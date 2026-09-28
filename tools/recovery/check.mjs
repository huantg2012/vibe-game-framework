import { spawnSync } from 'node:child_process';
const checks = ['save-replacement', 'actors', 'effects', 'world', 'state', 'catalog-state', 'catalog-authoritative-plan', 'run', 'persistence', 'settlement-random', 'admission', 'journey-recovery', 'lifecycle', 'minimap', 'current-tools', 'procedural-identity', 'procedural-admission', 'procedural-rescue', 'paint-geometry-compatibility'];
for (const name of checks) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', `tools/recovery/check-${name}.ts`], {
    stdio: 'inherit', env: { ...process.env, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
