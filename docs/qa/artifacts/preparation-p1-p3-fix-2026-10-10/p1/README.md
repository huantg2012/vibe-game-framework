# P1 独立回归证据

日期：2026-10-10。覆盖 COH-F003 / COH-F038；代码版本与工作树 SHA 见 [verification.json](verification.json)。标准来自合入审查 PI-01 的最小验收及备行任务的清理约定。

结论：P1 在本机 Chrome 的限定回归通过。测试使用独立 Playwright 页面和真实净化点 prepare-review 内存夹具，没有读写正式存档。

- 30 次正常开关（每次关闭后 80ms、打开后 150ms）与 30 次无等待的密集开关均通过。刻意保留所有旧 context 引用，不依赖 DOM 数量或 GC；60 个旧 context 全部 isContextLost=true，旧控制器均 disposed，RAF 取消、关闭后 frameCount 无增加，且没有触发 veilerror。
- Phaser 主世界始终 gl.isContextLost=false / renderer.contextLost=false，lostEvents=0；记录 draw 调用从第一次正常循环的 1166 次增至退出后 1646 次，全部检查后 1687 次。不存在 Too many active WebGL contexts / Renderer disabled 警告。退出后的实景截图已查看，人物、建筑与光照正常，并未白屏。
- 共享样例 overlay wrapper 的低、中、重各完成新 canvas 挂载、实际绘制、双调用 dispose、再次新 canvas 重建；preserveDrawingBuffer 仍为 true，旧 RAF 未重启。这里没有测试同一已丢失 canvas 的复用合同。
- 用真实 WebGL2 context 注入着色器编译失败与必要 uniform 缺失，两条初始化失败路径均释放已取得的 context。
- 原脚本的三档运动、连续降档、场景暂停、关闭/返回不重播、reduced-motion 和故障后进入行装检查也通过。页面异常为空；console 有两条资源 404，单独保留，未冒充 context 错误或“console 全无错误”。

报告：[final/vfx-report.json](final/vfx-report.json)。实景：[关闭 60 次后世界](final/world-after-60-cycles.png)，三档及行装截图也在 final/。第一轮 [vfx-report.json](vfx-report.json) 在共享服务重新加载后遥测失效，尚未进入生命周期循环；作为测试环境中断保留，最终轮使用独立 3042 服务、生产代码稳定后执行。

限制：仅本机 Chrome、WebGL2 与 WEBGL_lose_context 可用路径；未外推其他设备、浏览器或扩展不可用环境。P2 静态兼容表现仍待整改，故障注入时可导航不等于 P2 修复。共享控制器验证不代替样例完整录像、HMR 卸载过程或用户连续审美验收。此次不改样式、Shader、motion 或布局；不能借生命周期回归替 P49 / I14 整体结案。
