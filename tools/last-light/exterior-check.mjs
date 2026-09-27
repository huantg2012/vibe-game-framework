import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {getLastLightExteriorObserver,getLastLightExteriorOffsets,LAST_LIGHT_EXTERIOR,createLastLightEnvironmentShader} from '../../src/art/last-light-exterior.ts';

const dir='public/assets/last-light';
const meta=JSON.parse(await fs.readFile(`${dir}/exterior-fields.json`,'utf8'));
const manifest=JSON.parse(await fs.readFile(`${dir}/manifest.json`,'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [file,hash]of Object.entries(meta.sourceHashes))assert.equal(digest(await fs.readFile(file)),hash,`Stale exterior source ${file}`);
assert.equal(digest(await fs.readFile(`${dir}/${meta.texture}`)),meta.textureHash,'Stale exterior field PNG');
assert.deepEqual(meta.columns,['far','middle','near','haven']);
assert.deepEqual(meta.rows,['otherPollution','core','storage','purifier','furnace','motion','normal']);
const load=async name=>{const {data,info}=await sharp(`${dir}/${name}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});return{data,width:info.width,height:info.height};};
const [fields,depth,...plates]=await Promise.all(['exterior-fields','exterior-depth','exterior-far','exterior-middle','exterior-near','haven','background'].map(load));
assert.equal(fields.width,4096);assert.equal(fields.height,4928);
const luma=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const sample=(image,x,y)=>{x=Math.max(0,Math.min(image.width-1,Math.floor(x)));y=Math.max(0,Math.min(image.height-1,Math.floor(y)));const i=(y*image.width+x)*4;return [...image.data.subarray(i,i+4)];};
const pad=32,PW=1024,PH=704,W=960,H=640;
const field=(x,y,layer,row)=>sample(fields,x+layer*PW,y+row*PH);
const worldPoints=[[3.8,0,3.8],[-2,0,-2.28],[1.15,0,4.3],[10.634,0,2.255],[6,2.6,-3.33],[9.02,2.6,-3.55]];
const offsets=worldPoints.map(p=>{
 const observer=getLastLightExteriorObserver(p,manifest.camera),offset=getLastLightExteriorOffsets(observer);
 assert.deepEqual(getLastLightExteriorObserver([p[0],p[1]+20,p[2]],manifest.camera),observer,'Height must not pull the external building');
 assert.deepEqual(offset.near,[0,0]);assert(Math.hypot(...offset.far)<6);assert(Math.hypot(...offset.middle)<3.5);
 return{world:p,observer,offset};
});
for(let x=-1000;x<=1000;x+=.25){
 const a=getLastLightExteriorOffsets([x,0]),b=getLastLightExteriorOffsets([x+.25,0]);
 assert(Math.abs(a.far[0]-b.far[0])<.021,'Continuous bounded derivative (no clamp corner)');
 assert(Math.abs(a.middle[0]-b.middle[0])<.013);
}
let normals=0,haloFields=0;
for(let layer=0;layer<4;layer++)for(let y=0;y<PH;y++)for(let x=0;x<PW;x++){
 const d=sample(depth,x,y+layer*PH);
 if(d[3]){assert.equal(field(x,y,layer,6)[3],255,'Receiver depth without material normal');normals++;}
 if(layer===3&&!d[3]&&field(x,y,layer,1).some((n,k)=>k<3&&n>0))haloFields++;
}
assert(haloFields>0,'Haven source-scattered air missing outside opaque pixels');

// CPU t=0 reference of the opaque composition; this is a geometry/colour
// witness, not a substitute for shader compilation or real walking review.
function compose(position,{old=false,atmosphere=true}={}){
 const out=new Uint8ClampedArray(W*H*4),stats={backgroundDelta:0,nearDelta:0,havenDelta:0,farDeltas:[],middleDeltas:[]};
 const observer=getLastLightExteriorObserver(position,manifest.camera),offset=getLastLightExteriorOffsets(observer);
 const reference=getLastLightExteriorObserver([position[0],0,position[2]],manifest.camera);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const pix=[x+.5,y+.5];
  let os=[offset.far,offset.middle,offset.near,[0,0]];
  if(old){const attachment=1-smooth(220,640,pix[0]);os=[.06,.18,.38*attachment,0].map(n=>reference.map(v=>Math.max(-24,Math.min(24,-v*n))));}
  const layers=[];
  for(let layer=0;layer<4;layer++){
   const sx=pix[0]+pad-os[layer][0],sy=pix[1]+pad-os[layer][1];
   const c=sample(plates[layer],layer===3?sx-pad:sx,layer===3?sy-pad:sy),d=sample(depth,sx,sy+layer*PH);
   const decoded=d[0]*256/256+d[1]/256-80;
   const before=[...c];
   if(!old&&atmosphere&&layer<2&&d[3]){
    const nd=field(sx,sy,layer,6),n=nd.slice(0,3).map(v=>v/255*2-1),norm=Math.hypot(...n),light=[-.22,.87,.44],ln=Math.hypot(...light);
    const exposure=Math.max(0,n.reduce((sum,v,i)=>sum+v*light[i]/norm/ln,0));
    if(layer===0){const visibility=smooth(-30,-5,decoded),articulation=(.8+2.4*exposure)*(.35+.65*visibility),mix=.73+.27*visibility;
     for(let k=0;k<3;k++)c[k]=[.0285,.031,.0315][k]*255*(1-mix)+c[k]*mix+[1,.995,.965][k]*articulation*c[3]/255;
    }else{const recession=1-smooth(-13,1.5,decoded);for(let k=0;k<3;k++)c[k]=c[k]*(1-recession*.075)+[.0285,.031,.0315][k]*255*recession*.075+[1,.995,.965][k]*(.30+1.1*exposure)*recession*c[3]/255;}
   }
   layers.push({c,d,depth:d[3]?decoded:-10000,layer,before});
  }
  layers.sort((a,b)=>a.depth-b.depth);const background=sample(plates[4],...pix),color=background.slice(0,3);
  for(const {c}of layers)for(let k=0;k<3;k++)color[k]=c[k]+color[k]*(1-c[3]/255);
  const top=layers[layers.length-1];
  if(top.depth>-9999){if(top.layer===0)stats.farDeltas.push(luma(top.c)-luma(top.before));if(top.layer===1)stats.middleDeltas.push(luma(top.c)-luma(top.before));}
  out.set([...color.map(v=>Math.max(0,Math.min(255,Math.round(v)))),255],(y*W+x)*4);
 }
 return{out,stats};
}
const base=compose(worldPoints[0],{atmosphere:false}),improved=compose(worldPoints[0]);
let havenChanged=0,nearChanged=0,backgroundChanged=0,farChanged=0;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;let winner=-1,best=-10000;
 for(let k=0;k<4;k++){const d=sample(depth,x+pad,y+pad+k*PH),v=d[3]?d[0]+d[1]/256-80:-10000;if(v>best){best=v;winner=k;}}
 const changed=[0,1,2].some(k=>base.out[i+k]!==improved.out[i+k]);
 if(changed&&winner===3)havenChanged++;if(changed&&winner===2)nearChanged++;if(changed&&winner<0)backgroundChanged++;if(changed&&winner===0)farChanged++;
}
assert.equal(havenChanged,0,'Atmosphere touched the approved platform');assert.equal(nearChanged,0,'Atmosphere touched bonded structures');assert.equal(backgroundChanged,0,'Atmosphere raised the empty background');assert(farChanged>15000,'No material improvement in remote geometry');
const shader=createLastLightEnvironmentShader('');
assert(!shader.includes('smoothstep(220.'),'Screen-based masonry deformation returned');
assert(!shader.includes('uParallax'),'Unbounded asset parallax multiplier returned');
const stats={status:'PASS',offsets,limits:LAST_LIGHT_EXTERIOR,materialReceiverPixels:normals,sourceScatteringPixels:haloFields,havenChanged,nearChanged,backgroundChanged,farChanged,
 farSurfaceMeanLumaDelta:improved.stats.farDeltas.reduce((a,b)=>a+b,0)/improved.stats.farDeltas.length,
 middleSurfaceMeanLumaDelta:improved.stats.middleDeltas.reduce((a,b)=>a+b,0)/improved.stats.middleDeltas.length,
 limitsOfCheck:'CPU reference at time zero; shader compilation, runtime texture orientation, continuous camera movement and live atmospheric phases require browser verification.'};
const output=process.argv.indexOf('--render');
if(output>=0){
 const folder=process.argv[output+1];await fs.mkdir(folder,{recursive:true});
 for(const [name,result]of [['before',compose(worldPoints[0],{old:true})],['after',improved],['walk-left-before',compose(worldPoints[1],{old:true})],['walk-left-after',compose(worldPoints[1])],['core-before',compose(worldPoints[3],{old:true})],['core-after',compose(worldPoints[3])]])await sharp(Buffer.from(result.out),{raw:{width:W,height:H,channels:4}}).png().toFile(path.join(folder,name+'.png'));
 await fs.writeFile(path.join(folder,'checks.json'),JSON.stringify(stats,null,2)+'\n');
}
console.log(JSON.stringify(stats,null,2));
