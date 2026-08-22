/**
 * Visual-identity catalog for the contamination-lexicon gallery lesson (I4-A).
 * Pure. No Phaser. No attach. Scene code only consumes this list.
 *
 * Occupying fields per portfolio come from `docs/tasks/iteration-4.md` (静帧占格表).
 * Do not re-derive “does this field change pixels?” here.
 */

import type { ContaminationForm } from '@/generation/contamination-draw';
import { mix32 } from '@/generation/seed-fork';
import {
  PORTFOLIO_DATA,
  SUBSTRATE_DATA,
  type ContinuityId,
  type CoverageId,
  type LexemeSlot,
  type PortfolioId,
  type SubstrateEnabledScope,
} from '@/generated/contamination-lexicon-data';
import {
  applyUtterance,
  continuityOptions,
  coverageOptions,
  formFromConfig,
  lexemeOptions,
  portfolioOptions,
  substrateOptions,
  utteranceOptions,
  type LexiconGymConfig,
} from '@/gym/gym-lexicon-form';
import { resolveStopLoss, type StopLossProfile } from '@/systems/contamination-host-live';

/** Grid seed for 乙 / 丙 / 丁. Named so the sidebar can point at it. */
export const CANONICAL_SEED = 20260822;

export type GallerySeedBucket = 0 | 1 | 2;

export interface GallerySpecimen {
  readonly visualKey: string;
  readonly form: ContaminationForm;
  readonly seed: number;
  readonly seedBucket: GallerySeedBucket;
  readonly utteranceIds: readonly string[];
  readonly stopLoss: StopLossProfile | 'illegal';
  readonly enabledScope: SubstrateEnabledScope;
  readonly portfolio: PortfolioId;
  readonly substrate: string;
}

export interface GalleryEnumerateOpts {
  readonly includeIllegal?: boolean;
  /** Accepted so callers can pass the sidebar fragment. Identity ignores it. */
  readonly fragmentTypeId?: string;
}

export interface GalleryAxes {
  readonly occupying: readonly string[];
  readonly nonOccupying: readonly string[];
}

export interface GalleryDedupeCopy {
  readonly occupying: readonly { readonly item: string }[];
  readonly nonOccupying: readonly { readonly item: string }[];
  readonly rules: readonly { readonly item: string; readonly value: string }[];
  readonly canonicalSeed: number;
}

export interface GalleryDiscardStats {
  readonly residualMotionLock: number;
  readonly contactMeleeThree: number;
  readonly illegalStopLoss: number;
  readonly utterancesAttached: number;
  readonly utterancesNewCell: number;
}

export interface GalleryCatalog {
  readonly specimens: readonly GallerySpecimen[];
  readonly discards: GalleryDiscardStats;
}

/**
 * Must match `RESIDUAL_MOTION` in `src/generation/contamination-draw.ts`.
 * Copied so this module does not grow a generation-side export (rollback = delete this file).
 */
const INFILTRATE_RESIDUAL_MOTION: Readonly<Record<string, string>> = {
  doorframe: 'motion_anchor',
  lamp_pillar: 'motion_anchor',
  railing_post: 'motion_anchor',
  organic_remnant: 'motion_patrol',
  stalk_clump: 'motion_turn',
  wall_rust: 'motion_wall',
  fungal_mat: 'motion_cluster',
  oil_film: 'motion_wind',
  ash_veil: 'motion_cluster',
  sound_echo: 'motion_anchor',
  light_scatter: 'motion_trail',
  space_interval: 'motion_anchor',
};

const COVERAGES: readonly CoverageId[] = coverageOptions().map((row) => row.id);

/** Occupying / non-occupying field names for humans. Not internal ids. */
export const GALLERY_AXES: Record<PortfolioId, GalleryAxes> = {
  jia: {
    occupying: ['基体', '覆盖深度', '连续性', '感知', '运动', '族内变体', '成句'],
    nonOccupying: ['节律', 'moving', 'signal', '接触', '孔谱（厅已定）', '碎片'],
  },
  yi: {
    occupying: ['基体', '覆盖深度', '连续性', '感知', '成句'],
    nonOccupying: ['节律', '运动', '接触', '朝向', '连续种子', '碎片'],
  },
  bing: {
    occupying: ['基体', '覆盖深度', '连续性', '感知', '节律', '成句', '止损是否画核'],
    nonOccupying: ['运动', 'signal', 'visibility', '朝向', '连续种子', '碎片'],
  },
  ding: {
    occupying: ['基体', '覆盖深度', '连续性', '感知', '成句', '盒尺寸'],
    nonOccupying: ['运动', '节律', 'signal', 'visibility', '朝向', '连续种子', '碎片'],
  },
};

export function infiltrateResidualMotion(substrate: string): string | null {
  return INFILTRATE_RESIDUAL_MOTION[substrate] ?? null;
}

export function jiaVariantOf(seed: number, substrate: string): GallerySeedBucket {
  return (mix32(seed, substrate) % 3) as GallerySeedBucket;
}

export function jiaSeedForVariant(substrate: string, variant: GallerySeedBucket): number {
  for (let seed = 0; seed < 4096; seed++) {
    if (jiaVariantOf(seed, substrate) === variant) return seed;
  }
  throw new Error(`jiaSeedForVariant: no seed for ${substrate} variant ${variant}`);
}

function canonicalLexeme(slot: LexemeSlot, portfolio: PortfolioId): string {
  const row = lexemeOptions(slot, portfolio)[0];
  if (!row) throw new Error(`孔谱 ${portfolio} 的 ${slot} 槽没有合法词素`);
  return row.id;
}

function idsOf(slot: LexemeSlot, portfolio: PortfolioId): readonly string[] {
  return lexemeOptions(slot, portfolio).map((row) => row.id);
}

function continuitiesFor(portfolio: PortfolioId, substrate: string): readonly ContinuityId[] {
  const legal = continuityOptions(portfolio, substrate).map((row) => row.id);
  const extra = (SUBSTRATE_DATA[substrate]?.legalContinuities ?? []).filter((id) => !legal.includes(id));
  return extra.length === 0 ? legal : [...legal, ...extra];
}

function continuityInPortfolioAlphabet(
  portfolio: PortfolioId,
  substrate: string,
  continuity: ContinuityId,
): boolean {
  return continuityOptions(portfolio, substrate).some((row) => row.id === continuity);
}

function motionAlphabetOrLock(
  portfolio: PortfolioId,
  substrate: string,
  coverage: CoverageId,
): readonly string[] | null {
  const alphabet = idsOf('motion', portfolio);
  if (coverage !== 'infiltrate') return alphabet;
  const lock = infiltrateResidualMotion(substrate);
  if (!lock) return alphabet;
  if (!alphabet.includes(lock)) return null;
  return [lock];
}

function motionForNonOccupying(
  portfolio: PortfolioId,
  substrate: string,
  coverage: CoverageId,
): string | null {
  const locked = motionAlphabetOrLock(portfolio, substrate, coverage);
  if (!locked) return null;
  if (coverage === 'infiltrate') {
    const lock = infiltrateResidualMotion(substrate);
    if (lock) return lock;
  }
  return canonicalLexeme('motion', portfolio);
}

function formFromSlots(config: LexiconGymConfig): ContaminationForm | string {
  const built = formFromConfig(config);
  if (typeof built !== 'string') return built;
  if (built !== '连续性与孔谱不合') return built;
  const sub = SUBSTRATE_DATA[config.substrate];
  if (!sub?.legalContinuities.includes(config.continuity)) return built;
  return {
    substrate: config.substrate,
    coverage: config.coverage,
    continuity: config.continuity,
    occupancy: PORTFOLIO_DATA[config.portfolio].occupancy,
    portfolio: config.portfolio,
    lexemes: {
      motion: config.motion,
      sense: config.sense,
      rhythm: config.rhythm,
      contact: config.contact,
    },
    utteranceId: config.utteranceId || undefined,
  };
}

function stopLossVisualToken(form: ContaminationForm): string {
  const stop = resolveStopLoss(form);
  if (stop === 'illegal') return 'illegal';
  return stop.hittable ? 'paints_core' : 'no_core';
}

function dingBoxToken(form: ContaminationForm): string {
  return form.continuity === 'field' ? 'box_field' : 'box_compact';
}

export function visualKeyOf(form: ContaminationForm, seedBucket: number): string {
  const bucket: GallerySeedBucket = form.portfolio === 'jia' ? ((seedBucket % 3) as GallerySeedBucket) : 0;
  const base = `${form.portfolio}|${form.substrate}|${form.coverage}|${form.continuity}|${form.lexemes.sense}`;
  if (form.portfolio === 'jia') {
    return `${base}|${form.lexemes.motion}|v${bucket}`;
  }
  if (form.portfolio === 'yi') {
    return `${base}|v0`;
  }
  if (form.portfolio === 'bing') {
    return `${base}|${form.lexemes.rhythm}|${stopLossVisualToken(form)}`;
  }
  return `${base}|${dingBoxToken(form)}`;
}

function enabledScopeOf(substrate: string): SubstrateEnabledScope {
  return SUBSTRATE_DATA[substrate]?.enabledScope ?? 'gym';
}

function specimenOf(
  form: ContaminationForm,
  seed: number,
  seedBucket: GallerySeedBucket,
  utteranceIds: readonly string[],
): GallerySpecimen {
  return {
    visualKey: visualKeyOf(form, seedBucket),
    form,
    seed,
    seedBucket,
    utteranceIds,
    stopLoss: resolveStopLoss(form),
    enabledScope: enabledScopeOf(form.substrate),
    portfolio: form.portfolio,
    substrate: form.substrate,
  };
}

function configCount(portfolio: PortfolioId): number {
  return portfolio === 'jia' ? 4 : 1;
}

export function collectGalleryCatalog(opts: GalleryEnumerateOpts = {}): GalleryCatalog {
  void opts.fragmentTypeId;
  const includeIllegal = opts.includeIllegal === true;
  const byKey = new Map<string, GallerySpecimen>();
  let residualMotionLock = 0;
  let contactMeleeThree = 0;
  let illegalStopLoss = 0;
  let utterancesAttached = 0;
  let utterancesNewCell = 0;

  const put = (spec: GallerySpecimen): void => {
    const prev = byKey.get(spec.visualKey);
    if (prev) {
      throw new Error(`visualKey collision while enumerating: ${spec.visualKey}`);
    }
    byKey.set(spec.visualKey, spec);
  };

  for (const portRow of portfolioOptions()) {
    const portfolio = portRow.id;
    const rhythmCanon = canonicalLexeme('rhythm', portfolio);
    const contactCanon = canonicalLexeme('contact', portfolio);
    const senses = idsOf('sense', portfolio);
    const rhythms = idsOf('rhythm', portfolio);

    for (const subRow of substrateOptions(portfolio)) {
      const substrate = subRow.id;
      for (const coverage of COVERAGES) {
        const continuities = continuitiesFor(portfolio, substrate);
        for (const continuity of continuities) {
          const inAlphabet = continuityInPortfolioAlphabet(portfolio, substrate, continuity);
          if (portfolio === 'jia') {
            const motions = motionAlphabetOrLock(portfolio, substrate, coverage);
            if (!motions) {
              residualMotionLock += senses.length * 3;
              continue;
            }
            for (const sense of senses) {
              for (const motion of motions) {
                const config: LexiconGymConfig = {
                  portfolio,
                  coverage,
                  substrate,
                  continuity,
                  motion,
                  sense,
                  rhythm: rhythmCanon,
                  contact: contactCanon,
                  utteranceId: '',
                  count: configCount(portfolio),
                };
                const form = formFromSlots(config);
                if (typeof form === 'string') continue;
                const stop = resolveStopLoss(form);
                if (stop === 'illegal') {
                  illegalStopLoss += 3;
                  if (!includeIllegal) continue;
                } else if (!inAlphabet) {
                  continue;
                }
                for (const variant of [0, 1, 2] as const) {
                  const seed = jiaSeedForVariant(substrate, variant);
                  put(specimenOf(form, seed, variant, []));
                }
              }
            }
            continue;
          }

          const motion = motionForNonOccupying(portfolio, substrate, coverage);
          if (motion === null) {
            const occupyingLeaves =
              portfolio === 'bing' ? senses.length * rhythms.length : senses.length;
            residualMotionLock += occupyingLeaves;
            continue;
          }
          if (contactCanon === 'contact_melee_three') {
            const occupyingLeaves =
              portfolio === 'bing' ? senses.length * rhythms.length : senses.length;
            contactMeleeThree += occupyingLeaves;
            continue;
          }

          const occupyingRhythms = portfolio === 'bing' ? rhythms : [rhythmCanon];
          for (const sense of senses) {
            for (const rhythm of occupyingRhythms) {
              const config: LexiconGymConfig = {
                portfolio,
                coverage,
                substrate,
                continuity,
                motion,
                sense,
                rhythm,
                contact: contactCanon,
                utteranceId: '',
                count: configCount(portfolio),
              };
              const form = formFromSlots(config);
              if (typeof form === 'string') continue;
              if (form.portfolio !== 'jia' && form.lexemes.contact === 'contact_melee_three') {
                contactMeleeThree += 1;
                continue;
              }
              const stop = resolveStopLoss(form);
              if (stop === 'illegal') {
                illegalStopLoss += 1;
                if (!includeIllegal) continue;
              } else if (!inAlphabet) {
                continue;
              }
              put(specimenOf(form, CANONICAL_SEED, 0, []));
            }
          }
        }
      }
    }
  }

  for (const portRow of portfolioOptions()) {
    for (const uRow of utteranceOptions(portRow.id)) {
      const cfg = applyUtterance(uRow.id);
      if (!cfg) continue;
      const form = formFromSlots(cfg);
      if (typeof form === 'string') continue;
      if (form.portfolio !== 'jia' && form.lexemes.contact === 'contact_melee_three') {
        contactMeleeThree += 1;
        continue;
      }
      const stop = resolveStopLoss(form);
      if (stop === 'illegal') {
        illegalStopLoss += 1;
        if (!includeIllegal) continue;
      }
      const seedBucket: GallerySeedBucket = form.portfolio === 'jia' ? jiaVariantOf(CANONICAL_SEED, form.substrate) : 0;
      const seed = form.portfolio === 'jia' ? jiaSeedForVariant(form.substrate, seedBucket) : CANONICAL_SEED;
      const key = visualKeyOf(form, seedBucket);
      const prev = byKey.get(key);
      if (prev) {
        byKey.set(key, {
          ...prev,
          utteranceIds: [...prev.utteranceIds, uRow.id],
        });
        utterancesAttached += 1;
        continue;
      }
      const withMark: ContaminationForm = { ...form, utteranceId: uRow.id };
      put(specimenOf(withMark, seed, seedBucket, [uRow.id]));
      utterancesNewCell += 1;
    }
  }

  const order: Record<PortfolioId, number> = { jia: 0, yi: 1, bing: 2, ding: 3 };
  const specimens = [...byKey.values()].sort((a, b) => {
    const pd = order[a.portfolio] - order[b.portfolio];
    if (pd !== 0) return pd;
    const sd = a.substrate.localeCompare(b.substrate);
    if (sd !== 0) return sd;
    return a.visualKey.localeCompare(b.visualKey);
  });

  return {
    specimens,
    discards: {
      residualMotionLock,
      contactMeleeThree,
      illegalStopLoss,
      utterancesAttached,
      utterancesNewCell,
    },
  };
}

export function enumerateGallerySpecimens(opts: GalleryEnumerateOpts = {}): readonly GallerySpecimen[] {
  return collectGalleryCatalog(opts).specimens;
}

export function galleryDedupeCopy(portfolio: PortfolioId): GalleryDedupeCopy {
  const axes = GALLERY_AXES[portfolio];
  const rules: { readonly item: string; readonly value: string }[] = [
    { item: '非法止损', value: '默认排除' },
    { item: '渗透深度的残余动词锁', value: '已施加' },
    { item: '非甲接触', value: '禁止三刀近战' },
  ];
  if (portfolio === 'jia') {
    rules.push({ item: '族内变体', value: '3' });
  } else {
    rules.push({ item: '规范种子', value: String(CANONICAL_SEED) });
  }
  rules.push({ item: '碎片', value: '全局着色开关，不占格' });
  return {
    occupying: axes.occupying.map((item) => ({ item })),
    nonOccupying: axes.nonOccupying.map((item) => ({ item })),
    rules,
    canonicalSeed: CANONICAL_SEED,
  };
}
