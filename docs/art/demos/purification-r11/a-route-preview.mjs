import { SPACE,FLOORS,DEVICES,SPAWN,WAYPOINTS,OUTER_BOUNDARY,createState,canStand,clearance,
  stepMovement,reachableDevices,createController,setFocus,setPaused,stepController,planPath,directionToward } from './a-route-model.mjs';

const canvas=document.querySelector('#world'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id),controller=createController(),visited=new Set();
const player=new Image();player.src='./player-reference.png';
const routeNames={main:'下层主平台',upper:'上层后沿',leftRamp:'左坡',rightRamp:'右坡'};
const floorColors={main:'#586051',upper:'#79836e',leftRamp:'#90987e',rightRamp:'#90987e'};
let navigation=[],goals=[],trail=[{...controller.state}],source='待机',lastTime=performance.now(),walkedFrames=0;
let collisionVisible=true,trailVisible=true,lastStatusUpdate=0,targetLabel='',lastInteraction='';
const logs=[];
function log(message) { logs.unshift(message);logs.splice(4);$('movement-log').textContent=logs.join(' · '); }
function cancelNavigation(reason) {navigation=[];goals=[];targetLabel='';source=reason;}
function navigate(targets,label) {
  if(controller.paused) {log('先恢复，再选择行走目标。');return;}
  try {
    goals=targets.map(point=>({...point}));targetLabel=label;
    navigation=planPath(controller.state,goals.shift());source=`自动逐帧行走：${label}`;
    controller.keys.clear();log(`开始走向${label}`);canvas.focus();
  } catch(error) {cancelNavigation('目标不可达');log(error.message);}
}
for(const device of DEVICES) {
  const button=document.createElement('button');button.textContent=`走到${device.label}`;button.dataset.device=device.id;
  button.addEventListener('click',()=>navigate([device.anchor],device.label));$('device-buttons').append(button);
}
const loop=[WAYPOINTS.leftBottom,WAYPOINTS.leftMiddle,WAYPOINTS.leftTop,WAYPOINTS.upperMiddle,
  WAYPOINTS.rightTop,WAYPOINTS.rightMiddle,WAYPOINTS.rightBottom,WAYPOINTS.mainRight,SPAWN];
$('loop-forward').addEventListener('click',()=>navigate(loop,'顺时针环路'));
$('loop-reverse').addEventListener('click',()=>navigate([...loop.slice(0,-1)].reverse().concat(SPAWN),'逆时针环路'));
canvas.addEventListener('pointerdown',event=>{
  const rect=canvas.getBoundingClientRect(),point={x:(event.clientX-rect.left)*SPACE.width/rect.width,y:(event.clientY-rect.top)*SPACE.height/rect.height};
  if(!canStand(point)) {log('此处无法容纳完整脚底，请点地面内部。');canvas.focus();return;}
  navigate([point],`地面 (${Math.round(point.x)}, ${Math.round(point.y)})`);
});
function operate() {
  if(controller.paused||!controller.focused) return;
  const nearby=reachableDevices(controller.state).sort((a,b)=>Math.hypot(a.anchor.x-controller.state.x,a.anchor.y-controller.state.y)-Math.hypot(b.anchor.x-controller.state.x,b.anchor.y-controller.state.y));
  if(!nearby.length) {lastInteraction='此处没有同层、无遮挡且在范围内的装置。';return;}
  const device=nearby[0];visited.add(device.id);lastInteraction=`${device.label} · E 操作成功`;
  document.querySelector(`[data-device="${device.id}"]`).dataset.visited='true';log(lastInteraction);
}
const movementKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD']);
window.addEventListener('keydown',event=>{
  if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement) return;
  if(movementKeys.has(event.code)) {event.preventDefault();if(controller.paused)return;cancelNavigation('键盘');controller.keys.add(event.code);}
  if(event.code==='KeyE'&&!event.repeat) {event.preventDefault();operate();}
  if(event.code==='Escape') {event.preventDefault();togglePause();}
});
window.addEventListener('keyup',event=>controller.keys.delete(event.code));
function refreshFocus() {
  const focused=!document.hidden&&document.hasFocus();setFocus(controller,focused);
  if(!focused) {cancelNavigation('失焦停止');log('失焦：清空方向键并停止导航。');}
  lastTime=performance.now();
}
window.addEventListener('blur',refreshFocus);window.addEventListener('focus',refreshFocus);
document.addEventListener('visibilitychange',refreshFocus);
function togglePause() {
  setPaused(controller,!controller.paused);cancelNavigation(controller.paused?'已暂停':'待机');
  $('pause').textContent=controller.paused?'恢复':'暂停';$('pause').setAttribute('aria-pressed',String(controller.paused));
  lastTime=performance.now();
}
$('pause').addEventListener('click',togglePause);
$('reset').addEventListener('click',()=>{
  controller.state=createState();controller.keys.clear();setPaused(controller,false);cancelNavigation('复位');
  visited.clear();trail=[{...controller.state}];walkedFrames=0;lastInteraction='已复位；六点操作记录清空。';
  for(const button of document.querySelectorAll('[data-device]')) button.dataset.visited='false';
  $('pause').textContent='暂停';$('pause').setAttribute('aria-pressed','false');canvas.focus();log('回到起点。');
});
$('show-collision').addEventListener('change',event=>collisionVisible=event.target.checked);
$('show-trail').addEventListener('change',event=>trailVisible=event.target.checked);
function shape(points,fill,stroke='#b4bca7',width=2) {
  ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function text(label,x,y,color='#e7eddf',size=19,align='left') {ctx.font=`${size}px system-ui`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(label,x,y);}
function draw() {
  ctx.clearRect(0,0,SPACE.width,SPACE.height);ctx.fillStyle='#222722';ctx.fillRect(0,0,SPACE.width,SPACE.height);
  text('A / 路线与脚底占位',55,68,'#d4ddc9',28);text('1536 × 1024 · 图像坐标 · 独立候选',55,103,'#9faa94',20);
  text('上层装置前方留出连续走廊',335,340,'#acb79f',20);
  for(const id of ['leftRamp','rightRamp','main','upper']) shape(FLOORS[id],floorColors[id],'#8e997f',2);
  for(const [id,labelPoint] of Object.entries({main:{x:570,y:762},upper:{x:365,y:473},leftRamp:{x:82,y:552},rightRamp:{x:778,y:560}}))
    text(routeNames[id],labelPoint.x,labelPoint.y,'#d3dcc6',17,'center');
  if(trailVisible&&trail.length>1) {
    ctx.beginPath();trail.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));
    ctx.strokeStyle='#b9d1a26e';ctx.lineWidth=3;ctx.stroke();
  }
  if(collisionVisible) {
    for(const edge of OUTER_BOUNDARY) {
      ctx.beginPath();ctx.moveTo(edge.ax,edge.ay);ctx.lineTo(edge.ax+edge.dx,edge.ay+edge.dy);ctx.strokeStyle='#e1d4a1';ctx.lineWidth=2;ctx.stroke();
    }
  }
  for(const [index,device] of DEVICES.entries()) {
    const canUse=reachableDevices(controller.state).some(nearby=>nearby.id===device.id);
    shape(device.footprint,'#343b31',visited.has(device.id)?'#b6d295':'#b8c0ad',3);
    const cap=device.footprint.map(point=>({x:point.x,y:point.y-22}));
    ctx.save();ctx.globalAlpha=.72;shape(cap,'#4a5542','#9ba68e',1);ctx.restore();
    text(`${index+1} ${device.label}`,device.x,device.y-32,'#eff5e8',20,'center');
    if(collisionVisible) {
      ctx.beginPath();ctx.arc(device.anchor.x,device.anchor.y,SPACE.interactionRadius,0,Math.PI*2);
      ctx.strokeStyle=canUse?'#dcf8bb':'#c5d0b64d';ctx.lineWidth=1.5;ctx.setLineDash([4,6]);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(device.anchor.x,device.anchor.y,4,0,Math.PI*2);ctx.fillStyle='#dbe9c9';ctx.fill();
    }
    if(canUse) text('E',device.anchor.x,device.anchor.y+24,'#f1ffd8',22,'center');
  }
  const state=controller.state;
  if(collisionVisible) {ctx.beginPath();ctx.arc(state.x,state.y,SPACE.feetRadius,0,Math.PI*2);ctx.strokeStyle='#efffcf';ctx.lineWidth=2;ctx.stroke();}
  if(player.complete&&player.naturalWidth) {
    ctx.imageSmoothingEnabled=false;const width=SPACE.actorHeight*player.naturalWidth/player.naturalHeight;
    ctx.drawImage(player,state.x-width/2,state.y-SPACE.actorHeight,width,SPACE.actorHeight);
  } else {ctx.fillStyle='#ecf0e5';ctx.fillRect(state.x-8,state.y-SPACE.actorHeight,16,SPACE.actorHeight);}
  ctx.strokeStyle='#bcc8ac';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(1075,715);ctx.lineTo(1075,715-SPACE.actorHeight);ctx.stroke();
  text('原人物 52.8 px',1094,695,'#bcc8ac',20);text('脚底直径 28.8 px',1094,725,'#bcc8ac',20);
  text('几何校核 · 未接入正式场景',55,940,'#a8b49c',21);
  text('平台、坡道、实体占地是可碰撞模型；轨迹仅记录已经走过的位置。',55,974,'#9ea992',20);
}
function updateStatus() {
  const state=controller.state,nearby=reachableDevices(state);
  $('position').textContent=`${state.x.toFixed(1)}, ${state.y.toFixed(1)} · ${routeNames[state.route]} (${state.route})`;
  $('input-source').textContent=`${source} · ${controller.paused?'暂停':!controller.focused?'失焦停止':'运行'} · ${walkedFrames} 运动帧`;
  $('collision-state').textContent=`${canStand(state)?'完整脚底有效':'错误：脚底越界'} · 距碰撞余量 ${Math.max(0,clearance(state)).toFixed(1)} px`;
  $('nearby').textContent=nearby.map(device=>device.label).join(' / ')||'无';
  $('interaction-message').textContent=lastInteraction||'靠近装置后，实际按 E 记录一次操作。';
  $('visited').textContent=`${visited.size} / 6 · ${DEVICES.map(device=>`${visited.has(device.id)?'✓':'○'} ${device.label}`).join('　')}`;
}
function frame(time) {
  const delta=time-lastTime;lastTime=time;const before={...controller.state};
  if(controller.focused&&!controller.paused) {
    if(navigation.length) {
      stepMovement(controller.state,directionToward(controller.state,navigation[0],delta),delta);
      if(Math.hypot(controller.state.x-navigation[0].x,controller.state.y-navigation[0].y)<.05) navigation.shift();
      if(!navigation.length) {
        if(goals.length) {
          try {navigation=planPath(controller.state,goals.shift());}catch(error){cancelNavigation('导航停止');log(error.message);}
        } else {source=`已走到${targetLabel}`;log(source);}
      }
    } else stepController(controller,delta);
  }
  if(Math.hypot(before.x-controller.state.x,before.y-controller.state.y)>1e-6) {
    walkedFrames++;if(trail.length===0||Math.hypot(trail.at(-1).x-controller.state.x,trail.at(-1).y-controller.state.y)>2) trail.push({...controller.state});
    if(trail.length>6000) trail.shift();
  }
  if(!canStand(controller.state)) {setPaused(controller,true);cancelNavigation('碰撞异常，已停止');log('出现非法脚底位置，请保留坐标供复现。');}
  draw();if(time-lastStatusUpdate>100) {updateStatus();lastStatusUpdate=time;}
  requestAnimationFrame(frame);
}
fetch('./a-route-check.json').then(response=>{if(!response.ok)throw new Error('no report');return response.json();}).then(report=>{
  $('check-summary').textContent=`离线校核 ${report.status==='pass'?'通过':'失败'} · ${report.checks.length} 项 / ${report.metrics.frames.toLocaleString()} 帧`;
}).catch(()=>$('check-summary').textContent='未找到自动校核记录，请运行检查命令。');
refreshFocus();updateStatus();requestAnimationFrame(frame);
