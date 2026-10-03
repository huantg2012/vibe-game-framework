# 异步接入：非作者审查与修复复验

2026-10-03，审查对象为当前工作树的异步新出击、冷续局、存档快照与场景生命周期。执行时各模块 SHA256 与基线 revision 记录在 JSON；不是把未提交实现冒记为基线已有能力。本批只新增证据，没有修改被审实现。

## 发现与处置

- **P1，准备失败丢失旧局救援入口，已修复。** `loadExpedition` 的异步准备异常原先直接返回 failed，跳过 `canAbandonInterruptedRun` / `onInterrupted`，导致基地有效但出行身份坏掉的记录只能反复重试。当前 catch 在存档快照仍相同、基地确可救援且调用方提供入口时，恢复明确放弃确认；取消和记录变更不走此分支。独立脚本复验得到 `validEnvelopeSnapshot=true, canRescue=true, result=interrupted, rescueShown=1, savedBytesPreserved=true`。该次脚本在临时目录；持久自动负例由 `tools/recovery/check-async-entry.ts` 承接。
- **P2，等待期间直接 DESTROY 后恢复已销毁场景，已修复并浏览器复验。** Phaser 的 `scene.remove` / 整体销毁不保证先发 SHUTDOWN。旧异步 finally 调用 `pauseMenu.finishPreparation`，访问失效的 ScenePlugin 时真实触发 `Cannot read properties of null (reading 'isPaused')`。现净化点先释放请求/UI所有权，标题在 DESTROY 和 SHUTDOWN 共用幂等清理；迟到 continuation 不恢复、不重绘。两条实际浏览器结果见 [direct-destroy-report.json](direct-destroy-report.json)。

## 真实浏览器结果

1. 净化点原生备行显示“取消准备”后直接移除场景：Worker 恰好终止一次，存档逐字保持，准备 UI 清零，没有 pageerror 或 console error。
2. 首页冷续局显示“取消载入”后直接移除场景：Worker 恰好终止一次，原 checkpoint 字节保持，首页 UI 清零，没有误入 Rift，也没有 pageerror 或 console error。
3. 隔离空记录使用旧 DEV `#rift=17`：实际到达 RiftScene，真实诊断 seed 为 17，零 pageerror。没有把此同步 DEV 入口算作正式生成性能通过。
4. 在未准备缓存时携带有效历史 identity 直接启动 RiftScene：明确在 `withPreparedProceduralRecovery` 拒绝，返回标题“原记录已保留”；未进入 Rift、未新增存档、零 pageerror。预期的 create 错误日志单列，不隐藏。见 [rift-entry-boundary-report.json](rift-entry-boundary-report.json)。

## 入口边界判断

`directDevEntry` 只在 `import.meta.env.DEV && !devFixture && !recovery` 成立。正式新出击/续局始终带 recovery，即使在开发服务器上也必须通过 prepared-only；缓存 miss 不可能落入这个无身份分支。生产构建的 DEV 常量为 false，无身份直接入口明确拒绝。现有作者 fixture 继续拥有自己的 `createLayout`，历史 Boot 深链接和污染体对照页仍可使用无身份开发入口。按上述范围，该区分合理；不将 DEV 同步生成作为生产绕过路径，也不宣称已消除所有入场预烤长任务。

## 生产构建 Worker 与跨运行时边界

生产构建检查使用独立的 `vite preview` 3041 端口、真实 Chromium 154.0.8037.93，以及 `dist/assets/rift-generation-worker-Dh2SjsVL.js`。生产页面没有 `window.__game`；测试直接创建实际打包的 module Worker，HTTP 响应 SHA256 与磁盘产物一致，生产客户端 chunk 也引用此文件。没有以 DEV Worker 冒充生产打包验证。

- **同一浏览器内的迁移等价性通过。** 旧同步冻结 executor → DEV Worker → 生产 Worker，全部 3 个 v2、2 个无版本金样的身份与 layout/Host/sample/metadata 全值一致。10 次恢复均使用全新 Worker，以同步旧入口产生的身份进行冷恢复，严格签名校验保持启用；零 pageerror / console error。详见 [browser-worker-equivalence-report.json](browser-worker-equivalence-report.json)。这证明当前 Chrome 中的 Worker 迁移没有引入生成变化。
- **Node 历史金样跨 V8 不全兼容，未修复，登记 R100-P05。** 最初的生产金样测试通过 4 个 v1，随后在 v2-0 被严格身份校验拒绝。原始失败保留在 [production-worker-report.json](production-worker-report.json)，没有覆盖或改为 PASS。进一步检查发现全部 3 个 v2 的全值金样都与 Node 不同，但只有 v2-0 的身份签名不同；v2-5、v2-70421 的身份/layout/Host 相同，仅 sampleSha256 不同，不能把它们误记为身份恢复失败。2 个无版本样本全部相同。不能由本批结果宣称所有历史平台兼容。
- **根因是既有超越函数浮点差异，不是打包/minify。** Chrome 的 DEV 与生产结果完全相同，Node v22.14.0 / V8 12.4.254.21-node.22 则在 v2-0 的两个角度上差一个浮点量级：`enemySpawns[2].facing` 为 `-8.13010235415598` / `-8.130102354155978`，`formations[8].angle` 为 `-0.40740072580072684` / `-0.4074007258007268`。来源是冻结 executor 的 `Math.atan2`，随后引起 metadata 与 identity 签名变化；该例地形与 Host 图相同。证据见 [production-worker-diagnosis.json](production-worker-diagnosis.json)。

本批没有修改冻结算法、金样、签名精度或拒绝规则，也没有伪造跨版本兼容。既有记录若由不同数学实现产生，仍可能被严格恢复拒绝；长期解法需要单独定义历史恢复兼容性，而不能用舍入所有旧值来冒充等价修复。时长仅作描述，不是自然种子延迟验收。

## 复跑

从仓库根运行下面两项，默认使用 3027。可用 `GAME_URL`、`PLAYWRIGHT_MODULE`、`CHROME_PATH` 指定环境。

```sh
node docs/qa/artifacts/rift-r100-i02-validation/async-review/review-direct-destroy.mjs
node docs/qa/artifacts/rift-r100-i02-validation/async-review/review-rift-entry-boundary.mjs
```

生产检查先运行 `npm run build`，再在独立终端运行 `npm run preview -- --host 127.0.0.1 --port 3041 --strictPort`。当前浏览器等价检查同时需要 3027 开发服务器，可用 `DEV_URL` 和 `GAME_URL` 覆盖地址。

```sh
node docs/qa/artifacts/rift-r100-i02-validation/async-review/review-browser-worker-equivalence.mjs
```

`review-production-worker.mjs` 是保留的 Node 金样跨运行时诊断，在当前 Chrome 上会如实失败；`diagnose-production-worker.mjs` 比较三种执行环境并列出具体数值差。它们不属于已通过的迁移等价性结论。临时 preview 已在收尾停止，没有影响 3027。

上述检查不证明自然游玩、全设备性能、所有生成种子、视觉或玩家审美接受。
