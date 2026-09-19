import fs from 'node:fs';
import { generateRiftLayout } from '@/generation/rift-layout';
import { bakeGround as current, compositeStaticPaint as paint } from '@/generation/preview-paint';
const old = await import('/tmp/i27-preview-paint-before.ts');
const mask = generateRiftLayout(3036342668).ruins;
const rows=[];
for(let i=0;i<4;i++)for(const [name,fn,composite] of [['before',old.bakeGround,old.compositeStaticPaint],['after',current,paint]] as const){
 const start=performance.now(),ground=fn(mask,16),bake=performance.now();
 composite(ground,new Float32Array(ground.raw.length),new Uint8Array(ground.width*ground.height*4));
 rows.push({pass:i,name,bakeMs:Math.round(bake-start),totalMs:Math.round(performance.now()-start)});
}
fs.writeFileSync('docs/qa/artifacts/iteration-27/art/bake-timing.json',JSON.stringify(rows,null,2));console.log(rows);
