import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root='/Users/yilungao/coh',require=createRequire(root+'/package.json'),sharp=require('sharp');
const dir=root+'/docs/qa/artifacts/r100-i10-i12/b03-shard-refined';
const {buildNativeVolume}=await import(dir+'/body3/executor.mjs');
const parse=p=>JSON.parse(fs.readFileSync(p,'utf8').split('export const R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ')[1].replace(/;\s*$/,''));
const before=parse(dir+'/native72-before.ts.txt'),after=parse(root+'/src/generated/r100-native-worlds.ts');
const points=[[270,380],[456,404],[574,529],[723,478],[858,390]],boxes=[[240,350,500,451],[425,385,650,580],[540,420,795,580],[685,330,920,535]];
for(const [tag,lib]of [['before',before],['after',after]]){const d=lib.find(x=>x.id==='shard-switchback').definitions[1],els=[];
for(const {role,...s}of d.instances){const m=buildNativeVolume({...s,family:s.family??d.family,blocking:role==='solid'?1:0,seed:20261005^Math.imul(s.id,104729)});for(let i=0;i<m.indices.length;i+=3){const xy=[0,1,2].map(c=>{let at=m.indices[i+c]*3;return m.positions[at]+','+m.positions[at+1];}).join(' ');els.push(`<polygon points="${xy}" fill="${['#879aaa','#987455','#706288','#5c8562','#958482','#847655'][s.id-1]}"/>`);}els.push(`<text x="${s.x}" y="${s.y}" font-size="22" fill="white">${s.id}</text>`);}
for(let i=0;i<boxes.length;i++){const [x,y,X,Y]=boxes[i];els.push(`<rect x="${x}" y="${y}" width="${X-x}" height="${Y-y}" fill="none" stroke="#888" stroke-dasharray="8 4"/>`);}
for(let i=0;i<points.length;i++){const[x,y]=points[i];els.push(`<rect x="${x-10}" y="${y-10}" width="20" height="20" fill="none" stroke="red" stroke-width="2"/><text x="${x+12}" y="${y}" fill="red">S${i}</text>`);}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="1024" height="768" fill="#eee"/>${els.join('')}</svg>`;fs.writeFileSync(dir+'/xy-'+tag+'.svg',svg);await sharp(Buffer.from(svg)).png().toFile(dir+'/xy-'+tag+'.png');}
console.log('Two six-mesh footprint overlays generated; no world, raster, grid query or route test executed.');
