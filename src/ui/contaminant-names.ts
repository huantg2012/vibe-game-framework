import { getContaminantQualityRank } from '@/systems/contaminant-quality';
/**
 * Single lookup entry point for contaminant display names + canonical inventory
 * ordering (Slice 5.5 C2/C3).
 *
 * The authoritative name source is `CONTAMINANT_DATA` (generated from
 * `data/contaminants.csv`, CLAUDE.md 策划数据源规则). Any panel that needs a
 * contaminant's Chinese name must call these instead of maintaining its own name
 * table — see `docs/design-notes/ux-information-architecture.md` S15 for the five
 * panels that currently disagree with the CSV and with each other (V8 in
 * `docs/design-notes/ui-art-overhaul.md` A1).
 *
 * C2 wired the rift HUD and `rift-scene.ts`'s side-effect toast onto the name
 * getters. C3 wired `loadout-panel.ts` / `defense-panel.ts` / `status-panel.ts`
 * onto both the name getters and `sortContaminants` (IA §S13 "库存排序"), and
 * added `getRarityStars`. C4 wired the two remaining holdouts —
 * `src/ui/dom/impact-result-panel.ts` `TYPE_NAMES` and
 * `src/scenes/purification-scene.ts` `TOOL_NAMES` — onto `getDefenseName` /
 * `getToolName`, so no panel in the project maintains its own copy of these
 * names anymore (V8 in `ui-art-overhaul.md` A1 is fully closed).
 */

import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import type { Contaminant, ContaminantRarity, ContaminantStage, ContaminantType } from '@/types/game-types';

/** The name a contaminant is known by while equipped as a sortie tool. */
export function getToolName(type: ContaminantType): string {
  return CONTAMINANT_DATA[type]?.displayNameTool ?? type;
}

/** The name a contaminant is known by while slotted as defense. */
export function getDefenseName(type: ContaminantType): string {
  return CONTAMINANT_DATA[type]?.displayNameDefense ?? type;
}

const RARITY_STARS: Record<ContaminantRarity, string> = {
  common: '★',
  fine: '★★',
  rare: '★★★',
};

/** Star-count rarity badge. World.md does not yet name the three rarity tiers in
 *  Chinese (IA §S15 类别3) — ★ count remains the interim canonical representation. */
export function getRarityStars(rarity: ContaminantRarity): string {
  return RARITY_STARS[rarity] ?? '';
}

// ---------------------------------------------------------------------------
// Canonical inventory ordering (ux-information-architecture.md §S13
// "库存排序**固定**：阶段（防御 → 工具 → 已耗尽）→ 稀有度（稀有 → 精良 → 普通）→ 类型 id")
// ---------------------------------------------------------------------------

const STAGE_ORDER: Record<ContaminantStage, number> = { defense: 0, tool: 1, broken: 2 };
const TYPE_ORDER: Record<string, number> = Object.fromEntries(
  Object.keys(CONTAMINANT_DATA).map((id, index) => [id, index]),
);

/** Sort a contaminant list into the fixed inventory order all panels must share,
 *  so cursor position stays muscle-memory-stable across opens (not insertion order). */
export function sortContaminants<T extends Pick<Contaminant, 'stage' | 'rarity' | 'type' | 'quality'>>(
  list: readonly T[],
): T[] {
  return [...list].sort((a, b) => {
    if (a.stage !== b.stage) return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
    const quality = getContaminantQualityRank(b) - getContaminantQualityRank(a);
    if (quality) return quality;
    return (TYPE_ORDER[a.type] ?? 0) - (TYPE_ORDER[b.type] ?? 0);
  });
}
