"""Export this plan and its review as an offline, read-only document.

Run from the repository root. Supports the small Markdown subset in these two
sources; it does not execute the game or touch browser/game storage.
"""
from pathlib import Path
from hashlib import sha256
from html import escape
import os
import re

ROOT = Path(__file__).resolve().parents[4]
OUTPUT = ROOT / 'docs/reading/preparation-threat-plan.html'
SOURCES = [ROOT / 'docs/tasks/preparation-threat-ux.md',
           ROOT / 'docs/reviews/2026-10-10-preparation-threat-plan.md']


def inline(text, source):
    def token(match):
        value = match.group(0)
        if value.startswith('`'):
            return '<code>' + escape(value[1:-1]) + '</code>'
        if value.startswith('**'):
            return '<strong>' + escape(value[2:-2]) + '</strong>'
        label, href = re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)', value).groups()
        if not re.match(r'^(?:https?:|#)', href):
            path, mark, anchor = href.partition('#')
            href = os.path.relpath(source.parent / path, OUTPUT.parent)
            if mark:
                href += '#' + anchor
        return '<a href="' + escape(href, quote=True) + '">' + escape(label) + '</a>'

    pattern = r'`[^`]+`|\*\*.+?\*\*|\[[^\]]+\]\([^)]+\)'
    parts, start = [], 0
    for match in re.finditer(pattern, text):
        parts.extend([escape(text[start:match.start()]), token(match)])
        start = match.end()
    return ''.join(parts) + escape(text[start:])


def render(source, prefix):
    lines = source.read_text().splitlines()
    if lines[0] == '---':
        lines = lines[lines.index('---', 1) + 1:]
    output, toc, paragraph = [], [], []
    list_kind = None
    headings = 0

    def flush():
        if paragraph:
            output.append('<p>' + inline(' '.join(paragraph), source) + '</p>')
            paragraph.clear()

    for line in lines:
        heading = re.match(r'^(#{1,3}) (.+)$', line)
        item = re.match(r'^(- |\d+\. )(.+)$', line)
        if not item and list_kind:
            output.append('</' + list_kind + '>')
            list_kind = None
        if not line.strip():
            flush()
        elif heading:
            flush()
            level, title = len(heading[1]), heading[2]
            if level == 1:
                continue  # Page already supplies the document title.
            headings += 1
            ident = prefix + '-' + str(headings)
            output.append(f'<h{level} id="{ident}">' + inline(title, source) + f'</h{level}>')
            if level == 2:
                toc.append(f'<a href="#{ident}">' + escape(title) + '</a>')
        elif item:
            flush()
            kind = 'ul' if item[1] == '- ' else 'ol'
            if list_kind and list_kind != kind:
                output.append('</' + list_kind + '>')
                list_kind = None
            if not list_kind:
                output.append('<' + kind + '>')
                list_kind = kind
            output.append('<li>' + inline(item[2], source) + '</li>')
        else:
            assert not line.startswith(('```', '|')), 'Unsupported Markdown block'
            paragraph.append(line)
    flush()
    if list_kind:
        output.append('</' + list_kind + '>')
    return '\n'.join(output), '\n'.join(toc)


plan, toc = render(SOURCES[0], 'plan')
review, _ = render(SOURCES[1], 'review')
fingerprints = ' · '.join(p.name + ' ' + sha256(p.read_bytes()).hexdigest()[:12] for p in SOURCES)
page = '''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>污染选择 · 威胁感知方案与计划</title>
<style>
:root{color-scheme:light;--ink:#242b29;--muted:#5b6660;--line:#ccd2cb;--paper:#f4f4ed;--accent:#32574b}
*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.85 system-ui,-apple-system,"PingFang SC",sans-serif}a{color:var(--accent);text-underline-offset:4px}header,main,footer{max-width:1180px;margin:auto;padding:36px 36px}header{border-bottom:1px solid var(--line)}header>p{max-width:790px;margin:12px 0}.eyebrow{color:var(--muted);font-size:12px;letter-spacing:.08em}h1{font-size:30px;line-height:1.5;margin:12px 0;font-weight:650}h2{font-size:22px;margin:42px 0 16px;padding-top:14px;border-top:1px solid var(--line);scroll-margin-top:16px}h3{font-size:17px;margin:28px 0 12px}.status{display:inline-block;font-size:13px;color:var(--accent);border-bottom:2px solid var(--accent)}.links{display:flex;gap:24px;flex-wrap:wrap;font-size:14px}main{display:grid;grid-template-columns:220px minmax(0,1fr);gap:48px;padding-top:28px}aside nav{position:sticky;top:24px}aside a{display:block;font-size:13px;padding:6px 0;text-decoration:none}aside strong{display:block;font-size:12px;color:var(--muted);margin-bottom:12px}article{min-width:0}article>p:first-child{margin-top:0}p,li{overflow-wrap:anywhere}p{margin:14px 0}ul,ol{padding-left:24px}li{margin:14px 0}strong{font-weight:650}code{font:13px/1.7 ui-monospace,monospace;background:#e8ece5;padding:2px 4px;border-radius:3px}details{margin-top:44px;border-top:2px solid var(--accent);padding-top:20px}summary{font-size:21px;font-weight:650;color:var(--accent);cursor:pointer}footer{font-size:12px;color:var(--muted);border-top:1px solid var(--line)}.route{font-size:14px;word-spacing:5px;color:var(--muted)}
@media(max-width:820px){header,main,footer{padding:24px}main{display:block}aside{margin-bottom:28px}aside nav{position:static}h1{font-size:26px}}@media print{aside,.links{display:none}main{display:block}body{background:white}details{break-before:page}}
</style>
<header><div class="eyebrow">那天之后 / R100 · I14 · P49 / 2026-10-10</div>
<h1>污染选择：威胁感知方案与计划</h1>
<span class="status">方案已审查并修订 · 新视听未实施</span>
<p>先让背景传达压力，再用简洁规则支持判断，用少量文学低语保留人物的感受。低档从容，中档有压力但仍有信心，重档需要慎重。</p>
<p class="route">P0 方案收口 ✓　→　P1 静态实景　→　P2 动效与声音　→　P3 正式启用　→　P4 体验验收</p>
<nav class="links"><a href="../tasks/preparation-threat-ux.md">方案源文档</a><a href="../reviews/2026-10-10-preparation-threat-plan.md">审查源文档</a><a href="rift-r100.html">进度看板</a><a href="index.html">设计阅读目录</a></nav>
</header>
<main><aside><nav aria-label="方案目录"><strong>方案与实施安排</strong>TOC<a href="#review">三方审查与逐项处置</a></nav></aside>
<article>PLAN<details id="review"><summary>三方审查与逐项处置</summary>REVIEW</details></article></main>
<footer>这是只读设计文档，不是游戏界面或新背景预览。P49 与 I14 保持开放。<br>由方案和审查源文档生成；离线可读，无游戏逻辑、外部资源或浏览器存储。<br>SOURCE_HASHES</footer></html>
'''
page = page.replace('TOC', toc).replace('PLAN', plan).replace('REVIEW', review).replace('SOURCE_HASHES', escape(fingerprints))
OUTPUT.write_text(page)
print(str(OUTPUT.relative_to(ROOT)))
