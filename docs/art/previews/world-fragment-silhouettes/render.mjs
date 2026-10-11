import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Authored topology studies, not samples from the production map generator.
// Shared coordinate frame and scale. White = retained land; black = no land.
const dir = path.dirname(fileURLToPath(import.meta.url));
const maps = [
  { id:'A', name:'斜向截离', file:'a-oblique',
    outer:[[55,585],[100,515],[182,497],[143,427],[204,375],[274,361],[245,297],[329,238],[442,249],[428,194],[535,115],[648,98],[678,139],[777,62],[917,105],[880,213],[933,251],[870,322],[790,350],[815,407],[750,489],[680,452],[643,525],[537,548],[570,608],[477,694],[380,658],[341,717],[201,739],[151,683],[76,704],[103,630]],
    holes:[
      [[368,351],[418,321],[475,309],[497,285],[564,295],[617,261],[651,278],[610,322],[557,344],[527,379],[454,407],[422,381],[393,383]],
      [[698,202],[735,180],[776,182],[807,152],[839,161],[814,209],[768,222],[740,248],[708,241]],
      [[235,430],[278,404],[323,419],[340,447],[315,479],[267,491],[243,470]],
      [[340,526],[387,472],[426,465],[450,496],[415,527],[399,566],[357,571]],
      [[457,605],[483,580],[502,590],[489,617],[468,627]],
      [[569,432],[618,385],[650,394],[659,427],[622,466],[581,482],[558,466]],
      [[711,375],[741,342],[764,361],[771,394],[740,425],[708,416],[700,396]],
      [[190,615],[201,570],[221,550],[259,570],[251,609],[267,627],[233,658],[210,648]]
    ] },
  { id:'B', name:'扇向展开', file:'b-fan',
    outer:[[83,385],[124,298],[191,306],[180,236],[310,172],[383,199],[447,122],[553,88],[681,116],[754,76],[820,134],[756,247],[657,284],[682,337],[799,310],[858,328],[938,298],[929,414],[855,459],[750,432],[692,489],[750,562],[833,552],[905,628],[864,680],[757,666],[742,726],[618,743],[550,697],[417,706],[384,657],[263,681],[248,624],[155,604],[185,531],[111,509],[136,448]],
    holes:[
      [[274,341],[317,294],[354,301],[413,259],[452,264],[440,312],[385,350],[372,387],[311,410],[281,389]],
      [[453,205],[497,158],[531,173],[553,220],[601,239],[609,269],[565,283],[513,249],[470,248]],
      [[683,174],[706,149],[730,157],[724,183],[700,199]],
      [[447,409],[494,367],[551,384],[568,420],[625,431],[634,467],[593,492],[549,469],[511,483],[481,452]],
      [[156,376],[211,349],[238,362],[221,392],[180,422],[157,411]],
      [[248,504],[281,452],[316,456],[330,496],[377,511],[403,555],[377,574],[333,553],[314,582],[271,556]],
      [[475,577],[512,538],[547,552],[565,600],[604,616],[581,650],[535,648],[514,624],[477,625]],
      [[609,528],[646,499],[672,537],[663,575],[620,563]]
    ] },
  { id:'C', name:'偏心回卷', file:'c-curved',
    outer:[[190,105],[280,75],[410,111],[432,72],[569,105],[624,156],[730,135],[810,217],[786,271],[897,339],[861,384],[942,466],[901,561],[825,579],[852,640],[753,711],[684,679],[604,752],[501,702],[408,725],[309,658],[342,580],[438,574],[466,514],[441,443],[367,423],[310,474],[247,447],[282,359],[226,310],[140,292],[105,227],[165,195]],
    holes:[
      [[307,164],[350,146],[391,166],[424,162],[461,201],[447,231],[407,223],[375,198],[338,204],[313,184]],
      [[183,221],[216,197],[259,224],[284,248],[278,281],[241,273],[224,250],[193,252]],
      [[499,197],[514,171],[552,192],[527,209]],
      [[380,292],[435,246],[469,250],[520,278],[565,276],[609,295],[648,316],[670,350],[670,401],[632,417],[602,381],[546,367],[509,335],[450,329],[411,346]],
      [[683,217],[719,196],[754,239],[734,283],[687,271]],
      [[733,397],[780,414],[781,448],[825,473],[805,508],[767,476],[757,438],[715,426]],
      [[548,439],[582,420],[616,454],[628,501],[679,533],[674,570],[634,585],[604,550],[582,522],[573,481],[542,471]],
      [[439,620],[495,580],[539,604],[571,598],[616,642],[588,679],[550,648],[476,653]]
    ] }
];

function contour(points, seed) {
  // Small directional chips enrich large authored breaks without replacing them.
  let state=seed;
  const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const out=[];
  for(let i=0;i<points.length;i++) {
    const a=points[i], b=points[(i+1)%points.length]; out.push(a);
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    if(length<43 || rand()<.32)continue;
    const t=.38+rand()*.24, d=(rand()-.5)*9;
    out.push([a[0]+dx*t-dy/length*d,a[1]+dy*t+dx/length*d]);
  }
  return out;
}
const commands=points=>'M'+points.map(p=>p.map(x=>x.toFixed(1)).join(',')).join('L')+'Z';
const svgFor=m=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800" width="1000" height="800" role="img"><title>${m.id} · ${m.name}：白色地块，黑色空间空洞及外部</title><rect width="1000" height="800" fill="#000"/><path fill="#fff" fill-rule="evenodd" d="${[m.outer,...m.holes].map((p,i)=>commands(contour(p,100+m.id.charCodeAt(0)*17+i))).join(' ')}"/></svg>`;

function components(mask,width,height,target){
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),sizes=[];
  for(let start=0;start<mask.length;start++)if(!seen[start]&&mask[start]===target){
    let head=0,tail=0;queue[tail++]=start;seen[start]=1;
    while(head<tail){const at=queue[head++],x=at%width,y=(at/width)|0;
      for(const next of [x?at-1:-1,x+1<width?at+1:-1,y?at-width:-1,y+1<height?at+width:-1])if(next>=0&&!seen[next]&&mask[next]===target){seen[next]=1;queue[tail++]=next;}}
    sizes.push(tail);
  }return sizes.sort((a,b)=>b-a);
}

const results=[];
for(const map of maps){
  const svg=svgFor(map);fs.writeFileSync(path.join(dir,map.file+'.svg'),svg+'\n');
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir,map.file+'.png'));
  const {data,info}=await sharp(Buffer.from(svg)).flatten().greyscale().raw().toBuffer({resolveWithObject:true});
  const mask=Uint8Array.from(data,x=>x>=128?1:0);
  const land=components(mask,info.width,info.height,1),voids=components(mask,info.width,info.height,0);
  if(land.length!==1||voids.length!==9)throw Error(`${map.id}: land=${land.length}, enclosed void=${voids.length-1}`);
  results.push({id:map.id,landComponents:land.length,enclosedVoids:voids.length-1,landPixels:land[0],internalVoidPixels:voids.slice(1).reduce((a,b)=>a+b,0)});
}
fs.writeFileSync(path.join(dir,'geometry.json'),JSON.stringify({coordinateFrame:[1000,800],maps},null,2)+'\n');
fs.writeFileSync(path.join(dir,'check.json'),JSON.stringify({scope:'2D silhouette only. Single connected white component, eight enclosed black regions. No production collision/LOS test or human approval.',results},null,2)+'\n');
console.log(JSON.stringify(results));
