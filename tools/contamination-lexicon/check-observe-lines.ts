/**
 * I8-N machine gate: observe-line CSV contract (DEC-104 / I8-R2).
 *
 *   npm run check:observe-lines
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INFILTRATOR_FORM,
  REWRITER_FORM,
  displayTokenFor,
  encounterNodes,
  observePoolFor,
  pickObserveLine,
  type ContaminationForm,
} from '../../src/generation/contamination-draw.ts';
import {
  OBSERVE_LINE_DATA,
  OBSERVE_LINE_IDS,
  UTTERANCE_DATA,
} from '../../src/generated/contamination-lexicon-data.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Existing event/debug token identities survive copy edits and pool expansion.
const LEGACY_IDS = [
  'observe_jia_look_1',
  'observe_jia_look_2',
  'observe_jia_hear_1',
  'observe_jia_hear_2',
  'observe_yi_infiltrate_1',
  'observe_yi_infiltrate_2',
  'observe_yi_overwrite_1',
  'observe_yi_overwrite_2',
  'observe_bing_infiltrate_1',
  'observe_bing_infiltrate_2',
  'observe_bing_overwrite_1',
  'observe_bing_overwrite_2',
  'observe_ding_infiltrate_1',
  'observe_ding_infiltrate_2',
  'observe_ding_overwrite_1',
  'observe_ding_overwrite_2',
  'observe_utt_door',
  'observe_utt_eye',
  'observe_utt_lung',
  'observe_utt_corridor',
] as const;

const BANNED = ['识别。', '我们', '你', '危险', '敌人', '注意', '系统', '!', '！', '打不死', '打散重组'] as const;

const UTTERANCE_MARKS: Readonly<Record<string, string>> = {
  door_still_closing: '开合',
  eye_in_the_seam: '缝亮',
  cluster_lung: '在涨',
  corridor_watching: '回头',
};

function fixture(partial: {
  occupancy: ContaminationForm['occupancy'];
  coverage: ContaminationForm['coverage'];
  sense: string;
  utteranceId?: string;
  portfolio: ContaminationForm['portfolio'];
}): ContaminationForm {
  return {
    substrate: 'organic_remnant',
    coverage: partial.coverage,
    continuity: 'monolith',
    occupancy: partial.occupancy,
    portfolio: partial.portfolio,
    lexemes: {
      motion: 'motion_patrol',
      sense: partial.sense,
      rhythm: 'rhythm_open',
      contact: 'contact_melee_three',
    },
    utteranceId: partial.utteranceId,
  };
}

function formFromUtterance(id: string): ContaminationForm {
  const u = UTTERANCE_DATA[id]!;
  return {
    substrate: u.substrate,
    coverage: u.coverage,
    continuity: u.continuity,
    occupancy: u.occupancy,
    portfolio: u.portfolio,
    lexemes: { motion: u.motion, sense: u.sense, rhythm: u.rhythm, contact: u.contact },
    utteranceId: u.id,
  };
}

export function checkObserveLines(assert: (cond: unknown, msg: string) => void): void {
  assert(OBSERVE_LINE_IDS.length >= LEGACY_IDS.length, 'Legacy observe tokens must remain available');
  assert(new Set(OBSERVE_LINE_IDS).size === OBSERVE_LINE_IDS.length, 'Duplicate observe IDs');
  assert(Object.keys(OBSERVE_LINE_DATA).length === OBSERVE_LINE_IDS.length, 'Observe ID/data cardinality mismatch');
  for (const id of LEGACY_IDS) assert(!!OBSERVE_LINE_DATA[id], `missing legacy observe line ${id}`);
  for (const id of OBSERVE_LINE_IDS) {
    const row = OBSERVE_LINE_DATA[id];
    assert(!!row && row.id === id, `missing/mismatched observe row ${id}`);
    assert(!!row?.displayToken.trim() && [...(row?.displayToken ?? '')].length <= 40, `${id} must contain 1–40 characters`);
    for (const banned of BANNED) assert(!row?.displayToken.includes(banned), `${id} contains banned ${banned}`);
  }

  const keys: readonly { label: string; form: ContaminationForm; wantIds: readonly string[] }[] = [
    {
      label: 'jia look cone',
      form: fixture({ occupancy: 'floor', coverage: 'infiltrate', sense: 'sense_cone', portfolio: 'jia' }),
      wantIds: ['observe_jia_look_1', 'observe_jia_look_2'],
    },
    {
      label: 'jia look narrow',
      form: fixture({ occupancy: 'floor', coverage: 'rewrite', sense: 'sense_narrow', portfolio: 'jia' }),
      wantIds: ['observe_jia_look_1', 'observe_jia_look_2'],
    },
    {
      label: 'jia hear',
      form: fixture({ occupancy: 'floor', coverage: 'overwrite', sense: 'sense_hear', portfolio: 'jia' }),
      wantIds: ['observe_jia_hear_1', 'observe_jia_hear_2'],
    },
    {
      label: 'yi infiltrate',
      form: fixture({ occupancy: 'wall', coverage: 'infiltrate', sense: 'sense_touch', portfolio: 'yi' }),
      wantIds: ['observe_yi_infiltrate_1', 'observe_yi_infiltrate_2'],
    },
    {
      label: 'yi rewrite→overwrite',
      form: fixture({ occupancy: 'wall', coverage: 'rewrite', sense: 'sense_touch', portfolio: 'yi' }),
      wantIds: ['observe_yi_overwrite_1', 'observe_yi_overwrite_2'],
    },
    {
      label: 'yi overwrite',
      form: fixture({ occupancy: 'wall', coverage: 'overwrite', sense: 'sense_narrow', portfolio: 'yi' }),
      wantIds: ['observe_yi_overwrite_1', 'observe_yi_overwrite_2'],
    },
    {
      label: 'bing infiltrate',
      form: fixture({ occupancy: 'paint', coverage: 'infiltrate', sense: 'sense_touch', portfolio: 'bing' }),
      wantIds: ['observe_bing_infiltrate_1', 'observe_bing_infiltrate_2'],
    },
    {
      label: 'bing rewrite→overwrite',
      form: fixture({ occupancy: 'paint', coverage: 'rewrite', sense: 'sense_touch', portfolio: 'bing' }),
      wantIds: ['observe_bing_overwrite_1', 'observe_bing_overwrite_2'],
    },
    {
      label: 'ding infiltrate',
      form: fixture({ occupancy: 'volume', coverage: 'infiltrate', sense: 'sense_reverse', portfolio: 'ding' }),
      wantIds: ['observe_ding_infiltrate_1', 'observe_ding_infiltrate_2'],
    },
    {
      label: 'ding overwrite',
      form: fixture({ occupancy: 'volume', coverage: 'overwrite', sense: 'sense_domain', portfolio: 'ding' }),
      wantIds: ['observe_ding_overwrite_1', 'observe_ding_overwrite_2'],
    },
    {
      label: 'utt door',
      form: formFromUtterance('door_still_closing'),
      wantIds: ['observe_utt_door'],
    },
    {
      label: 'utt eye',
      form: formFromUtterance('eye_in_the_seam'),
      wantIds: ['observe_utt_eye'],
    },
    {
      label: 'utt lung',
      form: formFromUtterance('cluster_lung'),
      wantIds: ['observe_utt_lung'],
    },
    {
      label: 'utt corridor',
      form: formFromUtterance('corridor_watching'),
      wantIds: ['observe_utt_corridor'],
    },
  ];

  for (const { label, form, wantIds } of keys) {
    const pool = observePoolFor(form);
    assert(pool.length >= wantIds.length, `${label} lost its legacy pool`);
    assert(
      wantIds.every((id) => pool.some((row) => row.id === id)),
      `${label} pool missing [${wantIds.join(',')}] got [${pool.map((row) => row.id).join(',')}]`,
    );
    const picked = pickObserveLine(form, 1);
    assert(!!picked && pool.some(row => row.id === picked.id), `${label} pick ${picked?.id} not in pool`);
    assert(pool.every(row => form.utteranceId ? row.utteranceId === form.utteranceId
      : !row.utteranceId && row.occupancy === form.occupancy
        && (form.occupancy === 'floor' ? row.sense === (form.lexemes.sense === 'sense_hear' ? 'hear' : 'cone')
          : row.coverageBucket === (form.coverage === 'infiltrate' ? 'infiltrate' : 'overwrite'))), `${label} contains an unrelated prompt`);
    const nodes = encounterNodes(form, 1);
    assert(nodes[0]?.kind === 'observe', `${label} first node not observe`);
    assert(nodes.every((node) => node.kind === 'observe' || node.kind === 'utterance_mark'), `${label} illegal node kind`);
    if (form.utteranceId) {
      assert(nodes.length === 2 && nodes[1]?.kind === 'utterance_mark', `${label} utterance must add mark`);
      assert(nodes[1]?.tokenId === form.utteranceId, `${label} mark token`);
      assert(
        displayTokenFor(nodes[1]!) === UTTERANCE_MARKS[form.utteranceId],
        `${label} mark ${displayTokenFor(nodes[1]!)} want ${UTTERANCE_MARKS[form.utteranceId!]}`,
      );
    } else {
      assert(nodes.length === 1, `${label} nameless must be one observe span`);
    }
    assert(!displayTokenFor(nodes[0]!).includes('识别。'), `${label} observe still has prefix`);
  }

  const reachable = new Set(keys.flatMap(({ form }) => observePoolFor(form).map(row => row.id)));
  for (const id of OBSERVE_LINE_IDS) assert(reachable.has(id), `Unreachable observe line ${id}`);

  const inf = encounterNodes(INFILTRATOR_FORM, 0);
  assert(inf.length === 1 && inf[0]?.kind === 'observe', 'infiltrator is one observe node');
  assert(
    observePoolFor(INFILTRATOR_FORM).some(row => row.id === inf[0]!.tokenId),
    `infiltrator line ${inf[0]?.tokenId}`,
  );
  const hear = encounterNodes(REWRITER_FORM, 0);
  assert(
    observePoolFor(REWRITER_FORM).some(row => row.id === hear[0]!.tokenId),
    `rewriter line ${hear[0]?.tokenId}`,
  );

  const narrationSrc = readFileSync(resolve(ROOT, 'src/ui/dom/encounter-narration.ts'), 'utf8');
  assert(!narrationSrc.includes('devicePrefix'), 'narration must not read devicePrefix');
  assert(!narrationSrc.includes('识别。'), 'narration must not hardcode 识别。');
  assert(!narrationSrc.includes('encounter-prefix'), 'narration must not mount prefix span');
  const panelSrc = readFileSync(resolve(ROOT, 'src/ui/dom/panel-styles.ts'), 'utf8');
  assert(!panelSrc.includes('encounter-prefix'), 'panel-styles must not keep leftover encounter-prefix');
  const drawSrc = readFileSync(resolve(ROOT, 'src/generation/contamination-draw.ts'), 'utf8');
  assert(!drawSrc.includes('识别。'), 'contamination-draw must not fall back to 识别。');
  assert(!drawSrc.includes("kind: 'coverage'"), 'encounter nodes must not emit coverage');
}

const isMain =
  !!process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  let failed = 0;
  const assert = (cond: unknown, msg: string): void => {
    if (cond) return;
    failed++;
    console.error(`FAIL ${msg}`);
  };
  checkObserveLines(assert);
  if (failed) {
    console.error(`check:observe-lines ${failed} failure(s)`);
    process.exit(1);
  }
  console.log('check:observe-lines ok');
}
