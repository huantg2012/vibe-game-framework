/** One deliberately requested base cycle; never impersonates an expedition return. */
import { GAME_CONSTANTS } from '@/config/constants';
import { mix32 } from '@/generation/seed-fork';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { healingAfter, HEALING_PURIFIER_MIN_HP } from '@/systems/assimilation-system';
import { contaminantSystem } from '@/systems/contaminant-system';
import { projectItemForPlayer } from '@/systems/contaminant-catalog';
import { growthSystem } from '@/systems/growth-system';
import { impactSystem, type ForecastReading, type ImpactResult } from '@/systems/impact-system';
import { inventoryStore } from '@/systems/inventory-store';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem, type PhaseChangeInfo } from '@/systems/tide-system';
import type { OfferingTransformResult } from '@/types/inventory-types';
import { SeededRandom } from '@/utils/random';

export type HealingUnavailableReason = 'pending-save' | 'run-active' | 'return-pending' | 'unaffected' | 'purifier-damaged' | 'cycle-limit';
export interface HealingPreview {
  readonly available: boolean;
  readonly reason: HealingUnavailableReason | null;
  readonly assimilationBefore: number;
  readonly assimilationAfter: number;
  readonly reduction: number;
  readonly purifierHp: number;
  readonly requiredPurifierHp: number;
  readonly forecast: ForecastReading | null;
}
export interface HealingCycleResult {
  readonly cycleId: string;
  readonly before: number;
  readonly after: number;
  readonly impact: ImpactResult;
  readonly phaseChange: PhaseChangeInfo | null;
  readonly transforms: OfferingTransformResult[];
  readonly forecastBefore: ForecastReading | null;
  readonly stabilityDelta: number;
}
export type HealingCycleOutcome =
  | { readonly ok: true; readonly result: HealingCycleResult }
  | { readonly ok: false; readonly reason: HealingUnavailableReason }
  | { readonly ok: false; readonly reason: 'storage-failed'; readonly pendingResult: HealingCycleResult };

export function getHealingPreview(): HealingPreview {
  const assimilationBefore = gameState.getAssimilation();
  const assimilationAfter = healingAfter(assimilationBefore);
  const purifierHp = gameState.getModule('PURIFIER')?.hp ?? 0;
  const run = inventoryStore.getRun();
  const reason: HealingUnavailableReason | null = saveManager.hasPendingSave() || inventoryStore.hasFrameTransaction() ? 'pending-save'
    : run?.status === 'active' ? 'run-active'
      : run?.status === 'settled' && !run.baseSettled ? 'return-pending'
        : assimilationBefore <= 0 ? 'unaffected'
          : purifierHp < HEALING_PURIFIER_MIN_HP ? 'purifier-damaged'
            : gameState.getHealingCycles() >= Number.MAX_SAFE_INTEGER ? 'cycle-limit' : null;
  return { available: reason === null, reason, assimilationBefore, assimilationAfter,
    reduction: assimilationBefore - assimilationAfter, purifierHp, requiredPurifierHp: HEALING_PURIFIER_MIN_HP,
    forecast: impactSystem.getForecastReading(growthSystem.getLevel('growth_forecast_clarity'), { forceImpact: true }) };
}

/** On refusal, retain this exact candidate for SaveManager.trySave; never call again to retry. */
export function performHealingCycle(): HealingCycleOutcome {
  const preview = getHealingPreview();
  if (preview.reason) return { ok: false, reason: preview.reason };
  let result!: HealingCycleResult;
  const saved = saveManager.commitWorldTransaction(() => {
    const cycleId = `healing:${gameState.incrementHealingCycles()}`;
    const impactRandom = new SeededRandom(mix32(0, `${cycleId}:impact`));
    const forecastRandom = new SeededRandom(mix32(0, `${cycleId}:forecast`));
    gameState.setImpactIntensity(tideSystem.getCurrentIntensity());
    // Establish only if missing. Existing promises retain their target and roll.
    impactSystem.generateForecast(tideSystem.getCurrentIntensity(), growthSystem.getModifiers().forecastClarity,
      tideSystem.peekNextIntensity(), () => forecastRandom.next());
    const forecastBefore = impactSystem.getForecastReading(growthSystem.getLevel('growth_forecast_clarity'), { forceImpact: true });
    const offeringIds = inventoryStore.getOfferingItems().map(item => item?.id ?? null);
    const isHighTide = tideSystem.isHighTide();
    const impact = impactSystem.run(contaminantSystem.getDefenseSlotted(), offeringIds,
      () => impactRandom.next(), stabilityTracker.getProgress(), { forceImpact: true });
    const finished = contaminantSystem.finishOfferingImpact(isHighTide, impact.defenseResult?.bonusCharges ?? {}, offeringIds, cycleId);
    if (!finished.ok) throw new Error(`Healing offering settlement failed: ${finished.error}`);
    const phaseChange = tideSystem.advanceCycle(gameState.getModules().every(module => module.hp > 0) && !(impact.newlyZeroModules ?? 0));
    growthSystem.recordReturn({
      impactOccurred: !impact.skipped,
      offeringCompleted: finished.value.length > 0,
      toolRevealed: finished.value.some(transformed => {
        const item = inventoryStore.getItem(transformed.itemId);
        return item?.kind === 'contaminant' && projectItemForPlayer(item.contaminant).slot !== null;
      }),
      leftFiniteCrest: phaseChange?.from === 'crest' && phaseChange.to !== 'crest',
    });
    const stabilityBefore = stabilityTracker.getProgress();
    stabilityTracker.addProgress('healing-damage', (impact.newlyZeroModules ?? 0) * GAME_CONSTANTS.STABILITY.LOSS_MODULE_ZERO, false);
    // A healing cycle costs one normal tide impact; body state never changes its strength.
    gameState.setAssimilation(preview.assimilationAfter);
    impactSystem.generateForecast(tideSystem.getCurrentIntensity(), growthSystem.getModifiers().forecastClarity,
      tideSystem.peekNextIntensity(), () => forecastRandom.next());
    result = { cycleId, before: preview.assimilationBefore, after: preview.assimilationAfter, impact,
      phaseChange, transforms: finished.value, forecastBefore,
      stabilityDelta: stabilityTracker.getProgress() - stabilityBefore };
  });
  return saved ? { ok: true, result } : { ok: false, reason: 'storage-failed', pendingResult: result };
}
