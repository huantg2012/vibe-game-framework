---
id: "0003"
date: 2026-07-20
scope: framework
summary: "Round 2 review：分层文档协议 + Spec维护协议 + 框架迭代协议"
commit: 2112eec
---

# 0003: Round 2 Review — 核心架构升级

## 分层文档协议（Layered Doc Protocol）

解决 AI agent 中后期 context 过载问题：
- Spec frontmatter 新增 `interfaces-with` + `exposes` 字段
- 正文首行必须是 TL;DR（1-2 句摘要）
- Agent 分级加载：L0（CLAUDE.md）→ L1（frontmatter 判断相关性）→ L2（读完整内容）
- gdd-core.md 重定位为索引文件（不搬运 spec 详情）
- QA 回归检查改为增量式（仅相关系统）

## Spec 维护协议

写入 CLAUDE.md，所有 agent 遵守：
- 一个逻辑系统 = 一个 spec，原地更新
- Git 负责历史，spec 只反映当前真相
- 变更类型明确：演进/接口变更/拆分/废弃各有操作规程

## 框架迭代协议

- Hot fix（≤5 分钟当场改）vs Record & Continue（记下来不停）
- Director Step 8：每 Slice 收集框架反馈
- 每 3 Slice 触发 Retrospective（时间预算 ≤10% 总工时）
- 判断标准：重复出现/规则矛盾/步骤空转 = 框架问题

## 其他修复

- Code agent 新增"你不做的事"集中负面约束
- QA agent 新增构建验证（npm run build/test）
- Design agent 新增 spec 自审 + 触发规则要求填 interfaces-with/exposes
- Task brief 模板改用结构化标记（`## Task: [ID] | assignee: [agent]`）
- 删除 guides/04-prototype、05-production
- 标记 guides/00-overview SUPERSEDED、03-design PARTIALLY OUTDATED
- 修正 ideation.md "Design阶段"→"Foundation"
- START-HERE.md/.html 同步更新
