/** Independent pre-optimization oracle for the native BVH's exact distance arithmetic. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance} from '../../src/generation/world-study/native-spatial-geometry.ts';

const output=process.argv[2];assert(output,'Usage: check-distance-equivalence.mjs NEW_REPORT.json');assert(!fs.existsSync(output),'Preserve earlier evidence');
// Verbatim arithmetic and traversal from the implementation before optimization.
function oldSegmentDistanceSq(x,y,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,size=dx*dx+dy*dy;const t=size===0?0:Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/size));return(x-ax-t*dx)**2+(y-ay-t*dy)**2;}
function oldDistanceSq(x,y,p){const a=p.points;if(a.length===4)return oldSegmentDistanceSq(x,y,a[0],a[1],a[2],a[3]);const cross=(i,j)=>(a[j]-a[i])*(y-a[i+1])-(a[j+1]-a[i+1])*(x-a[i]);const e0=cross(0,2),e1=cross(2,4),e2=cross(4,0);if((e0>=0&&e1>=0&&e2>=0)||(e0<=0&&e1<=0&&e2<=0))return 0;return Math.min(oldSegmentDistanceSq(x,y,a[0],a[1],a[2],a[3]),oldSegmentDistanceSq(x,y,a[2],a[3],a[4],a[5]),oldSegmentDistanceSq(x,y,a[4],a[5],a[0],a[1]));}
function oldBoundsDistanceSq(x,y,p){return Math.max(p.minX-x,0,x-p.maxX)**2+Math.max(p.minY-y,0,y-p.maxY)**2;}
function oldPrimitiveDistance(root,x,y){let best=Infinity;function visit(node){if(oldBoundsDistanceSq(x,y,node)>=best)return;if(node.items){for(const item of node.items)best=Math.min(best,oldDistanceSq(x,y,item));return;}const left=node.left,right=node.right;if(oldBoundsDistanceSq(x,y,left)<=oldBoundsDistanceSq(x,y,right)){visit(left);visit(right);}else{visit(right);visit(left);}}visit(root);return Math.sqrt(best);}

let seed=0x615bcd;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
const point=()=>next()*2400-400;
const primitives=Array.from({length:384},(_,i)=>{const x=point(),y=point();return nativePrimitive(i%3===0?[x,y,x+(next()-.5)*300,y+(next()-.5)*300]:[x,y,x+(next()-.5)*400,y+(next()-.5)*400,x+(next()-.5)*400,y+(next()-.5)*400],i);});
const tree=nativePrimitiveTree(primitives),empty=nativePrimitiveTree([]),probes=Array.from({length:20000},()=>[point(),point()]);
for(const p of primitives)for(let i=0;i<p.points.length;i+=2)probes.push([p.points[i],p.points[i+1]]);
let checked=0;for(const [x,y]of probes){assert.equal(nativePrimitiveDistance(tree,x,y),oldPrimitiveDistance(tree,x,y),`Exact distance drift at ${x}/${y}`);checked++;}
assert.equal(nativePrimitiveDistance(empty,0,0),Infinity);
const source='src/generation/world-study/native-spatial-geometry.ts',report={status:'passed',createdAt:new Date().toISOString(),checked,randomProbes:20000,primitives:primitives.length,sourceHash:createHash('sha256').update(fs.readFileSync(source)).digest('hex'),scope:'Bit-exact distance and traversal equivalence, including primitive vertices and empty trees; not gameplay or browser performance.'};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
