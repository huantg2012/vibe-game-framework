const $ = id => document.getElementById(id);
const whole = $('whole'), focus = $('focus');
const wholeContext = whole.getContext('2d'), focusContext = focus.getContext('2d');
const compare = $('compare'), annotations = $('annotations'), holdButton = $('hold-current'), split = $('split'), routeSelect = $('route-select');
const crop = {x:300,y:250,width:300,height:260};
const allowedIds = ['a','a-before-rift'];
const images = new Map(), options = new Map(), buttons = new Map();
let selected = 'a', held = false, dragging = false, ready = false;
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const label = id => id === 'a-before-rift' ? 'A 调整前' : '调整后';

function polygon(ctx, points) {
  if (!points?.length) return;
  ctx.beginPath();points.forEach((point,index) => index ? ctx.lineTo(point[0],point[1]) : ctx.moveTo(point[0],point[1]));ctx.closePath();
}
function selectedRoute() {
  if(routeSelect.value==='')return undefined;
  return options.get(selected)?.routes?.[Number(routeSelect.value)];
}
function updateLegend() {
  const route=selectedRoute();
  $('legend').hidden=!annotations.checked&&!route;
  $('legend-footprint').hidden=!annotations.checked;
  $('legend-stop').hidden=!annotations.checked;
  $('legend-route').hidden=!route;
  $('legend-route').textContent=route ? `${route.label} · 示意路径 ${Number(route.distance).toFixed(1)} m` : '选中路线';
}
function drawRoute(ctx, route, region) {
  if(!route?.points||route.points.length<2)return;
  ctx.save();ctx.translate(-region.x,-region.y);
  ctx.strokeStyle='#d5b179';ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
  route.points.forEach((point,index)=>index?ctx.lineTo(...point):ctx.moveTo(...point));ctx.stroke();
  const start=route.points[0],tip=route.points.at(-1),before=route.points.at(-2),angle=Math.atan2(tip[1]-before[1],tip[0]-before[0]);
  ctx.beginPath();ctx.moveTo(tip[0]-8*Math.cos(angle-.45),tip[1]-8*Math.sin(angle-.45));ctx.lineTo(...tip);ctx.lineTo(tip[0]-8*Math.cos(angle+.45),tip[1]-8*Math.sin(angle+.45));ctx.stroke();
  ctx.fillStyle='#e2cea8';ctx.beginPath();ctx.arc(...start,2.5,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function drawAnnotations(ctx, option, region) {
  ctx.save();ctx.translate(-region.x,-region.y);
  if (option.footprint?.length) {
    polygon(ctx,option.footprint);ctx.fillStyle='#a1bfc521';ctx.fill();
    ctx.strokeStyle='#a1bfc5b8';ctx.lineWidth=1.3;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
  }
  if (option.stop) {
    ctx.strokeStyle='#e2cea8';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(...option.stop,7,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#e2cea8';ctx.beginPath();ctx.arc(...option.stop,2,0,Math.PI*2);ctx.fill();
  }
  ctx.font='12px system-ui,-apple-system,sans-serif';ctx.textBaseline='middle';
  const placedLabels=[];
  for (const note of option.callouts??[]) {
    const [px,py]=note.point;
    if(px<region.x||px>region.x+region.width||py<region.y||py>region.y+region.height)continue;
    const textWidth=ctx.measureText(note.text).width;
    const x=clamp(px+10,region.x+7,region.x+region.width-textWidth-12);
    const preferredY=clamp(py-16,region.y+15,region.y+region.height-15);
    let y=preferredY;
    // Keep the authored anchor; only move its label within this particular
    // viewport. Full-scene and cropped callouts pack independently.
    for(let step=0;step<=Math.ceil(region.height/26)*2;step++){
      const offset=step===0?0:Math.ceil(step/2)*26*(step%2?-1:1);
      const candidate=clamp(preferredY+offset,region.y+15,region.y+region.height-15);
      const rect={x:x-5,y:candidate-10,width:textWidth+10,height:21};
      const overlaps=placedLabels.some(other=>rect.x<other.x+other.width+3&&rect.x+rect.width+3>other.x&&rect.y<other.y+other.height+3&&rect.y+rect.height+3>other.y);
      if(!overlaps){y=candidate;break;}
    }
    placedLabels.push({x:x-5,y:y-10,width:textWidth+10,height:21});
    ctx.fillStyle='#0a1112df';ctx.fillRect(x-5,y-10,textWidth+10,21);
    ctx.fillStyle='#d6ddd2';ctx.fillText(note.text,x,y);
    ctx.strokeStyle='#b7c9ba';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x-3,y+7);ctx.stroke();
  }
  ctx.restore();
}
function drawCanvas(canvas,ctx,region) {
  const actual=held?'a-before-rift':selected,image=images.get(actual);
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,region.x,region.y,region.width,region.height,0,0,canvas.width,canvas.height);
  if(annotations.checked&&!held)drawAnnotations(ctx,options.get(selected),region);
  if(!held)drawRoute(ctx,selectedRoute(),region);
  if(compare.checked&&!held&&selected!=='a-before-rift') {
    const line=canvas.width*Number(split.value)/100;
    ctx.save();ctx.beginPath();ctx.rect(0,0,line,canvas.height);ctx.clip();
    ctx.drawImage(images.get('a-before-rift'),region.x,region.y,region.width,region.height,0,0,canvas.width,canvas.height);ctx.restore();
    ctx.fillStyle='#e0e0c8aa';ctx.fillRect(Math.round(line),0,1,canvas.height);
    ctx.fillStyle='#101612d9';ctx.fillRect(line-10,canvas.height/2-13,21,26);
    ctx.strokeStyle='#d5d9c6';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(line-3,canvas.height/2-5);ctx.lineTo(line-6,canvas.height/2);ctx.lineTo(line-3,canvas.height/2+5);ctx.moveTo(line+4,canvas.height/2-5);ctx.lineTo(line+7,canvas.height/2);ctx.lineTo(line+4,canvas.height/2+5);ctx.stroke();
  }
  canvas.dataset.option=actual;canvas.dataset.swipe=String(compare.checked&&!held&&selected!=='a-before-rift');
  canvas.dataset.route=held?'':selectedRoute()?.label??'';
  canvas.dataset.annotations=String(annotations.checked&&!held);
}
function draw() {
  if(!ready)return;
  drawCanvas(whole,wholeContext,{x:0,y:0,width:960,height:640});drawCanvas(focus,focusContext,crop);
  const comparing=compare.checked&&selected!=='a-before-rift';
  $('whole-state').textContent=held?'A 调整前 · 松开返回':comparing?`左：A 调整前 / 右：${label(selected)}`:label(selected);
  whole.setAttribute('aria-label',`${label(held?'a-before-rift':selected)}完整场景${comparing?'，可拖动分界线与 A 调整前比较':''}`);
  focus.setAttribute('aria-label',`${label(held?'a-before-rift':selected)}左前侧裂隙，同一固定裁切与比例`);
}
function select(id) {
  if(!options.has(id))return;
  selected=id;held=false;dragging=false;
  for(const [key,button]of buttons)button.setAttribute('aria-pressed',String(key===id));
  const option=options.get(id);
  $('title').textContent=option.title;$('summary').textContent=option.summary??'';
  $('tradeoff').textContent=option.tradeoff??'';
  $('design').replaceChildren(...(option.design??[]).slice(0,3).map(fact=>{const item=document.createElement('li');item.textContent=fact;return item;}));
  $('design').hidden=!option.design?.length;
  // Route coordinates belong to this exact alternative. Never carry an old
  // selection across a changed floor plan, even if the numeric index matches.
  const none=document.createElement('option');none.value='';none.textContent='不显示';
  routeSelect.replaceChildren(none,...(option.routes??[]).map((route,index)=>{const item=document.createElement('option');item.value=String(index);item.textContent=route.label;return item;}));
  routeSelect.value='';routeSelect.disabled=!option.routes?.length;
  holdButton.disabled=id==='a-before-rift';compare.disabled=id==='a-before-rift';
  holdButton.setAttribute('aria-pressed','false');
  $('swipe-control').hidden=!compare.checked||id==='a-before-rift';$('split-name').textContent=label(id);
  updateLegend();
  draw();
}
function setHeld(value) {
  if(!ready||selected==='a-before-rift')return;
  held=value;holdButton.setAttribute('aria-pressed',String(value));draw();
}
function setSplit(event,canvas) {
  const rect=canvas.getBoundingClientRect();split.value=String(clamp((event.clientX-rect.left)/rect.width*100,0,100));draw();
}
for(const canvas of [whole,focus]) {
  canvas.addEventListener('pointerdown',event=>{
    if(!ready||!compare.checked||held||selected==='a-before-rift')return;
    dragging=true;canvas.setPointerCapture(event.pointerId);setSplit(event,canvas);event.preventDefault();
  });
  canvas.addEventListener('pointermove',event=>{if(dragging&&canvas.hasPointerCapture(event.pointerId))setSplit(event,canvas);});
  canvas.addEventListener('pointerup',()=>{dragging=false;});canvas.addEventListener('pointercancel',()=>{dragging=false;});
}
holdButton.addEventListener('pointerdown',event=>{if(holdButton.disabled)return;holdButton.setPointerCapture(event.pointerId);setHeld(true);});
holdButton.addEventListener('pointerup',()=>setHeld(false));holdButton.addEventListener('pointercancel',()=>setHeld(false));
holdButton.addEventListener('lostpointercapture',()=>setHeld(false));holdButton.addEventListener('blur',()=>setHeld(false));
holdButton.addEventListener('keydown',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();setHeld(true);}});
holdButton.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();setHeld(false);}});
window.addEventListener('blur',()=>{dragging=false;setHeld(false);});
compare.addEventListener('change',()=>{$('swipe-control').hidden=!compare.checked||selected==='a-before-rift';draw();});
annotations.addEventListener('change',()=>{updateLegend();draw();});split.addEventListener('input',draw);
routeSelect.addEventListener('change',()=>{updateLegend();draw();});

try {
  const [response,beforeResponse]=await Promise.all([fetch('./assets/options.json'),fetch('./assets/a-before-rift.json')]);
  if(!response.ok||!beforeResponse.ok)throw new Error(`Options: ${response.status}; A before: ${beforeResponse.status}`);
  const [metadata,before]=await Promise.all([response.json(),beforeResponse.json()]);
  if(!Array.isArray(metadata))throw new Error('Expected an options array.');
  for(const option of metadata){const id=String(option.id).toLowerCase();if(id==='a')options.set(id,{...option,id});}
  options.set('a-before-rift',{...before,id:'a-before-rift'});
  for(const id of allowedIds)if(!options.has(id))throw new Error(`Missing option ${id}.`);
  await Promise.all(allowedIds.map(id=>new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>{if(image.naturalWidth!==960||image.naturalHeight!==640){reject(new Error(`${id}: camera size mismatch.`));return;}images.set(id,image);resolve();};
    image.onerror=()=>reject(new Error(`Unable to load ${id}.png`));image.src=`./assets/${id}.png`;
  })));
  for(const id of allowedIds){
    const button=document.createElement('button');button.type='button';button.id=`option-${id}`;button.textContent=label(id);button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>select(id));
    button.addEventListener('keydown',event=>{
      const delta=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;if(!delta)return;
      event.preventDefault();const next=allowedIds[(allowedIds.indexOf(id)+delta+allowedIds.length)%allowedIds.length];select(next);buttons.get(next).focus({preventScroll:true});
    });buttons.set(id,button);$('options').append(button);
  }
  const requested=new URLSearchParams(location.search).get('option')?.toLowerCase();if(requested&&options.has(requested))selected=requested;
  ready=true;annotations.disabled=false;holdButton.disabled=false;compare.disabled=false;
  $('status').textContent='';select(selected);
}catch(error){$('status').textContent='场景尚未载入完整，请稍后刷新。';console.error(error);}
