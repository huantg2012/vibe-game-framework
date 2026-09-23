# R9 净化点原生像素作者源

生产入口为`environment.ts`，汇合`interior.ts`与`exterior.ts`；共同面/材料合同为`schema.ts`。640×400，固定投影X=x、Y=y+Z。原角色/六装置等比原生，不粘贴或采样概念图。

- 室内左置：封闭厚壳、核心暗龛、短上层、双宽坡、三处内部接触。
- 外景集中右侧：承托/厚断芯穿入室内，实际暴露的远层递减凹腔经过中景遮挡，近层托腹与楼板基础相接。
- 主地坪、上层、坡道轮廓来自`src/systems/purification-chamber-layout.ts`，源图只在实际可走宿主内绘铺砌/接合。运动几何不反向从画面推断。
- 普通近材有显式表面方向/高程；远中层按作者深度配色，近层才接局部外景反射。输运微光按真实near透明度宿主判断，与反射方向掩膜分开。
- 内接触根与外部可见延续分别由layout的`CHAMBER_CONTACTS`/`CHAMBER_EXTERIOR_CONTACTS`定义；后者只保真实外露的rear/east。西接触在室内，没有虚构外部活动。

同源导出：`node --import tsx tools/art-pipeline/purification-chamber.ts [输出目录]`。输出albedo、baked、normal、height、可编辑面SVG及原生像素SVG；结构SVG不是最终渲染。floor alpha逐像素对照真实行走并集。旧`purification-r8.ts`只是兼容当前导出命令，历史R8图在Git和QA保留。

已执行范围与保留项见`docs/qa/iteration-30-r9.md`。原画只作构图参考的决定见`docs/art/demos/purification-r9/README.md`；任何内部检查均不代签人审或“达到死亡细胞”。
