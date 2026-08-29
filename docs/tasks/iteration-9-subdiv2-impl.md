---
status: ACTIVE
created-by: director agent
created-when: 2026-08-29
last-modified: 2026-08-29
note: 迭代 9（DEC-105）I9-LAB8 施工规格：subdiv2「光场细分带」——从 subdiv（8 层线性插值带）出发，带半径改取参考光场等照线（16 层），补「连续光质感 + 强弱光结合」两个 feature。红线同 iteration-9.md。**2026-08-29 晚人终审拍板：选中 subdiv2 + teal 软内缘，16→32 层，直接结案——结案实施计划见文末同名章节（DEC-107）。**
---

# I9-LAB8 施工规格：subdiv2（光场细分带）

上游：合同 `docs/tasks/iteration-9.md`；根因诊断与本方案设计 = director 报告（2026-08-29，field 阴影偏移三层根因：墙脚积光楔形亮刺 / 拐角溢光不查遮挡 / 光场纹理拥有形状的结构性错配）。本文件是 code agent 的唯一施工依据；数值不许自行发挥。

**一句话方案**：保留 subdiv 的骨架（每层带 = 射线裁剪多边形，顶点 = `min(命中墙距离, 层半径)`，阴影严格贴墙），只换层半径来源——从「核心→外缘线性插值」换成「参考光场的等亮度线轮廓，被射程曲线夹取」。参考光场 = field 模式同一套曲线（`FIELD_FLASH_STOPS` / `FIELD_LAMP_STOPS` / 肩部 smoothstep / `smoothLanding` 着陆窗），即用户认可的光质感来源，只是从「纹理」改道「带半径」进入画面。

---

## 0. 共存与冻结边界（先读）

**`subdiv2` 是 `VisionMaskStyle` 的新增成员，不替换 `subdiv`。** 改后：

```typescript
export type VisionMaskStyle = 'bands' | 'subdiv' | 'subdiv2' | 'field' | 'field-dim' | 'bayer';
```

共存的关键：`isFieldStyle()`（`src/systems/visibility-system.ts` 1942-1944 行）**不包含** `subdiv2`，且本批**不得**把它加进去。这一个判定把 field 路线的全部机器关在门外：

- `update()` 的 field 分支（512-521 行：`castFieldStencil` / `scanFieldCorners` / `scanCorruptionAnchors`）——subdiv2 不进入；
- `create()` 的 `ensureFieldObjects()`（483 行）、`drawMask` 的 `drawFieldMask` 分支（1150-1153 行）、`drawCorruption` 的 `drawCorruptionIsolux` 分支（1612-1615 行）——subdiv2 不进入；
- `drawFieldWallAo` / `stampFieldCornerBleed` / `scanFieldCorners` / `isFieldConvexCorner` / `fillCornerBleed` / `scanFieldIsoluxPair` / `fillVisionField` ——只被上述路径调用，对 subdiv2 不可达。

**冻结清单（一行都不许碰）**：`drawFieldMask`、`drawFieldWallAo`、`stampFieldCornerBleed`、`scanFieldCorners`、`isFieldConvexCorner`、`fieldCellKind`、`castFieldStencil`、`drawCorruptionIsolux`、`scanCorruptionAnchors`、`smoothCorruptionFront`、`ensureCorruptionClipMask`、`redrawCorruptionClip`、`ensureFieldObjects`、`ensureCornerBleedImage`、`fillCornerBleed`、`fillVisionField`、`scanFieldIsoluxPair`、`fieldTextureKey`、`isFieldStyle`、全部 `FIELD_*` / `CORRUPTION_ISO_*` / `BAYER_*` 常量。field / field-dim / bayer 三模式在 gym 里仍可按键对照（冻结留作反面教材），出击默认永远是 `bands`。

subdiv2 与 field 路线唯一的接触面是**只读复用纯函数** `fieldVisibilityAt`（曲线定义本身不改）。与 subdiv v1 的共享只有三处泛化（`bandCountForStyle` 加 case、`drawMask` switch 加 case、`buildPolygons` 主循环加并列分支）加一个抽出的共用绘制函数 `drawBandStack`——v1 的擦除 alpha、循环顺序、多边形来源逐像素不变。

---

## 1. `src/systems/vision-textures.ts`（全部新增，零修改既有代码）

### 1.1 新增常量（放在 `SUBDIV_PROFILE_STOPS` 之后，约 262 行后）

```typescript
/** Subdiv2 mode: nested band count (16 vs subdiv's 8). */
export const SUBDIV2_BAND_COUNT = 16;

/**
 * Subdiv2 mode: zone visibility at each band contour, descending. Band k's
 * radius is where the reference light field (FIELD_FLASH_STOPS x
 * FIELD_LAMP_STOPS via fieldVisibilityAt) falls to levels[k] along that ray -
 * the field's isolux contours, quantized. Dense at the dark end, where the
 * eye is most sensitive to steps. levels[0] = 1: the full-erase core.
 */
export const SUBDIV2_LEVELS: readonly number[] = [
  1.0, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.45, 0.38, 0.31, 0.25, 0.19, 0.14, 0.1, 0.06, 0.03,
];

/**
 * Subdiv2: the isolux walk starts here, so directions where the field never
 * reaches a level collapse to a 4px disc instead of a degenerate polygon.
 * Matches MIN_HIT_DIST in visibility-system.ts.
 */
export const SUBDIV2_BAND_FLOOR_PX = 4;
```

数值依据：相邻级别最大台阶 0.08（亮端），暗端 0.03–0.10 加密；16 层是「看不出带」与「每帧 16 次 fillPoints+erase」的平衡点。

### 1.2 新增 `computeLevelEraseAlphas`（望远镜擦除公式）

```typescript
/**
 * Subdiv2: per-polygon erase strengths for a nested stack whose zone visibility
 * just inside band k must equal levels[k] (descending, levels[0] = 1). Erase
 * compounds multiplicatively (outermost drawn first), so
 * alphas[k] = 1 - (1 - levels[k]) / (1 - levels[k+1]) with levels[N] = 0.
 * Equivalent to computeNestedEraseAlphas with a profile pinned exactly at the
 * levels; written directly to avoid stop-table sampling drift.
 */
export function computeLevelEraseAlphas(levels: readonly number[]): Float32Array {
  const count = levels.length;
  const alphas = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const next = k + 1 < count ? levels[k + 1]! : 0;
    const residualHere = 1 - levels[k]!;
    const residualNext = 1 - next;
    alphas[k] = residualNext > 0 ? clamp(1 - residualHere / residualNext, 0, 1) : 1;
  }
  return alphas;
}
```

自核值：`alphas[0] = 1`；`alphas[15] = 0.03`；`alphas[14] ≈ 0.0309`。

### 1.3 新增 `computeFieldBandRadii`（核心：等照线取带半径 + 越界带插值）

签名（写入预分配缓冲，与 `scanFieldIsoluxPair` 同一模式，重建帧零分配）：

```typescript
/**
 * Subdiv2: per-ray band radii = the reference field's isolux crossings, clamped
 * to the ray's range curve. One outward walk per ray: levels are descending and
 * the field falls monotonically, so crossings come out non-decreasing.
 *
 * Tail rule: crossings beyond the ray's range (the field's shoulder shelf would
 * otherwise stack N bands on the range edge and leave a hard visibility cliff,
 * or worse, leak past it) are replaced by an even spread between the last
 * in-range crossing and the range. The outermost band is ALWAYS exactly the
 * range - the silhouette is the production range curve, point for point.
 *
 * `params` radii must be pre-scaled by radiusScale; `rayRanges` are the cached
 * per-ray effective ranges (same scaling). Writes out[band][ray].
 */
export function computeFieldBandRadii(
  levels: readonly number[],
  rayOffsets: Float32Array,
  rayRanges: Float32Array,
  params: VisionFieldParams,
  floorPx: number,
  out: Float32Array[],
  stepPx = 1,
): void
```

算法（逐字施工规范）：

```typescript
const bandCount = levels.length;
const crossings = new Float64Array(bandCount); // 每次调用一次分配，可接受
for (let i = 0; i < rayOffsets.length; i++) {
  const theta = rayOffsets[i]!;
  const range = rayRanges[i]!;
  // 1) 地板处已低于的级别：crossing = floorPx（背光侧高位的 1.0..0.68 走这里）
  let band = 0;
  const vis0 = fieldVisibilityAt(theta, floorPx, params);
  while (band < bandCount && vis0 < levels[band]!) {
    crossings[band] = floorPx;
    band++;
  }
  // 2) 单次外走，线性插值出亚像素 crossing
  let prevVis = vis0;
  for (let r = floorPx + stepPx; r <= params.radiusForward && band < bandCount; r += stepPx) {
    const vis = fieldVisibilityAt(theta, r, params);
    while (band < bandCount && vis < levels[band]!) {
      const t = clamp((prevVis - levels[band]!) / Math.max(prevVis - vis, 1e-6), 0, 1);
      crossings[band] = r - stepPx + t * stepPx;
      band++;
    }
    prevVis = vis;
  }
  while (band < bandCount) crossings[band++] = params.radiusForward; // 兜底，实际不可达（field 在 radiusForward 处恒为 0）
  // 3) 射程夹取 + 插值尾巴
  let j = 0;
  while (j < bandCount && crossings[j]! < range) j++;
  const anchor = j > 0 ? crossings[j - 1]! : floorPx;
  for (let k = 0; k < bandCount; k++) {
    let rho: number;
    if (k < j) rho = Math.max(crossings[k]!, floorPx);
    else if (k < bandCount - 1) rho = anchor + ((range - anchor) * (k - j + 1)) / (bandCount - j);
    else rho = range; // 末层强制 = 射程曲线（红线）
    out[k]![i] = rho;
  }
}
```

**「各向异性怎么来」的明确回答**：不分开造 f_lamp / f_cone 两条曲线。各向异性由 `fieldVisibilityAt` 内部的方向混合天然给出——锥内方向的等照线跟手电曲线（满亮平台到 152px，224px 前着陆归零），环身方向跟灯曲线（峰值 0.62，62px 着陆、80px 归零），肩部由 50°→80° 的 smoothstep 光滑混合。

**越界带插值公式**（肩部示例复核）：j = 首个 `crossings[j] >= range` 的下标；带 k ∈ [j, N−2] 的半径 = `anchor + (range − anchor) × (k − j + 1) / (N − j)`，其中 anchor = `crossings[j−1]`；带 N−1 = range。65° 方向：j = 7，anchor ≈ 74.4，range = 152，N = 16 → 带 7 ≈ 83.0，带 14 ≈ 143.4，带 15 = 152。

### 1.4 三个方向的逐带参考半径表（scale = 1，code agent 自核用）

| 带 k | 级别 ℓ | 正前方 0°（range 224） | 肩部 65°（range 152） | 正后方 180°（range 80） |
| --- | --- | --- | --- | --- |
| 0 | 1.00 | ≈152.3 | 4（塌缩） | 4（塌缩） |
| 1 | 0.92 | ≈157.3 | 4（塌缩） | 4（塌缩） |
| 2 | 0.84 | ≈162.4 | 4（塌缩） | 4（塌缩） |
| 3 | 0.76 | ≈167.4 | ≈42.9 | 4（塌缩） |
| 4 | 0.68 | ≈172.4 | ≈58.2 | 4（塌缩） |
| 5 | 0.60 | ≈176.7 | ≈67.5 | ≈11.4 |
| 6 | 0.52 | ≈180.6 | ≈74.4 | ≈42.9 |
| 7 | 0.45 | ≈187.5 | ≈83.0（插值） | ≈49.6 |
| 8 | 0.38 | ≈193.1 | ≈91.6（插值） | ≈56.3 |
| 9 | 0.31 | ≈196.9 | ≈100.3（插值） | ≈63.0 |
| 10 | 0.25 | ≈199.5 | ≈108.9（插值） | ≈66.0 |
| 11 | 0.19 | ≈203.0 | ≈117.5（插值） | ≈67.4 |
| 12 | 0.14 | ≈205.5 | ≈126.1（插值） | ≈69.0 |
| 13 | 0.10 | ≈207.9 | ≈134.8（插值） | ≈69.8 |
| 14 | 0.06 | ≈210.8 | ≈143.4（插值） | ≈71.0 |
| 15 | 0.03 | **224（强制）** | **152（强制）** | **80（强制）** |

（手算参考值，允许 ±1px 误差；形状性质必须严格成立：带半径对 k 单调不减；末层 = range；锥内 152px 内满亮平台；背光 48px 内塌缩到地板。）

### 1.5 有意的语义变化（交付说明必须包含）

**背光半球脚下 48px 内，渲染可见度从灯曲线峰值 0.62 起**（继承 field 模式的「弱灯」读法，用户已认可该光质感），而不是 subdiv v1 的 1.0 全亮核。权威查询 `getVisibilityAt` 的 48px / 1.0 保证**不动**（实体仍按查询 alpha 渲染，反而比地面更亮、更易读；规则 23 不破——渲染比规则暗是安全方向）。

**回退旋钮**：若人终审否决该读法，把 `SUBDIV2_BAND_FLOOR_PX` 换成 `config.minSolidRadius`（48）——背光 48px 恢复全亮核，代价是 48px 处出现 1.0→0.45 的硬环，届时再议。本批不做。

---

## 2. `src/systems/visibility-system.ts`（6 处修改 + 2 个新方法 + 1 处注释）

| # | 位置（当前行号） | 动作 | 内容 |
| --- | --- | --- | --- |
| 2.1 | import 块（29-53） | 修改 | 从 `@/systems/vision-textures` 增导 `SUBDIV2_BAND_COUNT`、`SUBDIV2_LEVELS`、`SUBDIV2_BAND_FLOOR_PX`、`computeFieldBandRadii`、`computeLevelEraseAlphas` |
| 2.2 | 类型定义（62-70） | 修改 | 联合类型加 `'subdiv2'`；doc 注释补一句：「`subdiv2`：16 层等照线带——带半径取自参考光场等照线、逐射线被墙与射程曲线夹取，阴影贴墙性质与 `subdiv` 相同」 |
| 2.3 | spike 状态字段（320 行附近，`subdivAlphas` 旁） | 新增 | `private subdiv2Radii: Float32Array[] \| null = null;` / `private subdiv2Alphas: Float32Array \| null = null;` / `private subdiv2RadiiDirty = true;` |
| 2.4 | `bandCountForStyle`（793-803） | 修改 | 加 `case 'subdiv2': return SUBDIV2_BAND_COUNT;` |
| 2.5 | `allocatePolygonBuffers`（809-830） | 修改 | 末尾加：`if (this.maskStyle === 'subdiv2') { this.subdiv2Radii = []; for (let b = 0; b < bandCount; b++) this.subdiv2Radii.push(new Float32Array(this.rayCount)); this.subdiv2RadiiDirty = true; }`（`setRayCounts` 与 `setMaskStyle` 两个入口都覆盖；性能降级到 28+12 射线时表随之重建） |
| 2.6 | `setRadiusScale`（549-554） | 修改 | `this.cacheValid = false;` 后加 `this.subdiv2RadiiDirty = true;` |
| 2.7 | `buildPolygons`（1004-1107） | 修改 | (a) 主循环（1052）之前、field 早退块（1018-1050）之后插入 `if (style === 'subdiv2') this.ensureSubdiv2Radii();`；(b) 在 subdiv 分支（1065-1071）之后插入并列分支（代码见 2.9） |
| 2.8 | `drawMask` switch（1146-1169） | 修改 | 加 `case 'subdiv2': this.drawSubdiv2Bands(); break;` |
| 2.9 | `drawSubdivBands`（1181-1192） | 修改 | 抽出共用 `drawBandStack(alphas)`；新增 `drawSubdiv2Bands`（代码见 2.10） |
| 2.10 | `destroy`（727-769） | 修改 | spike 状态清理处加 `this.subdiv2Radii = null; this.subdiv2Alphas = null;` |
| 2.11 | `drawCorruption`（1611-1615 附近） | 零行为改动 | 只补一行注释：「subdiv2 的 soft 走 v3 几何环——其末层带与环带共用同一组 `rayDist`/`rayRange`，环与遮罩外缘天然对齐」 |

**`setMaskStyle`（574-583）不需要改**：现有函数体已调用 `allocatePolygonBuffers()`（2.5 挂钩生效）；`isFieldStyle('subdiv2')` 为假所以不建 field 对象；非 bayer 所以不建 punch。`create()` 重进入口（483-484）同理不加分支（subdiv2 无任何纹理对象）。

### 2.9(b) `buildPolygons` 新分支代码

```typescript
      if (style === 'subdiv2') {
        const radii = this.subdiv2Radii;
        if (!radii) continue; // 缓冲未就绪的理论空窗；下一帧恢复
        for (let band = 0; band < bandCount; band++) {
          const rho = band === bandCount - 1 ? outer : radii[band]![i]!;
          this.writePoint(this.polygons[band]!, i, cos, sin, Math.min(hitDist, rho));
        }
        continue;
      }
```

三条施工纪律：(1) `min(hitDist, rho)` 与 subdiv 同构——**每层带逐射线被墙截断，这是阴影贴墙性质的来源，不可省**；(2) 末层用 `outer`（= `max(range + jitter, minSolidRadius)`，1059-1060 行已有），混乱抖动只作用于外轮廓，与 v1 行为一致；(3) 表内半径已含 `radiusScale`（见 2.12），这里不再乘。

### 2.12 新方法 `ensureSubdiv2Radii`

```typescript
  /**
   * Subdiv2: per-ray isolux band radii, rebuilt only when inputs change (mask
   * style / ray counts / radius scale). Reads `rayRange`, so it must run after
   * `castRays` on rebuild frames - buildPolygons is always after it.
   */
  private ensureSubdiv2Radii(): void {
    if (!this.subdiv2RadiiDirty || !this.subdiv2Radii) return;
    const config = this.config;
    computeFieldBandRadii(
      SUBDIV2_LEVELS,
      this.rayOffsets,
      this.rayRange,
      {
        radiusForward: config.radiusForward * this.radiusScale,
        radiusAmbient: config.radiusAmbient * this.radiusScale,
        coneHalfAngleDeg: config.coneHalfAngleDeg,
        coneFalloffAngleDeg: config.coneFalloffAngleDeg,
      },
      SUBDIV2_BAND_FLOOR_PX,
      this.subdiv2Radii
    );
    this.subdiv2RadiiDirty = false;
  }
```

`lampStops` / `flashStops` 缺省 = `FIELD_LAMP_STOPS` / `FIELD_FLASH_STOPS`（用户认可的那套曲线）；scale 预乘有 `scanCorruptionAnchors`（1803-1809 行）同款先例。

### 2.10 绘制泛化代码

```typescript
  /** Subdiv spike: N nested polygons whose erase strengths sample a smooth profile. */
  private drawSubdivBands(): void {
    if (!this.subdivAlphas) {
      this.subdivAlphas = computeNestedEraseAlphas(SUBDIV_BAND_COUNT, SUBDIV_PROFILE_STOPS);
    }
    this.drawBandStack(this.subdivAlphas);
  }

  /**
   * Subdiv2 spike: 16 nested isolux bands. Same nested-erase machinery as
   * subdiv; only the per-ray radii differ (light-field contours, wall- and
   * range-clipped), so shadows stay wall-hugging exactly like subdiv.
   */
  private drawSubdiv2Bands(): void {
    if (!this.subdiv2Alphas) {
      this.subdiv2Alphas = computeLevelEraseAlphas(SUBDIV2_LEVELS);
    }
    this.drawBandStack(this.subdiv2Alphas);
  }

  /** Outermost first: erases compound to the target zone visibilities. */
  private drawBandStack(alphas: Float32Array): void {
    for (let band = alphas.length - 1; band >= 0; band--) {
      const graphics = this.bandGraphicsAt(band);
      graphics.clear();
      graphics.fillStyle(0xffffff, alphas[band]!);
      graphics.fillPoints(this.polygons[band]!, true);
      this.mask.erase(graphics);
    }
  }
```

`bandGraphicsAt`（1173-1178）惰性扩容到 16 个 Graphics，只在首次切换时增长，每帧零分配。性能：16 次 fillPoints+erase vs v1 的 8 次，低于 field 模式的 RT 合成开销；`BUDGET_MS` 2ms 预算与两级降级不动。

---

## 3. 青绿侵蚀 soft 在 subdiv2 下的锚定（零改动 + 后手登记）

**本批做法：v3 几何环，零代码改动。** `drawCorruption` 1612 行 `soft && isFieldStyle(...)` 对 subdiv2 为假，自然落到 v3 路径（1631-1682 行：20 层 sub-ring + `corruptionSoftProfile` 双端零斜率 + 44px 外尾 + 灰化色 0.4 混 void + 峰值 0.7）。「挂到各向异性带上」不需要做任何事：v3 环带的空间边界本来就是 `corruptionInner`（`rayRange × (1 − depthFraction)` 与 `rayDist` 取小）和外缘 `min(rayDist, rayRange)`——而 subdiv2 的末层带恰好也是同一组 `rayDist`/`rayRange`（末层强制 = range，顶点 = `min(hitDist, rho)`），**环带与遮罩外缘逐射线同源，天然对齐**。

I9-LAB5/6/7 修好的四个性质是 field-isolux 路径的属性；v3 路径的等价性质在 subdiv2 下原样成立，逐条对应：

| field-isolux 路径的修复性质 | subdiv2 + v3 下的等价保证 |
| --- | --- |
| 尾巴不穿墙 | 1650-1652 行：外缘 = `min(rayDist, rayRange)`，墙比带近则整条射线抑制；尾巴 44px 只在带存在的射线上加（1657-1660） |
| 被视野多边形裁剪 | 环带内外缘都从 `rayDist`/`rayRange` 构造，与遮罩末层同一数据源 |
| 前锋平滑 | `corruptionSoftProfile` 双端零斜率（159-167 行），无硬线 |
| 贴墙渐隐 | 内缘 `corruptionInner` 逐射线被 `rayDist` 夹住（1685-1689 行） |

用户在 gym 图 1/2 接受的 teal 形态正是 subdiv + v3 这条路径，subdiv2 下读法不变。

**后手（登记在案，本批不实现）**：若人试玩后要求 teal 前锋「贴着光走」（field-isolux 读法），把前锋锚到带半径表第 8 行（ℓ = 0.38 等照线，每射线一个数，已贴墙、已被射程夹、单调），尾巴沿级别序列向外渐隐。届时单开一小批，复用 `subdiv2Radii[8]` 即可，四个性质由表的构造自动继承。

---

## 4. `src/gym/gym-vision-lab-scene.ts`（5 处修改）

| # | 位置 | 内容 |
| --- | --- | --- |
| 4.1 | 文件头注释（第 4 行） | `keys 1-5` → `keys 1-6` |
| 4.2 | `MASK_STYLES`（36 行） | `['bands', 'subdiv', 'subdiv2', 'bayer', 'field', 'field-dim']` —— 键位：1 现状 / 2 细分带 v1（旧对照）/ **3 subdiv2（新方案）** / 4 抖动坡 / 5 光场 v3 / 6 光场 v3′。数字键 handler（140-147 行）不改（`Digit6` → index 5 自然成立） |
| 4.3 | `MODE_LABEL`（38-44） | 加 `subdiv2: '光场细分带 · 16 层等照线（贴墙 + 强弱光，新方案）'`；`subdiv` 改 `'细分带 v1 · 8 层线性插值（旧对照）'`；`field` 改 `'光场 v3 · 弱灯×强手电（冻结：阴影不贴墙）'`；`'field-dim'` 改 `'光场 v3′ · 灯再弱一档（冻结对照）'`；`bands` / `bayer` 不变。（`Record<VisionMaskStyle, string>` 会被 tsc 强制要求补全新成员，这也是闸门之一） |
| 4.4 | 深链解析（68-74） | 联合判断加 `mode === 'subdiv2' \|\|` |
| 4.5 | 侧栏 roster（181-185） | 五条模式行替换为六条，与 4.2 键位一致；T 行（187）不变 |

---

## 5. `tools/vision/check-vision-energy.ts`（能量平价闸门）

现有三项（噪声 0.90–1.10× 基准 59.3、灯盘 / 手电盘 0.85–1.05× 基准 0.360 / 0.333）**不受影响**——本方案不烤任何纹理、不动灯/手电 ADD 叠加层，它们必须原样通过。

**新增「带栈平价」一节**（追加在最终 PASS 日志之前）。新增导入：从 `vision-textures` 导 `SUBDIV2_LEVELS`、`SUBDIV2_BAND_FLOOR_PX`、`computeFieldBandRadii`、`SUBDIV_BAND_COUNT`、`SUBDIV_PROFILE_STOPS`、`sampleStopAlpha`；从 `../../src/config/constants.ts` 导 `GAME_CONSTANTS`（该文件无依赖，可安全引入——**闸门必须钉住红线真值，禁止在脚本里手抄 224/80/50/30**）。

### 5.1 对拍扇区构造（逐字规范）

```
合成生产射线扇，角度分布与 VisibilitySystem.buildRayOffsets 相同：
  前向 40 条：theta_i = −80° + 160°·i/39，i = 0..39（锥半角 50° + 过渡 30° = 半幅 80°）
  环身 20 条：step = 200°/21，theta = 80° + step·(i+1)，i = 0..19
逐射线射程（镜像 getEffectiveRadius，scale = 1，cone 模式）：
  |theta| ≤ 50° → 224；|theta| ≥ 80° → 80；其间 smoothstep 插值
逐射线面积加权平均可见度 = Σ_k v_k·(r_k² − r_{k−1}²) / range²（末带之外贡献 0）
```

三种方案的逐射线半径与区间可见度：

- **bands（生产）**：`bw = clamp((range−48)/2, 0, 32)`，`core = max(range−2·bw, 48)`；半径 `[core, range−bw, range]`，区间可见度 `[1.0, 0.6, 0.2]`。
- **subdiv v1**：半径 `core + (range−core)·k/7`（k = 0..7），区间可见度 `sampleStopAlpha(max(0, (k−0.5)/7), SUBDIV_PROFILE_STOPS)`。
- **subdiv2**：半径 = `computeFieldBandRadii(SUBDIV2_LEVELS, offsets, ranges, { radiusForward: 224, radiusAmbient: 80, coneHalfAngleDeg: 50, coneFalloffAngleDeg: 30 }, SUBDIV2_BAND_FLOOR_PX, out)`（scale 1，缺省 stops），区间可见度 = `SUBDIV2_LEVELS[k]`。

### 5.2 钉哪些扇区、阈值、预期值

| 分区 | 定义 | 闸门 / 报告 | 预期值 |
| --- | --- | --- | --- |
| 全量程扇区 | 40 条前向射线中 \|theta\| ≤ 50° 的 24 条 | **闸门：subdiv2 / bands ∈ [0.85, 1.15]** | subdiv2 ≈ 0.667，bands ≈ 0.678，比值 ≈ 0.98 |
| 锥扇区（含肩） | 全部 40 条前向射线 | 只报告 | 比值 ≈ 0.89（肩部按设计变暗） |
| 环身扇区 | 20 条环身射线 | 只报告 | 比值 ≈ 0.5（弱灯特性，有意变暗） |
| 全扇平均 | 60 条无权平均 | 只报告，vs bands 与 vs v1 各打一行 | ≈ 0.7–0.75 |

**为什么闸门只钉全量程扇区**：「迷雾下亮度人终审 PASS 不回退」针对的是主光区可读亮度；环身与肩部变暗正是用户亲点的「暖灯偏弱、手电偏强」特性本身——禁止该特性的闸门是装反的闸门。若全量程扇区比值出界：先调 `SUBDIV2_LEVELS`（暗端加密/减稀），**禁止**碰射程曲线与 stops。

脚本头部注释补一行带栈平价说明；`npm run check:vision-energy` 入口不变。

---

## 6. 文档登记（收尾四项相关部分，随本批同交）

1. `docs/dev/gym.md`：第 42 行与第 96-101 行的键位清单更新为 1–6（与 4.2 一致），深链 mode 集合加 `subdiv2`。
2. `docs/art/rift-vision-presentation.md` 的「spike 分支语义登记」：追加一条 2026-08-29 条目——subdiv2 语义（16 层等照线带；带半径 = 参考光场等照线被射程曲线夹取、越界带在「最后合法带—射程边」间均匀插值；末层强制 = 射程曲线；**背光脚下随灯曲线偏暗是继承 field 的有意读法**，查询的 48px/1.0 不动；soft 侵蚀走 v3 几何环；field/field-dim/bayer/isolux 路径冻结保留），标注「code 已交，画面等人终审」。
3. spec 判断：本批是 spike 分支并列候选，生产默认 `bands` 不变，`system-movement-vision.md` 不动；若人终审选中 subdiv2 转生产，届时按收尾四项原地更新 spec。
4. 架构登记：无新增模块（全部在既有两个文件内部），`architecture.md` 不动。

---

## 7. 闸门、预算与不做清单

**机器闸门**：`npx tsc --noEmit` 全绿（`Record<VisionMaskStyle, string>` 强制 gym 标签补全）+ `npm run check:vision-energy` 全绿（旧三项 + 新带栈闸门）。**逃逸兜底**：同一任务连续 2 次不过闸门 → 停止重试，升 T1 重做并记 `guides/98-field-notes.md`。**循环预算**：级别表 / 层数微调最多 3 轮，到顶未收敛升级给人。

**本批不做**：

- teal 前锋锚带（第 3 节后手）；
- Bayer 带边界打散、24 层升级（两个旋钮，人试玩说「还看得出带」再动）；
- field 分支的任何「修复」（路线已放弃，冻结而非修补）；
- 把 subdiv2 设为出击默认（人终审拍板前，`bands` 永远是出击默认）；
- 第 1.5 节语义变化的回退（旋钮仅登记）。

**红线自查**：射程 224/80、锥角 50°+30°、三档 1.0/0.6/0.2 与 `ERASE_ALPHAS`、规则 4 朝向、薪柴不发光、混乱缩放、相机、不加迷雾外信息（所有带被射程曲线夹住，比 field 更严）、`getVisibilityAt` 逻辑渲染一致（查询零改动）、性能预算（静止缓存 / 2ms 降级 / 无每帧分配）——逐项不碰。

**人终审试玩路径**：`npm run gym` → `gym.html?lesson=vision-lab&mode=subdiv2`（课内按 3），按 2 切回旧细分带对照，T 开关 teal。要回答的问题只有一个：**16 层等照线带是否读出了「连续的光」+「暖灯弱、手电强」，且阴影仍然贴墙。**

---

# 结案实施计划（2026-08-29 晚人终审拍板）

人终审结论原文：「很不错，不过 16 层还略有分层感，搞成 32 层吧，然后直接结案+提交。」这就是合同第 42 行的「人抽完拍板」：**选中分支 = subdiv2 遮罩 + teal 软内缘（人终审看图时就是这组组合：gym 键 3 + T 第三态），层数 16→32，随后结案并提交。**

本章节是结案批的唯一施工依据。行号均为 2026-08-29 当前工作区快照（含未提交的 I9-LAB8 改动），**以符号名为准、行号为锚**。两个 commit：① 32 层小改 + 截图；② 翻默认 + 大删除 + 文档 + 闸门改写（结案主体）。

## C1. 32 层规格

### C1.1 常量改动（`src/systems/vision-textures.ts`，仅两行）

```typescript
/** Subdiv2 mode: nested band count (32 vs subdiv's 8). */
export const SUBDIV2_BAND_COUNT = 32;

export const SUBDIV2_LEVELS: readonly number[] = [
  // 亮端 8 档（等距 0.04，保核心饱满）
  1.0, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72,
  // 中段 10 档（主衰减区，0.04 → 0.035）
  0.68, 0.64, 0.6, 0.56, 0.52, 0.485, 0.45, 0.415, 0.38, 0.345,
  // 暗端 14 档（加密：人眼对暗部台阶最敏感，且参考场在暗端半径变化最快、等照线间距最大）
  0.31, 0.28, 0.25, 0.22, 0.19, 0.165, 0.14, 0.12, 0.1, 0.08, 0.06, 0.045, 0.03, 0.015,
];
```

分布理由一句话：16 层版最大台阶 0.08 在亮端、暗端 0.03–0.10，人指出的「略有分层感」由台阶大小决定，32 层把最大台阶压到 0.04、暗端压到 0.015–0.03，同一参考光场、同一外轮廓，纯量化加密。`SUBDIV2_BAND_FLOOR_PX` / `computeLevelEraseAlphas` / `computeFieldBandRadii` 与层数无关，零改动。望远镜公式自核：`alphas[0] = 1`，`alphas[31] = 0.015`。

### C1.2 性能自查（已核实代码路径，code agent 复核一遍即可）

- **等照线半径表只在输入变化时重算。** `subdiv2RadiiDirty` 置位路径全项目只有两处：`setRadiusScale`（`visibility-system.ts` 564，混乱缩放变化）与 `allocatePolygonBuffers`（848，由 `setRayCounts` 性能降级 / `setMaskStyle` 调用；结案后 setMaskStyle 删除，剩降级一处）。**移动 / 转向 / 重建帧都不重算**——`rayRange` 只依赖射线角偏移与 scale，与位置无关；墙截断在 `buildPolygons` 的 `min(hitDist, rho)` 里每帧应用，不需要动半径表。✓
- **重算帧成本**：60 射线 × 一次外走（≤224 步，步长 1px）× 每步一次 `fieldVisibilityAt`；内层 while 每射线总共只前进 32 次。与 16 层同量级（16 层实测含 field 分支行走重建帧 avg 0.24ms，远低于 2ms 预算）。✓
- **每帧绘制成本**：32 ×（clear + fillPoints(60 顶点) + erase），低于已删除 field 模式的 RT 合成开销（2 次 RT clear + draw + erase + AO + 溢光）。`BUDGET_MS` 2ms 预算只计射线时间，不动；静止缓存与两级降级不动；update/render 路径零每帧分配（`bandGraphicsAt` 惰性增长只在首次绘制，结案后改 create 预分配 32 个，见 C2.2）。✓
- **能量平价预期**：望远镜公式保证任意层数下带 k 内残余 = `levels[k]` 精确成立；32 层是同一参考场的更密采样，全量程扇区面积加权均值预计仍 ≈ 0.667 vs bands 0.678，比值 ≈ 0.98，落 [0.85, 1.15]。出界 = 施工错误，停并回 director，**禁止**为凑闸门改级别表以外的任何东西。

## C2. 出击翻默认 + 分支下线（合同第 42 行）

**拍板（director）：`VisionMaskStyle` 与 `CorruptionEdgeStyle` 两个机制整个移除，不留单成员联合类型。** 依据：只剩一个成员时，联合类型 + setter + switch 是没有 alternatives 的间接层；vision-lab 课删除后全项目没有任何运行时调用方（grep 证实：类型与两个 setter 只被 `gym-vision-lab-scene.ts` 与 `visibility-system.ts` 自身引用；`rift-scene.ts` 只 import `createRiftVisionConfig` + `VisibilitySystem`，从未调 `setMaskStyle`）；git 保留全部历史，不存在「以防万一」的保留理由。subdiv2 成为唯一遮罩路径，teal 软内缘（v3 几何环）成为唯一侵蚀路径。

### C2.1 `src/systems/visibility-system.ts` 删除清单（逐符号）

**类型与机制：**
- `VisionMaskStyle`（77）、`CorruptionEdgeStyle`（80）两个类型
- `setMaskStyle`（585-594）、`getMaskStyle`（603-605）、`setCorruptionEdge`（597-601）
- 字段 `maskStyle`（325）、`corruptionEdge`（326）
- `isFieldStyle`（2019-2021）、`fieldTextureKey`（2023-2025）、`bayerPunchKey`（2027-2029）

**字段：**
- `subdivAlphas`（327）
- `fieldImage` / `fieldScratch` / `stencilScratch`（331-333）
- `bayerPunches`（334）
- `stencilDist` / `stencilRange`（341-342）
- `corruptionFront` / `corruptionDarkEdge` / `corruptionFrontScratch`（344-348）
- `isoluxNeedsScan`（350）
- `cornerBleedImage` / `fieldCornerX` / `fieldCornerY` / `fieldCornerD2` / `fieldCornerCount`（352-356）
- `ditherRingGraphics` / `ditherPunch` / `ditherScratch`（318-322；三个消费者 bands dither / field AO / bayer 全部删除后无引用）
- `shrunkPolygons` / `rangeEdge`（294-296；只服务 bands/bayer 的收缩填充与 dither 环）
- `ringScratchA` / `ringScratchB`（1498-1499）

**方法（整函数删除）：**
- `bandCountForStyle`（806-818）——删除后 `allocatePolygonBuffers` 直接用 `SUBDIV2_BAND_COUNT`
- `castFieldStencil`（934-967）
- `drawSubdivBands`（1240-1245）
- `drawFieldMask`（1277-1304）、`drawFieldWallAo`（1313-1341）、`stampFieldCornerBleed`（1344-1354）
- `scanFieldCorners`（1362-1402）、`fieldCellKind`（1407-1418）、`isFieldConvexCorner`（1420-1436）
- `drawBayerBands`（1443-1453）、`eraseBayerSlope`（1455-1496）、`ringVertex`（1502-1514）
- `ensureFieldObjects`（1521-1561）、`ensureCornerBleedImage`（1564-1581）、`ensureBayerPunches`（1588-1609）
- `eraseDitherRing`（1616-1640）
- `drawCorruptionIsolux`（1777-1853）、`scanCorruptionAnchors`（1862-1910）、`smoothCorruptionFront`（1916-1946）、`ensureCorruptionClipMask`（1948-1953）、`redrawCorruptionClip`（1960-1978）
- 文件级函数 `fillCornerBleed`（2032-2054）、`ensureDitherPunchTexture`（2075-2087）、`smoothstep01`（161-164；唯一消费者是 fillCornerBleed）

**顶部常量：**
- 删：`CORRUPTION_ISO_RINGS` / `CORRUPTION_ISO_FRONT_BLUR_RADIUS` / `CORRUPTION_ISO_FRONT_BLUR_PASSES` / `CORRUPTION_ISO_FRONT_FLOOR_PX` / `CORRUPTION_ISO_DARK_THRESHOLD` / `CORRUPTION_ISO_OUTER_OVERSHOOT_PX` / `CORRUPTION_ISO_OUTER_FADE_PX` / `CORRUPTION_ISO_MIN_BAND_PX`（107-127）、`FIELD_WALL_AO_*` 四个（132-135）、`FIELD_CORNER_BLEED_*` 四个（140-143）、`CORRUPTION_ISO_THRESHOLD_SCALE` / `CORRUPTION_ISO_THRESHOLD_MAX`（145-146）
- 留：`CORRUPTION_SOFT_RINGS` / `CORRUPTION_SOFT_TAIL_PX` / `CORRUPTION_SOFT_PEAK_T`（90-98）、`CORRUPTION_SOFT_VOID_MIX` / `CORRUPTION_SOFT_PEAK_SCALE`（152-153）——生产软环的全部参数
- 留：`mixRgb`（软环色）、`corruptionSoftProfile`（软环剖面）

**纹理键：** 删 `DITHER_PUNCH_TEXTURE_KEY` / `FIELD_TEXTURE_KEY` / `FIELD_CORNER_BLEED_TEXTURE_KEY` / `BAYER_PUNCH_TEXTURE_KEY`（2014-2017）；留 `NOISE_TEXTURE_KEY` / `LAMP_TEXTURE_KEY` / `FLASHLIGHT_TEXTURE_KEY`。

**import 块（29-58）：** 删 `BAYER_PHASE_COUNT` / `BAYER_PHASE_MS` / `BAYER_SLOPE_INSET` / `BAYER_SLOPE_KEEPS` / `BAYER_SLOPE_RING_WIDTH` / `FIELD_LAMP_DIM_STOPS` / `FIELD_LAMP_STOPS` / `FIELD_STENCIL_RAY_COUNT` / `fieldVisibilityAt` / `fillBayerPunch` / `scanFieldIsoluxPair` / `fillDitherPunch` / `fillVisionField` / `computeNestedEraseAlphas` / `SUBDIV_BAND_COUNT` / `SUBDIV_PROFILE_STOPS` / `VISION_FIELD_SIZE`；留 `computeFieldBandRadii` / `computeLevelEraseAlphas` / `SUBDIV2_BAND_COUNT` / `SUBDIV2_BAND_FLOOR_PX` / `SUBDIV2_LEVELS` / `fillVoidNoise` / `FLASHLIGHT_ALPHA_STOPS` / `FLASHLIGHT_POOL_STRETCH_ALONG` / `FLASHLIGHT_POOL_STRETCH_ACROSS` / `LAMP_ALPHA_STOPS` / `VOID_NOISE_SCROLL_Y_RATIO`。

### C2.2 `src/systems/visibility-system.ts` 修改清单（逐函数）

1. **文件头注释（1-21）**：「three fixed-width alpha bands…三次 erase」改写为 32 层等照线带描述（每层 = 射线裁剪多边形，带半径 = 参考光场等照线被射程曲线夹取，复合残余 = `SUBDIV2_LEVELS`）。
2. **`create()`**：删 dither 初始化块（429-444）；删 spike 重进块（491-494）；`bandGraphics` 预分配从 3 改为 `SUBDIV2_BAND_COUNT`（425-427）；删 `isoluxNeedsScan` / `fieldCornerCount` 重置（409-410）。
3. **`update()`**：删 field 分支（522-531 整块）。
4. **`setEdgeCorruption()`**：删 `this.isoluxNeedsScan = true;`（572）。
5. **`allocatePolygonBuffers()`**：简化为——bandCount = `SUBDIV2_BAND_COUNT`；vertexCount = `this.rayCount`；删 `stencilDist` 分配与 field 特例注释；`subdiv2Radii` 无条件分配并置 dirty；删 `shrunkPolygons` / `rangeEdge` 分配。
6. **`buildPolygons()`**：删 field 早退块（1038-1070）、subdiv 分支（1087-1093）、bands 分支（1105-1137 含 `rangeEdge` / `shrunkPolygons` 写入）；删 `shrinkPx` 与 `core` / `bandWidth` 计算（1036、1083-1085，只服务被删分支）；删 `if (style === 'subdiv2')` 判断（唯一路径，`ensureSubdiv2Radii()` 无条件调用）；循环体只剩：jitter → `outer` → 32 层 `writePoint(min(hitDist, rho))`（末层 `rho = outer`）。
7. **`drawMask()`**：删 switch（1178-1204），主体 = clear → fill → 噪点 → `this.drawSubdiv2Bands()`。
8. **`drawSubdiv2Bands()`**：保留；注释「Subdiv2 spike」改生产措辞（「生产遮罩：32 层等照线带」）。`drawBandStack` / `bandGraphicsAt` / `ensureSubdiv2Radii` 保留。
9. **`ensureSubdiv2Radii()`**：加 omni 参数化（净化点共用同一套系统，spec 规则 24；art 文档已锁「同一台设备、同一套语言，不为净化点另做分叉」）：
```typescript
const omni = config.mode === 'omni';
computeFieldBandRadii(SUBDIV2_LEVELS, this.rayOffsets, this.rayRange, {
  radiusForward: config.radiusForward * this.radiusScale,
  radiusAmbient: config.radiusAmbient * this.radiusScale,
  coneHalfAngleDeg: omni ? 180 : config.coneHalfAngleDeg,
  coneFalloffAngleDeg: omni ? 0 : config.coneFalloffAngleDeg,
}, SUBDIV2_BAND_FLOOR_PX, this.subdiv2Radii);
```
（omni 时 angular 恒为 1，参考场 = 手电曲线与灯曲线的全向 screen 混合，外轮廓仍是 `rayDistanceOverride` 的边界 blob。）
10. **`drawCorruption()`**：删 isolux 分支（1688-1691）与 `clearMask` 行（1695）；删 `soft` 局部变量与全部三元条件——软环成为唯一路径：`rings = CORRUPTION_SOFT_RINGS`、`color = mixRgb(v.CORRUPTION_COLOR, this.config.voidColor, CORRUPTION_SOFT_VOID_MIX)`、`capScale = CORRUPTION_SOFT_PEAK_SCALE`、`alphaScale = corruptionSoftProfile(...)`、44px 尾巴保留。**触发（edgeCorruption > 0）、深度（`CORRUPTION_MAX_DEPTH × edgeCorruption`）、flicker boost、上限（`CORRUPTION_MAX_MIX`）取值全不动**——`getChaosModulators` 的 edgeCorruption 映射不动，只是渲染边缘从硬环变软环。`corruptionInner` 保留。
11. **`destroy()`**：删已删字段的清理行（743-760、773-775 的 dither/field/bayer/clip 部分）；保留 bandGraphics / noise / lamp / flashlight / lightClip / glow / corruption / flicker / mask / subdiv2 清理。
12. **`VisionConfig`（190-217）**：字段全保留——`bandAlphas` / `edgeBandWidth` / `minSolidRadius` 仍被 `getVisibilityAt` 消费（逻辑三档是红线）；`eraseAlphas` 渲染不再消费，加注释「红线常量 `ERASE_ALPHAS` 的 config 镜像；32 层等照线带起渲染不再分层擦除，保留供逻辑三档对照」。**`constants.ts` 一字不动**（qa 闸门：VISIBILITY / CHAOS 段 diff 为空）。

### C2.3 `src/systems/vision-textures.ts` 删除 / 保留清单

**删除（spike 死代码，逐个过）：**
- subdiv v1：`SUBDIV_BAND_COUNT`（250）、`SUBDIV_PROFILE_STOPS`（256-262）、`computeNestedEraseAlphas`（292-309）
- bayer：`BAYER4_RANKS`（332）、`BAYER_PHASE_COUNT` / `BAYER_PHASE_MS`（335-337）、`fillBayerPunch`（349-368）、`BAYER_SLOPE_KEEPS` / `BAYER_SLOPE_INSET` / `BAYER_SLOPE_RING_WIDTH`（371-375）
- field 纹理与 isolux 扫描：`VISION_FIELD_SIZE`（378）、`FIELD_STENCIL_RAY_COUNT`（385）、`FIELD_LAMP_DIM_STOPS`（428-433）、`fillVisionField`（608-628）、`fieldIsoluxRadius`（550-561）、`scanFieldIsoluxPair`（569-597）
- bands dither：`fillDitherPunch`（187-199）

**保留（生产，注意参考光场族是 subdiv2 带半径的曲线来源，不是 field 残尸）：**
- 噪点族：`VOID_NOISE_*` 全部常量、`fillVoidNoise`、`noiseLumaEnergy`、`countIsolatedLitPixels`、`fillLegacyVoidNoise`（闸门基准）、`NOISE_ENERGY_*`、`VOID_NOISE_SCROLL_Y_RATIO`
- 光池族：`LAMP_ALPHA_STOPS`、`FLASHLIGHT_ALPHA_STOPS`、`LEGACY_LAMP_ALPHA_STOPS`、`LEGACY_FLASHLIGHT_ALPHA_STOPS`（闸门基准）、`LIGHT_ENERGY_*`、`LAMP_DISC_ENERGY_BASELINE`、`FLASHLIGHT_DISC_ENERGY_BASELINE`、`FLASHLIGHT_POOL_STRETCH_*`、`sampleStopAlpha`、`radialMeanAlpha`
- 参考光场族：`FIELD_FLASH_STOPS`、`FIELD_LAMP_STOPS`、`FIELD_FLASH_WINDOW_START`、`FIELD_LAMP_WINDOW_START`、`smoothLanding`、`VisionFieldParams`、`fieldVisibilityAt`
- 等照线带族：`SUBDIV2_BAND_COUNT`（32）、`SUBDIV2_LEVELS`（32 值）、`SUBDIV2_BAND_FLOOR_PX`、`computeLevelEraseAlphas`、`computeFieldBandRadii`

**注释更新：** spike 分节头（244-247「None of these are on the production default path」）重写为生产结构说明；`fieldVisibilityAt` doc 摘掉「teal-v4 isolux scan」提法，改为「参考光场：生产等照线带的曲线来源」；`SUBDIV2_*` 与 `computeFieldBandRadii` 的 doc 摘「spike」字样。**命名不改成 ISOLUX_\***——闸门、文档、DEC-107 都引用 subdiv2 名，改名是纯 churn。

**模块去留（director 拍板）：保留为独立模块。** 删除后仍约 400 行、四个函数族、被运行时与能量闸门双 import（闸门必须 Phaser-free 导入同一路径，这是它存在的核心理由，仍然成立）。不折回 visibility-system.ts。

### C2.4 出击与净化点接线

- `src/scenes/rift-scene.ts`：**零改动**（179 行 `create(...)` 之后从未调 `setMaskStyle`；机制删除后唯一路径即生产）。`applyChaosModulators`（847-849）三个 setter 不动。
- 净化点场景：**零接线改动**；视觉变化 = 遮罩从三档阶梯变为同一套等照线连续衰减（omni 参数化，C2.2-9），与 art 文档「人终审以裂隙出击画面为准，净化点顺带看一眼」一致——结案批冒烟必须含净化点一眼。
- `createRiftVisionConfig` / `createPurificationVisionConfig`：不动（`eraseAlphas` 字段保留，见 C2.2-12）。

### C2.5 gym vision-lab 整课删除（director 拍板：整课删，不留单模式 demo）

依据：课的使命是抽卡对照，人已抽完拍板；生产画面直接在出击看；留课就留不住 `setMaskStyle` 机制的删除（唯一调用方）。删除清单：

1. 删文件 `src/gym/gym-vision-lab-scene.ts`
2. `src/gym/main.ts`：删 import（16）与场景注册（29）
3. `src/gym/gym-lesson.ts`：`GymLesson` 联合类型删 `'vision-lab'`（12），`readGymLesson` 删对应分支（21）
4. `src/gym/gym-boot-scene.ts`：删 `SCENE_BY_LESSON` 条目（16）、三行 setHidden（41-43）、nav 映射条目（57）
5. `gym.html`：删导航链接（347）、规则块 `gym-rules-vision-lab`（534-540）、控件块 `gym-vision-controls`（541-548）、字幕 div `gym-vision-caption`（566）、CSS 里 `#gym-vision-controls` 四处选择器（57 / 67 / 86 / 95 行内的对应项）与 `#gym-vision-caption` 规则块（322 起）
6. `docs/dev/gym.md`：删课表行（20）、代码链里的 `GymVisionLabScene`（22）、规则 11（42）、「当前课」的视野渲染对比节（96-104）
7. 截图证据目录 `docs/art/review-2026-08-28/vision-lab/` **保留**（历史档案，git 已管）

### C2.6 能量平价闸门改写（`tools/vision/check-vision-energy.ts`）

噪点节与灯/手电盘节**一字不动**（纹理没动，它们必须原样绿）。带栈节（119-277）整体改写——bands 对照组没了，**拍板：钉住当前曲线，不用绝对阈值**。依据：绝对阈值（如 ≥0.6）太松，抓不住「未来有人改参考光场曲线导致亮度漂移」；钉住人终审过的那条曲线才是回归闸门。改写后结构：

1. **结构断言（机器硬闸门）：**
   - `SUBDIV2_LEVELS.length === SUBDIV2_BAND_COUNT === 32`；`levels[0] === 1`；严格单调递减；`levels[31] ≤ 0.03`
   - 望远镜自洽：`computeLevelEraseAlphas(SUBDIV2_LEVELS)` 满足 `alphas[0] === 1` 且对每个 k，`Π_{j≥k}(1 − alphas[j]) === 1 − levels[k]`（容差 1e-6）
   - 合成射线扇（现有 40+20 构造保留）逐射线：带半径单调不减；**末层半径 === 射程**（外轮廓红线）；所有半径 ≤ 射程（「不加迷雾外信息」的机器形）
   - omni 情形同构断言：全部 range = `GAME_CONSTANTS.VISIBILITY.PURIFY_RADIUS`、`coneHalfAngleDeg = 180 / coneFalloffAngleDeg = 0` 参数化跑一遍 `computeFieldBandRadii`，同样的单调 / 末层 / 不越界断言
2. **钉住亮度（回归闸门）：** 全量程扇区（|theta| ≤ 50° 的 24 条）面积加权均值对 pinned 基线 ∈ [0.85, 1.15]×。基线 = 结案时从 32 层表实测（预期 ≈ 0.667；**实测若出 [0.60, 0.74] 说明施工错了，停并回 director**），作为常量 `SUBDIV2_FULL_RANGE_BASELINE` 写进脚本并注释记录结案 commit。锥+肩与环身两扇区只报告不闸门（弱灯特性是有意读法）。
3. **删除：** `bandsRadii` / `subdivRadii` / `subdivVisAt` / `SectorMeans` 的 bands 与 subdiv 字段、全部 vs-bands / vs-subdiv 报告行、`SUBDIV_BAND_COUNT` / `SUBDIV_PROFILE_STOPS` / `sampleStopAlpha` 导入（`sampleStopAlpha` 在脚本内无其他消费）；`GAME_CONSTANTS` 导入保留（红线真值）。`accumulateSector` 简化为只算 subdiv2。文件头注释更新（I9-FINAL：噪点 / 光池平价 + 等照线带结构与钉住亮度）。
4. `package.json` 的 `check:vision-energy` 入口不动。

### C2.7 DEC-106 保住声明

VOID 挡光（`TileGrid.isOpaque` 对 WALL / VOID 均 true）是生产行为，与遮罩分支无关，本批零触碰。subdiv2 的墙截断走同一套 `castRay` / `rayDist`，虚空吞光天然继承。冒烟必验项：贴地图边界，虚空保持黑暗、边界墙块不背光、天空巨影（depth 60）仍可见。

## C3. 收尾四项 + 文档清单

### C3.1 架构登记（`docs/architecture.md`）

无新增模块、无删除模块、无新 DEC-ARCH。原地更新 VisibilitySystem 登记行（211）：摘掉「I9-G」与 spike 措辞，写最终态——「32 层等照线带遮罩（带半径 = 参考光场等照线 ∩ 射程曲线，逐射线墙截断）+ teal 软内缘（v3 几何环）+ 双八度迷雾颗粒 + 热核光池曲线；纹理与曲线纯函数 `src/systems/vision-textures.ts`（闸门共用，不是新运行时系统）」。接口列不动（`setMaskStyle` / `setCorruptionEdge` 从未列在该行接口里，无需删）。

### C3.2 spec 判断（`docs/specs/system-movement-vision.md`，原地更新）

- **规则 15 渲染段原地更新**：逻辑三档（`getVisibilityAt` 返回 0 / 0.2 / 0.6 / 1.0、带宽几何、clamp 分支）一字不动——那是红线与查询契约；渲染描述从「三层多边形 erase 阶梯」改为「32 层等照线连续衰减：每层 = 射线裁剪多边形，带半径取自参考光场（手电强曲线 × 暖灯弱曲线）等照线并被射程曲线夹取；逻辑查询仍返回三档，渲染比查询更平滑不违反规则 23（渲染 ≤ 查询亮度的方向一致）」。358 行「遮罩实现建议」段同步改写。
- **待验证假设回填**：「边缘渐变的推导」节挂的「三级硬分层带状感若过重 → 1–2px dither」假设由人终审直接回答：人选了连续等照线带（dither 是最小代价时代的答案，随 bands 分支下线被取代）。原地写一句结论。
- **规则 17 / 18 不动**（噪点与暖光行为未变）。`last-modified-date` 更新；`interface-changed` 保持 false（`getVisibilityAt` 签名与语义不变）。
- `docs/art/rift-vision-presentation.md`：「spike 分支语义登记」节追加最终态条目（2026-08-29 晚）：人终审拍板 subdiv2（32 层）+ teal 软内缘成为生产；field 路线否决根因（阴影不贴墙三层机制）留档；**背光脚下偏暗（灯曲线峰值 0.62 起）是有意的「弱灯」读法，查询的 48px / 1.0 不动；回退旋钮 = `SUBDIV2_BAND_FLOOR_PX` 换成 `minSolidRadius`（留档不启用）**；field / field-dim / bayer / subdiv v1 / bands 与 vision-lab 课下线。frontmatter `last-modified` 更新。

### C3.3 交付范围记录

- `docs/tasks/iteration-9.md`：frontmatter `status: COMPLETE`、note 改写；波段表加结案波 **I9-FINAL** 行（任务 = 32 层 + 翻默认 + 分支下线 + 课删除 + 闸门改写 + 文档批；闸门 = tsc + 全 check:* + 出击 / 净化点冒烟；状态「code 已交 2026-08-29，画面随人终审拍板收口」）；「验证问题」节按 C3.5 登记；「收尾四项」节四项打勾。
- `docs/progress/current-iteration.md`：frontmatter note 迭代 9 句改 COMPLETE；正文首段、工作性质节（迭代 9 表加 I9-FINAL 行 + COMPLETE 尾注）、验证问题节（见 C3.5）、「后续」节、新红线节迭代 9 摘要、登记表第 9 行（状态改 **COMPLETE（2026-08-29，人终审 PASS）**，DEC 列加 DEC-106 / DEC-107）同步。**活指针仍在迭代 5，一字不动。**
- `docs/progress/roadmap.md`：两处迭代 9「进行中」改 COMPLETE（措辞照迭代 7/8 既有格式）。

### C3.4 DEC 登记（`docs/progress/decisions-log.md`，append-only）

追加 **DEC-107**，全文：

```
## DEC-107: 视野渲染翻为 32 层等照线带 + teal 软内缘；field / subdiv v1 / bayer / bands 分支与视野对比课下线
- Date: 2026-08-29（人终审拍板；Director 本条登记）
- Phase: Iterative Development（迭代 9 结案；活指针仍在迭代 5）
- Type: Design（表现层终审定版）
- Context: 迭代 9 抽卡对照课（?lesson=vision-lab，合同 42 行例外）多轮比较后，人 2026-08-29 晚终审：「很不错，不过 16 层还略有分层感，搞成 32 层吧，然后直接结案+提交。」选中组合 = subdiv2 等照线带遮罩 + teal 软内缘（v3 几何环）。field 光场路线因结构性缺陷（阴影不贴墙：墙脚 AO 楔形亮刺 / 拐角溢光不查遮挡 / 纹理拥有形状导致背光阴影偏移碎裂；director 根因报告 2026-08-29）已在设计层放弃。
- Decision:
  1. 生产遮罩 = 32 层等照线带（subdiv2）：每层带 = 射线裁剪多边形，带半径 = 参考光场（手电强曲线 × 暖灯弱曲线）等照线被射程曲线夹取，末层强制 = 射程曲线。背光脚下偏暗（灯曲线峰值 0.62 起）是有意的「弱灯」读法；getVisibilityAt 的 48px / 1.0 查询保证不动。
  2. 生产侵蚀内缘 = 软（v3 几何环：20 环双端零斜率剖面 + 44px 黑中长尾 + 灰化色 ×0.7 峰值）；触发 / 深度 / 上限 / 混乱缩放映射不动。硬内缘下线。
  3. VisionMaskStyle / CorruptionEdgeStyle 机制整个移除；bands 三擦除 + 棋盘 dither、subdiv v1、field、field-dim、bayer、field 专属机器（360° 模板 / 墙脚 AO / 拐角溢光 / 光场纹理 / isolux 侵蚀）全部删除；vision-lab 课整课删除。
  4. 红线不动：射程 224/80、锥角 50+30、三档数值与 ERASE_ALPHAS（constants 段 diff 为空）、规则 4、薪柴不发光、混乱缩放、相机、getVisibilityAt、DEC-106 虚空吞光。
- 已考虑的替代方案（否决）：
  1. 保留单成员 VisionMaskStyle 联合类型 — 无 alternatives 的间接层；课删后无调用方。
  2. vision-lab 课留单模式 demo — 抽卡使命已完成；生产画面直接在出击看；留课就留不住机制删除。
  3. field 分支修补后保留 — 根因是结构性的（纹理拥有形状），修补等于重造 subdiv2。
- Impact: src/systems/visibility-system.ts 与 vision-textures.ts 净删 spike 面；src/gym/ 三文件 + gym.html 删课；check:vision-energy 带栈节改写为结构断言 + 钉住亮度；system-movement-vision 规则 15 渲染段原地更新（数值表不动）；architecture.md 登记行更新；iteration-9 合同标 COMPLETE。
- Verification: tsc 零错误；全部 check:* 绿；带栈闸门（结构断言 + 全量程扇区 ±15% 钉住亮度）；出击 + 净化点冒烟截图；人终审结论（2026-08-29 晚，gym 同代码路径）登记合同四问。
```

### C3.5 验证问题四条的合法登记措辞（不无证据记 PASS）

证据链：gym vision-lab 课 = 出击同一套 `VisibilitySystem`、同一份射线 / 配置 / 布局 / 玩家 / 相机（合同 42 行登记的例外，「不是另做一套视野表现」）；人 2026-08-29 晚在该同代码路径上终审选中组合并给结论「很不错」；16→32 是纯平滑度提升（同一参考光场、同一外轮廓、量化加密），且由人点名。登记措辞（写进合同「验证问题」节与 current-iteration 验证问题节）：

> 人答（2026-08-29 晚，gym vision-lab 课 = 出击同一套 VisibilitySystem 同代码路径，合同 42 行例外）：问 2（带状感）由人点名「搞成 32 层」直接回答，32 层落地后分层感消除；问 1 / 3 / 4 随人对选中组合（subdiv2 + teal 软内缘）的终审结论「很不错」收口。出击冒烟截图（v15-*）随结案批附为出击画面证据。**迭代 9 COMPLETE（2026-08-29，人终审 PASS）。**

### C3.6 状态行更新（`CLAUDE.md` / `AGENTS.md`）

两份的迭代 9 状态句改为（照迭代 7/8 既有格式）：「**迭代 9（rift 视野表现打磨）COMPLETE（2026-08-29，人终审 PASS）。** 选中分支 = 32 层等照线带（subdiv2）+ teal 软内缘；其余 spike 分支与对比课下线（DEC-107）。合同 `docs/tasks/iteration-9.md`。」活指针仍在迭代 5、「不要开 I5-C」等既有告诫全部保留。

### C3.7 其余文档落点

- `docs/dev/gym.md`：按 C2.5-6 删课四处。
- `docs/gdd-core.md`：检查视野系统索引行，有则更新一句（32 层等照线带 + 软内缘），无则不动。
- `docs/progress/backlog-issues.md`：I9-LAB5 的 F4/F5（留人拍板）与 I9-LAB7 遗留观察项（拐角溢光 12px 信息泄露观察 / F3 模糊拽近 / 墙脚 AO 偏弱 / 前锋只重建帧扫描）全部随 field 分支下线而消灭——逐条标注「随 DEC-107 分支下线消灭」，不静默删除。
- `docs/qa/iteration-9.md`：qa 结案机械对照追加（见 C4 Step 4）。
- 本文件 frontmatter note 已追加结案状态。

## C4. 执行顺序与闸门

**不一把梭。两个 commit，风险隔离：**

**Step 1（commit 1）：32 层小改 + 截图自检**
- 改动只有 C1.1 两行常量。此时 gym 课还在，键 3 直接看 32 层。
- 闸门：`npx tsc --noEmit`；`npm run check:vision-energy`（此时带栈节仍是 16 层时代的对拍 bands 旧版——32 层必须仍落 [0.85, 1.15]，预期 ≈ 0.98；出界 = 停，回 director）。
- 截图自检：同种子同点位对拍 v13（16 层）→ v14（32 层），确认分层感消失、外轮廓与阴影逐像素一致；存 `docs/art/review-2026-08-28/vision-lab/v14-*`。
- commit 1：「迭代 9 结案（1/2）：等照线带 16→32 层（人终审点名）」。

**Step 2（commit 2 主体）：翻默认 + 大删除 + 课删除 + 闸门改写**
- 按 C2 全部清单施工。
- 闸门：`npx tsc --noEmit`（抓悬空引用）；**grep 清零**——`VisionMaskStyle|CorruptionEdgeStyle|setMaskStyle|setCorruptionEdge|isFieldStyle|drawFieldMask|drawBayerBands|drawSubdivBands|drawCorruptionIsolux|fillVisionField|fillBayerPunch|fillDitherPunch|fieldIsoluxRadius|scanFieldIsoluxPair|computeNestedEraseAlphas|SUBDIV_BAND_COUNT|SUBDIV_PROFILE_STOPS|BAYER_|FIELD_STENCIL|FIELD_LAMP_DIM|VISION_FIELD_SIZE|GymVisionLabScene|vision-lab` 在 `src/` 与 `gym.html` 必须零命中（`docs/` 历史档案与 `docs/art/review-2026-08-28/` 截图证据除外）；全部 `check:*` 绿；改写后 `check:vision-energy` 先跑一遍打印实测三扇区均值 → 全量程实测值钉入 `SUBDIV2_FULL_RANGE_BASELINE`（出 [0.60, 0.74] 停并回 director）→ 再跑绿。
- 冒烟截图（v15-*，同目录）：出击——进图正常 / 走两步阴影贴墙 / 贴边界 DEC-106 虚空吞光不回退 / 高混乱 teal 软环 + 边缘抖动 + 全屏跳变共存；净化点——omni 参数化下边界外黑暗遮罩正常（顺带一眼，art 文档已锁的复核义务）。

**Step 3（同 commit 2）：文档批**——按 C3 全部落点施工。无 agent 定义改动，不需要跑 agent-parity。

**Step 4：qa 结案机械对照（🟢 可自动派）**——红线逐条（合同「不做什么」）、constants 的 VISIBILITY / CHAOS 段 diff 为空、C2 删除清单逐项核实零残留、闸门记录，追加 `docs/qa/iteration-9.md`。

**逃逸兜底不变：** 同一任务连续 2 次不过机器闸门 → 停，升 T1 重做并记 `guides/98-field-notes.md`。

## C5. 结案批不做清单

- 不动 `constants.ts` 的 VISIBILITY / CHAOS 段（含 `ERASE_ALPHAS`——保留但渲染不再消费，config 镜像字段同理保留）
- 不动 `getVisibilityAt` / `castRay` / `hasLineOfSight` / `TileGrid.isOpaque` / `getChaosModulators`
- 不动噪点 / 暖光 / 手电 / glow source / 全屏跳变五层的行为与数值
- 不把 field 代码备份到任何「以防万一」文件（git 是历史）
- 不开新课、不留 vision-lab 单模式 demo
- 不调 32 这个数字与级别表（人点名）；不回退背光脚下偏暗（有意读法；回退旋钮 `SUBDIV2_BAND_FLOOR_PX` → `minSolidRadius` 留档不启用）
- 不做 teal 前锋锚带后手（field-isolux 读法随分支下线死亡，v3 几何环即终态）
- 不动迭代 5 活指针、不开 I5-C、不标迭代 5 COMPLETE、不把结案塞进其他迭代
