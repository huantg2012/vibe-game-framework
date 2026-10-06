/** Positive frozen-source proof and adversarial cases, without baking assets. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { assertRemainsSourceContinuity } from './r100-remains-source-continuity.mjs';

const arg = name => { const i = process.argv.indexOf(name); assert(i >= 0 && process.argv[i + 1]); return process.argv[i + 1]; };
const sourcePath = arg('--from'), output = arg('--output'), source = JSON.parse(fs.readFileSync(sourcePath));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ref = file => ({ path: file, sha256: sha(fs.readFileSync(file)) });
const file = 'src/generation/world-study/search-remains.ts', oldFile = path.join(source.temporaryRoot, file);
assert.equal(sha(fs.readFileSync(oldFile)), source.sources[file]);
const before = fs.readFileSync(oldFile, 'utf8'), after = fs.readFileSync(file, 'utf8');
const generated = 'src/generated/rift-search-remains.ts';
function rows(text) {
  const ast = ts.createSourceFile(generated, text, ts.ScriptTarget.Latest, true);
  const row = ast.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).find(node => node.name.getText(ast) === 'SEARCH_REMAINS');
  assert(row?.initializer); let node = row.initializer;
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
  return JSON.parse(node.getText(ast));
}
const oldRows = rows(fs.readFileSync(path.join(source.temporaryRoot, generated), 'utf8')), newRows = rows(fs.readFileSync(generated, 'utf8'));
for (const row of oldRows) assert.deepEqual(newRows.find(value => value.worldId === row.worldId), row);
const result = assertRemainsSourceContinuity(before, after, oldRows.map(row => row.grammar));
const mutate = (needle, value) => { assert(after.includes(needle), `Missing mutation target ${needle}`); return after.replace(needle, value); };
const negatives = [
  ['changed existing pixels', mutate('[[4, 17], [12, 13]', '[[5, 17], [12, 13]')],
  ['changed delegated seed', mutate('return createSearchRemainsGrammarPixels(profile, seed,', 'return createSearchRemainsGrammarPixels(profile, seed + 1,')],
  ['added global execution', after + '\nconsole.log("unrelated");\n'],
  ['new branch hoisted variable', mutate("case 'compressed-fibre-fragments': {", "case 'compressed-fibre-fragments': { var hidden = 1;")],
  ['new branch nonliteral argument', mutate('[[3, 14], [7, 11]', '[[Math.random(), 14], [7, 11]')],
  ['missing explicit unknown rejection', mutate('unsupported source grammar', 'unexpected source grammar')],
  ['wrong grammar parameter type', mutate('grammar: SearchRemainsGrammar,', 'grammar: string,')],
  ['missing old row guard', mutate('if (!definition) throw new Error', 'if (false) throw new Error')],
  ['additional renderer statement', mutate('if (!Number.isInteger(seed)', 'pixelsChanged(); if (!Number.isInteger(seed)')],
];
for (const [name, text] of negatives) assert.throws(() => assertRemainsSourceContinuity(before, text, result.selectedGrammars), undefined, name);
assert.throws(() => assertRemainsSourceContinuity(before, after, ['compressed-fibre-fragments']), undefined, 'Cannot inherit a newly selected grammar');
assert.throws(() => assertRemainsSourceContinuity(before, after, []), undefined, 'Empty selection is not evidence');
assert(!fs.existsSync(output)); fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ status: 'pass', source: ref(sourcePath), oldRenderer: {path: oldFile, sha256: source.sources[file]},
  currentRenderer: ref(file), currentRows: ref(generated), worlds: oldRows.map(row => row.worldId), ...result,
  positiveCases: 1, negativeCases: negatives.length + 2, checks: negatives.map(([name]) => name).concat(['new grammar cannot inherit', 'empty selection rejected']),
  harness: ref('tools/qa/check-r100-remains-source-continuity.mjs'), helper: ref('tools/qa/r100-remains-source-continuity.mjs'),
  scope: 'All old drawing statements, wrapper arguments, global state and helpers are AST-exact after the narrowly specified extraction. No new grammar visual approval or new pixel bake is claimed.' }, null, 2) + '\n');
console.log(`PASS remains source continuity: ${oldRows.length} selected old rows, seven unchanged branches, 11 adversarial cases`);
