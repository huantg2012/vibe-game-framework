---
status: TEMPLATE
created-by: design agent
created-when: 系统 Slice 的设计阶段
last-modified-by: [agent名]
last-modified-date: [YYYY-MM-DD]
interface-changed: false
note: 实际使用时复制为 system-[name].md
---

# 系统设计：[系统名]

## 概述
[一段话：做什么、为什么存在、服务哪个体验支柱]

## 状态模型
[这个系统管理哪些数据/状态]

```typescript
interface [SystemName]State {
  // [状态字段定义]
}
```

## 规则
1. 当 [条件] 时，[结果]
2. 当 [条件] 时，[结果]
3. ...

## 玩家交互
- 输入：[玩家能做什么操作]
- 反馈：[系统怎么告诉玩家发生了什么]

## 数值结构
| 参数 | 含义 | 范围 | 调节目的 |
| ---- | ---- | ---- | -------- |
| [参数A] | [含义] | [x-y] | [影响什么体验] |

## Schema（内容条目的数据结构）
```typescript
interface [EntityName] {
  id: string        // 格式: [PREFIX]_[序号]
  name: string      // 显示名（使用 world.md 术语表）
  // [其他字段]
}
```

## 边界情况
- 如果 [极端情况A]：[处理方式]
- 如果 [极端情况B]：[处理方式]

## 与已有系统的接口
- 从 [系统X] 接收：[什么数据/事件]
- 向 [系统Y] 发送：[什么数据/事件]

## 对已有系统的影响
- [系统X] 需要修改：[什么变化]（如果有）
- [系统Y] 不受影响

## 验证标准
- 本 Slice 结束时能验证：[什么问题]
- 预期正面结果：[什么]
- 如果不 work 的信号：[什么]

## 待验证假设
- [ ] [假设1]
- [ ] [假设2]
