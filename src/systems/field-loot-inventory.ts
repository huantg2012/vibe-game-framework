import { contaminantWorldPixels } from '@/art/contaminant-icons';
import { getContaminantQuality } from '@/systems/contaminant-quality';
import { renderCrowbarPixels } from '@/art/crowbar-pixels';
import { WEAPON_DATA } from '@/generated/weapon-data';
/** Revealed field items: a projection of InventoryStore, never a second inventory. */
import type Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { inventoryStore } from '@/systems/inventory-store';
import { GameEvent } from '@/types/events';
import type { Vector2 } from '@/types/game-types';
import type { InventoryItem, InventoryResult } from '@/types/inventory-types';
import { runtimeRecord, runtimeStrings } from '@/systems/ai/runtime-validation';

let acquisitionRun: string | null = null;
const acquiredIds = new Set<string>();

export interface FieldLootRuntimeState {
  readonly version: 1;
  readonly acquisitionRun: string | null;
  readonly acquiredIds: readonly string[];
}

export function validateFieldLootRuntimeState(value: unknown): value is FieldLootRuntimeState {
  return runtimeRecord(value) && value.version === 1
    && (value.acquisitionRun === null || (typeof value.acquisitionRun === 'string' && value.acquisitionRun.length > 0))
    && runtimeStrings(value.acquiredIds, 4096) && (value.acquisitionRun !== null || value.acquiredIds.length === 0);
}

/** Call only AFTER a successful take/reveal transaction (also used by bag exchange). */
export function notifyFieldAcquisition(ids: readonly string[]): void {
  const run = inventoryStore.getRun();
  if (!run || run.status !== 'active') return;
  if (acquisitionRun !== run.id) {
    acquisitionRun = run.id;
    acquiredIds.clear();
    for (const id of run.carriedOutIds) acquiredIds.add(id);
  }
  for (const id of ids) {
    const item = inventoryStore.getItem(id);
    if (!item || item.location.kind !== 'carried' || acquiredIds.has(id)) continue;
    acquiredIds.add(id);
    if (item.kind === 'contaminant') {
      eventBus.emit(GameEvent.CONTAMINANT_ACQUIRED, { contaminant: item.contaminant });
    }
  }
}

export interface FieldLootInput {
  interactHeld: boolean;
  /** The shared nearest-object prompt has awarded E to this revealed item. */
  pickupPriority: boolean;
  /** Bag, attack, tool input, movement, hit, pause, or ended run. */
  blocked?: boolean;
}

export class FieldLootInventory {
  private scene: Phaser.Scene | null = null;
  private unsubscribe: (() => void) | null = null;
  private getPlayerPos!: () => Readonly<Vector2>;
  private getVisibilityAt!: (position: Readonly<Vector2>) => number;
  private legalGround!: (position: Readonly<Vector2>) => boolean;
  private onOpenBag!: () => void;
  private onMessage!: (message: string) => void;
  private readonly visuals = new Map<string, Phaser.GameObjects.Graphics>();
  /** A held search key must not take the item it has just revealed. */
  private released = false;

  exportRuntimeState(): FieldLootRuntimeState {
    return { version: 1, acquisitionRun, acquiredIds: [...acquiredIds] };
  }

  validateRuntimeState(value: unknown): value is FieldLootRuntimeState {
    if (!validateFieldLootRuntimeState(value)) return false;
    const run = inventoryStore.getRun();
    if (run?.id !== value.acquisitionRun) return true; // No notification yet in this run.
    const known = new Set([...run.carriedOutIds, ...run.destroyedIds, ...Object.values(run.revealedNodes).flat()]);
    return value.acquiredIds.every(id => known.has(id));
  }

  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid field acquisition runtime state');
    acquisitionRun = value.acquisitionRun;
    acquiredIds.clear();
    for (const id of value.acquiredIds) acquiredIds.add(id);
    // Reconnect requires a fresh key release; neither acquisition events nor held E replay.
    this.released = false;
  }

  create(
    scene: Phaser.Scene,
    getPlayerPos: () => Readonly<Vector2>,
    getVisibilityAt: (position: Readonly<Vector2>) => number,
    legalGround: (position: Readonly<Vector2>) => boolean,
    onOpenBag: () => void,
    onMessage: (message: string) => void,
  ): void {
    this.destroy();
    this.scene = scene;
    this.getPlayerPos = getPlayerPos;
    this.getVisibilityAt = getVisibilityAt;
    this.legalGround = legalGround;
    this.onOpenBag = onOpenBag;
    this.onMessage = onMessage;
    this.released = false;
    this.syncVisuals();
    this.unsubscribe = inventoryStore.subscribe(() => this.syncVisuals());
  }

  readonly canTake = (item: Readonly<InventoryItem>): boolean => {
    if (!this.scene || item.location.kind !== 'ground') return false;
    const run = inventoryStore.getRun();
    if (!run || run.status !== 'active' || item.location.runId !== run.id) return false;
    const position = item.location.position;
    const player = this.getPlayerPos();
    return Math.hypot(position.x - player.x, position.y - player.y) <= GAME_CONSTANTS.LOOT.SEARCH_RADIUS
      && this.getVisibilityAt(position) > 0 && this.legalGround(position);
  };

  readonly canDrop = (position: Readonly<Vector2>): boolean => {
    if (!this.scene || inventoryStore.getRun()?.status !== 'active') return false;
    const player = this.getPlayerPos();
    return Number.isFinite(position.x) && Number.isFinite(position.y)
      && Math.hypot(position.x - player.x, position.y - player.y) <= GAME_CONSTANTS.LOOT.SEARCH_RADIUS
      && this.legalGround(position) && this.getVisibilityAt(position) > 0;
  };

  hasNearby(): boolean { return inventoryStore.getItems().some(this.canTake); }

  getNearby(): readonly InventoryItem[] {
    if (!this.scene) return [];
    const player = this.getPlayerPos();
    const distance = (item: InventoryItem): number => item.location.kind === 'ground'
      ? Math.hypot(item.location.position.x - player.x, item.location.position.y - player.y) : Infinity;
    return inventoryStore.getItems().filter(this.canTake).sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id));
  }

  take(ids: readonly string[]): InventoryResult {
    const result = inventoryStore.take(ids, this.canTake);
    if (result.ok) notifyFieldAcquisition(ids);
    this.syncVisuals();
    return result;
  }

  update(_deltaMs: number, input: FieldLootInput): void {
    for (const [id, visual] of this.visuals) {
      const item = inventoryStore.getItem(id);
      if (item?.location.kind !== 'ground') continue;
      const visibility = this.getVisibilityAt(item.location.position);
      visual.setVisible(visibility > 0).setAlpha(Math.max(0, Math.min(1, visibility)));
    }
    if (!input.interactHeld) { this.released = true; return; }
    const pressed = this.released;
    this.released = false;
    if (!pressed || input.blocked || !input.pickupPriority) return;
    const item = this.getNearby()[0];
    if (!item) return;
    const result = this.take([item.id]);
    if (!result.ok) {
      this.onMessage(result.error === 'overweight' ? '负重不足。腾出位置再取。' : '未能取走。物件仍在原处。');
      if (result.error === 'overweight') this.onOpenBag();
    }
  }

  destroy(): void {
    this.unsubscribe?.(); this.unsubscribe = null;
    for (const visual of this.visuals.values()) visual.destroy();
    this.visuals.clear();
    this.scene = null;
    this.released = false;
  }

  private syncVisuals(): void {
    if (!this.scene) return;
    const run = inventoryStore.getRun();
    const ids = new Set<string>();
    for (const item of inventoryStore.getItems()) {
      if (run?.status !== 'active' || item.location.kind !== 'ground' || item.location.runId !== run.id) continue;
      ids.add(item.id);
      let visual = this.visuals.get(item.id);
      if (!visual) {
        visual = this.scene.add.graphics().setDepth(16);
        this.paint(visual, item);
        this.visuals.set(item.id, visual);
      }
      const position = item.location.position;
      const visibility = this.getVisibilityAt(position);
      visual.setPosition(Math.round(position.x), Math.round(position.y));
      visual.setVisible(visibility > 0).setAlpha(Math.max(0, Math.min(1, visibility)));
    }
    for (const [id, visual] of this.visuals) {
      if (!ids.has(id)) { visual.destroy(); this.visuals.delete(id); }
    }
  }

  private paint(graphics: Phaser.GameObjects.Graphics, item: InventoryItem): void {
    // Hard integer pixels; no floating marker, rarity pillar, or pickup billboard.
    graphics.fillStyle(0x111715, .8).fillRect(-6, 2, 13, 3);
    if (item.kind === 'weapon') {
      const definition = WEAPON_DATA[item.weapon.definitionId];
      const pixels = renderCrowbarPixels(definition?.quality ?? 'ordinary', definition?.variant ?? 'standard', 'world');
      for (let y = 0; y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
        const i = (y * pixels.width + x) * 4;
        if (!pixels.data[i + 3]) continue;
        const color = pixels.data[i]! * 65536 + pixels.data[i + 1]! * 256 + pixels.data[i + 2]!;
        // Turn the actual native model onto the ground, preserving every pixel.
        graphics.fillStyle(color, 1).fillRect(y - 16, x - 16, 1, 1);
      }
    } else {
      const pixels = contaminantWorldPixels(item.contaminant.type, getContaminantQuality(item.contaminant));
      for (let y = 0; y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
        const i = (y * pixels.width + x) * 4;
        if (!pixels.data[i + 3]) continue;
        const color = pixels.data[i]! * 65536 + pixels.data[i + 1]! * 256 + pixels.data[i + 2]!;
        graphics.fillStyle(color, 1).fillRect(x - pixels.width / 2, y - pixels.height / 2, 1, 1);
      }
    }
  }
}
