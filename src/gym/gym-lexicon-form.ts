/**
 * Practice-field config table for contamination lexicon dimensions.
 * Options come from CSV codegen. Illegal crosses are dropped from the selects.
 */

import type { ContaminationForm } from '@/generation/contamination-draw';
import {
  LEXEME_DATA,
  PORTFOLIO_DATA,
  SUBSTRATE_DATA,
  UTTERANCE_DATA,
  type CoverageId,
  type ContinuityId,
  type LexemeSlot,
  type PortfolioId,
} from '@/generated/contamination-lexicon-data';
import type { EnemyRole } from '@/generated/enemy-data';

export interface LexiconGymConfig {
  readonly portfolio: PortfolioId;
  readonly coverage: CoverageId;
  readonly substrate: string;
  readonly continuity: ContinuityId;
  readonly motion: string;
  readonly sense: string;
  readonly rhythm: string;
  readonly contact: string;
  readonly utteranceId: string;
  readonly count: number;
}

const COVERAGES: readonly { id: CoverageId; label: string }[] = [
  { id: 'infiltrate', label: '渗透' },
  { id: 'rewrite', label: '改写' },
  { id: 'overwrite', label: '覆盖' },
];

const PORTFOLIOS: readonly { id: PortfolioId; label: string }[] = [
  { id: 'jia', label: '甲 · 占地' },
  { id: 'yi', label: '乙 · 占墙' },
  { id: 'bing', label: '丙 · 占漆' },
  { id: 'ding', label: '丁 · 占空' },
];

export function portfolioOptions(): readonly { id: PortfolioId; label: string }[] {
  return PORTFOLIOS;
}

export function coverageOptions(): readonly { id: CoverageId; label: string }[] {
  return COVERAGES;
}

/** Full CSV table (gym + sortie). Filter by this portfolio's occupancy so 甲 never sees volume-only rows. */
export function substrateOptions(portfolio: PortfolioId): readonly { id: string; label: string }[] {
  const occ = PORTFOLIO_DATA[portfolio].occupancy;
  return Object.values(SUBSTRATE_DATA)
    .filter((row) => row.legalOccupancies.includes(occ))
    .map((row) => ({ id: row.id, label: row.displayToken }));
}

export function continuityOptions(
  portfolio: PortfolioId,
  substrate: string,
): readonly { id: ContinuityId; label: string }[] {
  const port = PORTFOLIO_DATA[portfolio];
  const sub = SUBSTRATE_DATA[substrate];
  const labels: Record<ContinuityId, string> = {
    monolith: '整块',
    shards: '碎裂',
    colony: '菌落',
    field: '场',
  };
  const legal = port.legalContinuities.filter((c) => !sub || sub.legalContinuities.includes(c));
  return legal.map((id) => ({ id, label: labels[id] }));
}

export function lexemeOptions(
  slot: LexemeSlot,
  portfolio: PortfolioId,
): readonly { id: string; label: string }[] {
  return Object.values(LEXEME_DATA)
    .filter((row) => row.slot === slot && row.legalPortfolios.includes(portfolio))
    .map((row) => ({ id: row.id, label: row.displayToken }));
}

export function utteranceOptions(
  portfolio: PortfolioId,
): readonly { id: string; label: string }[] {
  return Object.values(UTTERANCE_DATA)
    .filter((row) => row.portfolio === portfolio)
    .map((row) => ({ id: row.id, label: `${row.onScreenMark}（${row.internalLabel}）` }));
}

export function applyUtterance(id: string): LexiconGymConfig | null {
  const u = UTTERANCE_DATA[id];
  if (!u) return null;
  return {
    portfolio: u.portfolio,
    coverage: u.coverage,
    substrate: u.substrate,
    continuity: u.continuity,
    motion: u.motion,
    sense: u.sense,
    rhythm: u.rhythm,
    contact: u.contact,
    utteranceId: u.id,
    count: 1,
  };
}

export function formFromConfig(config: LexiconGymConfig): ContaminationForm | string {
  const port = PORTFOLIO_DATA[config.portfolio];
  const sub = SUBSTRATE_DATA[config.substrate];
  if (!sub) return '基体不在表里';
  if (!sub.legalOccupancies.includes(port.occupancy)) return '基体与孔谱占位不合';
  if (!port.legalContinuities.includes(config.continuity)) return '连续性与孔谱不合';
  if (!sub.legalContinuities.includes(config.continuity)) return '连续性与基体不合';
  const slots: readonly LexemeSlot[] = ['motion', 'sense', 'rhythm', 'contact'];
  const picked = {
    motion: config.motion,
    sense: config.sense,
    rhythm: config.rhythm,
    contact: config.contact,
  };
  for (const slot of slots) {
    const id = picked[slot];
    const row = LEXEME_DATA[id];
    if (!row || row.slot !== slot) return `${slot} 词素不在表里`;
    if (!row.legalPortfolios.includes(config.portfolio)) return `${row.displayToken} 不能填这个孔谱`;
  }
  if (config.count < 1 || config.count > 3) return '数量须为 1–3';
  return {
    substrate: config.substrate,
    coverage: config.coverage,
    continuity: config.continuity,
    occupancy: port.occupancy,
    portfolio: config.portfolio,
    lexemes: picked,
    utteranceId: config.utteranceId || undefined,
  };
}

export function jiaRoleFor(form: ContaminationForm): EnemyRole {
  return form.lexemes.sense === 'sense_hear' ? 'rewriter' : 'infiltrator';
}

export function defaultConfig(): LexiconGymConfig {
  return {
    portfolio: 'jia',
    coverage: 'infiltrate',
    substrate: 'organic_remnant',
    continuity: 'monolith',
    motion: 'motion_patrol',
    sense: 'sense_cone',
    rhythm: 'rhythm_open',
    contact: 'contact_melee_three',
    utteranceId: '',
    count: 1,
  };
}
