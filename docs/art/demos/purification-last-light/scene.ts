import { Model, type Station } from './model';
import { buildEnvironment } from './environment';
import { buildDevices } from './devices';

export interface Haven {model:Model;stations:Station[];}
export function buildHaven():Haven {
  const model=new Model();
  buildEnvironment(model);
  model.layer='haven';
  const stations=buildDevices(model);
  // The existing player's tiny amber lamp belongs to the same light field.
  model.light([3.43,1.18,3.9],[1,.61,.27],.34,1.9);
  return {model,stations};
}
