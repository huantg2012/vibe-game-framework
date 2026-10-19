import { drawBurden, drawAssimilation } from './pixel-marks.js';

const presets = [
  { weight:3, assimilation:0, title:'轻载 · 未同化' },
  { weight:14, assimilation:60, title:'临满 · 中度同化' },
  { weight:16, assimilation:100, title:'满载 · 完全同化' },
];
const state = { ...presets[1], growing:true, feedbackStart:-Infinity };
const hud = document.querySelector('#hud');
const ctx = hud.getContext('2d');
const scene = document.querySelector('.scene img');
const comparison = document.querySelector('#comparison');
const marks = document.querySelector('#marks');
const digits = {
  '0':['01110','11011','11011','11011','11011','11011','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','00100','00100','00100'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','01110'],
  '.':['00000','00000','00000','00000','00000','00110','00110'],
  '/':['00001','00001','00010','00100','01000','10000','10000'],
  '%':['11001','11010','00010','00100','01000','01011','10011'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
};

// The artwork and numerals use native pixel cells. Chinese labels retain the
// game's readable font instead of thresholding their strokes into broken glyphs.
function pixelText(target,text,x,y,color,size=11,align='left') {
  target.fillStyle=color;
  if (/[\u3400-\u9fff]/.test(text)) {
    target.font=`${size+1}px "PingFang SC",sans-serif`;
    target.textBaseline='top';target.textAlign=align;
    target.fillText(text,Math.round(x),Math.round(y));return;
  }
  let dx=Math.round(x-(align==='right'?text.length*6-1:0));
  for(const char of text){
    const rows=digits[char]??digits[' '];
    rows.forEach((row,py)=>[...row].forEach((pixel,px)=>{if(pixel==='1')target.fillRect(dx+px,Math.round(y)+2+py,1,1);}));
    dx+=6;
  }
}

function paintHud(target,s,time=0,feedback=0) {
  target.clearRect(0,0,168,116);target.imageSmoothingEnabled=false;
  pixelText(target,'薪柴',136,0,'#71816e',10,'right');
  pixelText(target,'0',168,0,'#b39b75',11,'right');
  drawBurden(target,34,22,s.weight/16,time,feedback);
  pixelText(target,'负重',78,24,'#8e9b83',10);
  pixelText(target,s.weight.toFixed(1),78,40,s.weight>=14?'#e0a848':'#c8cdd4',12);
  pixelText(target,'/16.0',111,40,'#8a8f96',10);
  drawAssimilation(target,34,68,s.assimilation,time,s.growing&&s.assimilation<100&&s.assimilation>0);
  pixelText(target,'同化',78,70,'#8e9b83',10);
  pixelText(target,`${s.assimilation.toFixed(1)}%`,78,86,s.assimilation>=60?'#a5b09a':'#c8cdd4',12);
}

function paintComparison() {
  const c=comparison.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#080d10';c.fillRect(0,0,960,360);
  presets.forEach((s,i)=>{
    const x=i*320;
    c.drawImage(scene,800,8,160,144,x,44,320,288);
    const tile=document.createElement('canvas');tile.width=168;tile.height=116;
    paintHud(tile.getContext('2d'),s,0,0);
    c.drawImage(tile,32,0,136,116,x,76,272,232);
    c.font='16px "PingFang SC",sans-serif';c.fillStyle='#b5c1b5';c.fillText(s.title,x+24,28);
    c.fillStyle='#52645b';c.font='12px monospace';c.fillText(`0${i+1}`,x+283,28);
  });
}

function paintMarks() {
  const c=marks.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#0b1013';c.fillRect(0,0,960,218);
  const tile=document.createElement('canvas');tile.width=32;tile.height=40;const t=tile.getContext('2d');
  [3/16,14/16,1,0,60,100].forEach((v,i)=>{
    t.clearRect(0,0,32,40);
    if(i<3)drawBurden(t,0,0,v,0,0);else drawAssimilation(t,0,0,v,0,false);
    c.drawImage(tile,i*160+16,12,128,160);
    c.fillStyle='#98a79d';c.textAlign='center';c.font='11px "PingFang SC",sans-serif';
    c.fillText(i<3?`负重 ${(v*16).toFixed(1)} / 16.0`:`同化 ${v}%`,i*160+80,195);
  });
}

function sync() {
  document.querySelector('#weight').value=state.weight;
  document.querySelector('#assimilation').value=state.assimilation;
  document.querySelector('#weight-value').value=`${state.weight.toFixed(1)} / 16.0`;
  document.querySelector('#assimilation-value').value=`${state.assimilation.toFixed(1)}%`;
  document.querySelectorAll('[data-preset]').forEach((b,i)=>b.classList.toggle('selected',state.weight===presets[i].weight&&state.assimilation===presets[i].assimilation));
}
document.querySelectorAll('[data-preset]').forEach((b,i)=>b.addEventListener('click',()=>{Object.assign(state,presets[i]);state.feedbackStart=performance.now();sync();}));
document.querySelector('#weight').addEventListener('input',e=>{state.weight=Number(e.target.value);state.feedbackStart=performance.now();sync();});
document.querySelector('#assimilation').addEventListener('input',e=>{state.assimilation=Number(e.target.value);sync();});
document.querySelector('#growing').addEventListener('change',e=>state.growing=e.target.checked);
document.querySelector('#replay').addEventListener('click',()=>state.feedbackStart=performance.now());

await scene.decode();await document.fonts.ready;
paintComparison();paintMarks();sync();
window.__hudArt = {
  presets,
  renderPreset(index){Object.assign(state,presets[index]);state.growing=false;sync();paintHud(ctx,state,0,0);},
  getState(){return {...state};},
  getSpriteSheet(){
    const c=document.createElement('canvas');c.width=192;c.height=40;const g=c.getContext('2d');
    presets.forEach((s,i)=>{drawBurden(g,i*32,0,s.weight/16,0,0);drawAssimilation(g,(i+3)*32,0,s.assimilation,0,false);});
    return c.toDataURL('image/png');
  },
};
function frame(now){
  const feedback=Math.max(0,1-(now-state.feedbackStart)/680);
  paintHud(ctx,state,now,feedback);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
