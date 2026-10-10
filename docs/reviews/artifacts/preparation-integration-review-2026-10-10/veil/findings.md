# 独立 UI / Veil 生命周期审查

审查 commit `0340113b`，相对 `f999bc95`。只读生产代码；Chrome + Playwright 独立上下文，`prepare-review.html?fixture=equipped` 的内存存档。未操作用户游戏页或正式存档。绑定 COH-F003 / COH-F038。

## P1：关闭备行未释放 WebGL 上下文，反复打开会逐出世界渲染器

定位：`src/ui/dom/preparation-veil.ts:234–240`（`dispose`），新建入口同文件 `46`。每次备行创建一个新的 WebGL2 context；关闭只删除 shader / program / VAO，未释放 context 或复用同一 context。DOM canvas 数量为 1 并不代表只有一个活动 context。

两次独立浏览器均在第 14 次关闭/重开时出现 `Too many active WebGL contexts. Oldest context will be lost.`，随后 `WebGL Context lost. Renderer disabled`，Phaser `gl.isContextLost()` 与 `renderer.contextLost` 均为 true。关闭备行后 1 秒仍丢失，游戏世界区域显示空白；第二次补测等待至 10 秒后浏览器恢复 context，世界重新显示。因此不能宣称永久黑屏，但可以确认可由普通面板生命周期触发的主场景渲染中断，且关闭面板不能立即恢复。

证据：`lifecycle-fallback.mjs` / `lifecycle-fallback.json` 的 contextLoss；`world-after-close-1s.png` 与 `world-after-close-10s.png`。初次 `probe.mjs` / `probe.json` 亦重现。现有 20 次开关测试只验证 canvas DOM 数量及 pageerror，未验证世界 context、console warnings 或世界帧有效。

应修为确定释放或复用 effect context，并把世界 renderer 在连续开关后不丢失纳入回归。

## P2：不支持 WebGL2 时丢失三档遮罩差异，未交付约定的静态退化

定位：`src/ui/dom/inventory-panel.ts:381`（失败只 hidden canvas）；失败源 `src/ui/dom/preparation-veil.ts:55`。

`docs/tasks/preparation-threat-ux.md:73` 明确最低保留三档静态遮罩。通过 init script 仅让 `getContext('webgl2')` 返回 null，真实世界仍正常运行于 `WebGLRenderingContext`，没有丢失 context。低、中、重档均为 `canvas.hidden=true`，保留相同基础暗场；没有静态纹理、等级类或其他 grade-specific fallback。文字与前进行装仍可用，但以遮罩第一眼感受三档压力的核心表达消失。

证据：`lifecycle-fallback.json` 的 fallback，以及 `fallback-low.png` / `fallback-medium.png` / `fallback-severe.png`。这与上下文开关泄漏是独立初始条件；不是第二次报告同一 bug。

应按档位提供无需 WebGL2 的静态遮罩，并保持人物保护和文字阅读区域。

## 已检查 / 限制

- 代码核对了关闭时 RAF / DOM 监听取消、media query 清理、场景销毁时 journey 清理、实际 actor bounds 投影；未发现另一项确定的生命周期故障。
- 稳定 actor 下 `setPhase` 不主动 draw，在 reduced-motion 下可能直到 actor region 改变才更新 `uEquipment`。当前真实场景 actor 的帧边界变化触发了下一次 draw，未证明持续的玩家可见故障，因此不列独立 finding。
- 实帧查看 reduced-motion 重档行装的人物/文字保护，不代替连续观感或审美终审。
- 未扩展跨浏览器、额外设备、音频及整包 GPU 性能测试；开发 fixture 的缺失资源 404 与此 finding 的 context warning 分开记录，未作为本提交新增缺陷。
