import { MATERIAL as c, front, side, top, type Face, type Layer, type Plane, type Point } from './schema';

/** R10: three distances cut out of the same crushed load-bearing reality.
 * The open intervals carry as much scale as the material. Details have a host:
 * sheared beds, concrete spalls and a few embedded ties, never freestanding noise.
 * Contacts remain at (227,151), (394,273); source plates are native 640 × 400.
 */
const faces: Face[] = [];
const face = (id: string, layer: Layer, color: string, points: readonly Point[], plane: Plane | null = null) => {
  faces.push({ id: `outside-${id}`, layer, color, points, plane });
};
const far = (id: string, color: string, points: readonly Point[]) => face(id, 'far', color, points);
const mid = (id: string, color: string, points: readonly Point[]) => face(id, 'middle', color, points);
const near = (id: string, color: string, points: readonly Point[], plane: Plane | null = null) => face(id, 'near', color, points, plane);
// FAR. No opaque wallpaper: a gulf between almost-lost masses. The far wall has
// no common horizon, no rim light and no small mechanical windows to count.
far('lost-vault', c.farReturn, [[275,0],[640,0],[640,75],[604,82],[574,77],[548,101],[506,112],[463,94],[417,81],[380,59],[326,53]]);
far('lost-vault-facing', c.far, [[334,0],[566,0],[557,29],[519,40],[493,65],[469,70],[429,47],[377,43]]);
far('lost-vault-break', c.void, [[455,0],[472,0],[458,24],[462,31],[451,49],[436,44],[444,25]]);
far('buried-remote-wall', c.farReturn, [[555,56],[640,35],[640,342],[601,330],[581,291],[568,251],[578,225],[563,204],[550,159]]);
far('remote-wall-lost-plane', c.far, [[592,99],[628,92],[640,107],[640,251],[618,258],[609,220],[615,190],[601,181]]);
far('remote-wall-blind-recess', c.void, [[612,115],[632,107],[640,115],[640,191],[624,203],[619,188],[624,164]]);
far('remote-bottom-mass', c.farReturn, [[345,331],[411,297],[449,283],[491,292],[526,267],[559,281],[591,316],[640,336],[640,400],[321,400]]);
far('remote-bottom-section', c.far, [[423,323],[452,312],[493,323],[526,302],[540,307],[532,320],[501,342],[468,331],[439,343]]);
far('remote-fallen-course', c.farReturn, [[347,141],[378,146],[401,165],[423,171],[449,192],[482,206],[519,207],[551,215],[572,204],[585,226],[555,233],[519,220],[478,219],[445,206],[420,186],[395,179],[373,157],[345,154]]);
far('remote-fallen-course-facing', c.far, [[421,171],[448,191],[481,205],[487,207],[478,211],[445,198],[423,180]]);
// One interrupted load member gives scale in the dark slot, then vanishes.
far('remote-hanging-member', c.farReturn, [[499,87],[509,86],[504,127],[513,144],[505,157],[495,162],[490,157],[500,146],[495,125]]);
far('remote-hanging-break', c.far, [[498,119],[503,120],[507,142],[502,149],[500,145],[501,138]]);

// MIDDLE. A displaced ceiling slab and one monumental support enclose an oblique
// shaft. Their mass runs beyond the frame; their absence is the primary detail.
mid('buried-ceiling-bulk', c.farReturn, [[275,0],[640,0],[640,71],[596,86],[573,110],[533,116],[512,106],[461,111],[441,101],[405,99],[378,80],[335,61],[299,59]]);
mid('ceiling-downturned-plane', c.distantSide, [[316,0],[640,0],[640,28],[593,45],[568,72],[536,79],[508,73],[478,78],[451,66],[421,70],[397,57],[361,43],[333,42]]);
mid('ceiling-shattered-edge', c.far, [[333,42],[361,43],[397,57],[421,70],[451,66],[478,78],[508,73],[536,79],[568,72],[593,45],[640,28],[640,48],[602,62],[581,86],[548,96],[520,94],[482,98],[447,86],[414,88],[382,72],[350,59]]);
mid('ceiling-sole-exposure', c.farTop, [[363,38],[383,42],[406,55],[419,61],[441,58],[456,62],[455,66],[421,69],[398,57],[378,49],[363,45]]);
mid('ceiling-large-shear', c.void, [[469,0],[502,0],[497,18],[483,25],[488,43],[480,58],[491,78],[483,98],[461,111],[442,99],[449,86],[455,78],[448,62],[456,42],[462,24]]);
mid('ceiling-shear-thickness', c.far, [[502,0],[519,0],[513,25],[501,36],[503,46],[495,58],[508,80],[500,105],[474,118],[461,111],[483,98],[491,78],[480,58],[488,43],[483,25],[497,18]]);
mid('ceiling-pressure-tooth', c.distantSide, [[428,61],[445,65],[451,82],[448,94],[437,90],[438,82]],);
mid('ceiling-pressure-tooth-cut', c.farTop, [[428,61],[433,62],[443,71],[448,87],[446,90],[438,78]]);
mid('ceiling-sheared-backing', c.farReturn, [[474,72],[481,66],[482,74],[476,80],[472,94],[459,98],[462,91],[470,84]]);
mid('ceiling-lost-lamina', c.far, [[552,3],[640,3],[640,17],[596,32],[570,58],[551,66],[548,62],[566,48],[580,26]]);
mid('ceiling-embedded-course', c.farReturn, [[355,13],[412,33],[445,32],[449,36],[409,38],[353,18]]);
mid('ceiling-torn-socket', c.farReturn, [[383,47],[395,49],[403,57],[414,60],[415,64],[400,61],[391,56],[382,54]]);

// One broad shoulder descending behind the nearest right-hand cut. Offset faces
// are deliberately not equidistant, and only two blind recesses survive.
mid('distant-buttress-bulk', c.far, [[598,39],[640,27],[640,400],[563,400],[553,374],[546,334],[528,313],[544,291],[554,259],[545,232],[552,210],[547,182],[559,153],[566,117],[584,97]]);
mid('distant-buttress-facing', c.distantSide, [[607,60],[640,49],[640,310],[606,330],[584,320],[576,286],[588,257],[577,228],[584,202],[577,179],[591,149],[590,125],[607,101]]);
mid('distant-buttress-side', c.farReturn, [[598,39],[607,60],[607,101],[590,125],[591,149],[577,179],[584,202],[577,228],[588,257],[576,286],[584,320],[563,340],[547,333],[528,313],[544,291],[554,259],[545,232],[552,210],[547,182],[559,153],[566,117],[584,97]]);
mid('buttress-bearing-scar', c.farTop, [[611,112],[621,107],[619,125],[609,139],[609,153],[600,169],[599,166],[603,147],[602,135]]);
mid('buttress-upper-blind-void', c.farReturn, [[609,184],[640,164],[640,225],[627,237],[611,227],[612,209],[605,203]]);
mid('buttress-upper-void-cheek', c.far, [[609,184],[615,180],[614,199],[620,205],[619,225],[628,230],[627,237],[611,227],[612,209],[605,203]]);
mid('buttress-lower-blind-void', c.farReturn, [[599,266],[614,260],[626,270],[640,269],[640,291],[624,303],[599,293],[594,284]]);
mid('buttress-lower-lost-sill', c.far, [[599,293],[624,303],[640,291],[640,296],[624,309],[600,300]]);
mid('buttress-wide-cross-grain', c.far, [[608,243],[620,247],[640,238],[640,244],[621,254],[604,250]]);

// Low buried terraces recede underneath the refuge. Only the broken crest is
// readable; there is no bright lower outline forming a second stage/platform.
mid('sunken-terrace-bulk', c.farReturn, [[333,373],[389,338],[435,330],[472,315],[509,326],[536,319],[583,340],[640,350],[640,400],[330,400]]);
mid('sunken-terrace-upper', c.far, [[365,369],[397,345],[438,340],[473,324],[509,335],[536,327],[579,349],[616,354],[604,362],[568,355],[534,340],[510,349],[473,337],[441,352],[402,355],[375,376]]);
mid('sunken-terrace-fracture', c.distantSide, [[397,345],[438,340],[459,331],[467,332],[444,345],[403,352],[384,366],[380,366]]);
mid('sunken-terrace-fallen-face', c.far, [[439,362],[475,347],[489,353],[481,374],[444,390],[414,400],[396,400],[423,380]]);
mid('sunken-terrace-lost-bed', c.farReturn, [[458,373],[481,363],[480,369],[455,381],[435,390],[431,389]]);

// NEAR, rear: a broad sheared root rises into an enormous displaced beam. The
// fixed aperture path (227,151)..(251,88) stays within this solid 24–42 px mass.
near('rear-bearing-bulk', c.deep, [[207,157],[216,125],[231,101],[235,76],[231,66],[245,36],[251,0],[336,0],[325,30],[310,51],[308,80],[278,106],[263,139],[249,162]], front(165,8,.69));
near('rear-bearing-facing', c.outerShade, [[216,153],[226,122],[240,101],[245,76],[240,66],[254,35],[261,0],[312,0],[302,29],[286,54],[286,75],[264,99],[254,126],[237,156]], front(163,8,.83));
near('rear-bearing-cut-cheek', c.outer, [[216,153],[226,122],[240,101],[245,76],[240,66],[254,35],[261,0],[279,0],[273,36],[262,63],[266,74],[255,105],[243,124],[230,155]], side(164,-1,8,.86));
near('rear-bearing-upper-exposed-core', c.slateShade, [[278,0],[292,0],[289,14],[281,25],[280,38],[270,47],[272,34]], side(83,-1,27,.81));
near('rear-bearing-upper-rupture', c.deep, [[292,0],[303,0],[299,17],[291,31],[293,47],[285,55],[278,49],[282,37],[281,25],[289,14]]);
near('rear-bearing-upper-rupture-return', c.distant, [[303,0],[307,0],[303,17],[295,33],[297,48],[287,60],[280,55],[278,49],[285,55],[293,47],[291,31],[299,17]]);
near('rear-bearing-open-cleft', c.deep, [[276,73],[285,74],[279,84],[269,91],[266,105],[257,115],[253,112],[259,102],[260,88]]);
near('rear-bearing-cleft-return', c.distant, [[285,74],[286,78],[282,87],[273,93],[270,108],[260,119],[257,115],[266,105],[269,91],[279,84]]);
near('rear-bearing-spall', c.slateShade, [[251,87],[254,79],[261,80],[258,102],[249,114],[241,117],[243,112],[248,105]], side(141,-1,12,.83));
near('rear-bearing-spall-cut', c.deep, [[256,89],[259,85],[257,101],[252,106],[251,102]]);
near('rear-bearing-torn-bed', c.outer, [[253,44],[260,43],[256,53],[259,63],[256,68],[248,63]], side(90,-1,28,.81));
near('rear-bearing-deep-shear', c.deep, [[251,31],[257,32],[264,38],[269,39],[268,45],[257,41],[250,38]]);
near('rear-bearing-embedded-tie', c.slateShade, [[237,116],[251,121],[252,124],[237,120]], top(22,.86));
near('rear-restrained-junction', c.concreteDark, [[213,139],[230,137],[241,145],[241,156],[230,162],[212,157]], front(163,0,.78));
near('rear-restrained-cap', c.slate, [[214,139],[221,135],[243,142],[238,146]], top(20,.85));
near('rear-contact-rewrite', c.intrusionDim, [[228,147],[231,148],[228,153],[231,158],[228,158],[225,153]]);

// The overhead body has a huge torn underside, not a second ornamental border.
near('overhead-bulk', c.deep, [[0,0],[183,0],[188,17],[207,28],[207,42],[196,53],[175,56],[159,49],[126,57],[98,51],[53,67],[0,67]], front(104,0,.68));
near('overhead-mineral-body', c.outerShade, [[0,0],[160,0],[177,16],[196,28],[191,40],[173,42],[160,37],[128,44],[98,38],[53,55],[0,55]], top(73,.71));
near('overhead-exposed-section', c.outer, [[0,33],[50,33],[91,20],[117,27],[140,26],[159,31],[177,26],[192,31],[190,36],[174,40],[158,37],[140,33],[115,35],[91,29],[52,42],[0,43]], front(67,14,.82));
near('overhead-internal-shear', c.deep, [[30,0],[45,0],[43,8],[51,19],[48,32],[40,32],[42,21],[35,13]]);
near('overhead-lost-bed', c.distant, [[0,47],[52,47],[92,33],[117,40],[130,40],[127,44],[98,38],[53,55],[0,55]]);
near('overhead-torn-lamina', c.outerShade, [[112,41],[137,44],[144,50],[156,51],[154,56],[137,54],[129,49],[114,49]]);

// EAST ROOT. The chamber foundation becomes a 28–40 px deep torn corbel.
// A short transverse cut core interrupts the longitudinal beds: the load passes
// through a solid section, not several parallel ribbons turning together.
near('east-continuation-bulk', c.deep, [[383,268],[400,258],[420,267],[432,279],[454,284],[466,303],[485,310],[490,329],[519,342],[517,368],[487,367],[469,349],[446,346],[428,342],[407,328],[385,323]], front(350,-18,.7));
near('east-continuation-bearing', c.outerShade, [[394,273],[405,268],[421,277],[432,290],[450,294],[460,310],[479,317],[479,335],[495,344],[495,350],[475,349],[463,337],[445,334],[428,332],[410,318],[394,311]], front(345,-12,.81));
near('east-continuation-upper-bed', c.outer, [[383,268],[400,258],[420,267],[432,279],[454,284],[466,303],[485,310],[490,329],[519,342],[511,347],[481,333],[479,317],[460,310],[450,294],[432,290],[421,277],[405,268],[394,273]], top(-7,.87));
near('east-continuation-thick-belly', c.slateShade, [[394,309],[409,316],[429,330],[445,334],[463,333],[475,343],[485,347],[482,355],[470,357],[455,346],[438,346],[415,339],[399,328],[391,326]], front(349,-19,.81));
near('east-continuation-belly-return', c.outerShade, [[397,319],[410,325],[431,337],[449,338],[469,347],[477,349],[470,357],[455,346],[438,346],[415,339],[399,328]], side(350,-1,-19,.83));
near('east-continuation-sheared-section', c.slate, [[412,285],[420,290],[429,302],[447,307],[451,313],[446,316],[430,310],[416,300],[407,299]], side(328,-1,-7,.8));
near('east-continuation-chamber', c.deep, [[428,313],[443,319],[456,319],[463,327],[455,333],[438,327],[427,322]], front(340,-12,.67));
near('east-continuation-chamber-cheek', c.outer, [[428,313],[433,315],[432,320],[438,323],[455,329],[455,333],[438,327],[427,322]], side(340,-1,-12,.8));
near('east-continuation-delamination', c.deep, [[433,281],[444,284],[451,284],[456,292],[450,293],[446,288],[436,287]]);
near('east-continuation-broken-tie', c.distant, [[460,321],[469,323],[475,334],[473,340],[470,338],[471,334],[466,327],[460,326]]);
// Confined to the existing opaque bulk, after the seam flow's (438,300) endpoint.
// The exposed cross-section covers secondary parallel edges without altering
// the silhouette, anchorage, remote layers or overall lighting hierarchy.
near('east-continuation-cross-core-body', c.outerShade, [[442,302],[457,305],[470,317],[467,332],[452,341],[437,333],[432,322],[438,314]], front(345,-12,.78));
near('east-continuation-cross-core-cut', c.outer, [[441,311],[451,307],[463,315],[463,327],[454,336],[445,333],[438,321]], side(342,-1,-12,.79));
near('east-continuation-cross-core-cap', c.slateShade, [[442,302],[457,305],[466,315],[463,319],[451,311],[441,315],[438,314]], top(-10,.81));
near('east-continuation-cross-core-shear', c.deep, [[453,317],[457,318],[458,324],[454,330],[451,329],[454,323]]);
near('east-contact-rewrite-pocket', c.intrusionDim, [[396,275],[405,278],[407,283],[401,282],[399,279],[396,280]]);

// CLOSEST MASS. The visible face is a thick broken section; its dark unlit body
// continues beyond the frame. Three large planes replace the former thin ribbons.
near('front-mass-bulk', c.deep, [[640,180],[610,211],[590,230],[578,265],[550,287],[545,329],[516,357],[491,400],[640,400]], front(435,-21,.65));
near('front-mass-facing', c.outerShade, [[640,205],[622,224],[608,240],[603,274],[577,295],[575,332],[549,360],[529,400],[640,400]], front(428,-22,.77));
near('front-mass-cut-face', c.outer, [[640,180],[610,211],[590,230],[578,265],[550,287],[545,329],[516,357],[491,400],[533,400],[547,374],[568,352],[581,325],[577,304],[606,283],[612,252],[634,230],[640,229]], side(428,-1,-18,.83));
near('front-mass-upper-break-bed', c.slateShade, [[640,180],[610,211],[590,230],[578,265],[550,287],[552,297],[564,297],[583,275],[589,270],[597,238],[619,216],[640,198]], top(-13,.88));
near('front-mass-exposed-mineral', c.slateShade, [[566,297],[577,282],[584,279],[582,295],[573,309],[572,329],[561,343],[553,344],[560,326]], side(365,-1,-15,.8));
near('front-mass-mineral-cleft', c.deep, [[572,299],[577,293],[576,307],[569,316],[568,332],[563,337],[563,320]]);
near('front-mass-shorn-crest', c.outerTop, [[626,201],[638,188],[640,187],[640,192],[629,205],[624,208]]);
near('front-mass-upper-inclusion', c.distant, [[607,231],[616,222],[615,234],[609,240],[607,252],[601,261],[600,256],[604,245]], front(292,-15,.75));
near('front-mass-deep-fracture', c.deep, [[548,319],[557,315],[563,320],[568,319],[575,309],[582,307],[583,320],[575,333],[568,338],[558,330],[546,331]]);
near('front-mass-fracture-return', c.distant, [[548,319],[552,318],[552,324],[561,325],[570,333],[577,327],[579,317],[582,314],[583,320],[575,333],[568,338],[558,330],[546,331]]);
near('front-mass-lower-cut-section', c.slateShade, [[517,357],[527,350],[539,353],[540,365],[536,373],[539,381],[530,400],[515,400],[522,385],[517,380],[525,366]], side(426,-1,-23,.82));
near('front-mass-lower-cut-split', c.deep, [[528,361],[531,357],[534,363],[530,372],[532,381],[525,394],[520,400],[517,400],[525,383],[525,375]]);
near('front-mass-broad-internal-cavity', c.deep, [[622,287],[640,278],[640,362],[628,360],[608,373],[596,366],[602,344],[593,330],[602,307]], front(401,-29,.61));
near('front-mass-cavity-inside', c.underside, [[622,287],[627,285],[616,309],[611,329],[618,343],[613,363],[608,373],[596,366],[602,344],[593,330],[602,307]], side(400,-1,-28,.64));
near('front-mass-cavity-lower-bed', c.distant, [[608,373],[628,360],[640,362],[640,370],[629,368],[609,382],[598,377]], top(-27,.67));
near('front-mass-buried-offset', c.outer, [[571,379],[582,369],[588,374],[584,387],[593,400],[576,400],[568,393]], side(429,-1,-23,.79));
near('front-mass-buried-offset-spall', c.slateShade, [[571,379],[576,374],[580,376],[576,383],[579,391],[573,389]], side(418,-1,-21,.83));

// West foot disappears into a cropped structural undercroft. It does not draw
// a decorative bright frame around the room.
near('west-buried-foot', c.deep, [[0,316],[26,323],[46,341],[73,351],[88,370],[120,379],[144,400],[0,400]], front(425,-29,.61));
near('west-foot-exposed-bed', c.outerShade, [[0,329],[23,335],[39,352],[68,361],[77,376],[101,383],[111,393],[95,391],[72,382],[62,369],[35,361],[19,344],[0,341]], top(-25,.72));
near('west-foot-mineral-return', c.distant, [[0,336],[19,341],[36,359],[62,367],[67,374],[60,372],[33,365],[15,348],[0,345]], front(403,-28,.71));
near('west-foot-cleft', c.farReturn, [[20,348],[28,350],[32,359],[29,363],[23,355]]);

export const EXTERIOR_FACES: readonly Face[] = faces;
