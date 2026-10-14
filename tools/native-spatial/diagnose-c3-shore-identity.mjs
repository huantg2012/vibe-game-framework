/** Fixed saved c3 only: measure raw/final shore and effective VOID identity. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileR100FragmentShape} from '../../src/generation/world-study/r100-fragment-shape.ts';
import {buildNativeSpatialGeometry,nativePrimitive} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures} from '../../src/generation/world-study/native-spatial-measure.ts';
import {createNativeSpatialPlanningGround} from '../../src/generation/world-study/native-spatial-bay-layout.ts';

const source='docs/qa/artifacts/native-spatial-2026-10-14/initial-c3-field-fallback-round1/proposal.json';
const out=process.argv[2];assert(out&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const paths=['r100-fragment-shape.ts','fragment-shape/rectilinear-fragment.ts','native-spatial-geometry.ts','native-spatial-measure.ts','native-spatial-bay-layout.ts','native-terrain.ts'];
const digest=value=>createHash('sha256').update(value).digest('hex');
const hashes=()=>Object.fromEntries(paths.map(p=>[p,digest(fs.readFileSync('src/generation/world-study/'+p))]));
const {input,proposal,gate}=JSON.parse(fs.readFileSync(source));
const result={scope:'Read-only measurement of the saved c3 proposal. No new placement, random draw, candidate or seed.',source,proposalFileHash:digest(fs.readFileSync(source)),sourceHashes:hashes()};
const start=performance.now(),seed=20261012;
const full=compileR100FragmentShape(proposal.fragmentShape,seed);
assert.deepEqual(full.terrainOutline,proposal.definition.terrainOutline);assert.deepEqual(full.erosion,proposal.definition.erosion);
const landOnlyInput=structuredClone(proposal.fragmentShape);
landOnlyInput.layout.voidRects=proposal.bays.flatMap(b=>b.rects.map(r=>r.map(v=>v/2)));
const landOnly=compileR100FragmentShape(landOnlyInput,seed);
const geometry=buildNativeSpatialGeometry(proposal.definition,seed),groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy);
const {cols,rows,matter}=geometry.terrain,labels=new Int32Array(cols*rows).fill(-1),components=[];
for(let at=0;at<labels.length;at++)if(!matter[at]&&labels[at]<0){
 const label=components.length,cells=[at];labels[at]=label;
 for(let i=0;i<cells.length;i++){const c=cells[i],x=c%cols,y=Math.floor(c/cols);for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*cols+nx;if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&!matter[n]&&labels[n]<0){labels[n]=label;cells.push(n);}}}
 components.push(cells);
}
const exterior=new Set(components.flatMap((cells,i)=>cells.some(c=>c%cols===0||c%cols===cols-1||c<cols||c>=cols*(rows-1))?[i]:[]));
const h=proposal.holes.find(h=>h.holeId==='hole-9');assert(h);
const hLabels=new Set();for(const [x,y,w,height]of h.rects)for(let cy=Math.floor(y/8);cy<Math.ceil((y+height)/8);cy++)for(let cx=Math.floor(x/8);cx<Math.ceil((x+w)/8);cx++){
 const cell=cy*cols+cx,px=cx*8+4,py=cy*8+4;if(px>=x&&px<=x+w&&py>=y&&py<=y+height&&labels[cell]>=0)hLabels.add(labels[cell]);
}
assert.equal(hLabels.size,1);const holeLabel=[...hLabels][0],holeCells=components[holeLabel];
const pairs=[];for(const cell of holeCells){const x=cell%cols,y=Math.floor(cell/cols);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
 const nx=x+dx,ny=y+dy,other=ny*cols+nx;if(nx<0||ny<0||nx>=cols||ny>=rows||!exterior.has(labels[other]))continue;
 const gap=Math.max(Math.max(0,Math.abs(dx)*8-8),Math.max(0,Math.abs(dy)*8-8));if(gap<20)pairs.push({holeCell:cell,exteriorCell:other,holeCenter:{x:x*8+4,y:y*8+4},exteriorCenter:{x:nx*8+4,y:ny*8+4},squareGapPx:gap,centerDistancePx:Math.hypot(dx*8,dy*8)});
}}
pairs.sort((a,b)=>a.squareGapPx-b.squareGapPx||a.centerDistancePx-b.centerDistancePx||a.holeCell-b.holeCell||a.exteriorCell-b.exteriorCell);
const ground=createNativeSpatialPlanningGround(proposal.plan.land,proposal.bays.flatMap(b=>b.rects));
const triangles=h.rects.flatMap(([x,y,w,height])=>[nativePrimitive([x,y,x+w,y,x,y+height],-1),nativePrimitive([x+w,y,x+w,y+height,x,y+height],-1)]);
const vertices=h.rects.flatMap(([x,y,w,height])=>[{x,y},{x:x+w,y},{x:x+w,y:y+height},{x,y:y+height}]);
const vertexMargins=vertices.map(p=>({...p,margin:ground.margin(p)}));
function inside(points,x,y){let value=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)value=!value;}return value;}
function nearestPoint(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return{x:a.x+t*dx,y:a.y+t*dy};}
function contourDistance(a,b){let best={distancePx:Infinity};for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)for(const [p,s,t,from]of [[a[i],b[j],b[(j+1)%b.length],'a'],[b[j],a[i],a[(i+1)%a.length],'b']]){const q=nearestPoint(p,s,t),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<best.distancePx)best={distancePx:d,a:from==='a'?p:q,b:from==='a'?q:p,aSegment:i,bSegment:j};}return best;}
const hContract=gate.metrics.holeProfileMeasurements.find(p=>p.holeId===h.holeId);assert.equal(hContract.contourIndices.length,1);const holeContour=full.erosion[hContract.contourIndices[0]];
const continuousGap=contourDistance(holeContour,full.terrainOutline),landOnlyGap=contourDistance(holeContour,landOnly.terrainOutline);
let differingFloorCells=0,fullOnlyCells=0,landOnlyCells=0;const localDifferences=[];
for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const px=x*8+4,py=y*8+4,a=inside(full.terrainOutline,px,py),b=inside(landOnly.terrainOutline,px,py);if(a!==b){differingFloorCells++;if(a)fullOnlyCells++;else landOnlyCells++;if(px>470&&px<560&&py>740&&py<920)localDifferences.push({x:px,y:py,full:a,landOnly:b});}}
const stripRows=[];for(let y=768;y<=864;y+=8){const cy=Math.floor(y/8),cells=[];for(let x=480;x<544;x+=8){const c=cy*cols+Math.floor(x/8);cells.push({x,y,kind:matter[c]?'land':labels[c]===holeLabel?'H9':exterior.has(labels[c])?'exterior':'otherVoid'});}stripRows.push(cells);}
Object.assign(result,{candidate:proposal.candidate,layoutSeed:proposal.layoutSeed,edgeSeed:proposal.fragmentShape.edgeSeed,
 rawSupport:{supportsWholeTriangles:ground.supportsFootprint(triangles,{x:0,y:0}),minimumVertexMarginPx:Math.min(...vertexMargins.map(p=>p.margin)),vertexMargins,rawWestCoastX:496,rawHoleWestX:520,rawGapPx:24},
 finalIdentity:{rawFourConnectedVoidCount:components.length,holeRawLabel:holeLabel,holeRawAreaPx2:holeCells.length*64,holeRawTouchesExterior:exterior.has(holeLabel),effectiveLabel:groups.holeLabelByCell[holeCells[0]],holeRecognized:groups.structures.some(s=>s.kind==='hole'&&s.cells.includes(holeCells[0])),continuousGap,nearbyExteriorPairsBelow20:pairs.length,closestPairs:pairs.slice(0,12),rasterRows:stripRows,gateHoleContract:hContract},
 shoreComparison:{sameSeed:true,sameLand:true,sameBays:true,removedOnlyH:true,outerEqual:JSON.stringify(full.terrainOutline)===JSON.stringify(landOnly.terrainOutline),fullOuterVertexCount:full.terrainOutline.length,landOnlyOuterVertexCount:landOnly.terrainOutline.length,differingFloorCells,fullOnlyCells,landOnlyCells,landOnlyGapToFullHoleContour:landOnlyGap,localDifferingFloorCells:localDifferences.length,localDifferences,fullOuter:full.terrainOutline,landOnlyOuter:landOnly.terrainOutline},
 elapsedMs:performance.now()-start});
result.sourceHashesAfter=hashes();result.sourcesStable=JSON.stringify(result.sourceHashes)===JSON.stringify(result.sourceHashesAfter);assert(result.sourcesStable);assert(!exterior.has(holeLabel));assert(pairs.length>0);assert.equal(result.rawSupport.minimumVertexMarginPx,24);assert.equal(result.rawSupport.supportsWholeTriangles,true);
fs.writeFileSync(out+'/report.json',JSON.stringify(result,null,2)+'\n');
const poly=points=>points.map(p=>`${p.x},${p.y}`).join(' ');
const squares=stripRows.flat().map(c=>`<rect x="${c.x}" y="${c.y}" width="8" height="8" fill="${c.kind==='land'?'#87977f':c.kind==='H9'?'#152528':'#202023'}" stroke="#535454" stroke-width=".2"/>`).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650" viewBox="464 740 310 166"><rect x="464" y="740" width="310" height="166" fill="#15191b"/>${squares}<polygon points="${poly(full.terrainOutline)}" fill="none" stroke="#ffab76" stroke-width="1"/><polygon points="${poly(landOnly.terrainOutline)}" fill="none" stroke="#88bdff" stroke-width=".8" stroke-dasharray="3 2"/><polygon points="${poly(holeContour)}" fill="none" stroke="#dcd8ba" stroke-width="1"/><line x1="496" x2="496" y1="740" y2="906" stroke="#6ddb9b" stroke-width=".7" stroke-dasharray="2 2"/><line x1="${continuousGap.a.x}" y1="${continuousGap.a.y}" x2="${continuousGap.b.x}" y2="${continuousGap.b.y}" stroke="#ff6c81" stroke-width="1"/><text x="546" y="753" fill="#deded8" font-family="monospace" font-size="5">c3 / H9: raw gap24; final ${continuousGap.distancePx.toFixed(2)}; cell gap${pairs[0].squareGapPx}</text><text x="546" y="760" fill="#deded8" font-family="monospace" font-size="4">Green: raw shore; orange: full; blue: L-B only</text></svg>`;
fs.writeFileSync(out+'/shore-detail.svg',svg);
console.log(JSON.stringify({sourcesStable:result.sourcesStable,rawSupport:result.rawSupport.minimumVertexMarginPx,continuousGap,rawFourConnectedSeparate:!result.finalIdentity.holeRawTouchesExterior,closestPairs:result.finalIdentity.closestPairs.slice(0,2),shoreComparison:{equal:result.shoreComparison.outerEqual,differingFloorCells,landOnlyGap},elapsedMs:result.elapsedMs},null,2));
