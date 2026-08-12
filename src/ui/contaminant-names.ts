/**
 * Single lookup entry point for contaminant display names (Slice 5.5 C2).
 *
 * The authoritative name source is `CONTAMINANT_DATA` (generated from
 * `data/contaminants.csv`, CLAUDE.md 策划数据源规则). Any panel that needs a
 * contaminant's Chinese name must call these instead of maintaining its own name
 * table — see `docs/design-notes/ux-information-architecture.md` S15 for the five
 * panels that currently disagree with the CSV and with each other (V8 in
 * `docs/design-notes/ui-art-overhaul.md` A1).
 *
 * This batch wires the rift HUD and `rift-scene.ts`'s side-effect toast onto it.
 * The remaining local tables are listed in the C2 delivery report for a later
 * batch (C4/C5/C6) to migrate:
 * - `src/ui/dom/loadout-panel.ts` `TYPE_NAMES` (tool-stage names, 14/18 mismatched)
 * - `src/ui/dom/defense-panel.ts` `TYPE_NAMES` (defense-stage names, mismatched)
 * - `src/ui/dom/status-panel.ts` `TYPE_NAMES` / `TOOL_NAMES`
 * - `src/ui/dom/impact-result-panel.ts` `TYPE_NAMES`
 * - `src/scenes/purification-scene.ts` `TOOL_NAMES`
 */

import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import type { ContaminantType } from '@/types/game-types';

/** The name a contaminant is known by while equipped as a sortie tool. */
export function getToolName(type: ContaminantType): string {
  return CONTAMINANT_DATA[type]?.displayNameTool ?? type;
}

/** The name a contaminant is known by while slotted as defense. */
export function getDefenseName(type: ContaminantType): string {
  return CONTAMINANT_DATA[type]?.displayNameDefense ?? type;
}
