/** Bounded investment/result and safe record replacement contracts. */
import { spawnSync } from 'node:child_process';
for (const file of [
  'tools/qa/check-i31-kindling-yield.ts',
  'tools/contaminant-catalog/check-passive-receipt.ts',
  'tools/recovery/check-save-replacement.ts',
]) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', file], {
    stdio: 'inherit', env: { ...process.env, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
