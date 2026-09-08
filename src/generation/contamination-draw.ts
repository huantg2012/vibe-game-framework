/**
 * Contamination lexicon draw (DEC-076). Pure functions. No Phaser.
 * Morphology, capability and map weights come from CSV codegen; this module resolves legal draws.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import {
  CONCEPTUAL_SUBSTRATE_IDS,
  LEXEME_DATA,
  OBSERVE_LINE_DATA,
  PORTFOLIO_DATA,
  SUBSTRATE_DATA,
  UTTERANCE_DATA,
  type ContinuityId,
  type CoverageId,
  type LexemeSlot,
  type ObserveCoverageBucket,
  type ObserveLineDef,
  type OccupancyId,
  type PortfolioId,
  type SubstrateDef,
  type SubstrateEnabledScope,
} from '@/generated/contamination-lexicon-data';
import { FAMILY_CAPABILITY_DATA, CONTAMINATION_DIALECT_DATA, CONTAMINATION_ENCOUNTER_DATA, type FamilyCapability, type ContaminationDialect } from '@/generated/contamination-family-data';
import { mix32 } from '@/generation/seed-fork';
import type { ContaminationAge } from '@/generation/types';
import { SeededRandom } from '@/utils/random';

export interface ContaminationForm {
  readonly substrate: string;
  readonly coverage: CoverageId;
  readonly continuity: ContinuityId;
  readonly occupancy: OccupancyId;
  readonly portfolio: PortfolioId;
  readonly lexemes: {
    readonly motion: string;
    readonly sense: string;
    readonly rhythm: string;
    readonly contact: string;
  };
  readonly utteranceId?: string;
}

export interface EncounterNode {
  readonly kind: 'observe' | 'utterance_mark';
  readonly tokenId: string;
}

export interface SortiePinAvailability {
  readonly fragmentTypeId: string;
  /** Occupancy-paint copies this sortie. 0 = skip 丙 (tests / empty pin layers). */
  readonly paintCount: number;
  readonly hasWallEdges: boolean;
  /** False excludes frames when no architectural opening exists. */
  readonly hasWallOpenings?: boolean;
  readonly hasCorridors: boolean;
  /** When 甲 already owns the hearing axis, yi must not take 听噪. */
  readonly hearingAxisTaken?: boolean;
}

/** Closed integer ranges by `contaminationAge`. Do not multiply by area or path length. */
export const PAINT_HOST_COUNT_RANGE: Record<ContaminationAge, readonly [number, number]> = {
  new: [3, 5],
  standard: [6, 8],
  ancient: [9, 12],
};

/** `N = lo + floor(rng × (hi − lo + 1))` with `mix32(layout.seed, 'paint-count')`. */
export function rollPaintHostCount(layoutSeed: number, age: ContaminationAge): number {
  const range = PAINT_HOST_COUNT_RANGE[age];
  const lo = range[0];
  const hi = range[1];
  const rng = new SeededRandom(mix32(layoutSeed, 'paint-count'));
  return lo + Math.floor(rng.next() * (hi - lo + 1));
}

export interface SortieDraw {
  readonly forms: readonly ContaminationForm[];
  readonly warnings: readonly string[];
}

const RETRY = GAME_CONSTANTS.CONTAMINATION.DRAW_RETRY_LIMIT;
const SLOTS: readonly LexemeSlot[] = ['motion', 'sense', 'rhythm', 'contact'];
const COVERAGES: readonly CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];

export const INFILTRATOR_FORM: ContaminationForm = {
  substrate: 'organic_remnant',
  coverage: 'infiltrate',
  continuity: 'monolith',
  occupancy: 'floor',
  portfolio: 'jia',
  lexemes: {
    motion: 'motion_patrol',
    sense: 'sense_cone',
    rhythm: 'rhythm_open',
    contact: 'contact_melee_three',
  },
};

export const REWRITER_FORM: ContaminationForm = {
  substrate: 'organic_remnant',
  coverage: 'rewrite',
  continuity: 'monolith',
  occupancy: 'floor',
  portfolio: 'jia',
  lexemes: {
    motion: 'motion_patrol',
    sense: 'sense_hear',
    rhythm: 'rhythm_open',
    contact: 'contact_melee_three',
  },
};

export function identityKey(form: ContaminationForm): string {
  if (form.utteranceId) return form.utteranceId;
  const base = `${form.coverage}|${form.substrate}|${form.occupancy}|${form.continuity}`;
  if (form.occupancy === 'floor') return `${base}|${form.lexemes.sense}`;
  return base;
}

function coverageBucketOf(coverage: CoverageId): ObserveCoverageBucket {
  return coverage === 'infiltrate' ? 'infiltrate' : 'overwrite';
}

function floorSenseBucket(senseId: string): 'cone' | 'hear' {
  return senseId === 'sense_hear' ? 'hear' : 'cone';
}

/** Nameless / utterance observe-line pool for one form. Utterance rows win. */
export function observePoolFor(form: ContaminationForm): readonly ObserveLineDef[] {
  const rows = Object.values(OBSERVE_LINE_DATA);
  if (form.utteranceId) {
    return rows.filter((row) => row.utteranceId === form.utteranceId);
  }
  if (form.occupancy === 'floor') {
    const sense = floorSenseBucket(form.lexemes.sense);
    return rows.filter((row) => row.occupancy === 'floor' && row.sense === sense && !row.utteranceId);
  }
  const bucket = coverageBucketOf(form.coverage);
  return rows.filter(
    (row) => row.occupancy === form.occupancy && row.coverageBucket === bucket && !row.utteranceId,
  );
}

export function pickObserveLine(form: ContaminationForm, hostSeed = 0): ObserveLineDef | null {
  const pool = observePoolFor(form);
  if (pool.length === 0) return null;
  return new SeededRandom(mix32(hostSeed, 'observe-line')).pick(pool);
}

export function encounterNodes(form: ContaminationForm, hostSeed = 0): readonly EncounterNode[] {
  const line = pickObserveLine(form, hostSeed);
  if (!line) return [];
  const nodes: EncounterNode[] = [{ kind: 'observe', tokenId: line.id }];
  if (form.utteranceId) {
    nodes.push({ kind: 'utterance_mark', tokenId: form.utteranceId });
  }
  return nodes;
}

/** Resolve an encounter node to the on-screen fragment. Never invents a whole sentence. */
export function displayTokenFor(node: EncounterNode): string {
  if (node.kind === 'observe') {
    return OBSERVE_LINE_DATA[node.tokenId]?.displayToken ?? node.tokenId;
  }
  return UTTERANCE_DATA[node.tokenId]?.onScreenMark ?? node.tokenId;
}

export type LexiconDrawScope = SubstrateEnabledScope;

/**
 * Occupancy view for a substrate. Gym follows CSV.
 * Sortie reads codegen's `sortieLegalOccupancies` (pairing: conceptual
 * substrates on sortie ↔ oil_film drops volume).
 */
export function occupanciesForScope(
  sub: SubstrateDef,
  scope: LexiconDrawScope,
): readonly OccupancyId[] {
  return scope === 'sortie' ? sub.sortieLegalOccupancies : sub.legalOccupancies;
}

export function conceptualSubstratesOnSortie(): boolean {
  return CONCEPTUAL_SUBSTRATE_IDS.some((id) => SUBSTRATE_DATA[id]?.enabledScope === 'sortie');
}

function dialectOf(fragmentTypeId: string): ContaminationDialect {
  return CONTAMINATION_DIALECT_DATA[fragmentTypeId] ?? { substrates: [], wallHostWeight: 0, volumeHostWeight: 0 };
}

function pickWeighted(rng: SeededRandom, items: readonly (readonly [string, number])[]): string | null {
  let total = 0;
  for (const [, w] of items) total += w;
  if (total <= 0) return null;
  let roll = rng.next() * total;
  for (const [id, w] of items) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return items[items.length - 1]?.[0] ?? null;
}

function lexemesFor(slot: LexemeSlot, portfolio: PortfolioId): string[] {
  return Object.values(LEXEME_DATA)
    .filter((row) => row.slot === slot && row.legalPortfolios.includes(portfolio))
    .map((row) => row.id);
}

/** One data source for generation and runtime capability checks. */
export function familyCapabilityFor(substrate: string, portfolio: PortfolioId): FamilyCapability | undefined {
  return FAMILY_CAPABILITY_DATA.find((row) => row.substrate === substrate && row.portfolio === portfolio);
}

export function motionChoicesFor(substrate: string, portfolio: PortfolioId, coverage: CoverageId): readonly string[] {
  const family = familyCapabilityFor(substrate, portfolio);
  if (!family) return [];
  return coverage === 'infiltrate' ? [family.infiltrateMotion] : family.motion;
}

export type FloorMotion = 'motion_patrol' | 'motion_turn' | 'motion_anchor';

export function floorMotionFor(form: ContaminationForm): FloorMotion {
  const choices = motionChoicesFor(form.substrate, form.portfolio, form.coverage);
  const motion = choices.includes(form.lexemes.motion) ? form.lexemes.motion : choices[0];
  return motion === 'motion_patrol' || motion === 'motion_turn' ? motion : 'motion_anchor';
}

export function supportsRuntimeForm(form: ContaminationForm): boolean {
  const family = familyCapabilityFor(form.substrate, form.portfolio);
  const port = PORTFOLIO_DATA[form.portfolio];
  const sub = SUBSTRATE_DATA[form.substrate];
  return !!family && sub?.enabledScope === 'sortie' && form.occupancy === port.occupancy &&
    sub.sortieLegalOccupancies.includes(form.occupancy) &&
    sub.legalContinuities.includes(form.continuity) && port.legalContinuities.includes(form.continuity) &&
    SLOTS.every((slot) => family[slot].includes(form.lexemes[slot])) &&
    motionChoicesFor(form.substrate, form.portfolio, form.coverage).includes(form.lexemes.motion);
}

function inScope(sub: SubstrateDef, scope: LexiconDrawScope): boolean {
  return scope === 'gym' || sub.enabledScope === 'sortie';
}

function legalSubstrates(
  portfolio: PortfolioId,
  fragmentTypeId: string,
  scope: LexiconDrawScope,
): (readonly [string, number])[] {
  const occupancy = PORTFOLIO_DATA[portfolio].occupancy;
  const dialect = dialectOf(fragmentTypeId);
  const out: (readonly [string, number])[] = [];
  for (const [id, w] of dialect.substrates) {
    const sub = SUBSTRATE_DATA[id];
    if (!sub || w <= 0) continue;
    if (!inScope(sub, scope)) continue;
    if (!occupanciesForScope(sub, scope).includes(occupancy)) continue;
    const contOk = sub.legalContinuities.some((c) =>
      PORTFOLIO_DATA[portfolio].legalContinuities.includes(c),
    );
    if (!contOk) continue;
    out.push([id, w]);
  }
  return out;
}

function pickContinuity(
  rng: SeededRandom,
  portfolio: PortfolioId,
  substrate: string,
): ContinuityId | null {
  const port = PORTFOLIO_DATA[portfolio];
  const sub = SUBSTRATE_DATA[substrate];
  if (!sub) return null;
  const inter = port.legalContinuities.filter((c) => sub.legalContinuities.includes(c));
  if (inter.length === 0) return null;
  if (inter.includes(port.continuity) && rng.next() < 0.7) return port.continuity;
  return rng.pick(inter);
}

export interface DrawOneOpts {
  readonly portfolio: PortfolioId;
  readonly fragmentTypeId: string;
  readonly coverage?: CoverageId;
  readonly substrate?: string;
  readonly forbidSubstrate?: readonly string[];
  readonly motion?: string;
  readonly forbidMotion?: readonly string[];
  readonly rhythm?: string;
  readonly forbidRhythm?: readonly string[];
  readonly sense?: string;
  readonly forbidSense?: readonly string[];
  readonly preferUtterance?: boolean;
  /** Default sortie: never leak gym-only rows into the rift. */
  readonly scope?: LexiconDrawScope;
}

function formFromUtterance(id: string): ContaminationForm | null {
  const u = UTTERANCE_DATA[id];
  if (!u) return null;
  return {
    substrate: u.substrate,
    coverage: u.coverage,
    continuity: u.continuity,
    occupancy: u.occupancy,
    portfolio: u.portfolio,
    lexemes: { motion: u.motion, sense: u.sense, rhythm: u.rhythm, contact: u.contact },
    utteranceId: u.id,
  };
}

function utteranceAllowed(form: ContaminationForm, scope: LexiconDrawScope): boolean {
  if (scope === 'gym') return true;
  const sub = SUBSTRATE_DATA[form.substrate];
  return sub?.enabledScope === 'sortie' && supportsRuntimeForm(form);
}

function slotChoices(slot: LexemeSlot, substrate: string, coverage: CoverageId, opts: DrawOneOpts): readonly string[] {
  const family = familyCapabilityFor(substrate, opts.portfolio);
  let choices: readonly string[] = (opts.scope ?? 'sortie') === 'sortie'
    ? slot === 'motion' ? motionChoicesFor(substrate, opts.portfolio, coverage) : family?.[slot] ?? []
    : lexemesFor(slot, opts.portfolio);
  if (slot === 'motion') {
    if (opts.scope === 'gym' && coverage === 'infiltrate' && family) choices = [family.infiltrateMotion];
    if (opts.motion) choices = choices.filter((id) => id === opts.motion);
    if (opts.forbidMotion) choices = choices.filter((id) => !opts.forbidMotion!.includes(id));
  }
  if (slot === 'rhythm') {
    if (opts.rhythm) choices = choices.filter((id) => id === opts.rhythm);
    if (opts.forbidRhythm) choices = choices.filter((id) => !opts.forbidRhythm!.includes(id));
  }
  if (slot === 'sense') {
    if (opts.sense) choices = choices.filter((id) => id === opts.sense);
    if (opts.forbidSense) choices = choices.filter((id) => !opts.forbidSense!.includes(id));
  }
  return choices;
}

function tryDrawOne(rng: SeededRandom, opts: DrawOneOpts): ContaminationForm | null {
  const port = PORTFOLIO_DATA[opts.portfolio];
  const scope = opts.scope ?? 'sortie';
  // Explicit gym inspection may select gym-only substrates outside sortie dialects.
  const gymSub = scope === 'gym' && opts.substrate ? SUBSTRATE_DATA[opts.substrate] : undefined;
  const legal = gymSub
    ? occupanciesForScope(gymSub, scope).includes(port.occupancy) && gymSub.legalContinuities.some((c) => port.legalContinuities.includes(c))
      ? [[gymSub.id, 1] as const] : []
    : legalSubstrates(opts.portfolio, opts.fragmentTypeId, scope).filter(([id]) => !opts.substrate || id === opts.substrate);
  const candidates = legal.filter(([id]) => !opts.forbidSubstrate?.includes(id));
  const viableCoverages = (opts.coverage ? [opts.coverage] : COVERAGES).filter((coverage) =>
    candidates.some(([id]) => SLOTS.every((slot) => slotChoices(slot, id, coverage, opts).length > 0)));
  if (viableCoverages.length === 0) return null;
  if (opts.preferUtterance) {
    const matching = Object.values(UTTERANCE_DATA).filter((u) => {
      if (u.portfolio !== opts.portfolio || !viableCoverages.includes(u.coverage) || !candidates.some(([id]) => id === u.substrate)) return false;
      const form = formFromUtterance(u.id);
      return !!form && utteranceAllowed(form, scope) && SLOTS.every((slot) => slotChoices(slot, u.substrate, u.coverage, opts).includes(form.lexemes[slot]));
    });
    if (matching.length > 0 && rng.next() < 0.35) return formFromUtterance(rng.pick(matching).id);
  }
  const coverage = opts.coverage ?? pickWeighted(rng, viableCoverages.map((id) => [id, id === 'infiltrate' ? 5 : id === 'rewrite' ? 3 : 2] as const)) as CoverageId;
  const pool = candidates.filter(([id]) => SLOTS.every((slot) => slotChoices(slot, id, coverage, opts).length > 0));
  const substrate = pickWeighted(rng, pool);
  if (!substrate) return null;
  const continuity = pickContinuity(rng, opts.portfolio, substrate);
  if (!continuity) return null;
  const lexemes = { motion: '', sense: '', rhythm: '', contact: '' };
  for (const slot of SLOTS) lexemes[slot] = rng.pick([...slotChoices(slot, substrate, coverage, opts)]);
  return { substrate, coverage, continuity, occupancy: port.occupancy, portfolio: opts.portfolio, lexemes };
}

export function drawOne(rng: SeededRandom, opts: DrawOneOpts): ContaminationForm | null {
  for (let i = 0; i < RETRY; i++) {
    const form = tryDrawOne(rng, opts);
    if (form) return form;
  }
  return null;
}

function pickYiOrDing(rng: SeededRandom, pins: SortiePinAvailability): PortfolioId | null {
  const dialect = dialectOf(pins.fragmentTypeId);
  const yiOk = pins.hasWallEdges && dialect.wallHostWeight > 0 && legalSubstrates('yi', pins.fragmentTypeId, 'sortie').length > 0;
  const dingOk = pins.hasCorridors && dialect.volumeHostWeight > 0 && legalSubstrates('ding', pins.fragmentTypeId, 'sortie').length > 0;
  if (!yiOk && !dingOk) return null;
  if (yiOk && !dingOk) return 'yi';
  if (!yiOk && dingOk) return 'ding';
  const total = dialect.wallHostWeight + dialect.volumeHostWeight;
  if (total <= 0) return null;
  const roll = rng.next() * total;
  // Preserve the existing seed partition: the preferred host occupies the first interval.
  return dialect.volumeHostWeight > dialect.wallHostWeight
    ? roll < dialect.volumeHostWeight ? 'ding' : 'yi'
    : roll < dialect.wallHostWeight ? 'yi' : 'ding';
}

/**
 * Draw one sortie of forms. Does not place them on the map.
 * Hearing axis: exactly one `sense_hear` among the returned forms when possible.
 */
export function drawSortie(rng: SeededRandom, pins: SortiePinAvailability): SortieDraw {
  const warnings: string[] = [];
  const forms: ContaminationForm[] = [];
  const jiaCount = pins.hearingAxisTaken ? 0 : rng.nextInt(2, 3);

  const alt = pickYiOrDing(rng, pins);
  if (!alt) warnings.push('no legal production environment host with a matching pin; skipped yi/ding');

  let hearingOnAlt = false;
  if (alt === 'yi') {
    const encounter = CONTAMINATION_ENCOUNTER_DATA[pins.fragmentTypeId];
    const preferWallHear = !pins.hearingAxisTaken && !!encounter && rng.next() *
      (encounter.hearingWallWeight + encounter.hearingFloorWeight) < encounter.hearingWallWeight;
    const withHear = preferWallHear ? drawOne(rng, {
      portfolio: 'yi', fragmentTypeId: pins.fragmentTypeId, forbidSubstrate: pins.hasWallOpenings === false ? ['doorframe'] : undefined, preferUtterance: true, sense: 'sense_hear',
    }) : null;
    if (withHear) { forms.push(withHear); hearingOnAlt = true; }
    else {
      const any = drawOne(rng, {
        portfolio: 'yi', fragmentTypeId: pins.fragmentTypeId, forbidSubstrate: pins.hasWallOpenings === false ? ['doorframe'] : undefined, forbidSense: ['sense_hear'], preferUtterance: true,
      });
      if (any) forms.push(any);
      else warnings.push('yi draw failed after retries');
    }
  } else if (alt === 'ding') {
    const ding = drawOne(rng, {
      portfolio: 'ding',
      fragmentTypeId: pins.fragmentTypeId,
      preferUtterance: true,
    });
    if (ding) forms.push(ding);
    else warnings.push('ding draw failed after retries');
  }

  for (let i = 0; i < jiaCount; i++) {
    const extractGate = i === 0;
    const needHear = !hearingOnAlt && i === 1;
    const forbidHear = hearingOnAlt || extractGate;
    const form = extractGate
      ? drawOne(rng, {
          portfolio: 'jia',
          fragmentTypeId: pins.fragmentTypeId,
          coverage: 'infiltrate',
          rhythm: 'rhythm_open',
          motion: 'motion_patrol',
          sense: 'sense_cone',
        })
      : drawOne(rng, {
          portfolio: 'jia',
          fragmentTypeId: pins.fragmentTypeId,
          motion: 'motion_patrol',
          sense: needHear ? 'sense_hear' : undefined,
          forbidSense: forbidHear ? ['sense_hear'] : needHear ? undefined : ['sense_hear'],
        });
    if (!form) {
      warnings.push(`jia[${i}] draw failed after retries`);

      continue;
    }
    if (extractGate) forms.unshift(form);
    else forms.push(form);
  }

  if (pins.paintCount > 0) {
    const bing = drawOne(rng, {
      portfolio: 'bing',
      fragmentTypeId: pins.fragmentTypeId,
      preferUtterance: true,
    });
    if (bing) {
      for (let i = 0; i < pins.paintCount; i++) forms.push(bing);
    } else {
      warnings.push('bing draw failed after retries');
    }
  }

  const hearCount = forms.filter((f) => f.lexemes.sense === 'sense_hear').length;
  if (pins.hearingAxisTaken) {
    if (hearCount !== 0) warnings.push(`hearing axis already taken but draw produced ${hearCount}`);
  } else if (hearCount !== 1) {
    const jiaIdx = forms.findIndex((f) => f.portfolio === 'jia' && f.lexemes.sense !== 'sense_cone');
    if (hearCount === 0 && jiaIdx >= 0) {
      const patched = drawOne(rng, {
        portfolio: 'jia',
        fragmentTypeId: pins.fragmentTypeId,
        sense: 'sense_hear',
        motion: 'motion_patrol',
        coverage: 'rewrite',
      });
      if (patched) forms[jiaIdx] = patched;
    }
    const again = forms.filter((f) => f.lexemes.sense === 'sense_hear').length;
    if (again !== 1) warnings.push(`hearing axis count ${again} (want 1)`);
  }

  return { forms, warnings };
}

export function isHearingAxis(form: ContaminationForm): boolean {
  return form.lexemes.sense === 'sense_hear';
}

export { COVERAGES };
