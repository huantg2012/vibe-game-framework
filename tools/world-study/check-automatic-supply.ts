import assert from 'node:assert/strict';
import { TileGrid } from '../../src/systems/tile-grid';
import { TileType } from '../../src/types/game-types';
import { bodyHasSupport, bodyDisplacementFraction } from '../../src/systems/ai/physical-grid';
import { createAutomaticSupplyPolicy, validAutomaticSupplyPolicy } from '../../src/generation/world-study/automatic-supply-policy';
import { AutomaticSupplyNavigation, automaticSupplyBudget } from '../../src/generation/world-study/automatic-supply-navigation';
import { planAutomaticSupply, type AutomaticSupplyCandidate } from '../../src/generation/world-study/automatic-supply';
import type { R100ExpeditionDefinition } from '../../src/generation/world-study/r100-expedition';
import { hasLineOfSight } from '../../src/utils/grid-raycast';

const policy = createAutomaticSupplyPolicy('low');
const point = (grid: TileGrid, cell: number) => ({ x: (cell % grid.cols + .5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + .5) * grid.tileSize });
function gridOf(cols: number, rows: number, blocked: (x: number, y: number) => boolean = () => false): TileGrid {
  const tiles = Array.from({length:rows}, (_, y) => Array.from({length:cols}, (_, x) => x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2 || blocked(x,y) ? TileType.VOID : TileType.FLOOR));
  return new TileGrid({ cols, rows, tileSize: 8, tiles, fragments: [] });
}
function navigation(grid: TileGrid, start: number) {
  // A support mask supplies potential cells; one physical Dijkstra identifies
  // the connected component, then the test constructs the production domain.
  const possible = Float64Array.from({length:grid.cols*grid.rows}, (_, cell) => bodyHasSupport(grid, point(grid, cell), 10, 10) ? 0 : Infinity);
  const graph = new AutomaticSupplyNavigation(grid, possible, policy);
  const origin = graph.distancesFrom([start]);
  return { origin, nav: new AutomaticSupplyNavigation(grid, origin, policy) };
}
for (const grade of ['low', 'medium', 'severe'] as const) {
  const p = createAutomaticSupplyPolicy(grade);
  assert.ok(validAutomaticSupplyPolicy(JSON.parse(JSON.stringify(p))));
  assert.ok(!validAutomaticSupplyPolicy({...p, worldId:'test'}));
  assert.ok(!validAutomaticSupplyPolicy({...p, maxNodes:33}));
  assert.ok(!validAutomaticSupplyPolicy({...p, p95CoveragePx:p.maxCoveragePx+1}));
}
const open = gridOf(60, 44), openStart = 5 * open.cols + 5;
const { origin, nav } = navigation(open, openStart);
const detour = gridOf(60, 44, (x, y) => x >= 28 && x <= 30 && y < 34);
const detourStart = 5 * detour.cols + 5, { nav:detourNav } = navigation(detour, detourStart);
const left = 8 * detour.cols + 24, right = 8 * detour.cols + 34;
assert.equal(hasLineOfSight(detour, point(detour,left), point(detour,right), 100), false);
const toLeft = detourNav.distancesFrom([left]);
assert.ok(toLeft[right]! > 350, 'VOID-adjacent seats require a real detour, not Euclidean coverage');
assert.ok(toLeft[right]! > Math.hypot(point(detour,left).x-point(detour,right).x, point(detour,left).y-point(detour,right).y) * 4);
const split = gridOf(60, 44, x => x >= 28 && x <= 30);
const { origin:splitOrigin } = navigation(split, 5 * split.cols + 5);
assert.equal(splitOrigin[right], Infinity, 'Unreachable territory cannot become supply coverage');
const larger = gridOf(120, 88), { nav:largeNav } = navigation(larger, 5 * larger.cols + 5);
assert.ok(automaticSupplyBudget(largeNav.space, 0, policy) > automaticSupplyBudget(nav.space, 0, policy), 'Area and route scale node budget');
// Identical physical obstacle area at two interior positions gives exactly
// equal measured body area but different origin-to-region detours.
const nearWall = gridOf(72,64,(x,y)=>x>=18&&x<=20&&y<=46);
const farWall = gridOf(72,64,(x,y)=>x>=56&&x<=58&&y<=46);
const nearSpace = navigation(nearWall,5*72+5).nav.space;
const farSpace = navigation(farWall,5*72+5).nav.space;
assert.equal(nearSpace.bodyAreaPx2,farSpace.bodyAreaPx2,'Test maps must have truly equal measured body area');
const sensitive = {...policy, routePerNodePx:40};
assert.notEqual(automaticSupplyBudget(nearSpace,0,sensitive),automaticSupplyBudget(farSpace,0,sensitive),'Equal-area maps can receive different budgets because actual detours differ');
const incremental = nav.emptyDistances();
nav.addSources(incremental, [openStart]); nav.addSources(incremental, [30 * open.cols + 48]);
assert.deepEqual(incremental, nav.distancesFrom([openStart, 30 * open.cols + 48]), 'Incremental coverage equals independent multisource result');
// Every graph edge is validated by the same continuous 20px body displacement.
assert.ok(bodyDisplacementFraction(detour, point(detour,left), 10, 10, 80, 0) < 1, 'Continuous body sweep stops at the VOID edge');
const candidates: AutomaticSupplyCandidate[] = [];
for (let cell = 0; cell < origin.length; cell++) {
  if (!Number.isFinite(origin[cell]) || cell % open.cols % 4 || Math.floor(cell/open.cols) % 4) continue;
  const position = point(open, cell), interactionCells: number[] = [];
  for (let dy=-6;dy<=6;dy++) for(let dx=-6;dx<=6;dx++) {
    const x=cell%open.cols+dx,y=Math.floor(cell/open.cols)+dy,next=y*open.cols+x;
    if (x<0||y<0||x>=open.cols||y>=open.rows||Math.hypot(dx,dy)>6||!Number.isFinite(origin[next]))continue;
    if (hasLineOfSight(open,point(open,next),position,48.001))interactionCells.push(next);
  }
  candidates.push({cell,position,distance:origin[cell]!,approachDistance:origin[cell]!,interactionSeats:interactionCells.length,
    pollutionDistance:100,interactionCells,tiers:origin[cell]!<220?['safe','contested']:['contested','deep'],environmentScore:0});
}
const definition: R100ExpeditionDefinition = {grade_id:'low',version:2,status:'test',label:'test',public_risk:'test',public_preparation:'test',public_reward:'test',enemy_count:2,
  kindling_safe_count:1,kindling_contested_count:2,kindling_deep_count:1,kindling_safe_value:1,kindling_contested_value:2,kindling_deep_value:4,
  contaminant_safe_count:1,contaminant_contested_count:1,contaminant_deep_count:0};
const plan = planAutomaticSupply(open,origin,candidates,definition,policy,77,52);
const repeat = planAutomaticSupply(open,origin,candidates,definition,JSON.parse(JSON.stringify(policy)),77,52);
assert.deepEqual(plan.selected,repeat.selected,'Frozen JSON and seed reproduce all placements');
assert.equal(plan.selected.filter(item=>item.necessaryFuel).length,2);
assert.ok(plan.selected.filter(item=>item.necessaryFuel).every(item=>item.kind==='kindling'&&item.tier==='safe'));
const fuel = plan.selected.filter(item=>item.kind==='kindling').map(item=>({position:item.seat.position,tier:item.tier,...(item.necessaryFuel?{allowWeapon:false}:{})}));
const contaminants = plan.selected.filter(item=>item.kind==='contaminant').map(item=>({position:item.seat.position}));
const receipt = plan.verify(fuel,contaminants);
for (const grade of ['medium','severe'] as const) {
  const noEarlyPolicy = {...createAutomaticSupplyPolicy(grade), earlyFuelNodes:0};
  assert.ok(validAutomaticSupplyPolicy(noEarlyPolicy));
  const noEarlyPlan = planAutomaticSupply(open,origin,candidates,{...definition,grade_id:grade},noEarlyPolicy,77,52);
  assert.ok(noEarlyPlan.selected.length > 0, 'No early fuel requirement must still choose the first supply node');
  assert.equal(noEarlyPlan.selected.filter(item=>item.necessaryFuel).length,0);
}
assert.ok(!validAutomaticSupplyPolicy({...policy,earlyFuelNodes:1}), 'Low grade frozen policy cannot remove its two fuel guarantees');

assert.throws(()=>plan.verify(fuel.map(item=>({...item,allowWeapon:true})),contaminants),/early-fuel/);
assert.throws(()=>plan.verify(fuel.slice(1),contaminants),/count-mismatch/);
assert.throws(()=>planAutomaticSupply(open,origin,candidates.map(candidate=>({...candidate,tiers:[] })),definition,policy,77,52),/early-fuel-infeasible/);
assert.throws(()=>new AutomaticSupplyNavigation(open,origin,{...policy,maxWorkEdges:1}),/work-budget/);
assert.throws(()=>planAutomaticSupply(open,origin,candidates.filter(candidate=>candidate.position.x<200),definition,{...policy,maxCoveragePx:80,p95CoveragePx:50},77,52),/legal-tier-coverage-infeasible/,'Theoretical legal-tier holes must reject before wasting the node budget');
console.log(JSON.stringify({status:'pass',scope:'offline small physical grids only; no game/browser execution or balance approval',budget:{small:automaticSupplyBudget(nav.space,0,policy),large:automaticSupplyBudget(largeNav.space,0,policy)},voidDetourPx:toLeft[right],receipt},null,2));
