/**
 * Game entry point.
 * Creates the Phaser game instance.
 */

import Phaser from 'phaser';
import { gameConfig } from '@/config/game-config';
import { assertBalanceInvariants } from '@/config/invariants';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { pauseMenu } from '@/ui/dom/pause-menu';

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

// C6: colours were #ccc/#888 - neither is a locked palette value (ui-art-overhaul.md
// §A2). Swapped for the standard bright/dim text pair; font family aligned to the
// same 'Courier New' the rest of the game's DOM overlays use (U11).
const overlay = document.createElement('div');
overlay.id = 'pause-overlay';
overlay.style.cssText =
  'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:none;' +
  'align-items:center;justify-content:center;z-index:9999;cursor:pointer;';
overlay.innerHTML =
  '<div style="color:#c8cdd4;font-family:\'Courier New\',monospace;font-size:20px;text-align:center;">' +
  '已暂停<br><span style="font-size:13px;color:#8a8f96;">点击继续</span></div>';
document.body.appendChild(overlay);

function pauseGame(): void {
  if (pauseMenu.isOpen()) return;
  if (paused) return;
  paused = true;
  game.scene.scenes.forEach((scene) => {
    if (scene.scene.isActive()) scene.scene.pause();
  });
  game.sound?.pauseAll();
  overlay.style.display = 'flex';
}

function resumeGame(): void {
  if (!paused) return;
  paused = false;
  game.scene.scenes.forEach((scene) => {
    if (scene.scene.isPaused()) scene.scene.resume();
  });
  game.sound?.resumeAll();
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
