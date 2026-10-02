/** DEV QA input driver. It never moves sprites or changes native movement rules. */
import { GAME_CONSTANTS } from '@/config/constants';
import type { PlayerMovementInputFrame } from '@/entities/player-movement-input';
import { bodyHasSupport, bodyDisplacementFraction } from '@/systems/ai/physical-grid';
import { TileGrid } from '@/systems/tile-grid';
import type { Vector2 } from '@/types/game-types';
import type { MasterWorld } from './world';
const BODY_HALF=GAME_CONSTANTS.PLAYER.BODY_SIZE*.5;
const DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1]] as const;
export interface PatrolRoute { readonly points: readonly Vector2[]; readonly stations: readonly {name:string;position:Vector2;index:number}[]; readonly distance:number }

export function createMasterPatrolRoute(world:MasterWorld,from:Readonly<Vector2>):PatrolRoute{
  const grid=new TileGrid(world.layout.tileMap),seats=new Uint8Array(grid.cols*grid.rows);
  const center=(i:number):Vector2=>({x:(i%grid.cols+.5)*grid.tileSize,y:(Math.floor(i/grid.cols)+.5)*grid.tileSize});
  for(let i=0;i<seats.length;i++)if(grid.isWalkable(i%grid.cols,Math.floor(i/grid.cols))&&bodyHasSupport(grid,center(i),BODY_HALF,BODY_HALF))seats[i]=1;
  const nearest=(point:Readonly<Vector2>,eligible:Uint8Array,requireSweep=false):number=>{
    let best=-1,distance=Infinity;
    for(let i=0;i<eligible.length;i++){if(!eligible[i])continue;const p=center(i),d=(p.x-point.x)**2+(p.y-point.y)**2;
      if(d<distance&&(!requireSweep||bodyDisplacementFraction(grid,point,BODY_HALF,BODY_HALF,p.x-point.x,p.y-point.y)===1)){best=i;distance=d;}}
    if(best<0)throw new Error('当前位置没有同侧、身体可达的巡查起点');return best;
  };
  let start=nearest(from,seats,true);const bounds=world.meshes[0]!.bounds;
  const desired=[
    {name:'侧缘',position:{x:bounds.minX-32,y:(bounds.minY+bounds.maxY)*.5}},
    {name:'背面',position:{x:(bounds.minX+bounds.maxX)*.5,y:bounds.minY-32}},
    {name:'另一侧缘',position:{x:bounds.maxX+32,y:(bounds.minY+bounds.maxY)*.5}},
    {name:'搜取点',position:world.layout.kindlingNodes[0]!.position},
    {name:'回到入口',position:world.layout.spawnPoint},
  ];
  const points:Vector2[]=[center(start)],stations:{name:string;position:Vector2;index:number}[]=[];
  let distance=Math.hypot(points[0]!.x-from.x,points[0]!.y-from.y);
  for(const target of desired){
    const parent=new Int32Array(seats.length).fill(-1),reachable=new Uint8Array(seats.length),queue=[start];parent[start]=start;reachable[start]=1;
    for(let at=0;at<queue.length;at++){
      const cell=queue[at]!,col=cell%grid.cols,row=Math.floor(cell/grid.cols),p=center(cell);
      for(const[dx,dy]of DIRECTIONS){const c=col+dx,r=row+dy,next=r*grid.cols+c;
        if(c<0||r<0||c>=grid.cols||r>=grid.rows||!seats[next]||reachable[next])continue;
        if(bodyDisplacementFraction(grid,p,BODY_HALF,BODY_HALF,dx*grid.tileSize,dy*grid.tileSize)<1)continue;
        parent[next]=cell;reachable[next]=1;queue.push(next);
      }
    }
    const end=nearest(target.position,reachable),reverse=[end];
    while(reverse[reverse.length-1]!==start)reverse.push(parent[reverse[reverse.length-1]!]!);
    reverse.reverse();
    for(let i=1;i<reverse.length;i++){points.push(center(reverse[i]!));distance+=grid.tileSize;}
    stations.push({name:target.name,position:center(end),index:points.length-1});start=end;
  }
  return{points,stations,distance};
}
export class MasterPatrol {
  private route:PatrolRoute|null=null;
  private index=0;
  private readonly direction:Vector2={x:0,y:0};
  private readonly previous:Vector2={x:0,y:0};
  private elapsedMs=0;
  private distance=0;
  private stalledMs=0;
  private stationIndex=0;
  private dwellMs=0;
  private status='未启动';
  private running=false;
  private readonly samples=Array.from({length:600},()=>({elapsedMs:0,x:0,y:0,distance:0}));
  private sampleCount=0;
  private sampleWrite=0;
  private lastSampleMs=-Infinity;
  start(route:PatrolRoute,position:Readonly<Vector2>):void{
    this.route=route;this.index=0;this.elapsedMs=0;this.distance=0;this.stalledMs=0;this.stationIndex=0;this.dwellMs=0;
    this.direction.x=0;this.direction.y=0;this.previous.x=position.x;this.previous.y=position.y;this.sampleCount=0;this.sampleWrite=0;this.lastSampleMs=-Infinity;this.running=true;this.status='沿边巡查';
  }
  stop(reason='手动停止'):void{this.running=false;this.status=reason;this.direction.x=0;this.direction.y=0;}
  get active():boolean{return this.running;}
  readonly readInput=(frame:PlayerMovementInputFrame):Readonly<Vector2>|null=>{
    if(frame.keyboardActive){if(this.running)this.stop('真实键盘接管');return null;}
    if(!this.running||!this.route)return null;
    const dt=Math.max(0,Math.min(frame.deltaMs,100)),travel=Math.hypot(frame.position.x-this.previous.x,frame.position.y-this.previous.y);
    this.elapsedMs+=dt;this.distance+=travel;this.previous.x=frame.position.x;this.previous.y=frame.position.y;
    // A bounded ring of diagnostics; only once per half-second, never each frame.
    if(this.elapsedMs-this.lastSampleMs>=500){
      const sample=this.samples[this.sampleWrite]!;sample.elapsedMs=this.elapsedMs;sample.x=frame.position.x;sample.y=frame.position.y;sample.distance=this.distance;
      this.sampleWrite=(this.sampleWrite+1)%this.samples.length;this.sampleCount=Math.min(this.samples.length,this.sampleCount+1);this.lastSampleMs=this.elapsedMs;
    }
    if(this.dwellMs>0){this.dwellMs-=dt;this.direction.x=0;this.direction.y=0;return this.direction;}
    this.stalledMs=travel<.02?this.stalledMs+dt:0;
    if(this.stalledMs>2200){this.stop('碰撞或阻挡持续 2.2 秒，巡查退出');return this.direction;}
    let point=this.route.points[this.index];
    while(point&&Math.hypot(point.x-frame.position.x,point.y-frame.position.y)<2.3){
      let station=this.route.stations[this.stationIndex];
      // Tiny or edge-clipped layouts may place two named stations on one seat.
      while(station?.index===this.index){this.status=`观察：${station.name}`;this.stationIndex++;this.dwellMs=650;station=this.route.stations[this.stationIndex];}
      this.index++;point=this.route.points[this.index];
      if(this.dwellMs>0){this.direction.x=0;this.direction.y=0;return this.direction;}
    }
    if(!point){this.stop('巡查完成');return this.direction;}
    const dx=point.x-frame.position.x,dy=point.y-frame.position.y,length=Math.hypot(dx,dy);
    this.direction.x=dx/length;this.direction.y=dy/length;
    return this.direction;
  };
  snapshot():unknown{return{active:this.running,status:this.status,elapsedMs:this.elapsedMs,distance:this.distance,targetIndex:this.index,
    plannedDistance:this.route?.distance??0,stations:this.route?.stations??[],position:{...this.previous},samples:this.sampleCount<this.samples.length?this.samples.slice(0,this.sampleCount):this.samples.slice(this.sampleWrite).concat(this.samples.slice(0,this.sampleWrite)),
    method:'DEV-generated BFS intent through native Player acceleration/facing/collision; not a human playtest'};}
}
