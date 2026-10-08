/**
 * GameState Manager - session-only in-memory state for the purification loop.
 *
 * This is a module-level singleton (architecture DEC-ARCH-002): it survives scene
 * transitions because it lives outside any single scene. Systems never import each
 * other; they read/write GameState and communicate through the event bus.
 *
 * Persisted via SaveManager (localStorage). reset() restores a new expedition.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { GROWTH_ROUTE_DATA } from '@/generated/growth-route-data';
import type { PendingSideEffect } from '@/systems/defense-engine';
import { calculateKindlingYieldExamples, type KindlingYieldExamples } from '@/systems/kindling-yield';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModuleType = 'CORE' | 'STORAGE' | 'PURIFIER';
export type EffectModuleType = 'CORE' | 'STORAGE';
export type ModuleMaxHpTier = 0 | 1 | 2 | 3;

export interface ModuleState {
  readonly id: string;
  readonly type: ModuleType;
  hp: number;
  maxHp: number;
}

export interface SortieModifiers {
  readonly chaosRateModifier: number;
  readonly kindlingValueModifier: number;
  readonly startingChaos: number;
}

export interface KindlingYieldRepair {
  /** Total kindling in one injection from the current state, not extra after a preview. */
  readonly kindlingCost: number;
  readonly repairedHp: number;
  readonly yields: KindlingYieldExamples;
}

export interface GameStateSnapshot {
  kindlingReserve: number;
  cycle: number;
  modules: { id: string; type: string; hp: number; maxHp: number }[];
  moduleMaxHpTier: ModuleMaxHpTier;
  pendingSideEffects: PendingSideEffect[];
  upgradeDiscount: number;
  moduleSwapActive: boolean;
  repairBonusHp: number;
}

export interface GameStateLoadInput {
  kindlingReserve: number;
  cycle: number;
  modules: { id: string; type: string; hp: number; maxHp: number }[];
  moduleMaxHpTier?: number;
  pendingSideEffects?: PendingSideEffect[];
  upgradeDiscount?: number;
  moduleSwapActive?: boolean;
  repairBonusHp?: number;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const P = GAME_CONSTANTS.PURIFICATION;

let kindlingReserve = 0;
let cycle = 0;
let impactIntensity = 1.0;
let pendingSideEffects: PendingSideEffect[] = [];
let moduleMaxHpTier: ModuleMaxHpTier = 0;
let repairBonusHp = 0;
let upgradeDiscount = 0;
/**
 * overwrite (Slice 5 T3, DEC-031): while active, getModuleEffect() reads the OTHER
 * module's HP through the requested type's formula, swapping which module feeds which
 * stat. Cleared at the start of the next impact resolution (exactly "1 次出击").
 * Purifier is never swapped.
 */
let moduleSwapActive = false;
/**
 * resonate (Slice 5 gap-fill, DEC-039): "装备期间CORE和STORAGE模块效果上限各提升10%,
 * 多个共振残渣不叠加此增益" - unlike overwrite's one-impact toggle, this tracks a
 * continuous "is at least one resonate currently in a defense slot" state, kept in sync
 * by ContaminantSystem on every defense-slot mutation (slot/unslot/transform-out). A
 * single boolean rather than a count is what makes "不叠加" automatic: 1 or 5 resonate
 * defense-slotted both just set this true.
 */
let resonateBonusActive = false;

function maxHpForTier(tier: number): number {
  return P.MODULE_BASE_MAX_HP + P.MODULE_MAX_HP_PER_TIER * tier;
}

function clampTier(value: number | undefined): ModuleMaxHpTier {
  const n = value ?? 0;
  if (n <= 0) return 0;
  if (n >= P.MODULE_MAX_HP_TIERS) return P.MODULE_MAX_HP_TIERS as ModuleMaxHpTier;
  return n as ModuleMaxHpTier;
}

function makeModule(type: ModuleType, hp: number, maxHp: number): ModuleState {
  return { id: type, type, hp, maxHp };
}

function createDefaultModules(): ModuleState[] {
  const maxHp = maxHpForTier(0);
  return [
    makeModule('CORE', P.MODULE_INITIAL_HP, maxHp),
    makeModule('STORAGE', P.MODULE_INITIAL_HP, maxHp),
    makeModule('PURIFIER', P.MODULE_INITIAL_HP, maxHp),
  ];
}

const modules: ModuleState[] = createDefaultModules();

function applyMaxHpFromTier(): void {
  const cap = maxHpForTier(moduleMaxHpTier);
  for (const mod of modules) {
    mod.maxHp = cap;
    if (mod.hp > cap) mod.hp = cap;
  }
}

function ensurePurifier(hp = P.MODULE_INITIAL_HP): void {
  if (modules.some((m) => m.type === 'PURIFIER')) return;
  modules.push(makeModule('PURIFIER', hp, maxHpForTier(moduleMaxHpTier)));
}

/**
 * Purifier effectiveness uses the same fixed HP reference as CORE/STORAGE.
 * Thickening adds repair capacity without weakening an unchanged current HP.
 * maxHp remains an input guard; saved sortie modifiers are never recomputed here.
 * Shared by GameState and the allocation/thickening previews.
 */
export function computeStartingChaos(hp: number, maxHp: number): number {
  if (!Number.isFinite(maxHp) || maxHp <= 0) return P.CHAOS_HARD_START;
  const integrity = Math.max(0, Math.min(1, hp / P.MODULE_EFFECT_HP_REF));
  return Math.round(P.CHAOS_HARD_START * (1 - integrity));
}

function effectHp(hp: number): number {
  return Math.min(hp, P.MODULE_EFFECT_HP_REF);
}

/** Shared by live effects and non-mutating repair projections, including overwrite. */
function moduleEffect(type: EffectModuleType, repairedType?: ModuleType, repairedHp?: number): number {
  const sourceType: EffectModuleType = moduleSwapActive
    ? (type === 'CORE' ? 'STORAGE' : 'CORE')
    : type;
  const mod = modules.find((m) => m.type === sourceType);
  if (!mod) return 1;
  const hp = sourceType === repairedType ? repairedHp ?? mod.hp : mod.hp;
  const resonateBonus = resonateBonusActive ? P.RESONATE_MODULE_CAP_BONUS : 0;
  const ratio = effectHp(hp) / P.MODULE_EFFECT_HP_REF;
  return type === 'CORE'
    ? 1 - ratio * (P.MAX_CORE_REDUCTION + resonateBonus)
    : 1 + ratio * (P.MAX_STORAGE_BONUS + resonateBonus);
}

function sortieModifiers(repairedType?: ModuleType, repairedHp?: number): SortieModifiers {
  const purifier = modules.find((m) => m.type === 'PURIFIER');
  return {
    chaosRateModifier: moduleEffect('CORE', repairedType, repairedHp),
    kindlingValueModifier: moduleEffect('STORAGE', repairedType, repairedHp),
    startingChaos: purifier
      ? computeStartingChaos(repairedType === 'PURIFIER' ? repairedHp ?? purifier.hp : purifier.hp, purifier.maxHp)
      : P.CHAOS_HARD_START,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const gameState = {
  // --- Kindling ---

  getKindlingReserve(): number {
    return kindlingReserve;
  },

  addKindling(n: number): void {
    kindlingReserve += Math.max(0, n);
  },

  /**
   * Spend kindling from reserve. Returns true if successful (had enough).
   * Does not allow spending more than the current reserve.
   */
  spendKindling(n: number): boolean {
    if (n <= 0 || n > kindlingReserve) return false;
    kindlingReserve -= n;
    return true;
  },

  // --- Modules ---

  getModules(): readonly ModuleState[] {
    return modules;
  },

  getModule(id: string): ModuleState | undefined {
    return modules.find((m) => m.id === id);
  },

  /**
   * Spend kindling to repair a module.
   * Returns actual kindling spent (clamped by reserve and maxHp).
   */
  allocateToModule(id: string, kindling: number): number {
    const mod = modules.find((m) => m.id === id);
    if (!mod || !Number.isFinite(kindling) || kindling <= 0) return 0;

    const perKindling = gameState.getEffectiveRepairPerKindling();
    const maxUseful = gameState.getMaxUsefulRepairKindling(mod.hp, mod.maxHp);
    const actual = Math.min(Math.floor(kindling), kindlingReserve, maxUseful);
    if (actual <= 0) return 0;

    kindlingReserve -= actual;
    mod.hp = Math.min(mod.hp + actual * perKindling + repairBonusHp, mod.maxHp);
    repairBonusHp = 0;
    return actual;
  },

  /**
   * Apply damage to a module. Returns actual damage dealt (clamped at 0 hp).
   */
  applyDamage(id: string, damage: number): number {
    const mod = modules.find((m) => m.id === id);
    if (!mod || damage <= 0) return 0;

    const actual = Math.min(damage, mod.hp);
    mod.hp -= actual;
    return actual;
  },

  /**
   * Heal a module directly (not via kindling repair). Returns actual amount healed
   * (clamped at maxHp). Used by combust's burst-release (DEC-030).
   */
  healModule(id: string, amount: number): number {
    const mod = modules.find((m) => m.id === id);
    if (!mod || amount <= 0) return 0;

    const actual = Math.min(amount, mod.maxHp - mod.hp);
    if (actual <= 0) return 0;
    mod.hp += actual;
    return actual;
  },

  // --- Module effects (spec rules 26-27b; swap per DEC-031) ---

  /** CORE/STORAGE only. Purifier does not go through this entry. */
  getModuleEffect(type: EffectModuleType): number {
    return moduleEffect(type);
  },

  /** Unique entry for sortie starting chaos (rule 27b). */
  getStartingChaos(): number {
    const purifier = modules.find((m) => m.type === 'PURIFIER');
    if (!purifier) return P.CHAOS_HARD_START;
    return computeStartingChaos(purifier.hp, purifier.maxHp);
  },

  getModuleMaxHpTier(): ModuleMaxHpTier {
    return moduleMaxHpTier;
  },

  getModuleMaxHp(): number {
    return maxHpForTier(moduleMaxHpTier);
  },

  /** Cost of the next thicken tier, or null if already at cap. */
  getNextModuleMaxHpCost(): number | null {
    return GROWTH_ROUTE_DATA.find(step => step.unit === 'thicken' && step.level === moduleMaxHpTier + 1)?.cost ?? null;
  },

  /** True when a thicken purchase can actually complete (not capped, enough kindling). */
  canRaiseModuleMaxHp(): boolean {
    const cost = gameState.getNextModuleMaxHpCost();
    return cost !== null && kindlingReserve >= cost;
  },

  /**
   * Spend kindling to raise every module's maxHp by one tier. Current hp is unchanged.
   * upgradeDiscount does not apply. Returns false if capped or kindling is short.
   */
  raiseModuleMaxHp(): boolean {
    const cost = gameState.getNextModuleMaxHpCost();
    if (cost === null) return false;
    if (!gameState.spendKindling(cost)) return false;
    moduleMaxHpTier = (moduleMaxHpTier + 1) as ModuleMaxHpTier;
    applyMaxHpFromTier();
    return true;
  },

  /** overwrite (DEC-031): whether CORE/STORAGE module effects are currently swapped. */
  isModuleSwapActive(): boolean {
    return moduleSwapActive;
  },

  /** overwrite (DEC-031): set by ImpactSystem when the 25% swap roll succeeds/expires. */
  setModuleSwapActive(active: boolean): void {
    moduleSwapActive = active;
  },

  /** resonate (DEC-039): whether the module-effect cap bonus is currently active. */
  isResonateBonusActive(): boolean {
    return resonateBonusActive;
  },

  /** resonate (DEC-039): set by ContaminantSystem whenever the defense loadout changes. */
  setResonateBonusActive(active: boolean): void {
    resonateBonusActive = active;
  },

  getSortieModifiers(): SortieModifiers {
    return sortieModifiers();
  },

  /**
   * One-injection projection. Does not consume reserve or the finite repair bonus.
   * Reserve is deliberately not a cap: callers may explain a still-unaffordable repair.
   */
  getSortieModifiersAfterRepair(type: ModuleType, kindling: number): SortieModifiers {
    const mod = modules.find((m) => m.type === type);
    if (!mod) return sortieModifiers();
    return sortieModifiers(type, gameState.previewModuleRepair(mod.hp, mod.maxHp, kindling));
  },

  /** The first affordable-or-not single injection that changes any whole-pile yield. */
  getNextKindlingYieldRepair(type: ModuleType, affinity: number): KindlingYieldRepair | null {
    const sourceType = moduleSwapActive ? 'CORE' : 'STORAGE';
    if (type !== sourceType) return null;
    const mod = modules.find((m) => m.type === type);
    if (!mod || mod.hp >= P.MODULE_EFFECT_HP_REF) return null;
    const before = calculateKindlingYieldExamples(affinity, moduleEffect('STORAGE'));
    const maxUseful = gameState.getMaxUsefulRepairKindling(mod.hp, mod.maxHp);
    for (let kindlingCost = 1; kindlingCost <= maxUseful; kindlingCost++) {
      const repairedHp = gameState.previewModuleRepair(mod.hp, mod.maxHp, kindlingCost);
      const yields = calculateKindlingYieldExamples(affinity, moduleEffect('STORAGE', type, repairedHp));
      if (yields.some((value, index) => value !== before[index])) {
        return { kindlingCost, repairedHp, yields };
      }
      if (repairedHp >= P.MODULE_EFFECT_HP_REF) break;
    }
    return null;
  },

  // --- Cycle ---

  getCycle(): number {
    return cycle;
  },

  incrementCycle(): void {
    cycle++;
  },

  // --- Impact intensity ---

  getImpactIntensity(): number {
    return impactIntensity;
  },

  // --- Serialization (for SaveManager) ---

  getState(): GameStateSnapshot {
    return {
      kindlingReserve,
      cycle,
      modules: modules.map((m) => ({ id: m.id, type: m.type, hp: m.hp, maxHp: m.maxHp })),
      moduleMaxHpTier,
      pendingSideEffects: [...pendingSideEffects],
      upgradeDiscount,
      moduleSwapActive,
      repairBonusHp,
    };
  },

  loadState(state: GameStateLoadInput): void {
    kindlingReserve = state.kindlingReserve;
    cycle = state.cycle;
    moduleMaxHpTier = clampTier(state.moduleMaxHpTier);
    ensurePurifier(P.MODULE_INITIAL_HP);
    for (const saved of state.modules) {
      const mod = modules.find((m) => m.id === saved.id);
      if (mod) mod.hp = saved.hp;
    }
    // maxHp is derived from the persisted tier (rule 65); rewrite if the save disagrees.
    applyMaxHpFromTier();
    pendingSideEffects = state.pendingSideEffects ?? [];
    upgradeDiscount = state.upgradeDiscount ?? 0;
    moduleSwapActive = state.moduleSwapActive ?? false;
    repairBonusHp = Number.isFinite(state.repairBonusHp) ? Math.max(0, Math.floor(state.repairBonusHp!)) : 0;
  },

  /** Set impact intensity (called by TideSystem to sync). */
  setImpactIntensity(value: number): void {
    impactIntensity = value;
  },

  // --- Pending side effects (defense engine output, consumed at sortie start) ---

  getPendingSideEffects(): PendingSideEffect[] {
    return pendingSideEffects;
  },

  addPendingSideEffects(effects: PendingSideEffect[]): void {
    pendingSideEffects.push(...effects);
  },

  /** Consume and clear all pending side effects. Called at rift scene create. */
  consumePendingSideEffects(): PendingSideEffect[] {
    const effects = [...pendingSideEffects];
    pendingSideEffects = [];
    return effects;
  },

  // --- Finite repair allowance: earned by impact, spent by one useful injection ---

  getRepairBonusHp(): number { return repairBonusHp; },

  grantRepairBonus(amount: number): void {
    if (Number.isFinite(amount)) repairBonusHp = Math.max(repairBonusHp, Math.max(0, Math.floor(amount)));
  },

  getEffectiveRepairPerKindling(): number { return P.REPAIR_PER_KINDLING; },

  getMaxUsefulRepairKindling(hp: number, maxHp: number): number {
    if (hp >= maxHp) return 0;
    return Math.max(1, Math.ceil((maxHp - hp - repairBonusHp) / P.REPAIR_PER_KINDLING));
  },

  previewModuleRepair(hp: number, maxHp: number, kindling: number): number {
    if (!Number.isFinite(kindling) || Math.floor(kindling) <= 0) return hp;
    return Math.min(maxHp, hp + Math.floor(kindling) * P.REPAIR_PER_KINDLING + repairBonusHp);
  },

  // --- Upgrade discount (retrograde defense effect) ---

  getUpgradeDiscount(): number {
    return upgradeDiscount;
  },

  setUpgradeDiscount(value: number): void {
    upgradeDiscount = value;
  },

  consumeUpgradeDiscount(): number {
    const d = upgradeDiscount;
    upgradeDiscount = 0;
    return d;
  },

  // --- Reset (page-refresh equivalent for testing) ---

  reset(): void {
    kindlingReserve = 0;
    cycle = 0;
    impactIntensity = 1.0;
    pendingSideEffects = [];
    repairBonusHp = 0;
    upgradeDiscount = 0;
    moduleSwapActive = false;
    resonateBonusActive = false;
    moduleMaxHpTier = 0;
    ensurePurifier(P.MODULE_INITIAL_HP);
    for (const mod of modules) {
      mod.hp = P.MODULE_INITIAL_HP;
      mod.maxHp = maxHpForTier(0);
    }
  },
};
