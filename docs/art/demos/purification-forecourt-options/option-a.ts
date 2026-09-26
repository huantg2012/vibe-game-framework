import {base,type Option} from './shared';
import {type V2} from '../purification-last-light/model';

/** A surviving sanctuary floor, not an extra prop or a painted target. */
export function buildOption():Option {
  const {model,core,world}=base();
  const outline:V2[]=[[-1.56,1.03],[1.55,1.02],[1.67,2.19],[1.56,3.84],
    [1.54,5.48],[1.14,6.12],[-1.42,6.13],[-2.13,5.66],[-2.14,3.94],[-1.68,2.45]];
  model.at(core.position,core.yaw,0,()=>{
    model.slab(outline,.116,.008,'stone',.83);
    // Unequal cut flags carry through to the existing three-course core base.
    // Narrow gaps expose the real bedding course; there is no coloured decal.
    const flags:{p:V2[];t:number}[]=[
      {p:[[-1.50,1.24],[-.035,1.24],[-.035,2.39],[-1.56,2.39]],t:.86},
      {p:[[.012,1.24],[1.49,1.24],[1.55,2.13],[1.50,2.39],[.012,2.39]],t:.90},
      {p:[[-1.56,2.435],[.42,2.435],[.42,3.64],[-2.04,3.64]],t:.88},
      {p:[[.455,2.435],[1.51,2.435],[1.43,3.64],[.455,3.64]],t:.85},
      {p:[[-2.05,3.68],[-.38,3.68],[-.38,5.03],[-2.06,5.03]],t:.91},
      {p:[[-.345,3.68],[1.47,3.68],[1.47,5.03],[-.345,5.03]],t:.88},
      {p:[[-2.06,5.07],[-.60,5.07],[-.60,5.94],[-1.39,5.94],[-2.06,5.54]],t:.87},
      {p:[[-.56,5.07],[1.47,5.07],[1.44,5.40],[1.08,5.94],[-.56,5.94]],t:.89},
    ];
    for(const f of flags)model.slab(f.p,.154,.117,'cutstone',f.t);
    // One broad worn threshold slopes down toward the circulation space.
    model.quad([-1.13,.155,5.95],[1.13,.155,5.95],[1.01,.014,6.49],[-1.01,.014,6.49],'cutstone',.85);
    model.quad([-1.13,.155,5.95],[-1.01,.014,6.49],[-1.01,.002,6.49],[-1.13,.002,5.95],'stone',.72);
    model.quad([1.13,.155,5.95],[1.13,.002,5.95],[1.01,.002,6.49],[1.01,.014,6.49],'stone',.72);
    // A broken architectural margin retains weight without becoming a fence.
    model.box([-1.54,.173,1.69],[.15,.15,1.18],'cutstone',.025,.83);
    model.box([-1.58,.164,2.78],[.15,.13,.82],'cutstone',.025,.80);
    model.slab([[1.44,1.16],[1.62,1.10],[1.64,2.09],[1.50,2.26]],.205,.117,'cutstone',.81);
  });
  return {
    id:'a',title:'低台基前庭',
    summary:'核心留在边缘。由旧石基延伸出低矮前庭，把“走近—跨过门槛—停下”组织成一次连续接近。',
    tradeoff:'保留灯塔位置与通行宽度；距离不缩短，仪式性更明确，也更规整。',
    model,
    route:[[2,.035,-.5],[5.2,.035,.3],world(0,.035,6.90),world(0,.17,5.6),world(0,.17,3.9),world(0,.17,2.65)],
    stop:world(0,.17,2.65),
    footprint:[world(-1.56,.16,1.03),world(1.55,.16,1.02),world(1.54,.16,5.48),world(1.01,.014,6.49),world(-1.01,.014,6.49),world(-2.13,.16,5.66),world(-2.14,.16,3.94)],
    callouts:[{text:'缓坡门槛',point:world(0,.09,6.22)},{text:'面向核心停驻',point:world(0,.17,2.65)},{text:'与原台基接合',point:world(-1.3,.19,1.4)}],
  };
}
