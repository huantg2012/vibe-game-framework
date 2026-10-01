/** Selected joint-opening atmosphere, promoted with its matching haven pack. Camera-space
 * rays are reconstructed from the pack's real orthographic camera; every
 * effect is clipped against the resolved, parallax-adjusted opaque depth.
 * Production and the isolated review pack use the same authored fields. */
export const LAST_LIGHT_JOINT_EXTERIOR_GLSL = `
uniform float uJointExterior,uExteriorSeconds;
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

// The silhouette retains the accepted giant's angular, incomplete folds, but
// each section now has a world-space axis, thickness and independent depth.
// Intersect the view ray with the projected section, then use its curved front
// surface for occlusion. A nearer column may hide one joint and expose another.
vec3 jointFoldSegment(vec3 origin,float surface,vec3 a,vec3 b,float radiusA,float radiusB,float salt){
  vec3 axis=b-a,planeAxis=axis-uExteriorBack*dot(axis,uExteriorBack);
  float along=clamp(dot(origin-a,planeAxis)/max(.001,dot(planeAxis,planeAxis)),0.,1.);
  vec3 center=mix(a,b,along);
  float centerDepth=dot(center-uExteriorTarget,uExteriorBack);
  vec3 local=origin-center+uExteriorBack*centerDepth;
  float radius=mix(radiusA,radiusB,along),distance=length(local);
  float coverage=1.-smoothstep(radius-1.5/uExteriorScale,radius+2.5/uExteriorScale,distance);
  if(coverage<=0.)return vec3(0.,0.,-2000.);
  float depth=centerDepth+sqrt(max(0.,radius*radius-distance*distance))*.62;
  if(depth<=surface+.02)return vec3(0.,0.,-2000.);
  float signedSide=dot(local,normalize(cross(uExteriorBack,planeAxis)))/radius;
  float plane=smoothstep(-.73,-.08,signedSide)*(1.-smoothstep(.23,.90,signedSide));
  float crease=(1.-smoothstep(.025,.13,abs(signedSide+.27)))*.32;
  float ridge=smoothstep(.87,.98,sin(along*18.5+signedSide*2.4+salt))
    *smoothstep(-.12,.21,signedSide)*(1.-smoothstep(.3,.63,signedSide))*.16;
  return vec3(coverage,clamp(plane*.69-crease+ridge,0.,1.),depth);
}
vec3 jointFrontFold(vec3 a,vec3 b){
  return a.x>0.&&(a.z>b.z||b.x<=0.)?a:b;
}
vec3 jointFoldChain(vec3 origin,float surface,vec3 a,vec3 b,vec3 c,vec3 d,vec4 radius,float salt){
  vec3 ab=jointFoldSegment(origin,surface,a,b,radius.x,radius.y,salt);
  vec3 bc=jointFoldSegment(origin,surface,b,c,radius.y,radius.z,salt+2.1);
  vec3 cd=jointFoldSegment(origin,surface,c,d,radius.z,radius.w,salt+4.8);
  return jointFrontFold(jointFrontFold(ab,bc),cd);
}
float jointEventSeed(float cycle,float salt){return fract(sin(cycle*91.731+salt)*15731.743);}

// Two unequal windows in a long cycle; later cycles vary timing and flexion.
// There is no global body translation. Roots remain fixed outside the opening,
// one broad joint changes its load and the thinner folds respond seconds later.
// The clock belongs to the game instance and survives interaction / scene return.
vec3 jointPassingMass(vec3 color,vec3 origin,float surface,float time){
  float cycle=floor(time/211.),phase=mod(time,211.);
  float second=step(100.,phase),seed=jointEventSeed(cycle,3.1+second*8.7);
  float start=second<.5?26.+seed*17.:131.+seed*19.;
  float duration=16.5+seed*3.,age=phase-start;
  if(age<0.||age>duration)return color;
  float bend=sin(clamp((age-.8)/(duration-2.),0.,1.)*3.14159265);
  float follow=sin(clamp((age-2.6)/(duration-2.8),0.,1.)*3.14159265);
  float late=sin(clamp((age-4.1)/(duration-4.4),0.,1.)*3.14159265);
  float strength=.81+seed*.23;
  bend*=strength;follow*=strength;late*=strength;
  vec3 rear=jointFoldChain(origin,surface,
    vec3(-23.791,-6.172,-37.142),
    vec3(-19.426,-17.998,-26.159)+vec3(-.57,.47,.46)*follow,
    vec3(-18.786,-26.005,-18.730)+vec3(.71,-.23,-.42)*follow,
    vec3(-21.109,-43.806,-13.019),vec4(1.17,1.28,.83,1.40),2.7);
  vec3 narrow=jointFoldChain(origin,surface,
    vec3(-35.569,-9.728,-31.124),
    vec3(-27.978,-19.366,-23.935)+vec3(.48,.26,-.28)*late,
    vec3(-26.152,-25.781,-17.102)+vec3(-.73,-.63,.34)*late,
    vec3(-25.587,-43.923,-14.376),vec4(.57,.72,.42,.87),5.2);
  vec3 main=jointFoldChain(origin,surface,
    vec3(-24.919,-3.932,-32.505),
    vec3(-21.052,-16.321,-20.756)+vec3(-1.48,-.46,.69)*bend,
    vec3(-15.165,-25.172,-15.975)+vec3(.86,.51,-.37)*bend,
    vec3(-9.645,-41.567,-16.357),vec4(2.38,1.96,1.55,2.72),.4);
  vec3 form=jointFrontFold(jointFrontFold(rear,narrow),main);
  float arrival=smoothstep(0.,3.2,age)*(1.-smoothstep(duration-3.8,duration,age));
  // Neutral dim planes are revealed by incident air; never glowing contours.
  // Middle air follows this pass and partially swallows the form again.
  return mix(color,vec3(.0095,.011,.0105)+vec3(.010,.011,.010)*form.y,form.x*arrival*.75);
}

vec3 jointFallingGrit(vec2 pixel,float surface,vec2 middleOffset,vec2 farOffset,float time){
  vec3 color=vec3(0.);
  // These points are transformed broken lips of the two actual archive models,
  // not free-floating particle emitters. Most of each cycle remains empty.
  for(int i=0;i<6;i++){
    float slot=float(i),group=floor(slot*.5),companion=mod(slot,2.);
    vec3 source=group<.5?vec3(-7.254,-9.319,-1.398)
      :group<1.5?vec3(-16.099,-6.693,.870):vec3(-15.279,-4.250,-13.651);
    float period=33.+group*11.,cycle=floor(time/period);
    float onset=5.+group*3.+jointEventSeed(cycle,17.3+group*2.9)*8.;
    float age=mod(time,period)-onset-companion*.43;
    if(age<0.||age>3.2)continue;
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
  // The upper-right broken vault opens onto a deeper air column. Its quieter
  // rate and low optical contribution let the negative space slowly breathe
  // without lifting the whole exterior or washing the nearer masonry.
  float vault=jointAir(farOrigin,surface,vec3(-4.,-22.,-34.),vec3(8.,25.,5.),time,.24);
  color=mix(color,vec3(.067,.073,.069),vault*.22);
  float remote=jointAir(farOrigin,surface,vec3(-13.2,-11.7,-14.2),vec3(4.2,22.,4.4),time,.52);
  color=mix(color,vec3(.073,.079,.074),remote*.66);
  color=jointPassingMass(color,farOrigin,surface,time);
  vec3 middleOrigin=jointRayOrigin(pixel-middleOffset);
  float middle=jointAir(middleOrigin,surface,vec3(-16.2,-16.7,-7.2),vec3(4.0,18.,3.8),time,1.);
  color=mix(color,vec3(.078,.084,.079),middle*.54);
  return color+jointFallingGrit(pixel,surface,middleOffset,farOffset,time);
}
`;
