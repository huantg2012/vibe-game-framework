import assert from 'node:assert/strict';

/** R9 route fixtures shared by pure movement and real-key production checks.
 * Coordinates are sole positions. Junction points keep 6px clearance from the
 * authored edges and unchanged device bodies; they are not teleport targets. */
export const CHAMBER_TEST_POINTS = {
  spawn: [243, 315], core: [175, 320], storage: [79, 322], purifier: [288, 320],
  rift: [364, 309], growth: [185, 226], offering: [283, 224],
  behindCore: [141, 283], frontCore: [175, 320],
  leftRamp: [193.5, 258.5], rightRamp: [321, 251.5],
};
export const CHAMBER_TEST_ROUTES = {
  coreToStorage: [[175, 327], [103, 327], CHAMBER_TEST_POINTS.storage],
  storageToBehindCore: [[105, 324], [110, 287], CHAMBER_TEST_POINTS.behindCore],
  behindToFrontCore: [[171, 283], CHAMBER_TEST_POINTS.frontCore],
  mainToClimb: [[243, 315], [205, 293], [200, 278], CHAMBER_TEST_POINTS.leftRamp],
  climbToUpper: [CHAMBER_TEST_POINTS.leftRamp, [187, 239], CHAMBER_TEST_POINTS.growth],
  upperToOffering: [[232, 226], CHAMBER_TEST_POINTS.offering],
  descendEast: [[312, 220], [311, 229], CHAMBER_TEST_POINTS.rightRamp, [331, 274], [330, 306], [329, 320]],
};

/** Known-safe authored routes, genuine keys. No position setters or time scaling.
 * This is an informed navigation harness, not evidence of first-time readability. */
export function createChamberDriver(page, journey) {
  async function walkFeet(x, y) {
    let stalled = 0;
    let previous = null;
    for (let step = 0; step < 180; step++) {
      const state = await journey.state();
      assert.equal(state.scene, 'base');
      const feet = { x: state.player.x, y: state.player.y + 10 };
      const dx = x - feet.x, dy = y - feet.y;
      if (Math.hypot(dx, dy) < 3) return state;
      stalled = previous && Math.hypot(feet.x - previous.x, feet.y - previous.y) < .2 ? stalled + 1 : 0;
      assert(stalled < 8, `Blocked route to ${x},${y}: ${JSON.stringify(state)}`);
      previous = feet;
      const keys = [];
      // Finish the shorter component before pursuing a long remaining axis.
      if (Math.abs(dx) > 1.8) keys.push(dx > 0 ? 'd' : 'a');
      if (Math.abs(dy) > 1.8) keys.push(dy > 0 ? 's' : 'w');
      const shortest = keys.length === 2 ? Math.min(Math.abs(dx), Math.abs(dy)) * Math.SQRT2 : Math.hypot(dx, dy);
      await journey.hold(keys, Math.max(22, Math.min(115, shortest / 80 * 1000)));
    }
    assert.fail(`Route did not converge to ${x},${y}`);
  }
  async function via(points) {
    for (const [x, y] of points) await walkFeet(x, y);
  }
  async function climbCenter() {
    await via([...CHAMBER_TEST_ROUTES.mainToClimb, ...CHAMBER_TEST_ROUTES.climbToUpper]);
    assert.equal((await journey.state()).route, 'upper');
  }
  async function descendEast() {
    await via(CHAMBER_TEST_ROUTES.descendEast);
    assert.equal((await journey.state()).route, 'main');
  }
  return { walkFeet, via, climbCenter, descendEast };
}
