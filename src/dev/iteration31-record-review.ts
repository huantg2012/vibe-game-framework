/** DEV-only entry: production scenes and persistence, with an isolated Map backend. */
import Phaser from 'phaser';
import { gameConfig } from '@/config/game-config';
import { GAME_CONSTANTS } from '@/config/constants';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { inventoryStore } from '@/systems/inventory-store';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { pauseMenu } from '@/ui/dom/pause-menu';

if (import.meta.env.DEV) {
  const key = GAME_CONSTANTS.SAVE.KEY;
  const records = new Map<string, string>();
  let baseline: string | null = null;
  let capturedRecord: string | null = null;
  let rejectWrites = false;
  let writeAttempts = 0;
  let committedWrites = 0;
  let removes = 0;
  let fixtureName = '无记录';
  let lastAction = '正在载入生产场景';
  let runtimeError = '';
  const controls = document.getElementById('record-review-controls')!;
  const status = document.getElementById('record-review-status')!;
  const report = document.getElementById('record-review-report')!;

  // Injection precedes scene creation. No SaveManager method is replaced.
  saveManager.setStorage({
    getItem: storedKey => records.get(storedKey) ?? null,
    setItem: (storedKey, bytes) => {
      writeAttempts++;
      if (rejectWrites) throw new Error('DEV fixture: writes rejected');
      records.set(storedKey, bytes);
      committedWrites++;
    },
    removeItem: storedKey => { removes++; records.delete(storedKey); },
  });
  window.location.hash = '';
  const game = new Phaser.Game(gameConfig);
  bindDomUiRootToGame(game);

  const scenes = (): Phaser.Scene[] => game.scene.scenes.filter(scene => scene.scene.isActive() || scene.scene.isPaused());
  const playingScene = (): Phaser.Scene | undefined => scenes().find(scene => scene.scene.key !== 'BootScene');
  const blocked = (): boolean => saveManager.hasPendingSave()
    || saveManager.hasUncommittedNewRecord() || inventoryStore.hasFrameTransaction();

  function inspect(): void {
    const raw = records.get(key) ?? null;
    const active = scenes();
    report.textContent = JSON.stringify({
      fixture: fixtureName,
      rawUnchanged: raw === baseline,
      recordPresent: raw !== null,
      rawLength: raw?.length ?? 0,
      rawPreview: raw?.slice(0, 180) ?? null,
      writeAttempts,
      committedWrites,
      removes,
      rejectWrites,
      hasPendingSave: saveManager.hasPendingSave(),
      hasUncommittedNewRecord: saveManager.hasUncommittedNewRecord(),
      inventoryFrameOpen: inventoryStore.hasFrameTransaction(),
      activeScenes: active.map(scene => scene.scene.key),
      pausedScenes: active.filter(scene => scene.scene.isPaused()).map(scene => scene.scene.key),
      pauseOpen: pauseMenu.isOpen(),
      kindling: gameState.getKindlingReserve(),
      capturedNormalRecord: capturedRecord !== null,
      lastAction,
      runtimeError: runtimeError || null,
    }, null, 2);
    status.textContent = `${fixtureName} · 原字节${raw === baseline ? '未变' : '已替换'} · 写入 ${committedWrites}/${writeAttempts} · ${active.map(scene => scene.scene.key).join(', ') || '启动中'} · ${lastAction}`;
  }

  function maySwitch(): boolean {
    if (!playingScene()) {
      lastAction = '素材尚未载入，请稍后切换。';
      return false;
    }
    if (blocked()) {
      lastAction = '仍有待保存的新记录或事务，不能换夹具。请关闭拒写并使用场内“尚未保存 · 点击重试”。';
      return false;
    }
    if (inventoryStore.getRun()?.status === 'active') {
      lastAction = '当前为活动出击，不允许替换夹具。';
      return false;
    }
    return true;
  }

  function title(): void {
    pauseMenu.discard();
    for (const scene of scenes()) game.scene.stop(scene.scene.key);
    game.scene.start('MainMenuScene');
  }

  function setFixture(name: string, bytes: string | null, pauseInPlace = false): void {
    if (!maySwitch()) return;
    const scene = playingScene();
    if (pauseInPlace && scene?.scene.key !== 'PurificationScene') {
      lastAction = '请先在无记录首页选择新游戏，进入净化点后再使用暂停夹具。';
      return;
    }
    if (pauseInPlace && document.getElementById('menu-entry-transition')) {
      lastAction = '净化点入场尚未完成，请等待过渡结束。';
      return;
    }
    pauseMenu.close();
    records.clear();
    if (bytes !== null) records.set(key, bytes);
    baseline = bytes;
    fixtureName = name;
    writeAttempts = 0; committedWrites = 0; removes = 0;
    lastAction = pauseInPlace ? '已替换内存记录；点击“暂停菜单”进入正式暂停入口。' : '已切换内存记录与正式标题页。';
    if (!pauseInPlace) title();
  }

  function button(label: string, action: () => void): HTMLButtonElement {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.onclick = () => {
      element.blur();
      try { action(); } catch (error) { runtimeError = error instanceof Error ? error.stack ?? error.message : String(error); }
      inspect();
    };
    controls.append(element);
    return element;
  }

  button('无记录首页', () => setFixture('无记录', null));
  button('损坏 JSON 首页', () => setFixture('损坏 JSON', '{"record":"preserve-malformed"'));
  button('未来版本首页', () => setFixture('未来版本', '{"version":999,"record":"preserve-future"}'));
  button('空字符串首页', () => setFixture('空字符串', ''));
  button('捕获当前正常记录', () => {
    const bytes = records.get(key);
    if (blocked() || playingScene()?.scene.key !== 'PurificationScene' || !bytes || committedWrites === 0 || !saveManager.peekRecordSummary()) {
      lastAction = '请先经正式新游戏进入净化点并成功保存，再捕获。';
      return;
    }
    capturedRecord = bytes;
    lastAction = '已捕获由生产流程真实生成并保存的正常记录。';
  });
  button('正常记录首页', () => {
    if (capturedRecord === null) { lastAction = '尚未捕获正常记录；请先走一次正式新游戏。'; return; }
    setFixture('正常记录', capturedRecord);
  });
  controls.append(document.createElement('br'));
  button('净化点写入坏档', () => setFixture('暂停菜单 / 损坏 JSON', '{"record":"preserve-pause-malformed"', true));
  button('暂停菜单', () => {
    const scene = playingScene();
    if (!scene || scene.scene.key !== 'PurificationScene' || document.getElementById('menu-entry-transition')) {
      lastAction = '等待净化点入场完成后才可开启暂停菜单。'; return;
    }
    pauseMenu.open(scene);
    lastAction = '已调用生产 pauseMenu.open。';
  });
  button('回标题（保留内存记录）', () => { if (maySwitch()) { title(); lastAction = '回到正式标题页，原内存记录未改。'; } });
  const rejectButton = button('拒写：关闭', () => {
    rejectWrites = !rejectWrites;
    rejectButton.textContent = `拒写：${rejectWrites ? '开启' : '关闭'}`;
    rejectButton.setAttribute('aria-pressed', String(rejectWrites));
    lastAction = rejectWrites ? 'Map 后端拒绝 setItem；原字节保留。' : 'Map 后端恢复写入，可使用正式场内重试按钮。';
  });
  rejectButton.setAttribute('aria-pressed', 'false');
  button('检查记录', inspect);
  controls.append(document.createElement('br'));
  for (const [label, keyName, code, keyCode, engineName] of [
    ['菜单 ↑', 'ArrowUp', 'ArrowUp', 38, 'UP'],
    ['菜单 ↓', 'ArrowDown', 'ArrowDown', 40, 'DOWN'],
    ['菜单 Enter', 'Enter', 'Enter', 13, 'ENTER'],
    ['菜单 Escape', 'Escape', 'Escape', 27, 'ESC'],
  ] as const) {
    button(label, () => {
      const event = new KeyboardEvent('keydown', { key: keyName, code, keyCode, which: keyCode, bubbles: true, cancelable: true });
      if (pauseMenu.isOpen()) document.dispatchEvent(event);
      else if (playingScene()?.scene.key === 'MainMenuScene') playingScene()!.input.keyboard?.emit(`keydown-${engineName}`, event);
      else { lastAction = '这些按键只用于正式标题或暂停菜单；场内重试请点击实际按钮。'; return; }
      lastAction = `${label} → ${pauseMenu.isOpen() ? 'DOM 暂停菜单' : 'Phaser 标题菜单'}`;
    });
  }

  const onError = (event: ErrorEvent): void => { runtimeError = event.error?.stack ?? event.message; inspect(); };
  const onRejection = (event: PromiseRejectionEvent): void => { runtimeError = String(event.reason?.stack ?? event.reason); inspect(); };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const timer = window.setInterval(inspect, 500);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.clearInterval(timer);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  });
  lastAction = '仅使用内存 Map；请等待标题载入。正常记录通过实际新游戏创建。';
  inspect();
} else {
  document.body.textContent = '此验收入口仅在开发服务器可用。';
}
