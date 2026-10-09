I14 当前供审版本是 **10 月 9 日遮挡优化版**，版本以[候选记录](release-candidate.json)为准。本轮技术与连续回归的最新结果见[实时 QA 进展](../../rift-r100-i14.md)；I14 仍未结案。

实际玩当前版：取[设备包](../../../../dist/r100-i14-device-kit-rc-clean-20261009.tar.gz)，按[说明](root/device-kit-rc/README.md)安装后，在解压目录运行 `node tools/qa/run-r100-i14-device.mjs --play`。它打开当前候选的正式主菜单，使用隔离窗口，不带入原有存档。[包与版本证据](root/device-kit-rc/handoff-clean.json)

先看听已有片段：[低档 · 赤壳断拱](continuous/recovery-v2/batch-01/i14/1-natural-canvas.webm)、[中档 · 拼裂壳皮](continuous/recovery-v2/batch-01/i14/2-natural-canvas.webm)、[重档 · 撕底浅庭](continuous/recovery-v2/batch-01/i14/3-natural-canvas.webm)。这三段是优化前首 12 趟中的第 1–3 趟，保留正常场内声音；录制从恢复完成后开始，不含 DOM 界面。本轮只优化遮挡查询，音频、美术资产与画法未改，素材按[版本继承记录](root/actor-occlusion-disposition.json)保留参考效力，并非当前候选重新录制。

[视听材料目录](../../interactive/r100-i14-review.html)另有只听音轨、整页截图、五个源声音与六族三档的历史受控混音；目录内标签区分正常录像和历史受控材料。其自动预览曾被浏览器安全策略拒绝；本交接只核文件与链接，未确认页面播放，也未代替人实际听过。[素材来源与限制](art-natural-media-source.json)

仍需分别核实三件事：

1. **真实较弱设备。** 在该设备按包说明填写实际配置并执行 `--run`，返回本次完整 `device-results` 文件夹及失败记录。参考机通过、软件降速或能打开游戏，都不能代替这项实机结果。
2. **实际听感与连续视觉体验。** 用上述材料和当前版 `--play` 判断：材料声是否分得开，受击／翻找中断提示是否被压住，反复转换是否刺耳，连续看与操作是否疲劳；靠近实体后角色是否被错误裁掉、离开后是否残留。记录实际使用时长即可。已有[六对遮挡画面对照](occlusion-visual/README.md)没有覆盖真实部分遮挡后的连续走出。
3. **当前候选的最终认可。** 在当前版实际看、听、玩后，明确反馈“认可”或“仍待整改”及具体问题。前两项结果与这项认可分别记录，均未自动勾选。

反馈可直接写：**片段时间点或世界／等级／位置 → 看见或听见的现象 → 期望表现**；另附设备、耳机／扬声器、音量与实际体验时长。
