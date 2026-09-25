import { Model, type Station } from './model';
import { buildEnvironment } from './environment';
import { buildDevices } from './devices';
import { buildActor } from './actor';

export interface Haven {model:Model;stations:Station[];}
export function buildHaven():Haven {
  const model=new Model();
  buildEnvironment(model);
  model.layer='haven';
  const stations=buildDevices(model);
  buildActor(model);
  // Source powers are balanced in the full scene; the three families remain
  // individually recoverable for source-aware motion and material response.
  for(const light of model.lights){
    if(light.kind==='shoulder'){light.power=1.65;light.radius=4.1;}
    if(light.kind==='furnace'){light.power=3.6;light.radius=6.4;}
    if(light.id==='core-heart'){light.power=3.0;light.radius=8.6;}
  }
  return {model,stations};
}
