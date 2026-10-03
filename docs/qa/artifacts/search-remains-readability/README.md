# 翻找残骸可读性 · 原生限定验证

入口：[修前／最终修后对照与实际录像](index.html)。主功能 COH-F007，关联 COH-F013／F052。基线为 `04cde7e99365cb50886caf2c442f5c2b8bcbc089`；最终业务版本按两份 JSON 的源指纹确定。

- `before/`：3 个 R100 中档母版＋5 个正式来源，共 8 组原生完整帧和未经改图的 160×160 裁切。
- `after/`：同 8 组、同种子 20261002、相同玩家最终坐标和相机坐标。正常 FOV、原肩灯、原敌人；实际键盘移动后用已校验的身体合法修前坐标校准停点。最终静帧各例校准距离约 0.001–34.000px，具体数值在 `comparison.correctionPx`；这是可比视觉取样，不作全程自然行走验收。
- `behavior/`：3 个中档母版各约 10.5 秒实际 canvas MediaRecorder WebM；每 50ms 只读观察。主体闲置 x/y/alpha/tint/scale 恒定；实际局部反光、下落碎屑出现且为普通 alpha 混合。3 组 Escape 真暂停时对象及模拟时间冻结，返回原身体合法入口后正常 FOV 隐藏并停止 ambient 时钟；3 组真实 E 中断无奖励、完成后对象与 ambient 隐藏且奖励增加；6 次母版重建释放旧主体、反光和碎屑对象以及对应双纹理租约。
- `behavior/*-video-{quiet,reflection,flakes}.png`：从对应实际 WebM 的观测时间点 `video.seek` 后直接截取的 960×640 帧，共 9 张；没有重绘。三个已保存 WebM 均在隔离浏览器实际播放，尺寸 960×640，时间推进。帧时间在 `videoReview`。50ms 采样在低渲染帧率下可重复同一 elapsed，不将重复采样解释成动画暂停。
- `first-pass/`：加强不足的第一版，明确未定稿，仅保留历史；没有用来替代真实修前。
- `alpha-comparison.json`：Root 提供的 1280 组形状 alpha 完全一致机器摘要，复制自既有结果，未重新执行。

最终静帧与行为批次的全部记录源指纹一致，各自首尾稳定，页面错误均为 0。前后浏览器上下文隔离，未读取或写入正式存档 `coh-save-v1`。录制窗口只覆盖当前母版，没有灭敌、修改灯光或扩大可见范围；不延伸为全世界、完整搜撤、长期性能或人审通过。

减动仅 **CPU-only**：本轮没有执行原生 `emulateMedia` 减动样本。

采集命令：

```sh
QA_PHASE=before QA_MODE=visual GAME_URL=http://127.0.0.1:3046 node tools/qa/capture-search-remains-readability.mjs
QA_PHASE=after QA_MODE=visual GAME_URL=http://127.0.0.1:3046 node tools/qa/capture-search-remains-readability.mjs
QA_PHASE=behavior QA_MODE=behavior GAME_URL=http://127.0.0.1:3046 node tools/qa/capture-search-remains-readability.mjs
QA_PHASE=behavior QA_REVIEW_ONLY=1 GAME_URL=http://127.0.0.1:3046 node tools/qa/capture-search-remains-readability.mjs
```

捕获完成后，脚本仅改进了未来重跑时的键盘移动断言表述（检查停点校准前实际位置），未重采也未改变已取得图像。页面 8 项选择切换和视频回放已实际验证。脚本语法检查通过；业务类型／CPU／构建检查由 Root 汇总。
