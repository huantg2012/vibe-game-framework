# R8 完整回归基线：已跑完，倒伏壳遮挡FAIL

本趟为新增cutface-r8后的冻结源。44次正常路线节点访问（29次覆盖原路+15次替代返程）、两回环、四probe及后续专项实际完成；**倒伏体接触实帧存在人物脚站进绘制肋片问题，当前不能交付为最终通过。** ROOT/code正在定位深度投影问题，之后只对受影响区域定向回归，不将此趟技术事实移植到新源。

## 真实数字和版本

总墙钟167.681秒，route阶段149.947秒（含probe/截帧，不称纯步行）；16,734次采样断言/99类规则，792窄动态样本，原始JSON2,351,723字节。53项源/CSV/资产/脚本/合同hash前后相同，运行时副本保留；后续产品修正是新版本。

原工具exit1/原始verdict CHECK FAILURES：**唯一自动失败是QA合同漏更新cliff说明文字**。实际值为新cutface语义`separate painted cut-face trim over actual geological section geometry`，合同仍旧说明。ROOT在开跑前明确授权独立cutface，源码与实际一致，属于测试合同陈旧；[纠正说明](contract-correction.json)保留，未删改原失败，也没有为一处说明文字盲重跑。其余运行规则未失败。视觉问题独立成立，不能因合同纠正改写成整批PASS。

[原始证据](evidence.json)、[数字摘要](summary.json)、[原合同](expected-contract.json)、[原脚本](qa-script-at-run.mjs)保留。

## 覆盖的运行事实

- 实际80正常/对角速度、20×20完整身体支持，两足净空1.5～4.499982。44次访问覆盖3区域/5连接/13点14唯一边的两个回环，返回出生；中景不授予支持。
- 持续650ms后四probe均0位移：南缘y1549.999901、西缘x378.000099、主壳y1218.000099、倒伏壳y1306.000099，实际原路退回。仅证明阻挡存在，不证明绘制轮廓对齐。
- 6资源实际加载，独有atlas/2cards/隐藏proxy的运行参数符合合同；地表真实bbox一次映射。新剖面已出现在[入口原帧](00-start-locked.png)，原光滑紫灰崖面缺口有所收口。
- 26秒声画实际共同周期覆盖rest/loading/bearing/release；middle/deep/response局部位移范围0～18/10/6，3固定端误差0。真实reduced-motion相位/顶点静止，静态底音运行。松键/原位不漂、M静音恢复不重启、刷新重置出生与音频锁/唯一canvas、无cookie/local/session存档写入通过。
- 实际同源iframe导航离开，2个native AudioContext最终closed，产品close调用及promise resolved被存活父页面被动观察；没有手动dispose/close。这不等于逐个GPU资源长期泄漏检查。
- page/console/HTTP错误0，首屏1787ms。18,625个rAF间隔，中位8.3ms/p95 10/p99 11.7/max1065.7，69个>50ms、65个>100ms；包括截图/录音开销，不能称无卡顿或纯GPU时序。

## 实际画面及阻断

直接看入口、主壳接触、rejoin、east、倒伏壳接触。主壳接触停点在绘制根缘附近；[倒伏体接触](check-fallen-rib-contact.png)人物脚却落进左侧绘制肋片中，ROOT明确判为错误，不能合理化为可进入空腔。物理supported始终true并不排除像素深度错误。ROOT/code随后怀疑共享actor-pixels沿用正交深度偏移而未适配透视；此为待修原因，旧证据只证明视觉错误真实发生。

## 录音与录屏限制

[实际首30秒WAV](main-audio-2-first30.wav)由157.8秒原始实际输出离线解码，48kHz双声道，peak .121368/RMS .008106；减少动态2.46秒音轨也解码。见[audio-decode.json](audio-decode.json)。未归一化，Agent没有听音能力，**听感未验**。

Playwright主视频page@f71e85bddde3863b2cac2521e2061a83.webm保留，但离线抽取绕背route04/24的4帧发现仅黑底与页面提示，Three画布未进入该录屏。因此**这份WebM不是有效的连续场景视觉证据**，不能声称已看完或验证连续绕背。正常canvas原始PNG有效，按节点保存；[解码帧索引](video-frames/index.json)和原黑帧保留，首次离线CORS导出失败记录也保留。后续短回归应验证新的被动画布录制是否含实际画面，并补移动中原帧，不能掩盖本次录屏限制。

真实OS失焦、Agent听感、用户审美/空间记忆/探索欲望、全硬件和长期泄漏未验证。最终产品需等待透视深度修复后的受影响区域正常回归及正交兼容检查。
