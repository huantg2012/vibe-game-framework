# I30 R9 有界技术复审

日期：2026-09-23。范围：COH-F026/F042，关联 F006/F033/F038/F039。

## 基线、方法与结论边界

复审基线为 `22cf10fe5b695b69e6db5433903a05686d720508` 上的 R9 未提交工作树。已读 QA 角色、现行场景合同、R9 原生像素源及相关 Git diff。独立 `CLAUDE.md` 改动排除。只读生产代码；本审查拥有本文和 `tools/qa/check-i30-r9-exterior-contacts.ts`。

本轮没有启动 Chrome、修改存档或重跑正式键盘流程。六交互/双坡/入 Rift 的真实运行证据在 [几何专项](iteration-30-r9-geometry.md)，motion/pause/reentry 由并行 QA 提供。下面区分静态核实、正式纯函数运行和像素模拟，不把它们写成浏览器实测或审美通过。

## 实质发现：外景接触活动迁移到无宿主/被遮盖的位置

**P2，已修复并通过专项复验。** R9 收紧据点后，原三接触活动仍按西、东、后三个室内损伤点创建外景近层受光。西接触 `(51,260)` 的实体实际属于建筑层，外景 `near` 在此没有任何实体；流动图层深度为 `-49.6`，建筑层深度为 `10`。

使用正式 `paintAuthoredEnvironmentLayer`、`paintAuthoredChamberArchitecture`、`paintAuthoredChamberFloor`、`ChamberSurfaceMap.bake` 和 `ChamberLightField.compileFace`，在 640×400 原生整数像素上复算首轮工作树：

- 西接触：**0** 个受光段、**0** 个接收像素；流动路径 101 个等间距中心样本全部落在建筑遮挡后。
- 东接触：101 个受光段、370 个接收像素；流动路径 101 个中心样本有 78 个被建筑盖住。
- 后接触：272 个受光段、887 个接收像素；流动路径 101 个中心样本全部被建筑盖住。

这解释了活动代码确实运行而对应活动不可见的情况。不是计时或随机数问题，也不是播放器观察时间不够。损伤层为单独的深度 14，不能凭内侧损伤可见推定后方活动有效。西侧音效仍可在实际近墙位置触发，同样不能作为外景动作存在的证据。

定位：`src/scenes/chamber-exterior-atmosphere.ts:25` 的正式受光/宿主编译、`:48` 的流动发射和 `:69` 的双像素宿主检查；`src/scenes/purification-chamber-visual.ts:94` 的 near 层采样与 `:105` 的建筑 depth 10；`src/systems/purification-chamber-layout.ts:88` 的室内损伤点与 `:95` 的独立外景动作源。

主任务已修复：西侧只保留内侧公开损伤，外部动作改为后部、东部两条实际暴露承托；公开源改为 `CHAMBER_EXTERIOR_CONTACTS`。新增闸门直接消费该公开数据、正式绘制器与正式活动类，检查完整 2×1 流动像素及实际发射。最终结果见下方复验记录。

## 已核实的其他接线

- **四个室内光源均有实际地面接收。** 以当前布局和正式 `compileFloor` 运行：核心 5,990、培养藏 3,048、净化器 3,701、墙灯 888 个地面接收像素。属于不带材质响应的接收几何检查，不等于实际画面亮度获通过。墙灯引用 `CHAMBER_WALL_LAMP`，六物引用 `CHAMBER_DEVICE_BASES`，粒子核心起点也随同一底座迁移；未发现遗留的旧绝对灯锚。
- **损伤未浮在空中。** 正常、70% 和 10% 三组公开状态分别画出 265、348、409 个非透明抵抗层像素；这些像素全部落在 near 或建筑/地坪的已有实体上。本项没有检查审美、侵蚀形状或暗部可读性。
- **观察和绘制消费同一 R9 作者面。** `chamber-observation.ts` 引用 R9 `ENVIRONMENT_FACES`；射线不使用脚底交互半径或跨层一票否决；高程由同一地坪/坡道坐标计算，建筑被正式地坪覆盖的像素按可见层语义排除。没有新增未来冲击/隐藏鉴定数据消费。现有 22 项观察核验归并行几何报告，本审查没有重复认领。
- **静态与动态分开。** 首轮 472 个作者面；最终源 489 个面（far 145、middle 98、near 79、architecture 102、floor 53、foreground 12）无重复 ID、非有限坐标或少于三顶点的面。作者材料只在构造阶段绘制；设备/抵抗层按公开状态档缓存。活动使用场景累计时间，外景10Hz、场景活动约12.5Hz；没有新增无限对象增长。首轮 30,000 次实际观察调用在本机隔离 Node 热路径中约87.5ms，仅排除这批坐标引入明显算法爆炸，不代表浏览器帧率。
- **层与销毁所有权明确。** 外景远/中层随实际镜头平移，near scrollFactor 为1，接触活动也处在相同世界坐标；near 不漂离其活动。`PurificationChamberVisual.destroy()` 的幂等门清理 lighting/activity/exteriorAtmosphere、六设备 Graphics、所有 Image 与临时纹理；场景 shutdown 解除 POST_UPDATE、库存/事件订阅、输入和面板，取消延迟切场。未发现本次删除 middleOcclusion 后留下对象或销毁引用。
- `git diff --check` 在审查时通过。未独立重跑总体 build；由主任务最终检查汇总。未将已有旧坐标专项的失败当作新生产缺陷。

## 外景修复复验

最终源执行：

```sh
node --import tsx tools/qa/check-i30-r9-exterior-contacts.ts
```

**1,625 项检查通过。** 后方源：256 个受光像素全部外露，62 个路径像素全部有 near 宿主且未被房间盖住；东侧源：481 个受光像素、460 个外露，57 个路径像素全部有 near 宿主且未被房间盖住。反射池部分被建筑自然遮挡是允许的；活动路径不得被整体埋在房间背后。

正式 `ChamberExteriorAtmosphere.update()` 在完整 19 秒、190 tick 内，后方 111 个活跃样本、东侧 110 个活跃样本均实际发出预期的 2×1 流动；所有流动/尘点像素均有真实宿主。减少动态模式保留反射光、停止流动和尘点；两个 Graphics 容器销毁通过；将近层 alpha 清空的独立负控在整个周期内不产生任何接触绘制。

保留的失败轨迹：

1. 原三接触源：西侧 0 个受光像素，后方流动全部被建筑盖住（上文首轮证据）。
2. 外部新源的第一版东侧路径仍命中建筑遮挡，明确失败像素为 `(410,281)`；起点后移至 `(413,283)`，并补足右承托，解决宿主/遮挡问题。
3. 新增双像素 guard 曾错误使用反射光照 `LightSpan`：后方仅 12/62 个路径像素可发射，东侧 0/57。该版即使受光池与路径各自非空，流动仍会消失。最终将自发异常微光绑定真实 near alpha，反射光池只约束反光/尘反射。这次失败促使闸门直接调用正式运行类，不能靠复制一个预测 guard 把实现错误隐藏掉。

脚本通过内存内 esbuild 装载正式活动类，仅将 Phaser import/Graphics 容器替换为绘制记录器；正式构造、宿主掩码、受光编译、时序、插值和发射代码原样执行。没有浏览器、存档写入、文件产物副作用。每条路径另取 1,001 个包络位置检查完整像素覆盖与可见性；空宿主与完全遮挡提供独立负控。该测试验证几何与发射事实，不验证人眼感到的节奏或亮度。

最终专项关键输入指纹（SHA-256；源码或坐标变化须重跑）：

```text
assets/source/purification-r9/environment.ts 4264315f8e3573c1ce151dfffd04898ddf350c101da0086bc5444a02cd34fca3
assets/source/purification-r9/interior.ts 1c01cd02b4e2fda807556f0ef13bbcc3a349d30b3d335e3457c12f5bdc89fd05
assets/source/purification-r9/exterior.ts 065a1ce42befe27ca2f13793879ef261720445ddd0a9eec15a66d741886e7470
assets/source/purification-r9/schema.ts 499463ed448ca3a624f8baea7c3e308cfa8f3f9f5c78d2a7ffe1a359ec915e43
src/art/chamber-authored-architecture.ts 91d5c1ac7ba75931e1fd1875447355e05cb5125f5d04e4768f2406c16e5b3fdb
src/art/chamber-light-field.ts fc8a66c42e0267f8e38cb4be7674a6d692b12a50b8d6e24c7631a052d5415bbb
src/art/chamber-surface-map.ts a422b5bb2895fad9bc40dc7eb9db3685be13550a63b88a8d0716389dc08504dd
src/art/purification-chamber-pixels.ts 5cc8c6095e91746373f79e690c5cd8c8078ec796579cdcf1524cfe15ca544f1d
src/scenes/chamber-exterior-atmosphere.ts c81798ad47de4bf97fb74e77f1cd85a3c7e2b014697330d24bc54bd0eab2f5da
src/systems/purification-chamber-layout.ts 9e679d73232591eed2644983cdc725f0fd55f0af2013ba1b55f4c52f16582050
tools/qa/check-i30-r9-exterior-contacts.ts 4023fffdc32f0e9c34c6413fc4caccf53be6ab867a645e4c7dec7f1c9f50fee1
```

## 仍未覆盖

最终实帧外景节奏/亮度、普通与 reduced-motion 模式的真实屏幕观感、暂停恢复、反复重入、声音方位和听感、所有面板镜头过渡、长期内存/帧率均不在本轮离线证据内。减少动态的离线分支通过不替代浏览器实测。用户终审、Rift 全随机世界、成长经济和 I28 挂起采样不由本报告提升。最终有界审查未留下待修的确定技术缺陷；审美裁决另归美术/用户。
