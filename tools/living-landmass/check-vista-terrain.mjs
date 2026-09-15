import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
// Execute the actual source through Vite so ?raw remains the real CSV loader.
// This is an offline geometry/support check; no HTTP or HMR listener is needed.
const root = fileURLToPath(new URL('../../', import.meta.url));
const server = await createServer({ root, configFile: false,
  resolve: { alias: { '@': path.join(root, 'src') } },
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const { LandmassVistaModel } = await server.ssrLoadModule('/src/dev/living-landmass-stage/vista-model.ts');
  const { bodyHasSupport, bodyDisplacementFraction } = await server.ssrLoadModule('/src/systems/ai/physical-grid.ts');
  const model = new LandmassVistaModel();
  model.group.updateMatrixWorld(true);
  const snapshot = model.snapshot();
  const inside = (x, y, poly) => { let result = false; for (let i=0,j=poly.length-1;i<poly.length;j=i++) { const a=poly[i],b=poly[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)result=!result;}return result; };
  const position = model.surface.geometry.getAttribute('position');
  let maxSlope = 0, surfaceArea = 0;
  for(let i=0;i<position.count;i+=3) {
    const a=new THREE.Vector3().fromBufferAttribute(position,i),b=new THREE.Vector3().fromBufferAttribute(position,i+1),c=new THREE.Vector3().fromBufferAttribute(position,i+2);
    const n=b.sub(a).cross(c.sub(a));
    assert(n.y>0, `reversed/degenerate surface triangle ${i}`);
    surfaceArea += n.y * .5;
    maxSlope=Math.max(maxSlope,Math.hypot(n.x,n.z)/n.y);
  }
  assert(maxSlope < .6, `steep slope ${maxSlope}`);
  const polygonArea = polygon => Math.abs(polygon.reduce((sum,p,i) => {
    const q = polygon[(i+1)%polygon.length]; return sum+p.x*q.y-q.x*p.y;
  },0)) * .5;
  const expectedArea = polygonArea(snapshot.outline) - snapshot.holes.reduce((area,hole)=>area+polygonArea(hole),0);
  assert(Math.abs(surfaceArea-expectedArea)<1, 'triangulated top area must equal authored polygon minus air holes');
  // Perimeter checks are independent from interior walking rays: a bad rim
  // sample must never become a plausible-looking long hanging triangle.
  const cliff = model.group.getObjectByName('worn-lips-fractured-faces-and-tapering-bases');
  assert(cliff?.isMesh, 'actual rendered cliff mesh exists');
  const cliffPosition = cliff.geometry.getAttribute('position'), cliffIndex = cliff.geometry.getIndex();
  const actualTopVertices = new Map();
  for(let i=0;i<position.count;i++) actualTopVertices.set(`${position.getX(i)}:${position.getZ(i)}`,position.getY(i));
  let maxRimError=0,maxRimSamplerError=0,minCliffThickness=Infinity,maxCliffThickness=0;
  for(let i=0;i<cliffPosition.count;i+=5) {
    const x=cliffPosition.getX(i), y=cliffPosition.getZ(i), z=cliffPosition.getY(i);
    const top=actualTopVertices.get(`${x}:${y}`);
    assert(top!==undefined, `cliff rim is not bound to actual top vertex ${x},${y}`);
    maxRimError=Math.max(maxRimError,Math.abs(z-top));
    maxRimSamplerError=Math.max(maxRimSamplerError,Math.abs(z-model.groundHeightAt(x,y)));
    assert(Math.abs(z-top)<1e-6, `cliff rim height mismatch ${x},${y}`);
    assert(Math.abs(z-model.groundHeightAt(x,y))<.001, `public height query loses rim support ${x},${y}`);
    const thickness=z-cliffPosition.getY(i+4);
    minCliffThickness=Math.min(minCliffThickness,thickness);maxCliffThickness=Math.max(maxCliffThickness,thickness);
    assert(thickness>65&&thickness<245, `invalid cliff thickness ${thickness}`);
    for(let row=1;row<5;row++) assert(cliffPosition.getY(i+row)<cliffPosition.getY(i+row-1), 'cliff column folds upward');
  }
  const sideEdges=new Map();
  for(let i=0;i<cliffIndex.count;i+=3)for(let edge=0;edge<3;edge++) {
    const a=cliffIndex.getX(i+edge),b=cliffIndex.getX(i+(edge+1)%3);
    assert(a>=0&&a<cliffPosition.count&&b>=0&&b<cliffPosition.count,'cliff index out of range');
    const key=a<b?`${a}:${b}`:`${b}:${a}`;sideEdges.set(key,(sideEdges.get(key)??0)+1);
  }
  for(const [edge,count] of sideEdges) {
    const [a,b]=edge.split(':').map(Number);
    assert(count===2 || count===1&&a%5===b%5&&(a%5===0||a%5===4),`open internal cliff seam ${edge}`);
  }
  for (const footprint of snapshot.obstacles) for (const p of footprint) {
    assert(model.contains(p.x,p.y), `rock footprint lacks real terrain at ${p.x},${p.y}`);
  }
  assert(bodyHasSupport(model.walk, model.spawn, 10, 10), 'spawn full body');
  let supported=0,sweeps=0,samples=0,maxError=0;
  const ray = new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  for(let y=20;y<model.height-20;y+=12)for(let x=20;x<model.width-20;x+=12) {
    if(!bodyHasSupport(model.walk,{x,y},10,10))continue;
    supported++;
    for(const dx of [-10,0,10])for(const dy of [-10,0,10]) {
      assert(inside(x+dx,y+dy,snapshot.outline),`body outside ${x},${y}`);
      assert(snapshot.holes.every(poly=>!inside(x+dx,y+dy,poly)), `body over air hole ${x},${y}`);
      assert(snapshot.obstacles.every(p=>!inside(x+dx,y+dy,p)),`body overlaps stone ${x},${y}`);
    }
    if(supported%24===0) {
      ray.ray.origin.set(x,500,y);
      const hit=ray.intersectObject(model.surface,false)[0];
      assert(hit, `mesh support missing ${x},${y}`);
      const error=Math.abs(hit.point.y-model.groundHeightAt(x,y));
      maxError=Math.max(maxError,error);assert(error<1e-4,`actual ray height mismatch ${error}`);samples++;
    }
    if(supported%60===0)for(let angle=0;angle<16;angle++) {
      const dx=Math.cos(angle*Math.PI/8)*900,dy=Math.sin(angle*Math.PI/8)*900;
      const f=bodyDisplacementFraction(model.walk,{x,y},10,10,dx,dy);
      assert(bodyHasSupport(model.walk,{x:x+dx*f,y:y+dy*f},10,10),`sweep ends unsupported ${x},${y}`);sweeps++;
    }
  }
  assert(supported>5000); assert(samples>200);
  // Routes are authored normal-keyboard waypoints, not teleport targets.
  // Every connecting line must admit the complete real body without a slide.
  const routeNodes = new Map(snapshot.routeNodes.map(node => [node.id, node]));
  assert.equal(snapshot.regionCount, 5);
  assert.equal(snapshot.connectors.length, 6);
  assert.equal(snapshot.holes.length, 2);
  const routeSegments = [];
  let maxRouteSlope = 0;
  // The ordinary route and a full body-width band retain gentle footing,
  // independently of the steeper exposed flank that is allowed off-route.
  const triangleSlopeAt = (x, y) => {
    ray.ray.origin.set(x,500,y);
    const hit = ray.intersectObject(model.surface,false)[0];
    assert(hit?.face, `route slope ray lacks surface ${x},${y}`);
    return Math.hypot(hit.face.normal.x, hit.face.normal.z) / hit.face.normal.y;
  };
  for (const connection of snapshot.connectors) for (let i = 1; i < connection.nodes.length; i++) {
    const a = routeNodes.get(connection.nodes[i-1]), b = routeNodes.get(connection.nodes[i]);
    assert(a && b, `missing route node ${connection.id}`);
    assert(bodyHasSupport(model.walk, a, 10, 10), `route body unsupported ${a.id}`);
    assert(bodyHasSupport(model.walk, b, 10, 10), `route body unsupported ${b.id}`);
    const fraction = bodyDisplacementFraction(model.walk, a, 10, 10, b.x-a.x, b.y-a.y);
    assert.equal(fraction, 1, `route direct line obstructed ${a.id} -> ${b.id}: ${fraction}`);
    const distance = Math.hypot(b.x-a.x,b.y-a.y), dx=(b.x-a.x)/distance,dy=(b.y-a.y)/distance;
    for(let travelled=0;travelled<=distance;travelled+=12)for(const side of [-10,0,10]) {
      const slope = triangleSlopeAt(a.x+dx*travelled-dy*side,a.y+dy*travelled+dx*side);
      maxRouteSlope=Math.max(maxRouteSlope,slope);
      assert(slope<.3, `route band too steep ${a.id}->${b.id}: ${slope}`);
    }
    routeSegments.push({ connection: connection.id, from: a.id, to: b.id, distance: Math.hypot(b.x-a.x,b.y-a.y) });
  }
  assert.equal(snapshot.recommendedRoute[0], 'spawn');
  assert.equal(snapshot.recommendedRoute.at(-1), 'spawn');
  for (const connection of snapshot.connectors) {
    const path = snapshot.recommendedRoute.join('|');
    assert(path.includes(connection.nodes.join('|')) || path.includes([...connection.nodes].reverse().join('|')),
      `recommended route omits ${connection.id}`);
  }
  const airChecks = snapshot.holes.map((hole, index) => {
    const center = hole.reduce((a,p) => ({x:a.x+p.x/hole.length,y:a.y+p.y/hole.length}), {x:0,y:0});
    assert(!model.walk.isWalkableAt(center.x,center.y), `air hole ${index} grants walking`);
    ray.ray.origin.set(center.x,500,center.y);
    assert.equal(ray.intersectObject(model.surface,false).length, 0, `air hole ${index} has a false top`);
    return { index, center, noWalk: true, noSurface: true };
  });
  const blockedProbes = snapshot.qaChecks.map(probe => {
    const node = routeNodes.get(probe.node);
    assert(node && bodyHasSupport(model.walk,node,10,10), `unsafe probe ${probe.id}`);
    const fraction = bodyDisplacementFraction(model.walk,node,10,10,probe.dx,probe.dy);
    assert(fraction>0 && fraction<1, `probe does not approach then block ${probe.id}: ${fraction}`);
    const stop = { x: node.x + probe.dx*fraction, y: node.y + probe.dy*fraction };
    assert(bodyHasSupport(model.walk,stop,10,10), `unsupported probe end ${probe.id}`);
    return { ...probe, start: {x:node.x,y:node.y}, stop, fraction };
  });
  const fresh=JSON.stringify(model.snapshot());snapshot.outline[0].x=99999;snapshot.obstacles[0][0].x=99999;assert.equal(JSON.stringify(model.snapshot()),fresh);
  const materialRoles = new Map();
  model.group.traverse(object => { if (object.isMesh) materialRoles.set(object.material.name, object.material); });
  const groundMaterial = materialRoles.get('vista-ground-r6'), rockMaterial = materialRoles.get('vista-rock-r6'), cliffMaterial = materialRoles.get('vista-cliff-r6');
  assert(groundMaterial && rockMaterial && cliffMaterial, 'three distinct physical material roles');
  assert.equal(cliffMaterial.map, null, 'cliff must not inherit ground coverage image');
  const strataWeights = model.surface.geometry.getAttribute('vistaStrata');
  assert.equal(strataWeights.count, position.count, 'material masks bind to actual terrain vertices');
  const bedding = model.surface.geometry.getAttribute('vistaBedding');
  let maxBeddingUvGradient = 0;
  for(let i=0;i<position.count;i+=3)for(let corner=0;corner<3;corner++) {
    const a=i+corner,b=i+(corner+1)%3;
    const worldDistance=Math.hypot(position.getX(a)-position.getX(b),position.getZ(a)-position.getZ(b));
    const uvDistance=Math.hypot(bedding.getX(a)-bedding.getX(b),bedding.getY(a)-bedding.getY(b));
    const gradient=uvDistance/worldDistance;maxBeddingUvGradient=Math.max(maxBeddingUvGradient,gradient);
    assert(gradient<1/600, `hard-shell UV folds across geological chart boundary: ${gradient}`);
  }
  const maskExtents = [[1,0],[1,0],[1,0]];
  for (let i=0;i<strataWeights.count;i++) for(let channel=0;channel<3;channel++) {
    const value = strataWeights.array[i*3+channel];
    assert(value>=0 && value<=1, 'finite normalized deposition/exposure/fracture');
    maskExtents[channel][0]=Math.min(maskExtents[channel][0],value);
    maskExtents[channel][1]=Math.max(maskExtents[channel][1],value);
  }
  assert(maskExtents[0][1]>.7 && maskExtents[1][1]>.7 && maskExtents[2][1]>.6,'actual mesh contains exposed bodies, deposits and concentrated fractures');
  assert.equal(snapshot.landmarks.filter(rock=>rock.id.startsWith('crown')).length,0,'crown is an intact destination face without paired stones');
  const rockTexture = new THREE.Texture(); let rockDisposals=0;
  rockTexture.addEventListener('dispose',()=>rockDisposals++);
  model.setRockTexture(rockTexture); model.setRockTexture(rockTexture);
  assert.equal(rockDisposals,0); assert.equal(rockMaterial.map,rockTexture);
  assert.notEqual(groundMaterial.map,rockTexture);
  const texture=new THREE.Texture();let disposals=0;texture.addEventListener('dispose',()=>disposals++);
  model.setSurfaceTexture(texture);model.setSurfaceTexture(texture);assert.equal(disposals,0);
  assert.equal(rockMaterial.map,rockTexture); assert.equal(cliffMaterial.map,null);
  model.destroy();model.destroy();assert.equal(disposals,1);assert.equal(rockDisposals,1);
  const lateTexture = new THREE.Texture();let lateDisposals=0;lateTexture.addEventListener('dispose',()=>lateDisposals++);
  model.setRockTexture(lateTexture); assert.equal(lateDisposals,1);
  const sources = [
    'src/dev/living-landmass-stage/vista-model.ts',
    'src/dev/living-landmass-stage/vista-terrain.ts',
    'src/dev/living-landmass-stage/vista-boundary.ts',
    'src/dev/living-landmass-stage/vista-cliff.ts',
    'src/dev/living-landmass-stage/vista-rocks.ts',
    'src/dev/living-landmass-stage/vista-strata.ts',
    'src/dev/living-landmass-stage/vista-sections.ts',
    'data/living-landmass-vista-sections.csv',
    'src/dev/living-landmass-stage/vista-material.ts',
    'data/living-landmass-vista-strata.csv',
    'data/living-landmass-vista-outline.csv',
    'data/living-landmass-vista-rocks.csv',
    'data/living-landmass-vista-holes.csv',
    'data/living-landmass-vista-regions.csv',
    'data/living-landmass-vista-route-nodes.csv',
    'data/living-landmass-vista-connectors.csv',
    'src/systems/ai/physical-grid.ts',
    'tools/living-landmass/check-vista-terrain.mjs',
  ];
  const sourceSha256 = {};
  for (const source of sources) sourceSha256[source] = createHash('sha256')
    .update(await readFile(path.join(root, source))).digest('hex');
  const result = { pass: true, recordedAt: new Date().toISOString(),
    method: 'Actual Vite SSR ?raw CSV imports; Three Raycaster against rendered BufferGeometry; production full-body physical-grid sweep',
    sourceSha256, triangles: position.count / 3, surfaceArea, expectedArea, height: model.snapshot().surfaceHeight,
    rimVertices:cliffPosition.count/5,maxRimError,maxRimSamplerError,minCliffThickness,maxCliffThickness,internalCliffSeamsClosed:true,
    maxSlope, maxRouteSlope, supportedBodies: supported, rays: samples, maxHeightError: maxError,
    regionCount: snapshot.regionCount, connectors: snapshot.connectors, routeSegments, airChecks, blockedProbes,
    longSweeps: sweeps, snapshotIsolation: true, textureDisposedOnce: true, independentMaterialRoles: true, lateTextureDisposedOnce: true, maskExtents, maxBeddingUvGradient,
    limitations: 'Geometry and support only; does not certify visual quality, input events, camera composition or browser frame rate.' };
  const output = path.join(root, 'docs/qa/artifacts/iteration-23/vista-r6/terrain-check.json');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await server.close(); }
