#!/usr/bin/env node
/**
 * 校验三份 agent 定义：.claude/agents（正本）、.cursor/agents、.codebuddy/agents。
 *
 * 一、.claude 与 .cursor 互为镜像：
 *   - 正文（frontmatter 之后的部分）必须逐字一致
 *   - frontmatter 只允许在 `model` 一个键上取不同的值
 *
 * 之所以放开 model：两个运行时的模型 ID 词汇表不重叠（Cursor 认 `claude-opus-5`
 * 这样的全名，Claude Code 认 `opus` 这样的别名），无法用同一个值同时生效。
 * 其余任何差异都是漂移，必须报错。
 *
 * 二、.codebuddy 是从正本派生的副本，只校验派生契约，不要求 frontmatter 同构：
 *   - 正文与 .claude 逐字一致
 *   - name 与文件名一致、agentMode === manual、enabled === true
 *   - tools 只能是正本 tools 的子集（可以少给，不许新增权限）
 *
 * 之所以不同构：CodeBuddy 的 frontmatter 格式不同（tools 是逗号串而非 YAML 列表，
 * 另有 agentMode / enabled 两个独有键，model 值域未知故不写）。
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIRS = { claude: join(ROOT, '.claude', 'agents'), cursor: join(ROOT, '.cursor', 'agents') };
const CODEBUDDY_DIR = join(ROOT, '.codebuddy', 'agents');
const DIVERGENCE_ALLOWED = new Set(['model']);

/** 拆出 frontmatter 的键值对与正文；换行统一为 \n 以免 CRLF 造成假阳性。 */
function split(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { front: null, body: text };
  const front = new Map();
  let key = null;
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      front.set(key, kv[2]);
    } else if (key && line.trim()) {
      // 列表项等续行，累加进当前键，保证 tools 之类的多行值也被比对
      front.set(key, `${front.get(key)}\n${line.trim()}`);
    }
  }
  return { front, body: text.slice(m[0].length) };
}

const errors = [];
const names = new Set();
for (const dir of Object.values(DIRS)) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    errors.push(`目录不存在：${dir}`);
    continue;
  }
  for (const f of entries.filter((f) => f.endsWith('.md'))) names.add(f);
}

for (const name of [...names].sort()) {
  const [a, b] = await Promise.all(
    [DIRS.claude, DIRS.cursor].map((d) =>
      readFile(join(d, name), 'utf8').then(split).catch(() => null)
    )
  );
  if (!a || !b) {
    errors.push(`${name}: 只存在于一侧（.claude=${!!a} .cursor=${!!b}）`);
    continue;
  }
  if (a.body !== b.body) {
    const at = a.body.split('\n');
    const bt = b.body.split('\n');
    const i = at.findIndex((l, idx) => l !== bt[idx]);
    errors.push(`${name}: 正文不一致，首个差异在正文第 ${i + 1} 行\n    .claude: ${at[i]}\n    .cursor: ${bt[i]}`);
  }
  if (!a.front || !b.front) {
    errors.push(`${name}: 缺少 frontmatter（.claude=${!!a.front} .cursor=${!!b.front}）`);
    continue;
  }
  for (const key of new Set([...a.front.keys(), ...b.front.keys()])) {
    if (DIVERGENCE_ALLOWED.has(key)) continue;
    if (a.front.get(key) !== b.front.get(key)) {
      errors.push(`${name}: frontmatter "${key}" 不一致（只允许 model 有差异）`);
    }
  }
  for (const key of DIVERGENCE_ALLOWED) {
    if (!a.front.has(key) || !b.front.has(key)) {
      errors.push(`${name}: 两侧都必须显式声明 frontmatter "${key}"`);
    }
  }
}

/** 抽出 frontmatter 里 tools 的工具名集合：兼容 YAML 列表与逗号串两种写法。 */
function toolSet(value) {
  return new Set(
    String(value ?? '')
      .split(/[\n,]/)
      .map((s) => s.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean)
  );
}

// CodeBuddy 派生副本：正文逐字一致 + manual 模式的硬性要求 + 工具不越权。
for (const name of [...names].sort()) {
  const src = await readFile(join(DIRS.claude, name), 'utf8').then(split).catch(() => null);
  const cb = await readFile(join(CODEBUDDY_DIR, name), 'utf8').then(split).catch(() => null);
  if (!cb) {
    errors.push(`${name}: 缺少 CodeBuddy 副本（.codebuddy/agents/）`);
    continue;
  }
  if (!src) continue; // 正本缺失已在上一段报错
  if (cb.body !== src.body) {
    const a = cb.body.split('\n');
    const b = src.body.split('\n');
    const i = a.findIndex((l, idx) => l !== b[idx]);
    errors.push(
      `${name}: .codebuddy 正文与 .claude 不一致，首个差异在正文第 ${i + 1} 行\n` +
        `    .codebuddy: ${a[i]}\n    .claude:    ${b[i]}`
    );
  }
  if (!cb.front) {
    errors.push(`${name}: .codebuddy 缺少 frontmatter`);
    continue;
  }
  if (cb.front.get('name') !== name.replace(/\.md$/, '')) {
    errors.push(`${name}: .codebuddy 的 name 与文件名不一致（现为 ${cb.front.get('name') ?? '<未声明>'}）`);
  }
  if (cb.front.get('agentMode') !== 'manual') {
    errors.push(`${name}: .codebuddy 的 agentMode 必须是 manual（现为 ${cb.front.get('agentMode') ?? '<未声明>'}）`);
  }
  if (cb.front.get('enabled') !== 'true') {
    errors.push(`${name}: .codebuddy 的 enabled 必须是 true（现为 ${cb.front.get('enabled') ?? '<未声明>'}）`);
  }
  const srcTools = toolSet(src.front?.get('tools'));
  for (const t of toolSet(cb.front.get('tools'))) {
    if (!srcTools.has(t)) errors.push(`${name}: .codebuddy 用了正本没有的工具 "${t}"`);
  }
}

if (errors.length) {
  console.error(`agent 定义一致性校验未通过（${errors.length} 项）：`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `agent 定义一致性校验通过（${names.size} 个文件；.claude/.cursor 正文逐字一致且仅 model 有差异；` +
    `.codebuddy 为 manual 派生副本，正文逐字一致且工具不越权）`
);
