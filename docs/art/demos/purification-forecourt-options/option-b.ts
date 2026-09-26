import {CORE_FACING_TARGET} from '../purification-last-light/devices';
import {base,relocate,type Option} from './shared';
import {type V3} from '../purification-last-light/model';

/** Repair on the inhabited floor; the upper library becomes an optional,
 * lower-frequency growth destination. This changes adjacency, not mechanics. */
export function buildOption():Option {
  const haven=base(),{model}=haven;
  const storage=relocate(haven,'storage',[8.10,0,-.55],.68);
  const corePosition:V3=[12.90,0,1.70];
  const core=relocate(haven,'core',corePosition,Math.atan2(CORE_FACING_TARGET[0]-corePosition[0],CORE_FACING_TARGET[2]-corePosition[2]));
  const purifier=haven.stations.find(s=>s.key==='purifier')!;
  const rift=haven.stations.find(s=>s.key==='rift')!;
  const growth=haven.stations.find(s=>s.key==='growth')!;
  // A surviving machine bay has a structural back, thick fractured feet and
  // inset masonry faces. Its front remains open to the shared working aisle.
  // It reconnects to the exposed lower-storey piers, not a freestanding fence.
  model.at([8.1,0,-.55],0,0,()=>{
    model.slab([[-2.1,-1.05],[-1.95,-1.67],[1.99,-1.73],[2.32,-1.35],[2.21,-.60],[1.77,-.55],[1.70,-1.13],[-1.60,-1.09]],.095,-.23,'stone',.76);
    model.box([-1.77,.24,-1.31],[.62,.48,.59],'cutstone',.035,.81);
    model.rock([-1.78,.49,-1.31],[.61,.28,.57],'stone',4321,.8);
    model.box([1.84,.31,-1.20],[.61,.61,.66],'cutstone',.037,.76);
    model.rock([1.92,.61,-1.23],[.59,.32,.64],'stone',4328,.8);
    model.slab([[-1.94,-1.70],[1.98,-1.73],[2.11,-1.43],[1.73,-1.31],[-1.90,-1.29]],.59,.06,'stone',.77);
    for(const [x,width,tint] of [[-1.12,1.12,.81],[.12,1.24,.76],[1.18,.73,.82]] as const){
      model.box([x,.28,-1.26],[width,.37,.09],'cutstone',.022,tint);
    }
    // One torn jamb below the upper fabric reveals the old room's boundary.
    model.beam([1.87,.10,-1.51],[1.87,1.54,-1.61],.48,.55,'stone',.74);
    model.rock([1.85,1.57,-1.61],[.57,.29,.58],'stone',4333,.77);
    model.beam([1.90,1.36,-1.69],[2.94,1.88,-1.92],.20,.24,'iron',.65);
    // Original machine skids are supported by two buried structural footings.
    // The operating patch stays flat; no decorative carpet occupies the aisle.
    model.box([-.60,.015,.04],[.30,.04,2.46],'stone',.014,.72);
    model.box([.69,.017,.04],[.31,.044,2.45],'stone',.015,.74);
  });
  // The core's eastern abutment continues back into the attached building.
  // Its irregular low crown catches the real all-direction core light.
  model.slab([[14.17,-.43],[14.45,-.29],[14.73,1.46],[14.86,2.24],[14.49,2.47],[14.17,1.23]],.32,-.31,'stone',.68);
  model.box([14.31,.37,.16],[.30,.38,.89],'cutstone',.033,.73);
  model.rock([14.36,.57,.09],[.34,.29,.67],'stone',4342,.74);
  const start:V3=[3.8,.035,3.8];
  const storageRoute:V3[]=[start,[4.5,.035,1.3],[5.7,.035,.54],storage.approach];
  const coreRoute:V3[]=[start,[4.6,.035,1.8],[7.1,.035,1.60],[9.5,.035,1.60],core.approach];
  return {
    id:'b',title:'下层检修厅',
    summary:'储藏落入下层旧墙龛，核心后靠右侧承托。三个可修复模块同层，上层留给成长；中央成为连接各操作位的工作前厅。',
    tradeoff:'直接改善装置邻接，少一次为储藏上下楼；生活区会更像维持据点运转的工作场所，核心的独立静谧感稍弱。',
    model,stations:haven.stations,changedObjects:[0,1,2],
    route:coreRoute,stop:core.approach,
    footprint:[[5.8,.035,-2.45],[10.4,.035,-2.45],[11.2,.035,.75],[9.5,.035,1.55],[6.3,.035,1.1]],
    callouts:[{text:'储藏操作面朝工作路',point:storage.approach},{text:'核心靠右承托，前场敞开',point:core.approach},{text:'上层专供可选成长',point:growth.approach}],
    routes:[
      {label:'检修储藏 · 取消上下楼',points:storageRoute},
      {label:'修复核心 · 从炉背直达',points:coreRoute},
      {label:'净化器 · 西侧直接往返',points:[start,[2.1,.035,2.3],purifier.approach]},
      {label:'准备出击 · 不穿检修工位',points:[start,[4.6,.035,1.9],[6.8,.035,2.15],rift.approach]},
    ],
    design:['把空地变成真实操作空间，承担已存在的检修用途。','同层三模块各有可站的正面，经过路线与操作位置分开。','不增加卸货、维护工序或强制参拜；只改变可选行动的距离。'],
  };
}
