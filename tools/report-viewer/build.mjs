import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const out = resolve(root, 'docs/qa/reports');
const reports = JSON.parse(await readFile(resolve(here, 'reports.json'), 'utf8'));
const css = await readFile(resolve(here, 'report.css'), 'utf8');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash = data => createHash('sha256').update(data).digest('hex');
const scriptText = s => s.replace(/<\/script/gi, '<\\/script');
const head = title => `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><link rel="icon" href="data:,"><title>${esc(title)}</title><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body>`;
await mkdir(out, {recursive:true});
const manifest = { formatVersion:1, purpose:'Browser-readable exports of unchanged historical analytical snapshots, not game validation', reports:[] };
for (const report of reports) {
  const sourcePath = resolve(here, 'sources', `${report.id}.canvas.tsx`);
  const source = await readFile(sourcePath, 'utf8');
  const entry = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import Report from ${JSON.stringify(sourcePath)};
    const workspaceRoot = ${JSON.stringify(root + '/')};
    function fileUrl(path) {
      if (typeof path !== 'string') throw new TypeError('Expected a file path');
      if (/^https?:\\/\\//.test(path)) return path;
      if (path.startsWith(workspaceRoot)) path = path.slice(workspaceRoot.length);
      // Historical snapshots may have been authored before the repository moved.
      else if (/^\\/Users\\/[^/]+\\/coh\\//.test(path)) path = path.replace(/^\\/Users\\/[^/]+\\/coh\\//, '');
      else if (path.startsWith('/')) throw new Error('File is outside the report workspace');
      if (path.split('/').includes('..') || /^[a-z]+:/i.test(path)) throw new Error('Invalid report file path');
      return new URL('../../../' + path.split('/').map(encodeURIComponent).join('/'), location.href).href;
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
  const filename = `${report.id}.html`;
  const banner = `<header class="report-banner"><a href="index.html">全部报告</a><span>历史快照 · ${esc(report.date)}</span><p>${esc(report.note)}</p><a href="../../../${esc(report.current)}" target="_blank" rel="noopener">后续记录与当前状态</a></header>`;
  const html = `${head(report.title)}${banner}<main id="root"></main><noscript>请启用 JavaScript 以阅读交互报告。</noscript><script>${scriptText(result.outputFiles[0].text)}</script></body></html>\n`;
  await writeFile(resolve(out,filename), html);
  manifest.reports.push({...report, source:relative(root,sourcePath), sourceSha256:hash(source), output:relative(root,resolve(out,filename)), outputSha256:hash(html), bytes:Buffer.byteLength(html)});
  console.log(`Exported ${filename}`);
}
const items = reports.map(r=>`<li><div><a href="${esc(r.id)}.html">${esc(r.title)}</a><time>${esc(r.date)}</time></div><p>${esc(r.summary)}</p></li>`).join('\n');
await writeFile(resolve(out,'index.html'),`${head('游戏分析与评审报告')}<main class="report-index"><p class="eyebrow">那天之后 · 开发记录</p><h1>游戏分析与评审报告</h1><p>原有图表、筛选和图文目录。各页保留生成时的数据与判断，页面顶部标明历史范围。</p><ul>${items}</ul><footer>这些页面可直接用浏览器打开。阅读与交互不需要联网，也不会修改游戏存档。<br><a href="../../../docs/dev/report-viewer.md">刷新与使用说明</a></footer></main></body></html>\n`);
await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
