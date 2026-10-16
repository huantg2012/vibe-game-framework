/**
 * Game entry point.
 * Creates the Phaser game instance.
 */

import Phaser from 'phaser';
import { gameConfig } from '@/config/game-config';
import { assertBalanceInvariants } from '@/config/invariants';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';

// Before anything boots: a tuning pass that broke a balance invariant would make every
// playtest afterwards answer the wrong question.
if (import.meta.env.DEV) assertBalanceInvariants();

// Create game instance
const game = new Phaser.Game(gameConfig);

// DOM↔Phaser scale alignment (ui-art-overhaul.md A1): every DOM overlay panel mounts
// under #dom-ui-root instead of document.body, and this keeps that root's transform in
// sync with the canvas's actual on-screen box under Scale.FIT.
bindDomUiRootToGame(game);

// Expose game instance for debugging (dev only)
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
