# P23 撕庭连续卷皮返工

原失败源为 `../b01-refined-source/source-snapshot.json`（3102），原实帧为 `../b01-refined-art/torn-reservoir-medium/02-rolled-edge-north.png`、`03-density-field-west.png`。三片独立内缩/封边及各片高度倍率把卷皮切成厚拼片；增加材质纹理不能修正该剪影。

本次 shapes 仅定点替换 `tornSheet`。三个凸域只用于三角化同一张皮：共用冠缘位置、同一连续曲率场与统一网格切分；内部共享边不再落地封墙。后段低贴床，近侧逐渐卷起，左角高、右角低；曲面回转后暴露内皮槽 2，实际薄撕端才用槽 1，完整后缘用外皮转下。没有新增世界字段、改色或修改固体/可走角色。保留实际面内槽 3 与光源，原主要足印逐像素保护。

`connection.json`：253 个三角，34 个原内封缝采样点均为连续皮面；17 档真实曲率法线；标准固体断面 721px、破断发光面 51px；原外足覆盖逐像素不变。既有 `fracture-fan` 和 `fallen-bundle` 实例数组保持。Root 同期独占修改 `clampBank`，本检查明确将该 profile 排除在精确对照外，不能据此声称新壳面已通过。

`contract-attempt1.log` 是联合纯检查的原失败，停于旧每 profile 600 三角上限；当时 root 新壳面是 1534 三角。不是身体碰撞失败，shapes 没有更改上限。Root 已将壳面收敛到 574 三角，原预算不变；联合合同第二次、12 个作者地图、类型、数据编译与开发服务源编译均通过，见 local-checks.json。原 source、照片、失败和 I11 隔离草稿全部保留。正常卷皮材质/剪影仍待同视角复审。
