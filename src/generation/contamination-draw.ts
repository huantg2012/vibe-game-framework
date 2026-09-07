/**
 * Contamination lexicon draw (DEC-076). Pure functions. No Phaser.
 * Morph tables come from CSV codegen. Quota / dialect / auto-rewrite live here.
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

interface Dialect {
  readonly substrates: readonly (readonly [string, number])[];
  readonly preferYiDing: 'yi' | 'ding' | 'either';
}

/** Spec dialect table. Weights are biases, not bans (illegal crosses still discard). */
const DIALECT: Record<string, Dialect> = {
  'frag-outdoor': {
    substrates: [
      ['fungal_mat', 3],
      ['ash_veil', 3],
      ['oil_film', 3],
      ['space_interval', 3],
      ['organic_remnant', 2],
      ['stalk_clump', 2],
      ['sound_echo', 2],
      ['light_scatter', 2],
      ['wall_rust', 1],
      ['street_wreckage', 1],
      ['insect_remnant', 1],
      ['mammal_remnant', 1],
      ['worm_remnant', 1],
    ],
    preferYiDing: 'ding',
  },
  'frag-clinic': {
    substrates: [
      ['street_wreckage', 5],
      ['doorframe', 3],
      ['wall_rust', 2],
      ['light_scatter', 2],
      ['organic_remnant', 1],
      ['stalk_clump', 1],
      ['ash_veil', 1],
      ['space_interval', 1],
      ['sound_echo', 1],
      ['insect_remnant', 1],
      ['mammal_remnant', 1],
      ['worm_remnant', 1],
    ],
    preferYiDing: 'yi',
  },
  'frag-metro': {
    substrates: [
      ['wall_rust', 3],
      ['oil_film', 2],
      ['street_wreckage', 4],
      ['doorframe', 2],
      ['ash_veil', 2],
      ['sound_echo', 2],
      ['space_interval', 2],
      ['light_scatter', 1],
      ['insect_remnant', 1],
      ['mammal_remnant', 1],
      ['worm_remnant', 1],
    ],
    preferYiDing: 'either',
  },
  'frag-library': {
    substrates: [
      ['doorframe', 3],
      ['wall_rust', 2],
      ['organic_remnant', 2],
      ['street_wreckage', 2],
      ['sound_echo', 2],
      ['stalk_clump', 1],
      ['light_scatter', 1],
      ['space_interval', 1],
      ['insect_remnant', 1],
      ['mammal_remnant', 1],
      ['worm_remnant', 1],
    ],
    preferYiDing: 'yi',
  },
  'frag-residential': {
    substrates: [
      ['organic_remnant', 3],
      ['stalk_clump', 3],
      ['doorframe', 2],
      ['oil_film', 2],
      ['street_wreckage', 1],
      ['ash_veil', 1],
      ['space_interval', 1],
      ['sound_echo', 1],
      ['light_scatter', 1],
      ['insect_remnant', 1],
      ['mammal_remnant', 1],
      ['worm_remnant', 1],
    ],
    preferYiDing: 'yi',
  },
};

const DEFAULT_DIALECT: Dialect = DIALECT['frag-metro']!;

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

function dialectOf(fragmentTypeId: string): Dialect {
  return DIALECT[fragmentTypeId] ?? DEFAULT_DIALECT;
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

/** Runtime capability filter, not another source of shape data. CSV remains the legal alphabet. */
const RUNTIME_LEXEMES: Readonly<Record<PortfolioId, Readonly<Record<LexemeSlot, readonly string[]>>>> = {
  jia: {
    motion: ['motion_patrol', 'motion_turn', 'motion_anchor'],
    sense: ['sense_cone', 'sense_hear'],
    rhythm: ['rhythm_open'],
    contact: ['contact_melee_three'],
  },
  yi: {
    motion: ['motion_wall', 'motion_turn', 'motion_anchor'],
    sense: ['sense_touch'],
    rhythm: ['rhythm_open'],
    contact: ['contact_adjacent_strike'],
  },
  bing: {
    motion: ['motion_cluster'],
    sense: ['sense_touch'],
    rhythm: ['rhythm_cluster'],
    contact: ['contact_step_chaos'],
  },
  ding: {
    motion: ['motion_anchor', 'motion_wind', 'motion_trail'],
    sense: ['sense_domain'],
    rhythm: ['rhythm_open'],
    contact: ['contact_volume_chaos'],
  },
};

export type FloorMotion = 'motion_patrol' | 'motion_turn' | 'motion_anchor';

/** An anchored substrate cannot acquire translation through a stale or manually authored form. */
export function floorMotionFor(form: ContaminationForm): FloorMotion {
  if (form.substrate === 'doorframe' || form.substrate === 'street_wreckage' ||
      form.substrate === 'lamp_pillar' || form.substrate === 'railing_post' ||
      form.lexemes.motion === 'motion_anchor') return 'motion_anchor';
  return form.lexemes.motion === 'motion_turn' ? 'motion_turn' : 'motion_patrol';
}

/** Exact named recipes are admitted only when every promised axis has a runtime consumer. */
export function supportsRuntimeForm(form: ContaminationForm): boolean {
  return SLOTS.every((slot) => RUNTIME_LEXEMES[form.portfolio][slot].includes(form.lexemes[slot])) &&
    (form.occupancy !== 'floor' || floorMotionFor(form) === form.lexemes.motion);
}

function rewriteLexeme(id: string, portfolio: PortfolioId): string {
  const row = LEXEME_DATA[id];
  if (!row) return id;
  const hit = row.rewrites.find((r) => r.portfolio === portfolio);
  return hit?.lexeme ?? id;
}

/** Spec residual-motion lock. Ids not in the spec table have no lock. */
const RESIDUAL_MOTION: Readonly<Record<string, string>> = {
  doorframe: 'motion_anchor',
  lamp_pillar: 'motion_anchor',
  railing_post: 'motion_anchor',
  street_wreckage: 'motion_anchor',
  organic_remnant: 'motion_patrol',
  mammal_remnant: 'motion_patrol',
  stalk_clump: 'motion_turn',
  insect_remnant: 'motion_patrol',
  worm_remnant: 'motion_turn',
  wall_rust: 'motion_wall',
  fungal_mat: 'motion_cluster',
  oil_film: 'motion_wind',
  ash_veil: 'motion_cluster',
  sound_echo: 'motion_anchor',
  light_scatter: 'motion_trail',
  space_interval: 'motion_anchor',
};

function residualMotion(substrate: string): string | null {
  return RESIDUAL_MOTION[substrate] ?? null;
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
    if (!sub) continue;
    if (!inScope(sub, scope)) continue;
    if (!occupanciesForScope(sub, scope).includes(occupancy)) continue;
    const contOk = sub.legalContinuities.some((c) =>
      PORTFOLIO_DATA[portfolio].legalContinuities.includes(c),
    );
    if (!contOk) continue;
    out.push([id, w]);
  }
  if (out.length > 0) return out;
  for (const sub of Object.values(SUBSTRATE_DATA)) {
    if (!inScope(sub, scope)) continue;
    if (!occupanciesForScope(sub, scope).includes(occupancy)) continue;
    if (!sub.legalContinuities.some((c) => PORTFOLIO_DATA[portfolio].legalContinuities.includes(c))) {
      continue;
    }
    out.push([sub.id, 1]);
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

function pickCoverage(rng: SeededRandom): CoverageId {
  const roll = rng.next();
  if (roll < 0.5) return 'infiltrate';
  if (roll < 0.8) return 'rewrite';
  return 'overwrite';
}

export interface DrawOneOpts {
  readonly portfolio: PortfolioId;
  readonly fragmentTypeId: string;
  readonly coverage?: CoverageId;
  readonly substrate?: string;
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

function tryDrawOne(rng: SeededRandom, opts: DrawOneOpts): ContaminationForm | null {
  const port = PORTFOLIO_DATA[opts.portfolio];
  const scope: LexiconDrawScope = opts.scope ?? 'sortie';
  if (opts.preferUtterance) {
    const matching = Object.values(UTTERANCE_DATA).filter((u) => u.portfolio === opts.portfolio);
    if (matching.length > 0 && rng.next() < 0.35) {
      const u = rng.pick(matching);
      if (!opts.forbidSense || !opts.forbidSense.includes(u.sense)) {
        if (!opts.sense || opts.sense === u.sense) {
          const form = formFromUtterance(u.id);
          if (form && utteranceAllowed(form, scope)) {
            return form;
          }
          // Gym-only utterance on sortie: skip (do not occupy the draw with an
          // oil_film volume shadow). Fall through to a nameless draw.
        }
      }
    }
  }

  const coverage = opts.coverage ?? pickCoverage(rng);
  const subPool = legalSubstrates(opts.portfolio, opts.fragmentTypeId, scope);
  const substrate = opts.substrate ?? pickWeighted(rng, subPool);
  if (!substrate) return null;
  const continuity = pickContinuity(rng, opts.portfolio, substrate);
  if (!continuity) return null;

  const lexemes: { motion: string; sense: string; rhythm: string; contact: string } = {
    motion: '',
    sense: '',
    rhythm: '',
    contact: '',
  };

  for (const slot of SLOTS) {
    let pool = lexemesFor(slot, opts.portfolio);
    if (scope === 'sortie') {
      pool = pool.filter((id) => RUNTIME_LEXEMES[opts.portfolio][slot].includes(id));
    }
    if (slot === 'sense' && opts.sense) {
      pool = pool.filter((id) => id === opts.sense);
    } else if (slot === 'sense' && opts.forbidSense) {
      pool = pool.filter((id) => !opts.forbidSense!.includes(id));
    }
    if (slot === 'motion' && opts.portfolio === 'jia' && residualMotion(substrate) === 'motion_anchor') {
      pool = pool.filter((id) => id === 'motion_anchor');
    }
    if (slot === 'motion' && coverage === 'infiltrate') {
      const lock = residualMotion(substrate);
      if (lock && pool.includes(lock)) pool = [lock];
    }
    if (pool.length === 0) return null;
    const raw = rng.pick(pool);
    const rewritten = rewriteLexeme(raw, opts.portfolio);
    const legal = lexemesFor(slot, opts.portfolio);
    if (!legal.includes(rewritten)) return null;
    lexemes[slot] = rewritten;
  }

  if (opts.portfolio !== 'jia' && lexemes.contact === 'contact_melee_three') return null;

  return {
    substrate,
    coverage,
    continuity,
    occupancy: port.occupancy,
    portfolio: opts.portfolio,
    lexemes,
  };
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
  const yiOk = pins.hasWallEdges;
  const dingOk = pins.hasCorridors;
  if (!yiOk && !dingOk) return null;
  if (yiOk && !dingOk) return 'yi';
  if (!yiOk && dingOk) return 'ding';
  if (dialect.preferYiDing === 'yi') return rng.next() < 0.75 ? 'yi' : 'ding';
  if (dialect.preferYiDing === 'ding') return rng.next() < 0.75 ? 'ding' : 'yi';
  return rng.next() < 0.5 ? 'yi' : 'ding';
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
  if (!alt) warnings.push('no wall edge or corridor pin; skipped yi/ding');

  let hearingOnAlt = false;
  if (alt === 'yi') {
    const yiOpts = {
      portfolio: 'yi' as const,
      fragmentTypeId: pins.fragmentTypeId,
      preferUtterance: true,
      forbidSense: pins.hearingAxisTaken ? (['sense_hear'] as const) : undefined,
      sense: pins.hearingAxisTaken ? undefined : ('sense_hear' as const),
    };
    const withHear = pins.hearingAxisTaken ? null : drawOne(rng, yiOpts);
    if (withHear) {
      forms.push(withHear);
      hearingOnAlt = true;
    } else {
      const any = drawOne(rng, {
        portfolio: 'yi',
        fragmentTypeId: pins.fragmentTypeId,
        forbidSense: ['sense_hear'],
        preferUtterance: true,
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
          substrate: 'organic_remnant',
          sense: 'sense_cone',
        }) ?? INFILTRATOR_FORM
      : drawOne(rng, {
          portfolio: 'jia',
          fragmentTypeId: pins.fragmentTypeId,
          sense: needHear ? 'sense_hear' : undefined,
          forbidSense: forbidHear ? ['sense_hear'] : needHear ? undefined : ['sense_hear'],
        });
    if (!form) {
      warnings.push(`jia[${i}] draw failed after retries`);
      if (extractGate) forms.unshift(INFILTRATOR_FORM);
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
        substrate: 'organic_remnant',
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
