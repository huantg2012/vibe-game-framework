/**
 * Machine gate for contamination lexicon draw (DEC-076 / R2-C-data). No Phaser.
 *
 *   npm run check:lexicon
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REWRITER_FORM,
  INFILTRATOR_FORM,
  conceptualSubstratesOnSortie,
  devicePrefix,
  displayTokenFor,
  drawOne,
  drawSortie,
  encounterNodes,
  identityKey,
  occupanciesForScope,
  type ContaminationForm,
} from '../../src/generation/contamination-draw.ts';
import { substrateOptions } from '../../src/gym/gym-lexicon-form.ts';
import { selfCheckHostLive } from '../../src/systems/contamination-host-live.ts';
import {
  CONCEPTUAL_SUBSTRATE_IDS,
  LEXEME_DATA,
  PORTFOLIO_DATA,
  SORTIE_SUBSTRATE_IDS,
  SUBSTRATE_DATA,
  SUBSTRATE_IDS,
  UTTERANCE_DATA,
} from '../../src/generated/contamination-lexicon-data.ts';
import { SeededRandom } from '../../src/utils/random.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed++;
  console.error(`FAIL ${msg}`);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = new Set(a);
  return b.every((id) => left.has(id));
}

function csvSubstrateIds(): string[] {
  let raw = readFileSync(resolve(ROOT, 'data/contamination-substrates.csv'), 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0]!.split(',');
  const idIdx = header.indexOf('id');
  return lines.slice(1).map((line) => line.split(',')[idIdx]!);
}

function hearCount(forms: readonly ContaminationForm[]): number {
  return forms.filter((f) => f.lexemes.sense === 'sense_hear').length;
}

assert(INFILTRATOR_FORM.lexemes.sense === 'sense_cone', 'infiltrator fixture is cone');
assert(REWRITER_FORM.lexemes.sense === 'sense_hear', 'rewriter fixture is hear');
assert(identityKey(INFILTRATOR_FORM) !== identityKey(REWRITER_FORM), 'jia cone/hear identity keys differ');
assert(devicePrefix() === '识别。', 'device prefix from CSV');

const infNodes = encounterNodes(INFILTRATOR_FORM);
assert(infNodes.length === 4, `infiltrator nodes 4 (got ${infNodes.length})`);
assert(
  infNodes.map(displayTokenFor).join(' ') === '渗透 有机残影 占地 视锥',
  `infiltrator tokens: ${infNodes.map(displayTokenFor).join(' ')}`,
);

const door = UTTERANCE_DATA.door_still_closing!;
assert(door.onScreenMark === '开合', 'utterance mark 开合');
assert(PORTFOLIO_DATA.jia.canChase && !PORTFOLIO_DATA.yi.canChase, 'only jia chases');
assert(LEXEME_DATA.contact_melee_three?.rewrites.some((r) => r.portfolio === 'yi'), 'melee rewrites on yi');

const csvIds = csvSubstrateIds();
assert(sameSet(csvIds, SUBSTRATE_IDS), `CSV ids vs generated: csv=${csvIds.join(',')} gen=${SUBSTRATE_IDS.join(',')}`);
assert(
  sameSet(
    SORTIE_SUBSTRATE_IDS,
    ['organic_remnant', 'lamp_pillar', 'doorframe', 'wall_rust', 'fungal_mat', 'oil_film'],
  ),
  `sortie whitelist ${SORTIE_SUBSTRATE_IDS.join(',')}`,
);
assert(
  SORTIE_SUBSTRATE_IDS.every((id) => SUBSTRATE_DATA[id]?.enabledScope === 'sortie'),
  'SORTIE_SUBSTRATE_IDS derived from enabledScope=sortie',
);
assert(
  Object.values(SUBSTRATE_DATA).filter((s) => s.enabledScope === 'sortie').length === SORTIE_SUBSTRATE_IDS.length,
  'no extra sortie rows outside SORTIE_SUBSTRATE_IDS',
);

const oil = SUBSTRATE_DATA.oil_film;
assert(!!oil, 'oil_film row exists');
assert(
  oil!.legalOccupancies.length === 1 && oil!.legalOccupancies[0] === 'paint',
  `CSV/gym oil_film occupancies [${oil?.legalOccupancies.join(',')}] want [paint]`,
);
const conceptualOnSortie = conceptualSubstratesOnSortie();
const oilSortieHasVolume = oil!.sortieLegalOccupancies.includes('volume');
assert(
  conceptualOnSortie === !oilSortieHasVolume,
  `pairing: conceptual scope=sortie (${conceptualOnSortie}) iff oil_film sortie view has no volume (${!oilSortieHasVolume})`,
);
if (!conceptualOnSortie) {
  assert(
    oil!.sortieLegalOccupancies.includes('paint') && oilSortieHasVolume,
    `sortie oil_film still paint|volume [${oil!.sortieLegalOccupancies.join(',')}]`,
  );
}

for (const id of CONCEPTUAL_SUBSTRATE_IDS) {
  const row = SUBSTRATE_DATA[id];
  assert(!!row, `missing conceptual ${id}`);
  assert(
    row!.legalOccupancies.length === 1 && row!.legalOccupancies[0] === 'volume',
    `${id} gym occupancies [${row?.legalOccupancies.join(',')}] want [volume]`,
  );
  assert(row!.enabledScope === 'gym', `${id} enabled_scope=gym`);
  assert(
    row!.legalContinuities.every((c) => c === 'monolith' || c === 'field'),
    `${id} continuities only monolith|field`,
  );
}

const stalk = SUBSTRATE_DATA.stalk_clump;
const rail = SUBSTRATE_DATA.railing_post;
const ash = SUBSTRATE_DATA.ash_veil;
assert(stalk?.enabledScope === 'gym' && stalk.legalOccupancies.includes('floor') && !stalk.legalOccupancies.includes('volume'), 'stalk_clump floor gym');
assert(rail?.enabledScope === 'gym' && rail.legalOccupancies.includes('floor') && !rail.legalOccupancies.includes('volume'), 'railing_post floor gym');
assert(ash?.enabledScope === 'gym' && ash.legalOccupancies.includes('paint') && !ash.legalOccupancies.includes('volume'), 'ash_veil paint gym');

assert(UTTERANCE_DATA.corridor_watching?.substrate === 'space_interval', 'corridor_watching binds space_interval');

const dingGym = substrateOptions('ding').map((row) => row.id);
assert(
  sameSet(dingGym, [...CONCEPTUAL_SUBSTRATE_IDS]),
  `gym ding dropdown [${dingGym.join(',')}] want conceptual three`,
);
assert(!dingGym.includes('oil_film'), 'gym ding dropdown excludes oil_film');
const jiaGym = substrateOptions('jia').map((row) => row.id);
assert(
  !jiaGym.some((id) => (CONCEPTUAL_SUBSTRATE_IDS as readonly string[]).includes(id)),
  'jia dropdown excludes volume-only conceptual substrates',
);
assert(jiaGym.includes('stalk_clump') && jiaGym.includes('railing_post'), 'jia dropdown includes new floor rows');
assert(substrateOptions('bing').some((row) => row.id === 'ash_veil'), 'bing dropdown includes ash_veil');

const seeds = [3, 11, 29, 47, 73, 101, 211, 409, 1024, 7777];
const fragments = ['frag-outdoor', 'frag-clinic', 'frag-metro'] as const;

for (const seed of seeds) {
  for (const fragmentTypeId of fragments) {
    const rng = new SeededRandom(seed ^ fragmentTypeId.length * 17);
    const { forms, warnings } = drawSortie(rng, {
      fragmentTypeId,
      hasClusters: true,
      hasWallEdges: true,
      hasCorridors: true,
    });
    const jia = forms.filter((f) => f.portfolio === 'jia');
    const yi = forms.filter((f) => f.portfolio === 'yi');
    const ding = forms.filter((f) => f.portfolio === 'ding');
    const bing = forms.filter((f) => f.portfolio === 'bing');
    assert(jia.length >= 2 && jia.length <= 3, `${fragmentTypeId}/${seed} jia ${jia.length}`);
    assert(yi.length + ding.length === 1, `${fragmentTypeId}/${seed} yi+ding ${yi.length}+${ding.length}`);
    assert(bing.length <= 1, `${fragmentTypeId}/${seed} bing ${bing.length}`);
    assert(hearCount(forms) === 1, `${fragmentTypeId}/${seed} hear ${hearCount(forms)} warnings=${warnings.join(';')}`);
    const gate = jia[0];
    assert(gate?.lexemes.sense === 'sense_cone', `${fragmentTypeId}/${seed} extract gate not cone`);
    for (const form of forms) {
      const sub = SUBSTRATE_DATA[form.substrate];
      assert(!!sub, `missing substrate ${form.substrate}`);
      assert(sub!.enabledScope === 'sortie', `drawSortie leaked gym substrate ${form.substrate}`);
      assert(
        occupanciesForScope(sub!, 'sortie').includes(form.occupancy),
        `illegal sortie occupancy ${form.substrate} ${form.occupancy}`,
      );
      if (form.portfolio === 'ding') {
        assert(form.occupancy === 'volume', `${fragmentTypeId}/${seed} ding not volume`);
        assert(form.substrate === 'oil_film', `${fragmentTypeId}/${seed} ding substrate ${form.substrate} want oil_film`);
      }
      for (const slot of ['motion', 'sense', 'rhythm', 'contact'] as const) {
        const id = form.lexemes[slot];
        const lex = LEXEME_DATA[id];
        assert(!!lex, `missing lexeme ${id}`);
        assert(lex!.slot === slot, `${id} slot ${lex!.slot} != ${slot}`);
        assert(lex!.legalPortfolios.includes(form.portfolio), `${id} illegal on ${form.portfolio}`);
      }
      const key = identityKey(form);
      assert(key.length > 0, 'empty identity key');
      if (form.utteranceId) assert(!key.includes('门'), 'internal utterance name leaked into key as 门');
      assert(form.utteranceId !== 'corridor_watching', 'sortie must not hit corridor_watching');
    }
  }
}

const emptyPins = drawSortie(new SeededRandom(9), {
  fragmentTypeId: 'frag-clinic',
  hasClusters: false,
  hasWallEdges: false,
  hasCorridors: false,
});
assert(
  emptyPins.forms.every((f) => f.portfolio === 'jia'),
  'no pins → only jia',
);
assert(emptyPins.warnings.some((w) => w.includes('skipped yi/ding')), 'warn when yi/ding skipped');

const noCluster = drawSortie(new SeededRandom(13), {
  fragmentTypeId: 'frag-outdoor',
  hasClusters: false,
  hasWallEdges: true,
  hasCorridors: true,
});
assert(
  noCluster.forms.every((f) => f.portfolio !== 'bing'),
  'no clusters → no bing',
);

const forced = drawOne(new SeededRandom(1), {
  portfolio: 'jia',
  fragmentTypeId: 'frag-clinic',
  coverage: 'infiltrate',
  substrate: 'organic_remnant',
  sense: 'sense_cone',
});
assert(forced?.lexemes.sense === 'sense_cone', 'forced cone draw');
assert(forced?.lexemes.contact === 'contact_melee_three', 'jia keeps melee');

const taken = drawSortie(new SeededRandom(21), {
  fragmentTypeId: 'frag-clinic',
  hasClusters: true,
  hasWallEdges: true,
  hasCorridors: true,
  hearingAxisTaken: true,
});
assert(
  taken.forms.every((f) => f.portfolio !== 'jia'),
  'hearingAxisTaken skips jia',
);
assert(
  taken.forms.every((f) => f.lexemes.sense !== 'sense_hear'),
  'hearingAxisTaken forbids 听噪 on hosts',
);

selfCheckHostLive();

const riftSrc = readFileSync(resolve(ROOT, 'src/scenes/rift-scene.ts'), 'utf8');
assert(!riftSrc.includes('gymLiveMotion'), 'RiftScene must not mention gymLiveMotion');
assert(
  /this\.hosts\.create\(\s*this,\s*layout,\s*this\.combat,\s*this\.chaos,\s*this\.visibilityAt\s*\)/.test(
    riftSrc,
  ),
  'RiftScene hosts.create stays 5-arg (no gymLiveMotion)',
);
const mapSrc = readFileSync(resolve(ROOT, 'src/gym/gym-map-scene.ts'), 'utf8');
assert(
  /this\.hosts\.create\(\s*this,\s*layout,\s*null,\s*null,\s*gymFullVisibility\s*\)/.test(mapSrc),
  'gym map lesson hosts.create stays 5-arg',
);
const hostSrc = readFileSync(resolve(ROOT, 'src/systems/contamination-host-system.ts'), 'utf8');
const sortieYi = hostSrc.split('private tickYiSortie')[1]?.split('private tickYiLive')[0] ?? '';
assert(!sortieYi.includes('resolveContactChannel'), 'tickYiSortie must not read contact');
assert(!sortieYi.includes('stepYiWalk'), 'tickYiSortie must not walk');
const sortieDing = hostSrc.split('private tickDingSortie')[1]?.split('private tickDingLive')[0] ?? '';
assert(!sortieDing.includes('dingLiveRect'), 'tickDingSortie must not morph');
assert(!sortieDing.includes('resolveContactChannel'), 'tickDingSortie must not read contact');
assert(hostSrc.includes('host.form.lexemes.contact'), 'gym path reads lexemes.contact');

if (failed) {
  console.error(`check:lexicon ${failed} failure(s)`);
  process.exit(1);
}
console.log('check:lexicon ok');
