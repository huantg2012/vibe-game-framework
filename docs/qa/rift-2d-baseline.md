---
status: PASS-WITHIN-SCOPE
date: 2026-09-16
decision: DEC-169
source-baseline: 218f773
tag: rift-2d-baseline-2026-09-16
---

# 俯视2D Rift基线确认

**结论：正式入口保持可玩的俯视2D像素关卡，正常出击与撤离返回通过。** 三维探索从未替换默认生产路线，因此本次没有回滚游戏代码；修改范围为方向归档、活计划和验证记录。用户认可R8视觉进步，但因制作成本与玩法取舍终止路线；这不是完整生命大陆的交付验收。

## 正式路径与范围

- `/` → 主菜单 → 净化点 → 备行 → `RiftScene`。净化点默认不传`devFixture`，没有创建三维运行时或投影器。
- 仍使用`generateRiftLayout`、原生`TileGrid`、Phaser像素地表/角色、有限视野，以及现有敌人、战斗、库存、翻找和撤离系统。当前CSV启用户外土壤、医院实验室、地铁工业、旧图书馆。
- 960×640逻辑分辨率、`pixelArt`与`roundPixels`保持；主菜单插画自身的平滑运动设置不变。
- R8检查点`218f773`与悬海、生命大陆DEV代码和资产保留用于复盘。迭代23终止归档，不再把旧视觉清单作为开工指令。共享问题和四A供给验证未冒称完成。

## 本次验证

`npm run typecheck`、`npm run build`均退出0；构建有既有的大包体积提示。正式HTML构建入口没有加入生命大陆或三维样板。

使用Playwright启动独立Chrome空上下文，访问`http://127.0.0.1:3011/?riftSeed=7`。只固定地图种子便于复现，通过正常键鼠完成：

1. 主菜单Enter新建旅程，进入净化点；绕过核心走到北侧入口，E打开备行。
2. Shift+Enter进入正式裂隙。只读核实`frag-library / ridge-library`，64×42格、32px格宽；`devFixture`、`devPresentation`、`devWorldProjector`为空，`devRuntime`未建立。
3. Esc暂停/恢复、空格挥击、Tab打开本趟拾获并关闭。按只读通行格规划52个格心的连接路线，实际用WASD逐段行走；没有传送、改速度、清敌、修改库存或直接调用场景切换。
4. 从`(240,752)`走到撤离点附近`(1201.71,77.25)`，E正常撤离；记录`runEnded=true`、`lastEndReason=extract`。
5. R返回净化点，出现冲击结算；Enter合上后向右移动，从`(224,256)`到`(241.44,256)`，操作恢复且无待保存状态。

浏览器pageerror/console error为0，HTTP错误为0。隔离上下文关闭，未使用或改动用户浏览器的正式记录。实际截图已查看；这是一趟入口/移动/撤离冒烟，不代替四种碎片全回归、敌人全目录、供给平衡、旧存档恢复或用户审美验收。

## 证据

- [状态与路线](artifacts/rift-2d-baseline-2026-09-16/evidence.json)、[源文件指纹](artifacts/rift-2d-baseline-2026-09-16/source-hashes.json)
- [进入2D裂隙](artifacts/rift-2d-baseline-2026-09-16/03-rift-entry.png)、[行走中](artifacts/rift-2d-baseline-2026-09-16/05-rift-walking.png)
- [撤离点](artifacts/rift-2d-baseline-2026-09-16/06-exit.png)、[返回净化点](artifacts/rift-2d-baseline-2026-09-16/08-returned.png)、[恢复操作](artifacts/rift-2d-baseline-2026-09-16/09-base-control-restored.png)
- [实际浏览器会话脚本](artifacts/rift-2d-baseline-2026-09-16/harness.mjs)、[实际键盘行走脚本](artifacts/rift-2d-baseline-2026-09-16/walk.js)

## 版本保存

本次提交范围仅为游戏文档和上述证据，独立`CLAUDE.md`框架改动留在本地工作树。标签`rift-2d-baseline-2026-09-16`指向本次基线提交；用户授权将`coh`及该标签推送至`origin`。完整三维探索历史随分支保留，未做强制推送或历史重写；实际远端结果以Git引用为准。
