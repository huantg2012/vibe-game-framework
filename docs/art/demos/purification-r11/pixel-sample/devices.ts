import { PixelLayer, type Ink, type Point, type Material } from './raster';

type Tone = number;
const TOP = [0, 0, 1] as const;
const FRONT = [0, 1, .12] as const;
const RIGHT = [.85, .25, .12] as const;
const LEFT = [-.65, .45, .12] as const;
const clamp = (n: number, low = 0, high = 1): number => Math.min(high, Math.max(low, n));
const bump = (n: number, center: number, width: number): number => Math.exp(-(((n-center)/width)**2));
const normal = (x: number, y: number, z: number): NonNullable<Ink['normal']> => {
  const d = Math.hypot(x,y,z) || 1;
  return [x/d,y/d,z/d];
};
const ink = (material: Material, tone: Tone, n: Ink['normal'] = FRONT, light = .65): Ink => ({
  material, tone, normal:n, light,
  roughness: material === 'paint' ? .74 : material === 'rust' ? .94 : material === 'steel' ? .42 : .78,
  specular: material === 'steel' ? .68 : material === 'paint' ? .17 : .08,
});
const metal = (tone: Tone, n: Ink['normal'] = FRONT, light = .65): Ink => ink('steel', tone, n, light);
const cavity: Ink = {...ink('steel',.65,FRONT,.1),roughness:.83,specular:.08,occlusion:.3};

/** C-space contours stay unchanged; the section beneath each contour is now curved. */
function oval(cx: number, cy: number, rx: number, ry: number, count = 40): Point[] {
  return Array.from({length:count},(_,i) => {
    const a = i/count*Math.PI*2;
    return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry] as const;
  });
}
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, count = 18): Point[] {
  return Array.from({length:count+1},(_,i) => {
    const a = (from+(to-from)*i/count)*Math.PI/180;
    return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry] as const;
  });
}
function annulus(cx:number,cy:number,rx:number,ry:number,ix:number,iy:number,from:number,to:number):Point[] {
  return [...arc(cx,cy,rx,ry,from,to),...arc(cx,cy,ix,iy,to,from)];
}

/** A recessed head has a seated socket, sloped crown and interrupted contact edge. */
function fastener(p:PixelLayer,x:number,y:number,r=3):void {
  p.poly(oval(x,y,r+1,r*.78+1,8),{...metal(.7,FRONT,.2),occlusion:.4,specular:.18});
  p.surface(oval(x,y,r,r*.76,6),(px,py) => ({
    ...metal(2.9,normal((px-x)/r*.5,1,(y-py)/r*.7),.55),roughness:.32,specular:.72,
  }));
  p.line([[x-1,y+.3],[x+1,y+.3]],metal(1.1,FRONT,.15),1);
}

/** Vertical cast section: a broad cheek turns through a soft corner, not flat strips. */
function castCheek(p:PixelLayer,outline:readonly Point[],x0:number,x1:number,y0:number,y1:number,
  tone:number,turn0:number,turn1:number):void {
  p.surface(outline,(x,y) => {
    const u=clamp((x-x0)/(x1-x0)), v=clamp((y-y0)/(y1-y0));
    const a=turn0+(turn1-turn0)*(u*u*(3-2*u));
    const cap=bump(v,0,.033)*.6, foot=bump(v,.98,.06)*.28;
    // The cast skin is planished along the load axis. Broad, shallow facets bend
    // a reflection in coherent clusters; they never paint grime over the metal.
    const worked=Math.sin(y*.17+Math.sin(x*.082)*2.1)*.055
      + Math.sin(x*.29+y*.037)*.025;
    const shoulder=bump(u,.26+.022*Math.sin(y*.09),.11);
    const finish=.5+.5*Math.sin(y*.12+Math.sin(x*.11)*1.4);
    return {
      ...metal(tone+.13*bump(v,.24,.26)-.18*bump(v,.88,.12),normal(Math.sin(a)+worked,Math.cos(a),.055+cap+foot+worked*.42),.68),
      roughness:.50-shoulder*.17+finish*.085,specular:.68+shoulder*.08,
      occlusion:1-.12*bump(v,.98,.025),
    };
  });
}

/** Cast-in relief: bevel normals and a deeper back wall carry the shape without dirt. */
function longPocket(p:PixelLayer,x:number,y:number,w:number,h:number,slant=0):void {
  const outline:Point[]=[[x+3,y],[x+w-3,y+slant],[x+w,y+5+slant],[x+w,y+h-5+slant],
    [x+w-4,y+h+slant],[x+3,y+h],[x,y+h-5],[x,y+5]];
  p.surface(outline,(px,py)=>{
    const u=clamp((px-x)/w), v=clamp((py-y-slant*u)/h);
    const edge=Math.min(u,1-u,v*h/w,(1-v)*h/w);
    const lip=bump(edge,.045,.05), back=clamp((edge-.075)/.08);
    const nx=u<.5?1:-1;
    const nz=v<.12?-.75:v>.88?.85:0;
    return {
      ...metal(1.65+lip*.62-back*.16,normal(nx*(1-back)*.78,.35+back*.65,nz*(1-back)),.34+.2*lip),
      roughness:.56,specular:.43,occlusion:.52+.35*(1-back),
    };
  });
  // Lower recess edge receives a reflected sliver, while the upper edge stays seated.
  p.line([[x+4,y+h-2],[x+w-4,y+h-2+slant]],metal(2.5,normal(0,.6,.8),.42),1);
}

function buildOffering(): PixelLayer {
  const p = new PixelLayer('offering');
  // Load goes from the barrel into two thick, splayed cast feet.
  p.surface([[540,472],[550,469],[559,489],[554,513],[540,512]],(x,y)=>({
    ...metal(2.2+.3*bump(y,491,13),normal(-.5+(x-540)/27,.8,.12),.48),roughness:.58,
  }));
  p.surface([[616,475],[632,474],[638,508],[626,514],[616,505]],(x,y)=>({
    ...metal(2.1,normal(.35+(x-616)/31,.7,(501-y)/95),.45),roughness:.58,
  }));
  p.surface([[525,492],[546,491],[551,498],[546,513],[521,510],[521,498]],(_x,y)=>({
    ...metal(2.3,normal(-.15,.86,bump(y,496,3)*.85),.5),roughness:.55,
  }));
  p.surface([[608,487],[622,484],[631,511],[619,518],[611,509]],(_x,y)=>({
    ...metal(2.4,normal(.42,.78,bump(y,491,5)*.55),.5),roughness:.53,
  }));
  // Receding barrel has a convex sidewall and two casting flanges. It is one volume.
  p.surface(oval(602,453,54,55),(x,y)=>{
    const a=Math.atan2((y-453)/55,(x-602)/54);
    return {...metal(2.45+.12*Math.cos(a+1.2),normal(.68,Math.cos(a)*.25+.4,-Math.sin(a)*.7),.55),
      roughness:.48,specular:.6};
  });
  p.surface([[588,400],[610,400],[627,407],[640,421],[650,442],[654,463],[648,483],
    [634,500],[615,509],[600,507],[621,488],[632,469],[633,444],[621,421]],(x,y)=>{
    const a=Math.atan2((y-453)/55,(x-598)/54);
    const flange=bump(x,641,3);
    return {...metal(2.28+.18*flange,normal(.68+flange*.12,.38,-Math.sin(a)*.8),.55),roughness:.5,specular:.58};
  });
  // Circular bearing section. Radial normal changes through the rounded casting,
  // so the broad sheen, dark middle band and thin return belong to the same metal.
  const ringSurface=(x:number,y:number):Ink=>{
    const dx=(x-582)/49,dy=(y-453)/54,r=Math.hypot(dx,dy);
    const section=clamp((r-.655)/.345);
    // The broad machined face is very slightly crowned. Most of the curvature
    // belongs to its two substantial corner radii, not an inflated torus.
    const q=section<.23 ? -.88+section/.23*.62
      : section>.78 ? .26+.61*((section-.78)/.22) : -.26+(section-.23)*(.52/.55);
    const front=Math.sqrt(1-q*q);
    const az=Math.atan2(dy,dx);
    const corner=section<.23||section>.78;
    const tool=.038*Math.sin(r*128+Math.sin(az*7)*.7);
    const crown=q+tool*(corner?.2:1);
    const burnish=bump(az,-2.22,.5)+bump(az,1.9,.27);
    return {...metal(2.93-.10*Math.sin(az),normal(Math.cos(az)*crown,front,-Math.sin(az)*crown),.61),
      roughness:corner?.48:.39-burnish*.12,specular:corner?.63:.8,occlusion:section<.13?.8:1};
  };
  p.surface(oval(582,453,49,54),ringSurface);
  // The bore is displaced backward, exposing an actual inner cylinder. Only the
  // rear aperture is transparent; no black disc or illustrated ring outline.
  p.surface(oval(581,454,34,39),(x,y)=>{
    const dx=(x-581)/34,dy=(y-454)/39,a=Math.atan2(dy,dx);
    const exposed=clamp((589-x)/38);
    return {...metal(1.9+.3*exposed,normal(-Math.cos(a)*.8,.32,Math.sin(a)*.8),.38),
      roughness:.54,specular:.48,occlusion:.45+.3*exposed};
  });
  p.clearPoly(oval(589,450,25,32));
  p.surface(annulus(581,454,35,40,32.5,37.5,17,148),(x,y)=>{
    const a=Math.atan2((y-454)/40,(x-581)/35);
    return {...metal(3.0,normal(-Math.cos(a)*.65,.62,Math.sin(a)*.65),.57),roughness:.31,specular:.79};
  });
  // A parting seam separates two bolted half castings. The seam is a cut, not a
  // full perimeter outline; only the lower mating edge picks up a reflection.
  p.line([[546,416],[552,421]],{...metal(.95,FRONT,.18),occlusion:.4},1);
  p.line([[606,488],[613,496]],{...metal(.9,FRONT,.15),occlusion:.4},1);
  p.line([[607,490],[611,495]],metal(3.2,TOP,.4),1);
  fastener(p,542,449,3);
  fastener(p,619,457,3);
  fastener(p,537,502,2.5);
  // A narrow machined socket cuts into the rear shoulder of the casting.
  p.poly([[640,437],[648,441],[651,454],[646,457],[641,451]],{...metal(.75,RIGHT,.1),occlusion:.35});
  p.surface([[642,438],[647,440],[649,450],[646,452],[643,448]],(_x,y)=>({
    ...metal(2.7,normal(.8,.3,(448-y)/15),.4),roughness:.3,specular:.7,
  }));
  // Replaceable bore liner: three seated sectors have inward-facing walls and
  // a thin machined landing. The interruptions are assembly gaps, not an icon.
  for(const [from,to] of [[146,232],[244,317],[329,438]] as const) {
    p.surface(annulus(581,454,36,41,32.8,37.6,from,to),(x,y)=>{
      const a=Math.atan2((y-454)/41,(x-581)/36);
      const r=Math.hypot((x-581)/36,(y-454)/41);
      return {...metal(2.2+(r>.972?.55:0),normal(-Math.cos(a)*.62,.56,Math.sin(a)*.72),.52),
        roughness:.3,specular:.78,occlusion:r>.972?.96:.76};
    });
  }
  // Two mating tongues at the split make the front ring a compressed assembly.
  p.poly([[543,420],[548,414],[559,421],[555,427]],{...metal(.92,FRONT,.18),occlusion:.45});
  p.surface([[545,420],[549,416],[557,421],[553,425]],(_x,_y)=>({
    ...metal(3.05,normal(-.6,.55,.55),.56),roughness:.32,specular:.71,
  }));
  p.surface([[552,425],[556,422],[560,425],[557,429]],(_x,_y)=>({
    ...metal(2.08,normal(.57,.64,-.2),.4),roughness:.4,specular:.54,occlusion:.77,
  }));
  // One over-centre lock seats in a recess at the right-hand split. A cast upper
  // lug, lower striker and articulated link physically bridge the divided ring.
  p.poly([[615,434],[621,433],[632,446],[633,461],[622,471],[615,464]],
    {...metal(.76,FRONT,.15),occlusion:.32});
  p.surface([[614,435],[620,436],[627,443],[622,448],[615,445]],(_x,y)=>({
    ...metal(2.65,normal(.3,.8,(444-y)/12),.55),roughness:.43,specular:.62,
  }));
  p.surface([[617,460],[624,456],[631,460],[626,467],[620,470],[616,467]],(_x,y)=>({
    ...metal(2.28,normal(.46,.78,(464-y)/12),.48),roughness:.45,specular:.62,
  }));
  p.surface([[621,443],[625,442],[630,451],[628,458],[623,464],[620,462],[625,454],[626,451]],(x,_y)=>({
    ...metal(3.0,normal((x-624)/8,.77,.35),.64),roughness:.27,specular:.8,
  }));
  fastener(p,626,453,2.7);
  return p;
}

/** The contained substance is reclaimed Rift matter, not a manufactured lamp.
 * Draw the restraint behind the mass first; the front jaws interrupt it later. */
function paintConstrainedCore(p: PixelLayer): void {
  const matter = (tone: Tone, normal: Ink['normal'] = FRONT, response = .28): Ink =>
    ink('alien',tone,normal,response);
  const stressed = (tone: Tone = 6): Ink => ({ material:'alien',tone,normal:FRONT,light:0,emission:true });

  // Open receiving well and contact shoes replace the former sealed glass tube.
  p.poly([[351,563],[365,554],[408,554],[425,565],[419,579],[362,580],[349,573]], metal(2));
  p.poly([[353,562],[367,553],[408,554],[422,563],[413,572],[363,570]], metal(4,TOP,.8));
  p.poly([[365,559],[376,554],[400,555],[411,562],[405,569],[374,568],[363,565]], metal(0,TOP,0));
  p.poly([[369,562],[382,558],[400,561],[403,565],[391,569],[375,566]], matter(0,TOP,.1));
  p.poly([[354,480],[360,475],[374,482],[374,490],[367,493],[355,488]], metal(1,RIGHT,.35));
  p.poly([[353,477],[358,473],[374,480],[369,484],[356,482]], metal(3,TOP,.6));
  p.poly([[405,459],[420,451],[426,455],[426,463],[410,473],[405,469]], metal(1,LEFT,.35));
  p.poly([[407,458],[420,451],[424,454],[410,463]], metal(3,TOP,.65));
  p.poly([[404,517],[420,508],[426,511],[425,520],[410,531]], metal(1,LEFT,.3));

  // Uneven lobes are being pulled into one another. The silhouette is offset,
  // interrupted and blunt; it has neither crystal facets nor a regular emblem.
  p.poly([[386,427],[393,431],[393,441],[402,445],[408,452],[406,463],[414,467],
    [412,478],[418,489],[411,499],[413,508],[405,515],[408,526],[402,535],
    [400,545],[392,551],[381,542],[378,533],[367,529],[370,519],[361,509],
    [366,499],[361,485],[366,476],[360,464],[368,456],[365,446],[377,442],[379,433]], matter(1));
  // The far return stays almost black, making the green matter a solid volume.
  p.poly([[397,447],[407,453],[406,464],[414,468],[411,479],[417,489],[409,500],
    [411,508],[402,515],[405,526],[399,536],[395,539],[397,523],[389,514],
    [394,504],[398,496],[400,485],[395,474],[399,464]], matter(0,RIGHT,.05));
  // Wide incompatible pieces interpenetrate. Dark material cuts through the upper
  // fold, preventing a self-contained bright diamond or upward flame silhouette.
  p.poly([[375,444],[385,445],[388,448],[399,447],[405,453],[401,460],
    [403,467],[394,469],[389,465],[380,470],[369,464],[370,454]], matter(2,FRONT,.15));
  p.poly([[373,451],[384,452],[391,456],[401,453],[405,457],[401,462],
    [390,464],[383,458],[371,457]], matter(0,FRONT,.03));
  p.poly([[376,451],[384,453],[390,457],[397,456],[398,459],[391,460],[383,456],[375,454]], matter(1,TOP,.08));
  p.poly([[370,456],[374,454],[380,457],[380,460],[374,459],[371,462]], matter(3,LEFT,.15));
  p.poly([[395,448],[401,450],[404,454],[400,453],[396,451]], matter(3,TOP,.1));
  p.poly([[371,465],[378,466],[381,470],[377,473],[373,472]], matter(2,FRONT,.12));
  // One broad, low-value mass crosses the middle, rather than a bright winding
  // ribbon surrounding a black hole. Its blunt overlap is the dominant shape.
  p.poly([[369,477],[379,476],[384,480],[395,478],[403,485],[402,490],
    [407,496],[401,507],[393,509],[386,505],[375,508],[368,501],[370,492],[366,486]], matter(1,FRONT,.12));
  p.poly([[372,485],[382,484],[388,487],[396,485],[400,490],[397,498],
    [390,501],[382,498],[375,501],[371,494]], matter(2,FRONT,.09));
  p.poly([[372,486],[377,487],[379,490],[376,494],[373,492]], matter(3,LEFT,.15));
  p.poly([[392,485],[399,486],[397,493],[401,496],[397,502],[389,499],[390,491]], matter(0,RIGHT,.02));
  p.poly([[393,488],[397,489],[395,494],[398,497],[395,499],[392,496]], matter(1,FRONT,.04));
  p.poly([[379,477],[385,479],[392,477],[400,480],[402,484],[395,482],
    [388,484],[381,482]], matter(0,FRONT,0));
  p.line([[380,483],[384,484],[388,487]], matter(3,TOP,.12),1);
  p.poly([[397,505],[403,503],[403,507],[398,511],[393,510]], matter(2,TOP,.1));
  p.poly([[370,514],[379,511],[384,515],[394,514],[399,519],[399,527],
    [395,534],[397,540],[391,545],[384,540],[382,532],[373,530]], matter(1,FRONT,.1));
  p.poly([[375,516],[381,516],[386,520],[394,518],[396,521],[393,526],
    [387,527],[384,534],[379,530],[377,524]], matter(2,LEFT,.12));
  p.poly([[377,516],[381,517],[384,520],[383,523],[380,521]], matter(3,TOP,.1));

  // Actual gaps split the visible matter. Rear wall remains visible between the pieces.
  p.clearPoly([[370,477],[375,476],[380,480],[383,481],[380,484],[375,481],[371,481]]);
  p.clearPoly([[394,518],[403,515],[407,516],[405,520],[398,522],[394,521]]);
  p.poly([[400,432],[407,434],[410,440],[408,445],[403,443],[404,438]], matter(1,RIGHT,.15));
  p.poly([[404,435],[407,436],[407,440],[405,439]], matter(2,LEFT,.1));
  p.poly([[366,438],[370,435],[373,439],[372,444],[369,445]], matter(1,LEFT,.1));
  p.poly([[415,491],[419,488],[422,492],[421,497],[417,499]], matter(2,RIGHT,.2));
  p.poly([[372,536],[376,538],[378,543],[375,548],[371,544]], matter(1,LEFT,.15));

  // A few stressed seams and stretched contact ribbons carry the emission.
  // The large dark heart and most green surfaces are expressly non-emissive.
  p.line([[371,457],[375,457],[378,459]], matter(4,LEFT,.1),1);
  p.line([[396,451],[400,452]], matter(4,TOP,.1),1);
  p.line([[373,492],[376,495],[379,496]], stressed(5),1);
  p.line([[381,520],[384,522]], matter(4,TOP,.1),1);
  p.poly([[360,487],[368,489],[374,493],[370,495],[366,492],[359,491]], matter(3,LEFT,.25));
  p.line([[361,489],[366,490],[370,493]], stressed(6),1);
  p.poly([[402,468],[410,461],[416,460],[413,465],[407,468],[406,473]], matter(3,TOP,.3));
  p.line([[406,469],[410,465],[414,464]], stressed(6),1);
  p.poly([[400,520],[407,523],[418,517],[417,522],[408,529],[402,527]], matter(2,TOP,.2));
  p.line([[405,524],[409,526],[414,523]], stressed(5),1);

  // Front jaws visibly overlap and compress the matter at unequal heights.
  p.poly([[353,486],[362,488],[369,486],[375,491],[373,497],[366,498],[360,495],[353,495]], metal(1,FRONT,.45));
  p.poly([[354,485],[361,487],[368,485],[375,490],[371,492],[367,490],[361,492],[354,490]], metal(3,TOP,1));
  p.line([[362,488],[367,488],[371,490]], metal(5,TOP,1),1);
  p.poly([[368,491],[373,492],[373,496],[369,495]], metal(2,RIGHT,.6));
  p.rect(374,493,2,2,stressed(7));
  p.poly([[409,459],[419,455],[426,457],[426,465],[420,468],[411,471],[407,468]], metal(1,FRONT,.4));
  p.poly([[408,459],[419,454],[425,457],[418,460],[413,465],[408,466]], metal(3,TOP,1));
  p.line([[409,460],[414,458],[418,457]], metal(4,TOP,1),1);
  p.poly([[407,464],[410,463],[412,467],[408,470],[405,468]], metal(2,LEFT,.8));
  p.rect(405,469,2,2,stressed(7));
  p.poly([[411,520],[422,514],[425,517],[423,524],[412,532],[406,529],[406,525]], metal(1,FRONT,.35));
  p.poly([[410,520],[421,513],[425,516],[420,520],[411,525],[407,524]], metal(3,TOP,.75));
  p.line([[410,522],[416,519]], metal(4,TOP,.9),1);

  // Two grounded restraint fingers clasp the lower mass instead of enclosing a tube.
  p.poly([[361,559],[365,544],[373,534],[381,537],[381,542],[375,546],[373,559],[367,566]], metal(1,FRONT,.35));
  p.poly([[363,557],[368,545],[374,538],[379,539],[374,543],[370,556],[369,563]], metal(3,LEFT,.8));
  p.line([[367,546],[372,540],[376,540]], metal(4,LEFT,1),1);
  p.poly([[404,561],[402,547],[395,538],[396,531],[402,531],[410,542],[415,558],[410,566]], metal(1,RIGHT,.35));
  p.poly([[405,556],[404,545],[398,538],[399,533],[404,538],[412,557],[408,563]], metal(3,TOP,.75));
  p.line([[399,535],[403,540],[405,546]], metal(4,LEFT,1),1);
  p.rect(381,539,2,2,stressed(6));
  p.poly([[377,558],[382,553],[389,555],[391,560],[386,565],[380,563]], matter(1,TOP,.1));
  p.line([[380,562],[385,563],[388,561]], matter(3,TOP,.15),1);
  p.line([[355,564],[363,561]], metal(4,TOP,.6),1);
  p.line([[404,570],[414,566]], metal(4,TOP,.65),1);
}


function buildCore(): PixelLayer {
  const p = new PixelLayer('core');
  // A cast plinth has a continuous rounded apron, a heavy horizontal flange and
  // an inset mounting bed. Its front is a section of the same load-bearing body.
  p.surface([[301,579],[327,569],[413,567],[453,580],[476,601],[476,615],[454,627],
    [417,634],[330,630],[292,620],[279,608],[281,597]],(x,y)=>{
    const nx=clamp((x-380)/105,-1,1), lower=clamp((y-596)/34);
    return {...metal(2.45-.3*lower,normal(nx*.74,.9-nx*nx*.25,.22-lower*.2),.54),
      roughness:.5,specular:.63,occlusion:1-lower*.2};
  });
  p.surface([[289,593],[329,579],[415,576],[453,589],[470,602],[452,615],[416,623],
    [330,620],[293,609]],(x,y)=>{
    const nx=clamp((x-380)/108,-1,1),front=clamp((y-590)/31);
    return {...metal(2.64,normal(nx*.32,front*.6,.93-front*.45),.6),roughness:.49,specular:.64};
  });
  p.surface([[290,581],[322,572],[412,571],[445,579],[456,589],[452,604],[418,614],
    [326,611],[289,600]],(x,y)=>({
    ...metal(2.6,normal((x-377)/145,.92,.05),.54),roughness:.46,specular:.68,
    occlusion:.9-.2*bump(y,600,2),
  }));
  p.surface([[291,579],[323,568],[407,567],[446,578],[456,587],[420,600],[326,598],
    [291,589]],(x,y)=>({
    ...metal(2.7,normal((x-375)/380,.1+bump(y,594,5)*.4,.98),.6),roughness:.58,specular:.57,
  }));
  // The machine bed is machined lower than its surrounding rim. This annular
  // ledge changes height and gloss; it is not a painted panel on the plinth.
  p.surface([[306,582],[330,574],[405,573],[433,581],[441,587],[416,594],[332,593]],(x,_y)=>({
    ...metal(2.45,normal((x-376)/400,.06,1),.54),roughness:.36,specular:.73,occlusion:.82,
  }));
  p.line([[304,583],[330,575],[407,574]],{...metal(1.2,TOP,.3),occlusion:.5},1);
  p.line([[331,593],[415,595],[440,587]],metal(3.1,TOP,.5),1);
  p.line([[294,606],[330,617],[415,620],[451,611]],{...metal(1.3,FRONT,.25),occlusion:.6},1);

  // The accepted reclaimed Rift mass and unequal restraint jaws remain intact.
  paintConstrainedCore(p);

  // Both uprights are thick castings with rolled cheeks and returning inner
  // flanges. Curvature exists over the whole clean face, before any small detail.
  castCheek(p,[[303,397],[322,379],[344,378],[367,384],[368,404],[360,413],
    [360,564],[373,579],[365,588],[342,587],[320,579],[303,558]],303,367,398,583,2.9,-1.17,1.13);
  castCheek(p,[[304,398],[331,399],[340,407],[339,551],[345,570],[351,581],
    [341,585],[321,576],[304,557]],304,343,398,578,3.05,-.9,.48);
  // The inner flange faces the restrained mass, then rolls away into a deep bus slot.
  p.surface([[344,401],[361,399],[361,414],[357,415],[357,558],[368,577],[361,581],
    [347,563],[344,550]],(x,y)=>{
    const u=clamp((x-344)/17), bend=bump(y,562,17);
    return {...metal(2.45,normal(Math.sin(u*1.4+.05),Math.cos(u*1.4+.05),bend*.4),.69),
      roughness:.36,specular:.72};
  });
  p.surface([[303,397],[322,379],[344,378],[367,384],[355,399],[331,404]],(x,y)=>{
    const edge=bump(y,399,4);
    return {...metal(3.12,normal((x-334)/85,edge*.5,.92),.6),roughness:.52,specular:.59};
  });
  // A dovetailed keeper is let into the cap, exposing its seating walls and
  // a raised curved back. Its interruption explains the cap's thickness.
  p.poly([[322,385],[334,382],[348,388],[335,395],[316,394]],{...metal(1.13,TOP,.25),occlusion:.46});
  p.surface([[323,386],[334,383],[345,388],[334,393],[318,392]],(_x,y)=>({
    ...metal(2.7,normal(-.12,(y-388)/10,.92),.44),roughness:.39,specular:.61,occlusion:.76,
  }));
  p.surface([[321,394],[334,396],[349,389],[347,392],[335,399],[321,397]],(_x,_y)=>({
    ...metal(2.8,normal(-.08,.85,.42),.46),roughness:.34,specular:.65,
  }));
  p.poly([[310,405],[332,407],[339,405],[340,410],[331,412],[310,410]],{...metal(1.3,FRONT,.28),occlusion:.6});
  p.surface([[313,405],[330,407],[336,406],[331,409],[313,408]],(_x,_y)=>({
    ...metal(3.05,normal(-.2,.62,.76),.5),roughness:.33,specular:.74,
  }));
  // A structural recess leaves metal webs above and below; its backing is inset,
  // its long sides are concave, and its foot can receive reflected light.
  longPocket(p,309,431,21,73,2);
  p.surface([[317,446],[322,447],[323,487],[320,493],[316,491]],(_x,_y)=>({
    ...metal(2.3,normal(-.15,.92,.08),.32),roughness:.6,specular:.32,occlusion:.66,
  }));
  // Shielded bus channel, separate from the load bearing casting around it.
  p.poly([[349,418],[356,416],[356,550],[351,562],[349,556]],{...metal(.7,RIGHT,.12),occlusion:.36});
  p.surface([[351,422],[354,420],[354,551],[351,558]],(_x,_y)=>({
    ...metal(1.6,normal(.6,.5,.04),.45),roughness:.34,specular:.66,occlusion:.6,
  }));
  for(const [top,bottom] of [[431,474],[481,527],[535,551]] as const) {
    p.surface([[356,top],[359,top-2],[359,bottom],[356,bottom+3]],(_x,_y)=>({
      ...metal(2.4,normal(-.85,.5,.03),.8),roughness:.3,specular:.77,occlusion:.85,
    }));
  }
  p.line([[350,476],[358,475]],{...metal(.45,TOP,.12),occlusion:.4},2);
  p.line([[350,530],[359,530]],{...metal(.45,TOP,.12),occlusion:.4},2);
  // Compression shoe is an actual thicker saddle around the foot of the casting.
  p.surface([[307,519],[331,523],[335,550],[344,565],[336,576],[321,569],[308,552]],(x,y)=>{
    const u=clamp((x-307)/37);
    return {...metal(2.78,normal(Math.sin(-.7+u),Math.cos(-.7+u),bump(y,523,6)*.6),.57),roughness:.47,specular:.65};
  });
  longPocket(p,314,530,13,20,2);
  p.surface([[309,554],[320,566],[337,575],[343,572],[345,579],[338,583],[319,573]],(_x,_y)=>({
    ...metal(3.1,normal(-.4,.65,.6),.65),roughness:.35,specular:.73,
  }));
  fastener(p,317,417,2.5);
  fastener(p,319,511,2.6);
  fastener(p,333,564,2.4);

  castCheek(p,[[405,381],[425,377],[446,380],[468,399],[469,559],[452,582],
    [435,587],[416,585],[406,578],[419,565],[419,399],[406,397]],419,469,399,582,2.65,-.37,1.24);
  castCheek(p,[[430,402],[446,401],[451,411],[450,548],[445,563],[433,581],
    [420,583],[420,576],[430,562]],430,450,402,579,2.9,-.24,.68);
  p.surface([[405,381],[425,377],[446,380],[468,399],[448,403],[420,400],[420,389]],(x,y)=>({
    ...metal(2.95,normal((x-425)/80,.12+bump(y,400,3)*.55,.93),.55),roughness:.53,specular:.59,
  }));
  p.poly([[425,382],[436,382],[452,394],[441,396],[433,389]],{...metal(1.18,TOP,.25),occlusion:.47});
  p.surface([[426,383],[435,383],[449,393],[442,394],[434,388]],(_x,y)=>({
    ...metal(2.7,normal(.1,(y-386)/19,.91),.43),roughness:.4,specular:.61,occlusion:.77,
  }));
  // A left facing inner return catches only localized pollution bounce.
  p.surface([[420,402],[431,402],[431,561],[421,578],[410,579],[418,569],[421,559]],(x,y)=>{
    const u=clamp((x-420)/11);
    return {...metal(2.15,normal(-Math.cos(u*.85),.27+u*.5,bump(y,568,10)*.3),.72),roughness:.35,specular:.7};
  });
  p.poly([[421,414],[427,413],[427,552],[421,565],[417,569],[421,552]],{...metal(.65,LEFT,.15),occlusion:.33});
  for(const [top,bottom] of [[431,474],[481,527],[535,550]] as const) {
    p.surface([[423,top],[426,top+1],[426,bottom],[423,bottom+3]],()=>({
      ...metal(2.5,normal(-.8,.6,.02),.82),roughness:.3,specular:.75,occlusion:.83,
    }));
  }
  longPocket(p,434,433,11,70,0);
  p.surface([[432,518],[445,518],[447,546],[439,563],[430,571],[425,569],[433,553]],(_x,y)=>({
    ...metal(2.66,normal(.3,.86,bump(y,520,4)*.45),.56),roughness:.48,specular:.62,
  }));
  longPocket(p,434,531,8,17,0);
  p.surface([[445,550],[451,546],[451,555],[438,579],[431,580],[435,573]],(_x,_y)=>({
    ...metal(2.5,normal(.7,.48,.42),.53),roughness:.42,specular:.63,
  }));
  fastener(p,438,416,2.4);
  fastener(p,438,510,2.3);
  // Only selected assembly seams interrupt the reflected vertical body.
  p.line([[450,407],[464,407]],{...metal(1.25,RIGHT,.25),occlusion:.7},1);
  p.line([[450,511],[466,508]],{...metal(1.3,RIGHT,.24),occlusion:.68},1);

  // The long cast cheeks terminate in transverse bearing saddles. Each saddle
  // has a recessed joint and a pressure key carried by the metal beneath it;
  // it interrupts the clean plane by changing construction, not by surface wear.
  p.poly([[305,505],[327,508],[340,507],[343,514],[329,518],[307,514]],
    {...metal(.95,FRONT,.2),occlusion:.48});
  p.surface([[305,501],[327,504],[339,503],[341,510],[327,513],[306,509]],(x,y)=>{
    const u=clamp((x-305)/36);
    return {...metal(2.95,normal(Math.sin(-.8+u),Math.cos(-.8+u),bump(y,505,3)*.65),.62),
      roughness:.4,specular:.68};
  });
  p.surface([[308,513],[327,516],[340,513],[340,518],[328,522],[309,518]],(_x,_y)=>({
    ...metal(2.12,normal(-.25,.9,-.1),.4),roughness:.52,specular:.5,occlusion:.76,
  }));
  // Small tapered key sits in the saddle's pocket, with its head above the seat.
  p.poly([[317,504],[324,505],[325,519],[318,517]],{...metal(.7,FRONT,.18),occlusion:.35});
  p.surface([[318,505],[323,506],[323,515],[319,514]],(_x,_y)=>({
    ...metal(2.85,normal(-.4,.74,.24),.54),roughness:.31,specular:.7,
  }));
  p.surface([[432,503],[446,503],[465,500],[465,509],[446,513],[432,511]],(x,y)=>({
    ...metal(2.63,normal(.32+(x-432)/80,.8,bump(y,505,3)*.48),.54),roughness:.43,specular:.63,
  }));
  p.poly([[432,511],[446,514],[466,510],[466,514],[446,518],[432,515]],
    {...metal(1.04,FRONT,.24),occlusion:.55});
  p.poly([[443,505],[448,504],[448,518],[443,519]],{...metal(.76,RIGHT,.2),occlusion:.4});
  p.surface([[444,506],[447,505],[447,515],[444,516]],()=>({
    ...metal(2.7,normal(.48,.75,.24),.49),roughness:.32,specular:.67,
  }));

  // Plinth joint and access stair: tread thickness and nosing reflections replace
  // labels, arbitrary scratches and decorative outlined panels.
  p.poly([[331,602],[356,604],[356,611],[331,609]],{...metal(1.0,FRONT,.15),occlusion:.4});
  p.surface([[334,604],[354,605],[354,609],[334,608]],(_x,_y)=>({
    ...metal(2.6,normal(-.1,.9,.3),.36),roughness:.4,specular:.6,
  }));
  p.surface([[402,586],[428,582],[442,622],[422,629],[413,612]],(_x,_y)=>({
    ...metal(2.2,normal(.12,.9,.2),.46),roughness:.6,specular:.45,
  }));
  const steps:readonly (readonly Point[])[]=[
    [[404,584],[427,581],[431,590],[408,594]],
    [[409,596],[432,591],[436,600],[413,605]],
    [[414,608],[437,602],[440,612],[419,618]],
  ];
  for(const points of steps) {
    const frontY=(points[2]![1]+points[3]![1])*.5;
    p.surface(points,(_x,y)=>({
      ...metal(2.88,normal(.06,bump(y,frontY,2.7)*.5,.94),.6),roughness:.58,specular:.55,
    }));
    p.line([points[3]!,points[2]!],metal(3.35,normal(.1,.6,.8),.62),1);
  }
  fastener(p,310,591,2.5);
  fastener(p,386,608,2.2);
  return p;
}

function buildPurifier(): PixelLayer {
  const p = new PixelLayer('purifier');
  // Deep pressed-steel enclosure. Side, roof and folded mouth are separate pieces
  // of one shell with rounded returns, never a bright outline on a flat rectangle.
  p.surface([[612,548],[643,536],[741,543],[746,553],[750,612],[717,625],[608,612]],(_x,_y)=>({
    ...metal(2.32,normal(.12,.95,.08),.5),roughness:.54,specular:.5,
  }));
  p.surface([[718,554],[744,545],[750,611],[718,623]],(x,y)=>{
    const u=clamp((x-718)/31), top=clamp((y-552)/65);
    return {...metal(2.52-.18*top,normal(.38+u*.45,.8-u*.52,.05+bump(y,553,5)*.35),.52),
      roughness:.55,specular:.5};
  });
  p.surface([[614,545],[642,535],[741,543],[716,555]],(x,y)=>{
    const along=(x-615)/120, front=clamp((y-(545+along*8))/7);
    return {...metal(3.27,normal(.05,.15+front*.45,1-front*.3),.62),roughness:.47,specular:.65};
  });
  // Rolled front fascia turns continuously from the roof into its vertical face.
  p.surface([[615,546],[717,555],[718,621],[615,610]],(x,y)=>{
    const top=547+(x-615)*.088, d=y-top;
    const lip=Math.exp(-Math.max(0,d)/3.5);
    return {...metal(2.98,normal((x-665)/900,.95-lip*.33,.08+lip*.83),.6),roughness:.45,specular:.65};
  });
  // Offset cavity has side jambs, a rear manifold and a return sill.
  p.poly([[622,557],[708,564],[709,610],[622,603]],{...cavity,occlusion:.2});
  p.surface([[622,557],[630,560],[630,600],[622,604]],(_x,_y)=>({
    ...metal(1.77,normal(.83,.28,.06),.29),roughness:.56,specular:.45,occlusion:.56,
  }));
  p.surface([[628,560],[707,566],[704,572],[630,566]],(_x,_y)=>({
    ...metal(1.18,normal(0,.2,-1),.21),roughness:.6,specular:.36,occlusion:.3,
  }));
  p.surface([[704,565],[708,564],[709,610],[703,607]],(_x,_y)=>({
    ...metal(1.66,normal(-.86,.35,.05),.32),roughness:.53,specular:.48,occlusion:.49,
  }));
  p.surface([[623,602],[703,607],[709,610],[706,614],[623,607]],(_x,_y)=>({
    ...metal(2.62,normal(0,.22,.98),.48),roughness:.48,specular:.57,occlusion:.73,
  }));
  // The roof inspection hatch is recessed into a pressed seat. The edge is a
  // shallow change in plane; the large lid reflects as one slightly bowed sheet.
  p.poly([[648,539],[726,545],[709,553],[632,547]],{...metal(1.22,TOP,.35),occlusion:.57});
  p.surface([[649,540],[721,546],[708,551],[637,546]],(x,_y)=>{
    const bow=clamp((x-641)/77);
    return {...metal(3.05,normal((bow-.5)*.3,.08+.17*Math.sin(bow*Math.PI),.98),.56),
      roughness:.6,specular:.48};
  });
  p.line([[640,546],[708,552],[723,546]],metal(2.2,normal(.05,.65,.76),.4),1);
  // Vertical filter cartridges retain the accepted three-cylinder read. Their
  // ceramic bodies turn continuously, while machined collars have narrow sheen.
  const tanks=[{x:632,y:565,h:38},{x:660,y:568,h:38},{x:687,y:571,h:37}];
  for(const {x,y,h} of tanks) {
    p.surface([[x+7,y-7],[x+12,y-6],[x+12,y+1],[x+7,y]],(px,_py)=>({
      ...metal(2.2,normal((px-x-9)/4,.9,.05),.33),roughness:.32,specular:.7,occlusion:.65,
    }));
    p.surface([[x,y],[x+5,y-3],[x+14,y-2],[x+18,y+2],[x+18,y+h],[x+12,y+h+4],
      [x+3,y+h+2],[x,y+h-1]],(px,py)=>{
      const u=clamp((px-x)/18), a=-1.38+u*2.75;
      const capShadow=.6*bump(py,y+7,4);
      return {...ink('chalk',3.18-capShadow,normal(Math.sin(a),Math.cos(a),.04),.6),
        roughness:.6,specular:.22,occlusion:.86};
    });
    p.surface(oval(x+9,y+1,9,3,16),(px,py)=>({
      ...metal(3.25,normal((px-x-9)/20,.2+(py-y)/5,.8),.49),roughness:.3,specular:.76,occlusion:.9,
    }));
    p.surface(oval(x+9,y-1,6,2,12),(_px,_py)=>({
      ...metal(2.4,normal(0,.2,1),.38),roughness:.42,specular:.55,occlusion:.63,
    }));
    p.surface([[x+1,y+3],[x+7,y+5],[x+13,y+5],[x+17,y+3],[x+17,y+7],
      [x+13,y+9],[x+7,y+9],[x+1,y+7]],(px,_py)=>{
      const a=-1.3+clamp((px-x)/18)*2.6;
      return {...metal(2.55,normal(Math.sin(a),Math.cos(a),.12),.46),roughness:.29,specular:.76,occlusion:.78};
    });
    p.surface([[x+1,y+h-3],[x+7,y+h-1],[x+13,y+h-1],[x+17,y+h-3],[x+17,y+h],
      [x+12,y+h+3],[x+5,y+h+2],[x+1,y+h]],(px,_py)=>{
      const a=-1.3+clamp((px-x)/18)*2.6;
      return {...metal(2.75,normal(Math.sin(a),Math.cos(a),.26),.53),roughness:.32,specular:.7,occlusion:.81};
    });
  }
  // Side service hatch: an inset shell with a dished center, not another decal.
  p.surface([[726,563],[739,559],[742,590],[728,595]],(x,y)=>{
    const u=clamp((x-726)/16), v=clamp((y-560)/35), edge=Math.min(u,1-u,v*2,(1-v)*2);
    const lip=bump(edge,.09,.08),depth=clamp((edge-.1)/.18);
    return {...metal(2.2+lip*.35-depth*.3,normal(.75,.48+(u-.5)*.15,.05),.4),
      roughness:.59,specular:.43,occlusion:.75-depth*.15};
  });
  p.poly([[731,573],[735,572],[736,580],[732,581]],{...metal(.62,RIGHT,.1),occlusion:.35});
  p.surface([[732,573],[734,573],[735,578],[733,579]],()=>({
    ...metal(2.35,normal(.85,.2,.3),.35),roughness:.33,specular:.58,
  }));
  // Two service latches are thick enough to stand proud of the housing.
  for(const points of [
    [[610,596],[619,597],[620,611],[613,616],[606,612],[606,603]],
    [[701,606],[709,606],[715,610],[715,623],[704,624],[698,620],[698,612]],
  ] as const) {
    const x0=points[0][0],y0=points[0][1];
    p.surface(points,(x,y)=>({
      ...metal(2.64,normal((x-x0-2)/15,.8,bump(y,y0+2,3)*.7),.51),roughness:.4,specular:.7,
    }));
  }
  fastener(p,619,551,2.2);
  fastener(p,712,560,2.2);
  fastener(p,739,604,2.1);
  // One drain beneath the lowest receiver; its darkness is a through opening.
  p.poly([[672,611],[680,612],[679,616],[674,617]],{...metal(.6,FRONT,.14),occlusion:.35});
  p.line([[673,611],[679,612]],metal(3.05,TOP,.42),1);
  return p;
}

export function buildDeviceLayers(): PixelLayer[] {
  return [buildOffering(),buildCore(),buildPurifier()];
}
