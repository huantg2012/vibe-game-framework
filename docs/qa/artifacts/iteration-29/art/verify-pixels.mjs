import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root=path.dirname(new URL(import.meta.url).pathname);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const context=await browser.newContext();
  const page=await context.newPage();
  // Empty page on the same origin: these tests instantiate drawing classes with
  // a recording Graphics target. They never create a game or load a user save.
  await page.route('**/__pixel_check',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Pixel contract</title>'}));
  await page.goto('http://127.0.0.1:3025/__pixel_check');
  const report=await page.evaluate(async()=>{
    const {GrowthConsoleVisual}=await import('/src/scenes/growth-console-visual.ts');
    const {OfferingStandVisual}=await import('/src/scenes/offering-stand-visual.ts');
    const {buildModuleDamagePixels,moduleDamageMaskFromRgba}=await import('/src/entities/purification-module.ts');
    const palette=new Set((await (await fetch('/docs/art/palette.json')).json()).colors.map(c=>parseInt(c.slice(1),16)));
    const records=[];
    async function inspect(name,Class,width,height,originY,url,configure) {
      const source=new Image(); source.src=url; await source.decode();
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
      const bytes=ctx.getImageData(0,0,width,height).data;
      const original=new Set();
      for(let i=0;i<width*height;i++)if(bytes[i*4+3])original.add(i);
      const added=new Set();let color=0;
      const graphics={
        clear(){added.clear();return this;},
        fillStyle(c){if(!palette.has(c))throw Error(name+': unlisted color');color=c;return this;},
        fillRect(x,y,w,h){
          for(const n of [x,y,w,h])if(!Number.isInteger(n))throw Error(name+': fractional pixel');
          for(let yy=y+originY;yy<y+originY+h;yy++)for(let xx=x+width/2;xx<x+width/2+w;xx++){
            if(xx<0||xx>=width||yy<0||yy>=height)throw Error(name+': outside declared frame');
            added.add(yy*width+xx);
          }return this;
        },
      };
      const visual=new Class({},0,0); configure(visual,graphics);
      const union=new Set([...original,...added]);
      const reached=new Set(original),todo=[...original];
      while(todo.length){const i=todo.pop(),x=i%width,y=Math.floor(i/width);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*width+xx;if(xx<0||xx>=width||yy<0||yy>=height||reached.has(j)||!union.has(j))continue;reached.add(j);todo.push(j);}}
      const floating=[...added].filter(i=>!reached.has(i));
      if(floating.length)throw Error(name+': '+floating.length+' disconnected added pixels');
      records.push({name,addedPixels:added.size,detachedAddedPixels:floating.length,lastColor:color.toString(16)});
    }
    for(let tier=0;tier<3;tier++)await inspect('growth-'+tier,GrowthConsoleVisual,40,42,40,'/assets/sprites/modules/growth-a-sheet.png',(v,g)=>{v.fittings=g;v.investment=tier;v.drawFittings();});
    for(let tier=0;tier<4;tier++)for(let pressure=0;pressure<3;pressure++)await inspect(`offering-${tier}-${pressure}`,OfferingStandVisual,32,32,26,'/assets/sprites/modules/offering-i-sheet.png',(v,g)=>{v.cradle=g;v.tier=tier;v.pressure=pressure;v.drawCradle();});
    const damage=[];
    for(const [type,file,width,height,frames,foot]of [['CORE','core-v6-b.png',32,40,1,34],['PURIFIER','purifier-b1-sheet.png',32,44,8,37.9],['STORAGE','storage-c1-sheet.png',32,36,8,32]]){
      const image=new Image();image.src='/assets/sprites/modules/'+file;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(image,0,0);const mask=moduleDamageMaskFromRgba(width,height,ctx.getImageData(0,0,width,height).data);
      for(const health of ['healthy','damaged','critical']){
        const pixels=buildModuleDamagePixels(type,health,mask);
        if(health==='healthy'&&pixels.length)throw Error(type+': healthy damage');
        if(health!=='healthy'&&pixels.length<4)throw Error(type+': invisible damage');
        for(let frame=0;frame<frames;frame++){
          ctx.clearRect(0,0,width,height);ctx.drawImage(image,-frame*width,0);
          const data=ctx.getImageData(0,0,width,height).data;
          for(const p of pixels){
            if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||!palette.has(p.color))throw Error(type+': damage grid/palette');
            if(p.y>foot||data[(p.y*width+p.x)*4+3]!==255)throw Error(type+': damage outside casing');
            for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(data[((p.y+dy)*width+p.x+dx)*4+3]!==255)throw Error(type+': damage on silhouette');
          }
        }
        damage.push({type,health,pixels:pixels.length,framesChecked:frames,offCasing:0,onSilhouette:0});
      }
    }
    return {method:'Record actual attachment drawing methods; four-neighbour attachment check against source alpha. Module damage uses actual exported material projection and is checked against every locked animation frame, with one-pixel silhouette guard and no marks below feet. Palette/frame/integer checks cover all new pixels.',records,damage};
  });
  fs.writeFileSync(path.join(root,'pixel-check.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({checked:report.records.length,detachedAddedPixels:0,damage:report.damage}));
} finally { await browser.close(); }
