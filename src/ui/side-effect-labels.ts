/**
 * Single describe-function for defense `PendingSideEffect`s (Slice 5.5 D5/V8).
 *
 * Before this file, `rift-scene.ts` held the only human-readable mapping from
 * `SideEffectType` to Chinese text, used solely for its sortie-start toast. The
 * impact result panel needs the exact same mapping to disclose "what residual
 * effect this slot just produced" (IA §S8's "本次产生的残留") — rather than grow
 * a second copy that can drift, both call sites share this one.
 */

import type { PendingSideEffect } from '@/systems/defense-engine';
import { getDefenseName } from '@/ui/contaminant-names';
import type { ContaminantType } from '@/types/game-types';

/** Relative to base rate 1.0: slower `-N%`, faster `+N%`. */
export function formatChaosRateDelta(rate: number): string {
  const pct = Math.round((1 - rate) * 100);
  if (pct > 0) return `-${pct}%`;
  if (pct < 0) return `+${-pct}%`;
  return '0%';
}

/** Multiplier form (e.g. 1.5 → `+50%`). */
export function formatChaosMultDelta(mult: number): string {
  const pct = Math.round((mult - 1) * 100);
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return '0%';
}

/** Describe a side effect's mechanical content alone (no source attribution). */
export function describeSideEffectBody(e: PendingSideEffect): string | null {
  switch (e.type) {
    case 'initial_chaos':
      return `初始混乱 +${e.value}`;
    case 'chaos_rate_mult':
      return `混乱增速 ${formatChaosMultDelta(e.value)}`;
    case 'vision_reduction':
      return `视野 -${Math.round(e.value * 100)}%`;
    case 'speed_reduction':
      return `移速 -${Math.round(e.value * 100)}%`;
    case 'proximity_sense_boost':
      return `敌近距感知 +${Math.round(e.value * 100)}%`;
    case 'storage_halved':
      return '储藏效果减半';
    case 'module_swap':
      return '模块功能已互换';
    case 'repair_efficiency':
    case 'upgrade_discount':
      return null; // Not surfaced as a "residual" line — standing bonuses, not events.
    default:
      return null;
  }
}

/** Full sentence with source attribution, e.g. "下次出击 初始混乱 +5 ← 晶锁残渣". */
export function describeSideEffectWithSource(e: PendingSideEffect): string | null {
  const body = describeSideEffectBody(e);
  if (!body) return null;
  const sourceName = e.source ? getDefenseName(e.source as ContaminantType) : '未知';
  return `下次出击 ${body} ← ${sourceName}`;
}
