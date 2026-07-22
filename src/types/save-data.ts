/**
 * Save data schema definition.
 * Version number allows forward-compatible migrations.
 */

import type { ItemSlot, PurificationModule } from './game-types';

/** Current save format version */
export const SAVE_VERSION = 1;

/** LocalStorage key */
export const SAVE_KEY = 'coh_save';

/** Complete save data structure */
export interface SaveData {
  /** Save format version for migration compatibility */
  version: number;

  /** Unix timestamp of when save was created */
  timestamp: number;

  /** Current cycle number (how many rift expeditions completed) */
  cycle: number;

  /** Purification point state */
  purificationPoint: {
    modules: PurificationModule[];
    kindlingReserve: number;
  };

  /** Player persistent state (carries across rifts) */
  player: {
    maxHealth: number;
    inventory: ItemSlot[];
  };

  /** Meta-progression values */
  meta: {
    /** Base impact intensity (increases each cycle) */
    impactIntensity: number;
    /** Total kindling ever earned (statistics) */
    totalKindlingEarned: number;
    /** Total rifts entered (statistics) */
    totalRiftsEntered: number;
  };
}
