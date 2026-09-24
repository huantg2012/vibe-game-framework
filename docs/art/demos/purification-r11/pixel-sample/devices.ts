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
  return p;
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

  // Core cradle and glass: the dark internal structure remains visible around the light.
  p.poly([[351,563],[365,554],[408,554],[425,565],[419,579],[362,580],[349,573]], metal(2));
  p.poly([[353,562],[367,554],[406,554],[422,563],[411,569],[366,570]], metal(4, TOP));
  p.ellipse(386,564,24,8,metal(5,TOP));
  p.ellipse(386,561,19,6,metal(2,TOP));
  p.poly([[372,475],[379,469],[398,469],[404,477],[404,554],[396,561],[378,558],[371,553]], ink('glass',2));
  p.poly([[374,479],[381,481],[381,552],[375,551]], ink('glass',4,LEFT,.9));
  p.poly([[398,479],[402,476],[402,551],[397,554]], ink('glass',1,RIGHT,.3));
  p.poly([[382,481],[391,482],[395,478],[395,548],[390,554],[382,552]], ink('glass',4,FRONT,1));
  p.rect(383,488,6,56,{material:'light',tone:6,emission:true,light:0});
  p.rect(384,503,3,25,{material:'light',tone:7,emission:true,light:0});
  // Short clamps interrupt the vessel rather than outlining every glass edge.
  p.poly([[370,472],[378,470],[397,470],[405,473],[405,479],[397,483],[377,481],[371,479]], metal(3));
  p.ellipse(387,472,18,6,metal(5,TOP));
  p.ellipse(387,469,12,6,metal(3,TOP));
  p.line([[379,464],[388,462],[396,466]], metal(5,TOP), 2);
  p.poly([[372,548],[379,552],[399,550],[404,546],[404,553],[397,559],[378,558],[372,554]], metal(3));
  p.line([[375,550],[382,553],[394,553]], metal(5,TOP), 2);
  p.rect(379,560,4,8,metal(2));
  p.rect(393,559,4,8,metal(2));

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
  p.poly([[625,602],[708,608],[708,613],[625,607]], metal(4,TOP));
  p.poly([[621,549],[708,557],[708,563],[621,557]], ink('paint',3));
  p.poly([[722,561],[740,555],[741,579],[724,585]], ink('paint',2,RIGHT));
  p.line([[724,588],[741,582]], metal(1,RIGHT), 2);
  p.line([[622,547],[646,540],[665,542]], metal(5,TOP), 1);
  // Three replaceable cylinders share construction, not random surface texture.
  const tanks = [{x:632,y:565,h:38},{x:660,y:568,h:38},{x:687,y:571,h:37}];
  for (const {x,y,h} of tanks) {
    p.poly([[x,y],[x+5,y-3],[x+14,y-2],[x+18,y+2],[x+18,y+h],[x+12,y+h+4],
      [x+3,y+h+2],[x,y+h-1]], metal(2));
    p.rect(x+3,y+2,10,h-3,metal(3));
    p.rect(x+4,y+5,3,h-8,metal(4,LEFT));
    p.poly([[x+14,y+3],[x+17,y+2],[x+17,y+h],[x+13,y+h+3]], metal(1,RIGHT));
    p.ellipse(x+9,y+1,9,3,metal(4,TOP));
    p.ellipse(x+9,y-1,6,2,metal(2,TOP));
    p.line([[x+1,y+7],[x+7,y+9],[x+16,y+8]], metal(1), 1);
    p.line([[x+1,y+h-2],[x+7,y+h],[x+15,y+h-1]], metal(4,TOP), 1);
    p.rect(x+7,y+18,5,8,ink('paint',2));
  }
  p.poly([[610,596],[619,597],[620,611],[613,616],[606,612],[606,603]], metal(2));
  p.poly([[609,596],[615,593],[622,596],[619,601],[609,600]], metal(4,TOP));
  p.poly([[701,606],[709,606],[715,610],[715,623],[704,624],[698,620],[698,612]], metal(2));
  p.poly([[700,606],[706,603],[714,607],[710,612],[699,611]], metal(4,TOP));
  p.poly([[724,600],[730,599],[730,605],[725,608]], ink('rust',2,RIGHT));
  p.poly([[628,550],[637,551],[637,554],[631,553],[628,555]], ink('rust',2));
  bolts(p, [[617,551],[710,560],[720,609]], 5);
  return p;
}

export function buildDeviceLayers(): PixelLayer[] {
  return [buildOffering(), buildCore(), buildPurifier()];
}
