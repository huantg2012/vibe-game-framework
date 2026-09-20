import assert from 'node:assert/strict';
import { generateRiftLayout } from '../../src/generation/rift-layout';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'zh-CN' } });
const { proceduralRiftIdentity, restoreProceduralLayout } = await import('../../src/managers/rift-recovery');
for (const seed of [432889249, 3036342668, 1, 17, 12918, 988299]) {
  const layout = generateRiftLayout(seed), identity = proceduralRiftIdentity(layout);
  assert.deepEqual(proceduralRiftIdentity(restoreProceduralLayout(identity)), identity);
  assert.throws(() => restoreProceduralLayout({ ...identity, signature: 'wrong' }));
  const { recipeId: _optionalLegacyHint, ...withoutRecipe } = identity;
  assert.equal(proceduralRiftIdentity(restoreProceduralLayout(withoutRecipe)).signature, identity.signature,
    'legacy recipe hint remains optional under its original contract');
}
console.log('PASS procedural identity: exact original retry/recipe selection, including seed 432889249; mismatch retained');
