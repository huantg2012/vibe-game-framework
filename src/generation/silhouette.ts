/**
 * Anti-maze silhouette gates (DEC-058). Wood (stump/root) is cover, not a corridor.
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

export function woodMask(
  cols: number,
  rows: number,
  paint: ReadonlyArray<{ col: number; row: number; role: string }>,
): Uint8Array {
  const wood = new Uint8Array(cols * rows);
  for (const cell of paint) {
    if (cell.role !== 'stump' && cell.role !== 'root') continue;
    if (!inBounds(cols, rows, cell.col, cell.row)) continue;
    wood[at(cols, cell.col, cell.row)] = 1;
  }
  return wood;
}

function isStone(
  walls: Uint8Array,
  wood: Uint8Array,
  cols: number,
  col: number,
  row: number,
): boolean {
  const i = at(cols, col, row);
  return !!walls[i] && !wood[i];
}

function isFloor(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  col: number,
  row: number,
): boolean {
  const i = at(cols, col, row);
  return !!land[i] && !walls[i];
}

/** Stone wall that sits in a 2×2 of stone. */
export function thickStoneMask(
  walls: Uint8Array,
  wood: Uint8Array,
  cols: number,
  rows: number,
): Uint8Array {
  const thick = new Uint8Array(walls.length);
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      if (
        isStone(walls, wood, cols, col, row) &&
        isStone(walls, wood, cols, col + 1, row) &&
        isStone(walls, wood, cols, col, row + 1) &&
        isStone(walls, wood, cols, col + 1, row + 1)
      ) {
        thick[at(cols, col, row)] = 1;
        thick[at(cols, col + 1, row)] = 1;
        thick[at(cols, col, row + 1)] = 1;
        thick[at(cols, col + 1, row + 1)] = 1;
      }
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      if (wood[i] && walls[i]) thick[i] = 1;
    }
  }
  return thick;
}

function maxThinRun(
  walls: Uint8Array,
  wood: Uint8Array,
  thick: Uint8Array,
  cols: number,
  rows: number,
): number {
  const thin = (col: number, row: number): boolean => {
    if (!inBounds(cols, rows, col, row)) return false;
    const i = at(cols, col, row);
    return !!walls[i] && !wood[i] && !thick[i];
  };
  let best = 0;
  for (let row = 0; row < rows; row++) {
    let run = 0;
    for (let col = 0; col <= cols; col++) {
      if (col < cols && thin(col, row)) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
  }
  for (let col = 0; col < cols; col++) {
    let run = 0;
    for (let row = 0; row <= rows; row++) {
      if (row < rows && thin(col, row)) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
  }
  return best;
}

function narrowSlotCount(
  land: Uint8Array,
  walls: Uint8Array,
  wood: Uint8Array,
  cols: number,
  rows: number,
): number {
  const stone = (c: number, r: number): boolean =>
    inBounds(cols, rows, c, r) && isStone(walls, wood, cols, c, r);
  const floor = (c: number, r: number): boolean =>
    inBounds(cols, rows, c, r) && isFloor(land, walls, cols, c, r);
  let n = 0;
  const seen = new Set<string>();
  const mark = (key: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    n++;
  };
  for (let row = 0; row < rows; row++) {
    for (let gap = 1; gap <= 2; gap++) {
      let run = 0;
      for (let col = 0; col <= cols; col++) {
        const ok =
          col < cols &&
          stone(col, row) &&
          stone(col, row + gap + 1) &&
          Array.from({ length: gap }, (_, k) => floor(col, row + 1 + k)).every(Boolean);
        if (ok) {
          run++;
          if (run === 4) mark(`h:${row}:${gap}:${col - 3}`);
        } else run = 0;
      }
    }
  }
  for (let col = 0; col < cols; col++) {
    for (let gap = 1; gap <= 2; gap++) {
      let run = 0;
      for (let row = 0; row <= rows; row++) {
        const ok =
          row < rows &&
          stone(col, row) &&
          stone(col + gap + 1, row) &&
          Array.from({ length: gap }, (_, k) => floor(col + 1 + k, row)).every(Boolean);
        if (ok) {
          run++;
          if (run === 4) mark(`v:${col}:${gap}:${row - 3}`);
        } else run = 0;
      }
    }
  }
  return n;
}

function perpFloorSpan(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
  horizontal: boolean,
): { span: number; walled: boolean } {
  if (horizontal) {
    let a = row;
    while (a - 1 >= 0 && isFloor(land, walls, cols, col, a - 1)) a--;
    let b = row;
    while (b + 1 < rows && isFloor(land, walls, cols, col, b + 1)) b++;
    const span = b - a + 1;
    const walled =
      (a - 1 < 0 || !!walls[at(cols, col, a - 1)]) && (b + 1 >= rows || !!walls[at(cols, col, b + 1)]);
    return { span, walled };
  }
  let a = col;
  while (a - 1 >= 0 && isFloor(land, walls, cols, a - 1, row)) a--;
  let b = col;
  while (b + 1 < cols && isFloor(land, walls, cols, b + 1, row)) b++;
  const span = b - a + 1;
  const walled =
    (a - 1 < 0 || !!walls[at(cols, a - 1, row)]) && (b + 1 >= cols || !!walls[at(cols, b + 1, row)]);
  return { span, walled };
}

function maxWalledAlley(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): number {
  let best = 0;
  for (let row = 0; row < rows; row++) {
    let run = 0;
    for (let col = 0; col <= cols; col++) {
      const ok =
        col < cols &&
        isFloor(land, walls, cols, col, row) &&
        (() => {
          const p = perpFloorSpan(land, walls, cols, rows, col, row, true);
          return p.walled && p.span >= 2 && p.span <= 4;
        })();
      if (ok) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
  }
  for (let col = 0; col < cols; col++) {
    let run = 0;
    for (let row = 0; row <= rows; row++) {
      const ok =
        row < rows &&
        isFloor(land, walls, cols, col, row) &&
        (() => {
          const p = perpFloorSpan(land, walls, cols, rows, col, row, false);
          return p.walled && p.span >= 2 && p.span <= 4;
        })();
      if (ok) {
        run++;
        if (run > best) best = run;
      } else run = 0;
    }
  }
  return best;
}

function oneWideStep(
  land: Uint8Array,
  walls: Uint8Array,
  wood: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
  dx: number,
  dy: number,
): boolean {
  const nc = col + dx;
  const nr = row + dy;
  if (!inBounds(cols, rows, nc, nr) || !isFloor(land, walls, cols, nc, nr)) return false;
  const horiz = dx !== 0;
  const p = perpFloorSpan(land, walls, cols, rows, nc, nr, horiz);
  if (p.span !== 1 || !p.walled) return false;
  const sideA = horiz ? [nc, nr - 1] : [nc - 1, nr];
  const sideB = horiz ? [nc, nr + 1] : [nc + 1, nr];
  const stoneA = inBounds(cols, rows, sideA[0]!, sideA[1]!) && isStone(walls, wood, cols, sideA[0]!, sideA[1]!);
  const stoneB = inBounds(cols, rows, sideB[0]!, sideB[1]!) && isStone(walls, wood, cols, sideB[0]!, sideB[1]!);
  return stoneA && stoneB;
}

function threeWayAlleyCount(
  land: Uint8Array,
  walls: Uint8Array,
  wood: Uint8Array,
  cols: number,
  rows: number,
): number {
  let n = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isFloor(land, walls, cols, col, row)) continue;
      let arms = 0;
      for (const [dx, dy] of DIRS4) {
        if (oneWideStep(land, walls, wood, cols, rows, col, row, dx, dy)) arms++;
      }
      if (arms >= 3) n++;
    }
  }
  return n;
}

function openYardWithEdgeCover(
  land: Uint8Array,
  walls: Uint8Array,
  thick: Uint8Array,
  cols: number,
  rows: number,
): boolean {
  const SIZE = 6;
  for (let row = 0; row <= rows - SIZE; row++) {
    for (let col = 0; col <= cols - SIZE; col++) {
      let open = true;
      for (let r = row; r < row + SIZE && open; r++) {
        for (let c = col; c < col + SIZE; c++) {
          const i = at(cols, c, r);
          if (!land[i] || walls[i]) {
            open = false;
            break;
          }
        }
      }
      if (!open) continue;
      for (let r = row - 2; r < row + SIZE + 2; r++) {
        for (let c = col - 2; c < col + SIZE + 2; c++) {
          if (!inBounds(cols, rows, c, r)) continue;
          const inside = c >= col && c < col + SIZE && r >= row && r < row + SIZE;
          if (inside) continue;
          if (thick[at(cols, c, r)]) return true;
        }
      }
    }
  }
  return false;
}

export interface SilhouetteMetrics {
  readonly thinRun: number;
  readonly thickRatio: number;
  readonly narrowSlots: number;
  readonly threeWayAlleys: number;
  readonly openYardCovered: boolean;
  readonly longAlley: number;
  readonly wallRatio: number;
}

export function measureSilhouette(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  paint: ReadonlyArray<{ col: number; row: number; role: string }> = [],
): SilhouetteMetrics {
  const wood = woodMask(cols, rows, paint);
  const thick = thickStoneMask(walls, wood, cols, rows);
  let landN = 0;
  let wallN = 0;
  let stoneN = 0;
  let thickN = 0;
  for (let i = 0; i < land.length; i++) {
    if (land[i]) landN++;
    if (!walls[i]) continue;
    wallN++;
    if (wood[i]) {
      if (thick[i]) thickN++;
      continue;
    }
    stoneN++;
    if (thick[i]) thickN++;
  }
  const thickRatio = wallN === 0 ? 1 : thickN / wallN;
  return {
    thinRun: maxThinRun(walls, wood, thick, cols, rows),
    thickRatio,
    narrowSlots: narrowSlotCount(land, walls, wood, cols, rows),
    threeWayAlleys: threeWayAlleyCount(land, walls, wood, cols, rows),
    openYardCovered: openYardWithEdgeCover(land, walls, thick, cols, rows),
    longAlley: maxWalledAlley(land, walls, cols, rows),
    wallRatio: landN === 0 ? 0 : wallN / landN,
  };
}

export function silhouetteFails(m: SilhouetteMetrics): string | null {
  if (m.thinRun > 6) return `thin run ${m.thinRun} > 6`;
  if (m.thickRatio < 0.5) return `thick ratio ${m.thickRatio.toFixed(2)} < 0.5`;
  if (m.narrowSlots > 0) return `narrow slots ${m.narrowSlots}`;
  if (m.threeWayAlleys > 0) return `three-way alleys ${m.threeWayAlleys}`;
  if (!m.openYardCovered) return 'no 6x6 yard with edge cover';
  if (m.longAlley > 8) return `walled alley ${m.longAlley} > 8`;
  if (m.wallRatio > 0.18 + 1e-6) return `wall ratio ${(m.wallRatio * 100).toFixed(1)}% > 18%`;
  return null;
}
