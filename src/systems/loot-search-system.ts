/**
 * Loot-search channel: hold E for SEARCH_CHANNEL_MS, then settle.
 * Production default for rift pickups (iteration 10 / DEC-109).
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { audioManager } from '@/managers/audio-manager';
import { contaminantSystem } from '@/systems/contaminant-system';
import {
  createSearchObjectVisual,
  ensureLootSearchTextures,
  type SearchObjectVisual,
} from '@/systems/loot-search-presentation';
import { GameEvent } from '@/types/events';
import type { ContaminantRarity, ContaminantType, Vector2 } from '@/types/game-types';
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
  readonly kindlingValueModifier?: number;
  readonly showKindling?: boolean;
}

interface SearchNode {
  readonly id: string;
  readonly kind: 'kindling' | 'contaminant';
  readonly position: Vector2;
  readonly value: number;
  collected: boolean;
  visual: SearchObjectVisual;
}

interface ChannelState {
  node: SearchNode;
  elapsedMs: number;
}

const TYPES_BY_RARITY: Record<ContaminantRarity, ContaminantType[]> = {
  common: [],
  fine: [],
  rare: [],
};

for (const [id, def] of Object.entries(CONTAMINANT_DATA)) {
  TYPES_BY_RARITY[def.rarity].push(id as ContaminantType);
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

function rollRarity(): ContaminantRarity {
  const weights = GAME_CONSTANTS.CONTAMINANT.RARITY_WEIGHTS;
  const total = weights.common + weights.fine + weights.rare;
  const roll = Math.random() * total;
  if (roll < weights.common) return 'common';
  if (roll < weights.common + weights.fine) return 'fine';
  return 'rare';
}

function rollType(rarity: ContaminantRarity): ContaminantType {
  const pool = TYPES_BY_RARITY[rarity];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export class LootSearchSystem {
  private nodes: SearchNode[] = [];
  private getVisibilityAt!: (point: Readonly<Vector2>) => number;
  private extraction: LootSearchCreateConfig['extraction'];
  private onNoise: LootSearchCreateConfig['onNoise'];
  private preview = false;
  private kindlingValueModifier = 1;
  private channel: ChannelState | null = null;
  private carried = 0;
  private readonly hud = new LootSearchHud();
  private readonly playerPos: Vector2 = { x: 0, y: 0 };
  private nearest: SearchNode | null = null;
  private nearestDist = 0;
  private prompt: LootSearchPromptKind = null;
  private loopPlaying = false;

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

    if (this.channel) {
      if (input.paused) {
        this.paintChannel();
        this.tickVisuals(deltaMs);
        return;
      }
      if (
        input.runEnded
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
    node.collected = true;
    node.visual.setRummaging(false);

    if (node.kind === 'kindling') {
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
      const rarity = rollRarity();
      const type = rollType(rarity);
      node.visual.playReveal({ kind: 'contaminant', rarity, playerPos: player });
      audioManager.playSFX('sfx-shared-player-search-reveal-residue');
      this.hud.flashResidue(rarity);
      if (!this.preview) contaminantSystem.acquire(type, rarity);
    }
  }

  private stopLoop(): void {
    if (!this.loopPlaying) return;
    audioManager.stopLoop(LOOP_INSTANCE, 0.08);
    this.loopPlaying = false;
  }
}
