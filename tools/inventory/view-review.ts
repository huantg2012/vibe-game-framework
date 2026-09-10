/** DEV-only presentation fixture. No GameState/SaveManager/domain singleton
 * imports: transactions below mutate this page's throwaway object only. */
import { inventoryPanel, type InventoryPanelAction, type InventoryPanelActionResult, type InventoryPanelItem, type InventoryPanelMode, type InventoryPanelSnapshot } from '../../src/ui/dom/inventory-panel';

if (!import.meta.env.DEV) throw new Error('Inventory review is development-only');
let currentMode: InventoryPanelMode = 'prepare';
let state: InventoryPanelSnapshot;
let failNext = false;
let events = 0;
const stateText = document.querySelector<HTMLElement>('#review-state')!;
const logText = document.querySelector<HTMLElement>('#review-log')!;
const log = (message: string) => { logText.textContent = `${++events}. ${message}`; };
const sumWeight = (snapshot: InventoryPanelSnapshot) => snapshot.items.reduce((sum, item) => sum + (item.location === 'carried' ? item.weight : 0), 0);

function createFixture(mode: InventoryPanelMode): InventoryPanelSnapshot {
  const items: InventoryPanelItem[] = Array.from({ length: 60 }, (_, index) => {
    const weapon = index % 4 === 0;
    return {
      id: `fixture-${index}`, kind: weapon ? 'weapon' : 'contaminant',
      name: weapon ? `旧撬棍 · ${String(index / 4 + 1).padStart(2, '0')}` : `检视用残片 · ${String(index).padStart(2, '0')}`,
      canEquip: true, stageLabel: '已成熟', usesRemaining: 3, quality: weapon ? '普通' : undefined, weight: weapon ? 30 : 20, location: index < 7 ? 'carried' : 'stash',
      description: weapon ? '普通铁撬棍，握持处缠着旧布。此页所有撬棍使用同一套普通属性。' : '仅用于测试物件分类、挂点和交换，不代表新增生产污染物。',
      stats: weapon ? [{ label: '伤害', value: 25 }, { label: '负重', value: 3 }] : [{ label: '使用余次', value: '3 次' }, { label: '作用', value: '检视用占位说明' }],
      toolSlots: weapon ? undefined : index === 3 ? ['passive'] : ['q', 'f'],
    };
  });
  // Six items total = 13 burden; this seventh light item gives exactly 15.
  // index 4 is a weapon, so shift it to storage and carry a contaminant instead.
  items[4]!.location = 'stash'; items[7]!.location = 'carried';
  // At base only equipped items are carried; field mode adds three found items.
  if (mode !== 'rift') for (let index = 4; index < items.length; index++) items[index]!.location = 'stash';
  items[0]!.equippedLabel = '在手'; items[1]!.equippedLabel = 'Q'; items[2]!.equippedLabel = 'F'; items[3]!.equippedLabel = '被动';
  if (mode === 'rift') items.push({ id: 'fixture-near', kind: 'weapon', name: '附近的测试撬棍', quality: '普通', weight: 40, location: 'ground', description: '仅测试超载交换的重 4 物件，并非新增生产款式。拿取后 19 / 16，须放下两件重 2 的收获。', stats: [{ label: '伤害', comparison: 25, value: 25 }] });
  const result: InventoryPanelSnapshot = { items, equipment: [{ id: 'weapon', label: '在手', itemId: 'fixture-0' }, { id: 'q', label: 'Q', itemId: 'fixture-1' }, { id: 'f', label: 'F', itemId: 'fixture-2' }, { id: 'g', label: 'G', locked: true }, { id: 'passive', label: '被动', itemId: 'fixture-3' }], weight: 0, capacity: 160, canDepart: true };
  result.weight = sumWeight(result);
  return result;
}

function report(): void {
  stateText.textContent = `模式：${currentMode}\n总物件：${state.items.length}\n随身：${state.items.filter(item => item.location === 'carried').length}\n负重：${state.weight / 10} / ${state.capacity / 10}\n${failNext ? '下一次交易将模拟失败' : '测试状态与游戏存档隔离'}`;
}

function onAction(action: InventoryPanelAction): InventoryPanelActionResult {
  if (action.type === 'inspect') return { ok: true };
  log(JSON.stringify(action));
  if (failNext) { failNext = false; report(); return { ok: false, message: '模拟失败：所有物件仍在原处，请重试或收起' }; }
  const candidate = structuredClone(state);
  const item = (id: string) => candidate.items.find(entry => entry.id === id);
  const equipped = (id: string) => candidate.equipment.some(slot => slot.itemId === id);
  if (action.type === 'exchange') {
    if (currentMode !== 'rift') return { ok: false, message: '交换仅用于裂隙附近收获' };
    if (!action.takeIds.length || new Set([...action.takeIds, ...action.dropIds]).size !== action.takeIds.length + action.dropIds.length) return { ok: false, message: '选择有重复，请重新查看' };
    if (action.takeIds.some(id => item(id)?.location !== 'ground') || action.dropIds.some(id => item(id)?.location !== 'carried' || equipped(id))) return { ok: false, message: '物件位置已变化，或选择了本趟装备' };
    for (const id of action.takeIds) item(id)!.location = 'carried';
    for (const id of action.dropIds) item(id)!.location = 'ground';
  } else if (action.type === 'drop') {
    if (currentMode !== 'rift' || action.itemIds.some(id => item(id)?.location !== 'carried' || equipped(id))) return { ok: false, message: '本趟装备不能放下' };
    for (const id of action.itemIds) item(id)!.location = 'ground';
  } else if (action.type === 'equipWeapon' || action.type === 'equipTool') {
    if (currentMode !== 'prepare') return { ok: false, message: '仅备行时可装配' };
    const selected = item(action.itemId);
    const slot = candidate.equipment.find(entry => entry.id === (action.type === 'equipWeapon' ? 'weapon' : action.slotId));
    if (!selected || !slot || slot.locked || (action.type === 'equipTool' && !selected.toolSlots?.includes(slot.id))) return { ok: false, message: '不能装到这个挂点' };
    const old = slot.itemId ? item(slot.itemId) : undefined;
    if (old) { old.equippedLabel = undefined; old.location = 'stash'; }
    for (const other of candidate.equipment) if (other.itemId === selected.id) other.itemId = null;
    slot.itemId = selected.id; selected.equippedLabel = slot.label; selected.location = 'carried';
  } else if (action.type === 'unequipTool') {
    if (currentMode !== 'prepare') return { ok: false, message: '仅备行时可装配' };
    const slot = candidate.equipment.find(entry => entry.id === action.slotId);
    if (!slot || slot.id === 'weapon') return { ok: false, message: '这个位置不能卸下' };
    const old = slot.itemId ? item(slot.itemId) : undefined;
    if (old) { old.equippedLabel = undefined; old.location = 'stash'; }
    slot.itemId = null;
  } else return { ok: false, message: '净化点通过装配携出，不手动转移库存' };
  candidate.weight = sumWeight(candidate);
  if (currentMode === 'rift' && candidate.weight > candidate.capacity) return { ok: false, message: `超过负重 ${(candidate.weight - candidate.capacity) / 10}，没有移动任何物件` };
  state = candidate; report();
  return { ok: true, message: action.type === 'exchange' ? '交换完成，附近物件仍可查看' : '测试物件已收好' };
}

function open(): void {
  inventoryPanel.open({ mode: currentMode, getSnapshot: () => state, onAction, onClose: () => log('已收起，测试数据未写入游戏'), onDepart: () => log('出发回调已收到；测试页不会进入真实关卡') });
  report();
}
for (const mode of ['catalog', 'prepare', 'rift'] as const) document.querySelector(`#review-${mode}`)!.addEventListener('click', () => { currentMode = mode; state = createFixture(mode); failNext = false; open(); });
document.querySelector('#review-refresh')!.addEventListener('click', () => { inventoryPanel.update(); log('无变化刷新已完成'); });
document.querySelector('#review-fail')!.addEventListener('click', () => { failNext = true; report(); });
document.querySelector('#review-empty')!.addEventListener('click', () => { currentMode = 'catalog'; state = { items: [], equipment: [{ id: 'weapon', label: '在手' }, { id: 'q', label: 'Q' }, { id: 'passive', label: '被动' }], weight: 0, capacity: 160 }; open(); });
state = createFixture('prepare');
open();
