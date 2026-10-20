# 裂隙加载与玩家尺度：限定运行验证

COH-F037 / COH-F011 / COH-F039。当前正式入口的加载表述、真实背景动效和 Rift 人物缩放已经完成限定验证；不据此关闭地图资源平衡、自然完整搜撤或性能预算。

代码分步提交：`c2a74bfb` 为等待菜单／视觉投影接管，`a5211aae` 为净化点真实阶段接线与出发短句，`5ac5da56` 为 Rift A 人物脚点对齐的 0.8 倍表现。运行时报告记录开始时 HEAD 与文件 SHA；当时净化点接线已在工作区，随后独立提交，HEAD 字段不冒充整个工作区版本。

工具：[check-rift-preparation-menu.mjs](../../tools/qa/check-rift-preparation-menu.mjs)。采用独立临时 Chrome 155 用户上下文，正常标题新开、真实备行/Worker；仅打开准备页时调用场景实际交互入口以省去无关步行。没有更换玩家记录、地图种子、生成输出、模拟时钟或渲染器。以真实键盘验证输入。该次随机得到晶化林床低污染。

运行结果：[report.json](artifacts/rift-loading-2026-10-20/report.json)，6 项通过、0 个 page error：

- 等待页标题为「临行」，当前句「我还看不清那边。」，唯一取消动作；没有“记录／上下选中／Esc 合上”错义。
- 真实 Last Light 视觉时钟从 4.58 秒推进到 8.80 秒，两帧左侧 700×960 区域中 2,799 像素出现大于 9 的 RGB 总差。场景时钟、物理余数、玩家脚点、世界坐标、gameState、库存及保存字节全部保持不变，期间按住 W/E/Tab 不穿透。
- 同一真实阶段的小点活动标记采到 0 / 5.39 / 16.19px，不依赖假的任务百分比。
- Esc 取消后恢复净化点，无消费、无新存档、无位移；游戏 pre-render 监听数回到准备前。
- 第二次实际准备依次观察 layout → surface，正常进入 Rift，没有模拟完成回包。
- A 人物、接触阴影、手套均为 0.8，持具为原 0.68×0.8；真实身体仍20×20。实际 Space 挥击产生 active 帧，原持具遮挡从背后切到身前。

实景：

- [等待开始](artifacts/rift-loading-2026-10-20/loading-start.png)
- [等待后续帧](artifacts/rift-loading-2026-10-20/loading-after.png)
- [正式 Rift 站姿与 HUD](artifacts/rift-loading-2026-10-20/entered-rift.png)
- [真实挥击 active 帧](artifacts/rift-loading-2026-10-20/player-active-attack.png)——这是960×640世界画布原帧，未包含 DOM HUD；其余截图为1440×960浏览器视口，不能直接拿两者的显示像素高度作尺度比较。

局部美术复核见[等待页短核](rift-loading-2026-10-20-art.md)。站姿及真实挥击帧保留 A 的短摆、背包、头肩和靴底可辨轮廓，持具仍接在手部，肩灯与脚点未出现分离；同一脚点变换及 NEAREST 避免软化成另一套画法。此次只观察一世界 A0 停步/挥击，不代签全朝向、运动、高同化或最终用户比例认可。

已有机器检查：`tsc --noEmit`、`check-async-entry.ts` 16 项、`check-async-destroy.ts` 通过；`npm run dev -- --host 127.0.0.1 --port 3038 --strictPort` 启动成功。项目没有 lint 脚本或配置，未宣称 lint 已通过；统一最终构建由根任务收口。

首个浏览器尝试因沿旧 QA 空置 `@vite/client`，丢失 `createHotContext` 导出而未能启动，不属于游戏运行失败。[原失败报告](artifacts/rift-loading-2026-10-20/attempt1-loader-failure.json)保留。修正工具为只拦截 HMR WebSocket、保留真实 Vite 模块后第二次通过。未丢弃或覆盖首次失败，也未重新测试到无限通过。

未验证：减少动态偏好下的实景、加载中系统级切应用、多个浏览器/GPU性能、长时间反复加载/内存、正常搜索与撤离体验。最终「该走了。」接在原500ms出发黑幕，不通过额外停顿制造进度；本次仅源码核对该句，未另截短暂黑幕。
