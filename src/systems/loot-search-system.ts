import { createWeaponInstance, rollWeaponDrop } from '@/systems/weapon-loot';
import { WEAPON_DATA } from '@/generated/weapon-data';
/**
 * Loot-search channel: hold E for SEARCH_CHANNEL_MS, then settle.
 * Production default for rift pickups (iteration 10 / DEC-109).
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { rollContaminantDrop, rollContaminantNodeDrop, getContaminantQualityName, isContaminantQuality, supportsContaminantQuality } from '@/systems/contaminant-quality';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { copyRuntimeVector, runtimeInteger, runtimeNumber, runtimeRecord, runtimeVector } from '@/systems/ai/runtime-validation';
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
import type { ContaminantRarity, ContaminantType, Vector2 } from '@/types/game-types';
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
  /** Bag or scene lock; nearby revealed items participate in the shared prompt. */
  readonly interactionBlocked?: boolean;
  /** Distance to the nearest visible, legal revealed item; absent means none. */
  readonly nearbyItemDistance?: number;
}

export interface LootSearchCreateConfig {
  readonly overlayRoot: HTMLElement;
  readonly getVisibilityAt: (point: Readonly<Vector2>) => number;
  readonly fragmentTypeId: string;
  /** A registered world's native visuals; supplying it bypasses legacy fragment textures. */
  readonly createVisual?: (scene: Phaser.Scene, position: Readonly<Vector2>, seed: number,
    getPlayerPos: () => Readonly<Vector2>) => SearchObjectVisual;
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
  lootPoolId?: string;
  allowWeapon?: boolean;
}

interface ChannelState {
  node: SearchNode;
  elapsedMs: number;
}

type SearchWeaponRoll = { readonly state: 'unrolled' } | { readonly state: 'none' }
  | { readonly state: 'weapon'; readonly definitionId: string };
export interface LootSearchRuntimeState {
  readonly version: 1;
  readonly runSeed: number;
  readonly fragmentTypeId: string;
  readonly kindlingValueModifier: number;
  readonly carried: number;
  readonly requiresRelease: boolean;
  readonly channel: { readonly nodeId: string; readonly elapsedMs: number } | null;
  readonly nodes: readonly {
    readonly id: string; readonly kind: 'kindling' | 'contaminant'; readonly position: Readonly<Vector2>;
    readonly value: number; readonly tier: KindlingTier | null; readonly lootPoolId: string | null;
    readonly allowWeapon: boolean | null; readonly collected: boolean;
    readonly weaponRoll: SearchWeaponRoll; readonly revealedItem: NewInventoryItem | null;
  }[];
}

/** Cached rolls are factory results, before offering/use. Validation never creates an ID. */
function validRevealedItem(value: unknown): value is NewInventoryItem {
  if (!runtimeRecord(value) || typeof value.id !== 'string' || !value.id || !runtimeRecord(value.source)
    || typeof value.source.fragmentId !== 'string' || value.source.nodeId !== undefined || value.source.runId !== undefined) return false;
  const body = value.kind === 'weapon' ? value.weapon : value.kind === 'contaminant' ? value.contaminant : null;
  if (!runtimeRecord(body) || body.id !== value.id || body.stage !== 'defense' || body.impactCharges !== 0 || body.usesRemaining !== 0) return false;
  if (value.kind === 'weapon') return typeof body.definitionId === 'string' && Object.prototype.hasOwnProperty.call(WEAPON_DATA, body.definitionId);
  return typeof body.type === 'string' && Object.prototype.hasOwnProperty.call(CONTAMINANT_DATA, body.type)
    && (body.rarity === 'common' || body.rarity === 'fine' || body.rarity === 'rare')
    && (body.quality === undefined || (isContaminantQuality(body.quality) && supportsContaminantQuality(body.type as ContaminantType)));
}

export function validateLootSearchRuntimeState(value: unknown): value is LootSearchRuntimeState {
  if (!runtimeRecord(value) || value.version !== 1 || !runtimeInteger(value.runSeed, 0, 0xffffffff)
    || typeof value.fragmentTypeId !== 'string' || !value.fragmentTypeId || !runtimeNumber(value.kindlingValueModifier, 0)
    || !runtimeNumber(value.carried, 0) || typeof value.requiresRelease !== 'boolean'
    || !Array.isArray(value.nodes) || value.nodes.length > 4096) return false;
  const ids = new Set<string>(), items = new Set<string>();
  for (const node of value.nodes) {
    if (!runtimeRecord(node) || typeof node.id !== 'string' || !node.id || ids.has(node.id)
      || (node.kind !== 'kindling' && node.kind !== 'contaminant') || !runtimeVector(node.position)
      || !runtimeNumber(node.value, 0) || !(node.tier === null || node.tier === 'safe' || node.tier === 'contested' || node.tier === 'deep')
      || !(node.lootPoolId === null || typeof node.lootPoolId === 'string')
      || !(node.allowWeapon === null || typeof node.allowWeapon === 'boolean') || typeof node.collected !== 'boolean'
      || !runtimeRecord(node.weaponRoll) || !['unrolled', 'none', 'weapon'].includes(node.weaponRoll.state as string)
      || !(node.revealedItem === null || validRevealedItem(node.revealedItem))) return false;
    ids.add(node.id);
    const item = node.revealedItem;
    if (item) {
      if (items.has(item.id) || item.source?.fragmentId !== value.fragmentTypeId) return false;
      items.add(item.id);
    }
    if (node.kind === 'contaminant') {
      if (node.weaponRoll.state !== 'unrolled' || (item && item.kind !== 'contaminant') || (node.collected && !item)) return false;
    } else if (node.weaponRoll.state === 'weapon') {
      if (node.allowWeapon === false || item?.kind !== 'weapon' || node.weaponRoll.definitionId !== item.weapon.definitionId) return false;
    } else if (item || (node.collected && node.weaponRoll.state === 'unrolled')) return false;
  }
  if (value.channel === null) return true;
  return runtimeRecord(value.channel) && typeof value.channel.nodeId === 'string' && ids.has(value.channel.nodeId)
    && value.nodes.some(node => node.id === (value.channel as Record<string, unknown>).nodeId && !node.collected)
    && runtimeNumber(value.channel.elapsedMs, 0, GAME_CONSTANTS.LOOT.SEARCH_CHANNEL_MS)
    && value.channel.elapsedMs < GAME_CONSTANTS.LOOT.SEARCH_CHANNEL_MS && !value.requiresRelease;
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
  private fragmentTypeId = '';
  private kindlingValueModifier = 1;
  private channel: ChannelState | null = null;
  private carried = 0;
  private readonly hud = new LootSearchHud();
  private readonly playerPos: Vector2 = { x: 0, y: 0 };
  private nearest: SearchNode | null = null;
  private nearestDist = 0;
  private readonly presentationTarget: { targetId: string | null; channelId: string | null } = { targetId: null, channelId: null };
  private readonly presentationNodes: { id: string; x: number; y: number; collected: boolean }[] = [];
  private prompt: LootSearchPromptKind = null;
  private loopPlaying = false;
  private restoredLoopPending = false;
  private requiresRelease = false;
  private onMessage: LootSearchCreateConfig['onMessage'];

  exportRuntimeState(): LootSearchRuntimeState {
    const value: LootSearchRuntimeState = {
      version: 1, runSeed: this.runSeed, fragmentTypeId: this.fragmentTypeId, kindlingValueModifier: this.kindlingValueModifier,
      carried: this.carried, requiresRelease: this.requiresRelease,
      channel: this.channel ? { nodeId: this.channel.node.id, elapsedMs: this.channel.elapsedMs } : null,
      nodes: this.nodes.map(node => ({
        id: node.id, kind: node.kind, position: copyRuntimeVector(node.position), value: node.value, tier: node.tier ?? null,
        lootPoolId: node.lootPoolId ?? null, allowWeapon: node.allowWeapon ?? null, collected: node.collected,
        weaponRoll: node.weaponDefinitionId === undefined ? { state: 'unrolled' }
          : node.weaponDefinitionId === null ? { state: 'none' } : { state: 'weapon', definitionId: node.weaponDefinitionId },
        revealedItem: node.revealedItem ? structuredClone(node.revealedItem) : null,
      })),
    };
    if (!this.validateRuntimeState(value)) throw new Error('Search state is not a recoverable inventory-backed run');
    return value;
  }

  validateRuntimeState(value: unknown): value is LootSearchRuntimeState {
    if (this.preview || !this.inventoryEnabled || !validateLootSearchRuntimeState(value) || value.runSeed !== this.runSeed
      || value.fragmentTypeId !== this.fragmentTypeId || value.kindlingValueModifier !== this.kindlingValueModifier
      || value.nodes.length !== this.nodes.length) return false;
    const run = inventoryStore.getRun();
    if (!run || run.status !== 'active' || Object.keys(run.revealedNodes).some(id => !value.nodes.some(node => node.id === id))) return false;
    for (let i = 0; i < value.nodes.length; i++) {
      const saved = value.nodes[i]!, node = this.nodes[i]!;
      if (saved.id !== node.id || saved.kind !== node.kind || saved.position.x !== node.position.x || saved.position.y !== node.position.y
        || saved.value !== node.value || saved.tier !== (node.tier ?? null) || saved.lootPoolId !== (node.lootPoolId ?? null)
        || saved.allowWeapon !== (node.allowWeapon ?? null)) return false;
      const revealed = run.revealedNodes[saved.id], cached = saved.revealedItem;
      if (saved.collected && cached) {
        if (!revealed || revealed.length !== 1 || revealed[0] !== cached.id) return false;
        const actual = inventoryStore.getItem(cached.id);
        if (!actual) { if (!run.destroyedIds.includes(cached.id)) return false; }
        else if (actual.kind !== cached.kind || actual.source?.nodeId !== saved.id || actual.source.runId !== run.id
          || (actual.kind === 'weapon' && cached.kind === 'weapon' && actual.weapon.definitionId !== cached.weapon.definitionId)
          || (actual.kind === 'contaminant' && cached.kind === 'contaminant'
            && (actual.contaminant.type !== cached.contaminant.type || actual.contaminant.quality !== cached.contaminant.quality
              || actual.contaminant.rarity !== cached.contaminant.rarity))) return false;
      } else if (revealed || (cached && inventoryStore.getItem(cached.id))) return false;
    }
    return true;
  }

  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid or incompatible search runtime state');
    this.stopLoop();
    this.carried = value.carried; this.requiresRelease = value.requiresRelease;
    for (let i = 0; i < value.nodes.length; i++) {
      const saved = value.nodes[i]!, node = this.nodes[i]!;
      node.collected = saved.collected;
      node.revealedItem = saved.revealedItem ? structuredClone(saved.revealedItem) : undefined;
      node.weaponDefinitionId = saved.weaponRoll.state === 'unrolled' ? undefined
        : saved.weaponRoll.state === 'none' ? null : saved.weaponRoll.definitionId;
      node.visual.setRummaging(false);
      node.visual.setVisibility(0);
    }
    this.channel = value.channel ? { node: this.nodes.find(node => node.id === value.channel!.nodeId)!, elapsedMs: value.channel.elapsedMs } : null;
    this.restoredLoopPending = this.channel !== null;
    this.nearest = null; this.nearestDist = Infinity; this.prompt = null;
    this.hud.setPrompt(null); this.hud.setKindling(this.carried);
    this.hud.setChannel(this.channel ? this.channel.elapsedMs / GAME_CONSTANTS.LOOT.SEARCH_CHANNEL_MS : null);
  }

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
    this.fragmentTypeId = config.fragmentTypeId;
    this.onMessage = config.onMessage;
    this.requiresRelease = false;
    this.kindlingValueModifier = config.kindlingValueModifier ?? 1;
    this.carried = 0;
    this.channel = null;

    const slots = config.createVisual ? null : ensureLootSearchTextures(scene, config.fragmentTypeId);
    this.hud.create(config.overlayRoot, { showKindling: config.showKindling === true });
    if (config.showKindling) this.hud.setKindling(0);

    const readPlayer = (): Readonly<Vector2> => this.playerPos;
    const frag = config.fragmentTypeId;
    const createVisual = (def: KindlingNodeDef | ContaminantNodeDef): SearchObjectVisual => config.createVisual
      ? config.createVisual(scene, def.position, hashId(def.id), readPlayer)
      : createSearchObjectVisual(scene, def.position.x, def.position.y, hashId(def.id), frag, slots!, readPlayer);

    for (const def of kindling) {
      const value = def.value ?? tierValue(def.tier);
      this.nodes.push({
        id: def.id,
        kind: 'kindling',
        tier: def.tier,
        allowWeapon: def.allowWeapon,
        position: def.position,
        value,
        collected: false,
        visual: createVisual(def),
      });
    }
    for (const def of contaminants) {
      this.nodes.push({
        id: def.id,
        kind: 'contaminant',
        tier: def.tier ?? 'safe',
        lootPoolId: def.lootPoolId,
        position: def.position,
        value: 0,
        collected: false,
        visual: createVisual(def),
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

  /** Read-only interaction identity. Never reveals the concealed contents of a pile. */
  getPresentationTarget(): Readonly<{ targetId: string | null; channelId: string | null }> {
    this.presentationTarget.targetId = this.prompt === 'search' ? this.nearest?.id ?? null : null;
    this.presentationTarget.channelId = this.channel?.node.id ?? null;
    return this.presentationTarget;
  }

  /** Borrowed scalar views for continuous rendering; no contents or Phaser objects. */
  getPresentationNodes(): readonly Readonly<{ id: string; x: number; y: number; collected: boolean }>[] {
    for(let i=0;i<this.nodes.length;i++){
      const node=this.nodes[i]!;
      let view=this.presentationNodes[i];
      if(!view){view={id:'',x:0,y:0,collected:false};this.presentationNodes.push(view);}
      view.id=node.id;view.x=node.position.x;view.y=node.position.y;view.collected=node.collected;
    }
    this.presentationNodes.length=this.nodes.length;return this.presentationNodes;
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
    this.refreshPrompt(input.playerPos, input.runEnded === true, input.nearbyItemDistance);
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
        if (this.restoredLoopPending) {
          // A real continued input resumes the loop; restore itself makes no sound/noise event.
          audioManager.playSFX('sfx-shared-player-search-loop', { loop: true, instanceId: LOOP_INSTANCE });
          this.loopPlaying = true; this.restoredLoopPending = false;
        }
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

  private refreshPrompt(player: Readonly<Vector2>, runEnded: boolean, nearbyItemDistance = Infinity): void {
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
    // A single current-frame winner owns both the hint and E. A farther item
    // must not steal a hidden pile's hold interaction (or its channel).
    const selectedDistance = kind === 'extract' ? extractDist : kind === 'search' ? this.nearestDist : Infinity;
    if (Number.isFinite(nearbyItemDistance) && nearbyItemDistance >= 0
      && nearbyItemDistance <= searchRadius && nearbyItemDistance < selectedDistance) kind = 'pickup';
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
          allowWeapon: node.allowWeapon,
        });
        if (node.weaponDefinitionId) {
          if (!node.revealedItem) {
            const id = `WPN_${crypto.randomUUID()}`;
            node.revealedItem = { id, kind: 'weapon', weapon: createWeaponInstance(node.weaponDefinitionId, false, id), source: { fragmentId: this.fragmentTypeId } };
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
          const drop = rollContaminantNodeDrop(this.runSeed, node.id, node.tier ?? 'safe', node.lootPoolId);
          const contaminant = contaminantSystem.createUnowned(drop.type, drop.rarity, drop.quality);
          node.revealedItem = { id: contaminant.id, kind: 'contaminant', contaminant, source: { fragmentId: this.fragmentTypeId } };
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
    this.restoredLoopPending = false;
    if (!this.loopPlaying) return;
    audioManager.stopLoop(LOOP_INSTANCE, 0.08);
    this.loopPlaying = false;
  }
}
