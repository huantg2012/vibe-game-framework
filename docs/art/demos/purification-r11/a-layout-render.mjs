/** Deterministic R11 A layout. Run: node docs/art/demos/purification-r11/a-layout-render.mjs
 * a.png is the composition reference only. All usable geometry and actor scale
 * are imported from the frozen model; background masses are non-walkable context.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SPACE, FLOORS, DEVICES, SPAWN, WAYPOINTS, OUTER_BOUNDARY } from './a-route-model.mjs';

const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const n = value => Number(value.toFixed(3));
const points = polygon => polygon.map(point=>`${n(point.x)},${n(point.y)}`).join(' ');
const polygon = (vertices, attributes='') => `<polygon points="${points(vertices)}" ${attributes}/>`;
const line = (a,b,attributes='') => `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" ${attributes}/>`;
const text = (label,x,y,attributes='') => `<text x="${n(x)}" y="${n(y)}" ${attributes}>${escape(label)}</text>`;
const source = await readFile(new URL('./a-route-model.mjs',import.meta.url));
const modelHash=createHash('sha256').update(source).digest('hex');
const actorPng=await readFile(new URL('./player-reference.png',import.meta.url));
if(actorPng.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw new Error('Reference actor must be PNG');
const actorWidth=SPACE.actorHeight*actorPng.readUInt32BE(16)/actorPng.readUInt32BE(20);
const actorData=`data:image/png;base64,${actorPng.toString('base64')}`;
const floorNames={main:'核心扩地 / 下层',upper:'上层通廊',leftRamp:'左坡',rightRamp:'右坡'};
const floorFills={main:'#969696',upper:'#b2b2b2',leftRamp:'#a4a4a4',rightRamp:'#a4a4a4'};

function extrudedFloor(id,depth) {
  const vertices=FLOORS[id],faces=[];
  for(let index=0;index<vertices.length;index++) {
    const a=vertices[index],b=vertices[(index+1)%vertices.length];
    if(b.x<a.x) faces.push(polygon([a,b,{x:b.x,y:b.y+depth},{x:a.x,y:a.y+depth}],`fill="${id==='main'?'#555555':'#626262'}" stroke="#404040" stroke-width="1.5"`));
  }
  return `<g data-support-for="${id}" aria-label="${escape(floorNames[id])}支承体">${faces.join('')}</g>`;
}
function deviceBlock(device) {
  const top=device.footprint.map(point=>({x:point.x,y:point.y-device.height}));
  const faces=[];
  for(let i=0;i<device.footprint.length;i++) {
    const a=device.footprint[i],j=(i+1)%device.footprint.length,b=device.footprint[j];
    if(b.x<=a.x) faces.push(polygon([a,b,top[j],top[i]],'fill="#696969" stroke="#353535" stroke-width="1.4"'));
  }
  return `<g id="device-${device.id}" data-floor="${device.floor}" aria-label="${escape(device.label)}占位">
    ${polygon(device.footprint,'data-role="footprint" fill="#414141" stroke="#272727" stroke-width="2.4"')}
    ${faces.join('')}${polygon(top,'fill="#838383" stroke="#424242" stroke-width="1.5"')}
    ${text(device.label,device.x,device.y-device.height-13,'text-anchor="middle" class="device-label"')}
    <circle data-role="operation-anchor" cx="${device.anchor.x}" cy="${device.anchor.y}" r="4" fill="#f1f1f1" stroke="#565656" stroke-width="1.5"/>
  </g>`;
}
function callout(number,target,label,x,y) {
  const elbow={x:x-28,y:y-8},end={x:x-8,y:y-8};
  return `<g class="callout">${line(target,elbow,'stroke="#a8a8a8" stroke-width="1.6"')}${line(elbow,end,'stroke="#a8a8a8" stroke-width="1.6"')}
    <circle cx="${target.x}" cy="${target.y}" r="12" fill="#363636" stroke="#efefef" stroke-width="1.6"/>
    ${text(number,target.x,target.y+5,'text-anchor="middle" font-size="15" fill="#ffffff"')}
    ${text(label,x,y,'font-size="20" fill="#e5e5e5"')}
  </g>`;
}
const core=DEVICES.find(device=>device.id==='core');
const growth=DEVICES.find(device=>device.id==='growth');
const upperCallout={x:growth.anchor.x+SPACE.actorHeight,y:WAYPOINTS.upperMiddle.y};
const metadata={reference:'a.png',geometrySource:'a-route-model.mjs',modelSha256:modelHash,
  coordinateSpace:`${SPACE.width}×${SPACE.height} image px`,geometry:{floors:FLOORS,devices:DEVICES,spawn:SPAWN},
  actor:{height:SPACE.actorHeight,feetRadius:SPACE.feetRadius,embedded:true},
  note:'Deterministic layout. Decorative background and support side faces are not walkable surfaces. No route art or generated image is used.'};
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${SPACE.width}" height="${SPACE.height}" viewBox="0 0 ${SPACE.width} ${SPACE.height}" role="img" aria-labelledby="title desc">
<title id="title">A · 确定性空间布局</title>
<desc id="desc">以原始A的左侧建筑和右侧深隙构图为参照。地面、左右坡道、六处装置实体占位和原人物比例直接读取已验证模型。核心前方扩地，双坡形成闭环，上层保留连续通廊。这里不定义画风和材质。</desc>
<metadata id="layout-source">${escape(JSON.stringify(metadata))}</metadata>
<style>text{font-family:"PingFang SC","Noto Sans CJK SC",system-ui,sans-serif}.device-label{font-size:18px;fill:#eeeeee;paint-order:stroke;stroke:#303030;stroke-width:3px;stroke-linejoin:round}</style>
<rect width="1536" height="1024" fill="#202020"/>
<!-- Non-walkable masses: the original A composition, intentionally texture-free. -->
<g id="non-walkable-context" aria-label="原A左侧建筑大体积及右侧深隙示意">
  <path d="M0 0H740L884 172 990 386 1024 640 946 845 844 1024H0Z" fill="#292929"/>
  <path d="M27 147L697 186 746 366 768 644 129 805 30 704Z" fill="#464646"/>
  <path d="M77 228L686 255 711 413 80 446Z" fill="#555555"/>
  <path d="M128 493L608 473 808 620 107 708Z" fill="#505050"/>
  <path d="M0 37L105 0 807 270 876 342 748 304 81 99Z" fill="#353535"/>
  <path d="M0 0H202L783 264 748 304 88 59Z" fill="#242424"/>
  <path d="M48 139L82 151 83 652 48 673Z" fill="#343434"/>
  <path d="M707 267L745 282 785 634 747 615Z" fill="#363636"/>
  <path d="M1165 0H1536V561L1434 547 1400 667 1270 659 1182 512Z" fill="#303030"/>
  <path d="M1218 0H1271V559L1241 547Z" fill="#383838"/>
  <path d="M1470 690L1536 644V1024H1336L1382 883Z" fill="#292929"/>
</g>
<g id="floor-supports">${extrudedFloor('main',92)}${extrudedFloor('upper',46)}${extrudedFloor('leftRamp',24)}${extrudedFloor('rightRamp',32)}</g>
<g id="walkable-surfaces">
${['main','upper','leftRamp','rightRamp'].map(id=>polygon(FLOORS[id],`id="floor-${id}" data-role="walkable" aria-label="${escape(floorNames[id])}" fill="${floorFills[id]}"`)).join('\n')}
</g>
<g id="exposed-walk-boundary" stroke="#d4d4d4" stroke-width="2" fill="none">
${OUTER_BOUNDARY.map(edge=>line({x:edge.ax,y:edge.ay},{x:edge.ax+edge.dx,y:edge.ay+edge.dy})).join('')}
</g>
<g id="devices">${[...DEVICES].sort((a,b)=>a.y-b.y).map(deviceBlock).join('\n')}</g>
<g id="actor" aria-label="原人物等比参考">
  <circle cx="${SPAWN.x}" cy="${SPAWN.y}" r="${SPACE.feetRadius}" fill="none" stroke="#eeeeee" stroke-width="1.4"/>
  <image x="${n(SPAWN.x-actorWidth/2)}" y="${n(SPAWN.y-SPACE.actorHeight)}" width="${n(actorWidth)}" height="${SPACE.actorHeight}" href="${actorData}" style="image-rendering:pixelated"/>
</g>
<g id="layout-legend">
  ${text('A · 确定性空间布局',56,67,'font-size="29" fill="#ededed"')}
  ${text('原始构图参照 / a.png',57,99,'font-size="18" fill="#b4b4b4"')}
  ${callout('1',WAYPOINTS.coreFront,'核心扩地',650,850)}
  ${callout('2',WAYPOINTS.rightMiddle,'左右双坡闭环',1023,577)}
  ${callout('3',upperCallout,'上层通廊',812,402)}
  <circle cx="${WAYPOINTS.leftMiddle.x}" cy="${WAYPOINTS.leftMiddle.y}" r="12" fill="#363636" stroke="#efefef" stroke-width="1.6"/>
  ${text('2',WAYPOINTS.leftMiddle.x,WAYPOINTS.leftMiddle.y+5,'text-anchor="middle" font-size="15" fill="#ffffff"')}
  ${text('人物 52.8 px / 脚半径 14.4 px',55,956,'font-size="18" fill="#c6c6c6"')}
  ${text('地面、坡道与占位来自同一模型；画风和材质留待开发。',55,987,'font-size="18" fill="#a8a8a8"')}
  ${text('1536 × 1024',1358,987,'font-size="17" fill="#8f8f8f"')}
</g>
</svg>\n`;

// Structural self-check: all four usable surfaces and six feet are literal
// serializations of imports; no independently maintained coordinates exist.
for(const [id,vertices] of Object.entries(FLOORS)) {
  if(!svg.includes(`points="${points(vertices)}" id="floor-${id}"`)) throw new Error(`Floor ${id} drifted`);
}
for(const device of DEVICES) {
  if(!svg.includes(`points="${points(device.footprint)}" data-role="footprint"`)) throw new Error(`Device ${device.id} drifted`);
}
if(!svg.includes('href="data:image/png;base64,')||/href="(?!data:)/.test(svg)) throw new Error('SVG must be standalone');
if(!core || DEVICES.length!==6 || Object.keys(FLOORS).length!==4) throw new Error('Expected two floors, two ramps, six devices');
await writeFile(new URL('./a-layout.svg',import.meta.url),svg);
console.log(JSON.stringify({output:'a-layout.svg',size:[SPACE.width,SPACE.height],walkableSurfaces:4,deviceFootprints:6,
  actorHeight:SPACE.actorHeight,embeddedActor:true,modelSha256:modelHash,svgSha256:createHash('sha256').update(svg).digest('hex')},null,2));
