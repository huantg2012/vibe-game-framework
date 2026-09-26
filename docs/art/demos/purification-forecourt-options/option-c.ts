import { CORE_FACING_TARGET } from '../purification-last-light/devices';
import { WALK_SURFACES } from '../purification-last-light/environment';
import { cross, sub, unit, type V3 } from '../purification-last-light/model';
import { base, relocate, type Option } from './shared';

export const C_CORE_POSITION: V3 = [8.7, 0, .45];
export const C_CORE_YAW = Math.atan2(
  CORE_FACING_TARGET[0] - C_CORE_POSITION[0],
  CORE_FACING_TARGET[2] - C_CORE_POSITION[2],
);
export const C_RIFT_POSITION: V3 = [12.6, 0, 4.4];
export const C_STORAGE_POSITION: V3 = [9.8, 2.6, -5.0];

/** C changes spatial relationships rather than decorating the empty floor:
 * the core claims the haven's center, and departure occupies the exposed edge. */
export function buildOption(): Option {
  const haven = base();
  const { model } = haven;
  const core = relocate(haven, 'core', C_CORE_POSITION, C_CORE_YAW);
  const rift = relocate(haven, 'rift', C_RIFT_POSITION, -.2);
  const storage = relocate(haven, 'storage', C_STORAGE_POSITION, 0);

  // The right edge has a genuinely tilted old floor layer above y=0. A wound
  // belongs to that surface: conform every vertex instead of hiding the Rift
  // below the slab or lifting a flat sticker above it.
  const groundHeight = (point: V3): number => {
    let height = 0;
    for (const surface of WALK_SURFACES) {
      if (surface.id !== 'main' && !surface.id.startsWith('old-floor-layer-')) continue;
      const p = surface.points;
      let inside = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const a = p[i]!, b = p[j]!;
        if (((a[2] > point[2]) !== (b[2] > point[2])) &&
          point[0] < (b[0] - a[0]) * (point[2] - a[2]) / (b[2] - a[2]) + a[0]) inside = !inside;
      }
      if (!inside) continue;
      const normal = cross(sub(p[1]!, p[0]!), sub(p[2]!, p[0]!));
      height = Math.max(height, p[0]![1] - (normal[0] * (point[0] - p[0]![0]) +
        normal[2] * (point[2] - p[0]![2])) / normal[1]);
    }
    return height;
  };
  const settle = (point: V3): V3 => [point[0], point[1] + groundHeight(point), point[2]];
  for (const triangle of model.triangles) if (triangle.object === rift.id) {
    triangle.a = settle(triangle.a);
    triangle.b = settle(triangle.b);
    triangle.c = settle(triangle.c);
    triangle.normal = unit(cross(sub(triangle.b, triangle.a), sub(triangle.c, triangle.a)));
  }
  for (const light of model.lights) if (light.id.startsWith('rift-')) light.position = settle(light.position);
  rift.position = settle(rift.position);
  rift.approach = settle(rift.approach);
  const world = (x: number, y: number, z: number): V3 => [
    core.position[0] + x * Math.cos(core.yaw) + z * Math.sin(core.yaw),
    core.position[1] + y,
    core.position[2] - x * Math.sin(core.yaw) + z * Math.cos(core.yaw),
  ];

  // A buried load-bearing socket gives the central mass architectural weight.
  // Its surviving outer course is only 6–7 cm above the walking floor. Separate
  // radial joints and a broken outer profile avoid a new tiled carpet or stage.
  model.at(core.position, core.yaw, 0, () => {
    const n = 14;
    model.cylinder([0, -.008, .05], 2.16, .12, 'stone', n, 2.08, .71);
    const radii = [2.07, 2.08, 2.04, 2.10, 2.08, 2.0, 1.99,
      2.06, 2.09, 2.02, 2.07, 2.06, 1.97, 2.03];
    for (let i = 0; i < n; i++) {
      // The front pair are worn back to the approach, without a raised threshold.
      if (i === 0 || i === n - 1) continue;
      const a = (i / n) * Math.PI * 2 + .012;
      const b = ((i + 1) / n) * Math.PI * 2 - .012;
      const point = (angle: number, radius: number): readonly [number, number] =>
        [Math.sin(angle) * radius, Math.cos(angle) * radius + .05];
      model.slab([point(a, 1.68), point(a, radii[i]!),
        point(b, radii[(i + 1) % n]!), point(b, 1.68)], .068, .052,
      'cutstone', .73 + (i % 3) * .024);
    }
  });

  const start: V3 = [3.8, .035, 3.8];
  const stop: V3 = [core.approach[0], .035, core.approach[2]];
  const riftStop: V3 = [rift.approach[0], rift.approach[1] + .035, rift.approach[2]];
  // Routes use actual interaction faces. The shown actor is a reference standing
  // position, not a newly specified production spawn or a compulsory quest path.
  const approach: V3[] = [start, [4.0, .035, 2.3], [4.9, .035, .85], stop];
  const departure: V3[] = [stop, [5.45, .035, 1.55], [6.75, .035, 2.92],
    [8.4, .035, 3.55], [10.55, .035, 3.75], riftStop];
  const upstairs: V3[] = [stop, [4.8, .035, -.5], [2, .035, -.5],
    [3.5, 2.635, -4], [5.15, 2.635, -3.95], [7.35, 2.635, -3.82],
    [storage.approach[0], 2.635, storage.approach[2]]];
  return {
    id: 'c',
    title: '中心圣龛 · 边缘出发',
    summary: '核心进入活动区中央；裂隙移到右侧断沿，储藏退回上层书库。右侧空地成为围绕核心分流的空间。',
    tradeoff: '组织关系最鲜明，核心更易接近；空间也更集中，炉边去裂隙需要绕过核心，边缘灯塔式的孤峙感减弱。',
    model,
    route: [...approach, ...departure.slice(1)],
    routes: [
      { label: '参考站位 → 核心', points: approach },
      { label: '核心 → 边缘裂隙', points: departure },
      { label: '核心 → 楼梯 → 储藏', points: upstairs },
    ],
    stations: haven.stations,
    design: [
      '让核心直接占据右侧空地的视线焦点，接近路线在它前方汇合，绕行在两侧发生。',
      '出发裂隙移到断沿；据点内部的庇护与边缘的暴露，在位置上形成明确差异。',
      '储藏退入书库工作区，解除原本压在核心头顶的上下堆叠；炉边休息组保持原位。',
    ],
    changedObjects: [core.id, rift.id, storage.id],
    stop,
    footprint: [[6.4, .035, -1.72], [10.86, .035, -1.72],
      [14.04, .035, 3.23], [13.32, .035, 5.51],
      [11.07, .035, 5.65], [6.4, .035, 2.68]],
    callouts: [
      { text: '核心成为空间中心', point: world(0, 2.66, -.44) },
      { text: '裂隙退至出发边缘', point: [rift.position[0], .16, rift.position[2]] },
      { text: '储藏退回书库工作区', point: [storage.position[0], 3.8, storage.position[2]] },
    ],
  };
}
