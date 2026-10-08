# R100 材料母片

2026-10-03 初版，通过内置 imagegen 新生成三张不透明地表材质原图。1254×1254 RGB；原图原样保存，没有把生成模型输出的整幅地图作为游戏背景。它们仅承担材料的层皮、断露、沉积与半调子描绘。CSV `data/rift-master-materials.csv` 声明加载与世界尺度；运行时解码至512像素，按实际地床/面坐标选材并接实时光。地图支撑、形体、法线、实体、侵蚀、视野、玩家和动态均由现有代码提供。

以下是可复用的制作指令摘要，不冒充生成服务的逐字请求日志：

- `ash-strata-source.png`：正顶视、无物件、无地平线的死灰矿质地表。成片完整表皮、层片断露、受压擦面、局部松散断端共存；像素簇表达材料厚薄和形成关系，疏密分明。不能做方砖、规则石块铺装、均匀噪点或全图裂纹；没有绿色、灯源、投影或黑色深坑。
- `crystal-fibre-source.png`：相同尺度的死亡板岩灰硅质纤维地床。局部紧密熔结、局部沿受力方向拉开、边缘松散；束与床连续，具有矿物质硬度。不能画绳索、草、藤蔓、活体绿色或整幅平行木纹。无角色、建筑、光源和长投影。
- `ivory-basin-source.png`：相同尺度的灰白死亡瓷釉材料。完整较安静釉皮与局部剥露、暗哑下层和片状碎屑形成事件关系。冷脏象牙与石灰半调子，不做明亮白瓷砖；无规则镶嵌、绿苔、孔洞布局或灯光烘焙。

三图共享约束：有限、克制的中性材料色；有经过绘制的大片关系与近看细节；画面边界无需充当地图边界。母片中的明暗仅作材料色与微结构描绘，不能从亮度自动推导实体高度、碰撞或吞光区。强方向性明暗须在实景转灯时复核。

来源文件及SHA256：

| 游戏文件 | imagegen来源文件 | SHA256 |
|---|---|---|
| ash-strata-source.png | exec-0da20cee-e8f5-4c0f-8c09-2378900e846f.png | 88bda7c04ecd21f8954fa7076dc73ce332ff0bb8935d39752b9923778fe01f4a |
| crystal-fibre-source.png | exec-3f094d2a-6938-464b-a349-cc6b26fef21b.png | b94630043fdc4418673337daa5eb3121dc5238b62b94f5b0fb2ef8fc461df002 |
| ivory-basin-source.png | exec-1c915212-824c-48a5-9c78-57a5360ce0c5.png | 0f3a10c683852461fc38543f508953ed058799dc7922c87c98bfb705f0b62f8d |

来源目录：`/Users/yilungao/.codex/generated_images/01a0cdf7-fd21-7173-be38-7eb0eb5d1a5b/`。正式运行只依赖本目录原图与CSV，不依赖用户机器的生成缓存。


## 2026-10-03：独立实体表面

用户认为只分开UV之后，实体仍与地面太近。本轮为 solid 增加三张独立原片，保留原地床图片不变。内置 imagegen 生成，原样复制，未做图片后期编辑。每张左部完整皮、右部断层，由 CSV 中的归一化区域选取；原图并非可直接平铺全图的背景。生成的较平缓色值变化仅用于材质色，不推导几何高度／法线。明确的转面、高度与投影仍由同源模型提供。

设计说明：[集中记录](../../../docs/art/rift-r100-material-separation.md)。逐字 prompt：[生成请求](../../../docs/qa/artifacts/r100-material-separation/generation-prompts.json)。三张新增原图各解码为512²RGBA，共增加3MiB有限缓存；三族地面+实体共6MiB，按家族共享完成／在途加载。正式运行不依赖生成缓存目录。

- `slab-solid-source.png` ← `exec-f14395c9-78e6-4bf5-8740-0ec9e75257ea.png`；SHA256 `4b2082c1be77d27f0ba57aef104204e3c10bb59c88078df8f741b9bd6ce38454`。
- `fibre-solid-source.png` ← `exec-3ea65361-e038-402f-82d7-aea6a96a1ab7.png`；SHA256 `015e854e49a0b48f5554f725341564817a0a267ad0c6b84708925a7231306089`。
- `shell-solid-source.png` ← `exec-817ce8ce-4370-4ee9-af6a-03af1aef5ba3.png`；SHA256 `784e95d608ea573f99bd99ff8f345e601504d3ebd24b18918dc78179cf4a4220`。
