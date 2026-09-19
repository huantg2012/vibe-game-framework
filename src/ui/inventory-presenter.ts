import { catalogIconUrl } from '@/art/contaminant-catalog-icons';
import { getContaminantQualityName, getContaminantQualityRank, getContaminantMaxUses, supportsContaminantQuality } from '@/systems/contaminant-quality';
/** Projects the one inventory owner into the shared base / field view. */
import { GAME_CONSTANTS } from '@/config/constants';
import { projectItemForPlayer, projectDiscoveredCatalogItems } from '@/systems/contaminant-catalog';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { contaminantSystem } from '@/systems/contaminant-system';
import { inventoryStore } from '@/systems/inventory-store';
import { itemIconUrl, itemStageLabel } from './contaminant-presentation';
import { getSurvivalAttributes, sumPollutionResistance } from '@/systems/survival-attributes';
import type { InventoryError, InventoryItem, InventoryResult } from '@/types/inventory-types';
import type { Vector2 } from '@/types/game-types';
import { getRarityStars } from './contaminant-names';
import { inventoryPanel, type InventoryPanelAction, type InventoryPanelActionResult, type InventoryPanelItem, type InventoryPanelMode, type InventoryPanelSnapshot } from './dom/inventory-panel';

const ERRORS: Record<InventoryError, string> = {
  'duplicate-action': '这项操作已经完成。',
  'invalid-item': '这件物品已不可用。', 'duplicate-id': '同一件物品只能选择一次。',
  'wrong-location': '物品位置已变化，请重新选择。', equipped: '本趟已装配的物品不能卸下。',
  incompatible: '这件物品不能放在这个位置。', overweight: '超过负重上限，请减少携带。',
  'run-active': '本次出击尚未结算。', 'no-active-run': '本次出击已结束。',
  'invalid-ground': '物品已不在可取范围内，或这里无法放下物品。',
  'storage-failed': '未能保存，本次操作没有生效。请释放按键后重试。',
  'not-ready': '尚未成熟，请先到供奉台承受冲击。',
  'missing-weapon': '请先装上一把撬棍。',
};
export function inventoryError(error: InventoryError): string { return ERRORS[error]; }

export interface InventoryPresenterOptions {
  mode: InventoryPanelMode;
  onClose: () => void;
  onDepart?: () => void;
  /** Navigation only; offering remains owned by the purification scene. */
  onOffering?: () => void;
  mount?: HTMLElement;
  portrait?: string;
  getPollutionResistanceBonus?: () => number;
  getNearby?: () => readonly InventoryItem[];
  getDropPosition?: () => Vector2;
  canTake?: (item: InventoryItem) => boolean;
  canDrop?: (position: Vector2) => boolean;
  onTaken?: (ids: readonly string[]) => void;
  afterMutation?: () => Promise<void>;
}

export function projectInventoryItem(item: InventoryItem, mode: InventoryPanelMode): InventoryPanelItem {
  const eq = inventoryStore.getEquipment();
  const slot = eq.toolIds.indexOf(item.id);
  const equippedLabel = eq.weaponId === item.id ? '在手' : slot >= 0 ? (slot === contaminantSystem.getSortiePassiveSlotIndex() ? '被动挂位' : `工具 ${GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS[slot] ?? slot + 1}`) : undefined;
  const lifecycle = item.kind === 'weapon' ? item.weapon : item.contaminant;
  const canEquip = lifecycle.stage === 'tool' && lifecycle.usesRemaining > 0;
  const common = { id: item.id, kind: item.kind, weight: inventoryStore.getWeight(item), location: item.location.kind, equippedLabel, canEquip, usesRemaining: lifecycle.stage === 'tool' ? lifecycle.usesRemaining : undefined, stageLabel: lifecycle.stage === 'tool' ? '已成熟' : '未成熟', canOffer: lifecycle.stage === 'defense' && item.location.kind === 'stash' };
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
      ...(mode === 'rift' ? [{ label: '负重', value: (common.weight / 10).toFixed(1), comparison: comparing ? (current.weight / 10).toFixed(1) : undefined }] : []),
      ...(lifecycle.stage === 'tool' ? [] : [{ label: '供奉积累', value: `${lifecycle.impactCharges} / ${def?.offeringCharges ?? '—'}` }]),
    ];
    return { ...common, name: def?.name ?? '未识别武器', quality: def?.qualityName, qualityRank: def?.qualityRank, maxDurability: def?.maxUses,
      icon: def ? `/assets/weapons/crowbars/${def.id}-icon.png` : undefined,
      description: canEquip ? '已完成供奉。每次有效命中消耗 1 点耐久度，同次挥击只扣一次，空挥不消耗；耐久归零后损坏。伤害在区间内浮动。' : '尚未成熟。带回后在供奉台承受冲击，再装配出击。',
      stats,

    };
  }
  const c = item.contaminant, view = projectItemForPlayer(c);
  const count = contaminantSystem.getSortieSlotCount();
  const passive = view.slot === 'passive', unknown = view.identification === 'unidentified';
  const toolSlots = canEquip && view.slot
    ? Array.from({ length: count }, (_, i) => i).filter(i => passive === (i === count - 1)).map(String) : [];
  const qualityName = supportsContaminantQuality(c.type) ? getContaminantQualityName(c) : getRarityStars(c.rarity);
  const maxUses = view.maxUses ?? (unknown || view.inert ? 0 : getContaminantMaxUses(c));
  return { ...common, name: view.name, stageLabel: itemStageLabel(c),
    quality: view.inert ? undefined : unknown ? `结构保持性 · ${qualityName}` : qualityName,
    qualityRank: view.inert ? 0 : getContaminantQualityRank(c), toolSlots, icon: itemIconUrl(c),
    usesRemaining: view.usesRemaining, canEquip: canEquip && !view.inert, canOffer: common.canOffer && !view.inert,
    description: view.inert ? `${view.summary} 可留存或丢弃，不能携入裂隙。` : unknown ? `供奉：${view.offeringSummary} 完成供奉后，揭晓真实物件及裂隙能力。` : view.summary,
    explanations: [{ label: unknown ? '供奉说明' : '物件说明', text: view.description }],
    stats: [
      ...(view.inert ? [] : [{ label: unknown ? '结构保持性' : '品质', value: qualityName }]),
      ...(unknown || c.stage === 'defense' ? [{ label: '供奉积累', value: `${view.impactCharges} / ${view.offeringCharges}` }]
        : view.inert ? [] : [{ label: '类型', value: passive ? '整趟被动' : '主动' },
          { label: passive ? '剩余趟数' : '余次', value: `${view.usesRemaining ?? 0} / ${maxUses}${c.catalog?.runBinding ? ' · 本趟已生效' : ''}` }]),
    ],
  };
}

function snapshot(options: InventoryPresenterOptions): InventoryPanelSnapshot {
  const eq = inventoryStore.getEquipment();
  const nearby = new Set(options.getNearby?.().map(item => item.id));
  const count = contaminantSystem.getSortieSlotCount();
  const weight = inventoryStore.getCarryWeight();
  const capacity = inventoryStore.getCapacity();
  const misplaced = eq.toolIds.flatMap((id, index) => {
    const item = id ? inventoryStore.getItem(id) : undefined;
    if (item?.kind !== 'contaminant') return [];
    const view = projectItemForPlayer(item.contaminant);
    return (view.slot === 'passive') !== (index === count - 1) ? [`${view.name}需放入${view.slot === 'passive' ? '被动' : '主动'}挂位`] : [];
  });
  const reason = inventoryStore.getRun()?.status === 'active' ? '本次出击尚未结算。'
    : !eq.weaponId ? '请先装上一把已成熟的撬棍。' : misplaced.length ? `${misplaced.join('；')}。` : '';
  const carriedOut = new Set(inventoryStore.getRun()?.carriedOutIds ?? []);
  const survival = getSurvivalAttributes();
  return {
    discoveries: options.mode === 'catalog' ? projectDiscoveredCatalogItems(inventoryStore.getDiscoveredCatalogIds()).map(view => ({
      id: `discovery:${view.definitionId}`, kind: 'contaminant' as const, discovery: true, name: view.name,
      weight: 0, location: 'stash' as const, description: view.summary,
      stageLabel: view.inert ? '无裂隙能力' : view.slot === 'passive' ? '整趟被动' : '主动',
      icon: catalogIconUrl({ kind: 'item', definitionId: view.iconId }), canEquip: false, canOffer: false,
    })) : undefined,
    items: inventoryStore.getItems().filter(item => options.mode === 'rift'
      ? (item.location.kind === 'carried' && !carriedOut.has(item.id) && !inventoryStore.isEquipped(item.id)) || nearby.has(item.id)
      : item.location.kind !== 'ground').map(item => projectInventoryItem(item, options.mode)),
    equipment: options.mode === 'rift' ? [] : [{ id: 'weapon', label: '在手', itemId: eq.weaponId, locked: false },
      ...Array.from({ length: count }, (_, i) => ({ id: String(i), label: i === count - 1 ? '被动' : `工具 ${GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS[i] ?? i + 1}`, itemId: eq.toolIds[i], locked: false }))],
    equippedWeight: inventoryStore.getItems().reduce((sum, item) => sum + (item.location.kind === 'carried' && carriedOut.has(item.id) ? inventoryStore.getWeight(item) : 0), 0),
    weight, capacity, survival: { ...survival, resistancePercent: sumPollutionResistance([survival.resistancePercent, options.getPollutionResistanceBonus?.() ?? 0]) }, canDepart: !reason, departReason: reason,
  };
}

function act(action: InventoryPanelAction, options: InventoryPresenterOptions): InventoryPanelActionResult {
  if (action.type === 'inspect') return { ok: true };
  let result: InventoryResult;
  const pos = options.getDropPosition?.() ?? { x: 0, y: 0 };
  const canTake = options.canTake ?? (() => false);
  const canDrop = options.canDrop ?? (() => false);
  const field = options.mode === 'rift';
  if (options.mode === 'prepare' && action.type === 'equipWeapon') result = inventoryStore.prepareWeapon(action.itemId);
  else if (options.mode === 'prepare' && action.type === 'equipTool') result = inventoryStore.prepareTool(action.itemId, Number(action.slotId));
  else if (options.mode === 'catalog' && action.type === 'discard') result = inventoryStore.discardAtBase(action.itemId);
  else if (options.mode === 'prepare' && action.type === 'unequipTool') result = inventoryStore.prepareTool(null, Number(action.slotId));
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
  inventoryPanel.open({ ...options, getSnapshot: () => snapshot(options), onAction: action => {
    const result = act(action, options);
    return result.ok && options.afterMutation ? options.afterMutation().then(() => result) : result;
  },
    onClose: () => { unsubscribe?.(); unsubscribe = undefined; options.onClose(); },
  });
  unsubscribe = inventoryStore.subscribe(() => inventoryPanel.update());
}
