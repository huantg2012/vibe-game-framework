import { PixelLayer, type Ink, type Point } from './raster';
import { paintApproach, paintFloorAndLedge, paintMasonry, paintNearMasonry } from './surface-paint';

const UP = [0, 0, 1] as const;
const FRONT = [0, 0.92, 0.28] as const;
const LEFT = [-0.85, 0.35, 0.18] as const;
const RIGHT = [0.9, 0.25, 0.15] as const;
const ink = (material: Ink['material'], tone: number, normal: Ink['normal'] = FRONT, light = 1): Ink => ({ material, tone, normal, light });

/** These vertices register to C. Shapes are authored material incidents, not a noise field. */
export function buildArchitectureLayers(): PixelLayer[] {
  const distance = new PixelLayer('opening-midground');
  distance.rect(253, 323, 709, 465, ink('void', 1, FRONT, 0));
  // Three overlapping depths in the existing opening. Empty strips separate the masses.
  distance.poly([[752, 338], [832, 324], [867, 372], [873, 542], [750, 558]], ink('void', 3, FRONT, 0));
  distance.poly([[799, 345], [829, 339], [852, 367], [853, 524], [832, 530], [831, 379], [799, 374]], ink('void', 2, FRONT, 0));
  distance.poly([[834, 382], [850, 377], [850, 509], [838, 516]], ink('concrete', 1, LEFT, 0));
  distance.poly([[789, 388], [812, 383], [813, 402], [801, 407], [790, 404]], ink('void', 1, FRONT, 0));
  distance.poly([[810, 403], [824, 398], [824, 467], [815, 476]], ink('void', 2, RIGHT, 0));
  distance.poly([[805, 462], [832, 455], [847, 459], [821, 471], [806, 471]], ink('concrete', 1, UP, 0));
  distance.poly([[806, 471], [821, 471], [847, 459], [845, 470], [825, 481], [807, 480]], ink('void', 1, FRONT, 0));
  distance.poly([[773, 358], [792, 354], [790, 500], [773, 512]], ink('concrete', 1, LEFT, 0));
  distance.poly([[792, 354], [804, 360], [802, 497], [790, 500]], ink('void', 2, RIGHT, 0));
  distance.poly([[776, 361], [780, 360], [781, 385], [778, 397], [778, 447], [775, 450]], ink('concrete', 2, LEFT, 0));
  distance.poly([[778, 478], [785, 476], [785, 499], [779, 504]], ink('void', 2, LEFT, 0));
  distance.poly([[760, 414], [831, 420], [831, 432], [760, 426]], ink('concrete', 1, UP, 0));
  distance.poly([[762, 427], [831, 433], [831, 458], [763, 450]], ink('void', 2, FRONT, 0));
  distance.line([[766, 416], [787, 418]], ink('concrete', 2, UP, 0), 1);
  distance.line([[787, 373], [787, 390]], ink('concrete', 2, LEFT, 0), 1);
  distance.line([[813, 488], [822, 486], [835, 489]], ink('void', 2, FRONT, 0), 2);

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
  room.line([[493, 352], [490, 365], [493, 374]], ink('concrete', 1), 1);
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

  // Old lime coat survives in connected sheets. The exposed pockets have weight,
  // not a repeated fleck pattern; their lower edges carry the loosened material.
  room.poly([[416, 341], [458, 343], [462, 357], [457, 367], [461, 384], [456, 403], [448, 409], [447, 438], [437, 450], [418, 447]], ink('chalk', 2, FRONT, .72));
  room.poly([[419, 342], [445, 344], [445, 349], [453, 350], [457, 361], [451, 371], [454, 384], [447, 397], [438, 399], [439, 413], [429, 419], [419, 416]], ink('concrete', 3, FRONT, .65));
  room.poly([[421, 421], [429, 425], [438, 423], [438, 440], [431, 444], [421, 441]], ink('concrete', 2, FRONT, .58));
  room.poly([[452, 377], [457, 381], [455, 390], [449, 393], [447, 390]], ink('concrete', 1, FRONT, .55));
  room.line([[451, 373], [452, 380], [449, 386]], ink('chalk', 3, FRONT, .7), 1);
  room.line([[424, 440], [431, 442], [437, 438]], ink('chalk', 3, FRONT, .7), 1);
  room.poly([[547, 351], [599, 353], [605, 361], [602, 375], [610, 383], [611, 407], [601, 413], [600, 432], [580, 438], [559, 430], [546, 434]], ink('concrete', 3, FRONT, .65));
  room.poly([[550, 354], [575, 355], [580, 361], [584, 361], [582, 377], [586, 386], [583, 398], [570, 399], [568, 412], [554, 415], [550, 411]], ink('chalk', 2, FRONT, .65));
  room.poly([[590, 365], [601, 365], [597, 379], [603, 390], [600, 399], [591, 394]], ink('concrete', 2, FRONT, .55));
  room.poly([[550, 446], [566, 441], [579, 445], [585, 441], [601, 445], [605, 460], [594, 466], [575, 461], [558, 469], [550, 466]], ink('paint', 1, FRONT, .75));
  room.poly([[555, 448], [563, 446], [570, 449], [578, 448], [574, 454], [563, 455], [558, 460], [555, 457]], ink('paint', 2, FRONT, .8));
  room.poly([[617, 391], [640, 387], [657, 392], [670, 389], [670, 423], [660, 428], [641, 424], [624, 431], [616, 423]], ink('concrete', 2, FRONT, .62));
  room.poly([[625, 433], [640, 429], [653, 433], [658, 431], [667, 436], [665, 450], [648, 451], [638, 446], [625, 451]], ink('chalk', 2, FRONT, .58));
  // Only the opening joint leaks from the roof. A second, much shorter stain
  // begins at the service-pipe collar; the other bays have no copied drip motif.
  room.poly([[737, 344], [747, 344], [745, 370], [739, 382], [740, 415], [736, 421]], ink('void', 2, FRONT, .1));
  room.line([[731, 370], [730, 385]], ink('concrete', 1, FRONT, .3), 1);
  room.poly([[694, 436], [698, 436], [697, 444], [699, 449], [697, 460], [694, 450]], ink('concrete', 1, FRONT, .5));
  // Interrupted formwork joints and old repair plugs: a human maintenance history.
  room.line([[417, 391], [437, 392]], ink('concrete', 1, FRONT, .7), 1);
  room.line([[444, 393], [471, 394]], ink('concrete', 1, FRONT, .65), 1);
  room.line([[539, 413], [564, 414], [567, 416]], ink('concrete', 1, FRONT, .5), 1);
  room.line([[590, 418], [616, 420], [624, 418]], ink('concrete', 1, FRONT, .6), 1);
  room.line([[554, 418], [564, 419]], ink('chalk', 3, FRONT, .6), 1);
  room.line([[634, 477], [646, 475], [669, 476]], ink('concrete', 1, FRONT, .65), 1);
  for (const [x, y] of [[342, 402], [426, 470], [451, 356], [546, 397], [599, 481], [665, 359]] as const) {
    room.rect(x, y, 5, 4, ink('concrete', 1, FRONT, .55));
    room.line([[x, y + 4], [x + 3, y + 4]], ink('chalk', 2, FRONT, .7), 1);
  }
  room.poly([[274, 473], [281, 471], [287, 475], [286, 483], [280, 486], [275, 481]], ink('concrete', 2));
  room.poly([[306, 444], [313, 441], [320, 445], [317, 454], [311, 456], [305, 451]], ink('chalk', 2));
  room.line([[307, 455], [312, 458], [318, 455]], ink('paint', 1), 1);
  room.line([[281, 488], [281, 500]], ink('concrete', 2), 1);
  room.poly([[365, 467], [370, 463], [379, 465], [378, 471], [385, 476], [382, 483], [369, 480]], ink('chalk', 2));
  room.line([[369, 481], [375, 484], [381, 482]], ink('concrete', 1), 1);
  room.poly([[481, 473], [489, 469], [495, 475], [494, 482], [503, 486], [501, 493], [487, 491]], ink('concrete', 2));
  room.line([[484, 494], [493, 496]], ink('chalk', 3), 1);

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
  // Aggregate occurs at four worn incidents. Isolated intact slabs stay quiet.
  for (const [x, y, length] of [[289, 627, 5], [298, 631, 4], [312, 634, 6], [325, 633, 3],
    [453, 642, 4], [461, 648, 7], [472, 643, 3], [482, 640, 4],
    [632, 674, 3], [637, 677, 5], [646, 683, 3], [660, 682, 6],
    [793, 655, 5], [801, 652, 3], [809, 650, 4], [816, 646, 3]] as const) {
    ground.line([[x, y], [x + length, y - 1]], ink('concrete', 2, UP, .85), 1);
  }
  ground.poly([[306, 636], [311, 634], [315, 636], [312, 638]], ink('chalk', 4, UP));
  ground.poly([[466, 645], [471, 643], [476, 644], [472, 646]], ink('chalk', 4, UP));
  ground.line([[641, 679], [645, 678]], ink('chalk', 3, UP), 1);
  ground.line([[801, 656], [808, 653]], ink('chalk', 3, UP), 1);
  ground.poly([[484, 601], [501, 596], [519, 600], [514, 604], [503, 603], [495, 606]], ink('concrete', 2, UP));
  ground.line([[489, 603], [496, 601]], ink('chalk', 3, UP), 1);
  ground.line([[478, 653], [495, 646], [501, 648]], ink('concrete', 2, UP), 1);
  ground.poly([[757, 678], [764, 674], [773, 675], [777, 679], [770, 682], [764, 680]], ink('chalk', 3, UP));
  // Broad paving joints share C's two ground directions. Near joints open and
  // chip; toward the raised platform only short, low-contrast traces survive.
  ground.line([[350, 642], [387, 622], [417, 629]], ink('concrete', 2, UP, .8), 1);
  ground.line([[333, 652], [366, 660], [374, 665]], ink('concrete', 2, UP, .9), 1);
  ground.line([[427, 687], [460, 670], [481, 676], [519, 686]], ink('concrete', 2, UP), 2);
  ground.line([[430, 689], [445, 681]], ink('chalk', 3, UP), 1);
  ground.line([[486, 678], [505, 683]], ink('concrete', 4, UP, .9), 1);
  ground.line([[530, 706], [566, 689], [595, 697], [616, 693]], ink('concrete', 2, UP), 2);
  ground.line([[549, 699], [560, 694]], ink('chalk', 4, UP), 1);
  ground.line([[586, 697], [594, 699]], ink('concrete', 4, UP), 1);
  ground.line([[651, 706], [675, 695], [701, 702]], ink('concrete', 2, UP), 1);
  ground.line([[696, 628], [709, 623]], ink('concrete', 2, UP, .6), 1);
  ground.line([[769, 652], [785, 646]], ink('concrete', 2, UP, .55), 1);
  ground.poly([[363, 660], [370, 659], [378, 662], [374, 666], [368, 665]], ink('concrete', 2, UP));
  ground.line([[366, 666], [371, 668]], ink('chalk', 3, UP), 1);
  ground.poly([[560, 690], [566, 687], [574, 691], [569, 695], [563, 694]], ink('concrete', 2, UP));
  ground.line([[564, 695], [570, 696]], ink('chalk', 4, UP), 1);
  // The short route from the mouth to the devices has rubbed broad, incomplete
  // islands into the stone, with fine abrasion only inside those worn regions.
  ground.poly([[462, 663], [481, 651], [507, 649], [523, 652], [518, 657], [503, 658], [495, 664], [479, 664], [470, 668]], ink('chalk', 3, UP, .92));
  ground.poly([[497, 624], [510, 619], [527, 621], [530, 625], [521, 630], [510, 628], [506, 631]], ink('concrete', 4, UP, .78));
  ground.poly([[539, 642], [554, 635], [568, 634], [582, 638], [578, 642], [566, 640], [557, 646], [547, 645]], ink('chalk', 3, UP, .82));
  ground.poly([[687, 677], [708, 667], [722, 669], [724, 673], [711, 678], [704, 677], [698, 681]], ink('concrete', 3, UP, .68));
  ground.line([[469, 662], [477, 658], [484, 658]], ink('concrete', 3, UP), 1);
  ground.line([[487, 661], [496, 656]], ink('concrete', 3, UP), 1);
  ground.line([[506, 653], [514, 653]], ink('concrete', 2, UP), 1);
  ground.line([[546, 642], [552, 639]], ink('concrete', 2, UP, .8), 1);
  ground.line([[561, 637], [568, 637]], ink('concrete', 3, UP), 1);
  ground.line([[704, 676], [714, 672]], ink('concrete', 2, UP, .8), 1);
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
  // The raised platform is built from heavy courses, with a worn cap over a
  // stained vertical bearing face. Fine edges stop before the recess.
  ground.poly([[492, 536], [503, 538], [505, 548], [519, 550], [522, 566], [516, 573], [493, 569]], ink('chalk', 2, FRONT, .8));
  ground.poly([[499, 541], [505, 543], [505, 552], [513, 556], [511, 559], [499, 557]], ink('concrete', 2, FRONT, .8));
  ground.line([[490, 559], [502, 560], [515, 564], [538, 566]], ink('concrete', 1, FRONT, .65), 1);
  ground.line([[490, 562], [498, 563]], ink('chalk', 3), 1);
  ground.poly([[550, 544], [559, 545], [557, 553], [564, 557], [561, 561], [550, 556]], ink('concrete', 2));
  ground.poly([[580, 547], [594, 550], [598, 557], [591, 563], [584, 560]], ink('concrete', 2));
  ground.poly([[597, 578], [604, 579], [604, 590], [592, 587]], ink('concrete', 1));
  ground.line([[549, 577], [565, 580], [573, 578]], ink('paint', 1), 1);
  ground.line([[581, 569], [586, 571], [586, 581]], ink('paint', 1), 1);
  ground.poly([[518, 578], [526, 579], [531, 583], [537, 582], [539, 587], [520, 584]], ink('concrete', 1, FRONT, .45));
  ground.line([[507, 528], [518, 529]], ink('concrete', 3, UP), 1);
  ground.line([[547, 529], [561, 531], [565, 533]], ink('concrete', 2, UP), 1);
  ground.line([[581, 537], [592, 539]], ink('chalk', 4, UP), 1);
  ground.poly([[672, 517], [823, 461], [823, 587], [749, 607], [682, 570]], ink('void', 1, RIGHT, 0));
  // A partly occluded return inside the undercroft: two receding faces and the
  // unpainted-looking dark gap between them, rather than a uniformly black hole.
  ground.poly([[734, 536], [783, 506], [783, 570], [746, 590], [734, 582]], ink('concrete', 1, LEFT, .08));
  ground.poly([[783, 506], [794, 511], [794, 573], [783, 570]], ink('void', 2, RIGHT, 0));
  ground.poly([[803, 489], [816, 482], [816, 580], [803, 585]], ink('void', 2, LEFT, 0));
  ground.poly([[745, 547], [760, 538], [760, 576], [747, 583]], ink('void', 1, LEFT, 0));
  ground.line([[774, 550], [781, 546]], ink('concrete', 2, LEFT, .1), 1);
  // The upper ramp rises back/right, exactly the perspective which A revisions lost.
  ground.poly([[630, 530], [736, 452], [821, 454], [700, 544]], ink('concrete', 3, [0.12, -0.28, 0.95]));
  ground.poly([[700, 544], [821, 454], [821, 466], [705, 556]], ink('concrete', 1, RIGHT, 0.35));
  ground.poly([[632, 530], [737, 452], [746, 455], [641, 535]], ink('concrete', 3, UP));
  ground.poly([[689, 538], [796, 458], [810, 457], [700, 541]], ink('concrete', 3, UP));
  ground.line([[653, 514], [676, 518], [716, 523]], ink('concrete', 2, UP), 1);
  ground.line([[677, 496], [701, 499]], ink('concrete', 2, UP, .65), 1);
  ground.line([[716, 501], [737, 503]], ink('concrete', 2, UP, .55), 1);
  ground.line([[704, 478], [723, 480]], ink('concrete', 2, UP, .35), 1);
  ground.line([[651, 532], [682, 509]], ink('concrete', 2, UP), 1);
  ground.line([[694, 500], [713, 486]], ink('concrete', 2, UP, .7), 1);
  ground.line([[640, 529], [657, 516]], ink('chalk', 4, UP), 1);
  ground.line([[668, 517], [681, 507]], ink('concrete', 4, UP, .85), 1);
  ground.poly([[666, 515], [677, 507], [686, 509], [683, 512], [676, 511], [671, 516]], ink('chalk', 3, UP));
  ground.poly([[697, 496], [705, 490], [714, 491], [710, 495], [704, 494]], ink('concrete', 2, UP, .7));
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
  foreground.line([[841, 419], [841, 438]], ink('chalk', 4, LEFT), 1);
  foreground.line([[842, 451], [842, 459]], ink('concrete', 3, LEFT), 1);
  foreground.line([[850, 606], [865, 611]], ink('chalk', 4, LEFT), 1);
  for (const [x, y] of [[823, 353], [832, 368], [832, 381], [840, 407], [851, 422], [867, 478], [882, 494], [867, 566], [880, 593], [849, 613], [865, 628], [879, 673]] as const) {
    foreground.poly([[x, y], [x + 5, y + 1], [x + 6, y + 5], [x + 2, y + 8], [x, y + 5]], ink('concrete', 3, LEFT));
    foreground.line([[x + 1, y + 1], [x + 4, y + 2]], ink('chalk', 4, LEFT), 1);
  }
  foreground.line([[852, 481], [852, 501], [854, 507]], ink('concrete', 2, LEFT), 1);
  foreground.line([[877, 574], [877, 583]], ink('paint', 1, LEFT), 1);
  // Near masonry keeps a readable depth hierarchy: old coat, exposed mortar,
  // crushed aggregate, then a few small turned edges. Damage grows from joints.
  foreground.poly([[845, 423], [855, 426], [858, 442], [851, 451], [854, 465], [850, 481], [846, 477]], ink('chalk', 2, LEFT, .68));
  foreground.poly([[847, 425], [851, 427], [853, 439], [850, 447], [847, 443]], ink('concrete', 3, LEFT, .75));
  foreground.poly([[846, 454], [850, 457], [849, 468], [851, 473], [848, 476], [845, 468]], ink('concrete', 1, LEFT, .6));
  foreground.line([[848, 475], [851, 478]], ink('chalk', 3, LEFT), 1);
  foreground.poly([[875, 385], [885, 386], [892, 393], [894, 409], [889, 416], [890, 429], [881, 433], [876, 421]], ink('concrete', 1, LEFT, .4));
  foreground.poly([[879, 389], [884, 390], [887, 399], [884, 408], [888, 414], [883, 420], [879, 415]], ink('concrete', 2, LEFT, .5));
  foreground.line([[883, 433], [887, 444]], ink('concrete', 1, LEFT, .3), 2);
  foreground.poly([[847, 502], [852, 504], [855, 514], [853, 521], [858, 529], [857, 542], [850, 541], [847, 532]], ink('concrete', 2, LEFT, .6));
  foreground.poly([[849, 510], [852, 512], [851, 520], [853, 526], [851, 530], [848, 522]], ink('chalk', 3, LEFT, .7));
  foreground.poly([[868, 498], [872, 496], [878, 500], [876, 508], [882, 512], [883, 521], [877, 524], [869, 518]], ink('concrete', 2, LEFT, .65));
  foreground.line([[869, 519], [875, 526], [880, 526]], ink('concrete', 1, LEFT, .5), 1);
  foreground.line([[869, 496], [873, 499]], ink('chalk', 3, LEFT, .75), 1);
  foreground.poly([[867, 550], [874, 551], [875, 556], [883, 559], [882, 567], [877, 570], [879, 582], [875, 588], [868, 584]], ink('concrete', 2, LEFT, .6));
  foreground.poly([[868, 554], [871, 554], [872, 562], [877, 565], [874, 568], [869, 565]], ink('chalk', 2, LEFT, .65));
  foreground.line([[877, 572], [876, 582], [879, 588]], ink('paint', 1, LEFT, .5), 1);
  foreground.poly([[886, 544], [893, 540], [902, 541], [903, 550], [894, 551], [891, 557], [886, 555]], ink('concrete', 1, LEFT, .45));
  foreground.line([[888, 544], [894, 543]], ink('concrete', 3, LEFT, .55), 1);
  foreground.poly([[854, 613], [861, 614], [864, 620], [861, 626], [853, 625], [850, 620]], ink('concrete', 1, LEFT, .5));
  foreground.line([[851, 620], [854, 616], [859, 617]], ink('chalk', 3, LEFT), 1);
  foreground.poly([[872, 656], [879, 658], [880, 672], [876, 677], [879, 685], [873, 684]], ink('concrete', 2, LEFT, .65));
  foreground.line([[878, 676], [879, 683]], ink('chalk', 3, LEFT, .7), 1);
  // Individual aggregate grains sit inside the broken pockets, not over the wall.
  for (const [x, y, w] of [[849, 458, 2], [849, 470, 3], [875, 502, 2], [873, 508, 3],
    [879, 518, 2], [871, 559, 2], [873, 563, 3], [855, 619, 2], [859, 623, 2]] as const) {
    foreground.rect(x, y, w, 2, ink('chalk', 2, LEFT, .7));
  }
  foreground.poly([[834, 369], [838, 366], [842, 370], [843, 378], [838, 380], [834, 376]], ink('void', 2, RIGHT, .1));
  foreground.line([[834, 369], [838, 367]], ink('chalk', 3, LEFT), 1);
  foreground.line([[839, 375], [841, 377]], ink('concrete', 3, LEFT), 1);
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
  // Near mouth abrasion follows the approach. Preserve the wide quiet tread,
  // but give its exposed joint ends and the lower cast face a material scale.
  approach.poly([[383, 765], [399, 753], [414, 756], [409, 762], [402, 762], [393, 771]], ink('chalk', 3, UP));
  approach.poly([[431, 725], [443, 717], [455, 719], [453, 725], [443, 728], [437, 726]], ink('concrete', 4, UP, .85));
  approach.poly([[464, 747], [473, 742], [480, 744], [478, 749], [471, 751]], ink('concrete', 2, UP));
  approach.line([[391, 765], [399, 760]], ink('concrete', 2, UP), 1);
  approach.line([[436, 725], [443, 721]], ink('concrete', 3, UP), 1);
  approach.line([[425, 738], [437, 741]], ink('chalk', 3, UP), 1);
  approach.line([[450, 744], [460, 747]], ink('concrete', 4, UP, .7), 1);
  approach.poly([[337, 733], [359, 727], [360, 737], [351, 744], [339, 745]], ink('concrete', 2, FRONT, .3));
  approach.poly([[372, 723], [390, 718], [391, 726], [382, 733], [372, 733]], ink('concrete', 2, FRONT, .35));
  approach.line([[344, 746], [356, 742]], ink('void', 2, FRONT, .1), 1);
  approach.line([[375, 735], [384, 731]], ink('void', 2, FRONT, .1), 1);
  // The floor wound occupies exactly C's existing broken outline. Its near
  // fragments have an inner wall; the far branches disappear under intact stone.
  const fissure = new PixelLayer('floor-fracture');
  fissure.poly([[620, 651], [643, 649], [651, 639], [656, 652], [680, 650], [666, 659], [685, 668], [662, 665], [654, 675], [644, 665], [625, 675], [630, 662], [604, 665]], ink('void', 0, UP, 0));
  for (const [i, points] of ([
    [[643, 653], [622, 643], [607, 647], [594, 641]],
    [[651, 646], [661, 635], [681, 632]],
    [[670, 659], [697, 659], [713, 650]],
    [[647, 666], [631, 683], [616, 685]],
    [[660, 666], [675, 684], [697, 688]],
    [[625, 660], [601, 655], [578, 660]],
  ] as const).entries()) {
    fissure.line(points, ink('concrete', i < 2 ? 1.7 : 1.4, UP, .2), 2);
    fissure.line(points.slice(0, 2), ink(i < 2 ? 'concrete' : 'void', i < 2 ? 1 : .3, UP, 0), 2);
  }
  // A continuous far cut face descends into the wound. Branches stay narrow;
  // the centre has an actual mouth, visible stone thickness and a darker bottom.
  fissure.poly([[620, 651], [641, 648], [649, 642], [652, 651], [672, 652], [663, 658],
    [656, 657], [647, 653], [639, 657], [626, 657]], ink('concrete', 3, FRONT, .4));
  fissure.poly([[628, 656], [639, 654], [646, 651], [650, 655], [666, 655], [661, 661],
    [651, 663], [644, 660], [635, 662]], ink('void', 1, FRONT, 0));
  fissure.poly([[618, 650], [631, 646], [641, 647], [637, 650], [628, 652], [620, 653]], ink('chalk', 3, UP, .75));
  fissure.line([[621, 651], [627, 649]], ink('chalk', 4, UP, .65), 1);
  fissure.poly([[660, 650], [668, 648], [679, 649], [674, 653], [667, 654]], ink('concrete', 3, UP, .55));
  fissure.poly([[630, 662], [644, 658], [644, 665], [625, 675], [629, 668]], ink('concrete', 1, FRONT, .3));
  fissure.poly([[644, 665], [649, 661], [654, 668], [654, 675]], ink('concrete', 2, LEFT, .25));
  fissure.poly([[654, 675], [657, 665], [662, 660], [662, 665]], ink('void', 2, RIGHT, .1));
  fissure.poly([[664, 662], [674, 663], [685, 668], [673, 667]], ink('concrete', 2, FRONT, .35));
  fissure.poly([[620, 651], [632, 652], [633, 655], [625, 655]], ink('concrete', 1, FRONT, .15));
  fissure.poly([[648, 646], [651, 639], [653, 646], [650, 651]], ink('concrete', 1, RIGHT, .1));
  // Two fallen fragments interrupt the graphic star shape without widening it.
  fissure.poly([[632, 655], [641, 652], [646, 654], [640, 658], [633, 658]], ink('concrete', 2, UP, .5));
  fissure.poly([[633, 658], [640, 658], [638, 662], [633, 661]], ink('concrete', 1, FRONT, .2));
  fissure.poly([[652, 656], [657, 653], [663, 656], [659, 660], [654, 660]], ink('concrete', 2, LEFT, .45));
  fissure.poly([[654, 660], [659, 660], [657, 664], [654, 663]], ink('void', 1, FRONT, .15));
  fissure.poly([[626, 668], [635, 663], [642, 665], [638, 670], [630, 672]], ink('concrete', 3, UP, .5));
  fissure.line([[628, 668], [633, 666]], ink('chalk', 4, UP, .6), 1);
  fissure.line([[646, 665], [649, 669]], ink('chalk', 3, LEFT, .65), 1);
  fissure.line([[635, 655], [639, 654]], ink('concrete', 3, UP, .5), 1);
  fissure.line([[671, 664], [677, 666]], ink('concrete', 3, FRONT, .4), 1);
  fissure.line([[629, 681], [635, 676]], ink('concrete', 2, FRONT, .25), 1);
  fissure.line([[605, 647], [614, 644]], ink('concrete', 3, UP, .6), 1);
  paintMasonry(room);
  paintFloorAndLedge(ground);
  paintNearMasonry(foreground);
  paintApproach(approach);
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
