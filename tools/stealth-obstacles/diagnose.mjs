/** Diagnose stored medium-grade maps without consulting today's authoring CSV. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {diagnoseWorld} from './diagnostics.ts';
import {readStoredMap, exactHash, sha256} from './baseline.mjs';

const input = process.argv[2], output = process.argv[3], requestFile = process.argv[4];
assert(input && output && !fs.existsSync(output), 'Usage: diagnose.mjs BASELINE_DIR NEW_OUTPUT_DIR [REQUESTS.json]');
const baseline = JSON.parse(fs.readFileSync(path.join(input, 'baseline.json'), 'utf8'));
assert.equal(baseline.status, 'passed');
const cases = baseline.cases.filter(row => row.grade === 'medium');
assert(cases.length > 0 && cases.length <= 5);
const requests = requestFile ? JSON.parse(fs.readFileSync(requestFile, 'utf8')) : {};
fs.mkdirSync(output, {recursive: true});
const summary = {status: 'running', sourceBaseline: input, baselineSha256: sha256(fs.readFileSync(path.join(input, 'baseline.json'))), cases: []};
for (const item of cases) {
  const id = `${item.worldId}-${item.grade}-${item.seed}`, directory = path.join(output, id);
  fs.mkdirSync(directory);
  const map = readStoredMap(path.join(input, id, 'map.v8.gz'));
  assert.equal(exactHash(map), item.mapHash, 'Stored map changed');
  const result = diagnoseWorld(map, requests[item.worldId]);
  fs.writeFileSync(path.join(directory, 'diagnostics.json'), JSON.stringify(result.report, null, 2) + '\n', {flag: 'wx'});
  fs.writeFileSync(path.join(directory, 'field.v8.gz'), gzipSync(serialize(result.field)), {flag: 'wx'});
  const marks = result.report.clearPeaks.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="12" fill="#ffcc55" stroke="black"/><text x="${p.x + 17}" y="${p.y - 12}">C${i + 1}: ${Math.round(p.clearRadiusPx)} / S${Math.round(p.solidDistancePx)} / V${Math.round(p.voidDistancePx)}</text>`).join('');
  const regions = result.report.regions.map(r => `<rect x="${r.bounds[0]}" y="${r.bounds[1]}" width="${r.bounds[2] - r.bounds[0]}" height="${r.bounds[3] - r.bounds[1]}" fill="none" stroke="#62ccff" stroke-width="3"/>`).join('');
  const routes = result.report.routes.filter(r => r.passed).map(r => `<polyline points="${r.path.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#7cf6ae" stroke-width="3"/>`).join('');
  const detours = result.report.detours.filter(r => r.passed).map(r => [r.sideA,r.sideB].map((side,index)=>`<polyline points="${side.path.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${index?'#ec8dff':'#5de5ff'}" stroke-width="4"/>`).join('')).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${result.report.width}" height="${result.report.height}"><g font-family="sans-serif" font-size="20" fill="white" stroke="black" stroke-width="4" paint-order="stroke">${regions}${routes}${detours}${marks}</g></svg>`;
  await sharp(path.join(input, id, 'intact-material.png')).composite([{input: Buffer.from(svg)}]).png().toFile(path.join(directory, 'clearance-points.png'));
  summary.cases.push({worldId: item.worldId, grade: item.grade, seed: item.seed, metrics: result.report.metrics,
    regions: result.report.regions, clearPeaks: result.report.clearPeaks.slice(0, 4), routePasses: result.report.routes.filter(r => r.passed).length,
    routeFailures: result.report.routes.filter(r => !r.passed).map(r => r.id), detourPasses: result.report.detours.filter(r => r.passed).length,
    detourFailures: result.report.detours.filter(r => !r.passed).map(r => r.id), output: directory});
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary.cases.at(-1))); global.gc?.();
}
summary.status = summary.cases.some(row => row.routeFailures.length || row.detourFailures.length) ? 'failed' : 'passed';
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
if (summary.status === 'failed') process.exitCode = 1;
