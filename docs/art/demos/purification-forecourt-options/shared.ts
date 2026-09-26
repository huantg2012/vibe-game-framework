import { buildHaven } from '../purification-last-light/scene';
import { type Model, type V3 } from '../purification-last-light/model';

export interface Option {
  id: string;
  title: string;
  summary: string;
  tradeoff: string;
  model: Model;
  route: V3[];
  stop: V3;
  footprint: V3[];
  callouts: { text: string; point: V3 }[];
}

export function base() {
  const haven=buildHaven({resting:true});
  const core=haven.stations.find(s=>s.key==='core')!;
  const world=(x:number,y:number,z:number):V3=>[
    core.position[0]+x*Math.cos(core.yaw)+z*Math.sin(core.yaw),
    core.position[1]+y,
    core.position[2]-x*Math.sin(core.yaw)+z*Math.cos(core.yaw),
  ];
  return {...haven,core,world};
}
