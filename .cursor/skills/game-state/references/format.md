# 文本格式与命令（schemaVersion 1）

全部源文件用 UTF-8 JSON，Git 可读可审查，不依赖 YAML 库。默认 `docs/game-state/`；由 atlas.json 指向功能文件，按领域拆分加载。新增品类从 init 开始，初始化没有任何已实现或已验收假设。

## atlas.json

- `schemaVersion`: 1。
- `project`: `id`, `title`, `summary` 非空文本。
- `domains`: `{id,title,coverage,note}`。coverage = `mapped | unreviewed | not-applicable`；note 必须说明扫描范围、剩余问题或不适用原因。mapped 必须有条目，不表示全验收。
- `featureFiles`: 功能数组文件名，如 `features/core.json`，相对于 atlas 所在目录。
- `evidenceFile`: 证据数组文件名，如 `evidence.json`，相对于 atlas 所在目录。
- `constraints`: `{id,statement,status,source:{path,note?},featureIds,supersededBy?}`。status = active 或 superseded；后者须指向另一约束 ID。
- `inventory`: `{id,title,include:[glob],exclude:[{pattern,reason}]}`。glob 支持 `*`、`**`、`?`，相对项目根。如 `src/scenes/*.ts`、`data/*.csv`。每个扫描到的文件必须归入某功能 sources 或有带理由的排除，不能用通配忽略所有未知。新引擎自行配置目录。

## 功能数组

```json
[{
  "id": "SAVE-RESUME",
  "title": "继续当前旅程",
  "domain": "persistence",
  "summary": "从已有存档恢复当前旅程；异常版本的行为仍待核实。",
  "delivery": "unknown",
  "work": "active",
  "entryPoints": ["主菜单 → 继续（入口待运行核对）"],
  "sources": [{"path": "docs/specs/save.md", "role": "spec", "note": "恢复契约"}],
  "dependsOn": [],
  "evidence": [],
  "unknowns": ["尚未追踪实际调用及异常恢复"]
}]
```

此片段仅说明字段，不直接复制进新游戏。sources 的路径须真实存在。

- delivery = `unknown | design | dev | production | retired`；production 至少有入口与 code 来源，仍由维护者验证该声明语义。
- work = `active | paused | settled`；与接入及验证独立。
- sources = `{path,role,note?}`，role = `spec | code | data | test | decision | art | audio | doc`。
- dependsOn 指功能 ID，evidence 指证据 ID，unknowns 是明确问题文本数组。空数组有效，但无证据会提示。
- 所有来源 path 相对项目根，不含绝对路径、上跳或 URL；来源不能越过项目根。外部文档应先留可审查的项目内引用记录。

## 证据数组

每条：`{id,kind,result,date,revision,scope,limitations,sources}`。

- kind = source / automated / runtime / human。
- result = pass / fail / partial / unknown。不要为“没跑”填 pass。
- date = YYYY-MM-DD；revision 使用实际提交，无法定位则如实说明，不能凭空填当前 HEAD。
- scope 是实际验证条件及范围；limitations 非空（可写“该检查未发现其他限制；不涵盖……”）。
- sources 与功能同格式。执行或人工 pass 至少需要 doc/art/audio 的持久化报告/证据，test/code 文件不能冒充执行结果。工具只能检查字段，维护者负责内容真实性。
- 老报告可继续登记；渲染按证据版本对比其关联功能 code/data/art/audio 来源，指出已变或无法比较。该保守对比可能多报，需要读报告判定适用性，不擅自涂绿。

## 派生文件

`snapshot.json` 是来源文件 SHA-256 指纹 + inventory 文件列表 + 捕获版本/时刻，由 baseline 生成。它不包含验收结论。`INDEX.md` 是 Agent 可低成本阅读的全域概览；`atlas.html` 是无第三方资源的离线浏览器。两者不手改。

`render` 即使遇到漂移仍允许生成，但必须带诊断；格式错误则拒绝。`render --index-only` 用于每轮源数据更新；完整 HTML 只在需要浏览时生成。输出不会注入运行游戏页面。

## 迁移与集成

复制完整 game-state skill 到其他工具能读取的技能目录；命令中的 `<skill>` 改成实际路径。脚本只需 Node 18+，无 npm install。将“开工读索引，收尾维护证据和 check”两条路由加入对方框架即可；不要求对方使用本框架的 agent 名称或项目文档目录。

可按项目习惯将命令加入 npm scripts / Makefile / CI，不能用 CI 全绿表示 gameplay pass。版本 1 不自动安装 Git hook，也不自动提交、推送或改存档。
