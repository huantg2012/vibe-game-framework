# game-state 独立试用记录

日期：2026-09-20。范围：没有 Git、没有 framework、没有 npm 的临时投递解谜项目。

## 实际步骤

命令前缀：`node /private/tmp/coh-game-state-master/.agents/skills/game-state/scripts/game-state.mjs`；项目参数：`--root /private/tmp/coh-game-state-forward`。

1. 读取 SKILL.md、protocol.md、format.md；创建真实 src/main.js（menu[0].activate → beginDelivery）、docs/delivery.md 与取消战斗决定。
2. `init` 退出 0，生成 12 个待核实域。录入 5 项功能、3 条静态证据：菜单/投递初始化为开发接入，完整循环/路线挑战仅设计，战斗退役。没有捏造战斗系统或运行证据。
3. `check` 退出 2，原因是尚无来源基线；8 个未知域和 3 条版本不可比证据分别警告。
4. 核对文本后 `baseline --reviewed` 退出 0；`check` 退出 0 仍保留未知与不可比较警告；`render --index-only` 只生成索引。
5. 新增未被 main.js 导入的 src/settings.js，字段 textSpeed/highContrast。未登记时 `check` 退出 2，明确返回文件变化、inventory 变化与 unowned 新文件。
6. `impact --feature DELIVERY-START` 返回 MENU-START、DELIVERY-LOOP、ROUTE-PUZZLE 三个下游。此命令按 feature 查影响，不声称发现未登记文件；接手者先 check 仍能看到遗漏。
7. 此时 `render` 退出 0，生成带“来源已变化，需要重新核对”的 INDEX/HTML。保存 before-registration-* 作为证据。
8. 静态核查 settings 与 main，新增 SETTINGS（delivery=unknown，入口空，明确未接入/未验证），只新增 source 证据；核对后 baseline/check/render 均退出 0。
9. 最终 12 域 / 6 项登记功能 / 4 条静态证据 / 0 正式接入；7 域仍待核实，4 条证据无法按版本比较。HTML 与 INDEX 都保留这些限制。

## 结果

核心目标成立：无需本框架或本游戏资料即可建立全貌，新增漏登文件会被接手检查发现，重新生成视图不会自动提升未知、接入或验证。

产物：
- docs/game-state/INDEX.md
- docs/game-state/atlas.html
- before-registration-INDEX.md / before-registration-atlas.html
- forward-results-before-registration.json：真实命令、退出码、stdout/stderr
- forward-results-final.json：收口命令输出
- artifact-checks.json：静态产物检查

只检查了生成文本与 HTML 内容，未在浏览器点击视图；未运行 fixture 游戏或游戏测试，不能声称游戏行为、审美或完整体验通过。首轮产物断言误写“尚未运行游戏或测试”，实际摘要是“未运行游戏或测试”；修正断言措辞后通过，不涉及产品修改。

## 发现的轻微歧义

1. renderer 将 source 显示为“源码核对”，但本例设计与取消决定也是 source。建议“静态核查”。
2. retired 显示“已下线”，会暗示取消的战斗曾经上线。建议“停用/取消”。
3. dev 显示“开发入口可用”，会让仅有静态调用路径的功能看似运行已通过。建议“开发接入”，仍保留独立证据。
4. SKILL 的“init 拒绝覆盖非空目录”最好明确“目标索引目录”；整个已有游戏项目非空不妨碍 init，本试用已成功。

没有修改技能或脚本，没有提交。
