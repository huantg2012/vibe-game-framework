import { PixelLayer, type Ink, type Point } from './raster';
import { brokenConcrete, castPlane, paving, recess } from './construction-surfaces';

const UP = [0, 0, 1] as const;
const FRONT = [0, .93, .3] as const;
const LEFT = [-.83, .4, .23] as const;
const RIGHT = [.89, .35, .2] as const;
const ink = (material: Ink['material'], tone: number, normal: Ink['normal'] = FRONT, light = 1): Ink => ({
  material, tone, normal, light,
  roughness: material === 'steel' ? .32 : .88,
  specular: material === 'steel' ? .68 : .07,
});

/** A chamfered poured pier. The face, arris and return are distinct volumes;
 * their construction joint passes across every face rather than stopping at it. */
function pier(layer: PixelLayer, x: number, top: number, width: number, bottom: number, tone: number): void {
  castPlane(layer, [[x, top], [x + width - 4, top + 1], [x + width - 4, bottom - 2], [x, bottom]], tone, FRONT);
  castPlane(layer, [[x + width - 4, top + 1], [x + width, top + 4], [x + width, bottom - 4], [x + width - 4, bottom - 2]], tone - .13, [-.28, .9, .33]);
  castPlane(layer, [[x + width, top + 4], [x + width + 12, top + 7], [x + width + 12, bottom - 8], [x + width, bottom - 4]], tone - .66, RIGHT, [x, top]);
  for (const lift of [394, 461]) {
    if (lift <= top || lift >= bottom - 12) continue;
    // The horizontal cold joint is a compacted cement bed, not a dark drawn grid.
    layer.poly([[x, lift], [x + width - 4, lift + 1], [x + width, lift + 3], [x + width + 11, lift + 5], [x + width + 11, lift + 7], [x + width - 3, lift + 3], [x, lift + 2]], ink('concrete', tone - .27, FRONT, .85));
  }
  // Recessed casting tie. It has an actual bevel, underside and dark bore.
  for (const [yy, shift] of [[365, 0], [436, 5]] as const) {
    const xx = x + width * .5 + shift;
    layer.poly([[xx - 3, yy], [xx + 2, yy - 1], [xx + 4, yy + 2], [xx + 2, yy + 5], [xx - 3, yy + 4]], ink('concrete', tone - .48, FRONT, .65));
    layer.rect(xx - 1, yy + 1, 3, 2, { ...ink('concrete', tone - .95), occlusion: .48 });
    layer.line([[xx - 2, yy + 4], [xx + 1, yy + 5]], ink('chalk', tone - .1, [0, .5, .85]), 1);
  }
}

/** C's silhouettes and ground axes stay registered. Architectural paint starts
 * with cast volumes, load paths, material section and joints—not a flat stain map. */
export function buildArchitectureLayers(): PixelLayer[] {
  const distance = new PixelLayer('opening-midground');
  distance.rect(253, 323, 709, 465, ink('void', 1, FRONT, 0));
  castPlane(distance, [[752, 338], [831, 324], [867, 372], [873, 542], [750, 558]], 1.9, FRONT, [752, 338], 'concrete', .08);
  recess(distance, [[799, 345], [829, 339], [852, 367], [853, 524], [832, 530], [831, 379], [799, 374]], 1.38, FRONT, [799, 345], 54, 185);
  castPlane(distance, [[773, 358], [792, 354], [790, 500], [773, 512]], 1.88, LEFT, [773, 358], 'concrete', .12);
  castPlane(distance, [[792, 354], [804, 360], [802, 497], [790, 500]], 1.15, RIGHT, [792, 354], 'concrete', .08);
  distance.poly([[789, 388], [812, 383], [813, 402], [801, 407], [790, 404]], ink('void', 1, FRONT, 0));
  distance.poly([[810, 403], [824, 398], [824, 467], [815, 476]], ink('void', 2, RIGHT, 0));
  castPlane(distance, [[805, 462], [832, 455], [847, 459], [821, 471], [806, 471]], 1.7, UP, [805, 462], 'concrete', .12);
  distance.poly([[806, 471], [821, 471], [847, 459], [845, 470], [825, 481], [807, 480]], ink('void', 1.2, FRONT, 0));
  distance.poly([[760, 414], [831, 420], [831, 432], [760, 426]], ink('concrete', 1.5, UP, .1));
  distance.poly([[762, 427], [831, 433], [831, 458], [763, 450]], ink('void', 1.7, FRONT, 0));
  distance.line([[776, 361], [778, 398], [777, 418]], ink('concrete', 2.1, LEFT, .15), 1);

  const room = new PixelLayer('rear-masonry');
  castPlane(room, [[253, 322], [786, 331], [752, 388], [751, 477], [252, 536]], 2.72, FRONT);
  // Deep wall bays have reveal thickness and a poured sill. They are structural
  // voids between piers, not small rectangles pasted on the wall.
  for (const bay of [
    { x: 332, right: 360, top: 338, bottom: 514, tone: 2.45 },
    { x: 407, right: 474, top: 339, bottom: 507, tone: 2.68 },
    { x: 531, right: 678, top: 348, bottom: 500, tone: 2.52 },
    { x: 718, right: 751, top: 349, bottom: 478, tone: 2.05 },
  ]) {
    const { x, right: r, top: y, bottom: b, tone } = bay;
    recess(room, [[x + 6, y + 7], [r - 4, y + 9], [r - 4, b - 8], [x + 6, b]], tone, FRONT, [x, y], r - x, b - y);
    castPlane(room, [[x, y], [x + 6, y + 7], [x + 6, b], [x, b + 3]], tone - .23, RIGHT);
    castPlane(room, [[x, y], [r, y + 3], [r - 4, y + 9], [x + 6, y + 7]], tone - .52, [0, -.3, -.94]);
    castPlane(room, [[x + 6, b], [r - 4, b - 8], [r, b - 4], [x, b + 5]], tone + .24, UP);
    // Two lifts of uncoated concrete form the back of the bay. Subtle formwork
    // ridges carry across the rear face, but terminate at the cast reveals.
    for (const yy of [389, 442]) {
      if (yy > b - 9) continue;
      room.poly([[x + 7, yy], [r - 5, yy + 1], [r - 5, yy + 3], [x + 7, yy + 2]], ink('concrete', tone - .18));
    }
  }
  pier(room, 273, 323, 50, 531, 3.26);
  pier(room, 362, 328, 33, 520, 3.2);
  pier(room, 474, 333, 43, 515, 3.1);
  pier(room, 677, 335, 29, 493, 2.8);
  // The wall's footing is a second pour. Its small bevel and inset service chase
  // keep the bottom structurally legible even when the core occludes it.
  castPlane(room, [[412, 483], [474, 477], [474, 509], [412, 517]], 2.85, FRONT);
  castPlane(room, [[534, 478], [677, 467], [677, 500], [534, 518]], 2.75, FRONT);
  room.poly([[540, 486], [664, 476], [664, 482], [540, 493]], { ...ink('concrete', 1.8), occlusion: .55 });
  room.line([[540, 494], [562, 492]], ink('concrete', 3.05, UP), 1);
  // Roof load rests on successive corbels. The darker underside has a real
  // flange and bearing pads, instead of a line around the room.
  room.poly([[253, 323], [787, 323], [786, 335], [716, 347], [611, 340], [517, 335], [420, 329]], ink('void', 1.1, [0, 0, -1], .05));
  castPlane(room, [[517, 333], [716, 346], [734, 342], [732, 350], [713, 354], [517, 341]], 2.2, FRONT);
  for (const [x, y, width] of [[611, 329, 34], [693, 334, 33]] as const) {
    castPlane(room, [[x, y], [x + width, y + 2], [x + width - 3, y + 18], [x + 11, y + 21], [x, y + 13]], 2.7, FRONT);
    room.poly([[x + 11, y + 21], [x + width - 3, y + 18], [x + width - 4, y + 22], [x + 12, y + 24]], ink('void', 1.35, [0, -.1, -.9], .08));
  }
  // One real break continues through the top and face of the right pier.
  brokenConcrete(room, [[691, 337], [705, 336], [705, 351], [699, 361], [692, 355]], [691, 337], [705, 336], 2.6, FRONT, 21);
  room.line([[700, 359], [698, 373], [702, 380], [700, 395]], ink('concrete', 1.8), 1);
  // The embedded conduit follows its chase. It is not a decorative edge stripe.
  room.line([[684, 383], [688, 386], [688, 452]], ink('steel', 1.55), 4);
  room.line([[687, 387], [687, 447]], ink('steel', 3.2, [-.2, .92, .34]), 1);
  for (const yy of [399, 432]) {
    room.poly([[681, yy], [694, yy + 1], [694, yy + 6], [681, yy + 5]], ink('steel', 2.05));
    room.rect(682, yy + 1, 3, 2, ink('steel', 3.1, UP));
  }

  const ground = new PixelLayer('floor-and-upper-platform');
  const floor: readonly Point[] = [[253, 580], [441, 553], [626, 571], [774, 601], [877, 613], [889, 645], [775, 688], [679, 715], [710, 724], [650, 741], [550, 716], [496, 730], [408, 701], [254, 730]];
  paving(ground, floor, 3.38, [293, 613], [168, 40], [-95, 50]);
  // The platform is a layered structure: a replaceable thin stone wearing bed,
  // a load-carrying concrete slab, then a damaged soffit exposing reinforcing steel.
  // All sections below share the exact same corners as the walking surface.
  const side: readonly Point[] = [[775, 688], [889, 645], [887, 680], [852, 693], [839, 702], [819, 703], [793, 715], [776, 719], [752, 732], [731, 735], [710, 746], [710, 724], [679, 715]];
  castPlane(ground, side, 2.76, LEFT, [889, 645], 'concrete', .83);
  ground.poly([[775, 688], [889, 645], [889, 651], [775, 695], [701, 726], [695, 722], [679, 715]], ink('concrete', 3.12, [-.62, .41, .66]));
  ground.poly([[775, 695], [889, 651], [888, 655], [774, 699], [704, 729], [700, 726]], { ...ink('concrete', 2.12, LEFT), occlusion: .72 });
  // Most of the bearing body remains a continuous pour. One large failure
  // and one shorter broken corner establish a large/medium/small rhythm.
  castPlane(ground, [[887, 658], [866, 666], [866, 687], [887, 680]], 2.72, LEFT);
  ground.poly([[887, 674], [867, 681], [866, 687], [887, 680]], ink('concrete', 2.36, [-.54, .64, -.42], .6));
  brokenConcrete(ground, [[859, 670], [846, 674], [842, 681], [830, 680], [821, 691], [807, 695], [799, 713], [819, 703], [839, 702], [850, 687], [858, 686]], [859, 670], [807, 690], 2.73, [-.68, .65, .31], 29);
  ground.poly([[845, 688], [839, 702], [819, 703], [825, 696], [838, 690]], { ...ink('concrete', 1.82, [0, -.1, -.98], .3), occlusion: .5 });
  castPlane(ground, [[799, 700], [777, 709], [778, 718], [793, 715]], 2.61, LEFT);
  castPlane(ground, [[744, 725], [732, 730], [730, 734], [710, 744], [710, 734], [742, 720]], 2.54, [-.81, .42, .2]);
  brokenConcrete(ground, [[776, 706], [765, 711], [765, 716], [750, 723], [748, 733], [764, 726], [775, 719]], [776, 706], [750, 717], 2.72, [-.83, .3, .35], 17);
  ground.poly([[754, 715], [773, 709], [772, 716], [750, 727], [742, 727]], { ...ink('void', 1.3, FRONT, .1), occlusion: .35 });
  // Exposed reinforcing bars belong inside the broken slab; two ends bend down.
  ground.line([[849, 688], [826, 698], [810, 703], [803, 712]], ink('steel', 1.78, LEFT, .6), 3);
  ground.line([[844, 689], [829, 695]], ink('steel', 3.15, [-.2, .8, .56], .7), 1);
  ground.line([[776, 717], [758, 724], [747, 730], [744, 738]], ink('steel', 1.67, LEFT, .55), 3);
  ground.line([[768, 720], [757, 724]], ink('steel', 2.9, [-.25, .8, .5], .8), 1);
  for (const [x, y] of [[836, 693], [826, 697], [766, 722]] as const) ground.line([[x, y - 2], [x + 2, y + 1]], ink('steel', 2.55, UP, .7), 1);
  // The short end face turns to a second normal and exposes the same layers.
  brokenConcrete(ground, [[710, 724], [650, 741], [649, 776], [659, 774], [670, 767], [678, 766], [688, 762], [707, 757]], [710, 724], [650, 741], 2.65, FRONT, 33);
  ground.poly([[710, 724], [650, 741], [650, 747], [709, 730]], ink('concrete', 3.22, [0, .72, .66]));
  ground.poly([[709, 730], [650, 747], [650, 750], [709, 733]], { ...ink('concrete', 1.94, FRONT), occlusion: .6 });
  ground.poly([[705, 740], [691, 744], [679, 751], [676, 766], [688, 762], [707, 757]], ink('concrete', 2.25, [.38, .82, -.24], .7));
  ground.poly([[679, 751], [666, 755], [659, 761], [649, 761], [649, 776], [659, 774], [670, 767], [676, 766]], ink('concrete', 2.55, [-.25, .9, .26], .7));
  ground.line([[693, 744], [683, 747], [671, 756], [664, 766]], ink('steel', 1.5), 2);
  ground.line([[684, 748], [673, 754]], ink('steel', 2.65, UP), 1);
  brokenConcrete(ground, [[650, 741], [624, 733], [622, 781], [633, 782], [636, 785], [647, 788]], [624, 733], [650, 741], 2.11, RIGHT, 47);
  ground.poly([[624, 733], [650, 741], [650, 747], [624, 739]], ink('concrete', 2.82, [.5, .35, .78]));
  ground.poly([[625, 765], [643, 769], [647, 788], [636, 785], [633, 782], [622, 781]], ink('concrete', 1.48, [.58, .28, -.72], .35));
  // A single crack begins on the wearing surface, opens at its edge and goes
  // through the face. This is one failure, not three unrelated scratches.
  ground.line([[798, 647], [799, 658], [812, 670], [817, 676], [824, 680], [820, 689], [816, 698]], ink('concrete', 2.2, UP, .7), 1);
  ground.line([[701, 700], [697, 710], [706, 721], [704, 734], [696, 743]], ink('concrete', 2, FRONT, .7), 1);
  ground.line([[818, 678], [820, 680], [818, 685]], ink('chalk', 3.55, [-.4, .3, .85]), 1);

  // Raised rear platform: a load-bearing stem wall under a thick cantilever cap.
  // A service chase is recessed in the stem, leaving a visible concrete lintel.
  castPlane(ground, [[253, 513], [352, 501], [480, 505], [532, 506], [628, 522], [671, 512], [675, 572], [625, 604], [475, 583], [346, 576], [253, 591]], 2.91, FRONT);
  paving(ground, [[253, 513], [352, 501], [480, 505], [532, 506], [628, 522], [663, 509], [674, 513], [631, 540], [527, 525], [474, 519], [351, 519], [253, 536]], 3.58, [347, 519], [169, 14], [-78, 24], .92);
  castPlane(ground, [[475, 519], [527, 525], [631, 540], [631, 548], [526, 533], [475, 527]], 3.08, [0, .85, .52]);
  ground.poly([[475, 527], [526, 533], [631, 548], [630, 552], [527, 537], [475, 531]], { ...ink('concrete', 2.07, FRONT), occlusion: .66 });
  recess(ground, [[488, 545], [610, 560], [610, 584], [488, 569]], 2.18, FRONT, [488, 545], 123, 40);
  castPlane(ground, [[488, 541], [614, 556], [610, 560], [488, 545]], 2.51, [0, -.5, -.85]);
  castPlane(ground, [[488, 569], [610, 584], [614, 589], [488, 574]], 2.93, UP);
  castPlane(ground, [[614, 556], [620, 557], [620, 591], [614, 589], [610, 584], [610, 560]], 2.83, LEFT);
  // Two structural ribs bridge the recess, showing what supports the ledge.
  for (const [x, yy] of [[518, 548], [570, 554]] as const) {
    castPlane(ground, [[x, yy - 10], [x + 12, yy - 8], [x + 12, yy + 39], [x, yy + 37]], 3.13, FRONT);
    castPlane(ground, [[x + 12, yy - 8], [x + 16, yy - 5], [x + 16, yy + 36], [x + 12, yy + 39]], 2.52, RIGHT);
  }
  // Wall-foot bearing pads and cold joint keep the lower course from hovering.
  ground.poly([[476, 575], [626, 596], [626, 604], [475, 583]], ink('concrete', 2.38, FRONT, .75));
  ground.line([[477, 575], [511, 580]], ink('concrete', 2.95, UP), 1);
  brokenConcrete(ground, [[625, 544], [641, 539], [638, 553], [632, 559], [634, 580], [625, 588], [620, 581], [622, 564]], [625, 544], [641, 539], 2.94, LEFT, 44);
  ground.line([[628, 554], [631, 563], [628, 571], [628, 580]], ink('steel', 1.62), 2);
  ground.poly([[672, 517], [823, 461], [823, 587], [749, 607], [682, 570]], ink('void', 1.03, RIGHT, .03));
  castPlane(ground, [[734, 536], [783, 506], [783, 570], [746, 590], [734, 582]], 1.9, LEFT, [734, 536], 'concrete', .15);
  ground.poly([[783, 506], [794, 511], [794, 573], [783, 570]], ink('void', 1.55, RIGHT, .06));
  ground.poly([[745, 547], [760, 538], [760, 576], [747, 583]], { ...ink('concrete', 1.27, LEFT, .07), occlusion: .58 });
  ground.poly([[803, 489], [816, 482], [816, 580], [803, 585]], ink('void', 1.63, LEFT, .06));

  // The original rising upper ramp remains. Fewer large construction pours,
  // transverse recessed joints and a cast curb preserve its perspective.
  paving(ground, [[630, 530], [736, 452], [821, 454], [700, 544]], 3.02, [630, 530], [71, 15], [53, -40], .78);
  brokenConcrete(ground, [[700, 544], [821, 454], [821, 466], [782, 497], [774, 508], [749, 524], [705, 556]], [700, 544], [821, 454], 2.55, RIGHT, 13);
  castPlane(ground, [[632, 530], [737, 452], [746, 455], [641, 535]], 3.35, [0, -.18, .98]);
  castPlane(ground, [[689, 538], [796, 458], [810, 457], [700, 541]], 3.15, [0, -.18, .98]);
  castPlane(ground, [[736, 451], [760, 438], [823, 440], [823, 454]], 3.02, UP);
  ground.line([[759, 439], [759, 422], [824, 431]], ink('steel', 1.7), 3);
  for (const x of [777, 800, 822]) ground.line([[x, 426 + (x - 777) * .13], [x, 449]], ink('steel', 2.35), 2);
  ground.line([[759, 422], [794, 427]], ink('steel', 3.75), 1);

  const contacts = new PixelLayer('contact-shadows');
  contacts.ellipse(383, 615, 118, 18, ink('concrete', 1, UP, 0));
  contacts.ellipse(383, 612, 99, 13, ink('void', 1, UP, 0));
  contacts.ellipse(586, 516, 66, 9, ink('concrete', 1, UP, 0));
  contacts.poly([[645, 597], [734, 613], [771, 632], [694, 638], [616, 613]], ink('concrete', 2, UP, 0));
  contacts.ellipse(674, 614, 74, 9, ink('concrete', 1, UP, 0));

  const foreground = new PixelLayer('right-wall-and-front-edge');
  const nearWall: readonly Point[] = [[838, 323], [887, 323], [887, 361], [906, 377], [909, 664], [927, 695], [950, 785], [887, 785], [879, 743], [860, 692], [850, 619], [837, 615], [837, 414], [822, 399], [823, 374], [813, 364], [820, 343]];
  castPlane(foreground, nearWall, 2.92, LEFT, [839, 414], 'concrete', .82);
  castPlane(foreground, [[887, 323], [919, 323], [926, 341], [935, 341], [935, 727], [960, 788], [951, 788], [928, 698], [910, 664], [906, 377], [887, 361]], 1.65, RIGHT, [887, 323], 'concrete', .26);
  // This near section reveals how the whole wall was built: its inner return is
  // a cast pier, the middle is recessed infill, and the outer edge is structural.
  castPlane(foreground, [[838, 414], [856, 418], [856, 596], [849, 600], [839, 596]], 3.21, LEFT);
  castPlane(foreground, [[856, 418], [861, 423], [861, 598], [856, 596]], 2.43, RIGHT);
  recess(foreground, [[862, 429], [890, 436], [890, 593], [862, 588]], 2.32, LEFT, [862, 429], 30, 164);
  castPlane(foreground, [[862, 422], [891, 429], [891, 436], [862, 429]], 2.77, [0, -.7, -.5]);
  castPlane(foreground, [[862, 588], [890, 593], [894, 602], [862, 597]], 3.05, UP);
  castPlane(foreground, [[894, 421], [905, 423], [909, 606], [895, 604]], 2.86, LEFT);
  foreground.poly([[890, 435], [894, 436], [895, 603], [890, 593]], { ...ink('concrete', 1.98, RIGHT), occlusion: .68 });
  // The horizontal pour joint wraps the near pier and is offset by the recess.
  foreground.poly([[839, 484], [856, 488], [861, 492], [861, 494], [856, 491], [839, 487]], ink('concrete', 2.59, LEFT));
  foreground.poly([[863, 490], [890, 496], [890, 498], [863, 492]], ink('concrete', 2.16, LEFT));
  foreground.poly([[895, 495], [907, 498], [907, 501], [895, 498]], ink('concrete', 2.36, LEFT));
  // The broken top is an exposed aggregate section, not a decorative chalk blob.
  brokenConcrete(foreground, [[821, 343], [838, 340], [849, 352], [843, 361], [839, 369], [826, 374], [813, 364]], [821, 343], [843, 349], 3.16, [-.6, .2, .77], 27);
  brokenConcrete(foreground, [[824, 378], [840, 383], [840, 398], [833, 405], [822, 399], [824, 390]], [824, 378], [840, 383], 2.88, LEFT, 23);
  foreground.poly([[840, 362], [848, 354], [850, 367], [840, 383], [834, 380]], { ...ink('concrete', 1.75, RIGHT, .4), occlusion: .7 });
  foreground.line([[833, 371], [834, 359], [828, 352]], ink('steel', 1.67), 2);
  foreground.line([[834, 359], [831, 354]], ink('steel', 2.85, UP), 1);
  // Wall foot flares into a buttress. Its steps carry load into the platform,
  // and the same chipped corner is visible on its upper and lower face.
  castPlane(foreground, [[838, 598], [862, 604], [874, 619], [869, 640], [847, 637]], 3.05, LEFT);
  castPlane(foreground, [[838, 598], [861, 600], [873, 614], [869, 620], [844, 613]], 3.45, UP);
  brokenConcrete(foreground, [[844, 613], [869, 620], [865, 630], [866, 642], [854, 639], [847, 637]], [844, 613], [869, 620], 2.88, LEFT, 23);
  castPlane(foreground, [[862, 646], [880, 649], [884, 685], [879, 698], [869, 684]], 2.95, LEFT);
  castPlane(foreground, [[879, 698], [891, 708], [912, 768], [907, 779], [889, 768]], 2.67, LEFT);
  castPlane(foreground, [[884, 697], [912, 710], [926, 754], [916, 762]], 1.95, RIGHT);
  // Two sockets have interior bevels. These are functional holes, not texture.
  for (const [x, y] of [[844, 457], [899, 554]] as const) {
    foreground.poly([[x, y], [x + 5, y + 1], [x + 5, y + 7], [x, y + 5]], ink('concrete', 1.8, LEFT));
    foreground.line([[x, y + 5], [x + 4, y + 6]], ink('concrete', 3.02, UP), 1);
  }
  foreground.line([[837, 643], [837, 624], [878, 609], [879, 631]], ink('steel', 1.66), 4);
  foreground.line([[838, 623], [867, 612]], ink('steel', 3.48), 1);
  foreground.line([[854, 619], [854, 638]], ink('steel', 2.4), 2);
  foreground.rect(832, 643, 9, 3, ink('steel', 2.55, UP));
  foreground.rect(873, 632, 9, 3, ink('steel', 2.55, UP));

  const approach = new PixelLayer('approach-mouth');
  castPlane(approach, [[253, 743], [417, 697], [420, 723], [316, 788], [253, 788]], 2.39, FRONT, [253, 743], 'concrete', .65);
  castPlane(approach, [[253, 739], [416, 693], [420, 699], [254, 748]], 3.13, UP);
  approach.poly([[253, 748], [420, 699], [420, 703], [253, 752]], { ...ink('concrete', 1.71, FRONT), occlusion: .55 });
  approach.line([[253, 715], [411, 662], [411, 692]], ink('steel', 1.6), 3);
  approach.line([[253, 713], [322, 690]], ink('steel', 3.4), 1);
  approach.line([[354, 680], [411, 660]], ink('steel', 3.07), 1);
  for (const [x, y] of [[281, 705], [322, 691], [364, 677]] as const) approach.line([[x, y], [x, y + 29]], ink('steel', 2.2), 2);
  paving(approach, [[417, 708], [472, 681], [550, 703], [445, 788], [290, 788]], 3.2, [417, 708], [86, 22], [-76, 56], .83);
  brokenConcrete(approach, [[550, 703], [582, 719], [503, 788], [445, 788]], [550, 703], [445, 788], 2.3, RIGHT, 31);
  castPlane(approach, [[422, 707], [473, 684], [483, 687], [330, 788], [315, 788]], 3.28, UP);
  approach.line([[393, 788], [521, 691], [553, 679], [555, 707]], ink('steel', 1.58), 5);
  approach.line([[453, 739], [521, 688], [553, 677]], ink('steel', 3.4), 1);
  approach.line([[393, 786], [424, 762]], ink('steel', 3.13), 1);
  approach.line([[462, 738], [462, 766]], ink('steel', 2.32), 3);
  approach.line([[504, 703], [504, 732]], ink('steel', 2.3), 3);
  // A construction crack at the parapet's actual folded corner.
  approach.line([[371, 710], [375, 719], [369, 730], [371, 742]], ink('concrete', 1.86, FRONT), 1);

  const fissure = new PixelLayer('floor-fracture');
  // A tilted piece of the wearing bed has dropped into an asymmetric opening.
  // Three main failures replace the radial black star without changing C's site.
  fissure.poly([[620, 652], [637, 649], [647, 642], [662, 646], [670, 655],
    [664, 664], [652, 672], [635, 668], [625, 663]], ink('void', .45, UP, 0));
  for (const points of [
    [[637, 652], [622, 645], [607, 647], [594, 641]],
    [[659, 649], [669, 641], [681, 639]],
    [[655, 667], [671, 684], [687, 686]],
  ] as const) fissure.line(points, ink('concrete', 1.81, UP, .5), 1);
  brokenConcrete(fissure, [[620, 652], [637, 649], [647, 642], [662, 646], [666, 652],
    [655, 650], [647, 648], [639, 657], [626, 658]], [620, 652], [662, 646], 2.78, FRONT, 8);
  castPlane(fissure, [[631, 655], [640, 651], [651, 655], [647, 661], [638, 664], [631, 661]], 3.05, [-.2, .35, .91]);
  brokenConcrete(fissure, [[631, 661], [638, 664], [647, 661], [646, 666], [638, 668], [632, 665]], [631, 661], [647, 661], 2.1, FRONT, 7);
  fissure.poly([[657, 654], [665, 653], [670, 655], [664, 664], [654, 669], [659, 663]], { ...ink('concrete', 2.1, LEFT, .5), occlusion: .77 });
  fissure.poly([[654, 669], [664, 664], [665, 668], [651, 674], [644, 671]], ink('concrete', 3.0, [0, .45, .89], .65));
  fissure.line([[628, 654], [635, 652]], ink('chalk', 3.2, UP, .8), 1);
  fissure.line([[687, 686], [697, 688]], ink('concrete', 2.7, UP, .5), 1);
  return [distance, room, ground, contacts, fissure, foreground, approach];
}

/** A local material overwrite; the platform outline and walking surface never move. */
export function buildIntrusionLayer(): PixelLayer {
  const layer = new PixelLayer('intrusion');
  const dark = ink('alien', 1, [-.7, .18, .1], .08);
  const body = ink('alien', 2, [-.45, .54, .28], .28);
  const turned = ink('alien', 3, [-.25, .8, .38], .34);
  const edge = ink('alien', 4, [-.2, .8, .55], .2);
  // The existing mortar line begins to follow a second, slightly displaced
  // register. Replacement travels through the same material rather than laying
  // identical tiles on top of it. The long body remains dull and non-emissive.
  layer.poly([[876, 446], [887, 444], [897, 448], [903, 453], [902, 466], [898, 474],
    [900, 486], [894, 498], [897, 510], [892, 523], [895, 538], [893, 549],
    [899, 559], [895, 575], [896, 588], [889, 603], [885, 606], [886, 584],
    [880, 574], [883, 558], [878, 547], [881, 532], [877, 521], [881, 509],
    [878, 498], [884, 486], [882, 474], [887, 463], [879, 459]], dark);
  layer.poly([[885, 450], [892, 449], [898, 454], [896, 466], [891, 472],
    [893, 484], [886, 497], [890, 508], [885, 521], [889, 534], [886, 547],
    [892, 559], [888, 575], [891, 587], [887, 598], [888, 580], [885, 573],
    [887, 558], [883, 548], [884, 532], [881, 521], [886, 508], [883, 499],
    [888, 485], [885, 473], [891, 462]], body);
  // One seam can still be traced through the change; its far half no longer
  // meets the near half. Narrow overhangs expose ordinary crushed stone below.
  layer.poly([[847, 443], [866, 447], [878, 445], [888, 449], [885, 454],
    [875, 450], [863, 452], [850, 447]], ink('concrete', 1, LEFT, .3));
  layer.poly([[863, 450], [875, 449], [884, 453], [881, 459], [871, 456], [863, 457]], body);
  layer.line([[850, 445], [865, 449], [874, 447]], ink('concrete', 2, LEFT, .45), 1);
  layer.line([[884, 454], [895, 450], [903, 452]], dark, 2);
  layer.line([[873, 451], [879, 454]], turned, 1);
  layer.poly([[878, 482], [884, 481], [888, 486], [884, 492], [875, 494], [872, 491]], ink('concrete', 1, LEFT, .28));
  layer.poly([[874, 484], [881, 483], [885, 487], [880, 490], [875, 489]], body);
  layer.line([[875, 488], [880, 489]], turned, 1);
  layer.poly([[879, 517], [885, 513], [891, 518], [888, 525], [880, 527], [875, 524]], ink('concrete', 1, LEFT, .2));
  layer.poly([[879, 518], [884, 517], [887, 520], [882, 524], [877, 523]], body);
  layer.line([[881, 519], [885, 520]], edge, 1);
  layer.poly([[857, 547], [870, 550], [879, 548], [887, 552], [883, 558],
    [875, 555], [869, 557], [859, 552]], ink('concrete', 1, LEFT, .25));
  layer.poly([[868, 551], [876, 551], [884, 555], [880, 559], [873, 557], [867, 556]], body);
  layer.line([[859, 549], [869, 552]], ink('concrete', 2, LEFT, .4), 1);
  layer.line([[877, 554], [882, 555]], turned, 1);
  // Only the small, turned fracture facets catch cold light. Fine discontinuities
  // follow the body without becoming an emissive crack network.
  layer.poly([[895, 466], [897, 464], [897, 469], [892, 475], [891, 472]], turned);
  layer.poly([[887, 498], [890, 495], [892, 503], [889, 508], [887, 505]], turned);
  layer.poly([[887, 535], [890, 532], [892, 539], [889, 544]], turned);
  layer.poly([[889, 568], [892, 565], [892, 571], [887, 577]], turned);
  layer.line([[896, 467], [894, 470]], edge, 1);
  layer.line([[889, 502], [890, 505]], edge, 1);
  layer.line([[889, 538], [890, 541]], body, 1);
  layer.line([[889, 576], [886, 583], [888, 589]], dark, 1);
  layer.poly([[888, 598], [891, 601], [886, 613], [877, 623], [866, 626],
    [860, 633], [856, 634], [862, 625], [873, 621], [882, 612]], dark);
  layer.line([[886, 604], [883, 613], [873, 623], [865, 625]], body, 2);
  layer.poly([[848, 638], [856, 634], [864, 635], [860, 638], [854, 640]], body);
  layer.line([[850, 638], [856, 636]], turned, 1);
  return layer;
}
