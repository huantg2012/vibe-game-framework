/** Optional atmosphere for the joint opening DEV asset pack. Camera-space
 * rays are reconstructed from the pack's real orthographic camera; every
 * effect is clipped against the resolved, parallax-adjusted opaque depth.
 * The production pack never opts in to these authored volumes or emitters. */
export const LAST_LIGHT_JOINT_EXTERIOR_GLSL = `
uniform float uJointExterior;
uniform vec3 uExteriorRight,uExteriorUp,uExteriorBack,uExteriorTarget;
uniform vec2 uExteriorOrigin;
uniform float uExteriorScale;

vec3 jointRayOrigin(vec2 pixel){
  return uExteriorTarget+uExteriorRight*((pixel.x-uExteriorOrigin.x)/uExteriorScale)
    +uExteriorUp*((uExteriorOrigin.y-pixel.y)/uExteriorScale);
}

// An ellipsoid is only a spatial envelope. Density travels through it in
// broken sheets; a stone pier clips the ray before integration, not afterwards
// by a brightness threshold. No new surface or depth is invented for the air.
float jointAir(vec3 origin,float surface,vec3 center,vec3 radius,float time,float rate){
  vec3 o=(origin-center)/radius,d=uExteriorBack/radius;
  float a=dot(d,d),b=dot(o,d),c=dot(o,o)-1.,discriminant=b*b-a*c;
  if(discriminant<=0.)return 0.;
  float root=sqrt(discriminant),front=(-b+root)/a;
  if(surface>=front)return 0.;
  float rear=max((-b-root)/a,surface+.01),stepSize=(front-rear)/4.;
  float opticalDepth=0.;
  for(int i=0;i<4;i++){
    float depth=rear+(float(i)+.5)*stepSize;
    vec3 p=origin+uExteriorBack*depth,q=(p-center)/radius;
    float edge=max(0.,1.-dot(q,q));
    vec2 flow=vec2(p.x*.19+p.z*.14,p.y*.18-p.z*.05);
    float fold=noise(flow-vec2(time*.09*rate,time*.035*rate));
    float broken=noise(flow*2.1+vec2(19.2-time*.032*rate,4.6));
    float sheet=smoothstep(.36,.69,fold*.78+broken*.22);
    opticalDepth+=edge*edge*(.012+sheet*.68)*stepSize;
  }
  return 1.-exp(-opticalDepth);
}

// Only existing pollution material / same-source receiving light responds.
// Travelling crests advance along the wound, rather than pulsing the entire
// ruin in unison or placing green particles in unpolluted architecture.
vec3 jointWound(vec3 base,vec3 light,vec4 data,vec2 pixel,float time){
  float seed=floor(data.g*255.+.5)*.91;
  float path=pixel.x*.048+pixel.y*.069+seed;
  float crest=smoothstep(.42,.96,sin(path-time*.79));
  float initial=smoothstep(.42,.96,sin(path));
  float material=step(.5,data.b*255.)*(1.-step(1.5,data.b*255.));
  return light*(crest-initial)*.32+base*material*(crest-initial)*.23;
}

// The front of a mass is glimpsed in separate architectural apertures. Its
// body extends beyond the view; there are no eyes, sprite outlines or complete
// creature icon. Two unequal gaps avoid an attention-seeking metronome.
float jointPassingMass(vec2 pixel,float surface,float time){
  float cycle=mod(time,78.),start=cycle<39.?7.:49.;
  float age=cycle-start,progress=age/11.;
  if(age<0.||age>11.||surface>-27.)return 0.;
  float alternate=step(39.,cycle);
  float x=mix(-95.,605.,progress);
  vec2 q=pixel-vec2(mix(x,510.-x,alternate),mix(222.,422.,alternate));
  float boundary=q.y-(sin(q.x*.011+time*.035)*37.+q.x*.075);
  float aperture=1.-smoothstep(.58,1.12,length(q/vec2(260.,130.)));
  float bulk=smoothstep(-22.,3.,boundary)*(1.-smoothstep(50.,106.,boundary));
  float arrival=smoothstep(0.,1.4,age)*(1.-smoothstep(9.4,11.,age));
  return aperture*bulk*arrival*.58;
}

vec3 jointFallingGrit(vec2 pixel,float surface,vec2 middleOffset,vec2 farOffset,float time){
  vec3 color=vec3(0.);
  // These points are transformed broken lips of the two actual archive models,
  // not free-floating particle emitters. Most of each cycle remains empty.
  for(int i=0;i<6;i++){
    float slot=float(i),group=floor(slot*.5),companion=mod(slot,2.);
    vec3 source=group<.5?vec3(-7.254,-9.319,-1.398)
      :group<1.5?vec3(-16.099,-6.693,.870):vec3(-15.279,-4.250,-13.651);
    float period=10.7+group*3.8,age=mod(time+group*3.9-companion*.43+period,period);
    if(age>3.2)continue;
    vec3 world=source+vec3(sin(age*1.4+slot)*.13,-(.23*age+.56*age*age),companion*.08);
    vec3 relative=world-uExteriorTarget;
    float depth=dot(relative,uExteriorBack);
    if(depth<=surface+.02)continue;
    vec2 position=uExteriorOrigin+vec2(dot(relative,uExteriorRight),-dot(relative,uExteriorUp))*uExteriorScale;
    position+=group>1.5?farOffset:middleOffset;
    vec2 delta=abs(pixel-floor(position)-.5);
    float footprint=(1.-step(.65,delta.x))*(1.-step(companion>.5?.65:1.25,delta.y));
    float fade=smoothstep(0.,.13,age)*(1.-smoothstep(1.6,3.2,age));
    color+=vec3(.078,.081,.076)*footprint*fade*(group>1.5?.52:1.);
  }
  return color;
}

vec3 jointExteriorAtmosphere(vec3 color,vec2 pixel,float surface,vec2 farOffset,vec2 middleOffset,float time){
  vec3 farOrigin=jointRayOrigin(pixel-farOffset);
  float remote=jointAir(farOrigin,surface,vec3(-13.2,-11.7,-14.2),vec3(4.2,22.,4.4),time,.52);
  color=mix(color,vec3(.073,.079,.074),remote*.66);
  color*=1.-jointPassingMass(pixel-farOffset,surface,time);
  vec3 middleOrigin=jointRayOrigin(pixel-middleOffset);
  float middle=jointAir(middleOrigin,surface,vec3(-16.2,-16.7,-7.2),vec3(4.0,18.,3.8),time,1.);
  color=mix(color,vec3(.078,.084,.079),middle*.54);
  return color+jointFallingGrit(pixel,surface,middleOffset,farOffset,time);
}
`;
