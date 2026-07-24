# 美术资源后处理管线（框架能力）Implementation Plan · v2（评审后修订）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## 会话性质声明（回应评审 S1 · 框架迭代协议合规）

本计划是**人主动批准的"刻意框架建设会话"**，属框架层（层 A）投资，**不是 Slice 1 的任务**。当前处于 Foundation 已完成、Slice 1 仍 PROPOSED 的空档，非阻塞。按 `CLAUDE.md` 框架迭代协议，集中式框架开发通常只在 Retro 发生；本次为人显式批准的例外。**Task 0 必须先把这一决策记入 `guides/98-field-notes.md`**，使协议留痕。Slice 1 门禁 A-G3 所需的"一次性手动往返"由本计划 Task 12 顺带满足。

**Goal:** 为框架增加一条通用、可被 agent 调用的**单图后处理往返能力**（AI 原图 → 合规游戏资产），使任何用本框架的游戏都能把生图产出稳定转成符合各自 art-direction 规格的**单张 tile/sprite** 资产。多资产类通过"多份 config 文件分别跑"支撑；图集打包/切帧为显式后续项。

**Architecture:** 以 `sharp` 为底、`RawImage`(RGBA) 为中间表示、由 config 声明的"可组合 stage 链" Node/TS CLI（`npm run art:postprocess` / `art:verify`）。框架给 stage 实现 + config schema + 运行时校验 + 机器可读验收器；游戏给 `pipeline.config.json` + `palette.json`（配置即数据）。同步更新框架文档与 agent 定义，固化"art 产 config / code 跑脚本 / 人生图+签核"的分工与人在环协议。

**Tech Stack:** Node ≥ 20，TypeScript（strict），`tsx`，`sharp`，`vitest`。不引入 Python。

## Global Constraints

- **两层纪律（最高约束）**：Task 1–11 为框架层，必须 game-agnostic——不得写入任何游戏具体色板/尺寸/色调。游戏特定值只在 Task 12。
- **stage 顺序铁律（B3）**：`colorGrade` 必须在 `quantize` **之前**。先统一色调、再吸附锁定色板，否则调色会把像素移出色板、打穿 `paletteConformance`。通用推荐序：`bgRemove → colorGrade → downscale → quantize → cropPad`。
- **确定性（N1）**：同输入 + 同 config ⇒ 同输出。stage 与 provenance **不得**包含时间戳/随机/网络/时钟。
- **保长宽比（S7）**：`downscale` 用 `fit:'inside'`（不拉伸、不裁切），最终尺寸由 `cropPad` 补齐到 `targetSize`。
- **调用形态**：能力经 `npm run` 暴露，主要由 **code agent** 调用；art agent **不跑脚本**；生图步骤天然需人；人做审美签核。
- **类型安全（S2）**：全程 TS strict；stage 类型用 `Extract<StageConfig, {name:'...'}>`；每个代码任务收尾跑 `tsc --noEmit`。
- **变更传播（CLAUDE.md 强制）**：改 agent 定义 / guides / 核心概念，必须 Grep `.claude/agents/*.md`、**`.cursor/agents/*.md`**、`docs/**/*.md`、`guides/**`、`START-HERE.md`、`CLAUDE.md` 并处理引用。
- **两份 agent 定义必须完全一致（S6，人已拍板）**：`.claude/agents/**` 与 `.cursor/agents/**` **内容逐字相同**，无主从之分。任何 agent 定义改动必须同步写入两侧，并以 `diff -r .claude/agents .cursor/agents`（预期无输出）作为验收。同步时不得吞掉 `.cursor/agents/qa.md` 现有未提交改动（须同样回写 `.claude/agents/qa.md`）。

---

## File Structure

```text
tools/art-pipeline/                     # 框架层（通用）
  package.json            # vitest 等测试依赖（子包）
  tsconfig.json           # strict
  config.schema.json      # pipeline.config.json 的 JSON Schema
  src/
    types.ts  io.ts  color.ts  validate.ts
    stages/ colorGrade.ts quantize.ts bgRemove.ts downscale.ts cropPad.ts index.ts
    postprocess.ts  verify.ts
  test/
    fixtures.ts           # 合成测试图（代码生成）
    io.test.ts color.test.ts colorGrade.test.ts quantize.test.ts
    bgRemove.test.ts downscale.test.ts cropPad.test.ts
    validate.test.ts postprocess.test.ts verify.test.ts

docs/art/                               # 游戏层（层 B，Task 12）
  palette.json
  pipeline.env.config.json     # 环境场景图用（bgRemove 关、requireTransparentBg 关）
  pipeline.sprite.config.json  # sprite 用（bgRemove 开、requireTransparentBg 开）
assets/_sources/          # 原图 + prompt 记录（追溯）
```

根 `package.json`（B1 修复）：把 `sharp`、`tsx` 加入 **根 devDependencies**（使 `npm run` 从根即可解析 tsx 与 sharp），并加脚本：
```json
{
  "scripts": {
    "art:postprocess": "tsx tools/art-pipeline/src/postprocess.ts",
    "art:verify": "tsx tools/art-pipeline/src/verify.ts"
  },
  "devDependencies": { "tsx": "^4.0.0", "sharp": "^0.33.0" }
}
```

**显式排除（YAGNI，另行追踪）：** `sliceFrames`（切帧条）、`packAtlas`（图集）、3D `.cube` LUT。tileset 图集（art-direction §3.1）与 sprite 条带是本游戏正式资产的真实需求，但属"多图/打包"范畴，待资产 Slice 用同一 Stage 接口扩展；本计划只承诺**单图往返**。

---

## 核心接口（Task 1 落地，后续任务一致引用）

`tools/art-pipeline/src/types.ts`：

```ts
export type RGB = [number, number, number];

/** stage 间流转：始终 RGBA、行主序 */
export interface RawImage { data: Buffer; width: number; height: number; }
export interface TargetSize { width: number; height: number; }

export type StageConfig =
  | { name: 'bgRemove';  enabled: boolean; method: 'chroma'; color: RGB; threshold: number }
  | { name: 'colorGrade'; enabled: boolean; brightness?: number; saturation?: number; tint?: RGB; tintAmount?: number }
  | { name: 'downscale'; enabled: boolean; filter: 'nearest' | 'mitchell' | 'lanczos3' }
  | { name: 'quantize';  enabled: boolean }                 // 色板来自顶层 config.paletteFile（S3：删除 stage 级 paletteFile）
  | { name: 'cropPad';   enabled: boolean; padding: number };

export interface AcceptanceConfig {
  maxAvgBrightness?: number; paletteConformance?: number; paletteTolerance?: number;
  requireTransparentBg?: boolean; exactSize?: [number, number];
}

export interface PipelineConfig {
  targetSize: TargetSize;
  sourceDir: string;
  outputDir: string;
  paletteFile?: string;        // quantize/verify 唯一色板来源
  stages: StageConfig[];
  acceptance: AcceptanceConfig;
}

export interface StageContext { config: PipelineConfig; palette: RGB[]; }

export interface Stage<C extends StageConfig = StageConfig> {
  name: C['name'];
  run(img: RawImage, cfg: C, ctx: StageContext): Promise<RawImage>;
}
```
> 各 stage 用 `Stage<Extract<StageConfig,{name:'colorGrade'}>>` 形式声明（S2），使 `cfg` 精确到该成员且满足约束。

---

## Task 0: 记录"刻意框架会话"决策（协议留痕）

**Files:** Create/append `guides/98-field-notes.md`
- [ ] **Step 1:** 若文件不存在则创建；追加一行：`- 框架会话（2026-07-24）：人批准在 Foundation 空档集中建设"美术后处理管线"（框架层），为 Slice 1 门禁 A-G3 提供可复用能力。属框架迭代协议的显式例外。`
- [ ] **Step 2: Commit** — `git add guides/98-field-notes.md && git commit -m "field-notes: record approved framework session for art pipeline"`

---

## Task 1: 脚手架 + IO + 纯色彩工具 + config 校验 + 根接线

**Files:**
- Create: `tools/art-pipeline/{package.json,tsconfig.json,config.schema.json}`
- Create: `tools/art-pipeline/src/{types.ts,io.ts,color.ts,validate.ts}`
- Create: `tools/art-pipeline/test/{fixtures.ts,io.test.ts,color.test.ts,validate.test.ts}`
- Modify: 根 `package.json`（B1：加 `sharp`+`tsx` 到 devDeps、加两条 script）

**Interfaces produced:** `loadRaw/saveRaw/loadPalette`（io）；`rgbDistance/nearestColor/rgbToLuma`（color）；`validateConfig(cfg): string[]`（validate，返回错误数组，空=通过）；`makeSolid/makeChecker`（`test/fixtures.ts`，S8 命名/路径统一）。

- [ ] **Step 1: 写 color 失败测试**（`test/color.test.ts`，同 v1：rgbDistance 欧氏 / nearestColor 取最近 / rgbToLuma Rec.601）。
- [ ] **Step 2: 运行确认失败** — `cd tools/art-pipeline && npm install && npx vitest run test/color.test.ts` → FAIL。
- [ ] **Step 3: 实现 color.ts**
```ts
import type { RGB } from './types';
export const rgbDistance = (a: RGB, b: RGB): number =>
  Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
export const rgbToLuma = ([r,g,b]: RGB): number => 0.299*r + 0.587*g + 0.114*b;
export function nearestColor(px: RGB, palette: RGB[]): RGB {
  let best = palette[0], bestD = Infinity;
  for (const c of palette){ const d = rgbDistance(px,c); if (d<bestD){ bestD=d; best=c; } }
  return best;
}
```
- [ ] **Step 4: 运行确认通过** → PASS。
- [ ] **Step 5: 写 io + fixtures 及测试**（`test/fixtures.ts` 提供 `makeSolid`/`makeChecker`；`test/io.test.ts` 验 saveRaw→loadRaw 像素往返 + loadPalette 解析 `{colors:[...]}`）——代码同 v1，但 fixtures 置于 `test/fixtures.ts`、导出名统一 `makeChecker`（S8）。
- [ ] **Step 6: 实现 io.ts**（同 v1：`sharp(file).ensureAlpha().raw()` 读；`sharp(buf,{raw})` 写；hex→RGB 解析色板）。
- [ ] **Step 7: 写 validate 失败测试**（`test/validate.test.ts`）
```ts
import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/validate';
it('flags missing targetSize and unknown stage', () => {
  const errs = validateConfig({ sourceDir:'a', outputDir:'b', stages:[{name:'nope',enabled:true} as any], acceptance:{} } as any);
  expect(errs.some(e=>e.includes('targetSize'))).toBe(true);
  expect(errs.some(e=>e.includes('nope'))).toBe(true);
});
it('passes a minimal valid config', () => {
  const errs = validateConfig({ targetSize:{width:32,height:32}, sourceDir:'a', outputDir:'b',
    stages:[{name:'downscale',enabled:true,filter:'nearest'}], acceptance:{} } as any);
  expect(errs).toEqual([]);
});
```
- [ ] **Step 8: 实现 validate.ts**（S4：运行时轻量校验）
```ts
import type { PipelineConfig } from './types';
const KNOWN = new Set(['bgRemove','colorGrade','downscale','quantize','cropPad']);
export function validateConfig(cfg: PipelineConfig): string[] {
  const e: string[] = [];
  if (!cfg?.targetSize?.width || !cfg?.targetSize?.height) e.push('missing targetSize {width,height}');
  if (!cfg?.sourceDir) e.push('missing sourceDir');
  if (!cfg?.outputDir) e.push('missing outputDir');
  if (!Array.isArray(cfg?.stages)) e.push('stages must be an array');
  else {
    cfg.stages.forEach((s,i)=>{ if(!KNOWN.has((s as any).name)) e.push(`unknown stage[${i}]: ${(s as any).name}`); });
    const gi = cfg.stages.findIndex(s=>s.name==='colorGrade' && s.enabled);
    const qi = cfg.stages.findIndex(s=>s.name==='quantize' && s.enabled);
    if (gi>=0 && qi>=0 && gi>qi) e.push('colorGrade must run before quantize');   // B3 守卫
  }
  if (cfg?.stages?.some(s=>s.name==='quantize'&&s.enabled) && !cfg.paletteFile)
    e.push('quantize enabled but config.paletteFile missing');
  return e;
}
```
- [ ] **Step 9: 落地 package.json/tsconfig(strict)/config.schema.json/types.ts**
`tsconfig.json`：
```json
{ "compilerOptions": { "target":"ES2022","module":"ESNext","moduleResolution":"Bundler",
  "strict":true,"noEmit":true,"skipLibCheck":true,"types":["node"] },
  "include":["src","test"] }
```
`package.json`（子包）：deps `sharp`，devDeps `tsx/vitest/typescript/@types/node`。`types.ts` 逐字采用"核心接口"。
- [ ] **Step 10: 根接线（B1）** — 编辑根 `package.json`：devDeps 加 `sharp`+`tsx`，scripts 加 `art:postprocess`/`art:verify`；根 `npm install`。
- [ ] **Step 11: 类型检查 + 全绿 + 根冒烟** —
  `cd tools/art-pipeline && npx tsc --noEmit && npx vitest run`（全 PASS）；
  回根建一个临时 config + 一张图，跑 `npm run art:postprocess -- --config <tmp> --in <tmp_in> --out <tmp_out>` 确认 tsx/sharp 从根可解析（冒烟，命令零报错即可，完整行为在 Task 7 测）。
- [ ] **Step 12: Commit** — `git add tools/art-pipeline package.json package-lock.json && git commit -m "art-pipeline: scaffold + io + color + config validate + root wiring"`

---

## Task 2: colorGrade stage

**Files:** Create `src/stages/colorGrade.ts`, `test/colorGrade.test.ts`
**类型：** `Stage<Extract<StageConfig,{name:'colorGrade'}>>`（S2）。逻辑同 v1（brightness→saturation 向 luma 混合→tint 线性插值，alpha 不变）。测试同 v1（变暗/去饱和/保 alpha）。收尾 `tsc --noEmit`。
- [ ] Step 1 失败测试 → Step 2 跑挂 → Step 3 实现（签名 `export const colorGrade: Stage<Extract<StageConfig,{name:'colorGrade'}>> = {...}`）→ Step 4 跑过 → Step 5 `tsc --noEmit` → Step 6 Commit `art-pipeline: colorGrade stage`。

---

## Task 3: quantize stage（S3：色板仅来自 ctx.palette）

**Files:** Create `src/stages/quantize.ts`, `test/quantize.test.ts`
**类型：** `Stage<Extract<StageConfig,{name:'quantize'}>>`；stage config 不再有 `paletteFile`；`ctx.palette` 由编排器按 `config.paletteFile` 预加载。逻辑：对 alpha>0 像素 `nearestColor` 映射；空 palette 抛错。测试同 v1。
- [ ] Step 1–6 同 Task 2 节奏；实现体：
```ts
import type { Stage, RawImage, RGB, StageConfig } from '../types';
import { nearestColor } from '../color';
export const quantize: Stage<Extract<StageConfig,{name:'quantize'}>> = {
  name: 'quantize',
  async run(img, _cfg, ctx){
    if (!ctx.palette.length) throw new Error('quantize: empty palette (set config.paletteFile)');
    const d = Buffer.from(img.data);
    for (let i=0;i<d.length;i+=4){ if(d[i+3]===0) continue;
      const [r,g,b]=nearestColor([d[i],d[i+1],d[i+2]] as RGB, ctx.palette); d[i]=r; d[i+1]=g; d[i+2]=b; }
    return { ...img, data: d };
  }
};
```
- [ ] 收尾 `tsc --noEmit` + Commit `art-pipeline: quantize stage`。

---

## Task 4: bgRemove stage

**Files:** Create `src/stages/bgRemove.ts`, `test/bgRemove.test.ts`
**类型：** `Stage<Extract<StageConfig,{name:'bgRemove'}>>`。逻辑/测试同 v1（与 `cfg.color` 距离 < `threshold` → alpha=0）。
- [ ] Step 1–6 同节奏；收尾 `tsc --noEmit` + Commit `art-pipeline: bgRemove stage`。

---

## Task 5: downscale stage（S7 保长宽比 + N5 alpha 注记）

**Files:** Create `src/stages/downscale.ts`, `test/downscale.test.ts`
**类型：** `Stage<Extract<StageConfig,{name:'downscale'}>>`。
**变更：** `fit:'inside'`（保长宽比、不裁切、不放大到超过 target）；最终精确尺寸交给 cropPad。
- [ ] **Step 1: 失败测试**（方形输入下仍精确到 target）
```ts
import { describe, it, expect } from 'vitest';
import { downscale } from '../src/stages/downscale';
import { makeSolid } from './fixtures';
it('shrinks square to target preserving aspect', async () => {
  const ctx = { config:{ targetSize:{width:8,height:8} } as any, palette: [] };
  const out = await downscale.run(makeSolid(64,64,[100,100,100,255]),
    { name:'downscale', enabled:true, filter:'nearest' }, ctx);
  expect([out.width,out.height]).toEqual([8,8]);
});
```
- [ ] **Step 2 跑挂 → Step 3 实现**
```ts
import sharp from 'sharp';
import type { Stage, RawImage, StageConfig } from '../types';
const KERNEL = { nearest:sharp.kernel.nearest, mitchell:sharp.kernel.mitchell, lanczos3:sharp.kernel.lanczos3 } as const;
export const downscale: Stage<Extract<StageConfig,{name:'downscale'}>> = {
  name: 'downscale',
  async run(img, cfg, ctx){
    const { width, height } = ctx.config.targetSize;
    // 注（N5）：sharp resize 会对含 alpha 图做预乘/反预乘；bgRemove 应在 downscale 之前，
    // 全透明像素 RGB 可能被改，但后续不依赖其 RGB。
    const { data, info } = await sharp(img.data, { raw:{ width:img.width, height:img.height, channels:4 } })
      .resize(width, height, { kernel: KERNEL[cfg.filter], fit:'inside' })
      .raw().toBuffer({ resolveWithObject:true });
    return { data, width: info.width, height: info.height };
  }
};
```
- [ ] Step 4 跑过 → Step 5 `tsc --noEmit` → Step 6 Commit `art-pipeline: downscale stage (preserve aspect)`。

---

## Task 6: cropPad stage（补齐到精确 targetSize）

**Files:** Create `src/stages/cropPad.ts`, `test/cropPad.test.ts`
**类型：** `Stage<Extract<StageConfig,{name:'cropPad'}>>`。逻辑/测试同 v1（非透明包围盒 → 居中放入 targetSize 画布，透明填充；全透明返回空目标图）。cropPad **保证输出精确等于 targetSize**。
- [ ] Step 1–6 同节奏；收尾 `tsc --noEmit` + Commit `art-pipeline: cropPad stage`。

---

## Task 7: 编排器 postprocess.ts（S3/S4/N1）

**Files:** Create `src/stages/index.ts`, `src/postprocess.ts`, `test/postprocess.test.ts`
**Interfaces:** CLI `art:postprocess --config <path> [--in <dir>] [--out <dir>]`；按 `config.stages`（enabled、数组序）处理 `sourceDir` 每图 → 写 `outputDir`；写 `<name>.provenance.json`（**不含时间戳**，N1）；启动先 `validateConfig`，有错即退出（S4）。

- [ ] **Step 1: stages 注册表** `src/stages/index.ts`（导入 5 个 stage → `STAGES: Record<string,Stage>`）。
- [ ] **Step 2: 失败测试**（同 v1：合成图 + 临时目录，跑 downscale，断言产物 + provenance 存在）。
- [ ] **Step 3 跑挂 → Step 4 实现**
```ts
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { loadRaw, saveRaw, loadPalette } from './io';
import { validateConfig } from './validate';
import { STAGES } from './stages/index';
import type { PipelineConfig, RGB } from './types';

export async function runPipeline(configPath: string, inOverride?: string, outOverride?: string){
  const config = JSON.parse(await readFile(configPath,'utf8')) as PipelineConfig;
  const errs = validateConfig(config);
  if (errs.length){ console.error('invalid config:\n- '+errs.join('\n- ')); process.exit(1); }
  const sourceDir = inOverride ?? config.sourceDir;
  const outputDir = outOverride ?? config.outputDir;
  await mkdir(outputDir, { recursive: true });
  const palette: RGB[] = config.paletteFile ? await loadPalette(config.paletteFile) : [];
  const ctx = { config, palette };
  const cfgHash = createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0,12);
  const enabled = config.stages.filter(s=>s.enabled);
  const inputs = (await readdir(sourceDir)).filter(f=>/\.(png|jpg|jpeg|webp)$/i.test(f));
  for (const file of inputs){
    let img = await loadRaw(join(sourceDir,file)); const chain:string[]=[];
    for (const s of enabled){ img = await STAGES[s.name].run(img, s as any, ctx); chain.push(s.name); }
    const stem = basename(file, extname(file));
    await saveRaw(img, join(outputDir, stem+'.png'));
    await writeFile(join(outputDir, stem+'.provenance.json'),
      JSON.stringify({ source:file, configHash:cfgHash, stages:chain }, null, 2)); // N1：无时间戳
  }
  console.log(`postprocess: ${inputs.length} images -> ${outputDir}`);
}
const args = process.argv.slice(2);
const getArg=(k:string)=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
if (getArg('--config')) runPipeline(getArg('--config')!, getArg('--in'), getArg('--out')).catch(e=>{console.error(e);process.exit(1);});
```
- [ ] Step 5 跑过 → Step 6 `tsc --noEmit` → Step 7 Commit `art-pipeline: orchestrator + runtime validate + deterministic provenance`。

---

## Task 8: 验收器 verify.ts

**Files:** Create `src/verify.ts`, `test/verify.test.ts`
**Interfaces:** 导出纯函数 `verifyImage(img,acc,palette)` + CLI `art:verify --config <path> [--out <dir>]`；检查平均亮度/色板符合度/透明底/尺寸；写 `verify-report.json`；任一失败 `process.exit(1)`（agent 据退出码判定）。逻辑/测试同 v1。
- [ ] Step 1 失败测试 → Step 2 跑挂 → Step 3 实现（同 v1 `verifyImage`+`runVerify`）→ Step 4 跑过 → Step 5 **全量回归 + 类型检查**：`cd tools/art-pipeline && npx tsc --noEmit && npx vitest run` 全绿 → Step 6 Commit `art-pipeline: acceptance verifier`。

---

## Task 9: 更新 guides/13-asset-generation.md（含 N2 失败分支）

**Files:** Modify `guides/13-asset-generation.md`
- [ ] **Step 1:** 工作流第 6 步"后处理"→ 引用确定性管线（`npm run art:postprocess`+`art:verify`），非手工 PS，给命令示例。
- [ ] **Step 2:** 修内部矛盾："后处理统一（最后手段）"→ 去背/降采样/色板量化为**强制确定性阶段**，色调归一为跨批一致手段。
- [ ] **Step 3:** 新增"## 谁来跑后处理" + 闭环图；**N2：闭环须区分两条失败分支**——verify 失败且"原图不合格"→ 回到生图步（**人**重生图）；verify 失败且"config 不当"→ **art/code** 调 config 重跑。附"agent 依 `art:verify` 退出码判定"。
- [ ] **Step 4:** "触发时机"表注明正式资产须过 `art:postprocess`+`art:verify`。
- [ ] **Step 5: Commit** `guides/13: deterministic pipeline + who-runs + human/agent failure branches`。

---

## Task 10: 更新 agent 定义 + 源真相 + 生成请求形式化（S5/S6/N3）

**Files:** Modify `.claude/agents/{art,code,director}.md` 并逐字同步 `.cursor/agents/` 对应三份；Modify `CLAUDE.md`
**前置（S6）：** 先 `git diff .cursor/agents/art.md .cursor/agents/qa.md` 查既有未提交改动；同步时**不得吞掉 `.cursor/agents/qa.md` 的"视觉统一性检查"改动**（该改动应同样回写 `.claude/agents/qa.md` 使两侧一致，并在本任务一并提交）。

- [ ] **Step 1: art.md** — 补职责：产 `docs/art/pipeline.*.config.json`+`palette.json`+`acceptance` 标准；**明确"art 不跑脚本，只定义什么叫对"**；**N3：新增"生成请求"结构化制品**——art 输出机读的生成请求块（工具/尺寸/固定前缀/反向 prompt/期望产物名），供人执行生图。
- [ ] **Step 2: code.md** — 新增"美术后处理管线"职责：实现/维护/调用 `tools/art-pipeline`；提供 `npm run art:postprocess`/`art:verify`；据退出码在生成迭代中判定；管线通用、游戏值仅来自 config。
- [ ] **Step 3: director.md** — Slice 资产任务须成对含"后处理 + 验收"，并标注人在环生图步。
- [ ] **Step 4:** 三份 `.claude → .cursor` 逐字同步 + qa.md 两侧对齐。
- [ ] **Step 5: CLAUDE.md（S5+S6）** — ①"文档层级"补：`.claude/agents/**` 为权威源、`.cursor/agents/**` 为镜像须一致；②**把"变更传播必须搜索范围"清单补上 `.cursor/agents/*.md` 与 `guides/**`**（现清单遗漏，不补则日后系统性漏镜像）；③在报告中把"Cursor 实际加载 .cursor/agents、源真相方向"标为**待人最终确认**项。
- [ ] **Step 6: Commit** `agents: pipeline responsibilities + generation-request; declare source-of-truth; fix propagation scope`。

---

## Task 11: 模板注册 + 变更传播（S5 补 .cursor）

**Files:** Modify `docs/art/asset-specs.md`、`docs/architecture.md`；两轮 Grep 传播
- [ ] **Step 1:** `asset-specs.md` 增"后处理规格位"：`pipeline.*.config.json`+`palette.json` 的位置/字段/维护者。
- [ ] **Step 2:** `architecture.md` 注册 `tools/art-pipeline/` + `npm run art:*`（构建期工具，独立于 `src/` 运行时）。
- [ ] **Step 3: 传播（管线概念）** — `rg -n "后处理|管线|art:postprocess|art:verify" .claude/agents .cursor/agents docs guides CLAUDE.md START-HERE.md`（**含 .cursor/agents**），逐个更新。
- [ ] **Step 4: 传播（双层结构概念）** — `rg -n "框架设计中|双层|dogfood|层 A|层 B" .claude/agents .cursor/agents guides START-HERE.md`，把"单一物"措辞对齐双层定位。
- [ ] **Step 5: 报告受影响文件清单**（CLAUDE.md 强制"报告"）。
- [ ] **Step 6: Commit** `templates+propagation: register pipeline, propagate dual-layer (incl .cursor mirror)`。

---

## Task 12: Dogfood 验证（层 B，满足 Slice 1 门禁 A-G3；B2/B3/S9）

**Files:** Create `docs/art/palette.json`、`docs/art/pipeline.env.config.json`、`docs/art/pipeline.sprite.config.json`（游戏特定值）
**输入：** 环境图用 `docs/art/demos/color-validation/*.png`；sprite 去背用 `docs/art/demos/entity-infiltrator/2026-07-23_094748_gpt-image-2.png`（纯黑底 sprite，验证 bgRemove/去背 → 补齐 §14.3 的"去背"环）。
**Agent 归属（S9）：** Step 1-2 由 **art**（定义色板/config/acceptance）；Step 3-5 由 **code**（跑 `npm run`）；Step 6 由 **人**（审美签核）。

- [ ] **Step 1（art）:** 从 `art-direction.md §2.2` 抽锁定色板 → `docs/art/palette.json`（`{"colors":[...四层色彩架构全部色值...]}`）。
- [ ] **Step 2（art）:** 写两份 config：
  - `pipeline.env.config.json`（环境图，**B2**）：`targetSize 32x32`；stages 顺序 **colorGrade(brightness≈0.9,saturation≈0.85,tint 冷灰,tintAmount 小) → downscale(nearest) → quantize → cropPad(padding 2)**（**B3**：grade 在 quantize 前）；`bgRemove.enabled:false`；acceptance `maxAvgBrightness:30, requireTransparentBg:false, paletteConformance:0.9, paletteTolerance:24, exactSize:[32,32]`。
  - `pipeline.sprite.config.json`（sprite）：在 env 序前加 `bgRemove(method:chroma,color:[8,10,12],threshold≈24)`；acceptance `requireTransparentBg:true`，其余同。
- [ ] **Step 3（code）:** 备输入到临时 `_sources_env/`、`_sources_sprite/`（或用 `--in`）。
- [ ] **Step 4（code）:** 分别跑
  `npm run art:postprocess -- --config docs/art/pipeline.env.config.json --in <env_src> --out <env_out>`；
  `npm run art:postprocess -- --config docs/art/pipeline.sprite.config.json --in <sprite_src> --out <sprite_out>`。
- [ ] **Step 5（code）:** 分别 `npm run art:verify -- --config <各 config> --out <各 out>`，读退出码 + `verify-report.json`。
- [ ] **Step 6（人）:** 肉眼审美签核：32px 产物是否保留裂隙/污染可读性与调性？sprite 去背是否干净？记录结论。
- [ ] **Step 7:** 结论 + 踩坑写入 `guides/98-field-notes.md`，标注需回修框架处（stage 参数/schema 缺口/量化损失等）。**满足 `art-direction §14.3` 与 `current-slice` 门禁 A-G3（环境往返 + sprite 去背均验证）。**
- [ ] **Step 8: Commit** `dogfood: run art pipeline (env+sprite) on demos, feasibility notes (Slice 1 gate A-G3)`。

---

## Self-Review（对照评审修订项复核）

**Blocker 修复：** B1 根 devDeps+根冒烟（Task 1 Step 10/11）；B2 环境/sprite 双 config + sprite 去背输入（Task 12）；B3 顺序 colorGrade→quantize + validate 守卫（Global Constraints / Task 1 Step 8 / Task 12 Step 2）。
**Should-fix：** S1 会话性质声明+Task 0；S2 `Extract<>` + strict tsconfig + `tsc --noEmit`（各代码任务）；S3 删 stage 级 paletteFile、顶层唯一来源；S4 `validateConfig` 运行时校验；S5 传播补 `.cursor/agents` + 更新 CLAUDE.md 搜索范围（Task 10/11）；S6 源真相待确认 + 保 qa.md 改动（Task 10 前置/Step 4-5）；S7 downscale `fit:'inside'`；S8 fixtures 路径/命名统一；S9 Task 12 agent 归属。
**Nice-to-have：** N1 provenance 去时间戳；N2 失败双分支（Task 9 Step 3）；N3 生成请求形式化（Task 10 Step 1）；N4 Goal 收敛为"单图往返"、多资产用多 config；N5 downscale alpha 预乘注记。
**§14.3 更正：** 现由 sprite config 的 bgRemove 真正验证"去背"，环境 config 不再误设透明要求 → §14.3 三环（降采样/量化/去背）均被覆盖。
**类型一致性：** `RawImage/StageConfig/PipelineConfig/StageContext` 于 Task 1 定义；`runPipeline/runVerify/verifyImage/validateConfig` 签名跨任务一致；`Extract<>` 统一 stage 类型。

---

## Execution Handoff

v2 已保存到 `docs/superpowers/plans/2026-07-24-art-postprocess-pipeline.md`。执行方式：
1. **Subagent-Driven（推荐）** — 每 Task 派新 subagent，任务间两段式评审。
2. **Inline 执行** — 本会话按 checkpoint 批量执行。
