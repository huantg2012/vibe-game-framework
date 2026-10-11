# 世界碎片：矩形骨架与自由断缘

## 当前方向

用户明确要求边界和空洞都用矩形拼合，并在看到本目录矩形剪影后回复“很好，是这种感觉”。认可的是构型大方向：偏置且非整块矩形的开放地面、集中而不均匀的空间缺失。用户随后要求边角适当打磨，不能固定圆角，要有动态感、随机性和自由度。新打磨尚不继承原骨架的人审。

`geometry.json` 是手工作者研究，不是生产策划表。地面由矩形并合，空洞由矩形挖除；矩形数量、孔数和本图坐标均不是未来生成器定额。本图不放实体、出生点、撤离点、敌人或奖励；其既有游戏规则未改变。

## 为什么与上一轮不同

上一轮 A/B/C 根据孔间余地组织移动，分别仍可读作主路、分叉、环路。固定八孔的比较进一步诱发了均匀布孔；它不是用户对未来地图的要求，三卡已退出候选。

本图西侧—中央—南部连续宽地先成立，密集破坏偏向东侧；局部仍允许窄肩与绕孔，不让它们概括全图。独立美术指出东侧伸出端仍可能读成附接房间，是后续正常视野和完整搜撤需检查的局部风险。此次用户认可只锁构型方向，不宣称漂泊语境、生产地图或自然探索已经通过。

## 边角样例

边角处理作用于矩形布尔运算之后的实际边界，不能对每个原始矩形分别加圆角产生接缝。`edge-treatment.mjs` 按可复现种子派生局部处理；`edge-render.mjs` 输出样例。大形与孔位由原骨架确定，局部切口长短、深浅和偏向变化，保留部分原角与直岸。动态感在这里指形态节奏，不是地形持续蠕动。

预览中“矩形骨架”可对照已认可的原图，“换一组打磨”切换三份代表样例；可选身体/观察尺度只是几何示意。蓝色为转身扫视的224px几何范围，不是生产方向视域、渐变、混乱修正或真正试玩。

## 证据与再生成

- `check.json`：原矩形剪影、20px身体的保守像素侵蚀、净空诊断及跨孔短线。
- `edge-check.json`：边角样例独立检查；具体范围以该文件为准。
- `manifest.json`：方向认可、新样例范围和状态。
- `index.html`：浏览器预览；`preview.fragment.html` 为派生内联版本。

```sh
node docs/art/previews/world-fragment-open-field/render.mjs
node docs/art/previews/world-fragment-open-field/check.mjs
node docs/art/previews/world-fragment-open-field/edge-render.mjs
node docs/art/previews/world-fragment-open-field/edge-check.mjs
node docs/art/previews/world-fragment-open-field/build-preview.mjs
```

独立 HTML 包装使用 visualize skill 的 `scripts/render.py`，输入本目录 `preview.fragment.html`，输出 `index.html`，覆盖时加 `--force`。当前浏览器入口为 `/docs/art/previews/world-fragment-open-field/`。

本轮未改游戏实现、CSV或正式spec。相关功能：COH-F007/F011/F012/F013/F014/F052。I14仍13/14、P49和另107世界仍开放。
