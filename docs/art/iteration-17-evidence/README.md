# 迭代17证据

模型图已更新为R2（2026-09-08，中档结构增强）。未带r2的实景截图和轨迹保留为R1管线证据。

模型原生/4倍图由当前生产baker生成：human-directions（行低/中/高，列下/左/上/右）；四方向phases（列待机/走路/警觉/预备/攻击/收势）；三覆盖档walk（行方向，列八时刻）。

- human-infiltrate-rift.png / human-rewrite-rift.png / human-overwrite-rift.png：seed26同实体，保护/暂停下只切外观。
- coverage-states.json：上述同位置/HP/纹理计数的可见状态。
- human-death-rift.png：暂停下通过正式工具伤害入口触发死亡，64×64当前轮廓副本跨销毁显示。
- reentry.json：连续3次重进纹理均14，错误为空。
- human-combat-trace.json：保护开启，12秒241样本，真实人形与虫状态；包含人形四个攻击阶段，不是难度验收。
- mixed-contact-rift.png：真实移动后人形追来，与固着虫形成混合近战；如实保留近距离重叠，不冒称所有遮挡都已解决。

[实景体验](http://127.0.0.1:3000/pollution-review.html?riftSeed=26&sample=human)。先切换观察保护再接近观察；外观下拉可对照三档。seed7/11/9分别实际生成人形低/中/高档，sample=human默认选人形。

完整范围与局限见[QA](../../qa/iteration-17.md)。R2中档结构调整已于2026-09-08获用户PASS；技术验证范围及实景复核局限仍按QA记录。
