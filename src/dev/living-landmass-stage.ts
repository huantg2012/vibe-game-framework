import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { LivingLandmassStudyScene } from './living-landmass-stage/scene';

if (import.meta.env.DEV) {
  const failures: string[] = [], output = document.querySelector<HTMLOutputElement>('#error')!;
  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    failures.push(message); output.textContent = failures.join('\n');
  };
  window.addEventListener('error', event => report(event.error ?? event.message));
  window.addEventListener('unhandledrejection', event => report(event.reason));
  try {
    const game = new Phaser.Game(gameConfigWithScenes([LivingLandmassStudyScene]));
    Object.defineProperty(window, '__livingLandmassStage', { configurable: false, writable: false,
      value: Object.freeze({ getState: () => ({ ...((game.scene.getScene('LivingLandmassStudy') as LivingLandmassStudyScene | null)?.snapshot()
        ?? { ready: false }), pageErrors: [...failures] }) }) });
    window.addEventListener('pagehide', () => {
      (game.scene.getScene('LivingLandmassStudy') as LivingLandmassStudyScene | null)?.dispose();
      game.destroy(true);
    }, { once: true });
  } catch (error) { report(error); }
}
