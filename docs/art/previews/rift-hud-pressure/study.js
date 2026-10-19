const presets = [
  { weight:3, assimilation:0, title:'轻载 · 未同化' },
  { weight:14, assimilation:60, title:'临满 · 中度同化' },
  { weight:16, assimilation:100, title:'满载 · 同化上限' },
];
const state = { ...presets[1] };
const hud = document.querySelector('#hud');
const ctx = hud.getContext('2d');
const scene = document.querySelector('.scene img');
const comparison = document.querySelector('#comparison');
const digits = {
  '0':['01110','10001','10001','10001','10001','10001','01110'],
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

// Numerals use native pixel cells. Chinese labels retain the
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

// One identifier column, one numeric right edge, equal 18px row pitch.
const hudLayout=Object.freeze({width:112,height:52,identifierWidth:24,valueRight:110,rowPitch:18});
function paintHud(target,s) {
  target.clearRect(0,0,hudLayout.width,hudLayout.height);target.imageSmoothingEnabled=false;
  pixelText(target,'薪柴',0,4,'#8a8f96',10);
  pixelText(target,'0',hudLayout.valueRight,4,'#b89040',11,'right');
  pixelText(target,'负重',0,22,'#8a8f96',10);
  const weight=s.weight.toFixed(1),capacity='/16.0';
  pixelText(target,weight,hudLayout.valueRight-capacity.length*6-2,22,s.weight>=14?'#e0a848':'#c8cdd4',12,'right');
  pixelText(target,capacity,hudLayout.valueRight,22,'#8a8f96',10,'right');
  pixelText(target,'同化',0,40,'#8a8f96',10);
  pixelText(target,`${s.assimilation.toFixed(1)}%`,hudLayout.valueRight,40,s.assimilation>=60?'#1aad96':'#c8cdd4',12,'right');
}

function paintComparison() {
  const c=comparison.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#080d10';c.fillRect(0,0,960,180);
  presets.forEach((s,i)=>{
    const x=i*320;
    c.drawImage(scene,784,16,160,64,x,44,320,128);
    const tile=document.createElement('canvas');tile.width=hudLayout.width;tile.height=hudLayout.height;
    paintHud(tile.getContext('2d'),s);
    c.drawImage(tile,x+88,56,hudLayout.width*2,hudLayout.height*2);
    c.font='16px "PingFang SC",sans-serif';c.fillStyle='#b5c1b5';c.fillText(s.title,x+16,28);
    c.fillStyle='#52645b';c.font='12px monospace';c.fillText(`0${i+1}`,x+283,28);
  });
}

function sync() {
  document.querySelector('#weight').value=state.weight;
  document.querySelector('#assimilation').value=state.assimilation;
  document.querySelector('#weight-value').value=`${state.weight.toFixed(1)} / 16.0`;
  document.querySelector('#assimilation-value').value=`${state.assimilation.toFixed(1)}%`;
  document.querySelectorAll('[data-preset]').forEach((b,i)=>b.classList.toggle('selected',state.weight===presets[i].weight&&state.assimilation===presets[i].assimilation));
}
document.querySelectorAll('[data-preset]').forEach((b,i)=>b.addEventListener('click',()=>{Object.assign(state,presets[i]);sync();paintHud(ctx,state);}));
document.querySelector('#weight').addEventListener('input',e=>{state.weight=Number(e.target.value);sync();paintHud(ctx,state);});
document.querySelector('#assimilation').addEventListener('input',e=>{state.assimilation=Number(e.target.value);sync();paintHud(ctx,state);});

await scene.decode();await document.fonts.ready;
paintComparison();sync();paintHud(ctx,state);
window.__hudArt = {
  presets, hudLayout,
  renderPreset(index){Object.assign(state,presets[index]);sync();paintHud(ctx,state);},
  getState(){return {...state};},
};
