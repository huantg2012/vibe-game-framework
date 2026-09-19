import type { ContaminationForm } from '@/generation/contamination-draw';
import type { LegacyContaminantType, ContaminantQuality } from '@/types/game-types';

/** Review configuration; never loaded from or persisted to a player's save. */
export interface CombatLabConfig {
  form: ContaminationForm;
  seed: number;
  fragmentTypeId: string;
  weaponId: string;
  toolQuality: ContaminantQuality;
  tools: readonly [LegacyContaminantType | null, LegacyContaminantType | null, LegacyContaminantType | null];
  count: 1 | 2 | 3;
  empty: boolean;
  protected: boolean;
  autoReset: boolean;
  zoom: number;
  extraWeight: number;
  startingChaos: number;
}
export interface CombatLabSubjectState {
  id: string;
  health: number | null;
  nuclei: number;
  alive: boolean;
  phase: string;
}
export interface CombatLabState {
  ready: boolean;
  health: number;
  maxHealth: number;
  chaos: number;
  weight: number;
  resistancePercent: number;
  speedFactor: number;
  playerPhase: string;
  weaponDurability: number;
  weaponMaxDurability: number;
  lastSwingDamage: number;
  swingCount: number;
  hitsDealt: number;
  hitsTaken: number;
  subjects: CombatLabSubjectState[];
  tools: { id: LegacyContaminantType; remaining: number }[];
  message: string;
  roundEnded: boolean;
  textureCount: number;
}
