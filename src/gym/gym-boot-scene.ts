/**
 * Gym boot: same placeholder textures as the sortie, no audio, no main menu.
 */

import Phaser from 'phaser';
import { generatePlaceholderTextures } from '@/scenes/placeholder-textures';
import { readGymLesson, type GymLesson } from '@/gym/gym-lesson';

const SCENE_BY_LESSON: Record<GymLesson, string> = {
  enemy: 'GymScene',
  player: 'GymPlayerScene',
  map: 'GymMapScene',
  lexicon: 'GymLexiconScene',
};

export class GymBootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GymBootScene' });
  }

  create(): void {
    generatePlaceholderTextures(this);
    const lesson = readGymLesson();

    setCurrentNav(lesson);
    setHidden('gym-dirs-block', lesson !== 'enemy');
    setHidden('gym-map-controls', lesson !== 'map');
    setHidden('gym-lexicon-controls', lesson !== 'lexicon');
    setHidden('gym-rules-enemy', lesson !== 'enemy');
    setHidden('gym-rules-player', lesson !== 'player');
    setHidden('gym-rules-map', lesson !== 'map');
    setHidden('gym-rules-lexicon', lesson !== 'lexicon');
    setHidden('gym-map-legend', lesson !== 'map');

    this.scene.start(SCENE_BY_LESSON[lesson]);
  }
}

function setCurrentNav(lesson: GymLesson): void {
  const ids: Record<GymLesson, string> = {
    enemy: 'gym-link-enemy',
    player: 'gym-link-player',
    map: 'gym-link-map',
    lexicon: 'gym-link-lexicon',
  };
  for (const [key, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (key === lesson) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  }
}

function setHidden(id: string, hidden: boolean): void {
  const el = document.getElementById(id);
  if (el) el.hidden = hidden;
}
