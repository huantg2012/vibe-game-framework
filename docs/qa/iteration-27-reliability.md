# 迭代27 · 正式出行恢复与连续出发

日期：2026-09-19。对应 I27-B/C 与场景接线 A/D/E/J；基线 `1d7f309`。本报告区分原评审症状、实施中抓到的实际缺陷、故障注入和正常操作证据。未提交或推送。

## 交付结果

- 正式随机俯视2D接入完整整帧恢复。关闭、刷新、重开后继续同一run、世界、人物/战斗/敌人/Host/工具/搜寻/探索状态；不重开种子、不补资源、不结算离线时间。
- 出发先生成并校验世界，与`beginRun + cycle + departure intent`原子保存；首个完整帧替换意图。死亡/成功/主动放弃沿同一run账本一次进入基地结算，归来随机流与替补武器ID绑定本趟。
- 当前13族工具与全正式甲身体、丙/丁环境宿主均具备恢复状态。Host计时先恢复，Tool只接回来源和表现；末次消费后的效果继续，不再消费。此工具主体由growth agent实现，场景接线/Host/跨域边界由本任务实现。
- 旧active无快照或坏世界包有明确“保留记录”与“放弃本趟”出口；只有基地和库存有效才允许后者。负HP、错误模块/容量、非法成长级别、潮汐或稳定度等坏基地拒绝载入与救援，原bytes保留。明确弃局会丢随身物并结算既定一次冲击，基地存物/成长保留。
- 存储拒写冻结候选并重试同一份；运行态校验失败显示持续可点的“返回标题，保留已存记录”，不留下无出口暂停。入场失败同样回到保留记录的标题。
- 成长生命、薪柴亲和、初始混乱HUD及完整恢复值已接实际领域接口；稳定度记录包含零薪柴成功撤离、模块新归零、完整峰值和换潮。首次免冲击按实际cycle 1执行。角色本体、分段上半身和武器在近距装置交互时共同淡化，模型/物理位置不变。

## WG07：原历史与实际定位边界

原评审在艺术B24准备路径和协调员第五趟出现过切换停滞，历史没有异常堆栈。先在冻结旧 `1d7f309` 诊断版3014重放高级24薪柴存档：净化器20→60、供奉石块、成长、留影/旧布/优良撬棍整备后出发成功；无pageerror。root/art重放原自然第五→第六也未复现。**原WG07根因仍未证实，不能写成已找到。**

本次实现已消除有界的半切换路径：清理在Phaser关闭场景插件前执行，update/postUpdate在移交/清理中短路；每个资源独立清理，即使一项抛错仍尝试后续监听、音频、面板、输入、世界对象与HUD，并记录具体失败阶段；出发已保存则回标题保留意图。

实施中的真实自然链找到另一条可复现缺陷：第三次出发seed `3955787773` 的run时钟仅16.66ms，Trail时钟却残留上一趟47814.76ms。完整校验拒绝保存并暂停，原实现仅瞬时toast，随后看似无UI卡死。修复为Trail在同实例create/destroy重置时钟，并补永久异常入口。旧失败原包仍保留，正常刷新后以同一run/seed继续成功。这是本轮泛化恢复暴露的复用缺陷，不冒充历史WG07的原始原因。

多内容首帧检查还找到：新增Host清单校验错误地将目标排序，而Combat按生成顺序登记“可击丁核→丙群核”。已恢复一致的生成顺序，并保留实际seed0包为稳定反例；foreign核仍拒绝。

## 实测证据

统一目录：`docs/qa/artifacts/iteration-27/reliability/`。固定构建以保留目录为准，不依赖HMR。

- **原历史重放**：`legacy-full-history-after.png`、`repro-before.png`、`repro-after.png`、`repro-errors.json`。生产交互API只用于打开装置，实际准备/出发用键鼠；属于高级fixture复放，不是自然获得证明。
- **正常刷新续局**：`active-checkpoint.storage.json`、`before-reload.json`、`after-reload.json`及截图，实际移动、Esc、刷新、继续，same run/seed/HP/混乱；恢复后首次正常物理步可能前移约2.44px，非离线推进。root另有真实购买两级生命130HP、40初始混乱及刷新证据。
- **六次连续周转，最终build7**：root接管复核 `roundtrips-final.json`，脚本 `tools/qa/check-sequential-departures.mjs`。同一浏览器/Scene实例六次真实准备→出发→确认弃局→回基地；第一趟额外暂停刷新同位置/ID。中途按真实备行选择已有备用武器；无补装、无pageerror/consoleError。该链证明生命周期与失败周转，不代替art自然拾获/供奉/成熟链。
- **八种实际首帧**：`first-frames-build7.json`。每个种子独立浏览器上下文，实际RiftScene建场并自动写首帧，断言实际identity.seed与请求一致。seed 0/1/2/42/432889249/3955787773/20260918/777覆盖地铁/图书馆/诊所/室外、2/3核与可击丁；8/8通过，异常日志空。输入仅为合法出发意图，没有注入运行态。
- **单个析构故障**：`cleanup-fault-build6.json`、`cleanup-fault-preserved-title.png`。真实碰撞析构完成后主动throw，其后atmosphere/breath/visibility/装置/player/tilemap仍全部释放，场景切回标题，无遗留面板/过渡。已提交意图保留，刷新继续同run并生成完整帧。预期console报告包含具体device-collision阶段；pageerror为空。
- **非法候选帧的可操作出口**：`invalid-frame-ui-build7.json`、`invalid-frame-action.png`。仅将一次序列化候选的Trail clock改成超出本趟时间，触发真实校验；持续按钮可点，返回标题前后原存档字节一致，真实Enter继续同run。一次预期console拒绝，pageerror为空。
- **坏世界包救援**：root独立 `root/bad-world-rescue.json`：取消不改bytes、拒写不结损、确认重试保留库存/成长并返基地、再次reload不二次冲击、负HP基地不提供救援，全过。
- **自然链Trail红例与续局**：`../economy-cycle/03-runtime-capture.json`、`03-paused-without-panel.storage.json`、`03-build6-continued.storage.json`。art保留原ID/seed继续；完整自然账本见art报告。

早期`roundtrips-build4/5.json`、`roundtrip-failure.png`是探索中的失败证据，不能当最终PASS。第一轮八seed脚本曾在活动页写fixture再reload，被pagehide旧帧覆盖后续seed，`first-frames-build6.json`仅0/1可用于定位；已改每seed独立context并强断言identity，最终以build7为准。`browser-errors.jsonl`另含并行工具文件写入途中编译的失效中间build日志，不是正式冻版结果。

## 机器检查与合同

- `npm run typecheck`通过；诊断Vite固定构建通过。root最终执行`npm run build`及正式无DEV接口入口复核。
- `npm run check:rift-recovery`由root收口全部已登记组，包含实际formal五Host与可击丁核反例、13族末次消费、minimap、一次结算/随机/生命周期等。
- `check-effects.ts`14项通过，新增同一Trail对象create→update→destroy→create，时钟和访问标记不串趟。
- `check-procedural-identity.ts`覆盖原seed生成重试；不能以最终recipe强制重建，否则seed432889249生成签名会变化。
- `check-procedural-rescue.ts`通过真实SaveManager救援/拒写重试及18个坏基地反例，任何拒绝都保持live状态和原bytes。输入夹具固化到`tools/recovery/fixtures/prepared-base.json`。
- `tools/inventory/check-save-migration.ts`9项通过。旧测试人为设置tide2/phase1却保留tide1强度1.0，违反历史配置；夹具改为合法1.4，不放松生产校验。保留旧V1物件身份、槽位、余次、成长、runtime counters与拒写迁移断言。
- `git diff --check`通过；项目没有lint脚本/配置，不能宣称已跑独立lint。Vite `npm run dev`运行在3015并完成浏览器入口冒烟；后续实测使用冻结构建避免HMR。
- 两次连续完整恢复门失败时按code逃逸规则报告root，由其复核旧首趟夹具并执行整套；本轮两次连续周转门失败也交root代跑最终6轮，不用反复自行重试代替升级复核。

Spec原地更新`system-field-inventory.md`，架构正式登记`managers/rift-recovery.ts`及Host/AI/工具与救援边界。没有修改框架CLAUDE或提交/push。未宣称无限seed、长期性能、音频听感或玩家审美全覆盖；本报告的八seed与六轮只是写明范围的运行证据。
