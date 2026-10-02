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

/** Integrity checks establish traceability, never the truth of an aesthetic verdict. */
export function checkPlan(data, { root = ROOT } = {}) {
  const errors = [];
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
  if (!record(data)) return { ok: false, errors: ['Plan must be a JSON object'], counts: { candidates: 0, qualified: 0, production: 0, humanApproved: 0 } };
  require(data.schemaVersion === 1, 'Unsupported schemaVersion');
  for (const key of ['iterations', 'workflow', 'worlds', 'evidence', 'risks', 'issues', 'changeLog']) require(Array.isArray(data[key]), `${key} must be an array`);
  const version = record(data.version) ? data.version : {};
  require(version.id === 'R100', 'version.id must be R100');
  require(text(version.title), 'version.title is required');
  require(version.targetWorlds === 108, 'R100 target must remain 108');
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
  require(iterations.size === 12 && list(data.iterations).length === 12, 'R100 requires twelve distinct iterations');
  require(workflow.size === 10 && list(data.workflow).length === 10, 'R100 requires ten workflow steps');
  for (const step of workflow.values()) require(text(step.label) && text(step.owner) && text(step.deliverable), `${step.id}: workflow fields incomplete`);
  for (const row of evidence.values()) {
    require(['automated', 'runtime', 'source', 'human'].includes(row.kind), `${row.id}: invalid evidence.kind`);
    require(text(row.revision) && text(row.scope) && typeof row.limitations === 'string', `${row.id}: evidence revision/scope/limitations required`);
    repoFile(row.path, row.id);
    if (row.worldId !== undefined) {
      const worldIds = Array.isArray(row.worldId) ? row.worldId : [row.worldId];
      require(worldIds.length > 0 && worldIds.every(id => worlds.has(id)), `${row.id}: unknown/empty evidence worldId scope`);
      require(typeof row.dependencyHash === 'string' && /^[a-f0-9]{64}$/.test(row.dependencyHash), `${row.id}: world evidence dependencyHash must be SHA-256`);
    }
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
  const authorization = (value, name, required) => {
    if (value === null || value === undefined) { require(!required, `${name}: human evidence required`); return; }
    require(record(value), `${name} must be an object`);
    if (!record(value)) return;
    require(date(value.date), `${name}.date must be a real date`);
    const rows = refs(name, value.evidenceIds);
    require(rows.some(row => row.kind === 'human'), `${name}: at least one human evidence record required`);
  };
  authorization(version.startAuthorization, 'startAuthorization', version.status !== 'awaiting-start');
  authorization(version.finalAcceptance, 'finalAcceptance', version.status === 'released');
  const qualified = [], production = [], humanApproved = [];
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
    const eligible = world.implementation === 'implemented' && world.integration !== 'retired' && world.invalidated === false
      && REVIEW_AXES.every(axis => review[axis] === 'pass' && axisHasProof.get(axis)) && currentEvidence;
    if (eligible) qualified.push(world.id);
    if (eligible && world.integration === 'production') production.push(world.id);
    if (world.implementation === 'implemented' && world.integration !== 'retired' && !world.invalidated && review.human === 'approved' && axisHasProof.get('human')) humanApproved.push(world.id);
  }
  const counts = { candidates: worlds.size, qualified: qualified.length, production: production.length, humanApproved: humanApproved.length };
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
      require(counts.qualified >= iteration.targetWorlds, `${iteration.id}: completed target exceeds current qualified worlds`);
    }
    visit(iteration.id);
  }
  require(lastTarget === version.targetWorlds, 'Final iteration target must equal the version target (108)');
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
    require([...iterations.values()].every(row => row.state === 'planned' && row.stage === 'not-started'
      && row.actualRevision === null && list(row.gateResults).length === 0), 'Awaiting-start cannot claim active/completed implementation or passed gates');
    require([...worlds.values()].every(row => row.implementation === 'planned' && row.integration !== 'production'), 'Awaiting-start cannot claim implemented/production worlds');
  }
  if (version.status === 'released') {
    require(counts.qualified >= 108 && counts.production >= 108, 'Released requires at least 108 current qualified production worlds');
    require([...iterations.values()].every(row => row.state === 'closed'), 'Released requires all twelve iterations closed');
    require([...issues.values()].every(row => !['P0', 'P1'].includes(row.severity) || row.status === 'resolved'), 'Released cannot retain unresolved P0/P1 issues');
  }
  return { ok: errors.length === 0, errors, counts, qualifiedIds: qualified, productionIds: production, humanApprovedIds: humanApproved };
}

const badge = (value, extra = '') => `<span class="badge ${escape(value)} ${extra}">${escape(STATUS[value] ?? value)}</span>`;
const bullets = values => `<ul>${list(values).map(value => `<li>${escape(value)}</li>`).join('')}</ul>`;
export function renderPlan(data, source, result) {
  if (!result.ok) throw new Error(`Cannot render an invalid plan:\n${result.errors.join('\n')}`);
  const hash = createHash('sha256').update(source).digest('hex'), v = data.version, c = result.counts;
  const status = STATUS[v.status], progress = Math.min(100, c.qualified / v.targetWorlds * 100);
  const phase = { foundation: '建立能力', production: '生产与校准', release: '候选与发布' };
  const stages = new Map(data.workflow.map(row => [row.id, row.label]));
  const evidenceById = new Map(data.evidence.map(row => [row.id, row]));
  const evidenceLinks = ids => list(ids).length ? list(ids).map(id => {
    const row = evidenceById.get(id);
    return `<a href="../../${escape(row.path.split('/').map(encodeURIComponent).join('/'))}">${escape(id)}</a>`;
  }).join(' · ') : '<span class="muted">尚无证据记录</span>';
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>R100 · 世界扩展计划</title>
<style>
:root{--paper:#f4f3ee;--card:#fffefa;--ink:#202b29;--soft:#60716b;--line:#d9ded6;--green:#17674f;--pale:#e8efe8;--amber:#9c6320;--amberbg:#fbf0dc;--mono:ui-monospace,SFMono-Regular,Consolas,monospace}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}a{color:var(--green);text-decoration-thickness:1px;text-underline-offset:4px}main{max-width:1320px;margin:auto;padding:42px 42px 72px}header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line);padding-bottom:20px}.wordmark{font:700 17px var(--mono);letter-spacing:.15em}.header-note,.eyebrow{font:11px/1.5 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--soft)}nav{display:flex;gap:24px;font-size:13px}nav a{text-decoration:none;color:var(--soft)}.hero{display:grid;grid-template-columns:1.55fr 1fr;gap:60px;align-items:center;padding:44px 0 34px}h1{font-size:clamp(28px,3.8vw,44px);line-height:1.25;font-weight:650;letter-spacing:-.045em;margin:13px 0 17px}h2{font-size:23px;letter-spacing:-.035em;line-height:1.4;margin:0}h3{margin:0;font-size:17px;line-height:1.5}.lede{font-size:16px;color:var(--soft);max-width:650px;margin:0 0 19px}.badge{display:inline-flex;align-items:center;border:1px solid var(--line);background:#f3f5f0;color:var(--soft);border-radius:6px;padding:2px 9px;font-size:11px;line-height:1.8;white-space:nowrap}.awaiting-start,.waiting-user,.paused,.changes-required,.changes-requested{color:var(--amber);border-color:#e7d7b8;background:var(--amberbg)}.active,.verified,.closed,.released,.pass,.approved{color:var(--green);border-color:#bad3c3;background:var(--pale)}.target-card{border:1px solid var(--line);padding:27px 30px;background:var(--card);border-radius:12px}.target-top{display:flex;align-items:end;justify-content:space-between;gap:16px}.target-number{font:600 86px/.95 var(--mono);letter-spacing:-.1em}.target-unit{color:var(--soft);font-size:14px;margin-top:7px}.progress-track{height:6px;background:#e6ebe3;border-radius:4px;overflow:hidden;margin:24px 0 12px}.progress-track span{display:block;height:100%;width:${progress}%;background:var(--green)}.small{font-size:12px;color:var(--soft)}.target-footer{display:flex;justify-content:space-between;gap:12px;font:12px var(--mono);color:var(--soft)}.notice{display:flex;gap:16px;border-left:3px solid var(--amber);background:var(--amberbg);padding:15px 20px;margin-bottom:24px;border-radius:0 8px 8px 0}.notice strong{white-space:nowrap;font-size:13px;color:#825117}.notice p{margin:0;font-size:13px;color:#76634b}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;border:1px solid var(--line);background:var(--line);border-radius:10px;overflow:hidden}.metric{background:var(--card);padding:20px 24px}.metric-num{font:500 40px/1.2 var(--mono);letter-spacing:-.07em}.metric-name{font-size:13px;margin:5px 0 2px}.metric-note{font-size:11px;color:var(--soft)}.section{margin-top:42px}.section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.section-head p{margin:7px 0 0;font-size:13px;color:var(--soft)}.route{display:grid;grid-template-columns:repeat(12,1fr);gap:5px;margin:22px 0}.route-step{border-top:3px solid #ccd6cc;padding:11px 8px 9px;background:#eef1eb;text-decoration:none}.route-step strong{font:600 21px var(--mono);display:block}.route-step span{font:10px var(--mono);color:var(--soft)}.route-step.active{border-color:var(--green);background:#e2eee5}.iterations{display:grid;grid-template-columns:1fr 1fr;gap:12px}.iteration{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;scroll-margin-top:20px}.iteration summary{list-style:none;cursor:pointer;padding:20px;display:grid;grid-template-columns:46px 1fr auto;gap:13px;align-items:start}.iteration summary::-webkit-details-marker{display:none}.iteration summary:focus-visible{outline:3px solid #86b19e;outline-offset:-3px}.iteration summary:hover{background:#f7f8f2}.round{font:500 23px/1.2 var(--mono);color:#8b9d92;padding-top:4px}.round small{display:block;font-size:9px;letter-spacing:.03em;margin-top:6px}.iteration-title{font-size:16px;font-weight:650;line-height:1.45}.iteration-meta{color:var(--soft);font-size:11px;margin-top:7px}.iteration-meta b{color:var(--ink);font-family:var(--mono);font-size:14px}.summary-right{display:flex;align-items:center;gap:9px}.chevron{color:#7c8b82;transition:transform .15s;font-size:16px}.iteration[open] .chevron{transform:rotate(90deg)}.iteration-detail{padding:0 20px 22px 79px;font-size:13px}.detail-row{margin-top:16px}.detail-label{font-size:10px;letter-spacing:.09em;color:var(--green);font-weight:700;text-transform:uppercase;margin-bottom:5px}.detail-row p{margin:0;color:#46564f}.detail-row ul{margin:3px 0 0;padding-left:18px;color:#46564f}.detail-row li{margin:4px 0}.exit-box{margin-top:18px;padding:12px 14px;border:1px solid #d9e4d7;background:#f2f6ee;border-radius:6px;color:#3d5948}.exit-box strong{font-size:11px;display:block;margin-bottom:4px}.detail-footer{border-top:1px solid var(--line);margin-top:17px;padding-top:13px;color:var(--soft);font-size:11px}.workflow{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.workflow-card{padding:18px;background:var(--card);border:1px solid var(--line);border-radius:8px}.workflow-card .step-no{font:12px var(--mono);color:var(--green);margin-bottom:10px}.workflow-card h3{font-size:14px}.workflow-card p{font-size:12px;color:var(--soft);margin:8px 0 0}.workflow-card .owner{font-size:10px;color:#6c7b70;margin-top:10px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px}.panel{padding:24px;border:1px solid var(--line);border-radius:10px;background:var(--card)}.panel h2{font-size:20px}.risk{padding:16px 0;border-bottom:1px solid var(--line)}.risk:last-child{padding-bottom:0;border:0}.risk h3{font-size:14px;display:flex;gap:10px}.risk code{font:10px var(--mono);color:var(--soft);padding-top:5px}.risk p{font-size:12px;color:var(--soft);margin:7px 0}.risk small{color:#78857c;font-size:10px}.next{font-size:17px;line-height:1.85;margin:18px 0}.cursor{display:flex;gap:9px;align-items:center;font:11px var(--mono);color:var(--green)}.subline{font-size:12px;color:var(--soft);padding-top:18px;margin-top:20px;border-top:1px solid var(--line)}.registry{overflow:auto;border:1px solid var(--line);border-radius:9px;background:var(--card)}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:13px 16px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:10px;color:var(--soft);font-weight:500;letter-spacing:.04em;background:#edf1e9}tr:last-child td{border-bottom:0}.empty{text-align:center;padding:31px;color:var(--soft);font-size:13px}.empty strong{display:block;color:#3f5549;margin-bottom:8px;font-size:16px}.limits{padding:18px 22px;background:#e9eee5;border-radius:8px;font-size:12px;color:#52654f;margin-top:17px}.limits p{margin:5px 0}.muted{color:var(--soft)}footer{border-top:1px solid var(--line);margin-top:38px;padding-top:20px;color:var(--soft);font-size:11px;display:flex;justify-content:space-between;gap:25px}footer code{font:10px/1.8 var(--mono);word-break:break-all}.hash{max-width:560px}a:focus-visible{outline:2px solid var(--green);outline-offset:3px}@media(max-width:1000px){main{padding:25px}.hero{gap:24px}.workflow{grid-template-columns:repeat(2,1fr)}.iterations{grid-template-columns:1fr}.route{grid-template-columns:repeat(6,1fr)}}@media(max-width:650px){main{padding:20px 16px}.hero,.two-col{grid-template-columns:1fr}.hero{padding:27px 0;gap:20px}.metrics{grid-template-columns:repeat(2,1fr)}nav{gap:12px}.header-note{display:none}.notice{display:block}.notice strong{display:block;margin-bottom:6px}.section-head{display:block}.iteration summary{padding:17px;grid-template-columns:30px 1fr auto;gap:10px}.iteration-detail{padding-left:57px}.workflow{grid-template-columns:1fr}.target-number{font-size:72px}.target-card{padding:23px}.summary-right .badge{font-size:10px}footer{display:block}.hash{margin-top:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}@media print{body{background:#fff}main{max-width:none;padding:10px}nav{display:none}.hero{padding-top:20px}.iterations,.workflow{display:block}.iteration,.workflow-card,.panel{break-inside:avoid;margin-bottom:10px}.iteration-detail{display:block!important}.section{margin-top:22px}.route{display:none}}
</style></head><body><main>
<header><div><div class="wordmark">R100<span style="color:#81998b"> / </span>WORLD EDITION</div><div class="header-note">计划 · 制作 · 审核 · 接续</div></div><nav aria-label="章节"><a href="../tasks/rift-r100.md">完整执行规则</a><a href="#iterations">12轮计划</a><a href="#workflow">审核流程</a><a href="#next">下一步</a></nav></header>
<div class="hero"><div><div class="eyebrow">Rift / Major Version Plan</div><h1>${escape(v.title)}</h1><p class="lede">把有差异的世界做完整，再逐批进入游戏。每份内容同时承担画面、空间与行动上的变化。</p>${badge(v.status)} <span class="small">${escape(STATUS[v.planStatus] ?? v.planStatus)} · ${escape(v.date)}</span></div><div class="target-card"><div class="target-top"><div><div class="target-number">${v.targetWorlds}</div><div class="target-unit">有效、独立、正式可达的世界</div></div><div class="small">大版本目标<br>数量与质量同时成立</div></div><div class="progress-track" role="progressbar" aria-label="内部合格世界进度" aria-valuemin="0" aria-valuemax="${v.targetWorlds}" aria-valuenow="${c.qualified}"><span></span></div><div class="target-footer"><span>当前内部合格 ${c.qualified} / ${v.targetWorlds}</span><span>${progress.toFixed(1)}%</span></div></div></div>
<div class="notice"><strong>${v.status === 'awaiting-start' ? '开发尚未获启动' : escape(status)}</strong><p>${v.status === 'awaiting-start' ? '当前只完成计划与管理工具。等待用户敲钟后，才进入 R100 实施。' : '状态以启动授权、迭代记录及当前版本证据为依据。'} ${escape(v.baselineNote)}</p></div>
<div class="metrics"><div class="metric"><div class="metric-num">${c.qualified}</div><div class="metric-name">内部合格</div><div class="metric-note">实现 + 技术 / 美术 / 体验三审</div></div><div class="metric"><div class="metric-num">${c.production}</div><div class="metric-name">合格且正式启用</div><div class="metric-note">当前版本进入正式生产池</div></div><div class="metric"><div class="metric-num">${c.humanApproved}</div><div class="metric-name">记录用户认可</div><div class="metric-note">与内部三审、正式接入独立</div></div><div class="metric"><div class="metric-num">${c.candidates}</div><div class="metric-name">已登记候选</div><div class="metric-note">含待审与失效记录，不直接抵数</div></div></div>
<section class="section" id="iterations"><div class="section-head"><div><div class="eyebrow">01 / Iteration Roadmap</div><h2>十二轮，逐步达到完整世界库</h2><p>数字为每轮累计合格目标。展开可见制作范围、审核问题与退出条件。</p></div><span class="small">当前接续 ${escape(data.resume.iteration)}</span></div>
<div class="route" aria-label="累计目标路线">${data.iterations.map((row, i) => `<a href="#${escape(row.id)}" class="route-step ${row.state === 'active' ? 'active' : ''}"><span>I${String(i + 1).padStart(2, '0')}</span><strong>${row.targetWorlds}</strong><span>${escape(STATUS[row.state])}</span></a>`).join('')}</div>
<div class="iterations">${data.iterations.map((row, i) => `<details class="iteration" id="${escape(row.id)}"${i === 0 ? ' open' : ''}><summary><div class="round">${String(i + 1).padStart(2, '0')}<small>${escape(row.phase.toUpperCase())}</small></div><div><div class="iteration-title">${escape(row.title)}</div><div class="iteration-meta">${escape(phase[row.phase])} · 累计目标 <b>${row.targetWorlds}</b> 个 · ${escape(stages.get(row.stage) ?? STATUS[row.stage])}</div></div><div class="summary-right">${badge(row.state)}<span class="chevron" aria-hidden="true">›</span></div></summary><div class="iteration-detail"><div class="detail-row"><div class="detail-label">目标 / 为什么做</div><p>${escape(row.goal)}</p></div><div class="detail-row"><div class="detail-label">技术方案</div><p>${escape(row.technical)}</p></div><div class="detail-row"><div class="detail-label">美术与视听</div><p>${escape(row.visual)}</p></div><div class="detail-row"><div class="detail-label">开发批次</div>${bullets(row.batches)}</div><div class="detail-row"><div class="detail-label">审核问题</div>${bullets(row.review)}</div><div class="exit-box"><strong>本轮退出条件</strong>${escape(row.exit)}</div><div class="detail-footer">依赖：${row.dependencies.length ? row.dependencies.map(escape).join(' / ') : '无'}<br>实际版本：${escape(row.actualRevision ?? '未实施')} · 门禁记录 ${row.gateResults.length} · 问题 ${row.issueIds.length}<br>证据：${evidenceLinks(row.evidenceIds)}</div></div></details>`).join('')}</div></section>
<section class="section" id="workflow"><div class="section-head"><div><div class="eyebrow">02 / Shared Workflow</div><h2>每轮都走完的十个步骤</h2><p>技术、美术与体验分别审核。失败回到对应批次修正，迭代完成不等于大版本结单。</p></div></div><div class="workflow">${data.workflow.map((step, i) => `<article class="workflow-card"><div class="step-no">${String(i + 1).padStart(2, '0')} / 10</div><h3>${escape(step.label)}</h3><p>${escape(step.deliverable)}</p><div class="owner">${escape(step.owner)}</div></article>`).join('')}</div></section>
<section class="section two-col"><div class="panel"><div class="eyebrow">03 / Risks</div><h2>先看到风险，再安排返工</h2>${data.risks.map(risk => `<article class="risk"><h3><code>${escape(risk.id)}</code>${escape(risk.title)}</h3><p>${escape(risk.response)}</p><small>${escape(risk.owner)} · ${escape(risk.iteration)}</small></article>`).join('')}</div><div class="panel" id="next"><div class="eyebrow">04 / Resume Here</div><h2>下一步</h2><div class="next">${escape(data.resume.nextAction)}</div><div class="cursor">${escape(data.resume.iteration)} ${data.resume.batch ? ` / ${escape(data.resume.batch)}` : ' / 批次尚未启动'}</div><div class="subline"><strong>最近完成</strong><br>${escape(data.resume.lastCompleted)}</div><div class="subline"><strong>计数政策</strong><br>${escape(data.countPolicy)}</div><div class="subline"><strong>回归基线</strong><br>${escape(v.baselineWorlds)} 个既有 demo · ${escape(v.baselineRevision)}<br>${escape(v.baselineNote)}</div></div></section>
<section class="section"><div class="section-head"><div><div class="eyebrow">05 / World Registry</div><h2>实际世界台账</h2><p>记录来自 JSON；三个内部审核、正式启用与人审状态分别保留。</p></div></div><div class="registry">${data.worlds.length ? `<table><thead><tr><th>世界 / 家族</th><th>当前版本</th><th>实施与接入</th><th>三项内部审核</th><th>人审 / 资格</th><th>证据</th></tr></thead><tbody>${data.worlds.map(world => `<tr><td><strong>${escape(world.id)}</strong><br>${escape(world.family)}<br><span class="small">${escape(world.distinctness)}</span></td><td>${escape(world.revision)}</td><td>${badge(world.implementation)} ${badge(world.integration)}</td><td>技术 ${badge(world.review.technical)}<br>美术 ${badge(world.review.visual)}<br>体验 ${badge(world.review.experience)}</td><td>${badge(world.review.human)}<br>${world.invalidated ? '当前资格已失效' : result.qualifiedIds.includes(world.id) ? '计入合格数' : '未计入合格数'}</td><td>${evidenceLinks(world.evidenceIds)}</td></tr>`).join('')}</tbody></table>` : `<div class="empty"><strong>尚无 R100 世界记录</strong>${v.status === 'awaiting-start' ? '开发未启动，' : ''}当前合格数与正式启用数均为 0。${v.baselineWorlds} 个既有 demo 不自动计入。</div>`}</div><div class="limits"><strong>校验能够确认什么</strong><p>状态与启动授权一致、依赖合法且无环、累计目标单调、证据文件存在、每项审核绑定当前世界与版本、依赖清单文件的 SHA-256 匹配、计数规则与发布条件成立。</p><strong>校验不能代替什么</strong><p>记录关联完整不证明证据内容真实，也不能证明依赖清单与全部生产代码、数据一致。独立性、审美、视听品质与游戏体验仍需实际观察和独立审核；机器不会代签用户认可。</p></div></section>
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
    data.evidence = [{ id: 'auth', kind: 'human', revision: 'plan-r100', path: DEFAULT_INPUT, scope: 'self-test authorization', limitations: 'Test fixture, not real approval' },
      ...REVIEW_AXES.map(axis => ({ id: axis, kind: axis === 'technical' ? 'automated' : 'runtime', revision: 'world-r1', path: DEFAULT_INPUT,
        worldId: 'test-world', dependencyHash, scope: `self-test ${axis} current revision`, limitations: 'Test fixture, not a completed world' }))];
    data.version.startAuthorization = { date: '2026-10-02', evidenceIds: ['auth'] };
    data.worlds = [{ id: 'test-world', family: 'test-family', revision: 'world-r1', implementation: 'implemented', integration: 'production',
      dependencyManifest: { path: DEFAULT_INPUT, hash: dependencyHash },
      review: { technical: 'pass', visual: 'pass', experience: 'pass', human: 'pending' }, evidenceIds: [...REVIEW_AXES],
      reviewEvidence: { technical: ['technical'], visual: ['visual'], experience: ['experience'], human: [] },
      nearestWorldIds: [], distinctness: 'Self-test world only; never written to canonical data.', invalidated: false }];
  };
  const valid = test('future qualified production world derives counts without human conflation', activeWorld, true);
  assert.deepEqual(valid.counts, { candidates: 1, qualified: 1, production: 1, humanApproved: 0 });
  const invalidated = test('invalidated record is removed from qualified and production counts', data => { activeWorld(data); data.worlds[0].invalidated = true; }, true);
  assert.equal(invalidated.counts.qualified, 0); assert.equal(invalidated.counts.production, 0);
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
  test('future complete release can satisfy the full minimum record contract', data => {
    activeWorld(data);
    const prototype = structuredClone(data.worlds[0]);
    data.worlds = Array.from({ length: 108 }, (_, i) => ({ ...structuredClone(prototype), id: `test-world-${i}` }));
    for (const row of data.evidence) if (row.worldId) row.worldId = data.worlds.map(world => world.id);
    data.version.status = 'released'; data.version.finalAcceptance = { date: '2026-10-02', evidenceIds: ['auth'] };
    for (const iteration of data.iterations) { iteration.state = 'closed'; iteration.stage = 'close'; iteration.actualRevision = 'plan-r100'; iteration.evidenceIds = ['auth']; }
  }, true);
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
  console.log(JSON.stringify({ command, status: data.version.status, counts: result.counts, iterations: data.iterations.length,
    workflowSteps: data.workflow.length, sourceSha256: createHash('sha256').update(source).digest('hex'), ...(command === 'render' ? { output: relative(ROOT, output) } : {}) }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
