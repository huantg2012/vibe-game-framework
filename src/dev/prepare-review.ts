/** DEV-only, real PurificationScene and inventory UI over an injected memory
 * backend. Fixtures are declared grants, never an earned gameplay record. */
import Phaser from 'phaser';
import { gameConfig } from '@/config/game-config';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { PurificationScene } from '@/scenes/purification-scene';
import { BuildLabMemoryStorage } from './build-lab-session';
import { contaminantSystem } from '@/systems/contaminant-system';
import { createCatalogContaminant } from '@/systems/contaminant-catalog';
import { CATALOG_ITEMS } from '@/generated/contaminant-catalog-data';
import { resetDefenseEngine } from '@/systems/defense-engine';
import { growthSystem } from '@/systems/growth-system';
import { impactSystem } from '@/systems/impact-system';
import { inventoryStore } from '@/systems/inventory-store';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import { inventoryPanel } from '@/ui/dom/inventory-panel';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { projectInventoryItem } from '@/ui/inventory-presenter';
import type { InventoryResult } from '@/types/inventory-types';

if (!import.meta.env.DEV) throw new Error('Preparation review is development-only');

type Fixture = 'starter' | 'equipped' | 'long' | 'expanded' | 'blocked';
const FIXTURES: readonly Fixture[] = ['starter', 'equipped', 'long', 'expanded', 'blocked'];
let fixture: Fixture = 'starter';
let ready = false;
const calls = { get: 0, set: 0, remove: 0 };
class ReviewStorage extends BuildLabMemoryStorage {
  override getItem(key: string): string | null { calls.get++; return super.getItem(key); }
  override setItem(key: string, value: string): void { calls.set++; super.setItem(key, value); }
  override removeItem(key: string): void { calls.remove++; super.removeItem(key); }
}
// Must precede Phaser Boot. No persistence method is replaced or stubbed.
saveManager.setStorage(new ReviewStorage());
const game = new Phaser.Game(gameConfig);
bindDomUiRootToGame(game);
const controls = document.getElementById('prepare-review-controls')!;
const buttons = new Map<Fixture, HTMLButtonElement>();

function fail(reason: unknown): void {
  let node = document.getElementById('prepare-review-error');
  if (!node) { node = document.createElement('pre'); node.id = 'prepare-review-error'; document.body.append(node); }
  node.textContent = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
}
window.addEventListener('error', event => fail(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => fail(event.reason));
function requireResult<T>(result: InventoryResult<T>): T {
  if (!result.ok) throw new Error(`Preparation fixture: ${result.error}`);
  return result.value;
}
function scene(): PurificationScene | null {
  const active = game.scene.getScenes(true).find(value => value instanceof PurificationScene);
  return active instanceof PurificationScene ? active : null;
}
function close(): void {
  inventoryPanel.close(); scene()?.cancelWorldInteraction();
}
function open(): void {
  if (!ready) return;
  close(); scene()?.openWorldInteraction('rift');
}
function grant(definitionId: string, index: number, mature: boolean): string {
  const id = `prepare-fixture-${index}`;
  requireResult(inventoryStore.addContaminant(createCatalogContaminant({ id, definitionId,
    appearanceId: 'wax_parcel', offeringProfileId: 'resist_25', quality: 'ordinary', acquiredOrdinal: index + 1 })));
  if (mature) {
    requireResult(inventoryStore.slotOffering(id, 0));
    requireResult(inventoryStore.finishOfferingImpact([id], 3, {}, `prepare-review-offering-${index}`));
  }
  return id;
}
function reset(next: Fixture = 'starter'): void {
  if (!ready || !FIXTURES.includes(next)) return;
  close();
  for (const current of game.scene.getScenes(false)) {
    if (current.scene.isActive() || current.scene.isPaused()) game.scene.stop(current.scene.key);
  }
  saveManager.deleteSave();
  gameState.reset(); growthSystem.reset(); tideSystem.reset(); stabilityTracker.reset();
  resetDefenseEngine(); impactSystem.resetForecastState(); contaminantSystem.reset();
  fixture = next;
  if (next === 'expanded') {
    const growth = growthSystem.getState(); growth.upgrades.growth_sortie_slot = 1;
    growthSystem.loadState(growth);
  }
  if (next === 'equipped' || next === 'expanded' || next === 'long') {
    const definitions = ['cold_ash_pipe', 'amber_beetle', 'brass_monocle', 'split_heel_boot'];
    const ids = definitions.map((definition, index) => grant(definition, index, true));
    requireResult(inventoryStore.prepareTool(ids[0]!, 0));
    requireResult(inventoryStore.prepareTool(ids[1]!, 1));
    const passive = contaminantSystem.getSortieSlotCount() - 1;
    requireResult(inventoryStore.prepareTool(ids[2]!, passive));
    if (next === 'expanded') requireResult(inventoryStore.prepareTool(ids[3]!, 2));
    grant('doorless_lantern', 4, false);
    if (next === 'long') {
      const catalogue = Object.values(CATALOG_ITEMS).filter(item => item.enabled && item.class !== 'inert');
      for (let index = 5; index < 65; index++) grant(catalogue[(index - 5) % catalogue.length]!.id, index, true);
    }
    gameState.addKindling(35);
  }
  contaminantSystem.syncInventoryDerivedState();
  saveManager.save();
  game.scene.start('PurificationScene', { fromMenu: true });
  if (next === 'blocked') {
    // An owned ready weapon remains in storage; only its prepared reference is
    // empty. Production replacement rules therefore do not grant another one.
    const inventory = inventoryStore.getState();
    const weapon = inventory.items.find(item => item.id === inventory.equipment.weaponId);
    if (weapon) weapon.location = { kind: 'stash' };
    inventory.equipment.weaponId = null;
    if (!inventoryStore.loadState(inventory)) throw new Error('Blocked preparation fixture is invalid');
    saveManager.save();
  }
  for (const [name, button] of buttons) button.setAttribute('aria-pressed', String(name === fixture));
  open();
}
function getState() {
  const active = game.scene.getScenes(true).map(value => value.scene.key);
  return { ready, fixture, activeScene: active[0] ?? null, scenes: active,
    grade: document.querySelector<HTMLButtonElement>('[data-departure-grade][aria-pressed="true"]')?.dataset.departureGrade ?? null,
    view: document.getElementById('inventory-panel')?.dataset.prepareView ?? null,
    equipment: inventoryStore.getEquipment(), inventory: inventoryStore.getItems().map(item => projectInventoryItem(item, 'prepare')),
    run: inventoryStore.getRun(), cycle: gameState.getCycle(), base: gameState.getState(),
    storageCalls: { ...calls }, journey: scene()?.probeJourneyState() ?? null };
}
for (const name of FIXTURES) {
  const button = document.createElement('button'); button.textContent = name; button.dataset.fixture = name;
  button.onclick = () => reset(name); buttons.set(name, button); controls.append(button);
}
for (const [label, action] of [['打开备行', open], ['关闭', close]] as const) {
  const button = document.createElement('button'); button.textContent = label; button.onclick = action; controls.append(button);
}
Object.assign(window, { __game: game, __prepareReview: { getState, reset, open, close } });
function afterBoot(): void {
  if (!game.scene.getScenes(true).some(current => current.scene.key !== 'BootScene')) { requestAnimationFrame(afterBoot); return; }
  ready = true;
  const requested = new URLSearchParams(location.search).get('fixture');
  reset(FIXTURES.includes(requested as Fixture) ? requested as Fixture : 'starter');
}
requestAnimationFrame(afterBoot);
