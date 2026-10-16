---
status: DEV-FITTING / LIMITED-VERIFIED / HUMAN-CONFIRMATION-PENDING
date: 2026-10-16
feature: COH-F039
decision: DEC-218
---

# A 玩家 · 三场实景试装

用户选 A 后，用余烬脊 seed92、晶化林床 seed156、破膜盆地 seed82 三张已认可 r13 地图，中污染，进入真实 RiftScene。完整 960×640 游戏画面与同图局部放大见[三场图册](artifacts/player-a-three-scenes-2026-10-16/index.html)。三场各取正向、侧向停步；正常相机倍率 1.5，模型原像素比例 1，保留实际世界灯场、视野与实体遮挡。

此次只由 `r100-gym.html?playerModel=a` 开启。Gym 使用内存存档，真实地将测试武器移回库存；默认正式人物不变。截图使用原已验证坐标并先检查身体完整支撑，随后正常按键转向，静态截帧前暂停场景。不是自然整趟游玩，也不是完整战斗/武器动画接入。

## 首轮发现及修正

- 材料 PNG 的 alpha 存储发光，普通 Canvas 读取会清掉 alpha=0 的 AO。改用保留原通道的数据 PNG 解码；与 sharp 原始解码逐字节比对，53,233 个透明 AO 像素保留。
- 第一批截图机械检查通过但人物上半身过暗，art 退回排查；破膜侧面短按未生效，实际仍为正面。首轮原记录和两张图保留在 [first-pass](artifacts/player-a-three-scenes-2026-10-16/first-pass/capture.json)。采集脚本改为等待真实朝向到达目标，不以固定 70ms 推定转向完成。

- 人物过暗最终确认为地面 fog 二次遮暗。保留真实受光，只对已由世界 GeometryMask 裁切后的身体 opaque 轮廓擦除 fog；身体深度仍低于 fog/HUD，contact 不擦，未改 FOV 范围或探索查询。现有 `revealProjectedTerrain` 同步临时 mask 坐标并 finally 恢复。
- [同帧 GPU 核查](artifacts/player-a-three-scenes-2026-10-16/fog-proof/fog-isolation.json)：409 个身体内 fog 像素改变，轮廓外为 0；半遮挡被挡侧泄漏 0，全遮挡变化 0。半／全遮挡是临时测试 mask，不冒充自然关卡遮挡全覆盖。

## 验证

坐标/数据专项涵盖 PNG 与 sharp 对照、截断拒绝、投影逆变换、正交变换、八朝向/四输入方向及 104 帧脚锚/灯高；既有玩家受击检查通过。实际截图逐帧检查 A 就绪、模型比例、旧身体隐藏、20×20 碰撞身体、合法完整支撑、身体和脚影的遮罩绑定、脚点、同源肩灯以及真实存档零读写。最终三场六帧全部通过：每场正面为 0-idle-0、侧面为 2-idle-0，零页面错误／失败请求；捕获源码 SHA-256 与最终源码一致。三份实际配方均为 r13。

## 重现

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/qa/check-rift-player-presentation.ts
node tools/qa/capture-player-a-scenes.mjs
npm run build
```

浏览器采集可指定 `COH_PLAYWRIGHT_MODULE`、`COH_CHROME_PATH`、`COH_REVIEW_BASE_URL`。截图只有角色实际受光，不使用 review 检视照明。未覆盖完整战斗、武器、收步、死亡、跨设备与长期性能；本轮不提升 I14/P49 或用户审美终验。

## 本轮收口

生产构建通过（Vite 保留已有大 chunk 提示）。独立代码复核无剩余阻塞；art 复看修后六图，原尺寸可辨单面罩、短摆分腿、肩灯与侧身背包，未见脚点漂浮、旧身体残层或双灯。背光侧仍暗，保留实际光照供用户判断；只确认足以提交本次静态试装，不代签动态或美术终验。图册十二张图片（六原图、六局部）全部加载，零页面错误／失败请求。

## 侧身亮度反馈（同日续修）

用户要求侧身稍亮。仅在 A 身体的非发光、低受光材质上加入平滑漫反射增益（上限28%，受光达到0.8后为0），不改色板、几何、AO、灯面、真实世界灯场或FOV。三场六帧重新实机采集，通过原比例／身体支撑／脚灯／遮罩与存档隔离断言，零页面错误和失败请求，最终源码签名一致；`npx tsc --noEmit`通过。未重复全库生成或与此系数无关的fog隔离测试。

art复看晶化侧面：背包盖、胸侧与上臂更易区分，面罩／接缝仍深，未见明显扁平化、轮廓光圈或灯面过曝。静态效果仍交用户确认。本轮沿用既有架构与模型身份锁，未改机制、UI或接入范围。
