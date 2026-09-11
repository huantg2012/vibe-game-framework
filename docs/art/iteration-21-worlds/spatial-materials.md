---
status: R2-REWORK / R1-USER-VISUAL-REJECTED
created-date: 2026-09-11
iteration: 21-F
decision: DEC-149 / DEC-150
---

# 悬海样板的水体材质

使用内置`image_gen`生成，未使用CLI或第三方模型。选定产物为[sea-water-r1.png](../../../src/dev/spatial-study/assets/sea-water-r1.png)，1536×1024，已存入项目并由空间样板Boot加载。原始输出仍保留在生成目录。

R1使用这张图的空间表现被用户评为30/100，不能因纹理获生成就认为水体成立。R2保留图像来源，将它作为真实闭合体积上的移动材质：上下表面、厚薄、卷腹与落水由几何和深度缓冲产生；保持原图比例，以最近邻采样。主体采用缓慢流动反光；下落片单独转为沿下降方向拉长的流束，薄片透出原Fog处理后的背景，回收时流向逆转。没有本轮新生成图像，也不以加密噪点替代形体和水流验证。资源缺失的程序材质只作故障兜底。

运行方式见[空间样板](../../dev/spatial-study.md)，实际画面审查见[空间QA](../../qa/iteration-21-spatial.md)。这不代表首个生产世界或美术终审已经获选。

## R2内部画面修订

先去掉了均匀蓝色光照的黏土感，再将下落片的横向水纹改成纵向长流束及透光，结合真实薄翼破口、重力碎水和触地横散。art查看原速录像及连续帧后认为具备重审条件，但保留内源纵深、海下压迫感及部分长反光偏密的问题。内部认可送审不等于用户美术PASS。礁石作为空间参照，不承担更改游戏光照/视野规则的功能。

## 最终生成提示词

```text
Use case: stylized-concept. Asset type: production pixel-art material texture for a dark cosmic-horror top-down indie game, After That Day. Create ONE flat, edge-to-edge orthographic albedo painting of an enormous black-blue sea surface, with natural irregular currents, tiny broken silvery teal wave crests, different broad dark water masses and a few subtle turbulent turns. This is a TEXTURE, NOT a scene or concept poster: water fills 100% of the image, no shore, horizon, land, rocks, waterfall, character, objects, symbols, border, labels or text. No light sun glint. No round whirlpool rings or perfect spirals. No uniform sine stripes, contour map lines, grid, neon, or repetitive identical marks. A realistic painter's understanding of heavy deep water expressed in deliberately clustered hard-edged pixel art, matching a somber 16/32-bit hand-painted world. Low contrast overall: navy black, dark desaturated petroleum blue/green, sparse muted cold grey-cyan glints; warm lighting will be added by the game, do not bake a spotlight. Irregular elongated broken wave crests flow diagonally and gently cross, fine textured stippling, layered water depth, a sense of tremendous weight. Avoid flat vector contours and avoid photorealistic glossy 3D water. Output landscape 1536x1024, full opaque surface, crisp pixel grouping. No transparent areas. Intended to be mapped over runtime geometry at approximately 500x350 logical texture pixels.
```
