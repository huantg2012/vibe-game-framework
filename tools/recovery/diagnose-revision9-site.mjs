import {createR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/legacy-r100-v9/executor-recovery.js';
// Reconstruct the unpublished B02/r9 diagnostic recipe; this is not a player-save migration.
const recipe=createR100ProductionRecipe('woven-quarters',20261012,'medium');
const input={algorithm:'r100-native@3.9',native:recipe.nativeDefinition,profile:recipe.profile,space:recipe.space,contentFragmentTypeId:recipe.contentFragmentTypeId,grade:recipe.gradeDefinition,contents:recipe.contentDefinition,spatialPolicy:recipe.spatialPolicy,appearance:recipe.appearance,materials:recipe.package.materials,searchSitePolicy:recipe.searchSitePolicy};
let fingerprint=2166136261;const identityJson=JSON.stringify(input);for(let i=0;i<identityJson.length;i++)fingerprint=Math.imul(fingerprint^identityJson.charCodeAt(i),16777619);
recipe.package.algorithmRevision=9;recipe.package.dependencyHash=(fingerprint>>>0).toString(16).padStart(8,'0');
const map=createR100ProductionMap(recipe);
const out=[];
function distance(p,mesh){let best=Infinity;const a=mesh.positions;for(let i=0;i<(mesh.groundEdgeStart?.triangle??mesh.triangleCount);i++){const vs=[0,1,2].map(j=>{const k=mesh.indices[3*i+j]*3;return{x:a[k],y:a[k+1]}});const signs=vs.map((v,j)=>{const n=vs[(j+1)%3];return(n.x-v.x)*(p.y-v.y)-(n.y-v.y)*(p.x-v.x)});const area=(vs[1].x-vs[0].x)*(vs[2].y-vs[0].y)-(vs[1].y-vs[0].y)*(vs[2].x-vs[0].x);if(Math.abs(area)>1e-7&&(signs.every(n=>n>=0)||signs.every(n=>n<=0)))return 0;for(let j=0;j<3;j++){const v=vs[j],n=vs[(j+1)%3],dx=n.x-v.x,dy=n.y-v.y,t=Math.max(0,Math.min(1,((p.x-v.x)*dx+(p.y-v.y)*dy)/(dx*dx+dy*dy)||0));best=Math.min(best,Math.hypot(v.x+t*dx-p.x,v.y+t*dy-p.y));}}return best;}
for(const site of map.native.searchSites){if(site.sourceDomain!=='formation')continue;const mesh=map.native.meshes.find(m=>m.spec.id===site.sourceObjectId);out.push({site,role:map.native.definition.instances.find(i=>i.id===site.sourceObjectId).role,rotation:mesh.spec.rotation,distance:distance(site.sourceAnchor,mesh),pixelCenterDistance:distance({x:Math.floor(site.sourceAnchor.x)+.5,y:Math.floor(site.sourceAnchor.y)+.5},mesh)});}
console.log(JSON.stringify(out,null,2));
