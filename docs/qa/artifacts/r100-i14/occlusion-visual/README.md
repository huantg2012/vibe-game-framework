遮挡缓存优化的有限视觉复核已完成。6 处正常画面在真实 Escape 暂停后，只切换原源遮挡查询与新缓存查询；全部实际 actor 绘制条带、记录状态和 PNG 逐对完全相同。Art 直接查看了 9 张对应原图，未见本优化新增的画面差异。

这不是完整视觉通过。6 个实际停点的角色隐藏像素均为 0：真实进入部分遮挡并再走出来的连续现象仍未观察到。实际覆盖 right / up / down，未覆盖 left；所有非玩家 actor 在画面中不可见。hollow-wreckage 的浅起伏与角色重叠处保持完整。

两次补充靠近了实体边缘：

- [hollow-wreckage 原查询](v3/hollow-wreckage-1-composite-partial-arrival-old.png) / [新查询](v3/hollow-wreckage-1-composite-partial-arrival-new.png)
- [felt-wedges 原查询](v3/felt-wedges-1-composite-partial-arrival-old.png) / [新查询](v3/felt-wedges-1-composite-partial-arrival-new.png)
- [hollow-wreckage 浅起伏原查询](v2/hollow-wreckage-2-departure-old.png) / [新查询](v2/hollow-wreckage-2-departure-new.png)

[完整限定结论、亲看记录与逐项自检](report.json)；[独立源码与收据核对](source-audit.json)；[4 对实际配对记录](v2/capture-report.json)；[剩余 2 对补充记录](v3/capture-report.json)。原式数值支持另有 8 个世界、6 族、39,757,776 断言及 112 组 mask spans 零差异；这不是 Art 第二次执行该数值测试。

首轮因 Gym 没有启用正式 Combat / AI recovery 导出，在拍图和移动前停止，[失败原件](capture-report.json)保留。后续只读记录明确列出这两个完整导出不可用，使用其余正常导出和 Gym probe / combat stats；没有启用 recovery 或修改游戏状态。全部测试实例已关闭、query 已恢复，生产文件未变，新增自然出击计数为 0。

截图是浏览器内实际画面区域，1136×758 显示像素，逻辑画布 960×640；区域上的正常 HUD 可能随截图进入。未改材质、画法、CSV、光照、雾、相机或既有审阅页面。声音未听，真实弱设备及用户最终审美仍沿原待验边界。
