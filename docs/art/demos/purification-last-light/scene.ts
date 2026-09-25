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
    if(light.kind==='shoulder'){light.power=3.2;light.radius=6.2;}
    if(light.kind==='furnace'){light.power=5.2;light.radius=8.4;}
    if(['storage-well','purifier-inlet','purifier-sump','offering-residue','growth-medium','rift-wound'].includes(light.id)){light.power*=2.5;light.radius*=1.2;}
    if(light.id==='core-heart'){light.power=9.0;light.radius=15.5;}
  }
  return {model,stations};
}
