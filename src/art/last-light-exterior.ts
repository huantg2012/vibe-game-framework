import { lastLightBasis, type LastLightCamera, type LightVector } from './last-light-spatial';
import { LAST_LIGHT_JOINT_EXTERIOR_GLSL } from './last-light-joint-exterior';

/** Camera-relative displacement of an anchored foreground. Values are native
 * art pixels, not a fraction of the player's entire walk across the room. */
export const LAST_LIGHT_EXTERIOR = {
  referenceXZ: [3.8, 3.8] as const,
  observerScale: 72,
  verticalResponse: .65,
  farLimit: 6,
  middleLimit: 3.5,
  nearLimit: 0,
  fieldColumns: 4,
  fieldRows: 7,
} as const;

/** Actor height is deliberately absent: walking up the ramp must not drag the
 * surrounding building down. The source camera and XZ footprint are shared. */
export function getLastLightExteriorObserver(world: LightVector, camera: LastLightCamera): [number, number] {
  const basis = lastLightBasis(camera);
  const x = world[0] - LAST_LIGHT_EXTERIOR.referenceXZ[0];
  const z = world[2] - LAST_LIGHT_EXTERIOR.referenceXZ[1];
  return [camera.scale * (basis.right[0] * x + basis.right[2] * z),
    -camera.scale * (basis.up[0] * x + basis.up[2] * z)];
}

/** CPU mirror of the shader, used by export checks and displacement review. */
export function getLastLightExteriorOffsets(observer: readonly [number, number]): {
  far: [number, number]; middle: [number, number]; near: [number, number];
} {
  const x = observer[0] / LAST_LIGHT_EXTERIOR.observerScale;
  const y = observer[1] * LAST_LIGHT_EXTERIOR.verticalResponse / LAST_LIGHT_EXTERIOR.observerScale;
  const scale = -1 / Math.sqrt(1 + x * x + y * y);
  return { far: [x * scale * LAST_LIGHT_EXTERIOR.farLimit, y * scale * LAST_LIGHT_EXTERIOR.farLimit],
    middle: [x * scale * LAST_LIGHT_EXTERIOR.middleLimit, y * scale * LAST_LIGHT_EXTERIOR.middleLimit], near: [0, 0] };
}

/** The receiving colour, illumination, material motion and opaque depth of a
 * layer all use one UV. No world member is deformed by screen-position masks.
 * `common` supplies the shared noise, light rhythm and depth encoding helpers. */
export function createLastLightEnvironmentShader(common: string): string {
  return `#version 300 es
${common}
layout(location=1) out vec4 resolvedOpaqueDepth;
uniform sampler2D uScene,uBackground,uFar,uMiddle,uNear,uExteriorDepth,uExteriorFields;
uniform vec2 uObserver,uPlateSize;
uniform float uPadding;
uniform vec3 uHealth;
uniform float uCharge,uGrowth,uThicken;
uniform float uPulses[6];
${LAST_LIGHT_JOINT_EXTERIOR_GLSL}

vec2 plateUv(vec2 pixel,vec2 offset){
  vec2 p=pixel+vec2(uPadding)-offset;
  return vec2(p.x/uPlateSize.x,1.-p.y/uPlateSize.y);
}
vec4 plateDepth(vec2 uv,float layer){
  return texture(uExteriorDepth,vec2(uv.x,(3.-layer+uv.y)/4.));
}
vec4 exteriorField(vec2 uv,float layer,float row){
  // The PNG has far/middle/near/haven columns and seven top-to-bottom fields.
  return texture(uExteriorFields,vec2((layer+uv.x)/4.,(6.-row+uv.y)/7.));
}
float physicalDepth(vec4 encoded){
  return encoded.a>.5?decodeDepth(encoded):-10000.;
}
void orderLayers(inout vec4 a,inout float ad,inout vec4 b,inout float bd){
  if(ad>bd){vec4 c=a;a=b;b=c;float d=ad;ad=bd;bd=d;}
}
vec3 sourceVariation(vec3 other,vec3 core,vec3 storage,vec3 purifier,vec3 furnace){
  float coreGain=.25+.75*uHealth.x;
  return other*pulse(uSeconds)+core*(coreGain*(1.+.22*coreExpansion(uSeconds))-1.)
    +storage*((.25+.75*uHealth.y)*(1.+pulse(uSeconds))-1.)
    +purifier*((.25+.75*uHealth.z)*(1.+pulse(uSeconds))-1.)
    +furnace*fire(uSeconds);
}
vec3 erosion(vec3 other,vec4 motion,vec2 sourcePixel){
  float id=floor(motion.g*255.+.5),source=floor(motion.b*255.+.5);
  if(source<.5||source>1.5||(id>.5&&id<1.5))return vec3(0);
  float seed=motion.a*19.+sourcePixel.y*.009;
  return -other*(smoothstep(.64,.93,sin(seed-uSeconds*.31))-smoothstep(.64,.93,sin(seed)))*.058;
}

vec4 exterior(vec4 plate,vec2 uv,float layer,vec4 encodedDepth){
  if(plate.a<.001&&max(plate.r,max(plate.g,plate.b))<.0001)return plate;
  vec3 other=exteriorField(uv,layer,0.).rgb;
  plate.rgb+=sourceVariation(other,exteriorField(uv,layer,1.).rgb,
    exteriorField(uv,layer,2.).rgb,exteriorField(uv,layer,3.).rgb,
    exteriorField(uv,layer,4.).rgb);
  vec4 data=exteriorField(uv,layer,5.);
  vec2 sourcePixel=vec2(uv.x,1.-uv.y)*uPlateSize-uPadding;
  plate.rgb+=erosion(other,data,sourcePixel);
  if(uJointExterior>.5&&layer<1.5)plate.rgb+=jointWound(plate.rgb,other,data,sourcePixel,uExteriorSeconds);
  // Preserve every near joint and its contact shadow exactly. Depth comes from
  // the middle and remote fabric behind it, not a moving or rubber-like root.
  if(layer>1.5||encodedDepth.a<.5)return plate;
  float depth=decodeDepth(encodedDepth);
  vec4 normalData=exteriorField(uv,layer,6.);
  vec3 normal=normalize(normalData.rgb*2.-1.);
  float exposure=max(0.,dot(normal,normalize(vec3(-.22,.87,.44))));
  vec3 charcoal=vec3(.0285,.031,.0315);
  if(layer<.5){
    // Authored far walls occupied only two luma steps. Recover a few neutral
    // face values from their own normals; retreating portions dissolve into
    // charcoal rather than becoming a single flat black cutout.
    float distanceVisibility=smoothstep(-30.,-5.,depth);
    float articulation=(.8+2.4*exposure)*(.35+.65*distanceVisibility)/255.;
    plate.rgb=mix(charcoal,plate.rgb,.73+.27*distanceVisibility)
      +vec3(1.,.995,.965)*articulation*plate.a;
  }else{
    // Local air behind the nearer ruin changes by physical depth and surface
    // orientation. No veil is added over the haven or across empty screen.
    float recession=1.-smoothstep(-13.,1.5,depth);
    plate.rgb=mix(plate.rgb,charcoal,recession*.075)
      +vec3(1.,.995,.965)*((.30+1.1*exposure)*recession/255.)*plate.a;
  }
  return plate;
}

float distantPresence(vec2 sourcePixel,float geometryDepth,float time){
  float clock=mod(time,23.),alternate=mod(floor(time/23.),2.);
  float life=smoothstep(5.4,6.5,clock)*(1.-smoothstep(8.85,10.1,clock));
  vec2 center=mix(vec2(239.,142.),vec2(609.,200.),alternate);
  vec2 q=sourcePixel-center;
  vec2 size=mix(vec2(130.,106.),vec2(114.,79.),alternate);
  float entityDepth=mix(-18.2,-16.7,alternate);
  float visibility=1.-smoothstep(entityDepth-.35,entityDepth+.1,geometryDepth);
  float aperture=1.-smoothstep(.56,1.,length(q/size));
  float drift=(clock-7.7)*27.;
  float edge=q.y-(.0026*q.x*q.x+q.x*.19+sin(q.x*.024+time*.19)*8.5-22.+drift);
  float mass=smoothstep(-1.6,2.1,edge)*(1.-smoothstep(48.,93.,edge));
  float fold=q.y-(q.x*-.24+.0033*(q.x+34.)*(q.x+34.)+drift+43.);
  float lobe=smoothstep(-2.,1.5,fold)*(1.-smoothstep(10.,36.,fold))*.55;
  return max(mass,lobe)*aperture*visibility*life;
}

void main(){
  vec2 pixel=floor(vec2(vUv.x,1.-vUv.y)*uSize)+.5,uv=uvAt(pixel);
  vec2 observation=vec2(uObserver.x,uObserver.y*${LAST_LIGHT_EXTERIOR.verticalResponse})/${LAST_LIGHT_EXTERIOR.observerScale}.;
  observation=-observation/sqrt(1.+dot(observation,observation));
  vec2 farOffset=observation*${LAST_LIGHT_EXTERIOR.farLimit}.;
  vec2 middleOffset=observation*${LAST_LIGHT_EXTERIOR.middleLimit};
  vec2 farUv=plateUv(pixel,farOffset),middleUv=plateUv(pixel,middleOffset),nearUv=plateUv(pixel,vec2(0));
  vec4 farDepth=plateDepth(farUv,0.),middleDepth=plateDepth(middleUv,1.),nearDepth=plateDepth(nearUv,2.);
  vec4 havenDepth=plateDepth(nearUv,3.);
  vec4 far=exterior(texture(uFar,farUv),farUv,0.,farDepth);
  vec4 middle=exterior(texture(uMiddle,middleUv),middleUv,1.,middleDepth);
  vec4 near=exterior(texture(uNear,nearUv),nearUv,2.,nearDepth);
  vec4 haven=exterior(texture(uScene,uv),nearUv,3.,havenDepth);
  vec4 data=exteriorField(nearUv,3.,5.);
  vec3 other=exteriorField(nearUv,3.,0.).rgb;
  if(havenDepth.a>.5){
    float id=floor(data.g*255.+.5);
    if(id>=1.&&id<=6.){
      int index=int(id)-1;float response=uPulses[index];
      float grain=step(.94,hash(floor(pixel*.5)));
      haven.rgb+=haven.rgb*response*.3+vec3(.018,.012,.005)*grain*min(uThicken,5.)*.12;
      if(id>3.5&&id<4.5)haven.rgb+=other*uCharge*(.07+.025*sin(uSeconds*.7));
      if(id>4.5&&id<5.5)haven.rgb+=other*min(uGrowth,12.)*.014;
    }
  }
  float fd=physicalDepth(farDepth),md=physicalDepth(middleDepth),nd=physicalDepth(nearDepth),hd=physicalDepth(havenDepth);
  vec4 resolved=vec4(0);float closest=-10000.;
  if(fd>closest){resolved=farDepth;closest=fd;}
  if(md>closest){resolved=middleDepth;closest=md;}
  if(nd>closest){resolved=nearDepth;closest=nd;}
  if(hd>closest){resolved=havenDepth;closest=hd;}
  resolvedOpaqueDepth=resolved;
  orderLayers(far,fd,middle,md);orderLayers(near,nd,haven,hd);
  orderLayers(far,fd,near,nd);orderLayers(middle,md,haven,hd);orderLayers(middle,md,near,nd);
  vec3 color=texture(uBackground,uv).rgb;
  color=far.rgb+color*(1.-far.a);color=middle.rgb+color*(1.-middle.a);
  color=near.rgb+color*(1.-near.a);color=haven.rgb+color*(1.-haven.a);
  float visibleLayer=floor(resolved.b*255.+.5);
  if(uJointExterior>.5&&visibleLayer<2.5){
    color=jointExteriorAtmosphere(color,pixel,closest,farOffset,middleOffset,uExteriorSeconds);
  }else if(visibleLayer<2.5){
    // Air and the unplaceable passing contour are tied to the deep field and
    // hidden by the actual winning depth. Near joints/platform stay untouched.
    vec2 deepPixel=pixel-farOffset,p=deepPixel*vec2(.0067,.0048);
    float presence=visibleLayer<.5?1.:visibleLayer<1.5?.40:.09;
    float air=noise(p+vec2(uSeconds*.007,-uSeconds*.009))-noise(p);
    vec2 p2=p*vec2(.38,1.7)+vec2(9.4,3.8);
    air+=(noise(p2+vec2(-uSeconds*.0023,-uSeconds*.006))-noise(p2))*.5;
    color+=vec3(.0042,.0042,.004)*air*presence;
    color*=1.-distantPresence(deepPixel,closest,uSeconds)*.3;
  }
  fragColor=vec4(clamp(color,0.,1.),1.);
}`;
}
