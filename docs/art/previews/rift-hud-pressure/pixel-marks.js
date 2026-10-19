/**
 * Art-only HUD proof. Native 32 × 40, transparent, integer pixels.
 * Palette subset: docs/art/palette.json. No production imports or state.
 * time is milliseconds; burden feedback is a one-shot envelope in [0, 1].
 */
const P = Object.freeze({
  fold: '#2c2e33', side: '#3a3d42', cloth: '#4a4e55', face: '#5a5f66',
  thread: '#8a8f96', buckle: '#c8cdd4', leather: '#50463c',
  strain: '#b89040', strainLight: '#e0a848',
  alienDark: '#0e4a3f', alien: '#1a6b5c', alienEdge: '#1aad96',
});

const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));

/** Rasterize at cell centres, then emit integer rectangles: no AA edge pixels. */
function polygon(put, points, color) {
  const yMin = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
  const yMax = Math.min(40, Math.ceil(Math.max(...points.map(p => p[1]))));
  for (let y = yMin; y < yMax; y++) {
    const intersections = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y + .5 && b[1] > y + .5) || (b[1] <= y + .5 && a[1] > y + .5)) {
        intersections.push(a[0] + (y + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      for (let x = Math.max(0, Math.ceil(intersections[i] - .5)); x < Math.min(32, Math.ceil(intersections[i + 1] - .5)); x++) put(x, y, color);
    }
  }
}

function rect(put, x, y, w, h, color) {
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) put(px, py, color);
}

function makeMark(ctx, x, y) {
  const cells = new Array(32 * 40);
  const put = (px, py, color) => {
    if (px >= 0 && px < 32 && py >= 0 && py < 40) cells[py * 32 + px] = color;
  };
  return {
    put, cells,
    finish() {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const ox = Math.round(x), oy = Math.round(y);
      for (let py = 0; py < 40; py++) {
        let px = 0;
        while (px < 32) {
          const color = cells[py * 32 + px];
          let end = px + 1;
          while (end < 32 && cells[py * 32 + end] === color) end++;
          if (color) { ctx.fillStyle = color; ctx.fillRect(ox + px, oy + py, end - px, 1); }
          px = end;
        }
      }
      ctx.restore();
    },
  };
}

export function drawBurden(ctx, x, y, ratio, time = 0, feedback = 0) {
  const r = clamp(ratio, 0, 1);
  const {put, finish} = makeMark(ctx, x, y);
  const squash = feedback > .45 ? 1 : 0;
  const left = 9 - Math.round(r * 6);
  const right = 23 + Math.round(r * 5);
  const top = 12 - Math.round(r * 4) + squash;
  const bottom = 29 + Math.round(r * 7);
  const warm = r >= .84;
  const strap = warm ? P.strain : P.thread;
  const strapFace = warm ? P.strain : P.face;

  // The carrying loop is compressed by the swelling roll beneath it.
  polygon(put, [[11,10],[11,5],[13,3],[19,3],[21,5],[21,10],[19,10],[19,6],[13,6],[13,10]], P.side);
  rect(put,13,3,6,1,P.thread);
  rect(put,11,6,1,4,P.face);

  // One coherent cloth volume; the right facet turns away from the reader.
  polygon(put, [[left+3,top],[right-4,top],[right-1,top+4],[right,top+10],
    [right,bottom-4],[right-3,bottom],[left+3,bottom],[left,bottom-4],[left,top+7]], P.cloth);
  polygon(put, [[left+3,top],[right-4,top],[right-3,top+5],[left+1,top+6]], P.face);
  polygon(put, [[right-4,top+4],[right-1,top+4],[right,top+10],[right,bottom-4],
    [right-3,bottom],[right-6,bottom-2],[right-5,top+11]], P.side);
  polygon(put, [[left+2,bottom-6],[left+6,bottom-3],[right-5,bottom-2],[right-3,bottom],
    [left+3,bottom],[left,bottom-4]], P.fold);
  // Broad fold planes, not random fabric speckles.
  polygon(put, [[left+2,top+8],[left+6,top+7],[left+5,bottom-6],[left+2,bottom-4]], P.face);
  polygon(put, [[right-8,top+10],[right-5,top+8],[right-5,bottom-6],[right-8,bottom-8]], P.fold);
  rect(put,left+3,top,Math.max(4,right-left-8),1,P.thread);

  // The lashing's profile changes from bowed slack to a straight, taut harness.
  const waist = top + 8;
  const bow = Math.round((1-r)*3);
  polygon(put, [[left+3,top+2],[left+5,top+2],[left+5-bow,waist+4],
    [left+6,bottom-3],[left+4,bottom-3],[left+3-bow,waist+4]], strapFace);
  polygon(put, [[right-6,top+2],[right-4,top+3],[right-3+bow,waist+4],
    [right-5,bottom-3],[right-7,bottom-3],[right-5+bow,waist+4]], strap);
  // Tight cross-band visually cuts into the load. It is not a filling gauge.
  polygon(put, [[left+1,waist],[right-1,waist+1],[right-1,waist+3],
    [left+1,waist+2]], P.fold);
  rect(put,left+2,waist,Math.max(4,right-left-4),1,strap);
  rect(put,14,waist-1,5,5,warm ? P.strain : P.thread);
  rect(put,15,waist,3,3,P.leather);
  rect(put,17,waist+1,2,1,warm ? P.strainLight : P.buckle);

  // Spare strap hangs below a light load; it is taken up when the bag is full.
  const tail = Math.round((1-r)*5);
  if (tail) {
    rect(put,left+4,bottom-1,2,tail,P.face);
    rect(put,left+5,bottom+tail-2,2,1,P.thread);
  }
  if (r >= .84) {
    // Small exposed folds immediately outside the constricting band.
    rect(put,left,waist-2,2,2,P.thread);
    rect(put,right-2,waist+3,2,2,P.face);
  }
  if (feedback > .05) {
    // Event-only strain along existing seams, never a persistent flashing halo.
    rect(put,left+3,waist-1,2,1,P.strainLight);
    rect(put,right-6,waist,2,1,P.strainLight);
  }
  finish();
}

// Geometric plates invade one continuous body, beginning at the right flank.
// The authored ordering prevents a fill-bar reading and random-noise texture.
const invasion = [
  {start:0, end:20, points:[[20,23],[24,21],[25,28],[22,33],[18,31],[18,27]], tone:0},
  {start:9, end:30, points:[[17,27],[21,26],[22,33],[20,37],[14,36],[15,30]], tone:1},
  {start:17, end:40, points:[[18,17],[23,17],[27,20],[24,24],[19,25],[18,22]], tone:1},
  {start:27, end:50, points:[[14,19],[20,19],[22,24],[17,29],[13,27]], tone:0},
  {start:37, end:60, points:[[15,12],[19,10],[21,13],[21,18],[17,21],[14,18]], tone:1},
  {start:42, end:66, points:[[10,29],[16,26],[19,31],[16,36],[10,35]], tone:0},
  {start:50, end:74, points:[[20,5],[22,7],[21,12],[17,15],[14,12],[16,8]], tone:0},
  {start:56, end:80, points:[[8,17],[14,16],[17,21],[13,25],[8,23],[5,21]], tone:1},
  {start:67, end:88, points:[[9,23],[14,22],[16,27],[12,32],[7,28]], tone:0},
  {start:74, end:96, points:[[12,4],[18,3],[20,6],[17,10],[13,10],[11,7]], tone:1},
  {start:82, end:100, points:[[11,9],[16,8],[18,13],[14,16],[11,13]], tone:0},
];

export function drawAssimilation(ctx, x, y, amount, time = 0, growing = false) {
  const a = clamp(amount, 0, 100);
  const {put, cells, finish} = makeMark(ctx, x, y);
  // A face without a readable expression; no eye pixels, mask HUD or skeleton.
  polygon(put, [[13,3],[19,3],[21,5],[22,10],[20,14],[17,16],[13,14],[11,10],[11,6]],P.face);
  polygon(put, [[13,3],[19,3],[19,5],[14,6],[13,11],[11,10],[11,6]],P.thread);
  polygon(put, [[19,6],[22,8],[22,10],[20,14],[17,16],[17,12],[19,11]],P.side);
  rect(put,14,14,5,4,P.side);
  // Asymmetric shoulders and coat mass, with broad joined planes.
  polygon(put, [[12,16],[15,18],[18,18],[21,16],[25,18],[28,21],[27,26],
    [24,28],[22,36],[19,38],[11,37],[9,33],[8,27],[5,25],[5,21],[8,18]],P.cloth);
  polygon(put, [[8,18],[12,16],[15,18],[14,21],[10,22],[8,26],[5,25],[5,21]],P.thread);
  polygon(put, [[15,19],[19,18],[22,20],[22,28],[19,34],[19,38],[14,37],[12,32],[12,24]],P.face);
  polygon(put, [[23,18],[28,21],[27,26],[24,28],[22,36],[19,38],[20,29],[22,25]],P.side);
  polygon(put, [[10,23],[13,21],[14,26],[12,32],[14,37],[11,37],[9,33],[8,27]],P.fold);
  rect(put,15,22,1,9,P.thread);
  rect(put,13,34,5,1,P.thread);

  const body = cells.slice();
  const corrupted = new Set();
  for (let index = 0; index < invasion.length; index++) {
    const plate = invasion[index];
    const progress = clamp((a - plate.start) / (plate.end - plate.start), 0, 1);
    if (!progress) continue;
    const pixels = [];
    polygon((px,py) => { if(body[py*32+px]) pixels.push([px,py]); },plate.points,'x');
    // Within each plate a directional front moves inward, with connected steps.
    pixels.sort((p,q) => (q[0]+q[1]*.62)-(p[0]+p[1]*.62));
    const count = Math.floor(progress * pixels.length);
    for(let k=0;k<count;k++) {
      const [px,py]=pixels[k];
      const local = (px + 2*py + index*3) % 13;
      const tone = local < 3 ? P.alienDark : (plate.tone ? P.alien : P.alienDark);
      put(px,py,tone);
      corrupted.add(py*32+px);
    }
    // A cropped face on each foreign plate, not a luminous silhouette outline.
    for(let k=0;k<count;k++) {
      const [px,py]=pixels[k];
      if ((px+2*py+index*3)%13===3 && body[py*32+px-1] && body[py*32+px+1]) {
        put(px,py,P.alien);
      }
    }
  }
  // Broken displaced registration remains inside the human silhouette.
  if(a>34) {
    for(const [px,py,w] of [[18,21,3],[16,28,3],[19,16,2]]) {
      for(let i=0;i<w;i++) if(corrupted.has(py*32+px+i)) put(px+i,py,P.thread);
    }
  }
  if(a>72) {
    // Wrong alignment across collar/face, no paired eyes or completed halo.
    for(const [px,py] of [[17,11],[18,11],[16,12],[15,24],[15,25],[16,26]]) {
      if(corrupted.has(py*32+px)) put(px,py,P.alien);
    }
  }
  if(growing && a>0 && a<100) {
    // Three local pixels advance through one existing intrusion every 560 ms.
    const active=[...corrupted].filter(n=>body[n-1] && !corrupted.has(n-1));
    if(active.length) {
      const phase=Math.floor(Math.max(0,time)/560)%3;
      const n=active[Math.floor(active.length*.45)];
      const px=n%32,py=Math.floor(n/32);
      for(let dy=0;dy<2;dy++) if(corrupted.has((py+dy)*32+px)) put(px,py+dy,phase===1?P.alienEdge:P.alien);
    }
  }
  finish();
}

export const markSize = Object.freeze({width:32,height:40});
