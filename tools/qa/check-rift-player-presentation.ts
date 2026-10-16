import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { decodeLastLightDataPng } from '../../src/entities/player-last-light-png';
import { LAST_LIGHT_PLAYER_CAMERA as camera, LAST_LIGHT_PLAYER_BASIS as basis,
  lastLightToNative, lastLightScreenHeading, nearestLastLightYaw } from '../../src/entities/player-last-light-math';
import { projectLastLight, unprojectLastLight, type LightVector } from '../../src/art/last-light-spatial';

const root = 'docs/art/previews/rift-player-models/assets/';
const manifest = JSON.parse(await fs.readFile(root + 'manifest.json', 'utf8'));
const variant = manifest.variants.find((value: {id: string}) => value.id === 'a');
const materialBytes = await fs.readFile(root + variant.atlas.material);
const decoded = await decodeLastLightDataPng(materialBytes);
const reference = await sharp(materialBytes).ensureAlpha().raw().toBuffer();
assert.equal(decoded.width, 832); assert.equal(decoded.height, 640);
assert.deepEqual(Buffer.from(decoded.data), reference, 'Browser data decoder must preserve every channel including zero-alpha RGB');
let hiddenAo = 0;
for (let i = 0; i < reference.length; i += 4) if (reference[i + 3] === 0 && reference[i + 2]! > 0) hiddenAo++;
assert(hiddenAo > 10_000, 'The regression fixture must contain substantial non-emissive AO at alpha zero');
await assert.rejects(() => decodeLastLightDataPng(materialBytes.subarray(0, 70)), /Truncated|Incomplete/);

const original: LightVector = [.27, 1.31, -.18];
const projected = projectLastLight(original, camera, basis);
const reconstructed = unprojectLastLight(...projected, camera, basis);
for (let i = 0; i < 3; i++) assert(Math.abs(original[i]! - reconstructed[i]!) < 1e-10);
const native = lastLightToNative(original);
assert(Math.abs(Math.hypot(...native) - Math.hypot(...original)) < 1e-10, 'Axis remap must be an orthonormal rotation');
assert.deepEqual(lastLightToNative([0, 1, 0]), [0, 0, 1], 'Source Y up must map to native Z up');
const front = Math.atan2(19, 30);
const headings = Array.from({length: 8}, (_, i) => lastLightScreenHeading(front + i * Math.PI / 4));
assert.equal(nearestLastLightYaw(Math.PI / 2, headings), 0, 'Screen-down movement uses the real front view');
assert.equal(nearestLastLightYaw(0, headings), 2, 'Screen-right uses source yaw +pi/2');
assert.equal(nearestLastLightYaw(-Math.PI / 2, headings), 4, 'Screen-up uses the back');
assert.equal(nearestLastLightYaw(Math.PI, headings), 6, 'Screen-left uses lamp side');
for (let i = 0; i < headings.length; i++) assert.equal(nearestLastLightYaw(headings[i]!, headings), i);
for (let index = 0; index < 104; index++) {
  const frame = variant.frames[index];
  assert.equal(frame.yawIndex, Math.floor(index / 13));
  assert.equal(frame.pose, index % 13 === 0 ? 'idle' : 'walk');
  assert.deepEqual(frame.foot, [32, 66]);
  assert.equal(frame.rect[0], index % 13 * 64); assert.equal(frame.rect[1], Math.floor(index / 13) * 80);
  assert(lastLightToNative(frame.lampWorld)[2] > 1.2, 'Shoulder lamp cannot regress to the foot');
}
console.log(JSON.stringify({ pass: true, checks: ['RGBA data PNG exact decoded bytes', 'truncation rejection', 'source camera inverse', 'orthonormal Y-up to Z-up', 'eight projected headings and four keyboard axes', '104 frame anchors and shoulder heights'], preservedZeroAlphaAoPixels: hiddenAo }));
