---
status: INTERNAL-VERIFIED-WITH-LIMITS
created-date: 2026-09-21
baseline: 7a67523 + R2 working tree
features: COH-F028/F029/F030/F033/F034/F044/F045
---

# 迭代29 R2：线性蜕变、供奉1～4与明确进度

## 已交内容

22步固定路线，6轴19级＋加厚3级，总计428薪柴。供奉在第3/10/18步扩至2/3/4位；第5步真实冲击、第17步抵达退潮为两处经历门槛。只显示当前下一项的未来收益和条件，已购项仅查已生效收益；等级/上限、已刻入/22可见。CSV独源顺序，普通升级与加厚共用购买门禁。

旧档原3/4供奉位、物件引用/品质/充能及已购能力保留；新schema2一次迁移。在途和未结算旧包不立即重写，后续合法完整帧或结算同笔保存新schema与原世界条件。修复后，培养藏缺贴图时的fallback高亮也依当前下一项资格判断（静态交叉审查发现，无正常模型表现异常的声称）。

## 实际验证

- 核心代理：22次真实生产购买，每步拒越级、保存/重载、一写一奖励；普通升级及加厚拒写完整回滚后重试；旧非前缀等级跳过且收益保留。[4组记录](artifacts/iteration-29-r2/linear-growth.json)。
- 容量代理：新档1→4、拒写、旧基地3/4、V1/缺字段、重复加载、旧在途完整帧/出发意图/未结算归来、坏schema和等级，9组。[记录](artifacts/iteration-29-r2/offering-capacity.json)。
- 回归：成长资格4组、扩槽9组、成长收益6组（含27组搜寻组合）、保守事实恢复26组、预告10组、加厚预览16状态、旧存档11组、库存9组、坏档救援均由对应代理实际运行通过。持久证据：[扩槽](artifacts/iteration-29-r2/growth-slots-linear.json)、[预告](artifacts/iteration-29-r2/forecast-reading-linear.json)、[经历恢复](artifacts/iteration-29-r2/growth-evidence.json)。这些不是自然获得的长期体验样本。
- 根实机：隔离Chrome、1440×960、正式3025入口，使用真实行走/键盘/点击。新档、冲击未满足、退潮未满足、全22步购买、非前缀旧档5组通过。[脚本](../../tools/qa/i29-linear-runtime.mjs)、[清单](artifacts/iteration-29-r2/runtime/manifest.json)。满线实际扣428；按住Enter重复事件只买一次；已完成再按Enter不扣费；旧档容量4、已购6/22保留；供奉1/2/3/4四种容量实景；重载不重抽预告；满线后正常出发。
- 根真实事件链：独立新档走六个实体交互，两次通过暂停菜单确认放弃后归来，首归免伤不记冲击，第二次真实冲击记入且保存。不是两次成功搜撤。[脚本](../../tools/qa/i29-return-journey.mjs)通过`I29_OUT`另存R2，[实录](artifacts/iteration-29-r2/return-journey/manifest.json)。首次自然退潮没有在本次浏览器重跑完整潮汐，资格逻辑由专项与受控状态验证。
- `npm run typecheck`、`npm run build`、`git diff --check`通过；codegen再运行生成文件零变化。[codegen](artifacts/iteration-29-r2/codegen-check.json)。构建保留既有大chunk警告。代理实际执行`npm run lint`返回缺脚本，未记通过。

## 实景修正与内部审美

初次实拍发现成功toast全屏遮暗，以及加厚第三模块被裁切；[缺陷原帧](artifacts/iteration-29-r2/art-before/thicken-clipped-and-toast.png)保留。最终改成总进度行安静反馈，去掉多余分隔线，自动断言覆盖第三模块首屏完整，再跑全部5组通过。供奉“供奉位”改为“供奉容量”，避免被误读为占用数。

最终[加厚首屏](artifacts/iteration-29-r2/runtime/linear/step-07.png)、[冲击门槛](artifacts/iteration-29-r2/runtime/impact/01-growth.png)、[退潮门槛](artifacts/iteration-29-r2/runtime/crest/01-growth.png)、[第三次供奉扩容](artifacts/iteration-29-r2/runtime/linear/step-18.png)。[art复核](artifacts/iteration-29-r2/art-review.md)是内部三问判断，不冒充用户审美PASS。

## 边界与可续接

[设计正文](../design-notes/purification-growth-renewal.md)完整列出路线、功能转折、投入与修复取舍、分期累计成本、扩展守则和风险。428不是已获长期平衡认可的价格；单格开局、中段40薪柴等待、线性加厚的强制时机仍需体验。固定线减少了购买轴的自由排序，深度来自信息解读、供奉吞吐与可遗失装备周转，不能仅以22步声称完整终局或无限池。

迭代28长期采样/平衡/动态审美继续挂起；角色、2D、六锚点、单一薪柴保持。未新增提交/推送，独立CLAUDE修改未触碰。源码记录见[source-hashes](artifacts/iteration-29-r2/source-hashes.json)，R1报告与产物仍为原版证据。


现状登记：53项功能/23条证据；R2增量更新F028/F029/F034/F045并联结F030/F044。`state:check`结构/引用有效，仅独立CLAUDE来源漂移（退出2）保留；语言/设置/可达性未核、12条历史证据实现变化及7条版本不可比较仍显示，不把基线刷新当验收。HTML未刷新，INDEX为当前文本派生。
