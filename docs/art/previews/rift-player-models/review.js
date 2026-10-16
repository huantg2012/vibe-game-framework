const manifest = await fetch('./assets/manifest.json').then(response => {
  if (!response.ok) throw new Error(`模型清单读取失败：${response.status}`);
  return response.json();
});
const descriptions = {
  a: '短衣摆、收腰、紧贴背部的工具包。\n延续净化点原型的利落工作服。',
  b: '分开的长衣襟、细长背包。\n重心向下，留下修长的行旅轮廓。',
  c: '柔软覆肩、下移的横向背包。\n上宽下收，强调负重与防护感。',
};
const viewLabels = { front:'正面', 'lamp-side':'灯侧', back:'背面' };
const images = new Map();
async function loadImage(url) {
  if (images.has(url)) return images.get(url);
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload=resolve; image.onerror=()=>reject(new Error(`图像未载入：${url}`)); image.src=url; });
  images.set(url,image); return image;
}
const candidates = manifest.variants.filter(variant => variant.id !== 'haven');
const imageURLs = new Set(manifest.variants.flatMap(variant => [
  ...Object.values(variant.atlas), ...Object.values(variant.threeViews).flatMap(Object.values),
]).map(file => `./assets/${file}`));
await Promise.all([...imageURLs, './assets/old-rift.png'].map(loadImage));
const groundSamples = {
  ivory: {url:'../../../qa/artifacts/native-diverse-samples-2026-10-15/browser/ivory-basin-material.png',crop:[700,670]},
  crystal: {url:'../../../qa/artifacts/native-diverse-samples-2026-10-15/browser/crystal-fibre-material.png',crop:[1900,850]},
};
// Existing material images are read as swatches; they do not stand in for live lighting.
await Promise.all(Object.values(groundSamples).map(sample=>loadImage(sample.url)));
const settings = { channel:'review', backdrop:'dark', direction:0, playing:true, ground:'plain' };
const stills = [], motion = [];
function context(canvas) { const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false; return ctx; }
function backdrop(ctx,w,h) {
  ctx.fillStyle=settings.backdrop==='light'?'#afb4aa':'#19211d';ctx.fillRect(0,0,w,h);
  if(settings.backdrop==='check')for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){ctx.fillStyle=(x/8+y/8)%2?'#29352d':'#37443a';ctx.fillRect(x,y,8,8);}
}
function sprite(ctx,image,sx,sy,sw,sh,dx,dy,dw,dh) {
  if(settings.channel!=='silhouette'){ctx.drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh);return;}
  const mask=document.createElement('canvas');mask.width=dw;mask.height=dh;
  const m=context(mask);m.drawImage(image,sx,sy,sw,sh,0,0,dw,dh);m.globalCompositeOperation='source-in';m.fillStyle=settings.backdrop==='light'?'#18251c':'#cbd7c9';m.fillRect(0,0,dw,dh);ctx.drawImage(mask,dx,dy);
}
for(const variant of candidates) {
  const card=document.createElement('article');card.className='card';card.dataset.variant=variant.id;
  card.innerHTML=`<div class="card-header"><div class="card-title"><span class="card-code">${variant.id.toUpperCase()}</span><h3>${variant.label}</h3></div><p>${descriptions[variant.id].replace('\n','<br>')}</p></div><div class="three-views"></div><nav class="card-links"><a href="./assets/${variant.atlas.rgba}" download>透明图集 PNG</a><a href="./assets/${variant.threeViews.front.rgba}" download>原尺寸正面</a></nav>`;
  for(const view of manifest.views){
    const figure=document.createElement('figure');figure.className='view';
    const canvas=document.createElement('canvas');canvas.width=36;canvas.height=52;canvas.setAttribute('aria-label',`${variant.label} ${viewLabels[view.id]}`);
    const caption=document.createElement('figcaption');caption.textContent=viewLabels[view.id];figure.append(canvas,caption);card.querySelector('.three-views').append(figure);stills.push({variant,view,canvas});
  }
  document.querySelector('#candidates').append(card);
  const wrapper=document.createElement('div');wrapper.className='motion-card';
  const label=document.createElement('span');label.className='motion-label';label.textContent=`${variant.id.toUpperCase()} · ${variant.label}`;wrapper.append(label);
  const canvas=document.createElement('canvas');canvas.width=192;canvas.height=104;canvas.setAttribute('aria-label',`${variant.label} 行走`);wrapper.append(canvas);document.querySelector('#motion-cards').append(wrapper);motion.push({variant,canvas});
}
function paintStills(){for(const {variant,view,canvas} of stills){const ctx=context(canvas);backdrop(ctx,36,52);const channel=settings.channel==='silhouette'?'rgba':settings.channel;const img=images.get(`./assets/${variant.threeViews[view.id][channel]}`);sprite(ctx,img,14,22,36,52,0,0,36,52);}}
for(const id of ['haven','old','a','b','c']){
  const variant=manifest.variants.find(v=>v.id===id);const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');canvas.width=64;canvas.height=80;const ctx=context(canvas);ctx.strokeStyle='#415247';ctx.beginPath();ctx.moveTo(6,66.5);ctx.lineTo(58,66.5);ctx.stroke();
  if(variant)ctx.drawImage(images.get(`./assets/${variant.threeViews.front.review}`),0,0);else ctx.drawImage(images.get('./assets/old-rift.png'),16,40);
  caption.textContent=id==='haven'?'净化点母型':id==='old'?'Rift 现状':`${id.toUpperCase()} · ${variant.label}`;figure.append(canvas,caption);document.querySelector('#native-strip').append(figure);
}
let phase=0,lastTime;
function paintMotion(){for(const {variant,canvas} of motion){const ctx=context(canvas);backdrop(ctx,192,104);if(settings.ground!=='plain'){const sample=groundSamples[settings.ground],img=images.get(sample.url),source=sample.crop;ctx.drawImage(img,source[0],source[1],192,104,0,0,192,104);}
  const frame=variant.frames.find(f=>f.yawIndex===settings.direction&&f.pose===(settings.playing?'walk':'idle')&&(settings.playing?f.key.endsWith(`-${Math.floor(phase)%12}`):true));if(!frame)continue;
  const channel=settings.channel==='silhouette'?'rgba':settings.channel;const img=images.get(`./assets/${variant.atlas[channel]}`);const [sx,sy,w,h]=frame.rect;
  if(['rgba','review'].includes(settings.channel)&&variant.atlas.contact)ctx.drawImage(images.get(`./assets/${variant.atlas.contact}`),sx,sy,w,h,64,10,w,h);
  sprite(ctx,img,sx,sy,w,h,64,10,w,h);
}}
function animate(time){if(lastTime!==undefined&&settings.playing)phase=(phase+Math.min(time-lastTime,80)/1000*12)%12;lastTime=time;paintMotion();requestAnimationFrame(animate);}
for(const id of ['channel','backdrop','direction','ground'])document.querySelector(`#${id}`).addEventListener('change',event=>{settings[id]=id==='direction'?Number(event.target.value):event.target.value;paintStills();paintMotion();});
document.querySelector('#play').addEventListener('click',event=>{settings.playing=!settings.playing;event.target.textContent=settings.playing?'暂停行走':'播放行走';event.target.setAttribute('aria-pressed',String(settings.playing));phase=0;paintMotion();});
paintStills();paintMotion();requestAnimationFrame(animate);
document.querySelector('#load-status').textContent=`已载入 · 三版模型 / 九张三视图 / ${candidates.reduce((n,v)=>n+v.frames.length,0)} 个候选帧 · 正式游戏未替换`;
document.body.dataset.ready='true';
window.modelReview={manifest,settings,groundSamples,paintStills,paintMotion};
