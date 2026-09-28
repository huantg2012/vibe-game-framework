# Boundary cadence follow-up · 2026-09-28

The previous boundary patch fixed orientation flips but did not prevent an almost-normal input from creeping along a wall. At the user's west-ramp right-edge example, SE input produced 0.10947 m/s and about 1.05 walk sprite changes per second, with a pose held for approximately 950 ms. This was distance-driven slow motion, not evidence of a one-frame-per-second renderer.

The correction stops a tangential component below 20% of the remaining input. A deliberate tangent reuses the remaining walking-distance budget at requested speed. Further contacts must also agree with the original input, preventing automatic backward turns at concave corners. Actual floor support and collision clearance remain authoritative; gait still advances from actual travel.

- `motion.json`: numerical boundary, cadence, no-creep, gait/travel coupling and collision regression. The previous `4c1573a` runtime fails the new screenshot-location regression.
- `navigation.json`: existing navigation regression including full-width ramp landing lanes.
- `pressure.webp` / `pressure-states.json`: same right-ramp position with held SE input. After about 5 mm of approach it gathers its feet and remains idle while the key is held.
- `stride.webp` / `stride-states.json`: same position with held E input. The actor walks along the edge and onto the upper floor; sampled speeds are 1.786–1.8 m/s. Maximum sampled walking-pose dwell is 68 ms.
- `contact-sheet.jpg`: six frames from each sequence, visually inspected for the stop and continuous stride.

Each animation contains 32 production-renderer browser screenshots, taken by deterministic time seek from 0.48 through 1.968 seconds at 48 ms spacing. They use the real movement, gait and assets. Playback is not a real-time rendering performance benchmark. Browser warning/error logs were empty. The user's active save was not reset; this is not a complete root-game playthrough.

Actor art, gait animation, scene geometry and Rift movement are unchanged. Existing brief velocity variation while crossing different projected floor patches is outside this correction; do not infer exact constant speed across every seam from the steady-contact results.
