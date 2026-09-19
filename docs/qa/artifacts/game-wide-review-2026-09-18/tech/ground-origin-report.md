# 正式Rift地表来源限定核对

2026-09-18。根代理追加任务：5分钟内核查 art/28-rift-teal.png 的稀疏土色地面和青绿正矩形；不改源码／规范，不做审美裁决。

## 结果

**这是当前正式程序烤地的输出，不是FRACTURE基础tile露出、production素材未加载或成品层被遮导致的回退。** 青绿矩形的具体来源为按整格赋予的 `vegetation` 地表角色，再经像素量化变为单色。它在技术上按当前代码执行，不等于已满足美术合同或体验质量。

## 直接证据

1. 已实际查看 `../art/28-rift-teal.png`。画面上可见沿格对齐的青绿正矩形；本报告不从截图推测碰撞、危险性或玩家应该如何理解它。
2. 正式Rift `src/scenes/rift-scene.ts:301–313` 创建placeholder tile层后立即 `setVisible(false)`，普通入口始终调用 `RiftSurfacePainter.mount`。唯一替代是显式DEV fixture的worldSurface runtime；生产构建将fixture置null（250行），未发现prod与DEV普通Rift分别使用两份地表。
3. `src/systems/procedural-surface.ts:65–82` 直接 bakeGround→compositeStaticPaint→CanvasTexture→Image，不加载外部地面PNG。创建CanvasTexture失败在157行抛错；没有切回placeholder的catch。tile贴图缺失同样抛错（tilemap-renderer.ts:40）。
4. 根只读DEV运行层证据 `../coordinator/render-layer-diagnostic.json`：seed3036342668、frag-outdoor/ridge-soil，TilemapLayer visible=false、rift-surface Image visible=true，两者depth0，地表2048×1344。此项是同源DEV实测，**没有冒称已读production3013内部对象**；production未暴露该对象，根保持冻结未注入。
5. `src/generation/draft-pipeline.ts:131–139` 在符合scatter概率的floor cell上整体登记role=vegetation；`src/generation/preview-paint.ts:1979–1989` 对该格每个像素混入青绿色，仅加固定纹理；随后 `compositeStaticPaint:2088` 量化。
6. 本次独立脚本 `probe-ground-origin.ts` 调用同一生产generateRiftLayout/bakeGround/compositeStaticPaint复现上述seed；无改状态、无平行重画规则。结果 `ground-origin.json`：58个vegetation格，其中4个16×16烤图格全部256像素为RGB(14,74,63)，例如(col13,row10)。这些位置tile=1/FLOOR。整个样本tile counts仅0:202、1:921、3:1565；没有tile2/FRACTURE。`ruins.ts:64–72`当前转换器只写VOID/WALL/FLOOR，FRACTURE enum不是这批矩形来源。
7. 已实际查看生成的 `ground-origin-baked.png`，可见同类正矩形和土色稀疏颗粒。此图是去掉镜头/灯/视野的实际原始地表，不能作为首轮art帧的同seed复现（首轮seed未读出）；它精确复现根提供的诊断seed，说明具体绘制机制可产生该现象。

## 土色地面与层级

普通地面来自preview-paint.ts:1947–1965的floorBv、噪声、macro和floorBias；`stampWear:2032`追加划痕/颗粒；live分辨率每格16px（2110行）再显示为32世界像素。天空dim/rim只在地表上以depth+0.1/+0.2分别做MULTIPLY/ADD（procedural-surface.ts:98–110）；正式视野再遮蔽。没有发现一张已制作完成的高细节地面PNG被错误盖在底层这一解释的代码依据。

## 对合同的限定判断

现行 `docs/art/rift-fragment-surfaces.md:11,45`将“看得见的成片青绿”归于有主占漆，并明确排除网格对齐矩形平涂。当前vegetation绘制仍能输出整格青绿，属于需要C阶段明确核对的呈现合同偏差；不能因变量名为vegetation就把玩家看到的矩形自动判为符合意图，也不能把它误报为缺贴图。是否美观、是否误导危险判断，留给体验与美术证据；本文没有改规范或提议按现状改口。

## 证据范围

实际看过首轮帧和本轮生产烤图；只读源码＋同源Node烤制＋根转交DEV层状态。没有运行新浏览器、读production内部、修改游戏、重做材质或通知盲审组。日志：probe-ground-origin.log。
