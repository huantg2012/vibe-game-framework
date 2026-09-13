/** QA navigation hints only. Tests move through real input; these are not game rules. */
import type { SuspendedSeaSceneId } from '../../src/dev/suspended-sea/world';

export const SEA_ROUTE_GUIDES = {
  'sea-open-channel': {
    observation: { x: 768, y: 480 }, hitStand: { x: 790, y: 477 }, hitFacingDegrees: 0,
    shortcut: [{ x: 624, y: 480 }, { x: 976, y: 480 }, { x: 1136, y: 480 }],
    bypass: [{ x: 624, y: 480 }, { x: 624, y: 304 }, { x: 1136, y: 304 }, { x: 1136, y: 480 }],
    approach: [{ x: 304, y: 944 }, { x: 464, y: 944 }, { x: 464, y: 480 }, { x: 768, y: 480 }],
    nodeOrder: ['near-kindling', 'retreat-deposit', 'foreign-remnant', 'far-deposit', 'foreign-kindling', 'return-remnant', 'far-kindling'],
    returnWaypoints: [{ x: 1616, y: 944 }, { x: 464, y: 944 }, { x: 240, y: 944 }],
  },
  'sea-folded-ridge': {
    observation: { x: 1168, y: 656 }, hitStand: { x: 968, y: 705 }, hitFacingDegrees: 90,
    shortcut: [{ x: 976, y: 656 }, { x: 976, y: 880 }],
    bypass: [{ x: 976, y: 656 }, { x: 1200, y: 656 }, { x: 1200, y: 880 }, { x: 976, y: 880 }],
    approach: [{ x: 304, y: 944 }, { x: 304, y: 208 }, { x: 1232, y: 208 }, { x: 1232, y: 656 }, { x: 1168, y: 656 }],
    nodeOrder: ['near-kindling', 'foreign-kindling', 'far-kindling', 'foreign-remnant', 'far-deposit', 'retreat-deposit', 'return-remnant'],
    returnWaypoints: [{ x: 1392, y: 912 }, { x: 976, y: 944 }, { x: 304, y: 944 }],
  },
} as const satisfies Record<SuspendedSeaSceneId, unknown>;
