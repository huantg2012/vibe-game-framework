/**
 * Shared new-game / load-game bootstrap.
 *
 * Main menu and the in-game Esc record menu both need the same reset/load
 * sequence. Kept here so neither scene reimplements the list of systems that
 * must be cleared (defense-engine runtime state was missed once already).
 */

import Phaser from 'phaser';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { contaminantSystem } from '@/systems/contaminant-system';
import { resetDefenseEngine } from '@/systems/defense-engine';
import { growthSystem } from '@/systems/growth-system';
import { impactSystem } from '@/systems/impact-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';

export function hasReadableSave(): boolean {
  return saveManager.hasSave() && saveManager.peekTideNumber() !== null;
}

/** Wipe runtime + save, then enter the purification point as a new record. */
export function beginNewExpedition(host: Phaser.Scene): void {
  saveManager.deleteSave();
  gameState.reset();
  tideSystem.reset();
  contaminantSystem.reset();
  growthSystem.reset();
  stabilityTracker.reset();
  resetDefenseEngine();
  impactSystem.resetForecastState();
  host.scene.start('PurificationScene', { fromMenu: true });
}

/** Load the stored record. Falls back to a new expedition if the file is unreadable. */
export function loadExpedition(host: Phaser.Scene): void {
  const loaded = saveManager.load();
  if (loaded) {
    host.scene.start('PurificationScene', { fromMenu: true });
  } else {
    beginNewExpedition(host);
  }
}
