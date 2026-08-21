/**
 * Contamination lexicon draw (DEC-076). Pure functions. No Phaser.
 * Morph tables come from CSV codegen. Quota / dialect / auto-rewrite live here.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import {
  DISPLAY_TOKEN_DATA,
  LEXEME_DATA,
  PORTFOLIO_DATA,
  SUBSTRATE_DATA,
  UTTERANCE_DATA,
  type ContinuityId,
  type CoverageId,
  type LexemeSlot,
  type OccupancyId,
  type PortfolioId,
} from '@/generated/contamination-lexicon-data';
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
  readonly kind: 'coverage' | 'substrate' | 'occupancy' | 'sense' | 'utterance_mark';
  readonly tokenId: string;
}

export interface SortiePinAvailability {
  readonly fragmentTypeId: string;
  readonly hasClusters: boolean;
  readonly hasWallEdges: boolean;
  readonly hasCorridors: boolean;
  /** When 甲 already owns the hearing axis, yi must not take 听噪. */
  readonly hearingAxisTaken?: boolean;
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
      ['oil_film', 3],
      ['organic_remnant', 2],
      ['wall_rust', 1],
    ],
    preferYiDing: 'ding',
  },
  'frag-clinic': {
    substrates: [
      ['lamp_pillar', 3],
      ['doorframe', 3],
      ['wall_rust', 2],
      ['organic_remnant', 1],
    ],
    preferYiDing: 'yi',
  },
  'frag-metro': {
    substrates: [
      ['wall_rust', 3],
      ['oil_film', 2],
      ['lamp_pillar', 2],
      ['doorframe', 2],
    ],
    preferYiDing: 'either',
  },
  'frag-library': {
    substrates: [
      ['doorframe', 3],
      ['wall_rust', 2],
      ['organic_remnant', 2],
    ],
    preferYiDing: 'yi',
  },
  'frag-residential': {
    substrates: [
      ['organic_remnant', 3],
      ['doorframe', 2],
      ['oil_film', 2],
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

export function encounterNodes(form: ContaminationForm): readonly EncounterNode[] {
  const nodes: EncounterNode[] = [
    { kind: 'coverage', tokenId: `coverage_${form.coverage}` },
    { kind: 'substrate', tokenId: form.substrate },
    { kind: 'occupancy', tokenId: `occupancy_${form.occupancy}` },
  ];
  if (form.occupancy === 'floor') {
    nodes.push({ kind: 'sense', tokenId: form.lexemes.sense });
  }
  if (form.utteranceId) {
    nodes.push({ kind: 'utterance_mark', tokenId: form.utteranceId });
  }
  return nodes;
}

/** Resolve an encounter node to the on-screen fragment. Never invents a whole sentence. */
export function displayTokenFor(node: EncounterNode): string {
  if (node.kind === 'coverage' || node.kind === 'occupancy') {
    return DISPLAY_TOKEN_DATA[node.tokenId]?.displayToken ?? node.tokenId;
  }
  if (node.kind === 'substrate') {
    return SUBSTRATE_DATA[node.tokenId]?.displayToken ?? node.tokenId;
  }
  if (node.kind === 'sense') {
    return LEXEME_DATA[node.tokenId]?.displayToken ?? node.tokenId;
  }
  return UTTERANCE_DATA[node.tokenId]?.onScreenMark ?? node.tokenId;
}

export function devicePrefix(): string {
  return DISPLAY_TOKEN_DATA.device_prefix?.displayToken ?? '识别。';
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

function rewriteLexeme(id: string, portfolio: PortfolioId): string {
  const row = LEXEME_DATA[id];
  if (!row) return id;
  const hit = row.rewrites.find((r) => r.portfolio === portfolio);
  return hit?.lexeme ?? id;
}

function residualMotion(substrate: string): string | null {
  switch (substrate) {
    case 'doorframe':
    case 'lamp_pillar':
      return 'motion_anchor';
    case 'organic_remnant':
      return 'motion_patrol';
    case 'wall_rust':
      return 'motion_wall';
    case 'fungal_mat':
      return 'motion_cluster';
    case 'oil_film':
      return 'motion_wind';
    default:
      return null;
  }
}

function legalSubstrates(portfolio: PortfolioId, fragmentTypeId: string): (readonly [string, number])[] {
  const occupancy = PORTFOLIO_DATA[portfolio].occupancy;
  const dialect = dialectOf(fragmentTypeId);
  const out: (readonly [string, number])[] = [];
  for (const [id, w] of dialect.substrates) {
    const sub = SUBSTRATE_DATA[id];
    if (!sub) continue;
    if (!sub.legalOccupancies.includes(occupancy)) continue;
    const contOk = sub.legalContinuities.some((c) =>
      PORTFOLIO_DATA[portfolio].legalContinuities.includes(c),
    );
    if (!contOk) continue;
    out.push([id, w]);
  }
  if (out.length > 0) return out;
  for (const sub of Object.values(SUBSTRATE_DATA)) {
    if (!sub.legalOccupancies.includes(occupancy)) continue;
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

function tryDrawOne(rng: SeededRandom, opts: DrawOneOpts): ContaminationForm | null {
  const port = PORTFOLIO_DATA[opts.portfolio];
  if (opts.preferUtterance) {
    const matching = Object.values(UTTERANCE_DATA).filter((u) => u.portfolio === opts.portfolio);
    if (matching.length > 0 && rng.next() < 0.35) {
      const u = rng.pick(matching);
      if (!opts.forbidSense || !opts.forbidSense.includes(u.sense)) {
        if (!opts.sense || opts.sense === u.sense) {
          const form = formFromUtterance(u.id);
          if (form) return form;
        }
      }
    }
  }

  const coverage = opts.coverage ?? pickCoverage(rng);
  const subPool = legalSubstrates(opts.portfolio, opts.fragmentTypeId);
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
    if (slot === 'sense' && opts.sense) {
      pool = pool.filter((id) => id === opts.sense);
    } else if (slot === 'sense' && opts.forbidSense) {
      pool = pool.filter((id) => !opts.forbidSense!.includes(id));
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

  if (pins.hasClusters && rng.next() < 0.7) {
    const bing = drawOne(rng, {
      portfolio: 'bing',
      fragmentTypeId: pins.fragmentTypeId,
      preferUtterance: true,
    });
    if (bing) forms.push(bing);
    else warnings.push('bing draw failed after retries');
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
