---
status: COMPLETE
iteration: 14
last-modified: 2026-09-07
---

# 迭代14：首页入场验证

2026-09-07，用户明确“结案，提交”，迭代14人终审PASS、COMPLETE。下文保留实际执行的检查及验证边界。

## 入口与证据

`http://127.0.0.1:3000/ui-review.html?sample=entry` 复用生产MainMenuScene、session与PurificationScene；三个按钮准备新游戏、可读档、坏档的内存夹具。save/load/delete在该开发文档隔离，不读写用户正式存档。继续夹具只恢复37薪柴以识别误reset，不等于验证完整持久化协议。记录按钮调用生产Enter监听，逐帧输出在可展开DOM报告中。`motion=off` 模拟本页媒体查询，不改变全局偏好。

证据目录 `docs/art/iteration-14-evidence/`。new-0..9.png 是连续浏览器全屏截图，顶部工具条不属于游戏。初轮new/continue/bad-stress记录用于发现问题；最终修正证据为new-final、continue-final、pause、reduced-new、reduced-continue、abort。为限制报告大小，new-final每2帧、pause每3帧保存一次，其余逐帧。

## 实景结果

- 完整版最终2108ms交控制，短版1107ms；净化点首记录黑罩alpha=1，无裸场景闪帧。新首zoom1.44、继续1.47，HUD阶段始终恢复原值1.5。显现/落位阶段屏幕HUD透明度0，末段显现后回到原设计0.68。
- 新档hum于124ms、继续64ms开始；每条入场记录内hum始终同一个voice ID，切场未销毁重播。最终新音轨首帧增益0；渐入达到hum0.5/drone0.6。验证为播放状态与增益轨迹，不声称人工试听或感知音量PASS。
- 继续夹具load=1、delete=0、保留37薪柴；坏档load=1、delete=1、回退new完整节奏与0薪柴。新档只delete一次。new-final在中止后再次进入，计数累计2，对应两次独立启动。
- 坏档同时压力测试：离场每帧重复确认；进场每帧按住W/E/Tab/Esc。过渡期间角色物理坐标始终218,262，未打开交互/报告/暂停；交还控制后仍按住W才开始移动。不是通过禁用整个scene来冻结世界。
- 暂停记录931–1782ms的35个采样点，黑罩opacity始终0.705081、zoom始终1.452575991796386；恢复后继续渐变。音频paused=true期间播放冻结。此为开发按钮调用生产使用的scene pause/resume和audio pause/resume，不等于多浏览器实际失焦测试。
- 减少动态新档507ms、继续508ms；净化点所有记录zoom=1.5，无镜头运动。音频unlocked=false的该次记录也完成交接，未阻塞场景。
- 进场中止返回首页后罩数量0、场景为MainMenuScene；再次完整进入正常，无残罩或输入锁。多轮往返后浏览器error日志为空。
- art独立复核233/666/1059/1450/2050ms实景：菜单先退、净化点渐显、HUD最后进入；现有冷灰/teal/肩灯关系与构图保留，无新增窗口材质。离散帧内部美术判断不能代用户连续体验。

## 本轮发现并修复

1. settle计时器先于tween更新执行，恢复zoom后又被同帧tween覆盖，HUD首帧尚有微小镜头变化。现先移除tween再恢复精确zoom，最终记录HUD阶段均1.5。
2. 新音轨初始GainNode读数为1，下一帧才变0。现source启动前显式设置GainNode初值与play配置，最终首帧为0。原读数可能受音频线程调度影响，未将其认定为已听到的突响。
3. 快速重入时正在淡出的同key ambience可能被误当已播放而继续停止。现从当前gain反转淡出，保留同voice。暂停期间音频fade不再消耗后台时间。

## 机器检查与边界

最终`npm run build`（含TypeScript）和`git diff --check`通过；本轮另通过`check:vision-energy`（含I12接缝）和`check:layout`（8 seeds），独立开发端口启动/HTTP200检查通过。构建仅有既有Phaser大包提示。无独立lint脚本，不宣称lint通过。

Esc记录菜单与裂隙返回未传入新回调，代码路径核对保持原行为；本轮未重跑完整潮汐/战斗、正式存档加载、真实OS失焦、跨浏览器与长时间资源压测。覆盖确认结构沿用I13，仅确认后的两个session回调接入新过渡，未将本轮未重测项列为实景通过。
