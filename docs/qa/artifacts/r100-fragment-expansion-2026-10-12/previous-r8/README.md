> 此目录为首轮保留记录：入口来自固定Git，但最初 TSX alias 配置指向工作区，故不单独作为隔离来源证明。最终固定Git闭包捕获请使用 `../previous-r8-confirmed/`。本轮内容将与该目录逐例比对；原文件和完整map仍保留。

# 扩展前的真实修订8存档基线

`baseline.json` 来自固定 Git `c0b71d93` 的隔离副本，不使用此次正在修改的 CSV。8例均为 medium / seed20261012，包括5个跨类型推广候选、已认可余烬脊、压纤四角与单柱旷地。

每例 `.recipe.json` 是该旧执行源真正创建的配方。报告记录完整地图的递归精确 hash（保留对象字段次序及 typed-array 类型/字节）和 albedo / normal / response / emission 四层 RGBA hash；全部执行源、作者 CSV 和实际材质文件另有 SHA256，并在捕获时逐一与固定 Git 原文核对。

完整 map 的8份 `.map.v8.gz` 约85MB，保留在生成机器本目录，以具名 `.gitignore` 排除 Git。它们未被删除。恢复检查如发现二进制会再校验内容；其他机器没有这些本地产物时，仍使用已提交的旧配方生成完整地图并与基线完整 map hash 和四层材质 hash 比较，报告 `storedMapChecked=false`。这个字段只表示是否额外校验保存的二进制，并不跳过实际地图生成。

当前源码复验：

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json \
  QA_REPORT=/tmp/r8-replay-new-report.json \
  node --expose-gc --import tsx tools/fragment-shape/check-r8-previous.mjs verify
```

需要重新生成完整旧map时：从本仓库用 `git archive c0b71d93 src data public package.json tsconfig.json` 解压至新临时目录，为其链接当前已安装的 `node_modules`。设置 `QA_SOURCE_ROOT` 指向该目录、`QA_SOURCE_COMMIT=c0b71d93`、`QA_GIT_ROOT` 指向仓库，设置 `QA_BASELINE_DIR` 为**新的空输出目录**，以相同 tsx 环境执行 `check-r8-previous.mjs capture`。工具拒绝覆盖已有证据；输出应与本基线的 recipe/map/RGBA hash一致。

此证据覆盖真实旧r8内容、部署及材质恢复；不覆盖浏览器冷续流程，也不外推所有世界/种子。
