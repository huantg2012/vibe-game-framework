# R100 v3 角色精细身体修复

功能范围：COH-F002 / COH-F003 / COH-F005。仅 native v3 玩家实际身体；原 8px 保守生成/AI 网格、20×20px 玩家、32px Host、地图身份、奖励和已验收像素未改。

## 原因与改法

同一个实物原先以三角形交到的整块 8px 格做玩家碰撞，在稀疏角留下可见表面以外的阻挡。实际玩家现在对全部 `role=solid` 三角形的 XY 并集作连续 AABB 扫掠，按接触法线滑动；`relief` 不挡路，也不能盖掉下面的实体。缺地面仍取原 8px VOID，没有把虚空放宽。4 个旧接触点到真实实体的额外距离为 4.953 / 7.654 / 2.152 / 4.983px。

- WASD：每个 Arcade `worldstep` 的物理子步碰撞后、sprite 回写前校正 body，保留 `prevFrame`，不重复加位移。
- 冲刺、穿墙落脚、声诱与探查的合法起点使用同源查询。穿墙仍只豁免选中的一条 8px 实体平面；16px 厚墙和 VOID 不能通过。
- 原生技能瞬移在 `Body.reset` 后补 collider offset 同步；否则 Phaser 当帧会暂留 `sprite−6px` 的中心，影响下一段冲刺和当帧保存。
- 新 v3 完整身体和 sprite/body 关系均严格校验。旧版本技能偏移另由专项兼容任务处理，此报告不声称其已完成。

## 固定版本与证据边界

- 3065：原始 before；原图和诊断在 `../manual-boundary-review/`。
- 3072 / `frozen/source-snapshot.json`：精细身体与帧围栏；`replay-frozen/` 为 18 段原始普通键盘输入的独立重放。全部停帧 `fineSupport=true`，无运行错误。真实轮廓滑动改变之后的路线，因此不能把最终坐标直接逐项当作同起点距离差。
- 3073 / `frozen-final/source-snapshot.json`：补原生技能 `reset` offset 同步。与 3072 的区别仅 RiftScene 该 helper 及两处调用；WASD 三角形查询和美术未变。
- 浏览器：真实 Chrome / WebGL，1440×1000（几何）、1440×960（正式续局）。查询时间是 CPU wall time，不代表 GPU 占用。

## 通过的检查

1. `cpu.json`：4 个精确旧接触点；6572 个确定性长扫掠/滑动；6397 个旧保守合法点仍然合法；8px 穿墙正例、厚墙/VOID 反例、relief、完整身体支持、稀疏角技能起点。全部不修改输入地图/配方/mesh。
2. 同报告检查 20 世界重度污染构造，最复杂 `shell-chain` 为 10,428 个投影三角。10,000 步 CPU p50 0.079ms / p95 0.088ms / max 1.260ms。最高一次准备为 6.442ms，未构建整图高精度缓存。
3. `browser/report.json`：4 个旧接触点由 QA 明确重定位后再普通按键；before 完整身体合法且与 sprite 一致。4 个斜向输入及一个明确注入的固定 20px 敌体挤压夹具；630 个真实物理步，0 穿实体/VOID、0 sprite/body 错位，查询 p95 约 0.1ms、max 约 0.3ms。此为故障回归，不冒充自然玩家行程。
4. `cold-recovery/report.json`：真实旧普通 `silt-gel-low` 保存件正式 Continue；在完整身体合法、旧保守身体判否的 (680,160) 贴边点，正常按键、速度冲量、Esc 保存、reload 冷 Continue，世界身份和身体位置一致。QA 只将角色放到指定点，不改几何或旧保存字节。
5. `current-dash-save/report.json`：受控授予并供奉一个 dash 物品，真实准备 UI 装 Q，正式入场，Q 后约 55ms 按 Esc。已付费 active dash 存档中心偏差 0/0；reload 正式 Continue 的首个零时钟 checkpoint 保留位置、技能剩时、世界身份，没有重复扣次数。未注入角色位置、物理时钟或保存状态。
6. `admission.json`：实际旧普通帧兼容、新精细角可保存；sprite/body 错位、实体穿透、VOID 拒绝，6 项 CPU 检查。
7. `recovery-suite-final.log`：完整 `check:rift-recovery` 24 组通过；旧 v1/v2 生成/恢复、12/12 worker 注销等仍过。既有 tool-targeting 检查、tsc、dev 启动也过。仓库无独立 lint 命令，未虚称已跑 lint。

## 正式穿墙覆盖的限制

在 ash-strata/severe、crystal-fibre/severe、ivory-basin/low、cinder-ridge/low 的此 seed 上，定向扫描没有找到完整 20px 身体能穿过的 8px 薄墙正例。未伪造正式关卡成功截图。穿墙几何正/反例由 CPU 覆盖；真实当帧落脚同步与已验证冲刺共用 helper。关卡是否需要更多可用薄墙，是另一个关卡/能力设计判断，不在本次修复中改变墙厚规则。

## 已拒绝的采集

- `replay/`：热更新导致中途回出生点，不能作为前后证据。
- `browser-rejected-offset-probe/`：QA 用 Phaser 原始 `body.reset` 定点后立即读到了未应用 collider offset 的初值；真实后续步虽有效，初始对照无效。已改用生产 helper 重采为 `browser/`。
- `frozen-unreviewed-auto-frame/`：未被任何验收浏览器使用的临时快照；autoFrame 为 Phaser 未声明内部字段，已移除该无须写入，最终以 `frozen-final/` 为准。
- 总恢复测试最初两次因旧 Node Phaser 替身缺少 Physics 事件常量、world.off 而退出；根裁决后补真实 world.on/off 替身和精确解绑断言，生产没有可选 off 兜底。

## 视觉核对

实际截图保持原材料、照明和轮廓。013 处按左键现在沿真实斜面边缘继续向左/下滑行，避免停在外侧空地；008 的上行仍会被确实存在的两件实体相交处挡住。修复只消除碰撞外扩，没有把宽实心斜板改为可走坡面。局部画面可读性仍应与根的正常视野手动复核一起判断；这份几何通过不能替代整世界体验终审。
