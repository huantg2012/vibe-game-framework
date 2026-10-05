# 材质身份与冻结恢复专项

执行器基线：`5788ef07225ec04abe99330adffd777ddef24abe`。最终 runtime/data/public 与 `../final-source/source-snapshot.json` 的 SHA-256 对照为零差异；以下当前版本检查未跨源码变更运行。2026-10-05，Code 子任务。

- `freeze-native-r100-revision3.mjs --check`：PASS。57 项依赖封入无可变 import 的 1,412,304 字节执行器，SHA-256 `8aa337fb4687b45206db5db496bbe1a0a5269975b002cb2d1a7880c89870be78`；12 张历史原图路径内容保持原 SHA。生成、验证、表面烘焙均从固定提交可重建。
- `codegen-r100-worlds.mjs --check` / `codegen-r100-appearance.ts --check` / `codegen-r100-packages.mjs --check`：PASS，20 世界 / 60 定义 / 20 外观配方 / 32 项包源收据。资格收据按世界嵌入外观，不把整张外观表当某一世界内容依赖。
- `check-r100-world-appearance.ts`：PASS。20 配方完整冻结、篡改与缺外观拒绝；真实原图经连续色阶映射；20 种翻找物像素轮廓保持原 alpha。六族旧 revision 3 完整传输 payload 保持一致、四张 RGBA 均逐字节一致；六个当前世界的配色变化不改法线、高度/粗糙度或污染发光。额外浅纤维回归确认材质身份不由 collision role 决定，修改实体色不会染色空地。
- `check-r100-frozen-recipe.ts`：PASS，三个污染等级已保存包在当前 catalog、内容、材料追加及作者行改变后保持相同完整 payload。
- `tools/recovery/check-native-generation-revision.ts`：PASS，60 份历史 revision 2 原 Chrome 身份及完整世界 payload 精确恢复；当前 revision 4 / 内容定义 2 选择正确，伪造与未来修订拒绝。
- `check-r100-surface-prewarm.ts`：PASS，使用真正冻结 revision 3 配方，对九个旧世界 / 36 张原 RGBA 缓冲逐字节比较，54 个真实 Host 身份及完整 bake 一致，Worker 取消/超时/错误/身份生命周期通过。
- `check-r100-presentation.ts`：PASS，23 项 CPU 生命周期、准备取消、GPU 资源归属/回收、恢复状态和 7,200 音频帧合同检查。使用假 GL；不等于实际 GPU 或听感验收。
- [Node / Chrome 等价结果](browser-equivalence.json)：PASS。当前 20 世界 × 3 档共 60 个生成身份完全相同；历史原 Chrome revision 1 的 18 个身份在当前 Chrome 原样恢复。测试端口 3090 与 3087 冻结源内容核对相同。
- `npm run typecheck`、`npm run build`、`npm run dev -- --port 3090 --strictPort`、`git diff --check`：PASS。构建仍提示现有大 chunk；主 chunk 约 5.75 MB / gzip 1.60 MB。项目没有 lint 命令或独立 lint 配置，不声称独立 lint 通过。

保留的过程问题：包生成脚本首次添加依赖时误改 `readFileSync` 参数，已修复后通过；新测试初版附加了“次材覆盖永远小于主材”的未约定假设（`film-laminate` 空间抽样 51%），修正测试为原合同要求的实际主次分区，未为该断言调整美术数据。首轮实图的周期条纹、直切色块和浅纤维错误地面色均被退回后修复；画面裁决归 Art / 主 QA，不由本页的色数或技术指标代签。
