import { MATERIAL as c, front, side, top, type Face, type Layer, type Plane, type Point } from './schema';

/**
 * The exterior is the continuation of the room's load-bearing structure, rewritten
 * into offset laminations. It is not a cave, a skyline or a collection of islands.
 * Author coordinates deliberately fix the three depth readings: a remote throat
 * in the visible wedge toward (450,170), transverse middle supports, and the large
 * near-right exposed core.
 * Small units are attached to named structural faces, never scattered as texture.
 */
const faces: Face[] = [];
const f = (id: string, layer: Layer, color: string, points: readonly Point[], plane: Plane | null = null) => {
  faces.push({ id: `outside-${id}`, layer, color, points, plane });
};
const far = (id: string, color: string, points: readonly Point[]) => f(id, 'far', color, points);
const mid = (id: string, color: string, points: readonly Point[]) => f(id, 'middle', color, points);
const near = (id: string, color: string, points: readonly Point[], plane: Plane | null = null) => f(id, 'near', color, points, plane);

/** A continuous narrow face, with shared rounded joints, rather than dotted lines. */
function strip(id: string, layer: Layer, color: string, path: readonly Point[], dx: number, dy: number,
  plane: Plane | null = null): void {
  f(id, layer, color, [...path, ...[...path].reverse().map(([x, y]) => [x + dx, y + dy] as const)], plane);
}

// FAR — the throat is enclosed on every side. Low-contrast mineral colours, not
// atmospheric sky. The largest folds exceed the frame so they cannot read as rocks.
far('deep-field', c.far, [[0,0],[640,0],[640,400],[0,400]]);
far('remote-rear-volume', c.far, [[342,0],[640,0],[640,277],[606,266],[589,223],[567,202],[544,167],[490,144],[406,117],[355,78]]);
far('remote-inner-return', c.farTop, [[413,0],[640,0],[640,146],[614,142],[590,154],[567,173],[550,173],[529,155],[490,141],[479,111],[443,70]]);
far('remote-throat-shadow', c.farReturn, [[515,86],[560,98],[600,92],[640,72],[640,201],[589,200],[559,185],[549,158],[516,142]]);
far('remote-bottom-return', c.far, [[485,217],[538,182],[562,178],[588,191],[640,184],[640,340],[571,320],[553,287],[512,270]]);
far('remote-buried-shoulder', c.farTop, [[0,0],[221,0],[270,30],[315,42],[362,74],[412,91],[434,125],[398,120],[328,99],[283,91],[241,62],[144,57],[0,78]]);
far('remote-roof-thickness', c.far, [[0,78],[144,57],[241,62],[283,91],[328,99],[398,120],[434,125],[422,134],[397,130],[329,110],[273,104],[236,75],[145,68],[0,91]]);

// Nine remote compression courses. Their widths and offsets shrink toward the
// throat; transverse seams, short return faces and supporting teeth give scale.
const remoteCourses: readonly (readonly [number,number,number,number])[] = [
  [423,12,152,18],[437,31,151,16],[455,48,140,13],[470,64,132,12],
  [484,78,122,10],[493,91,116,9],[502,104,109,7],[510,115,101,6],[519,124,89,5],
];
remoteCourses.forEach(([x,y,w,h], i) => {
  const rise = Math.max(4, Math.round(w * .17));
  far(`remote-course-${i}-body`, i % 3 === 1 ? c.far : c.farTop,
    [[x,y],[x+w,y-rise],[x+w+9,y-rise+4],[x+w-4,y-rise+h],[x+8,y+h],[x,y+h-2]]);
  strip(`remote-course-${i}-lip`, 'far', c.distantSide, [[x,y],[x+w,y-rise]], 0, 2);
  for (let j=0; j<3; j++) {
    const sx=x+Math.round(w*(.19+j*.24)), sy=y-Math.round(rise*(.19+j*.24));
    far(`remote-course-${i}-joint-${j}`, c.farReturn, [[sx,sy+2],[sx+2,sy+1],[sx+6,sy+h-2],[sx+4,sy+h-1]]);
  }
});

// Far ribs are much smaller than the nearer supports, with occluded roots.
for (let i=0; i<8; i++) {
  const x=479+i*14, y=193-Math.round(i*3.3), length=43-i*3;
  far(`remote-lower-rib-${i}`, c.farTop, [[x,y],[x+3,y-1],[x+15,y+length],[x+11,y+length+2]]);
  far(`remote-lower-rib-shadow-${i}`, c.farReturn, [[x+3,y-1],[x+5,y],[x+17,y+length],[x+15,y+length]]);
}
strip('remote-return-sill', 'far', c.distantSide, [[470,212],[521,196],[553,178],[588,188],[640,174]], 0, 3);
far('remote-lower-plate', c.farTop, [[425,285],[478,246],[524,245],[550,272],[610,286],[640,278],[640,297],[607,303],[544,287],[520,260],[481,259],[437,296]]);
strip('remote-lower-plate-foot', 'far', c.far, [[437,296],[481,259],[520,260],[544,287],[607,303],[640,297]], 0, 8);

// Smaller members survive in the intervals between the big folds. These little
// supported bays establish a distant scale without turning into a city skyline.
far('throat-recess-back', c.farTop, [[517,143],[560,137],[593,154],[640,142],[640,171],[596,184],[560,165],[528,172]]);
strip('throat-recess-upper-joint', 'far', c.distantSide, [[517,143],[560,137],[593,154],[640,142]], 0, 2);
far('throat-recess-bottom', c.far, [[528,164],[560,157],[596,176],[640,162],[640,171],[596,184],[560,165],[528,172]]);
for (let i=0;i<7;i++) {
  const x=529+i*15, y=i<3 ? 149-i*2 : 151+(i===3?4:8)-((i-3)*4);
  far(`throat-small-cell-${i}`, c.farReturn, [[x,y],[x+8,y-2],[x+9,y+9],[x+2,y+11]]);
  far(`throat-small-cell-sill-${i}`, c.distantSide, [[x+2,y+11],[x+9,y+9],[x+9,y+11],[x+3,y+13]]);
}

// The diminishing group occupies the REAL open wedge left of the middle pier.
// Its broad filled walls contain inset load pockets. The banks bind these walls
// into one solid mass, rather than repeating open outline rings behind an occluder.
far('depth-bank-parent-mass', '#202632', [[357,133],[381,139],[403,149],[425,156],[451,164],[458,177],[437,186],[410,201],[387,218],[365,224],[352,205]]);
far('depth-bank-upper', '#2c303b', [[356,132],[381,137],[404,147],[426,154],[451,162],[456,167],[432,164],[407,157],[384,149],[361,143]]);
far('depth-bank-lower', '#252c38', [[358,207],[380,202],[400,192],[420,181],[437,176],[451,170],[455,175],[438,182],[421,188],[403,199],[383,211],[362,216]]);
far('depth-bank-lower-soffit', '#1a202b', [[358,216],[383,211],[403,199],[421,188],[438,182],[455,175],[458,179],[440,187],[424,194],[406,206],[385,218],[365,224]]);
const depthBays: readonly (readonly [number,number,number,number,number])[] = [
  [363,136,34,70,9],[386,144,25,50,7],[407,153,18,32,5],
  [422,159,14,22,4],[434,164,10,13,3],
];
depthBays.forEach(([x,y,w,h,t],i) => {
  const lip=Math.max(2,Math.round(t*.55)), end=y+h, insetY=y+Math.max(6,Math.round(h*.16));
  const body=i<2?'#292d38':'#242b36', cap=i<2?'#333440':'#2c323d';
  far(`depth-bay-${i}-return`, '#1d2330',
    [[x,y],[x+w,y+5],[x+w+t,y+9],[x+w+t-2,end-4],[x+w-3,end+5],[x-2,end],[x,y]]);
  far(`depth-bay-${i}-filled-wall`, body,
    [[x,y+2],[x+w,y+7],[x+w-1,end-2],[x+t,end],[x-1,end-5],[x+2,y+Math.round(h*.48)]]);
  far(`depth-bay-${i}-cap`, cap,
    [[x,y],[x+w,y+5],[x+w+2,y+8],[x+t,y+5],[x+1,y+2]]);
  // Real material remains on both sides and under the recess. Different shoulder
  // slopes and progressively smaller apertures retain a visible solid section.
  far(`depth-bay-${i}-load-pocket`, '#141b26',
    [[x+t,insetY],[x+w-lip,insetY+3],[x+w-lip-1,end-lip*2],[x+t+lip,end-lip],[x+t-1,end-lip*2],[x+t+1,insetY+lip]]);
  far(`depth-bay-${i}-pocket-cheek`, '#222a37',
    [[x+t,insetY],[x+t+lip,insetY+1],[x+t+lip,end-lip],[x+t-1,end-lip*2],[x+t+1,insetY+lip]]);
  if(i<3) {
    far(`depth-bay-${i}-sill`, '#303440',
      [[x+t-1,end-lip*2],[x+t+lip,end-lip],[x+w-lip-1,end-lip*2],[x+w-lip-1,end-lip+1],[x+t+lip,end],[x+t-1,end-lip]]);
    const joint=y+Math.round(h*.6);
    far(`depth-bay-${i}-pressure-joint`, '#1d2430', [[x,joint],[x+t-2,joint+2],[x+t-2,joint+4],[x,joint+2]]);
  }
});
far('far-well-side', c.farTop, [[435,225],[459,223],[492,243],[526,266],[543,316],[569,343],[640,361],[640,386],[563,366],[526,329],[511,279],[480,259],[453,239],[435,240]]);
far('far-well-undercut', c.far, [[455,234],[481,251],[519,273],[534,322],[570,353],[640,373],[640,386],[563,366],[526,329],[511,279],[480,259],[453,239]]);
for (let i=0;i<6;i++) {
  const x=524+i*17, y=319+i*7;
  far(`far-well-pocket-${i}`, c.farReturn, [[x,y],[x+10,y+4],[x+10,y+12],[x+2,y+8]]);
}

// Long compacted cross-section on the rear right wall. Rows have interrupted
// tooth counts so this is a massive laminated object, not evenly tiled windows.
far('remote-right-section-body', c.distantSide, [[600,0],[640,0],[640,129],[622,118],[602,91],[586,80],[583,56]]);
far('remote-right-section-cut', c.farTop, [[611,0],[640,0],[640,115],[626,107],[611,83],[597,72],[594,57]]);
for (let i=0;i<7;i++) {
  const y=12+i*13, x=609-Math.min(i,3)*3;
  far(`remote-right-section-course-${i}`, c.far, [[x,y],[640,y+10],[640,y+15],[x-2,y+4]]);
  if(i!==2&&i!==5) far(`remote-right-section-hole-${i}`, c.farReturn, [[x+7,y+1],[x+18,y+4],[x+16,y+10],[x+5,y+7]]);
}

// MIDDLE — an oblique folded span passes in front of the rear throat. Its visible
// top, exposed aggregate courses and deep sockets have different shape frequencies.
mid('upper-span-underbody', c.distantSide, [[311,0],[385,0],[371,45],[398,71],[475,91],[528,113],[640,74],[640,116],[524,158],[474,136],[404,121],[364,93],[330,53]]);
mid('upper-span-top', c.distantSide, [[327,0],[385,0],[371,45],[398,71],[475,91],[528,113],[640,74],[640,85],[528,129],[474,109],[395,88],[360,55]]);
mid('upper-span-torn-bed', c.distant, [[360,55],[395,88],[474,109],[528,129],[640,85],[640,97],[562,127],[558,138],[530,145],[511,139],[482,127],[470,125],[402,106],[387,96],[376,93]]);
strip('upper-span-top-turn', 'middle', c.outerShade, [[332,0],[369,53],[402,82],[475,101],[528,121],[640,80]], 0, 1);
strip('upper-span-bottom-thickness', 'middle', c.farReturn, [[364,93],[404,121],[474,136],[524,158],[640,116]], 0, 6);

// Long openings are structural compression slots with bounded ends, not random
// debris. A few are interrupted where the same material is shifted by rewriting.
const upperSlots: readonly (readonly Point[])[] = [
  [[390,91],[410,96],[413,105],[396,101]],
  [[420,100],[445,107],[451,117],[426,112]],
  [[459,111],[482,116],[488,126],[468,121]],
  [[497,122],[518,130],[517,138],[502,132]],
  [[542,126],[564,118],[564,127],[542,134]],
  [[573,115],[600,105],[600,114],[574,124]],
  [[610,101],[638,91],[638,99],[611,110]],
];
upperSlots.forEach((p,i) => mid(`upper-span-slot-${i}`, c.farReturn, p));
for (const [i,x,y] of [[0,415,95],[1,452,107],[2,488,117],[3,531,131],[4,568,118],[5,604,105]] as const) {
  mid(`upper-span-collar-${i}`, c.outerShade, [[x,y],[x+5,y+1],[x+11,y+24],[x+6,y+25]]);
  strip(`upper-span-collar-cap-${i}`, 'middle', c.distant, [[x,y],[x+5,y+1],[x+8,y+10]], -1, 1);
}

// A tall pier crosses the span, partly hidden by it. Its lateral stepped return
// reads as a massive buried member, rather than another parallel horizon band.
mid('upright-return', c.distantSide, [[477,-12],[502,-12],[467,54],[460,78],[483,105],[481,155],[459,192],[449,220],[421,248],[408,226],[426,196],[441,161],[450,120],[431,86],[440,48]]);
mid('upright-face', c.distantSide, [[477,-12],[491,-12],[455,51],[447,85],[467,115],[465,150],[447,186],[435,218],[418,233],[417,220],[435,184],[452,148],[453,119],[435,85],[443,49]]);
strip('upright-bearing-light', 'middle', c.distant, [[478,0],[448,52],[440,85],[458,119],[458,149],[440,184],[429,216],[415,231]], 2, 0);
strip('upright-deep-slot', 'middle', c.farReturn, [[484,0],[454,52],[448,84],[465,115]], 2, 1);
for (let i=0;i<5;i++) {
  const x=447-i*5, y=160+i*13;
  mid(`upright-lower-collar-${i}`, c.outerShade, [[x-6,y],[x+9,y+3],[x+6,y+8],[x-9,y+5]]);
  strip(`upright-lower-collar-edge-${i}`, 'middle', c.distant, [[x-6,y],[x+9,y+3]], 0, 1);
}

// At the principal junction the mass spreads into a buttress, with a deep throat
// between two different thicknesses. It carries the upper member's load visibly.
mid('upright-splayed-root', c.outerShade, [[444,172],[456,177],[475,168],[496,174],[492,187],[469,187],[455,201],[442,221],[426,231],[421,224],[433,204]]);
mid('upright-splayed-root-cap', c.distant, [[444,172],[456,177],[475,168],[496,174],[492,178],[475,174],[456,185],[444,181],[435,207],[429,216],[428,209]]);
mid('upright-splayed-root-gap', c.farReturn, [[459,187],[472,179],[484,180],[484,184],[471,184],[457,197],[444,216],[439,218]]);
mid('upright-root-old-course', c.distant, [[444,190],[449,193],[441,211],[433,219],[430,217],[437,207]]);
mid('upright-root-pressure-bed', c.distantTop, [[448,171],[454,174],[454,176],[447,175]]);

// The pier's displaced outside section is broad and stepped; its layers partly
// cover one another. The primary outline changes at load transitions, not by
// cutting small decorative bites out of a straight line.
mid('upright-flanged-side', c.outerShade, [[459,102],[474,104],[487,117],[490,147],[474,167],[466,190],[451,207],[442,201],[452,183],[459,159],[472,146],[472,127],[463,118]]);
mid('upright-flanged-section', c.distant, [[474,108],[482,116],[485,145],[469,164],[460,190],[449,201],[449,196],[456,181],[463,158],[476,144],[477,127],[468,116]]);
mid('upright-section-split', c.farReturn, [[474,123],[480,128],[480,139],[470,154],[465,159],[463,172],[459,176],[462,156],[474,140]]);
mid('upright-root-offset-core', c.distantSide, [[465,182],[473,180],[470,194],[461,205],[447,217],[440,215],[453,201],[460,194]]);
mid('upright-root-offset-cap', c.distant, [[465,182],[473,180],[471,184],[464,187],[460,197],[449,208],[453,201],[460,194]]);

// Mid-distance crossing brace: narrower at its far root; its branches meet actual
// solid faces. Light tips are clipped to material, never floating motes.
mid('crossing-brace-shadow', c.farReturn, [[405,239],[467,201],[537,193],[604,162],[640,151],[640,159],[606,171],[540,203],[471,211],[411,249]]);
mid('crossing-brace-front', c.distantSide, [[401,230],[466,192],[536,184],[602,155],[640,144],[640,151],[604,162],[537,193],[467,201],[405,239]]);
strip('crossing-brace-top', 'middle', c.distant, [[401,230],[466,192],[536,184],[602,155],[640,144]], 0, 1);
const braceCollars: readonly Point[] = [[429,214],[453,200],[480,190],[510,186],[552,177],[577,166],[614,152]];
braceCollars.forEach(([x,y],i) => {
  mid(`crossing-brace-collar-${i}`, c.outerShade, [[x,y],[x+4,y-1],[x+8,y+8],[x+4,y+9]]);
  mid(`crossing-brace-key-${i}`, c.distant, [[x+1,y],[x+4,y-1],[x+5,y+2],[x+2,y+3]]);
});

// Two crossing stays sit behind the large near block and actually meet the span;
// small parallel cross-sections read as bundled structural material, not ropes.
const stays: readonly (readonly Point[])[] = [
  [[457,196],[472,171],[496,159],[511,149]],
  [[530,188],[545,163],[565,151],[570,136]],
];
stays.forEach((p,i) => {
  strip(`oblique-stay-${i}-body`, 'middle', c.distantSide, p, 4, 3);
  strip(`oblique-stay-${i}-bed`, 'middle', c.distant, p, 1, 1);
  const [x,y]=p[1]!;
  mid(`oblique-stay-${i}-key`, c.outerShade, [[x-2,y],[x+5,y+3],[x+6,y+7],[x-2,y+4]]);
});

// The lower middle volume turns upward across the depth direction. Its staggered
// recesses reveal three thicknesses, not a uniform faceted ribbon.
mid('lower-middle-underbody', c.distantSide, [[351,348],[411,293],[456,277],[470,239],[519,216],[536,224],[552,254],[598,268],[640,264],[640,319],[588,324],[546,300],[522,280],[490,278],[468,298],[434,323],[399,369],[359,390]]);
mid('lower-middle-top', c.distant, [[351,348],[411,293],[456,277],[470,239],[519,216],[536,224],[523,239],[485,252],[471,286],[429,308],[394,352],[359,372]]);
mid('lower-middle-return-face', c.distant, [[523,239],[536,224],[552,254],[598,268],[640,264],[640,278],[596,281],[546,270]]);
strip('lower-middle-bearing-edge', 'middle', c.outerShade, [[363,354],[416,300],[463,282],[478,246],[521,224]], 2, 2);
mid('lower-middle-cleft', c.farReturn, [[435,307],[479,286],[495,270],[522,266],[550,287],[551,298],[521,279],[493,279],[471,300],[444,321]]);
const lowerKeys: readonly (readonly [number,number,number])[] = [
  [411,315,16],[427,302,13],[445,292,12],[465,270,13],[473,253,11],[488,243,10],[505,236,9],
];
lowerKeys.forEach(([x,y,w],i) => {
  mid(`lower-middle-compression-key-${i}`, c.outerShade, [[x,y],[x+w,y-4],[x+w+5,y+9],[x+5,y+15]]);
  strip(`lower-middle-compression-key-cap-${i}`, 'middle', c.distant, [[x,y],[x+w,y-4]], 1, 1);
});
for (const [i,x,y] of [[0,548,261],[1,569,268],[2,594,273],[3,620,270]] as const) {
  mid(`lower-middle-face-socket-${i}`, c.farReturn, [[x,y],[x+11,y+3],[x+12,y+14],[x+2,y+12]]);
  strip(`lower-middle-face-socket-bottom-${i}`, 'middle', c.distant, [[x+2,y+12],[x+12,y+14]], 0, 2);
}

// NEAR — physical attachment 1: the chamber's rear corbel continues at (227,151).
// The upright is laminated and displaced higher up, while its root is restrained.
near('rear-bearing-shadow', c.deep, [[206,152],[215,122],[232,88],[218,54],[230,15],[232,0],[275,0],[270,21],[262,51],[275,88],[257,126],[247,153]], front(164,8,.61));
near('rear-bearing-body', c.outerShade, [[215,150],[225,119],[243,88],[229,53],[241,15],[242,0],[262,0],[259,21],[251,52],[264,88],[247,123],[236,151]], front(159,8,.72));
near('rear-bearing-left-cheek', c.outer, [[215,150],[225,119],[243,88],[229,53],[241,15],[242,0],[248,0],[247,19],[236,54],[250,88],[232,123],[223,151]], side(159,-1,9,.78));
strip('rear-bearing-top-split', 'near', c.slateShade, [[249,1],[246,25],[238,53],[252,89],[235,124],[228,151]], 2, 0);
const bearingCollars: readonly (readonly [number,number])[] = [[234,32],[230,53],[240,77],[240,102],[228,127]];
bearingCollars.forEach(([x,y],i) => {
  near(`rear-bearing-collar-${i}`, c.outerShade, [[x-5,y],[x+20,y+4],[x+19,y+10],[x-6,y+5]], front(y+13,4,.8));
  strip(`rear-bearing-collar-cap-${i}`, 'near', c.outerTop, [[x-5,y],[x+20,y+4]], 0, 1);
});
near('rear-restrained-junction', c.concreteDark, [[213,139],[238,142],[241,156],[230,162],[212,157]], front(163,0,.76));
near('rear-restrained-cap', c.slate, [[214,139],[221,135],[243,142],[238,146]], top(20,.83));
near('rear-contact-rewrite', c.intrusionDim, [[228,147],[231,148],[228,153],[231,158],[228,158],[225,153]]);

// Near overhead buttress: a large mass partly out of view, with a long dark soffit.
// It frames the chamber without drawing an artificial full-circle enclosure.
near('overhead-crown-body', c.deep, [[0,0],[175,0],[196,29],[207,43],[205,65],[168,73],[118,66],[64,87],[0,88]], front(106,0,.7));
near('overhead-crown-top', c.outerShade, [[0,0],[159,0],[178,24],[200,38],[205,49],[178,55],[120,49],[65,72],[0,75]], top(78,.75));
near('overhead-crown-cut-face', c.outer, [[0,54],[61,53],[116,34],[168,40],[196,48],[176,57],[121,52],[65,74],[0,79]], front(87,1,.8));
strip('overhead-crown-upper-bed', 'near', c.slateShade, [[0,53],[61,52],[116,33],[168,39],[196,47]], 0, 2);
strip('overhead-crown-lower-bed', 'near', c.outerShade, [[0,70],[64,66],[119,45],[176,49]], 0, 2);
near('overhead-crown-open-socket', c.deep, [[76,49],[95,42],[99,48],[81,55]]);
near('overhead-crown-offset-course', c.outerShade, [[127,48],[143,49],[153,58],[144,61],[128,57]]);
near('overhead-crown-split', c.deep, [[43,54],[46,54],[47,62],[42,68],[43,75],[40,76],[39,66],[44,61]]);

// Physical attachment 2: the room's right foundation at (394,273) becomes a
// substantial descending girder. It crosses in front of the middle structure.
near('east-continuation-soffit', c.deep, [[384,271],[400,262],[438,276],[472,299],[499,308],[519,337],[513,351],[482,354],[457,348],[430,348],[410,339],[397,326],[384,324]], front(346,-18,.59));
// A broad corbel descends to the room's foundation return at (397,319)..(410,325).
// Its load-bearing belly is one continuous volume, not a thin suspended branch.
near('east-continuation-face', c.outerShade, [[394,273],[433,285],[470,308],[493,316],[512,340],[503,345],[477,337],[457,335],[442,337],[426,330],[409,317],[394,311]], front(334,-11,.79));
near('east-continuation-lower-belly', c.slateShade, [[394,309],[409,316],[426,330],[442,337],[457,335],[477,337],[488,349],[470,353],[452,346],[435,347],[412,339],[399,328],[391,326]], front(344,-18,.78));
near('east-continuation-belly-return', c.outerShade, [[397,319],[410,325],[432,337],[453,338],[468,345],[479,347],[470,353],[452,346],[435,347],[412,339],[399,328]], side(348,-1,-19,.8));
near('east-continuation-top', c.outer, [[384,271],[400,262],[438,276],[472,299],[499,308],[519,337],[512,340],[493,316],[470,308],[433,285],[394,273]], top(-8,.87));
strip('east-continuation-bearing-lip', 'near', c.slateWorn, [[394,271],[434,283],[471,306],[493,314],[514,338]], 0, 1);
near('east-continuation-section-bed', c.slate, [[410,290],[426,297],[442,308],[459,315],[477,316],[487,324],[480,327],[458,321],[439,316],[424,305],[409,299]], front(336,-10,.83));
near('east-continuation-section-recess', c.deep, [[425,310],[438,317],[454,322],[460,327],[450,330],[436,325],[425,319]], front(338,-13,.64));
near('east-continuation-recess-cheek', c.outer, [[425,310],[438,317],[454,322],[452,324],[436,321],[427,316],[427,321],[425,319]], side(338,-1,-12,.78));
near('east-continuation-underbed', c.outerShade, [[432,334],[442,337],[457,335],[477,337],[480,341],[457,340],[442,341],[431,338]], front(350,-20,.8));
near('east-continuation-break', c.deep, [[442,281],[445,284],[442,290],[448,296],[447,300],[440,292],[441,287],[438,282]]);
near('east-continuation-key', c.slate, [[449,291],[457,295],[457,303],[450,299]], side(312,-1,-2,.79));
near('east-contact-rewrite-pocket', c.intrusionDim, [[396,275],[405,278],[407,283],[401,282],[399,279],[396,280]]);

// The closest cut core occupies the right lower corner. Deep channels, laminate
// ends and undercuts sit at a different scale from the far repeated small units.
near('front-core-outer-shadow', c.deep, [[640,206],[611,222],[584,241],[567,269],[543,291],[548,318],[529,345],[500,369],[483,400],[640,400]], front(424,-18,.62));
near('front-core-soffit', c.underside, [[640,246],[607,266],[600,291],[573,317],[573,340],[554,365],[548,400],[640,400]], side(417,1,-20,.61));
near('front-core-face', c.outerShade, [[640,216],[613,232],[591,250],[577,279],[556,294],[561,320],[541,351],[514,377],[505,400],[547,400],[554,365],[573,340],[573,317],[600,291],[607,266],[640,246]], front(404,-18,.76));
near('front-core-bearing-top', c.outer, [[640,205],[610,221],[582,241],[566,268],[541,287],[543,300],[558,307],[577,288],[590,260],[613,239],[640,225]], top(-18,.88));
strip('front-core-laminated-lip', 'near', c.outerTop, [[640,207],[611,224],[585,244],[570,272],[546,291],[547,297],[558,302]], 1, 2);
strip('front-core-recess-course', 'near', c.deep, [[640,236],[615,250],[600,273],[593,293],[573,308],[573,321],[551,352],[526,379],[519,400]], 3, 2);
strip('front-core-inner-bed', 'near', c.distant, [[640,244],[615,256],[608,278],[598,296],[580,312],[580,326],[559,357],[535,385],[530,400]], 1, 2);
near('front-core-wide-end', c.slateShade, [[555,301],[566,299],[575,308],[572,321],[558,337],[551,331],[559,316]], side(350,-1,-12,.77));
near('front-core-wide-end-recess', c.deep, [[560,307],[566,307],[568,314],[562,324],[559,322],[564,314]]);
near('front-core-lower-spalled-face', c.outer, [[531,363],[542,358],[548,369],[530,394],[524,400],[511,400],[519,380]], side(419,-1,-16,.8));
near('front-core-lower-exposed-bed', c.slateShade, [[531,367],[537,364],[541,370],[532,382],[525,385],[525,378]]);

// The near mass shows a broad exposed inner section beyond its rim. Large dark
// chambers and irregular mineral skins keep it from reading as a single cable.
near('front-core-inner-section', c.outerShade, [[625,262],[640,256],[640,400],[580,400],[579,380],[594,351],[608,336],[606,313]], front(416,-21,.7));
near('front-core-inner-cut-lime', c.slateShade, [[628,268],[640,263],[640,291],[622,308],[620,323],[629,339],[625,349],[613,337],[612,312]], side(390,-1,-13,.69));
near('front-core-large-recess', c.deep, [[624,312],[640,299],[640,329],[632,335],[624,326]]);
near('front-core-recess-lower-sill', c.distantSide, [[624,326],[632,335],[640,329],[640,334],[631,341],[623,332]]);
near('front-core-second-recess', c.deep, [[613,351],[627,357],[640,352],[640,374],[627,380],[606,369]]);
near('front-core-second-sill', c.distantSide, [[606,369],[627,380],[640,374],[640,378],[627,385],[604,373]]);
near('front-core-skin-lift', c.distant, [[598,352],[605,343],[612,346],[604,358],[602,373],[592,389],[587,387],[596,370]]);
strip('front-core-layered-plane', 'near', c.outer, [[587,393],[598,389],[608,396],[633,395],[640,389]], 0, 2);

// Cross-section ends interrupt the closest diagonal at chosen load-transfer points.
const coreSections: readonly (readonly [number,number,number])[] = [
  [616,238,17],[594,262,17],[577,287,14],[555,328,15],[539,355,13],[516,384,12],
];
coreSections.forEach(([x,y,w],i) => {
  near(`front-core-section-${i}`, c.deep, [[x,y],[x+w,y+6],[x+w-3,y+13],[x-3,y+6]]);
  near(`front-core-section-inner-${i}`, c.distant, [[x+2,y+2],[x+w-2,y+7],[x+w-4,y+10],[x,y+5]]);
  strip(`front-core-section-lime-${i}`, 'near', c.outer, [[x,y],[x+w,y+6]], -1, 1);
});

// Lower left compressed footing continues beyond the camera. The gaps expose
// older strata behind it instead of suggesting a floating disconnected platform.
near('buried-west-footing', c.deep, [[0,322],[36,335],[72,360],[110,374],[156,382],[177,400],[0,400]], front(423,-28,.63));
near('buried-west-footing-return', c.outerShade, [[0,345],[31,350],[65,372],[103,385],[146,390],[161,400],[122,400],[92,395],[56,386],[23,368],[0,365]], top(-30,.72));
strip('buried-west-footing-bed', 'near', c.slateShade, [[0,345],[31,350],[65,372],[103,385],[146,390]], 0, 2);
near('buried-west-footing-socket', c.farReturn, [[41,361],[55,369],[53,377],[40,368]]);

export const EXTERIOR_FACES: readonly Face[] = faces;
