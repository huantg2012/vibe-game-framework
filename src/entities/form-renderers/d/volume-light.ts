import { sampleWorldMaterialLight, type WorldMaterialLighting } from './world-material-light';

/** Air has no hard faceted normals. Sample its received light on 4px optical
 * cells, bounding expensive world shadow rays to one per cell/light. Density,
 * alpha and the 2px material details remain sampled independently below. */
export function volumeLight(lighting: WorldMaterialLighting | undefined, w: number, h: number, left: number, top: number) {
  const cols = Math.ceil(w / 4), cells = lighting ? new Float32Array(cols * Math.ceil(h / 4) * 4) : undefined;
  const result: [number, number, number] = [1, 1, 1];
  return (x: number, y: number): readonly [number, number, number] => {
    if (!lighting || !cells) return result;
    const cx = Math.floor(x / 4), cy = Math.floor(y / 4), i = (cy * cols + cx) * 4;
    if (!cells[i]) {
      sampleWorldMaterialLight(lighting, left + cx * 4 + 2, top + cy * 4 + 2, 12, 0, 0, 1, true, result);
      cells[i] = 1; cells.set(result, i + 1);
    }
    result[0] = cells[i + 1]!; result[1] = cells[i + 2]!; result[2] = cells[i + 3]!;
    return result;
  };
}

