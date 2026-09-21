/** Hub module interaction/readout. Device bodies belong to the chamber renderer. */
import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { gameState, type ModuleType } from '@/managers/game-state';

export class ChamberModule {
  readonly x: number;
  readonly y: number;
  private readonly readout: Phaser.GameObjects.Graphics;
  private inRange = false;
  private focused = false;

  constructor(scene: Phaser.Scene, readonly id: ModuleType, point: Readonly<{ x: number; y: number }>) {
    this.x = point.x;
    this.y = point.y;
    this.readout = scene.add.graphics().setDepth(60);
  }

  update(x: number, y: number, canInteract: boolean): void {
    this.inRange = canInteract && Math.hypot(x - this.x, y - this.y) <= GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;
    this.readout.clear();
    const hp = this.getHpData();
    if (!hp || !this.inRange || this.focused) return;
    const ratio = Math.max(0, Math.min(1, hp.hp / hp.maxHp));
    // Only the approached fixture displays a small integrity readout.
    this.readout.fillStyle(0x151a1e).fillRect(this.x - 14, this.y + 15, 28, 3);
    this.readout.fillStyle(ratio < .3 ? 0x8a5c2a : 0x5a5f66)
      .fillRect(this.x - 14, this.y + 15, Math.round(28 * ratio), 2);
  }

  isInRange(): boolean { return this.inRange; }
  setInteractionReadoutActive(active: boolean): void { this.focused = active; this.readout.setVisible(!active); }
  getHpData(): { hp: number; maxHp: number } | null {
    const mod = gameState.getModule(this.id);
    return mod ? { hp: mod.hp, maxHp: mod.maxHp } : null;
  }
  getEffectPct(): number {
    if (this.id === 'PURIFIER') return 0;
    // Shared gameplay output also accounts for module-swapping/resonance.
    const effect = gameState.getModuleEffect(this.id);
    return Math.round((this.id === 'CORE' ? 1 - effect : effect - 1) * 100);
  }
  destroy(): void { this.readout.destroy(); }
}
