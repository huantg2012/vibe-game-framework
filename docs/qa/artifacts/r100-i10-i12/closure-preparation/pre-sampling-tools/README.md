# I10–I12 结案提案准备器

状态：`prepared-only`。本目录没有实际结案提案，也没有修改台账。

`proposal-builder.mjs` 仅做文件与既有结果复核。它不运行浏览器、生成、binder baseline、89 项反例或构建，不支持应用台账的选项。实际输入尚缺时直接失败；不能用预备报告、空 SHA 或未来结果代替。

```sh
node docs/qa/artifacts/r100-i10-i12/closure-preparation/proposal-builder.mjs \
  --refs <完成后创建的输入引用文件> \
  --output docs/qa/artifacts/r100-i10-i12/closure-preparation/<全新目录>
```

默认只读，全部验证通过也不写文件。加 `--prepare-proposals` 才在全新目录生成三个 `proposal-not-applied` 提案、各步 achievement 证据与校验收据，最后写 `proposal-sequence.json`。输出父目录必须已存在；最终目录必须不存在。失败产物保留，不覆盖、不删除、不应用。

## 完成后的 refs 文件

根对象包含以下字段。每个引用必须是已存在文件的 `{path, sha256}`；SHA 是原始文件字节的 SHA-256。路径须在仓库内，不能经符号链接逃逸。

- `schemaVersion`: `1`。
- `date`: 实际 root 结案决定的 `YYYY-MM-DD`。
- `plan`: 完整最终计划，包含四份运行报告及各自 source binding、真实 technical/art/shader 根审引用。
- `prebindLedger`: 在实际 dry/89/binder 之前封存的原台账文件，不能使用当前台账路径。预期由 root 保存为 `final-binding/ledger.before-bind.json`。
- `boundLedger`: 当前 `docs/progress/rift-r100.json`。其**原始字节 SHA** 必须等于真实 89 报告的 `baseline.proposedLedgerSha256`。
- `negativeCheck`: 实际 89 项语义反例报告；不接受 prepared-only、合成 fixture 或仅 49 项小合同。
- `rootApproval`: 下节定义的实际 root 结案决定。
- `rcManifest`: 下节定义的已冻结 RC 文件；没有循环 self-SHA 或未来 commit 字段。
- `evidence`: 以下 23 个名字各一个精确引用，不接受缺项或额外未分类键。

`evidence` 键及对应产物：

```text
artRoot                   final-art-root-review.json
galleryRoot               root 实际最新图册布局/交互复核
audioRoot                 final-audio-root-disposition.json
activation                final-enable/report.json
selection                 selection-final108/selection.json
continuity                final-enable/continuity-all108.json
compatibility             独立五命令 final-compatibility-review.json
staticReview              final-static-readiness-review.json
staticSupplement          final-static-readiness-supplement.json
build                     final-build/execution.json
controlled                final-controlled-execution/execution.json
archivePlan               final-source-archive-plan.json
archiveIndex              source-archive/index.json
archivePack               source-archive/final-pack-report.json
archiveRestore            source-archive/final-source-restore-verification.json
productionIndependent     production-completion-review.json
continuousPolicy          自然48原 policy-freeze.json
continuousExecution       自然48完整 execution.json
continuousSummary         自然48完整 summary.json
continuousAutomaticReview 自然48实际自动 review.json
experienceRoot            自然48实际 independent-experience-review.json
toolChangeAddendum         final-tool-change-addendum.json
methodBindingAddendum      final-tool-method-binding-addendum.json
```

上面是角色说明，不是脚本写死的未来报告路径。refs 文件由 root 在产物真实完成后填写。若真实产物协议改变（例如自然 review 需要另行批准修正），应先独立审修正合同，再修改准备器；不能调宽成“任意 pass”。

## rootApproval 的实际合同

根对象必须包含：

- `status: "approved-i10-i12-closure-proposals"`、`reviewer: "root"`、与 refs 相同的 `date`。
- `builder`: 本准备器的精确文件引用；代码改变后旧批准失效。
- `inputs`: 与 refs 的 `plan/prebindLedger/boundLedger/negativeCheck/rcManifest/evidence` 六项组成的对象完全相等。不要把 `rootApproval` 本身塞入而形成循环。
- `finalSource`: 与最终 plan 完全相同的引用。
- 非空 `scope`、`limitations`，保留有限样本、继承、原失败、声音听感与人审边界。
- `iterationScopes`: 恰好 I10、I11、I12 三项。每项包含 `iterationId`、`status: "bounded-internal-pass"`、精确 `qualifiedWorldIds` 和 `{worldId,grade}` 数组 `gradeCases`、非空 `scope/limitations`。集合按冻结 baseline52 加 B01–B05、B01–B10、B01–B14 得到，分别 72/216、92/276、108/324，不从台账顺序截取。
- `issueDispositions`: 恰好 P36、P44。每项为 `issueId`、`decision: "bounded-resolved"`、`ledgerIssueSha256`、`limitations`。`ledgerIssueSha256` 为该完整 issue 对象 `JSON.stringify(issue,null,2)+"\n"` 的 SHA-256；它封住已由 root 有限解决的历史和限制。
- `p45Disposition`: `decision: "remaining-final-binding-checks-satisfied"`、与 refs 相同的 `negativeCheck`、非空 `limitations`。仅 I12 提案会补真实反例证据并处理原“最终检查仍待”文字，保留原文字及原修复历史。
- `gates`: 恰好脚本导出的 `GATE_INPUTS` 中 15 个具名门，每项含 `id/status:"pass"/blocking:true/finalSource/evidence/scope/limitations`。`evidence` 必须与该门映射的完整引用集合相等，没有省略或重复。所有门均需真实 root 判断，不能因文件存在自动签。

`GATE_INPUTS` 是本地脚本中的固定映射，可只读获取；最终输入不能改变它。14 个通用阻断门用于每轮，`frozen-internal-rc` 仅加入 I12 的 gateResults。实际 108/324 证据覆盖每轮的冻结精确子集。

## 真实 RC 文件

RC 由 root 创建并冻结后才作为输入。必需字段：

- `status: "frozen-internal-release-candidate"`、`reviewer: "root"`、实际非空 `revision`、`algorithmRevision: 6`。
- `finalSource/packages/finalPlan/negativeCheck/rootTechnical/rootShader/rootExperience/audioDisposition`：分别精确引用最终源、包、计划、真实反例和对应根审/声音裁决。
- `worldIds` 为精确 108，`gradeCases` 为精确 324。
- `versionStatus: "active"`、`finalAcceptance: null`、`humanApproval: false`、`releaseApproval: false`。
- `pendingIterations: ["R100-I13","R100-I14"]`。
- `listeningRisk: {id:"R100-R10",status:"unverified",requiredBeforeRelease:true,waived:false}`。
- 非空 `limitations`。这是内部候选范围，不是发布或用户认可。

仅 I12 提案将 `version.releaseManifest` 设置为 `{revision: rc.revision, path: rcManifest.path, hash: rcManifest.sha256}`。所有 `releaseGateResults` 原样保留；不签 G-COVERAGE 或其它发布门。

## 应用边界

1. root 先完成全部运行与独审，实际 dry→89→binder 写入；期间不得通过 P45 文本更新破坏前后台账 SHA 对账。
2. 冻结 RC 与实际 rootApproval，生成 refs。先只读运行本脚本，再显式准备提案。
3. QA 独立审三份提案。root 按 `proposal-sequence.json` 的 I10→I11→I12 顺序逐步 CAS 应用：当前台账 SHA 必须等于该步 `expectedPreviousLedgerSha256`，应用结果字节必须等于该步 `proposedLedger.sha256`。
4. 每步应用后运行 `node tools/world-study/r100-progress.mjs check --input docs/progress/rift-r100.json`。提案文件存在或生成器 exit0 都不是已应用的证明。

保护：全部 worlds、人审状态、历史 evidence 前缀、无关迭代、P36/P44 等其它 issues、R10/全部 risks、resume/changeLog、releaseGateResults 不变。I13/I14 仍 planned/not-started；R100 仍 active，finalAcceptance 仍 null。只在 I12 对 P45 作明确的最终检查补记。
