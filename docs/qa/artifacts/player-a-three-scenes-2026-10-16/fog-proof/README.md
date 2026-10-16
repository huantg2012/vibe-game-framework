# A 角色投影迷雾修复

真实 GPU 对同一静止姿态的 fog alpha 前后逐像素核对：角色轮廓外变化为 0；半遮挡的被挡侧泄漏为 0；全遮挡时变化为 0。半／全遮挡为测试临时 GeometryMask，结束恢复真实场景 mask，不声称代表全部地图遮挡。

- 重现：`node tools/qa/check-rift-player-presentation-fog.mjs`（需本地 3027 开发服务）。可设 `COH_FOG_PROOF_OUTPUT` 写回执。
- 数值与源码签名：`fog-isolation.json`。
- `body-before-fog.png`：实际原材质身体纹理，64×80，原生比例。原灯光已正常计算。
- `before-detail.png`／`after-detail.png`：前后实际场景最近邻局部放大；两次短输入停止位置略有差异，只作视觉佐证，不用于逐像素比较。

修复仅把真实受光、实体遮挡裁切后的身体 opaque alpha 投影到 fog 层。没有新灯、色彩增益或 FOV 查询／半径变化；contact 保留地面迷雾，身体深度仍低于 fog 与 HUD 层。精确逐像素判断来自同一帧 GPU 回执。
