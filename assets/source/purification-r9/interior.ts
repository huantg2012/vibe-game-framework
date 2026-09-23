import { MATERIAL as c, top, front, side, type Face, type Layer, type Point, type Plane } from './schema';

/** R9 native-scale interior drawing.
 * Identity: a maintained enclosure loaded by the surrounding structure. Its left
 * deep work bay, high rear shoulder and right folded wall are different load paths.
 * Projection is X=x, Y=y+Z, with floor Z=0 and upper Z=32. No device is painted here.
 * Surface joins, paving and repairs carry use history; no uniformly sprinkled dots.
 */
const faces: Face[] = [];
const f = (id: string, layer: Layer, color: string, points: readonly Point[], plane: Plane | null): void => {
  faces.push({ id, layer, color, points, plane });
};
const back = (z: number): Plane => ({ normal:[0,.2,-1], elevation:z, occlusion:.54, roughness:.97 });
const paint = {
  stone: '#4e5251', stoneDark: '#373d40', stoneWorn: '#656962',
  plasterCool: '#585c59', plasterGrey: '#62615a', plasterLow: '#474b49',
  bedding: '#434744', beddingDark: '#303736', dust: '#4c504c',
  tile: '#434b4d', tileCool: '#3e484d', tileOld: '#4a4d48', tileEdge: '#525855',
  upperTile: '#4d5252', upperOld: '#4d514d', upperCool: '#465157',
  brickCore: '#544a44', repair: '#5c574c', lampShell: '#44413a',
} as const;

// COMPLETE CUT ENVELOPE. Dark actual understructure, not an outline around a flat room.
f('enclosure-load-envelope', 'architecture', c.underside,
  [[34,247],[48,190],[87,171],[116,148],[148,117],[219,104],[252,123],
   [311,123],[347,149],[359,180],[374,216],[405,247],[412,288],[399,320],
   [380,350],[258,358],[227,371],[75,368],[42,340],[30,313]], front(350,-12,.73));
// West outer return is thick enough to close the lower bay behind storage.
f('west-enclosure-exterior', 'architecture', c.slateShade,
  [[39,247],[52,196],[68,186],[72,219],[58,264],[55,306],[61,333],[53,340],[39,324],[36,287]], side(342,1,0,.85));
f('west-inner-wall', 'architecture', paint.plasterLow,
  [[63,206],[80,194],[106,205],[111,238],[102,267],[57,277],[52,304],[46,302],[49,262]], front(279,0,.89));
f('west-inner-foot-return', 'architecture', c.concreteDark,
  [[57,263],[103,255],[106,267],[58,279],[54,310],[50,312],[51,279]], side(320,1,0,.75));
f('west-wall-ashlar-lower', 'architecture', paint.stone,
  [[56,238],[76,232],[95,236],[98,252],[62,259],[53,263]], front(278,0,.90));
f('west-wall-ashlar-upper', 'architecture', paint.plasterGrey,
  [[64,213],[80,207],[98,213],[98,230],[78,227],[59,233]], front(278,0,.94));
f('west-inner-bed-joint', 'architecture', paint.beddingDark,
  [[58,234],[77,228],[98,231],[98,235],[76,232],[57,238]], front(278,0,.80));
f('west-bearing-cut-top', 'architecture', c.cap,
  [[38,241],[50,192],[77,177],[102,186],[103,201],[79,193],[63,203],[52,246]], top(74,.94));
f('west-coping-old-section', 'architecture', paint.stoneDark,
  [[45,232],[53,197],[73,184],[77,188],[59,202],[50,234]], top(75,.94));
f('west-compression-socket', 'architecture', c.cavity,
  [[39,253],[48,250],[55,255],[55,269],[46,275],[38,269]], front(280,0,.62));
f('west-compression-pad', 'architecture', paint.stoneDark,
  [[40,253],[48,252],[52,256],[51,269],[45,272],[40,267]], side(278,1,0,.83));
f('west-socket-retainer', 'architecture', c.steel,
  [[45,252],[49,251],[52,256],[51,262],[48,263],[48,256]], front(278,0,.87));

// LEFT CORE BAY. A load-bearing niche inset into the shell, open only toward the room.
f('core-bay-rear-mass', 'architecture', paint.stoneDark,
  [[84,179],[113,161],[147,170],[161,191],[157,236],[171,269],[147,281],[105,271],[92,236]], front(277,0,.85));
f('core-bay-shadow-back', 'architecture', '#303d3e',
  [[103,190],[123,181],[146,190],[150,217],[145,244],[154,267],[116,273],[109,245]], front(275,0,.81));
f('core-bay-deep-recess', 'architecture', '#2a3538',
  [[113,198],[127,192],[141,196],[141,235],[137,251],[144,267],[121,270],[116,245]], front(273,0,.76));
// The recess terminates in a visible bonded back wall. The old void-black
// insert looked like an outdoor passage, despite having solid collision.
f('core-bay-closed-back-upper-course', 'architecture', '#344041',
  [[114,202],[127,197],[139,201],[139,213],[116,216]], front(273,0,.79));
f('core-bay-closed-back-bed', 'architecture', '#202c30',
  [[116,216],[139,213],[139,215],[116,218]], front(273,0,.74));
f('core-bay-closed-back-lower-course', 'architecture', '#303c3d',
  [[117,221],[138,218],[138,233],[122,236],[117,232]], front(273,0,.8));
f('core-bay-back-cross-bond', 'architecture', '#253034',
  [[126,198],[128,198],[129,212],[127,214]], front(273,0,.78));
f('core-bay-left-cheek', 'architecture', paint.stone,
  [[89,189],[104,184],[111,209],[112,245],[118,271],[106,270],[99,243],[96,211]], side(275,1,0,.88));
f('core-bay-right-cheek', 'architecture', c.slate,
  [[144,184],[155,192],[156,221],[151,242],[161,267],[154,271],[144,244],[148,218]], side(275,-1,0,.86));
f('core-bay-thick-top', 'architecture', paint.stone,
  [[82,177],[113,158],[147,167],[162,184],[157,193],[142,181],[114,174],[95,185]], top(100,.91));
f('core-bay-top-return', 'architecture', c.concreteDark,
  [[96,185],[114,174],[142,181],[153,190],[149,196],[140,188],[118,183],[105,190]], back(91));
f('core-bay-cast-course', 'architecture', paint.beddingDark,
  [[96,221],[110,223],[111,227],[97,226]], side(276,1,0,.76));
f('core-bay-lower-repair', 'architecture', c.plasterShade,
  [[101,249],[111,253],[114,264],[110,267],[104,264]], side(275,1,0,.88));
f('core-bay-constraint-seat', 'architecture', c.steelSide,
  [[111,250],[118,249],[120,257],[116,267],[112,266]], front(276,0,.85));
f('core-bay-repaired-anchor', 'architecture', c.binder,
  [[112,253],[116,253],[117,258],[115,262],[112,260]], front(276,0,.88));

// HIGH REAR SHOULDER. The central bearing continues through (227,151) into the exterior.
f('rear-west-bearing', 'architecture', paint.stoneDark,
  [[121,151],[151,126],[217,114],[237,133],[239,166],[229,176],[162,184],[149,202],[144,182]], front(183,32,.88));
f('rear-west-plaster-face', 'architecture', paint.plasterGrey,
  [[157,139],[190,132],[207,135],[218,147],[217,168],[163,176],[151,187],[151,153]], front(183,32,.92));
f('rear-west-coat-infill', 'architecture', paint.plasterCool,
  [[157,151],[177,146],[197,149],[211,144],[215,153],[211,166],[166,173],[153,185]], front(183,32,.94));
f('rear-west-wall-cap', 'architecture', paint.stone,
  [[115,147],[146,114],[217,101],[240,123],[234,137],[215,119],[153,132],[132,153]], top(112,.96));
f('rear-cap-mineral-top', 'architecture', c.cap,
  [[129,141],[150,120],[177,114],[180,118],[160,124],[154,130],[139,145]], top(113,.95));
f('rear-coping-underface', 'architecture', c.cavity,
  [[132,153],[153,132],[215,119],[234,137],[231,142],[212,126],[156,138],[136,156]], back(102));
f('rear-bearing-riser', 'architecture', c.slateShade,
  [[216,118],[234,128],[242,144],[239,169],[230,176],[218,168],[222,151]], side(180,-1,32,.82));
f('rear-bearing-socket', 'architecture', c.steelSide,
  [[223,139],[231,142],[234,151],[231,163],[225,164],[222,154]], front(180,32,.76));
f('rear-bearing-contact-pad', 'architecture', paint.stoneWorn,
  [[224,143],[229,144],[231,152],[229,159],[225,157]], front(180,32,.87));
f('rear-bearing-bond', 'architecture', c.binderShade,
  [[217,161],[224,161],[232,167],[229,171],[219,166]], front(180,32,.88));
// Lower eastern shoulder is a solid folded wall, not another roof outline.
f('rear-east-wall', 'architecture', c.slateShade,
  [[239,142],[268,145],[309,142],[335,161],[346,191],[334,202],[310,182],[271,185],[229,176]], front(187,32,.88));
f('rear-east-plaster', 'architecture', paint.plasterCool,
  [[245,152],[267,156],[307,152],[326,165],[332,184],[310,175],[273,179],[240,173]], front(185,32,.94));
f('rear-east-old-coat', 'architecture', paint.plasterLow,
  [[272,158],[291,157],[295,171],[305,174],[274,178],[263,174]], front(185,32,.92));
f('rear-east-cap', 'architecture', c.concrete,
  [[237,130],[269,133],[310,130],[338,150],[350,179],[343,188],[331,160],[307,145],[267,147],[241,143]], top(86,.95));
f('rear-east-cap-bearing-joint', 'architecture', paint.beddingDark,
  [[280,133],[284,133],[284,145],[280,146]], top(87,.86));
f('rear-east-end-return', 'architecture', c.concreteDark,
  [[331,160],[343,168],[351,187],[343,214],[333,229],[332,207],[337,199]], side(229,-1,32,.81));

// EAST ENCLOSURE. Retained wall and connected foundation form an uninterrupted barrier.
f('east-wall-body', 'architecture', c.slateShade,
  [[343,199],[363,211],[386,235],[402,254],[408,290],[396,319],[382,330],
   [378,326],[395,302],[385,265],[360,257],[349,275],[337,271],[342,241]], side(330,-1,0,.85));
f('east-wall-inner-face', 'architecture', paint.plasterLow,
  [[344,210],[359,222],[378,242],[389,265],[381,268],[359,259],[347,276],[339,271],[345,247]], front(277,0,.9));
f('east-wall-stone-inner', 'architecture', paint.stone,
  [[350,219],[359,227],[372,243],[380,260],[359,252],[350,259],[350,248]], front(276,0,.93));
f('east-wall-cap-fold', 'architecture', c.cap,
  [[347,191],[369,208],[391,233],[405,254],[397,264],[383,243],[362,221],[346,208]], top(68,.94));
f('east-fold-cut-face', 'architecture', c.concreteDark,
  [[405,254],[410,272],[406,293],[397,317],[385,331],[379,327],[393,307],[397,286],[397,264]], side(332,-1,0,.91));
f('east-wall-bearing-joint', 'architecture', c.steelSide,
  [[391,263],[402,267],[405,278],[400,288],[391,283]], side(307,-1,0,.76));
f('east-contact-bedded-heel', 'architecture', paint.stoneDark,
  [[389,266],[397,267],[400,275],[397,283],[391,280]], side(303,-1,0,.89));
f('east-contact-restraint', 'architecture', c.steel,
  [[385,258],[393,260],[400,270],[398,273],[391,266],[385,265]], front(294,0,.91));
f('east-wall-lower-ashlar', 'architecture', paint.stone,
  [[393,292],[401,290],[398,308],[388,321],[383,322],[391,307]], side(330,-1,0,.89));

// UPPER FRONT. The entire two-storey support is present between the two real ramps.
f('upper-west-return', 'architecture', c.concreteDark,
  [[150,218],[166,237],[178,275],[144,269],[149,249]], side(278,-1,0,.83));
f('upper-front-bearing', 'architecture', paint.stoneDark,
  [[208,239],[279,239],[290,229],[309,273],[283,279],[221,278]], front(279,0,.86));
f('upper-front-large-pier', 'architecture', paint.plasterLow,
  [[220,244],[256,244],[256,274],[230,274],[221,270]], front(279,0,.92));
f('upper-front-cut-lintel', 'architecture', paint.stone,
  [[208,239],[279,239],[289,231],[292,239],[281,247],[212,247]], front(279,0,.94));
f('upper-front-lintel-soffit', 'architecture', c.cavity,
  [[219,247],[278,247],[283,244],[286,250],[280,254],[220,253]], back(25));
f('upper-front-east-pier', 'architecture', c.slate,
  [[265,251],[282,249],[292,243],[304,270],[281,276],[266,274]], front(279,0,.91));
f('upper-front-pier-bed', 'architecture', c.concreteDark,
  [[221,269],[256,271],[256,275],[230,277],[222,273]], front(279,0,.79));
f('upper-front-old-repair', 'architecture', c.plasterShade,
  [[230,252],[244,252],[249,256],[248,267],[233,267],[228,263]], front(279,0,.93));
f('upper-front-repair-bond', 'architecture', paint.beddingDark,
  [[229,251],[244,251],[248,253],[247,255],[232,254],[230,261],[227,260]], front(279,0,.84));

// FRONT SECTION. Slab, bedding, coarser core and two bearing toes are separate materials.
f('front-foundation-load-slab', 'architecture', c.slateShade,
  [[51,316],[76,340],[223,341],[256,334],[378,326],[385,339],[261,348],
   [227,357],[74,355],[46,331]], front(344,-3,.88));
f('front-foundation-core', 'architecture', paint.stoneDark,
  [[74,348],[226,350],[257,342],[381,332],[381,345],[259,354],[229,365],
   [77,362],[52,340],[48,330]], front(348,-10,.85));
f('front-foundation-bedding', 'architecture', paint.beddingDark,
  [[77,354],[225,356],[259,348],[380,339],[379,343],[260,352],[228,360],[78,358]], front(348,-13,.8));
f('west-underfloor-bearing', 'architecture', c.underside,
  [[61,349],[100,358],[111,380],[100,393],[72,382],[58,366]], front(354,-26,.73));
f('west-underfloor-bearing-face', 'architecture', paint.stoneDark,
  [[68,353],[95,360],[102,378],[97,385],[77,378],[67,366]], front(354,-26,.85));
f('middle-foundation-toe', 'architecture', c.concreteDark,
  [[191,358],[228,358],[242,368],[235,384],[207,391],[192,380]], front(355,-25,.81));
f('middle-foundation-toe-end', 'architecture', paint.stone,
  [[223,360],[239,368],[233,377],[213,383],[209,378],[226,372]], side(357,-1,-25,.82));
f('east-foundation-outward-return', 'architecture', c.slateShade,
  [[345,338],[380,332],[397,319],[410,325],[402,342],[378,352],[347,355]], front(340,-19,.86));
f('east-foundation-bearing-socket', 'architecture', c.cavity,
  [[374,343],[393,333],[402,331],[399,339],[379,350],[370,352]], front(345,-20,.6));
f('foundation-exposed-stone-core', 'architecture', paint.brickCore,
  [[121,351],[164,351],[170,356],[165,362],[126,361],[116,357]], front(348,-14,.87));
f('foundation-retained-mortar', 'architecture', paint.bedding,
  [[123,351],[137,352],[138,356],[151,356],[152,352],[163,353],[165,357],
   [156,360],[141,358],[128,360],[121,357]], front(348,-14,.94));
f('foundation-long-rebar', 'architecture', c.steelSide,
  [[120,355],[147,355],[166,357],[166,359],[146,357],[120,357]], front(348,-15,.87));

// AUTHOR-PLACED WEAR. Medium-scale loss stays rooted in true material joins.
f('rear-west-vertical-pour-joint', 'architecture', paint.beddingDark,
  [[187,135],[190,134],[190,149],[192,158],[191,172],[187,173],[188,159],[185,149]], null);
f('rear-west-joint-lime', 'architecture', c.plasterWorn,
  [[190,138],[191,138],[191,150],[193,158],[192,167],[190,167],[191,158]], null);
f('rear-west-open-coat-loss', 'architecture', c.plasterShade,
  [[154,170],[163,166],[175,167],[184,164],[188,167],[183,172],[171,171],[162,175],[153,182]], null);
f('rear-west-stone-show-through', 'architecture', paint.stoneWorn,
  [[159,171],[164,168],[174,169],[179,167],[182,169],[175,172],[165,172],[158,178]], null);
f('rear-east-lower-coat-loss', 'architecture', c.plasterShade,
  [[274,168],[281,168],[286,171],[296,169],[303,172],[308,171],[308,177],[289,179],[275,176]], null);
f('rear-east-lime-sliver', 'architecture', c.plasterWorn,
  [[280,171],[285,173],[296,171],[303,174],[302,175],[288,176],[280,174]], null);
f('west-wall-compression-repair', 'architecture', paint.repair,
  [[63,244],[67,242],[73,243],[72,247],[65,250],[59,253],[59,250]], null);
f('east-wall-diagonal-bond', 'architecture', paint.beddingDark,
  [[359,226],[363,227],[374,242],[373,246],[370,243],[369,237],[362,230]], null);
f('east-wall-bond-aggregate', 'architecture', paint.stoneWorn,
  [[363,231],[366,233],[368,238],[367,239],[363,235]], null);

// REAL WALL LAMP. Shield, bed, aperture: the warm source is a four-pixel opening.
f('wall-lamp-mount', 'architecture', c.steelSide,
  [[247,162],[253,161],[257,166],[256,176],[250,179],[246,175]], front(185,32,.84));
f('wall-lamp-cast-shield', 'architecture', paint.lampShell,
  [[248,164],[253,163],[255,166],[254,170],[249,171],[247,168]], top(49,.86));
f('wall-lamp-lower-return', 'architecture', c.steel,
  [[248,170],[254,169],[254,175],[249,177]], front(185,32,.87));
f('wall-lamp-aperture', 'architecture', '#b08b59',
  [[250,171],[253,171],[253,173],[251,174],[250,173]], null);
f('wall-lamp-inner-light', 'architecture', '#dcc79c',
  [[251,171],[253,171],[253,172],[251,172]], null);

// MAIN FLOOR PAVING. Unequal retained stone plates, compacted joints and one later pour.
// These polygons are all inside the legal main route. Base floor is painted by the host.
f('main-west-retained-flags', 'floor', paint.tileOld,
  [[58,281],[91,278],[108,283],[103,307],[68,313],[57,305]], top(0,.96));
f('main-west-flag-open-joint', 'floor', paint.beddingDark,
  [[60,300],[80,297],[82,298],[104,294],[104,296],[82,300],[60,302]], top(0,.91));
f('main-west-work-infill', 'floor', c.floorWear,
  [[64,306],[84,304],[98,308],[96,322],[76,329],[61,315]], top(0,.96));
f('main-west-compacted-use', 'floor', paint.dust,
  [[77,314],[88,312],[95,313],[94,316],[89,317],[82,321],[77,319],[68,318],[67,316]], top(0,.96));
f('main-core-heel-plate', 'floor', paint.tile,
  [[110,279],[141,275],[164,280],[169,309],[112,313],[107,307]], top(0,.96));
f('main-core-front-repaired-pour', 'floor', c.floorOld,
  [[119,317],[155,316],[171,309],[184,318],[183,333],[161,337],[116,335],[111,330]], top(0,.96));
f('main-core-pour-trailing-edge', 'floor', paint.tileEdge,
  [[118,329],[126,331],[148,331],[160,329],[169,330],[167,333],[158,332],[149,334],[125,334],[117,332]], top(0,.96));
f('main-central-long-flag', 'floor', paint.tileCool,
  [[186,283],[226,283],[232,287],[229,311],[187,312],[185,305]], top(0,.96));
f('main-central-flag-joint', 'floor', paint.beddingDark,
  [[186,311],[215,311],[220,310],[229,310],[229,311],[221,312],[186,313]], top(0,.91));
f('main-front-continuous-bedding', 'floor', c.floorOld,
  [[190,318],[220,317],[232,321],[257,319],[284,321],[292,331],[256,334],[223,339],[191,338]], top(0,.96));
f('main-right-retained-paving', 'floor', paint.tileOld,
  [[239,284],[274,283],[281,290],[280,309],[238,311],[237,308]], top(0,.96));
f('main-right-large-old-flag', 'floor', paint.tile,
  [[307,282],[345,280],[350,286],[349,310],[306,315],[299,308],[303,294]], top(0,.96));
f('main-right-paving-separated-bed', 'floor', paint.beddingDark,
  [[307,283],[309,283],[305,295],[302,307],[308,313],[306,314],[299,308],[302,293]], top(0,.91));
f('main-east-threshold-plate', 'floor', paint.tileCool,
  [[358,278],[363,264],[379,270],[385,291],[376,310],[353,317],[349,311],[356,293]], top(0,.96));
f('main-east-wall-compaction', 'floor', paint.dust,
  [[380,291],[386,291],[389,302],[379,316],[366,321],[358,320],[376,313],[384,301]], top(0,.95));
f('main-front-right-retained-course', 'floor', c.floorOld,
  [[298,320],[321,322],[346,319],[363,319],[373,324],[321,327],[301,330]], top(0,.96));
f('main-central-traffic-polish', 'floor', c.floorWear,
  [[201,286],[214,285],[222,290],[218,294],[213,294],[208,300],[201,300],[196,297],[199,295]], top(0,.97));
f('main-center-polish-break', 'floor', paint.tileCool,
  [[202,293],[210,291],[218,292],[213,294],[208,297],[202,298]], top(0,.97));
f('main-to-purifier-use', 'floor', c.floorWear,
  [[255,304],[266,300],[277,303],[279,307],[270,310],[257,311],[252,309]], top(0,.97));
f('main-east-paving-worn-nose', 'floor', paint.tileEdge,
  [[356,312],[366,310],[375,304],[375,307],[367,314],[357,315]], top(0,.96));
f('main-old-flag-small-fissure', 'floor', c.floorShade,
  [[251,287],[254,287],[259,296],[258,301],[256,300],[257,296]], top(0,.90));

// UPPER WORKING BAND. Two bays and the lamp-lit infill share a free circulation strip.
f('upper-west-plinth-paving', 'floor', paint.upperOld,
  [[160,189],[183,186],[204,190],[208,210],[160,213],[155,205]], top(32,.97));
f('upper-west-front-flag', 'floor', paint.upperTile,
  [[157,216],[181,215],[197,218],[198,232],[188,236],[168,235]], top(32,.97));
f('upper-west-paving-bed', 'floor', paint.bedding,
  [[163,215],[181,213],[198,216],[197,219],[183,217],[165,218]], top(32,.92));
f('upper-middle-repaired-bed', 'floor', c.upperOld,
  [[213,184],[229,180],[255,186],[260,194],[259,214],[215,215],[209,200]], top(32,.97));
f('upper-middle-pour-joint', 'floor', paint.beddingDark,
  [[211,187],[213,187],[212,201],[215,211],[214,214],[210,201]], top(32,.92));
f('upper-middle-pour-edge', 'floor', c.upperWear,
  [[215,201],[219,211],[226,214],[239,216],[239,218],[224,216],[217,213]], top(32,.96));
f('upper-middle-compressed-wear', 'floor', paint.upperTile,
  [[223,204],[234,202],[250,205],[250,209],[243,214],[233,212],[224,214],[220,210]], top(32,.97));
f('upper-east-retained-flag', 'floor', paint.upperCool,
  [[270,191],[309,187],[326,202],[324,219],[273,217],[268,204]], top(32,.97));
f('upper-east-bed-open-joint', 'floor', paint.beddingDark,
  [[266,193],[268,193],[269,205],[274,213],[273,214],[266,206]], top(32,.92));
f('upper-east-nose-plate', 'floor', c.upperWear,
  [[305,223],[321,220],[329,221],[329,226],[306,228],[298,227]], top(32,.97));
f('upper-front-working-band', 'floor', paint.upperTile,
  [[204,221],[224,224],[245,222],[259,224],[279,224],[281,231],[275,237],[208,237],[201,231]], top(32,.97));
f('upper-front-compacted-joint', 'floor', paint.bedding,
  [[223,226],[225,226],[225,236],[222,236]], top(32,.94));
f('upper-front-paving-broken-joint', 'floor', paint.bedding,
  [[257,227],[259,226],[262,232],[271,233],[271,235],[260,234]], top(32,.94));
f('upper-lamp-work-scuff', 'floor', c.upperWear,
  [[242,186],[247,185],[253,188],[255,193],[253,195],[249,191],[244,191]], top(32,.97));

// Contact shade is authored on the actual walking hosts; no new floor extension.
f('upper-rear-wall-contact', 'floor', c.floorShade,
  [[162,183],[229,176],[271,185],[310,182],[335,200],[334,204],
   [309,185],[271,188],[229,179],[164,186],[153,203],[153,219],[150,220],[150,202]], top(32,.77));
f('main-west-wall-contact', 'floor', c.floorShade,
  [[57,277],[61,279],[55,314],[77,336],[94,337],[94,340],[76,340],[51,316]], top(0,.77));
f('main-east-wall-contact', 'floor', c.floorShade,
  [[352,274],[360,257],[385,265],[395,302],[378,326],
   [376,323],[390,301],[382,269],[362,262],[355,277]], top(0,.77));
f('upper-front-support-contact', 'floor', c.floorShade,
  [[222,279],[283,280],[304,276],[304,279],[283,283],[223,282]], top(0,.79));

// LOW FRONT CUT. Its thickness projects down/out; no wall rises across legal foot space.
f('front-observation-slab-cut', 'foreground', paint.stone,
  [[51,316],[76,340],[223,341],[256,334],[378,326],[382,330],[257,339],[224,346],[75,345],[49,321]], top(3,.94));
f('front-cut-retained-west-top', 'foreground', c.concrete,
  [[55,322],[77,342],[129,342],[129,344],[77,344],[53,324]], top(3,.96));
f('front-cut-retained-middle-top', 'foreground', c.cap,
  [[158,342],[191,342],[191,344],[158,344]], top(3,.95));
f('front-cut-east-top-course', 'foreground', c.concrete,
  [[275,334],[312,331],[335,330],[335,332],[309,334],[276,337]], top(3,.95));
f('front-cut-joint-one', 'foreground', paint.beddingDark,
  [[130,341],[133,341],[133,346],[130,346]], top(2,.89));
f('front-cut-joint-two', 'foreground', paint.beddingDark,
  [[238,338],[241,337],[241,342],[238,343]], top(2,.89));
f('front-cut-exposed-upper-core', 'foreground', paint.stoneWorn,
  [[195,343],[202,343],[205,346],[219,345],[219,348],[204,349],[201,346],[195,346]], front(345,-1,.90));
f('front-cut-west-end-thickness', 'foreground', c.concreteDark,
  [[49,321],[76,345],[77,351],[52,329]], front(347,-2,.89));
f('front-cut-central-thickness', 'foreground', paint.stoneDark,
  [[77,345],[224,346],[224,350],[78,350]], front(345,-2,.89));
f('front-cut-eastern-return-thickness', 'foreground', c.slateShade,
  [[257,339],[382,330],[380,334],[258,343],[224,350],[224,346]], front(341,-1,.91));

// R9 real-frame refinement: twelve local construction assemblies. These marks
// explain joints and material thickness on retained hosts, never the outer silhouette.
// 1. Rear cap has a keyed bed and one compressed, partly lost mortar line.
f('rear-cap-keyed-bed', 'architecture', paint.beddingDark,
  [[166,112],[171,112],[173,118],[171,124],[173,128],[169,129],[167,124],[169,119]], top(113,.84));
f('rear-cap-key-cut-lip', 'architecture', paint.stoneWorn,
  [[171,113],[173,114],[175,118],[173,121],[172,120],[173,118]], top(113,.95));
// 2. West plaster loss exposes a staggered stone course, not scattered grains.
f('rear-west-hidden-stone-bed', 'architecture', paint.beddingDark,
  [[157,161],[168,159],[177,160],[183,158],[184,161],[176,163],[166,162],[157,164]], null);
f('rear-west-stone-joint-tooth', 'architecture', paint.stone,
  [[167,161],[170,160],[171,165],[178,164],[181,166],[177,168],[169,167]], null);
f('rear-west-plaster-thin-lip', 'architecture', c.plasterWorn,
  [[157,162],[165,160],[168,161],[166,163],[159,164],[157,166]], null);
// 3. Niche left return has a bonded joint and a thin surviving plaster edge.
f('core-niche-return-bed', 'architecture', c.cavity,
  [[99,206],[108,208],[109,211],[101,209]], side(275,1,0,.70));
f('core-niche-return-bonded-edge', 'architecture', paint.stoneWorn,
  [[100,203],[102,204],[103,207],[107,208],[108,211],[104,211],[101,208]], side(275,1,0,.9));
// 4. Eastern old coat stops against the lamp bed with an inset ledger course.
f('rear-lamp-ledger-seam', 'architecture', paint.beddingDark,
  [[259,163],[270,165],[282,163],[283,166],[270,168],[259,166]], front(185,32,.78));
f('rear-lamp-ledger-cut', 'architecture', paint.stone,
  [[261,167],[270,169],[282,167],[286,169],[285,172],[270,172],[263,170]], front(185,32,.92));
f('rear-ledger-left-stone-joint', 'architecture', paint.beddingDark,
  [[272,168],[274,168],[274,171],[272,171]], front(185,32,.82));
// 5. Right wall's fold contains an older embedded ashlar tongue and keyed facing.
f('east-fold-bonded-ashlar', 'architecture', paint.stoneDark,
  [[351,232],[355,231],[362,237],[366,245],[362,247],[356,240],[351,238]], front(276,0,.89));
f('east-fold-ashlar-cut-face', 'architecture', paint.stoneWorn,
  [[352,232],[355,232],[362,239],[361,242],[355,237],[352,237]], front(276,0,.92));
f('east-fold-facing-mortar', 'architecture', paint.beddingDark,
  [[351,239],[356,241],[361,247],[367,249],[367,251],[360,249],[354,243],[351,242]], front(276,0,.78));
// 6. Terrace fascia: an actual toothed joint joins lintel and repaired pier.
f('terrace-lintel-key-joint', 'architecture', paint.beddingDark,
  [[245,240],[247,240],[247,243],[252,243],[252,247],[249,247],[249,245],[245,245]], front(279,0,.79));
f('terrace-pier-return-exposed', 'architecture', paint.stone,
  [[249,255],[253,253],[254,270],[250,272],[249,266]], side(279,-1,0,.86));
// 7. Upper paving: one staggered bed crosses the service bays without forming a grid.
f('upper-west-retained-cross-bed', 'floor', paint.beddingDark,
  [[160,206],[175,207],[177,206],[202,208],[201,210],[180,209],[175,210],[161,208]], top(32,.9));
f('upper-middle-staggered-bed', 'floor', paint.bedding,
  [[216,210],[233,211],[234,209],[238,209],[238,212],[257,213],[257,215],[235,214],[230,213],[217,212]], top(32,.92));
f('upper-east-retained-cross-bed', 'floor', paint.bedding,
  [[280,214],[304,214],[306,213],[322,215],[322,217],[307,215],[305,216],[281,216]], top(32,.92));
// 8. A chipped upper slab corner exposes the thinner coat and compacted stone below.
f('upper-infill-corner-cut', 'floor', paint.beddingDark,
  [[253,207],[258,207],[258,211],[255,214],[251,214],[251,212],[254,211]], top(31.5,.85));
f('upper-infill-corner-layer', 'floor', paint.tileEdge,
  [[252,207],[256,207],[256,209],[254,210],[252,210]], top(32,.96));
f('upper-infill-compacted-tail', 'floor', c.upperWear,
  [[247,215],[251,214],[254,215],[254,216],[250,217],[245,217]], top(32,.96));
// 9. Front upper work band contains a narrow bed repair, with an unequal cut end.
f('upper-front-bed-repair', 'floor', paint.upperOld,
  [[231,225],[245,225],[249,228],[247,231],[231,230]], top(32,.97));
f('upper-front-bed-repair-edge', 'floor', paint.bedding,
  [[231,230],[246,230],[248,228],[250,228],[248,232],[232,232]], top(32,.9));
// 10. Main circulation paving has a common bed direction and a short perpendicular key.
f('main-central-paving-course', 'floor', paint.bedding,
  [[187,309],[228,308],[235,306],[250,307],[279,305],[279,307],[251,309],[235,308],[229,310],[187,311]], top(0,.91));
f('main-central-staggered-key', 'floor', paint.beddingDark,
  [[208,285],[210,285],[210,290],[211,293],[210,299],[208,299],[209,293]], top(0,.9));
f('main-central-course-worn-lip', 'floor', paint.tileEdge,
  [[215,311],[229,310],[234,309],[234,311],[229,312],[216,313]], top(0,.96));
// 11. One old paving corner has compacted wear, not a second pedestal shape.
f('main-east-paving-broken-corner', 'floor', paint.beddingDark,
  [[337,306],[342,306],[344,309],[349,310],[348,312],[342,311],[340,308],[337,309]], top(-.5,.84));
f('main-east-paving-exposed-layer', 'floor', paint.tileEdge,
  [[337,304],[340,304],[342,307],[340,308],[338,306],[335,307]], top(0,.96));
f('main-core-front-sole-scrape', 'floor', paint.tileEdge,
  [[183,323],[189,322],[195,323],[201,322],[202,323],[196,325],[190,324],[184,325]], top(0,.96));
// 12. Foreground slab has one traceable construction lap; its silhouette stays intact.
f('front-slab-bed-lap', 'foreground', paint.beddingDark,
  [[269,338],[273,338],[273,341],[279,341],[279,344],[272,344],[270,342]], front(345,-2,.80));
f('front-slab-lap-exposed-core', 'foreground', paint.stoneWorn,
  [[276,338],[285,337],[287,339],[285,341],[279,341]], front(345,-2,.9));

export const INTERIOR_FACES: readonly Face[] = faces;
