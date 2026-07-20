# 框架变更日志

每次框架结构性变更记录为独立文件，按编号排序。

## 文件命名

`NNNN-short-slug.md`（如 `0003-round2-review.md`）

## Frontmatter 格式

```yaml
---
id: "NNNN"
date: YYYY-MM-DD
scope: framework | agent | protocol | cleanup
summary: "一句话描述"
commit: (git commit hash, optional)
---
```

## 何时写 changelog

- 框架 Retrospective 完成后（每 3 Slice）
- Hot fix 累积到一定量后合并记录
- 重大设计决策变更时

## 与 99-review.md 的关系

- `99-review.md`：问题发现 + 状态跟踪（审计视角）
- `changelog/`：变更历史（发生了什么、为什么、影响了哪些文件）

两者互补：review 记录"什么需要改"，changelog 记录"改了什么"。
