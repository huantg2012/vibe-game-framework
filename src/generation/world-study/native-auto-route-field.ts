/** Cheap topology-aware planning distance. This is a predictor, never G2
 * admission: the compiled world still needs attributed LOS witnesses.
 *
 * Integer 2/3 chamfer costs bound eight-neighbour path length from above
 * (by at most 6.1%). Four cyclic buckets avoid a heap in every plan trial.
 * Diagonals cannot cut across either blocked cardinal neighbour. */
export function createNativeAutoRouteField(
  points: readonly { readonly gx: number; readonly gy: number }[],
  spacing: number,
) {
  const count = points.length;
  const lookup = new Map(points.map((point, index) => [`${point.gx}:${point.gy}`, index]));
  const directions = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]] as const;
  const links = new Int32Array(count * 8).fill(-1);
  points.forEach((point, index) => directions.forEach(([dx, dy], direction) => {
    links[index * 8 + direction] = lookup.get(`${point.gx + dx}:${point.gy + dy}`) ?? -1;
  }));
  const corners = [[0,1],[1,2],[2,3],[3,0]] as const;
  const distance = new Int32Array(count);
  const next = new Int32Array(count), previous = new Int32Array(count);
  const heads = new Int32Array(4), queued = new Uint8Array(count);
  const result = new Float64Array(count);
  return (available: Uint8Array, holeDistance: Float32Array, approachRadius: number, exactLinks?:Uint8Array): Float64Array => {
    if (available.length !== count || holeDistance.length !== count) throw new Error('Automatic route field size mismatch');
    distance.fill(0x3fffffff); heads.fill(-1); queued.fill(0); result.fill(Infinity);
    let pending = 0, cursor = 0;
    const insert = (cell: number, cost: number) => {
      if (queued[cell]) {
        const before = previous[cell]!, after = next[cell]!;
        if (before < 0) heads[distance[cell]! % 4] = after; else next[before] = after;
        if (after >= 0) previous[after] = before;
      } else { queued[cell] = 1; pending++; }
      const bucket = cost % 4, old = heads[bucket]!;
      distance[cell] = cost; previous[cell] = -1; next[cell] = old;
      if (old >= 0) previous[old] = cell;
      heads[bucket] = cell;
    };
    for (let cell = 0; cell < count; cell++) {
      if (available[cell] && holeDistance[cell]! <= approachRadius) insert(cell, 0);
    }
    while (pending) {
      while (heads[cursor % 4] === -1) cursor++;
      const cell = heads[cursor % 4]!, following = next[cell]!;
      heads[cursor % 4] = following;
      if (following >= 0) previous[following] = -1;
      queued[cell] = 0; pending--;
      result[cell] = cursor * spacing / 2;
      for (let direction = 0; direction < 8; direction++) {
        const neighbor = links[cell * 8 + direction]!;
        if (neighbor < 0 || !available[neighbor]) continue;
        if(exactLinks&&!(exactLinks[cell]!&(1<<direction)))continue;
        if (!exactLinks&&direction >= 4) {
          const [a, b] = corners[direction - 4]!;
          const first = links[cell * 8 + a]!, second = links[cell * 8 + b]!;
          if (first < 0 || second < 0 || !available[first] || !available[second]) continue;
        }
        const cost = cursor + (direction < 4 ? 2 : 3);
        if (cost < distance[neighbor]!) insert(neighbor, cost);
      }
    }
    return result;
  };
}
