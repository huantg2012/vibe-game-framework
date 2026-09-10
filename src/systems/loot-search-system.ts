import { createWeaponInstance, rollWeaponDrop } from '@/systems/weapon-loot';
import { WEAPON_DATA } from '@/generated/weapon-data';
/**
 * Loot-search channel: hold E for SEARCH_CHANNEL_MS, then settle.
 * Production default for rift pickups (iteration 10 / DEC-109).
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { rollContaminantDrop, getContaminantQualityName, supportsContaminantQuality } from '@/systems/contaminant-quality';
import { audioManager } from '@/managers/audio-manager';
import { contaminantSystem } from '@/systems/contaminant-system';
import { inventoryStore } from '@/systems/inventory-store';
import { notifyFieldAcquisition } from '@/systems/field-loot-inventory';
import {
  createSearchObjectVisual,
  ensureLootSearchTextures,
  type SearchObjectVisual,
} from '@/systems/loot-search-presentation';
import { GameEvent } from '@/types/events';
import type { ContaminantRarity, Vector2 } from '@/types/game-types';
import type { NewInventoryItem } from '@/types/inventory-types';
import type { ContaminantNodeDef, KindlingNodeDef, KindlingTier } from '@/types/map-types';
import { LootSearchHud, type LootSearchPromptKind } from '@/ui/dom/loot-search-hud';

const LOOP_INSTANCE = 'loot-search-loop';

export interface LootSearchInput {
  readonly playerPos: Readonly<Vector2>;
  readonly searchHeld: boolean;
  readonly moving: boolean;
  readonly attacking: boolean;
  readonly toolPressed: boolean;
  readonly hitThisFrame: boolean;
  readonly paused: boolean;
  readonly runEnded?: boolean;
  /** Scene arbitration: a nearby revealed item owns E instead of a hidden pile. */
  readonly interactionBlocked?: boolean;
}

export interface LootSearchCreateConfig {
  readonly overlayRoot: HTMLElement;
  readonly getVisibilityAt: (point: Readonly<Vector2>) => number;
  readonly fragmentTypeId: string;
  readonly extraction?: { readonly position: Readonly<Vector2>; readonly radius: number };
  readonly onNoise?: (
    pos: Readonly<Vector2>,
    radius: number,
    level: 'suspicious',
  ) => void;
  /** Gym preview: no inventory write, no production events. */
  readonly preview?: boolean;
  /** Opt-in only after scene begin/settle/recovery ownership is connected. */
  readonly inventoryEnabled?: boolean;
  readonly runSeed?: number;
  readonly kindlingValueModifier?: number;
  readonly showKindling?: boolean;
  readonly onMessage?: (message: string) => void;
}

interface SearchNode {
  readonly id: string;
  readonly kind: 'kindling' | 'contaminant';
  readonly position: Vector2;
  readonly value: number;
  collected: boolean;
  visual: SearchObjectVisual;
  /** Generated once, retained even when durable inventory publication fails. */
  revealedItem?: NewInventoryItem;
  weaponDefinitionId?: string | null;
  tier?: KindlingTier;
}

interface ChannelState {
  node: SearchNode;
  elapsedMs: number;
}

function tierValue(tier: KindlingTier): number {
  const loot = GAME_CONSTANTS.LOOT;
  switch (tier) {
    case 'safe': return loot.VALUE_SAFE;
    case 'contested': return loot.VALUE_CONTESTED;
    case 'deep': return loot.VALUE_DEEP;
  }
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class LootSearchSystem {
  private nodes: SearchNode[] = [];
  private getVisibilityAt!: (point: Readonly<Vector2>) => number;
  private extraction: LootSearchCreateConfig['extraction'];
  private onNoise: LootSearchCreateConfig['onNoise'];
  private preview = false;
  private inventoryEnabled = false;
  private runSeed = 0;
  private kindlingValueModifier = 1;
  private channel: ChannelState | null = null;
  private carried = 0;
  private readonly hud = new LootSearchHud();
  private readonly playerPos: Vector2 = { x: 0, y: 0 };
  private nearest: SearchNode | null = null;
  private nearestDist = 0;
  private prompt: LootSearchPromptKind = null;
  private loopPlaying = false;
  private requiresRelease = false;
  private onMessage: LootSearchCreateConfig['onMessage'];

  create(
    scene: Phaser.Scene,
    kindling: readonly KindlingNodeDef[],
    contaminants: readonly ContaminantNodeDef[],
    config: LootSearchCreateConfig,
  ): void {
    this.destroy();
    this.getVisibilityAt = config.getVisibilityAt;
    this.extraction = config.extraction;
    this.onNoise = config.onNoise;
    this.preview = config.preview === true;
    this.inventoryEnabled = config.inventoryEnabled === true;
    this.runSeed = config.runSeed ?? 0;
    this.onMessage = config.onMessage;
    this.requiresRelease = false;
    this.kindlingValueModifier = config.kindlingValueModifier ?? 1;
    this.carried = 0;
    this.channel = null;

    const slots = ensureLootSearchTextures(scene, config.fragmentTypeId);
    this.hud.create(config.overlayRoot, { showKindling: config.showKindling === true });
    if (config.showKindling) this.hud.setKindling(0);

    const readPlayer = (): Readonly<Vector2> => this.playerPos;
    const frag = config.fragmentTypeId;

    for (const def of kindling) {
      const value = def.value ?? tierValue(def.tier);
      this.nodes.push({
        id: def.id,
        kind: 'kindling',
        tier: def.tier,
        position: def.position,
        value,
        collected: false,
        visual: createSearchObjectVisual(
          scene,
          def.position.x,
          def.position.y,
          hashId(def.id),
          frag,
          slots,
          readPlayer,
        ),
      });
    }
    for (const def of contaminants) {
      this.nodes.push({
        id: def.id,
        kind: 'contaminant',
        position: def.position,
        value: 0,
        collected: false,
        visual: createSearchObjectVisual(
          scene,
          def.position.x,
          def.position.y,
          hashId(def.id),
          frag,
          slots,
          readPlayer,
        ),
      });
    }
  }

  getCarriedKindling(): number {
    return this.carried;
  }

  addBonusKindling(n: number): void {
    this.carried += Math.max(0, n);
    this.hud.setKindling(this.carried);
  }

  getRemainingCount(): number {
    let n = 0;
    for (const node of this.nodes) if (!node.collected) n++;
    return n;
  }

  getChannelProgress01(): number | null {
    if (!this.channel) return null;
    return this.channel.elapsedMs / GAME_CONSTANTS.LOOT.SEARCH_CHANNEL_MS;
  }

  getPrompt(): LootSearchPromptKind {
    return this.prompt;
  }

  getCollectedContaminantPositions(): readonly Vector2[] {
    const out: Vector2[] = [];
    for (const node of this.nodes) {
      if (node.kind === 'contaminant' && node.collected) out.push(node.position);
    }
    return out;
  }

  /** Revisitable fuel piles only; collected contaminant piles cannot yield bonus fuel. */
  getCollectedKindlingPositions(): readonly Vector2[] {
    const out: Vector2[] = [];
    for (const node of this.nodes) {
      if (node.kind === 'kindling' && node.collected) out.push(node.position);
    }
    return out;
  }

  getRemainingContaminantPositions(): readonly Vector2[] {
    const out: Vector2[] = [];
    for (const node of this.nodes) {
      if (node.kind === 'contaminant' && !node.collected) out.push(node.position);
    }
    return out;
  }

  getUncollectedSearchPositions(): readonly Vector2[] {
    const out: Vector2[] = [];
    for (const node of this.nodes) {
      if (!node.collected) out.push(node.position);
    }
    return out;
  }

  getNodesProbe(): ReadonlyArray<{
    id: string;
    kind: 'kindling' | 'contaminant';
    x: number;
    y: number;
    collected: boolean;
  }> {
    return this.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      x: n.position.x,
      y: n.position.y,
      collected: n.collected,
    }));
  }

  update(deltaMs: number, input: LootSearchInput): void {
    this.playerPos.x = input.playerPos.x;
    this.playerPos.y = input.playerPos.y;

    this.refreshNearest(input.playerPos);
    this.refreshPrompt(input.playerPos, input.runEnded === true);
    if (!input.searchHeld) this.requiresRelease = false;

    if (this.channel) {
      if (input.paused) {
        this.paintChannel();
        this.tickVisuals(deltaMs);
        return;
      }
      if (
        input.runEnded
        || input.interactionBlocked
        || !input.searchHeld
        || input.moving
        || input.attacking
        || input.toolPressed
        || input.hitThisFrame
      ) {
        this.interrupt();
      } else {
        this.channel.elapsedMs += deltaMs;
        if (this.channel.elapsedMs >= GAME_CONSTANTS.LOOT.SEARCH_CHANNEL_MS) {
          this.complete(input.playerPos);
        } else {
          this.paintChannel();
        }
      }
    } else if (
      !input.runEnded
      && !input.paused
      && !input.interactionBlocked
      && !this.requiresRelease
      && input.searchHeld
      && !input.moving
      && !input.attacking
      && !input.toolPressed
      && this.prompt === 'search'
      && this.nearest
      && !this.nearest.collected
    ) {
      const vis = this.getVisibilityAt(this.nearest.position);
      if (vis > 0) this.startChannel(this.nearest);
    }

    this.tickVisuals(deltaMs);
  }

  destroy(): void {
    this.stopLoop();
    this.channel = null;
    this.hud.destroy();
    for (const node of this.nodes) node.visual.destroy();
    this.nodes = [];
    this.nearest = null;
    this.carried = 0;
    this.prompt = null;
  }

  private tickVisuals(deltaMs: number): void {
    for (const node of this.nodes) {
      if (node.collected) continue;
      const vis = this.getVisibilityAt(node.position);
      node.visual.setVisibility(vis);
      node.visual.setRummaging(this.channel?.node === node);
      node.visual.update(deltaMs);
    }
  }

  private refreshNearest(player: Readonly<Vector2>): void {
    const radius = GAME_CONSTANTS.LOOT.SEARCH_RADIUS;
    const r2 = radius * radius;
    let best: SearchNode | null = null;
    let bestD = r2;
    for (const node of this.nodes) {
      if (node.collected) continue;
      const dx = node.position.x - player.x;
      const dy = node.position.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD) {
        best = node;
        bestD = d2;
      }
    }
    this.nearest = best;
    this.nearestDist = best ? Math.sqrt(bestD) : Infinity;
  }

  private refreshPrompt(player: Readonly<Vector2>, runEnded: boolean): void {
    if (runEnded) {
      this.prompt = null;
      this.hud.setPrompt(null);
      return;
    }
    const searchRadius = GAME_CONSTANTS.LOOT.SEARCH_RADIUS;
    let extractDist = Infinity;
    const ext = this.extraction;
    if (ext) {
      const dx = ext.position.x - player.x;
      const dy = ext.position.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d <= ext.radius) extractDist = d;
    }

    const searchOk =
      this.nearest !== null
      && this.nearestDist <= searchRadius
      && this.getVisibilityAt(this.nearest.position) > 0;

    let kind: LootSearchPromptKind = null;
    if (extractDist !== Infinity && searchOk) {
      kind = extractDist <= this.nearestDist ? 'extract' : 'search';
    } else if (extractDist !== Infinity) {
      kind = 'extract';
    } else if (searchOk) {
      kind = 'search';
    }
    this.prompt = kind;
    this.hud.setPrompt(kind);
  }

  private startChannel(node: SearchNode): void {
    this.channel = { node, elapsedMs: 0 };
    this.onNoise?.(
      node.position,
      GAME_CONSTANTS.LOOT.SEARCH_NOISE_RADIUS,
      GAME_CONSTANTS.LOOT.SEARCH_NOISE_LEVEL,
    );
    audioManager.playSFX('sfx-shared-player-search-loop', {
      loop: true,
      instanceId: LOOP_INSTANCE,
    });
    this.loopPlaying = true;
    this.paintChannel();
  }

  private paintChannel(): void {
    if (!this.channel) return;
    const t = this.channel.elapsedMs / GAME_CONSTANTS.LOOT.SEARCH_CHANNEL_MS;
    this.hud.setChannel(t);
  }

  private interrupt(): void {
    if (!this.channel) return;
    this.channel.node.visual.setRummaging(false);
    this.channel = null;
    this.hud.setChannel(null);
    this.stopLoop();
    audioManager.playSFX('sfx-shared-player-search-interrupt');
  }

  private complete(player: Readonly<Vector2>): void {
    const ch = this.channel;
    if (!ch) return;
    const node = ch.node;
    this.channel = null;
    this.hud.setChannel(null);
    this.stopLoop();
    node.visual.setRummaging(false);
    this.requiresRelease = this.inventoryEnabled;

    if (node.kind === 'kindling') {
      if (this.inventoryEnabled && !this.preview) {
        if (node.weaponDefinitionId === undefined) node.weaponDefinitionId = rollWeaponDrop({
          runSeed: this.runSeed, nodeId: node.id, tier: node.tier ?? 'safe',
          firstWeaponDiscovered: inventoryStore.getState().firstWeaponDiscovered,
        });
        if (node.weaponDefinitionId) {
          if (!node.revealedItem) {
            const id = `WPN_${crypto.randomUUID()}`;
            node.revealedItem = { id, kind: 'weapon', weapon: createWeaponInstance(node.weaponDefinitionId, false, id) };
          }
          const result = inventoryStore.revealBatch(node.id, [node.revealedItem], node.position);
          if (!result.ok) { this.onMessage?.('未能记下所得。物件仍留在原处。'); return; }
          const definition = WEAPON_DATA[node.weaponDefinitionId];
          if (result.value.taken) {
            notifyFieldAcquisition(result.value.ids);
            this.onMessage?.(`${definition?.name ?? '撬棍'} 已收好 · 负重 ${inventoryStore.getCarryWeight() / 10} / ${inventoryStore.getCapacity() / 10}`);
          } else {
            const missing = inventoryStore.getCarryWeight() + (definition?.weight ?? 30) - inventoryStore.getCapacity();
            this.onMessage?.(`${definition?.name ?? '撬棍'} · 还差 ${(missing / 10).toFixed(1)} 负重 · 释放 E 后整理`);
          }
        }
      }
      node.collected = true;
      const value = Math.max(1, Math.floor(node.value * this.kindlingValueModifier));
      this.carried += value;
      this.hud.setKindling(this.carried);
      node.visual.playReveal({ kind: 'kindling', playerPos: player });
      audioManager.playSFX('sfx-shared-player-search-reveal-kindling');
      if (this.preview) this.hud.flashKindling(value);
      else {
        eventBus.emit(GameEvent.KINDLING_COLLECTED, { amount: value, total: this.carried });
      }
    } else {
      let rarity: ContaminantRarity;
      let qualityLabel: string | undefined;
      if (this.preview) {
        const drop = rollContaminantDrop();
        rarity = drop.rarity;
        if (supportsContaminantQuality(drop.type)) qualityLabel = getContaminantQualityName(drop);
      } else {
        if (!node.revealedItem) {
          const drop = rollContaminantDrop();
          const contaminant = contaminantSystem.createUnowned(drop.type, drop.rarity, drop.quality);
          node.revealedItem = { id: contaminant.id, kind: 'contaminant', contaminant };
        }
        const item = node.revealedItem;
        if (item.kind !== 'contaminant') return;
        rarity = item.contaminant.rarity;
        if (supportsContaminantQuality(item.contaminant.type)) qualityLabel = getContaminantQualityName(item.contaminant);
        if (!this.inventoryEnabled) {
          // The pre-W4 route still acquires directly, without a run/ground ledger.
          // Persist before consuming the pile, and retain this exact roll on failure.
          const added = inventoryStore.addContaminant(item.contaminant);
          if (!added.ok) {
            this.requiresRelease = true;
            this.onMessage?.('未能记下所得。物件仍留在原处。');
            return;
          }
          node.collected = true;
          const owned = inventoryStore.getItem(added.value);
          if (owned?.kind === 'contaminant') {
            eventBus.emit(GameEvent.CONTAMINANT_ACQUIRED, { contaminant: owned.contaminant });
          }
        } else {
          const result = inventoryStore.revealBatch(node.id, [item], node.position);
          if (!result.ok) {
            this.onMessage?.('未能记下所得。物件仍留在原处。');
            return;
          }
          if (result.value.taken) notifyFieldAcquisition(result.value.ids);
          else this.onMessage?.('负重不足。已揭开的物件留在脚边。');
        }
      }
      node.collected = true;
      node.visual.playReveal({ kind: 'contaminant', rarity: qualityLabel ? 'common' : rarity, playerPos: player });
      audioManager.playSFX('sfx-shared-player-search-reveal-residue');
      this.hud.flashResidue(rarity, qualityLabel);
    }
  }

  private stopLoop(): void {
    if (!this.loopPlaying) return;
    audioManager.stopLoop(LOOP_INSTANCE, 0.08);
    this.loopPlaying = false;
  }
}
