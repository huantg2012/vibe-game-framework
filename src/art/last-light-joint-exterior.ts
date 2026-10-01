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

// A broad fold has a dark turning side and a dim plane, not an emissive rim.
// Rounded segment ends only join internal bends: every actual limb endpoint
// lies outside the view, so this cannot make a closed disc-shaped apparition.
vec2 jointFoldSegment(vec2 pixel,vec2 a,vec2 b,float radiusA,float radiusB,float salt){
  vec2 axis=b-a;
  float along=clamp(dot(pixel-a,axis)/dot(axis,axis),0.,1.);
  vec2 local=pixel-(a+axis*along);
  float radius=mix(radiusA,radiusB,along);
  float signedSide=dot(local,normalize(vec2(-axis.y,axis.x)))/radius;
  float fold=1.-smoothstep(radius-2.5,radius+3.5,length(local));
  float plane=smoothstep(-.73,-.08,signedSide)*(1.-smoothstep(.23,.90,signedSide));
  float crease=(1.-smoothstep(.025,.13,abs(signedSide+.27)))*.32;
  // Incomplete oblique ridges describe a folded surface; their support belongs
  // to this plane and never becomes a complete contour or parallel scan lines.
  float ridge=smoothstep(.87,.98,sin(along*18.5+signedSide*2.4+salt))
    *smoothstep(-.12,.21,signedSide)*(1.-smoothstep(.3,.63,signedSide))*.16;
  return vec2(fold,clamp(plane*.69-crease+ridge,0.,1.));
}

vec2 jointFoldChain(vec2 pixel,vec2 a,vec2 b,vec2 c,vec2 d,vec4 radius,float salt){
  vec2 ab=jointFoldSegment(pixel,a,b,radius.x,radius.y,salt);
  vec2 bc=jointFoldSegment(pixel,b,c,radius.y,radius.z,salt+2.1);
  vec2 cd=jointFoldSegment(pixel,c,d,radius.z,radius.w,salt+4.8);
  // At the bend, the larger coverage owns the visible face. Darker material
  // remains at the joint rather than adding three overlapping light ribbons.
  vec2 form=ab.x>bc.x?ab:bc;
  return cd.x>form.x?cd:form;
}

// We glimpse articulated portions of something much larger than the opening.
// Upper roots stay fixed while one joint flexes and two thinner folds follow
// late. There is no global translating body and no encompassing oval mask.
vec3 jointPassingMass(vec3 color,vec2 pixel,float surface,float time){
  float cycle=mod(time,78.),start=cycle<39.?7.:49.;
  float age=cycle-start;
  if(age<0.||age>11.||surface>-27.)return color;
  float alternate=step(39.,cycle);
  vec2 q=pixel-vec2(alternate*14.,alternate*-64.);
  float bend=sin(clamp((age-.45)/8.35,0.,1.)*3.14159265);
  float follow=sin(clamp((age-1.80)/8.1,0.,1.)*3.14159265);
  float late=sin(clamp((age-2.65)/8.2,0.,1.)*3.14159265);
  vec2 rear=jointFoldChain(q,vec2(472.,-230.),vec2(414.-follow*24.,202.+follow*19.),
    vec2(323.+follow*31.,476.-follow*8.),vec2(190.,920.),vec4(31.,34.,22.,37.),2.7);
  vec2 narrow=jointFoldChain(q,vec2(123.,-170.),vec2(191.+late*18.,192.-late*11.),
    vec2(135.-late*24.,433.+late*27.),vec2(109.,870.),vec4(15.,19.,11.,23.),5.2);
  vec2 main=jointFoldChain(q,vec2(381.,-230.),vec2(301.-bend*48.,220.+bend*19.),
    vec2(365.+bend*26.,521.-bend*17.),vec2(494.,920.),vec4(63.,52.,41.,72.),.4);
  float arrival=smoothstep(0.,1.85,age)*(1.-smoothstep(8.75,11.,age));
  // Dim neutral incident light reveals turning planes. Middle air is composited
  // afterwards, naturally swallowing the lower-contrast fragments again.
  vec3 dark=vec3(.0095,.011,.0105),light=vec3(.010,.011,.010);
  color=mix(color,dark+light*rear.y,rear.x*arrival*.67);
  color=mix(color,dark+light*narrow.y,narrow.x*arrival*.59);
  return mix(color,dark+light*main.y,main.x*arrival*.78);
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
  color=jointPassingMass(color,pixel-farOffset,surface,time);
  vec3 middleOrigin=jointRayOrigin(pixel-middleOffset);
  float middle=jointAir(middleOrigin,surface,vec3(-16.2,-16.7,-7.2),vec3(4.0,18.,3.8),time,1.);
  color=mix(color,vec3(.078,.084,.079),middle*.54);
  return color+jointFallingGrit(pixel,surface,middleOffset,farOffset,time);
}
`;
