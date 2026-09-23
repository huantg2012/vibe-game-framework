/**
 * R8 master drawing. Each named face is an authored piece of one complete construction.
 * Coordinates are final 640×400 pixels, projection X=x, Y=y+Z. This is an editable
 * layered source plate, not a generated noise recipe. SVG/PNG and surface manifests
 * are derived by tools/art-pipeline/purification-r8.ts from these very same faces.
 */
export type Point = readonly [number, number];
export type Layer = 'far' | 'middle' | 'near' | 'architecture' | 'floor' | 'foreground';
export interface Plane {
  normal: readonly [number, number, number]; elevation: number;
  originX?: number; originY?: number; riseX?: number; riseY?: number;
  occlusion?: number; roughness?: number;
}
export interface Face { id: string; layer: Layer; color: string; points: readonly Point[]; plane: Plane | null }

/** DEC-180 material colours: painted mineral grey, lime plaster, oxidised binder.
 * Warm material is matte; it does not emit. Teal stays inside exterior contact seams. */
export const MATERIAL = {
  void: '#080b10', far: '#111922', farTop: '#19212c', farReturn: '#0d121a',
  distant: '#202b37', distantTop: '#303f4b', distantSide: '#141e29',
  outer: '#293440', outerTop: '#44515b', outerShade: '#1a2330',
  cavity: '#151b23', deep: '#10161d', underside: '#1c202b',
  concrete: '#454b50', concreteDark: '#303941', cap: '#4e575e', capWorn: '#60696d',
  slate: '#3d4b55', slateShade: '#303c47', slateWorn: '#4a585f',
  plaster: '#65605a', plasterShade: '#4e4a47', plasterWorn: '#80796b',
  binder: '#665347', binderShade: '#443a35', lime: '#a19482',
  floor: '#343d43', floorOld: '#3b4346', floorWear: '#434b4d', floorShade: '#293238',
  upper: '#424a4e', upperWear: '#4b5252', upperOld: '#4b4c48',
  steel: '#343b43', steelEdge: '#626d77', steelSide: '#252c35',
  intrusion: '#15473f', intrusionDim: '#12302f',
} as const;

const faces: Face[] = [];
const f = (id: string, layer: Layer, color: string, points: readonly Point[], plane: Plane | null): void => {
  faces.push({ id, layer, color, points, plane });
};
const top = (z: number, occlusion = .96): Plane => ({ normal: [0,0,1], elevation: z, occlusion, roughness: .96 });
const front = (foot: number, z = 0, occlusion = .9): Plane => ({ normal: [0,1,0], elevation: z, originY: foot, riseY: -1, occlusion, roughness: .95 });
const side = (foot: number, sign: number, z = 0, occlusion = .8): Plane => ({ normal: [sign,0,0], elevation: z, originY: foot, riseY: -1, occlusion, roughness: .96 });
const c = MATERIAL;

// FAR — large ambiguous load paths. Detail is deliberately absent at this distance.
f('unbounded-dark', 'far', c.void, [[0,0],[640,0],[640,400],[0,400]], null);
f('remote-west-return', 'far', c.farReturn, [[0,36],[83,4],[207,4],[237,24],[193,31],[88,20],[0,68]], null);
f('remote-west-mass', 'far', c.far, [[0,48],[89,13],[173,18],[207,42],[129,38],[41,81],[0,91]], null);
f('remote-west-plane', 'far', c.farTop, [[0,48],[89,13],[173,18],[183,27],[91,23],[0,63]], null);
f('remote-east-pier', 'far', c.far, [[449,0],[482,0],[507,42],[565,57],[640,35],[640,119],[575,128],[535,107],[496,96]], null);
f('remote-east-underface', 'far', c.farReturn, [[507,58],[555,78],[640,56],[640,107],[576,116],[537,96]], null);
f('dropped-remote-beam', 'far', c.far, [[0,377],[46,350],[100,366],[132,399],[76,399],[39,375],[0,400]], null);
f('remote-below-room', 'far', c.far, [[390,400],[448,363],[506,363],[541,388],[601,372],[640,379],[640,400]], null);

// MIDDLE — one continuous displaced east mass passes behind the nearer bearing blocks.
f('east-displaced-body', 'middle', c.distantSide, [[482,36],[510,43],[546,107],[605,120],[640,102],[640,321],[609,332],[582,280],[578,220],[557,167],[533,138]], front(337,-42,.65));
f('east-displaced-receiving-face', 'middle', c.distant, [[494,43],[510,48],[545,111],[585,123],[584,153],[558,162],[543,140],[532,102]], front(285,-22,.75));
f('east-displaced-cap', 'middle', c.distantTop, [[484,36],[504,31],[520,39],[555,101],[605,115],[640,96],[640,108],[605,128],[544,112],[508,47]], top(127,.68));
f('east-displaced-fold', 'middle', c.distant, [[605,129],[640,109],[640,265],[619,276],[613,246],[616,194]], side(301,-1,-22,.70));
f('east-displaced-underhang', 'middle', c.distantSide, [[545,112],[605,128],[605,140],[557,137],[549,129]], {normal:[0,.2,-1],elevation:115,occlusion:.5});
f('east-lower-shear-return', 'middle', c.distantTop, [[589,260],[611,274],[640,266],[640,288],[610,302],[593,283]], top(-27,.7));
f('east-lower-shear-front', 'middle', c.distant, [[610,302],[640,288],[640,329],[623,341],[610,327]], front(344,-34,.65));
f('west-displaced-pier', 'middle', c.distantSide, [[0,99],[31,82],[51,111],[53,175],[39,208],[41,299],[13,322],[0,315]], side(325,1,-12,.66));
f('west-displaced-plane', 'middle', c.distant, [[0,110],[24,99],[35,117],[35,174],[22,206],[22,295],[0,308]], front(325,-12,.68));
f('west-displaced-cap', 'middle', c.distantTop, [[0,99],[31,82],[47,94],[26,106],[0,120]], top(157,.68));
f('west-displaced-basal-return', 'middle', c.distant, [[0,265],[23,247],[48,257],[55,283],[29,311],[0,315]], top(-20,.63));

// NEAR — physical outer-side contacts and supports. They are occluded by the room.
f('west-near-bearing', 'near', c.outerShade, [[57,157],[75,141],[102,177],[102,300],[81,351],[64,336],[61,276],[47,243]], side(349,1,-14,.73));
f('west-near-contact-top', 'near', c.outerTop, [[46,149],[69,136],[84,149],[105,181],[90,190],[70,160],[59,164]], top(103,.83));
f('west-near-contact-face', 'near', c.outer, [[46,149],[59,164],[70,160],[90,190],[84,215],[65,194],[53,181]], front(251,-4,.79));
f('west-contact-underfold', 'near', c.deep, [[54,180],[66,195],[83,214],[78,231],[62,215],[50,203]], {normal:[0,.4,-1],elevation:50,occlusion:.48});
f('east-near-shoulder', 'near', c.outerShade, [[581,159],[609,170],[614,231],[638,259],[640,307],[609,318],[579,286],[566,229]], side(336,-1,-9,.77));
f('east-near-thick-cap', 'near', c.outerTop, [[578,154],[599,146],[614,158],[611,176],[586,181],[572,169]], top(109,.80));
f('east-near-thick-face', 'near', c.outer, [[586,181],[611,176],[614,219],[640,255],[640,279],[611,254],[595,227]], front(316,-8,.81));
f('east-near-return', 'near', c.outerShade, [[572,169],[586,181],[595,227],[611,254],[609,270],[584,249],[574,212]], side(292,-1,-5,.72));
f('east-contact-long-shear', 'near', c.intrusionDim, [[586,185],[591,189],[588,219],[578,232],[560,231],[551,220],[554,216],[565,226],[578,225],[583,216]], null);
f('east-contact-loaded-tip', 'near', c.intrusion, [[578,225],[585,217],[586,211],[589,212],[588,220],[580,230],[565,230],[557,224],[558,221],[566,226]], null);
f('west-contact-loaded-tip', 'near', c.intrusion, [[69,197],[73,199],[78,224],[94,235],[92,240],[75,229]], null);
f('rear-compression-root', 'near', c.outerShade, [[254,0],[273,0],[293,25],[308,54],[307,103],[294,119],[283,111],[287,70],[276,50]], front(136,28,.64));
f('rear-compression-return', 'near', c.outer, [[271,0],[280,0],[303,29],[318,52],[317,101],[307,112],[307,68],[307,53],[291,29]], side(144,-1,20,.71));
f('rear-compression-contact', 'near', c.intrusionDim, [[296,94],[303,99],[308,117],[303,125],[297,115]], null);

// ARCHITECTURE — stable west shoulder. Large, uninterrupted cap and actual returns.
f('west-wall-outer-foot', 'architecture', c.underside, [[75,116],[114,71],[196,52],[242,63],[260,88],[349,89],[402,121],[427,155],[561,183],[583,220],[580,314],[551,344],[123,361],[85,331],[75,263]], front(352,-7,.70));
f('west-load-wall', 'architecture', c.slateShade, [[83,125],[113,92],[134,102],[124,165],[117,226],[119,318],[126,337],[98,326],[85,300]], side(335,1,0,.82));
f('west-load-wall-return', 'architecture', c.concreteDark, [[111,101],[133,102],[139,137],[126,186],[132,214],[112,244],[104,284],[100,311],[94,298],[99,241],[113,182]], side(316,1,0,.74));
f('west-shoulder-front', 'architecture', c.plasterShade, [[121,85],[195,68],[231,77],[231,115],[213,137],[143,145],[125,169],[129,120]], front(148,32,.89));
f('west-shoulder-coat', 'architecture', c.plaster, [[138,91],[194,79],[213,83],[213,126],[199,134],[144,140],[137,131]], front(148,32,.93));
f('west-shoulder-cap', 'architecture', c.cap, [[83,115],[114,71],[196,52],[239,65],[231,79],[195,68],[126,85],[105,114],[101,132]], top(118,.98));
f('west-shoulder-cap-worn', 'architecture', c.concrete, [[117,78],[151,68],[161,69],[177,63],[194,60],[212,66],[213,71],[195,69],[185,72],[172,72],[157,76],[129,82],[115,97],[107,100]], top(119,.96));
f('west-cap-end-return', 'architecture', c.concreteDark, [[231,79],[239,65],[245,90],[245,119],[231,115]], side(153,-1,32,.79));
f('west-coping-underhang', 'architecture', c.cavity, [[106,114],[126,85],[195,68],[231,79],[231,84],[194,74],[129,91],[109,122]], {normal:[0,.2,-1],elevation:106,occlusion:.62});
// Main back face steps down to the narrower right bay; no repeated broken teeth.
f('rear-middle-setback', 'architecture', c.slateShade, [[236,89],[266,101],[300,99],[307,110],[349,109],[380,128],[380,165],[370,154],[274,154],[234,138],[223,138]], front(154,32,.86));
f('rear-middle-plaster', 'architecture', c.slate, [[247,103],[266,112],[300,110],[308,119],[347,118],[365,129],[365,151],[277,150],[237,134]], front(155,32,.91));
f('rear-middle-cap', 'architecture', c.concrete, [[239,78],[269,88],[301,87],[310,98],[351,98],[390,120],[380,132],[347,113],[305,113],[298,103],[265,105],[239,95]], top(89,.93));
f('rear-cap-retained-ridge', 'architecture', c.concrete, [[244,82],[269,91],[300,90],[308,102],[350,102],[382,121],[380,124],[348,108],[307,108],[298,98],[267,99],[242,91]], top(92,.95));
f('east-bay-return', 'architecture', c.concreteDark, [[380,132],[390,120],[405,143],[407,176],[396,193],[396,174]], side(181,-1,32,.81));
f('west-wall-full-bearing', 'architecture', c.concrete, [[82,139],[90,138],[98,155],[89,240],[92,297],[108,326],[101,329],[86,307],[82,279],[80,217]], side(332,1,0,.86));
f('west-bearing-lime-loss', 'architecture', c.plasterShade, [[85,249],[91,238],[90,278],[96,302],[92,303],[86,286]], side(332,1,0,.88));

// EAST — a single sheared wall segment, with its displaced whole top and deep right return.
f('east-wall-understructure', 'architecture', c.concreteDark, [[403,151],[484,160],[528,177],[557,188],[570,219],[562,269],[550,270],[541,232],[460,232],[442,250],[407,245]], front(245,0,.88));
f('east-wall-main-face', 'architecture', c.plasterShade, [[413,163],[483,176],[505,184],[499,216],[463,218],[442,238],[418,228]], front(245,0,.89));
f('east-wall-retained-plaster', 'architecture', c.plaster, [[423,176],[481,186],[494,190],[491,210],[463,211],[442,229],[426,225]], front(245,0,.92));
f('east-wall-sheared-plane', 'architecture', c.slate, [[514,172],[549,183],[566,209],[555,236],[526,231],[511,221],[505,214]], front(241,0,.93));
f('east-shear-true-return', 'architecture', c.cavity, [[506,166],[516,171],[511,199],[510,216],[518,229],[510,232],[499,216],[503,187]], side(240,-1,0,.70));
f('east-wall-continuous-cap', 'architecture', c.cap, [[403,145],[483,155],[507,164],[505,180],[481,172],[410,160]], top(85,.95));
f('east-wall-displaced-cap', 'architecture', c.concrete, [[517,157],[554,170],[577,201],[568,212],[549,185],[513,172]], top(88,.97));
f('east-wall-displaced-edge', 'architecture', c.cap, [[521,159],[553,173],[571,196],[568,200],[550,178],[519,165]], top(90,.98));
f('east-wall-outward-face', 'architecture', c.concreteDark, [[577,201],[584,219],[580,290],[566,329],[547,333],[548,316],[556,277],[552,236],[568,212]], side(335,-1,0,.89));
f('east-wall-outward-return', 'architecture', c.slateShade, [[577,218],[580,220],[574,289],[561,323],[554,322],[562,286],[565,248]], side(333,-1,0,.94));
// One short strapping pair crosses the actual shear; dark steel is a secondary material.
f('east-shear-upper-restraint', 'architecture', c.steelSide, [[489,191],[526,202],[527,209],[488,199]], front(247,0,.88));
f('east-shear-upper-edge', 'architecture', c.steelEdge, [[489,190],[527,201],[527,204],[489,193]], top(53,.9));
f('east-shear-low-restraint', 'architecture', c.steel, [[494,212],[524,221],[525,226],[493,218]], front(245,0,.88));
f('east-shear-bonding', 'architecture', c.binder, [[489,194],[495,196],[495,201],[489,199]], null);
f('east-shear-bonding-east', 'architecture', c.binder, [[520,203],[526,205],[526,209],[520,207]], null);

// TERRACE FRONT — structure supporting the upper route and the main-floor core.
f('terrace-bearing-body', 'architecture', c.concreteDark, [[132,207],[190,207],[211,217],[263,221],[279,262],[239,267],[210,245],[124,253]], front(264,0,.9));
f('terrace-bearing-left-face', 'architecture', c.plasterShade, [[132,215],[189,215],[209,225],[223,240],[211,241],[197,232],[130,238]], front(250,0,.90));
f('terrace-bearing-load-plate', 'architecture', c.slateShade, [[211,225],[234,226],[239,237],[242,263],[239,264],[211,244]], front(266,0,.88));
f('core-recess-back', 'architecture', c.deep, [[231,224],[259,224],[274,262],[242,264],[239,245]], front(267,0,.51));
f('core-recess-left-return', 'architecture', c.steelSide, [[223,224],[231,224],[239,245],[242,264],[235,261],[232,244]], side(265,1,0,.73));
f('core-bearing-right-return', 'architecture', c.concrete, [[259,224],[263,226],[282,264],[274,266]], side(266,-1,0,.92));
f('core-recess-underside', 'architecture', c.cavity, [[229,224],[260,224],[264,231],[233,231]], {normal:[0,.25,-1],elevation:29,occlusion:.48});
f('terrace-east-between-ramps', 'architecture', c.slateShade, [[305,225],[328,218],[350,206],[350,233],[334,258],[326,265]], side(265,-1,0,.77));
f('terrace-east-front-face', 'architecture', c.plasterShade, [[350,218],[382,219],[388,248],[379,265],[334,265],[340,248]], front(267,0,.9));
f('terrace-east-front-coat', 'architecture', c.concrete, [[350,229],[377,225],[382,247],[375,258],[342,258],[346,244]], front(267,0,.92));

// FOUNDATION — continuous dropped slab and two downward supports, not a broken border.
f('foundation-long-slab', 'architecture', c.slateShade, [[94,306],[126,334],[368,334],[392,324],[548,318],[551,336],[396,343],[371,355],[121,355],[88,326]], front(335,0,.92));
f('foundation-main-fascia', 'architecture', c.concreteDark, [[126,342],[367,342],[393,332],[548,326],[546,342],[393,349],[370,361],[124,361],[94,337],[93,326]], front(341,-6,.84));
f('foundation-left-loaded-heel', 'architecture', c.underside, [[121,355],[177,355],[177,372],[158,380],[129,370]], front(355,-20,.76));
f('foundation-left-heel-face', 'architecture', c.slateShade, [[129,355],[168,355],[168,369],[154,373],[130,366]], front(355,-20,.83));
f('foundation-east-dropped-section', 'architecture', c.underside, [[396,343],[465,340],[484,354],[478,371],[446,381],[404,367]], front(345,-17,.72));
f('foundation-east-section-face', 'architecture', c.concreteDark, [[404,345],[462,342],[476,354],[468,364],[447,372],[406,361]], front(345,-16,.87));
f('foundation-east-exposed-core', 'architecture', c.plasterShade, [[451,344],[462,342],[476,354],[469,361],[458,351]], {normal:[.6,.8,0],elevation:-9,originY:345,riseY:-1,occlusion:.82});
f('foundation-long-underface', 'architecture', c.deep, [[179,355],[371,355],[395,345],[404,346],[404,354],[374,369],[179,368]], {normal:[0,.4,-1],elevation:-22,occlusion:.48});

// Surface marks are placed at construction joints or use zones. No random dots or islands.
f('west-pour-joint', 'architecture', c.binderShade, [[174,84],[177,83],[177,131],[174,133]], null);
f('west-pour-joint-fill', 'architecture', c.binder, [[175,85],[177,84],[177,105],[176,106],[177,127],[176,131]], null);
f('rear-old-sheet-joint', 'architecture', c.concreteDark, [[297,112],[299,112],[301,120],[301,151],[298,151],[298,121]], null);
f('west-plaster-bottom-loss', 'architecture', c.binderShade, [[143,128],[151,129],[158,126],[173,129],[173,133],[146,137],[139,133]], null);
f('west-plaster-exposed-lime', 'architecture', c.plasterWorn, [[144,128],[151,130],[161,128],[166,130],[165,132],[149,134],[143,132]], null);
f('east-plaster-bottom-wear', 'architecture', c.binderShade, [[426,217],[442,222],[458,208],[464,208],[454,218],[443,227],[430,224]], null);
f('east-plaster-lime-contact', 'architecture', c.plasterWorn, [[428,216],[441,220],[455,209],[459,210],[442,225],[430,222]], null);
f('foundation-construction-joint', 'architecture', c.steelSide, [[325,343],[328,343],[328,361],[325,361]], null);
f('foundation-joint-fill', 'architecture', c.binderShade, [[328,344],[330,344],[330,360],[328,360]], null);

// FLOOR. Authoring preserves the exact four collision polygons; only material is replaced.
// Base polygons are stamped by the runtime from CHAMBER_WALK_POLYGONS, preventing drift.
f('hall-west-working-surface', 'floor', c.floorOld, [[98,255],[191,250],[213,259],[207,277],[169,291],[138,298],[105,311],[97,299]], null);
f('hall-west-traffic-wear', 'floor', c.floorWear, [[98,285],[110,282],[118,286],[133,287],[152,283],[170,284],[172,287],[152,289],[134,293],[117,292],[100,298]], null);
f('hall-west-contact-wear', 'floor', c.floorOld, [[100,288],[121,290],[139,289],[137,291],[118,295],[100,293]], null);
f('hall-front-old-pour', 'floor', c.floorOld, [[298,311],[353,315],[376,313],[393,311],[418,312],[436,316],[447,316],[447,321],[392,324],[368,334],[299,334]], null);
f('hall-front-pour-contact', 'floor', c.floorShade, [[297,311],[300,310],[300,334],[297,334]], null);
f('hall-right-maintenance-coat', 'floor', c.floorOld, [[461,238],[538,238],[548,256],[545,270],[532,276],[495,279],[465,269],[447,258]], null);
f('hall-right-sole-wear', 'floor', c.floorWear, [[461,238],[484,238],[480,245],[465,255],[464,271],[458,268],[458,253]], null);
f('hall-right-wear-soft-stop', 'floor', c.floorOld, [[465,241],[477,240],[472,245],[464,254],[462,267],[461,261],[462,251]], null);
f('upper-central-working-plane', 'floor', c.upperWear, [[132,195],[145,193],[160,197],[178,199],[187,204],[208,210],[223,211],[250,217],[261,218],[262,224],[208,224],[190,214],[132,214]], null);
f('upper-central-wear', 'floor', c.upper, [[135,198],[155,200],[175,204],[188,208],[211,215],[239,219],[242,221],[213,220],[191,211],[178,210],[157,206],[135,205]], null);
f('upper-west-bay', 'floor', c.upperOld, [[143,150],[197,144],[201,156],[184,175],[155,183],[134,183]], null);
f('upper-east-bay', 'floor', c.upperOld, [[333,156],[369,157],[400,175],[396,184],[373,181],[351,187],[329,183]], null);
f('upper-long-pour-joint', 'floor', c.floorShade, [[219,148],[221,148],[220,164],[229,179],[229,192],[228,192],[227,179],[218,165]], null);
f('upper-long-joint-worn-lip', 'floor', c.upperWear, [[215,165],[217,165],[226,180],[227,187],[224,183]], null);
f('upper-east-joint', 'floor', c.floorShade, [[308,204],[321,197],[328,181],[330,181],[323,198],[309,206]], null);
f('floor-west-expansion-joint', 'floor', c.floorShade, [[177,319],[191,315],[204,316],[206,318],[191,317],[178,321]], null);
f('floor-east-expansion-joint', 'floor', c.floorShade, [[437,291],[456,304],[472,307],[472,309],[455,306],[436,293]], null);
f('floor-use-worn-seam', 'floor', c.floorWear, [[440,294],[456,304],[466,306],[465,307],[455,305],[440,296]], null);

// FOREGROUND top cut is 5px deep, entirely outside the foot polygon.
f('foreground-slab-top', 'foreground', c.concrete, [[94,306],[126,334],[368,334],[392,324],[548,318],[548,322],[393,328],[369,339],[126,339],[95,312]], top(3,.94));
f('foreground-west-cut-end', 'foreground', c.slate, [[95,312],[126,339],[126,344],[96,317]], front(343,-1,.94));
f('foreground-long-worn-top', 'foreground', c.cap, [[129,335],[207,335],[207,337],[129,337]], top(3,.96));
f('foreground-east-worn-top', 'foreground', c.slateWorn, [[420,324],[471,322],[471,324],[420,326]], top(3,.95));

// Material finish is authored at existing joints, with intact fields between them.
f('west-coat-old-flow', 'architecture', c.plasterShade, [[140,98],[144,98],[144,116],[149,126],[146,130],[143,120]], null);
f('west-pour-fresh-lime', 'architecture', c.plasterWorn, [[177,90],[179,89],[178,117],[180,124],[178,125],[176,119]], null);
f('west-plaster-mineral-stratum', 'architecture', c.plasterShade, [[180,131],[190,128],[199,128],[207,123],[209,125],[199,132],[187,134],[180,136]], null);
f('rear-pour-low-wash', 'architecture', c.slateShade, [[258,135],[264,140],[289,145],[296,145],[297,150],[276,149],[267,145],[260,145]], null);
f('rear-sheet-open-loss', 'architecture', c.slateWorn, [[342,120],[347,120],[359,127],[359,130],[348,124],[342,125]], null);
f('east-plaster-old-flow', 'architecture', c.plasterShade, [[437,180],[440,181],[440,198],[444,209],[442,213],[438,202]], null);
f('east-shear-exposed-mineral', 'architecture', c.slateWorn, [[515,183],[519,185],[516,201],[514,204],[513,198]], null);
f('west-bearing-salvage-strap', 'architecture', c.steelSide, [[89,214],[97,216],[97,219],[89,217]], null);
f('west-bearing-strap-edge', 'architecture', c.binderShade, [[89,213],[97,215],[97,217],[89,215]], null);

export const ENVIRONMENT_FACES: readonly Face[] = faces;
export const ENVIRONMENT_SIZE = { width: 640, height: 400 } as const;
export const ENVIRONMENT_REVISION = 'r8-authored-03-material';
