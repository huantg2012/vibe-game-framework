/**
 * Gym entry. Separate HTML so it does not boot the main menu or a sortie.
 * Agent contract: docs/dev/gym.md.
 */

import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { assertBalanceInvariants } from '@/config/invariants';
import { GymBootScene } from '@/gym/gym-boot-scene';
import { GymLexiconGalleryScene } from '@/gym/gym-lexicon-gallery-scene';
import { GymLexiconScene } from '@/gym/gym-lexicon-scene';
import { GymMapScene } from '@/gym/gym-map-scene';
import { GymPaintVeinCardScene } from '@/gym/gym-paint-vein-card-scene';
import { GymPlayerScene } from '@/gym/gym-player-scene';
import { GymScene } from '@/gym/gym-scene';
import { GymVisionLabScene } from '@/gym/gym-vision-lab-scene';

if (import.meta.env.DEV) assertBalanceInvariants();

const game = new Phaser.Game(
  gameConfigWithScenes([
    GymBootScene,
    GymScene,
    GymPlayerScene,
    GymMapScene,
    GymLexiconScene,
    GymLexiconGalleryScene,
    GymPaintVeinCardScene,
    GymVisionLabScene,
  ]),
);

if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
