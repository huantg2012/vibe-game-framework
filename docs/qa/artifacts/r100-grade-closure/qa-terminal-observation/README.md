# QA 在死亡清账后导出活动工具的异常

仅审查 QA；生产源不变。对应 `r100-second-seed-severe` 中 cinder-ridge、pallid-membrane、schist-shear 三份 `severe/1-rejected-state.json`。

三份均有：`checkpoint.state.phase=settled`、`runEnded=true`、`lastEndReason=player_died`、`settlementSaved=true`；库存为 `settled/death`，HUD 为 0/145 HP 且装备已卸下。`captureError` 与 `inventoryError` 均为 null。未按 R，不声称已返家。

生产 `RiftScene.captureRuntimeCheckpoint` 在终局只保存 settled 分支，不再导出活动工具。QA `costed-encounters.observe` 则在已结束，或两次 `page.evaluate` 之间发生死亡后，仍导出依赖出击库存的 `ToolSystem.exportRuntimeState`。清账后的库存与仍存在的旧 ToolSystem 引用不应相符，因此严格校验抛错是合理行为。

补丁只在 QA 中增加终局检查：首次公开观察已终局即返回；付费罗盘读取前在同一同步浏览器回调中再次检查终局；压制效果读取同样保护。活动局面的 export 错误继续抛出，不能吞掉真实恢复故障。

`costed-encounters-terminal-guard.patch` 在低中 14 与重度 15 两个冻结批次结束、各自 owner 明确释放后应用。原 helper 字节已保存到 `frozen-source/`，与 `patch-input.json` 的旧 SHA256 一致。旧批次证据不重写，新 helper 五项定向测试全部通过，见 `applied.json` 与 `test-report.json`。`candidate.mjs` 是候选 QA 文件，仅用于 5 项定向测试：已终局、两次读取间终局、活动异常传播、正常付费罗盘静态快照，以及压制输入后死亡不得再次导出活动工具。

原三例的实际探索、搜索、压力和死亡记录仍有效；QA 后处理异常不能改称生产保存失败，也不能把死亡样本改成搜取返家通过。无需改生产或重跑生成、恢复与性能全库。
