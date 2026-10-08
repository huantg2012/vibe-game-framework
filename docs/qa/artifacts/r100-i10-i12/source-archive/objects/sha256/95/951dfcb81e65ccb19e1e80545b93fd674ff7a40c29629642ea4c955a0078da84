/**
 * Gym entry. Separate HTML so it does not boot the main menu or a sortie.
 * Agent contract: docs/dev/gym.md.
 */

import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { assertBalanceInvariants } from '@/config/invariants';
import { GymBootScene } from '@/gym/gym-boot-scene';
import { GymLexiconGalleryScene } from '@/gym/gym-lexicon-gallery-scene';
import { GymMapScene } from '@/gym/gym-map-scene';
import { GymPaintVeinCardScene } from '@/gym/gym-paint-vein-card-scene';
import { GymPlayerScene } from '@/gym/gym-player-scene';
import { GymRiftEntranceCardScene } from '@/gym/gym-rift-entrance-card-scene';
import { GymOfferingCardScene } from '@/gym/gym-offering-card-scene';
import { GymGrowthCardScene } from '@/gym/gym-growth-card-scene';
import { GymScene } from '@/gym/gym-scene';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';

if (import.meta.env.DEV) assertBalanceInvariants();

// The old configuration yard is replaced by the focused inspector.
if (new URLSearchParams(location.search).get('lesson') === 'rift-world') {
  const params = new URLSearchParams(location.search);
  params.delete('lesson');
  location.replace(`/rift-gym.html?${params}`);
} else if (new URLSearchParams(location.search).get('lesson') === 'lexicon') {
  location.replace('/enemy-inspector.html');
} else {
const game = new Phaser.Game(
  gameConfigWithScenes([
    GymBootScene,
    GymScene,
    GymPlayerScene,
    GymMapScene,
    GymLexiconGalleryScene,
    GymPaintVeinCardScene,
    GymRiftEntranceCardScene,
    GymOfferingCardScene,
    GymGrowthCardScene,
  ]),
);
bindDomUiRootToGame(game);

if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

}
