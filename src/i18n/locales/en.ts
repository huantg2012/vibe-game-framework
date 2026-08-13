/**
 * English locale.
 * Must maintain the same structure as LocaleSchema.
 *
 * Style rules (from world.md - apply to all languages):
 * - Terse, factual, no emotional embellishment
 * - No exclamation marks, no rhetorical questions
 * - Tooltip/short: concise; Description: max ~80 chars (English equivalent of 40 CJK chars)
 */

import type { LocaleSchema } from '../types';

export const en: LocaleSchema = {
  // Common
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    back: 'Back',
  },

  // Main Menu
  menu: {
    title: 'Enduring',
    subtitle: 'The boundary holds. The light has not gone out.',
    newGame: 'Enter the Purification Point',
    continue: 'Return by the old path',
    newSave: 'New record',
    loadSave: 'Load record',
    resume: 'Resume',
    pauseTitle: 'Records',
    language: 'Language',
    overwriteWarning: 'This will erase all records of Tide {tideNumber}.',
    overwriteClear: 'Erase and start new',
  },

  // HUD (in-game overlay)
  hud: {
    chaos: {
      label: 'Chaos',
    },
    health: {
      label: 'Status',
    },
    kindling: {
      label: 'Kindling',
    },
  },

  // Rift scene
  rift: {
    exitHint: 'Extraction point marked',
    chaosWarning: 'Foreign infiltration intensifying',
    returnToMenu: 'Press ESC to return',
  },

  // Purification point
  purify: {
    title: 'Purification Point',
    allocate: {
      title: 'Kindling Allocation',
      confirm: 'Confirm Allocation',
      remaining: 'Remaining: {amount}',
    },
    module: {
      core: 'Core Module',
      storage: 'Storage Module',
      healthy: 'Operational',
      damaged: 'Damaged',
      critical: 'Critical',
    },
    enterRift: 'Enter Rift',
  },

  // Impact
  impact: {
    warning: 'Boundary pressure rising',
    intensity: 'Estimated impact intensity: {level}',
    result: {
      safe: 'Module intact',
      damaged: 'Module damaged',
      destroyed: 'Module critically damaged',
    },
  },

  // Items
  item: {
    kindling: {
      name: 'Kindling',
      desc: 'Compressed residue from foreign sources. Releases negation when burned.',
    },
  },

  // Enemies
  enemy: {
    patrolInfiltrate: {
      name: 'Patrol Infiltrate',
      desc: 'Organic base, low-degree overwrite. Visual perception, fixed patrol path.',
    },
  },
};
