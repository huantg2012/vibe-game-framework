# Catalog native-32 formal drop evidence

This is an isolated saved-fixture replay, not evidence of natural acquisition. The supplied `docs/qa/artifacts/iteration-28/browser/natural-current/03-carry.storage.json` was imported verbatim into a new headless Chrome context. No inventory grants, storage patches, game-domain setters, teleports, forced outcomes, or source changes were used.

## Actual input and observed result

1. Attempted Continue with Enter on `http://127.0.0.1:3016/`. That obsolete bundled build (`main--rkW9UpZ.js`) rejected the snapshot. `00-menu.png` and `01-resumed.png` record this version mismatch only; they do not establish a current save defect.
2. Root confirmed the current source service is `http://127.0.0.1:3017/`. Navigated there with the same fixture import script (new origin storage), pressed Enter, and entered the saved active Rift.
3. Pressed B because the expanded controls named B; it did not open the bag. Pressed Tab and the real bag opened (`04-bag-before-drop.png`).
4. Clicked the actual **放在脚边** button for the unidentified 陶封块, waited for the committed bag state (`05-drop-committed-bag.png`), pressed Esc to close, then held W for 450 ms to step clear of the object. `06-drop-world.png` is the unmodified formal world frame with normal HUD.
5. Pressed Esc to pause (`07-paused-drop.png`). No simulation time or light state was changed programmatically.

## Paired diagnostic render

- `08-paused-world-only-diagnostic.png`: same paused scene, only DOM overlay visibility temporarily hidden.
- `09-paused-background-only-diagnostic.png`: then additionally hid the already-created ground-item Graphics visual. This also hides its small ground shadow. Both presentation toggles were restored afterwards.
- These are unedited browser screenshots, explicitly diagnostic render variants, not ordinary gameplay frames. No saved/domain state, actor, camera, lighting, or game source was changed.
- Screenshot pair differs only within `[693,542]–[743,590]`, 2,020 screen pixels changed; zero differences outside the 80×80 drop ROI. The pair is suitable for comparison against the actual background at this fixed scene state.

## Recorded geometry

See `drop-measurement.json` for read-only scene data. The paused Graphics origin is world `(1486,915)`, logical screen `(480,377)`, screenshot `(720,565.5)`. Original ledger drop point retains fractional player coordinates. Visibility and Graphics alpha are both 1. Native source is 32×32; camera zoom 1.5 and canvas-to-CSS scale 1.5 give **2.25 screenshot pixels per world pixel**. This is not an integer screen-scale test.

Public model: unidentified `ceramic_seal`. Internal definition `amber_beetle` is recorded only as diagnostic context and was not revealed to the player. `06-drop-world.png` precedes the pause by a few frames; precise paused coordinates apply to the 08/09 pair.

## Scope and limitations

- One shell, one soil scene, one full-visibility location; not coverage of all catalog models, fragments, light sources, or visibility boundaries.
- The author personally viewed 06, 08 and 09 at native screenshot resolution. The shell silhouette is visible below the player. No user aesthetic PASS or identification study is claimed.
- `journey.jsonl` records actual key input and screenshots. `errors.jsonl` contains only the attempted read-only source import against the obsolete 3016 bundled server; it is not a gameplay failure on 3017.
- Initial Chrome launch was blocked by the workspace sandbox; the authorized local-QA escalation then succeeded. The browser uses an isolated temporary profile.
