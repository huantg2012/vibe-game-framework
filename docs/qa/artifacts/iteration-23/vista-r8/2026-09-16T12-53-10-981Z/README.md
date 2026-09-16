# R8 定点轮2质量段：准入完整QA，未作最终验收

本段使用ROOT批准的绘制资产方法修正：真实连续地形和碰撞保持，主壳/倒伏体改固定世界RGBA景物，中景改绘制悬挑，地表独有atlas一次映射。前两段FAIL证据保留。本段只运行正常10次节点访问，没有擅自启动完整路线。

## 本段运行事实

总墙钟27.691秒含启动/截帧/记录；3,220次采样断言/74类规则0失败，150动态样本。52项源/CSV/资产/工具/合同hash前后相同，原始JSON421,267字节；浏览器、console、HTTP错误0，无shader报错。

- 32°/span960/前望350/+x60、960×640逻辑/1920×1280内部，实际20×20身体与双足支持、角色屏幕投影、即时声画与固定端检查通过。
- 5资产实际加载：vista-r8、carapace-r8、fallen-r8、ground-atlas-r8、middle-carapace-r8。中景3形体/1画片/2空气层及新的middle-painted-cantilever合同相符。
- 两张主景物的角色/loaded/visible、固定-32°、尺寸/crop、opaque/depthTest/depthWrite参数符合冻结合同。隐藏solid代理colorWrite/depthWrite=false，collisionRetained=true。参数通过不等于视觉与碰撞轮廓已经逐点对齐。
- 地表atlas运行图像1472×1069，Clamp1001、repeat[1,1]、offset[0,0]，实际shader atlas bounds与真实地形geometryBounds匹配；不是repeat地砖或同一岩块纹理铺地。

[原始证据](evidence.json)、[摘要](summary.json)、[合同](expected-contract.json)、[运行脚本](qa-script-at-run.mjs)及连续视频page@a1aa4ea40b2e0e65040e7c55128461ff.webm保留。实际被动main-audio-2.webm保留，本质量段未解码/审听。

## 五关键原帧实际评审

直接查看[入口](00-start-locked.png)、[西侧](quality-02-west.png)、[前望](quality-03-look.png)、[汇合](quality-04-rejoin.png)、[主壳前](quality-08-wall-front.png)。

**可准入完整QA，不是用户审美PASS。** 规则阶梯主形已撤，壳片有非等距破损、内外层与埋入根部的绘制表达；近地/主壳/中景比上轮更属于同族，细节不再只由远画承担。look/rejoin上部有明确深景开口。rejoin角色位于壳尖后地面，已不再出现双脚落在完整不可走平顶内的上一轮假站顶画面。所看五帧未见白框、矩形卡边或新增明显裁边，人物身体可定位。

**保留缺陷与风险：** 入口上部仍由本地地面占较大部分；地表atlas刻画密度偏高，其中所画层缘不等于真实错台；近地前沿的光滑紫灰崖面与绘制地表接缝可见，小source-flake仍显低模碎块。rejoin的尖缘靠近脚部，单帧不足以证明整个身后的连续遮挡无误。可见轮廓与隐藏碰撞代理的真实尺寸对齐、边缘是否出现空气墙/可穿图像，需下一完整回归持续输入与原帧检验。

## 未验证

未在本段执行完整13节点/两回环与额外逆回、四探针持续阻挡、完整26秒形变范围、减少动态、M/刷新/存档、资源释放和性能统计。新的绘制贴图释放与atlas/cards边界也不得沿用旧版本结果。真实OS失焦、Agent音频听感、用户审美/探索欲望/回程记忆仍未验证。看过五静帧不等于看完全部连续视频。
