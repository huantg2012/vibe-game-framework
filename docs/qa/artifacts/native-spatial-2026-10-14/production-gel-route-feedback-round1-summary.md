# gel / medium / 20261012 正式失败成本摘要

只读 [原回执](production-gel-route-feedback-round1.json)；没有新几何、地图或门测量，src/data 未修改。原源指纹稳定。

请求在 **60.206 秒**截止：48 次 proposal、66 work、47 次 final measurement 开始，0 full；47 条候选记录中 46 条有实际 geometry hash，c14 提前失败，c47 的拒绝工作已完成但最后 checkpoint 使候选记录未发布。G2、route probe、完整部署均未进入。

- 48 个 final 工作包共 **60.198 秒**。其中 fresh 15 个包 15.945 秒，已记录 refinement 32 个包 43.108 秒，c47 未发布记录的包 1.145 秒。
- 18 次 initial-H 身份预检仅 0.401 秒，已嵌在 final 工作包里，不能重复相加。final 包之外记录差额仅 0.008 秒。
- actualVOID 在已完成真实测量的 **18/46** 个候选可用：fresh 14/14，refinement 4/32。28 个 refinement 全部因 actual-void-hole-count-mismatch 不可用，并同时报 hole-profile-final-identity，耗时 **38.076 秒，占请求 63.24%**。
- 其中 **13 个**后继还从已知 actualVOID 不可用的基线出发，消耗 16.494 秒（27.40%）。这是错误身份链持续占用预算的直接证据；几何身份为何破坏由 Main 静态调查。
- 46 份实际 hash 只有40份唯一。hash 0f11a11fa87b4cbf 的 c31–34（base24）额外重复3次耗 3.779 秒；ed05d5201c59ffb8 的 c40–43（base39）额外重复3次耗 3.752 秒。共 **6 次重复、7.531 秒（12.51%）**。这是上面38.076秒坏身份细化的子集，不能另加成节省总量。

最优先调查和修复的是：有效H身份在细化时为何丢失，以及为何身份已失格的结果还能继续充当细化基线；其次是避免对相同真实几何反复支付完整规划／编译／测量成本。当前数据不支持把瓶颈归给新G4探针、初始身份预检或未执行的部署阶段。

**测量边界：** final-geometry 字段包含规划、fragment编译、真实几何／分组／G1-G3测量、指纹和actualVOID提取，没有各子步骤独立时钟，不能将整包耗时误标为纯编译CPU时间。c47没有实际hash／actualVOID字段，不能推定其是否重复或反馈可用。此次仅给成本证据，不调整门槛或宣称新流程通过。机器可读逐候选和重复分组见 [summary JSON](production-gel-route-feedback-round1-summary.json)。
