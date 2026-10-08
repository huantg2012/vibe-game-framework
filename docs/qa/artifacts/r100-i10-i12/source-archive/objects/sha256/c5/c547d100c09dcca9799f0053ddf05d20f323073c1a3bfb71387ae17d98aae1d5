# Final-source drop evidence

Fresh isolated headless Chrome context on current source service `http://127.0.0.1:3017/`. The original supplied carry fixture was imported verbatim. Real inputs: Enter to continue, Tab to open bag, click **放在脚边**, Esc to close, W held 450 ms to step clear, Esc to pause.

- `06-drop-world.png`: ordinary game frame after the actual committed drop and movement, normal HUD intact.
- `08-paused-world-only-diagnostic.png`: Esc-paused scene with only the DOM overlay temporarily hidden.
- `09-paused-background-only-diagnostic.png`: same paused scene, then ground-item Graphics temporarily hidden as well, including its small ground shadow. Both presentation toggles were restored. These two files are explicitly diagnostic render buffers, not ordinary gameplay frames.
- `drop-measurement.json`: read-only camera, ground position, visibility, inventory binding, and actual Graphics command buffer.
- `evidence.json`: load timestamp, source mtimes/hashes, fixture hash, browser API RGBA hash and local API match. `browser-world-source.rgba` is the browser's actual native 32×32 RGBA byte output.

The page loaded at `2026-09-19T16:49:28.393Z`, after the stable world-faces source mtime `2026-09-19T16:44:52.810Z`. Browser and local `catalogWorldPixels({kind:'shell',appearanceId:'ceramic_seal'})` SHA256 both equal `259a84469d692f7dfe6af2985d588ea1fa1d4c26e11ef7039b42e9656699b3a7`. The browser API was read before the actual drop created its Graphics, in a fresh context with no preexisting module cache.

Paused Graphics center: world `(1486,915)`, logical screen `(480,377)`, screenshot `(720,565.5)`. Camera zoom 1.5 × canvas CSS scale 1.5 = **2.25 screenshot pixels per world pixel**. Visibility and Graphics alpha both 1. Public object remains unidentified `ceramic_seal`; diagnostic internal binding is `amber_beetle`. Precise geometry is for the paused pair; the ordinary frame precedes pause by a few frames.

This is prepared-state/fixture evidence, not natural acquisition. No grants, inventory patches, game-domain setters, source changes, camera edits, light edits, teleport, or forced outcome. One shell on one soil scene at one visible location does not establish whole-catalog or low-visibility acceptance. Browser error list is empty. The author personally viewed all three unedited raw frames.

Earlier `../drop-review/` records are superseded by this final-source capture for rendering checks. The old 3016 refusal is only a service-version exclusion and is not evidence of a current save defect.
