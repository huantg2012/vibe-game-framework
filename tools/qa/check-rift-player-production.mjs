/** Selected A asset/attachment regression gate; browser QA exercises actual Combat. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { decodeLastLightDataPng } from '../../src/entities/player-last-light-png.ts';
import { LAST_LIGHT_ATTACK_SAMPLES, LAST_LIGHT_REST_ARM, lastLightAttackArm, lastLightAttackSampleIndex } from '../../src/entities/player-last-light-combat.ts';
import { LAST_LIGHT_PLAYER_CAMERA } from '../../src/entities/player-last-light-math.ts';
import { projectLastLight } from '../../src/art/last-light-spatial.ts';
import { RIFT_PLAYER_PRESENTATIONS } from '../../src/generated/rift-player-presentations.ts';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds.ts';

const selected = ['cinder-ridge', 'crystal-fibre', 'ruptured-film'];
assert.deepEqual(Object.keys(RIFT_PLAYER_PRESENTATIONS).sort(), selected.map(id => `r100-${id}`).sort());
for (const world of R100_NATIVE_WORLDS) for (const grade of ['low', 'medium', 'severe']) {
  assert.equal(RIFT_PLAYER_PRESENTATIONS[`r100-${world.id}`], selected.includes(world.id) ? 'last-light-a' : undefined,
    `${world.id}/${grade}: presentation selection belongs to the stable package identity`);
}

const root = 'public/assets/player-last-light-a/';
const candidateRoot = 'docs/art/previews/rift-player-models/assets/';
const manifest = JSON.parse(await fs.readFile(root + 'manifest.json', 'utf8'));
const receipt = JSON.parse(await fs.readFile(root + 'export-receipt.json', 'utf8'));
const old = JSON.parse(await fs.readFile(candidateRoot + 'manifest.json', 'utf8')).variants.find(v => v.id === 'a');
const base = manifest.variants[0];
const digest = data => createHash('sha256').update(data).digest('hex');
for (const [file, hash] of Object.entries(receipt.files)) assert.equal(digest(await fs.readFile(root + file)), hash, file);
for (const [file, hash] of Object.entries(receipt.sourceHashes)) assert.equal(digest(await fs.readFile(file)), hash, file);
for (const channel of ['albedo', 'normal', 'material', 'depth', 'contact']) {
  assert.deepEqual(await fs.readFile(root + base.atlas[channel]), await fs.readFile(candidateRoot + old.atlas[channel]), `104 selected ${channel} frames changed`);
}
assert.equal(base.frames.length, 104);
assert.equal(manifest.attackArm.frames.length, 120);
const bounds = new Map();
let opaquePixels = 0;
for (const [name, atlas, frames] of [
  ['a', base.atlas, base.frames],
  ['body', manifest.bodyWithoutArm.atlas, base.frames],
  ['arm', manifest.attackArm.atlas, manifest.attackArm.frames],
]) {
  const { data, info } = await sharp(root + atlas.albedo).raw().toBuffer({ resolveWithObject: true });
  const material = await fs.readFile(root + atlas.material);
  assert.deepEqual(Buffer.from((await decodeLastLightDataPng(material)).data), await sharp(material).raw().toBuffer(), `${name} material premultiplication`);
  for (const frame of frames) {
    let xMin = 64, xMax = -1, yMin = 80, yMax = -1;
    for (let y = 0; y < 80; y++) for (let x = 0; x < 64; x++) {
      const alpha = data[((frame.rect[1] + y) * info.width + frame.rect[0] + x) * 4 + 3];
      assert(alpha === 0 || alpha === 255);
      if (!alpha) continue;
      opaquePixels++;
      xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
    }
    assert(xMax >= xMin && yMax >= yMin, `${name}/${frame.key} is empty`);
    assert(xMin > 0 && yMin > 0 && xMax < 63 && yMax < 79, `${name}/${frame.key} clips`);
    bounds.set(name + frame.key, [xMin, yMin, xMax, yMax]);
    for (const coordinate of ['wrist', 'shoulder']) {
      const projected = projectLastLight(frame[coordinate + 'World'], LAST_LIGHT_PLAYER_CAMERA);
      projected.forEach((value, index) => assert(Math.abs(value - frame[coordinate][index]) < 1e-9, `${name} ${coordinate} detached from skeleton`));
    }
  }
}
let movingCombinations = 0;
for (const frame of base.frames) for (const arm of manifest.attackArm.frames.filter(a => a.yawIndex === frame.yawIndex)) {
  const dx = Math.round(frame.shoulder[0] - arm.shoulder[0]);
  const dy = Math.round(frame.shoulder[1] - arm.shoulder[1]);
  const [xMin, yMin, xMax, yMax] = bounds.get('arm' + arm.key);
  assert(xMin + dx > 0 && xMax + dx < 63 && yMin + dy > 0 && yMax + dy < 79, 'Walking plus swing clips the body frame');
  movingCombinations++;
}
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
for (const sample of LAST_LIGHT_ATTACK_SAMPLES) {
  const arm = lastLightAttackArm(sample.phase, sample.progress);
  assert(Math.abs(distance(arm.shoulder, arm.elbow) - distance(LAST_LIGHT_REST_ARM.shoulder, LAST_LIGHT_REST_ARM.elbow)) < 1e-9, 'Upper arm stretches');
  assert(Math.abs(distance(arm.elbow, arm.wrist) - distance(LAST_LIGHT_REST_ARM.elbow, LAST_LIGHT_REST_ARM.wrist)) < 1e-9, 'Forearm stretches');
}
const pose = { phase: 'active', elapsedMs: 170, facing: 0, windupMs: 100, activeMs: 120, recoveryMs: 200, contactHoldMs: 60, contactRemainingMs: 40, contactElapsedMs: 140 };
assert.equal(lastLightAttackSampleIndex(pose), lastLightAttackSampleIndex({ ...pose, elapsedMs: 220 }), 'Contact hold must freeze the actual hand, not just weapon');
assert.equal(lastLightAttackSampleIndex({ ...pose, phase: 'idle' }), -1, 'Death/cancel idle must release attack pose');
for (const [phase, elapsedMs] of [['windup', 50], ['active', 160], ['recovery', 320]]) {
  const index = lastLightAttackSampleIndex({ ...pose, phase, elapsedMs, contactRemainingMs: 0 });
  assert.equal(LAST_LIGHT_ATTACK_SAMPLES[index].phase, phase);
}
console.log(JSON.stringify({ pass: true, originalFramesByteIdentical: 104, atlasFiles: 13, movingAttackCombinations: movingCombinations, opaquePixels, checks: ['source and image hashes', 'straight material data decoding', 'opaque bounds', 'true skeleton grip and shoulder', 'fixed arm lengths', 'contact freeze and cancellation'] }));
