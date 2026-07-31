// A-G3 合成测试用一次性脚本：把处理后的 32px tile 铺成一小块场景 + decal 叠加 + 有限视野遮罩。
// 目的：为"纯俯视像素平铺是否马赛克"提供可视证据。非游戏运行时代码。
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const TILES = join(DIR, 'out-tiles');
const DECALS = join(DIR, 'out-decals');
const T = 32;                 // tile 原生像素
const COLS = 20, ROWS = 13;   // 视口 ~20x13 tile (DEC-009)
const UPSCALE = 3;            // 最终整体放大，便于肉眼看

// 确定性 RNG，保证可复现
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rng = mulberry32(20260729);
const pick = (arr)=>arr[Math.floor(rng()*arr.length)];
function weighted(pairs){const s=pairs.reduce((a,[,w])=>a+w,0);let r=rng()*s;for(const[v,w]of pairs){if((r-=w)<0)return v;}return pairs[0][0];}

const load = (base,name)=>join(base,name+'.png');
const FLOOR = [
  ['tile-rift-floor-metro-base',40],
  ['tile-rift-floor-metro-crack',25],
  ['tile-rift-floor-metro-worn',25],
  ['tile-rift-floor-metro-seam',10],
];

async function tileBuf(base,name){ return await sharp(load(base,name)).resize(T,T,{kernel:'nearest'}).toBuffer(); }

async function main(){
  // 1) 构建 tile 网格类型
  const grid = []; // grid[r][c] = tile name (from out-tiles)
  for(let r=0;r<ROWS;r++){
    grid[r]=[];
    for(let c=0;c<COLS;c++){
      if(r===0) grid[r][c] = (c===0||c===COLS-1)?'tile-rift-wall-metro-corner':'tile-rift-wall-metro-straight';
      else if(r===4 && c>=6 && c<=13) grid[r][c]='tile-rift-wall-metro-straight';
      else grid[r][c]=weighted(FLOOR);
    }
  }
  // 撒数据错误块
  const errSpots=[[7,3],[9,15],[3,10]]; for(const[r,c]of errSpots){ if(grid[r]&&grid[r][c]) grid[r][c]='tile-rift-error-small'; }
  grid[8][9]='tile-rift-error-large';

  // 2) 合成底层 tile
  const W=COLS*T, H=ROWS*T;
  const composites=[];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    composites.push({ input: await tileBuf(TILES,grid[r][c]), top:r*T, left:c*T });
  }
  let scene = sharp({create:{width:W,height:H,channels:4,background:{r:8,g:10,b:12,alpha:1}}}).composite(composites).png();
  let sceneBuf = await scene.toBuffer();

  // 3) 叠加 decal（随机旋转），只在地面 tile 上
  const decalNames=['decal-rift-teal-crack','decal-rift-debris'];
  const decalComposites=[];
  let placed=0, tries=0;
  while(placed<11 && tries<200){
    tries++;
    const r=Math.floor(rng()*ROWS), c=Math.floor(rng()*COLS);
    if(grid[r][c].startsWith('tile-rift-floor')===false) continue;
    const name=placed%2===0?'decal-rift-teal-crack':'decal-rift-debris';
    const rot=pick([0,90,180,270]);
    const buf=await sharp(load(DECALS,name)).resize(T,T,{kernel:'nearest'}).rotate(rot).toBuffer();
    decalComposites.push({input:buf,top:r*T,left:c*T});
    placed++;
  }
  sceneBuf = await sharp(sceneBuf).composite(decalComposites).png().toBuffer();

  // 保存无遮罩版
  await sharp(sceneBuf).resize(W*UPSCALE,H*UPSCALE,{kernel:'nearest'}).png()
    .toFile(join(DIR,'composed-scene-raw.png'));

  // 4) 有限视野遮罩（径向近似：中心全亮，外沿趋近 void 黑）
  const px=10*T+16, py=8*T+16;          // 玩家位置 (col10,row8)
  const rSolid=2.0*T, rFull=6.0*T;      // 全亮半径 / 视野外沿
  const mask=Buffer.alloc(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const d=Math.hypot(x-px,y-py);
    let v; if(d<=rSolid)v=1; else if(d>=rFull)v=0.06; else{const t=(d-rSolid)/(rFull-rSolid);v=1-(1-0.06)*t;}
    const i=(y*W+x)*4; mask[i]=mask[i+1]=mask[i+2]=Math.round(255*v); mask[i+3]=255;
  }
  const maskPng=await sharp(mask,{raw:{width:W,height:H,channels:4}}).png().toBuffer();
  const masked=await sharp(sceneBuf).composite([{input:maskPng,blend:'multiply'}]).png().toBuffer();
  await sharp(masked).resize(W*UPSCALE,H*UPSCALE,{kernel:'nearest'}).png()
    .toFile(join(DIR,'composed-scene-masked.png'));

  // 5) 10 块处理后 tile 的放大对照表
  const all=[...FLOOR.map(([n])=>n),'tile-rift-wall-metro-straight','tile-rift-wall-metro-corner','tile-rift-error-small','tile-rift-error-large'];
  const S=T*4, GAP=8, PERROW=5;
  const sheetW=PERROW*S+(PERROW+1)*GAP, sheetH=2*S+3*GAP + 2*(S+GAP) + GAP;
  const sheetComps=[]; let idx=0;
  for(const n of all){ const rr=Math.floor(idx/PERROW),cc=idx%PERROW;
    sheetComps.push({input:await sharp(load(TILES,n)).resize(S,S,{kernel:'nearest'}).toBuffer(),top:GAP+rr*(S+GAP),left:GAP+cc*(S+GAP)}); idx++; }
  // decal 放第三行
  for(const n of decalNames){ const cc=idx%PERROW,rr=Math.floor(idx/PERROW);
    sheetComps.push({input:await sharp(load(DECALS,n)).resize(S,S,{kernel:'nearest'}).flatten({background:{r:20,g:20,b:24}}).toBuffer(),top:GAP+rr*(S+GAP),left:GAP+cc*(S+GAP)}); idx++; }
  const rowsNeeded=Math.ceil(idx/PERROW);
  await sharp({create:{width:sheetW,height:GAP+rowsNeeded*(S+GAP),channels:4,background:{r:15,g:16,b:20,alpha:1}}})
    .composite(sheetComps).png().toFile(join(DIR,'contact-sheet.png'));

  console.log('done: composed-scene-raw.png, composed-scene-masked.png, contact-sheet.png');
}
main().catch(e=>{console.error(e);process.exit(1);});
