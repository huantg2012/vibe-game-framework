# I30 R3 调色修正

日期：2026-09-22。基线`42894d7`。主功能COH-F042，关联F026。

用户指出暖色过多，要求参考旧净化点调色盘；本次是局部调色纠偏，不重做模型或空间。

## 对照依据

- 旧版实际地坪：`src/systems/procedural-purification-surface.ts`，冷混凝土主底`#2c2e33`。
- 旧维修构造：`src/scenes/purification-renewal-visual.ts`，修补面`#3a3d42`、窄断面/金属`#4a4e55`；青绿是介质/侵蚀，暖色留给小灯。
- 已亲看[旧全景](artifacts/iteration-29/runtime/fresh/01-hub.png)与[修前R3](artifacts/iteration-30-r3/presentation/normal/01-main.png)。独立explorer亲看旧基线与I29实景后给出相同判断：建筑大面积earth灰褐造成偏暖，不是动态灯光强度。

## 实施与验证

建筑专用`building`色槽：下层主地坪/裸底使用`#2c2e33`，上层/涂层/壳断面使用`#3a3d42`，侧返面保留`#1e2228`，窄金属/断口保留`#4a4e55`。降低顶盖、厚墙、坡沿与施工补片的灰褐覆盖；设备、人物与动态光保持。

- 正式入口隔离浏览器[正常/受控损伤记录](artifacts/iteration-30-palette/manifest.json)两组通过，无运行错误；两状态各四机位，核心面板开关、上下层实走及三次菜单重入均由既有脚本执行。
- [同状态纹理对比](artifacts/iteration-30-palette/palette-check.json)：两组都只有architecture/front-cut发生改变；六装置、外部残构、接地与抵抗层哈希均与修前一致。源码22个RGB都属于既有39格色板，开始/结束源码指纹一致。
- `npm run build`通过（含TypeScript，318模块；既有大chunk提示保留）。本次没有新增测试，也没有重跑完整Rift/归来/成长经济；脚本附带的短时帧样本不作为新的性能结论。
- 根代理与art亲看最终[正常全景](artifacts/iteration-30-palette/normal/01-main.png)、[受损全景](artifacts/iteration-30-palette/synthetic-damage/01-main.png)：棕褐包围带已收掉，冷灰/青绿/小暖灯的分工接近旧版；上下层、中央立面与受损裂缝仍可辨，无新增明显金属亮边或漂白。未启用第二次校色，源码已冻结；这是内部静帧判断，不是用户终审。

## 收尾判断

- 架构：现有静态绘制内增加建筑专用材料用色，缓存/动态受光/层级和公共接口不变；具体分工登记于美术正文。
- Spec：玩法、碰撞、交互、存档无变化，规则spec无需修改。
- UI：本轮不改HUD/DOM/菜单；原角色、六设备和功能灯保持。
- 交付：美术正文、任务、进度及现状证据同步。旧R2分数和R3剩余质量问题保留，不代签用户审美；I28长期采样继续挂起。
