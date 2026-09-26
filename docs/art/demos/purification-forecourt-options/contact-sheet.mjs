import fs from 'node:fs/promises';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const assets=fileURLToPath(new URL('./assets/',import.meta.url));
const rows=JSON.parse(await fs.readFile(`${assets}options.json`,'utf8'));
const tiles=[];
for(let i=0;i<rows.length;i++){
  const {id,title}=rows[i],x=16+(i%2)*692,y=16+Math.floor(i/2)*530;
  const label=id==='current'?'当前版':`${id.toUpperCase()} · ${title}`;
  const heading=Buffer.from(`<svg width="676" height="42"><text x="3" y="30" fill="#d8dacf" font-family="PingFang SC,Arial,sans-serif" font-size="25">${label}</text></svg>`);
  const input=await sharp(`${assets}${id}.png`).extract({left:490,top:250,width:338,height:235}).resize(676,470,{kernel:'nearest'}).toBuffer();
  tiles.push({input:heading,left:x,top:y},{input,left:x,top:y+45});
}
await sharp({create:{width:1400,height:1076,channels:4,background:'#0b1010'}}).composite(tiles).png().toFile(`${assets}comparison.png`);
console.log('Saved exact-scale four-image comparison.');
