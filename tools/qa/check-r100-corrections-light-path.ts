/** Compare the actual production GLSL function with the master surface contract.
 * No visual approval: this only proves that a material reflection cannot cross
 * an eaten-light corner which the same world's surface path rejects. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { hasMasterMatterPath } from '../../src/dev/rift-r100-masters/visibility';

const sourcePath = process.env.R100_SHADER_SOURCE ?? 'src/systems/r100-world/surface-renderer.ts';
const source = await readFile(sourcePath, 'utf8');
const start = source.indexOf('bool darkCell('), end = source.indexOf('float heightAt(');
assert(start >= 0 && end > start, 'actual shader light-path function must be present');
const shader = source.slice(start, end);
const cases = [
  { name: 'clear diagonal', cells: [1, 1, 1, 1], from: [4, 4], to: [12, 12] },
  { name: 'single east corner', cells: [1, 0, 1, 1], from: [4, 4], to: [12, 12] },
  { name: 'single south corner', cells: [1, 1, 0, 1], from: [4, 4], to: [12, 12] },
  { name: 'both corner cells', cells: [1, 0, 0, 1], from: [4, 4], to: [12, 12] },
  { name: 'single corner reversed', cells: [1, 0, 1, 1], from: [12, 12], to: [4, 4] },
  { name: 'direct black cell', cells: [1, 0, 1, 1], from: [4, 4], to: [12, 4] },
  { name: 'clear horizontal', cells: [1, 1, 0, 1], from: [4, 4], to: [12, 4] },
];
const modulePath = process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
let results: { name: string; expected: boolean; actual: boolean }[] = [];
try {
  const page = await browser.newPage();
  // tsx preserves nested function names with this helper when serializing the
  // evaluate callback; install the same inert naming helper in the page realm.
  await page.evaluate('globalThis.__name = (target, name) => Object.defineProperty(target, "name", { value: name, configurable: true })');
  const gpu: boolean[] = await page.evaluate(({ shader, cases }: { shader: string; cases: { cells: number[]; from: number[]; to: number[] }[] }) => {
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true })!;
    if (!gl) throw new Error('WebGL2 unavailable');
    const compile = (type: number, body: string): WebGLShader => {
      const s = gl.createShader(type)!; gl.shaderSource(s, body); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)!);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}'));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;uniform sampler2D albedoMap;uniform vec2 size,origin,target;out vec4 color;\n' + shader + '\nvoid main(){float value=materialLightPath(origin,target);color=vec4(value,value,value,1.);}'));
    gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)!);
    gl.useProgram(program); gl.uniform2f(gl.getUniformLocation(program, 'size'), 16, 16);
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return cases.map(test => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(test.cells.flatMap(v => [255, 255, 255, v * 255])));
      gl.uniform2f(gl.getUniformLocation(program, 'origin'), test.from[0]!, test.from[1]!);
      gl.uniform2f(gl.getUniformLocation(program, 'target'), test.to[0]!, test.to[1]!);
      gl.drawArrays(gl.TRIANGLES, 0, 3); const bytes = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      return bytes[0]! > 127;
    });
  }, { shader, cases });
  results = cases.map((test, index) => ({ name: test.name, actual: gpu[index]!, expected: hasMasterMatterPath(Uint8Array.from(test.cells), 2, 2, 8, test.from[0]!, test.from[1]!, test.to[0]!, test.to[1]!) }));
} finally { await browser.close(); }
const report = { sourcePath, sourceHash: createHash('sha256').update(source).digest('hex'), shaderLightPath: shader, cases, status: results.every(row => row.actual === row.expected) ? 'pass' : 'fail', results };
if (process.env.QA_OUTPUT_FILE) {
  const { dirname } = await import('node:path'); await mkdir(dirname(process.env.QA_OUTPUT_FILE), { recursive: true });
  await writeFile(process.env.QA_OUTPUT_FILE, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
assert(results.every(row => row.actual === row.expected), 'material-light GLSL must obey the master supercover path');
