import { mix32 } from '@/generation/seed-fork';
import type { TileGrid } from '@/systems/tile-grid';
import type { Vector2 } from '@/types/game-types';
import type { KindlingTier } from '@/types/map-types';
import type { R100ExpeditionDefinition } from './r100-expedition';
import { validAutomaticSupplyPolicy, type R100AutomaticSupplyPolicy } from './automatic-supply-policy';
import { AutomaticSupplyNavigation, automaticSupplyBudget, type AutomaticSupplyCoverage } from './automatic-supply-navigation';

export interface AutomaticSupplyCandidate {
  readonly cell: number;
  readonly position: Vector2;
  readonly distance: number;
  readonly approachDistance: number;
  readonly interactionSeats: number;
  readonly pollutionDistance: number;
  readonly interactionCells: readonly number[];
  readonly tiers: readonly KindlingTier[];
  readonly environmentScore: number;
}
export interface AutomaticSupplySelection {
  readonly seat: AutomaticSupplyCandidate;
  readonly tier: KindlingTier;
  readonly kind: 'kindling' | 'contaminant';
  readonly necessaryFuel: boolean;
}
/** Admission is performed after enemy patrol placement. Cells are dry legal
 * operation stations, and non-safe nodes require a complete patrol window. */
export interface AutomaticSupplyAdmittedSeats {
  readonly nodeId: string;
  readonly position: Vector2;
  readonly cells: readonly number[];
}
interface Quota { readonly kind: 'kindling' | 'contaminant'; readonly tier: KindlingTier; remaining: number }
export interface AutomaticSupplyPlan {
  readonly selected: readonly AutomaticSupplySelection[];
  /** Must run after full placement/patrol admission; it rebuilds the distance
   * field from the actual final positions, never trusts incremental receipts. */
  readonly verify: (nodes: readonly { readonly id: string; readonly position: Vector2; readonly allowWeapon?: boolean; readonly tier: KindlingTier }[], contaminants: readonly { readonly id: string; readonly position: Vector2 }[], admittedSeats: readonly AutomaticSupplyAdmittedSeats[]) => Readonly<Record<string, unknown>>;
}
export function planAutomaticSupply(grid: TileGrid, originDistance: Float64Array, candidates: readonly AutomaticSupplyCandidate[],
  definition: R100ExpeditionDefinition, policy: R100AutomaticSupplyPolicy, seed: number, nodeSpacingPx: number): AutomaticSupplyPlan {
  if (!validAutomaticSupplyPolicy(policy) || policy.grade !== definition.grade_id) throw new Error('Invalid frozen automatic supply policy or grade');
  const navigation = new AutomaticSupplyNavigation(grid, originDistance, policy), coverageDistance = navigation.emptyDistances();
  const quotas: Quota[] = (['safe', 'contested', 'deep'] as const).flatMap(tier => (['kindling', 'contaminant'] as const).map(kind => ({
    tier, kind, remaining: kind === 'kindling' && tier === 'safe' ? Math.max(policy.earlyFuelNodes, definition.kindling_safe_count) : definition[`${kind}_${tier}_count`],
  })));
  const minimumNodes = quotas.reduce((sum, quota) => sum + quota.remaining, 0);
  const budget = automaticSupplyBudget(navigation.space, minimumNodes, policy);
  const selected: AutomaticSupplySelection[] = [];
  const admissible = candidates.filter(candidate => candidate.tiers.length > 0 && candidate.interactionCells.length > 0);
  const kindlingShare = quotas.filter(quota => quota.kind === 'kindling').reduce((sum, quota) => sum + quota.remaining, 0) / minimumNodes;
  let legalCoverage: AutomaticSupplyCoverage | undefined;
  const passes = (coverage: AutomaticSupplyCoverage): boolean => coverage.maxPx <= policy.maxCoveragePx && coverage.p95Px <= policy.p95CoveragePx;
  const fail = (reason: string, coverage = navigation.coverage(coverageDistance)): never => {
    throw Object.assign(new Error(`Automatic supply rejected: ${reason}`), { diagnostics: { automaticSupply: {
      stage: 'supply-placement', reason, ...navigation.space, budget, actualCount: selected.length, minimumNodes,
      legalCandidateCount: admissible.length, legalCoverage, quotas: quotas.map(quota => ({ ...quota })), coverage, work: { ...navigation.work },
    } } });
  };
  if (budget > policy.maxNodes) fail('node-budget');
  if (!admissible.length) fail(policy.earlyFuelNodes ? 'early-fuel-infeasible' : 'legal-coverage-infeasible');
  // Even unlimited nodes cannot improve on all legal interaction seats. Detect
  // a risk-tier coverage hole once before spending the finite placement budget.
  const legalSources = new Set<number>();
  for (const candidate of admissible) for (const cell of candidate.interactionCells) legalSources.add(cell);
  legalCoverage = navigation.coverage(navigation.distancesFrom([...legalSources]));
  if (!passes(legalCoverage)) fail('legal-tier-coverage-infeasible', legalCoverage);
  for (let slot = 0; slot < policy.maxNodes; slot++) {
    const coverage = navigation.coverage(coverageDistance), earlyFuel = slot < policy.earlyFuelNodes;
    if (slot >= budget && quotas.every(quota => quota.remaining === 0) && passes(coverage)) break;
    // Allocate scarce risk tiers before coverage-driven fillers can occupy
    // their only spaced locations. Counts and tier eligibility never change.
    const spaced = admissible.filter(candidate => !selected.some(other =>
      Math.hypot(other.seat.position.x-candidate.position.x,other.seat.position.y-candidate.position.y)<nodeSpacingPx));
    const required = quotas.filter(quota => quota.remaining > 0);
    const availability = new Map(required.map(quota => [quota,spaced.filter(candidate=>candidate.tiers.includes(quota.tier)).length]));
    required.sort((a,b)=>availability.get(a)!/a.remaining-availability.get(b)!/b.remaining);
    const priority = earlyFuel ? required.find(quota=>quota.kind==='kindling'&&quota.tier==='safe') : required[0];
    const targetDistance = !earlyFuel && selected.length ? navigation.distancesFrom([coverage.worstCell]) : undefined;
    let best: AutomaticSupplyCandidate | undefined, bestQuota: Quota | undefined, bestScore = Infinity;
    for (const candidate of spaced) {
      const quota = priority && candidate.tiers.includes(priority.tier) ? priority : undefined;
      if (required.length && !quota) continue;
      const route = earlyFuel || selected.length === 0 ? candidate.approachDistance : Math.min(...candidate.interactionCells.map(cell => targetDistance![cell]!));
      // Geodesic proximity has priority; source-material preference and seeded
      // order only break subpixel ties, and never consume hidden reward fields.
      const score = route - Math.min(100, Math.max(-100, candidate.environmentScore)) * .000001
        + mix32(seed, `automatic-supply-${slot}-${candidate.cell}`) / 0x100000000 * .0000001;
      if (score < bestScore || score === bestScore && candidate.cell < (best?.cell ?? Infinity)) { best = candidate; bestQuota = quota; bestScore = score; }
    }
    if (!best) return fail(earlyFuel ? 'early-fuel-infeasible' : required.length ? 'risk-tier-spacing-infeasible' : 'legal-coverage-infeasible', coverage);
    if (bestQuota) bestQuota.remaining--;
    const kind = bestQuota?.kind ?? (selected.filter(item => item.kind === 'kindling').length < (slot + 1) * kindlingShare ? 'kindling' : 'contaminant');
    const tier = bestQuota?.tier ?? best.tiers[0]!;
    selected.push({ seat: best, tier, kind, necessaryFuel: earlyFuel });
    navigation.addSources(coverageDistance, best.interactionCells);
  }
  const plannedCoverage = navigation.coverage(coverageDistance);
  if (selected.length < budget || quotas.some(quota => quota.remaining) || !passes(plannedCoverage)) fail('coverage-node-limit', plannedCoverage);
  return { selected, verify: (nodes, contaminants, admittedSeats) => {
    const actual = [...nodes, ...contaminants];
    if (actual.length !== selected.length) fail('final-node-count-mismatch');
    if (admittedSeats.length !== actual.length || new Set(admittedSeats.map(row => row.nodeId)).size !== actual.length) fail('final-admitted-seat-count-mismatch');
    const finalCells: number[] = [];
    const remaining = new Set(selected);
    for (const node of actual) {
      const item = [...remaining].find(candidate => candidate.seat.position.x === node.position.x && candidate.seat.position.y === node.position.y);
      if (!item) return fail('final-node-position-mismatch');
      const admitted = admittedSeats.find(row => row.nodeId === node.id && row.position.x === node.position.x && row.position.y === node.position.y);
      if (!admitted || !admitted.cells.length) return fail('final-node-missing-operation-seat');
      if (admitted.cells.some(cell => !item.seat.interactionCells.includes(cell) || !Number.isFinite(originDistance[cell]))) fail('final-operation-seat-invalid');
      remaining.delete(item); finalCells.push(...admitted.cells);
    }
    const safeFuelCount = nodes.filter(node => node.tier === 'safe' && node.allowWeapon === false).length;
    if (safeFuelCount < policy.earlyFuelNodes) fail('final-early-fuel-mismatch');
    const finalCoverage = navigation.coverage(navigation.distancesFrom(finalCells));
    if (!passes(finalCoverage)) fail('final-coverage-mismatch', finalCoverage);
    return { algorithm: policy.algorithm, sourceHash: policy.sourceHash, ...navigation.space, budget, minimumNodes,
      actualCount: actual.length, legalCoverage, safeFuelCount, requiredSafeFuel: policy.earlyFuelNodes, coverage: finalCoverage,
      planningCoverage: plannedCoverage, admittedSeatCounts: admittedSeats.map(row => ({ nodeId: row.nodeId, count: row.cells.length })),
      coverageBasis: 'shortest-20px-body-route-to-dry-48px-operation-seats-with-nonsafe-patrol-window', work: { ...navigation.work } };
  } };
}
