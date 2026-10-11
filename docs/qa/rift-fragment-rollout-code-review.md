# 裂隙碎片 r8 推广：独立代码复核

日期：2026-10-12（北京时间）。基线：`b2d737901ebe6e7ea61c4ea37be3470370d981a4` 加本轮未提交修改；审查快照为下附逐文件 SHA256 表，组合 SHA256：`199329bace876fb97297fd25dc6b2ccda590e483c817633ed62de5ec02a30e61`。不包含独立的 CLAUDE.md 修改。

Feature IDs：COH-F007 / F011 / F012 / F013 / F014 / F044 / F052。依据：[地图唯一 spec](../specs/system-map-generation.md#rectangle-fragment-authoring)、[当前推广任务](../tasks/rift-spatial-rollout.md)。环境：macOS，本仓库 Node v22.14.0 / tsx；静态审查与两组独立 Node 检查，未操作浏览器。

**结论：本次范围内未发现未解决的生产代码缺陷。** 这只覆盖版本接线、冻结输入与边界约束；不代替完整生成、实际 Worker 冷续、正常视野、性能、自然搜撤或人审。构建及浏览器验证由根代理统一执行，本复核未重复。

## 已核实的接入

- 三份 fragment CSV 单向生成作者源；只注册 cinder-ridge。共享 v1 编译器消费完整 layout 与原请求 seed，恢复编译不读取当前 CSV。worldScale 固定 2；保存的外环/孔必须与保存的作者输入重新编译结果逐点相等，不能独自变造轮廓。
- 新配方算法修订 8、fragment 空间策略版本 2；算法版本、layoutId、来源 hash、seedSalt、edgeSeed、全部矩形及轮廓均进入空间策略和包身份。新增快照/layout/policy 使用精确键校验；未知版本、缺字段、稀疏数组、seed 漂移和轮廓截断均拒绝。这里验证的是完整性回执，不是密码学防作弊签名。
- 80 点外岸通过独立 fragment 预算（每环 2048、总输出 8192、最多 128 个孔），没有削成旧 32 点。默认/历史作者入口仍保留旧预算；原尺寸 nativeDefinition 拒绝夹带世界 outline 或 fragment marker，避免两套来源互相覆盖。
- 正式出发和恢复经同一 executeRiftGeneration → createR100ProductionMap 路由。外岸/孔在配方阶段固定；最多 8 次部署尝试只改变实例/内容的候选 seed，未重新选 edgeSeed 或当前作者表。r1–r7 继续进入各自冻结执行器；本报告不重复上一子任务的 r7 完整等价结果。
- createMasterWorld 用外环减孔生成唯一 8px matter；tileMap 与 LOS 直接取该结果，普通 solid 仍透明于视线。20px 身体保留实际实体三角形与 8px VOID 支撑；32px material sample 保留任何含实际支撑的单元，最终 paintMasterGround/surface-bake 再逐像素受 matterAt 裁切，岸壁也消费外岸与内孔。
- serializeR100MasterWorld 仅剥离方法，保存 definition/geometry；hydrate 从传回的实际 8px tileMap 重建 matterAt/LOS。surface-preparation 复用该 hydration，再按修订分发表面烘焙。以上为静态接线结论，运行像素/浏览器范围见根代理和实现代理的专项证据。

## 两组独立检查

最终作者表同步后重新执行，未复制 check-r8.mjs 的 expected。

1. **冻结身份破坏：26/26 拒绝；另 10/10 直接 policy 拒绝。** 覆盖新增未知字段、未知版本/种子模式、缺失/null/undefined 快照、r7 改标、native 母版覆盖、请求/edge/salt 漂移、来源 hash/layoutId 变造、错误比例、两种稀疏数组、外环单点变造、删除孔、截成32点和档位改标。未改动的 JSON 往返仍合法；seed20261011 外岸80点、内部10孔。
2. **原世界隔离与重试稳定：321/321 非 cinder 配方与固定 b2d73790 的 r7 oracle 逐值相等。** 仅剔除新版 package 与全表 sourceHash，完整比较其余全部输入；并确认没有 fragmentShape。另以请求 seed 0 / 20261011 / UINT32_MAX，分别比较三档、每档7个实际重试 seed，共63个 definition 的外岸/孔精确不变，9份 JSON 配方往返的 definition 精确相等。未在此测试内完整生成这321局。

三个 seed 的 [terrainOutline, erosion] JSON SHA256 分别为：

- 0：459fd9cf24a4213dfee0f915b85e759ba9f5634922bf4c9326b854b35bf3c48e
- 20261011：1ccdafb832fae6c9a44759adf2f23a8aa5a03143acd5a810afb0ea5cea69e79b
- 4294967295：3c10c76df08d773035e9535b73006f3dec0b96af14ad918beb0a19ad2b4d46f9

另实际执行两个 CSV 生成器 --check：fragment 1 个显式世界、spatial 108 世界/7组织，均通过。最终 spatial 来源 hash 以本报告下附 generated 文件指纹为准（本轮实体 relief 3 的作者 y=390、width=150 已同步，未沿用先前 stale 产物）。

## 已关闭的测试维护问题

根代理发现旧 check-positive-ground.mjs 未传请求 seed 且把旧8孔当作当前条件；code 已拆分通用8孔 fixture、当前 fragment 编译验证和历史 r7 八孔契约。本复核另外发现其改版误用 recipe.algorithmRevision，已反馈 code 修至 package.algorithmRevision，包含旧包变造对象的正确层级。静态复核修正完成；code 实际执行的 [positive-ground.json](artifacts/r100-fragment-rollout-2026-10-11/positive-ground.json) 通过，含旧两个小世界完整 transfer / surface-fields 等价。这是测试接入缺陷，不是生产入口行为缺陷。

## 覆盖限制与证据归属

本报告不宣告 108 世界新构型通过、任意随机 seed 全覆盖、玩家体验通过或 I14 结案。完整9例 r8 准入/像素同源由 code 执行；额外两seed三档、真实进入/冷续和 VOID 见证由根代理执行；各自报告保持独立。r7 冻结及原四案例完整 payload/RGBA 等价见 revision7-freeze.json / revision7-live.json，未重复运行。游戏状态 evidence ID 与跨模块状态由根代理统一登记。

## 审查快照 SHA256

组合算法：按文件路径排序，生成下面同序 JSON 对象，再取 JSON.stringify(object) 的 SHA256。

```json
{
  "data/rift-spatial-fragment-layouts.csv": "2b7a0067e3a095f38879d50b514d3c51876639968b51e897d01e57b23a80a154",
  "data/rift-spatial-fragment-rectangles.csv": "21761df18bca06cac0a6ad81ef9d24bf3bdf863c8ece96558bfa819543c0c253",
  "data/rift-spatial-fragment-worlds.csv": "13287ca6afe0411bed3f211df91497e08ec3d527822a30c956c6ae3f2313e05a",
  "data/rift-spatial-sector-anchors.csv": "2c51e14cc5fc6cefd9723952adb48becc64589fc4124952845f434c2276bce6e",
  "data/rift-spatial-sector-layouts.csv": "c4f3910db4e702e9e7bff94dda2699b20ebd0ab4fee5faf90c4f95c2edee84ca",
  "src/generated/r100-fragment-data.ts": "f84b6b041bc34dbed4fe3919b40598245bc11a4b0b22b84b70ab7d8d9392b1dd",
  "src/generated/r100-spatial-data.ts": "28bf9ce0f2f7a98aadecf9371a2406b73c71bd508933e30d8d63d98abb32098e",
  "src/generation/rift-generation-execute.ts": "73b0882b47c2b040c11f1f021125c7ce44d1f5d0be5c9785c69adbcad1c36cfc",
  "src/generation/rift-generation-protocol.ts": "ee929416e408074916458f5445b3ff8f7487ad9e52ff9f1eac41e92b00acf61b",
  "src/generation/world-study/fragment-shape/index.ts": "360fec66eb098bd062ddb5515d65323a35e7aeeb1f6681ba3b18ce5eb8a008ab",
  "src/generation/world-study/fragment-shape/rectilinear-fragment.ts": "3b865b938bb853a33e1a377ae806056d469f99b55cbfdaad47d73aeff2f6e754",
  "src/generation/world-study/fragment-shape/types.ts": "ec3195b0389f261a9cd48b83de4468c97bc01708ee3e11eb8cefd0992c670a58",
  "src/generation/world-study/fragment-shape/validation.ts": "0c6e580622a8a935afdc1a56508e5685fd3cf2e52066c8c0e0fc578ba2d9df35",
  "src/generation/world-study/native-volume-erosion.ts": "32fb50764a8f9479bbd725a53b90a58a5bbd220199d5ad4da524a893fb9eaeec",
  "src/generation/world-study/r100-fragment-shape.ts": "3d77225f786e885459094b39a210d735c4972f89123139dcfeadb004d0ca6adb",
  "src/generation/world-study/r100-master-world.ts": "2b1335c815c6f3f588cf576e37c527e2cf89c9e104ff2e652fad6ec2fdab3258",
  "src/generation/world-study/r100-native-data.ts": "69c3ed29e6dc6951916419d0ffb5c297d98b2358cccad615fd75dd9c155123e0",
  "src/generation/world-study/r100-package.ts": "eab2b732010631f85a26427f86d43acae980339bd196c11c28ca43a3022bb140",
  "src/generation/world-study/r100-production-map.ts": "d6a091ad3c75402e2601c0f67d8ab9b9feb56e30dfcd169f0e4921b721856a3f",
  "src/generation/world-study/r100-spatial-types.ts": "ab09972625975a3512ad45364d012285ab1f6b6e06e04a3dd0d58c162762bb06",
  "src/generation/world-study/r100-spatial-world.ts": "0d7458a8016bb896f6608369c07e73e57e41436de2ec59ba9ae2e062d70d5137",
  "src/managers/rift-recovery.ts": "dbe9ac569320c6c3df6680f13c61913d2901b30da287d9e8adf185882810dfa4",
  "src/systems/r100-world/ground.ts": "36fc10eb24d9d111619c968367e937b82693d31d775a8d07800831794aa57f0d",
  "src/systems/r100-world/surface-bake.ts": "300488833b50d5760ef5df3d2b17d9f91e1abe7926411ace9bf0435e32c8cf8e",
  "src/systems/r100-world/surface-fields.ts": "29da511c97b2ffc4d4b6d73526d853994432356cd5d9c70f9656f4e09fdf32a6",
  "src/systems/r100-world/surface-preparation.ts": "00a027404b24ea056702f642c15388bd59f127183a19739eb125e139fa4b4427",
  "tools/world-study/codegen-r100-fragments.mjs": "6285be9f54c350c58ed06472bed3cdbb1cd5937c599364a59f81941c68f9dcc7"
}
```

## 独立检查复现源

在仓库根目录把下面内容送入 `TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx --input-type=module` 的 stdin。两组均仅比较输入/编译产物，不启动完整地图生成。

```js
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {R100_NATIVE_WORLDS} from './src/generated/r100-native-worlds.ts';
import {createR100ProductionRecipe as make,validR100ProductionRecipe as valid} from './src/generation/world-study/r100-package.ts';
import {createR100ProductionRecipe as oldMake} from './src/generation/legacy-r100-v7/executor.js';
import {createR100SpatialDefinition as definition,validR100SpatialPolicy as validPolicy} from './src/generation/world-study/r100-spatial-world.ts';
import {mix32} from './src/generation/seed-fork.ts';
const source=make('cinder-ridge',20261011,'medium');
const reject=[
 ['unknown snapshot key',r=>r.spatialPolicy.fragmentShape.newOption=true],
 ['unknown layout key',r=>r.spatialPolicy.fragmentShape.layout.fixedRadius=12],
 ['unknown policy key',r=>r.spatialPolicy.newOption=true],
 ['unknown algorithm',r=>r.spatialPolicy.fragmentShape.algorithmVersion='rectilinear-fragment-v2'],
 ['unknown seed mode',r=>r.spatialPolicy.fragmentShape.seedMode='attempt-seed'],
 ['undefined snapshot',r=>r.spatialPolicy.fragmentShape=undefined],
 ['null snapshot',r=>r.spatialPolicy.fragmentShape=null],
 ['missing snapshot',r=>delete r.spatialPolicy.fragmentShape],
 ['legacy policy relabel',r=>r.spatialPolicy.version=1],
 ['unknown policy version',r=>r.spatialPolicy.version=3],
 ['unknown algorithm revision',r=>r.package.algorithmRevision=9],
 ['r7 downgrade',r=>r.package.algorithmRevision=7],
 ['wrong source marker',r=>r.nativeDefinition.fragmentShapeVersion='rectilinear-fragment-v1'],
 ['source outline override',r=>r.nativeDefinition.terrainOutline=r.spatialPolicy.terrainOutline],
 ['edge seed drift',r=>r.spatialPolicy.fragmentShape.edgeSeed++],
 ['requested seed drift',r=>r.requestedSeed++],
 ['salt drift',r=>r.spatialPolicy.fragmentShape.seedSalt++],
 ['source hash drift',r=>r.spatialPolicy.fragmentShape.sourceHash='a'.repeat(64)],
 ['layout id drift',r=>r.spatialPolicy.fragmentShape.layoutId='alternate-layout'],
 ['scale drift',r=>r.spatialPolicy.fragmentShape.layout.worldScale=1],
 ['sparse authoring frame',r=>r.spatialPolicy.fragmentShape.layout.authoringFrame=Array(2)],
 ['sparse rectangle',r=>r.spatialPolicy.fragmentShape.layout.landRects[0]=Array(4)],
 ['outer point drift',r=>r.spatialPolicy.terrainOutline[0].x++],
 ['hole removed',r=>r.spatialPolicy.erosion.pop()],
 ['outer truncated to32',r=>r.spatialPolicy.terrainOutline.splice(32)],
 ['grade relabel',r=>r.package.grade='low'],
];
for(const[label,mutate]of reject){const bad=structuredClone(source);mutate(bad);assert(!valid(bad),label);}
for(const[label,mutate]of reject.slice(0,10)){const bad=structuredClone(source);mutate(bad);assert(!validPolicy(bad.spatialPolicy,'cinder-ridge',source.requestedSeed),label);}
assert(valid(JSON.parse(JSON.stringify(source))));assert(source.spatialPolicy.terrainOutline.length>32);
const result1={group:'r8 frozen identity rejection',passed:reject.length,directPolicyRejections:10,roundtrip:true,outerPoints:source.spatialPolicy.terrainOutline.length,holes:source.spatialPolicy.erosion.length};
const grades=['low','medium','severe'];
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const normalize=recipe=>{const result=structuredClone(recipe);delete result.package;delete result.spatialPolicy.sourceHash;return result;};
let preserved=0;
for(const row of R100_NATIVE_WORLDS)if(row.id!=='cinder-ridge')for(const grade of grades){
 const now=make(row.id,20261011,grade),old=oldMake(row.id,20261011,grade);
 assert.deepEqual(normalize(now),normalize(old),`${row.id}/${grade} changed frozen inputs`);
 assert(!Object.hasOwn(now.spatialPolicy,'fragmentShape'));assert(valid(now));preserved++;
}
const cases=[];
for(const seed of[0,20261011,0xffffffff]){
 let first;
 for(const grade of grades){
  const recipe=make('cinder-ridge',seed,grade);assert(valid(recipe));
  const original=definition(recipe.nativeDefinition,recipe.spatialPolicy,seed).definition;
  const shape=hash([original.terrainOutline,original.erosion]);
  if(first)assert.equal(shape,first,'grade changed terrain');else first=shape;
  for(let attempt=1;attempt<8;attempt++){
   const next=definition(recipe.nativeDefinition,recipe.spatialPolicy,mix32(seed,`r100-native-v3-attempt-${attempt}`)).definition;
   assert.deepEqual(next.terrainOutline,original.terrainOutline);assert.deepEqual(next.erosion,original.erosion);
   assert.equal(next.fragmentShapeVersion,'rectilinear-fragment-v1');
  }
  const round=JSON.parse(JSON.stringify(recipe));assert(valid(round));
  assert.deepEqual(definition(round.nativeDefinition,round.spatialPolicy,seed).definition,original);
 }
 cases.push({requestedSeed:seed,shapeHash:first});
}
console.log(JSON.stringify([result1,{group:'unmigrated geometry and frozen retry inputs',preservedRecipes:preserved,roundtripDefinitions:9,retryDefinitions:63,cases}],null,2));
```
