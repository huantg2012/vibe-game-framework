#!/usr/bin/env node
/** Export only frozen game sources and I14 diagnostic inputs, excluding saves and unrelated repository history. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const destination = process.argv[2] && path.resolve(process.argv[2]);
assert(destination && [3, 6].includes(process.argv.length), 'Usage: node tools/qa/package-r100-i14-device.mjs NEW_ABSOLUTE_OUTPUT_DIRECTORY [RC_PATH RC_SHA256 RUNTIME_POLICY_PATH]');
assert(!fs.existsSync(destination), 'Use a new directory; an existing kit is immutable.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const rcPath = process.argv[3] ?? 'docs/qa/artifacts/r100-i10-i12/release-candidate.json';
const rcExpected = process.argv[4] ?? 'fed6fb7896644ca74214ed6a8f265b2cebc40b49623393f8d68dabd5e1153be8';
const policyPath = process.argv[5] ?? 'docs/qa/artifacts/r100-i14/runtime-policy-freeze.json';
assert(/^[a-f0-9]{64}$/.test(rcExpected), 'Pass the reviewed immutable RC SHA-256.');
const rcBytes = fs.readFileSync(path.join(root, rcPath));
assert.equal(hash(rcBytes), rcExpected, 'I14 accepted RC changed');
const rc = JSON.parse(rcBytes);
const snapshotBytes = fs.readFileSync(path.join(root, rc.finalSource.path));
assert.equal(hash(snapshotBytes), rc.finalSource.sha256, 'RC source snapshot changed');
const sources = JSON.parse(snapshotBytes).sources;
const extras = ['package-lock.json', 'vite.config.ts',
  'tools/qa/run-r100-i14-device.mjs', 'tools/qa/check-r100-i14-runtime-budget.mjs',
  'tools/qa/check-r100-runtime-budget.mjs',
  policyPath, rcPath, rc.finalSource.path];
const files = new Map();
for (const [name, expected] of Object.entries(sources)) {
  const bytes = fs.readFileSync(path.join(root, name));
  assert.equal(hash(bytes), expected, `Frozen production source changed: ${name}`);
  files.set(name, bytes);
}
const packageIndexBytes = fs.readFileSync(path.join(root, rc.packages.path));
assert.equal(hash(packageIndexBytes), rc.packages.sha256, 'RC package index changed');
files.set(rc.packages.path, packageIndexBytes);
const dependencies = new Map();
for (const row of JSON.parse(packageIndexBytes).worlds) {
  const bytes = fs.readFileSync(path.join(root, row.dependencyManifest.path));
  assert.equal(hash(bytes), row.dependencyManifest.hash, `Package receipt changed: ${row.worldId}`);
  files.set(row.dependencyManifest.path, bytes);
  for (const dependency of JSON.parse(bytes).dependencies) {
    if (dependencies.has(dependency.path)) assert.equal(dependencies.get(dependency.path), dependency.sha256);
    dependencies.set(dependency.path, dependency.sha256);
  }
}
for (const [name, expected] of dependencies) {
  const bytes = fs.readFileSync(path.join(root, name));
  assert.equal(hash(bytes), expected, `RC package dependency changed: ${name}`);
  files.set(name, bytes);
}
const policy = JSON.parse(fs.readFileSync(path.join(root, policyPath)));
assert.equal(policy.releaseCandidate?.sha256, hash(rcBytes), 'Runtime policy targets a different RC');
assert.equal(policy.releaseCandidate?.revision, rc.revision, 'Runtime policy RC revision differs');
assert(policy.sourceManifest?.file && policy.sourceManifest.sha256, 'Runtime policy source receipt missing');
const policySourceBytes = fs.readFileSync(path.join(root, policy.sourceManifest.file));
assert.equal(hash(policySourceBytes), policy.sourceManifest.sha256, 'Runtime source receipt changed');
assert.deepEqual(JSON.parse(policySourceBytes).sources, sources, 'Runtime policy production sources differ from RC');
for (const reference of [policy.taskContract, policy.sourceManifest, ...(policy.dependencies ?? [])]) {
  assert(reference?.file && reference.sha256, 'Runtime input receipt is incomplete');
  const bytes = fs.readFileSync(path.join(root, reference.file));
  assert.equal(hash(bytes), reference.sha256, `Runtime input changed: ${reference.file}`);
  files.set(reference.file, bytes);
}
assert(Array.isArray(policy.tools) && policy.tools.length >= 2, 'Runtime policy must bind its tool receipts');
for (const tool of policy.tools) {
  const bytes = fs.readFileSync(path.join(root, tool.path));
  assert.equal(hash(bytes), tool.sha256, `Frozen runtime tool changed: ${tool.path}`);
  files.set(tool.path, bytes);
}
assert(policy.tools.some(tool => tool.path === 'tools/qa/check-r100-i14-runtime-budget.mjs'), 'New runtime runner must be frozen');
assert(policy.tools.some(tool => tool.path === 'tools/qa/check-r100-runtime-budget.mjs'), 'Parent runtime runner must be frozen');
for (const name of extras) files.set(name, fs.readFileSync(path.join(root, name)));
const template = {operator: '填写实际执行者', deviceModel: '填写实际型号', cpu: '填写实际CPU',
  gpu: '填写实际GPU', memoryGiB: '填写实际内存GiB', os: '填写实际系统版本',
  power: '填写插电/电池及节能状态', backgroundActivity: '填写后台状况',
  displayScale: '填写显示缩放或DPR', exclusiveWindow: false};
files.set('device-template.json', Buffer.from(JSON.stringify(template, null, 2) + '\n'));
files.set('.i14-runtime/package.json', Buffer.from(JSON.stringify({private: true, type: 'module',
  dependencies: {playwright: '1.62.1'}}, null, 2) + '\n'));
files.set('README-I14.md', Buffer.from(`# I14 真实设备复验包\n\n候选：${rc.revision}。此包包含当前冻结游戏与四个既定重档性能诊断，不含用户存档。性能结果不替代实际审听或用户终验，也不能仅凭运行成功认定设备较弱。\n\n在真实设备解压，安装 Node.js 22 或以上和 Google Chrome。在包目录打开终端：\n\n\`\`\`sh\nnpm ci --ignore-scripts --no-audit --no-fund\nnpm install --prefix .i14-runtime --ignore-scripts --no-audit --no-fund\nnode tools/qa/run-r100-i14-device.mjs --preflight\n\`\`\`\n\n将 device-template.json 复制为 device.json，填写实际设备及运行条件。关闭其他高负载任务，把 exclusiveWindow 改为 true，然后：\n\n\`\`\`sh\nnode tools/qa/run-r100-i14-device.mjs --run --device device.json\n\`\`\`\n\nChrome 未自动找到时加 \`--chrome "完整可执行文件路径"\`。四个场景固定种子 20261004、重档、1440×1000 浏览器视口、默认 DPR 1，正常身体、敌人、伤害与时钟，串行各 61.2 秒。它们是开发巡览场景和固定按键路线，不是自然经营出击；不会计入48趟。等待报告生成，把 device-results 下本次完整文件夹返还，包括失败记录，不挑选成功重跑。\n\n若要实际玩、看、听正式入口，可运行：\n\n\`\`\`sh\nnode tools/qa/run-r100-i14-device.mjs --play\n\`\`\`\n\n这会打开隔离的 Chrome 临时窗口和可用本机端口（默认5173，已占用时自动顺延）；窗口内是正式主菜单，用户原有存档不进入该窗口。关闭窗口结束。主游戏新档与开发巡览给装不可混称。记录实际播放设备、音量、时长、地点和问题；不要求听满一个人为规定的分钟数。\n\n返回设备规格用于与参考机 M4 Pro／14逻辑核／48GiB／20核GPU 比较。软件降速不算另一台硬件。运行模式的帧、CPU与材料提交预算沿原合同，源 SHA 和原失败均保留。Windows/Linux 的包运行尚待实机验证；本机打包/预检不冒充跨系统验证。\n`));
fs.mkdirSync(destination, {recursive: true});
const hashes = {};
for (const [name, bytes] of files) {
  const target = path.join(destination, name);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, bytes);
  hashes[name] = hash(bytes);
}
const manifest = {schemaVersion: 1, createdAt: new Date().toISOString(),
  release: {revision: rc.revision, path: rcPath, sha256: hash(rcBytes)},
  productionSourceCount: Object.keys(sources).length, uniquePackageDependencies: dependencies.size, files: hashes,
  scope: 'Portable frozen source plus four fixed severe diagnostics; no device, listening or release pass implied.'};
fs.writeFileSync(path.join(destination, 'I14-DEVICE-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({destination, productionSourceCount: manifest.productionSourceCount,
  files: files.size, bytes: [...files.values()].reduce((n, b) => n + b.length, 0),
  manifestSha256: hash(fs.readFileSync(path.join(destination, 'I14-DEVICE-MANIFEST.json')))}, null, 2));
