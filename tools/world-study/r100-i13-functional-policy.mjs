/** Eligibility precedes FIFO: an insufficient earlier item must not prevent
 * a genuinely owned, publicly revealed preparation from satisfying its budget.
 * This revision is separate from the immutable 14-sortie continuation policy.
 */
import assert from 'node:assert/strict';
import { publicAbility } from './r100-i13-continuation-policy.mjs';
export { publicAbility, sameRoute, relevantRemembered } from './r100-i13-continuation-policy.mjs';

export function chooseOwnedPreparation(owned, slot, preparation, freshOrder) {
  const rule = slot.key === null ? preparation.passive : preparation.active[slot.index];
  if (!rule) return null;
  const candidates = owned.items.filter(item => {
    if (item.kind !== 'contaminant' || !item.canEquip || !item.toolSlots?.includes(slot.id)) return false;
    if ((item.usesRemaining ?? 0) < (rule.minimumUses ?? 1)) return false;
    if (rule.name) return item.name === rule.name;
    const ability = publicAbility(item);
    return ability?.family === rule.family && ability.power >= (rule.minimumPower ?? 0);
  });
  candidates.sort((a, b) => (freshOrder.get(a.id) ?? Infinity) - (freshOrder.get(b.id) ?? Infinity));
  return candidates[0] ?? null;
}

export function checkFunctionalSelection() {
  const slot = { index: 0, id: 'active', key: 'Q' };
  const item = (id, usesRemaining, description = '探查4格内目标位置', canEquip = true) =>
    ({ id, kind: 'contaminant', canEquip, usesRemaining, description, toolSlots: ['active'] });
  const owned = { items: [item('old-ready', 6), item('first-fresh-low', 1), item('second-fresh-ready', 3), item('third-fresh-ready', 4)] };
  const freshOrder = new Map([['first-fresh-low', 0], ['second-fresh-ready', 1], ['third-fresh-ready', 2]]);
  const preparation = { active: [{ family: 'survey', minimumPower: 128, minimumUses: 2 }], passive: null };
  assert.equal(chooseOwnedPreparation(owned, slot, preparation, freshOrder)?.id, 'second-fresh-ready');
  assert.equal(chooseOwnedPreparation({ items: [item('one', 1), item('another-one', 1)] }, slot, preparation, freshOrder), null, 'Two single uses do not make one prepared item');
  assert.equal(chooseOwnedPreparation({ items: [item('weak', 4, '探查3格内目标位置'), item('hidden', 6, '供奉完成后揭晓'), item('unavailable', 9, '探查4格内目标位置', false)] }, slot, preparation, freshOrder), null);
  assert.equal(chooseOwnedPreparation({ items: [item('old-ready', 2)] }, slot, preparation, freshOrder)?.id, 'old-ready');
  const dash = { active: [{ family: 'dash', minimumPower: 48, minimumUses: 3 }], passive: null };
  assert.equal(chooseOwnedPreparation({ items: [item('depleted-boot', 2, '沿可走地面短冲48像素'), item('ready-spindle', 3, '沿可走地面短冲96像素')] }, slot, dash, new Map())?.id, 'ready-spindle');
  return { status: 'pass', scope: 'Public family, power and single-item uses eligibility before fresh FIFO; hidden/unavailable/insufficient candidates excluded; no aggregation' };
}

if (process.argv[1]?.endsWith('r100-i13-functional-policy.mjs') && process.argv.includes('--self-check')) console.log(JSON.stringify(checkFunctionalSelection()));
