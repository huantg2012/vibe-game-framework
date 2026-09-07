# 迭代16证据

模型图已更新为R3（仅中档回收）；早期实景截图和行为轨迹保留为R1历史证据。完整验证见[报告](../../qa/iteration-16.md)。

- insect-sheet.png：R3污染实体，三行渗透/改写/覆盖，四列上/右/下/左；4倍nearest用于审形，不是游戏放大比例。
- insect-motion.png：待机/走路/警觉/蓄势/攻击/收势，每行8时刻；2倍nearest。
- insect-rift.png（R1外形）：seed7旧图书馆，正式RiftScene的地面、视野与模型。
- insect-rewrite-rift.png（R1外形）：seed11改写档，近距离观察，保护开启并暂停以取图。
- insect-death-rift.png（R1外形）：同一虫死亡后仍使用虫轮廓的池自有纹理；保护/暂停下以生产工具伤害入口触发，不代表玩家挥刀输入测试。
- reentry.json：连续三次重进，受监控纹理数量均13，运行错误为空。
- doorframe-trace.json：seed1，12秒/241次，门框静止位置记录；仅patrol阶段。
- insect-encounter-trace.json：seed7，不受保护，真实方向输入移动接近；12秒记录包含四个攻击阶段与玩家HP变化。

验收页：[seed7虫](http://127.0.0.1:3000/pollution-review.html?riftSeed=7)、[seed11虫](http://127.0.0.1:3000/pollution-review.html?riftSeed=11)。默认选虫；点击“接近观察”，需要长时间查看时明确打开“切换观察保护”。正常游戏不受此DEV页影响。

R2新增：
- insect-native.png：三档四向1:1原生像素。
- insect-overwrite-motion.png：高档六动作。
- insect-r2-infiltrate-rift.png / insect-r2-rewrite-rift.png / insect-r2-overwrite-rift.png：seed7同一实体、同位置/姿态/光照，观察保护和暂停下只切换外观。实际生成档保持infiltrate，不是机制随时间进化的演示。
- insect-r2-coverage-state.json：同一实体三档外观对照的可见状态记录。

验收页新增“外观”下拉，切换三档或“按生成”还原。

- insect-r2-combat-state.json：覆盖档外观、观察保护下，真实近战时钟12秒/241样本，包含四个攻击阶段；并非难度测试。

R3：当前模型图的中档恢复连续头腹与五足，折面仅占一侧；`insect-r2-*`保留R2历史，不能代表当前中档。

- insect-r3-rewrite-rift.png：R3中档，seed7正式场景，观察保护/暂停，只切换外观。
