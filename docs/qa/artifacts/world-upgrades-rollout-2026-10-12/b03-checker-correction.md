# B03 独立检查器字段错误

首轮Cleft三档完整生成后，在额外来源断言处误读mesh.spec.role。实际构建在r100-master-world.ts以 `{role,...geometry}` 分离物理角色，mesh.spec仅有几何，角色保留于definition.instances。故undefined与relief比较失败，未显示游戏缺陷。

检查器改为按原instance ID从definition.instances读取role；真实主体三角面包含与排除groundEdge断言完全保留。复验以同world/grade/seed在b02-cleft-r10-final保存。原失败report保留，不更改其结果。
