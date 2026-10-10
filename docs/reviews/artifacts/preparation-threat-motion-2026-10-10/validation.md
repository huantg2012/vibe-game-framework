# 持续动态与切档过渡：独立样例验证

2026-10-10；COH-F003 / COH-F038，COH-E202。仅独立视觉可行性样例，未接正式游戏；P49 open，I14 13/14。旧 E201 被用户反馈动态近似静态，不继承其动态结论。

## 产物与方法

- 实际入口：`/docs/art/demos/preparation-threat-sample/`。整层 UI 遮罩位于阅读暗场之上、文字之下；背景为同一实际 LastLightRenderer 静息画面。人物中心保护与文字位置固定。
- 960×640 WebGL2 双层运输：主层低/中/重 8/15/22 逻辑 px/s，薄层异向 1.5 倍速。主前沿升级 0.82 秒、降级 1.02 秒，薄层延迟并在最长 1.34 秒收尾；快切从当前外观重定向。行装速度向 0.34 倍收敛。
- 首次实看发现低档四边连续亮边像烧纸花框；按独立 Art 意见修为低档右上/右下两处断流、中档三处、重档多侧围合；亮缘移入材料内部并断续。速度保持，避免以重新降低动态解决造型问题。
- `preparation-motion.webm` 为修订后的真实浏览器录制；`preparation-motion.mp4` 为同一片段转码便于播放（未替换视效或时序）。页面自带实录播放器并可重新录制。录制合成实际 world Canvas、CSS 阅读暗场、实时 WebGL Canvas 与预热的真实 DOM 文案快照；非另一套特效实现。

## 实际运行范围

Root 通过 IAB 操作：默认动态开启；鼠标重→低→中连续改选后选中及事实正确；Enter 进入中档行装、Shift+Enter 不出发、Esc 返回保留中档、ArrowDown 到重档；静止、隐藏文字、关闭/恢复氛围、关闭/重开有限核对。新增录制在预热后取消能恢复所有查看控件；内嵌实录播放器实际点击播放，读取 currentTime 递增且 paused=false。三档/行装人物与阅读区截图核查，浏览器 console error/warn 为空。1020px 宽视口只用于 960 逻辑尺度核查，交付恢复默认视口。

实际录制 10 秒低→中→重→低，解码为 960×640、600 帧、约 59.94 fps、10.01 秒。4 fps 提取 `frame-01.jpg` 至 `frame-40.jpg`，`transition-sequence.jpg` 给出 2/5/8 秒切档附近的连续时序形态：升级由边缘向内扩展，降级先松覆盖再退去尾层；人物及文字锚点保持。完整可播放文件是动态交付，时序图只作定位证据。

`recording-metrics.json` 包含约 0.2 秒间隔抽样；`runtime-summary.json` 记录本机录制期间约 120.3 次 RAF/s、抽样帧间隔 7.4–9.2ms。它们只说明本机该片段调度与状态，不是全帧性能统计，也不能证明美术品质或连续观感。

定向 strict 检查：

```sh
./node_modules/.bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM,DOM.Iterable --skipLibCheck --allowSyntheticDefaultImports docs/art/demos/preparation-threat-sample/*.ts src/vite-env.d.ts
```

通过；`git diff --check` 通过。实现方另做纯运动状态及 mock-GL 生命周期核查：幂等、快切连续、隐藏停帧、恢复不跳时间、静止落目标、dispose 无 RAF/监听残留。mock 不替代真实着色器编译；后者已由浏览器实际执行。

## 范围与未决

Art 独立复核和造型修订见 `art-review.md`。Root 和 Art 使用实景静帧与带时间的解码序列评审，没有冒称模型连续观看完整视频。最终运动气质、三档心理压力与长时舒适仍交用户实际播放判断；未把数值/帧数作为“专业品质通过”。无音频、生产业务桥、真实装备/存档/出发或较弱设备验证。此次未改 `src/**`、`data/**`、`public/**`。

现状索引结构核查：0 errors、0 unowned；保留既有来源漂移及历史证据版本警告，不以全仓刷新基线掩盖未复核部分。本次仅增量登记 F003/F038/E202 并刷新 INDEX。
