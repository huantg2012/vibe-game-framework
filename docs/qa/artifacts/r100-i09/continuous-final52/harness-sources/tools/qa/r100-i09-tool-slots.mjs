/** QA consumes public runtime bindings; no hardcoded active count or passive index. */
import assert from 'node:assert/strict';

export function toolSlots(owned) {
  const slots = owned.toolSlots;
  assert(Array.isArray(slots) && slots.length >= 2, 'public runtime tool bindings required');
  const keys = new Set();
  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];
    assert.equal(slot.index, index); assert.equal(slot.id, String(index));
    if (index === slots.length - 1) {
      assert.equal(slot.key, null, 'last open slot is passive'); assert.equal(slot.label, '被动');
    } else {
      assert.equal(typeof slot.key, 'string'); assert.match(slot.key, /^[A-Z]$/);
      assert(!keys.has(slot.key), 'active keys must be distinct'); keys.add(slot.key);
      assert.equal(slot.label, `工具 ${slot.key}`);
    }
  }
  return slots;
}

export function activeToolSlots(owned) {
  return toolSlots(owned).filter(slot => slot.key !== null);
}

/** Same first eligible owned-item order as policy13, across all actual open slots. */
export function planOwnedToolEquipment(owned) {
  const occupied = new Set(owned.equipment.toolIds.filter(Boolean)), choices = [];
  for (const slot of toolSlots(owned)) {
    if (owned.equipment.toolIds[slot.index]) continue;
    const item = owned.items.find(candidate => candidate.kind === 'contaminant' && candidate.canEquip
      && candidate.toolSlots?.includes(slot.id) && !occupied.has(candidate.id));
    if (!item) continue;
    occupied.add(item.id); choices.push({ slot: slot.id, label: slot.label, id: item.id });
  }
  return choices;
}
