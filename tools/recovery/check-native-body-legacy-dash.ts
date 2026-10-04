/** A genuine old Chrome Q -> Esc save, never fabricated player movement. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nativeRiftPlayerForRestore } from '../../src/systems/native-rift-body-recovery';
import { nativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { validateProceduralRiftAdmission, restoreProceduralWorld } = await import('../../src/managers/rift-recovery');
const bytes = readFileSync('docs/qa/artifacts/r100-i03/native-body-fix/legacy-dash-save/actual-old-save.json', 'utf8');
const record = JSON.parse(bytes), original = structuredClone(record);
const cp = record.riftCheckpoint, inventory = record.inventory;
assert(validateProceduralRiftAdmission(cp, inventory), 'real old paid in-flight dash remains admissible');
const world = restoreProceduralWorld(cp.identity)!;
const collision = nativeBodyCollision(world.native!, world.layout);
const normalized = nativeRiftPlayerForRestore(cp.state, collision)!;
assert(normalized && normalized !== cp.state.player);
assert.deepEqual(normalized, { ...cp.state.player, bodyPosition: { x: cp.state.player.position.x - 10, y: cp.state.player.position.y - 10 } });
assert.deepEqual(record, original, 'admission and restore transform cannot mutate source or inventory');
const canonical = structuredClone(cp); canonical.state.player = normalized; canonical.state.world.bodyGeometryVersion = 1;
assert(validateProceduralRiftAdmission(canonical, inventory));
assert.equal(nativeRiftPlayerForRestore(canonical.state, collision), normalized, 'new complete states have no migration copy');
let checks = 4;
function reject(name: string, mutate: (checkpoint: any) => void) {
  const candidate = structuredClone(cp); mutate(candidate);
  assert(!validateProceduralRiftAdmission(candidate, inventory), name); checks++;
}
reject('new marker cannot use legacy reset convention', c => { c.state.world.bodyGeometryVersion = 1; });
reject('unknown body convention rejects', c => { c.state.world.bodyGeometryVersion = 2; });
reject('null marker is not absent', c => { c.state.world.bodyGeometryVersion = null; });
reject('arbitrary offset is not old reset', c => { c.state.player.bodyPosition.x += .01; });
reject('non-dash offset is not migrated', c => { c.state.tools.catalog.effects = []; });
reject('finished dash is not an active dash', c => { c.state.tools.catalog.effects[0].remainingTime = 0; });
reject('nonzero velocity is not reset state', c => { c.state.player.velocity.x = 1; });
reject('nonzero input is not locked dash', c => { c.state.player.inputVector.y = 1; });
reject('input enabled is not locked dash', c => { c.state.player.inputEnabled = true; });
reject('moving is not reset state', c => { c.state.player.moving = true; });
reject('progress cannot be changed independently', c => { c.state.tools.catalog.effects[0].position.x += 1; });
reject('unpaid action rejects', c => { c.state.tools.catalog.completedActions = []; });
reject('invalid full body cannot migrate', c => {
  const p = c.state.player, d = c.state.tools.catalog.effects[0], dx = 5 - p.position.x, dy = 5 - p.position.y;
  for (const v of [p.position, p.bodyPosition, d.origin, d.position]) { v.x += dx; v.y += dy; }
});
assert.equal(readFileSync('docs/qa/artifacts/r100-i03/native-body-fix/legacy-dash-save/actual-old-save.json', 'utf8'), bytes);
console.log(JSON.stringify({ ok: true, checks, world: cp.identity.generation.nativeDefinition.id, originalOffset: -6, bodyOnlyCorrection: 6 }));
