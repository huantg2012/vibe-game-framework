# 灰层重污染 B1：消声与侧向铃，固定一次

已真实 E 撤离、R 回到净化点：**32.915 秒，115/145 完整度，80.939 混乱，12 薪柴结算带回**。没有攻击，精良撬棍40/90不变；Q灰毡手套、F裂舌铜铃各使用2次。原有G空白相框4次未动。runId `4961703b-37a6-4c44-805c-60d497a54d09`。

固定 ash-strata / severe / 20261005，最终3086源。使用真实低档30趟原始存档（145HP、起始混乱24、亲和2），只有两件普通成熟Q/F工具是公开fixture。已从此前B0、A熟悉西侧通道；每段输入后正常画面截图，再Esc暂停。该结果不是初见、连续反射或自然工具供给证据，也不与新档B0做装备效果因果比较。

## 实际动作与可见效果

- 007在接近前开启消声，但画面内巡逻者仍正面发现角色。009第一声铃落在侧前方，敌人继续靠近；没有看到被引开的可见对象。
- 012再开消声，013靠近东北袋的已见残骸时受到15点伤害。014消声期间完成一次翻找，正常画面显示+12；该翻找段没有新增受伤，两名追兵仍在靠近。
- 016朝回撤路线东侧投第二声铃并观察，仍受到15点伤害。之后沿已知北带、西通道回撤，没有攻击，也没有后续受伤。027真实撤离提示、028实际E、returned.png实际R。

## 完局后核对

仅在返回、浏览器关闭后读取封存的after-play-audit.jsonl。Q期间 `playerActionSilenced` 与 `hearingSuppressed` 为true，功能实际生效。007已有一个CHASE，010第二个CHASE，014第三个由patrol变CHASE；29个采样时点没有任何 `investigatingLure=true`。不能据此排除帧间瞬时反应，但正常截图同样未支持有效侧引。**本趟可确认不攻击深搜撤回；不能确认铃提供了安全搜取窗口，也不能推导铃会取消CHASE。**

12薪的深层分类为事后核验：本趟只有一次完成翻找，冻结重度deep基础6，已成长亲和+2、储藏102按100上限得到1.5倍率，`floor((6+2)*1.5)=12`；相同条件安全/争夺收益分别4/6。纯薪柴不进入物品revealedNodes，因此不虚构具体deep节点ID。真实结算kindlingGained=12、status=settled、outcome=extract、baseSettled=true。

原图优先：[013接近](013-quiet-step-to-observed-remains.png)、[014取得12薪](014-search-visible-remains-under-silence.png)、[016第二铃仍受伤](016-second-bell-east-of-return-route.png)、[028实际撤离](028-extract-deep-kindling.png)。精确状态、文件SHA与有限帧审计见[review.json](review.json)。没有生产代码改动；不签人类终审或稳定成功率。
