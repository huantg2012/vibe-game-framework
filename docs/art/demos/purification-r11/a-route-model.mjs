/** R11 A candidate only. All values use 1536 × 1024 image pixels (world × 2.4).
 * Continuous circle sweep / union boundary / sliding adapted from
 * src/systems/purification-chamber-locomotion.ts; no production scene is modified.
 */
export const SPACE = Object.freeze({ width: 1536, height: 1024, worldScale: 2.4,
  // src/config/constants.ts PLAYER.SPEED = 80 world px/s.
  actorHeight: 52.8, feetRadius: 14.4, interactionRadius: 57.6, speed: 80 * 2.4, maxStepMs: 100 });
const polygon = (points) => points.map(([x, y]) => ({ x, y }));
export const FLOORS = {
  main: polygon([[45,640],[145,620],[252,620],[441,607],[797,620],[935,610],
    [950,638],[891,700],[540,790],[235,816],[157,795],[90,722]]),
  upper: polygon([[110,397],[625,385],[670,457],[620,480],[140,500],[100,458]]),
  leftRamp: polygon([[45,666],[135,666],[198,462],[109,462]]),
  rightRamp: polygon([[574,482],[643,453],[952,606],[866,669]]),
};
const bevelBox = (x, y, rx, ry, bevel = 8) => polygon([
  [x-rx+bevel,y-ry],[x+rx-bevel,y-ry],[x+rx,y-ry+bevel],
  [x+rx,y+ry-bevel],[x+rx-bevel,y+ry],[x-rx+bevel,y+ry],
  [x-rx,y+ry-bevel],[x-rx,y-ry+bevel],
]);
export const DEVICES = [
  { id:'core', label:'核心', floor:'main', x:386, y:676, rx:77, ry:23, height:194, anchor:{x:386,y:730} },
  { id:'storage', label:'储藏', floor:'main', x:223, y:727, rx:58, ry:20, height:100, anchor:{x:223,y:773} },
  { id:'purifier', label:'净化器', floor:'main', x:663, y:627, rx:62, ry:18, height:67, anchor:{x:650,y:674} },
  { id:'growth', label:'蜕变', floor:'upper', x:230, y:410, rx:30, ry:13, height:108, anchor:{x:230,y:453} },
  { id:'offering', label:'供奉', floor:'upper', x:535, y:410, rx:45, ry:14, height:95, anchor:{x:535,y:451} },
  { id:'rift', label:'裂隙', floor:'main', x:715, y:670, rx:46, ry:16, height:64, anchor:{x:785,y:695} },
].map(device => ({...device, footprint:bevelBox(device.x,device.y,device.rx,device.ry)}));
export const SPAWN = Object.freeze({x:460,y:734});
export const WAYPOINTS = Object.freeze({
  leftBottom:{x:90,y:652}, leftMiddle:{x:120,y:562}, leftTop:{x:155,y:480},
  upperMiddle:{x:370,y:458}, rightTop:{x:620,y:476}, rightMiddle:{x:762,y:554},
  rightBottom:{x:897,y:629}, coreFront:{x:386,y:757}, mainRight:{x:818,y:665},
});
const EPSILON = 1e-8;
const CONTACT_EPSILON = 1e-7;
// Stop infinitesimally before contact. This prevents floating-point endpoint
// cancellation from putting the next sweep behind a corner (negative hit time).
const CONTACT_SKIN = 1e-4;
const WALK_POLYGONS = Object.values(FLOORS);
const DEVICE_POLYGONS = DEVICES.map(device => device.footprint);
export function containsPoint(poly, x, y) {
  let inside = false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[j],b=poly[i],dx=b.x-a.x,dy=b.y-a.y;
    const cross=(x-a.x)*dy-(y-a.y)*dx;
    if(Math.abs(cross)<EPSILON && (x-a.x)*(x-b.x)+(y-a.y)*(y-b.y)<=EPSILON) return true;
    if((a.y>y)!==(b.y>y) && x<a.x+(y-a.y)*dx/dy) inside=!inside;
  }
  return inside;
}
const containsWalkPoint=(x,y)=>WALK_POLYGONS.some(poly=>containsPoint(poly,x,y));
function makeSegment(ax,ay,bx,by) {
  const dx=bx-ax,dy=by-ay,lengthSquared=dx*dx+dy*dy,length=Math.sqrt(lengthSquared);
  return {ax,ay,dx,dy,lengthSquared,nx:-dy/length,ny:dx/length};
}
const polygonSegments=poly=>poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return makeSegment(a.x,a.y,b.x,b.y);});
function squaredDistanceToSegment(x,y,edge) {
  const t=Math.max(0,Math.min(1,((x-edge.ax)*edge.dx+(y-edge.ay)*edge.dy)/edge.lengthSquared));
  return (x-edge.ax-t*edge.dx)**2+(y-edge.ay-t*edge.dy)**2;
}
function compileWalkBoundary() {
  const raw=WALK_POLYGONS.flatMap(polygonSegments),result=[];
  for(const edge of raw) {
    const cuts=[0,1];
    for(const other of raw) {
      const ox=other.ax-edge.ax,oy=other.ay-edge.ay,denominator=edge.dx*other.dy-edge.dy*other.dx;
      if(Math.abs(denominator)>EPSILON) {
        const t=(ox*other.dy-oy*other.dx)/denominator,u=(ox*edge.dy-oy*edge.dx)/denominator;
        if(t>EPSILON && t<1-EPSILON && u>=-EPSILON && u<=1+EPSILON) cuts.push(t);
      } else if(Math.abs(ox*edge.dy-oy*edge.dx)<EPSILON) {
        for(const end of [0,1]) {
          const t=((ox+other.dx*end)*edge.dx+(oy+other.dy*end)*edge.dy)/edge.lengthSquared;
          if(t>EPSILON && t<1-EPSILON) cuts.push(t);
        }
      }
    }
    cuts.sort((a,b)=>a-b);
    for(let i=1;i<cuts.length;i++) {
      const start=cuts[i-1],end=cuts[i];
      if(end-start<EPSILON) continue;
      const middle=(start+end)/2,x=edge.ax+edge.dx*middle,y=edge.ay+edge.dy*middle;
      if(containsWalkPoint(x+edge.nx*.01,y+edge.ny*.01)===containsWalkPoint(x-edge.nx*.01,y-edge.ny*.01)) continue;
      result.push(makeSegment(edge.ax+edge.dx*start,edge.ay+edge.dy*start,edge.ax+edge.dx*end,edge.ay+edge.dy*end));
    }
  }
  return result;
}
export const OUTER_BOUNDARY=compileWalkBoundary();
export const BOUNDARIES=[...OUTER_BOUNDARY,...DEVICE_POLYGONS.flatMap(polygonSegments)];
export function routeAt(position) {
  for(const [route,poly] of Object.entries(FLOORS)) if(containsPoint(poly,position.x,position.y)) return route;
  return null;
}
export function clearance(position) {
  return Math.min(...BOUNDARIES.map(edge=>Math.sqrt(squaredDistanceToSegment(position.x,position.y,edge))))-SPACE.feetRadius;
}
export function canStand(position) {
  if(!Number.isFinite(position.x)||!Number.isFinite(position.y)||!containsWalkPoint(position.x,position.y)) return false;
  if(DEVICE_POLYGONS.some(poly=>containsPoint(poly,position.x,position.y))) return false;
  return BOUNDARIES.every(edge=>squaredDistanceToSegment(position.x,position.y,edge)>=SPACE.feetRadius**2-CONTACT_EPSILON);
}
export function createState(position=SPAWN) {
  if(!canStand(position)) throw new Error(`Invalid circular-foot spawn: ${JSON.stringify(position)}`);
  return {x:position.x,y:position.y,route:routeAt(position)};
}
// Synchronous shared scratch state, as in the source implementation.
const hit={time:1,nx:0,ny:0};
function recordHit(time,nx,ny,vx,vy) {
  if(time>=-EPSILON && time<hit.time && vx*nx+vy*ny<-EPSILON) {
    hit.time=Math.max(0,time);hit.nx=nx;hit.ny=ny;
  }
}
function sweepEndpoint(x,y,vx,vy,ex,ey) {
  const ox=x-ex,oy=y-ey,a=vx*vx+vy*vy,b=ox*vx+oy*vy;
  if(b>=0) return;
  const c=ox*ox+oy*oy-SPACE.feetRadius**2,discriminant=b*b-a*c;
  if(discriminant<0) return;
  const time=(-b-Math.sqrt(discriminant))/a,nx=ox+vx*Math.max(0,time),ny=oy+vy*Math.max(0,time),length=Math.hypot(nx,ny);
  recordHit(time,nx/length,ny/length,vx,vy);
}
function sweepCircle(x,y,vx,vy) {
  hit.time=1;hit.nx=0;hit.ny=0;
  for(const edge of BOUNDARIES) {
    const distance=(x-edge.ax)*edge.nx+(y-edge.ay)*edge.ny,velocity=vx*edge.nx+vy*edge.ny,side=distance>=0?1:-1;
    if(velocity*side<-EPSILON) {
      const time=(side*SPACE.feetRadius-distance)/velocity;
      const projection=((x+vx*time-edge.ax)*edge.dx+(y+vy*time-edge.ay)*edge.dy)/edge.lengthSquared;
      if(projection>=0 && projection<=1) recordHit(time,edge.nx*side,edge.ny*side,vx,vy);
    }
    sweepEndpoint(x,y,vx,vy,edge.ax,edge.ay);
    sweepEndpoint(x,y,vx,vy,edge.ax+edge.dx,edge.ay+edge.dy);
  }
}
export function stepMovement(state,input,deltaMs,speed=SPACE.speed) {
  if(!Number.isFinite(deltaMs)||deltaMs<=0||!Number.isFinite(speed)||speed<=0) return;
  if(!Number.isFinite(input.x)||!Number.isFinite(input.y)) return;
  const inputLength=Math.hypot(input.x,input.y);
  if(inputLength<=EPSILON) return;
  const travel=Math.min(deltaMs,SPACE.maxStepMs)*speed/1000;
  let vx=input.x/Math.max(1,inputLength)*travel,vy=input.y/Math.max(1,inputLength)*travel;
  for(let contact=0;contact<6 && Math.hypot(vx,vy)>EPSILON;contact++) {
    sweepCircle(state.x,state.y,vx,vy);
    const safeTime=hit.time===1?1:Math.max(0,hit.time-CONTACT_SKIN/Math.hypot(vx,vy));
    state.x+=vx*safeTime;state.y+=vy*safeTime;
    if(hit.time===1) break;
    vx*=1-hit.time;vy*=1-hit.time;
    const intoWall=vx*hit.nx+vy*hit.ny;
    vx-=intoWall*hit.nx;vy-=intoWall*hit.ny;
  }
  const route=routeAt(state);
  if(route!==null) state.route=route;
}
export function canInteract(state,device) {
  if(state.route!==device.floor || Math.hypot(device.anchor.x-state.x,device.anchor.y-state.y)>SPACE.interactionRadius) return false;
  const dx=device.anchor.x-state.x,dy=device.anchor.y-state.y;
  if(Math.hypot(dx,dy)<=EPSILON) return true;
  sweepCircle(state.x,state.y,dx,dy);
  return hit.time===1;
}
export function reachableDevices(state) { return DEVICES.filter(device=>canInteract(state,device)); }
/** Browser and Node tests share focus / pause behavior as well as movement. */
export function createController() {
  return {state:createState(),keys:new Set(),focused:true,paused:false};
}
export function setFocus(controller,focused) {
  controller.focused=focused;
  if(!focused) controller.keys.clear();
}
export function setPaused(controller,paused) {
  controller.paused=paused;
  if(paused) controller.keys.clear();
}
export function stepController(controller,deltaMs) {
  if(!controller.focused || controller.paused) return;
  const k=controller.keys;
  stepMovement(controller.state,{x:Number(k.has('ArrowRight')||k.has('KeyD'))-Number(k.has('ArrowLeft')||k.has('KeyA')),
    y:Number(k.has('ArrowDown')||k.has('KeyS'))-Number(k.has('ArrowUp')||k.has('KeyW'))},deltaMs);
}

// A* supplies direction inputs; every movement frame still goes through stepMovement.
const GRID=8;
let navGrid;
const nodeKey=(x,y)=>`${x},${y}`;
function getNavGrid() {
  if(navGrid) return navGrid;
  navGrid=new Map();
  for(let y=376;y<=824;y+=GRID) for(let x=40;x<=960;x+=GRID) {
    const point={x,y};if(canStand(point)&&clearance(point)>=2) navGrid.set(nodeKey(x,y),point);
  }
  return navGrid;
}
export function segmentIsClear(a,b) {
  if(!canStand(a)||!canStand(b)) return false;
  if(Math.hypot(a.x-b.x,a.y-b.y)<EPSILON) return true;
  sweepCircle(a.x,a.y,b.x-a.x,b.y-a.y);return hit.time===1;
}
function nearestNode(point) {
  const candidates=[...getNavGrid().values()].sort((a,b)=>(a.x-point.x)**2+(a.y-point.y)**2-((b.x-point.x)**2+(b.y-point.y)**2));
  return candidates.find(candidate=>segmentIsClear(point,candidate));
}
export function planPath(start,goal) {
  if(!canStand(start)||!canStand(goal)) throw new Error(`Unstandable route endpoint ${JSON.stringify({start,goal})}`);
  if(segmentIsClear(start,goal)) return [{...goal}];
  const grid=getNavGrid(),first=nearestNode(start),last=nearestNode(goal);
  if(!first||!last) throw new Error('No route endpoint connector');
  const firstKey=nodeKey(first.x,first.y),lastKey=nodeKey(last.x,last.y),open=new Set([firstKey]);
  const scores=new Map([[firstKey,0]]),parents=new Map();
  while(open.size) {
    let currentKey,best=Infinity;
    for(const key of open) {
      const node=grid.get(key),score=scores.get(key)+Math.hypot(last.x-node.x,last.y-node.y);
      if(score<best) {best=score;currentKey=key;}
    }
    if(currentKey===lastKey) {
      const path=[{...goal}];let key=currentKey;
      while(key) {path.push(grid.get(key));key=parents.get(key);}
      path.reverse();
      const smooth=[];let from=start,index=0;
      while(index<path.length) {
        let far=index;
        while(far+1<path.length && segmentIsClear(from,path[far+1])) far++;
        smooth.push(path[far]);from=path[far];index=far+1;
      }
      return smooth;
    }
    open.delete(currentKey);
    const current=grid.get(currentKey);
    for(const dx of [-GRID,0,GRID]) for(const dy of [-GRID,0,GRID]) {
      if(!dx&&!dy) continue;
      const key=nodeKey(current.x+dx,current.y+dy),neighbor=grid.get(key);
      if(!neighbor||!segmentIsClear(current,neighbor)) continue;
      const score=scores.get(currentKey)+Math.hypot(dx,dy);
      if(score<(scores.get(key)??Infinity)) {scores.set(key,score);parents.set(key,currentKey);open.add(key);}
    }
  }
  throw new Error('No circular-foot route exists');
}
export function directionToward(state,target,deltaMs=1000/60) {
  const dx=target.x-state.x,dy=target.y-state.y,distance=Math.hypot(dx,dy),travel=SPACE.speed*Math.min(deltaMs,SPACE.maxStepMs)/1000;
  if(distance===0) return {x:0,y:0};
  const amount=Math.min(1,distance/travel);
  return {x:dx/distance*amount,y:dy/distance*amount};
}
