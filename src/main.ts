/**
 * Game entry point.
 * Creates the Phaser game instance.
 */

import Phaser from 'phaser';
import { gameConfig } from '@/config/game-config';

// Create game instance
const game = new Phaser.Game(gameConfig);

// Handle page visibility (pause/resume)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.scene.scenes.forEach((scene) => {
      if (scene.scene.isActive()) {
        scene.scene.pause();
      }
    });
  } else {
    game.scene.scenes.forEach((scene) => {
      if (scene.scene.isPaused()) {
        scene.scene.resume();
      }
    });
  }
});

// Expose game instance for debugging (dev only)
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
