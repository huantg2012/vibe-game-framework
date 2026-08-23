/**
 * 一次性探针：启用图书馆 / 居民区之后，残墟生成到底能不能出图。
 * 只在内存里翻 enabled，不改 CSV、不改 src。
 */

import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { generateRuins } from '@/generation/ruins';

const TARGETS = ['frag-library', 'frag-residential'] as const;
const SEEDS = [101, 404, 707, 1234, 5678];

for (const id of TARGETS) {
  const row = RIFT_FRAGMENT_DATA[id] as { enabled: boolean; massGrammar: string; surfaceMaterial: string } | undefined;
  if (!row) continue;
  row.enabled = true;
  let ok = 0;
  let lastErr = '';
  for (const seed of SEEDS) {
    try {
      generateRuins(seed, id);
      ok += 1;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  console.log(
    `${id.padEnd(18)} mass_grammar=${row.massGrammar.padEnd(10)} surface=${row.surfaceMaterial.padEnd(8)} 成功 ${ok}/${SEEDS.length}${ok === SEEDS.length ? '' : `   最后一次失败：${lastErr}`}`,
  );
}
