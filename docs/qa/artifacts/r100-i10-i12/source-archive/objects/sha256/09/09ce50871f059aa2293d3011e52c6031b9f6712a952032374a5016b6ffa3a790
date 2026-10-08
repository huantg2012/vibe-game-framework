/**
 * Walkable connectivity. FATAL for every generator and preview draft.
 * Four-connected. Land and not wall.
 */

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function inBounds(cols: number, rows: number, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}

export function labelFloors(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): { labels: Int32Array; count: number } {
  const total = cols * rows;
  const labels = new Int32Array(total);
  let count = 0;
  for (let i = 0; i < total; i++) {
    if (!land[i] || walls[i] || labels[i]) continue;
    count++;
    const stack = [i];
    labels[i] = count;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const col = cur % cols;
      const row = (cur / cols) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds(cols, rows, nx, ny)) continue;
        const ni = at(cols, nx, ny);
        if (labels[ni] || !land[ni] || walls[ni]) continue;
        labels[ni] = count;
        stack.push(ni);
      }
    }
  }
  return { labels, count };
}

export function countWalkableComponents(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): number {
  return labelFloors(land, walls, cols, rows).count;
}

/** Floor cells that are not in the largest walkable component. 0 = connected. */
export function leftoverDisconnectedCount(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): number {
  const { labels, count } = labelFloors(land, walls, cols, rows);
  if (count <= 1) return 0;
  const sizes = new Array<number>(count + 1).fill(0);
  for (let i = 0; i < labels.length; i++) sizes[labels[i]!]!++;
  let best = 0;
  for (let k = 1; k <= count; k++) if (sizes[k]! > best) best = sizes[k]!;
  let floor = 0;
  for (let i = 0; i < land.length; i++) if (land[i] && !walls[i]) floor++;
  return floor - best;
}

/** Punch walls that seal leftover floor pockets. Returns how many cells opened. */
export function openSealedFloors(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  keep?: Uint8Array,
): number {
  let punched = 0;
  for (let iter = 0; iter < 48; iter++) {
    const { labels, count } = labelFloors(land, walls, cols, rows);
    if (count <= 1) return punched;
    const sizes = new Array<number>(count + 1).fill(0);
    for (let i = 0; i < labels.length; i++) sizes[labels[i]!]!++;
    let main = 1;
    for (let k = 2; k <= count; k++) if (sizes[k]! > sizes[main]!) main = k;

    let both = -1;
    let leftoverOnly = -1;
    for (let i = 0; i < walls.length; i++) {
      if (!walls[i] || !land[i]) continue;
      if (keep && keep[i]) continue;
      const col = i % cols;
      const row = (i / cols) | 0;
      let touchMain = false;
      let touchLeftover = false;
      for (const [dx, dy] of DIRS4) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds(cols, rows, nx, ny)) continue;
        const id = labels[at(cols, nx, ny)]!;
        if (id === main) touchMain = true;
        else if (id > 0) touchLeftover = true;
      }
      if (touchMain && touchLeftover) {
        both = i;
        break;
      }
      if (touchLeftover && leftoverOnly < 0) leftoverOnly = i;
    }
    const hit = both >= 0 ? both : leftoverOnly;
    if (hit < 0) return punched;
    walls[hit] = 0;
    punched++;
  }
  return punched;
}

export function assertSingleWalkable(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  label: string,
): void {
  const n = countWalkableComponents(land, walls, cols, rows);
  if (n === 1) return;
  throw new Error(`${label}: walkable components = ${n}, need 1`);
}
