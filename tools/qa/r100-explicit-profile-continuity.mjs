/** Prove the default paths stay exact when opt-in tear/settled profiles are added.
 * This is a source proof for unselected profiles, never approval of new shapes. */
import assert from 'node:assert/strict';
import ts from 'typescript';

const printer = ts.createPrinter({removeComments: true});
const profiles = ['pleated-tear', 'settled-sheet', 'settled-fan'];
const parse = text => {
  const ast = ts.createSourceFile('source.ts', text, ts.ScriptTarget.Latest, true);
  assert.equal(ast.parseDiagnostics.length, 0); return ast;
};
const print = (node, ast) => printer.printNode(ts.EmitHint.Unspecified, node, ast).trim();
const one = text => { const ast = parse(text); assert.equal(ast.statements.length, 1); return print(ast.statements[0], ast); };
const importFrom = (node, value) => ts.isImportDeclaration(node)
  && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === value;
const unwrap = node => ts.isAsExpression(node) || ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;

function assertInertModule(text, exportedNames) {
  const ast = parse(text), exports = [];
  const inert = node => ts.isArrowFunction(node) || ts.isFunctionExpression(node)
    || ts.isNumericLiteral(node) || ts.isStringLiteral(node)
    || ts.isArrayLiteralExpression(node) && node.elements.every(inert);
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement)) {
      assert(statement.importClause?.isTypeOnly, 'New profile module imports types only'); continue;
    }
    if (ts.isFunctionDeclaration(statement)) {
      assert(statement.name && statement.body);
      if (statement.modifiers?.some(item => item.kind === ts.SyntaxKind.ExportKeyword)) exports.push(statement.name.text);
      continue;
    }
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
    assert(ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const), 'No profile top-level execution');
    for (const declaration of statement.declarationList.declarations)
      assert(ts.isIdentifier(declaration.name) && declaration.initializer && inert(unwrap(declaration.initializer)), 'No executed profile initializer');
  }
  assert.deepEqual(exports.sort(), [...exportedNames].sort(), 'New runtime exports require separate review');
}

function profileList(statement, ast, name, added) {
  if (!ts.isVariableStatement(statement) || !statement.declarationList.declarations.some(d => d.name.getText(ast) === name)) return null;
  assert.equal(statement.declarationList.declarations.length, 1);
  const declaration = statement.declarationList.declarations[0], array = unwrap(declaration.initializer);
  assert(ts.isArrayLiteralExpression(array) && array.elements.every(ts.isStringLiteral));
  const ids = array.elements.map(item => item.text);
  if (added.length) { assert.deepEqual(ids.slice(-added.length), added); ids.splice(-added.length); }
  assert(ts.isAsExpression(declaration.initializer), 'Profile list remains a literal const assertion');
  const prior = ts.factory.updateArrayLiteralExpression(array, array.elements.slice(0, ids.length));
  const value = ts.factory.updateAsExpression(declaration.initializer, prior, declaration.initializer.type);
  const updated = ts.factory.updateVariableDeclaration(declaration, declaration.name, declaration.exclamationToken, declaration.type, value);
  return print(ts.factory.updateVariableStatement(statement, statement.modifiers,
    ts.factory.updateVariableDeclarationList(statement.declarationList, [updated])), ast);
}

const ridgeDeclaration = one('let ridge = 4;');
const ridgeSelection = one('if (openedTear && piece === 1) for (let i = 5; i < along - 4; i++) if (rows[i]![6]![2] > rows[ridge]![6]![2]) ridge = i;');
const surfaceDeclaration = one('const openedSurface = openedTear && piece === 1 ? createPleatedTear(b, rows[ridge]![6]!, [rows[ridge]![7]![0] - rows[ridge]![5]![0], rows[ridge]![7]![1] - rows[ridge]![5]![1]]) : undefined;');
const optionalSurface = one('if (openedSurface) { openedSurface.triangle(a, c, d); openedSurface.triangle(a, d, e); } else b.quad(a, c, d, e, 0, [uv(a), uv(c), uv(d), uv(e)], [0, 0, 1], 4);');
const optionalMarker = one('if (!openedTear && start! < 0 && i === 15 && j === 7) fracture(b, a, c, d);');
const settledGuard = one("if ((spec.shapeProfile === 'settled-sheet' || spec.shapeProfile === 'settled-fan') && (spec.blocking !== 0 || spec.height > 6)) throw new Error('Settled material requires explicit nonblocking material with height at most 6');");

function defaultPleated(node, ast) {
  assert.equal(node.parameters.length, 2);
  assert.equal(print(node.parameters[1], ast), 'openedTear = false', 'Old calls must keep the exact false default');
  const expected = [ridgeDeclaration, ridgeSelection, surfaceDeclaration, optionalSurface, optionalMarker];
  const counts = expected.map(() => 0);
  const transformed = ts.transform(node.body, [context => {
    const visit = current => {
      if (ts.isVariableStatement(current) || ts.isIfStatement(current)) {
        const index = expected.indexOf(print(current, ast));
        if (index >= 0) {
          counts[index]++;
          if (index < 3) return undefined;
          if (index === 3) return current.elseStatement;
          // Drop only the exact leading !openedTear term. All old marker terms remain.
          const strip = expression => ts.isBinaryExpression(expression.left)
            ? ts.factory.updateBinaryExpression(expression, strip(expression.left), expression.operatorToken, expression.right)
            : expression.right;
          return ts.factory.updateIfStatement(current, strip(current.expression), current.thenStatement, current.elseStatement);
        }
      }
      return ts.visitEachChild(current, visit, context);
    };
    return visit;
  }]);
  try {
    assert.deepEqual(counts, [1, 1, 1, 1, 1], 'Only the reviewed conditional tear changes are accepted');
    return print(ts.factory.updateFunctionDeclaration(node, node.modifiers, node.asteriskToken, node.name,
      node.typeParameters, node.parameters.slice(0, 1), node.type, transformed.transformed[0]), ast);
  } finally { transformed.dispose(); }
}

function dispatch(node, ast, additions) {
  assert(node.body && node.body.statements.length === 1 && ts.isSwitchStatement(node.body.statements[0]));
  const statement = node.body.statements[0]; assert.equal(print(statement.expression, ast), 'builder.spec.shapeProfile');
  const matches = statement.caseBlock.clauses.filter(clause => ts.isCaseClause(clause)
    && ts.isStringLiteral(clause.expression) && additions.some(row => row[0] === clause.expression.text));
  assert.equal(matches.length, additions.length);
  for (const [profile, code] of additions) {
    const row = matches.find(clause => clause.expression.text === profile), expected = parse(code);
    assert.deepEqual(row.statements.map(item => print(item, ast)), expected.statements.map(item => print(item, expected)));
  }
  const block = ts.factory.updateCaseBlock(statement.caseBlock, statement.caseBlock.clauses.filter(clause => !matches.includes(clause)));
  const body = ts.factory.updateBlock(node.body, [ts.factory.updateSwitchStatement(statement, statement.expression, block)]);
  return print(ts.factory.updateFunctionDeclaration(node, node.modifiers, node.asteriskToken, node.name,
    node.typeParameters, node.parameters, node.type, body), ast);
}

export function assertExplicitProfileContinuity({oldExpansion, newExpansion, oldGround, newGround,
  oldGeometry, newGeometry, tearModule, settledModule, instances}) {
  assert(instances.length && instances.every(row => !profiles.includes(row.shapeProfile)), 'Selected world uses a newly added profile');
  assertInertModule(tearModule, ['createPleatedTear']);
  assertInertModule(settledModule, ['buildSettledSheet', 'buildSettledFan']);
  const normalize = (text, kind, newer) => {
    const ast = parse(text), counts = {import: 0, list: 0, dispatch: 0, default: 0};
    const from = kind === 'expansion' ? './native-volume-pleated-tear' : './native-volume-settled-sheet';
    const expectedImport = one(kind === 'expansion'
      ? "import { createPleatedTear } from './native-volume-pleated-tear';"
      : "import { buildSettledSheet, buildSettledFan } from './native-volume-settled-sheet';");
    const lines = ast.statements.flatMap(statement => {
      if (importFrom(statement, from)) { assert(newer); assert.equal(print(statement, ast), expectedImport); counts.import++; return []; }
      const list = profileList(statement, ast, kind === 'expansion' ? 'NATIVE_VOLUME_SHAPE_PROFILES' : 'NATIVE_VOLUME_V4_PROFILES',
        newer ? kind === 'expansion' ? ['pleated-tear'] : ['settled-sheet', 'settled-fan'] : []);
      if (list !== null) { counts.list++; return [list]; }
      if (ts.isFunctionDeclaration(statement)) {
        if (newer && statement.name?.text === 'pleatedSheet') { counts.default++; return [defaultPleated(statement, ast)]; }
        if (newer && statement.name?.text === (kind === 'expansion' ? 'buildExpandedNativeVolume' : 'buildGroundNativeVolume')) {
          counts.dispatch++; return [dispatch(statement, ast, kind === 'expansion'
            ? [['pleated-tear', 'pleatedSheet(builder, true); return;']]
            : [['settled-sheet', 'buildSettledSheet(builder); return;'], ['settled-fan', 'buildSettledFan(builder); return;']])];
        }
      }
      return [print(statement, ast)];
    });
    assert.deepEqual(counts, {import: newer ? 1 : 0, list: 1, dispatch: newer ? 1 : 0, default: newer && kind === 'expansion' ? 1 : 0});
    return lines;
  };
  assert.deepEqual(normalize(newExpansion, 'expansion', true), normalize(oldExpansion, 'expansion', false), 'Old expansion paths or shared Builder changed');
  assert.deepEqual(normalize(newGround, 'ground', true), normalize(oldGround, 'ground', false), 'Old ground profiles changed');
  const ast = parse(newGeometry); let removed = 0;
  const transformed = ts.transform(ast, [context => {
    const visit = node => {
      if (ts.isIfStatement(node) && print(node, ast) === settledGuard) { removed++; return undefined; }
      return ts.visitEachChild(node, visit, context);
    }; return visit;
  }]);
  try {
    assert.equal(removed, 1, 'Exactly the new profile-specific validation guard is removable');
    assert.equal(print(transformed.transformed[0], ast), print(parse(oldGeometry), parse(oldGeometry)), 'Existing validator/geometry behavior changed');
  } finally { transformed.dispose(); }
  return {status: 'pass', newProfiles: profiles, selectedInstances: instances.length,
    scope: 'Unselected explicit profile additions only. Old Builder, shapes, routing and validator are AST-exact after removing the three unreachable branches; the old pleated function is exact under its false default. Imported modules have no top-level execution. No new-profile art/body approval or current runtime execution is inferred.'};
}
