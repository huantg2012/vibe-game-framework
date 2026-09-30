import { buildOption } from '../../docs/art/demos/purification-forecourt-options/option-a';
import { ACTOR_POSITION, ACTOR_FACING, ACTOR_OBJECT_ID, buildActor, actorLampAnchor } from '../../docs/art/demos/purification-last-light/actor';
import { FURNACE_POSITION } from '../../docs/art/demos/purification-last-light/environment';
import { REST_POSITION } from '../../docs/art/demos/purification-last-light/rest';
import { project, type Camera } from '../../docs/art/demos/purification-last-light/render';
import { add, type V3 } from '../../docs/art/demos/purification-last-light/model';
import { addOpeningExterior } from './opening-exterior';

/** Independent authored shot. These controls never modify the game's CAMERA,
 * placement, movement or interaction data. The default is the review master. */
export function buildOpeningShot() {
  const option = buildOption();
  // The disconnected middle ruin is recomposed as an exterior proposal.
  // At the game azimuth it made a frame; here it otherwise seals the chasm.
  // Attached near structure and every playable object retain their placement.
  const middleOffset:V3=[-7,-2,3];
  const middleLightIds=new Set(['seam--10.95--3.94-3.19','seam--9.32-2.71--4.92',
    'attachment-3611','attachment-3617','attachment-3629','attachment-3789',
    'attachment-3767','attachment-4231','seam--13.79--6.07-1.94']);
  for(const t of option.model.triangles)if(t.layer==='middle'){
    t.a=add(t.a,middleOffset);t.b=add(t.b,middleOffset);t.c=add(t.c,middleOffset);
  }
  for(const light of option.model.lights)if(middleLightIds.has(light.id))light.position=add(light.position,middleOffset);
  if(option.model.lights.filter(l=>middleLightIds.has(l.id)).length!==middleLightIds.size)throw new Error('Middle ruin source lights changed; re-audit opening placement.');
  const number = (name:string,fallback:number) => {
    const value=Number(process.env[name]??fallback);
    if(!Number.isFinite(value))throw new Error(`Invalid ${name}`);
    return value;
  };
  const resolution=number('OPENING_RESOLUTION',1);
  const camera:Camera={width:Math.round(960*resolution),height:Math.round(640*resolution),
    origin:[0,0],target:[0,0,0],scale:number('OPENING_SCALE',50)*resolution,
    direction:[number('OPENING_DIRECTION_X',29),number('OPENING_ELEVATION',15),number('OPENING_DIRECTION_Z',22)]};
  const feet=project(ACTOR_POSITION,camera);
  camera.origin=[number('OPENING_ACTOR_X',660)*resolution-feet[0],number('OPENING_ACTOR_Y',330)*resolution-feet[1]];
  const actorFacing=number('OPENING_ACTOR_FACING',-2.35);
  // An opening pose looks out into the chasm. Position, identity, scale and
  // standing rig are shared; integration must inherit this facing at the cut.
  for(let i=option.model.triangles.length-1;i>=0;i--)if(option.model.triangles[i]!.object===ACTOR_OBJECT_ID)option.model.triangles.splice(i,1);
  for(let i=option.model.lights.length-1;i>=0;i--)if(option.model.lights[i]!.kind==='shoulder')option.model.lights.splice(i,1);
  buildActor(option.model,ACTOR_POSITION,actorFacing);
  const clothAlbedoGain=number('OPENING_CLOTH_ALBEDO',.58);
  for(const triangle of option.model.triangles)if(triangle.object===ACTOR_OBJECT_ID&&triangle.material==='cloth')triangle.tint*=clothAlbedoGain;
  for(const light of option.model.lights)if(light.kind==='shoulder'){light.power=3.2;light.radius=6.2;}
  // Newly authored outer fabric only. The rigid transform keeps it beyond the
  // west ruin when composing the new azimuth; nothing on the haven is moved.
  option.model.at([1.1,-.3,-.75],Math.atan2(29,22)-Math.atan2(33,17),0,()=>addOpeningExterior(option.model));
  for(const t of option.model.triangles)if((t.object===8701||t.object===8702)&&t.material!=='pollutant')t.tint*=1.4;
  // All three modules start at 70/100. Keep the same .25+.75*health gain as
  // the production renderer; no extra cinematic light is introduced.
  for(const light of option.model.lights)if(/^(core|storage|purifier)-/.test(light.id))light.power*=.775;
  const core=option.stations!.find(s=>s.key==='core')!;
  return {model:option.model,camera,meta:{
    title:'开场美术母版 · 炉席与深渊',status:'ART-MASTER / REVIEW-PENDING / NOT-PRODUCTION',
    source:'Current Last Light A geometry, materials and real lights; independent orthographic shot.',
    initialHealth:{core:.7,storage:.7,purifier:.7},actorFacing,productionSpawnFacing:ACTOR_FACING,clothAlbedoGain,middleOffset,
    anchors:{actorFeet:ACTOR_POSITION,shoulderLamp:actorLampAnchor(ACTOR_POSITION,actorFacing),furnace:FURNACE_POSITION,seat:REST_POSITION,core:core.position},
    unchanged:'Haven floor and functional object positions, gameplay camera, navigation, interactions, Rift and live menu remain unchanged. Opening-only changes: camera, actor facing/cloth calibration, disconnected middle ruin placement and deep exterior extension.',
  }};
}
