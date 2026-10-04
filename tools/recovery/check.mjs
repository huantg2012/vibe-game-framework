import { spawnSync } from 'node:child_process';
const checks = ['save-replacement', 'async-entry', 'async-destroy', 'actors', 'effects', 'world', 'state', 'catalog-state', 'catalog-authoritative-plan', 'run', 'persistence', 'settlement-random', 'admission', 'journey-recovery', 'lifecycle', 'entry-frame-fence', 'staged-entry', 'native-body-admission', 'native-body-legacy-dash', 'minimap', 'current-tools', 'procedural-identity', 'procedural-admission', 'procedural-rescue', 'paint-geometry-compatibility', 'world-generation-version', 'legacy-generation', 'legacy-arithmetic', 'legacy-arithmetic-recovery', 'native-generation-revision', 'generation-worker'];
for (const name of checks) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--import', './tools/recovery/register-css.mjs', `tools/recovery/check-${name}.ts`], {
    stdio: 'inherit', env: { ...process.env, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
