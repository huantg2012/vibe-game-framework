import { projectItemForPlayer } from '@/systems/contaminant-catalog';
import { itemIconUrl } from '@/ui/contaminant-presentation';
import { createProceduralDeparture, installProceduralRiftRecovery } from '@/managers/rift-recovery';
import type { RiftCheckpoint } from '@/types/rift-checkpoint';
import { mix32 } from '@/generation/seed-fork';
import { SeededRandom } from '@/utils/random';
import { inventoryStore } from '@/systems/inventory-store';
import { getEquipmentLifecycle, type OfferingTransformResult } from '@/types/inventory-types';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { inventoryPanel } from '@/ui/dom/inventory-panel';
import { openInventory, inventoryError } from '@/ui/inventory-presenter';
import { PurificationChamberVisual, type PurificationChamberState } from './purification-chamber-visual';
import { CHAMBER_DEVICE_ANCHORS, CHAMBER_DEVICE_BASES, CHAMBER_SPAWN_POINT, CHAMBER_CAMERA, CHAMBER_SIZE, CHAMBER_INTERACTION_RADIUS, chamberFeetToPlayerPosition, type ChamberDevice } from '@/systems/purification-chamber-layout';
import { PurificationChamberLocomotion } from '@/systems/purification-chamber-locomotion';
import { ChamberModule } from '@/entities/purification-chamber-module';
/**
 * Purification Scene - the base management walkable space.
 *
 * Two enclosed walkable terraces, connected by broad ramps. Floors and fixtures use
 * a shared shallow oblique projection; the exterior is rewritten matter beyond
 * physical walls, not a magic dome. The rift retains independent top-down movement.
 * Existing settlement, inventory and growth transactions remain scene owners.
 *
 * Scene data received: { kindlingGained: number, survived: boolean }
 * Scene data sent to RiftScene: { modifiers: SortieModifiers, cycle: number }
 */

import Phaser from 'phaser';
import { MenuEntryTransition } from './menu-entry-transition';
import { GAME_CONSTANTS } from '@/config/constants';
import { ACTIVE_CONTAMINANT_TYPES } from '@/generated/contaminant-data';
import { eventBus } from '@/core/event-bus';
import { Player } from '@/entities/player';
import { PURIFICATION_PLAYER_BODY, PURIFICATION_DEVICE_ANCHORS } from '@/systems/purification-collision';
import { gameState, type SortieModifiers } from '@/managers/game-state';
import { audioManager } from '@/managers/audio-manager';
import { saveManager } from '@/managers/save-manager';
import { contaminantSystem } from '@/systems/contaminant-system';
import { growthSystem } from '@/systems/growth-system';
import { recoverGrowthFacts } from '@/systems/growth-evidence';
import { impactSystem } from '@/systems/impact-system';
import type { ForecastDisplay, ImpactResult } from '@/systems/impact-system';
import {
  createBoundaryShape,
} from '@/systems/boundary-shape';
import type { BoundaryShape } from '@/systems/boundary-shape';
import { createPurificationSurfaceTexture } from '@/systems/procedural-purification-surface';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import { allocationPanel } from '@/ui/dom/allocation-panel';
import { defensePanel } from '@/ui/dom/defense-panel';
import { growthPanel } from '@/ui/dom/growth-panel';
import { loadoutPanel } from '@/ui/dom/loadout-panel';
import { statusPanel } from '@/ui/dom/status-panel';
import { purificationHud } from '@/ui/dom/purification-hud';
import type { InteractionTarget } from '@/ui/dom/purification-hud';
import { impactResultPanel } from '@/ui/dom/impact-result-panel';
import { pauseMenu } from '@/ui/dom/pause-menu';
import type { ChargeChangeEntry } from '@/ui/dom/impact-result-panel';
import type { PhaseChangeInfo } from '@/systems/tide-system';
import { TileType } from '@/types/game-types';
import type { ContaminantType } from '@/types/game-types';
import { createCrtPanel, getDomUiRoot, showToastInline } from '@/ui/dom/panel-styles';
import { GameEvent } from '@/types/events';
import type { TileMapData } from '@/types/map-types';

// ---------------------------------------------------------------------------
// Map layout constants
// ---------------------------------------------------------------------------

const TILE = GAME_CONSTANTS.TILE_SIZE;
const COLS = GAME_CONSTANTS.PURIFICATION.MAP_COLS;
const ROWS = GAME_CONSTANTS.PURIFICATION.MAP_ROWS;
const WIDTH_PX = COLS * TILE;
const HEIGHT_PX = ROWS * TILE;
const CENTER_X = WIDTH_PX / 2;
const CENTER_Y = HEIGHT_PX / 2;

// Elliptical safe area (spec: ~12x10 usable tiles in a 14x12 map)
const ELLIPSE_RX = 5.2; // tiles
const ELLIPSE_RY = 5.0; // tiles

// Production operation anchors are distinct from the historical gym's floor example.
// Movement/proximity uses actor centers; authored floor geometry uses feet.
const CORE_POS = chamberFeetToPlayerPosition(CHAMBER_DEVICE_ANCHORS.core);
const STORAGE_POS = chamberFeetToPlayerPosition(CHAMBER_DEVICE_ANCHORS.storage);
const PURIFIER_POS = chamberFeetToPlayerPosition(CHAMBER_DEVICE_ANCHORS.purifier);
const RIFT_ENTRANCE_POS = chamberFeetToPlayerPosition(CHAMBER_DEVICE_ANCHORS.rift);
const DEFENSE_POS = chamberFeetToPlayerPosition(CHAMBER_DEVICE_ANCHORS.offering);
const GROWTH_POS = chamberFeetToPlayerPosition(CHAMBER_DEVICE_ANCHORS.growth);

/**
 * Build the tilemap using the dynamic boundary shape.
 * Tiles are FLOOR if their center is inside the boundary at 98% radius.
 * Used for visibility occluder grid only -- physics uses the smooth blob collider.
 */
/**
 * 练习场对照课用的落地底：与出击同一份边界 → 瓦片 → 地面纹理。
 * 潮汐取常态（强度 1.0 / 满潮）以免对照图随存档变。只读，不改生产路径。
 */
export function createPurificationFloorTexture(scene: Phaser.Scene, key: string): string {
  const interactionPts = [...Object.values(PURIFICATION_DEVICE_ANCHORS), { x: CENTER_X, y: 64 }];
  const shape = createBoundaryShape({
    ellipseRx: ELLIPSE_RX,
    ellipseRy: ELLIPSE_RY,
    tideIntensity: 1.0,
    tidePhase: 'crest',
    pressureSeed: 7919,
    interactionPoints: interactionPts,
    centerX: CENTER_X,
    centerY: CENTER_Y,
  });
  const tileMap = buildPurificationTileMap(shape);
  return createPurificationSurfaceTexture(scene, tileMap, key, shape, interactionPts);
}

function buildPurificationTileMap(shape: BoundaryShape): TileMapData {
  const tiles: number[][] = [];

  for (let row = 0; row < ROWS; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < COLS; col++) {
      const worldX = (col + 0.5) * TILE;
      const worldY = (row + 0.5) * TILE;
      const nDist = shape.normalizedDist(worldX, worldY);
      rowData.push(nDist <= 0.98 ? TileType.FLOOR : TileType.WALL);
    }
    tiles.push(rowData);
  }

  return { cols: COLS, rows: ROWS, tileSize: TILE, tiles };
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export type WorldInteractionTarget = 'CORE' | 'STORAGE' | 'PURIFIER' | 'defense' | 'growth' | 'rift';

/** DEV routing is prepared before the departure transaction. Production owns all
 * inventory, cycle, save and transition work; the adapter only selects the scene. */
export interface PurificationDepartureData {
  readonly modifiers: SortieModifiers;
  readonly cycle: number;
  readonly loadout: ReturnType<typeof contaminantSystem.getSortieLoadout>;
}
export interface PurificationDevDeparture {
  readonly recoveryIdentity?: import('@/types/rift-checkpoint').RiftCheckpoint['identity'];
  start(data: PurificationDepartureData): void;
  cancel(): void;
}
export interface PurificationDevSession {
  prepareDeparture(): PurificationDevDeparture;
  onPause?(): void;
}

export class PurificationScene extends Phaser.Scene {
  private readonly player = new Player();
  private unsubscribeWeapon: (() => void) | null = null;
  private unsubscribeForecast: (() => void) | null = null;
  private chamber: PurificationChamberVisual | null = null;
  private locomotion: PurificationChamberLocomotion | null = null;
  private readonly chamberState: PurificationChamberState = {
    moduleHealth: { core: 1, storage: 1, purifier: 1 }, thickenLevel: 0,
    offeringCharge: 0, growthLevels: {}, activeTarget: null, player: { x: 224, y: 286 },
  };
  private coreModule!: ChamberModule;
  private storageModule!: ChamberModule;
  private purifierModule!: ChamberModule;

  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private saveRetryTimer: number | null = null;
  private tabKey: Phaser.Input.Keyboard.Key | null = null;
  private transitioning = false;
  private devSession: PurificationDevSession | null = null;
  private productionDeparture: RiftCheckpoint['identity'] | null = null;
  private devDeparture: PurificationDevDeparture | null = null;
  private menuEntry: MenuEntryTransition | null = null;
  private transitionDelay: Phaser.Time.TimerEvent | null = null;
  private transitionOverlay: HTMLDivElement | null = null;
  private interactionFocusReturn: { scrollX: number; scrollY: number; zoom: number } | null = null;
  private interactionFocusTween: Phaser.Tweens.Tween | null = null;
  private readonly interactionWorldPoint = { x: 0, y: 0 };
  private interactionModule: ChamberModule | null = null;
  private readonly interactionScreenAnchor = { x: 0, y: 0 };
  private shuttingDown = false;
  private cleanupComplete = false;
  private cleanupStage = 'ready';
  private panelClosedAt = 0;
  private lastStepAt = -1000;
  private lastBoundaryPulseAt = -10000;
  /** Same nearest overlap as the prompt bar; passed into 存续报告身份带. */
  private lastOverlapType: InteractionTarget['type'] | null = null;

  // E3: Track stability milestones already shown
  private lastStabilityMilestone = 0;

  constructor() {
    super({ key: 'PurificationScene' });
  }

  create(data?: { kindlingGained?: number; survived?: boolean; fromMenu?: boolean; menuEntry?: MenuEntryTransition; devSession?: PurificationDevSession }): void {
    this.shuttingDown = false;
    this.cleanupComplete = false;
    this.devSession = import.meta.env?.DEV ? data?.devSession ?? null : null;
    this.devDeparture = null;
    this.productionDeparture = null;
    this.menuEntry = data?.menuEntry ?? null;
    this.lastOverlapType = null;
    // Determine if this is a return from rift (vs. menu/load entry)
    const ledger = inventoryStore.getRun();
    const isReturnFromRift = ledger?.status === 'settled' ? !ledger.baseSettled : !data?.fromMenu && data?.kindlingGained !== undefined;
    const survived = ledger?.status === 'settled' ? ledger.outcome === 'extract' : data?.survived;
    const kindlingGained = ledger?.status === 'settled' ? ledger.kindlingGained ?? 0 : data?.kindlingGained ?? 0;

    // Stability milestone crossed by this visit's extraction bonus, if any (Slice 5.5
    // D5: this used to fire through the STABILITY_CHANGED event, but the listener is
    // registered later in create() — after this addProgress() call — so it never
    // actually reached `onStabilityChanged` (a pre-existing gap this batch closes by
    // computing the crossing here, directly, instead of relying on the event for this
    // particular trigger). Captured before/after so the merged notice below reports
    // exactly what changed on this return, no more/no less.
    let stabilityMilestoneMessage: string | null = null;

    // Impact only triggers on return from rift, not on menu/load entry
    let impactResult: ReturnType<typeof impactSystem.run> = { skipped: true, damages: [], intensity: 0 };
    let chargeChanges: ChargeChangeEntry[] = [];
    let phaseChange: PhaseChangeInfo | null = null;
    let transformResults: OfferingTransformResult[] = [];
    // Captured BEFORE run() consumes/regenerates the forecast, so this is exactly what
    // the player saw on their way out — the prediction this impact is judged against
    // (Slice 5.5 D5 "预告 vs 实际", IA §S8).
    let predictedForecast: ForecastDisplay | null = null;

    const recoveryReturn = isReturnFromRift && ledger;
    const impactRandom = recoveryReturn ? new SeededRandom(mix32(0, `return:${ledger.id}:impact`)) : null;
    const forecastRandom = recoveryReturn ? new SeededRandom(mix32(0, `return:${ledger.id}:forecast`)) : null;
    const saved = saveManager.commitWorldTransaction(() => {
    growthSystem.recordReturn(recoverGrowthFacts(inventoryStore.getState(), tideSystem.getState(), gameState.getCycle()));
    // Credit kindling from the rift run (spec rule 10)
    if (isReturnFromRift && survived && kindlingGained > 0) {
      gameState.addKindling(kindlingGained);
    }

    if (isReturnFromRift) {
      // Sync impact intensity from tide system
      gameState.setImpactIntensity(tideSystem.getCurrentIntensity());

      // Snapshot defense slot charges before applying impact (for D2 visualization)
      const chargesBefore = this.snapshotDefenseCharges();

      // Every offered item participates in this impact before completing its offering.
      const offeringIds = inventoryStore.getOfferingItems().map(item => item?.id ?? null);
      const isHighTide = tideSystem.isHighTide();
      predictedForecast = impactSystem.getForecastReading(growthSystem.getLevel('growth_forecast_clarity'));
      impactResult = impactSystem.run(contaminantSystem.getDefenseSlotted(), offeringIds, impactRandom ? () => impactRandom.next() : undefined, stabilityTracker.getProgress());
      if (!impactResult.skipped) {
        const finished = contaminantSystem.finishOfferingImpact(isHighTide, impactResult.defenseResult?.bonusCharges ?? {}, offeringIds, `impact:${ledger?.id ?? gameState.getCycle()}`);
        if (!finished.ok) throw new Error(`Offering settlement failed: ${finished.error}`);
        transformResults = finished.value;
        chargeChanges = this.computeChargeChanges(chargesBefore, transformResults);
      }

      // Advance tide cycle after impact resolves (E1: capture phase change)
      phaseChange = tideSystem.advanceCycle(gameState.getModules().every(module => module.hp > 0) && !(impactResult.newlyZeroModules ?? 0));
      growthSystem.recordReturn({
        impactOccurred: !impactResult.skipped,
        offeringCompleted: transformResults.length > 0,
        toolRevealed: transformResults.some(result => {
          const item = inventoryStore.getItem(result.itemId);
          return item?.kind === 'contaminant' && projectItemForPlayer(item.contaminant).slot !== null;
        }),
        leftFiniteCrest: phaseChange?.from === 'crest' && phaseChange.to !== 'crest',
      });
      const beforeProgress = stabilityTracker.getProgress();
      stabilityTracker.recordReturn({ extracted: !!survived, newlyZeroModules: impactResult.newlyZeroModules ?? 0, phaseChange });
      stabilityMilestoneMessage = this.findCrossedStabilityMilestone(beforeProgress, stabilityTracker.getProgress());
    }

    // Generate the non-spatial forecast (target module + severity) for the NEXT impact
    // (DEC-034), plus retrograde's extra lookahead layer for the impact after that (previewed
    // via a pure, RNG-free peek at tide state). Intensity/clarity/peek are read here and
    // passed in so impact-system.ts doesn't import tideSystem/growthSystem directly
    // (DEC-ARCH-002) — see its generateForecast() doc.
    impactSystem.generateForecast(
      tideSystem.getCurrentIntensity(),
      growthSystem.getModifiers().forecastClarity,
      tideSystem.peekNextIntensity(),
      forecastRandom ? () => forecastRandom.next() : undefined,
    );

    if (isReturnFromRift && ledger?.status === 'settled') inventoryStore.markBaseSettled();
    inventoryStore.ensureStarter(recoveryReturn ? `WPN_replacement:${ledger.id}` : undefined);
    });

    this.transitioning = false;

    // E3: Initialize stability milestone tracker
    this.lastStabilityMilestone = Math.floor(stabilityTracker.getProgress() / 25) * 25;

    // One sole-space layout drives drawing, solid boundaries and operation anchors.
    this.physics.world.setBounds(0, 0, CHAMBER_SIZE.width, CHAMBER_SIZE.height);
    const camera = this.cameras.main;
    camera.setZoom(CHAMBER_CAMERA.zoom).setBackgroundColor(0x080a0c).setRoundPixels(true);
    camera.centerOn(CHAMBER_CAMERA.x, CHAMBER_CAMERA.y);
    this.chamber = new PurificationChamberVisual(this);
    this.player.create(this, {
      spawn: chamberFeetToPlayerPosition(CHAMBER_SPAWN_POINT), depth: 100 + CHAMBER_SPAWN_POINT.y, facing: 'right',
      body: PURIFICATION_PLAYER_BODY, movementMode: 'constrained',
    });
    this.locomotion = new PurificationChamberLocomotion(this.player);
    const syncWeapon = (): void => {
      const id = inventoryStore.getEquipment().weaponId;
      const item = id ? inventoryStore.getItem(id) : undefined;
      const weapon = item?.kind === 'weapon' ? WEAPON_DATA[item.weapon.definitionId] : undefined;
      this.player.setWeaponVisual(weapon?.quality ?? null, weapon?.variant ?? 'standard');
    };
    syncWeapon();
    this.unsubscribeWeapon = inventoryStore.subscribe(syncWeapon);
    this.coreModule = new ChamberModule(this, 'CORE', CORE_POS);
    this.storageModule = new ChamberModule(this, 'STORAGE', STORAGE_POS);
    this.purifierModule = new ChamberModule(this, 'PURIFIER', PURIFIER_POS);
    this.syncInvestmentVisuals();
    this.updateChamberVisuals(0, 0);

    // Purification HUD (DOM overlay)
    purificationHud.create(() => this.openStatusPanel());
    purificationHud.refresh();
    this.unsubscribeForecast = inventoryStore.subscribe(() => {
      impactSystem.generateForecast(tideSystem.getCurrentIntensity(), growthSystem.getModifiers().forecastClarity,
        tideSystem.peekNextIntensity());
      purificationHud.refresh();
    });
    if (this.menuEntry) {
      purificationHud.setEntryVisible(false);
      this.player.setInputEnabled(false);
      this.player.getSprite().setVelocity(0, 0);
    }

    // Input
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, true, false);
      this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, true, false);
      this.tabKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB, true, false);

    }

    // C2: Listen for allocation confirmed to flash modules
    eventBus.on(GameEvent.ALLOCATION_CONFIRMED, this.onAllocationConfirmed);
    eventBus.on(GameEvent.GROWTH_PURCHASED, this.onGrowthPurchased);

    // E3: Listen for stability changes
    eventBus.on(GameEvent.STABILITY_CHANGED, this.onStabilityChanged);

    // Post-update for visibility sync
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    // Show impact result on arrival (player must dismiss before interacting).
    // Slice 5.5 D5: the tide-phase-change and stability-milestone notices that used to
    // chain as separate "knowledge  " overlays after this panel are now rendered as a
    // trailing section INSIDE it — one blocking notification per return, not three.
    // Exemption suppresses damage, not the return report. Snapshot unchanged HP
    // for the first return without asking the impact/defense systems to run again.
    const reportDamages = impactResult.skipped
      ? gameState.getModules().map(module => ({ moduleId: module.id, damage: 0, newHp: module.hp }))
      : impactResult.damages;
    let arrivalPublished = false;
    const publishArrival = () => {
      if (this.shuttingDown || arrivalPublished) return;
      arrivalPublished = true;
      if (isReturnFromRift) {
        if (!impactResult.skipped) {
          this.playImpactAudio(impactResult);
          this.cameras.main.shake(300, 0.005);
        }
        this.player.setInputEnabled(false);
        impactResultPanel.show(reportDamages, impactResult.intensity, () => {
          this.consumeEntryKeys();
          this.panelClosedAt = this.time.now;
          this.player.setInputEnabled(!this.menuEntry && !saveManager.hasPendingSave());
          purificationHud.refresh();
          this.startIsolationBed();
          // B3: Show new tool toast after the merged panel is dismissed (Channel B —
          // non-blocking, so it doesn't re-introduce a second confirmation step).
          this.showNewToolToast(transformResults);
        }, {
          firstReturnExempt: impactResult.skipped,
          chargeChanges: chargeChanges.length > 0 ? chargeChanges : undefined,
          defenseResult: impactResult.defenseResult,
          baseDamagePerModule: impactResult.baseDamagePerModule,
          forecastPrediction: predictedForecast,
          actualPrimaryModuleId: impactResult.primaryModuleId,
          actualSeverity: impactResult.trueSeverity,
          phaseChange,
          stabilityMilestoneMessage,
        });
      } else {
        this.startIsolationBed();
        if (!this.menuEntry) this.player.setInputEnabled(true);
      }
    };
    // A reveal is knowledge the player cannot unlearn. Publish it only after the
    // same settled candidate is durable; retry saving, never run the impact twice.
    if (saved) publishArrival();
    else {
      this.player.setInputEnabled(false);
      this.requestSaveRetry(publishArrival);
    }
    this.menuEntry?.arrive(this,
      () => purificationHud.setEntryVisible(true),
      () => {
        this.consumeEntryKeys();
        this.menuEntry = null;
        this.player.setInputEnabled(!saveManager.hasPendingSave() && !impactResultPanel.isOpen());
      },
    );
  }

  private consumeEntryKeys(): void {
    if (this.interactKey) Phaser.Input.Keyboard.JustDown(this.interactKey);
    if (this.escKey) Phaser.Input.Keyboard.JustDown(this.escKey);
    if (this.tabKey) Phaser.Input.Keyboard.JustDown(this.tabKey);
  }

  update(time: number, delta: number): void {
    if (this.transitioning || this.shuttingDown) return;

    this.player.update(delta);
    this.locomotion?.update(delta);
    this.player.setGroundDepth(100 + this.player.getGroundY(), 20);

    const pos = this.player.getPosition();
    this.tickPurificationAudio(time, pos);

    // Update modules (checks proximity)
    const canInteract = (device: ChamberDevice): boolean => this.locomotion?.canInteract(device) ?? false;
    this.coreModule.update(pos.x, pos.y, canInteract('core'));
    this.storageModule.update(pos.x, pos.y, canInteract('storage'));
    this.purifierModule.update(pos.x, pos.y, canInteract('purifier'));

    const riftDist = this.distTo(pos, RIFT_ENTRANCE_POS);
    const defDist = this.distTo(pos, DEFENSE_POS);
    const groDist = this.distTo(pos, GROWTH_POS);
    const radius = CHAMBER_INTERACTION_RADIUS;

    const nearRift = canInteract('rift') && riftDist <= radius;
    const nearDefense = canInteract('offering') && defDist <= radius;
    const nearGrowth = canInteract('growth') && groDist <= radius;

    const target = this.findNearestTarget(
      nearRift, nearDefense, nearGrowth,
      riftDist, defDist, groDist,
    );
    this.lastOverlapType = target?.type ?? null;
    purificationHud.updatePrompt(target);

    // Hide prompt when a panel is open
    purificationHud.setPromptVisible(!this.isAnyPanelOpen());

    this.updateChamberVisuals(time, delta);

    // Keep the world alive while discarding button edges during the entry.
    // Retain held-key state so OS repeat cannot become a fresh E/Esc/Tab press.
    if (this.menuEntry) {
      this.consumeEntryKeys();
      return;
    }

    // Interaction key (edge-triggered)
    if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (this.isAnyPanelOpen()) return;

      switch (target?.type) {
        case 'core':
          this.openAllocationPanel('CORE');
          break;
        case 'storage':
          this.openAllocationPanel('STORAGE');
          break;
        case 'purifier':
          this.openAllocationPanel('PURIFIER');
          break;
        case 'defense':
          this.openDefensePanel();
          break;
        case 'growth':
          this.openGrowthPanel();
          break;
        case 'rift':
          this.enterRift();
          break;
        default:
          break;
      }
    }

    // ESC
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      if (impactResultPanel.isOpen()) {
        impactResultPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (allocationPanel.isOpen()) {
        allocationPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (defensePanel.isOpen()) {
        defensePanel.close();
        this.panelClosedAt = this.time.now;
      } else if (growthPanel.isOpen()) {
        growthPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (loadoutPanel.isOpen()) {
        loadoutPanel.close();
    inventoryPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (statusPanel.isOpen()) {
        statusPanel.close();
        this.panelClosedAt = this.time.now;
      } else if (!this.interactionFocusReturn && !pauseMenu.isOpen() && this.time.now - this.panelClosedAt > 150) {
        if (this.devSession?.onPause) this.devSession.onPause();
        else pauseMenu.open(this);
      }
    }

    // Tab: Status & Inventory panel (A1 + B1)
    if (this.tabKey && Phaser.Input.Keyboard.JustDown(this.tabKey)) {
      if (statusPanel.isOpen()) {
        statusPanel.close();
      } else if (!this.isAnyPanelOpen()) {
        this.openStatusPanel();
      }
    }
  }

  /** Isolated journey diagnostics only. No commands, inventory writes or position setters. */
  probeJourneyState(): Record<string, unknown> | null {
    if (!import.meta.env?.DEV || this.shuttingDown) return null;
    return { player: { ...this.player.getPosition() }, route: this.locomotion?.getRoute(), transitioning: this.transitioning,
      pendingSave: saveManager.hasPendingSave(),
      devices: { core: { ...CORE_POS }, storage: { ...STORAGE_POS }, purifier: { ...PURIFIER_POS },
        entrance: { ...RIFT_ENTRANCE_POS }, offering: { ...DEFENSE_POS }, growth: { ...GROWTH_POS } },
      panels: { inventory: inventoryPanel.isOpen(), status: statusPanel.isOpen(), offering: defensePanel.isOpen(),
        impact: impactResultPanel.isOpen(), allocation: allocationPanel.isOpen(), growth: growthPanel.isOpen() } };
  }

  // ------------------------------------------------------------------ private

  private distTo(pos: { x: number; y: number }, target: { x: number; y: number }): number {
    const dx = pos.x - target.x;
    const dy = pos.y - target.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Find the nearest in-range interaction target for the prompt bar. */
  private findNearestTarget(
    nearRift: boolean, nearDefense: boolean, nearGrowth: boolean,
    riftDist: number, defDist: number, groDist: number,
  ): InteractionTarget | null {
    const candidates: InteractionTarget[] = [];

    if (this.coreModule.isInRange()) {
      const hpData = this.coreModule.getHpData();
      candidates.push({
        type: 'core',
        distance: this.distTo(this.player.getPosition(), CORE_POS),
        moduleData: hpData ? { hp: hpData.hp, maxHp: hpData.maxHp, effectPct: this.coreModule.getEffectPct() } : undefined,
      });
    }
    if (this.storageModule.isInRange()) {
      const hpData = this.storageModule.getHpData();
      candidates.push({
        type: 'storage',
        distance: this.distTo(this.player.getPosition(), STORAGE_POS),
        moduleData: hpData ? { hp: hpData.hp, maxHp: hpData.maxHp, effectPct: this.storageModule.getEffectPct() } : undefined,
      });
    }
    if (this.purifierModule.isInRange()) {
      const hpData = this.purifierModule.getHpData();
      candidates.push({
        type: 'purifier',
        distance: this.distTo(this.player.getPosition(), PURIFIER_POS),
        moduleData: hpData ? { hp: hpData.hp, maxHp: hpData.maxHp, effectPct: 0 } : undefined,
      });
    }
    if (nearDefense) {
      candidates.push({ type: 'defense', distance: defDist });
    }
    if (nearGrowth) {
      candidates.push({ type: 'growth', distance: groDist });
    }
    if (nearRift) {
      candidates.push({ type: 'rift', distance: riftDist });
    }

    if (candidates.length === 0) return null;

    const order: InteractionTarget['type'][] = [
      'core', 'storage', 'purifier', 'defense', 'growth', 'rift',
    ];
    candidates.sort((a, b) => a.distance - b.distance || order.indexOf(a.type) - order.indexOf(b.type));
    return candidates[0]!;
  }

  private startIsolationBed(): void {
    audioManager.playBGM('bgm-pp-isolation-drone');
    audioManager.playAmbient('amb-pp-mechanical-hum');
  }

  private playImpactAudio(result: ImpactResult): void {
    audioManager.playSFX('sfx-impact-start');
    audioManager.playSFX('sfx-ui-warning');
    audioManager.playBGM('bgm-impact-pressure', 2, { loop: false });
    result.damages.forEach((entry, i) => {
      this.time.delayedCall(200 * (i + 1), () => {
        if (entry.damage === 0) {
          audioManager.playSFX('sfx-impact-survive', { priority: 'low' });
        } else if (entry.newHp === 0) {
          audioManager.playSFX('sfx-impact-break');
        } else {
          audioManager.playSFX('sfx-impact-hit');
        }
      });
    });
  }

  private tickPurificationAudio(time: number, pos: { x: number; y: number }): void {
    if (this.player.isMoving() && time - this.lastStepAt >= 400) {
      this.lastStepAt = time;
      audioManager.playSFX('sfx-shared-player-step-metal', { priority: 'low' });
    }
    const edgeDistance = Math.min(Math.abs(pos.x - 68), Math.abs(572 - pos.x));
    if (edgeDistance < 56 && time - this.lastBoundaryPulseAt >= 10000) {
      this.lastBoundaryPulseAt = time;
      audioManager.playSpatialSFX('sfx-pp-boundary-pulse',
        { x: pos.x < 320 ? 68 : 572, y: pos.y }, pos);
    }
  }

  private readonly onGrowthPurchased = (payload: { upgradeId: string; newLevel: number }): void => {
    audioManager.playSFX('sfx-ui-click');
    this.chamber?.pulse('growth', payload.upgradeId === 'thicken' ? 'thicken' : 'player');
    this.syncInvestmentVisuals();
    purificationHud.refresh();
  };

  private onPostUpdate(): void {
    if (this.shuttingDown) return;
    this.player.postUpdate();
  }

  private isAnyPanelOpen(): boolean {
    return inventoryPanel.isOpen() || saveManager.hasPendingSave() || this.interactionFocusReturn !== null || allocationPanel.isOpen() || defensePanel.isOpen() || growthPanel.isOpen() || loadoutPanel.isOpen() || statusPanel.isOpen() || impactResultPanel.isOpen();
  }

  private openAllocationPanel(moduleId: 'CORE' | 'STORAGE' | 'PURIFIER'): void {
    if (this.isAnyPanelOpen() || this.transitioning || this.menuEntry || this.shuttingDown) return;
    const mod = moduleId === 'CORE' ? this.coreModule : moduleId === 'STORAGE' ? this.storageModule : this.purifierModule;
    this.focusWorldInteraction(CHAMBER_DEVICE_BASES[moduleId.toLowerCase() as 'core' | 'storage' | 'purifier'], 320, mod);
    allocationPanel.open(moduleId, () => this.restoreInteractionFocus(), {
      getAnchor: this.getInteractionScreenAnchor, integrityOffsetY: 138,
    });
  }

  /** Review controls and proximity interaction share the same production paths. */
  public openWorldInteraction(target: WorldInteractionTarget): void {
    switch (target) {
      case 'CORE': case 'STORAGE': case 'PURIFIER': this.openAllocationPanel(target); break;
      case 'defense': this.openDefensePanel(); break;
      case 'growth': this.openGrowthPanel(); break;
      case 'rift': this.enterRift(); break;
    }
  }

  /** A review screen switch must not leave a restore tween in a paused scene. */
  public cancelWorldInteraction(): void {
    this.restoreInteractionFocus(true);
  }

  public openCoreAllocationSample(): void {
    this.openWorldInteraction('CORE');
  }

  public cancelCoreAllocationSample(): void {
    this.cancelWorldInteraction();
  }

  private readonly getInteractionScreenAnchor = (): { x: number; y: number } => {
    const camera = this.cameras.main;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    // Phaser zooms around the viewport origin, not its top-left corner.
    this.interactionScreenAnchor.x = camera.x + originX + (this.interactionWorldPoint.x - camera.scrollX - originX) * camera.zoom;
    this.interactionScreenAnchor.y = camera.y + originY + (this.interactionWorldPoint.y - camera.scrollY - originY) * camera.zoom;
    return this.interactionScreenAnchor;
  };

  private focusWorldInteraction(point: Readonly<{ x: number; y: number }>, screenX: number, mod: ChamberModule | null = null): void {
    this.player.setInputEnabled(false);
    this.interactionWorldPoint.x = point.x;
    this.interactionWorldPoint.y = point.y - 24;
    this.interactionModule = mod;
    mod?.setInteractionReadoutActive(true);
    const camera = this.cameras.main;
    this.interactionFocusReturn = { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom };
    const zoom = 3;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    this.interactionFocusTween = this.tweens.add({
      targets: camera,
      zoom,
      scrollX: point.x - originX - (screenX - camera.x - originX) / zoom,
      scrollY: point.y - 24 - originY - (330 - camera.y - originY) / zoom,
      duration: 260,
      ease: 'Sine.easeInOut',
      onComplete: () => { this.interactionFocusTween = null; },
    });
  }

  private restoreInteractionFocus(immediate = false): void {
    // CameraManager handles SHUTDOWN before this scene listener. Its main camera
    // has already been removed; discard our snapshot instead of touching it.
    if (this.shuttingDown) {
      this.interactionFocusReturn = null;
      this.interactionFocusTween = null;
      this.interactionModule = null;
      return;
    }
    const previous = this.interactionFocusReturn;
    if (!previous) return;
    this.interactionFocusTween?.stop();
    this.interactionFocusTween = null;
    const finish = (): void => {
      this.interactionModule?.setInteractionReadoutActive(false);
      this.interactionModule = null;
      this.interactionFocusReturn = null;
      this.interactionFocusTween = null;
      if (this.shuttingDown) return;
      this.panelClosedAt = this.time.now;
      this.player.setInputEnabled(!this.isAnyPanelOpen());
      purificationHud.refresh();
    };
    if (immediate || this.shuttingDown) {
      this.cameras.main.setScroll(previous.scrollX, previous.scrollY).setZoom(previous.zoom);
      finish();
      return;
    }
    this.interactionFocusTween = this.tweens.add({
      targets: this.cameras.main,
      ...previous,
      duration: 180,
      ease: 'Sine.easeInOut',
      onComplete: finish,
    });
  }

  private openDefensePanel(): void {
    if (this.isAnyPanelOpen() || this.transitioning || this.menuEntry || this.shuttingDown) return;
    this.focusWorldInteraction(CHAMBER_DEVICE_BASES.offering, 184);
    defensePanel.open(() => this.restoreInteractionFocus(), { getAnchor: this.getInteractionScreenAnchor });
  }

  private openGrowthPanel(): void {
    if (this.isAnyPanelOpen() || this.transitioning || this.menuEntry || this.shuttingDown) return;
    this.focusWorldInteraction(CHAMBER_DEVICE_BASES.growth, 184);
    growthPanel.open(() => this.restoreInteractionFocus(), { getAnchor: this.getInteractionScreenAnchor });
  }

  /** A1 + B1: Open the combined status & inventory panel. */
  private openStatusPanel(): void {
    if (this.isAnyPanelOpen() || pauseMenu.isOpen() || this.transitioning || this.menuEntry || this.shuttingDown) return;
    this.player.setInputEnabled(false);
    statusPanel.open(() => {
      this.player.setInputEnabled(true);
    }, this.lastOverlapType, () => this.openOfferingFromInventory());
  }

  private enterRift(): void {
    if (this.isAnyPanelOpen() || this.transitioning || this.menuEntry || this.shuttingDown) return;
    this.focusWorldInteraction(CHAMBER_DEVICE_BASES.rift, 184);
    const sprite = this.player.getSprite();
    const portrait = document.createElement('canvas'); portrait.width = sprite.frame.cutWidth; portrait.height = sprite.frame.cutHeight;
    portrait.getContext('2d')?.drawImage(sprite.texture.getSourceImage() as CanvasImageSource, sprite.frame.cutX, sprite.frame.cutY, portrait.width, portrait.height, 0, 0, portrait.width, portrait.height);
    openInventory({ mode: 'prepare', portrait: portrait.toDataURL(), onClose: () => this.restoreInteractionFocus(),
      onDepart: () => this.transitionToRift(),
      onOffering: () => this.openOfferingFromInventory(),
    });
  }

  private openOfferingFromInventory(): void {
    // Finish the entrance camera's return before focusing the offering device.
    this.time.delayedCall(220, () => {
      if (!this.shuttingDown) this.openDefensePanel();
    });
  }

  private requestSaveRetry(onSaved?: () => void): void {
    if (this.saveRetryTimer !== null) return;
    const notice = createCrtPanel('save-retry-notice');
    notice.style.cssText = 'left:360px;top:584px;width:240px;height:auto;padding:8px;z-index:3000;pointer-events:auto';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'action-btn';
    retry.textContent = '尚未保存 · 点击重试';
    notice.append(retry);
    getDomUiRoot().append(notice);
    retry.onclick = () => { if (saveManager.trySave()) { notice.remove(); this.saveRetryTimer = null; onSaved?.(); } };
    this.saveRetryTimer = 1;
    retry.focus();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { notice.remove(); this.saveRetryTimer = null; });
  }

  /** D4: Scene transition with narrative overlay + T10 radial glow. */
  private transitionToRift(): void {
    if (this.transitioning || saveManager.hasPendingSave()) return;
    if (contaminantSystem.getSortieLoadout().some(item => item && item.type !== 'catalog' && !ACTIVE_CONTAMINANT_TYPES.includes(item.type))) {
      showToastInline('行装中有已封存的旧式工具。请先将它卸下，再进入裂隙；物件仍会保留在储藏中。', {});
      return;
    }
    try {
      this.devDeparture = this.devSession?.prepareDeparture() ?? null;
      if (!this.devSession) { installProceduralRiftRecovery(); this.productionDeparture = createProceduralDeparture(); }
    }
    catch (reason) { showToastInline(reason instanceof Error ? reason.message : String(reason), {}); return; }
    let error: string | null = null;
    const saved = saveManager.commitWorldTransaction(() => {
      const begun = inventoryStore.beginRun(crypto.randomUUID(), this.productionDeparture ? {
        catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2,
      } : undefined);
      if (!begun.ok) { error = inventoryError(begun.error); return; }
      gameState.incrementCycle();
      const identity = this.devDeparture?.recoveryIdentity ?? this.productionDeparture;
      if (identity) saveManager.recordRiftDeparture({ version: 1, runId: inventoryStore.getRun()!.id,
        identity, conditions: { modifiers: gameState.getSortieModifiers(), cycle: gameState.getCycle() } });
    });
    if (error) { this.devDeparture?.cancel(); this.devDeparture = null; showToastInline(error, {}); return; }
    if (!saved) { this.requestSaveRetry(() => this.finishRiftDeparture()); return; }
    this.finishRiftDeparture();
  }

  private finishRiftDeparture(): void {
    inventoryPanel.close();
    this.transitioning = true;
    const modifiers = gameState.getSortieModifiers();
    const cycle = gameState.getCycle();
    const loadout = contaminantSystem.getSortieLoadout();

    // Save before entering rift (captures loadout selection)
    eventBus.emit(GameEvent.RIFT_ENTERED, { cycle });

    // Inject transition animation styles once
    this.injectTransitionStyles();

    // Phase 1: 0.3s teal radial glow from edges inward
    const glowOverlay = document.createElement('div');
    glowOverlay.id = 'scene-transition-glow';
    glowOverlay.style.cssText = [
      'position:absolute', 'inset:0',
      'z-index:1999', 'pointer-events:none',
      'animation:rift-enter-glow 0.3s ease-in forwards',
    ].join(';');
    getDomUiRoot().appendChild(glowOverlay);
    this.transitionOverlay = glowOverlay;

    // Phase 2: After 0.3s, show black screen with text
    this.transitionDelay = this.time.delayedCall(300, () => {
      glowOverlay.remove();

      const overlay = document.createElement('div');
      overlay.id = 'scene-transition-overlay';
      overlay.style.cssText = [
        'position:absolute', 'inset:0',
        'z-index:2000', 'background:#000', 'display:flex',
        'align-items:center', 'justify-content:center',
        // C6: was #5a5f66 (metal-light, border/divider-only per A1 V1/V2 - unreadable
        // as text on black). Same bright text colour the chaos-threshold narration uses.
        "font:14px 'Courier New',monospace", 'color:#c8cdd4',
      ].join(';');
      overlay.textContent = '进入裂隙。';
      getDomUiRoot().appendChild(overlay);
      this.transitionOverlay = overlay;

      this.transitionDelay = this.time.delayedCall(500, () => {
        this.transitionDelay = null;
        // scene.start is queued until the next frame. Stop drawing this scene
        // before removing the cover and disposing its actors, or the remaining
        // ground renders alone for one frame. Systems.start restores visibility.
        this.sys.setVisible(false);
        overlay.remove();
        this.transitionOverlay = null;
        const departure = this.devDeparture;
        this.devDeparture = null; // A synchronous scene shutdown must not cancel the handed-off run.
        // Dispose owned callbacks while Phaser's scene plugins are still alive.
        // SHUTDOWN remains a once-only fallback for menu/load transitions.
        try {
          const cleanupError = this.onShutdown();
          if (cleanupError) throw cleanupError;
          if (departure) departure.start({ modifiers, cycle, loadout });
          else this.scene.start('RiftScene', { modifiers, cycle, loadout, recovery: this.productionDeparture ? { identity: this.productionDeparture, externalTargetIds: [] } : undefined });
        } catch (reason) {
          console.error(`Purification departure cleanup failed at ${this.cleanupStage}; saved departure retained`, reason);
          this.scene.start('MainMenuScene', { recoveryError: '场景切换未完成，原出行记录已保留。' });
        }
      });
    });
  }

  /** Inject CSS keyframes for scene transition animations (idempotent). */
  private injectTransitionStyles(): void {
    if (document.getElementById('scene-transition-styles')) return;
    const style = document.createElement('style');
    style.id = 'scene-transition-styles';
    style.textContent = `
      @keyframes rift-collapse-glow {
        from {
          box-shadow: inset 0 0 0px rgba(0, 180, 160, 0);
          background: transparent;
        }
        to {
          box-shadow: inset 0 0 60px rgba(0, 180, 160, 0.3);
          background: rgba(0, 0, 0, 0.3);
        }
      }
      @keyframes rift-enter-glow {
        from {
          background: radial-gradient(ellipse at center, transparent 60%, rgba(0, 180, 160, 0) 100%);
        }
        to {
          background: radial-gradient(ellipse at center, transparent 30%, rgba(0, 180, 160, 0.25) 100%);
        }
      }
    `;
    document.head.appendChild(style);
  }

  /** B3: Show a Channel-B toast (C6 shared primitive) when new tools are available
   *  from transformation. */
  private showNewToolToast(transformResults: OfferingTransformResult[]): void {
    if (transformResults.length === 0) return;

    const names = transformResults.map(r => { const item = inventoryStore.getItem(r.itemId); return item?.kind === 'contaminant' ? projectItemForPlayer(item.contaminant).name : WEAPON_DATA[r.definitionId]?.name ?? '物件'; });
    const text = `供奉完成：${names.join('、')}。已揭晓并收入储藏。`;

    showToastInline(text, {
      color: '#2ae6c8',
      extraStyle: "background:rgba(15,17,20,0.92);border:1px solid #1aad96;padding:8px 16px;" +
        "font:12px 'Courier New',monospace;",
    });
  }

  /** C2: Flash the module entity when repair is confirmed. */
  private readonly onAllocationConfirmed = (payload: { allocations: Record<string, number> }): void => {
    this.syncInvestmentVisuals();
    const spent = Object.values(payload.allocations).reduce((sum, n) => sum + n, 0);
    if (spent > 0) {
      audioManager.playSFX('sfx-ui-allocate');
      audioManager.playSFX('sfx-shared-module-repair');
    }
    for (const moduleId of Object.keys(payload.allocations)) {
      if (moduleId === 'CORE') {
        if ((payload.allocations[moduleId] ?? 0) > 0) this.pulseModuleRepair(this.coreModule);
      } else if (moduleId === 'STORAGE') {
        this.pulseModuleRepair(this.storageModule);
      } else if (moduleId === 'PURIFIER') {
        this.pulseModuleRepair(this.purifierModule, 0x80b39e);
      }
    }
  };

  /** Persistent additions update only after a saved investment/repair or scene creation. */
  private syncInvestmentVisuals(): void {
    const fraction = (id: string): number => {
      const module = gameState.getModule(id);
      return module && module.maxHp > 0 ? module.hp / module.maxHp : 0;
    };
    this.chamberState.moduleHealth.core = fraction('CORE');
    this.chamberState.moduleHealth.storage = fraction('STORAGE');
    this.chamberState.moduleHealth.purifier = fraction('PURIFIER');
    this.chamberState.thickenLevel = gameState.getModuleMaxHpTier();
    this.chamberState.growthLevels = growthSystem.getState().upgrades;
  }

  private updateChamberVisuals(time: number, delta: number): void {
    this.chamberState.offeringCharge = inventoryStore.getOfferingItems().filter(Boolean).length / 4;
    this.chamberState.activeTarget = this.lastOverlapType;
    const pos = this.player.getPosition();
    this.chamberState.player.x = pos.x;
    this.chamberState.player.y = pos.y;
    this.chamber?.update(time, delta, this.chamberState);
  }

  private pulseModuleRepair(mod: ChamberModule, _tint?: number): void {
    this.chamber?.pulse('repair', mod.id);
  }

  private readonly onStabilityChanged = (payload: { progress: number; delta: number }): void => {
    const message = this.findCrossedStabilityMilestone(this.lastStabilityMilestone, payload.progress);
    this.lastStabilityMilestone = Math.floor(payload.progress / 25) * 25;
    if (message) this.showStabilityMilestone(message);
  };

  /** World.md 无人称/不描述玩家感受: the old copy had second-person encouragement
   *  ("坚持住"/"终点在望") on the 25/75 lines (IA §S15 类别2) — restated as plain fact. */
  private static readonly STABILITY_MILESTONE_MESSAGES: Record<number, string> = {
    25: '<span style="color:#8a8f96;">稳定度</span> <span style="color:#c8cdd4;font-weight:bold;">25%</span>',
    50: '<span style="color:#8a8f96;">稳定度</span> <span style="color:#c8cdd4;font-weight:bold;">50%</span> <span style="color:#8a8f96;">已过半</span>',
    75: '<span style="color:#8a8f96;">稳定度</span> <span style="color:#c8cdd4;font-weight:bold;">75%</span>',
    100: '净化完成。',
  };

  /** Returns the highest milestone (25/50/75/100) newly crossed between `before` and
   *  `after`, or null if none. Shared by the extraction-triggered path (create()) and
   *  the event-driven path (onStabilityChanged) so the two can never disagree on
   *  wording. Does NOT mutate `lastStabilityMilestone` — callers own that. */
  private findCrossedStabilityMilestone(before: number, after: number): string | null {
    const milestones = [25, 50, 75, 100];
    for (const m of milestones) {
      if (after >= m && before < m) {
        return PurificationScene.STABILITY_MILESTONE_MESSAGES[m] ?? null;
      }
    }
    return null;
  }

  private showStabilityMilestone(message: string): void {
    // C6: was #44aa66 (green) - "绿色=好" has no narrative home in this project's four-
    // layer colour architecture (ui-art-overhaul.md §A2, same reasoning as the CORE
    // module colour fix). Stability progress is a human-side positive outcome, so it
    // takes the warm palette instead, same family as the growth-panel purchase flash.
    showToastInline(message, {
      color: '#e0a848',
      extraStyle: "background:rgba(15,17,20,0.92);padding:8px 16px;" +
        "font:13px 'Courier New',monospace;text-align:center;",
    });
  }

  /** Snapshot current defense slot charge levels before impact application (D2). */
  private snapshotDefenseCharges(): { slotIndex: number; id: string; type: ContaminantType | null; weaponDefinitionId?: string; publicName: string; publicIcon?: string; charges: number; threshold: number }[] {
    return inventoryStore.getOfferingItems().flatMap((item, slotIndex) => item ? [{
      slotIndex, id: item.id, type: item.kind === 'contaminant' ? item.contaminant.type : null,
      weaponDefinitionId: item.kind === 'weapon' ? item.weapon.definitionId : undefined,
      publicName: item.kind === 'contaminant' ? projectItemForPlayer(item.contaminant).name : WEAPON_DATA[item.weapon.definitionId]!.name,
      publicIcon: item.kind === 'contaminant' ? itemIconUrl(item.contaminant) : undefined,
      charges: getEquipmentLifecycle(item).impactCharges,
      threshold: item.kind === 'weapon' ? WEAPON_DATA[item.weapon.definitionId]!.offeringCharges : GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD,
    }] : []);
  }

  private computeChargeChanges(
    before: ReturnType<PurificationScene['snapshotDefenseCharges']>,
    transformResults: OfferingTransformResult[],
  ): ChargeChangeEntry[] {
    const transformedIds = new Set(transformResults.map(r => r.itemId));
    return before.map(entry => {
      const current = inventoryStore.getItem(entry.id);
      const transformed = transformedIds.has(entry.id);
      const revealed = transformed && current?.kind === 'contaminant' ? projectItemForPlayer(current.contaminant) : null;
      return { itemId: entry.id, slotIndex: entry.slotIndex, type: entry.type, weaponDefinitionId: entry.weaponDefinitionId,
        publicName: entry.publicName, publicIcon: entry.publicIcon,
        revealedName: revealed?.name, revealedSummary: revealed?.summary,
        revealedIcon: revealed && current?.kind === 'contaminant' ? itemIconUrl(current.contaminant) : undefined,
        revealedInert: revealed?.inert,
        revealedSlot: revealed?.slot, revealedUses: revealed?.usesRemaining, revealedWeight: revealed?.weight,
        before: entry.charges, after: transformed ? entry.threshold : current ? getEquipmentLifecycle(current).impactCharges : entry.charges,
        threshold: entry.threshold, transformed };
    });
  }

  private onShutdown(): Error | null {
    if (this.cleanupComplete) return null;
    this.cleanupComplete = true;
    this.shuttingDown = true;
    const failures: string[] = [];
    const dispose = (stage: string, action: () => void): void => {
      this.cleanupStage = stage;
      try { action(); } catch (reason) { failures.push(`${stage}: ${String(reason)}`); }
    };
    dispose('listeners', () => {
      eventBus.off(GameEvent.ALLOCATION_CONFIRMED, this.onAllocationConfirmed);
      eventBus.off(GameEvent.GROWTH_PURCHASED, this.onGrowthPurchased);
      eventBus.off(GameEvent.STABILITY_CHANGED, this.onStabilityChanged);
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    });
    dispose('departure', () => this.devDeparture?.cancel()); this.devDeparture = null; this.devSession = null;
    dispose('weapon-observer', () => this.unsubscribeWeapon?.()); this.unsubscribeWeapon = null;
    dispose('forecast-observer', () => this.unsubscribeForecast?.()); this.unsubscribeForecast = null;
    dispose('entry', () => this.menuEntry?.destroy()); this.menuEntry = null;
    dispose('transition-delay', () => this.transitionDelay?.remove(false)); this.transitionDelay = null;
    dispose('transition-overlay', () => this.transitionOverlay?.remove()); this.transitionOverlay = null;
    dispose('interaction-focus', () => this.restoreInteractionFocus(true));
    dispose('audio', () => audioManager.haltNonBgm());
    for (const [name, close] of [
      ['allocation', () => allocationPanel.close()], ['defense', () => defensePanel.close()],
      ['growth', () => growthPanel.close()], ['loadout', () => loadoutPanel.close()],
      ['inventory', () => inventoryPanel.close()], ['status', () => statusPanel.close()],
      ['impact-result', () => impactResultPanel.destroy()], ['pause', () => pauseMenu.discard()],
    ] as const) dispose(`panel:${name}`, close);
    for (const key of [this.interactKey, this.escKey, this.tabKey]) {
      if (key) dispose(`input:${key.keyCode}`, () => this.input.keyboard?.removeKey(key, true));
    }
    this.interactKey = null; this.escKey = null; this.tabKey = null;
    this.locomotion = null;
    for (const [name, resource] of [
      ['core', this.coreModule], ['storage', this.storageModule], ['purifier', this.purifierModule],
      ['player', this.player], ['chamber', this.chamber],
    ] as const) dispose(`world:${name}`, () => resource?.destroy());
    this.chamber = null;
    dispose('hud', () => purificationHud.destroy());
    this.cleanupStage = failures.length ? failures.join('; ') : 'complete';
    if (!failures.length) return null;
    const error = new Error(`Purification cleanup: ${this.cleanupStage}`);
    console.error(error);
    return error;
  }
}
