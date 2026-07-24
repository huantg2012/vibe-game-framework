---
status: TEMPLATE
created-by: art agent
created-when: Slice 中需要资产时
note: 实际使用时复制为 [asset-name].md
---

## Asset: [资产名]
用途：[在游戏中的位置/功能]
工具：[Midjourney / SD / Suno / ElevenLabs SFX]
输出规格：[WxH px | 时长 Ns]
输出格式：[PNG/WebP/SVG/MP3/OGG]

### 生成 Prompt
```
[完整 prompt，包含风格前缀（来自 art-direction.md）]
```

### 反向 Prompt（SD 用，Midjourney 不需要）
```
[排除项]
```

### 工具参数建议
- 模型/版本：[xxx]
- 采样器：[xxx]（SD）
- CFG Scale：[N]（SD）
- 步数：[N]（SD）
- 风格参考：[--sref xxx]（MJ）

### 后处理步骤
- 后处理配置：[docs/art/pipeline.*.config.json；不需要时写“无”]
- 锁定色板：[docs/art/palette.json 或配置指定路径]
- 由程序 Agent 运行：`npm run art:postprocess -- --config <配置路径>`
- 机器验收：`npm run art:verify -- --config <配置路径>`（退出码为 0 才通过）

### 一致性检查点
- [ ] 色彩符合 art-direction.md 的色彩方案
- [ ] 风格与已有资产统一
- [ ] 符合 world.md 的约束（材质/元素/禁忌）
- [ ] 尺寸和格式符合 asset-specs.md
