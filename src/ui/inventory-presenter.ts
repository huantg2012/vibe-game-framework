/** Projects the one inventory owner into the shared base / field view. */
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { contaminantSystem } from '@/systems/contaminant-system';
import { inventoryStore } from '@/systems/inventory-store';
import { getBurdenSpeedFactor, getSurvivalAttributes } from '@/systems/survival-attributes';
import type { InventoryError, InventoryItem, InventoryResult } from '@/types/inventory-types';
import type { Vector2 } from '@/types/game-types';
import { getDefenseName, getRarityStars, getToolName } from './contaminant-names';
import { inventoryPanel, type InventoryPanelAction, type InventoryPanelActionResult, type InventoryPanelItem, type InventoryPanelMode, type InventoryPanelSnapshot } from './dom/inventory-panel';

const ERRORS: Record<InventoryError, string> = {
  'invalid-item': '这件物品已不可用。', 'duplicate-id': '同一件物品只能选择一次。',
  'wrong-location': '物品位置已变化，请重新选择。', equipped: '本趟已装配的物品不能卸下。',
  incompatible: '这件物品不能放在这个位置。', overweight: '超过负重上限，请减少携带。',
  'run-active': '本次出击尚未结算。', 'no-active-run': '本次出击已结束。',
  'invalid-ground': '物品已不在可取范围内，或这里无法放下物品。',
  'storage-failed': '未能保存，本次操作没有生效。请释放按键后重试。',
  'missing-weapon': '请先装上一把撬棍。',
};
export function inventoryError(error: InventoryError): string { return ERRORS[error]; }

export interface InventoryPresenterOptions {
  mode: InventoryPanelMode;
  onClose: () => void;
  onDepart?: () => void;
  /** Navigation only; offering remains owned by the purification scene. */
  onOffering?: () => void;
  getNearby?: () => readonly InventoryItem[];
  getDropPosition?: () => Vector2;
  canTake?: (item: InventoryItem) => boolean;
  canDrop?: (position: Vector2) => boolean;
  onTaken?: (ids: readonly string[]) => void;
}

function itemView(item: InventoryItem, mode: InventoryPanelMode): InventoryPanelItem {
  const eq = inventoryStore.getEquipment();
  const slot = eq.toolIds.indexOf(item.id);
  const equippedLabel = eq.weaponId === item.id ? '在手' : slot >= 0 ? (slot === contaminantSystem.getSortiePassiveSlotIndex() ? '被动挂位' : `工具 ${GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS[slot] ?? slot + 1}`) : undefined;
  const common = { id: item.id, kind: item.kind, weight: inventoryStore.getWeight(item), location: item.location.kind, equippedLabel };
  if (item.kind === 'weapon') {
    const def = WEAPON_DATA[item.weapon.definitionId];
    const held = inventoryStore.getItems().find(value => value.id === eq.weaponId);
    const current = held?.kind === 'weapon' ? WEAPON_DATA[held.weapon.definitionId] : undefined;
    const comparing = !!current && held?.id !== item.id;
    const damage = def ? `${def.damageMin}–${def.damageMax}` : '—';
    const stats: InventoryPanelItem['stats'] = [
      { label: '品质', value: def?.qualityName ?? '—', comparison: comparing ? current.qualityName : undefined },
      { label: '构造', value: def ? { standard: '标准', light: '轻型', resistant: '抗污' }[def.variant] : '—' },
      { label: '伤害', value: damage, comparison: comparing ? `${current.damageMin}–${current.damageMax}` : undefined },
      { label: '污染抗性', value: `${def?.pollutionResistance ?? 0}%`, comparison: comparing ? `${current.pollutionResistance}%` : undefined },
      { label: '负重', value: (common.weight / 10).toFixed(1), comparison: comparing ? (current.weight / 10).toFixed(1) : undefined },
    ];
    const preview = mode !== 'rift' && comparing && ['stash', 'carried'].includes(item.location.kind)
      ? inventoryStore.getCarryWeight() - (held?.location.kind === 'carried' ? inventoryStore.getWeight(held) : 0) + (item.location.kind === 'carried' ? 0 : common.weight) : undefined;
    return { ...common, name: def?.name ?? '未识别武器', quality: def?.qualityName,
      icon: def ? `/assets/weapons/crowbars/${def.id}-icon.png` : undefined,
      description: mode === 'rift' ? '回到净化点可装配。每次挥击在伤害区间内浮动。' : '每次挥击在伤害区间内浮动。撬棍不可升级。',
      stats,
      preview: preview === undefined ? undefined : `装配后负重 ${(preview / 10).toFixed(1)} / ${(inventoryStore.getCapacity() / 10).toFixed(1)} · 移动 −${Math.round((1 - getBurdenSpeedFactor(preview, inventoryStore.getCapacity())) * 100)}%`,
    };
  }
  const c = item.contaminant;
  const count = contaminantSystem.getSortieSlotCount();
  const passive = CONTAMINANT_DATA[c.type]?.toolType === 'passive';
  const toolSlots = c.stage === 'tool' && c.usesRemaining > 0
    ? Array.from({ length: count }, (_, i) => i).filter(i => passive === (i === count - 1)).map(String) : [];
  return { ...common, name: c.stage === 'tool' ? getToolName(c.type) : getDefenseName(c.type), quality: getRarityStars(c.rarity), toolSlots, canOffer: c.stage === 'defense' && item.location.kind === 'stash',
    description: c.stage === 'tool' ? '在净化点装入工具挂位，出击期间保持装配。' : c.stage === 'broken' ? '已耗尽。' : '带回净化点，可在供奉台投入防御。',
    stats: c.stage === 'tool' ? [{ label: '剩余次数', value: c.usesRemaining }] : [{ label: '阶段', value: c.stage === 'broken' ? '已耗尽' : '残渣' }, { label: '冲击蓄积', value: c.impactCharges }] };
}

function snapshot(options: InventoryPresenterOptions): InventoryPanelSnapshot {
  const eq = inventoryStore.getEquipment();
  const nearby = new Set(options.getNearby?.().map(item => item.id));
  const count = contaminantSystem.getSortieSlotCount();
  const weight = inventoryStore.getCarryWeight();
  const capacity = inventoryStore.getCapacity();
  const reason = inventoryStore.getRun()?.status === 'active' ? '本次出击尚未结算。'
    : !eq.weaponId ? '请先装上一把撬棍。' : weight > capacity ? '出发负重超过上限。' : '';
  return {
    items: inventoryStore.getItems().filter(item => options.mode === 'rift'
      ? item.location.kind === 'carried' || nearby.has(item.id)
      : item.location.kind !== 'ground').map(item => itemView(item, options.mode)),
    equipment: [{ id: 'weapon', label: '在手', itemId: eq.weaponId, locked: options.mode === 'rift' },
      ...Array.from({ length: count }, (_, i) => ({ id: String(i), label: i === count - 1 ? '被动' : `工具 ${GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS[i] ?? i + 1}`, itemId: eq.toolIds[i], locked: options.mode === 'rift' }))],
    weight, capacity, survival: getSurvivalAttributes(), canDepart: !reason, departReason: reason,
  };
}

function act(action: InventoryPanelAction, options: InventoryPresenterOptions): InventoryPanelActionResult {
  if (action.type === 'inspect') return { ok: true };
  let result: InventoryResult;
  const pos = options.getDropPosition?.() ?? { x: 0, y: 0 };
  const canTake = options.canTake ?? (() => false);
  const canDrop = options.canDrop ?? (() => false);
  const field = options.mode === 'rift';
  if (!field && action.type === 'equipWeapon') result = inventoryStore.prepareWeapon(action.itemId);
  else if (!field && action.type === 'equipTool') result = inventoryStore.prepareTool(action.itemId, Number(action.slotId));
  else if (!field && action.type === 'discard') result = inventoryStore.discardAtBase(action.itemId);
  else if (!field && action.type === 'unequipTool') result = inventoryStore.prepareTool(null, Number(action.slotId));
  else if (field && action.type === 'take') result = inventoryStore.take(action.itemIds, canTake);
  else if (field && action.type === 'drop') result = inventoryStore.drop(action.itemIds, pos, canDrop);
  else if (field && action.type === 'exchange') result = inventoryStore.exchange(action.takeIds, action.dropIds, pos, { canTake, canDrop });
  else return { ok: false, message: '这里不能执行这项操作。' };
  if (!result.ok) return { ok: false, message: inventoryError(result.error) };
  contaminantSystem.syncInventoryDerivedState();
  if (action.type === 'take') options.onTaken?.(action.itemIds);
  if (action.type === 'exchange') options.onTaken?.(action.takeIds);
  return { ok: true, message: action.type === 'discard' ? '物件已永久丢弃，没有返还。' : undefined };
}

export function openInventory(options: InventoryPresenterOptions): void {
  // Close before subscribing so replacing one panel cannot retain its listener.
  inventoryPanel.close();
  let unsubscribe: (() => void) | undefined;
  inventoryPanel.open({ ...options, getSnapshot: () => snapshot(options), onAction: action => act(action, options),
    onClose: () => { unsubscribe?.(); unsubscribe = undefined; options.onClose(); },
  });
  unsubscribe = inventoryStore.subscribe(() => inventoryPanel.update());
}
