import { CORE_FACING_TARGET } from '../purification-last-light/devices';
import { type V3 } from '../purification-last-light/model';
import { base, type Option } from './shared';

/** A whole-assembly relocation, including its volume and radiance samples.
 * Moving farther north than the first sketch preserves the Rift's NE fork. */
export const C_CORE_POSITION: V3 = [11.3, 0, 1.7];
export const C_CORE_YAW = Math.atan2(
  CORE_FACING_TARGET[0] - C_CORE_POSITION[0],
  CORE_FACING_TARGET[2] - C_CORE_POSITION[2],
);

export function buildOption(): Option {
  const { model, core } = base();
  const turn = C_CORE_YAW - core.yaw;
  const c = Math.cos(turn), s = Math.sin(turn);
  const rotate = (p: V3): V3 => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  const relocate = (p: V3): V3 => {
    const q = rotate([p[0] - core.position[0], p[1] - core.position[1], p[2] - core.position[2]]);
    return [q[0] + C_CORE_POSITION[0], q[1] + C_CORE_POSITION[1], q[2] + C_CORE_POSITION[2]];
  };
  const world = (x: number, y: number, z: number): V3 => [
    C_CORE_POSITION[0] + x * Math.cos(C_CORE_YAW) + z * Math.sin(C_CORE_YAW),
    C_CORE_POSITION[1] + y,
    C_CORE_POSITION[2] - x * Math.sin(C_CORE_YAW) + z * Math.cos(C_CORE_YAW),
  ];

  for (const triangle of model.triangles) {
    if (triangle.object !== core.id) continue;
    triangle.a = relocate(triangle.a);
    triangle.b = relocate(triangle.b);
    triangle.c = relocate(triangle.c);
    triangle.normal = rotate(triangle.normal);
  }
  for (const light of model.lights) {
    if (light.id.startsWith('core-')) light.position = relocate(light.position);
  }
  for (const volume of model.volumes) {
    if (volume.object !== core.id) continue;
    volume.center = relocate(volume.center);
    volume.yaw += turn;
  }

  // The shrine still derives its support from the right-hand building. Two
  // low surviving stone ties bridge back to the edge, entirely BEHIND it.
  // They are physical courses with separate joints, not painted floor strips.
  // The front and southwest flank remain clear for the Rift approach.
  model.at(C_CORE_POSITION, C_CORE_YAW, 0, () => {
    for (const [x, length, tint] of [[-.77, 1.9, .72], [.72, 1.62, .69]] as const) {
      model.box([x, .065, -1.05 - length / 2], [.60, .13, length], 'stone', .033, tint);
      model.box([x, .159, -1.16], [.49, .11, .61], 'cutstone', .027, tint + .045);
      model.box([x + .014, .151, -1.87], [.48, .10, .73], 'cutstone', .024, tint);
      model.box([x - .024, .13, -2.52], [.45, .07, .52], 'cutstone', .018, tint - .025);
    }
    // An incomplete rear cross-course embeds both ties in one older wall line.
    model.slab([[-1.10, -2.85], [.99, -2.80], [1.10, -3.11], [.39, -3.22],
      [-.47, -3.10], [-1.03, -3.16]], .14, -.025, 'stone', .68);
  });

  const stop = world(0, .035, 2.45);
  return {
    id: 'c',
    title: '核心内收',
    summary: '核心整体向内移约 2.27 米，朝向仍对准净化点中心；缩短前庭，将停留点带回活动区域。',
    tradeoff: '到核心更直接；但核心与上层储藏形成上下堆叠，独立地标感减弱，视觉更拥挤。',
    model,
    route: [[2, .035, -.5], [4.7, .035, -.05], [6.8, .035, .36], stop],
    stop,
    footprint: [world(-1.82, .038, -3.24), world(1.8, .038, -3.24),
      world(1.8, .038, 2.15), world(-1.82, .038, 2.15)],
    callouts: [
      { text: '核心整体内移 2.27 米', point: world(0, 2.66, -.44) },
      { text: '接近与停留区同步前收', point: stop },
      { text: '低基础仍接向右沿', point: world(-.77, .20, -2.65) },
    ],
  };
}
