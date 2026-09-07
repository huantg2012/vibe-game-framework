import { DENSE_PLAYER_GROUND_OFFSET_Y } from '@/entities/player-sprite-dense';
/** Developer-only review surface. Every screen is its production module.
 * Fixtures are memory-only and this entry never reads, writes or deletes a save.
 * Deliberately excluded from Vite production inputs.
 */
import Phaser from 'phaser';
import { PurificationScene, type WorldInteractionTarget } from '@/scenes/purification-scene';
import { gameConfig } from '@/config/game-config';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { contaminantSystem } from '@/systems/contaminant-system';
import { growthSystem } from '@/systems/growth-system';
import { tideSystem } from '@/systems/tide-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { statusPanel } from '@/ui/dom/status-panel';
import { allocationPanel } from '@/ui/dom/allocation-panel';
import { defensePanel } from '@/ui/dom/defense-panel';
import { growthPanel } from '@/ui/dom/growth-panel';
import { loadoutPanel } from '@/ui/dom/loadout-panel';
import { impactResultPanel } from '@/ui/dom/impact-result-panel';
import { riftResultPanel } from '@/ui/dom/rift-result-panel';
import { pauseMenu } from '@/ui/dom/pause-menu';
import type { ContaminantType } from '@/types/game-types';

if (import.meta.env.DEV) {
  // Keep runtime failures visible in this isolated review surface.
  const reportError = (message: string): void => {
    let output = document.getElementById('review-runtime-error');
    if (!output) {
      output = document.createElement('pre');
      output.id = 'review-runtime-error';
      output.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:30000;margin:0;padding:12px;background:#190f0e;color:#dab6a3;font:12px/18px monospace;white-space:pre-wrap;';
      document.body.appendChild(output);
    }
    output.textContent = message;
  };
  window.addEventListener('error', (event) => reportError(event.error?.stack ?? event.message));
  window.addEventListener('unhandledrejection', (event) => reportError(String(event.reason?.stack ?? event.reason)));

  // Isolation belongs to this development entry, never to the save system.
  saveManager.save = () => {};
  saveManager.load = () => false;
  saveManager.deleteSave = () => {};
  saveManager.hasSave = () => false;
  const savedRecordFixture = new URLSearchParams(window.location.search).get('record') === 'saved';
  saveManager.peekRecordSummary = () => savedRecordFixture
    ? { tideNumber: 3, phase: 'ebb', cycle: 2, progress: 4, reached: false } : null;
  saveManager.peekTideNumber = () => savedRecordFixture ? 3 : null;
  window.location.hash = 'purif';
  const game = new Phaser.Game(gameConfig);
  bindDomUiRootToGame(game);
  const sample = new URLSearchParams(window.location.search).get('sample');
  const coreSampleOnly = sample === 'core';
  const worldSampleOnly = sample === 'world';
  if (coreSampleOnly || worldSampleOnly) document.body.classList.add('core-sample');
  let selectedWorldTarget: WorldInteractionTarget = 'CORE';
  const worldTargets: readonly (readonly [string, WorldInteractionTarget])[] = [
    ['核心', 'CORE'], ['储藏', 'STORAGE'], ['净化器', 'PURIFIER'],
    ['供奉', 'defense'], ['蜕变', 'growth'], ['裂隙入口', 'rift'],
  ];
  let populated = false;
  let resultKey: ((event: KeyboardEvent) => void) | null = null;
  let finishImpact: (() => void) | null = null;

  function activeScene(): Phaser.Scene | undefined {
    return game.scene.scenes.find((scene) => scene.scene.isActive() || scene.scene.isPaused());
  }
  function resume(): void {
    game.scene.scenes.forEach((scene) => {
      if (scene.scene.isPaused()) game.scene.resume(scene.scene.key);
    });
  }
  function closeScreens(): void {
    statusPanel.close(); allocationPanel.close(); defensePanel.close();
    growthPanel.close(); loadoutPanel.close(); pauseMenu.close();
    riftResultPanel.close();
    // Impact has an intentionally keyboard-owned dismissal. Its development
    // button is wired through the same visible close action.
    document.getElementById('impact-close-btn')?.click();
    finishImpact?.(); finishImpact = null;
    if (resultKey) document.removeEventListener('keydown', resultKey);
    resultKey = null;
    const purificationScene = game.scene.getScene('PurificationScene');
    if (purificationScene instanceof PurificationScene &&
        (purificationScene.scene.isActive() || purificationScene.scene.isPaused())) {
      purificationScene.cancelWorldInteraction();
    }
    resume();
  }
  function switchScene(key: string): void {
    closeScreens();
    game.scene.scenes.forEach((scene) => {
      if (scene.scene.isActive() || scene.scene.isPaused()) game.scene.stop(scene.scene.key);
    });
    game.scene.start(key);
  }
  function fixture(withItems: boolean, copies = 1): void {
    closeScreens();
    gameState.reset(); contaminantSystem.reset(); growthSystem.reset();
    tideSystem.reset(); stabilityTracker.reset();
    populated = withItems;
    if (withItems) {
      gameState.addKindling(85);
      const core = gameState.getModule('CORE');
      if (core) core.hp = 28;
      const types = Object.keys(CONTAMINANT_DATA) as ContaminantType[];
      Array.from({ length: copies }, () => types).flat().forEach((type, i) => {
        contaminantSystem.acquire(type, i % 2 === 0 ? 'fine' : 'rare');
        const tool = contaminantSystem.acquire(type, 'fine');
        tool.stage = 'tool';
      });
      const defense = contaminantSystem.getAll().find((item) => item.stage === 'defense');
      if (defense) contaminantSystem.slotDefense(defense.id, 0);
    }
    switchScene('PurificationScene');
    paintControls();
  }
  function openWorldTarget(target: WorldInteractionTarget): void {
    closeScreens();
    selectedWorldTarget = target;
    if (activeScene()?.scene.key !== 'PurificationScene') switchScene('PurificationScene');
    const scene = game.scene.getScene('PurificationScene');
    if (scene instanceof PurificationScene) scene.openWorldInteraction(target);
    if (worldSampleOnly) paintControls();
  }
  function open(action: () => void): void {
    closeScreens();
    const scene = activeScene();
    if (!scene || scene.scene.key === 'BootScene') return;
    game.scene.pause(scene.scene.key);
    action();
  }
  function result(survived: boolean): void {
    open(() => {
      const acquired = contaminantSystem.getAll().filter((item) => item.stage === 'defense');
      riftResultPanel.show({ survived, kindlingGained: survived ? 37 : 0,
        killCount: 3, peakChaos: 108, elapsedMs: 184000, acquired,
        passiveTriggers: new Map() }, closeScreens);
      resultKey = (event) => {
        if (event.key.toLowerCase() === 'r') closeScreens();
      };
      document.addEventListener('keydown', resultKey);
    });
  }
  const actions: [string, () => void][] = [
    ['净化点', () => switchScene('PurificationScene')],
    ['报告', () => open(() => statusPanel.open(resume))],
    ['核心分配', () => openWorldTarget('CORE')],
    ['储藏分配', () => openWorldTarget('STORAGE')],
    ['净化器分配', () => openWorldTarget('PURIFIER')],
    ['供奉', () => openWorldTarget('defense')],
    ['蜕变', () => openWorldTarget('growth')],
    ['装配', () => openWorldTarget('rift')],
    ['裂隙', () => switchScene('RiftScene')],
    ['撤离结算', () => result(true)], ['阵亡结算', () => result(false)],
    ['冲击结算', () => open(() => {
      finishImpact = resume;
      impactResultPanel.show([
        { moduleId: 'CORE', damage: 32, newHp: 38 },
        { moduleId: 'STORAGE', damage: 11, newHp: 59 },
        { moduleId: 'PURIFIER', damage: 8, newHp: 62 },
      ], 1.35, resume, { actualPrimaryModuleId: 'CORE', actualSeverity: 'heavy' });
    })],
    ['暂停', () => { closeScreens(); const scene = activeScene(); if (scene) pauseMenu.open(scene); }],
    ['主菜单', () => switchScene('MainMenuScene')],
    ['长库存', () => fixture(true, 5)],
    ['合上', closeScreens],
    ['检查界面', () => {
      const loaded = document.fonts.status === 'loaded';
      const panel = document.querySelector<HTMLElement>('.game-panel');
      const bounds = panel?.getBoundingClientRect();
      const clipped = bounds ? [...panel!.querySelectorAll('.key-hint-bar button')].some((button) => {
        const rect = button.getBoundingClientRect();
        return rect.bottom > bounds.bottom || rect.top < bounds.top || rect.right > bounds.right;
      }) : false;
      document.getElementById('review-note')!.textContent = `字体${loaded ? '已加载' : '未就绪'} · 底部操作${clipped ? '超界' : '正常'} · 示例不读写存档`;
    }],
  ];
  function paintControls(): void {
    const controls = document.getElementById('review-controls')!;
    controls.replaceChildren();
    if (worldSampleOnly) {
      const label = document.createElement('span');
      label.textContent = '场景交互 · ';
      controls.appendChild(label);
      for (const [text, target] of worldTargets) {
        const button = document.createElement('button');
        button.textContent = text;
        button.setAttribute('aria-pressed', String(selectedWorldTarget === target));
        button.onclick = () => openWorldTarget(target);
        controls.appendChild(button);
      }
      for (const [text, action] of [
        ['重置 / 85薪柴', () => startWorldSample(true)],
        ['零库存', () => startWorldSample(false)],
        ['退回场景', closeScreens],
      ] as const) {
        const button = document.createElement('button');
        button.textContent = text; button.onclick = action; controls.appendChild(button);
      }
      return;
    }
    if (coreSampleOnly) {
      const label = document.createElement('span');
      label.textContent = '核心交互样板 · ';
      controls.appendChild(label);
      for (const [text, action] of [
        ['重新体验', () => startCoreSample(true)],
        ['零薪柴', () => startCoreSample(false)],
        ['退回场景', closeScreens],
      ] as const) {
        const button = document.createElement('button');
        button.textContent = text; button.onclick = action; controls.appendChild(button);
      }
      return;
    }
    if (sample === 'spatial') {
      const row = document.createElement('div');
      for (const [label, texture] of [
        ['核心', 'module-core-v6-b'], ['储藏', 'module-storage-c1'],
        ['净化器', 'module-purifier-b1'], ['供奉', 'module-offering-i'], ['培养藏', 'module-growth-a'],
      ]) {
        for (const [side, offset] of [['后方', -24], ['前方', 24]] as const) {
          const button = document.createElement('button');
          button.textContent = `${label}${side}`;
          button.onclick = () => {
            closeScreens();
            const scene = activeScene();
            if (!(scene instanceof PurificationScene)) return;
            const actor = scene.children.list.find((item): item is Phaser.Physics.Arcade.Image =>
              item instanceof Phaser.Physics.Arcade.Image && item.texture.key.startsWith('player-dense'));
            const device = scene.children.list.find((item): item is Phaser.GameObjects.Image | Phaser.GameObjects.Sprite =>
              (item instanceof Phaser.GameObjects.Image || item instanceof Phaser.GameObjects.Sprite) && item.texture.key === texture);
            if (!actor || !device) return;
            scene.cameras.main.setZoom(3).centerOn(device.x, device.y - 8);
            (actor.body as Phaser.Physics.Arcade.Body).reset(device.x, device.y - DENSE_PLAYER_GROUND_OFFSET_Y + offset);
            const note = document.getElementById('review-note');
            scene.time.delayedCall(80, () => {
              if (note) note.textContent = `${label}${side} · 角色层 ${actor.depth.toFixed(1)} / 装置层 ${device.depth.toFixed(1)} · 示例不读写存档`;
            });
          };
          row.appendChild(button);
        }
      }
      for (const [label, names] of [
        ['走上', ['UP']], ['走下', ['DOWN']], ['走左', ['LEFT']], ['走右', ['RIGHT']],
        ['走左上', ['LEFT', 'UP']], ['走右上', ['RIGHT', 'UP']],
        ['走左下', ['LEFT', 'DOWN']], ['走右下', ['RIGHT', 'DOWN']],
      ] as const) {
        const button = document.createElement('button');
        button.textContent = label;
        button.onclick = () => {
          closeScreens();
          const scene = activeScene();
          if (!(scene instanceof PurificationScene) || !scene.input.keyboard) return;
          const heldKeys = names.map(name => {
            const key = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes[name]);
            key.onDown(new KeyboardEvent('keydown', { key: name }));
            return key;
          });
          scene.time.delayedCall(350, () => {
            heldKeys.forEach(key => key.onUp(new KeyboardEvent('keyup')));
            scene.time.delayedCall(180, () => {
              const actor = scene.children.list.find((item): item is Phaser.Physics.Arcade.Image =>
                item instanceof Phaser.Physics.Arcade.Image && item.texture.key.startsWith('player-dense'));
              const note = document.getElementById('review-note');
              if (actor && note) note.textContent = `${label} · ${actor.texture.key} · 角色层 ${actor.depth.toFixed(1)} · x${actor.x.toFixed(1)} y${actor.y.toFixed(1)}`;
            });
          });
        };
        row.appendChild(button);
      }
      const interact = document.createElement('button');
      interact.textContent = '按E交互';
      interact.onclick = () => {
        const scene = activeScene();
        if (!(scene instanceof PurificationScene) || !scene.input.keyboard) return;
        const key = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        key.onDown(new KeyboardEvent('keydown', { key: 'e' }));
        scene.time.delayedCall(80, () => key.onUp(new KeyboardEvent('keyup', { key: 'e' })));
      };
      row.appendChild(interact);
      const highTide = document.createElement('button');
      highTide.textContent = '最高潮汐';
      highTide.onclick = () => {
        closeScreens();
        tideSystem.loadState({ tideNumber: 5, phase: 'crest', cycleInPhase: 0, currentIntensity: 3 });
        switchScene('PurificationScene');
      };
      row.appendChild(highTide);
      controls.appendChild(row);
    }
    const fixtureRow = document.createElement('div');
    for (const [label, withItems] of [['空库存 / 零薪柴', false], ['完整库存 / 85薪柴', true]] as const) {
      const button = document.createElement('button');
      button.textContent = label;
      button.setAttribute('aria-pressed', String(populated === withItems));
      button.onclick = () => fixture(withItems);
      fixtureRow.appendChild(button);
    }
    const note = document.createElement('span');
    note.id = 'review-note'; note.textContent = '开发验收 · 生产界面 · 示例状态不读写存档';
    fixtureRow.appendChild(note); controls.appendChild(fixtureRow);
    for (const [label, action] of actions) {
      const button = document.createElement('button'); button.textContent = label;
      button.onclick = action; controls.appendChild(button);
    }
  }
  function startWorldSample(withItems: boolean): void {
    fixture(withItems);
    openWorldTarget(selectedWorldTarget);
  }
  function startCoreSample(withKindling: boolean): void {
    fixture(withKindling);
    openWorldTarget('CORE');
  }
  // Do not let a fixture stop BootScene while its assets are still loading.
  const showControlsWhenReady = (): void => {
    if (game.scene.scenes.some((scene) => scene.scene.key !== 'BootScene' && scene.scene.isActive())) {
      if (coreSampleOnly) startCoreSample(true);
      else if (worldSampleOnly) startWorldSample(true);
      else paintControls();
    } else {
      requestAnimationFrame(showControlsWhenReady);
    }
  };
  showControlsWhenReady();
}
