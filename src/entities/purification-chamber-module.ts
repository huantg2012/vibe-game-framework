/** Hub module interaction/readout. Device bodies belong to the chamber renderer. */
import Phaser from 'phaser';
import { CHAMBER_DEVICE_BASES } from '@/systems/purification-chamber-layout';
import { gameState, type ModuleType } from '@/managers/game-state';
import { INTEGRITY_COLORS, integrityCapacityRatio, integrityFillColor, moduleIntegrityBounds,
  type IntegrityPlacementInput, type IntegrityRect } from '@/ui/chamber-integrity-placement';
import { ChamberIntegrityLifecycle, type IntegrityPresentation } from '@/ui/chamber-integrity-lifecycle';

export interface ChamberModuleGeometry {
  readonly base: Readonly<{x:number;y:number}>;
  readonly bounds: readonly [number,number,number,number];
}

export class ChamberModule {
  readonly x: number;
  readonly y: number;
  private readonly readout: Phaser.GameObjects.Graphics;
  private inRange = false;
  private readonly integrity = new ChamberIntegrityLifecycle();
  private readonly visualBase: Readonly<{ x: number; y: number }>;
  private readonly authoredGeometry?: ChamberModuleGeometry;

  constructor(private readonly scene: Phaser.Scene, readonly id: ModuleType, point: Readonly<{ x: number; y: number }>, geometry?:ChamberModuleGeometry) {
    this.x = point.x;
    this.y = point.y;
    this.authoredGeometry = geometry;
    this.visualBase = geometry?.base ?? CHAMBER_DEVICE_BASES[id.toLowerCase() as 'core' | 'storage' | 'purifier'];
    this.readout = scene.add.graphics().setDepth(550);
  }

  /** The physical scene owns eligibility; presentation must not add a second radius. */
  update(canInteract: boolean): void {
    this.inRange = canInteract;
  }

  getWorldBounds():IntegrityRect {
    const {x,y}=this.visualBase,b=this.authoredGeometry?.bounds;
    return b ? {left:x+b[0],top:y+b[1],right:x+b[2],bottom:y+b[3]} : moduleIntegrityBounds(this.id,x,y);
  }

  /** Observation is selected by the scene, independently of existing E eligibility. */
  setObservationActive(active: boolean, immediate = false): void {
    this.integrity.setObserved(active, this.scene.time.now, immediate);
  }

  /** Draw after the actor rig has synchronized this frame, including turns. */
  syncIntegrityReadout(playerBounds: IntegrityRect, playerX: number,
    geometry: { viewport?: IntegrityRect; reserved?: readonly IntegrityRect[] } = {}): void {
    this.readout.clear();
    const hp = this.getHpData();
    if (!hp) return;
    const ratio = integrityCapacityRatio(hp.hp, hp.maxHp);
    // Include the one-pixel dark edge in the reserved rectangle, not only fill.
    const presentation = this.integrity.sample('world', {
      device: this.getWorldBounds(), player: playerBounds, playerX,
      width: 4, height: 26, gap: 7, hysteresis: 8, clearance: 5, ...geometry,
    }, this.scene.time.now);
    if (!presentation.placement.visible || presentation.opacity <= 0) return;
    const { left, top } = presentation.placement.rect;
    const barX = Math.round(left) + 1, barY = Math.round(top) + 1, fillHeight = Math.round(24 * ratio);
    this.readout.setAlpha(presentation.opacity);
    this.readout.fillStyle(Number(INTEGRITY_COLORS.outline.replace('#', '0x'))).fillRect(barX - 1, barY - 1, 4, 26);
    this.readout.fillStyle(Number(INTEGRITY_COLORS.track.replace('#', '0x'))).fillRect(barX, barY, 2, 24);
    this.readout.fillStyle(Number(integrityFillColor(hp.hp, hp.maxHp).replace('#', '0x')))
      .fillRect(barX, barY + 24 - fillHeight, 2, fillHeight);
    // An empty gauge still communicates failure without pretending to have HP.
    if (hp.hp <= 0) this.readout.fillRect(barX - 1, barY + 23, 4, 2);
  }

  isInRange(): boolean { return this.inRange; }
  setInteractionReadoutActive(active: boolean): void { this.integrity.setFocused(active, this.scene.time.now); }
  getFocusedIntegrityPresentation(input: IntegrityPlacementInput): IntegrityPresentation {
    return this.integrity.sample('focused', input, this.scene.time.now);
  }
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
