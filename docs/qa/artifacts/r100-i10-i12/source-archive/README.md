# 冻结源内容归档

此目录保存源清单声明的原始文件内容，供逐字还原。它不证明游戏、美术或性能通过，也不承诺无需安装依赖即可运行。

## 文件合同

- `objects/sha256/<前两位>/<完整 SHA>`：源文件、原 manifest 及明确补充件的内容，每份 SHA 只存一次。内容对象只读，恢复时复制，不能以硬链接恢复后更改 mode。
- `snapshots/<SHA>.json`：原 manifest 路径与 SHA、原临时根、逐文件相对路径/SHA/字节数/mode、必要父目录 mode。原 manifest 字节另存为内容对象，不重写临时路径。
- `indexes/<SHA>.json`：不可覆盖的索引修订。`index.json` 指向当前修订的相同字节；新增源生成新修订并保留父索引 SHA。引用某次结果时绑定具体 `indexes/…` 文件与 SHA。
- `plans/<SHA>.json`：本次源发现范围、读取的证据引用与 SHA、明确路径别名和未生成的未来引用。
- `explicit-aliases.json`：三条旧收据短路径的明确映射；每条同时绑定原收据 SHA、短字符串、规范源 SHA、旧美术索引 SHA 和具体 evidence JSON pointer。工具拒绝同一原文映射到不同身份。没有权威绑定的模糊路径不能按 basename 推测。
- `supplements.json`：实际资格收据绑定的 `package-lock.json`。它不加入任何旧源 manifest；只说明该资格记录所用的锁文件已保存。

原冻结器的 `src/data/public` 和四个入口配置文件均按 manifest 全量保存。35 份当前源都有 `package.json`、`tsconfig.json`、`index.html`、`r100-gym.html`；**原源清单均没有 package-lock**。`node_modules` 软链接、Vite 缓存、浏览器和操作系统不属于该冻结合同，不予冒充已归档。QA 执行器、原 manifest、临时目录和原有软链接均不修改。

工具仅支持 manifest 声明的普通文件和其必要父目录。拒绝绝对路径、`..` 文件项、反斜线、路径冲突、符号链接、未知文件类型与特殊权限位。空目录等未被 manifest 声明的内容不纳入还原声明。

## 核验与恢复

```sh
node --test tools/qa/check-r100-source-archive.mjs
node tools/qa/r100-source-archive.mjs verify \
  --archive docs/qa/artifacts/r100-i10-i12/source-archive \
  --restore-all --report /new/path/verification.json
```

`--restore-all` 对每份快照创建全新的隔离临时目录，从内容库写回所有文件，逐项重新计算 SHA、字节数、文件和目录 mode。每份成功后仅删除工具自建的恢复目录；失败目录保留，返回非零。它不读取原临时源，不启动服务。

保留某一份恢复目录：

```sh
node tools/qa/r100-source-archive.mjs restore \
  --archive docs/qa/artifacts/r100-i10-i12/source-archive \
  --manifest-sha ORIGINAL_MANIFEST_SHA256 \
  --target /canonical/parent/new-directory \
  --report /new/path/restore.json
```

目标必须不存在，父目录须为真实规范路径，且目标不在归档目录内。现存目录、损坏或截断对象、错误 manifest→snapshot 映射均拒绝。恢复目录只含原清单文件；不会隐式加入补充 lock 或 node_modules。

## 最终源增量追加

最终源冻结后，由 pipeline 给出正式 source/package/continuity 引用，再生成新计划。不要覆盖 `closure-plan.json` 或此前收据。

```sh
node tools/qa/r100-source-archive.mjs plan \
  --scan docs/qa/artifacts/r100-i10-i12 \
  --reference docs/qa/artifacts/r100-i10-i12/final-binding/plan.json \
  --reference docs/qa/artifacts/r100-i10-i12/final-art-review.json \
  --aliases docs/qa/artifacts/r100-i10-i12/source-archive/explicit-aliases.json \
  --supplements docs/qa/artifacts/r100-i10-i12/source-archive/supplements.json \
  --report /new/path/final-plan.json
node tools/qa/r100-source-archive.mjs pack \
  --archive docs/qa/artifacts/r100-i10-i12/source-archive \
  --plan /new/path/final-plan.json --report /new/path/final-pack.json
```

之后运行完整 `verify --restore-all`。已有对象复用，旧索引不删除。当前最终源与最终美术文件仍是计划中的 pending 项，不能由本归档代签。

## 范围与保留错误

初步 `initial-plan.json` 只有34源；深查已绑定美术历史后，`closure-plan.json` 纳入第35份原 r4 源。两次早期 discovery 错误由历史相对路径写法导致，已保留，不是游戏失败。root 批准明确 aliases 后才继续；原文件与证据不作纠正性重写。

任务关联 COH-F011（正式随机世界与空间配方池）的 QA 来源保存。工具没有产品运行时 import、没有新玩法接口，不修改 source continuity 或 art acceptance。
