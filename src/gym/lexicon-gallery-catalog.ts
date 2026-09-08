/**
 * Visual-identity catalog for the contamination-lexicon gallery lesson (I4-A).
 * Pure. No Phaser. No attach. Scene code only consumes this list.
 *
 * Occupying fields per portfolio come from `docs/tasks/iteration-4.md` (静帧占格表).
 * Do not re-derive “does this field change pixels?” here.
 */

import {
  MAMMAL_NEIGHBORHOODS,
  MAMMAL_NEIGHBORHOOD_LABEL,
  MAMMAL_REMNANT_ID,
  mammalHallId,
  mammalNeighborhoodFromHallId,
  mammalNeighborhoodOf,
  type MammalNeighborhoodId,
} from '@/entities/form-renderers/d/genome/mammal-remnant';
import {
  OIL_FILM_ID,
  OIL_FILM_VARIANTS,
  OIL_FILM_VARIANT_LABEL,
  oilFilmHallId,
  oilFilmVariantFromHallId,
  oilFilmVariantOf,
  type OilFilmVariantId,
} from '@/entities/form-renderers/d/paint-genome/topology';
import {
  STREET_WRECKAGE_ID,
  STREET_WRECKAGE_NEIGHBORHOODS,
  streetNeighborhoodsOf,
  type StreetWreckageNeighborhoodId,
} from '@/entities/form-renderers/d/genome/street-wreckage';
import { familyCapabilityFor, type ContaminationForm } from '@/generation/contamination-draw';
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

export const GALLERY_JIA_SEED_COUNT = 8;
export const GALLERY_JIA_SEED_BUCKETS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export type GallerySeedBucket = (typeof GALLERY_JIA_SEED_BUCKETS)[number];

/** 翻列前灯柱 / 栏柱仍在策划表，陈列馆不另开厅。 */
export const GALLERY_JIA_HIDDEN_SUBSTRATES: ReadonlySet<string> = new Set([
  'lamp_pillar',
  'railing_post',
]);

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
  /** 导航厅。哺乳动物是 `mammal_remnant:cat` 等四条；油膜是 `oil_film:beads` 等三支。策划表仍各一行。 */
  readonly hallId: string;
  /** 哺乳动物邻域；其它基体为 null。 */
  readonly mammalHood: MammalNeighborhoodId | null;
  /** 油膜三变体入口；其它基体为 null。 */
  readonly oilFilmHood: OilFilmVariantId | null;
}

export interface GalleryHallNav {
  readonly hallId: string;
  readonly substrate: string;
  readonly label: string;
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
  street_wreckage: 'motion_anchor',
  organic_remnant: 'motion_patrol',
  human_remnant: 'motion_patrol',
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

const COVERAGES: readonly CoverageId[] = coverageOptions().map((row) => row.id);

/** Occupying / non-occupying field names for humans. Not internal ids. */
export const GALLERY_AXES: Record<PortfolioId, GalleryAxes> = {
  jia: {
    occupying: ['基体', '覆盖深度', '连续性', '感知', '运动', '采样种子', '成句'],
    nonOccupying: ['节律', 'moving', 'signal', '接触', '孔谱（厅已定）', '碎片'],
  },
  yi: {
    occupying: ['基体', '覆盖深度', '连续性', '感知', '成句'],
    nonOccupying: ['节律', '运动', '接触', '朝向', '连续种子', '碎片'],
  },
  bing: {
    occupying: ['基体', '覆盖深度', '连续性', '感知', '节律'],
    nonOccupying: ['成句', '止损是否画核', '运动', 'signal', 'visibility', '朝向', '连续种子', '碎片'],
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
  return (mix32(seed, substrate) % GALLERY_JIA_SEED_COUNT) as GallerySeedBucket;
}

export function jiaSeedForVariant(substrate: string, variant: GallerySeedBucket): number {
  for (let seed = 0; seed < 8192; seed++) {
    if (jiaVariantOf(seed, substrate) === variant) return seed;
  }
  throw new Error(`jiaSeedForVariant: no seed for ${substrate} variant ${variant}`);
}

function jiaOccupyingLeaves(substrate: string): number {
  return substrate === MAMMAL_REMNANT_ID
    ? GALLERY_JIA_SEED_COUNT * MAMMAL_NEIGHBORHOODS.length
    : GALLERY_JIA_SEED_COUNT;
}

const MAMMAL_SEED_SEARCH = 65536;
const STREET_SEED_SEARCH = 65536;
const mammalSeedByHall = new Map<string, number>();
const streetSeedByBucket = new Map<GallerySeedBucket, number>();

/** 桶内搜邻域。禁止 `% 4` 切身份。 */
export function jiaSeedForMammalNeighborhood(
  variant: GallerySeedBucket,
  hood: MammalNeighborhoodId,
): number {
  const key = `${variant}:${hood}`;
  const cached = mammalSeedByHall.get(key);
  if (cached !== undefined) return cached;
  for (let seed = 0; seed < MAMMAL_SEED_SEARCH; seed++) {
    if (jiaVariantOf(seed, MAMMAL_REMNANT_ID) !== variant) continue;
    if (mammalNeighborhoodOf(seed) === hood) {
      mammalSeedByHall.set(key, seed);
      return seed;
    }
  }
  throw new Error(`jiaSeedForMammalNeighborhood: no seed for ${hood} variant ${variant}`);
}

function findStreetSeed(
  variant: GallerySeedBucket,
  pred: (seed: number) => boolean,
): number | null {
  for (let seed = 0; seed < STREET_SEED_SEARCH; seed++) {
    if (jiaVariantOf(seed, STREET_WRECKAGE_ID) !== variant) continue;
    if (pred(seed)) return seed;
  }
  return null;
}

function pickStreetGallerySeeds(): readonly number[] {
  const picked: number[] = Array.from({ length: GALLERY_JIA_SEED_COUNT }, () => -1);
  const covered = new Set<StreetWreckageNeighborhoodId>();
  for (const hood of STREET_WRECKAGE_NEIGHBORHOODS) {
    if (covered.has(hood)) continue;
    for (const variant of GALLERY_JIA_SEED_BUCKETS) {
      if (picked[variant]! >= 0) continue;
      const seed = findStreetSeed(variant, (s) => streetNeighborhoodsOf(s).has(hood));
      if (seed === null) continue;
      picked[variant] = seed;
      for (const hit of streetNeighborhoodsOf(seed)) covered.add(hit);
      break;
    }
  }
  for (const variant of GALLERY_JIA_SEED_BUCKETS) {
    if (picked[variant]! >= 0) continue;
    picked[variant] = jiaSeedForVariant(STREET_WRECKAGE_ID, variant);
  }
  const unionOf = (): Set<StreetWreckageNeighborhoodId> => {
    const u = new Set<StreetWreckageNeighborhoodId>();
    for (const seed of picked) {
      for (const hood of streetNeighborhoodsOf(seed)) u.add(hood);
    }
    return u;
  };
  for (const hood of STREET_WRECKAGE_NEIGHBORHOODS) {
    if (unionOf().has(hood)) continue;
    let replaced = false;
    for (let i = GALLERY_JIA_SEED_BUCKETS.length - 1; i >= 0 && !replaced; i -= 1) {
      const variant = GALLERY_JIA_SEED_BUCKETS[i]!;
      const seed = findStreetSeed(variant, (s) => streetNeighborhoodsOf(s).has(hood));
      if (seed === null) continue;
      picked[variant] = seed;
      replaced = true;
    }
    if (!unionOf().has(hood)) {
      throw new Error(`jiaSeedForStreetWreckage: cannot cover neighborhood ${hood}`);
    }
  }
  return picked;
}

/** 街具残骸一厅：8 个桶的并集须看见灯柱 / 栏柱 / 标牌杆邻域。 */
export function jiaSeedForStreetWreckage(variant: GallerySeedBucket): number {
  if (streetSeedByBucket.size === 0) {
    const seeds = pickStreetGallerySeeds();
    for (const bucket of GALLERY_JIA_SEED_BUCKETS) {
      streetSeedByBucket.set(bucket, seeds[bucket]!);
    }
  }
  const seed = streetSeedByBucket.get(variant);
  if (seed === undefined) {
    throw new Error(`jiaSeedForStreetWreckage: missing bucket ${variant}`);
  }
  return seed;
}

export function galleryHallIdOf(substrate: string, seed: number): string {
  if (substrate === MAMMAL_REMNANT_ID) return mammalHallId(mammalNeighborhoodOf(seed));
  if (substrate === OIL_FILM_ID) return oilFilmHallId(oilFilmVariantOf(seed));
  return substrate;
}

export function galleryHallLabelOf(hallId: string, substrate: string): string {
  const mammal = mammalNeighborhoodFromHallId(hallId);
  if (mammal) return MAMMAL_NEIGHBORHOOD_LABEL[mammal];
  const oil = oilFilmVariantFromHallId(hallId);
  if (oil) return OIL_FILM_VARIANT_LABEL[oil];
  return SUBSTRATE_DATA[substrate]?.displayToken ?? substrate;
}

export function galleryHallsOf(
  portfolio: PortfolioId,
  specimens: readonly GallerySpecimen[],
): readonly GalleryHallNav[] {
  const halls: GalleryHallNav[] = [];
  for (const sub of substrateOptions(portfolio)) {
    if (portfolio === 'jia' && GALLERY_JIA_HIDDEN_SUBSTRATES.has(sub.id)) continue;
    if (portfolio === 'jia' && sub.id === MAMMAL_REMNANT_ID) {
      for (const hood of MAMMAL_NEIGHBORHOODS) {
        const hallId = mammalHallId(hood);
        const count = specimens.filter((row) => row.portfolio === portfolio && row.hallId === hallId)
          .length;
        if (count === 0) continue;
        halls.push({
          hallId,
          substrate: MAMMAL_REMNANT_ID,
          label: MAMMAL_NEIGHBORHOOD_LABEL[hood],
        });
      }
      continue;
    }
    if (portfolio === 'bing' && sub.id === OIL_FILM_ID) {
      for (const hood of OIL_FILM_VARIANTS) {
        const hallId = oilFilmHallId(hood);
        const count = specimens.filter((row) => row.portfolio === portfolio && row.hallId === hallId)
          .length;
        if (count === 0) continue;
        halls.push({
          hallId,
          substrate: OIL_FILM_ID,
          label: OIL_FILM_VARIANT_LABEL[hood],
        });
      }
      continue;
    }
    const count = specimens.filter((row) => row.portfolio === portfolio && row.hallId === sub.id)
      .length;
    if (count === 0) continue;
    halls.push({ hallId: sub.id, substrate: sub.id, label: sub.label });
  }
  return halls;
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
  // A fixed architectural host must remain attached in every gallery tier.
  // Full floor alphabet experiments remain available; this is only the
  // non-occupying motion selected as the representative environmental pose.
  const family = familyCapabilityFor(substrate, portfolio);
  if (family?.motion.length === 1) return family.motion[0]!;
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

function dingBoxToken(form: ContaminationForm): string {
  return form.continuity === 'field' ? 'box_field' : 'box_compact';
}

export function visualKeyOf(
  form: ContaminationForm,
  seedBucket: number,
  hallId?: string,
): string {
  const bucket: GallerySeedBucket =
    form.portfolio === 'jia' ? ((seedBucket % GALLERY_JIA_SEED_COUNT) as GallerySeedBucket) : 0;
  const hall = hallId ?? form.substrate;
  const base = `${form.portfolio}|${form.substrate}|${form.coverage}|${form.continuity}|${form.lexemes.sense}`;
  if (form.portfolio === 'jia') {
    const hood = mammalNeighborhoodFromHallId(hall);
    const hoodToken = hood ? `|${hood}` : '';
    return `${base}|${form.lexemes.motion}|v${bucket}${hoodToken}`;
  }
  if (form.portfolio === 'yi') {
    return `${base}|v0`;
  }
  if (form.portfolio === 'bing') {
    const oil = oilFilmVariantFromHallId(hall);
    const oilToken = oil ? `|${oil}` : '';
    return `${base}|${form.lexemes.rhythm}${oilToken}`;
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
  hallId?: string,
): GallerySpecimen {
  const resolvedHall = hallId ?? galleryHallIdOf(form.substrate, seed);
  return {
    visualKey: visualKeyOf(form, seedBucket, resolvedHall),
    form,
    seed,
    seedBucket,
    utteranceIds,
    stopLoss: resolveStopLoss(form),
    enabledScope: enabledScopeOf(form.substrate),
    portfolio: form.portfolio,
    substrate: form.substrate,
    hallId: resolvedHall,
    mammalHood: mammalNeighborhoodFromHallId(resolvedHall),
    oilFilmHood: oilFilmVariantFromHallId(resolvedHall),
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
      if (portfolio === 'jia' && GALLERY_JIA_HIDDEN_SUBSTRATES.has(substrate)) continue;
      for (const coverage of COVERAGES) {
        const continuities = continuitiesFor(portfolio, substrate);
        for (const continuity of continuities) {
          const inAlphabet = continuityInPortfolioAlphabet(portfolio, substrate, continuity);
          if (portfolio === 'jia') {
            const motions = motionAlphabetOrLock(portfolio, substrate, coverage);
            if (!motions) {
              residualMotionLock += senses.length * jiaOccupyingLeaves(substrate);
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
                  illegalStopLoss += jiaOccupyingLeaves(substrate);
                  if (!includeIllegal) continue;
                } else if (!inAlphabet) {
                  continue;
                }
                for (const variant of GALLERY_JIA_SEED_BUCKETS) {
                  if (substrate === MAMMAL_REMNANT_ID) {
                    for (const hood of MAMMAL_NEIGHBORHOODS) {
                      const seed = jiaSeedForMammalNeighborhood(variant, hood);
                      put(specimenOf(form, seed, variant, [], mammalHallId(hood)));
                    }
                    continue;
                  }
                  const seed =
                    substrate === STREET_WRECKAGE_ID
                      ? jiaSeedForStreetWreckage(variant)
                      : jiaSeedForVariant(substrate, variant);
                  put(specimenOf(form, seed, variant, [], substrate));
                }
              }
            }
            continue;
          }

          const motion = motionForNonOccupying(portfolio, substrate, coverage);
          const oilLeaves = substrate === OIL_FILM_ID ? OIL_FILM_VARIANTS.length : 1;
          if (motion === null) {
            const occupyingLeaves =
              (portfolio === 'bing' ? senses.length * rhythms.length : senses.length) * oilLeaves;
            residualMotionLock += occupyingLeaves;
            continue;
          }
          if (contactCanon === 'contact_melee_three') {
            const occupyingLeaves =
              (portfolio === 'bing' ? senses.length * rhythms.length : senses.length) * oilLeaves;
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
              const hallIds =
                form.substrate === OIL_FILM_ID
                  ? OIL_FILM_VARIANTS.map((hood) => oilFilmHallId(hood))
                  : [form.substrate];
              if (form.portfolio !== 'jia' && form.lexemes.contact === 'contact_melee_three') {
                contactMeleeThree += hallIds.length;
                continue;
              }
              const stop = resolveStopLoss(form);
              if (stop === 'illegal') {
                illegalStopLoss += hallIds.length;
                if (!includeIllegal) continue;
              } else if (!inAlphabet) {
                continue;
              }
              for (const hallId of hallIds) {
                put(specimenOf(form, CANONICAL_SEED, 0, [], hallId));
              }
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
      if (form.portfolio === 'jia' && GALLERY_JIA_HIDDEN_SUBSTRATES.has(form.substrate)) continue;
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
      const seed =
        form.portfolio === 'jia' && form.substrate === MAMMAL_REMNANT_ID
          ? jiaSeedForMammalNeighborhood(
              seedBucket,
              mammalNeighborhoodOf(jiaSeedForVariant(form.substrate, seedBucket)),
            )
          : form.portfolio === 'jia' && form.substrate === STREET_WRECKAGE_ID
            ? jiaSeedForStreetWreckage(seedBucket)
            : form.portfolio === 'jia'
              ? jiaSeedForVariant(form.substrate, seedBucket)
              : CANONICAL_SEED;
      const hallId = galleryHallIdOf(form.substrate, seed);
      const key = visualKeyOf(form, seedBucket, hallId);
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
      put(specimenOf(withMark, seed, seedBucket, [uRow.id], hallId));
      utterancesNewCell += 1;
    }
  }

  const order: Record<PortfolioId, number> = { jia: 0, yi: 1, bing: 2, ding: 3 };
  const specimens = [...byKey.values()].sort((a, b) => {
    const pd = order[a.portfolio] - order[b.portfolio];
    if (pd !== 0) return pd;
    const sd = a.substrate.localeCompare(b.substrate);
    if (sd !== 0) return sd;
    const hd = a.hallId.localeCompare(b.hallId);
    if (hd !== 0) return hd;
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
    rules.push({ item: '采样种子', value: String(GALLERY_JIA_SEED_COUNT) });
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
