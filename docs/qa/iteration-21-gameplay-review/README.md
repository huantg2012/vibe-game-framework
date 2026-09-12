# 迭代21 M：正常实机代表帧

2026-09-12。Agent局部复核完成，用户观感待审。试玩入口：[长路线 / 短窗近战](http://127.0.0.1:3002/spatial-slices.html?view=stage&route=long&loadout=melee&seed=7)。

这里是未经编辑的真实整页截图，来自正式RiftScene与隔离训练库存。输入为WASD、Space、Q/F、E、Tab、Esc；没有传送、修改角色或敌人状态。短路与完整搜撤的证据范围见[QA报告](../iteration-21-gameplay.md)。

前六张来自最终海层源码的短复验。后四张是此前完整机制/听觉专项，海材质仍为第一轮修正；技能源码相同，不能把它们当作最终海体图片。画面有敌人脚挡住壳、受击动作只捕获一瞬等真实限制，保留原图而不换摆拍。

## 最终海体与技能显隐

- [最终海层：中岸和真实孔口，无记忆岸壁跨海栅栏](stage-long-sea.png)。
- [最终海层：北外沿正常反向观察](stage-north-edge.png)。
- [最终海层：离身回看落地石块与断续压力痕](stage-pressure.png)。
- [最终海层：当前可见的真实线与压力](stage-tools-visible.png)。
- [最终海层：实例尚在生效，离开视野时图形隐藏](stage-tools-hidden.png)。
- [最终海层：回看原处，真实痕迹恢复](stage-tools-returned.png)。

## 真实技能触发补充

- [完整近战趟：真实结线已落地；使用第一轮海层修正，不作为最终海体样貌](melee-stitch.png)。
- [完整近战趟：正伤触发空壳；仅该瞬间，不证明全段短动画可辨](melee-siphon.png)。
- [轻装趟：真实纯听觉拦截确认；使用第一轮海层修正](light-hearing.png)。
- [轻装趟：真实声音落点影响敌人；壳与敌人脚部分重叠，静帧不能证明投掷全过程](light-lure.png)。

## 追溯

[manifest.json](manifest.json)记录代表图SHA256、每趟源码前后哈希、全部本地原始证据文件哈希与性能摘要。连续原速录像、原始失败尝试、只读轨迹和诊断保留于`docs/qa/artifacts/iteration-21-gameplay/`，该大体积目录被Git忽略，不随提交上传。清单提供可核对索引，不代表Git内包含录像。

最初启动失败、执行器过早读取结算及错误听觉前提均已保留归因；海层CPU重建只作故障定位，不称GPU深度实测。最终composition与settlement趟负责最后shader正常合成、活跃实例消隐和实际撤离冻结；bare/melee负责完整两敌/三翻找搜撤。单机有限种子结果不代表发行认证、用户美术PASS或持续供给四A通过。
