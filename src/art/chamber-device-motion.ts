import type { ChamberPixels, ChamberPoint } from './purification-chamber-pixels';
import type { ChamberDevice } from '../systems/purification-chamber-layout';

export type ChamberActivityKind = 'repair' | 'growth' | 'offering' | 'offering-complete';
export interface ChamberActivityState {
  /** Fixed-100 public efficiency, not hp / maxHp. */
  core: number;
  storage: number;
  purifier: number;
  /** Occupied slots / slot limit; never interpreted as charge or maturity. */
  offeringOccupancy: number;
}
export interface CoreMotion {
  frame: number;
  contraction: number;
  light: number;
  shiver: number;
  repairStage: 'idle' | 'close' | 'gather' | 'settle';
}
export interface DeviceAtlasSpec {
  width: number; height: number; originX: number; originY: number; frames: number;
}
export const DEVICE_ACTIVITY_ATLASES: Readonly<Record<ChamberDevice, DeviceAtlasSpec>> = {
  core: { width: 64, height: 104, originX: 32, originY: 98, frames: 36 },
  storage: { width: 48, height: 48, originX: 24, originY: 44, frames: 24 },
  purifier: { width: 64, height: 48, originX: 32, originY: 44, frames: 24 },
  growth: { width: 48, height: 64, originX: 24, originY: 60, frames: 24 },
  offering: { width: 56, height: 56, originX: 28, originY: 50, frames: 32 },
  rift: { width: 64, height: 40, originX: 32, originY: 22, frames: 24 },
};
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };
const phase = (time: number, duration: number): number => ((time % duration) + duration) % duration / duration;

/** Three unequal breaths; pauses belong to the gesture, not a scene-wide sine wave. */
export function sampleCoreMotion(timeMs: number, health: number, reducedMotion = false,
  pulseAgeMs = Infinity): CoreMotion {
  const efficiency = clamp(health);
  let contraction = .4;
  let frame = 6;
  let shiver = 0;
  let repairStage: CoreMotion['repairStage'] = 'idle';
  if (!reducedMotion) {
    let elapsed = phase(timeMs, 19200) * 19200;
    const duration = elapsed < 6200 ? 6200 : elapsed < 13600 ? 7400 : 5600;
    if (elapsed >= 13600) elapsed -= 13600;
    else if (elapsed >= 6200) elapsed -= 6200;
    const t = elapsed / duration;
    contraction = t < .18 ? .12 : t < .47 ? .12 + .83 * smooth((t - .18) / .29)
      : t < .59 ? .95 : t < .91 ? .95 - .83 * smooth((t - .59) / .32) : .12;
    // Current damage produces a held lobe, not a stronger or brighter alarm.
    if (efficiency < .25 && t > .35 && t < .72) contraction = .38;
    frame = Math.round(contraction * 15);
    const rareTime = phase(timeMs, 108000) * 108000;
    for (const onset of [26700, 62200, 92400]) {
      const age = rareTime - onset;
      if (age >= 0 && age < 240) {
        const step = Math.min(3, Math.floor(age / 60));
        frame = 32 + step;
        shiver = [1, -1, 1, 0][step]!;
      }
    }
  }
  if (pulseAgeMs >= 0 && pulseAgeMs < 1680) {
    const t = pulseAgeMs / 1680;
    repairStage = t < .2 ? 'close' : t < .61 ? 'gather' : 'settle';
    contraction = t < .2 ? .4 + .55 * smooth(t / .2)
      : t < .61 ? .95 : .95 - .55 * smooth((t - .61) / .39);
    frame = reducedMotion ? 6 : 16 + Math.min(15, Math.floor(t * 16));
    shiver = 0;
  }
  const light = (.415 + .105 * contraction) * (.18 + .82 * efficiency)
    + (repairStage !== 'idle' ? .022 * Math.sin(Math.PI * clamp(pulseAgeMs / 1680)) : 0);
  return { frame, contraction, light, shiver, repairStage };
}

/** Pose selection is deterministic and never consumes the gameplay RNG. */
export function sampleDeviceActivityFrame(id: ChamberDevice, timeMs: number, health: number,
  reducedMotion = false, pulseAgeMs = Infinity): number {
  if (id === 'core') return sampleCoreMotion(timeMs, health, reducedMotion, pulseAgeMs).frame;
  if (reducedMotion) return id === 'growth' ? 4 : 0;
  if (pulseAgeMs >= 0 && pulseAgeMs < 1440) return 16 + Math.min(7, Math.floor(pulseAgeMs / 180));
  if (id === 'storage') {
    const t = phase(timeMs + 2300, 17300);
    return t < .9 ? 0 : Math.min(15, Math.floor((t - .9) * 160));
  }
  if (id === 'offering') {
    const t = phase(timeMs + 7700, 13700);
    return t < .92 ? 0 : Math.min(15, Math.floor((t - .92) * 200));
  }
  if (id === 'growth') return Math.floor(phase(timeMs + 900, 7900) * 16);
  if (id === 'purifier') {
    const t = phase(timeMs + 3700, 11300);
    if (health < .25 && t > .25 && t < .7) return 5;
    return t > .48 ? 0 : Math.min(15, Math.floor(t / .48 * 16));
  }
  const t = phase(timeMs + 1800, 5700);
  return t > .79 ? 0 : Math.min(15, Math.floor(t / .79 * 16));
}

/** Secondary light follows the same work phase as its painted medium, not another oscillator. */
export function sampleDeviceLight(id: 'growth' | 'purifier', timeMs: number, health: number,
  reducedMotion = false, pulseAgeMs = Infinity): number {
  const frame = sampleDeviceActivityFrame(id, timeMs, health, reducedMotion, pulseAgeMs);
  const t = frame >= 16 ? (frame - 16) / 7 : frame / 15;
  const wave = 1 - Math.abs(t * 2 - 1);
  const event = pulseAgeMs >= 0 && pulseAgeMs < 1440
    ? .025 * Math.sin(Math.PI * pulseAgeMs / 1440) : 0;
  return id === 'growth' ? .068 + .016 * wave + event
    : (.101 + .024 * wave + event) * Math.max(.1, clamp(health));
}

const c = {
  void: '#0b1114', cavity: '#142526', blackGlass: '#102726', deep: '#16463f',
  body: '#1c6659', middle: '#268773', live: '#43b79a', light: '#86d0b4',
  steel: '#535b60', edge: '#747c7c', clasp: '#74614b', shadow: '#242c31',
};
function coreFrame(p: ChamberPixels, frame: number, health: number): void {
  const repair = frame >= 16 && frame < 32;
  const step = repair ? (frame - 16) / 15 : 0;
  const contraction = frame < 16 ? frame / 15 : repair
    ? step < .2 ? .4 + .55 * smooth(step / .2) : step < .61 ? .95 : .95 - .55 * smooth((step - .61) / .39)
    : .48;
  const squeeze = Math.round(contraction * 3);
  const right = 10 - squeeze;
  const left = -10 + Math.round(contraction * 2);
  const lift = Math.round(contraction * 2);
  const shiver = frame >= 32 ? [1, -1, 1, 0][frame - 32]! : 0;
  const damaged = health < .25;
  const body = damaged ? c.deep : c.body;
  const middle = damaged ? c.body : c.middle;
  const live = health < 1 ? c.middle : c.live;
  // Three joined, captive folds. Silhouette and internal turn both change between poses.
  p.poly([[left,-67],[left+4,-74],[1,-72],[right-1,-64],[right,-57],
    [right-3,-50+lift],[right+1,-39],[right-2,-29],[-1,-21],[-7,-26],
    [left+1,-36],[left,-43],[-6,-52],[left-1,-60]], c.deep);
  p.poly([[left+2,-66],[left+5,-71],[0,-69],[right-3,-62],
    [right-1,-57],[3,-51+lift],[right-2,-40],[right-4,-30],[-1,-26],
    [-5,-30],[-7,-39],[-4,-47],[-5,-53],[left+1,-60]], body);
  p.poly([[-5,-66],[-2,-69],[2,-64+lift],[1,-61],[right-3,-57],
    [3,-53+lift],[-1,-55],[-2,-60],[-6,-62]], middle);
  p.poly([[-1,-49+lift],[3,-47],[right-3,-42],[3,-37],[-1,-34],
    [-4,-38],[-3,-43]], middle);
  p.poly([[-3,-32],[1,-34],[3,-30],[-1,-26],[-4,-28]], body);
  p.poly([[-3,-64],[-1,-66],[1,-62],[0,-59],[-2,-60],[-4,-62]], live);
  p.line(-1,-48+lift,2,-44+lift,live);
  p.line(2,-44+lift,0,-40+lift,live);
  if (!damaged) {
    p.rect(-2,-63,1,2, health >= 1 ? c.light : c.live);
    p.rect(1,-44+lift,1,1,c.light);
  }
  // These small cross-pieces cover their neutral seats; the heavy shell never shakes.
  p.poly([[-15,-58],[-11+shiver,-59],[-6+shiver,-56],[-6+shiver,-53],[-12,-54],[-15,-55]],c.clasp);
  p.line(-14,-58,-10+shiver,-58,c.edge);
  p.poly([[6-shiver,-37],[13,-39],[16,-38],[16,-35],[10,-33],[6-shiver,-34]],c.clasp);
  p.line(8-shiver,-36,13,-38,c.steel);
  if (repair && step < .22) {
    p.rect(-3,-22,6,2,c.steel);
    p.rect(-2,-24,4,2,c.edge);
  }
  if (repair && step > .61 && step < .94) p.line(-3,-30,1,-27,c.live);
}

function storageFrame(p: ChamberPixels, frame: number, health: number): void {
  const repair = frame >= 16;
  const t = repair ? (frame - 16) / 7 : frame / 15;
  const drop = frame === 0 ? 0 : t > .2 && t < .7 ? 1 : 0;
  p.poly([[-9,-33],[-4,-36],[9,-35],[12,-32],[6,-30],[-6,-30]],c.void);
  p.poly([[-6,-33],[-2,-34],[6,-33],[3,-32],[-4,-32]],health < .25 ? c.cavity : c.deep);
  p.poly([[-9,-34+drop],[-4,-36+drop],[9,-35+drop],[10,-34+drop],[3,-34+drop],[-5,-33+drop]],c.steel);
  p.line(-7,-34+drop,-2,-35+drop,c.edge);
  if (frame > 2 && frame < 11) p.rect(Math.round(-3+t*6),-33,2,1,c.body);
  if (repair && t > .35 && t < .78) p.line(-7,-33,4,-32,c.middle);
}

function purifierFrame(p: ChamberPixels, frame: number, health: number): void {
  const event = frame >= 16;
  const t = event ? (frame - 16) / 7 : frame / 15;
  p.poly([[-13,-27],[-3,-26],[-3,-13],[-13,-14]],c.blackGlass);
  p.poly([[2,-25],[12,-25],[12,-11],[2,-12]],c.cavity);
  const level = Math.round(t * 6);
  p.poly([[-12,-24+level],[-9,-25+level],[-5,-23+level],[-4,-14],[-12,-15]],c.deep);
  p.line(-11,-23+level,-8,-22+level,health < .25 ? c.body : c.middle);
  const rightFlow = t < .38 ? 0 : Math.round((t-.38)/.62*5);
  p.poly([[3,-15-rightFlow],[7,-17-rightFlow],[11,-15-rightFlow],[11,-12],[3,-13]],c.deep);
  if (t > .4 && health >= .25) p.line(5,-15-rightFlow,9,-14-rightFlow,event ? c.live : c.body);
  if (event && t > .15 && t < .65) p.rect(-8,-22+level,1,2,c.live);
}

function growthFrame(p: ChamberPixels, frame: number): void {
  const event = frame >= 16;
  const t = event ? (frame - 16) / 7 : frame / 15;
  const drift = t > .25 && t < .72 ? 1 : 0;
  // Cover only liquid, leaving the rigid vessel, seals and glass edges visible.
  p.rect(-8,-41,18,29,c.deep);
  p.poly([[-7,-39],[-4,-41],[4,-40],[9,-34],[7,-25],[9,-18],[6,-13],[-5,-14],[-6,-24]],c.body);
  p.poly([[1+drift,-36],[5+drift,-35],[6+drift,-31],[4+drift,-29],
    [5+drift,-25],[7+drift,-22],[4+drift,-17],[0+drift,-18],[-1+drift,-23],[1+drift,-28]],c.deep);
  p.line(-7,-37,-7,-29,c.middle);
  const rises = [Math.floor(t*18),Math.floor(((t+.47)%1)*16)];
  p.rect(-5,-19-rises[0]!,1,2,event ? c.live : c.middle);
  if (t > .2 && t < .72) p.rect(7,-17-rises[1]!,1,1,c.middle);
  if (event) p.line(-2,-15-Math.round(t*22),3,-15-Math.round(t*22),c.live);
}

function offeringFrame(p: ChamberPixels, frame: number, occupied: boolean): void {
  const complete = frame >= 24;
  const event = frame >= 16;
  const t = complete ? (frame - 24) / 7 : event ? (frame - 16) / 7 : frame / 15;
  const close = complete ? (t > .15 && t < .6 ? -1 : 0)
    : frame !== 0 && t > .3 && t < .7 ? 1 : 0;
  p.poly([[-11,-28],[-6+close,-26],[-6+close,-24],[-12,-26]],c.clasp);
  p.line(-11,-28,-7+close,-27,c.steel);
  p.poly([[9-close,-18],[15,-20],[16,-18],[10-close,-15]],c.clasp);
  if (complete) {
    // The item has already transformed and left the slot. Only a brief anonymous remnant recedes.
    if (t < .72) {
      const y = -24 + Math.round(t * 8);
      p.line(-1, y, 1, y + 2, t < .3 ? c.middle : c.deep);
      if (t < .3) p.rect(2, y - 2, 1, 1, c.body);
    }
    return;
  }
  if (!occupied) return;
  const shift = close;
  p.poly([[-4,-28],[-1,-31],[4,-29],[7,-25],[5,-20],[-1,-18],[-5,-22]],c.deep);
  p.poly([[-2,-27-shift],[1,-28],[4,-25],[3,-21],[-1,-22],[-3,-24]],c.body);
  p.line(-1,-26,1,-24, event ? c.live : c.middle);
  if (event && t > .45 && t < .8) p.rect(1,-23,2,1,c.live);
}

/** Authored unequal fracture paths, including dependent forks and one incomplete join. */
export const CHAMBER_RIFT_BRANCHES: readonly (readonly ChamberPoint[])[] = [
  [[-2,-1],[7,-2],[15,-4],[24,-5]],
  [[-2,-1],[4,3],[9,7],[16,11]],
  [[-2,-1],[-2,4],[0,10]],
  [[-2,-1],[-7,5],[-14,12]],
  [[-2,-1],[-10,2],[-18,5],[-25,6]],
  [[-2,-1],[-10,-3],[-19,-3]],
  [[-2,-1],[-7,-6],[-15,-12]],
  [[-2,-1],[-2,-7],[2,-16]],
  [[-2,-1],[5,-7],[13,-11],[22,-12]],
  [[15,-4],[19,-1],[25,1]],
  [[-7,5],[-11,6],[-18,7]],
  [[-18,5],[-22,3],[-25,2]],
  [[-7,-6],[-13,-6],[-19,-9]],
  [[5,-7],[7,-12],[11,-15]],
  [[-10,-3],[-11,0],[-10,2]],
];
interface RiftCell { x: number; y: number; depth: number; travel: number; }
const riftKey = (x: number,y: number): string => `${x},${y}`;
const RIFT_CELLS: readonly RiftCell[] = (() => {
  const cells = new Map<string,RiftCell>();
  for (let branchIndex=0;branchIndex<CHAMBER_RIFT_BRANCHES.length;branchIndex++) {
    const points = CHAMBER_RIFT_BRANCHES[branchIndex]!;
    let length = 0;
    for(let i=1;i<points.length;i++) length += Math.hypot(points[i]![0]-points[i-1]![0],(points[i]![1]-points[i-1]![1])/.62);
    let covered = 0;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1]!, b=points[i]!;
      const segment = Math.hypot(b[0]-a[0],(b[1]-a[1])/.62);
      const samples = Math.ceil(segment*3);
      for(let step=0;step<=samples;step++) {
        const t = step / samples;
        const cx=a[0]+(b[0]-a[0])*t, cy=a[1]+(b[1]-a[1])*t;
        const along=(covered+segment*t)/length;
        const halfWidth=(branchIndex<9 ? .61 : .48)*(1-along);
        for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++) {
          const across=Math.hypot(ox,oy*1.35);
          if(across>halfWidth+.35) continue;
          const x=Math.round(cx+ox),y=Math.round(cy+oy);
          const radial=Math.min(1,Math.hypot(x+2,(y+1)/.62)/29);
          const depth=Math.min(1,across/Math.max(.6,halfWidth+.35)*.42+radial*.72);
          const key=riftKey(x,y), old=cells.get(key);
          if(!old||depth<old.depth)cells.set(key,{x,y,depth,travel:radial});
        }
      }
      covered+=segment;
    }
  }
  // The puncture is only seven cells; the fracture does not become a portal-shaped blot.
  for(const [x,y] of [[-2,-1],[-1,-1],[-3,-1],[-2,0],[-1,0],[-3,0],[-2,-2]]) {
    cells.set(riftKey(x!,y!),{x:x!,y:y!,depth:0,travel:0});
  }
  return [...cells.values()];
})();
const RIFT_GAP = new Set(RIFT_CELLS.map(cell=>riftKey(cell.x,cell.y)));
const RIFT_LIPS: readonly {x:number;y:number;color:string}[] = (()=>{
  const cells = new Map<string,{x:number;y:number;color:string}>();
  for(const cell of RIFT_CELLS) {
    for(const [dx,dy] of [[0,-1],[1,0]]) {
      const x=cell.x+dx!,y=cell.y+dy!,key=riftKey(x,y);
      if(RIFT_GAP.has(key)||cells.has(key)||y < -16||x>25)continue;
      const choice=((x*73+y*139+4171)%101+101)%101;
      if(choice<32)cells.set(key,{x,y,color:choice<20?'#50585d':'#697173'});
      else if(choice<46)cells.set(key,{x,y,color:'#3a4147'});
    }
  }
  return [...cells.values()];
})();
const RIFT_SUPPORT = new Set([...RIFT_GAP,...RIFT_LIPS.map(cell=>riftKey(cell.x,cell.y))]);
const RIFT_LIVE = RIFT_CELLS.filter(cell=>[[1,0],[-1,0],[0,1],[0,-1]]
  .filter(([dx,dy])=>RIFT_SUPPORT.has(riftKey(cell.x+dx!,cell.y+dy!))).length>=3);

export function paintRiftShell(p: ChamberPixels): void {
  p.setPlane({ normal: [0,0,1], elevation: 0, roughness: .88 });
  // A few broken lips, with a side face and top, establish material rather than an outline.
  p.poly([[-12,-7],[-9,-8],[-7,-6],[-10,-5]],'#30363c');
  p.line(-12,-7,-9,-8,'#596064');
  p.poly([[6,5],[10,5],[12,7],[8,7]],'#30373b');
  p.line(7,5,10,5,'#5c6465');
  p.rect(3,-10,2,1,'#595953');p.rect(3,-9,2,1,'#3d423e');
  p.rect(-8,7,2,1,'#4f4840');p.rect(-7,8,2,1,'#33383d');
  p.rect(15,1,1,1,'#4f5659');p.rect(-15,0,1,1,'#454d51');
  for(const cell of RIFT_LIPS)p.rect(cell.x,cell.y,1,1,cell.color);
  p.setPlane({ normal: [0,0,1], elevation: -2, roughness: .95 });
  for(const cell of RIFT_CELLS)p.rect(cell.x,cell.y,1,1,
    cell.depth<.34?'#080a0c':cell.depth<.68?'#0d1114':'#202830');
  p.setPlane(null);
}
function riftFrame(p: ChamberPixels, frame: number): void {
  const t=frame>=16?(frame-16)/7:frame/15;
  if(t<.06||t>.94)return;
  const head=t*1.3;
  for(const cell of RIFT_LIVE) {
    const age=head-cell.travel;
    if(age<0||age>.3)continue;
    // Bright travel is embedded between real fracture banks, never painted over bare ground.
    p.rect(cell.x,cell.y,1,1,age<.06?'#46b5a0':age<.14?'#287b6b':'#16463f');
  }
}

/** One already-translated local frame, with no world surface stamping or runtime allocation. */
export function paintDeviceActivityFrame(p: ChamberPixels, id: ChamberDevice, frame: number,
  health: number, occupied: boolean): void {
  if (id === 'core') coreFrame(p,frame,health);
  else if (id === 'storage') storageFrame(p,frame,health);
  else if (id === 'purifier') purifierFrame(p,frame,health);
  else if (id === 'growth') growthFrame(p,frame);
  else if (id === 'offering') offeringFrame(p,frame,occupied);
  else riftFrame(p,frame);
}
