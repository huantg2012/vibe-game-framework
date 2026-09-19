/** Isolated test input builder. Uses the real base load, beginRun, generator and
 * atomic departure transaction. It never reads or writes browser/user storage. */
import fs from 'node:fs';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { saveManager } = await import('../../src/managers/save-manager');
const { gameState } = await import('../../src/managers/game-state');
const { inventoryStore } = await import('../../src/systems/inventory-store');
const { generateRiftLayout } = await import('../../src/generation/rift-layout');
const { proceduralRiftIdentity, installProceduralRiftRecovery } = await import('../../src/managers/rift-recovery');
const [input, output, ...seedArgs] = process.argv.slice(2);
if (!input || !output || !seedArgs.length) throw new Error('Usage: prepare-rift-departures.ts prepared-base.json output.json seed...');
const source = JSON.parse(fs.readFileSync(input, 'utf8'));
const initial = source.record ?? source['coh-save-v1'] ?? source;
const initialBytes = typeof initial === 'string' ? initial : JSON.stringify(initial);
const records = new Map<string, string>();
saveManager.setStorage({ getItem: key => records.get(key) ?? null, setItem: (key, value) => { records.set(key, value); }, removeItem: key => { records.delete(key); } });
installProceduralRiftRecovery();
const results = [];
for (const arg of seedArgs) {
  const seed = Number(arg);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Expected a uint32 seed');
  records.set('coh-save-v1', initialBytes);
  if (!saveManager.load()) throw new Error('Input base is not readable');
  if (inventoryStore.getRun()?.status === 'active' || (inventoryStore.getRun() && !inventoryStore.getRun()!.baseSettled)) throw new Error('Input must be a prepared, settled base');
  const layout = generateRiftLayout(seed), identity = proceduralRiftIdentity(layout);
  const saved = saveManager.commitWorldTransaction(() => {
    const begun = inventoryStore.beginRun(`QA-admission-${seed}`);
    if (!begun.ok) throw new Error(`Cannot depart: ${begun.error}`);
    gameState.incrementCycle();
    saveManager.recordRiftDeparture({ version: 1, runId: inventoryStore.getRun()!.id, identity,
      conditions: { modifiers: gameState.getSortieModifiers(), cycle: gameState.getCycle() } });
  });
  if (!saved) throw new Error('Isolated fixture persistence failed');
  results.push({ seed, fragment: layout.fragmentTypeId, recipe: layout.recipeId,
    forms: layout.contaminationDraw.forms, raw: records.get('coh-save-v1')! });
}
fs.writeFileSync(output, JSON.stringify(results));
console.log(`Prepared ${results.length} actual procedural departures without runtime injection`);
