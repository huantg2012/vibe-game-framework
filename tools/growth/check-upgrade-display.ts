/** Player-facing growth contracts: cumulative effects, purchase deltas and knowledge boundaries. */
import assert from 'node:assert/strict';
import { GROWTH_UPGRADE_DISPLAY, formatGrowthLevel } from '../../src/config/growth-upgrade-display';
import { UPGRADE_DATA } from '../../src/generated/upgrade-data';
import { growthSystem } from '../../src/systems/growth-system';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import type { GrowthUpgradeId } from '../../src/types/game-types';

function display(id: GrowthUpgradeId) {
  const found = GROWTH_UPGRADE_DISPLAY.find(item => item.id === id);
  assert(found, `Missing player-facing growth definition: ${id}`);
  return found;
}
function applyLevel(id: GrowthUpgradeId, level: number): void {
  growthSystem.reset();
  const state = growthSystem.getState();
  state.upgrades[id] = level;
  growthSystem.loadState(state);
}

assert.equal(formatGrowthLevel(0), '未刻入');
for (let level = 1; level <= 5; level++) assert.equal(formatGrowthLevel(level), `Level ${level}`);
for (const item of GROWTH_UPGRADE_DISPLAY) {
  const maxLevel = UPGRADE_DATA[item.id].maxLevel;
  for (let level = 0; level <= maxLevel; level++) {
    const owned = item.effectPreview(level);
    assert(owned.label && owned.value);
    assert.equal(owned.gain, undefined, 'An owned effect must not advertise an unpurchased gain');
    assert.equal(owned.currentValue, undefined, 'A read-only effect has no upgrade transition');
    if (level > 0) assert(!item.effectLabel(level, maxLevel).includes('→'), 'Legacy readouts must not reveal the next route step');
  }
}
console.log('PASS explicit Level labels and read-only acquired effects for all six axes');

const vitality = display('growth_vitality');
for (const [level, expected] of [100, 115, 130, 145, 160].entries()) {
  applyLevel('growth_vitality', level);
  assert.equal(vitality.effectPreview(level).value, String(expected));
  assert.equal(100 + growthSystem.getModifiers().vitalityBonus, expected);
  if (level === 0) continue;
  const next = vitality.effectPreview(level - 1, level);
  assert.equal(next.value, String(expected));
  assert.equal(next.currentValue, String(expected - 15));
  assert.equal(next.gain, '完整度上限 +15');
  assert.equal(next.label, '自身完整度上限');
  assert.match(next.flavor!, /厌恶污染覆盖/);
  assert.match(next.note!, /不改变装置完整度/);
}
assert(!vitality.effectLabel(0, 4).includes('延缓覆盖'));
console.log('PASS vitality identifies personal maximum integrity and separates flavor, total and this purchase');

const resistance = display('growth_chaos_resist');
for (const [level, reduction] of [0, 4, 8, 12, 16, 20].entries()) {
  applyLevel('growth_chaos_resist', level);
  assert.equal(resistance.effectPreview(level).value, `减缓 ${reduction}%`);
  assert.equal(Math.round(growthSystem.getModifiers().chaosResist * 100), reduction);
  assert.match(resistance.effectPreview(level).note!, /随时间积累.*不改变起始混乱/);
  if (level > 0) assert.equal(resistance.effectPreview(level - 1, level).gain,
    level === 1 ? '自然混乱增速减缓 4%' : '自然混乱增速再减缓 4 个百分点');
}
const affinity = display('growth_kindling_affinity');
for (let level = 0; level <= 3; level++) {
  applyLevel('growth_kindling_affinity', level);
  assert.equal(affinity.effectPreview(level).value, `+${growthSystem.getModifiers().kindlingAffinity}`);
  if (level > 0) assert.equal(affinity.effectPreview(level - 1, level).gain, '每堆基础额外薪柴 +1');
  assert.match(affinity.effectPreview(level).note!, /再受储藏效能影响/);
}
console.log('PASS resistance uses percentage points for repeat purchases; affinity separates +1 from its accumulated bonus');

const offering = display('growth_defense_slot');
for (const [level, capacity] of [1, 2, 3, 4].entries()) {
  applyLevel('growth_defense_slot', level);
  assert.equal(contaminantSystem.getDefenseSlotCount(), capacity);
  assert.equal(offering.effectPreview(level).value, `${capacity} 件`);
  if (level > 0) assert.equal(offering.effectPreview(level - 1, level).gain, '可多供奉 1 件物品');
  assert.match(offering.effectPreview(level).note!, /成熟速度不变/);
}
const sortie = display('growth_sortie_slot');
for (const [level, activeCount] of [2, 3].entries()) {
  applyLevel('growth_sortie_slot', level);
  assert.equal(contaminantSystem.getSortieActiveSlotCount(), activeCount);
  assert.equal(sortie.effectPreview(level).value, `${activeCount} 位`);
  assert.match(sortie.effectPreview(level).note!, /被动工具仍为 1 位.*重量照常计入/);
}
assert.equal(sortie.effectPreview(0, 1).gain, '可多携带 1 件主动工具');
console.log('PASS capacity descriptions agree with actual offering and active/passive loadout slots');

const forecast = display('growth_forecast_clarity');
const unknown = JSON.stringify(forecast.effectPreview(0));
assert.match(unknown, /可能误报/);
assert(!/准确|供奉前压力/.test(unknown));
const first = JSON.stringify(forecast.effectPreview(1));
assert.match(first, /准确强度/);
assert(!/重点装置|供奉前压力/.test(first));
const second = JSON.stringify(forecast.effectPreview(2));
assert.match(second, /准确强度/);
assert.match(second, /重点装置/);
assert(!second.includes('供奉前压力'));
const third = JSON.stringify(forecast.effectPreview(3));
for (const ability of ['准确强度', '重点装置', '供奉前压力']) assert(third.includes(ability));
assert.equal(forecast.effectPreview(1, 2).gain, '辨清下次冲击的重点装置');
assert.equal(forecast.effectPreview(2, 3).gain, '读取下次各装置的供奉前压力');
assert.equal(forecast.effectPreview(2, 3).currentValue, undefined, 'Qualitative upgrades should not repeat earlier abilities in an arrow comparison');
assert.equal(forecast.effectPreview(2, 3).label, '刻入后可辨明');
assert.equal(forecast.effectPreview(3).label, '现已辨明');
growthSystem.reset();
console.log('PASS forecast knowledge remains cumulative without exposing later layers in owned readouts');
