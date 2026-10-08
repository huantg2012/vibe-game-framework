import assert from 'node:assert/strict';
import { ChaosSystem } from '../../src/systems/chaos-system';
import { POLLUTION_GRADE_DEFINITIONS } from '../../src/generated/rift-pollution-grade-data';
import { isPollutionGradeDefinition, pollutionExposureBetween } from '../../src/generation/world-study/pollution-grade';

const frozen = structuredClone(POLLUTION_GRADE_DEFINITIONS.find(row => row.id === 'severe')!);
const altered = { ...frozen, chaosStartRate: .61, chaosEndRate: .91 };
assert(isPollutionGradeDefinition(altered));
const run = new ChaosSystem({ pollutionGrade: 'severe', pollutionDefinition: altered });
// Changing the caller's catalog object after departure cannot change this run.
altered.chaosStartRate = 1.4;
for (let i = 0; i < 600; i++) run.update(100);
const rules = { ...frozen, chaosStartRate: .61, chaosEndRate: .91 };
assert(Math.abs(run.getValue() - pollutionExposureBetween(rules, 0, 60)) < 1e-8);
const snapshot = run.exportRuntimeState(); run.destroy();
const restored = new ChaosSystem({ pollutionGrade: 'severe', pollutionDefinition: rules });
restored.restoreRuntimeState(snapshot);
for (let i = 0; i < 600; i++) restored.update(100);
assert(Math.abs(restored.getValue() - pollutionExposureBetween(rules, 0, 120)) < 1e-8);
restored.destroy();
assert.throws(() => new ChaosSystem({ pollutionGrade: 'low', pollutionDefinition: frozen }), /Incompatible/);
assert.throws(() => new ChaosSystem({ pollutionGrade: 'severe', pollutionDefinition: { ...frozen, chaosEndRate: NaN } }), /Incompatible/);
const legacy = new ChaosSystem();
assert(!Object.hasOwn(legacy.exportRuntimeState(), 'pollutionGrade'));
legacy.destroy();
console.log('Frozen pollution curves: caller mutation, cold resume, grade mismatch, invalid rate and legacy absence passed');
