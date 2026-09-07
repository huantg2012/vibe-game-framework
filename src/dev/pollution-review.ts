import type { CoverageId } from '@/generated/contamination-lexicon-data';
/** DEV entry only, excluded from production inputs. No save access, real RiftScene. */
import Phaser from 'phaser';
import { gameConfig } from '@/config/game-config';
import { RiftScene } from '@/scenes/rift-scene';
import { saveManager } from '@/managers/save-manager';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { riftResultPanel } from '@/ui/dom/rift-result-panel';

if (import.meta.env.DEV) {
  saveManager.save = () => {};
  saveManager.load = () => false;
  saveManager.deleteSave = () => {};
  saveManager.hasSave = () => false;
  saveManager.peekRecordSummary = () => null;
  saveManager.peekTideNumber = () => null;
  location.hash = 'rift';
  const error = document.getElementById('error')!;
  window.addEventListener('error', (event) => error.textContent = event.error?.stack ?? event.message);
  window.addEventListener('unhandledrejection', (event) => error.textContent = String(event.reason));
  const game = new Phaser.Game(gameConfig);
  bindDomUiRootToGame(game);
  const controls = document.getElementById('controls')!;
  const output = document.getElementById('state')!;
  const select = document.createElement('select');
  select.setAttribute('aria-label', '污染体样本');
  controls.append(select);
  const scene = () => game.scene.getScene('RiftScene') as RiftScene;
  const coverage = document.createElement('select');
  coverage.setAttribute('aria-label', '覆盖程度（仅外观对照）');
  for (const [value, label] of [['', '外观：按生成'], ['infiltrate', '外观：渗透'], ['rewrite', '外观：改写'], ['overwrite', '外观：覆盖']]) {
    const option = document.createElement('option'); option.value = value!; option.textContent = label!; coverage.append(option);
  }
  controls.append(coverage);
  let previewId = '';
  coverage.onchange = () => {
    if (previewId && previewId !== select.value) scene().probeReviewCoverage(previewId, null);
    previewId = select.value;
    scene().probeReviewCoverage(previewId, (coverage.value || null) as CoverageId | null);
    coverage.blur();
  };
  select.onchange = () => {
    if (previewId) scene().probeReviewCoverage(previewId, null);
    previewId = ''; coverage.value = '';
  };
  let roster = '';
  let recording = false;
  const trace: unknown[] = [];
  let traceStart = 0;
  function button(label: string, action: () => void) {
    const element = document.createElement('button');
    element.textContent = label;
    element.onclick = () => { action(); element.blur(); };
    controls.append(element);
  }
  let protectedReview = false;
  button('切换观察保护', () => { protectedReview = !protectedReview; scene().probeReviewProtection(protectedReview); });
  button('接近观察', () => scene().probeInspectEnemy(select.value, 96));
  button('进入近战', () => scene().probeInspectEnemy(select.value, 22));
  button('受击样本', () => scene().probeReviewHit(select.value, false));
  button('消亡样本', () => scene().probeReviewHit(select.value, true));
  button('暂停 / 继续', () => game.scene.isPaused('RiftScene') ? game.scene.resume('RiftScene') : game.scene.pause('RiftScene'));
  button('重启本种子', () => { riftResultPanel.close(); game.scene.stop('RiftScene'); game.scene.start('RiftScene'); scene().probeReviewProtection(protectedReview); coverage.value = ''; previewId = ''; });
  button('记录12秒', () => { trace.length = 0; recording = true; traceStart = performance.now(); });
  button('显示记录', () => { output.textContent = JSON.stringify(trace); output.dataset.frozen = 'true'; });
  button('实时状态', () => delete output.dataset.frozen);
  // Visible test actions hold genuine keyboard events so movement uses Player + Arcade.
  for (const [label, key, code, keyCode] of [
    ['向右走1秒', 'd', 'KeyD', 68], ['向左走1秒', 'a', 'KeyA', 65],
    ['向上走1秒', 'w', 'KeyW', 87], ['向下走1秒', 's', 'KeyS', 83],
    ['挥击', ' ', 'Space', 32],
  ] as const) {
    button(label, () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, code, keyCode, bubbles: true }));
      window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key, code, keyCode, bubbles: true })), key === ' ' ? 80 : 1000);
    });
  }
  window.setInterval(() => {
    if (!game.scene.isActive('RiftScene') && !game.scene.isPaused('RiftScene')) return;
    const state = scene().probeEnemyReview();
    if (!state) return;
    const nextRoster = state.enemies.map((enemy) => enemy.id).join(',');
    if (roster !== nextRoster) {
      const previous = select.value;
      select.replaceChildren(...state.enemies.map((enemy) => {
        const option = document.createElement('option');
        option.value = enemy.id;
        option.textContent = `${enemy.id} · ${enemy.substrate} · ${enemy.motion}`;
        return option;
      }));
      select.value = state.enemies.some((enemy) => enemy.id === previous) ? previous
        : state.enemies.find((enemy) => enemy.substrate === 'insect_remnant')?.id ?? state.enemies[0]?.id ?? '';
      if (previewId && select.value !== previewId) {
        scene().probeReviewCoverage(previewId, null);
        previewId = ''; coverage.value = '';
      }
      roster = nextRoster;
    }
    if (recording) {
      trace.push({ ms: Math.round(performance.now() - traceStart), ...state });
      if (performance.now() - traceStart >= 12000) recording = false;
    }
    if (!output.dataset.frozen) output.textContent = JSON.stringify({
      seed: state.seed, hp: state.hp, player: state.player,
      sample: state.enemies.find((enemy) => enemy.id === select.value),
      textureCount: state.textures.length, coveragePreview: coverage.value || null, protectedReview, recording, samples: trace.length,
    }, null, 2);
  }, 50);
}
