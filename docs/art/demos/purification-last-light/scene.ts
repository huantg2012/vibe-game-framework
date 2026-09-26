import { Model, type Station } from './model';
import { buildEnvironment } from './environment';
import { buildDevices } from './devices';
import { buildActor,buildSeatedActor } from './actor';
import { buildRestRemnant,REST_POSITION,REST_YAW,REST_SEAT_HEIGHT,type RestPoint } from './rest';

export interface Haven {model:Model;stations:Station[];rest:RestPoint;}
export function buildHaven({resting=false}:{resting?:boolean}={}):Haven {
  const model=new Model();
  buildEnvironment(model);
  model.layer='haven';
  const stations=buildDevices(model);
  const rest=buildRestRemnant(model);
  if(resting)buildSeatedActor(model,REST_POSITION,REST_YAW,REST_SEAT_HEIGHT);
  else buildActor(model);
  // Source powers are balanced in the full scene; the three families remain
  // individually recoverable for source-aware motion and material response.
  for(const light of model.lights){
    if(light.kind==='shoulder'){light.power=3.2;light.radius=6.2;}
    if(light.kind==='furnace'){light.power=3.8;light.radius=5.3;}
    if(['storage-well','purifier-inlet','purifier-sump','offering-residue','growth-medium','rift-wound'].includes(light.id)){light.power*=2.5;light.radius*=1.2;}
  }
  return {model,stations,rest};
}
