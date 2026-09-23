/** Hub module interaction/readout. Device bodies belong to the chamber renderer. */
import Phaser from 'phaser';
import { CHAMBER_DEVICE_BASES, CHAMBER_INTERACTION_RADIUS } from '@/systems/purification-chamber-layout';
import { gameState, type ModuleType } from '@/managers/game-state';
import { INTEGRITY_COLORS, integrityFillColor, moduleIntegrityBounds, placeIntegrityReadout, type IntegrityPlacement, type IntegrityRect } from '@/ui/chamber-integrity-placement';

export class ChamberModule {
  readonly x: number;
  readonly y: number;
  private readonly readout: Phaser.GameObjects.Graphics;
  private inRange = false;
  private focused = false;
  private integrityPlacement: IntegrityPlacement | null = null;
  private readonly visualBase: Readonly<{ x: number; y: number }>;

  constructor(scene: Phaser.Scene, readonly id: ModuleType, point: Readonly<{ x: number; y: number }>) {
    this.x = point.x;
    this.y = point.y;
    this.visualBase = CHAMBER_DEVICE_BASES[id.toLowerCase() as 'core' | 'storage' | 'purifier'];
    this.readout = scene.add.graphics().setDepth(550);
  }

  update(x: number, y: number, canInteract: boolean): void {
    this.inRange = canInteract && Math.hypot(x - this.x, y - this.y) <= CHAMBER_INTERACTION_RADIUS;
  }

  /** Draw after the actor rig has synchronized this frame, including turns. */
  syncIntegrityReadout(playerBounds: IntegrityRect, playerX: number): void {
    this.readout.clear();
    const hp = this.getHpData();
    if (!this.inRange) this.integrityPlacement = null;
    if (!hp || !this.inRange || this.focused) return;
    const ratio = Math.max(0, Math.min(1, hp.hp / hp.maxHp));
    const { x: baseX, y: baseY } = this.visualBase;
    this.integrityPlacement = placeIntegrityReadout({
      device: moduleIntegrityBounds(this.id, baseX, baseY), player: playerBounds, playerX,
      previousSide: this.integrityPlacement?.side,
      width: 2, height: 24, gap: 7, hysteresis: 8, clearance: 5,
    });
    if (!this.integrityPlacement.visible) return;
    const { left, top } = this.integrityPlacement.rect;
    const barX = Math.round(left), barY = Math.round(top), fillHeight = Math.round(24 * ratio);
    this.readout.fillStyle(Number(INTEGRITY_COLORS.track.replace('#', '0x'))).fillRect(barX, barY, 2, 24);
    this.readout.fillStyle(Number(integrityFillColor(hp.hp, hp.maxHp).replace('#', '0x')))
      .fillRect(barX, barY + 24 - fillHeight, 2, fillHeight);
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
