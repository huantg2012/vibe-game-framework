/** Offline, dependency-free views of the game-state text registry. No file I/O. */
const DELIVERY = { unknown: '接入待核实', design: '仅有设计', dev: '开发接入', production: '正式流程已接入', retired: '停用 / 取消' };
const WORK = { active: '推进中', paused: '已挂起', settled: '本轮已收口' };
const COVERAGE = { mapped: '已登记', unreviewed: '尚未梳理', 'not-applicable': '不适用' };
const KIND = { source: '静态核查', automated: '自动检查', runtime: '运行验证', human: '人工体验' };
const FRESHNESS = { unknown: '当前适用性未确认', changed: '关联实现已变化，需复核', unchanged: '关联实现未变，仅沿用原范围' };
const RESULT = { pass: '本条范围通过', fail: '本条范围失败', partial: '部分确认', unknown: '待确认' };
const ROLE = { spec: '规则', code: '实现', data: '内容数据', test: '测试代码', decision: '决策', art: '美术', audio: '音频', doc: '文档 / 报告' };
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (value = '') => String(value ?? '').replace(/\r?\n/g, ' ').replace(/([\\`*_[\]<>|])/g, '\\$1');
const list = (value) => Array.isArray(value) ? value : [];
const short = (value = '') => String(value || '未提供').slice(0, 14);

function sourceHref(path, prefix = '') {
  if (typeof path !== 'string' || !path || /[\\\u0000-\u001f]/.test(path) || path.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(path) || path.split('/').some((p) => p === '..' || p === '.' || !p)) return '';
  if (prefix && !/^(?:\.\.\/)*(?:\.\.?\/?)?$/.test(prefix)) return '';
  return (prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix) + path.split('/').map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
}

function prepare(model) {
  const features = list(model.features);
  const evidence = new Map(list(model.evidence).map((e) => [e.id, e]));
  const byId = new Map(features.map((f) => [f.id, f]));
  const evidenceFor = (f) => list(f.evidence).map((id) => evidence.get(id)).filter(Boolean);
  const attention = (f) => {
    const records = evidenceFor(f);
    return f.delivery === 'unknown' || list(f.unknowns).length > 0 || records.length === 0 || records.every((e) => e.kind === 'source') || records.some((e) => e.result !== 'pass' || model.evidenceFreshness?.[e.id]?.state !== 'unchanged');
  };
  return { features, evidence, byId, evidenceFor, attention };
}

function freshnessOf(model, evidence) {
  return model.evidenceFreshness?.[evidence.id] || { state: 'unknown', note: '未取得证据版本与当前关联实现的比较结果。', changed: [] };
}

function recordSummary(records) {
  if (!records.length) return '尚无验证记录';
  const kinds = [...new Set(records.map((e) => KIND[e.kind] || e.kind))].join('、');
  return `${records.length} 条：${kinds}`;
}

function diagnostics(model) {
  const d = model.diagnostics || {};
  return [
    ...list(d.errors).map((text) => ({ label: '结构错误', text })),
    ...list(d.stale).map((text) => ({ label: '来源变化', text })),
    ...list(d.unowned).map((text) => ({ label: '未归属清单', text })),
    ...list(d.warnings).map((text) => ({ label: '待关注', text })),
  ];
}

function sourceLink(source, prefix) {
  const href = sourceHref(source.path, prefix);
  const label = `<code>${esc(source.path)}</code>`;
  return `<li class="source-row"><span class="source-role">${esc(ROLE[source.role] || source.role || '来源')}</span><div>${href ? `<a href="${esc(href)}">${label}<span aria-hidden="true"> ↗</span></a>` : label}${source.note ? `<p>${esc(source.note)}</p>` : ''}</div></li>`;
}

function relation(id, byId) {
  const feature = byId.get(id);
  return feature ? `<button type="button" class="relation" data-jump="${esc(id)}"><span>${esc(feature.title)}</span><code>${esc(id)}</code><span aria-hidden="true">→</span></button>` : `<p class="muted">${esc(id)} · 未找到登记</p>`;
}

export function renderHtml(model) {
  const { features, byId, evidenceFor, attention } = prepare(model);
  const atlas = model.atlas || {};
  const meta = model.meta || {};
  const domains = list(atlas.domains);
  const notices = diagnostics(model);
  const needsRefresh = list(model.diagnostics?.stale).length > 0 || !meta.snapshotAt;
  const prefix = meta.linkPrefix || '';
  const sourceFingerprint = meta.fingerprint || '未生成';
  const dependencies = (id) => features.filter((f) => list(f.dependsOn).includes(id));
  const domainName = (id) => domains.find((d) => d.id === id)?.title || id;
  const items = features.map((f, index) => {
    const records = evidenceFor(f);
    const search = [f.id, f.title, f.summary, domainName(f.domain), ...list(f.entryPoints), ...list(f.unknowns), ...list(f.sources).map((s) => s.path)].join(' ').toLocaleLowerCase();
    return `<button type="button" class="feature-link" data-feature="${esc(f.id)}" data-domain="${esc(f.domain)}" data-delivery="${esc(f.delivery)}" data-work="${esc(f.work)}" data-attention="${attention(f)}" data-search="${esc(search)}" aria-controls="feature-detail-${index}" aria-pressed="false"><span class="feature-top"><code>${esc(f.id)}</code>${attention(f) ? '<span class="attention-dot" title="存在待核实项"></span>' : ''}</span><strong>${esc(f.title)}</strong><span class="feature-summary">${esc(f.summary)}</span><span class="feature-bottom"><span class="tag delivery-${esc(f.delivery)}">${esc(DELIVERY[f.delivery] || f.delivery)}</span><span>${records.length} 条验证记录</span></span></button>`;
  }).join('');
  const details = features.map((f, index) => {
    const records = evidenceFor(f);
    const dependents = dependencies(f.id);
    const constraints = list(atlas.constraints).filter((c) => list(c.featureIds).includes(f.id));
    return `<article class="feature-detail" id="feature-detail-${index}" data-detail="${esc(f.id)}" hidden aria-labelledby="feature-title-${index}"><div class="detail-eyebrow">${esc(domainName(f.domain))}<span> / </span><code>${esc(f.id)}</code></div><h2 id="feature-title-${index}" tabindex="-1">${esc(f.title)}</h2><p class="detail-summary">${esc(f.summary)}</p><div class="status-grid"><div><span>接入状态</span><strong>${esc(DELIVERY[f.delivery] || f.delivery)}</strong><small>正式接入不等于体验验收</small></div><div><span>工作状态</span><strong>${esc(WORK[f.work] || f.work)}</strong><small>收口不等于所有方面通过</small></div><div><span>验证记录</span><strong>${records.length ? `${records.length} 条独立记录` : '尚无记录'}</strong><small>${esc(records.length ? [...new Set(records.map((e) => KIND[e.kind] || e.kind))].join(' / ') : '需补充可追溯依据')}</small></div></div>
      <section class="detail-section"><h3>怎样进入和体验</h3>${list(f.entryPoints).length ? `<ol class="entry-list">${f.entryPoints.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>` : '<p class="empty-note">未登记入口，暂不能据此确认玩家可达。</p>'}</section>
${list(f.unknowns).length ? `<section class="detail-section unknown-box"><h3>尚未确认</h3><ul>${f.unknowns.map((u) => `<li>${esc(u)}</li>`).join('')}</ul></section>` : ''}
      <section class="detail-section"><h3>权威正文与实现位置</h3><ul class="sources">${list(f.sources).map((s) => sourceLink(s, prefix)).join('') || '<li class="empty-note">尚未登记来源。</li>'}</ul></section>
      <section class="detail-section"><div class="section-heading"><h3>验证依据</h3><span>每条结论只覆盖其声明范围</span></div>${records.length ? `${records.every((e) => e.kind === 'source') ? '<p class="empty-note">目前只有静态核查，尚未记录运行或人工体验证据。</p>' : ''}<div class="evidence-list">${records.map((e) => `<article class="evidence-record"><div class="evidence-heading"><span class="tag">${esc(KIND[e.kind] || e.kind)}</span><span class="result result-${esc(e.result)}">${esc(RESULT[e.result] || e.result)}</span></div><div class="evidence-meta"><code>${esc(e.id)}</code><span>记录于 ${esc(e.date)}</span><span>版本 <code>${esc(e.revision)}</code></span></div><dl><dt>确认范围</dt><dd>${esc(e.scope)}</dd><dt>限制与未覆盖</dt><dd>${esc(e.limitations || '未说明限制；不要推定覆盖整项功能。')}</dd></dl><ul class="sources compact">${list(e.sources).map((s) => sourceLink(s, prefix)).join('')}</ul><div class="freshness freshness-${esc(freshnessOf(model, e).state)}"><strong>${esc(FRESHNESS[freshnessOf(model, e).state] || '当前适用性未确认')}</strong><p>${esc(freshnessOf(model, e).note)}</p>${list(freshnessOf(model, e).changed).length ? `<ul>${freshnessOf(model, e).changed.map((path) => `<li><code>${esc(path)}</code></li>`).join('')}</ul>` : ''}</div><p class="historical-note">这是该日期、该版本的记录；来源基线一致也不会自动将其升级为当前版本通过。</p></article>`).join('')}</div>` : '<p class="empty-note">暂无可追溯验证记录。条目已登记不代表功能已经过验证。</p>'}</section>
      <section class="detail-section"><h3>关联系统</h3><div class="relations-grid"><div><h4>依赖这些功能</h4>${list(f.dependsOn).map((id) => relation(id, byId)).join('') || '<p class="muted">未登记依赖。</p>'}</div><div><h4>这些功能依赖它</h4>${dependents.map((dep) => relation(dep.id, byId)).join('') || '<p class="muted">未登记下游。</p>'}</div></div></section>
      <section class="detail-section"><h3>关联约束与决策</h3>${constraints.map((c) => `<div class="constraint ${c.status === 'superseded' ? 'superseded' : ''}"><div><code>${esc(c.id)}</code><span class="tag">${c.status === 'active' ? '当前有效' : '已被替代'}</span></div><p>${esc(c.statement)}</p>${c.supersededBy ? `<p class="muted">替代决策：${esc(c.supersededBy)}</p>` : ''}${c.source ? `<ul class="sources compact">${sourceLink(c.source, prefix)}</ul>` : ''}</div>`).join('') || '<p class="muted">没有关联约束记录；这不表示不存在项目级约束。</p>'}</section>
    </article>`;
  }).join('');
  const domainCards = domains.map((d) => {
    const children = features.filter((f) => f.domain === d.id);
    return `<article class="domain-card"><button type="button" class="domain-select" data-domain-select="${esc(d.id)}" aria-pressed="false"><span class="domain-line"><span class="coverage coverage-${esc(d.coverage)}">${esc(COVERAGE[d.coverage] || d.coverage)}</span><span>${children.length} 项</span></span><strong>${esc(d.title)}</strong><span class="domain-note">${esc(d.note || '未补充领域说明。')}</span></button><div class="domain-features">${children.slice(0, 4).map((f) => `<button type="button" data-jump="${esc(f.id)}">${esc(f.title)}<span aria-hidden="true">↗</span></button>`).join('') || `<p>${d.coverage === 'not-applicable' ? '此游戏无需该领域；原因见上方说明。' : '此领域尚无功能登记。'}</p>`}${children.length > 4 ? `<button type="button" class="more" data-domain-select="${esc(d.id)}">查看其余 ${children.length - 4} 项 →</button>` : ''}</div></article>`;
  }).join('');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(atlas.project?.title || '游戏')} · 现状地图</title><style>${styles}</style></head>
<body><div class="shell"><header class="hero"><div class="eyebrow"><span class="logo-mark" aria-hidden="true">◈</span> GAME STATE ATLAS <span class="edition">文本驱动 · 离线快照</span></div><div class="hero-row"><div><h1>${esc(atlas.project?.title || '游戏现状地图')}</h1><p class="hero-summary">${esc(atlas.project?.summary || '从玩家能力、系统入口到验证依据，建立可追溯的游戏全貌。')}</p></div><a class="text-source" href="${esc(sourceHref('INDEX.md'))}">阅读文本索引 ↗</a></div><div class="stats"><div><strong>${domains.length}</strong><span>已列出的领域</span></div><div><strong>${features.length}</strong><span>已登记功能</span></div><div><strong>${features.filter((f) => f.delivery === 'production').length}</strong><span>声明正式接入</span></div><div><strong>${features.filter(attention).length}</strong><span>有待核实项</span></div></div><p class="count-note">数量来自登记清单，不代表全游戏已穷尽或全部通过验收。</p></header>
<section class="snapshot" aria-label="快照与证据状态"><div class="snapshot-main"><span class="snapshot-indicator ${needsRefresh ? 'caution' : ''}" aria-hidden="true"></span><strong>${needsRefresh ? (meta.snapshotAt ? '来源已变化，需要重新核对' : '尚未建立来源基线') : '生成时来源与基线一致'}</strong><span>基线是文件指纹，不是验收结论。</span></div><details><summary>快照信息${notices.length ? ` · ${notices.length} 条提醒` : ''}</summary><dl class="snapshot-fields"><dt>生成时间</dt><dd>${esc(meta.generatedAt || '未提供')}</dd><dt>来源基线时间</dt><dd>${esc(meta.snapshotAt || '未建立')}</dd><dt>生成版本</dt><dd><code>${esc(meta.revision || '未提供')}</code></dd><dt>来源指纹</dt><dd><code>${esc(sourceFingerprint)}</code></dd><dt>登记源</dt><dd><code>${esc(meta.atlasPath || '未提供')}</code></dd></dl>${notices.length ? `<ul class="diagnostics">${notices.map((n) => `<li><span>${esc(n.label)}</span>${esc(n.text)}</li>`).join('')}</ul>` : '<p class="muted">生成时没有报告结构或来源差异；未覆盖的内容仍可能存在。</p>'}<p class="muted">本文件离线打开后不能自动检测后续修改。需要最新状态时，从文本源重新生成。</p></details></section>
<main><section class="overview" aria-labelledby="overview-title"><div class="section-heading"><div><span class="section-number">01 / 全貌</span><h2 id="overview-title">游戏由哪些部分构成</h2></div><p>先看领域，再沿功能与依赖深入。空白领域也保留在地图上。</p></div><div class="domain-grid">${domainCards || '<p class="empty-note">尚未登记领域。</p>'}</div></section>
<section class="browser" id="feature-browser" aria-labelledby="browser-title"><div class="section-heading"><div><span class="section-number">02 / 事实与依据</span><h2 id="browser-title">功能浏览器</h2></div><p>接入、工作进展与验证记录分开阅读。</p></div><form class="filters" id="filters" role="search"><label class="search-label"><span>搜索功能、入口、来源</span><input type="search" id="search" placeholder="例如：首次体验、背包、结算…" autocomplete="off"></label><label><span>领域</span><select id="domain-filter"><option value="">全部领域</option>${domains.map((d) => `<option value="${esc(d.id)}">${esc(d.title)}</option>`).join('')}</select></label><label><span>接入状态</span><select id="delivery-filter"><option value="">全部接入状态</option>${Object.entries(DELIVERY).map(([value, title]) => `<option value="${value}">${title}</option>`).join('')}</select></label><label><span>工作状态</span><select id="work-filter"><option value="">全部工作状态</option>${Object.entries(WORK).map(([value, title]) => `<option value="${value}">${title}</option>`).join('')}</select></label><label class="checkbox-label"><input type="checkbox" id="attention-filter"><span>只看待核实</span></label><button type="reset" class="reset-button">重置</button></form><p class="filter-note">“待核实”包含接入未知、存在未决事项、缺少记录、仅静态核查、有未通过记录或证据适用性未确认；历史通过记录仍需按版本和范围判断。</p><div class="browser-layout"><aside class="feature-sidebar" aria-label="功能清单"><div class="list-heading"><span>登记功能</span><span id="result-count" aria-live="polite">${features.length} 项</span></div><div id="feature-list">${items}</div><p id="empty-list" class="empty-note" hidden>没有符合条件的功能。可清除搜索或放宽筛选。</p></aside><div class="detail-pane" id="detail-pane"><p class="empty-note" id="empty-detail">选择一项功能，查看入口、来源和证据。</p>${details}</div></div></section>
<section class="inventory-section"><details><summary>覆盖检查与实现清单 <span>${list(model.inventory).length} 组</span></summary><p class="muted">这些是登记过的文件发现规则，可帮助识别新入口遗漏。它们不能证明所有玩法都已登记。</p>${list(model.inventory).map((group) => `<details class="inventory-group"><summary>${esc(group.title || group.id)} <span>${list(group.files).length} 个文件 / ${list(group.unowned).length} 个未归属</span></summary><ul>${list(group.files).map((path) => `<li><code>${esc(path)}</code>${list(group.unowned).includes(path) ? '<span class="tag warning">未关联功能</span>' : ''}</li>`).join('') || '<li class="muted">未发现匹配文件。</li>'}</ul></details>`).join('') || '<p class="empty-note">尚未配置实现清单。</p>'}</details></section></main>
<footer><span>从文本维护事实，从地图找到入口。</span><span>来源指纹 ${esc(short(sourceFingerprint))} · ${esc(meta.generatedAt || '')}</span></footer></div><script>${clientScript}</script></body></html>`;
}

export function renderIndex(model) {
  const { features, evidenceFor, attention } = prepare(model);
  const atlas = model.atlas || {};
  const meta = model.meta || {};
  const notices = diagnostics(model);
  const prefix = meta.linkPrefix || '';
  const linked = (label, path) => {
    const href = sourceHref(path, prefix);
    return href ? `[${label}](${href})` : label;
  };
  const lines = [`# ${md(atlas.project?.title || '游戏')} · 当前状态索引`, '', '> 由文本登记源生成，请勿手工编辑本索引。先读全貌，再按功能 ID 打开模块正文；验证详单保留在证据文件和可视地图。', '', md(atlas.project?.summary || ''), '', `- 生成：${md(meta.generatedAt || '未提供')}；版本：${md(meta.revision || '未提供')}`, `- 来源基线：${md(meta.snapshotAt || '未建立')}；指纹：${md(meta.fingerprint || '未生成')}`, `- 登记源：${linked(md(meta.atlasPath || '未提供'), meta.atlasPath)}`, `- ${features.length} 项登记功能 / ${features.filter((f) => f.delivery === 'production').length} 项声明正式接入 / ${features.filter(attention).length} 项有待核实信息`, '', '**登记数量不代表全游戏已穷尽；接入、工作收口、验证通过互不等价。基线不是验收。**', '', '[可视地图与完整证据](atlas.html)', '', '## 来源与覆盖提醒', ''];
  if (notices.length) {
    lines.push(`共 ${notices.length} 条提醒，以下预览最多 8 条；完整结果运行 check 或查看地图。`, '', ...notices.slice(0, 8).map((n) => `- ${md(n.label)}：${md(n.text)}`));
  } else lines.push('- 生成时未报告结构或来源差异；不表示全部内容已登记或验证。');
  lines.push('- 此索引不会自动感知之后的修改；开工运行 check，需要最新索引时重新生成。', '', '## 领域与功能', '');
  for (const domain of list(atlas.domains)) {
    const children = features.filter((f) => f.domain === domain.id);
    lines.push(`### ${md(domain.title)} · ${md(COVERAGE[domain.coverage] || domain.coverage)}`, '', `${md(domain.note || '未补充领域说明。')}（${children.length} 项）`, '');
    if (!children.length) lines.push('- 暂无功能登记。', '');
    for (const feature of children) {
      const records = evidenceFor(feature);
      const location = model.featureLocations?.[feature.id];
      const label = `**${md(feature.id)} · ${md(feature.title)}**`;
      lines.push(`- ${linked(label, location)}：${md(feature.summary)}`, `  接入：${md(DELIVERY[feature.delivery] || feature.delivery)} · 工作：${md(WORK[feature.work] || feature.work)} · 验证：${md(recordSummary(records))}${attention(feature) ? ' · **待核实**' : '（仍限原版本与范围）'}`, '');
    }
  }
  lines.push('## 约束与有效决策', '');
  for (const constraint of list(atlas.constraints)) {
    lines.push(`- **${md(constraint.id)} · ${constraint.status === 'active' ? '有效' : '已替代'}**：${md(constraint.statement)}${constraint.source ? ` — ${linked(md(constraint.source.path), constraint.source.path)}` : ''}${constraint.supersededBy ? `；替代：${md(constraint.supersededBy)}` : ''}`);
  }
  if (!list(atlas.constraints).length) lines.push('- 暂无登记；不表示没有项目约束。');
  lines.push('', '## 实现覆盖清单', '');
  for (const group of list(model.inventory)) lines.push(`- ${md(group.title || group.id)}：${list(group.files).length} 个文件 / ${list(group.unowned).length} 个未归属功能；细目见 check。`);
  if (!list(model.inventory).length) lines.push('- 尚未配置。');
  lines.push('', '> “待核实”包含接入未知、未决事项、缺少记录、只有源码核对、未通过记录或证据适用性未确认。历史记录不会因重新建立基线而变成当前版本通过。', '');
  return lines.join('\n');
}

const styles = `
:root{--ink:#172c31;--muted:#687a7d;--line:#dfe6e4;--teal:#227565;--paper:#f5f7f3;--amber:#a15b15;--soft:#edf2ed;--white:#fff;--radius:14px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--ink);background:var(--paper);font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button,a,input,select,summary{-webkit-tap-highlight-color:transparent}button{color:inherit;cursor:pointer}a{color:var(--teal);text-underline-offset:3px}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #d4a35b;outline-offset:3px}[hidden]{display:none!important}.shell{max-width:1480px;padding:52px 42px 24px;margin:auto}.eyebrow{display:flex;gap:10px;align-items:center;letter-spacing:.16em;font-size:11px;font-weight:750;color:var(--teal)}.logo-mark{font-size:25px;line-height:1}.edition{margin-left:auto;color:var(--muted);font-weight:500;letter-spacing:.08em}.hero-row{display:flex;justify-content:space-between;gap:32px;align-items:flex-start;margin-top:28px}h1{font-size:clamp(30px,3.4vw,48px);line-height:1.2;letter-spacing:-.04em;margin:0;font-weight:700}.hero-summary{max-width:820px;font-size:15px;line-height:1.9;color:var(--muted);margin:16px 0 0}.text-source{flex-shrink:0;font-size:12px;padding:10px 14px;border:1px solid var(--line);border-radius:24px;text-decoration:none;margin-top:4px;background:#ffffff88}.stats{display:flex;margin-top:32px;gap:42px}.stats>div{display:flex;gap:12px;align-items:baseline}.stats strong{font-size:30px;font-weight:550;letter-spacing:-.05em}.stats span{font-size:12px;color:var(--muted)}.count-note{font-size:11px;color:var(--muted);margin:12px 0 0}.snapshot{margin:26px 0 44px;border:1px solid var(--line);border-radius:10px;background:#fff9;padding:14px 18px;font-size:12px}.snapshot-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.snapshot-main>span:last-child{color:var(--muted)}.snapshot-indicator{width:7px;height:7px;background:#7b9690;border-radius:100%}.snapshot-indicator.caution{background:#c58b38}.snapshot details{margin-top:10px}.snapshot summary{color:var(--muted);cursor:pointer}.snapshot-fields{display:grid;grid-template-columns:100px 1fr;gap:8px;margin-top:20px}.snapshot-fields dt{color:var(--muted)}.snapshot-fields dd{margin:0;overflow-wrap:anywhere}.diagnostics{padding:0;list-style:none;border-top:1px solid var(--line);padding-top:12px;max-height:260px;overflow:auto}.diagnostics li{display:flex;gap:12px;line-height:1.8;padding:3px 0;overflow-wrap:anywhere}.diagnostics li span{color:var(--amber);flex-shrink:0}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:20px}.section-heading h2{font-size:22px;letter-spacing:-.02em;margin:6px 0 0;font-weight:650}.section-number{font-size:10px;letter-spacing:.13em;color:var(--teal);font-weight:650}.section-heading p,.section-heading>span{font-size:12px;line-height:1.7;color:var(--muted);margin:0}.domain-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:22px 0 44px}.domain-card{background:var(--white);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}.domain-select{padding:18px 20px 14px;width:100%;text-align:left;border:0;background:transparent;display:block;transition:background .12s}.domain-select:hover,.domain-select[aria-pressed=true]{background:#edf4ee}.domain-line{display:flex;justify-content:space-between;color:var(--muted);font-size:11px;line-height:1.5}.coverage{color:var(--teal)}.coverage-unreviewed{color:var(--amber)}.coverage-not-applicable{color:var(--muted)}.domain-select strong{display:block;font-size:18px;font-weight:650;margin:12px 0 7px}.domain-note{display:block;font-size:12px;line-height:1.7;color:var(--muted);min-height:2.9em}.domain-features{padding:0 20px 13px}.domain-features button{display:flex;justify-content:space-between;gap:12px;width:100%;border:0;border-top:1px solid #edf0ed;background:transparent;padding:9px 0;font-size:12px;text-align:left}.domain-features button:hover{color:var(--teal)}.domain-features button span{color:#92aaa1}.domain-features .more{color:var(--teal)}.domain-features p{color:var(--muted);font-size:12px;line-height:1.7}.filters{display:flex;align-items:end;gap:10px;padding:18px;background:#eaf0eb;border-radius:12px;margin-top:22px;flex-wrap:wrap}.filters label:not(.checkbox-label){display:flex;flex-direction:column;gap:7px;font-size:11px;color:var(--muted)}.search-label{flex:1;min-width:200px}.filters input[type=search],.filters select{border:1px solid #d4dfd8;border-radius:7px;background:#fff;padding:10px 11px;font-size:12px;color:var(--ink);min-height:38px}.filters input[type=search]{width:100%}.checkbox-label{display:flex;gap:6px;align-items:center;min-height:38px;white-space:nowrap;font-size:12px}.checkbox-label input{accent-color:var(--teal)}.reset-button{font-size:12px;padding:10px;border:0;background:transparent;min-height:38px;color:var(--teal)}.filter-note{color:var(--muted);font-size:11px;line-height:1.8;margin:10px 0 18px}.browser-layout{display:grid;grid-template-columns:minmax(230px,320px) minmax(0,1fr);gap:22px;align-items:start}.feature-sidebar{border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden;position:sticky;top:18px;max-height:calc(100vh - 36px);display:flex;flex-direction:column}.list-heading{padding:13px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;font-size:11px;color:var(--muted);flex-shrink:0}#feature-list{overflow:auto;scrollbar-width:thin}.feature-link{display:block;width:100%;text-align:left;background:transparent;border:0;border-left:3px solid transparent;border-bottom:1px solid #e9eeea;padding:16px 16px 16px 13px;transition:background .12s}.feature-link:last-child{border-bottom:0}.feature-link:hover{background:#f5f8f5}.feature-link[aria-pressed=true]{border-left-color:var(--teal);background:#eff5ee}.feature-top{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:10px}.attention-dot{background:#c8a15f;width:6px;height:6px;border-radius:100%}.feature-link strong{display:block;font-size:15px;font-weight:650;margin:7px 0}.feature-summary{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;line-height:1.7;color:var(--muted)}.feature-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;font-size:10px;color:var(--muted)}.tag{display:inline-block;border-radius:4px;padding:3px 6px;font-size:10px;background:#eef1ee;color:#60746d;line-height:1.4;font-weight:500}.delivery-production{background:#e2eee6;color:#35664b}.delivery-unknown,.warning{background:#f6eedf;color:#8f681e}.delivery-retired{background:#efefef;color:#818181}.detail-pane{min-height:450px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:30px 32px}.detail-eyebrow{display:flex;gap:10px;font-size:11px;color:var(--muted);line-height:1.8}.feature-detail h2{font-size:28px;line-height:1.35;letter-spacing:-.03em;margin:10px 0 14px;font-weight:650}.detail-summary{font-size:14px;line-height:1.9;color:#4e6667;margin:0 0 24px}.status-grid{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:12px;padding:18px;background:#f3f6f2;border-radius:8px}.status-grid>div{display:flex;flex-direction:column;gap:7px}.status-grid span{font-size:10px;color:var(--muted)}.status-grid strong{font-size:12px;line-height:1.6;font-weight:650}.status-grid small{font-size:10px;line-height:1.6;color:var(--muted)}.detail-section{margin-top:28px;border-top:1px solid var(--line);padding-top:22px}.detail-section h3{font-size:14px;margin:0 0 14px;font-weight:650}.detail-section .section-heading{align-items:start}.detail-section .section-heading>span{font-size:10px}.entry-list{padding-left:20px;color:#465e60;font-size:13px;line-height:1.9}.entry-list li{padding-left:3px;margin-bottom:5px}.unknown-box{border:1px solid #eadcc2;border-radius:8px;padding:16px 18px;background:#fffcf4}.unknown-box h3{color:#8f621e;font-size:12px;margin-bottom:10px}.unknown-box ul{margin:0;padding-left:18px;font-size:12px;line-height:1.9;color:#8b6c40}.sources{list-style:none;padding:0;margin:0}.source-row{display:grid;grid-template-columns:75px minmax(0,1fr);gap:8px;font-size:12px;line-height:1.7;margin:9px 0}.source-row code{font-size:11px;overflow-wrap:anywhere}.source-row a{text-decoration:none}.source-row a:hover{text-decoration:underline}.source-role{font-size:10px;color:var(--muted);padding-top:1px}.source-row p{margin:3px 0 0;color:var(--muted);font-size:11px}.evidence-list{display:grid;gap:12px}.evidence-record{padding:16px;background:#fafbf8;border:1px solid #e8ede6;border-radius:8px}.evidence-heading{display:flex;justify-content:space-between;gap:12px;align-items:center}.result{font-size:11px;color:var(--muted)}.result-pass{color:#44725b}.result-fail{color:#a04332}.result-partial,.result-unknown{color:#9a772d}.evidence-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:var(--muted);margin:10px 0 14px;overflow-wrap:anywhere}.evidence-record dl{display:grid;grid-template-columns:78px 1fr;gap:8px;font-size:12px;line-height:1.8}.evidence-record dt{color:var(--muted);font-size:10px;padding-top:2px}.evidence-record dd{margin:0;overflow-wrap:anywhere}.freshness{margin-top:12px;padding:10px;border-radius:6px;background:#eff3ed;font-size:10px;line-height:1.7;color:#5f7768}.freshness strong{font-weight:600}.freshness p{margin:3px 0 0}.freshness ul{padding-left:16px;margin:5px 0 0;overflow-wrap:anywhere}.freshness-changed,.freshness-unknown{background:#f6efdf;color:#886528}.historical-note{color:#85928c;font-size:10px;line-height:1.7;margin:13px 0 0}.compact .source-row{margin:6px 0}.relations-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.relations-grid h4{font-size:11px;color:var(--muted);font-weight:500;margin:0 0 12px}.relation{border:1px solid var(--line);background:#fafcf9;border-radius:6px;padding:10px;width:100%;display:grid;grid-template-columns:1fr auto;gap:5px;text-align:left;margin-bottom:7px}.relation:hover{background:#edf5ee}.relation span:first-child{font-size:12px}.relation code{font-size:9px;color:var(--muted);grid-row:2}.relation span:last-child{grid-column:2;grid-row:1 / 3;align-self:center;color:var(--teal)}.constraint{border-left:2px solid #abc4b6;padding:2px 0 2px 14px;margin-bottom:18px}.constraint>div{display:flex;gap:12px;align-items:center}.constraint code{font-size:10px;color:var(--muted)}.constraint>p{font-size:12px;line-height:1.85;margin:10px 0}.constraint.superseded{border-color:#d9ddda;color:#7d8783}.empty-note{font-size:12px;line-height:1.9;color:var(--muted);padding:12px;border-radius:7px;background:#f5f7f3;margin:10px 0}.feature-sidebar>.empty-note{margin:16px}.muted{color:var(--muted);font-size:11px;line-height:1.8}.inventory-section{margin:32px 0 0;padding:20px 24px;border:1px solid var(--line);border-radius:12px;background:#fff8}.inventory-section summary{font-size:13px;cursor:pointer}.inventory-section summary>span{font-size:11px;color:var(--muted);margin-left:12px}.inventory-group{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}.inventory-group summary{font-size:12px}.inventory-group ul{padding-left:20px;font-size:11px;line-height:1.8}.inventory-group li{overflow-wrap:anywhere;margin:6px 0}.inventory-group .tag{margin-left:10px}footer{display:flex;justify-content:space-between;gap:20px;font-size:10px;color:#87958f;padding:28px 0 0;line-height:1.8}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}html{scroll-behavior:smooth}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}@media(min-width:1300px){.domain-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:900px){.shell{padding:30px 22px}.domain-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.stats{gap:24px;flex-wrap:wrap}.stats>div{gap:8px}.browser-layout{grid-template-columns:250px minmax(0,1fr);gap:14px}.detail-pane{padding:24px 20px}.status-grid{grid-template-columns:1fr;gap:16px}.status-grid>div{gap:4px}.section-heading{align-items:start}.section-heading p{max-width:260px}.relations-grid{grid-template-columns:1fr}.hero-row{gap:16px}}@media(max-width:640px){.shell{padding:24px 16px}.hero-row{display:block}.text-source{display:inline-block;margin-top:18px}.edition{font-size:9px;letter-spacing:0}.stats{display:grid;grid-template-columns:1fr 1fr;gap:14px}.stats strong{font-size:27px}.stats span{font-size:11px}.snapshot{margin-bottom:32px}.section-heading{display:block}.section-heading p{margin-top:10px;max-width:none}.section-heading h2{font-size:20px}.domain-grid{grid-template-columns:1fr 1fr;gap:9px}.domain-select{padding:14px}.domain-features{padding:0 14px 10px}.domain-select strong{font-size:16px}.domain-note{font-size:11px}.domain-features button{font-size:11px}.filters{padding:12px;gap:8px}.search-label{flex-basis:100%}.filters label:not(.checkbox-label){flex:1}.filters select{width:100%;font-size:11px}.browser-layout{grid-template-columns:1fr}.feature-sidebar{position:static;max-height:330px}.detail-pane{padding:22px 18px}.feature-detail h2{font-size:25px}.status-grid{grid-template-columns:1fr 1fr 1fr;padding:14px;gap:8px}.status-grid strong{font-size:11px}.status-grid small{font-size:9px}.snapshot-fields{grid-template-columns:84px 1fr}.source-row{grid-template-columns:65px 1fr}.evidence-record dl{grid-template-columns:1fr;gap:2px}.evidence-record dd{margin-bottom:8px}.detail-section .section-heading{display:block}.detail-section .section-heading>span{display:block;margin:-7px 0 14px}footer{display:block}footer span{display:block}}@media print{.shell{padding:0}.filters,.feature-sidebar,.domain-features,.text-source{display:none}.browser-layout{display:block}.detail-pane{border:0}.feature-detail[hidden]{display:block!important;break-before:page}.snapshot details:not([open])>*:not(summary){display:block}button{color:var(--ink)}.domain-grid{grid-template-columns:repeat(3,1fr)}.feature-detail{break-inside:auto}.detail-section{break-inside:avoid}.inventory-section{display:none}}
`;

const clientScript = `
(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const form = byId('filters');
  const search = byId('search');
  const domain = byId('domain-filter');
  const delivery = byId('delivery-filter');
  const work = byId('work-filter');
  const attention = byId('attention-filter');
  const buttons = [...document.querySelectorAll('[data-feature]')];
  const details = [...document.querySelectorAll('[data-detail]')];
  const domainButtons = [...document.querySelectorAll('.domain-select')];
  let selected = null;
  function select(id, focus = false) {
    const button = buttons.find((item) => item.dataset.feature === id && !item.hidden);
    selected = button ? id : null;
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    details.forEach((item) => { item.hidden = item.dataset.detail !== selected; });
    byId('empty-detail').hidden = Boolean(button);
    if (button) {
      if (location.hash !== '#' + encodeURIComponent(id)) { try { history.replaceState(null, '', '#' + encodeURIComponent(id)); } catch {} }
      if (focus) details.find((item) => item.dataset.detail === id)?.querySelector('h2')?.focus({ preventScroll: true });
    }
  }
  function filter() {
    const terms = search.value.trim().toLocaleLowerCase().split(/\\s+/).filter(Boolean);
    const visible = buttons.filter((item) => {
      const data = item.dataset;
      const show = terms.every((term) => data.search.includes(term)) && (!domain.value || data.domain === domain.value) && (!delivery.value || data.delivery === delivery.value) && (!work.value || data.work === work.value) && (!attention.checked || data.attention === 'true');
      item.hidden = !show;
      return show;
    });
    byId('result-count').textContent = visible.length + ' / ' + buttons.length + ' 项';
    byId('empty-list').hidden = visible.length > 0;
    domainButtons.forEach((button) => button.setAttribute('aria-pressed', String(Boolean(domain.value) && button.dataset.domainSelect === domain.value)));
    select(visible.some((item) => item.dataset.feature === selected) ? selected : visible[0]?.dataset.feature);
  }
  function jump(id, scroll = true) {
    if (!buttons.some((item) => item.dataset.feature === id)) return;
    form.reset();
    filter();
    select(id, scroll);
    if (scroll) byId('feature-browser').scrollIntoView({ block: 'start' });
  }
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('reset', () => setTimeout(filter, 0));
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target) return;
    if (target.hasAttribute('data-feature')) select(target.dataset.feature, true);
    else if (target.hasAttribute('data-jump')) jump(target.dataset.jump);
    else if (target.hasAttribute('data-domain-select')) {
      search.value = ''; delivery.value = ''; work.value = ''; attention.checked = false;
      domain.value = target.dataset.domainSelect;
      filter();
      byId('feature-browser').scrollIntoView({ block: 'start' });
    }
  });
  function fromHash() {
    let id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch {}
    if (id) jump(id, false);
  }
  const initialHash = location.hash;
  filter();
  if (initialHash) {
    let id = '';
    try { id = decodeURIComponent(initialHash.slice(1)); } catch {}
    if (id) jump(id, false);
  }
  addEventListener('hashchange', fromHash);
})();
`;
