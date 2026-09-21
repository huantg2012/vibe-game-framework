import {useState, useHostTheme, Stack, Row, Grid, H1, H2, H3, Text, Button, Select, Table, Divider, Callout} from "cursor/canvas";
const items = [
  {
    "item_id": "amber_beetle",
    "family_id": "solidify",
    "grade": "1",
    "display_name": "琥珀甲虫",
    "short_effect": "停住一敌2.5秒；受伤解除",
    "param_key": "freeze_duration_ms",
    "param_value": "2500",
    "duration_ms": "2500",
    "range_px": "128",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "偏扁五角琥珀包住一只内收足的甲虫；半透明树脂断面与深色虫身分成两团；一条裂缝停在虫壳前",
    "design_role": "提案待审；标本盒中的树脂包埋物；提供短时单敌绕行或搜取窗口",
    "item_class": "core"
  },
  {
    "item_id": "stopped_pocket_watch",
    "family_id": "solidify",
    "grade": "2",
    "display_name": "停摆怀表",
    "short_effect": "停住一敌4秒；受伤解除",
    "param_key": "freeze_duration_ms",
    "param_value": "4000",
    "duration_ms": "4000",
    "range_px": "128",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "圆铜壳带大提环与侧翻表盖；表针被一颗砂粒抵住；铜壳暗面和褪白表盘分开成面",
    "design_role": "提案待审；衣袋中遗留的旧计时物；扩大同一次停驻的行动窗口",
    "item_class": "core"
  },
  {
    "item_id": "sealed_hourglass",
    "family_id": "solidify",
    "grade": "3",
    "display_name": "封底沙漏",
    "short_effect": "停住一敌5.5秒；受伤解除",
    "param_key": "freeze_duration_ms",
    "param_value": "5500",
    "duration_ms": "5500",
    "range_px": "128",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "窄腰双瓶嵌在两根短立柱间；底瓶被厚蜡封住；砂束悬在腰口但不做全身发光",
    "design_role": "提案待审；旧计时器被外来物封住出口；支持更从容的单敌脱离而不扩大控制对象",
    "item_class": "core"
  },
  {
    "item_id": "brass_monocle",
    "family_id": "sight",
    "grade": "1",
    "display_name": "铜框单镜",
    "short_effect": "本趟视距增加10%",
    "param_key": "vision_radius_multiplier",
    "param_value": "1.10",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "2",
    "weight": "2",
    "icon_brief": "单圆镜片连一根偏弯短柄；铜框缺一小段；镜内高光在缺口两侧错开且不做光圈",
    "design_role": "提案待审；脱落的单眼镜具；被动换取小幅观察距离而不增加亮度",
    "item_class": "core"
  },
  {
    "item_id": "milky_fish_eye",
    "family_id": "sight",
    "grade": "2",
    "display_name": "白膜鱼眼",
    "short_effect": "本趟视距增加20%",
    "param_key": "vision_radius_multiplier",
    "param_value": "1.20",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "2",
    "weight": "2",
    "icon_brief": "椭圆眼体包着层叠白膜；深色瞳孔偏离眼体中心；保留湿润窄亮面并避开球形宝石读法",
    "design_role": "提案待审；被保存下来的异界感官组织；扩大观察半径并保留混乱缩距",
    "item_class": "core"
  },
  {
    "item_id": "doorless_lantern",
    "family_id": "sight",
    "grade": "3",
    "display_name": "缺门提灯",
    "short_effect": "本趟视距增加30%",
    "param_key": "vision_radius_multiplier",
    "param_value": "1.30",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "2",
    "weight": "2",
    "icon_brief": "竖高折角灯壳带弧形提把；正面门片缺失而灯芯仍在暗处；侧面裂开窄缝不新增暖色灯焰",
    "design_role": "提案待审；无人携带的旧照明器；高幅扩视距仍受真实遮挡与空洞限制",
    "item_class": "core"
  },
  {
    "item_id": "salted_vial",
    "family_id": "resistance",
    "grade": "1",
    "display_name": "盐封药瓶",
    "short_effect": "30秒内抗污增加20",
    "param_key": "contamination_resistance_points",
    "param_value": "20",
    "duration_ms": "30000",
    "range_px": "0",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "矮肩玻璃瓶配宽软木塞；盐壳只结在瓶颈一侧；瓶内沉淀斜面与瓶外竖直边不一致",
    "design_role": "提案待审；药柜遗留的封存瓶；主动减缓下一段正向混乱积累而不清旧值",
    "item_class": "core"
  },
  {
    "item_id": "bone_clasp_mask",
    "family_id": "resistance",
    "grade": "2",
    "display_name": "骨扣面罩",
    "short_effect": "30秒内抗污增加30",
    "param_key": "contamination_resistance_points",
    "param_value": "30",
    "duration_ms": "30000",
    "range_px": "0",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "横宽软面罩由左右两枚骨扣撑开；鼻部三道折线向内折合；一边系带收进面罩阴影",
    "design_role": "提案待审；换过扣件的防护面罩；在继续深入前开启一段抗污窗口",
    "item_class": "core"
  },
  {
    "item_id": "lead_fastened_breastplate",
    "family_id": "resistance",
    "grade": "3",
    "display_name": "铅扣护胸",
    "short_effect": "30秒内抗污增加40",
    "param_key": "contamination_resistance_points",
    "param_value": "40",
    "duration_ms": "30000",
    "range_px": "0",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "上宽下窄的双层护胸配偏心铅扣；衬层沿破口反向卷入；大块金属面与粗布背衬分明",
    "design_role": "提案待审；被异源覆盖的旧护具；强化抗污窗口但不减生命伤害且沿总抗性上限",
    "item_class": "core"
  },
  {
    "item_id": "split_heel_boot",
    "family_id": "dash",
    "grade": "1",
    "display_name": "断跟短靴",
    "short_effect": "沿可走地面短冲48像素",
    "param_key": "dash_distance_px",
    "param_value": "48",
    "duration_ms": "200",
    "range_px": "48",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "侧向短靴有断开的低鞋跟；鞋头宽而鞋筒收窄；断跟两截保留向内对应的磨损面",
    "design_role": "提案待审；失去半截后跟的旧鞋；短距离离开贴身威胁而不穿障碍",
    "item_class": "core"
  },
  {
    "item_id": "coiled_tape_measure",
    "family_id": "dash",
    "grade": "2",
    "display_name": "回卷尺",
    "short_effect": "沿可走地面短冲72像素",
    "param_key": "dash_distance_px",
    "param_value": "72",
    "duration_ms": "200",
    "range_px": "72",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "扁圆量尺壳露出一截弯折尺带；尺带从壳口折回自身背面；刻度用少量断续亮点不写小字",
    "design_role": "提案待审；工位上自卷的量尺；扩大同一按键的地面短冲距离",
    "item_class": "core"
  },
  {
    "item_id": "hollow_loom_shuttle",
    "family_id": "dash",
    "grade": "3",
    "display_name": "空心梭",
    "short_effect": "沿可走地面短冲96像素",
    "param_key": "dash_distance_px",
    "param_value": "96",
    "duration_ms": "200",
    "range_px": "96",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "细长双尖木梭包着纵向空腔；一端铜护角被挤进另一端的轮廓；中孔作为主要负形",
    "design_role": "提案待审；脱离织机的空梭；较长短冲仍须连续可见地面且途中危害照常",
    "item_class": "core"
  },
  {
    "item_id": "gray_felt_glove",
    "family_id": "silence",
    "grade": "1",
    "display_name": "灰毡手套",
    "short_effect": "5秒内自身行动消声",
    "param_key": "silence_duration_ms",
    "param_value": "5000",
    "duration_ms": "5000",
    "range_px": "0",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "侧折的连指厚手套显出短拇指；毡毛只在袖口成簇；掌心折缝吞没内侧纹理",
    "design_role": "提案待审；铺毡作业留下的手套；主动覆盖一次短穿行或翻找的听觉暴露",
    "item_class": "core"
  },
  {
    "item_id": "scorched_scarf",
    "family_id": "silence",
    "grade": "2",
    "display_name": "焦边围巾",
    "short_effect": "8秒内自身行动消声",
    "param_key": "silence_duration_ms",
    "param_value": "8000",
    "duration_ms": "8000",
    "range_px": "0",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "长围巾折成不对称环并垂下一长一短尾；焦边沿褶皱中断；纤维团沿单一织向而非散点噪声",
    "design_role": "提案待审；焦过边却未烧断的围巾；延长一次安静穿行而不掩盖视觉",
    "item_class": "core"
  },
  {
    "item_id": "unlined_coat",
    "family_id": "silence",
    "grade": "3",
    "display_name": "脱衬风衣",
    "short_effect": "11秒内自身行动消声",
    "param_key": "silence_duration_ms",
    "param_value": "11000",
    "duration_ms": "11000",
    "range_px": "0",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "风衣折起后仍保留宽翻领和一截袖管；里衬从下摆翻出形成深浅两层；衣袋口与褶皱相互错位",
    "design_role": "提案待审；里衬脱落的旧外衣；覆盖较长搜取窗口但不解除已确认追逐",
    "item_class": "core"
  },
  {
    "item_id": "split_tongue_bell",
    "family_id": "sound_lure",
    "grade": "1",
    "display_name": "裂舌铜铃",
    "short_effect": "抛出声诱饵持续4秒",
    "param_key": "lure_duration_ms",
    "param_value": "4000",
    "duration_ms": "4000",
    "range_px": "96",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "小铜铃呈敞口梯形配短柄；断成两截的铃舌互相错开；铜口厚薄不匀而不添声波符号",
    "design_role": "提案待审；曾悬在门口的破铃；用短声源引开尚未锁定玩家的听觉目标",
    "item_class": "core"
  },
  {
    "item_id": "crooked_clay_whistle",
    "family_id": "sound_lure",
    "grade": "2",
    "display_name": "弯颈陶哨",
    "short_effect": "抛出声诱饵持续6秒",
    "param_key": "lure_duration_ms",
    "param_value": "6000",
    "duration_ms": "6000",
    "range_px": "96",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "梨形陶腔接弯折细吹嘴；侧孔斜向下而吹嘴向上；釉面大片缺失露出粗陶底",
    "design_role": "提案待审；失去吹奏者的陶制口哨；延长同一落点的调查声源",
    "item_class": "core"
  },
  {
    "item_id": "missing_tooth_music_box",
    "family_id": "sound_lure",
    "grade": "3",
    "display_name": "缺齿八音盒",
    "short_effect": "抛出声诱饵持续8秒",
    "param_key": "lure_duration_ms",
    "param_value": "8000",
    "duration_ms": "8000",
    "range_px": "96",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "方匣掀开一块窄盖露出横向齿梳；齿梳留有明显缺齿；摇柄偏在一角并与匣体保持完整连接",
    "design_role": "提案待审；机芯缺齿的旧音乐匣；保留较久声源但不扩大听域或洗掉追逐",
    "item_class": "core"
  },
  {
    "item_id": "crooked_hook_needle",
    "family_id": "tripwire",
    "grade": "1",
    "display_name": "弯头钩针",
    "short_effect": "铺线绊停跨线敌人1秒",
    "param_key": "crossing_stop_ms",
    "param_value": "1000",
    "duration_ms": "10000",
    "range_px": "32",
    "ordinary_uses": "4",
    "weight": "2",
    "icon_brief": "长针在一端弯成开口钩并穿过一圈线结；针身只作两段硬亮面；线尾贴回针旁不散成孤点",
    "design_role": "提案待审；被线结缠住的钩针；固定短线为退路提供一次短停步",
    "item_class": "core"
  },
  {
    "item_id": "wooden_thread_spool",
    "family_id": "tripwire",
    "grade": "2",
    "display_name": "木芯线轴",
    "short_effect": "铺线绊停跨线敌人1.5秒",
    "param_key": "crossing_stop_ms",
    "param_value": "1500",
    "duration_ms": "10000",
    "range_px": "32",
    "ordinary_uses": "4",
    "weight": "2",
    "icon_brief": "双挡片夹紧粗线团形成横卧短轴；一端挡片破缺；线股从缺口折返穿入线团中央",
    "design_role": "提案待审；缝补箱中的木芯线轴；同样长度的绊线争取更长回身时间",
    "item_class": "core"
  },
  {
    "item_id": "double_clasp_strap",
    "family_id": "tripwire",
    "grade": "3",
    "display_name": "双扣束带",
    "short_effect": "铺线绊停跨线敌人2秒",
    "param_key": "crossing_stop_ms",
    "param_value": "2000",
    "duration_ms": "10000",
    "range_px": "32",
    "ordinary_uses": "4",
    "weight": "2",
    "icon_brief": "扁宽束带折成浅U形且两端各有一枚不同形状的扣件；一侧扣舌反向咬住内层；带面磨损沿受力方向",
    "design_role": "提案待审；搬运器具上卸下的束带；强化跨线停步但不禁攻也不延长线宽",
    "item_class": "core"
  },
  {
    "item_id": "lead_type_stamp",
    "family_id": "slow_zone",
    "grade": "1",
    "display_name": "铅字印章",
    "short_effect": "脚下重区使敌移速减30%",
    "param_key": "enemy_movement_multiplier",
    "param_value": "0.70",
    "duration_ms": "6000",
    "range_px": "64",
    "ordinary_uses": "4",
    "weight": "2",
    "icon_brief": "短方印座承着小拱形柄；底部铅字面厚重并错开一角；只表现大片压痕不描可读文字",
    "design_role": "提案待审；排字台遗留的铅印；脚下生成重区帮助临场拉开距离",
    "item_class": "core"
  },
  {
    "item_id": "broken_eye_scale_weight",
    "family_id": "slow_zone",
    "grade": "2",
    "display_name": "断耳秤砣",
    "short_effect": "脚下重区使敌移速减45%",
    "param_key": "enemy_movement_multiplier",
    "param_value": "0.55",
    "duration_ms": "6000",
    "range_px": "64",
    "ordinary_uses": "4",
    "weight": "2",
    "icon_brief": "梨形铁砣顶部提耳断去一侧；厚重下腹压成斜底；两条磨亮受力面围住粗暗铁皮",
    "design_role": "提案待审；断开提耳的称量砣；同一区域提供更显著移动减速",
    "item_class": "core"
  },
  {
    "item_id": "waterlogged_spine",
    "family_id": "slow_zone",
    "grade": "3",
    "display_name": "沉水脊骨",
    "short_effect": "脚下重区使敌移速减60%",
    "param_key": "enemy_movement_multiplier",
    "param_value": "0.40",
    "duration_ms": "6000",
    "range_px": "64",
    "ordinary_uses": "4",
    "weight": "2",
    "icon_brief": "三节宽脊骨错层连成短弧；骨孔向下塌缩而表面附有细薄沉积；保持骨质实体轮廓不画内脏",
    "design_role": "提案待审；从沉积中取出的异界骨节；强化重区脱身能力而不附送禁攻或感知压制",
    "item_class": "core"
  },
  {
    "item_id": "silver_back_hand_mirror",
    "family_id": "image_lure",
    "grade": "1",
    "display_name": "银背袖镜",
    "short_effect": "原地留下假身5秒",
    "param_key": "lure_duration_ms",
    "param_value": "5000",
    "duration_ms": "5000",
    "range_px": "0",
    "ordinary_uses": "4",
    "weight": "2",
    "icon_brief": "小卵圆镜面接短柄；银背翻起一条窄边；镜面反光只占偏侧一块不绘人脸图案",
    "design_role": "提案待审；随身携带的旧小镜；留下短时视觉替身来误导可见目标",
    "item_class": "core"
  },
  {
    "item_id": "empty_photo_frame",
    "family_id": "image_lure",
    "grade": "2",
    "display_name": "空白相框",
    "short_effect": "原地留下假身8秒",
    "param_key": "lure_duration_ms",
    "param_value": "8000",
    "duration_ms": "8000",
    "range_px": "0",
    "ordinary_uses": "4",
    "weight": "2",
    "icon_brief": "斜置长方相框缺掉一角；框内纸面空白而背撑露出；框内投影与外框倾斜方向不一致",
    "design_role": "提案待审；照片褪尽的台式相框；延长视觉假身而不增加声音或伤害",
    "item_class": "core"
  },
  {
    "item_id": "inverted_face_mask",
    "family_id": "image_lure",
    "grade": "3",
    "display_name": "倒脸面具",
    "short_effect": "原地留下假身11秒",
    "param_key": "lure_duration_ms",
    "param_value": "11000",
    "duration_ms": "11000",
    "range_px": "0",
    "ordinary_uses": "4",
    "weight": "2",
    "icon_brief": "瘦长面具的额部宽而下颌窄；五官压痕上下倒置但不画夸张表情；边缘一截绑带连在破孔上",
    "design_role": "提案待审；失去正确朝向的表演面具；保留较久替身但不强行覆盖已确认目标",
    "item_class": "core"
  },
  {
    "item_id": "blind_needle_compass",
    "family_id": "survey",
    "grade": "1",
    "display_name": "盲针罗盘",
    "short_effect": "探查4格内目标位置",
    "param_key": "snapshot_path_range_px",
    "param_value": "128",
    "duration_ms": "6000",
    "range_px": "128",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "圆形罗盘藏在半开八角盒中；宽针指向盒盖的内侧；浅刻度与缺一角的金属护边分开",
    "design_role": "提案待审；指针失去方位的携行罗盘；沿可通行空间记录一次近处位置快照",
    "item_class": "core"
  },
  {
    "item_id": "creased_negative",
    "family_id": "survey",
    "grade": "2",
    "display_name": "折角底片",
    "short_effect": "探查5格内目标位置",
    "param_key": "snapshot_path_range_px",
    "param_value": "160",
    "duration_ms": "6000",
    "range_px": "160",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "宽窄不等的两帧底片相连并折起一角；两侧齿孔形成断续负形；片中只保留模糊地面轮廓",
    "design_role": "提案待审；散落在暗袋中的旧底片；增加位置快照范围而不实时追踪",
    "item_class": "core"
  },
  {
    "item_id": "one_eyed_puppet_head",
    "family_id": "survey",
    "grade": "3",
    "display_name": "独目偶首",
    "short_effect": "探查6格内目标位置",
    "param_key": "snapshot_path_range_px",
    "param_value": "192",
    "duration_ms": "6000",
    "range_px": "192",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "偏方木偶头下方留有颈部插孔；单只偏大嵌眼不居中；另一侧是平整木面而非伤口",
    "design_role": "提案待审；拆离身体的木偶头；扩大有界探查但不揭内容物或照亮空洞",
    "item_class": "core"
  },
  {
    "item_id": "cold_ash_pipe",
    "family_id": "suppress",
    "grade": "1",
    "display_name": "冷灰烟斗",
    "short_effect": "压住一处污染源3秒",
    "param_key": "suppression_duration_ms",
    "param_value": "3000",
    "duration_ms": "3000",
    "range_px": "128",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "细弯斗柄连着厚壁小斗碗；碗内灰面朝外倾斜却不掉落；暗木与冷灰分别成面且没有火点",
    "design_role": "提案待审；未倒尽灰的旧烟斗；短时压住眼前污染源来打开穿越窗口",
    "item_class": "core"
  },
  {
    "item_id": "ceramic_charcoal_box",
    "family_id": "suppress",
    "grade": "2",
    "display_name": "陶壁炭盒",
    "short_effect": "压住一处污染源5秒",
    "param_key": "suppression_duration_ms",
    "param_value": "5000",
    "duration_ms": "5000",
    "range_px": "128",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "带窄提耳的矮陶盒半开一片厚盖；盒内炭块被陶壁挤成一整面；釉裂只沿一侧接缝生长",
    "design_role": "提案待审；包着余炭的厚壁容器；延长污染压制以支持一次搜取",
    "item_class": "core"
  },
  {
    "item_id": "frosted_furnace_core",
    "family_id": "suppress",
    "grade": "3",
    "display_name": "结霜炉芯",
    "short_effect": "压住一处污染源7秒",
    "param_key": "suppression_duration_ms",
    "param_value": "7000",
    "duration_ms": "7000",
    "range_px": "128",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "短粗炉芯保留三道竖直肋和底部安装脚；冷凝白壳只贴在向内的肋面；中心裂隙不画燃烧焰",
    "design_role": "提案待审；已经拆出的异温炉内件；较长压制仍不冻结实体攻击且到时恢复",
    "item_class": "core"
  },
  {
    "item_id": "brass_back_buckle",
    "family_id": "capacity",
    "grade": "1",
    "display_name": "黄铜背扣",
    "short_effect": "本趟负重上限增加4",
    "param_key": "carry_capacity_bonus",
    "param_value": "4",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "2",
    "weight": "2",
    "icon_brief": "双孔黄铜扣连接一小截厚背带；扣舌错过原孔咬进孔间空处；轮廓以双内孔辨认",
    "design_role": "提案待审；负具上卸下的承重扣；占被动槽换一趟额外携带空间",
    "item_class": "core"
  },
  {
    "item_id": "wrinkled_bottom_satchel",
    "family_id": "capacity",
    "grade": "2",
    "display_name": "皱底挎包",
    "short_effect": "本趟负重上限增加6",
    "param_key": "carry_capacity_bonus",
    "param_value": "6",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "2",
    "weight": "2",
    "icon_brief": "横宽软包有短侧带与压扁翻盖；底部连褶明显多于上口；口沿和包底分别形成清楚的体量层",
    "design_role": "提案待审；底层反复折皱的旧挎包；同等自身重量下多容纳几件战利品",
    "item_class": "core"
  },
  {
    "item_id": "reverse_woven_basket",
    "family_id": "capacity",
    "grade": "3",
    "display_name": "反编藤篮",
    "short_effect": "本趟负重上限增加8",
    "param_key": "carry_capacity_bonus",
    "param_value": "8",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "2",
    "weight": "2",
    "icon_brief": "椭圆提篮带一根偏心拱把；篮壁上下编向相反并在中腰交接；深浅藤条成束而不铺单像素棋盘",
    "design_role": "提案待审；编织次序异常的携物篮；强化单趟容量而不使薪柴计重或改变常态速度",
    "item_class": "core"
  },
  {
    "item_id": "wax_sealed_button",
    "item_class": "weak",
    "family_id": "solidify",
    "grade": "0",
    "display_name": "蜡封纽扣",
    "short_effect": "停住一敌1秒；受伤解除",
    "param_key": "freeze_duration_ms",
    "param_value": "1000",
    "duration_ms": "1000",
    "range_px": "128",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "厚蜡偏包一枚四孔纽扣；至少留两个可辨孔位",
    "design_role": "提案；短窗口可打断准备但难完成搜取"
  },
  {
    "item_id": "clouded_lens",
    "item_class": "weak",
    "family_id": "sight",
    "grade": "0",
    "display_name": "雾斑镜片",
    "short_effect": "本趟视距增加5%",
    "param_key": "vision_radius_multiplier",
    "param_value": "1.05",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "2",
    "weight": "2",
    "icon_brief": "半月缺口镜片带一片凝斑；边缘窄亮面",
    "design_role": "提案；微幅视距收益仍占被动槽"
  },
  {
    "item_id": "ceramic_capsule",
    "item_class": "weak",
    "family_id": "resistance",
    "grade": "0",
    "display_name": "陶衣药丸",
    "short_effect": "30秒内抗污增加10",
    "param_key": "contamination_resistance_points",
    "param_value": "10",
    "duration_ms": "30000",
    "range_px": "0",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "两瓣陶衣包成横向短胶囊；一侧釉色成整面",
    "design_role": "提案；基准少增1.5混乱；须在接触污染场景验证最低可感收益"
  },
  {
    "item_id": "hollow_reed_joint",
    "item_class": "weak",
    "family_id": "sound_lure",
    "grade": "0",
    "display_name": "空节苇管",
    "short_effect": "抛出声诱饵持续2秒",
    "param_key": "lure_duration_ms",
    "param_value": "2000",
    "duration_ms": "2000",
    "range_px": "96",
    "ordinary_uses": "5",
    "weight": "2",
    "icon_brief": "斜切短苇管保留一处节疤与敞口负形",
    "design_role": "提案；仅提供很短调查声源"
  },
  {
    "item_id": "sunken_inkstone",
    "item_class": "weak",
    "family_id": "slow_zone",
    "grade": "0",
    "display_name": "凹心砚台",
    "short_effect": "脚下重区使敌移速减10%",
    "param_key": "enemy_movement_multiplier",
    "param_value": "0.9",
    "duration_ms": "6000",
    "range_px": "64",
    "ordinary_uses": "4",
    "weight": "2",
    "icon_brief": "浅方砚带偏心凹面；残墨只聚一角不铺噪点",
    "design_role": "提案；低幅移动减速可用但替代性强"
  },
  {
    "item_id": "hollow_eyelet",
    "item_class": "weak",
    "family_id": "survey",
    "grade": "0",
    "display_name": "空眼铜环",
    "short_effect": "探查2格内目标位置",
    "param_key": "snapshot_path_range_px",
    "param_value": "64",
    "duration_ms": "6000",
    "range_px": "64",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "开口不相接的短铜环；背侧留连接皮片",
    "design_role": "提案；近处快照在缩视或拐角仍有窄用途"
  },
  {
    "item_id": "ash_tooth",
    "item_class": "weak",
    "family_id": "suppress",
    "grade": "0",
    "display_name": "灰釉齿",
    "short_effect": "压住一处污染源1秒",
    "param_key": "suppression_duration_ms",
    "param_value": "1000",
    "duration_ms": "1000",
    "range_px": "128",
    "ordinary_uses": "3",
    "weight": "2",
    "icon_brief": "短根尖齿包半侧灰釉；根部深孔与尖端区分",
    "design_role": "提案；极短穿过窗口不能承诺完整搜取"
  },
  {
    "item_id": "creased_ticket_wallet",
    "item_class": "weak",
    "family_id": "capacity",
    "grade": "0",
    "display_name": "折页票夹",
    "short_effect": "本趟负重上限增加2",
    "param_key": "carry_capacity_bonus",
    "param_value": "2",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "2",
    "weight": "1",
    "icon_brief": "对折薄票夹撑开两层夹页；一角反卷",
    "design_role": "提案；揭晓去壳后重量1；净增容量1；未鉴定壳仍2重；轻装不额外触发减速"
  },
  {
    "item_id": "double_hole_token",
    "item_class": "inert",
    "family_id": "",
    "grade": "0",
    "display_name": "双孔票牌",
    "short_effect": "没有可用的裂隙能力",
    "param_key": "",
    "param_value": "0",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "0",
    "weight": "2",
    "icon_brief": "狭长硬票牌有大小两个孔；两层边缘错开",
    "design_role": "提案；无Rift作用；保留收藏记录；不承诺未来隐藏用途"
  },
  {
    "item_id": "sealed_flower_calyx",
    "item_class": "inert",
    "family_id": "",
    "grade": "0",
    "display_name": "封口花萼",
    "short_effect": "没有可用的裂隙能力",
    "param_key": "",
    "param_value": "0",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "0",
    "weight": "2",
    "icon_brief": "合拢五角花萼包住空腔；一瓣内翻露深色面",
    "design_role": "提案；无Rift作用；外形仍体现被改写的原生物"
  },
  {
    "item_id": "split_porcelain_spoon",
    "item_class": "inert",
    "family_id": "",
    "grade": "0",
    "display_name": "分叉瓷匙",
    "short_effect": "没有可用的裂隙能力",
    "param_key": "",
    "param_value": "0",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "0",
    "weight": "2",
    "icon_brief": "短柄匙头分成不对称两瓣；瓷断面厚而硬",
    "design_role": "提案；无Rift作用；不因噪声身份降低美术完成度"
  },
  {
    "item_id": "paper_spiral",
    "item_class": "inert",
    "family_id": "",
    "grade": "0",
    "display_name": "折纸螺",
    "short_effect": "没有可用的裂隙能力",
    "param_key": "",
    "param_value": "0",
    "duration_ms": "0",
    "range_px": "0",
    "ordinary_uses": "0",
    "weight": "2",
    "icon_brief": "宽纸带沿方折线卷成矮螺形；末端反折入内",
    "design_role": "提案；无Rift作用；不兑换新资源避免废品必刷"
  }
];
const families = [
  {
    "family_id": "solidify",
    "display_role": "凝滞",
    "slot": "active",
    "scope": "timed",
    "param_key": "freeze_duration_ms",
    "range_semantics": "target_distance",
    "ordinary_uses": "5",
    "target_contract": "当前可见且无遮挡地面实体；受伤解除；恢复完整预兆",
    "stack_contract": "同一目标生效中拒绝；解除后2秒控制抗性"
  },
  {
    "family_id": "sight",
    "display_role": "视距",
    "slot": "passive",
    "scope": "run",
    "param_key": "vision_radius_multiplier",
    "range_semantics": "none",
    "ordinary_uses": "2",
    "target_contract": "先混乱缩距及保底后乘半径；再算真实遮挡；不增光亮",
    "stack_contract": "唯一被动槽；不叠加"
  },
  {
    "family_id": "resistance",
    "display_role": "抗污",
    "slot": "active",
    "scope": "timed",
    "param_key": "contamination_resistance_points",
    "range_semantics": "none",
    "ordinary_uses": "3",
    "target_contract": "所有正向混乱进入既有抗性环节；总抗性上限60%",
    "stack_contract": "生效中拒绝；若已达上限无收益则拒绝"
  },
  {
    "family_id": "dash",
    "display_role": "短冲",
    "slot": "active",
    "scope": "instant",
    "param_key": "dash_distance_px",
    "range_semantics": "travel_distance",
    "ordinary_uses": "3",
    "target_contract": "200ms内连续身体扫掠；不穿VOID或WALL；不无敌；危害照常",
    "stack_contract": "短冲执行中拒绝；结束后共享0.4秒再次施放间隔"
  },
  {
    "family_id": "silence",
    "display_role": "消声",
    "slot": "active",
    "scope": "timed",
    "param_key": "silence_duration_ms",
    "range_semantics": "none",
    "ordinary_uses": "5",
    "target_contract": "仅压自身行动听觉信号；不改变视认与已确认追逐",
    "stack_contract": "本人同族生效中拒绝"
  },
  {
    "family_id": "sound_lure",
    "display_role": "声诱",
    "slot": "active",
    "scope": "timed",
    "param_key": "lure_duration_ms",
    "range_semantics": "throw_distance",
    "ordinary_uses": "5",
    "target_contract": "可见合法落点；真实声路96px；每秒声脉冲；不抹追逐",
    "stack_contract": "本角色同族最多1个存活诱饵；生效中拒绝"
  },
  {
    "family_id": "tripwire",
    "display_role": "绊线",
    "slot": "active",
    "scope": "timed",
    "param_key": "crossing_stop_ms",
    "range_semantics": "placement_distance",
    "ordinary_uses": "4",
    "target_contract": "面前32px横铺64px完整线；每敌每线触发一次；不禁攻",
    "stack_contract": "同族最多1条；停步后2秒控制抗性"
  },
  {
    "family_id": "slow_zone",
    "display_role": "重区",
    "slot": "active",
    "scope": "timed",
    "param_key": "enemy_movement_multiplier",
    "range_semantics": "radius",
    "ordinary_uses": "4",
    "target_contract": "脚下64px半径；仅连通合法地面；只慢地面实体移动",
    "stack_contract": "同族最多1处；不同重区取最强不相乘"
  },
  {
    "family_id": "image_lure",
    "display_role": "假身",
    "slot": "active",
    "scope": "timed",
    "param_key": "lure_duration_ms",
    "range_semantics": "none",
    "ordinary_uses": "4",
    "target_contract": "当前位置；敌人实际可见才参与选择；不抹追逐",
    "stack_contract": "同族最多1个；与声诱可共存且感官分开"
  },
  {
    "family_id": "survey",
    "display_role": "探查",
    "slot": "active",
    "scope": "snapshot",
    "param_key": "snapshot_path_range_px",
    "range_semantics": "walkable_path_distance",
    "ordinary_uses": "3",
    "target_contract": "沿通行路径距离采样位置并显示6秒；不照亮不揭内容；空结果有效",
    "stack_contract": "快照显示中拒绝；不保留实时绑定"
  },
  {
    "family_id": "suppress",
    "display_role": "压制",
    "slot": "active",
    "scope": "timed",
    "param_key": "suppression_duration_ms",
    "range_semantics": "target_distance",
    "ordinary_uses": "3",
    "target_contract": "可见无遮挡活动Host源；所有危险阶段可用；不影响实体",
    "stack_contract": "目标已有压制或暂缓拒绝；结束后2秒再压制保护"
  },
  {
    "family_id": "capacity",
    "display_role": "负重",
    "slot": "passive",
    "scope": "run",
    "param_key": "carry_capacity_bonus",
    "range_semantics": "none",
    "ordinary_uses": "2",
    "target_contract": "本趟加容量；自身重量读物件定义；现有速度曲线读新上限",
    "stack_contract": "唯一被动槽；末次效果先完成回库再解除"
  }
];
const review = [
  {
    "id": "solidify",
    "name": "凝滞的石块",
    "current": "使视野内无遮挡的最近地面实体停滞4秒，阻止移动、感知与攻击。受到伤害后提前解除；重新出手须完整预兆。不作用于占漆或占空场域。",
    "offering_current": "凝滞的石块将冲击的一部分留在停滞裂面里，减伤35%，无额外副作用。",
    "verdict": "保留",
    "reason": "效果直接、对象停住可见；稳定选中目标即可。",
    "target": "P01"
  },
  {
    "id": "scatter",
    "name": "重影碎片",
    "current": "被动生效。当敌人新一次开始怀疑你的存在时，感知填充速度降低30%。同一怀疑事件只消耗一次。",
    "offering_current": "将集中冲击分散到全部模块，总伤害不减少，脆弱模块也可能受伤。",
    "verdict": "重做",
    "reason": "隐藏的怀疑填充减速难感知；改为直接扩光，并明确更换物件名。",
    "target": "P02"
  },
  {
    "id": "retrograde",
    "name": "记忆碎片",
    "current": "被动生效。新一轮追击中，敌人离开你的视线后，在最后看见的位置留下6秒残影。同一轮追击只消耗一次；不追踪视野外的实时位置。",
    "offering_current": "减伤15%。每次在供奉中承受冲击后，记下下一轮准确目标与强度；取下或成熟后本次记录仍有效。",
    "verdict": "合并",
    "reason": "追击后失去玩家视线才触发，消耗自动且收益窄；信息职责收进珠子，不附赠追击残影。",
    "target": "P10"
  },
  {
    "id": "delay",
    "name": "不落的砂砾",
    "current": "推迟视野内无遮挡且尚未释放的最近气团、雾团或尘絮群的下一次释放5秒。距离4格以内；不作用于已释放危险或持续占漆。没有合法目标不消耗。",
    "offering_current": "悬住的砂粒承接冲击，稳定减伤30%。",
    "verdict": "合并",
    "reason": "目标与阶段覆盖比余烬窄；次数/阶段差异不足以证明独立打法。",
    "target": "P11"
  },
  {
    "id": "siphon",
    "name": "附着的空壳",
    "current": "被动。真实受伤后增加20点污染抗性，持续8秒，与装备抗性叠加至现有上限。生效期间再次受伤不重复消耗，不回血，也不消除已经积累的混乱。",
    "offering_current": "减伤15%。在供奉中实际承受冲击后，下一次有效注入额外修复最多6点完整度。额度不累积，取下或成熟后仍有效。",
    "verdict": "重做",
    "reason": "受伤后才抗污，无法处理刚发生的伤害；改为主动选择一段抗污窗口。",
    "target": "P03"
  },
  {
    "id": "expand",
    "name": "带缺口的石头",
    "current": "向面朝方向越过一格薄墙，抵达全身可站立的安全位置后实体化1秒。不能穿厚墙、虚空或边界；没有合法落点不消耗。",
    "offering_current": "缺口令40%冲击失去着力点，稳定减伤40%，不扣稳定度。",
    "verdict": "重做",
    "reason": "旧薄墙穿越在全空洞障碍的新地图中无合法目标；改为沿地面短冲。",
    "target": "P04"
  },
  {
    "id": "muffle",
    "name": "消声的旧布",
    "current": "压住能够引起敌人听觉发现的声音，不屏蔽视觉或接触危险。连续听觉遭遇消耗1次；最后一份效果完整维持，连续1.5秒无有效听觉信号后结束。",
    "offering_current": "声响消失在折布内，吸收30%冲击，不改变后续出击。",
    "verdict": "简化",
    "reason": "连续听觉遭遇与1.5秒间隔决定扣次，玩家不可直接掌控；改一次按键、固定8秒。",
    "target": "P05"
  },
  {
    "id": "kindle",
    "name": "回声空壳",
    "current": "向面朝方向的合法位置抛出回声空壳，持续6秒发出声音，最远可传96像素；敌人的听力与空间遮挡会缩短可听范围。适合引开尚未锁定你的敌人；不会让已确认追逐者忘记你。不会造成伤害，也可能引来其他威胁。",
    "offering_current": "减伤20%。壳内回声让自身每轮供奉积累翻倍，不加下次出击混乱。",
    "verdict": "保留待实证",
    "reason": "主效果直接，但已有实测未证明稳定诱离搜取；落点/传播可读性与收益须过关。",
    "target": "P06"
  },
  {
    "id": "stitch",
    "name": "打结的细线",
    "current": "在面前1格处横铺2格长的打结的细线，持续10秒。每个地面实体首次跨线时止步1.5秒，仍可感知和攻击。不跨墙或虚空，无法铺成完整线段时不消耗。",
    "offering_current": "减伤20%，再将主要受冲击模块最多4点伤害转给余血最多的另一模块。接收方至少保留1点完整度，没有安全接收者时不转移。",
    "verdict": "保留待对照",
    "reason": "预先布置与脚下减速有时机差异，不能只因均限制移动就合并；需证明准备有收益。",
    "target": "P07"
  },
  {
    "id": "compress",
    "name": "沉重的石块",
    "current": "在脚下留下半径2格的沉重区域，持续6秒。区域内地面实体移速降低50%，离开即恢复；不改变方向、感知或攻击，场域本身不受影响。",
    "offering_current": "承住冲击最集中的一股，使主要模块受到的伤害减少50%。不减轻其他模块的余波。",
    "verdict": "保留",
    "reason": "脚下立即出现慢行区，临场脱身用途直接；需与绊线做携带选择对照。",
    "target": "P08"
  },
  {
    "id": "mirror",
    "name": "留影玻璃",
    "current": "在原地留下一具持续8秒的视觉诱饵。只有能实际看见它的敌人才可能被吸引；不会抹去敌人已经确认的目标。",
    "offering_current": "减伤25%，非主要目标承受的余波再减少25%。不返还薪柴或误导预告。",
    "verdict": "保留待对照",
    "reason": "假身容易理解，但和声诱的感官差异必须形成不同走法；否则候选合并。",
    "target": "P09"
  },
  {
    "id": "abyss",
    "name": "映出别处的珠子",
    "current": "在6格以内沿可通行空间回探，短暂标记实体、环境危险核心及未翻找堆的位置，保留6秒。只记录施放瞬间，不显示内容物或实时追踪，不越过封闭墙体探知另一侧。",
    "offering_current": "各模块减伤20%；冲击前完整度不高于40%的模块改为减伤50%。不伤害其他模块。",
    "verdict": "简化",
    "reason": "保留一次快照，统一时效；不把追踪/敌情分析等多套功能叠上去。",
    "target": "P10"
  },
  {
    "id": "combust",
    "name": "冷却的余烬",
    "current": "压住4格内可见且无遮挡的最近活动污染源5秒。气团、雾团、尘絮群的各活动阶段及持续占漆均可作用；已受压制或暂缓的目标不能重复使用。实体仍可攻击；没有合法目标不消耗。",
    "offering_current": "减伤25%。每轮将本次实际承伤的20%用于修复最低完整度模块；没有承伤不产生修复，不增加下次出击混乱。",
    "verdict": "保留",
    "reason": "已证实压制后的穿越收益；统一活动阶段，承担原砂砾的环境干预职责。",
    "target": "P11"
  }
];
const offerings = [
  {
    "offering_id": "resist_25",
    "display_name": "迟滞反应",
    "effect": "impact_damage_reduction",
    "amount": "0.25",
    "charge_multiplier": "1",
    "weight": "30",
    "short_effect": "供奉期间冲击伤害减少25%"
  },
  {
    "offering_id": "resist_35",
    "display_name": "排斥反应",
    "effect": "impact_damage_reduction",
    "amount": "0.35",
    "charge_multiplier": "1",
    "weight": "30",
    "short_effect": "供奉期间冲击伤害减少35%"
  },
  {
    "offering_id": "resist_45",
    "display_name": "隔断反应",
    "effect": "impact_damage_reduction",
    "amount": "0.45",
    "charge_multiplier": "1",
    "weight": "20",
    "short_effect": "供奉期间冲击伤害减少45%"
  },
  {
    "offering_id": "quickening",
    "display_name": "促变反应",
    "effect": "self_charge_multiplier",
    "amount": "2",
    "charge_multiplier": "2",
    "weight": "10",
    "short_effect": "自身供奉积累翻倍；不提供减伤"
  },
  {
    "offering_id": "quiet",
    "display_name": "沉默反应",
    "effect": "none",
    "amount": "0",
    "charge_multiplier": "1",
    "weight": "10",
    "short_effect": "不提供供奉增益；仍可转化揭晓"
  }
];
const loot = [
  {
    "profile_id": "safe",
    "core_weight": "65",
    "weak_weight": "25",
    "inert_weight": "10",
    "grade_1_weight": "80",
    "grade_2_weight": "18",
    "grade_3_weight": "2",
    "global_family_mix": "0.6",
    "notes": "低风险偏低功能级；所有品质沿60/25/12/3独立抽样；节点生成条件见正文"
  },
  {
    "profile_id": "contested",
    "core_weight": "65",
    "weak_weight": "25",
    "inert_weight": "10",
    "grade_1_weight": "60",
    "grade_2_weight": "32",
    "grade_3_weight": "8",
    "global_family_mix": "0.6",
    "notes": "一般风险；功能级只在core内抽；没有按品质筛除空签"
  },
  {
    "profile_id": "deep",
    "core_weight": "65",
    "weak_weight": "25",
    "inert_weight": "10",
    "grade_1_weight": "40",
    "grade_2_weight": "42",
    "grade_3_weight": "18",
    "global_family_mix": "0.6",
    "notes": "高风险偏高功能级；同样可能弱效或无能力；不按世界名分支"
  }
];

const className:Record<string,string>={core:"核心装备",weak:"弱效异物",inert:"无出击能力"};
const qualityNames=["普通","优良","精良","卓越"];
const docPath="/Users/yilungao/coh/docs/design-notes/contaminant-ability-design.md";
function familyName(id:string){return families.find(f=>f.family_id===id)?.display_role??"无能力";}
function uses(item:typeof items[number],q:number){if(item.item_class==="inert")return "不适用"; return `${Number(item.ordinary_uses)+q}${families.find(f=>f.family_id===item.family_id)?.slot==="passive"?"趟":"次"}`;}
function percent(n:number){return (n*100).toFixed(1)+"%";}
export default function ContaminantSystemDesign(){
  const t=useHostTheme();
  const [tab,setTab]=useState("catalog");
  const [kind,setKind]=useState("all");
  const [family,setFamily]=useState("all");
  const [quality,setQuality]=useState("0");
  const [selected,setSelected]=useState("stopped_pocket_watch");
  const [revealed,setRevealed]=useState(false);
  const [risk,setRisk]=useState("contested");
  const [nodeCount,setNodeCount]=useState("3");
  const category=items.filter(i=>kind==="all"||i.item_class===kind);
  const availableFamilies=[...new Set(category.map(i=>i.family_id))];
  const shown=category.filter(i=>family==="all"||i.family_id===family);
  const picked=items.find(i=>i.item_id===selected)!;
  const profile=loot.find(i=>i.profile_id===risk)!;
  const q=Number(quality),n=Number(nodeCount),raw=[.65,.25,.10],den=1-.35**n;
  const actual=n<3?raw:[.65/den,(.25-.35**n*(.25/.35))/den,(.10-.35**n*(.10/.35))/den];
  return <Stack gap={18} style={{padding:24,maxWidth:1320,margin:"0 auto",color:t.text.primary,background:t.bg.editor}}>
    <Text tone="secondary" size="small">污染物系统设计 · 2026-09-19 · DEC-173 · 提案，尚未实施</Text>
    <H1>发现一件东西，再发现它能做什么</H1>
    <Text>12个共享能力族承载36件核心装备、8件弱效与4件无出击能力异物。供奉先兑现基地作用，完成后揭晓工具身份。单件仍保持一个主效果、一次简单操作。</Text>
    <Row gap={12} wrap>{[["catalog","48件目录"],["identify","供奉与鉴定"],["supply","掉落与周转"],["delivery","实施与审查"]].map(([id,label])=><span key={id}><Button variant={tab===id?"primary":"ghost"} onClick={()=>setTab(id)}>{label}</Button></span>)}</Row>
    <Divider/>
    {tab==="catalog"&&<Stack gap={18}>
      <Row gap={12} wrap><Text>目录</Text><Select value={kind} onChange={v=>{setKind(v);setFamily("all");}} options={[{value:"all",label:"全部48件"},{value:"core",label:"核心36件"},{value:"weak",label:"弱效8件"},{value:"inert",label:"无能力4件"}]}/>
        <Select value={family} onChange={setFamily} options={[{value:"all",label:"全部能力"},...availableFamilies.map(v=>({value:v,label:familyName(v)}))]}/>
        <Text>查看品质</Text><Select value={quality} onChange={setQuality} options={qualityNames.map((label,i)=>({value:String(i),label}))}/></Row>
      <Text tone="secondary">功能级属于不同装备；品质只改变同一装备的余次。下面的级别和分类用于设计审查，游戏内不显示“初级/高级/噪声”标签。未鉴定外壳均2重；揭晓后票夹1重，其余物件2重。</Text>
      {shown.length>0&&<Table headers={["物件真名","能力／内部级","主效果","所选品质余量","查看构造"]} rows={shown.map(i=>[i.display_name,`${familyName(i.family_id)} · ${i.grade}`,i.short_effect,uses(i,q),<Button variant="ghost" onClick={()=>setSelected(i.item_id)}>查看</Button>])} stickyHeader style={{maxHeight:470,overflow:"auto"}}/>}
      <Grid columns="minmax(200px,1fr) minmax(260px,2fr)" gap={24}>
        <Stack gap={8}><H2>{picked.display_name}</H2><Text>{className[picked.item_class]} · {familyName(picked.family_id)}</Text><Text>{picked.short_effect}</Text><Text tone="secondary">{qualityNames[q]} · {uses(picked,q)} · 重量{picked.weight}</Text></Stack>
        <Stack gap={8}><H3>图标构造说明</H3><Text>{picked.icon_brief}</Text><Text tone="secondary">{picked.design_role}</Text><Text size="small" tone="secondary">这里展示美术brief，不是已制作图标。48个独立物件形体、8外壳与可复用残片，共128个24/32px基础图像层；需要的16px技能物另计。</Text></Stack>
      </Grid>
      <Text tone="secondary">36件提供纵向发现与替换，不等于36种玩法。横向深度需由不同族在实际遭遇中的取舍证明。</Text>
    </Stack>}
    {tab==="identify"&&<Stack gap={18}>
      <H2>同一个实例，前后不同的信息</H2>
      <Text>以下是设计演示，切换不操作游戏、存档或真实供奉。用同一外壳与相同基地反应承载不同结果，检验“隐藏能力”是否真的成立。</Text>
      <Row wrap gap={12}><Select value={selected} onChange={v=>{setSelected(v);setRevealed(false);}} options={items.map(i=>({value:i.item_id,label:`设计者选择：${i.display_name}`}))}/><Button variant="primary" onClick={()=>setRevealed(!revealed)}>{revealed?"查看转化前":"查看转化后"}</Button></Row>
      <Grid columns={2} gap={32}>
        <Stack gap={10}><H3>玩家此刻能看到</H3><H2>{revealed?picked.display_name:"蜡封包"}</H2><Text>{revealed?picked.short_effect:"供奉期间冲击伤害减少35%"}</Text><Text>{revealed?`${picked.item_class==="inert"?"无可用次数":uses(picked,q)} · 重量${picked.weight}`:`结构保持性：${qualityNames[q]} · 重量2 · 转化后揭晓裂隙能力`}</Text><Text tone="secondary">{revealed?"主体是真物件，保留原封缝残片；供奉作用已结束。":"主体是不透明外壳；不透露真名、装备位、未来次数或技能图。"}</Text></Stack>
        <Stack gap={10}><H3>系统必须保证</H3><Text>真实身份在节点生成时固定，供奉只揭晓。出发意图先锁内容与算法版本，刷新不能重抽。</Text><Text>转化进度、清槽、回库、余量和发现记录在同一持久事务提交；成功后才播放揭晓。</Text><Text>名称、图标、读屏、排序、过滤和报告共用公开信息投影，不能只遮一段说明。</Text><Text>新实例即便外壳见过、真物件已收录，仍是多种可能结果。旧物此前已公开的信息保留。</Text></Stack>
      </Grid>
      <H3>五种公开供奉反应</H3><Table headers={["反应","已知作用","采样权重"]} rows={offerings.map(o=>[o.display_name,o.short_effect,o.weight+"%"])}/>
      <Text tone="secondary">来源：供奉草案CSV。反应与核心／弱效／无能力独立。成熟基础3积累；普通有效冲击＋1，高潮＋3；促变×2。三槽可并行，不能称固定三趟一件。</Text>
    </Stack>}
    {tab==="supply"&&<Stack gap={18}>
      <H2>大量不同物件，不稀释能力族的供给</H2>
      <Row gap={12} wrap><Text>风险档</Text><Select value={risk} onChange={setRisk} options={[{value:"safe",label:"安全"},{value:"contested",label:"一般"},{value:"deep",label:"深入"}]}/><Text>本图污染物节点数</Text><Select value={nodeCount} onChange={setNodeCount} options={[1,2,3,5,10].map(v=>({value:String(v),label:String(v)}))}/></Row>
      <Table headers={["结果类别","原始抽样权重","生成保护后的期望比例"]} rows={["核心","弱效","无出击能力"].map((name,i)=>[name,percent(raw[i]),percent(actual[i])])}/>
      <Text tone="secondary">来源：掉落草案与条件概率模型。≥3节点要求生成计划里至少一件核心；不保证玩家找到或带回。上表是生成期望，不是实玩掉率。教学首件另设一次性保证。</Text>
      <H3>核心装备内部功能级比例</H3><Table headers={["一级","二级","三级"]} rows={[[profile.grade_1_weight+"%",profile.grade_2_weight+"%",profile.grade_3_weight+"%"]]}/>
      <Grid columns={2} gap={24}>
        <Stack gap={10}><H3>可预期的方向</H3><Text>图内两个可达搜取片区有不同来源倾向，靠近已见翻堆才能读到提示，玩家可选择搜索方向。先抽能力族，再抽功能级和具体装备。60%全局＋40%来源偏好；两个偏好族各25%，其余各5%。给一个族加新物件，不增加该族总权重。</Text><Text>品质独立：普通60%、优良25%、精良12%、卓越3%。高品质弱物仍然弱，高品质无能力物也不会出现虚假次数。</Text></Stack>
        <Stack gap={10}><H3>噪声的边界</H3><Text>低价值层约32%–35%；大部分仍有供奉收益或弱技能。两边都没功能约0.9%–1%，避免长时间等待后大量纯空签。</Text><Text>不设废品兑换新货币、集齐加属性等机制。图鉴留记忆，丢弃不丢记录。若玩家因此不想捡，先调空签与供奉周转。</Text></Stack>
      </Grid>
      <H3>补给等待不能只看总物件数</H3><Text>未加保底、全局均匀池下，核心级指定族约5.4%（平均18.5次鉴定）；来源偏好下16.25%（平均6.15次）。有弱效版的8族若把弱物一起算，约8.54%／19.38%。这是理论平均，不能承诺几趟补齐。</Text>
      <Text tone="secondary">所有比例是待验证初值。需记录生成、拾取、带回、供奉、鉴定、装配、使用、耗尽和死亡，才能评估真实构筑周转。</Text>
    </Stack>}
    {tab==="delivery"&&<Stack gap={18}>
      <H2>从可实现的合同到可交付的内容</H2>
      <Table headers={["批次","完成什么","过关依据"]} rows={[
        ["A · 数据与鉴定","锁版本、dropPlan、公开投影、原子揭晓、旧物兼容","三类物件自然链；保存拒写/刷新不重抽或重复给物"],
        ["B · 能力与供给","视距、容量、抗污、短冲与共享地图能力；片区来源与已见提示、掉落","实际行动收益；末次被动满载刷新/回库；多地图一致"],
        ["C · 图标与全目录","先标杆，再完成48真物件、8外壳及必要落地稿","24/32/16px真实消费；同族不同形体；前后身份与防泄露"],
        ["D · 长链切换","多风险、多来源、死亡与补给；版本化启用新目录","自然鉴定与工具消耗账本；旧在途局仍可恢复"]
      ]}/>
      <H3>当前13族的审查事实</H3><Table headers={["现役物件","裁决方向","问题或保留理由"]} rows={review.map(r=>[r.name,r.verdict,r.reason])}/>
      <Text tone="secondary">来源：2026-09-19现状审查快照；裁决为后续设计方向，生产13族还在。当前证据没有证明声诱稳定帮助安全搜取。</Text>
      <H3>本轮已查与未查</H3><Text>静态内容检查：48个唯一ID/名称、12族三档单轴递进、8弱效低于一级、4无能力无次数、权重及引用。条件抽样诊断覆盖1/2/3/5/10节点，每档5万批。492项生产源文件与I27最终清单一致。</Text><Text>未实现新能力、鉴定或新掉落；未制作图标；未做新方案实玩；画布只做TypeScript检查，不冒称浏览器视觉验收。</Text>
      <H3>扩展规则</H3><Text>加同族装备：原物与真名→CSV一行→独立图标→族内池→对照验证。加新能力：先证明新的玩家决定，再写共享空间/保存/叠加合同。加世界：提供风险与来源标签，通过同一能力探针，不按世界ID改技能。</Text>
    </Stack>}
    <Divider/>
    <Text size="small" tone="secondary">完整规则、全部CSV与制作合同以文档为准。新数值未平衡，用户方向与具体提案分开记录。</Text>
    <Text><a href={docPath} style={{color:t.accent.primary}}>完整系统设计</a> · <a href="/Users/yilungao/coh/docs/art/contaminant-item-icons.md" style={{color:t.accent.primary}}>图标制作规格</a></Text>
  </Stack>;
}
