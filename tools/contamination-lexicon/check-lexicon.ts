/**
 * Machine gate for contamination lexicon draw (DEC-076). No Phaser.
 *
 *   npm run check:lexicon
 */
import {
  REWRITER_FORM,
  INFILTRATOR_FORM,
  devicePrefix,
  displayTokenFor,
  drawOne,
  drawSortie,
  encounterNodes,
  identityKey,
  type ContaminationForm,
} from '../../src/generation/contamination-draw.ts';
import {
  LEXEME_DATA,
  PORTFOLIO_DATA,
  SUBSTRATE_DATA,
  UTTERANCE_DATA,
} from '../../src/generated/contamination-lexicon-data.ts';
import { SeededRandom } from '../../src/utils/random.ts';

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed++;
  console.error(`FAIL ${msg}`);
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
assert(SUBSTRATE_DATA.oil_film?.legalOccupancies.includes('volume'), 'oil film may occupy volume');
assert(PORTFOLIO_DATA.jia.canChase && !PORTFOLIO_DATA.yi.canChase, 'only jia chases');
assert(LEXEME_DATA.contact_melee_three?.rewrites.some((r) => r.portfolio === 'yi'), 'melee rewrites on yi');

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
      assert(sub!.legalOccupancies.includes(form.occupancy), `illegal occupancy ${form.substrate} ${form.occupancy}`);
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

if (failed > 0) {
  console.error(`check:lexicon ${failed} failure(s)`);
  process.exit(1);
}
console.log('check:lexicon ok');
