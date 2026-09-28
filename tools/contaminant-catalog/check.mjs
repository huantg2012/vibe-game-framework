/** Repeatable content, ownership, ability and source contracts for future expansions. */
import { spawnSync } from 'node:child_process';
const checks = [
  'tools/contaminant-catalog/check-codegen.mjs',
  'tools/contaminant-catalog/check-catalog.ts',
  'tools/contaminant-catalog/check-passive-receipt.ts',
  'tools/inventory/check-source-regions.ts',
  'tools/inventory/check-catalog-abilities.ts',
  'tools/inventory/check-catalog-world-contract.ts',
  'tools/inventory/check-equipment-lifecycle.ts',
  'tools/inventory/check-save-migration.ts',
];
for (const file of checks) {
  const result = spawnSync(process.execPath, file.endsWith('.ts') ? ['--import', 'tsx', file] : [file], {
    stdio: 'inherit', env: { ...process.env, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
