/** Prove the bounded extraction of the seven accepted remains grammars.
 * This permits two unused, literal drawing branches, never new world approval. */
import assert from 'node:assert/strict';
import ts from 'typescript';

export const UNUSED_REMAINS_GRAMMARS = ['compressed-fibre-fragments', 'porous-core-chips'];
const ACCEPTED_GRAMMARS = ['laminated-flakes', 'fractured-fibres', 'glaze-shell', 'mineral-splinters', 'packed-granules', 'torn-membrane', 'gel-fragments'];

export function assertRemainsSourceContinuity(beforeText, afterText, selectedGrammars) {
  const parse = text => ts.createSourceFile('search-remains.ts', text, ts.ScriptTarget.Latest, true);
  const before = parse(beforeText), after = parse(afterText), printer = ts.createPrinter({ removeComments: true });
  assert.equal(before.parseDiagnostics.length, 0); assert.equal(after.parseDiagnostics.length, 0);
  const print = (node, ast) => printer.printNode(ts.EmitHint.Unspecified, node, ast);
  const named = (ast, name) => {
    const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(nodes.length, 1, `Exactly one ${name}`); return nodes[0];
  };
  const original = named(before, 'createSearchRemainsPixels');
  const wrapper = named(after, 'createSearchRemainsPixels');
  const grammar = named(after, 'createSearchRemainsGrammarPixels');
  const outside = (ast, names) => ast.statements.filter(node => !(ts.isFunctionDeclaration(node) && names.includes(node.name?.text)))
    .map(node => print(node, ast));
  assert.deepEqual(outside(before, ['createSearchRemainsPixels']), outside(after, ['createSearchRemainsPixels', 'createSearchRemainsGrammarPixels']),
    'Imports, global state and all other remains functions must be exact');
  assert.equal(original.parameters.length, 3); assert.equal(wrapper.parameters.length, 3); assert.equal(grammar.parameters.length, 4);
  assert.deepEqual(wrapper.parameters.map(node => print(node, after)), original.parameters.map(node => print(node, before)));
  assert.deepEqual([grammar.parameters[0], grammar.parameters[1], grammar.parameters[3]].map(node => print(node, after)), original.parameters.map(node => print(node, before)));
  assert.equal(print(grammar.parameters[2], after), 'grammar: SearchRemainsGrammar');
  assert.equal(print(wrapper.type, after), print(original.type, before)); assert.equal(print(grammar.type, after), print(original.type, before));
  for (const fn of [wrapper, grammar]) assert.equal(fn.modifiers?.map(node => node.kind).join(','), original.modifiers?.map(node => node.kind).join(','));
  assert.equal(wrapper.body.statements.length, 3);
  assert.deepEqual(wrapper.body.statements.slice(0, 2).map(node => print(node, after)), original.body.statements.slice(0, 2).map(node => print(node, before)));
  assert.equal(print(wrapper.body.statements[2], after), 'return createSearchRemainsGrammarPixels(profile, seed, definition.grammar, painting);');
  const oldSwitches = original.body.statements.filter(ts.isSwitchStatement), newSwitches = grammar.body.statements.filter(ts.isSwitchStatement);
  assert.equal(oldSwitches.length, 1); assert.equal(newSwitches.length, 1);
  const oldSwitch = oldSwitches[0], newSwitch = newSwitches[0];
  const label = clause => ts.isCaseClause(clause) && ts.isStringLiteral(clause.expression) ? clause.expression.text : null;
  const oldNames = oldSwitch.caseBlock.clauses.map(label);
  assert.deepEqual(oldNames, ACCEPTED_GRAMMARS);
  assert(selectedGrammars.length && selectedGrammars.every(name => oldNames.includes(name)), 'Selected worlds must use accepted old grammars');
  assert.deepEqual(newSwitch.caseBlock.clauses.map(label), [...oldNames, ...UNUSED_REMAINS_GRAMMARS, null]);
  const literal = node => ts.isStringLiteral(node) || ts.isNumericLiteral(node)
    || ts.isArrayLiteralExpression(node) && node.elements.every(literal)
    || ts.isPrefixUnaryExpression(node) && [ts.SyntaxKind.MinusToken, ts.SyntaxKind.PlusToken].includes(node.operator) && ts.isNumericLiteral(node.operand);
  for (const clause of newSwitch.caseBlock.clauses.slice(7, 9)) {
    assert.equal(clause.statements.length, 1); const block = clause.statements[0]; assert(ts.isBlock(block));
    assert(ts.isBreakStatement(block.statements.at(-1)) && !block.statements.at(-1).label);
    for (const statement of block.statements.slice(0, -1)) {
      assert(ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression));
      const call = statement.expression;
      assert(ts.isIdentifier(call.expression) && ['fill', 'plate'].includes(call.expression.text) && call.arguments.every(literal),
        'Unused additions may contain only literal fill/plate calls; no declarations or global effects');
    }
  }
  assert.equal(print(newSwitch.caseBlock.clauses.at(-1), after), 'default: throw new Error(`Search remains: unsupported source grammar ${String(grammar)}`);');
  // Normalize only the two former definition.grammar reads and the equivalent
  // returned property. Every accepted drawing statement then compares exactly.
  let replacements = 0;
  const transformed = ts.transform(original.body, [context => {
    const visit = node => {
      if (ts.isPropertyAccessExpression(node) && node.expression.getText(before) === 'definition' && node.name.text === 'grammar') {
        replacements++; return ts.factory.createIdentifier('grammar');
      }
      if (ts.isPropertyAssignment(node) && node.name.getText(before) === 'grammar'
        && ts.isPropertyAccessExpression(node.initializer) && node.initializer.getText(before) === 'definition.grammar') {
        replacements++; return ts.factory.createShorthandPropertyAssignment('grammar');
      }
      return ts.visitEachChild(node, visit, context);
    }; return node => ts.visitNode(node, visit);
  }]);
  assert.equal(replacements, 2);
  const expected = transformed.transformed[0].statements.slice(2).map(node => print(node, before));
  const actual = grammar.body.statements.map(node => node === newSwitch
    ? ts.factory.updateSwitchStatement(node, node.expression, ts.factory.updateCaseBlock(node.caseBlock, node.caseBlock.clauses.slice(0, 7))) : node)
    .map(node => print(node, after));
  assert.deepEqual(actual, expected, 'Accepted remains renderer changed');
  transformed.dispose();
  return { acceptedGrammars: oldNames, unusedGrammars: [...UNUSED_REMAINS_GRAMMARS], selectedGrammars: [...new Set(selectedGrammars)].sort(),
    rule: 'Only pure grammar extraction, equivalent delegation and two unselected literal drawing branches; all accepted statements and external code exact.' };
}
