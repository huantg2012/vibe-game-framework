# Last Light boundary movement regression · 2026-09-28

- `motion.json`: `tools/last-light/check-boundary-motion.ts`, 6,683 simulated frames across fixed/variable frame durations, eight screen-key directions, floor edges, slope walls, polygon and circle props. The previous runtime fails the same test with a 154.59° body/travel direction disagreement.
- `navigation.json`: existing 10-group movement regression, including the previous full-width upper landing fix.
- `browser-states.json`: 20 DOM-exposed samples from the production-renderer motion harness: four held-input cases at 0.8, 1.6, 2.4, 3.2 and 4.032 seconds. The first four samples are during held diagonal input; the final sample is after release. The crate-corner case becomes blocked and settles to idle while input remains held.
- `outer.webp`, `ramp.webp`, `prop.webp`, `slope.webp`: each contains 32 browser captures, sampled at 80 ms intervals from 0.8 through 3.28 seconds. These are deterministic time-seek replays using the production movement, gait, renderer and assets; their playback speed is **not** a live frame-rate measurement. Each crop is the harness's 4× actor/context panel. The ramp-side actor is occluded by the structure, so that case only supports visual review of lamp/shadow continuity alongside numerical movement checks.
- `contact-sheet.jpg`: six frames per case from those captures, inspected for orientation, contact and lighting continuity.

Browser warning/error logs were empty. Verification did not reset or abandon the user's active Rift save and does not claim a complete root-game keyboard/business playthrough. Scene geometry, actor art and gait logic are unchanged.
