import { PixelLayer, type Ink, type Point, type Material } from './raster';

type Tone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const TOP = [0, 0, 1] as const;
const FRONT = [0, 1, .12] as const;
const RIGHT = [.85, .25, .12] as const;
const LEFT = [-.65, .45, .12] as const;
const ink = (material: Material, tone: Tone, normal: Ink['normal'] = FRONT, light = .65): Ink => ({ material, tone, normal, light });
const metal = (tone: Tone, normal: Ink['normal'] = FRONT, light = .65): Ink => ink('steel', tone, normal, light);
const cavity = ink('void', 0, FRONT, 0);

/** Deliberate contour samples retain the ellipse's oblique depth at display scale. */
function oval(cx: number, cy: number, rx: number, ry: number, count = 24): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const a = i / count * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as const;
  });
}

function bolts(p: PixelLayer, points: readonly Point[], tone: Tone = 4): void {
  for (const [x, y] of points) {
    p.rect(x, y, 3, 3, metal(1));
    p.rect(x, y, 2, 1, metal(tone));
  }
}

function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, count = 10): Point[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const angle = (from + (to - from) * i / count) * Math.PI / 180;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as const;
  });
}

function ringArc(p: PixelLayer, from: number, to: number, outerX: number, outerY: number,
  innerX: number, innerY: number, paint: Ink): void {
  p.poly([...arc(582,453,outerX,outerY,from,to),
    ...arc(582,453,innerX,innerY,to,from)], paint);
}

function buildOffering(): PixelLayer {
  const p = new PixelLayer('offering');
  // Back casting and its short feet, kept within C's existing footprint.
  p.poly([[541,471],[549,463],[558,485],[555,514],[541,512]], metal(1));
  p.poly([[617,478],[632,475],[638,509],[626,513]], metal(2, RIGHT));
  p.poly([[535,492],[546,493],[544,514],[521,510],[522,497]], metal(2));
  p.poly([[534,491],[546,492],[550,497],[536,499],[522,497]], metal(4, TOP));
  p.poly([[609,487],[624,484],[633,512],[619,517]], metal(2, RIGHT));
  p.poly([[608,487],[616,484],[623,506],[619,517],[612,507]], metal(3));
  p.poly(oval(602, 453, 55, 54), metal(1, RIGHT));
  p.poly([[590,400],[610,401],[628,408],[641,423],[651,443],[654,466],[647,485],
    [634,502],[615,509],[602,506],[621,490],[632,471],[633,444],[621,420]], metal(2, RIGHT));
  p.poly([[605,404],[623,411],[635,426],[638,433],[627,428],[620,417]], metal(3, TOP));
  // Front iron ring: one broad body, a lit upper arc, dark returning lower arc.
  p.poly(oval(582, 453, 49, 54), metal(3));
  p.poly([[533,451],[536,431],[547,413],[565,402],[582,399],[601,403],[616,416],
    [611,427],[599,417],[582,412],[568,415],[553,425],[547,440],[546,453]], metal(4, LEFT));
  p.poly([[536,469],[547,481],[563,491],[582,495],[600,489],[613,476],[623,454],
    [631,454],[627,479],[615,496],[600,505],[582,508],[563,504],[547,494]], metal(2));
  // Cut through both the extruded casting and front disc; no painted black plug.
  const hole = oval(581, 454, 34, 39);
  p.clearPoly(hole);
  p.poly([[558,426],[569,419],[582,416],[595,419],[603,425],[596,425],[584,422],
    [572,425],[564,432],[558,445],[556,456],[551,467],[548,455],[550,439]], metal(1, RIGHT));
  p.poly([[559,478],[571,488],[584,491],[597,486],[608,474],[614,455],[613,442],
    [609,451],[608,465],[600,478],[588,484],[577,484],[566,479]], metal(4, TOP));
  // Casting seams and a small maintained paint patch define manufacture.
  p.line([[582,400],[582,411]], metal(2), 2);
  p.line([[616,417],[608,426]], metal(2), 2);
  p.line([[538,435],[549,439]], metal(2), 2);
  p.line([[541,478],[552,473]], metal(1), 2);
  p.line([[580,496],[580,507]], metal(1), 2);
  p.poly([[546,417],[552,412],[559,415],[555,421],[550,422]], ink('paint', 3, LEFT));
  p.poly([[603,496],[612,491],[616,493],[607,501]], ink('rust', 2));
  p.line([[539,435],[542,425],[547,417]], metal(5, LEFT), 1);
  p.line([[565,403],[576,400]], metal(5, TOP), 1);
  bolts(p, [[540,451],[549,486],[612,435],[603,501]], 4);

  // A recessed bore has its own cylindrical wall and a smaller rear aperture.
  // Looking through the front opening exposes the left and lower inner wall;
  // the visible aperture is offset toward the receding right-hand casting.
  p.poly(oval(581,454,34,39), metal(1,RIGHT,.24));
  p.poly([[552,434],[561,421],[578,416],[594,419],[606,430],[612,444],[611,460],
    [600,476],[582,482],[566,475],[558,463],[555,448]], metal(2,LEFT,.35));
  p.poly([[551,450],[554,469],[566,484],[582,492],[598,486],[608,472],[605,465],
    [596,479],[581,483],[568,477],[560,466],[557,452]], metal(2,TOP,.4));
  p.clearPoly(oval(589,450,25,32));
  p.line(arc(589,450,26,33,132,246,9), metal(1,RIGHT,.1), 2);
  p.line(arc(589,450,26,33,17,76,6), metal(3,TOP,.3), 1);
  // Broad front annulus stays quiet; these are bevels and seated segments,
  // not a luminous outline around both sides of the cast metal.
  ringArc(p,185,251,49,54,46,51,metal(4,LEFT,.5));
  ringArc(p,251,281,49,54,46,51,metal(5,TOP,.45));
  ringArc(p,281,315,49,54,46,51,metal(3,TOP,.4));
  ringArc(p,4,76,48,53,45,50,metal(1,RIGHT,.12));
  ringArc(p,84,153,48,53,45,50,metal(2,FRONT,.28));
  ringArc(p,153,223,36,41,34,39,metal(1,RIGHT,.15));
  ringArc(p,40,119,36,41,34,39,metal(4,TOP,.45));
  // The receding body is three connected cast segments, each with a return.
  p.poly([[628,417],[635,420],[646,439],[649,449],[643,448],[638,432]], metal(2,RIGHT,.22));
  p.poly([[644,452],[653,451],[653,465],[648,480],[641,488],[639,481],[645,466]], metal(1,RIGHT,.12));
  p.line([[627,417],[637,426],[643,438]], metal(3,RIGHT,.3), 1);
  p.line([[639,450],[650,451]], metal(0,RIGHT,0), 2);
  p.line([[631,482],[641,488]], metal(0,RIGHT,0), 2);
  p.poly([[550,409],[558,405],[567,406],[565,411],[557,415],[553,415]], ink('paint',3,TOP,.4));
  p.poly([[555,410],[559,409],[560,412],[557,414],[554,414]], metal(4,TOP,.4));
  p.line([[543,418],[546,415]], metal(5,LEFT,.3), 1);
  p.poly([[547,492],[554,495],[555,501],[551,500],[550,497],[547,496]], ink('rust',2,FRONT,.18));
  p.poly([[536,497],[545,498],[543,504],[535,503]], metal(1,FRONT,.2));
  p.line([[523,498],[534,500]], metal(3,TOP,.25), 1);
  p.line([[616,507],[619,511]], metal(4,TOP,.25), 1);
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
  // The base follows the original elliptical polygon and its lower, dark return.
  p.poly([[301,579],[327,569],[413,567],[453,580],[476,601],[476,615],[454,627],
    [417,634],[330,630],[292,620],[279,608],[281,597]], metal(1));
  p.poly([[292,594],[329,581],[415,578],[454,590],[469,605],[452,615],[416,622],
    [330,620],[294,609]], metal(3, TOP));
  p.poly([[280,599],[293,607],[330,617],[416,619],[453,610],[469,600],[475,603],
    [469,615],[449,624],[414,630],[329,627],[291,616],[281,609]], metal(2));
  p.line([[289,612],[328,625],[367,628]], metal(3), 2);
  p.poly([[290,581],[322,572],[412,571],[445,579],[456,589],[452,604],[418,614],
    [326,611],[289,600]], metal(2));
  p.poly([[291,579],[323,568],[407,567],[446,578],[456,587],[420,599],[326,597],
    [291,589]], metal(4, TOP));
  p.poly([[302,583],[328,575],[407,574],[435,581],[443,586],[416,593],[329,592]], metal(3, TOP));
  p.line([[291,590],[324,601],[362,603]], metal(1), 2);
  p.line([[420,602],[449,592]], metal(1), 2);
  p.line([[366,603],[366,627]], metal(1), 2);
  p.line([[326,601],[323,623]], metal(1), 2);
  p.line([[452,596],[458,612]], metal(1), 2);
  p.poly([[299,600],[317,605],[316,613],[300,608]], ink('paint', 2));
  p.poly([[344,600],[356,601],[356,605],[344,605]], ink('rust', 2));

  paintConstrainedCore(p);

  // Left load-bearing shoulder: silhouette and plane breaks copied from C.
  p.poly([[303,397],[322,379],[344,378],[367,384],[368,404],[360,412],[360,565],
    [373,579],[365,588],[342,587],[320,579],[303,558]], metal(2));
  p.poly([[303,397],[322,379],[344,378],[330,397]], metal(5,TOP));
  p.poly([[331,397],[345,379],[365,383],[354,397]], metal(4,TOP));
  p.poly([[304,398],[331,399],[334,560],[347,580],[341,585],[321,576],[304,557]], metal(3,LEFT));
  p.poly([[333,399],[349,399],[349,563],[362,581],[348,583],[336,567]], metal(2));
  p.poly([[349,400],[362,399],[361,414],[355,415],[355,560],[367,578],[361,581],[349,562]], metal(1,RIGHT));
  p.poly([[306,408],[328,408],[328,431],[307,429]], ink('paint',3,LEFT));
  p.poly([[307,433],[320,433],[320,437],[311,436],[311,440],[307,438]], ink('rust',2,LEFT));
  p.poly([[307,444],[324,445],[326,465],[321,466],[321,451],[307,450]], metal(2,LEFT));
  p.line([[305,433],[330,435]], metal(1), 2);
  p.line([[306,506],[331,510]], metal(1), 2);
  p.line([[337,438],[347,438]], metal(1), 2);
  p.line([[337,506],[347,508]], metal(1), 2);
  p.line([[306,399],[321,383]], metal(6,TOP), 1);
  p.line([[309,455],[309,476]], metal(4,LEFT), 1);
  p.line([[338,566],[347,579]], metal(4,LEFT), 1);
  bolts(p, [[310,417],[322,421],[310,515],[322,519],[341,545]], 4);

  // Right shoulder returns into shadow; its inward lip catches the vessel light.
  p.poly([[405,381],[425,377],[446,380],[468,399],[469,559],[452,582],[435,587],
    [416,585],[406,578],[419,565],[419,399],[406,397]], metal(2));
  p.poly([[406,381],[425,377],[438,381],[447,399],[420,399],[419,386]], metal(4,TOP));
  p.poly([[438,380],[447,381],[468,399],[455,400]], metal(3,TOP));
  p.poly([[447,400],[467,401],[467,557],[450,579],[437,583],[447,562]], metal(2,RIGHT));
  p.poly([[430,402],[445,402],[445,562],[433,580],[420,581],[430,564]], metal(3));
  p.poly([[421,401],[430,402],[430,565],[419,579],[409,577],[420,564]], metal(1));
  p.poly([[423,412],[427,412],[427,553],[423,561]], metal(4,LEFT,.95));
  p.poly([[433,408],[443,408],[443,430],[433,428]], ink('paint',2));
  p.poly([[433,433],[442,434],[442,441],[437,438],[433,439]], ink('rust',2));
  p.line([[450,435],[465,435]], metal(1), 2);
  p.line([[431,434],[444,436]], metal(1), 2);
  p.line([[432,508],[445,508],[466,506]], metal(1), 2);
  p.line([[407,381],[424,380],[437,383]], metal(5,TOP), 1);
  bolts(p, [[435,416],[435,517],[450,552]], 4);

  // Pressed service plates are middle-sized forms within the load-bearing metal.
  // Their paint survives on protected faces; wear belongs to fasteners and lips.
  p.poly([[308,441],[323,443],[327,448],[328,495],[324,502],[310,499]], metal(1,LEFT,.35));
  p.poly([[310,443],[322,445],[325,449],[326,493],[323,498],[312,497]], ink('paint',2,LEFT,.5));
  p.poly([[310,443],[322,445],[323,450],[322,489],[319,494],[312,494]], ink('paint',3,LEFT,.5));
  p.poly([[311,452],[314,453],[314,470],[312,468]], ink('paint',4,LEFT,.3));
  p.poly([[312,476],[315,477],[315,486],[319,489],[318,492],[312,490]], metal(3,LEFT,.4));
  p.line([[310,498],[322,500]], metal(3,LEFT,.4), 1);
  // Recessed high-current bus runs up the inward return, behind the lit lip.
  p.poly([[350,417],[356,416],[356,554],[352,563],[350,560]], metal(0,RIGHT,0));
  p.rect(352,425,2,23,metal(2,RIGHT,.35));
  p.rect(352,480,2,20,metal(2,RIGHT,.35));
  p.poly([[351,522],[356,520],[356,538],[352,542]], metal(2,LEFT,.5));
  p.poly([[356,436],[360,434],[359,477],[357,479]], metal(2,RIGHT,1));
  p.poly([[356,480],[360,478],[360,532],[357,536]], metal(3,RIGHT,1));
  p.poly([[357,538],[360,536],[360,562],[366,573],[363,575],[357,564]], metal(3,RIGHT,1));
  p.line([[358,492],[358,513]], metal(4,RIGHT,1), 1);
  p.line([[359,547],[360,558]], metal(4,RIGHT,1), 1);
  // The cap joint has a seated dark seam, machined upper lip, and one worn corner.
  p.poly([[322,379],[326,379],[311,397],[307,397]], metal(3,TOP,.35));
  p.line([[335,384],[346,382],[358,385]], metal(5,TOP,.3), 1);
  p.poly([[342,390],[352,390],[355,395],[338,395]], metal(2,TOP,.25));
  p.poly([[306,402],[328,403],[328,407],[307,406]], metal(1,LEFT,.2));
  p.line([[308,400],[321,400]], metal(4,LEFT,.25), 1);
  p.poly([[325,405],[328,406],[328,413],[325,411]], ink('rust',2,LEFT,.2));
  // Lower access cover and mechanically clamped foot leave the large middle calm.
  p.poly([[309,519],[324,522],[326,549],[320,554],[311,548]], metal(2,LEFT,.35));
  p.poly([[312,522],[322,524],[323,546],[319,548],[313,545]], metal(3,LEFT,.4));
  p.poly([[313,526],[320,528],[320,532],[313,530]], metal(1,LEFT,.2));
  p.poly([[319,550],[324,550],[331,565],[327,568],[321,560]], ink('rust',2,LEFT,.2));
  p.poly([[316,562],[323,565],[332,575],[329,578],[319,573]], metal(2,LEFT,.4));
  p.line([[319,564],[326,568]], metal(4,LEFT,.35), 1);
  bolts(p,[[311,445],[321,494],[314,539]],3);

  // Opposite shoulder has the same fabrication, but most detail disappears into its return.
  p.poly([[432,443],[442,443],[443,495],[435,501],[432,497]], metal(1,FRONT,.3));
  p.poly([[433,446],[440,446],[441,492],[436,497],[433,495]], ink('paint',2,FRONT,.4));
  p.line([[435,449],[435,470]], ink('paint',3,LEFT,.4),1);
  p.poly([[420,411],[424,411],[424,552],[420,565],[417,568],[421,551]], metal(0,RIGHT,0));
  p.poly([[423,436],[426,437],[426,477],[423,474]], metal(2,LEFT,1));
  p.poly([[423,478],[426,480],[426,532],[423,535]], metal(3,LEFT,1));
  p.poly([[423,537],[426,535],[426,554],[420,568],[417,570],[423,553]], metal(3,LEFT,1));
  p.line([[424,493],[424,514]], metal(4,LEFT,1),1);
  p.line([[422,554],[419,562]], metal(4,LEFT,1),1);
  p.poly([[432,520],[441,520],[441,545],[436,552],[432,550]], metal(2,FRONT,.4));
  p.line([[434,524],[439,524]], metal(1,FRONT,.2),1);
  p.poly([[449,407],[455,407],[454,552],[450,557]], metal(1,RIGHT,.15));
  p.line([[455,408],[464,408]], metal(2,RIGHT,.2),1);
  p.poly([[431,383],[438,384],[447,396],[440,396]], metal(2,TOP,.3));
  p.line([[413,384],[424,383]], metal(5,TOP,.3),1);
  p.poly([[435,558],[440,554],[442,556],[438,565],[433,568]], ink('rust',2,FRONT,.3));

  // Recessed pedestal panels, hinge brackets and a single inset service plaque.
  p.poly([[296,593],[319,599],[318,605],[298,600]], metal(2,FRONT,.3));
  p.poly([[299,594],[310,597],[310,600],[299,597]], ink('paint',3,FRONT,.35));
  p.poly([[331,602],[358,604],[358,612],[331,609]], metal(1,FRONT,.2));
  p.poly([[334,604],[353,605],[353,609],[334,608]], metal(2,FRONT,.3));
  p.line([[333,605],[341,606]], metal(4,FRONT,.2),1);
  p.poly([[377,606],[399,605],[399,615],[378,617]], metal(1,FRONT,.2));
  p.poly([[380,608],[397,607],[397,613],[380,615]], ink('paint',2,FRONT,.35));
  p.poly([[306,610],[312,612],[312,620],[307,618]], metal(1,FRONT,.2));
  p.poly([[341,617],[347,618],[347,627],[341,626]], metal(1,FRONT,.2));
  p.line([[301,585],[313,581]], metal(5,TOP,.3),1);
  p.line([[328,591],[350,593]], metal(4,TOP,.4),1);
  p.poly([[450,585],[453,587],[451,593],[448,594],[448,590]], ink('rust',2,TOP,.25));
  // C's short access steps remain on the front right of the base.
  p.poly([[402,586],[428,582],[442,622],[422,629],[413,612]], metal(1));
  p.poly([[404,584],[427,581],[431,590],[408,594]], metal(4,TOP));
  p.poly([[409,596],[432,591],[436,600],[413,605]], metal(3,TOP));
  p.poly([[414,608],[437,602],[440,612],[419,618]], metal(4,TOP));
  p.line([[408,594],[430,590]], metal(5,TOP), 1);
  p.line([[413,605],[435,600]], metal(4,TOP), 1);
  return p;
}

function buildPurifier(): PixelLayer {
  const p = new PixelLayer('purifier');
  p.poly([[612,548],[643,536],[741,543],[746,553],[750,612],[717,625],[608,612]], metal(1));
  p.poly([[615,545],[642,535],[741,543],[716,554]], metal(4,TOP));
  p.poly([[719,554],[744,546],[749,611],[719,621]], metal(2,RIGHT));
  p.poly([[615,546],[717,555],[718,620],[615,610]], metal(3));
  p.poly([[621,557],[708,563],[709,610],[622,603]], cavity);
  p.poly([[621,557],[630,559],[629,602],[622,603]], metal(1,RIGHT));
  // The manifold sits behind the replaceable filters and vanishes beneath the header.
  p.poly([[627,558],[704,564],[704,573],[628,568]], metal(0,FRONT,0));
  p.line([[629,565],[704,571]], metal(1,TOP,.15),1);
  p.poly([[700,563],[708,563],[709,610],[703,609]], metal(0,RIGHT,0));
  p.poly([[625,602],[708,608],[708,613],[625,607]], metal(2,TOP,.3));
  p.poly([[621,549],[708,557],[708,563],[621,557]], ink('paint',3));
  p.poly([[722,561],[740,555],[741,579],[724,585]], ink('paint',2,RIGHT));
  p.line([[724,588],[741,582]], metal(1,RIGHT), 2);
  p.line([[622,547],[646,540],[665,542]], metal(5,TOP), 1);
  // Glazed ceramic filter bodies have broad matte bands; machined steel belongs
  // to the cap and retaining collar. No texture is spread over these small forms.
  const tanks = [{x:632,y:565,h:38},{x:660,y:568,h:38},{x:687,y:571,h:37}];
  for (const {x,y,h} of tanks) {
    p.rect(x+7,y-6,5,7,metal(1,FRONT,.2));
    p.rect(x+8,y-5,2,5,metal(3,LEFT,.25));
    p.poly([[x,y],[x+5,y-3],[x+14,y-2],[x+18,y+2],[x+18,y+h],[x+12,y+h+4],
      [x+3,y+h+2],[x,y+h-1]], ink('chalk',1,RIGHT,.25));
    p.poly([[x+3,y+4],[x+8,y+5],[x+13,y+4],[x+13,y+h-3],[x+9,y+h],[x+3,y+h-2]], ink('chalk',3,FRONT,.65));
    p.poly([[x+4,y+7],[x+8,y+8],[x+8,y+h-7],[x+5,y+h-5],[x+3,y+h-7]], ink('chalk',4,LEFT,.7));
    p.poly([[x+12,y+5],[x+16,y+3],[x+16,y+h-2],[x+12,y+h]], ink('chalk',2,RIGHT,.25));
    p.ellipse(x+9,y+1,9,3,metal(3,TOP,.45));
    p.ellipse(x+9,y-1,6,2,metal(2,TOP,.2));
    p.poly([[x+1,y+4],[x+7,y+6],[x+13,y+6],[x+17,y+4],[x+17,y+6],[x+13,y+8],
      [x+7,y+8],[x+1,y+6]], metal(1,FRONT,.15));
    p.line([[x+3,y+5],[x+8,y+7],[x+12,y+7]], metal(2,TOP,.25),1);
    // The cap throws a short soft-value band onto the otherwise uninterrupted cylinder.
    p.poly([[x+3,y+8],[x+8,y+9],[x+13,y+8],[x+13,y+11],[x+7,y+12],[x+3,y+10]], ink('chalk',2,FRONT,.3));
    p.poly([[x+1,y+h-3],[x+7,y+h-1],[x+13,y+h-1],[x+17,y+h-3],[x+17,y+h],
      [x+12,y+h+3],[x+5,y+h+2],[x+1,y+h]], metal(2,FRONT,.25));
    p.line([[x+3,y+h-2],[x+8,y+h],[x+12,y+h-1]], metal(3,TOP,.35),1);
  }
  p.poly([[610,596],[619,597],[620,611],[613,616],[606,612],[606,603]], metal(2));
  p.poly([[609,596],[615,593],[622,596],[619,601],[609,600]], metal(4,TOP));
  p.poly([[701,606],[709,606],[715,610],[715,623],[704,624],[698,620],[698,612]], metal(2));
  p.poly([[700,606],[706,603],[714,607],[710,612],[699,611]], metal(4,TOP));
  p.poly([[724,600],[730,599],[730,605],[725,608]], ink('rust',2,RIGHT));
  p.poly([[628,550],[637,551],[637,554],[631,553],[628,555]], ink('rust',2));
  bolts(p, [[617,551],[710,560],[720,609]], 5);
  // Top inspection lid: one seated plate, four protected fasteners, one worn lip.
  p.poly([[647,540],[722,546],[708,552],[632,546]], metal(2,TOP,.35));
  p.poly([[648,541],[718,547],[708,550],[638,545]], ink('paint',3,TOP,.45));
  p.line([[641,545],[682,548]], metal(4,TOP,.4),1);
  p.poly([[650,541],[657,542],[653,543],[650,543]], metal(4,TOP,.3));
  p.poly([[698,546],[704,546],[705,548],[699,548]], ink('rust',2,TOP,.2));
  p.line([[664,547],[675,548]], metal(1,TOP,.2),1);
  // A single lower drain and a side access hatch make the box serviceable.
  p.poly([[726,563],[739,559],[742,590],[728,595]], metal(1,RIGHT,.12));
  p.poly([[728,565],[737,562],[739,587],[729,591]], ink('paint',2,RIGHT,.22));
  p.line([[730,568],[736,566]], metal(2,RIGHT,.15),1);
  p.poly([[730,576],[734,575],[735,581],[731,582]], metal(0,RIGHT,0));
  p.line([[729,591],[738,588]], metal(2,TOP,.2),1);
  p.poly([[672,610],[679,611],[679,615],[674,616]], metal(1,FRONT,.2));
  p.rect(674,612,3,2,metal(3,TOP,.25));
  p.line([[627,612],[648,615]], metal(1,FRONT,.2),1);
  p.line([[649,613],[668,615]], metal(3,TOP,.3),1);
  p.poly([[638,603],[642,604],[642,608],[639,607]], ink('rust',2,FRONT,.25));
  // Clamps remain behind the necks, leaving the three principal ceramic curves intact.
  p.poly([[632,568],[635,569],[635,574],[632,573]], metal(1,FRONT,.15));
  p.poly([[660,571],[663,572],[663,577],[660,576]], metal(1,FRONT,.15));
  p.poly([[687,574],[690,575],[690,580],[687,579]], metal(1,FRONT,.15));
  p.line([[695,592],[698,592]], ink('chalk',2,FRONT,.3),1);
  return p;
}

export function buildDeviceLayers(): PixelLayer[] {
  return [buildOffering(), buildCore(), buildPurifier()];
}
