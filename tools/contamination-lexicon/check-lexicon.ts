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
import { substrateOptions, lexemeOptions } from '../../src/gym/gym-lexicon-form.ts';
import { selfCheckHostLive, resolveContactChannel, resolveStopLoss } from '../../src/systems/contamination-host-live.ts';
import {
  CONCEPTUAL_SUBSTRATE_IDS,
  LEXEME_DATA,
  LEXEME_IDS,
  PORTFOLIO_DATA,
  SORTIE_SUBSTRATE_IDS,
  STOP_LOSS_DATA,
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
assert(
  !LEXEME_IDS.includes('contact_disperse_core'),
  'LEXEME_IDS must not contain contact_disperse_core',
);
const meleeRewrite = LEXEME_DATA.contact_melee_three?.rewrites ?? [];
assert(
  meleeRewrite.some((r) => r.portfolio === 'bing' && r.lexeme === 'contact_step_chaos'),
  'melee rewrite bing → contact_step_chaos',
);
assert(
  meleeRewrite.some((r) => r.portfolio === 'ding' && r.lexeme === 'contact_volume_chaos'),
  'melee rewrite ding → contact_volume_chaos',
);
assert(
  meleeRewrite.every((r) => r.lexeme !== 'contact_disperse_core'),
  'melee rewrite must not point at contact_disperse_core',
);
const stopKeys = Object.keys(STOP_LOSS_DATA);
assert(stopKeys.length === 9, `STOP_LOSS_DATA keys ${stopKeys.length} want 9`);
assert(
  stopKeys.every((id) => !id.includes('shards') && STOP_LOSS_DATA[id]?.continuity !== 'shards'),
  'stop-loss must not include shards',
);
assert(
  !lexemeOptions('contact', 'bing').some((row) => row.id === 'contact_disperse_core'),
  'gym bing contact dropdown has no disperse',
);
assert(
  !lexemeOptions('contact', 'ding').some((row) => row.id === 'contact_disperse_core'),
  'gym ding contact dropdown has no disperse',
);

const csvIds = csvSubstrateIds();
assert(sameSet(csvIds, SUBSTRATE_IDS), `CSV ids vs generated: csv=${csvIds.join(',')} gen=${SUBSTRATE_IDS.join(',')}`);
const sortieFromScope = Object.values(SUBSTRATE_DATA)
  .filter((s) => s.enabledScope === 'sortie')
  .map((s) => s.id);
assert(
  sameSet(SORTIE_SUBSTRATE_IDS, sortieFromScope),
  `SORTIE_SUBSTRATE_IDS ${SORTIE_SUBSTRATE_IDS.join(',')} vs enabledScope=sortie ${sortieFromScope.join(',')}`,
);
assert(
  SORTIE_SUBSTRATE_IDS.every((id) => SUBSTRATE_DATA[id]?.enabledScope === 'sortie'),
  'SORTIE_SUBSTRATE_IDS derived from enabledScope=sortie',
);
assert(
  Object.values(SUBSTRATE_DATA).filter((s) => s.enabledScope === 'sortie').length === SORTIE_SUBSTRATE_IDS.length,
  'no extra sortie rows outside SORTIE_SUBSTRATE_IDS',
);
for (const id of ['stalk_clump', 'railing_post', 'ash_veil', ...CONCEPTUAL_SUBSTRATE_IDS]) {
  assert(SORTIE_SUBSTRATE_IDS.includes(id), `SORTIE_SUBSTRATE_IDS includes ${id}`);
}

/** Pre-I5-J closed set. Flip (street_wreckage→sortie, lamp/railing out) is I5-J only. */
const PRE_FLIP_SORTIE_SUBSTRATE_IDS = [
  'organic_remnant',
  'lamp_pillar',
  'doorframe',
  'wall_rust',
  'fungal_mat',
  'oil_film',
  'stalk_clump',
  'railing_post',
  'ash_veil',
  'sound_echo',
  'light_scatter',
  'space_interval',
] as const;
assert(
  sameSet(SORTIE_SUBSTRATE_IDS, PRE_FLIP_SORTIE_SUBSTRATE_IDS),
  `SORTIE_SUBSTRATE_IDS must stay pre-I5-J [${SORTIE_SUBSTRATE_IDS.join(',')}]`,
);
assert(SORTIE_SUBSTRATE_IDS.includes('lamp_pillar'), 'pre-I5-J SORTIE still includes lamp_pillar');
assert(SORTIE_SUBSTRATE_IDS.includes('railing_post'), 'pre-I5-J SORTIE still includes railing_post');

const I5S_GYM: Readonly<
  Record<string, { token: string; verb: string; lock: string }>
> = {
  street_wreckage: { token: '街具残骸', verb: '立', lock: 'motion_anchor' },
  insect_remnant: { token: '虫', verb: '爬', lock: 'motion_turn' },
  mammal_remnant: { token: '哺乳动物', verb: '走', lock: 'motion_patrol' },
  worm_remnant: { token: '大号蠕虫', verb: '拱', lock: 'motion_turn' },
};
for (const [id, fields] of Object.entries(I5S_GYM)) {
  const row = SUBSTRATE_DATA[id];
  assert(!!row, `missing I5-S gym substrate ${id}`);
  assert(row!.enabledScope === 'gym', `${id} enabled_scope=gym`);
  assert(row!.displayToken === fields.token, `${id} display_token ${row?.displayToken} want ${fields.token}`);
  assert(row!.residualVerb === fields.verb, `${id} residual_verb ${row?.residualVerb} want ${fields.verb}`);
  assert(
    row!.legalOccupancies.length === 1 && row!.legalOccupancies[0] === 'floor',
    `${id} occupancies [${row?.legalOccupancies.join(',')}] want [floor]`,
  );
  assert(!row!.legalOccupancies.includes('volume'), `${id} must not occupy volume`);
  assert(
    row!.legalContinuities.length === 1 && row!.legalContinuities[0] === 'monolith',
    `${id} continuities [${row?.legalContinuities.join(',')}] want [monolith]`,
  );
  assert(!SORTIE_SUBSTRATE_IDS.includes(id), `${id} must not enter SORTIE_SUBSTRATE_IDS`);
}

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
assert(
  CONCEPTUAL_SUBSTRATE_IDS.every((id) => SUBSTRATE_DATA[id]?.enabledScope === 'sortie'),
  'conceptual three enabled_scope=sortie',
);
assert(
  oil!.sortieLegalOccupancies.length === 1 && oil!.sortieLegalOccupancies[0] === 'paint',
  `open: oil_film sortie view paint-only [${oil!.sortieLegalOccupancies.join(',')}]`,
);

for (const id of CONCEPTUAL_SUBSTRATE_IDS) {
  const row = SUBSTRATE_DATA[id];
  assert(!!row, `missing conceptual ${id}`);
  assert(
    row!.legalOccupancies.length === 1 && row!.legalOccupancies[0] === 'volume',
    `${id} gym occupancies [${row?.legalOccupancies.join(',')}] want [volume]`,
  );
  assert(row!.enabledScope === 'sortie', `${id} enabled_scope=sortie`);
  assert(
    row!.legalContinuities.every((c) => c === 'monolith' || c === 'field'),
    `${id} continuities only monolith|field`,
  );
}

const stalk = SUBSTRATE_DATA.stalk_clump;
const rail = SUBSTRATE_DATA.railing_post;
const ash = SUBSTRATE_DATA.ash_veil;
assert(stalk?.enabledScope === 'sortie' && stalk.legalOccupancies.includes('floor') && !stalk.legalOccupancies.includes('volume'), 'stalk_clump floor sortie');
assert(rail?.enabledScope === 'sortie' && rail.legalOccupancies.includes('floor') && !rail.legalOccupancies.includes('volume'), 'railing_post floor sortie');
assert(ash?.enabledScope === 'sortie' && ash.legalOccupancies.includes('paint') && !ash.legalOccupancies.includes('volume'), 'ash_veil paint sortie');

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
for (const id of Object.keys(I5S_GYM)) {
  assert(jiaGym.includes(id), `jia dropdown includes I5-S gym row ${id}`);
  assert(!dingGym.includes(id), `ding dropdown excludes I5-S gym row ${id}`);
}
assert(substrateOptions('bing').some((row) => row.id === 'ash_veil'), 'bing dropdown includes ash_veil');

const seeds = [3, 11, 29, 47, 73, 101, 211, 409, 1024, 7777];
const fragments = ['frag-outdoor', 'frag-clinic', 'frag-metro'] as const;
const drawSrc = readFileSync(resolve(ROOT, 'src/generation/contamination-draw.ts'), 'utf8');
assert(!drawSrc.includes('shadowGymUtteranceForSortie'), 'sortie must not shadow gym utterances with oil_film');
const catalogSrc = readFileSync(resolve(ROOT, 'src/gym/lexicon-gallery-catalog.ts'), 'utf8');
for (const [id, fields] of Object.entries(I5S_GYM)) {
  const lockRe = new RegExp(`${id}:\\s*'${fields.lock}'`);
  assert(lockRe.test(drawSrc), `contamination-draw residual lock ${id} → ${fields.lock}`);
  assert(lockRe.test(catalogSrc), `gallery catalog residual lock ${id} → ${fields.lock}`);
}

for (const [id, fields] of Object.entries(I5S_GYM)) {
  const gymForm = drawOne(new SeededRandom(id.length * 17), {
    portfolio: 'jia',
    fragmentTypeId: 'frag-clinic',
    coverage: 'infiltrate',
    substrate: id,
    scope: 'gym',
  });
  assert(!!gymForm, `gym drawOne ${id} must succeed`);
  assert(gymForm!.substrate === id, `gym drawOne ${id} substrate`);
  const jiaMotions = lexemeOptions('motion', 'jia').map((row) => row.id);
  if (jiaMotions.includes(fields.lock)) {
    assert(
      gymForm!.lexemes.motion === fields.lock,
      `gym infiltrate ${id} motion ${gymForm?.lexemes.motion} want residual lock ${fields.lock}`,
    );
  }
}

let watchingHits = 0;

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
        assert(
          (CONCEPTUAL_SUBSTRATE_IDS as readonly string[]).includes(form.substrate),
          `${fragmentTypeId}/${seed} ding substrate ${form.substrate} want conceptual`,
        );
        assert(form.substrate !== 'oil_film', `${fragmentTypeId}/${seed} ding must not occupy as oil_film`);
      }
      if (form.utteranceId === 'corridor_watching') {
        watchingHits++;
        assert(form.substrate === 'space_interval', `${fragmentTypeId}/${seed} corridor_watching substrate ${form.substrate}`);
        assert(form.occupancy === 'volume', `${fragmentTypeId}/${seed} corridor_watching occupancy ${form.occupancy}`);
      }
      for (const slot of ['motion', 'sense', 'rhythm', 'contact'] as const) {
        const id = form.lexemes[slot];
        const lex = LEXEME_DATA[id];
        assert(!!lex, `missing lexeme ${id}`);
        assert(lex!.slot === slot, `${id} slot ${lex!.slot} != ${slot}`);
        assert(lex!.legalPortfolios.includes(form.portfolio), `${id} illegal on ${form.portfolio}`);
      }
      assert(
        resolveContactChannel(form.portfolio, form.lexemes.contact) !== 'none',
        `${fragmentTypeId}/${seed} ${form.portfolio} contact channel none`,
      );
      const stop = resolveStopLoss(form);
      assert(stop !== 'illegal', `${fragmentTypeId}/${seed} ${form.portfolio} stop-loss illegal`);
      assert(
        !(PORTFOLIO_DATA[form.portfolio].blockWalk && stop !== 'illegal' && stop.family === 'unkillable'),
        `${fragmentTypeId}/${seed} ${form.portfolio} blockWalk unkillable`,
      );
      const key = identityKey(form);
      assert(key.length > 0, 'empty identity key');
      if (form.utteranceId) assert(!key.includes('门'), 'internal utterance name leaked into key as 门');
    }
  }
}

if (watchingHits === 0) {
  for (let seed = 0; seed < 80 && watchingHits === 0; seed++) {
    const rng = new SeededRandom(seed ^ 'frag-outdoor'.length * 17);
    const { forms } = drawSortie(rng, {
      fragmentTypeId: 'frag-outdoor',
      hasClusters: true,
      hasWallEdges: true,
      hasCorridors: true,
    });
    for (const form of forms) {
      if (form.utteranceId !== 'corridor_watching') continue;
      watchingHits++;
      assert(form.substrate === 'space_interval', `probe corridor_watching substrate ${form.substrate}`);
      assert(form.occupancy === 'volume', `probe corridor_watching occupancy ${form.occupancy}`);
    }
  }
}
assert(watchingHits > 0, 'sortie must be allowed to hit corridor_watching');

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
  !riftSrc.includes("from '@/gym/") && !riftSrc.includes("from '../gym/"),
  'RiftScene must not import src/gym',
);
assert(
  /this\.hosts\.create\(\s*this,\s*layout,\s*this\.combat,\s*this\.chaos,\s*this\.visibilityAt\s*,\s*\{\s*liveMotion:\s*true\s*\}\s*\)/.test(
    riftSrc,
  ),
  'RiftScene hosts.create passes { liveMotion: true }',
);
assert(riftSrc.includes("getFormRenderer('d-mixed')"), 'RiftScene attaches production d-mixed');
assert(riftSrc.includes('setVisualSuppressed(true)'), 'scheme D ready hides jia stand-in body');
assert(riftSrc.includes('setSkipPaint(true)'), 'scheme D ready skips host geometric paint');
assert(riftSrc.includes('ready !== true'), 'scheme D attach is gated on renderer.ready');
assert(riftSrc.includes('VOLUME_DEPTH'), 'ding visual depth uses VOLUME_DEPTH');
assert(/visionMask:\s*50/.test(riftSrc), 'vision mask depth is 50');
assert(riftSrc.includes('getVisualPin'), 'host attach passes getVisualPin');
assert(riftSrc.includes('attach.seamX'), 'yi pose uses seamX, not tile centre');
assert(!riftSrc.includes('Math.max(0.2'), 'RiftScene must not floor visibility at 0.2');
assert(!riftSrc.includes('textureNamespace'), 'RiftScene must not pass textureNamespace');
assert(!riftSrc.includes('stainWorldPoint'), 'RiftScene must not pass stainWorldPoint');

const constantsSrc = readFileSync(resolve(ROOT, 'src/config/constants.ts'), 'utf8');
const volumeDepth = /VOLUME_DEPTH:\s*(\d+)/.exec(constantsSrc);
assert(volumeDepth?.[1] === '40', `VOLUME_DEPTH is 40 (got ${volumeDepth?.[1] ?? 'missing'})`);
assert(Number(volumeDepth![1]) < 50, 'ding visual depth < visionMask 50');

const jiaSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/jia.ts'), 'utf8');
const yiSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/yi.ts'), 'utf8');
const bingSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/bing.ts'), 'utf8');
const dingSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/ding.ts'), 'utf8');
assert(!jiaSrc.includes('Math.max(0.2, pose.visibility)'), 'jia must not floor visibility at 0.2');
assert(!yiSrc.includes('Math.max(0.2, pose.visibility)'), 'yi must not floor visibility at 0.2');
assert(jiaSrc.includes('applyFormVisibility'), 'jia consumes visibility via applyFormVisibility');
assert(yiSrc.includes('applyFormVisibility'), 'yi consumes visibility via applyFormVisibility');
assert(jiaSrc.includes('textureNamespace'), 'jia keys honor optional textureNamespace');
assert(bingSrc.includes('textureNamespace'), 'bing keys honor optional textureNamespace');
assert(dingSrc.includes('textureNamespace'), 'ding keys honor optional textureNamespace');
assert(dingSrc.includes('stainWorldPoint'), 'ding stains honor optional stainWorldPoint');
const mapSrc = readFileSync(resolve(ROOT, 'src/gym/gym-map-scene.ts'), 'utf8');
assert(!mapSrc.includes('gymLiveMotion'), 'gym map lesson must not mention gymLiveMotion');
assert(!mapSrc.includes('liveMotion'), 'gym map lesson must not enable liveMotion');
const hostSrc = readFileSync(resolve(ROOT, 'src/systems/contamination-host-system.ts'), 'utf8');
assert(hostSrc.includes('readonly liveMotion?: boolean'), 'host option public name is liveMotion');
assert(
  hostSrc.includes('private tickYiSortie') &&
    hostSrc.includes('private tickBingSortie') &&
    hostSrc.includes('private tickDingSortie'),
  'static ticks remain for liveMotion false',
);
assert(hostSrc.includes('else this.tickYiSortie'), 'liveMotion false still calls tickYiSortie');
assert(hostSrc.includes('else this.tickBingSortie'), 'liveMotion false still calls tickBingSortie');
assert(hostSrc.includes('else this.tickDingSortie'), 'liveMotion false still calls tickDingSortie');

const liveYi = hostSrc.split('private tickYiLive')[1]?.split('private tickBing(')[0] ?? '';
assert(liveYi.includes('resolveContactChannel'), 'tickYiLive reads contact');
assert(liveYi.includes('host.form.lexemes.contact'), 'tickYiLive reads lexemes.contact');
assert(liveYi.includes('stepYiWalk'), 'tickYiLive walks wall edge');
assert(liveYi.includes('resolveStopLoss'), 'tickYiLive reads stop-loss');
assert(liveYi.includes('ADJACENT_STRIKE_DAMAGE'), 'yi strike damage stays the constant');
assert(liveYi.includes('ADJACENT_STRIKE_WINDUP_MS'), 'yi windup stays the constant');

const liveBing = hostSrc.split('private tickBingLive')[1]?.split('private tickDing(')[0] ?? '';
assert(liveBing.includes('resolveContactChannel'), 'tickBingLive reads contact');
assert(liveBing.includes('host.form.lexemes.contact'), 'tickBingLive reads lexemes.contact');
assert(liveBing.includes('resolveStopLoss'), 'tickBingLive reads stop-loss');
assert(liveBing.includes('addChaos'), 'tickBingLive still applies step chaos');
assert(!liveBing.includes('hittable'), 'tickBingLive must not gate step chaos on hittable');

const liveDing = hostSrc.split('private tickDingLive')[1]?.split('private spawnBingNuclei')[0] ?? '';
assert(liveDing.includes('dingLiveRect'), 'tickDingLive morphs current box');
assert(liveDing.includes('resolveContactChannel'), 'tickDingLive reads contact');
assert(liveDing.includes('host.form.lexemes.contact'), 'tickDingLive reads lexemes.contact');
assert(liveDing.includes('resolveStopLoss'), 'tickDingLive reads stop-loss');
assert(liveDing.includes('host.live'), 'tickDingLive chaos/sight follow current box');
assert(liveDing.includes('VOLUME_SIGHT_MULT'), 'tickDingLive uses volume sight price');
assert(liveDing.includes('VOLUME_CHAOS_PER_SEC'), 'tickDingLive uses volume chaos price');
assert(!liveDing.includes('hittable'), 'tickDingLive must not gate volume field on hittable');

const hitCore = hostSrc.split('private hitCore')[1]?.split('private paintYi')[0] ?? '';
assert(hitCore.includes('resolveStopLoss'), 'hitCore reads stop-loss');
assert(hitCore.includes('!stop.hittable'), 'unkillable skips HP');
const liveHit = hitCore.split('if (this.liveMotion)')[1] ?? '';
const unkillableIdx = liveHit.indexOf('!stop.hittable');
const returnIdx = liveHit.indexOf('return');
const dmgIdx = liveHit.indexOf('ENEMY_DAMAGED');
assert(
  unkillableIdx >= 0 && returnIdx > unkillableIdx && returnIdx < dmgIdx,
  'unkillable returns before ENEMY_DAMAGED',
);

assert(hostSrc.includes("resolveStopLoss(form) === 'illegal'"), 'spawn discards illegal stop-loss');
assert(hostSrc.includes('host.form.lexemes.contact'), 'live path reads lexemes.contact');
assert(hostSrc.includes('resolveStopLoss'), 'live path reads resolveStopLoss');

const factorySrc = readFileSync(resolve(ROOT, 'src/entities/enemy-factory.ts'), 'utf8');
assert(
  factorySrc.includes('spawnData.form ??'),
  'sortie Enemy.getForm comes from spawnData.form, not a role ternary',
);
assert(
  !/this\.form = config\.role === 'rewriter' \? REWRITER_FORM : INFILTRATOR_FORM/.test(factorySrc),
  'Enemy.getForm is not a role ternary on the sortie path',
);

const layoutSrc = readFileSync(resolve(ROOT, 'src/generation/rift-layout.ts'), 'utf8');
const placeBody = layoutSrc.split('function placeOnIsland')[1]?.split('function isExtractGateForm')[0] ?? '';
assert(!placeBody.includes('drawSortie'), 'placeOnIsland must not draw lexicon (would consume placement rng)');
assert(
  layoutSrc.includes("mix32(inputSeed, 'lexicon')"),
  'lexicon seed is mix32(layout.seed, lexicon)',
);

const createBody = hostSrc.split('\n  create(')[1]?.split('\n  destroy():')[0] ?? '';
assert(!createBody.includes('drawSortie'), 'ContaminationHostSystem.create must not call drawSortie');
assert(
  createBody.includes('layout.contaminationDraw'),
  'one layout draw: create materializes layout.contaminationDraw',
);
assert(
  !hostSrc.includes("mix32(layout.seed, 'lexicon-hosts')"),
  'hosts.create must not fork a second lexicon seed',
);

const marksBody = hostSrc.split('private paintMarks')[1]?.split('private coreInSwing')[0] ?? '';
assert(marksBody.includes('this.skipPaint'), 'paintMarks hides gym debug cores when skipPaint');

if (failed) {
  console.error(`check:lexicon ${failed} failure(s)`);
  process.exit(1);
}
console.log('check:lexicon ok');
