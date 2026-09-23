# R7 有界技术复核

独立子代理 r5_volume_audit 对当前改动的静态检查。范围为外景绘制、ChamberExteriorAtmosphere、灯光和visual集成；检查时核心/外景首稿已接入、UI由另一作者施工。没有运行浏览器或离屏枚举，不代表全部新面属性通过。

未发现可确证的新技术问题：

- 外光取 bake 返回的原始 albedo，compileFace 同时使用透明/黑值/表面覆盖掩膜；不会把纯黑空域作为受光面。
- 外光/尘 depth −49/−48，在建筑10及人物之后；100ms更新、visual.destroy释放已接入。
- 核心活动点与光源同为底座上46px，Z46；共享 CORE bounds 包含新最高点−72。
- 底座、路线及碰撞数据未改。

后续根代理依据首帧补回右侧外残构一块朝内断面；这一增量须以最终实际绘图/表面浏览器测试为证据，不能借本次静态检查称已验。运行结论归 I30 R7 QA。

## 完整度避让补审（当前PRE_RENDER修复后）

同一独立代理只读核对共享placement、ChamberModule、Player/WeaponRig包围盒、场景投影与面板/CSS，并核实本地Phaser实现：Core.PRE_RENDER在所有scene.update/POST_UPDATE之后、scene.render之前发出。未发现额外确证bug。

- 事件挂game.events；正式面板订阅与旧context的RAF回退互斥。面板挂载后立即测量一次，关闭/销毁解绑；场景shutdown先关闭面板再释放角色。
- 世界条在player.postUpdate后读取可见身体、旋转持具、上身和肩灯；DOM用相机投影到960×640根缩放前的坐标，offset*与之对应。
- 所有候选都检查人物、保留区和视口；无合法位置才隐藏，CSS仅透明度变化，不在左右切换时滑过人物。
- 完整度色基于实时hp/maxHp，严格低于25%；旧无context分支保留，没有残留integrityOffsetY调用。

这部分未重复算法或浏览器测试，具体变焦/左右/键鼠和实际时序证据仍以专项manifest为准。
