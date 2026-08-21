/**
 * Contamination-lexicon practice: fixed observation yard, live player (god mode),
 * config table → spawn. Same AI / combat / hosts as a sortie. Contract: docs/dev/gym.md.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { isActorWalking } from '@/entities/actor-motion';
import { Enemy } from '@/entities/enemy-factory';
import { Player } from '@/entities/player';
import type { ContaminationForm } from '@/generation/contamination-draw';
import { mix32 } from '@/generation/seed-fork';
import { orderWallEdgeTiles, sameWallEdgeTileSet } from '@/generation/wall-edge-path';
import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import type { EnemyRole } from '@/generated/enemy-data';
import { DISPLAY_TOKEN_DATA } from '@/generated/contamination-lexicon-data';
import {
  createLexiconObserveMap,
  lexiconPlayerSpawn,
  lexiconPracticePins,
  LEXICON_DEFAULT_FRAGMENT,
  LEXICON_JIA_WAYPOINTS,
} from '@/gym/gym-lexicon-arena';
import {
  applyUtterance,
  continuityOptions,
  coverageOptions,
  clampLexiconCount,
  defaultConfig,
  formFromConfig,
  jiaRoleFor,
  lexemeOptions,
  lexiconCountOptions,
  portfolioOptions,
  substrateOptions,
  utteranceOptions,
  type LexiconGymConfig,
} from '@/gym/gym-lexicon-form';
import type { FormVisual, FormVisualSignal } from '@/gym/form-renderers/form-renderer';
import { getFormRenderer } from '@/gym/form-renderers/registry';
import {
  isLexiconFragmentId,
  LEXICON_FRAGMENT_IDS,
  rgbToHex,
  yardSurfaceColors,
} from '@/gym/form-renderers/d/fragment-ramp';
import { AISystem, ENEMY_DEPTH } from '@/systems/ai';
import { ChaosSystem } from '@/systems/chaos-system';
import { CombatSystem } from '@/systems/combat-system';
import { selfCheckHostLive } from '@/systems/contamination-host-live';
import { ContaminationHostSystem } from '@/systems/contamination-host-system';
import { TileGrid } from '@/systems/tile-grid';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { GameEvent } from '@/types/events';
import { AIState, TileType, type TileCoord, type Vector2 } from '@/types/game-types';
import type { EnemySpawnData, TileMapData } from '@/types/map-types';

const RESPAWN_MS = 800;
const DEPTH = { surface: 0, yardBias: 0.05, bing: 1, yi: 20, player: 30 } as const;
const GYM_HOST_OPTS = { gymLiveMotion: true } as const;
const INTRO_STATUS =
  '玩家默认无敌。侧栏可开「感受伤害」。WASD 移动，空格挥击。点生成后刷当前配置；击杀后按当前配置再刷。不开迷雾。';

function gymVisible(_p: Readonly<Vector2>): number {
  return 1;
}

export class GymLexiconScene extends Phaser.Scene {
  private readonly tiles = new TilemapRenderer();
  private readonly player = new Player();
  private readonly ai = new AISystem();
  private readonly combat = new CombatSystem();
  private readonly hosts = new ContaminationHostSystem();
  private chaos: ChaosSystem | null = null;
  private attackKey: Phaser.Input.Keyboard.Key | null = null;
  private lastDelta = 16;
  private formBound = false;
  private filling = false;
  private lastForm: ContaminationForm | null = null;
  private lastCount = 4;
  private spawnSerial = 0;
  private respawnTimer: Phaser.Time.TimerEvent | null = null;
  private readonly visuals = new Map<string, FormVisual>();
  private tileMap: TileMapData | null = null;
  private yardBias: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: 'GymLexiconScene' });
  }

  create(): void {
    const fragmentTypeId = LEXICON_DEFAULT_FRAGMENT;
    const tileMap = createLexiconObserveMap(fragmentTypeId);
    this.tileMap = tileMap;
    const grid = new TileGrid(tileMap);
    const layer = this.tiles.create(this, tileMap, {
      tilesetKey: 'placeholder-rift-tileset',
      collidingIndices: [TileType.WALL, TileType.VOID],
      depth: DEPTH.surface,
    });

    this.physics.world.setBounds(0, 0, grid.widthPx, grid.heightPx);
    const camera = this.cameras.main;
    camera.setBounds(0, 0, grid.widthPx, grid.heightPx);
    camera.setZoom(GAME_CONSTANTS.CAMERA.ZOOM);
    camera.setBackgroundColor(GAME_CONSTANTS.VISIBILITY.VOID_COLOR);

    this.player.create(this, { spawn: lexiconPlayerSpawn(), depth: DEPTH.player, facing: 'right' });
    this.physics.add.collider(this.player.getSprite(), layer);
    camera.startFollow(this.player.getSprite(), true);
    this.yardBias = this.add.graphics().setDepth(DEPTH.yardBias);
    this.paintYardBias(fragmentTypeId);
    this.paintSeats();
    this.logWallEdgePathCheck();
    selfCheckHostLive();

    this.ai.create(this, [], grid, grid, { requireExactlyOneRewriter: false });
    this.ai.setVisibilityProvider(gymVisible);
    this.ai.addWallCollider(layer);

    this.combat.create(this, grid, this.player, this.ai, {
      onNoise: (pos, radius, level) => this.ai.reportNoise(pos, radius, level),
    });
    this.combat.setGodMode(true);

    this.chaos = new ChaosSystem({ startingValue: 0 });
    this.hosts.bindPractice(this, lexiconPracticePins(), this.combat, this.chaos, gymVisible, GYM_HOST_OPTS);

    this.bindAttackKey();
    this.bindForm();
    eventBus.on(GameEvent.ENEMY_DAMAGED, this.onEnemyDamaged);
    eventBus.on(GameEvent.ENEMY_KILLED, this.onEnemyKilled);

    const title = document.getElementById('gym-title');
    if (title) title.textContent = '练习场 · 污染句法';
    this.setStatus(INTRO_STATUS);

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(_time: number, delta: number): void {
    this.lastDelta = delta;
    this.player.update(delta);
    this.ai.update(delta, this.player.getPosition(), this.player.isMoving());
    if (this.attackKey && Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      this.combat.requestPlayerAttack();
    }
    this.combat.update(delta);
    this.hosts.update(delta, this.player.getPosition());
    this.chaos?.update(delta);
    this.paintRoster();
  }

  private onPostUpdate(): void {
    this.player.postUpdate();
    this.ai.postUpdate(this.lastDelta);
    this.syncVisualPoses(this.lastDelta);
  }

  private paintSeats(): void {
    const pins = lexiconPracticePins();
    const tile = GAME_CONSTANTS.TILE_SIZE;
    const g = this.add.graphics().setDepth(1);
    const cluster = pins.clusterCores[0];
    if (cluster) {
      g.fillStyle(0x1a6b5c, 0.28);
      g.fillRect(cluster.floorCol * tile + 4, cluster.floorRow * tile + 4, tile - 8, tile - 8);
    }
    const box = pins.corridorAabbs[0];
    if (box) {
      g.fillStyle(0x0e4a3f, 0.12);
      g.fillRect(
        box.minCol * tile,
        box.minRow * tile,
        (box.maxCol - box.minCol + 1) * tile,
        (box.maxRow - box.minRow + 1) * tile,
      );
    }
  }

  private paintYardBias(fragmentTypeId: string): void {
    const map = this.tileMap;
    const gfx = this.yardBias;
    if (!map || !gfx) return;
    const colors = yardSurfaceColors(fragmentTypeId);
    const tile = map.tileSize;
    gfx.clear();
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const kind = map.tiles[row]![col];
        if (kind === TileType.WALL) gfx.fillStyle(rgbToHex(colors.wall), 1);
        else if (kind === TileType.FLOOR) gfx.fillStyle(rgbToHex(colors.floor), 1);
        else continue;
        gfx.fillRect(col * tile, row * tile, tile, tile);
      }
    }
  }

  private logWallEdgePathCheck(): void {
    const edge = lexiconPracticePins().wallEdges[0];
    if (!edge) return;
    const ordered = orderWallEdgeTiles(edge.tiles);
    const ok = sameWallEdgeTileSet(edge.tiles, ordered);
    console.info(
      `[gym lexicon] wall-edge path set-eq ${ok ? 'ok' : 'FAIL'} in=${edge.tiles.length} out=${ordered.length}`,
    );
  }

  private bindAttackKey(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const code = Phaser.Input.Keyboard.KeyCodes[GAME_CONSTANTS.COMBAT.ATTACK_KEY];
    this.attackKey = keyboard.addKey(code, true, false);
  }

  private bindForm(): void {
    if (this.formBound) return;
    this.formBound = true;
    const generate = document.getElementById('gym-lexicon-generate');
    generate?.addEventListener('click', this.onGenerateClick);
    const renderer = document.getElementById('gym-lex-renderer');
    if (renderer instanceof HTMLSelectElement) {
      renderer.addEventListener('change', this.onRendererChange);
    }
    const fragment = document.getElementById('gym-lex-fragment');
    if (fragment instanceof HTMLSelectElement) {
      fragment.addEventListener('change', this.onFragmentChange);
    }
    const feelHit = document.getElementById('gym-lex-feel-hit');
    if (feelHit instanceof HTMLInputElement) {
      feelHit.addEventListener('change', this.onFeelHitChange);
    }
    for (const id of [
      'gym-lex-portfolio',
      'gym-lex-coverage',
      'gym-lex-substrate',
      'gym-lex-continuity',
      'gym-lex-motion',
      'gym-lex-sense',
      'gym-lex-rhythm',
      'gym-lex-contact',
      'gym-lex-utterance',
      'gym-lex-count',
    ]) {
      document.getElementById(id)?.addEventListener('change', this.onFieldChange);
    }
    this.refillSelects(defaultConfig());
    this.fillFragmentSelect(LEXICON_DEFAULT_FRAGMENT);
    this.applyFeelHit();
  }

  private readonly onFieldChange = (event: Event): void => {
    if (this.filling) return;
    const target = event.target;
    const changedId = target instanceof HTMLSelectElement ? target.id : '';
    if (changedId === 'gym-lex-utterance') {
      const utterance = selectValue('gym-lex-utterance');
      if (utterance) {
        const applied = applyUtterance(utterance);
        if (applied) {
          this.refillSelects({
            ...applied,
            count: clampLexiconCount(Number(selectValue('gym-lex-count')), applied.portfolio),
          });
          return;
        }
      }
    }
    const next = this.readConfig();
    const keepUtterance = changedId === 'gym-lex-count' || changedId === 'gym-lex-utterance';
    this.refillSelects({
      ...next,
      utteranceId: keepUtterance ? next.utteranceId : '',
    });
  };

  private refillSelects(config: LexiconGymConfig): void {
    this.filling = true;
    fillSelect('gym-lex-portfolio', portfolioOptions(), config.portfolio);
    fillSelect('gym-lex-coverage', coverageOptions(), config.coverage);
    const portfolio = (selectValue('gym-lex-portfolio') || config.portfolio) as LexiconGymConfig['portfolio'];
    fillSelect('gym-lex-substrate', substrateOptions(portfolio), config.substrate);
    const substrate = selectValue('gym-lex-substrate') || config.substrate;
    fillSelect('gym-lex-continuity', continuityOptions(portfolio, substrate), config.continuity);
    fillSelect('gym-lex-motion', lexemeOptions('motion', portfolio), config.motion);
    fillSelect('gym-lex-sense', lexemeOptions('sense', portfolio), config.sense);
    fillSelect('gym-lex-rhythm', lexemeOptions('rhythm', portfolio), config.rhythm);
    fillSelect('gym-lex-contact', lexemeOptions('contact', portfolio), config.contact);
    fillSelect(
      'gym-lex-utterance',
      [{ id: '', label: '无' }, ...utteranceOptions(portfolio)],
      config.utteranceId,
    );
    fillSelect('gym-lex-count', lexiconCountOptions(portfolio), String(clampLexiconCount(config.count, portfolio)));
    this.filling = false;
  }

  private readConfig(): LexiconGymConfig {
    const fallback = defaultConfig();
    const portfolio = (selectValue('gym-lex-portfolio') || fallback.portfolio) as LexiconGymConfig['portfolio'];
    return {
      portfolio,
      coverage: (selectValue('gym-lex-coverage') || fallback.coverage) as LexiconGymConfig['coverage'],
      substrate: selectValue('gym-lex-substrate') || fallback.substrate,
      continuity: (selectValue('gym-lex-continuity') || fallback.continuity) as LexiconGymConfig['continuity'],
      motion: selectValue('gym-lex-motion') || fallback.motion,
      sense: selectValue('gym-lex-sense') || fallback.sense,
      rhythm: selectValue('gym-lex-rhythm') || fallback.rhythm,
      contact: selectValue('gym-lex-contact') || fallback.contact,
      utteranceId: selectValue('gym-lex-utterance'),
      count: clampLexiconCount(Number(selectValue('gym-lex-count')), portfolio),
    };
  }

  private readonly onGenerateClick = (): void => {
    const parsed = formFromConfig(this.readConfig());
    if (typeof parsed === 'string') {
      this.setStatus(`不能生成：${parsed}`);
      return;
    }
    this.lastForm = parsed;
    this.lastCount = clampLexiconCount(Number(selectValue('gym-lex-count')), parsed.portfolio);
    this.clearPopulation();
    this.chaos?.reset(0);
    this.spawnMissing();
    this.noteRendererStatus('已按当前配置生成。击杀后按侧栏现有选项再刷。');
  };

  private readonly onRendererChange = (): void => {
    this.syncCandidateVisuals();
    this.noteRendererStatus(this.lastForm ? '已按当前配置生成。击杀后按侧栏现有选项再刷。' : INTRO_STATUS);
  };

  private readonly onFragmentChange = (): void => {
    this.paintYardBias(this.readFragmentId());
    this.syncCandidateVisuals();
  };

  private readonly onFeelHitChange = (): void => {
    this.applyFeelHit();
  };

  private applyFeelHit(): void {
    const feel = document.getElementById('gym-lex-feel-hit');
    const on = feel instanceof HTMLInputElement && feel.checked;
    this.combat.setGodMode(!on);
  }

  private fillFragmentSelect(selected: string): void {
    const options = LEXICON_FRAGMENT_IDS.map((id) => ({
      id,
      label: RIFT_FRAGMENT_DATA[id]?.displayName ?? id,
    }));
    fillSelect('gym-lex-fragment', options, selected);
  }

  private readFragmentId(): string {
    const raw = selectValue('gym-lex-fragment');
    return isLexiconFragmentId(raw) ? raw : LEXICON_DEFAULT_FRAGMENT;
  }

  private clearPopulation(): void {
    this.cancelRespawn();
    this.destroyVisuals();
    for (const enemy of [...this.ai.getEnemies()]) this.ai.despawn(enemy.getId());
    this.hosts.clearHosts();
    this.hosts.bindPractice(this, lexiconPracticePins(), this.combat, this.chaos, gymVisible, GYM_HOST_OPTS);
    this.combat.noteRosterChanged();
    this.spawnSerial = 0;
  }

  private spawnMissing(): void {
    const form = this.lastForm;
    if (!form) return;
    this.hosts.purgeDead();
    if (form.portfolio === 'jia') {
      while (this.ai.getEnemies().length < this.lastCount) this.spawnJia(form);
      this.combat.noteRosterChanged();
      this.syncCandidateVisuals();
      return;
    }
    while (this.hosts.getSubjects().length < this.lastCount) {
      const id = this.hosts.spawnForm(form);
      if (!id) break;
    }
    this.syncCandidateVisuals();
  }

  private spawnJia(form: ContaminationForm): void {
    const role: EnemyRole = jiaRoleFor(form);
    const index = this.spawnSerial++;
    const start = jiaSpawnTile(index, this.lastCount);
    const spawn: EnemySpawnData = {
      id: `gym-jia-${index}`,
      type: role,
      spawn: start,
      facing: 0,
      patrol: { waypoints: LEXICON_JIA_WAYPOINTS, mode: 'loop' },
    };
    this.ai.spawnOne(spawn);
  }

  private readonly onEnemyDamaged = ({ enemyId }: { enemyId: string }): void => {
    this.ai.reportDamage(enemyId, this.player.getPosition());
  };

  private readonly onEnemyKilled = ({ enemyId }: { enemyId: string }): void => {
    this.destroyVisual(enemyId);
    if (this.ai.getEnemyById(enemyId)) this.ai.despawn(enemyId);
    this.combat.noteRosterChanged();
    this.scheduleRespawn();
  };

  private scheduleRespawn(): void {
    this.cancelRespawn();
    this.respawnTimer = this.time.delayedCall(RESPAWN_MS, () => {
      this.respawnTimer = null;
      if (!this.sys.isActive()) return;
      this.spawnMissing();
    });
  }

  private cancelRespawn(): void {
    this.respawnTimer?.remove(false);
    this.respawnTimer = null;
  }

  private paintRoster(): void {
    const el = document.getElementById('gym-roster');
    if (!el) return;
    const form = this.lastForm;
    const chaos = this.chaos?.getValue() ?? 0;
    const jia = this.ai.getEnemies().length;
    const hosts = this.hosts.getSubjects().length;
    const lines = [
      form ? describeForm(form) : '尚未生成。选维度后点生成。',
      `在场 甲 ${jia} · 宿主 ${hosts} / 目标 ${form ? this.lastCount : 0}`,
      `混乱 ${chaos.toFixed(1)}（丙踩踏 / 丁体积会加）`,
      `生命 ${this.combat.getHealth()}/${this.combat.getMaxHealth()}（${feelHitOn() ? '可受伤' : '玩家无敌'}）`,
    ];
    el.textContent = lines.join('\n');
  }

  private syncCandidateVisuals(): void {
    this.destroyVisuals();
    const renderer = getFormRenderer(selectValue('gym-lex-renderer'));
    const ready = renderer?.ready === true;
    const dMixed = renderer?.id === 'd-mixed';
    const form = this.lastForm;
    const hideJia = ready && (!dMixed || form?.portfolio === 'jia');
    const skipHosts =
      ready &&
      (!dMixed ||
        form?.portfolio === 'bing' ||
        form?.portfolio === 'yi' ||
        form?.portfolio === 'ding');
    this.hosts.setSkipPaint(skipHosts);
    for (const view of this.ai.getEnemies()) {
      if (view instanceof Enemy) view.setVisualSuppressed(hideJia);
    }
    if (!ready || !renderer || !form) return;
    const fragmentTypeId = this.readFragmentId();
    if (form.portfolio === 'jia') {
      for (const view of this.ai.getEnemies()) {
        const visual = renderer.attach({
          scene: this,
          form,
          seed: mix32(0, view.getId()),
          depth: ENEMY_DEPTH,
          fragmentTypeId,
        });
        this.visuals.set(view.getId(), visual);
      }
      return;
    }
    for (const subject of this.hosts.getSubjects()) {
      const pin = this.hosts.getVisualPin(subject.id) ?? undefined;
      const visual = renderer.attach({
        scene: this,
        form,
        seed: mix32(0, subject.id),
        depth: depthForPortfolio(form.portfolio),
        fragmentTypeId,
        pin,
      });
      this.visuals.set(subject.id, visual);
    }
  }

  private syncVisualPoses(deltaMs: number): void {
    for (const [id, visual] of this.visuals) {
      const view = this.ai.getEnemyById(id);
      if (view) {
        const vel = view instanceof Enemy ? view.ai.velocity : { x: 0, y: 0 };
        const pos = view.getPosition();
        visual.update({
          x: pos.x,
          y: pos.y,
          facing4: view.getFacing4(),
          moving: isActorWalking(Math.hypot(vel.x, vel.y)),
          visibility: gymVisible(pos),
          signal: view instanceof Enemy ? jiaSignal(view) : 'idle',
          deltaMs,
        });
        continue;
      }
      const host = this.hosts.getSubjects().find((row) => row.id === id);
      if (!host) continue;
      visual.update({
        x: host.position.x,
        y: host.position.y,
        facing4: this.hosts.getVisualFacing(id),
        moving: this.hosts.getVisualMoving(id),
        visibility: gymVisible(host.position),
        signal: this.hosts.getVisualSignal(id),
        deltaMs,
      });
    }
  }

  private destroyVisual(id: string): void {
    const visual = this.visuals.get(id);
    if (!visual) return;
    visual.destroy();
    this.visuals.delete(id);
  }

  private destroyVisuals(): void {
    for (const visual of this.visuals.values()) visual.destroy();
    this.visuals.clear();
  }

  private noteRendererStatus(base: string): void {
    const selected = selectValue('gym-lex-renderer');
    const renderer = getFormRenderer(selected);
    if (selected !== 'placeholder' && renderer?.ready !== true) {
      this.setStatus(`${base}该方案尚未落地。`);
      return;
    }
    this.setStatus(base);
  }

  private setStatus(text: string): void {
    const status = document.getElementById('gym-status');
    if (status) status.textContent = text;
  }

  private onShutdown(): void {
    this.cancelRespawn();
    this.destroyVisuals();
    eventBus.off(GameEvent.ENEMY_DAMAGED, this.onEnemyDamaged);
    eventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled);
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    const generate = document.getElementById('gym-lexicon-generate');
    generate?.removeEventListener('click', this.onGenerateClick);
    const renderer = document.getElementById('gym-lex-renderer');
    renderer?.removeEventListener('change', this.onRendererChange);
    const fragment = document.getElementById('gym-lex-fragment');
    fragment?.removeEventListener('change', this.onFragmentChange);
    const feelHit = document.getElementById('gym-lex-feel-hit');
    feelHit?.removeEventListener('change', this.onFeelHitChange);
    this.formBound = false;
    if (this.attackKey) {
      this.input.keyboard?.removeKey(this.attackKey, true);
      this.attackKey = null;
    }
    this.hosts.destroy();
    this.combat.destroy();
    this.ai.destroy();
    this.player.destroy();
    this.chaos?.destroy();
    this.chaos = null;
    this.yardBias?.destroy();
    this.yardBias = null;
    this.tileMap = null;
    this.tiles.destroy();
  }
}

function depthForPortfolio(portfolio: ContaminationForm['portfolio']): number {
  switch (portfolio) {
    case 'jia':
      return ENEMY_DEPTH;
    case 'yi':
      return DEPTH.yi;
    case 'bing':
      return DEPTH.bing;
    case 'ding':
      return GAME_CONSTANTS.CONTAMINATION.VOLUME_DEPTH;
  }
}

function selectValue(id: string): string {
  const el = document.getElementById(id);
  return el instanceof HTMLSelectElement ? el.value : '';
}

function feelHitOn(): boolean {
  const el = document.getElementById('gym-lex-feel-hit');
  return el instanceof HTMLInputElement && el.checked;
}

function fillSelect(
  id: string,
  options: readonly { id: string; label: string }[],
  selected: string,
): void {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) return;
  const keep = options.some((row) => row.id === selected) ? selected : (options[0]?.id ?? '');
  el.replaceChildren();
  for (const row of options) el.add(new Option(row.label, row.id));
  el.value = keep;
}

function jiaSpawnTile(index: number, count: number): TileCoord {
  const slot = ((index % Math.max(1, count)) + Math.max(1, count)) % Math.max(1, count);
  const ring = LEXICON_JIA_WAYPOINTS;
  if (slot < ring.length) return ring[slot]!;
  const corner = ring[0]!;
  return { col: corner.col + 1, row: corner.row };
}

function jiaSignal(view: Enemy): FormVisualSignal {
  if (view.isEngaged()) return 'strike';
  const state = view.getState();
  if (state === AIState.CHASE) return 'awake';
  if (state === AIState.ALERT || state === AIState.SUSPICIOUS) return 'inflated';
  return 'idle';
}

function describeForm(form: ContaminationForm): string {
  const token = (id: string): string => DISPLAY_TOKEN_DATA[id]?.displayToken ?? id;
  const coverage = token(`coverage_${form.coverage}`);
  const occupancy = token(`occupancy_${form.occupancy}`);
  const mark = form.utteranceId ? ` · 成句` : '';
  return `${coverage} ${occupancy}${mark}`;
}
