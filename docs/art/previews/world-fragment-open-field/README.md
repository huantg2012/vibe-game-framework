# 世界碎片：矩形骨架与自由断缘

## 已认可基准

2026-10-11，用户对 `ada26f43` 展示的构型及断缘回复“效果很不错，这是我想要的”，要求固化方便推广（DEC-205）。批准母版为本目录的矩形骨架与三份种子样例；批准的是空间语言，不是将同一张图复制到所有世界。

白地是矩形并合后被矩形挖除的连续开放地面，VOID集中且不均匀；局部断缘保留长直岸与部分原角，混合不等长斜切、多段崩角和少量岸线缺口。“动态感”是形态节奏，不是地形随时间移动。小孔不统一倒成八边形，全周不加等距噪声。

## 唯一实现与使用入口

- **共享算法：** [src/generation/world-study/fragment-shape/index.ts](../../../../src/generation/world-study/fragment-shape/index.ts)。TypeScript纯函数，`rectilinear-fragment-v1` 冻结本次策略。
- **调用合同：** [地图生成spec](../../../specs/system-map-generation.md#rectangle-fragment-authoring)。输入完整矩形layout和uint32边角seed；输出真正外环/内孔、版本、坐标单位、SVG路径及诊断。v1一作者单位固定为2世界像素，`fragmentContoursToWorld`只转换一次。
- **作者方法：** [空间设计说明](../../../design-notes/rift-world-space.md#rectangle-fragment-authoring)。先组织宽地、偏置外岸与局部破坏，再处理边角。不能让孔间余地变成房间—走廊骨架。
- **后续接入：** [推广任务](../../../tasks/rift-spatial-rollout.md)。先冻结旧r7、建立新版本与CSV作者链，再统一地形/身体/LOS/材质和内容部署，代表验证后分批展开。

`edge-treatment.mjs` 只是兼容预览的薄适配，不再保存一份算法。`geometry.json` 是手工作者研究夹具，不是生产策划表；矩形数量、孔数和本图坐标不是生成定额。算法不自动设计每张地图的宏观构型，也不把坏输入修补成默认矩形。

## 不漂移的回归

[accepted-v1.json](../../../../tools/fragment-shape/accepted-v1.json) 绑定 `ada26f43` 已认可输入、三份轮廓/统计及PNG/SVG的SHA256。检查只读这些基准，绝不先重新生成expected再宣布通过。

```sh
npm run check:fragment-shape
npm run typecheck
```

`tools/fragment-shape/check.mjs` 检查母版精确复现、预览适配同源、输入不变性、单位转换、非母版布局及错误拒绝，传入报告路径可写入结果；本次归 `consolidation-check.json`。不同矩形输入不能仅靠通过算法就算人审通过；纯矢量检查也不等于20px身体/8px支撑或真实LOS准入。

## 预览与样例维护

预览提供“矩形骨架”对照及三组打磨切换；可选20px身体、224px转身几何范围不是真实方向FOV或游戏试玩。`preview.template.html` / `preview.mjs` 为可编辑UI，`build-preview.mjs` 打包共享源，`preview.fragment.html` / `index.html` 为派生页面。

```sh
node docs/art/previews/world-fragment-open-field/build-preview.mjs
```

独立HTML使用visualize的 `scripts/render.py` 包装fragment，浏览器入口为 `/docs/art/previews/world-fragment-open-field/`。母版图由 `render.mjs` 和 `node --import tsx .../edge-render.mjs` 产生；它们会覆盖获认可样片，普通回归禁止运行。需要改变v1策略时另立版本与比较母版，不原地更新指纹掩盖变化。

原 `check.json` / `edge-check.json` 保存此前矩形/三seed保守像素身体、孔一一对应与独立光栅检查，保留原验证范围。本次没有新增出生/撤离/实体或正式生产接入；正式存档、真实探索及其他107世界仍待推广，I14保持13/14、P49开放。功能绑定COH-F007/F011/F012/F013/F014/F052。
