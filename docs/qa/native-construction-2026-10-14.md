# DEV 直接构造与正常入口隔离 · 2026-10-14

绑定 COH-F011/F007/F013，关联 F006/F012/F014/F019/F044/F052；决定 DEC-211。普通入口隔离已完成，DEV 固定参考构造已实现；地图生成任务、随机化及全库空间品质未完成，I14/P49 保持开放。

## 正常入口与版本边界

普通 `create/selectR100ProductionRecipe` 的全部108世界使用r11。显式 `createR100NativeSpatialDevelopmentRecipe` 和 gym 的 `nativeSpatial=1` 才创建r12；不支持的DEV世界直接拒绝。旧r12保存配方仍按原校验和执行分派恢复，未改冻结CSV/sourceHash；该项是入口隔离，不是r12失败后回落旧图。

[8组小检查](artifacts/native-construction-2026-10-14/development-isolation-recipes-round1.json)通过：108×3的324份普通配方均r11、五代表×3的15份DEV配方均r12、18次普通select均r11；五代表三档普通配方与冻结r11 oracle一致。历史r12配方校验及篡改拒绝通过，本批没有重跑该历史图。畸形当前DEV作者数据不影响普通工厂。此处是配方检查，不是324图重新生成。

[Vite冒烟](artifacts/native-construction-2026-10-14/development-isolation-dev.json)185ms ready，根页、DEV gym及两模块HTTP 200，28个改动DEV工具语法通过；仅HTML/模块检查，没有浏览器JS或地图生成。隔离改动的 `tsc --noEmit` 通过；仓库没有顶层lint/test脚本。小回执从上一证据目录原样复制，旧大档案保留。

## 单图完整基线与阶段耗时

[正常r11基线](artifacts/native-construction-2026-10-14/normal-baseline.json)：双脊渡口 `split-rib-causeway` / seed20261012 / medium，普通工厂到完整地图返回 **2434.159ms**，attempt0，5薪柴/3污染物/3敌人，source稳定；地图SHA-256为 `40fc768708e0c509e7ee05d98ede415b8e56a38defcc60fdc8098e26fecb7960`。模块启动及hash断言在外，整进程约2903.881ms。本次仅一图，不含烘焙、重放、全库或弱设备对比。

DEV参考中的秒级数字只计各回执实际执行的构造/几何/遮视阶段。`fullCandidates=0` 表示没有完成出口、Master、完整资源/敌人/Host/巡逻及G4，不能与上述完整地图耗时直接比速度。

## DEV 构造范围

完整参考CSV直接声明L/H、母体、从属实体和出生探针；独立岸线CSV的 `macro-shore-step-v1` 在原始土地并集外岸构造不等长内缺/外伸，保护孔、搭接及完整物件支撑。它们一起进入认可的fragment-v1断缘和同源真实几何，G1/G2/G3全通过才调用一次正式完整候选链。没有调用原布局搜索、成图后增补或修改准入阈值。

参考/岸线CSV、各自SHA及组合身份保存在每轮产物。普通r12配方没有编码该参考布局，不能单独恢复它；这仍是固定构造验证，不是随机生成器或新存档协议。初始fragment/geometry、后续Master尝试及full分开计数，不能把初始编译次数称为所有物理数据的总编译次数。

## 冻结结果

[最终回执](artifacts/native-construction-2026-10-14/reference-final/report.json)源稳定，实际geometry hash `b6ae0b8f409bb3f7`，**仍拒绝**；1731.094ms只完成构造、结构身份与G1/G2/G3测量，1次fragment/初始geometry、0次Master/完整候选。

- 有效12H/6S；26,244个身体站位全部可达，G2通过。
- G1最大空白半径上界167.743px >160px；深空白跨度584px >448px。
- G3宽域占比0.548735 <0.55；最大宽域连通占比0.978474。完整内容与G4没有执行。
- 岸线短尾并入相邻段，避免固定小尾形成细针。最终实际外轮廓合并共线段后最长直边272px ≤ CSV的 `max_clean_run_px=384`，本项机械检查通过；不能拆分共线顶点刷过。实际10处内缺、0处外伸：模块支持双向构造，但本图外伸都被支撑保护或空白覆盖筛选取消。

[最终剪影](artifacts/native-construction-2026-10-14/reference-final/silhouette.png)与[早期round2剪影](artifacts/native-construction-2026-10-14/reference-round2/silhouette.png)用于观察岸线变化，早期最长直边932px。本次为同世界不同参考布局，**不是严格同布局A/B**；边界机制已实现不等于用户审美通过。

此前round1–21均未完整准入，原失败全保留：round19因输入旋转越界失败、0次几何，其余20轮有真实几何；最终冻结复核再次失败。没有挑成功截图覆盖失败，也没有将全可达或孔数正确写成参考图完成。

[最终纯输入/岸线检查](artifacts/native-construction-2026-10-14/shore-input-final/report.json)通过，包含13项shore检查及5项输入/无shore原样检查，0次地图编译。直接构造模块的[DEV冒烟](artifacts/native-construction-2026-10-14/reference-dev-smoke.json)135ms ready，根页及模块HTTP 200；类型检查通过。主线程最终 `npm run build`（含tsc/Vite）退出0，Vite阶段20.01秒，仅既有chunk体积warning；见[构建日志](artifacts/native-construction-2026-10-14/build.log)。主线程 `git diff --check` 通过。

## 证据边界

[静态独立审查](artifacts/native-construction-2026-10-14/review.md)与纯岸线检查各自保留来源指纹。早轮检查不自动覆盖后续参数或源码修改；全可达、H/S数量正确、图形参差及耗时均不能抵扣实际硬门失败。历史E243的凝胶单seed中档完整生成/精确重放仅覆盖旧r12求解器，不覆盖这批参考图。

后续仍需修复真实空白/宽域失败，完成完整准入、确定性恢复、正常镜头及动态潜行，再验证随机变化和留出样本；全108世界推广、用户审美与自然探索终验尚未发生。
