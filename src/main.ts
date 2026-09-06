/**
 * Game entry point.
 * Creates the Phaser game instance.
 */

import Phaser from 'phaser';
import { gameConfig } from '@/config/game-config';
import { assertBalanceInvariants } from '@/config/invariants';
import { bindDomUiRootToGame, getDomUiRoot } from '@/ui/dom/panel-styles';
import { pauseMenu } from '@/ui/dom/pause-menu';
import { audioManager } from '@/managers/audio-manager';

// Before anything boots: a tuning pass that broke a balance invariant would make every
// playtest afterwards answer the wrong question.
if (import.meta.env.DEV) assertBalanceInvariants();

// Create game instance
const game = new Phaser.Game(gameConfig);

// DOM↔Phaser scale alignment (ui-art-overhaul.md A1): every DOM overlay panel mounts
// under #dom-ui-root instead of document.body, and this keeps that root's transform in
// sync with the canvas's actual on-screen box under Scale.FIT.
bindDomUiRootToGame(game);

// ---------------------------------------------------------------------------
// Pause/resume on window blur/focus with visible overlay
// ---------------------------------------------------------------------------

let paused = false;

const overlay = document.createElement('div');
overlay.id = 'pause-overlay';
overlay.className = 'scene-menu-backdrop scene-menu-compact-backdrop';
overlay.style.cssText =
  'position:absolute;inset:0;display:none;z-index:9999;pointer-events:auto;';
overlay.innerHTML =
  '<div class="focus-pause-copy">已暂停<span>点击画面或按任意键继续</span></div>';
getDomUiRoot().appendChild(overlay);

function pauseGame(): void {
  if (pauseMenu.isOpen()) return;
  if (paused) return;
  paused = true;
  game.scene.scenes.forEach((scene) => {
    if (scene.scene.isActive()) scene.scene.pause();
  });
  audioManager.pauseAll();
  overlay.style.display = 'flex';
}

function resumeGame(): void {
  if (!paused) return;
  paused = false;
  game.scene.scenes.forEach((scene) => {
    if (scene.scene.isPaused()) scene.scene.resume();
  });
  audioManager.resumeAll();
  overlay.style.display = 'none';
}

window.addEventListener('blur', pauseGame);
window.addEventListener('focus', () => {
  // Don't auto-resume on focus; require a click/keypress to confirm the player is ready
});

overlay.addEventListener('click', resumeGame);
document.addEventListener('keydown', (e) => {
  if (pauseMenu.isOpen()) return;
  if (paused && !e.repeat) resumeGame();
});

// Expose game instance for debugging (dev only)
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
