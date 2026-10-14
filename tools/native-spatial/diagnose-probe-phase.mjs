import fs from 'node:fs';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {mix32} from '../../src/generation/seed-fork.ts';
const [source,out]=process.argv.slice(2);if(!out||fs.existsSync(out))throw Error('source new-report required');const {proposal,input}=JSON.parse(fs.readFileSync(source)),g=buildNativeSpatialGeometry(proposal.definition,20261012),rows=[];
for(const mode of ['grid32-center','grid16-phase4','grid16-phase12','stratified16']){let walk=0,wide=0;const step=mode==='grid32-center'?32:16;
for(let cy=0;cy<input.world.frameHeightPx;cy+=step)for(let cx=0;cx<input.world.frameWidthPx;cx+=step){const hash=mix32(20261012,`native-planner-${cx}-${cy}`),x=cx+(mode==='grid32-center'?16:mode==='grid16-phase4'?4:mode==='grid16-phase12'?12:4+8*(hash&1)),y=cy+(mode==='grid32-center'?16:mode==='grid16-phase4'?4:mode==='grid16-phase12'?12:4+8*((hash>>>1)&1)),p={x,y};if(g.collision.supports(p,10,10)){walk++;if(Math.min(g.solidDistance(p),g.voidDistance(p))>=48)wide++;}}
rows.push({mode,walk,wide,ratio:wide/walk});}fs.writeFileSync(out,JSON.stringify({source,rows},null,2)+'\n');console.log(rows);
