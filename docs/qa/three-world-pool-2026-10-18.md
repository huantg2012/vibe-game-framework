# 三世界开放范围与旧局作废

日期：2026-10-18 · DEC-220 · F011 / F044 / F002 / F004

## 实现

正式随机池仅余烬脊、晶化林床、破膜盆地，三档污染共用；其他105行 `enabled=false`，108定义保留。当前目录的开放状态不写入冻结配方，不升级旧地图身份。逐图重构清单见[内容记录](../content/rift-open-worlds.md)。

继续记录先读取通过外层存档校验的 runStatus。有效active局只有开放世界v3包可恢复；其他世界及更早有效旧局在任何地图Worker或表现准备前调用既有abandon事务。该处理经用户明确授权，丢弃随身物及本趟收获，保留基地进度与访问历史，不当作撤离。已结算记录不受门禁弃局，坏存档保持原显式救援保护。写失败保留原始存档和active状态，重试不重复扣物；净化点沿原返程结算并只处理一次。

## 本次验证

- [锁池检查](artifacts/three-world-pool-2026-10-18/pool-check.json)：精确3开放／105关闭；384次跨档选择及128次反序目录、关闭世界历史用例通过。108定义和324配方与[修改前摘要](artifacts/three-world-pool-2026-10-18/recipes-before.json)完全相同；反转enabled的反例同样不改变配方。
- [废局检查](artifacts/three-world-pool-2026-10-18/recovery-check.log)：19项通过，覆盖checkpoint/departure、legacy与无身份有效旧局、无Worker启动、拒写重试、取消、三图三档普通恢复分支、settled保护、坏envelope和净化点一次结算。使用真实会话／保存事务与受控Worker，未在该脚本中渲染世界。
- [异步恢复回归](artifacts/three-world-pool-2026-10-18/async-entry-recheck.log)：16项通过；另12项存档迁移、11项记录替换及既有显式救援检查通过，命令见废局检查日志。旧异步测试的legacy active按新政策已不可续玩，改用历史真实晶化林床checkpoint；补齐测试环境的Worker started、ImageData与成功场景释放，未替换生产逻辑。适配过程中两次失败及最终通过均保留。
- [正式入口汇总](artifacts/three-world-pool-2026-10-18/browser-summary.json)：三图中污染正常出发、A角色、实际Space挥击及刷新继续通过。种子分别1／0／2；净化点由场景方法打开备行，之后走真实控件，隔离测试存储，不触及用户记录。
- [构建](artifacts/three-world-pool-2026-10-18/build.log)通过，保留既有大bundle告警；类型检查、目录codegen与依赖收据检查通过。源收据顺带同步此前已有代码hash，不刷新全库资格；324配方再次核对未变。
- 独立窄审未发现确定阻塞：核对保存失败、重复结算、active条件、legacy政策与三图正常恢复，未扩展为整套游戏review。

## 失败与复验

[首次浏览器记录](artifacts/three-world-pool-2026-10-18/browser/report.json)保留2通过／1失败：破膜冷续后的bodyPosition.y为1022.206308931623，保存值为1022.2063089316229，相差1.1368683772161603e-13px。原探针对浮点坐标作严格相等，产生误判。改为与同脚本中心／身体检查一致的1e-6px容差，保留实际误差数值；没有修改游戏坐标或恢复逻辑。[破膜同seed复验](artifacts/three-world-pool-2026-10-18/browser-film-recheck/report.json)通过，原失败未覆盖。汇总只采用前两图有效结果和这次复验，并核对共同served源hash一致。

## 边界

本轮验证开放政策和会话迁移，不重复生成或验收108地图。三图中档浏览器不代表全部种子、三档完整体验或自然整趟搜撤；怪物本土化仍仅晶化林床／破膜盆地。50ms预算已有未过记录，本轮不宣布性能达标，I14/P49保持开放。历史旧执行器仍供开发及冻结身份校验；正式入口允许范围以DEC-220为准。

复验入口：`tools/qa/check-three-world-pool.ts`、`tools/recovery/check-closed-world-entry.ts`、`tools/recovery/check-async-entry.ts`、`tools/qa/check-r100-production-browser.mjs`。
