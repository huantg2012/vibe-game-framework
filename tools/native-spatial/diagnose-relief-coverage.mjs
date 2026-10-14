import fs from 'node:fs';
import {buildNativeSpatialGeometry,nativeSolidPrimitives,nativePrimitiveTree,nativePrimitiveDistance,nativeCellPoint} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures} from '../../src/generation/world-study/native-spatial-measure.ts';
import {nativeSpatialCountPairs} from '../../src/generation/world-study/native-spatial-layout.ts';
const source=process.argv[2],out=process.argv[3];if(!source||!out||fs.existsSync(out))throw Error('source + newreport required');
const {proposal,input}=JSON.parse(fs.readFileSync(source,'utf8')),g=buildNativeSpatialGeometry(proposal.definition,20261012),groups=identifyNativeSpatialStructures(g,proposal.assemblies,input.policy),coverage=nativePrimitiveTree(groups.structures.flatMap(s=>s.boundary));
const all=nativeSolidPrimitives(g.terrain,true),rows=[];
for(const assembly of input.assemblies){const body=all.filter(p=>assembly.sourceInstanceIds.includes(p.objectId)),relief=all.filter(p=>assembly.attachedReliefIds.includes(p.objectId)),bt=nativePrimitiveTree(body),rt=nativePrimitiveTree(relief);let groundArea=0,padded24Area=0,padded72Area=0,worst={distance:0};
 for(let cell=0;cell<g.supported.length;cell++)if(g.supported[cell]){const p=nativeCellPoint(cell,g.terrain.cols),d=nativePrimitiveDistance(rt,p.x,p.y);groundArea+=d===0?64:0;padded24Area+=d<24?64:0;padded72Area+=d<72?64:0;if(d===0){const ds=nativePrimitiveDistance(coverage,p.x,p.y);if(ds>worst.distance)worst={...p,distance:ds};}}
 rows.push({id:assembly.id,solidBounds:bt,reliefBounds:{minX:rt.minX,minY:rt.minY,maxX:rt.maxX,maxY:rt.maxY},reliefGroundArea:groundArea,relief24PadArea:padded24Area,relief72PadArea:padded72Area,worst});delete rows.at(-1).solidBounds.items;delete rows.at(-1).solidBounds.left;delete rows.at(-1).solidBounds.right;
}
let unionInside=0,union24=0,union72=0;const allRelief=nativePrimitiveTree(all.filter(p=>proposal.definition.instances.find(i=>i.id===p.objectId)?.role==='relief'));
for(let cell=0;cell<g.supported.length;cell++)if(g.supported[cell]){const p=nativeCellPoint(cell,g.terrain.cols),d=nativePrimitiveDistance(allRelief,p.x,p.y);unionInside+=d===0?64:0;union24+=d<24?64:0;union72+=d<72?64:0;}
const report={source,walkArea:g.supportedCount*64,countPairs:nativeSpatialCountPairs(input),rows,unionInside,union24,union72};fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(report);
