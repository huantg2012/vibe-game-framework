#!/usr/bin/env node
/** R100 plan integrity and derived, offline, read-only progress. No game imports. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_INPUT = 'docs/progress/rift-r100.json';
const DEFAULT_OUTPUT = 'docs/reading/rift-r100.html';
const REVIEW_AXES = ['technical', 'visual', 'experience'];
const GRADES = ['low', 'medium', 'severe'];
const GRADE_LABELS = { low: '低污染', medium: '中污染', severe: '重污染' };
const STATES = ['planned', 'active', 'in-review', 'changes-required', 'verified', 'closed'];
const VERSION_STATES = ['awaiting-start', 'active', 'waiting-user', 'paused', 'release-review', 'released'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = value => Array.isArray(value) ? value : [];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const STATUS = { 'awaiting-start': '等待敲钟', active: '进行中', 'waiting-user': '等待用户', paused: '已暂停', 'release-review': '版本终审', released: '已发布', planned: '未启动',
  'in-review': '审核中', verified: '内部通过', closed: '已结单', 'not-started': '尚未开始', prepared: '计划已准备', pending: '待审', pass: '通过',
  'changes-required': '待整改', approved: '用户认可', 'changes-requested': '用户要求修改', implemented: '已实现',
  dev: '仅开发入口', production: '正式启用', retired: '已退役' };

/** Stable payload binds historical achievement evidence without recounting current eligibility. */
export function hashAchievement(iterationId, achievement) {
  const payload = { iterationId, revision: achievement.revision,
    qualifiedWorldIds: list(achievement.qualifiedWorldIds).slice().sort(),
    gradeCases: list(achievement.gradeCases).map(row => ({ worldId: row?.worldId, grade: row?.grade }))
      .sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0) };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Integrity checks establish traceability, never the truth of an aesthetic verdict. */
export function checkPlan(data, { root = ROOT } = {}) {
  const errors = [], warnings = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const repoFile = (path, owner) => {
    if (!text(path)) { errors.push(`${owner}: repository file path required`); return null; }
    const absolute = resolve(root, path), rel = relative(root, absolute);
    const inside = value => value !== '..' && !value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(value);
    if (isAbsolute(path) || !inside(rel)) { errors.push(`${owner}: file path must stay inside the repository`); return null; }
    if (!existsSync(absolute) || !statSync(absolute).isFile()) { errors.push(`${owner}: file does not exist: ${path}`); return null; }
    if (!inside(relative(realpathSync(root), realpathSync(absolute)))) { errors.push(`${owner}: symlink escapes the repository`); return null; }
    return absolute;
  };
  if (!record(data)) return { ok: false, errors: ['Plan must be a JSON object'], counts: { candidates: 0, qualified: 0, production: 0, humanApproved: 0, qualifiedGradeCases: 0, productionGradeCases: 0 } };
  require(data.schemaVersion === 2, 'Unsupported schemaVersion: the R100 grade contract requires version 2');
  for (const key of ['iterations', 'workflow', 'worlds', 'evidence', 'risks', 'issues', 'changeLog', 'releaseGateResults']) require(Array.isArray(data[key]), `${key} must be an array`);
  const version = record(data.version) ? data.version : {};
  require(version.id === 'R100', 'version.id must be R100');
  require(text(version.title), 'version.title is required');
  require(version.targetWorlds === 108, 'R100 target must remain 108');
  require(Array.isArray(version.requiredGrades) && version.requiredGrades.length === GRADES.length
    && GRADES.every((grade, i) => version.requiredGrades[i] === grade), 'requiredGrades must be low, medium, severe in order');
  require(version.targetGradeCases === 324 && version.targetGradeCases === version.targetWorlds * GRADES.length,
    'R100 requires 108 distinct worlds and 324 world-grade cases; grades do not increase world count');
  require(VERSION_STATES.includes(version.status), 'Unknown version.status');
  require(date(version.date), 'version.date must be a real YYYY-MM-DD');
  require(Number.isInteger(version.baselineWorlds) && version.baselineWorlds >= 0, 'baselineWorlds must be a nonnegative integer');
  require(text(version.baselineNote) && text(version.baselineRevision), 'Baseline note/revision required');
  require(text(data.countPolicy), 'countPolicy is required');
  const makeIndex = (rows, name) => {
    const result = new Map();
    for (const row of list(rows)) {
      if (!record(row) || !text(row.id)) { errors.push(`${name} record requires id`); continue; }
      if (result.has(row.id)) errors.push(`Duplicate ${name} id: ${row.id}`);
      result.set(row.id, row);
    }
    return result;
  };
  const iterations = makeIndex(data.iterations, 'iteration'), worlds = makeIndex(data.worlds, 'world');
  const evidence = makeIndex(data.evidence, 'evidence'), issues = makeIndex(data.issues, 'issue'), risks = makeIndex(data.risks, 'risk');
  const workflow = makeIndex(data.workflow, 'workflow');
  require(iterations.size === 14 && list(data.iterations).length === 14, 'R100 requires fourteen distinct iterations');
  require(workflow.size === 10 && list(data.workflow).length === 10, 'R100 requires ten workflow steps');
  for (const step of workflow.values()) require(text(step.label) && text(step.owner) && text(step.deliverable), `${step.id}: workflow fields incomplete`);
  const quality = record(data.qualityPlan) ? data.qualityPlan : {};
  for (const field of ['artStandard', 'gradeDesign']) {
    require(text(quality[field]) && quality[field].split('#').length === 2 && text(quality[field].split('#')[1]), `qualityPlan.${field}: document and anchor required`);
    if (text(quality[field])) repoFile(quality[field].split('#')[0], `qualityPlan.${field}`);
  }
  require(Array.isArray(quality.pillars) && quality.pillars.length > 0 && quality.pillars.every(row => record(row) && text(row.title) && text(row.body)), 'qualityPlan.pillars requires concrete art principles');
  const gradeDesigns = makeIndex(quality.grades, 'grade design'), releaseGates = makeIndex(quality.releaseGates, 'release gate');
  require(Array.isArray(quality.grades) && quality.grades.length === GRADES.length && GRADES.every(grade => gradeDesigns.has(grade)), 'qualityPlan.grades must describe all three required grades exactly once');
  for (const grade of gradeDesigns.values()) require(['label', 'visual', 'play', 'preparation'].every(field => text(grade[field])), `${grade.id}: incomplete grade design`);
  require(Array.isArray(quality.releaseGates) && quality.releaseGates.length > 0, 'qualityPlan.releaseGates must declare release requirements');
  for (const gate of releaseGates.values()) require(text(gate.label) && iterations.has(gate.iteration), `${gate.id}: release gate requires label and valid iteration`);
  for (const row of evidence.values()) {
    require(['automated', 'runtime', 'source', 'human'].includes(row.kind), `${row.id}: invalid evidence.kind`);
    require(text(row.revision) && text(row.scope) && typeof row.limitations === 'string', `${row.id}: evidence revision/scope/limitations required`);
    repoFile(row.path, row.id);
    if (row.worldId !== undefined) {
      const worldIds = Array.isArray(row.worldId) ? row.worldId : [row.worldId];
      require(worldIds.length > 0 && worldIds.every(id => worlds.has(id)), `${row.id}: unknown/empty evidence worldId scope`);
      require(typeof row.dependencyHash === 'string' && /^[a-f0-9]{64}$/.test(row.dependencyHash), `${row.id}: world evidence dependencyHash must be SHA-256`);
    }
    if (row.grades !== undefined) require(Array.isArray(row.grades) && row.grades.every(grade => GRADES.includes(grade))
      && new Set(row.grades).size === row.grades.length, `${row.id}: evidence grades must be distinct required grade IDs`);
  }
  const refs = (owner, ids) => {
    require(Array.isArray(ids), `${owner}: evidenceIds must be an array`);
    require(new Set(list(ids)).size === list(ids).length, `${owner}: repeated evidence reference`);
    for (const id of list(ids)) require(typeof id === 'string' && evidence.has(id), `${owner}: unknown evidence ${id}`);
    return list(ids).map(id => evidence.get(id)).filter(Boolean);
  };
  const proof = (owner, ids, revision) => {
    const rows = refs(owner, ids);
    require(text(revision) && rows.some(row => row.revision === revision), `${owner}: claim lacks evidence for current revision`);
    return rows;
  };
  const releaseManifest = record(version.releaseManifest) ? version.releaseManifest : null;
  let releaseManifestMatches = false;
  require(version.releaseManifest === null || releaseManifest !== null, 'version.releaseManifest must be null or a manifest record');
  if (releaseManifest) {
    require(text(releaseManifest.revision) && /^[a-f0-9]{64}$/.test(releaseManifest.hash ?? ''), 'releaseManifest requires an RC revision and SHA-256 hash');
    const file = repoFile(releaseManifest.path, 'releaseManifest');
    releaseManifestMatches = Boolean(file && createHash('sha256').update(readFileSync(file)).digest('hex') === releaseManifest.hash);
    require(releaseManifestMatches, 'Release manifest file/hash mismatch');
  }
  const matchesRelease = row => releaseManifestMatches && row.revision === releaseManifest.revision && row.releaseManifestHash === releaseManifest.hash;
  const authorization = (value, name, required) => {
    if (value === null || value === undefined) { require(!required, `${name}: human evidence required`); return; }
    require(record(value), `${name} must be an object`);
    if (!record(value)) return;
    require(date(value.date), `${name}.date must be a real date`);
    const rows = refs(name, value.evidenceIds);
    if (name === 'startAuthorization') require(rows.some(row => row.kind === 'human' && row.purpose === 'start-authority'), `${name}: human start-authority evidence required`);
    else require(rows.some(row => row.kind === 'human' && row.purpose === 'final-acceptance' && matchesRelease(row)), `${name}: human final-acceptance evidence must target the current RC revision and release manifest`);
  };
  authorization(version.startAuthorization, 'startAuthorization', version.status !== 'awaiting-start');
  authorization(version.finalAcceptance, 'finalAcceptance', version.status === 'released');
  const qualified = [], production = [], humanApproved = [], qualifiedGradeCases = [], productionGradeCases = [];
  const gradeCounts = Object.fromEntries(GRADES.map(grade => [grade, { qualified: 0, production: 0 }]));
  for (const world of worlds.values()) {
    require(text(world.family) && text(world.revision), `${world.id}: family/revision required`);
    require(['planned', 'implemented'].includes(world.implementation), `${world.id}: invalid implementation`);
    require(['dev', 'production', 'retired'].includes(world.integration), `${world.id}: invalid integration`);
    require(typeof world.invalidated === 'boolean', `${world.id}: invalidated must be explicit`);
    require(text(world.distinctness), `${world.id}: distinctness rationale required`);
    require(Array.isArray(world.nearestWorldIds), `${world.id}: nearestWorldIds must be an array`);
    for (const nearest of list(world.nearestWorldIds)) require(nearest !== world.id && worlds.has(nearest), `${world.id}: unknown/self nearest world ${nearest}`);
    const review = record(world.review) ? world.review : {};
    for (const axis of REVIEW_AXES) require(['pending', 'pass', 'changes-required'].includes(review[axis]), `${world.id}: invalid ${axis} review`);
    require(['pending', 'approved', 'changes-requested'].includes(review.human), `${world.id}: invalid human review`);
    const rows = refs(world.id, world.evidenceIds), currentEvidence = rows.some(row => row.revision === world.revision);
    const manifest = record(world.dependencyManifest) ? world.dependencyManifest : null;
    let manifestMatches = false;
    if (manifest) {
      require(typeof manifest.hash === 'string' && /^[a-f0-9]{64}$/.test(manifest.hash), `${world.id}: dependencyManifest.hash must be SHA-256`);
      const file = repoFile(manifest.path, `${world.id} dependencyManifest`);
      manifestMatches = Boolean(file && createHash('sha256').update(readFileSync(file)).digest('hex') === manifest.hash);
      require(manifestMatches, `${world.id}: dependency manifest file/hash mismatch`);
    } else require(world.implementation === 'planned', `${world.id}: implemented world needs dependencyManifest`);
    const reviewEvidence = record(world.reviewEvidence) ? world.reviewEvidence : {};
    const axisHasProof = new Map();
    for (const axis of [...REVIEW_AXES, 'human']) {
      const axisRows = refs(`${world.id}/${axis}`, reviewEvidence[axis]);
      require(list(reviewEvidence[axis]).every(id => list(world.evidenceIds).includes(id)), `${world.id}/${axis}: review evidence must also appear in evidenceIds`);
      const matches = axisRows.some(row => row.revision === world.revision && row.dependencyHash === manifest?.hash
        && (Array.isArray(row.worldId) ? row.worldId.includes(world.id) : row.worldId === world.id)
        && (axis !== 'human' || row.kind === 'human'));
      axisHasProof.set(axis, matches && manifestMatches);
      if (review[axis] === 'pass' || review[axis] === 'approved') require(matches && manifestMatches, `${world.id}/${axis}: passed review needs matching world, revision and dependency hash evidence${axis === 'human' ? ' of human kind' : ''}`);
    }
    if (world.implementation === 'implemented' || REVIEW_AXES.some(axis => review[axis] === 'pass'))
      require(currentEvidence, `${world.id}: implementation/review claim lacks current-revision evidence`);
    if (REVIEW_AXES.some(axis => review[axis] === 'pass')) require(world.implementation === 'implemented', `${world.id}: unimplemented world cannot pass review`);
    if (world.integration === 'production') require(world.implementation === 'implemented', `${world.id}: unimplemented world cannot be in production`);
    const identityEligible = world.implementation === 'implemented' && world.integration !== 'retired' && world.invalidated === false
      && REVIEW_AXES.every(axis => review[axis] === 'pass' && axisHasProof.get(axis)) && currentEvidence;
    const gradeRecords = record(world.grades) ? world.grades : {};
    require(record(world.grades) && Object.keys(world.grades).length === GRADES.length && GRADES.every(grade => record(world.grades[grade])), `${world.id}: grades must contain low, medium and severe records`);
    const gradeEligible = new Map(), gradeProduction = new Map();
    for (const gradeId of GRADES) {
      const grade = record(gradeRecords[gradeId]) ? gradeRecords[gradeId] : {};
      const gradeReview = record(grade.review) ? grade.review : {}, gradeEvidence = record(grade.reviewEvidence) ? grade.reviewEvidence : {};
      const owner = `${world.id}/${gradeId}`;
      require(['dev', 'production', 'retired'].includes(grade.integration), `${owner}: invalid integration`);
      require(typeof grade.invalidated === 'boolean', `${owner}: invalidated must be explicit`);
      let axesMatch = true;
      for (const axis of REVIEW_AXES) {
        require(['pending', 'pass', 'changes-required'].includes(gradeReview[axis]), `${owner}: invalid ${axis} review`);
        const axisRows = refs(`${owner}/${axis}`, gradeEvidence[axis]);
        require(list(gradeEvidence[axis]).every(id => list(world.evidenceIds).includes(id)), `${owner}/${axis}: review evidence must also appear in world evidenceIds`);
        const matches = manifestMatches && axisRows.some(row => row.revision === world.revision && row.dependencyHash === manifest?.hash
          && (Array.isArray(row.worldId) ? row.worldId.includes(world.id) : row.worldId === world.id) && list(row.grades).includes(gradeId));
        if (gradeReview[axis] === 'pass') {
          require(world.implementation === 'implemented', `${owner}: unimplemented world cannot pass grade review`);
          require(matches, `${owner}/${axis}: passed grade needs matching world, revision, dependency hash and explicit grade evidence`);
        }
        axesMatch &&= gradeReview[axis] === 'pass' && matches;
      }
      const integrationRows = refs(`${owner}/integration`, grade.integrationEvidence);
      require(list(grade.integrationEvidence).every(id => list(world.evidenceIds).includes(id)), `${owner}: integration evidence must also appear in world evidenceIds`);
      const integrationCoverage = new Set(integrationRows.filter(row => row.kind === 'runtime' && row.purpose === 'production-integration'
        && row.revision === world.revision && row.dependencyHash === manifest?.hash && manifestMatches
        && (Array.isArray(row.worldId) ? row.worldId.includes(world.id) : row.worldId === world.id) && list(row.grades).includes(gradeId))
        .flatMap(row => list(row.coverage)));
      const hasProductionProof = ['production-entry', 'recovery'].every(scope => integrationCoverage.has(scope));
      if (grade.integration === 'production') {
        require(world.implementation === 'implemented', `${owner}: unimplemented world cannot have production grade`);
        require(hasProductionProof, `${owner}: production requires current runtime production-integration evidence for both production-entry and recovery`);
      }
      const eligible = identityEligible && grade.invalidated === false && grade.integration !== 'retired' && axesMatch;
      gradeEligible.set(gradeId, eligible);
      if (eligible) { qualifiedGradeCases.push({ worldId: world.id, grade: gradeId }); gradeCounts[gradeId].qualified++; }
      gradeProduction.set(gradeId, eligible && world.integration === 'production' && grade.integration === 'production' && hasProductionProof);
      if (gradeProduction.get(gradeId)) {
        productionGradeCases.push({ worldId: world.id, grade: gradeId }); gradeCounts[gradeId].production++;
      }
    }
    const eligible = identityEligible && GRADES.every(grade => gradeEligible.get(grade));
    if (eligible) qualified.push(world.id);
    if (eligible && GRADES.every(grade => gradeProduction.get(grade))) production.push(world.id);
    if (world.implementation === 'implemented' && world.integration !== 'retired' && !world.invalidated && review.human === 'approved' && axisHasProof.get('human')) humanApproved.push(world.id);
  }
  const counts = { candidates: worlds.size, qualified: qualified.length, production: production.length, humanApproved: humanApproved.length,
    qualifiedGradeCases: qualifiedGradeCases.length, productionGradeCases: productionGradeCases.length };
  let lastTarget = -1;
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visiting.has(id)) { errors.push(`Iteration dependency cycle at ${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of list(iterations.get(id)?.dependencies)) if (iterations.has(dependency)) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const iteration of iterations.values()) {
    require(STATES.includes(iteration.state), `${iteration.id}: invalid state`);
    require(iteration.stage === 'not-started' || workflow.has(iteration.stage), `${iteration.id}: unknown workflow stage`);
    require(['foundation', 'production', 'release'].includes(iteration.phase), `${iteration.id}: invalid phase`);
    require(Number.isInteger(iteration.targetWorlds) && iteration.targetWorlds >= lastTarget && iteration.targetWorlds <= 108, `${iteration.id}: cumulative target must be monotonic and <=108`);
    require(iteration.targetGradeCases === iteration.targetWorlds * GRADES.length, `${iteration.id}: cumulative grade target must equal world target times three`);
    lastTarget = iteration.targetWorlds;
    for (const key of ['title', 'goal', 'technical', 'visual', 'exit']) require(text(iteration[key]), `${iteration.id}: ${key} is required`);
    for (const key of ['batches', 'review']) require(Array.isArray(iteration[key]) && iteration[key].length > 0 && iteration[key].every(text), `${iteration.id}: ${key} needs concrete entries`);
    require(Array.isArray(iteration.dependencies), `${iteration.id}: dependencies must be an array`);
    for (const dependency of list(iteration.dependencies)) require(dependency !== iteration.id && iterations.has(dependency), `${iteration.id}: unknown/self dependency ${dependency}`);
    refs(iteration.id, iteration.evidenceIds);
    require(Array.isArray(iteration.gateResults) && Array.isArray(iteration.issueIds), `${iteration.id}: gateResults/issueIds must be arrays`);
    for (const id of list(iteration.issueIds)) require(issues.has(id), `${iteration.id}: unknown issue ${id}`);
    for (const gate of list(iteration.gateResults)) {
      require(record(gate) && text(gate.id) && ['pending', 'pass', 'changes-required'].includes(gate.status), `${iteration.id}: malformed gate result`);
      if (gate?.status === 'pass') proof(`${iteration.id}/${gate.id}`, gate.evidenceIds, gate.revision ?? iteration.actualRevision);
    }
    if (iteration.state === 'planned') require(iteration.stage === 'not-started', `${iteration.id}: planned iteration cannot claim an active workflow stage`);
    if (iteration.state !== 'planned') for (const dependency of list(iteration.dependencies))
      require(iterations.get(dependency)?.state === 'closed', `${iteration.id}: dependency ${dependency} is not closed`);
    if (['verified', 'closed'].includes(iteration.state)) {
      proof(iteration.id, iteration.evidenceIds, iteration.actualRevision);
      const achievement = record(iteration.achievement) ? iteration.achievement : {};
      require(record(iteration.achievement) && achievement.revision === iteration.actualRevision, `${iteration.id}: completion requires a historical achievement matching actualRevision`);
      const achievedWorlds = list(achievement.qualifiedWorldIds), achievedCases = list(achievement.gradeCases);
      require(Array.isArray(achievement.qualifiedWorldIds) && new Set(achievedWorlds).size === achievedWorlds.length
        && achievedWorlds.every(id => worlds.has(id) && worlds.get(id).implementation === 'implemented'), `${iteration.id}: achievement world IDs must be unique implemented ledger records`);
      const caseKeys = achievedCases.map(row => `${row?.worldId}/${row?.grade}`);
      require(Array.isArray(achievement.gradeCases) && new Set(caseKeys).size === caseKeys.length
        && achievedCases.every(row => record(row) && worlds.has(row.worldId) && worlds.get(row.worldId).implementation === 'implemented' && GRADES.includes(row.grade)), `${iteration.id}: malformed/duplicate historical grade cases`);
      require(achievedWorlds.every(id => GRADES.every(grade => caseKeys.includes(`${id}/${grade}`))), `${iteration.id}: every historically qualified world needs all three grade cases`);
      require(achievedWorlds.length >= iteration.targetWorlds && achievedCases.length >= iteration.targetGradeCases, `${iteration.id}: historical achievement is below the iteration target`);
      const achievementRows = refs(`${iteration.id}/achievement`, achievement.evidenceIds);
      require(list(achievement.evidenceIds).every(id => list(iteration.evidenceIds).includes(id)), `${iteration.id}: achievement evidence must also appear in iteration evidenceIds`);
      const digest = hashAchievement(iteration.id, achievement);
      require(achievementRows.some(row => row.purpose === 'iteration-achievement' && row.iterationId === iteration.id
        && row.revision === achievement.revision && row.achievementHash === digest), `${iteration.id}: historical achievement lacks evidence bound to this iteration, revision and snapshot hash`);
      if (counts.qualified < iteration.targetWorlds || counts.qualifiedGradeCases < iteration.targetGradeCases)
        warnings.push(`${iteration.id} 保留历史达成 ${achievedWorlds.length} 世界 / ${achievedCases.length} 格；当前有效仅 ${counts.qualified} 世界 / ${counts.qualifiedGradeCases} 格，资格缺口须补回，不能据历史结单发布。`);
    }
    visit(iteration.id);
  }
  require(lastTarget === version.targetWorlds, 'Final iteration target must equal the version target (108)');
  const releaseResults = makeIndex(data.releaseGateResults, 'release gate result');
  for (const result of releaseResults.values()) {
    require(releaseGates.has(result.id), `${result.id}: result references an undeclared release gate`);
    require(['pending', 'pass', 'changes-required'].includes(result.status), `${result.id}: invalid release gate result`);
    if (result.status === 'pass') {
      const rows = proof(`release/${result.id}`, result.evidenceIds, result.revision);
      require(result.revision === releaseManifest?.revision && rows.some(row => row.purpose === 'release-gate' && row.gateId === result.id && matchesRelease(row)), `${result.id}: release gate proof must target this gate and the current RC revision/manifest`);
    }
    else refs(`release/${result.id}`, result.evidenceIds);
  }
  require(record(data.resume) && iterations.has(data.resume.iteration) && text(data.resume.nextAction) && text(data.resume.lastCompleted), 'resume must identify a valid iteration and concrete next action');
  for (const risk of risks.values()) require(text(risk.title) && text(risk.owner) && text(risk.response) && iterations.has(risk.iteration), `${risk.id}: incomplete/unknown risk routing`);
  for (const issue of issues.values()) {
    require(text(issue.title) && ['P0', 'P1', 'P2', 'P3'].includes(issue.severity)
      && ['open', 'resolved', 'accepted'].includes(issue.status), `${issue.id}: invalid issue record`);
    if (issue.status === 'resolved') proof(issue.id, issue.evidenceIds, issue.revision);
  }
  if (version.status === 'awaiting-start') {
    require(version.startAuthorization === null, 'Awaiting-start cannot carry start authorization');
    require(version.finalAcceptance === null, 'Awaiting-start cannot carry final acceptance');
    require(version.releaseManifest === null, 'Awaiting-start cannot carry a release candidate manifest');
    require([...iterations.values()].every(row => row.state === 'planned' && row.stage === 'not-started'
      && row.actualRevision === null && list(row.gateResults).length === 0 && row.achievement == null), 'Awaiting-start cannot claim active/completed implementation or passed gates');
    require([...worlds.values()].every(row => row.implementation === 'planned' && row.integration !== 'production'), 'Awaiting-start cannot claim implemented/production worlds');
    require(list(data.releaseGateResults).length === 0, 'Awaiting-start cannot carry release gate results');
  }
  if (version.status === 'released') {
    require(releaseManifestMatches, 'Released requires a valid versioned release manifest');
    require(counts.qualified >= 108 && counts.production >= 108, 'Released requires at least 108 current qualified production worlds');
    require(counts.qualifiedGradeCases >= 324 && counts.productionGradeCases >= 324, 'Released requires at least 324 qualified production world-grade cases');
    require([...iterations.values()].every(row => row.state === 'closed'), 'Released requires all fourteen iterations closed');
    for (const gate of releaseGates.values()) require(releaseResults.get(gate.id)?.status === 'pass', `Released requires passed release gate ${gate.id}`);
    require([...issues.values()].every(row => !['P0', 'P1'].includes(row.severity) || row.status === 'resolved'), 'Released cannot retain unresolved P0/P1 issues');
  }
  return { ok: errors.length === 0, errors, warnings, counts, gradeCounts, qualifiedGradeCases, productionGradeCases,
    qualifiedIds: qualified, productionIds: production, humanApprovedIds: humanApproved };
}

const badge = (value, extra = '') => `<span class="badge ${escape(value)} ${extra}">${escape(STATUS[value] ?? value)}</span>`;
const bullets = values => `<ul>${list(values).map(value => `<li>${escape(value)}</li>`).join('')}</ul>`;
export function renderPlan(data, source, result) {
  if (!result.ok) throw new Error(`Cannot render an invalid plan:\n${result.errors.join('\n')}`);
  const hash = createHash('sha256').update(source).digest('hex'), v = data.version, c = result.counts;
  const status = STATUS[v.status], progress = Math.min(100, c.qualified / v.targetWorlds * 100);
  const gradeProgress = Math.min(100, c.qualifiedGradeCases / v.targetGradeCases * 100), quality = data.qualityPlan;
  const phase = { foundation: '建立能力', production: '生产与校准', release: '候选与发布' };
  const stages = new Map(data.workflow.map(row => [row.id, row.label]));
  const evidenceById = new Map(data.evidence.map(row => [row.id, row]));
  const evidenceLinks = ids => list(ids).length ? list(ids).map(id => {
    const row = evidenceById.get(id);
    return `<a href="../../${escape(row.path.split('/').map(encodeURIComponent).join('/'))}">${escape(id)}</a>`;
  }).join(' · ') : '<span class="muted">尚无证据记录</span>';
  const documentLink = path => `../../${path.split('#')[0].split('/').map(encodeURIComponent).join('/')}${path.includes('#') ? `#${encodeURIComponent(path.split('#')[1])}` : ''}`;
  const releaseResults = new Map(data.releaseGateResults.map(row => [row.id, row]));
  const warningOverview = result.warnings.length ? `<section class="limits" role="status"><strong>当前资格缺口</strong>${bullets(result.warnings)}<p>历史达成保留。发布判断始终使用当前有效世界、等级资格与当前候选版本证据。</p></section>` : '';
  const gradeCell = world => GRADES.map(id => {
    const grade = world.grades[id], qualified = result.qualifiedGradeCases.some(row => row.worldId === world.id && row.grade === id);
    return `<div class="grade-cell"><strong>${GRADE_LABELS[id]}</strong> · ${grade.invalidated ? '资格失效' : qualified ? '该格合格' : '未合格'} ${badge(grade.integration)}<br>${REVIEW_AXES.map((axis, i) => `${['技术', '美术', '体验'][i]} ${badge(grade.review[axis])}`).join(' ')}<br>审核：${evidenceLinks([...new Set(REVIEW_AXES.flatMap(axis => grade.reviewEvidence[axis]))])}<br>正式接入与恢复：${evidenceLinks(grade.integrationEvidence)}</div>`;
  }).join('');
  const qualityOverview = `<section class="section" id="quality"><div class="section-head"><div><div class="eyebrow">Visual Foundation / Two Axes</div><h2>世界身份与三级污染，共同成立</h2><p>世界身份与污染程度是两条独立轴。三级完整通过才抵一个世界，美术有独立否决权。</p></div><div class="small"><a href="${escape(documentLink(quality.artStandard))}">美术验收标准</a> · <a href="${escape(documentLink(quality.gradeDesign))}">污染分级设计</a></div></div>
<div class="quality-pillars">${quality.pillars.map(pillar => `<article class="quality-pillar"><h3>${escape(pillar.title)}</h3><p>${escape(pillar.body)}</p></article>`).join('')}</div>
<div class="grade-designs">${quality.grades.map(grade => `<article class="grade-design ${escape(grade.id)}"><div class="eyebrow">${escape(grade.id)} / ${result.gradeCounts[grade.id].qualified} OF ${v.targetWorlds} QUALIFIED</div><h3>${escape(grade.label)}</h3><div class="detail-row"><div class="detail-label">画面与感官</div><p>${escape(grade.visual)}</p></div><div class="detail-row"><div class="detail-label">行动与压力</div><p>${escape(grade.play)}</p></div><div class="detail-row"><div class="detail-label">准备与理解</div><p>${escape(grade.preparation)}</p></div><div class="grade-counter">该级合格 <b>${result.gradeCounts[grade.id].qualified} / ${v.targetWorlds}</b> · 正式 <b>${result.gradeCounts[grade.id].production}</b></div></article>`).join('')}</div></section>`;
  const releaseOverview = `<section class="section" id="release"><div class="section-head"><div><div class="eyebrow">Release / Independent Gates</div><h2>贯穿制作与发布的独立门槛</h2><p>以下是计划门槛。只有登记版本与证据的通过记录才显示通过；当前未执行项保持待审。</p></div></div><p class="small">发布候选：${v.releaseManifest ? `${escape(v.releaseManifest.revision)} · <a href="${escape(documentLink(v.releaseManifest.path))}">发布清单</a> · SHA-256 ${escape(v.releaseManifest.hash)}` : '尚未形成；启动授权不作为终验或发布门证据'}</p><div class="release-gates">${quality.releaseGates.map(gate => {
    const row = releaseResults.get(gate.id);
    return `<article class="release-gate"><div>${badge(row?.status ?? 'pending')} <a href="#${escape(gate.iteration)}">${escape(gate.iteration)}</a></div><h3>${escape(gate.label)}</h3><p>${escape(gate.id)} · ${escape(row?.revision ?? '尚无执行版本')}<br>${evidenceLinks(row?.evidenceIds)}</p></article>`;
  }).join('')}</div></section>`;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>R100 · 世界扩展计划</title>
<style>
:root{--paper:#f4f3ee;--card:#fffefa;--ink:#202b29;--soft:#60716b;--line:#d9ded6;--green:#17674f;--pale:#e8efe8;--amber:#9c6320;--amberbg:#fbf0dc;--mono:ui-monospace,SFMono-Regular,Consolas,monospace}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}a{color:var(--green);text-decoration-thickness:1px;text-underline-offset:4px}main{max-width:1320px;margin:auto;padding:42px 42px 72px}header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line);padding-bottom:20px}.wordmark{font:700 17px var(--mono);letter-spacing:.15em}.header-note,.eyebrow{font:11px/1.5 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--soft)}nav{display:flex;flex-wrap:wrap;gap:18px;font-size:13px}nav a{text-decoration:none;color:var(--soft)}.hero{display:grid;grid-template-columns:1.55fr 1fr;gap:60px;align-items:center;padding:44px 0 34px}h1{font-size:clamp(28px,3.8vw,44px);line-height:1.25;font-weight:650;letter-spacing:-.045em;margin:13px 0 17px}h2{font-size:23px;letter-spacing:-.035em;line-height:1.4;margin:0}h3{margin:0;font-size:17px;line-height:1.5}.lede{font-size:16px;color:var(--soft);max-width:650px;margin:0 0 19px}.badge{display:inline-flex;align-items:center;border:1px solid var(--line);background:#f3f5f0;color:var(--soft);border-radius:6px;padding:2px 9px;font-size:11px;line-height:1.8;white-space:nowrap}.awaiting-start,.waiting-user,.paused,.changes-required,.changes-requested{color:var(--amber);border-color:#e7d7b8;background:var(--amberbg)}.active,.verified,.closed,.released,.pass,.approved{color:var(--green);border-color:#bad3c3;background:var(--pale)}.target-card{border:1px solid var(--line);padding:27px 30px;background:var(--card);border-radius:12px}.target-top{display:flex;align-items:end;justify-content:space-between;gap:16px}.target-number{font:600 86px/.95 var(--mono);letter-spacing:-.1em}.target-unit{color:var(--soft);font-size:14px;margin-top:7px}.progress-track{height:6px;background:#e6ebe3;border-radius:4px;overflow:hidden;margin:24px 0 12px}.progress-track span{display:block;height:100%;width:${progress}%;background:var(--green)}.small{font-size:12px;color:var(--soft)}.target-footer{display:flex;justify-content:space-between;gap:12px;font:12px var(--mono);color:var(--soft)}.notice{display:flex;gap:16px;border-left:3px solid var(--amber);background:var(--amberbg);padding:15px 20px;margin-bottom:24px;border-radius:0 8px 8px 0}.notice strong{white-space:nowrap;font-size:13px;color:#825117}.notice p{margin:0;font-size:13px;color:#76634b}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;border:1px solid var(--line);background:var(--line);border-radius:10px;overflow:hidden}.metric{background:var(--card);padding:20px 24px}.metric-num{font:500 40px/1.2 var(--mono);letter-spacing:-.07em}.metric-name{font-size:13px;margin:5px 0 2px}.metric-note{font-size:11px;color:var(--soft)}.section{margin-top:42px}.section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.section-head p{margin:7px 0 0;font-size:13px;color:var(--soft)}.route{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin:22px 0}.route-step{border-top:3px solid #ccd6cc;padding:11px 8px 9px;background:#eef1eb;text-decoration:none}.route-step strong{font:600 21px var(--mono);display:block}.route-step span{font:10px var(--mono);color:var(--soft)}.route-step.active{border-color:var(--green);background:#e2eee5}.iterations{display:grid;grid-template-columns:1fr 1fr;gap:12px}.iteration{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;scroll-margin-top:20px}.iteration summary{list-style:none;cursor:pointer;padding:20px;display:grid;grid-template-columns:46px 1fr auto;gap:13px;align-items:start}.iteration summary::-webkit-details-marker{display:none}.iteration summary:focus-visible{outline:3px solid #86b19e;outline-offset:-3px}.iteration summary:hover{background:#f7f8f2}.round{font:500 23px/1.2 var(--mono);color:#8b9d92;padding-top:4px}.round small{display:block;font-size:9px;letter-spacing:.03em;margin-top:6px}.iteration-title{font-size:16px;font-weight:650;line-height:1.45}.iteration-meta{color:var(--soft);font-size:11px;margin-top:7px}.iteration-meta b{color:var(--ink);font-family:var(--mono);font-size:14px}.summary-right{display:flex;align-items:center;gap:9px}.chevron{color:#7c8b82;transition:transform .15s;font-size:16px}.iteration[open] .chevron{transform:rotate(90deg)}.iteration-detail{padding:0 20px 22px 79px;font-size:13px}.detail-row{margin-top:16px}.detail-label{font-size:10px;letter-spacing:.09em;color:var(--green);font-weight:700;text-transform:uppercase;margin-bottom:5px}.detail-row p{margin:0;color:#46564f}.detail-row ul{margin:3px 0 0;padding-left:18px;color:#46564f}.detail-row li{margin:4px 0}.exit-box{margin-top:18px;padding:12px 14px;border:1px solid #d9e4d7;background:#f2f6ee;border-radius:6px;color:#3d5948}.exit-box strong{font-size:11px;display:block;margin-bottom:4px}.detail-footer{border-top:1px solid var(--line);margin-top:17px;padding-top:13px;color:var(--soft);font-size:11px}.workflow{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.workflow-card{padding:18px;background:var(--card);border:1px solid var(--line);border-radius:8px}.workflow-card .step-no{font:12px var(--mono);color:var(--green);margin-bottom:10px}.workflow-card h3{font-size:14px}.workflow-card p{font-size:12px;color:var(--soft);margin:8px 0 0}.workflow-card .owner{font-size:10px;color:#6c7b70;margin-top:10px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px}.panel{padding:24px;border:1px solid var(--line);border-radius:10px;background:var(--card)}.panel h2{font-size:20px}.risk{padding:16px 0;border-bottom:1px solid var(--line)}.risk:last-child{padding-bottom:0;border:0}.risk h3{font-size:14px;display:flex;gap:10px}.risk code{font:10px var(--mono);color:var(--soft);padding-top:5px}.risk p{font-size:12px;color:var(--soft);margin:7px 0}.risk small{color:#78857c;font-size:10px}.next{font-size:17px;line-height:1.85;margin:18px 0}.cursor{display:flex;gap:9px;align-items:center;font:11px var(--mono);color:var(--green)}.subline{font-size:12px;color:var(--soft);padding-top:18px;margin-top:20px;border-top:1px solid var(--line)}.registry{overflow:auto;border:1px solid var(--line);border-radius:9px;background:var(--card)}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:13px 16px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:10px;color:var(--soft);font-weight:500;letter-spacing:.04em;background:#edf1e9}tr:last-child td{border-bottom:0}.empty{text-align:center;padding:31px;color:var(--soft);font-size:13px}.empty strong{display:block;color:#3f5549;margin-bottom:8px;font-size:16px}.limits{padding:18px 22px;background:#e9eee5;border-radius:8px;font-size:12px;color:#52654f;margin-top:17px}.limits p{margin:5px 0}.muted{color:var(--soft)}footer{border-top:1px solid var(--line);margin-top:38px;padding-top:20px;color:var(--soft);font-size:11px;display:flex;justify-content:space-between;gap:25px}footer code{font:10px/1.8 var(--mono);word-break:break-all}.hash{max-width:560px}a:focus-visible{outline:2px solid var(--green);outline-offset:3px}@media(max-width:1000px){main{padding:25px}.hero{gap:24px}.workflow{grid-template-columns:repeat(2,1fr)}.iterations{grid-template-columns:1fr}.route{grid-template-columns:repeat(6,1fr)}}@media(max-width:650px){main{padding:20px 16px}.hero,.two-col{grid-template-columns:1fr}.hero{padding:27px 0;gap:20px}.metrics{grid-template-columns:repeat(2,1fr)}nav{gap:12px}.header-note{display:none}.notice{display:block}.notice strong{display:block;margin-bottom:6px}.section-head{display:block}.iteration summary{padding:17px;grid-template-columns:30px 1fr auto;gap:10px}.iteration-detail{padding-left:57px}.workflow{grid-template-columns:1fr}.target-number{font-size:72px}.target-card{padding:23px}.summary-right .badge{font-size:10px}footer{display:block}.hash{margin-top:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}@media print{body{background:#fff}main{max-width:none;padding:10px}nav{display:none}.hero{padding-top:20px}.iterations,.workflow{display:block}.iteration,.workflow-card,.panel{break-inside:avoid;margin-bottom:10px}.iteration-detail{display:block!important}.section{margin-top:22px}.route{display:none}}

.dual-target{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px}.target-number.secondary{font-size:64px;color:#527362}.target-multiply{font:16px var(--mono);color:var(--soft)}.target-note{margin:18px 0 0}.grade-progress{margin-top:18px}.grade-progress span{background:#719d89}.metric-num small{font-size:14px;letter-spacing:0;color:var(--soft)}.quality-pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.quality-pillar{border-top:2px solid #759580;padding:17px 18px;background:#eaf0e7}.quality-pillar h3{font-size:15px}.quality-pillar p{font-size:12px;line-height:1.8;color:#536652;margin:10px 0 0}.grade-designs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.grade-design{border:1px solid var(--line);background:var(--card);border-radius:9px;padding:23px 21px}.grade-design h3{font-size:22px;margin-top:8px}.grade-design .detail-row{font-size:13px}.grade-design.severe{border-top:3px solid #a17c5e}.grade-design.medium{border-top:3px solid #8a9272}.grade-design.low{border-top:3px solid #769586}.grade-counter{border-top:1px solid var(--line);padding-top:16px;margin-top:20px;font-size:11px;color:var(--soft)}.grade-counter b{font-family:var(--mono);color:var(--ink)}.release-gates{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.release-gate{padding:18px;border:1px solid var(--line);border-radius:8px;background:var(--card)}.release-gate h3{font-size:15px;margin-top:12px}.release-gate p,.release-gate a{font-size:11px;color:var(--soft)}.grade-cell{padding:8px 0;border-bottom:1px solid var(--line);min-width:260px}.grade-cell:last-child{border:0}.grade-cell .badge{font-size:10px;padding:0 5px}@media(max-width:1000px){.hero{grid-template-columns:1fr 1fr}.target-number{font-size:68px}.target-number.secondary{font-size:54px}.quality-pillars{grid-template-columns:repeat(2,1fr)}.grade-designs{grid-template-columns:1fr}.release-gates{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){header{align-items:start}nav{justify-content:end;font-size:11px;max-width:210px}.hero,.quality-pillars,.release-gates{grid-template-columns:1fr}.dual-target{gap:12px}.metric{padding:18px}.metric-num{font-size:33px}.metric-num small{font-size:11px}.route{grid-template-columns:repeat(4,1fr)}.grade-design{padding:20px}}@media print{.quality-pillars,.grade-designs,.release-gates{display:block}.quality-pillar,.grade-design,.release-gate{break-inside:avoid;margin-bottom:12px}}
</style></head><body><main>
<header><div><div class="wordmark">R100<span style="color:#81998b"> / </span>WORLD EDITION</div><div class="header-note">计划 · 制作 · 审核 · 接续</div></div><nav aria-label="章节"><a href="../tasks/rift-r100.md">完整执行规则</a><a href="#quality">美术与分级</a><a href="#iterations">${data.iterations.length}轮计划</a><a href="#workflow">审核流程</a><a href="#next">下一步</a></nav></header>
<div class="hero"><div><div class="eyebrow">Rift / Major Version Plan</div><h1>${escape(v.title)}</h1><p class="lede">视觉是地图的基石。先建立有身份、有吸引力的世界，再让低、中、重污染各自形成完整体验。</p>${badge(v.status)} <span class="small">${escape(STATUS[v.planStatus] ?? v.planStatus)} · ${escape(v.date)}</span></div><div class="target-card"><div class="dual-target"><div><div class="target-number">${v.targetWorlds}</div><div class="target-unit">独立世界</div></div><div class="target-multiply">× 3</div><div><div class="target-number secondary">${v.targetGradeCases}</div><div class="target-unit">世界—等级资格格</div></div></div><div class="progress-track" role="progressbar" aria-label="完整三级合格世界进度" aria-valuemin="0" aria-valuemax="${v.targetWorlds}" aria-valuenow="${c.qualified}"><span></span></div><div class="target-footer"><span>完整世界 ${c.qualified} / ${v.targetWorlds}</span><span>${progress.toFixed(1)}%</span></div><div class="progress-track grade-progress" role="progressbar" aria-label="世界等级资格覆盖" aria-valuemin="0" aria-valuemax="${v.targetGradeCases}" aria-valuenow="${c.qualifiedGradeCases}"><span style="width:${gradeProgress}%"></span></div><div class="target-footer"><span>资格覆盖 ${c.qualifiedGradeCases} / ${v.targetGradeCases}</span><span>${gradeProgress.toFixed(1)}%</span></div><p class="small target-note">三级不增加世界数量。世界身份与所有等级均通过，才计为一个完整合格世界。</p></div></div>
<div class="notice"><strong>${v.status === 'awaiting-start' ? '开发尚未获启动' : escape(status)}</strong><p>${v.status === 'awaiting-start' ? '当前只完成计划与管理工具。等待用户敲钟后，才进入 R100 实施。' : '状态以启动授权、迭代记录及当前版本证据为依据。'} ${escape(v.baselineNote)}</p></div>
${warningOverview}
<div class="metrics"><div class="metric"><div class="metric-num">${c.qualified}<small> / ${v.targetWorlds}</small></div><div class="metric-name">完整内部合格世界</div><div class="metric-note">身份三审 + 低 / 中 / 重逐级三审</div></div><div class="metric"><div class="metric-num">${c.production}<small> / ${v.targetWorlds}</small></div><div class="metric-name">完整正式世界</div><div class="metric-note">身份合格且三级全部正式启用</div></div><div class="metric"><div class="metric-num">${c.qualifiedGradeCases}<small> / ${v.targetGradeCases}</small></div><div class="metric-name">合格资格格</div><div class="metric-note">每格 = 同一世界的一个污染等级</div></div><div class="metric"><div class="metric-num">${c.productionGradeCases}<small> / ${v.targetGradeCases}</small></div><div class="metric-name">正式资格格</div><div class="metric-note">当前版本、对应等级正式启用</div></div><div class="metric"><div class="metric-num">${c.humanApproved}</div><div class="metric-name">记录用户认可</div><div class="metric-note">与内部审核、正式接入独立</div></div><div class="metric"><div class="metric-num">${c.candidates}</div><div class="metric-name">已登记候选世界</div><div class="metric-note">含待审与失效，不把等级抵数</div></div></div>
${qualityOverview}
<section class="section" id="iterations"><div class="section-head"><div><div class="eyebrow">01 / Iteration Roadmap</div><h2>${data.iterations.length}轮，逐步达到完整世界库</h2><p>数字为每轮累计合格世界及三级资格格目标。展开可见制作范围、审核问题与退出条件。</p></div><span class="small">当前接续 ${escape(data.resume.iteration)}</span></div>
<div class="route" aria-label="累计目标路线">${data.iterations.map((row, i) => `<a href="#${escape(row.id)}" class="route-step ${row.state === 'active' ? 'active' : ''}"><span>I${String(i + 1).padStart(2, '0')}</span><strong>${row.targetWorlds}</strong><span>世界 / ${row.targetGradeCases} 格</span><br><span>${escape(STATUS[row.state])}</span></a>`).join('')}</div>
<div class="iterations">${data.iterations.map((row, i) => `<details class="iteration" id="${escape(row.id)}"${i === 0 ? ' open' : ''}><summary><div class="round">${String(i + 1).padStart(2, '0')}<small>${escape(row.phase.toUpperCase())}</small></div><div><div class="iteration-title">${escape(row.title)}</div><div class="iteration-meta">${escape(phase[row.phase])} · 累计目标 <b>${row.targetWorlds}</b> 世界 / <b>${row.targetGradeCases}</b> 格 · ${escape(stages.get(row.stage) ?? STATUS[row.stage])}</div></div><div class="summary-right">${badge(row.state)}<span class="chevron" aria-hidden="true">›</span></div></summary><div class="iteration-detail"><div class="detail-row"><div class="detail-label">目标 / 为什么做</div><p>${escape(row.goal)}</p></div><div class="detail-row"><div class="detail-label">技术方案</div><p>${escape(row.technical)}</p></div><div class="detail-row"><div class="detail-label">美术与视听</div><p>${escape(row.visual)}</p></div><div class="detail-row"><div class="detail-label">开发批次</div>${bullets(row.batches)}</div><div class="detail-row"><div class="detail-label">审核问题</div>${bullets(row.review)}</div><div class="exit-box"><strong>本轮退出条件</strong>${escape(row.exit)}</div><div class="detail-footer">依赖：${row.dependencies.length ? row.dependencies.map(escape).join(' / ') : '无'}<br>实际版本：${escape(row.actualRevision ?? '未实施')} · 门禁记录 ${row.gateResults.length} · 问题 ${row.issueIds.length}<br>历史达成：${row.achievement ? `${row.achievement.qualifiedWorldIds.length} 世界 / ${row.achievement.gradeCases.length} 格 · ${escape(row.achievement.revision)}` : '尚无快照'}<br>证据：${evidenceLinks(row.evidenceIds)}</div></div></details>`).join('')}</div></section>
<section class="section" id="workflow"><div class="section-head"><div><div class="eyebrow">02 / Shared Workflow</div><h2>每轮都走完的十个步骤</h2><p>技术、美术与体验分别审核。失败回到对应批次修正，迭代完成不等于大版本结单。</p></div></div><div class="workflow">${data.workflow.map((step, i) => `<article class="workflow-card"><div class="step-no">${String(i + 1).padStart(2, '0')} / 10</div><h3>${escape(step.label)}</h3><p>${escape(step.deliverable)}</p><div class="owner">${escape(step.owner)}</div></article>`).join('')}</div></section>
${releaseOverview}
<section class="section two-col"><div class="panel"><div class="eyebrow">03 / Risks</div><h2>先看到风险，再安排返工</h2>${data.risks.map(risk => `<article class="risk"><h3><code>${escape(risk.id)}</code>${escape(risk.title)}</h3><p>${escape(risk.response)}</p><small>${escape(risk.owner)} · ${escape(risk.iteration)}</small></article>`).join('')}</div><div class="panel" id="next"><div class="eyebrow">04 / Resume Here</div><h2>下一步</h2><div class="next">${escape(data.resume.nextAction)}</div><div class="cursor">${escape(data.resume.iteration)} ${data.resume.batch ? ` / ${escape(data.resume.batch)}` : ' / 批次尚未启动'}</div><div class="subline"><strong>最近完成</strong><br>${escape(data.resume.lastCompleted)}</div><div class="subline"><strong>计数政策</strong><br>${escape(data.countPolicy)}</div><div class="subline"><strong>回归基线</strong><br>${escape(v.baselineWorlds)} 个既有 demo · ${escape(v.baselineRevision)}<br>${escape(v.baselineNote)}</div></div></section>
<section class="section"><div class="section-head"><div><div class="eyebrow">05 / World Registry</div><h2>实际世界台账</h2><p>总体身份三审与低 / 中 / 重三级逐格审核分别记录；三级不拆成新世界，人审继续单列。</p></div></div><div class="registry">${data.worlds.length ? `<table><thead><tr><th>世界 / 家族</th><th>当前版本</th><th>实施与接入</th><th>身份三审</th><th>三级资格格</th><th>人审 / 资格</th><th>证据</th></tr></thead><tbody>${data.worlds.map(world => `<tr><td><strong>${escape(world.id)}</strong><br>${escape(world.family)}<br><span class="small">${escape(world.distinctness)}</span></td><td>${escape(world.revision)}</td><td>${badge(world.implementation)} ${badge(world.integration)}</td><td>技术 ${badge(world.review.technical)}<br>美术 ${badge(world.review.visual)}<br>体验 ${badge(world.review.experience)}</td><td>${gradeCell(world)}</td><td>${badge(world.review.human)}<br>${world.invalidated ? '当前资格已失效' : result.qualifiedIds.includes(world.id) ? '计入合格数' : '未计入合格数'}</td><td>${evidenceLinks(world.evidenceIds)}</td></tr>`).join('')}</tbody></table>` : `<div class="empty"><strong>尚无 R100 世界记录</strong>${v.status === 'awaiting-start' ? '开发未启动，' : ''}当前合格数与正式启用数均为 0。${v.baselineWorlds} 个既有 demo 不自动计入。</div>`}</div><div class="limits"><strong>校验能够确认什么</strong><p>状态与启动授权一致、依赖合法且无环、累计目标单调、证据文件存在、每项审核绑定当前世界、版本与相应污染等级、依赖清单文件的 SHA-256 匹配、108世界与324资格格分别计数、正式入口与恢复有逐级运行证据、历史达成与当前资格分账、发布门及人审终验绑定同一候选清单。</p><strong>校验不能代替什么</strong><p>记录关联完整不证明证据内容真实，也不能证明依赖清单与全部生产代码、数据一致。独立性、审美、视听品质与游戏体验仍需实际观察和独立审核；机器不会代签用户认可。</p></div></section>
<footer><div>离线只读派生页 · 无游戏逻辑、无存档访问、无浏览器持久化<br>计划日期 ${escape(v.date)} · 生成日期 ${new Date().toISOString().slice(0, 10)} · 数据源 <a href="../progress/rift-r100.json">rift-r100.json</a> · <a href="../tasks/rift-r100.md">完整执行规则</a></div><div class="hash">JSON SHA-256<br><code>${hash}</code><br>内容与状态以 JSON 为准；修改后需重新 render。</div></footer>
</main></body></html>\n`;
}

export function selfTest(base, root = ROOT) {
  const cases = [];
  const test = (name, mutate, ok) => { const data = structuredClone(base); mutate(data); const result = checkPlan(data, { root });
    assert.equal(result.ok, ok, `${name}: ${result.errors.join('; ')}`); cases.push(name); return result; };
  test('canonical awaiting-start accepted with zero derived count', () => {}, true);
  test('duplicate iteration rejected', data => { data.iterations[1].id = data.iterations[0].id; }, false);
  test('cyclic dependency rejected', data => { data.iterations[0].dependencies = [data.iterations[1].id]; }, false);
  test('unknown dependency rejected', data => { data.iterations[0].dependencies = ['missing']; }, false);
  test('decreasing cumulative target rejected', data => { data.iterations[4].targetWorlds = 1; }, false);
  test('active version without human authorization rejected', data => { data.version.status = 'active'; }, false);
  test('awaiting-start cannot claim implementation', data => { data.iterations[0].state = 'active'; data.iterations[0].stage = 'implementation'; }, false);
  test('released version without 108 qualified worlds rejected', data => { data.version.status = 'released'; }, false);
  test('nonexistent evidence rejected', data => { data.iterations[0].evidenceIds = ['missing']; }, false);
  const activeWorld = data => {
    const dependencyHash = createHash('sha256').update(readFileSync(resolve(root, DEFAULT_INPUT))).digest('hex');
    data.version.status = 'active';
    data.evidence = [{ id: 'auth', kind: 'human', purpose: 'start-authority', revision: 'plan-r100', path: DEFAULT_INPUT, scope: 'self-test authorization', limitations: 'Test fixture, not real approval' },
      ...REVIEW_AXES.map(axis => ({ id: axis, kind: axis === 'technical' ? 'automated' : 'runtime', revision: 'world-r1', path: DEFAULT_INPUT,
        worldId: 'test-world', dependencyHash, grades: [...GRADES], scope: `self-test ${axis} current revision and all three grades`, limitations: 'Test fixture, not a completed world' })),
      { id: 'integration', kind: 'runtime', purpose: 'production-integration', revision: 'world-r1', path: DEFAULT_INPUT,
        worldId: 'test-world', dependencyHash, grades: [...GRADES], coverage: ['production-entry', 'recovery'], scope: 'self-test production entry and recovery', limitations: 'Test fixture, not real runtime evidence' }];
    data.version.startAuthorization = { date: '2026-10-02', evidenceIds: ['auth'] };
    data.worlds = [{ id: 'test-world', family: 'test-family', revision: 'world-r1', implementation: 'implemented', integration: 'production',
      dependencyManifest: { path: DEFAULT_INPUT, hash: dependencyHash },
      review: { technical: 'pass', visual: 'pass', experience: 'pass', human: 'pending' }, evidenceIds: [...REVIEW_AXES, 'integration'],
      reviewEvidence: { technical: ['technical'], visual: ['visual'], experience: ['experience'], human: [] },
      grades: Object.fromEntries(GRADES.map(grade => [grade, { integration: 'production', integrationEvidence: ['integration'], invalidated: false,
        review: { technical: 'pass', visual: 'pass', experience: 'pass' }, reviewEvidence: { technical: ['technical'], visual: ['visual'], experience: ['experience'] } }])),
      nearestWorldIds: [], distinctness: 'Self-test world only; never written to canonical data.', invalidated: false }];
  };
  const valid = test('future qualified production world derives counts without human conflation', activeWorld, true);
  assert.deepEqual(valid.counts, { candidates: 1, qualified: 1, production: 1, humanApproved: 0, qualifiedGradeCases: 3, productionGradeCases: 3 });
  const invalidated = test('invalidated record is removed from qualified and production counts', data => { activeWorld(data); data.worlds[0].invalidated = true; }, true);
  assert.equal(invalidated.counts.qualified, 0); assert.equal(invalidated.counts.production, 0); assert.equal(invalidated.counts.qualifiedGradeCases, 0);
  test('a missing grade cannot be replaced by overall world reviews', data => { activeWorld(data); delete data.worlds[0].grades.severe; }, false);
  test('a passed grade cannot reuse evidence that only covers another grade', data => { activeWorld(data); data.evidence[1].grades = ['low', 'medium']; }, false);
  test('overall evidence without explicit grade coverage cannot qualify grade cases', data => { activeWorld(data); delete data.evidence[1].grades; }, false);
  test('each grade needs its own review evidence references', data => { activeWorld(data); data.worlds[0].grades.severe.reviewEvidence.visual = []; }, false);
  const partial = test('two verified grades are two cells, not one complete world', data => {
    activeWorld(data); data.worlds[0].grades.severe.review.visual = 'pending'; data.worlds[0].grades.severe.reviewEvidence.visual = [];
  }, true);
  assert.equal(partial.counts.qualified, 0); assert.equal(partial.counts.production, 0); assert.equal(partial.counts.qualifiedGradeCases, 2);
  const invalidGrade = test('invalidating one grade removes its cell and complete world qualification', data => { activeWorld(data); data.worlds[0].grades.severe.invalidated = true; }, true);
  assert.equal(invalidGrade.counts.qualified, 0); assert.equal(invalidGrade.counts.qualifiedGradeCases, 2);
  const devGrade = test('one dev grade blocks complete production but preserves internal qualification', data => { activeWorld(data); data.worlds[0].grades.severe.integration = 'dev'; }, true);
  assert.equal(devGrade.counts.qualified, 1); assert.equal(devGrade.counts.production, 0); assert.equal(devGrade.counts.productionGradeCases, 2);
  const noIntegration = test('production labels without integration evidence do not count', data => { activeWorld(data); data.worlds[0].grades.severe.integrationEvidence = []; }, false);
  assert.equal(noIntegration.counts.production, 0); assert.equal(noIntegration.counts.productionGradeCases, 2);
  test('review runtime evidence is not production integration evidence', data => { activeWorld(data); data.worlds[0].grades.severe.integrationEvidence = ['visual']; }, false);
  test('integration requires runtime evidence rather than source assertions', data => { activeWorld(data); data.evidence.at(-1).kind = 'source'; }, false);
  test('production entry without recovery evidence is incomplete', data => { activeWorld(data); data.evidence.at(-1).coverage = ['production-entry']; }, false);
  test('integration evidence cannot cross grade scope', data => { activeWorld(data); data.evidence.at(-1).grades = ['low']; }, false);
  test('integration evidence cannot cross revision', data => { activeWorld(data); data.evidence.at(-1).revision = 'old-world'; }, false);
  test('integration evidence cannot cross dependency hash', data => { activeWorld(data); data.evidence.at(-1).dependencyHash = '0'.repeat(64); }, false);
  test('entry and recovery may be proved by separate runtime records', data => {
    activeWorld(data); const row = data.evidence.at(-1); row.coverage = ['production-entry'];
    data.evidence.push({ ...structuredClone(row), id: 'recovery', coverage: ['recovery'] });
    data.worlds[0].evidenceIds.push('recovery'); for (const grade of Object.values(data.worlds[0].grades)) grade.integrationEvidence.push('recovery');
  }, true);
  test('world target and grade target cannot be conflated', data => { data.version.targetGradeCases = 108; }, false);
  test('iteration grade target must equal three times world target', data => { data.iterations[1].targetGradeCases += 1; }, false);
  test('unknown fourth grade is rejected', data => { activeWorld(data); data.worlds[0].grades.extreme = data.worlds[0].grades.severe; }, false);
  test('world grade cannot claim an unapproved severity ID in evidence', data => { activeWorld(data); data.evidence[1].grades = ['extreme']; }, false);
  test('all three grade designs must have actionable content', data => { data.qualityPlan.grades[2].preparation = ''; }, false);
  test('fourteen iterations are required', data => { data.iterations.pop(); }, false);
  test('stale revision evidence cannot support current qualification', data => { activeWorld(data); data.worlds[0].revision = 'world-r2'; }, false);
  test('human approval cannot be fabricated from a runtime result', data => { activeWorld(data); data.worlds[0].review.human = 'approved'; }, false);
  test('three pass labels without per-axis proof are rejected', data => { activeWorld(data); data.worlds[0].reviewEvidence.visual = []; }, false);
  test('manifest file mutation invalidates old hash', data => { activeWorld(data); data.worlds[0].dependencyManifest.hash = '0'.repeat(64); }, false);
  test('evidence from old dependencies cannot support a passed review', data => { activeWorld(data); data.evidence[1].dependencyHash = '0'.repeat(64); }, false);
  test('evidence from another world cannot support a passed review', data => { activeWorld(data); data.evidence[1].worldId = 'other-world'; }, false);
  test('review proof must be listed among world evidence', data => { activeWorld(data); data.worlds[0].evidenceIds = ['technical', 'experience']; }, false);
  test('batch-scoped current human evidence records approval separately', data => {
    activeWorld(data);
    data.evidence.push({ id: 'human-batch', kind: 'human', revision: 'world-r1', path: DEFAULT_INPUT, worldId: ['test-world'],
      dependencyHash: data.worlds[0].dependencyManifest.hash, scope: 'self-test batch review', limitations: 'Test fixture, not real approval' });
    data.worlds[0].evidenceIds.push('human-batch'); data.worlds[0].reviewEvidence.human = ['human-batch']; data.worlds[0].review.human = 'approved';
  }, true);
  test('verified iteration cannot claim an unproven revision', data => { activeWorld(data); data.iterations[0].state = 'verified'; }, false);
  for (const state of ['waiting-user', 'paused', 'release-review']) test(`authorized ${state} version state accepted`, data => { activeWorld(data); data.version.status = state; }, true);
  const completeRelease = data => {
    activeWorld(data);
    const prototype = structuredClone(data.worlds[0]);
    data.worlds = Array.from({ length: 108 }, (_, i) => ({ ...structuredClone(prototype), id: `test-world-${i}` }));
    for (const row of data.evidence) if (row.worldId) row.worldId = data.worlds.map(world => world.id);
    data.version.status = 'released';
    data.version.releaseManifest = { path: DEFAULT_INPUT, hash: prototype.dependencyManifest.hash, revision: 'release-rc-1' };
    data.version.finalAcceptance = { date: '2026-10-02', evidenceIds: ['final-approval'] };
    data.evidence.push({ id: 'final-approval', kind: 'human', purpose: 'final-acceptance', revision: 'release-rc-1', releaseManifestHash: prototype.dependencyManifest.hash,
      path: DEFAULT_INPUT, scope: 'self-test final RC acceptance', limitations: 'Test fixture, not user approval' });
    for (const iteration of data.iterations) {
      iteration.state = 'closed'; iteration.stage = 'close'; iteration.actualRevision = `${iteration.id}-revision`;
      const evidenceId = `achievement-${iteration.id}`, qualifiedWorldIds = data.worlds.slice(0, iteration.targetWorlds).map(world => world.id);
      iteration.achievement = { revision: iteration.actualRevision, qualifiedWorldIds,
        gradeCases: qualifiedWorldIds.flatMap(worldId => GRADES.map(grade => ({ worldId, grade }))), evidenceIds: [evidenceId] };
      iteration.evidenceIds = [evidenceId];
      data.evidence.push({ id: evidenceId, kind: 'automated', purpose: 'iteration-achievement', iterationId: iteration.id,
        revision: iteration.actualRevision, achievementHash: hashAchievement(iteration.id, iteration.achievement), path: DEFAULT_INPUT,
        scope: 'self-test historical achievement', limitations: 'Test fixture, not completed work' });
    }
    data.releaseGateResults = data.qualityPlan.releaseGates.map(gate => {
      const evidenceId = `release-${gate.id}`;
      data.evidence.push({ id: evidenceId, kind: 'runtime', purpose: 'release-gate', gateId: gate.id, revision: 'release-rc-1',
        releaseManifestHash: prototype.dependencyManifest.hash, path: DEFAULT_INPUT, scope: 'self-test RC gate', limitations: 'Test fixture, not real qualification' });
      return { id: gate.id, status: 'pass', revision: 'release-rc-1', evidenceIds: [evidenceId] };
    });
  };
  const release = test('future complete release requires 108 worlds, 324 grade cases and all declared gates', completeRelease, true);
  assert.equal(release.counts.qualified, 108); assert.equal(release.counts.productionGradeCases, 324);
  test('complete world count alone cannot bypass a missing release gate', data => { completeRelease(data); data.releaseGateResults.pop(); }, false);
  test('duplicate release result rejected', data => { completeRelease(data); data.releaseGateResults.push(structuredClone(data.releaseGateResults[0])); }, false);
  test('undeclared release result rejected', data => { completeRelease(data); data.releaseGateResults[0].id = 'unknown-gate'; }, false);
  test('release gate requires current revision evidence', data => { completeRelease(data); data.releaseGateResults[0].revision = 'new-revision-without-proof'; }, false);
  test('duplicate planned release gate rejected', data => { data.qualityPlan.releaseGates.push(structuredClone(data.qualityPlan.releaseGates[0])); }, false);
  test('release gate points to an existing iteration', data => { data.qualityPlan.releaseGates[0].iteration = 'unknown-iteration'; }, false);
  test('start authority cannot masquerade as final acceptance', data => { completeRelease(data); data.version.finalAcceptance.evidenceIds = ['auth']; }, false);
  test('start authority cannot masquerade as a release gate', data => { completeRelease(data); data.releaseGateResults[0].evidenceIds = ['auth']; data.releaseGateResults[0].revision = 'plan-r100'; }, false);
  test('a different release gate cannot cover this gate', data => { completeRelease(data); data.releaseGateResults[0].evidenceIds = data.releaseGateResults[1].evidenceIds; }, false);
  test('a stale RC cannot support final acceptance', data => { completeRelease(data); data.evidence.find(row => row.id === 'final-approval').revision = 'release-rc-0'; }, false);
  test('a stale manifest cannot support a release gate', data => { completeRelease(data); data.evidence.find(row => row.purpose === 'release-gate').releaseManifestHash = '0'.repeat(64); }, false);
  test('the release manifest must match its actual file hash', data => { completeRelease(data); data.version.releaseManifest.hash = '0'.repeat(64); }, false);
  test('release requires a release manifest', data => { completeRelease(data); data.version.releaseManifest = null; }, false);
  let historyData;
  const historical = test('historical closure survives current invalidation but displays a qualification gap', data => {
    completeRelease(data); data.version.status = 'active'; data.version.finalAcceptance = null;
    data.worlds[0].invalidated = true; historyData = data;
  }, true);
  assert.equal(historical.counts.qualified, 107); assert(historical.warnings.length > 0);
  assert(renderPlan(historyData, JSON.stringify(historyData), historical).includes('当前资格缺口'), 'Legal historical regression must still render with a visible warning');
  test('a historical closure cannot permit release below current qualification', data => { completeRelease(data); data.worlds[0].invalidated = true; }, false);
  test('first closure cannot claim an empty snapshot for a positive target', data => {
    completeRelease(data); const iteration = data.iterations.find(row => row.targetWorlds > 0);
    iteration.achievement.qualifiedWorldIds = []; iteration.achievement.gradeCases = [];
    data.evidence.find(row => row.iterationId === iteration.id).achievementHash = hashAchievement(iteration.id, iteration.achievement);
  }, false);
  test('unbound historical achievement cannot close an iteration', data => { completeRelease(data); data.iterations[2].achievement.evidenceIds = ['auth']; }, false);
  test('editing a historical snapshot invalidates its evidence binding', data => {
    completeRelease(data); const achievement = data.iterations[2].achievement;
    achievement.qualifiedWorldIds.push('test-world-4'); achievement.gradeCases.push(...GRADES.map(grade => ({ worldId: 'test-world-4', grade })));
  }, false);
  test('historical qualification requires complete grade cases', data => { completeRelease(data); data.iterations[2].achievement.gradeCases.pop(); }, false);
  test('repository escape evidence rejected', data => { activeWorld(data); data.evidence[0].path = '../outside.txt'; }, false);
  test('directory cannot masquerade as evidence', data => { activeWorld(data); data.evidence[0].path = 'docs'; }, false);
  const before = JSON.stringify(base), source = JSON.stringify(base), output = renderPlan(base, source, checkPlan(base, { root }));
  assert.equal(JSON.stringify(base), before, 'Rendering must not mutate canonical data');
  assert(!/<script\b|localStorage|sessionStorage|indexedDB/i.test(output), 'The page must remain offline and read-only');
  assert(output.includes(createHash('sha256').update(source).digest('hex')), 'Rendered source hash required');
  return { passed: cases.length + 3, cases, render: ['source immutability', 'no executable/persistent browser state', 'JSON hash'] };
}

function main() {
  const args = process.argv.slice(2), command = args[0] ?? 'check';
  const option = (flag, fallback) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : fallback; };
  if (!['check', 'render', 'self-test'].includes(command)) throw new Error('Usage: node tools/world-study/r100-progress.mjs check|render|self-test [--input path] [--output path]');
  const input = resolve(ROOT, option('--input', DEFAULT_INPUT)), output = resolve(ROOT, option('--output', DEFAULT_OUTPUT));
  const source = readFileSync(input, 'utf8'), data = JSON.parse(source), result = checkPlan(data);
  if (command === 'self-test') { console.log(JSON.stringify(selfTest(data), null, 2)); return; }
  if (!result.ok) { console.error(result.errors.map(error => `ERROR ${error}`).join('\n')); process.exitCode = 1; return; }
  if (command === 'render') { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, renderPlan(data, source, result)); }
  console.log(JSON.stringify({ command, status: data.version.status, counts: result.counts, warnings: result.warnings, iterations: data.iterations.length,
    workflowSteps: data.workflow.length, sourceSha256: createHash('sha256').update(source).digest('hex'), ...(command === 'render' ? { output: relative(ROOT, output) } : {}) }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
