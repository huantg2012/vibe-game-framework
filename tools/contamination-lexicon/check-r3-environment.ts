/** Run with tsx --tsconfig tools/contam-preview/tsconfig.json.
 * Real production attachments and Host live-surface query, lightweight canvas adapters.
 */
import assert from 'node:assert/strict';
import { attachBingD } from '../../src/entities/form-renderers/d/bing';
import { paintYiSkin } from '../../src/entities/form-renderers/d/yi-paint';
import { yiRecipeFromForm,faceNormal } from '../../src/entities/form-renderers/d/yi-recipe';
import { attachYiD } from '../../src/entities/form-renderers/d/yi';
import { attachDingD } from '../../src/entities/form-renderers/d/ding';
import { paintDingFrame } from '../../src/entities/form-renderers/d/ding-paint';
import { dingRecipeFromForm } from '../../src/entities/form-renderers/d/ding-recipe';
import { ContaminationHostSystem } from '../../src/systems/contamination-host-system';
import type { ContaminationForm } from '../../src/generation/contamination-draw';
import type { FormAttachContext,FormVisualPose } from '../../src/entities/form-renderers/form-renderer';
function fixture(){
 const objects=new Set<Draw>(),textures=new Map<string,{w:number;h:number;data:Uint8ClampedArray}>();
 class Draw {
  key='';depth=0;alpha=1;visible=true;x=0;y=0;rects:{x:number;y:number;w:number;h:number}[]=[];
  constructor(){objects.add(this);}setDepth(n:number){this.depth=n;return this;}setOrigin(){return this;}setRotation(){return this;}
  setScale(){return this;}setVisible(v:boolean){this.visible=v;return this;}setAlpha(v:number){this.alpha=v;return this;}
  setPosition(x:number,y:number){this.x=x;this.y=y;return this;}fillStyle(){return this;}clear(){this.rects=[];return this;}
  fillRect(x:number,y:number,w:number,h:number){this.rects.push({x,y,w,h});return this;}destroy(){objects.delete(this);}
 }
 const host=Object.create(ContaminationHostSystem.prototype) as ContaminationHostSystem;
 Object.assign(host,{hosts:[],paintFloors:new Map(),liveMotion:false});
 const scene={hosts:host,add:{image:(_x:number,_y:number,key:string)=>{const o=new Draw();o.key=key;return o;},graphics:()=>new Draw()},textures:{
  exists:(key:string)=>textures.has(key),remove:(key:string)=>textures.delete(key),
  createCanvas(key:string,w:number,h:number){const row={w,h,data:new Uint8ClampedArray(w*h*4)};textures.set(key,row);return{
   setFilter(){},refresh(){},getContext(){return{createImageData(){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(p:{data:Uint8ClampedArray}){row.data=p.data.slice();}};}};
 }},cameras:{main:{midPoint:{x:99999,y:99999}}}};
 return {scene,host,objects,textures};
}
const facings=['down','left','up','right']as const;
let constructions=0,retiredFloors=0;
for(const substrate of ['fungal_mat','oil_film','ash_veil'])for(const coverage of ['infiltrate','rewrite','overwrite']as const){
 const f=fixture();
 const form={substrate,portfolio:'bing',coverage,continuity:'colony',occupancy:'paint',lexemes:{motion:'motion_anchor',sense:'sense_touch',rhythm:'rhythm_open',contact:'contact_step'}}as ContaminationForm;
 const row={id:'sample',kind:'bing',alive:true,gfx:{clear(){},setVisible(){}},form,pin:{floorCol:8,floorRow:8},nuclei:[]as {alive:boolean;floorCol:number;floorRow:number}[]};
 Object.assign(f.host,{hosts:[row]});
 for(let iteration=0;iteration<8;iteration++){
  row.alive=true;
  const v=attachBingD({scene:f.scene as never,form,seed:7,depth:4,subjectId:row.id,pin:{kind:'cluster',x:256,y:256}});
  constructions++;
  assert(v.stepFloors&&v.stepFloors.length>0,`${substrate} exposes its production footprint`);
  const cells=v.stepFloors;
  // Two independent live nuclei: retire one and verify the renderer follows
  // the Host's actual live predicate, including overlap retained by the other.
  let pair=[cells[0]!,cells[cells.length-1]!];let far=-1;
  for(const a of cells)for(const b of cells){const d=Math.max(Math.abs(a.col-b.col),Math.abs(a.row-b.row));if(d>far){pair=[a,b];far=d;}}
  row.nuclei=pair.map(p=>({alive:true,floorCol:p.col,floorRow:p.row}));
  f.host.setStepFloors('sample',cells);
  const before=cells.filter(p=>f.host.isPaintFloorActive('sample',p.col,p.row));
  const pose:FormVisualPose={x:256,y:256,facing4:'down',moving:false,visibility:1,signal:'idle',deltaMs:16,activity:{phase:'active',progress:1}};
  v.update(pose);assert.equal(f.textures.size,1);
  row.nuclei[0]!.alive=false;v.update(pose);
  const removed=before.filter(p=>!f.host.isPaintFloorActive('sample',p.col,p.row));retiredFloors+=removed.length;
  assert(removed.length>0,'test fixture actually retires visible danger');
  const tex=[...f.textures.values()][0]!;
  const wash=[...f.objects].find(o=>Math.abs(o.depth-3.99)<.001)!;
  assert(wash.rects.every(r=>r.w<=3&&r.h<=3),'no whole-tile highlight rectangles');
  for(const r of wash.rects)assert(f.host.isPaintFloorActive('sample',Math.floor(r.x/32),Math.floor(r.y/32)),'deposition never indicates a dead danger tile');
  let retiredPixels=0;
  for(let y=0;y<tex.h;y++)for(let x=0;x<tex.w;x++){
   const alpha=tex.data[(y*tex.w+x)*4+3]!;if(!alpha)continue;
   const col=Math.floor((256-tex.w/2+x)/32),r=Math.floor((256-tex.h/2+y)/32);
   if(removed.some(p=>p.col===col&&p.row===r)){assert.equal(alpha,100,'retired area is a quiet remnant, not active anatomy');retiredPixels++;}
  }
  assert(retiredPixels>0,'retired surface remains visually inspectable');
  f.host.setStepFloors('sample',[]);v.update(pose);assert.equal(wash.rects.length,0,'empty authoritative surface has no active wash');
  v.update({...pose,visibility:0});assert([...f.objects].every(o=>!o.visible),'fog hides body and footprint together');
  v.destroy();assert.equal(f.textures.size,0);assert.equal(f.objects.size,0,'paint restart releases image, footprint and texture');
 }
}
for(const substrate of ['doorframe','wall_rust','sound_echo','light_scatter','space_interval']){
 const f=fixture(),wall=substrate==='doorframe'||substrate==='wall_rust';
 const form={substrate,portfolio:wall?'yi':'ding',coverage:'rewrite',continuity:'monolith',occupancy:wall?'wall':'volume',lexemes:{motion:'motion_anchor',sense:'sense_touch',rhythm:'rhythm_open',contact:wall?'contact_melee':'contact_step'}}as ContaminationForm;
 for(let iteration=0;iteration<8;iteration++){
  const ctx={scene:f.scene as never,form,seed:7,depth:4,pin:{kind:wall?'wall':'volume',x:256,y:256,width:96,height:64}}as FormAttachContext;
  const v=wall?attachYiD(ctx):attachDingD(ctx);constructions++;
  for(const facing4 of facings)for(const phase of ['idle','windup','strike','recover']as const)for(let k=0;k<16;k++)
   v.update({x:256,y:256,facing4,moving:false,visibility:1,signal:'idle',deltaMs:16,attack:{phase,progress:k/15},activity:{phase:k<4?'rest':k<8?'waking':'active',progress:k/15}});
  assert.equal(f.textures.size,wall?0:1,'facing changes update the existing surface without accumulating textures');
  v.destroy();assert.equal(f.textures.size,0);assert.equal(f.objects.size,0,'wall/volume shutdown releases every drawing object');
 }
}
// Identical models coexist in independent inspector cells. Deleting one cell
// must neither replace the other's texture nor delete it during teardown.
for(const substrate of ['fungal_mat','oil_film','ash_veil']) {
 const f=fixture();
 const form={substrate,portfolio:'bing',coverage:'rewrite',continuity:'colony',occupancy:'paint',lexemes:{motion:'motion_anchor',sense:'sense_touch',rhythm:'rhythm_open',contact:'contact_step'}} as ContaminationForm;
 const make=(textureNamespace:string)=>attachBingD({scene:f.scene as never,form,seed:77,depth:4,textureNamespace,pin:{kind:'cluster',x:256,y:256}});
 const a=make('gallery_a'),b=make('gallery_b');
 assert.equal(f.textures.size,2,`${substrate}: same-seed namespace cells must not replace each other`);
 const keys=[...f.textures.keys()];
 assert(keys.some(key=>key.startsWith('gallery_a_'))&&keys.some(key=>key.startsWith('gallery_b_')),'each runtime texture includes its own namespace');
 a.destroy();assert.equal(f.textures.size,1);assert([...f.textures.keys()][0]!.startsWith('gallery_b_'),'cell A teardown must leave cell B alive');
 b.update({x:256,y:256,facing4:'down',moving:false,visibility:1,signal:'idle',deltaMs:16});
 b.destroy();assert.equal(f.textures.size,0);assert.equal(f.objects.size,0);
}
// A world-bound paint body must clip walls/void while isolated preview stays
// complete. Both initial upload and animated growth use the same floor query.
for(const substrate of ['fungal_mat','oil_film','ash_veil'])for(const coverage of ['infiltrate','rewrite','overwrite'] as const) {
 const f=fixture();
 const form={substrate,portfolio:'bing',coverage,continuity:'colony',occupancy:'paint',lexemes:{motion:'motion_anchor',sense:'sense_touch',rhythm:'rhythm_open',contact:'contact_step'}} as ContaminationForm;
 const legal=(col:number,row:number)=>col<8&&row>=8;
 const whole=attachBingD({scene:f.scene as never,form,seed:7,depth:4,textureNamespace:'whole',pin:{kind:'cluster',x:256,y:256}});
 const clipped=attachBingD({scene:f.scene as never,form,seed:7,depth:4,textureNamespace:'world',pin:{kind:'cluster',x:256,y:256},isWalkableFloor:legal});
 const fullCells=whole.stepFloors!,cells=clipped.stepFloors!;
 assert(fullCells.some(p=>!legal(p.col,p.row)),'unconstrained preview retains the whole model');
 assert(cells.length>0&&cells.length<fullCells.length,'world fixture genuinely clips the body');
 assert(cells.every(p=>legal(p.col,p.row)),'wall/void tiles cannot enter the registered damage footprint');
 let clippedPixels=0,legalPixels=0;
 const checkPixels=()=>{
  const tex=[...f.textures.entries()].find(([key])=>key.startsWith('world_'))![1];
  for(let y=0;y<tex.h;y++)for(let x=0;x<tex.w;x++){
   const alpha=tex.data[(y*tex.w+x)*4+3]!;
   if(!legal(Math.floor((256-tex.w*.5+x+.5)/32),Math.floor((256-tex.h*.5+y+.5)/32))){assert.equal(alpha,0,'wall/void paint pixels are fully clipped');clippedPixels++;}
   else if(alpha)legalPixels++;
  }
 };
 checkPixels();
 for(let i=0;i<24;i++){clipped.update({x:256,y:256,facing4:'down',moving:false,visibility:1,signal:i%2?'inflated':'idle',deltaMs:100});checkPixels();}
 assert(clippedPixels>0&&legalPixels>0,'clipping does not hide all legal model anatomy');
 // Real Host registration must choose colony nuclei from this filtered set,
 // never its former default 3x3 seating across the forbidden half-plane.
 const hostRow={id:'clip',kind:'bing',alive:true,gfx:{clear(){},setVisible(){}},form,core:{x:256,y:256},pin:{floorCol:8,floorRow:8},nuclei:[{alive:true,floorCol:8,floorRow:7,core:{x:272,y:240}}]};
 Object.assign(f.host,{hosts:[hostRow],liveMotion:true,walkableFloors:new Set(cells.map(p=>`${p.col},${p.row}`))});
 f.host.setStepFloors('clip',cells);
 assert(hostRow.nuclei.length>0&&hostRow.nuclei.every(n=>legal(n.floorCol,n.floorRow)),'all surviving nuclei stand on a legal registered tile');
 clipped.update({x:912,y:144,facing4:'down',moving:false,visibility:1,signal:'inflated',deltaMs:16});
 const image=[...f.objects].find(o=>o.key.startsWith('world_'))!;
 assert.deepEqual({x:image.x,y:image.y},{x:256,y:256},'re-seated host core cannot move the fixed paint surface off its registered footprint');
 checkPixels();
 whole.destroy();clipped.destroy();assert.equal(f.objects.size,0);assert.equal(f.textures.size,0);
}
// Retained historical wall attacks expose a one-frame strike (R4 wall is not production). The visual tail must
// recover continuously while real windup/tile warning timing remains untouched.
for(const substrate of ['doorframe','wall_rust'])for(const facing4 of facings) {
 const f=fixture(),form={substrate,portfolio:'yi',coverage:'rewrite',continuity:'monolith',occupancy:'wall',lexemes:{motion:'motion_anchor',sense:'sense_narrow',rhythm:'rhythm_open',contact:'contact_melee'}}as ContaminationForm;
 const ctx={scene:f.scene as never,form,seed:7,depth:4,pin:{kind:'wall',x:256,y:256}}as FormAttachContext;
 const {nx,ny}=faceNormal(facing4);
 let visual=attachYiD(ctx);
 const update=(phase:'idle'|'windup'|'strike',ms:number)=>{
  visual.update({x:256,y:256,facing4,moving:false,visibility:1,signal:'idle',deltaMs:ms,attack:{phase,progress:.6},activity:{phase:'active',progress:1}});
  const skin=[...f.objects].find(o=>o.depth===4)!;
  return Math.max(...skin.rects.map(r=>r.x*nx+r.y*ny));
 };
 const idle=update('idle',0);
 for(let k=0;k<24;k++)assert(update('idle',100)<=idle+1,'untriggered ambient clock never invents an attack');
 const strike=update('strike',16);assert(strike>idle+4,'actual strike extends the body');
 const early=update('idle',35),middle=update('idle',35),late=update('idle',90);
 assert(early>middle&&middle>late&&early<strike,'one-frame strike gets a multi-frame decreasing recoil');
 assert(late<=idle+1&&strike<32,'tail finishes at normal pose and stays within adjacent tile');
 update('strike',16);update('windup',16);
 const ticks=[...f.objects].find(o=>o.depth===.2)!;
 assert(ticks.visible&&ticks.rects.length>0,'next authoritative windup telegraph appears immediately during recoil');
 visual.destroy();visual=attachYiD(ctx);assert.equal(update('idle',0),idle,'new wall visual has no residual recoil');visual.destroy();
 assert.equal(f.objects.size,0);assert.equal(f.textures.size,0);
}
// An opaque wall removes normal<0 pixels. Most visible anatomy must survive
// that real occlusion without raising render depth above fog or shifting cores.
for(const substrate of ['doorframe','wall_rust'])for(const coverage of ['infiltrate','rewrite','overwrite']as const)
for(const facing4 of facings)for(const phase of ['idle','windup','strike','recover']as const) {
 const form={substrate,portfolio:'yi',coverage,continuity:'monolith',occupancy:'wall',lexemes:{motion:'motion_anchor',sense:'sense_narrow',rhythm:'rhythm_open',contact:'contact_melee'}}as ContaminationForm;
 const pixels=new Map<string,{x:number;y:number;ink:number}>();let ink=0;
 const graphics={clear(){pixels.clear();},fillStyle(c:number){ink=c;},fillRect(x:number,y:number,w:number,h:number){for(let j=0;j<h;j++)for(let i=0;i<w;i++)pixels.set(`${x+i},${y+j}`,{x:x+i,y:y+j,ink});}};
 const {nx,ny}=faceNormal(facing4);
 paintYiSkin(graphics as never,yiRecipeFromForm(form,7),{x:0,y:0,facing4,moving:false,visibility:1,signal:'idle',deltaMs:16,attack:{phase,progress:.8},activity:{phase:'active',progress:1}},500,nx,ny);
 const body=[...pixels.values()],visible=body.filter(p=>p.x*nx+p.y*ny>=0);
 assert(visible.length/body.length>.9,'wall occlusion must leave over 90% of the projected anatomy visible');
 assert(visible.every(p=>p.x*nx+p.y*ny<32),'attack projection stays within the adjacent floor depth');
 const core=body.filter(p=>p.ink===0x47ac8d||p.ink===0x93d7b8);
 assert(core.length>=6&&core.every(p=>p.x*nx+p.y*ny>=0&&p.x*nx+p.y*ny<=2),'bright hittable core remains at the original seam');
}
// Boundary contract: paint must remain in the host box without tracing it
// as four ruler edges. Sample several seeds, tiers and animation positions.
for(const substrate of ['sound_echo','light_scatter','space_interval'])
for(const coverage of ['infiltrate','rewrite','overwrite'] as const)
for(const seed of [0,7,31,101])for(let time=0;time<2400;time+=400) {
 const form={substrate,portfolio:'ding',coverage,continuity:'monolith',occupancy:'volume',lexemes:{motion:'motion_anchor',sense:'sense_reverse',rhythm:'rhythm_open',contact:'contact_step'}} as ContaminationForm;
 const recipe=dingRecipeFromForm(form,{form,seed} as FormAttachContext),pixels=new Uint8ClampedArray(160*160*4);
 paintDingFrame(pixels,160,160,recipe,{x:0,y:0,facing4:'down',moving:false,visibility:1,signal:'awake',deltaMs:16,activity:{phase:'active',progress:1}},time,{cx:80,cy:80,rx:56,ry:40,breath:1,morphMs:time});
 const edges=[0,0,0,0];
 for(let y=0;y<160;y++)for(let x=0;x<160;x++) {
  const a=pixels[(y*160+x)*4+3]!;
  if(x<24||x>135||y<40||y>119)assert.equal(a,0,'volume draw cannot expand the billed host AABB');
  if(a<80)continue;
  if(x===24)edges[0]!++;if(x===135)edges[1]!++;if(y===40)edges[2]!++;if(y===119)edges[3]!++;
 }
 assert(edges[0]!/80<.2&&edges[1]!/80<.2&&edges[2]!/112<.2&&edges[3]!/112<.2,'no strongly traceable rectangular perimeter');
}
console.log(JSON.stringify({constructions,retiredFloors,wallDirections:4,renderFramesPerWall:256,textureLeaks:0}));
console.log('check-r3-environment OK');
