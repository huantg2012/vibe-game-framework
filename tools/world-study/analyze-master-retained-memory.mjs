/** Reproducible independent object-graph checks over the captured CDP heaps. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const directory = path.resolve(process.argv[2] ?? 'docs/qa/artifacts/rift-r100-i02-validation/memory');
const snapshots = [];
for (const label of ['warmed-baseline', 'same-case-final', 'mixed-final']) {
  const raw = gunzipSync(await readFile(path.join(directory, `${label}.heapsnapshot.json.gz`)));
  const graph = JSON.parse(raw);
  const fields = graph.snapshot.meta.node_fields, edges = graph.snapshot.meta.edge_fields;
  const nw = fields.length, ew = edges.length;
  const ni = fields.indexOf('name'), ti = fields.indexOf('type'), si = fields.indexOf('self_size');
  const ci = fields.indexOf('edge_count'), ii = fields.indexOf('id');
  const en = edges.indexOf('name_or_index'), et = edges.indexOf('type'), to = edges.indexOf('to_node');
  const nodeTypes = graph.snapshot.meta.node_types[ti], edgeTypes = graph.snapshot.meta.edge_types[et];
  const offset = new Uint32Array(graph.nodes.length / nw);
  let edgeOffset = 0;
  for (let n = 0; n < graph.nodes.length; n += nw) { offset[n / nw] = edgeOffset; edgeOffset += graph.nodes[n + ci] * ew; }
  function node(n) { return { id: graph.nodes[n + ii], type: nodeTypes[graph.nodes[n + ti]], name: graph.strings[graph.nodes[n + ni]], selfBytes: graph.nodes[n + si] }; }
  function outgoing(n) {
    const result = [], start = offset[n / nw];
    for (let e = start; e < start + graph.nodes[n + ci] * ew; e += ew) {
      const type = edgeTypes[graph.edges[e + et]];
      result.push({ edgeType: type, key: ['element', 'hidden'].includes(type) ? graph.edges[e + en] : graph.strings[graph.edges[e + en]], to: graph.edges[e + to], ...node(graph.edges[e + to]) });
    }
    return result;
  }
  const groups = new Map(), materials = [], worlds = [];
  for (let n = 0; n < graph.nodes.length; n += nw) {
    const item = node(n), key = `${item.type}:${item.name}`;
    const row = groups.get(key) ?? { type: item.type, name: item.name, count: 0, selfBytes: 0 };
    row.count++; row.selfBytes += item.selfBytes; groups.set(key, row);
    if (item.type !== 'object' || item.name !== 'Object') continue;
    const values = outgoing(n), property = name => values.find(value => value.edgeType === 'property' && value.key === name);
    const pixels = property('pixels'), source = property('source');
    if (pixels?.name === 'Uint8ClampedArray' && /^\/assets\/r100-materials\//.test(source?.name ?? '')) {
      const buffer = outgoing(pixels.to).find(value => value.key === 'buffer');
      assert(buffer, 'Material pixels need an ArrayBuffer');
      const backing = outgoing(buffer.to).find(value => value.key === 'backing_store');
      assert(backing, 'Material buffer backing must be present in the heap graph');
      materials.push({ objectId: item.id, source: source.name, pixelsId: pixels.id, bufferId: buffer.id, backingId: backing.id, bytes: backing.selfBytes });
    }
    // V8 literal boilerplates have the same property names but system/Hole
    // values; they are code templates, not retained world instances.
    if (['definition', 'meshes', 'raster', 'matterAt', 'roleAt', 'diagnostics'].every(name => property(name) && property(name).name !== 'system / Hole')) worlds.push({ objectId: item.id, rasterId: property('raster').id, definition: outgoing(property('definition').to).find(value => value.key === 'id')?.name });
  }
  const all = [...groups.values()].sort((a, b) => b.selfBytes - a.selfBytes);
  const classes = all.filter(row => /MasterPresentation|MasterSurfaceRenderer|MasterMaterialAudio|HTMLCanvasElement|CanvasRendering|WebGL|AudioBuffer|AudioContext|ArrayBuffer|RiftScene|TextureManager/.test(row.name) && ['object', 'native'].includes(row.type));
  // Source-map strings can be megabytes long; the raw immutable heaps retain them.
  const largestGroups = all.slice(0, 35).map(row => row.name.length <= 256 ? row : { ...row, name: `${row.name.slice(0, 256)}…`, fullNameLength: row.name.length, fullNameSha256: createHash('sha256').update(row.name).digest('hex') });
  const summary = { label, nodeCount: graph.snapshot.node_count, edgeCount: graph.snapshot.edge_count,
    snapshotSha256: createHash('sha256').update(raw).digest('hex'), worlds, materials: materials.sort((a, b) => a.source.localeCompare(b.source)),
    materialBackingBytes: materials.reduce((sum, value) => sum + value.bytes, 0), classes, largestGroups };
  assert.equal(worlds.length, 1, `${label}: exactly one retained MasterWorld`);
  assert.equal(materials.length, 3, `${label}: exactly three prepared material caches`);
  assert.equal(summary.materialBackingBytes, 3 * 1024 ** 2, `${label}: three real 512² RGBA buffers`);
  for (const name of ['MasterPresentation', 'MasterSurfaceRenderer', 'MasterMaterialAudio', 'RiftScene', 'TextureManager2']) assert.equal(classes.find(row => row.type === 'object' && row.name === name)?.count, 1, `${label}: ${name} count`);
  for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext', 'AudioContext']) assert.equal(classes.find(row => row.type === 'native' && row.name === name)?.count, 1, `${label}: native ${name}`);
  snapshots.push(summary);
  await writeFile(path.join(directory, `${label}-heap-summary.json`), JSON.stringify(summary, null, 2));
}
for (const sample of snapshots.slice(1)) {
  assert.deepEqual(sample.materials, snapshots[0].materials, `${sample.label}: same cached material objects and backing stores`);
  assert.equal(sample.classes.find(row => row.type === 'native' && row.name === 'system / JSArrayBufferData')?.selfBytes, snapshots[0].classes.find(row => row.type === 'native' && row.name === 'system / JSArrayBufferData')?.selfBytes, 'No native typed-buffer backing growth');
}
const report = JSON.parse(await readFile(path.join(directory, 'controlled-gc-memory.json'), 'utf8'));
report.snapshots = snapshots;
report.objectGraphAudit = { status: 'pass-with-stated-scope', method: 'Heap-node/edge traversal after controlled GC; actual material pixels → buffer → backing_store, same heap object IDs across snapshots', oneWorldPerSnapshot: true, onePresentationRendererAudioPerSnapshot: true, sameThreeMaterialBackings: true, materialBackingBytes: 3 * 1024 ** 2, nativeArrayBufferBackingBytes: snapshots[0].classes.find(row => row.type === 'native' && row.name === 'system / JSArrayBufferData').selfBytes };
await writeFile(path.join(directory, 'controlled-gc-memory.json'), JSON.stringify(report, null, 2));
await writeFile(path.join(directory, 'heap-graph-audit.json'), JSON.stringify({ ...report.objectGraphAudit, snapshots: snapshots.map(({ label, worlds, materials, materialBackingBytes }) => ({ label, worlds, materials, materialBackingBytes })) }, null, 2));
console.log(JSON.stringify(report.objectGraphAudit, null, 2));
