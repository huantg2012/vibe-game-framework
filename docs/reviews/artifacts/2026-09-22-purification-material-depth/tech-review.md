---
status: PASS-WITH-LIMITS
scope: I30 R6 pass1 authoring technical review
date: 2026-09-22
reviewer: r5_volume_audit
features: [COH-F042, COH-F026]
baseline: da38e91787b48d96b98ab82fdc99537f3b6f1f22
---

# I30 R6 pass1 · 材料与外残构技术复核

**结论：本次限定检查未发现需修复的技术漏洞。** 结论针对室内/外景作者首稿 pass1；不代表审美、发布品质或后续 A/C 调色通过。

## 版本与适用范围

- 执行时 HEAD / R5 对照基线：`da38e91787b48d96b98ab82fdc99537f3b6f1f22`。
- 测试对象：该 HEAD 上的 R6 pass1 未提交工作树。不能把 HEAD 本身误当成已含 R6 首稿。
- 同期源码指纹来源：[presentation-pass1/manifest.json](../../../qa/artifacts/iteration-30-r6/presentation-pass1/manifest.json)，其 `at` 为 `2026-09-22T08:51:41.206Z`。该时间是根代理 presentation 运行的记录时间，不是本离屏命令单独计时。
- 本离屏命令当时未另存源码 hash；本报告落盘时补登记下列指纹，并只读核对其与 presentation 的 `sources`、`endingSources`、当时磁盘源码三者一致。补登记没有重跑测试。
- 室内作者随后开展 A/C 颜色修正；本文件保留 pass1 历史事实，不自动覆盖后续颜色版本。外景首稿冻结。若任何源码 hash 改变，应按实际差异判断旧结论适用性，不得把本记录直接改成新版本验证。

```json
{
  "src/art/chamber-pixel-helpers.ts": "b71bae2af83a26b31788f7316125db32e05a03d5280816ad650cce100c29e17b",
  "src/art/chamber-exterior-pixels.ts": "6f9d9f7baedca19f71d2293675e5676acfda4ae6da1a6951d18551b94abaea7c",
  "src/art/chamber-surface-map.ts": "a422b5bb2895fad9bc40dc7eb9db3685be13550a63b88a8d0716389dc08504dd",
  "src/art/purification-chamber-pixels.ts": "388b1e94dc797e394d81349b18dd8a54d3da62e7a90bf4674b8e22d028250a9f",
  "src/scenes/purification-chamber-visual.ts": "09514968d9287a8ee6808529c0205d14094479426e82cc15e7c35f9f9d55f433",
  "src/art/chamber-floor-light.ts": "77266161635a4eed798dcefbda3bbf7f0ce4dbac4c0efc8c09c95c12d15ad604",
  "src/art/chamber-light-field.ts": "fc8a66c42e0267f8e38cb4be7674a6d692b12a50b8d6e24c7631a052d5415bbb",
  "src/scenes/purification-chamber-lighting.ts": "732a618656856aea6840d36a74e51a5ee4b5bf25b2cc32c22c65184a3e160454",
  "src/systems/purification-chamber-layout.ts": "4dc6cd15792e53ea196391a3673c2d86050c05bd5b24c09c2d3881d7ffbd4880"
}
```

## 实际方法与结果

没有启动浏览器、Phaser 场景或额外 FPS 采样。通过 Node + tsx 导入当前生产 painter，将 R5 基线文件用 TypeScript 转译为 CommonJS 并在受控 `require` 中注入未改变的 layout。生产绘制最终调用的整数 `fillRect` 写入一个 640×400 RGBA 数组；设备用简化 context 维护真实调用的 save/restore/translate。表面记录使用实际 `ChamberSurfaceMap`。这属于纯离屏数学与颜色缓冲对照，不是原生 Canvas 或 GPU 验证。

### 室内与六设备

- Architecture 的 `coverage`、`heights`、`normalX`、`normalY`、`normalZ`、`occlusion`、`roughness` 七组完整数组相对 R5 均为 **0 个元素变化**。
- Architecture 的 alpha 为 **0 字节变化**；RGB 合计 **41,821 字节变化**。
- 因此本稿室内材料修改继承了宿主表面，没有改变既有双坡或楼层的表面高程、法线、覆盖和遮蔽标签。这不等于所有材料视觉读法已通过。
- 六设备分别以 `{core:1,storage:1,purifier:1,thickenLevel:0,growthLevels:0}` 绘制。core、storage、purifier、growth、offering、rift 每项的 RGBA 与七组表面属性相对 R5 都是 **0 差异**。

原始输出：

```json
{"architectureAttributesChanged":{"coverage":0,"heights":0,"normalX":0,"normalY":0,"normalZ":0,"occlusion":0,"roughness":0},"architectureColorBytesChanged":41821,"architectureAlphaBytesChanged":0,"devices":{"core":{"rgba":0,"attributes":0},"storage":{"rgba":0,"attributes":0},"purifier":{"rgba":0,"attributes":0},"growth":{"rgba":0,"attributes":0},"offering":{"rgba":0,"attributes":0},"rift":{"rgba":0,"attributes":0}}}
```

### 外残构

- 相对 R5，外景有 **14,303 个改色像素**。
- 在这些改色像素中，亮度大于 20 且不属于本次代码判定的 teal 发光色的材料，**缺少 surface coverage 的数量为 0**。
- 改色且有 coverage 的像素中，高程或法线出现非有限数值的数量为 **0**。
- 改色后亮度不超过 20 的 **817 个暗像素**经过生产 `bake()` 后，RGBA 字节变化为 **0**。这是改动暗区/黑腔的限定保存检查，不是完整隐蔽体积验证。
- 静态核对两块新增斜面：左侧 `riseX=.40, riseY=-.32` 对应 normal `[-.40,.32,.68]`；右侧 `.20,-.45` 对应 `[-.20,.45,.55]`，符合本场景 `Y=y+Z` 的法线变换。新增斜向 upright 的 footSlope 与面方向相配。
- 绘制次序为实体大面、内部暗腔、前唇及厚断面/折面；未发现将旧黑腔错误重新作为普通受光面的接线问题。洞形改变本身属于本稿有意重绘。

原始输出：

```json
{"exteriorChangedPixels":14303,"changedMaterialWithoutSurface":0,"missingSamples":[],"invalidNewSurfaceValues":0,"newBlackCavityPixels":817,"newBlackCavityBakeByteChanges":0}
```

### 其他静态边界

本轮 `purification-chamber-layout.ts`、`purification-chamber-visual.ts`、`purification-chamber-lighting.ts`、`chamber-light-field.ts`、`chamber-surface-map.ts` 无修改。原楼层/底座/移动边界、设备深度与光源身份的代码接线保持；本次未重新运行相关运动或动态光场回归。

## 实际执行命令

工作目录均为 `/Users/yilungao/coh`。两条命令通过 shell heredoc 执行，**没有保存临时脚本文件**；下面原样保留当次代码以便追溯。命令里的 `HEAD` 在执行时为前述固定 SHA。今后重放需把该引用换成 `da38e91787b48d96b98ab82fdc99537f3b6f1f22`，且被导入工作树必须先恢复并核对上述 pass1 hash；否则只是在验证另一个版本。

### 命令 A：室内属性与默认六设备对照

```sh
node --import tsx --input-type=module - <<'NODE'
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import * as now from './src/art/purification-chamber-pixels.ts';
import * as layout from './src/systems/purification-chamber-layout.ts';
import { ChamberSurfaceMap } from './src/art/chamber-surface-map.ts';
const source=execFileSync('git',['show','HEAD:src/art/purification-chamber-pixels.ts'],{encoding:'utf8'});
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const prior={};
new Function('require','exports',js)(id=>{if(id.includes('purification-chamber-layout'))return layout;throw Error(id)},prior);
function context(){const data=new Uint8ClampedArray(640*400*4);let ox=0,oy=0;const stack=[];return{data,fillStyle:'#000000',save(){stack.push([ox,oy])},restore(){[ox,oy]=stack.pop()},translate(x,y){ox+=x;oy+=y},fillRect(x,y,w,h){const color=parseInt(this.fillStyle.slice(1),16),r=color>>16,g=(color>>8)&255,b=color&255;for(let py=Math.max(0,y+oy);py<Math.min(400,y+oy+h);py++)for(let px=Math.max(0,x+ox);px<Math.min(640,x+ox+w);px++){const i=(py*640+px)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;}}};}
function paint(module,fn,id){const ctx=context(),map=new ChamberSurfaceMap(),p=new module.ChamberPixels(ctx,map);if(id)module[fn](p,id,{core:1,storage:1,purifier:1,thickenLevel:0,growthLevels:0});else module[fn](p);return{ctx,map};}
const before=paint(prior,'paintChamberArchitecture'),after=paint(now,'paintChamberArchitecture');
const attrs={};for(const name of ['coverage','heights','normalX','normalY','normalZ','occlusion','roughness'])attrs[name]=before.map[name].reduce((n,v,i)=>n+(v!==after.map[name][i]),0);
let colorChange=0,alphaChange=0;for(let i=0;i<640*400*4;i++){if(before.ctx.data[i]!==after.ctx.data[i]){if(i%4===3)alphaChange++;else colorChange++;}}
const devices={};for(const id of ['core','storage','purifier','growth','offering','rift']){const a=paint(prior,'paintChamberDevice',id),b=paint(now,'paintChamberDevice',id);let rgba=0,attributes=0;for(let i=0;i<a.ctx.data.length;i++)rgba+=a.ctx.data[i]!==b.ctx.data[i];for(const name of Object.keys(attrs))for(let i=0;i<a.map[name].length;i++)attributes+=a.map[name][i]!==b.map[name][i];devices[id]={rgba,attributes};}
console.log(JSON.stringify({architectureAttributesChanged:attrs,architectureColorBytesChanged:colorChange,architectureAlphaBytesChanged:alphaChange,devices}));
NODE
```

### 命令 B：外景新增材料覆盖、有效数值与暗区保存

```sh
node --import tsx --input-type=module - <<'NODE'
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import * as now from './src/art/purification-chamber-pixels.ts';
import * as layout from './src/systems/purification-chamber-layout.ts';
import { ChamberSurfaceMap } from './src/art/chamber-surface-map.ts';
const source=execFileSync('git',['show','HEAD:src/art/purification-chamber-pixels.ts'],{encoding:'utf8'}),prior={};new Function('require','exports',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText)(()=>layout,prior);
function fixture(module){const pixels=new Uint8ClampedArray(640*400*4);const ctx={canvas:{width:640,height:400},fillStyle:'#000000',fillRect(x,y,w,h){const v=parseInt(this.fillStyle.slice(1),16);for(let sy=Math.max(0,y);sy<Math.min(400,y+h);sy++)for(let sx=Math.max(0,x);sx<Math.min(640,x+w);sx++)pixels.set([v>>16,(v>>8)&255,v&255,255],(sy*640+sx)*4)},getImageData(){return{data:pixels.slice()}},putImageData(image){pixels.set(image.data)}};const map=new ChamberSurfaceMap();module.paintChamberExterior(new module.ChamberPixels(ctx,map));return{pixels,map,ctx};}
const a=fixture(prior),b=fixture(now),holes=[],missing=[];let changed=0,newInvalid=0;for(let i=0;i<640*400;i++){const k=i*4,was=a.pixels.slice(k,k+3),rgb=b.pixels.slice(k,k+3);if(was.every((v,j)=>v===rgb[j]))continue;changed++;const [r,g,blue]=rgb,lum=.2126*r+.7152*g+.0722*blue,em=g>=50&&g>r*1.35&&blue>r*1.2;if(lum>20&&!em&&!b.map.coverage[i])missing.push([i%640,Math.floor(i/640)]);if(b.map.coverage[i]&&![b.map.heights[i],b.map.normalX[i],b.map.normalY[i],b.map.normalZ[i]].every(Number.isFinite))newInvalid++;if(lum<=20)holes.push(i);}
const albedo=b.pixels.slice();b.map.bake(b.ctx);let blackChanges=0;for(const i of holes)for(let j=0;j<4;j++)blackChanges+=albedo[i*4+j]!==b.pixels[i*4+j];console.log(JSON.stringify({exteriorChangedPixels:changed,changedMaterialWithoutSurface:missing.length,missingSamples:missing.slice(0,10),invalidNewSurfaceValues:newInvalid,newBlackCavityPixels:holes.length,newBlackCavityBakeByteChanges:blackChanges}));
NODE
```

## 未测及收口边界

- 未独立运行浏览器、原生 Canvas、GPU 合成、相机缩放、动态光源、运动/交互/碰撞、FPS 或重入销毁；同期 presentation 证据归根代理，不混计为本报告亲自执行。
- 六设备只实测上述默认公开态，未遍历损伤、加厚及成长档位。代码未改不等于所有动态组合已重测。
- 离屏 context 只实现本次实际用到的整数绘制、颜色和设备平移，不能用它证明任意 Canvas 变换/混合行为；未输出独立图片。
- 未证明完整封闭三维几何、不可见面的遮挡、跨层光输运；本场景仍是有明确边界的 2.5D 表面图。
- 未评价材料是否足够有工艺差异、外残构是否达到成熟作品精度、颜色是否悦目，也不代签用户终审。
- 后续 A/C 调色属于新输入版本，本文件不自动延伸其颜色结论。此次落盘仅新增本文件，没有再次运行命令 A/B。
