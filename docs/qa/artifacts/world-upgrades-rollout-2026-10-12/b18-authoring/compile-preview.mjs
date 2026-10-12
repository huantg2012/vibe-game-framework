// B18 candidate-only authoring preview. Does not register layouts or write generated production data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { generateRectilinearFragment, RECTILINEAR_FRAGMENT_VERSION } from '../../../../../src/generation/world-study/fragment-shape/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const source = path.join(here, 'archive/world-upgrades-b18-rectangles.csv');
const parse = text => { const [header, ...lines] = text.trim().split(/\r?\n/); const keys = header.split(','); return lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [keys[i], v]))); };
const sourceBytes = fs.readFileSync(source);
const rows = parse(sourceBytes.toString());
const plans = parse(fs.readFileSync(path.join(root, 'data/world-upgrades-authoring-plan.csv'), 'utf8')).filter(row => row.batch_id === 'B18');
const corrections = parse(fs.readFileSync(path.join(here, 'archive/world-upgrades-b18-transforms.csv'), 'utf8'));
for (const plan of plans) Object.assign(plan, corrections.find(row => row.world_id === plan.world_id) ?? {});
const native = parse(fs.readFileSync(path.join(root, 'data/rift-native-worlds.csv'), 'utf8'));
const identities = {"scalloped-reach": "scalloped-overhang-loss-v1", "hollow-wreckage": "hollow-downcast-beds-v1", "three-shelves": "three-shelves-broken-angle-v1", "red-vault-fragments": "red-vault-upper-drift-v1", "crossed-casings": "crossed-casings-displaced-coast-v1"};
const seeds = [20261012, 20261019];
const outputName = process.argv[2] ?? 'attempt1';
if (!/^(attempt[12]|root-correction)$/.test(outputName)) throw new Error('Use attempt1 or attempt2; bounded author review.');
const output = path.join(here, outputName);
if (fs.existsSync(output)) throw new Error(`Evidence already exists: ${output}`);
fs.mkdirSync(output, {recursive:true});
const report = { status:'candidate-compiled', source:'docs/qa/artifacts/world-upgrades-rollout-2026-10-12/b18-authoring/archive/world-upgrades-b18-rectangles.csv', sourceHash:createHash('sha256').update(sourceBytes).digest('hex'), algorithm:RECTILINEAR_FRAGMENT_VERSION, authoringFrame:[1152,896], worldScale:2, seeds, cases:[], failures:[], limitations:['Authoring-only compile; no production registration or admission.', 'Native overlays are conservative rotated author dimensions with 16 world px margin, not rendered native meshes.', 'No world body/support/FOV/content/recovery/runtime or human approval is implied.'] };
const insideLoop = (x,y,loop) => { let inside=false; for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside; };
const pointOnLand = (x,y,result) => result.contours.reduce((inside,loop)=>inside !== insideLoop(x,y,loop),false);
const pathLoop = loop => loop.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' ')+' Z';
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="896" viewBox="0 0 1152 896"><rect width="1152" height="896" fill="#000"/>${body}</svg>`;
const writeImage = async (dir,name,body) => { const text=svg(body);fs.writeFileSync(path.join(dir,name+'.svg'),text);await sharp(Buffer.from(text)).png().toFile(path.join(dir,name+'.png')); };

for(const plan of plans){
 const id=identities[plan.world_id];
 if(!id)throw new Error(`Unregistered B18 candidate ${plan.world_id}`);
 const list=kind=>rows.filter(row=>row.layout_id===id&&row.kind===kind).sort((a,b)=>Number(a.ordinal)-Number(b.ordinal)).map(row=>['x','y','width','height'].map(k=>Number(row[k])));
 const layout={authoringFrame:[1152,896],worldScale:2,landRects:list('land'),voidRects:list('void')};
 const nativeRow=native.find(row=>row.world_id===plan.world_id);
 const scale=Number(plan.native_uniform_scale);
 const envelopes=nativeRow.instances.split('|').map((descriptor,i)=>{
  const fields=descriptor.split(':');
  const center=[(Number(plan.native_target_center_x_px)+(Number(fields[2])-Number(plan.native_source_center_x_px))*scale)/2,(Number(plan.native_target_center_y_px)+(Number(fields[3])-Number(plan.native_source_center_y_px))*scale)/2];
  const angle=Number(fields[4])+Number(plan.native_rotation_delta_rad);
  const half=[Number(fields[5])*scale/4+8,Number(fields[6])*scale/4+8];
  const project=(x,y)=>[center[0]+x*Math.cos(angle)-y*Math.sin(angle),center[1]+x*Math.sin(angle)+y*Math.cos(angle)];
  return {index:i,family:fields[0],role:fields[1],center,angle,half,corners:[project(-half[0],-half[1]),project(half[0],-half[1]),project(half[0],half[1]),project(-half[0],half[1])],project};
 });
 for(const edgeSeed of seeds){
  try{
   const result=generateRectilinearFragment({algorithmVersion:RECTILINEAR_FRAGMENT_VERSION,layout,edgeSeed});
   const repeated=generateRectilinearFragment({algorithmVersion:RECTILINEAR_FRAGMENT_VERSION,layout,edgeSeed});
   if(JSON.stringify(result)!==JSON.stringify(repeated))throw new Error('Non-deterministic shared compile');
   const dir=path.join(output,`${plan.world_id}-${edgeSeed}`);fs.mkdirSync(dir);
   const envelopeChecks=envelopes.map(envelope=>{
    const outside=[];let samples=0;
    for(let y=-envelope.half[1];y<=envelope.half[1];y+=4)for(let x=-envelope.half[0];x<=envelope.half[0];x+=4){const p=envelope.project(x,y);samples++;if(!pointOnLand(...p,result))outside.push(p);}
    return {index:envelope.index,family:envelope.family,role:envelope.role,samples,outside:outside.length,firstOutside:outside.slice(0,8)};
   });
   await writeImage(dir,'silhouette',`<path fill="#ececec" fill-rule="evenodd" d="${result.pathD}"/>`);
   await writeImage(dir,'outer-filled',`<path fill="#ececec" d="${result.contours.filter((_,i)=>result.contourKinds[i]==='outer').map(pathLoop).join(' ')}"/>`);
   const overlays=envelopes.map(e=>`<path d="${pathLoop(e.corners)}" fill="${e.role==='solid'?'#b58a5f':'#688b9b'}" fill-opacity=".4" stroke="${e.role==='solid'?'#d8a872':'#7bbfd0'}" stroke-width="2"/><text x="${e.center[0]}" y="${e.center[1]}" fill="#000" font-size="18">${e.index} ${e.role}</text>`).join('');
   await writeImage(dir,'native-envelopes',`<path fill="#ececec" fill-rule="evenodd" d="${result.pathD}"/>${overlays}`);
   fs.writeFileSync(path.join(dir,'geometry.json'),JSON.stringify({worldId:plan.world_id,layoutId:id,layout,result,nativeAuthorTransform:plan,envelopes:envelopes.map(({project,...other})=>other),envelopeChecks},null,2));
   report.cases.push({world:plan.world_id,layoutId:id,edgeSeed,landRectCount:layout.landRects.length,voidRectCount:layout.voidRects.length,stats:result.stats,shapeHash:createHash('sha256').update(JSON.stringify(result.contours)).digest('hex'),envelopeChecks});
  }catch(error){report.failures.push({world:plan.world_id,edgeSeed,error:error.stack??String(error)});}
 }
}
fs.writeFileSync(path.join(output,'rectangles-snapshot.csv'),sourceBytes);
if(report.failures.length)report.status='candidate-compile-failed';
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({world:c.world,seed:c.edgeSeed,holes:c.stats.holeContours,envelopeOutside:c.envelopeChecks.map(x=>x.outside)})),failures:report.failures},null,2));
if(report.failures.length)process.exitCode=1;
