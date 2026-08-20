/**
 * Gym boot: same placeholder textures as the sortie, no audio, no main menu.
 */

import Phaser from 'phaser';
import { generatePlaceholderTextures } from '@/scenes/placeholder-textures';

export class GymBootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GymBootScene' });
  }

  create(): void {
    generatePlaceholderTextures(this);
    const lesson = new URLSearchParams(window.location.search).get('lesson');
    const playerLesson = lesson === 'player';
    if (playerLesson) {
      document.getElementById('gym-link-player')?.setAttribute('aria-current', 'page');
      document.getElementById('gym-link-enemy')?.removeAttribute('aria-current');
    } else {
      document.getElementById('gym-link-enemy')?.setAttribute('aria-current', 'page');
      document.getElementById('gym-link-player')?.removeAttribute('aria-current');
    }
    const dirs = document.getElementById('gym-dirs-block');
    if (dirs) dirs.hidden = playerLesson;
    const enemyRules = document.getElementById('gym-rules-enemy');
    const playerRules = document.getElementById('gym-rules-player');
    if (enemyRules) enemyRules.hidden = playerLesson;
    if (playerRules) playerRules.hidden = !playerLesson;
    this.scene.start(playerLesson ? 'GymPlayerScene' : 'GymScene');
  }
}
