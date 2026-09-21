import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const reports = JSON.parse(await readFile(resolve(here, 'reports.json'), 'utf8'));
const catalog = JSON.parse(await readFile(resolve(root, 'docs/reviews/catalog.json'), 'utf8'));
const relocations = JSON.parse(await readFile(resolve(root, 'docs/reviews/relocations.json'), 'utf8'));
const css = await readFile(resolve(here, 'report.css'), 'utf8');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash = data => createHash('sha256').update(data).digest('hex');
const scriptText = s => s.replace(/<\/script/gi, '<\\/script');
const head = title => `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><link rel="icon" href="data:,"><title>${esc(title)}</title><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body>`;
const kinds = {review:'审查报告', design:'设计与探索', catalog:'内容目录'};
const readingIndex = 'docs/reading/index.html';
const reviewIndex = 'docs/reviews/index.html';
const legacyIndex = 'docs/qa/reports/index.html';

function repoPath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '.') || /^[a-z]+:/i.test(path)) throw new Error(`Expected a repository-relative path: ${path}`);
  return resolve(root, path);
}
function href(from, to) {
  return relative(dirname(repoPath(from)), repoPath(to)).split(sep).map(part => part === '..' ? part : encodeURIComponent(part)).join('/');
}
async function output(path, contents) {
  const absolute = repoPath(path);
  await mkdir(dirname(absolute), {recursive:true});
  await writeFile(absolute, contents);
}
function link(from, to, title, attrs = '') {
  return `<a href="${esc(href(from, to))}"${attrs}>${esc(title)}</a>`;
}
function redirectPage(from, to, title) {
  const target = href(from, to);
  // Keep old chat/file URLs usable in ordinary browsers, including file://.
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${esc(target)}"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>${esc(title)} · 入口已迁移</title></head><body><h1>阅读入口已迁移</h1><p>${link(from,to,title)}</p><p>若未自动打开，请点击上方链接。历史报告内容保持不变。</p></body></html>\n`;
}

if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.reports) || !Array.isArray(catalog.references)) throw new Error('Unsupported review catalog schema');
if (relocations.schemaVersion !== 1 || !relocations.paths || Array.isArray(relocations.paths)) throw new Error('Unsupported review relocation schema');
for (const [from, to] of Object.entries(relocations.paths)) { repoPath(from); repoPath(to); }
for (const [name, rows] of [['interactive reports',reports], ['review catalog',catalog.reports]]) {
  const ids = new Set();
  for (const row of rows) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(row.id) || ids.has(row.id)) throw new Error(`Invalid or duplicate ${name} id: ${row.id}`);
    ids.add(row.id);
    if (!row.title || !row.date) throw new Error(`Missing title/date: ${row.id}`);
  }
}
const outputPaths = new Set();
for (const report of reports) {
  const expected = report.kind === 'review' ? `docs/reviews/interactive/${report.id}.html` : `docs/reading/${report.id}.html`;
  if (!(report.kind in kinds) || report.output !== expected || outputPaths.has(report.output)) throw new Error(`Invalid output/kind: ${report.id}`);
  outputPaths.add(report.output);
  if (report.current) await access(repoPath(report.current));
}
// Fail before exporting if a catalog entry points at a missing canonical document.
// Summaries produced by this build need not already exist on a fresh checkout.
for (const report of catalog.reports) {
  if (!report.scope || !report.report || !report.note) throw new Error(`Incomplete review catalog entry: ${report.id}`);
  for (const key of ['report','summary','followUp']) if (report[key]) {
    repoPath(report[key]);
    if (!outputPaths.has(report[key])) await access(repoPath(report[key]));
  }
}
for (const reference of catalog.references) {
  if (!reference.title || !reference.kind) throw new Error('Incomplete review reference');
  await access(repoPath(reference.path));
}
for (const report of reports.filter(report => report.kind === 'review')) {
  if (!catalog.reports.some(entry => entry.summary === report.output)) throw new Error(`Interactive review missing from review catalog: ${report.id}`);
}

const manifest = {formatVersion:2, purpose:'Browser-readable exports of unchanged historical analytical snapshots, not game validation', reviewCatalog:'docs/reviews/catalog.json', reviewIndex, readingIndex, reports:[]};
for (const report of reports) {
  const sourcePath = resolve(here, 'sources', `${report.id}.canvas.tsx`);
  const source = await readFile(sourcePath, 'utf8');
  const repositoryPrefix = relative(dirname(repoPath(report.output)), root).split(sep).join('/') + '/';
  const entry = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import Report from ${JSON.stringify(sourcePath)};
    const workspaceRoot = ${JSON.stringify(root + '/')};
    const relocations = ${JSON.stringify(relocations.paths)};
    function fileUrl(path) {
      if (typeof path !== 'string') throw new TypeError('Expected a file path');
      if (/^https?:\\/\\//.test(path)) return path;
      if (path.startsWith(workspaceRoot)) path = path.slice(workspaceRoot.length);
      // Historical snapshots may have been authored before the repository moved.
      else if (/^\\/Users\\/[^/]+\\/coh\\//.test(path)) path = path.replace(/^\\/Users\\/[^/]+\\/coh\\//, '');
      else if (path.startsWith('/')) throw new Error('File is outside the report workspace');
      if (path.split('/').includes('..') || /^[a-z]+:/i.test(path)) throw new Error('Invalid report file path');
      path = Object.prototype.hasOwnProperty.call(relocations, path) ? relocations[path] : path;
      return new URL(${JSON.stringify(repositoryPrefix)} + path.split('/').map(encodeURIComponent).join('/'), location.href).href;
    }
    window.__reportFileUrl = fileUrl;
    window.__reportOpenFile = path => window.open(fileUrl(path), '_blank', 'noopener,noreferrer');
    document.addEventListener('click', event => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor) return;
      const raw = anchor.getAttribute('href');
      if (raw.startsWith('/Users/')) { event.preventDefault(); window.__reportOpenFile(raw); }
    });
    class ReportBoundary extends React.Component {
      state = {error:null};
      static getDerivedStateFromError(error) { return {error}; }
      componentDidCatch(error) { console.error(error); }
      render() { return this.state.error ? React.createElement('p', {role:'alert'}, '阅读页加载失败：' + this.state.error.message) : this.props.children; }
    }
    createRoot(document.getElementById('root')).render(React.createElement(ReportBoundary,null,React.createElement(Report)));
  `;
  const result = await build({
    stdin:{contents:entry, resolveDir:here, sourcefile:`${report.id}-entry.tsx`, loader:'tsx'},
    bundle:true, write:false, format:'iife', platform:'browser', target:'es2020', minify:true,
    jsx:'automatic', define:{'process.env.NODE_ENV':'"production"'},
    alias:{'cursor/canvas':resolve(here,'browser-adapter.tsx')}, legalComments:'inline',
  });
  const primary = report.kind === 'review' ? reviewIndex : readingIndex;
  const secondary = report.kind === 'review' ? readingIndex : reviewIndex;
  const banner = `<header class="report-banner"><nav>${link(report.output, primary, report.kind === 'review' ? '审查档案' : '全部阅读材料')} · ${link(report.output, secondary, report.kind === 'review' ? '设计与目录' : '审查档案')}</nav><p>历史快照 · ${esc(report.date)} · ${kinds[report.kind]}</p><p>${esc(report.note)}</p>${report.current ? link(report.output,report.current,'后续记录与当前状态',' target="_blank" rel="noopener"') : ''}</header>`;
  const html = `${head(report.title)}${banner}<main id="root"></main><noscript>请启用 JavaScript 以阅读交互报告。</noscript><script>${scriptText(result.outputFiles[0].text)}</script></body></html>\n`;
  await output(report.output, html);
  const legacy = `docs/qa/reports/${report.id}.html`;
  await output(legacy, redirectPage(legacy, report.output, report.title));
  manifest.reports.push({...report, source:relative(root,sourcePath), sourceSha256:hash(source), outputSha256:hash(html), bytes:Buffer.byteLength(html), legacy});
  console.log(`Exported ${report.output}`);
}

const groups = Object.entries(kinds).map(([kind,label]) => {
  const items = reports.filter(report => report.kind === kind).map(report => `<li data-report-id="${esc(report.id)}"><div>${link(readingIndex,report.output,report.title)}<time>${esc(report.date)}</time></div><p>${esc(report.summary)}</p></li>`).join('\n');
  return `<section aria-labelledby="${kind}-heading"><h2 id="${kind}-heading">${label}</h2>${kind === 'review' ? `<p>${link(readingIndex,reviewIndex,'完整审查档案：正文、交互摘要与后续处理')}</p>` : ''}<ul>${items}</ul></section>`;
}).join('\n');
await output(readingIndex, `${head('游戏阅读材料')}<main class="report-index"><p class="eyebrow">那天之后 · 开发记录</p><h1>游戏阅读材料</h1><p>按用途分开的交互材料。审查结果统一收在${link(readingIndex,reviewIndex,'审查档案')}；设计探索和内容目录保留在此。</p><p>各页保留生成时的数据与判断，页面顶部标明历史范围。</p>${groups}<footer>页面可直接用浏览器打开。阅读与交互不需要联网，也不会修改游戏存档。<br>${link(readingIndex,'docs/dev/report-viewer.md','刷新与使用说明')}</footer></main></body></html>\n`);

const reviewItems = catalog.reports.map(report => `<li data-review-id="${esc(report.id)}"><div>${link(reviewIndex,report.report,report.title,' data-review-link="report"')}<time>审查时点 · ${esc(report.date)}</time></div><p>范围：${esc(Array.isArray(report.scope) ? report.scope.join(' / ') : report.scope)}</p><nav class="report-index-links">${link(reviewIndex,report.report,report.report.endsWith('.md') ? '审查正文 · Markdown' : '审查正文 · 网页',' data-review-link="report"')}${report.summary ? link(reviewIndex,report.summary,'交互摘要',' data-review-link="summary"') : ''}${report.followUp ? link(reviewIndex,report.followUp,'后续处理',' data-review-link="followUp"') : ''}</nav><p class="report-history-note">${esc(report.note)}</p></li>`).join('\n');
const references = catalog.references.map(reference => `<li><div>${link(reviewIndex,reference.path,reference.title)}<span>${esc(reference.kind)}</span></div></li>`).join('\n');
await output(reviewIndex, `${head('游戏审查档案')}<main class="report-index"><p class="eyebrow">那天之后 · 专项审查</p><h1>游戏审查档案</h1><p>正式审查结果统一入口。每份报告保留原审查时点、范围与结论；后续整改和复验在“后续处理”中查看，不用历史缺陷推断当前状态。</p><nav class="report-index-links">${link(reviewIndex,'docs/reviews/README.md','归档规则与文本目录')}${link(reviewIndex,readingIndex,'设计与内容目录')}</nav><section aria-labelledby="reviews-heading"><h2 id="reviews-heading">审查结果 · ${catalog.reports.length} 份</h2><ul>${reviewItems}</ul></section><section aria-labelledby="references-heading"><h2 id="references-heading">规范与计划</h2><p>以下是审查方法和执行安排，不是审查结论。</p><ul>${references}</ul></section><footer>此目录由 catalog.json 生成，不复制各报告结论，也不改变验收状态。<br>${link(reviewIndex,'docs/dev/report-viewer.md','刷新与使用说明')}</footer></main></body></html>\n`);
await output(legacyIndex, redirectPage(legacyIndex, readingIndex, '游戏阅读材料'));
await output('docs/reading/manifest.json', JSON.stringify(manifest,null,2)+'\n');
await output('docs/qa/reports/manifest.json', JSON.stringify({formatVersion:2,movedTo:'docs/reading/manifest.json',note:'Compatibility marker; authoritative export manifest moved to docs/reading/manifest.json.'},null,2)+'\n');
