/** Isolated DEV fixture. Production game, player, interaction and save code are
 * unchanged. Only legal starting coordinates and a page-local storage backend
 * are supplied here; E and all proximity decisions run through the real scene. */
import Phaser from 'phaser';
import { gameConfig } from '@/config/game-config';
import { saveManager } from '@/managers/save-manager';
import { beginNewExpedition } from '@/managers/session';
import { PurificationScene } from '@/scenes/purification-scene';
import type { Player } from '@/entities/player';
import {
  canStandLastLight, createLastLightMovementState,
  type LastLightLocomotion, type LastLightMovementState,
} from '@/systems/last-light-locomotion';
import {
  LAST_LIGHT_STATIONS, LAST_LIGHT_SPAWN, CHAMBER_DEVICE_WORLD_ANCHORS,
  CHAMBER_DEVICE_FLOORS, CHAMBER_GROUND_OFFSET_Y,
  projectLastLight, sampleLastLightSurface,
  type ChamberDevice, type LastLightRoute,
} from '@/systems/last-light-layout';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';

// Narrow access is confined to this excluded DEV entry. No production setter
// or window command bridge is added, and no predicate is monkey-patched.
interface FixtureSceneInternals {
  player: Player;
  locomotion: LastLightLocomotion | null;
}
interface FixtureMovementInternals { state: LastLightMovementState }

if (import.meta.env.DEV) {
  const records = new Map<string, string>();
  saveManager.setStorage({
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value); },
    removeItem: key => { records.delete(key); },
  });
  window.location.hash = '';
  const game = new Phaser.Game(gameConfig);
  bindDomUiRootToGame(game);
  const status = document.getElementById('interaction-review-status')!;
  const report = document.getElementById('interaction-review-report')!;
  const stationControls = document.getElementById('interaction-review-stations')!;
  const form = document.getElementById('interaction-review-position') as HTMLFormElement;
  const xInput = document.getElementById('interaction-review-x') as HTMLInputElement;
  const zInput = document.getElementById('interaction-review-z') as HTMLInputElement;
  const routeInput = document.getElementById('interaction-review-route') as HTMLSelectElement;
  const labels: Record<ChamberDevice, string> = {
    core: '核心', storage: '储藏', purifier: '净化器', offering: '供奉', growth: '蜕变', rift: '裂隙入口',
  };
  let bootstrapped = false;
  let lastAction = '等待真实标题场景，随后创建本页内存记录。';
  let runtimeError: string | null = null;
  let lastPlacement: Record<string, unknown> | null = null;

  function scene(): PurificationScene | null {
    const found = game.scene.scenes.find(s => s instanceof PurificationScene);
    return found instanceof PurificationScene && found.scene.isActive() ? found : null;
  }

  function updateInputs(x: number, z: number, route: LastLightRoute): void {
    xInput.value = x.toFixed(3); zInput.value = z.toFixed(3); routeInput.value = route;
  }

  function place(x: number, z: number, route: LastLightRoute, label: string, facing?: number): void {
    const active = scene();
    if (!active) { lastAction = '拒绝定位：净化点尚未激活。'; return; }
    const internals = active as unknown as FixtureSceneInternals;
    const probe = active.probeJourneyState();
    const playerState = internals.player.exportRuntimeState();
    if (!internals.locomotion || !playerState.inputEnabled || probe?.resting || probe?.transitioning || saveManager.hasPendingSave()) {
      lastAction = '拒绝定位：请经正式 Esc 关闭界面或起身，等待镜头恢复后再定位。'; return;
    }
    if (!['main', 'upper', 'west-ramp'].includes(route) || !Number.isFinite(x) || !Number.isFinite(z)) {
      lastAction = '拒绝定位：坐标或地层无效。'; return;
    }
    const support = sampleLastLightSurface(route, x, z);
    if (!support || !canStandLastLight({ x, y: support.height, z }, route)) {
      lastAction = `拒绝定位：${label} (${x.toFixed(3)}, ${z.toFixed(3)}) 在 ${route} 不满足完整脚圆支撑或碰撞净空。`;
      lastPlacement = { label, x, z, route, accepted: false };
      return;
    }
    const movement = createLastLightMovementState({ x, y: support.height, z }, route);
    movement.facing = facing ?? internals.locomotion.getWorldFacing();
    const feet = projectLastLight(movement);
    const playerPosition = { x: feet.x, y: feet.y - CHAMBER_GROUND_OFFSET_Y };
    const dx = playerPosition.x - playerState.position.x, dy = playerPosition.y - playerState.position.y;
    // Hydrate both layers together; a projected sprite-only relocation would
    // snap back on the next update and invalidate the interaction observation.
    Object.assign((internals.locomotion as unknown as FixtureMovementInternals).state, movement);
    internals.player.restoreRuntimeState({
      ...playerState,
      position: playerPosition,
      bodyPosition: { x: playerState.bodyPosition.x + dx, y: playerState.bodyPosition.y + dy },
      velocity: { x: 0, y: 0 }, inputVector: { x: 0, y: 0 }, moving: false,
    });
    internals.locomotion.update(0);
    updateInputs(x, z, route);
    lastPlacement = { label, x, y: support.height, z, route, accepted: true };
    lastAction = `${label}：已定位合法脚点；目标与提示由下一帧正式交互代码决定。`;
    (document.activeElement as HTMLElement | null)?.blur();
    game.canvas.focus();
  }

  function button(label: string, action: () => void): void {
    const element = document.createElement('button');
    element.type = 'button'; element.textContent = label;
    element.onclick = () => {
      element.blur();
      try { action(); } catch (error) { runtimeError = error instanceof Error ? error.stack ?? error.message : String(error); }
      inspect();
    };
    stationControls.append(element);
  }
  for (const key of ['core', 'storage', 'purifier', 'offering', 'growth', 'rift'] as const) {
    button(`${labels[key]} · 操作面`, () => {
      const point = CHAMBER_DEVICE_WORLD_ANCHORS[key];
      const station = LAST_LIGHT_STATIONS.find(s => s.key === key)!;
      place(point.x, point.z, CHAMBER_DEVICE_FLOORS[key], `${labels[key]}操作面`,
        Math.atan2(station.position[0]! - point.x, station.position[2]! - point.z));
    });
  }
  button('出生点', () => place(LAST_LIGHT_SPAWN.x, LAST_LIGHT_SPAWN.z, 'main', '出生点'));
  form.onsubmit = event => {
    event.preventDefault();
    place(xInput.valueAsNumber, zInput.valueAsNumber, routeInput.value as LastLightRoute, '手动脚点');
    inspect();
  };
  document.getElementById('interaction-review-read-position')!.onclick = () => {
    const active = scene() as unknown as FixtureSceneInternals | null;
    const movement = active?.locomotion;
    if (!movement) return;
    const point = movement.getWorldPosition();
    updateInputs(point.x, point.z, movement.getRoute());
  };
  // Text/select editing belongs to the fixture, not to gameplay keyboard input.
  for (const type of ['keydown', 'keyup'] as const) form.addEventListener(type, event => event.stopPropagation());

  function inspect(): void {
    if (!bootstrapped) {
      const title = game.scene.scenes.find(s => s.scene.key === 'MainMenuScene' && s.scene.isActive());
      if (title) {
        bootstrapped = true;
        if (!beginNewExpedition(title)) runtimeError = '本页新记录创建失败。';
      }
    }
    const active = scene();
    const actual = active?.probeJourneyState() ?? null;
    const prompt = document.getElementById('purif-prompt');
    const promptStyle = prompt ? getComputedStyle(prompt) : null;
    const visible = !!prompt && promptStyle?.visibility !== 'hidden' && promptStyle?.display !== 'none' && Number(promptStyle?.opacity) > 0;
    const promptText = visible ? prompt.innerText.replace(/\s+/g, ' ').trim() : '';
    const entrance = LAST_LIGHT_STATIONS.find(s => s.key === 'rift')!;
    report.textContent = JSON.stringify({
      mode: 'production scene + production SaveManager; page-local Map only',
      actual,
      prompt: { visible, text: promptText },
      entrance: { position: entrance.position, approach: CHAMBER_DEVICE_WORLD_ANCHORS.rift, floor: CHAMBER_DEVICE_FLOORS.rift },
      stations: LAST_LIGHT_STATIONS.map(station => ({ key: station.key, position: station.position, approach: station.approach, floor: station.floor })),
      lastPlacement, lastAction, runtimeError,
    }, null, 2);
    const world = actual?.worldPlayer as { x: number; y: number; z: number } | undefined;
    status.textContent = runtimeError ?? `${world ? `(${world.x.toFixed(2)}, ${world.y.toFixed(2)}, ${world.z.toFixed(2)}) / ${actual?.route}` : '载入中'} · 当前 ${actual?.nearTarget ?? '无目标'} · ${promptText || '提示未显示'} · ${lastAction}`;
  }
  const onError = (event: ErrorEvent): void => { runtimeError = event.error?.stack ?? event.message; };
  const onRejection = (event: PromiseRejectionEvent): void => { runtimeError = String(event.reason?.stack ?? event.reason); };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const timer = window.setInterval(inspect, 200);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.clearInterval(timer);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  });
  inspect();
} else {
  document.body.textContent = '此验收入口仅在开发服务器可用。';
}
