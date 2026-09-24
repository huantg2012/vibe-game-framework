import { PixelLayer, type Ink, type Point } from './raster';

const UP = [0, 0, 1] as const;
const FRONT = [0, 0.92, 0.28] as const;
const LEFT = [-0.85, 0.35, 0.18] as const;
const RIGHT = [0.9, 0.25, 0.15] as const;
const ink = (material: Ink['material'], tone: number, normal: Ink['normal'] = FRONT, light = 1): Ink => ({ material, tone, normal, light });

/** These vertices register to C. Shapes are authored material incidents, not a noise field. */
export function buildArchitectureLayers(): PixelLayer[] {
  const distance = new PixelLayer('opening-midground');
  distance.rect(253, 323, 709, 465, ink('void', 1, FRONT, 0));
  // The existing opening behind the upper ramp: one quiet recess, then remote planes.
  distance.poly([[752, 338], [832, 324], [867, 372], [873, 542], [750, 558]], ink('void', 3, FRONT, 0));
  distance.poly([[773, 358], [792, 354], [790, 500], [773, 512]], ink('concrete', 1, LEFT, 0));
  distance.poly([[792, 354], [804, 360], [802, 497], [790, 500]], ink('void', 2, RIGHT, 0));
  distance.poly([[760, 414], [831, 420], [831, 432], [760, 426]], ink('concrete', 1, UP, 0));
  distance.poly([[762, 427], [831, 433], [831, 458], [763, 450]], ink('void', 2, FRONT, 0));
  distance.line([[804, 375], [820, 375], [820, 413]], ink('void', 4, FRONT, 0), 1);

  const room = new PixelLayer('rear-masonry');
  // Rear wall plane under the roof; the recess remains deeper than the projecting piers.
  room.poly([[253, 322], [786, 331], [752, 388], [751, 477], [252, 536]], ink('concrete', 2));
  room.poly([[273, 322], [323, 323], [323, 531], [273, 532]], ink('concrete', 3));
  room.poly([[323, 323], [337, 326], [337, 523], [323, 531]], ink('concrete', 1, RIGHT));
  room.poly([[361, 326], [395, 327], [395, 521], [361, 523]], ink('chalk', 2));
  room.poly([[395, 327], [409, 330], [409, 520], [395, 521]], ink('concrete', 1, RIGHT));
  room.poly([[473, 330], [518, 334], [518, 516], [473, 515]], ink('concrete', 2));
  room.poly([[519, 334], [536, 334], [536, 514], [518, 516]], ink('void', 2, RIGHT, 0));
  room.poly([[677, 333], [706, 332], [706, 488], [677, 503]], ink('concrete', 2));
  room.poly([[706, 332], [721, 334], [721, 485], [706, 488]], ink('void', 2, RIGHT, 0));
  // Remnants of a maintained mineral coat: broad areas, exposed substrate and a few drips.
  room.poly([[274, 423], [294, 423], [294, 430], [305, 428], [306, 417], [320, 421], [320, 513], [274, 520]], ink('paint', 2));
  room.poly([[476, 452], [487, 450], [491, 459], [513, 456], [513, 511], [474, 514]], ink('paint', 1));
  room.poly([[362, 453], [372, 456], [374, 449], [390, 451], [390, 516], [362, 520]], ink('paint', 2));
  room.poly([[277, 335], [299, 338], [302, 351], [297, 358], [275, 355]], ink('chalk', 3));
  room.poly([[305, 368], [321, 366], [321, 387], [318, 391], [308, 389]], ink('chalk', 2));
  room.poly([[363, 348], [387, 349], [388, 364], [381, 367], [361, 362]], ink('chalk', 3));
  room.poly([[608, 337], [667, 340], [662, 369], [642, 377], [637, 368], [611, 367]], ink('concrete', 1));
  // Formwork seams and wall service line, placed sparingly instead of all-over weathering.
  room.line([[274, 392], [321, 394]], ink('concrete', 1), 1);
  room.line([[274, 395], [300, 395]], ink('chalk', 3), 1);
  room.line([[366, 416], [392, 416]], ink('concrete', 1), 1);
  room.line([[493, 352], [489, 370], [495, 380], [492, 396]], ink('void', 2), 1);
  room.line([[285, 341], [285, 377], [281, 380], [281, 413]], ink('concrete', 2), 1);
  room.line([[681, 377], [689, 377], [689, 456]], ink('steel', 1), 3);
  room.line([[688, 384], [688, 443]], ink('steel', 3), 1);
  for (const y of [391, 432]) {
    room.rect(683, y, 13, 4, ink('steel', 2));
    room.rect(684, y, 3, 2, ink('rust', 3));
  }
  // Overhead roof underside and its successive corbels (positions belong to C).
  room.poly([[253, 323], [787, 323], [786, 335], [716, 347], [611, 340], [517, 335], [420, 329]], ink('void', 1, UP, 0));
  room.poly([[617, 324], [648, 326], [648, 339], [625, 340], [615, 335]], ink('concrete', 1, FRONT));
  room.poly([[697, 326], [730, 324], [729, 337], [706, 342], [697, 338]], ink('concrete', 2, FRONT));
  room.line([[626, 340], [644, 339]], ink('concrete', 3), 1);

  // Exposed coat edges, not surface-wide grit. These incidents sit at actual peeling boundaries.
  for (const [x, y] of [[277, 424], [289, 427], [303, 433], [312, 420], [278, 455], [300, 487], [315, 505], [369, 456], [387, 453], [477, 458], [508, 460]] as const) {
    room.poly([[x, y], [x + 5, y - 2], [x + 8, y + 1], [x + 6, y + 4], [x + 2, y + 3]], ink('concrete', 3));
    room.rect(x + 7, y + 6, 2, 3, ink('chalk', 2));
  }
  room.poly([[277, 407], [282, 406], [282, 418], [280, 421], [278, 416]], ink('concrete', 2));
  room.poly([[312, 348], [317, 349], [317, 366], [314, 362]], ink('concrete', 2));
  room.line([[278, 482], [288, 483]], ink('paint', 1), 1);
  room.line([[302, 468], [317, 469]], ink('paint', 1), 1);
  room.line([[365, 485], [379, 486]], ink('paint', 1), 1);
  room.rect(282, 405, 3, 3, ink('chalk', 4));
  room.rect(370, 442, 2, 4, ink('chalk', 3));

  const ground = new PixelLayer('floor-and-upper-platform');
  // Main walking surface, rear ledge, and their thickness use the locked C perimeter.
  ground.poly([[253, 580], [441, 553], [626, 571], [774, 601], [877, 613], [889, 645], [775, 688], [679, 715], [710, 724], [650, 741], [550, 716], [496, 730], [408, 701], [254, 730]], ink('concrete', 3, UP));
  ground.poly([[710, 724], [650, 741], [649, 776], [678, 766], [707, 757]], ink('concrete', 1, FRONT, 0.3));
  ground.poly([[775, 688], [889, 645], [887, 680], [776, 719], [710, 746], [710, 724], [679, 715]], ink('concrete', 2, LEFT, 0.35));
  ground.poly([[650, 741], [624, 733], [622, 781], [647, 788]], ink('void', 2, RIGHT, 0));
  // Sparse large slabs; slightly changing level is a material choice, never random RGB.
  const slabs: readonly (readonly Point[])[] = [
    [[268, 614], [326, 593], [384, 605], [338, 631]],
    [[433, 630], [491, 603], [555, 620], [504, 648]],
    [[558, 620], [627, 599], [689, 615], [634, 641]],
    [[647, 646], [701, 624], [756, 637], [704, 659]],
    [[518, 650], [577, 625], [637, 644], [581, 669]],
    [[592, 673], [646, 650], [700, 664], [648, 688]],
    [[695, 689], [752, 666], [799, 677], [748, 696]],
    [[365, 670], [411, 646], [469, 661], [426, 686]],
  ];
  for (const [i, points] of slabs.entries()) {
    ground.poly(points, ink('concrete', i === 3 || i === 6 ? 2 : 3, UP));
    const a = points[0]!; const b = points[1]!; const c = points[2]!;
    ground.line([a, b, c], ink('concrete', 2, UP), 1);
  }
  for (const points of [
    [[255, 646], [302, 625], [351, 642]],
    [[312, 674], [351, 654], [408, 670]],
    [[501, 678], [550, 654]],
    [[752, 665], [827, 638], [873, 645]],
    [[594, 703], [649, 679]],
  ] as const) ground.line(points, ink('concrete', 2, UP), 1);
  // Repairs around the core plinth, with a few worn contacts at human scale.
  ground.poly([[284, 625], [308, 615], [329, 622], [346, 636], [324, 641], [311, 637], [298, 640]], ink('chalk', 3, UP));
  ground.poly([[450, 641], [469, 632], [484, 635], [484, 642], [461, 652], [450, 649]], ink('chalk', 3, UP));
  ground.poly([[528, 600], [548, 593], [566, 598], [562, 603], [543, 608]], ink('chalk', 2, UP));
  ground.line([[295, 629], [307, 625], [317, 628]], ink('chalk', 4, UP), 1);
  ground.line([[458, 645], [474, 639]], ink('chalk', 4, UP), 1);
  ground.poly([[794, 654], [799, 650], [819, 643], [821, 649], [806, 655]], ink('concrete', 4, UP));
  ground.poly([[715, 703], [727, 700], [734, 702], [726, 706]], ink('chalk', 3, UP));
  // Maintenance wear is restricted to the existing short working route.
  for (const [x, y, w] of [[482, 614, 11], [511, 622, 7], [548, 627, 10], [588, 617, 6], [603, 638, 9], [773, 649, 8]] as const) {
    ground.line([[x, y], [x + w, y - 3]], ink('chalk', 3, UP), 1);
  }
  // A small vocabulary of authored aggregate clusters concentrated at repairs and broken edges.
  for (const [x, y] of [[287, 625], [301, 635], [317, 626], [326, 637], [346, 638],
    [453, 642], [460, 650], [475, 633], [483, 638], [508, 648], [543, 603],
    [597, 644], [610, 650], [634, 675], [665, 678], [688, 674], [704, 694],
    [744, 689], [766, 685], [793, 661], [804, 652], [826, 645]] as const) {
    ground.poly([[x, y], [x + 4, y - 2], [x + 7, y], [x + 3, y + 2]], ink('concrete', 2, UP));
    ground.line([[x + 1, y + 2], [x + 5, y + 1]], ink('chalk', 3, UP), 1);
    ground.rect(x + 9, y + 3, 2, 2, ink('chalk', 3, UP));
  }
  ground.poly([[484, 601], [501, 596], [519, 600], [514, 604], [503, 603], [495, 606]], ink('concrete', 2, UP));
  ground.line([[489, 603], [496, 601]], ink('chalk', 3, UP), 1);
  ground.line([[478, 653], [495, 646], [501, 648]], ink('concrete', 2, UP), 1);
  ground.poly([[757, 678], [764, 674], [773, 675], [777, 679], [770, 682], [764, 680]], ink('chalk', 3, UP));
  // C's raised rear platform: broad top, thick vertical face, and a deep right undercroft.
  ground.poly([[253, 513], [352, 501], [480, 505], [532, 506], [628, 522], [671, 512], [675, 572], [625, 604], [475, 583], [346, 576], [253, 591]], ink('concrete', 2, FRONT));
  ground.poly([[253, 513], [352, 501], [480, 505], [532, 506], [628, 522], [663, 509], [674, 513], [631, 540], [527, 525], [474, 519], [351, 519], [253, 536]], ink('concrete', 4, UP));
  ground.poly([[263, 537], [329, 525], [329, 575], [314, 579], [262, 585]], ink('chalk', 2));
  ground.poly([[488, 525], [540, 532], [540, 588], [487, 581]], ink('concrete', 3));
  ground.poly([[545, 533], [608, 543], [608, 598], [545, 590]], ink('paint', 2));
  ground.poly([[548, 557], [560, 559], [563, 564], [574, 563], [580, 569], [604, 571], [604, 590], [550, 582]], ink('paint', 3));
  ground.line([[533, 527], [533, 587]], ink('concrete', 1), 1);
  ground.line([[579, 535], [579, 540]], ink('chalk', 4), 1);
  ground.line([[615, 538], [615, 600]], ink('concrete', 1), 1);
  ground.line([[486, 522], [506, 525]], ink('chalk', 5, UP), 1);
  ground.line([[546, 532], [572, 536]], ink('chalk', 5, UP), 1);
  ground.poly([[626, 543], [640, 539], [634, 548], [625, 549]], ink('chalk', 3));
  ground.line([[618, 599], [621, 580], [619, 564], [627, 546]], ink('void', 2), 1);
  for (const [x, y] of [[490, 528], [514, 530], [555, 541], [571, 544], [592, 553], [604, 544], [633, 535]] as const) {
    ground.poly([[x, y], [x + 5, y], [x + 8, y + 3], [x + 6, y + 7], [x + 1, y + 5]], ink('chalk', 3));
    ground.rect(x + 3, y + 8, 2, 3, ink('concrete', 1));
  }
  ground.line([[544, 586], [553, 587]], ink('concrete', 1), 1);
  ground.line([[578, 593], [601, 596]], ink('concrete', 1), 1);
  ground.poly([[672, 517], [823, 461], [823, 587], [749, 607], [682, 570]], ink('void', 1, RIGHT, 0));
  // The upper ramp rises back/right, exactly the perspective which A revisions lost.
  ground.poly([[630, 530], [736, 452], [821, 454], [700, 544]], ink('concrete', 3, [0.12, -0.28, 0.95]));
  ground.poly([[700, 544], [821, 454], [821, 466], [705, 556]], ink('concrete', 1, RIGHT, 0.35));
  ground.poly([[632, 530], [737, 452], [746, 455], [641, 535]], ink('chalk', 4, UP));
  ground.poly([[689, 538], [796, 458], [810, 457], [700, 541]], ink('concrete', 4, UP));
  for (const points of [
    [[653, 514], [676, 518], [716, 523]],
    [[677, 496], [701, 499], [741, 504]],
    [[703, 477], [727, 480], [767, 484]],
  ] as const) ground.line(points, ink('concrete', 1, UP), 1);
  ground.line([[651, 532], [751, 458]], ink('concrete', 2, UP), 1);
  ground.line([[668, 519], [733, 471]], ink('chalk', 4, UP), 1);
  ground.poly([[736, 451], [760, 438], [823, 440], [823, 454]], ink('concrete', 3, UP));
  // Thin, load-bearing guard, quiet against the dark opening.
  ground.line([[759, 439], [759, 422], [824, 431]], ink('steel', 1), 3);
  for (const x of [777, 800, 822]) ground.line([[x, 426 + (x - 777) * 0.13], [x, 449]], ink('steel', 2), 2);
  ground.line([[759, 422], [813, 429]], ink('steel', 4), 1);

  const contacts = new PixelLayer('contact-shadows');
  contacts.ellipse(383, 615, 118, 18, ink('concrete', 1, UP, 0));
  contacts.ellipse(383, 612, 99, 13, ink('void', 1, UP, 0));
  contacts.ellipse(586, 516, 66, 9, ink('concrete', 1, UP, 0));
  contacts.poly([[645, 597], [734, 613], [771, 632], [694, 638], [616, 613]], ink('concrete', 2, UP, 0));
  contacts.ellipse(674, 614, 74, 9, ink('concrete', 1, UP, 0));

  const foreground = new PixelLayer('right-wall-and-front-edge');
  // Near right wall: an irregular break at the top, a broad face and a much darker return.
  foreground.poly([[838, 323], [887, 323], [887, 361], [906, 377], [909, 664], [927, 695], [950, 785], [887, 785], [879, 743], [860, 692], [850, 619], [837, 615], [837, 414], [822, 399], [823, 374], [813, 364], [820, 343]], ink('concrete', 2, LEFT, 0.7));
  foreground.poly([[887, 323], [919, 323], [926, 341], [935, 341], [935, 727], [960, 788], [951, 788], [928, 698], [910, 664], [906, 377], [887, 361]], ink('void', 2, RIGHT, 0.1));
  foreground.poly([[821, 343], [838, 340], [846, 354], [839, 369], [826, 374], [813, 364]], ink('chalk', 3, LEFT));
  foreground.poly([[824, 378], [840, 383], [840, 398], [833, 400], [822, 390]], ink('concrete', 3, LEFT));
  foreground.poly([[838, 414], [863, 420], [863, 600], [849, 600], [848, 583], [839, 580]], ink('concrete', 3, LEFT, 0.8));
  foreground.poly([[866, 469], [889, 474], [891, 602], [878, 612], [863, 601], [864, 527], [870, 517]], ink('paint', 1, LEFT));
  foreground.poly([[866, 482], [879, 486], [879, 495], [888, 499], [888, 584], [882, 582], [883, 598], [866, 594]], ink('paint', 2, LEFT));
  foreground.poly([[838, 602], [861, 607], [871, 621], [867, 639], [847, 637]], ink('chalk', 2, LEFT));
  foreground.poly([[862, 646], [880, 649], [884, 685], [879, 698], [869, 684]], ink('concrete', 3, LEFT));
  foreground.poly([[890, 727], [906, 731], [916, 762], [911, 767], [899, 753]], ink('concrete', 3, LEFT));
  for (const points of [
    [[839, 442], [880, 450], [904, 445]],
    [[842, 549], [862, 553]],
    [[874, 632], [907, 637]],
    [[889, 711], [912, 716]],
  ] as const) foreground.line(points, ink('concrete', 1, LEFT), 1);
  foreground.line([[864, 433], [871, 451], [868, 467]], ink('void', 2, LEFT), 1);
  foreground.line([[841, 416], [841, 471]], ink('chalk', 4, LEFT), 1);
  foreground.line([[850, 606], [865, 611]], ink('chalk', 4, LEFT), 1);
  for (const [x, y] of [[823, 353], [832, 368], [832, 381], [840, 407], [851, 422], [867, 478], [882, 494], [867, 566], [880, 593], [849, 613], [865, 628], [879, 673]] as const) {
    foreground.poly([[x, y], [x + 5, y + 1], [x + 6, y + 5], [x + 2, y + 8], [x, y + 5]], ink('concrete', 3, LEFT));
    foreground.line([[x + 1, y + 1], [x + 4, y + 2]], ink('chalk', 4, LEFT), 1);
  }
  foreground.line([[852, 481], [852, 501], [854, 507]], ink('concrete', 2, LEFT), 1);
  foreground.line([[877, 574], [877, 583]], ink('paint', 1, LEFT), 1);
  // Existing railing and its two bolted shoes.
  foreground.line([[837, 643], [837, 624], [878, 609], [879, 631]], ink('steel', 1), 4);
  foreground.line([[838, 623], [879, 608]], ink('steel', 4), 1);
  foreground.line([[854, 619], [854, 638]], ink('steel', 2), 2);
  foreground.rect(832, 643, 9, 3, ink('steel', 2, UP));
  foreground.rect(873, 632, 9, 3, ink('steel', 2, UP));
  foreground.rect(874, 632, 3, 2, ink('rust', 3, UP));

  const approach = new PixelLayer('approach-mouth');
  // The left approach parapet remains a solid face below C's existing railing.
  approach.poly([[253, 743], [417, 697], [420, 723], [316, 788], [253, 788]], ink('concrete', 1, FRONT, 0.25));
  approach.poly([[253, 739], [416, 693], [420, 699], [254, 748]], ink('concrete', 3, UP));
  approach.line([[253, 715], [411, 662], [411, 692]], ink('steel', 1), 3);
  approach.line([[253, 713], [411, 660]], ink('steel', 4), 1);
  for (const [x, y] of [[281, 705], [322, 691], [364, 677]] as const) {
    approach.line([[x, y], [x, y + 29]], ink('steel', 2), 2);
  }
  approach.poly([[417, 708], [472, 681], [550, 703], [445, 788], [290, 788]], ink('concrete', 3, UP));
  approach.poly([[550, 703], [582, 719], [503, 788], [445, 788]], ink('concrete', 1, RIGHT, 0.2));
  approach.poly([[422, 707], [473, 684], [483, 687], [330, 788], [315, 788]], ink('concrete', 4, UP));
  approach.line([[386, 763], [470, 783]], ink('concrete', 2, UP), 1);
  approach.line([[420, 736], [504, 754]], ink('concrete', 2, UP), 1);
  approach.line([[449, 714], [529, 732]], ink('concrete', 2, UP), 1);
  approach.line([[393, 788], [521, 691], [553, 679], [555, 707]], ink('steel', 1), 5);
  approach.line([[393, 786], [521, 688], [553, 677]], ink('steel', 4), 1);
  approach.line([[462, 738], [462, 766]], ink('steel', 2), 3);
  approach.line([[504, 703], [504, 732]], ink('steel', 2), 3);
  // C's floor fracture stays flat. Sparse branching with discrete broken stone tips.
  const fissure = new PixelLayer('floor-fracture');
  fissure.poly([[620, 651], [643, 649], [651, 639], [656, 652], [680, 650], [666, 659], [685, 668], [662, 665], [654, 675], [644, 665], [625, 675], [630, 662], [604, 665]], ink('void', 0, UP, 0));
  for (const points of [
    [[643, 653], [622, 643], [607, 647], [594, 641]],
    [[651, 646], [661, 635], [681, 632]],
    [[670, 659], [697, 659], [713, 650]],
    [[647, 666], [631, 683], [616, 685]],
    [[660, 666], [675, 684], [697, 688]],
    [[625, 660], [601, 655], [578, 660]],
  ] as const) fissure.line(points, ink('void', 0, UP, 0), 2);
  fissure.line([[607, 646], [619, 643]], ink('chalk', 4, UP), 1);
  fissure.line([[680, 667], [697, 668]], ink('concrete', 4, UP), 1);
  return [distance, room, ground, contacts, fissure, foreground, approach];
}

/** A local material overwrite; the platform outline and walking surface never move. */
export function buildIntrusionLayer(): PixelLayer {
  const layer = new PixelLayer('intrusion');
  const dark = ink('alien', 1, LEFT, 0);
  const body = ink('alien', 2, LEFT, 0);
  const edge = ink('alien', 4, LEFT, 0);
  // A regular foreign cadence takes ownership of one pre-existing masonry seam.
  layer.poly([[869, 448], [904, 443], [905, 480], [891, 482], [891, 462], [869, 467]], dark);
  layer.poly([[878, 450], [904, 448], [904, 454], [885, 457], [885, 472], [878, 474]], body);
  layer.line([[887, 451], [904, 450]], edge, 1);
  layer.poly([[876, 480], [904, 476], [905, 507], [891, 509], [891, 491], [877, 494]], dark);
  layer.poly([[884, 482], [904, 480], [904, 485], [891, 488]], body);
  layer.poly([[876, 514], [904, 510], [905, 541], [891, 543], [891, 525], [877, 528]], dark);
  layer.line([[889, 516], [902, 514]], edge, 1);
  layer.poly([[879, 548], [904, 544], [905, 575], [891, 577], [891, 559], [880, 562]], dark);
  layer.line([[889, 550], [902, 548]], body, 2);
  // A restrained continuation along the existing pressure interface, not a neon crack net.
  layer.line([[890, 578], [886, 611], [872, 624], [860, 624], [858, 636]], body, 2);
  layer.poly([[845, 638], [856, 634], [866, 636], [854, 641]], dark);
  layer.line([[846, 638], [852, 636]], edge, 1);
  return layer;
}
