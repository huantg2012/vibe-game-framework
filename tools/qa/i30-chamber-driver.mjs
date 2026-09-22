import assert from 'node:assert/strict';

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
    await via([[366, 304], [312, 288], [304, 270], [293, 246], [281, 218]]);
    assert.equal((await journey.state()).route, 'upper');
  }
  async function descendEast() {
    await via([[374, 199], [382, 215], [405, 238], [421, 258], [413, 297]]);
    assert.equal((await journey.state()).route, 'main');
  }
  return { walkFeet, via, climbCenter, descendEast };
}
