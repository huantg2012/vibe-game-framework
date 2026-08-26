/**
 * I5-D machine gate: 夹具上七个违规算子 + 预算 1/3/5。
 * 渗透 / 改写抽到放射 → FAIL；覆盖档可以放射。
 * 算子后 weld 可见身体四连通分量必须为 1。不用 IoU。
 *
 *   npm run check:jia-operators
 */
import { SeededRandom } from '../../src/utils/random.ts';
import { buildFixtureSkeleton } from '../../src/entities/form-renderers/d/genome/fixture.ts';
import {
  OPERATOR_IDS,
  applyNamedOperator,
  applyOperators,
  operatorBudget,
  operatorPool,
  pickOperators,
  radiateAllowed,
} from '../../src/entities/form-renderers/d/genome/operators.ts';
import { countOpaquePixels } from '../../src/entities/form-renderers/d/genome/parts.ts';
import { countOpaque4Components, paintWeldedBody } from '../../src/entities/form-renderers/d/genome/weld.ts';
import type { CoverageId } from '../../src/generated/contamination-lexicon-data.ts';

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed += 1;
  console.error(`FAIL ${msg}`);
}

assert(OPERATOR_IDS.length === 7, `operator count ${OPERATOR_IDS.length} want 7`);
assert(OPERATOR_IDS.includes('quantity'), 'quantity operator present');
assert(OPERATOR_IDS.includes('symmetry'), 'symmetry operator present');
assert(OPERATOR_IDS.includes('hierarchy'), 'hierarchy operator present');
assert(OPERATOR_IDS.includes('graft'), 'graft operator present');
assert(OPERATOR_IDS.includes('facing'), 'facing operator present');
assert(OPERATOR_IDS.includes('scale'), 'scale operator present');
assert(OPERATOR_IDS.includes('radiate'), 'radiate operator present');

assert(operatorBudget('infiltrate') === 1, 'infiltrate budget 1');
assert(operatorBudget('rewrite') === 3, 'rewrite budget 3');
assert(operatorBudget('overwrite') === 5, 'overwrite budget 5');

assert(!radiateAllowed('infiltrate'), 'infiltrate must not unlock radiate');
assert(!radiateAllowed('rewrite'), 'rewrite must not unlock radiate');
assert(radiateAllowed('overwrite'), 'overwrite unlocks radiate');

assert(
  !operatorPool('infiltrate').includes('radiate'),
  'infiltrate pool must not contain radiate',
);
assert(!operatorPool('rewrite').includes('radiate'), 'rewrite pool must not contain radiate');
assert(operatorPool('overwrite').includes('radiate'), 'overwrite pool contains radiate');
assert(operatorPool('overwrite').length === 7, 'overwrite pool is all seven operators');
assert(operatorPool('infiltrate').length === 6, 'infiltrate pool is six (no radiate)');

const coverages: readonly CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];
const seeds = Array.from({ length: 48 }, (_, i) => i);

let overwriteSawRadiate = false;
for (const coverage of coverages) {
  const budget = operatorBudget(coverage);
  for (const seed of seeds) {
    const picked = pickOperators(coverage, seed);
    assert(picked.length === budget, `${coverage} seed ${seed} picked ${picked.length} want ${budget}`);
    const unique = new Set(picked);
    assert(unique.size === picked.length, `${coverage} seed ${seed} picked duplicate operators`);
    if (coverage === 'infiltrate' || coverage === 'rewrite') {
      if (picked.includes('radiate')) {
        assert(false, `${coverage} seed ${seed} drew radiate (must be unavailable, not grey radiate)`);
      }
    } else if (picked.includes('radiate')) {
      overwriteSawRadiate = true;
    }

    const sk = buildFixtureSkeleton(coverage, seed);
    const applied = applyOperators(sk, coverage, seed);
    assert(
      applied.join(',') === picked.join(','),
      `${coverage} seed ${seed} apply/pick mismatch`,
    );
    const buf = paintWeldedBody(sk);
    const n = countOpaque4Components(buf);
    assert(n === 1, `${coverage} seed ${seed} after operators weld 4-connected components ${n} want 1`);
    assert(countOpaquePixels(buf) > 0, `${coverage} seed ${seed} welded body is empty`);
    assert(sk.canvas.collision === 20, `${coverage} collision must stay 20`);
    if (coverage === 'infiltrate') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 32, 'infiltrate canvas stays 32x32');
    } else if (coverage === 'rewrite') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 48, 'rewrite canvas stays 32x48');
    } else {
      assert(sk.canvas.w === 48 && sk.canvas.h === 64, 'overwrite canvas stays 48x64');
    }
  }
}

assert(overwriteSawRadiate, 'overwrite seeds must be able to draw radiate');

for (const coverage of ['infiltrate', 'rewrite'] as const) {
  const sk = buildFixtureSkeleton(coverage, 1);
  const rng = new SeededRandom(1);
  let locked = false;
  try {
    applyNamedOperator(sk, 'radiate', rng, coverage);
  } catch {
    locked = true;
  }
  assert(locked, `${coverage} applying radiate by name must fail (locked, not grey radiate)`);
}

const overwrite = buildFixtureSkeleton('overwrite', 9);
applyNamedOperator(overwrite, 'radiate', new SeededRandom(9), 'overwrite');
const overwriteBuf = paintWeldedBody(overwrite);
assert(
  countOpaque4Components(overwriteBuf) === 1,
  'overwrite forced radiate still welds to 1 component',
);

if (failed > 0) {
  console.error(`check:jia-operators ${failed} failed`);
  process.exit(1);
}
console.log('check:jia-operators PASS');
