import type { RiftCheckpoint } from '@/types/rift-checkpoint';
import type { RiftRecoveryState } from '@/systems/rift-recovery-state';
import { installSuspendedSeaRecoveryValidation, suspendedSeaIdentity } from './recovery';
/** Native expedition with either temporary memory or explicitly enabled recovery.
 * Formal scenes own gameplay transactions. This adapter admits the saved world,
 * records committed boundaries, and routes settled runs back to their base.
 */
import type Phaser from 'phaser';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { eventBus } from '@/core/event-bus';
import { gameState } from '@/managers/game-state';
import { saveManager, type SaveStorage } from '@/managers/save-manager';
import { beginNewExpedition } from '@/managers/session';
import type { PurificationDepartureData, PurificationDevDeparture } from '@/scenes/purification-scene';
import { contaminantSystem } from '@/systems/contaminant-system';
import { growthSystem } from '@/systems/growth-system';
import { impactSystem } from '@/systems/impact-system';
import { inventoryStore } from '@/systems/inventory-store';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import { GameEvent } from '@/types/events';
import { getEquipmentLifecycle, type InventoryItem, type InventoryState } from '@/types/inventory-types';
import { BuildLabMemoryStorage } from '../build-lab-session';
import { STAGE_TOOL_TYPES, supportsStageWeapon } from '../spatial-study/stage/support';
import { createSuspendedSeaWorld, resolveSuspendedSeaOptions, type SuspendedSeaMetadata, type SuspendedSeaWorld } from './world';

export type SeaJourneyPhase = 'new' | 'base-starting' | 'base' | 'departing' | 'rift-starting' | 'rift' | 'rift-settled' | 'faulted' | 'closed';
export interface SeaJourneySelection { readonly scene: string; readonly seed: string }
export interface SeaJourneyPorts {
  /** Called once initially and once per true, settled return. */
  enterBase(initial: boolean): void;
  enterRift(world: SuspendedSeaWorld, data: PurificationDepartureData, checkpoint?: RiftCheckpoint<RiftRecoveryState>): void;
}
export function assertSeaJourneyEquipment(state: InventoryState): void {
  const byId = new Map(state.items.map(item => [item.id, item]));
  const weapon = state.equipment.weaponId ? byId.get(state.equipment.weaponId) : undefined;
  if (!weapon || weapon.kind !== 'weapon' || !supportsStageWeapon(weapon.weapon.definitionId)) {
    throw new Error('悬海目前只能携带已有完整外观的撬棍出击。');
  }
  const items: InventoryItem[] = [weapon];
  for (const id of state.equipment.toolIds) {
    if (!id) continue;
    const item = byId.get(id);
    if (!item || item.kind !== 'contaminant' || !STAGE_TOOL_TYPES.has(item.contaminant.type)) {
      throw new Error(`当前悬海支持：${[...STAGE_TOOL_TYPES].map(type => CONTAMINANT_DATA[type].displayNameTool).join('、')}。请调整备行物品。`);
    }
    items.push(item);
  }
  for (const item of items) {
    const lifecycle = getEquipmentLifecycle(item);
    if (item.location.kind !== 'carried' || lifecycle.stage !== 'tool' || lifecycle.usesRemaining <= 0) {
      throw new Error('请先完成供奉，并装配仍可使用的物件。');
    }
  }
}
function captureState() {
  return structuredClone({ inventory: inventoryStore.getState(), game: gameState.getState(), tide: tideSystem.getState(),
    growth: growthSystem.getState(), stability: stabilityTracker.getState(), forecast: impactSystem.getForecastState(),
    pendingSave: saveManager.hasPendingSave() });
}
export interface SeaJourneyLedgerEntry {
  readonly sequence: number;
  readonly at: string;
  readonly boundary: 'initial' | 'departure-prepared' | 'departure-saved' | 'rift-settled' | 'base-saved' | 'departure-cancelled' | 'recovered' | 'fault' | 'closed';
  readonly runId: string | null;
  readonly world: SuspendedSeaMetadata | null;
  readonly state: ReturnType<typeof captureState>;
  readonly detail?: string;
}

export class SuspendedSeaJourneySession {
  private phase: SeaJourneyPhase = 'new';
  private initialized = false;
  private world: SuspendedSeaWorld | null = null;
  private runId: string | null = null;
  private readonly ledger: SeaJourneyLedgerEntry[] = [];
  private readonly baseSaved = new Set<string>();
  private readonly riftSettled = new Set<string>();
  private faultMessage: string | null = null;

  constructor(private readonly ports: SeaJourneyPorts, storage: SaveStorage = new BuildLabMemoryStorage(), private readonly recovery = false) {
    // Install BEFORE Boot. This is never changed back to the browser's record.
    saveManager.setStorage(storage);
    if (recovery) installSuspendedSeaRecoveryValidation();
    eventBus.on(GameEvent.GAME_SAVED, this.onSaved);
    eventBus.on(GameEvent.RIFT_EXITED, this.onRiftSettled);
  }

  initialize(host: Phaser.Scene): void {
    if (this.initialized || this.phase !== 'new') throw new Error('The temporary expedition can only be initialized once');
    this.initialized = true;
    try {
      if (this.recovery && saveManager.hasSave()) {
        if (!saveManager.load()) throw new Error('这份悬海记录无法完整读取，原记录已保留。');
        const run = inventoryStore.getRun();
        this.runId = run?.id ?? null;
        if (run?.status === 'active') {
          const checkpoint = saveManager.peekRiftCheckpoint() as RiftCheckpoint<RiftRecoveryState> | null;
          const departure = saveManager.peekRiftDeparture();
          const identity = checkpoint?.identity ?? departure?.identity;
          const conditions = checkpoint?.state.conditions ?? departure?.conditions;
          if (!identity || !conditions || (checkpoint && checkpoint.state.phase !== 'active')) {
            throw new Error('旧记录缺少完整的裂隙状态，已保留，不能自动判为死亡或重开。');
          }
          this.world = createSuspendedSeaWorld(identity.seed, identity.layoutId);
          this.phase = 'rift-starting'; this.record('recovered');
          this.ports.enterRift(this.world, { ...conditions, loadout: contaminantSystem.getSortieLoadout() }, checkpoint ?? undefined);
        } else {
          this.phase = 'base-starting'; this.record('recovered');
          this.ports.enterBase(!run || run.baseSettled === true);
        }
        return;
      }
      beginNewExpedition(host, () => {
        this.record('initial');
        this.phase = 'base-starting';
        this.ports.enterBase(true);
      });
    } catch (reason) { this.fail(reason); throw reason; }
  }

  prepareDeparture(selection: SeaJourneySelection): PurificationDevDeparture {
    if (this.phase !== 'base' || saveManager.hasPendingSave()) throw new Error('基地尚未完成保存，不能出发。');
    const ledger = inventoryStore.getRun();
    if (ledger && (ledger.status !== 'settled' || !ledger.baseSettled)) throw new Error('上一趟尚未完成结算。');
    assertSeaJourneyEquipment(inventoryStore.getState());
    const options = resolveSuspendedSeaOptions({ scene: selection.scene, seed: selection.seed });
    const world = createSuspendedSeaWorld(options.seed, options.scene);
    const beforeCycle = gameState.getCycle();
    this.world = world;
    this.phase = 'departing';
    this.record('departure-prepared');
    let handedOff = false;
    return {
      ...(this.recovery ? { recoveryIdentity: suspendedSeaIdentity(world) } : {}),
      start: data => {
        if (handedOff || this.phase !== 'departing') return;
        const run = inventoryStore.getRun();
        if (!run || run.status !== 'active' || saveManager.hasPendingSave() || gameState.getCycle() !== beforeCycle + 1
          || data.cycle !== gameState.getCycle()) {
          const reason = new Error('Native departure requires the committed formal beginRun / cycle / save boundary');
          this.fail(reason); throw reason;
        }
        // Runtime never rewrites the admitted equipment or creates a training loadout.
        assertSeaJourneyEquipment(inventoryStore.getState());
        const actual = contaminantSystem.getSortieLoadout();
        if (actual.length !== data.loadout.length || actual.some((item, index) => item?.id !== data.loadout[index]?.id)) {
          const reason = new Error('Prepared equipment changed after the departure transaction');
          this.fail(reason); throw reason;
        }
        handedOff = true;
        this.runId = run.id;
        this.record('departure-saved');
        this.phase = 'rift-starting';
        try { this.ports.enterRift(world, data); }
        catch (reason) { this.fail(reason); throw reason; }
      },
      cancel: () => {
        if (handedOff || this.phase !== 'departing') return;
        if (inventoryStore.getRun()?.status === 'active') {
          this.fail(new Error('Departure was interrupted after commit; the unfinished temporary run is retained.'));
        } else {
          this.record('departure-cancelled'); this.phase = 'base';
        }
      },
    };
  }

  markRiftReady(): void {
    if (this.phase === 'rift-starting') this.phase = 'rift';
  }

  returnToBase(): boolean {
    const run = inventoryStore.getRun();
    if (this.phase !== 'rift-settled' || !run || run.id !== this.runId || run.status !== 'settled'
      || run.baseSettled || saveManager.hasPendingSave()) return false;
    this.phase = 'base-starting'; // R / callbacks cannot enter the same base twice.
    try { this.ports.enterBase(false); }
    catch (reason) { this.fail(reason); throw reason; }
    return true;
  }

  readonly onSaved = (): void => {
    if (this.phase !== 'base-starting') return;
    const run = inventoryStore.getRun();
    const key = run?.id ?? 'initial';
    if (saveManager.hasPendingSave() || (run && (run.status !== 'settled' || !run.baseSettled)) || this.baseSaved.has(key)) return;
    this.baseSaved.add(key);
    this.record('base-saved');
    this.phase = 'base';
  };

  private readonly onRiftSettled = (): void => {
    const run = inventoryStore.getRun();
    if (!['rift', 'rift-starting'].includes(this.phase) || !run || run.id !== this.runId || run.status !== 'settled'
      || saveManager.hasPendingSave() || this.riftSettled.has(run.id)) return;
    this.riftSettled.add(run.id);
    this.record('rift-settled');
    this.phase = 'rift-settled';
  };

  fail(reason: unknown): void {
    if (this.phase === 'closed') return;
    this.faultMessage = reason instanceof Error ? reason.message : String(reason);
    this.phase = 'faulted'; this.record('fault', this.faultMessage);
  }

  snapshot() {
    return { phase: this.phase, initialized: this.initialized, fault: this.faultMessage, runId: this.runId,
      world: this.world ? structuredClone(this.world.metadata) : null, boundaries: this.ledger.length, ...captureState() };
  }
  exportLedger(): readonly SeaJourneyLedgerEntry[] { return structuredClone(this.ledger); }

  close(): void {
    if (this.phase === 'closed') return;
    this.record('closed', this.recovery ? 'Page closed. Continue the last complete record; no abandon or extra settlement.' : 'Temporary page closed. No abandon, death, recovery or extra settlement was applied.');
    this.phase = 'closed';
    eventBus.off(GameEvent.GAME_SAVED, this.onSaved);
    eventBus.off(GameEvent.RIFT_EXITED, this.onRiftSettled);
  }

  private record(boundary: SeaJourneyLedgerEntry['boundary'], detail?: string): void {
    this.ledger.push({ sequence: this.ledger.length + 1, at: new Date().toISOString(), boundary,
      runId: inventoryStore.getRun()?.id ?? null, world: this.world ? structuredClone(this.world.metadata) : null,
      state: captureState(), ...(detail ? { detail } : {}) });
  }
}
