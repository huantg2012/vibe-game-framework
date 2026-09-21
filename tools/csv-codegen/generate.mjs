/**
 * CSV → TypeScript codegen.
 *
 * Reads data/*.csv and generates src/generated/*.ts with typed constants.
 * No external dependencies — uses built-in fs and simple comma-split parsing
 * (the CSV data uses Chinese punctuation, never ASCII commas inside fields).
 *
 * Usage: node tools/csv-codegen/generate.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateContaminantCatalog } from './contaminant-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DATA_DIR = resolve(ROOT, 'data');
const OUT_DIR = resolve(ROOT, 'src/generated');

// Ensure output directory exists
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a CSV file, strip BOM, return rows as string[][].
 * First row is the header.
 */
function readCsv(filename) {
  let raw = readFileSync(resolve(DATA_DIR, filename), 'utf-8');
  // Strip UTF-8 BOM (EF BB BF appears as ﻿ in the decoded string)
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => line.split(','));
  return { header, rows };
}

/** Convert snake_case to camelCase. */
function toCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Escape a string for use inside a TS template literal or single-quoted string. */
function escapeStr(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

// ---------------------------------------------------------------------------
// Generate contaminant-data.ts
// ---------------------------------------------------------------------------

function generateContaminants() {
  const { header, rows } = readCsv('contaminants.csv');

  // Map header indices
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const entries = rows.map((cols) => ({
    id: cols[idx.id],
    active: cols[idx.active] === 'true',
    toolResistanceBonus: Number(cols[idx.tool_resistance_bonus]),
    toolStopMs: Number(cols[idx.tool_stop_ms]),
    toolPlacementDistancePx: Number(cols[idx.tool_placement_distance_px]),
    toolMovementMult: Number(cols[idx.tool_movement_mult]),
    defenseRepairBonusHp: Number(cols[idx.defense_repair_bonus_hp]),
    defenseTransferCap: Number(cols[idx.defense_transfer_cap]),
    defensePrimaryReduction: Number(cols[idx.defense_primary_reduction]),
    defenseLowHpThreshold: Number(cols[idx.defense_low_hp_threshold]),
    defenseLowHpReduction: Number(cols[idx.defense_low_hp_reduction]),
    rarity: cols[idx.rarity],
    displayNameDefense: cols[idx.display_name_defense],
    descriptionDefense: cols[idx.description_defense],
    summaryDefense: cols[idx.summary_defense] ?? '',
    defenseCategory: cols[idx.defense_category],
    defenseReduction: parseFloat(cols[idx.defense_reduction]),
    defenseSideEffect: cols[idx.defense_side_effect],
    sideEffectDuration: cols[idx.side_effect_duration],
    defenseChargeMult: parseFloat(cols[idx.defense_charge_mult]),
    defenseSecondaryReduction: parseFloat(cols[idx.defense_secondary_reduction]),
    defenseHealRatio: parseFloat(cols[idx.defense_heal_ratio]),
    displayNameTool: cols[idx.display_name_tool],
    descriptionTool: cols[idx.description_tool],
    summaryTool: cols[idx.summary_tool] ?? '',
    toolType: cols[idx.tool_type],
    toolUses: parseInt(cols[idx.tool_uses], 10),
    toolRangePx: parseInt(cols[idx.tool_range_px], 10),
    toolDurationMs: parseInt(cols[idx.tool_duration_ms], 10),
    toolDetectionFillMult: parseFloat(cols[idx.tool_detection_fill_mult]),
    toolThrowDistancePx: parseInt(cols[idx.tool_throw_distance_px], 10),
    toolPulseIntervalMs: parseInt(cols[idx.tool_pulse_interval_ms], 10),
    narrativeOrigin: cols[idx.narrative_origin],
  }));

  for (const entry of entries) {
    for (const key of ['defensePrimaryReduction', 'defenseLowHpThreshold', 'defenseLowHpReduction', 'toolMovementMult', 'defenseReduction', 'defenseSecondaryReduction', 'defenseHealRatio', 'toolDetectionFillMult']) {
      if (!Number.isFinite(entry[key]) || entry[key] < 0 || entry[key] > 1) {
        throw new Error(`[codegen] invalid ${key} for contaminant ${entry.id}`);
      }
    }
    for (const key of ['toolResistanceBonus', 'toolStopMs', 'toolPlacementDistancePx', 'defenseRepairBonusHp', 'defenseTransferCap', 'toolRangePx', 'toolDurationMs', 'toolThrowDistancePx', 'toolPulseIntervalMs']) {
      if (!Number.isSafeInteger(entry[key]) || entry[key] < 0) {
        throw new Error(`[codegen] invalid ${key} for contaminant ${entry.id}`);
      }
    }
    if (!['active', 'passive'].includes(entry.toolType) || !Number.isSafeInteger(entry.toolUses) || entry.toolUses <= 0) {
      throw new Error(`[codegen] invalid tool lifecycle for contaminant ${entry.id}`);
    }
  }

  const lines = [
    '// AUTO-GENERATED by tools/csv-codegen/generate.mjs — DO NOT EDIT',
    "import type { LegacyContaminantType as ContaminantType, ContaminantRarity } from '@/types/game-types';",
    '',
    'export interface ContaminantDef {',
    '  id: ContaminantType;',
    '  active: boolean;',
    '  toolResistanceBonus: number;',
    '  toolStopMs: number;',
    '  toolPlacementDistancePx: number;',
    '  toolMovementMult: number;',
    '  defenseRepairBonusHp: number;',
    '  defenseTransferCap: number;',
    '  defensePrimaryReduction: number;',
    '  defenseLowHpThreshold: number;',
    '  defenseLowHpReduction: number;',

    '  rarity: ContaminantRarity;',
    '  displayNameDefense: string;',
    '  descriptionDefense: string;',
    '  summaryDefense: string;',
    '  defenseCategory: string;',
    '  defenseReduction: number;',
    '  defenseSideEffect: string;',
    '  sideEffectDuration: string;',
    '  defenseChargeMult: number;',
    '  defenseSecondaryReduction: number;',
    '  defenseHealRatio: number;',
    '  displayNameTool: string;',
    '  descriptionTool: string;',
    '  summaryTool: string;',
    "  toolType: 'active' | 'passive';",
    '  toolUses: number;',
    '  toolRangePx: number;',
    '  toolDurationMs: number;',
    '  toolDetectionFillMult: number;',
    '  toolThrowDistancePx: number;',
    '  toolPulseIntervalMs: number;',
    '  narrativeOrigin: string;',
    '}',
    '',
    'export const CONTAMINANT_DATA: Record<ContaminantType, ContaminantDef> = {',
  ];

  for (const e of entries) {
    lines.push(`  '${e.id}': {`);
    lines.push(`    active: ${e.active},`);
    lines.push(`    toolResistanceBonus: ${e.toolResistanceBonus},`);
    lines.push(`    toolStopMs: ${e.toolStopMs},`);
    lines.push(`    toolPlacementDistancePx: ${e.toolPlacementDistancePx},`);
    lines.push(`    toolMovementMult: ${e.toolMovementMult},`);
    lines.push(`    defenseRepairBonusHp: ${e.defenseRepairBonusHp},`);
    lines.push(`    defenseTransferCap: ${e.defenseTransferCap},`);
    lines.push(`    defensePrimaryReduction: ${e.defensePrimaryReduction},`);
    lines.push(`    defenseLowHpThreshold: ${e.defenseLowHpThreshold},`);
    lines.push(`    defenseLowHpReduction: ${e.defenseLowHpReduction},`);
    lines.push(`    id: '${e.id}',`);
    lines.push(`    rarity: '${e.rarity}',`);
    lines.push(`    displayNameDefense: '${escapeStr(e.displayNameDefense)}',`);
    lines.push(`    descriptionDefense: '${escapeStr(e.descriptionDefense)}',`);
    lines.push(`    summaryDefense: '${escapeStr(e.summaryDefense)}',`);
    lines.push(`    defenseCategory: '${escapeStr(e.defenseCategory)}',`);
    lines.push(`    defenseReduction: ${e.defenseReduction},`);
    lines.push(`    defenseSideEffect: '${escapeStr(e.defenseSideEffect)}',`);
    lines.push(`    sideEffectDuration: '${escapeStr(e.sideEffectDuration)}',`);
    lines.push(`    defenseChargeMult: ${e.defenseChargeMult},`);
    lines.push(`    defenseSecondaryReduction: ${e.defenseSecondaryReduction},`);
    lines.push(`    defenseHealRatio: ${e.defenseHealRatio},`);
    lines.push(`    displayNameTool: '${escapeStr(e.displayNameTool)}',`);
    lines.push(`    descriptionTool: '${escapeStr(e.descriptionTool)}',`);
    lines.push(`    summaryTool: '${escapeStr(e.summaryTool)}',`);
    lines.push(`    toolType: '${e.toolType}',`);
    lines.push(`    toolUses: ${e.toolUses},`);
    lines.push(`    toolRangePx: ${e.toolRangePx},`);
    lines.push(`    toolDurationMs: ${e.toolDurationMs},`);
    lines.push(`    toolDetectionFillMult: ${e.toolDetectionFillMult},`);
    lines.push(`    toolThrowDistancePx: ${e.toolThrowDistancePx},`);
    lines.push(`    toolPulseIntervalMs: ${e.toolPulseIntervalMs},`);
    lines.push(`    narrativeOrigin: '${escapeStr(e.narrativeOrigin)}',`);
    lines.push('  },');
  }

  lines.push('};');
  lines.push('export const ACTIVE_CONTAMINANT_TYPES: readonly ContaminantType[] = ' + JSON.stringify(entries.filter(e => e.active).map(e => e.id)) + ';');
  lines.push('export const ACTIVE_CONTAMINANT_DATA = ACTIVE_CONTAMINANT_TYPES.map(id => CONTAMINANT_DATA[id]);');
  lines.push('');

  writeFileSync(resolve(OUT_DIR, 'contaminant-data.ts'), lines.join('\n'), 'utf-8');
  console.log(`  contaminant-data.ts (${entries.length} entries)`);
}

function generateContaminantQualities() {
  const { header, rows } = readCsv('contaminant-qualities.csv');
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const expected = ['ordinary', 'good', 'fine', 'excellent'];
  const types = header.filter(column => column.endsWith('_uses') && column !== 'extra_uses').map(column => column.slice(0, -5));
  const contaminantCsv = readCsv('contaminants.csv');
  const knownTypes = new Set(contaminantCsv.rows.map(row => row[contaminantCsv.header.indexOf('id')]));
  if (rows.length !== expected.length || types.length === 0 || types.some(type => !knownTypes.has(type))) {
    throw new Error('[codegen] invalid contaminant quality table coverage');
  }
  const entries = {};
  let totalWeight = 0;
  for (const [index, row] of rows.entries()) {
    const id = row[idx.id];
    const rank = Number(row[idx.quality_rank]);
    const weight = Number(row[idx.standard_drop_weight]);
    if (id !== expected[index] || rank !== index + 1 || !row[idx.display_name]
      || !Number.isFinite(weight) || weight < 0) throw new Error('[codegen] invalid contaminant quality ' + id);
    const maxUses = {};
    for (const type of types) {
      const uses = Number(row[idx[type + '_uses']]);
      const previous = entries[expected[index - 1]]?.maxUses[type];
      if (!Number.isSafeInteger(uses) || uses <= 0 || (previous !== undefined && uses <= previous)) {
        throw new Error('[codegen] quality uses must increase: ' + type + '/' + id);
      }
      maxUses[type] = uses;
    }
    totalWeight += weight;
    entries[id] = { id, name: row[idx.display_name], rank, standardDropWeight: weight, maxUses };
  }
  if (totalWeight <= 0) throw new Error('[codegen] contaminant quality weights must have positive total');
  writeFileSync(resolve(OUT_DIR, 'contaminant-quality-data.ts'), [
    '// AUTO-GENERATED from data/contaminant-qualities.csv — DO NOT EDIT',
    "import type { ContaminantQuality, ContaminantType } from '@/types/game-types';",
    'export interface ContaminantQualityDefinition {',
    '  readonly id: ContaminantQuality;',
    '  readonly name: string;',
    '  readonly rank: number;',
    '  readonly standardDropWeight: number;',
    '  readonly maxUses: Readonly<Partial<Record<ContaminantType, number>>>;',
    '}',
    'export const CONTAMINANT_QUALITY_ORDER: readonly ContaminantQuality[] = ' + JSON.stringify(expected) + ';',
    'export const CONTAMINANT_QUALITY_DATA: Readonly<Record<ContaminantQuality, ContaminantQualityDefinition>> = ' + JSON.stringify(entries, null, 2) + ';',
    '',
  ].join('\n'));
  console.log(`  contaminant-quality-data.ts (${rows.length} qualities / ${types.length} families)`);
}

// ---------------------------------------------------------------------------
// Generate upgrade-data.ts
// ---------------------------------------------------------------------------

function generateUpgrades() {
  const { header, rows } = readCsv('upgrades.csv');
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const requirements = new Set(['none', 'impactExperienced', 'offeringCompleted', 'toolRevealed', 'crestExperienced']);
  const responsibilities = new Set(['body', 'base', 'equipment']);
  const ids = new Set();
  for (const key of ['id', 'name', 'axis', 'responsibility', 'max_level', 'effect_per_level', 'effect_unit', 'description',
    ...Array.from({ length: 5 }, (_, i) => `cost_${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `unlock_${i + 1}`)]) {
    if (idx[key] === undefined) throw new Error(`[codegen] upgrades.csv missing column ${key}`);
  }

  const entries = rows.map((cols) => {
    const id = cols[idx.id];
    const maxLevel = Number(cols[idx.max_level]);
    const effectPerLevel = Number(cols[idx.effect_per_level]);
    if (cols.length !== header.length || !id || ids.has(id)) throw new Error(`[codegen] invalid or duplicate upgrade ${id}`);
    ids.add(id);
    if (!Number.isInteger(maxLevel) || maxLevel < 1 || maxLevel > 5
      || !Number.isFinite(effectPerLevel) || effectPerLevel <= 0
      || !responsibilities.has(cols[idx.responsibility])
      || ['name', 'axis', 'effect_unit', 'description'].some(key => !cols[idx[key]]?.trim())) {
      throw new Error(`[codegen] invalid upgrade definition ${id}`);
    }
    const costs = [];
    const unlocks = [];
    for (let i = 1; i <= 5; i++) {
      const val = cols[idx[`cost_${i}`]].trim();
      const requirement = cols[idx[`unlock_${i}`]].trim();
      if (i <= maxLevel) {
        const cost = Number(val);
        if (!Number.isSafeInteger(cost) || cost <= 0 || !requirements.has(requirement)) {
          throw new Error(`[codegen] invalid cost or unlock at ${id} level ${i}`);
        }
        costs.push(cost);
        unlocks.push(requirement);
      } else if (val || requirement) {
        throw new Error(`[codegen] upgrade ${id} has data past max_level`);
      }
    }
    return {
      id,
      name: cols[idx.name],
      axis: cols[idx.axis],
      responsibility: cols[idx.responsibility],
      maxLevel,
      effectPerLevel,
      effectUnit: cols[idx.effect_unit],
      costs,
      unlocks,
      description: cols[idx.description]?.trim() ?? '',
    };
  });

  const lines = [
    '// AUTO-GENERATED by tools/csv-codegen/generate.mjs — DO NOT EDIT',
    "import type { GrowthProgressionState, GrowthUpgradeId } from '@/types/game-types';",
    '',
    "export type GrowthResponsibility = 'body' | 'base' | 'equipment';",
    "export type GrowthUnlockRequirement = 'none' | Exclude<keyof GrowthProgressionState, 'version'>;",
    '',
    'export interface UpgradeDef {',
    '  readonly id: GrowthUpgradeId;',
    '  readonly name: string;',
    '  readonly axis: string;',
    '  readonly responsibility: GrowthResponsibility;',
    '  readonly maxLevel: number;',
    '  readonly effectPerLevel: number;',
    '  readonly effectUnit: string;',
    '  readonly costs: readonly number[];',
    '  readonly unlocks: readonly GrowthUnlockRequirement[];',
    '  readonly description: string;',
    '}',
    '',
    'export const UPGRADE_DATA: Record<GrowthUpgradeId, UpgradeDef> = {',
  ];

  for (const e of entries) {
    lines.push(`  '${e.id}': {`);
    lines.push(`    id: '${e.id}',`);
    lines.push(`    name: '${escapeStr(e.name)}',`);
    lines.push(`    axis: '${escapeStr(e.axis)}',`);
    lines.push(`    responsibility: '${e.responsibility}',`);
    lines.push(`    maxLevel: ${e.maxLevel},`);
    lines.push(`    effectPerLevel: ${e.effectPerLevel},`);
    lines.push(`    effectUnit: '${escapeStr(e.effectUnit)}',`);
    lines.push(`    costs: [${e.costs.join(', ')}],`);
    lines.push(`    unlocks: [${e.unlocks.map(requirement => `'${requirement}'`).join(', ')}],`);
    lines.push(`    description: '${escapeStr(e.description)}',`);
    lines.push('  },');
  }

  lines.push('};');
  lines.push('');

  writeFileSync(resolve(OUT_DIR, 'upgrade-data.ts'), lines.join('\n'), 'utf-8');
  console.log(`  upgrade-data.ts (${entries.length} entries)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function num(s) {
  if (s === undefined || s === null || String(s).trim() === '') return 0;
  return parseFloat(s);
}

function flag(s) {
  const v = String(s ?? '').trim().toLowerCase();
  return v === 'true' || v === '1';
}

function generateRiftFragments() {
  const { header, rows } = readCsv('rift-fragments.csv');
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const requiredCols = [
    'id',
    'display_name',
    'coverage',
    'mass_grammar',
    'jog_period',
    'jog_amp',
    'gap_count',
    'gap_placement',
    'turn_count',
    'turn_corner',
    'cap_kind',
    'facing_policy',
    'join',
    'surface_material',
    'enabled',
    'floor_bv',
    'floor_bias_r',
    'floor_bias_g',
    'floor_bias_b',
    'stain_key',
    'stain_threshold',
    'stain_strength',
    'grime_amp',
    'macro_amp',
    'scratch_per_1000px2',
    'fleck_per_1000px2',
    'scratch_angle',
    'scratch_dispersion',
    'wall_bv',
    'wall_bias_r',
    'wall_bias_g',
    'wall_bias_b',
    'feature_width_tiles',
    'feature_length_tiles',
    'feature_count_min',
    'feature_count_max',
  ];
  const forbiddenCols = ['l1_key', 'source_domain', 'wall_body_key', 'wall_rim_key'];
  for (const col of requiredCols) {
    if (!(col in idx)) throw new Error(`rift-fragments.csv missing column: ${col}`);
  }
  for (const col of forbiddenCols) {
    if (col in idx) throw new Error(`rift-fragments.csv still has deleted column: ${col}`);
  }

  const entries = rows.map((cols) => ({
    id: cols[idx.id],
    displayName: cols[idx.display_name],
    coverage: cols[idx.coverage],
    massGrammar: cols[idx.mass_grammar],
    jogPeriod: num(cols[idx.jog_period]),
    jogAmp: num(cols[idx.jog_amp]),
    gapCount: num(cols[idx.gap_count]),
    gapPlacement: cols[idx.gap_placement] ?? '',
    turnCount: num(cols[idx.turn_count]),
    turnCorner: cols[idx.turn_corner] ?? '',
    capKind: cols[idx.cap_kind] ?? '',
    facingPolicy: cols[idx.facing_policy] ?? '',
    join: cols[idx.join],
    surfaceMaterial: cols[idx.surface_material],
    enabled: flag(cols[idx.enabled]),
    floorBv: num(cols[idx.floor_bv]),
    floorBiasR: num(cols[idx.floor_bias_r]),
    floorBiasG: num(cols[idx.floor_bias_g]),
    floorBiasB: num(cols[idx.floor_bias_b]),
    stainKey: cols[idx.stain_key] ?? '',
    stainThreshold: num(cols[idx.stain_threshold]),
    stainStrength: num(cols[idx.stain_strength]),
    grimeAmp: num(cols[idx.grime_amp]),
    macroAmp: num(cols[idx.macro_amp]),
    scratchPer1000px2: num(cols[idx.scratch_per_1000px2]),
    fleckPer1000px2: num(cols[idx.fleck_per_1000px2]),
    scratchAngle: cols[idx.scratch_angle] ?? '',
    scratchDispersion: num(cols[idx.scratch_dispersion]),
    wallBv: num(cols[idx.wall_bv]),
    wallBiasR: num(cols[idx.wall_bias_r]),
    wallBiasG: num(cols[idx.wall_bias_g]),
    wallBiasB: num(cols[idx.wall_bias_b]),
    featureWidthTiles: num(cols[idx.feature_width_tiles]),
    featureLengthTiles: num(cols[idx.feature_length_tiles]),
    featureCountMin: num(cols[idx.feature_count_min]),
    featureCountMax: num(cols[idx.feature_count_max]),
  }));

  const lines = [
    '// AUTO-GENERATED by tools/csv-codegen/generate.mjs — DO NOT EDIT',
    '',
    'export type Coverage = \'remnant\' | \'half\' | \'unnamed\';',
    '',
    'export type MassGrammar =',
    "  | 'enclosure'",
    "  | 'ridge'",
    "  | 'cluster'",
    "  | 'slab'",
    "  | 'lattice'",
    "  | 'growth';",
    '',
    "export type FragmentJoin = 'single' | 'shear';",
    '',
    "export type ScratchAngle = 'free' | 'orthogonal' | 'longitudinal' | '';",
    '',
    'export interface RiftFragmentDef {',
    '  id: string;',
    '  displayName: string;',
    '  coverage: Coverage;',
    '  massGrammar: MassGrammar;',
    '  jogPeriod: number;',
    '  jogAmp: number;',
    '  gapCount: number;',
    '  gapPlacement: string;',
    '  turnCount: number;',
    '  turnCorner: string;',
    '  capKind: string;',
    '  facingPolicy: string;',
    '  join: FragmentJoin;',
    '  surfaceMaterial: string;',
    '  enabled: boolean;',
    '  floorBv: number;',
    '  floorBiasR: number;',
    '  floorBiasG: number;',
    '  floorBiasB: number;',
    '  stainKey: string;',
    '  stainThreshold: number;',
    '  stainStrength: number;',
    '  grimeAmp: number;',
    '  macroAmp: number;',
    '  scratchPer1000px2: number;',
    '  fleckPer1000px2: number;',
    '  scratchAngle: ScratchAngle;',
    '  scratchDispersion: number;',
    '  wallBv: number;',
    '  wallBiasR: number;',
    '  wallBiasG: number;',
    '  wallBiasB: number;',
    '  featureWidthTiles: number;',
    '  featureLengthTiles: number;',
    '  featureCountMin: number;',
    '  featureCountMax: number;',
    '}',
    '',
    'export const RIFT_FRAGMENT_DATA: Record<string, RiftFragmentDef> = {',
  ];

  for (const e of entries) {
    lines.push(`  '${e.id}': {`);
    lines.push(`    id: '${escapeStr(e.id)}',`);
    lines.push(`    displayName: '${escapeStr(e.displayName)}',`);
    lines.push(`    coverage: '${escapeStr(e.coverage)}',`);
    lines.push(`    massGrammar: '${escapeStr(e.massGrammar)}',`);
    lines.push(`    jogPeriod: ${e.jogPeriod},`);
    lines.push(`    jogAmp: ${e.jogAmp},`);
    lines.push(`    gapCount: ${e.gapCount},`);
    lines.push(`    gapPlacement: '${escapeStr(e.gapPlacement)}',`);
    lines.push(`    turnCount: ${e.turnCount},`);
    lines.push(`    turnCorner: '${escapeStr(e.turnCorner)}',`);
    lines.push(`    capKind: '${escapeStr(e.capKind)}',`);
    lines.push(`    facingPolicy: '${escapeStr(e.facingPolicy)}',`);
    lines.push(`    join: '${escapeStr(e.join)}',`);
    lines.push(`    surfaceMaterial: '${escapeStr(e.surfaceMaterial)}',`);
    lines.push(`    enabled: ${e.enabled},`);
    lines.push(`    floorBv: ${e.floorBv},`);
    lines.push(`    floorBiasR: ${e.floorBiasR},`);
    lines.push(`    floorBiasG: ${e.floorBiasG},`);
    lines.push(`    floorBiasB: ${e.floorBiasB},`);
    lines.push(`    stainKey: '${escapeStr(e.stainKey)}',`);
    lines.push(`    stainThreshold: ${e.stainThreshold},`);
    lines.push(`    stainStrength: ${e.stainStrength},`);
    lines.push(`    grimeAmp: ${e.grimeAmp},`);
    lines.push(`    macroAmp: ${e.macroAmp},`);
    lines.push(`    scratchPer1000px2: ${e.scratchPer1000px2},`);
    lines.push(`    fleckPer1000px2: ${e.fleckPer1000px2},`);
    lines.push(`    scratchAngle: '${escapeStr(e.scratchAngle)}',`);
    lines.push(`    scratchDispersion: ${e.scratchDispersion},`);
    lines.push(`    wallBv: ${e.wallBv},`);
    lines.push(`    wallBiasR: ${e.wallBiasR},`);
    lines.push(`    wallBiasG: ${e.wallBiasG},`);
    lines.push(`    wallBiasB: ${e.wallBiasB},`);
    lines.push(`    featureWidthTiles: ${e.featureWidthTiles},`);
    lines.push(`    featureLengthTiles: ${e.featureLengthTiles},`);
    lines.push(`    featureCountMin: ${e.featureCountMin},`);
    lines.push(`    featureCountMax: ${e.featureCountMax},`);
    lines.push('  },');
  }

  lines.push('};');
  lines.push('');
  lines.push(
    'export const ENABLED_RIFT_FRAGMENTS: readonly RiftFragmentDef[] = Object.values(RIFT_FRAGMENT_DATA).filter((row) => row.enabled);',
  );
  lines.push('');

  writeFileSync(resolve(OUT_DIR, 'rift-fragment-data.ts'), lines.join('\n'), 'utf-8');
  console.log(`  rift-fragment-data.ts (${entries.length} entries)`);
}

// ---------------------------------------------------------------------------
// Generate enemy-data.ts
// ---------------------------------------------------------------------------

function generateEnemies() {
  const { header, rows } = readCsv('enemies.csv');
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const requiredCols = [
    'id',
    'display_name',
    'role',
    'sight_range',
    'sight_half_angle_core',
    'sight_range_periph',
    'sight_half_angle_periph',
    'chase_sight_range',
    'hearing_range',
    'hearing_move_mult',
    'hearing_still_range',
    'hearing_wall_factor',
    'vision_weight',
    'hearing_weight',
    'hearing_max_push',
    'patrol_speed',
    'chase_speed',
    'suspicious_speed',
    'alert_speed',
    'return_speed',
  ];
  for (const col of requiredCols) {
    if (idx[col] === undefined) {
      throw new Error(`[codegen] enemies.csv missing column '${col}'`);
    }
  }

  const entries = rows.map((cols) => {
    const id = cols[idx.id];
    const role = cols[idx.role];
    const hearingMaxPush = cols[idx.hearing_max_push];
    if (role !== id) {
      throw new Error(`[codegen] enemies.csv role '${role}' must equal id '${id}'`);
    }
    if (hearingMaxPush !== 'suspicious' && hearingMaxPush !== 'alert') {
      throw new Error(`[codegen] enemies.csv ${id}: hearing_max_push must be suspicious|alert`);
    }
    return {
      id,
      displayName: cols[idx.display_name],
      role,
      sightRange: num(cols[idx.sight_range]),
      sightHalfAngleCore: num(cols[idx.sight_half_angle_core]),
      sightRangePeriph: num(cols[idx.sight_range_periph]),
      sightHalfAnglePeriph: num(cols[idx.sight_half_angle_periph]),
      chaseSightRange: num(cols[idx.chase_sight_range]),
      hearingRange: num(cols[idx.hearing_range]),
      hearingMoveMult: num(cols[idx.hearing_move_mult]),
      hearingStillRange: num(cols[idx.hearing_still_range]),
      hearingWallFactor: num(cols[idx.hearing_wall_factor]),
      visionWeight: num(cols[idx.vision_weight]),
      hearingWeight: num(cols[idx.hearing_weight]),
      hearingMaxPush,
      patrolSpeed: num(cols[idx.patrol_speed]),
      chaseSpeed: num(cols[idx.chase_speed]),
      suspiciousSpeed: num(cols[idx.suspicious_speed]),
      alertSpeed: num(cols[idx.alert_speed]),
      returnSpeed: num(cols[idx.return_speed]),
    };
  });

  const ids = new Set(entries.map((e) => e.id));
  for (const required of ['infiltrator', 'rewriter']) {
    if (!ids.has(required)) {
      throw new Error(`[codegen] enemies.csv missing required row '${required}'`);
    }
  }

  const lines = [
    '// AUTO-GENERATED by tools/csv-codegen/generate.mjs — DO NOT EDIT',
    '',
    "export type EnemyRole = 'infiltrator' | 'rewriter';",
    '',
    "export type HearingMaxPush = 'suspicious' | 'alert';",
    '',
    'export interface PerceptionProfile {',
    '  role: EnemyRole;',
    '  displayName: string;',
    '  sightRange: number;',
    '  sightHalfAngleCore: number;',
    '  sightRangePeriph: number;',
    '  sightHalfAnglePeriph: number;',
    '  chaseSightRange: number;',
    '  hearingRange: number;',
    '  hearingMoveMult: number;',
    '  hearingStillRange: number;',
    '  hearingWallFactor: number;',
    '  visionWeight: number;',
    '  hearingWeight: number;',
    '  hearingMaxPush: HearingMaxPush;',
    '  patrolSpeed: number;',
    '  chaseSpeed: number;',
    '  suspiciousSpeed: number;',
    '  alertSpeed: number;',
    '  returnSpeed: number;',
    '}',
    '',
    'export const ENEMY_DATA: Record<EnemyRole, PerceptionProfile> = {',
  ];

  for (const e of entries) {
    lines.push(`  ${e.id}: {`);
    lines.push(`    role: '${e.role}',`);
    lines.push(`    displayName: '${escapeStr(e.displayName)}',`);
    lines.push(`    sightRange: ${e.sightRange},`);
    lines.push(`    sightHalfAngleCore: ${e.sightHalfAngleCore},`);
    lines.push(`    sightRangePeriph: ${e.sightRangePeriph},`);
    lines.push(`    sightHalfAnglePeriph: ${e.sightHalfAnglePeriph},`);
    lines.push(`    chaseSightRange: ${e.chaseSightRange},`);
    lines.push(`    hearingRange: ${e.hearingRange},`);
    lines.push(`    hearingMoveMult: ${e.hearingMoveMult},`);
    lines.push(`    hearingStillRange: ${e.hearingStillRange},`);
    lines.push(`    hearingWallFactor: ${e.hearingWallFactor},`);
    lines.push(`    visionWeight: ${e.visionWeight},`);
    lines.push(`    hearingWeight: ${e.hearingWeight},`);
    lines.push(`    hearingMaxPush: '${e.hearingMaxPush}',`);
    lines.push(`    patrolSpeed: ${e.patrolSpeed},`);
    lines.push(`    chaseSpeed: ${e.chaseSpeed},`);
    lines.push(`    suspiciousSpeed: ${e.suspiciousSpeed},`);
    lines.push(`    alertSpeed: ${e.alertSpeed},`);
    lines.push(`    returnSpeed: ${e.returnSpeed},`);
    lines.push('  },');
  }

  lines.push('};');
  lines.push('');
  lines.push("export const ENEMY_ROLES: readonly EnemyRole[] = ['infiltrator', 'rewriter'];");
  lines.push('');

  writeFileSync(resolve(OUT_DIR, 'enemy-data.ts'), lines.join('\n'), 'utf-8');
  console.log(`  enemy-data.ts (${entries.length} entries)`);
}

// ---------------------------------------------------------------------------
// Generate contamination-lexicon-data.ts
// ---------------------------------------------------------------------------

function splitBar(s) {
  return (s ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseBool(s, col, id) {
  if (s === 'true') return true;
  if (s === 'false') return false;
  throw new Error(`[codegen] contamination ${id}: ${col} must be true|false (got '${s}')`);
}

function parseRewrites(s) {
  if (!s) return [];
  return s.split(';').filter(Boolean).map((pair) => {
    const [portfolio, lexeme] = pair.split(':');
    if (!portfolio || !lexeme) {
      throw new Error(`[codegen] rewrite_to must be portfolio:lexeme (; separated), got '${s}'`);
    }
    return { portfolio, lexeme };
  });
}

function generateContaminationLexicon() {
  const substratesCsv = readCsv('contamination-substrates.csv');
  const portfoliosCsv = readCsv('contamination-portfolios.csv');
  const lexemesCsv = readCsv('contamination-lexemes.csv');
  const utterancesCsv = readCsv('contamination-utterances.csv');
  const tokensCsv = readCsv('contamination-display-tokens.csv');
  const observeCsv = readCsv('contamination-observe-lines.csv');

  const sIdx = Object.fromEntries(substratesCsv.header.map((h, i) => [h, i]));
  const pIdx = Object.fromEntries(portfoliosCsv.header.map((h, i) => [h, i]));
  const lIdx = Object.fromEntries(lexemesCsv.header.map((h, i) => [h, i]));
  const uIdx = Object.fromEntries(utterancesCsv.header.map((h, i) => [h, i]));
  const tIdx = Object.fromEntries(tokensCsv.header.map((h, i) => [h, i]));
  const oIdx = Object.fromEntries(observeCsv.header.map((h, i) => [h, i]));

  const requiredSub = [
    'id',
    'display_token',
    'residual_verb',
    'legal_occupancies',
    'legal_continuities',
    'enabled_scope',
  ];
  for (const col of requiredSub) {
    if (sIdx[col] === undefined) throw new Error(`[codegen] contamination-substrates.csv missing '${col}'`);
  }

  const OCC_OK = new Set(['floor', 'wall', 'paint', 'volume']);
  const CONT_OK = new Set(['monolith', 'shards', 'colony', 'field']);
  const SCOPE_OK = new Set(['sortie', 'gym']);
  /** Spec conceptual substrates (volume-only). Pairing: any conceptual row scope=sortie ↔ oil_film drops volume. */
  const CONCEPTUAL_SUBSTRATE_IDS = ['sound_echo', 'light_scatter', 'space_interval'];

  const substrates = substratesCsv.rows.map((cols) => {
    if (cols.length !== substratesCsv.header.length) {
      throw new Error(
        `[codegen] contamination-substrates.csv row '${cols[sIdx.id]}' has ${cols.length} fields, expected ${substratesCsv.header.length}`,
      );
    }
    const id = cols[sIdx.id];
    const enabledScope = cols[sIdx.enabled_scope];
    if (!SCOPE_OK.has(enabledScope)) {
      throw new Error(`[codegen] contamination-substrates.csv ${id}: enabled_scope must be sortie|gym (got '${enabledScope}')`);
    }
    const legalOccupancies = splitBar(cols[sIdx.legal_occupancies]);
    const legalContinuities = splitBar(cols[sIdx.legal_continuities]);
    for (const occ of legalOccupancies) {
      if (!OCC_OK.has(occ)) throw new Error(`[codegen] contamination-substrates.csv ${id}: illegal occupancy '${occ}'`);
    }
    for (const cont of legalContinuities) {
      if (!CONT_OK.has(cont)) throw new Error(`[codegen] contamination-substrates.csv ${id}: illegal continuity '${cont}'`);
    }
    return {
      id,
      displayToken: cols[sIdx.display_token],
      residualVerb: cols[sIdx.residual_verb],
      legalOccupancies,
      legalContinuities,
      enabledScope,
    };
  });
  const subIds = new Set(substrates.map((s) => s.id));
  for (const required of [
    'organic_remnant',
    'lamp_pillar',
    'doorframe',
    'wall_rust',
    'fungal_mat',
    'oil_film',
    'street_wreckage',
    'insect_remnant',
    'mammal_remnant',
    'worm_remnant',
    ...CONCEPTUAL_SUBSTRATE_IDS,
  ]) {
    if (!subIds.has(required)) throw new Error(`[codegen] contamination-substrates.csv missing '${required}'`);
  }

  const conceptualOnSortie = CONCEPTUAL_SUBSTRATE_IDS.some((id) => {
    const row = substrates.find((s) => s.id === id);
    return row?.enabledScope === 'sortie';
  });
  for (const s of substrates) {
    s.sortieLegalOccupancies =
      s.id === 'oil_film' && !conceptualOnSortie && !s.legalOccupancies.includes('volume')
        ? [...s.legalOccupancies, 'volume']
        : s.legalOccupancies;
  }
  const sortieSubstrates = substrates.filter((s) => s.enabledScope === 'sortie');

  const portfolios = portfoliosCsv.rows.map((cols) => {
    const id = cols[pIdx.id];
    return {
      id,
      displayToken: cols[pIdx.display_token],
      continuity: cols[pIdx.continuity],
      occupancy: cols[pIdx.occupancy],
      legalContinuities: splitBar(cols[pIdx.legal_continuities]),
      pinLayer: cols[pIdx.pin_layer],
      canChase: parseBool(cols[pIdx.can_chase], 'can_chase', id),
      blockWalk: parseBool(cols[pIdx.block_walk], 'block_walk', id),
      defaultContact: cols[pIdx.default_contact],
      detectionPulse: parseBool(cols[pIdx.detection_pulse], 'detection_pulse', id),
    };
  });
  const portIds = new Set(portfolios.map((p) => p.id));
  for (const required of ['jia', 'yi', 'bing', 'ding']) {
    if (!portIds.has(required)) throw new Error(`[codegen] contamination-portfolios.csv missing '${required}'`);
  }

  const lexemes = lexemesCsv.rows.map((cols) => {
    const slot = cols[lIdx.slot];
    if (!['motion', 'sense', 'rhythm', 'contact'].includes(slot)) {
      throw new Error(`[codegen] lexeme ${cols[lIdx.id]} slot must be motion|sense|rhythm|contact`);
    }
    return {
      id: cols[lIdx.id],
      slot,
      displayToken: cols[lIdx.display_token],
      legalPortfolios: splitBar(cols[lIdx.legal_portfolios]),
      rewrites: parseRewrites(cols[lIdx.rewrite_to] ?? ''),
    };
  });

  const utterances = utterancesCsv.rows.map((cols) => ({
    id: cols[uIdx.id],
    internalLabel: cols[uIdx.internal_label],
    onScreenMark: cols[uIdx.on_screen_mark],
    coverage: cols[uIdx.coverage],
    substrate: cols[uIdx.substrate],
    portfolio: cols[uIdx.portfolio],
    continuity: cols[uIdx.continuity],
    occupancy: cols[uIdx.occupancy],
    motion: cols[uIdx.motion],
    sense: cols[uIdx.sense],
    rhythm: cols[uIdx.rhythm],
    contact: cols[uIdx.contact],
  }));
  const uttIds = new Set(utterances.map((u) => u.id));
  for (const required of ['door_still_closing', 'eye_in_the_seam', 'cluster_lung', 'corridor_watching']) {
    if (!uttIds.has(required)) throw new Error(`[codegen] contamination-utterances.csv missing '${required}'`);
  }

  const displayTokens = tokensCsv.rows.map((cols) => ({
    id: cols[tIdx.id],
    kind: cols[tIdx.kind],
    displayToken: cols[tIdx.display_token],
  }));

  const OBSERVE_REQUIRED_COLS = [
    'id',
    'occupancy',
    'sense',
    'coverage_bucket',
    'utterance_id',
    'display_token',
  ];
  for (const col of OBSERVE_REQUIRED_COLS) {
    if (oIdx[col] === undefined) {
      throw new Error(`[codegen] contamination-observe-lines.csv missing '${col}'`);
    }
  }
  const OBSERVE_SENSE_OK = new Set(['', 'cone', 'hear', 'narrow']);
  const OBSERVE_BUCKET_OK = new Set(['', 'infiltrate', 'overwrite']);
  const OBSERVE_REQUIRED_IDS = [
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
  ];
  if (observeCsv.rows.length !== 20) {
    throw new Error(`[codegen] contamination-observe-lines.csv must have exactly 20 rows (got ${observeCsv.rows.length})`);
  }
  const observeLines = observeCsv.rows.map((cols, rowI) => {
    if (cols.length !== observeCsv.header.length) {
      throw new Error(
        `[codegen] contamination-observe-lines.csv row ${rowI + 2} has ${cols.length} fields, expected ${observeCsv.header.length} (ASCII comma in a field?)`,
      );
    }
    const id = cols[oIdx.id];
    const occupancy = cols[oIdx.occupancy] ?? '';
    const sense = cols[oIdx.sense] ?? '';
    const coverageBucket = cols[oIdx.coverage_bucket] ?? '';
    const utteranceId = cols[oIdx.utterance_id] ?? '';
    const displayToken = cols[oIdx.display_token] ?? '';
    if (occupancy && !OCC_OK.has(occupancy)) {
      throw new Error(`[codegen] contamination-observe-lines.csv ${id}: illegal occupancy '${occupancy}'`);
    }
    if (!OBSERVE_SENSE_OK.has(sense)) {
      throw new Error(`[codegen] contamination-observe-lines.csv ${id}: illegal sense '${sense}'`);
    }
    if (!OBSERVE_BUCKET_OK.has(coverageBucket)) {
      throw new Error(`[codegen] contamination-observe-lines.csv ${id}: illegal coverage_bucket '${coverageBucket}'`);
    }
    if (utteranceId && !uttIds.has(utteranceId)) {
      throw new Error(`[codegen] contamination-observe-lines.csv ${id}: unknown utterance_id '${utteranceId}'`);
    }
    if (!displayToken) {
      throw new Error(`[codegen] contamination-observe-lines.csv ${id}: empty display_token`);
    }
    if (utteranceId) {
      if (occupancy || sense || coverageBucket) {
        throw new Error(`[codegen] contamination-observe-lines.csv ${id}: utterance row must leave occupancy/sense/coverage empty`);
      }
    } else if (occupancy === 'floor') {
      if (sense !== 'cone' && sense !== 'hear') {
        throw new Error(`[codegen] contamination-observe-lines.csv ${id}: floor row sense must be cone|hear`);
      }
      if (coverageBucket) {
        throw new Error(`[codegen] contamination-observe-lines.csv ${id}: floor row coverage_bucket must be empty`);
      }
    } else {
      if (!occupancy) {
        throw new Error(`[codegen] contamination-observe-lines.csv ${id}: nameless row needs occupancy`);
      }
      if (sense) {
        throw new Error(`[codegen] contamination-observe-lines.csv ${id}: non-floor nameless row sense must be empty`);
      }
      if (!coverageBucket) {
        throw new Error(`[codegen] contamination-observe-lines.csv ${id}: non-floor nameless row needs coverage_bucket`);
      }
    }
    return { id, occupancy, sense, coverageBucket, utteranceId, displayToken };
  });
  const observeIds = new Set(observeLines.map((row) => row.id));
  for (const required of OBSERVE_REQUIRED_IDS) {
    if (!observeIds.has(required)) {
      throw new Error(`[codegen] contamination-observe-lines.csv missing '${required}'`);
    }
  }

  if (lexemes.some((l) => l.id === 'contact_disperse_core')) {
    throw new Error('[codegen] contamination-lexemes.csv must not contain contact_disperse_core');
  }
  const melee = lexemes.find((l) => l.id === 'contact_melee_three');
  if (!melee) throw new Error('[codegen] contamination-lexemes.csv missing contact_melee_three');
  const meleeWant = {
    yi: 'contact_adjacent_strike',
    bing: 'contact_step_chaos',
    ding: 'contact_volume_chaos',
  };
  for (const [portfolio, lexeme] of Object.entries(meleeWant)) {
    const hit = melee.rewrites.find((r) => r.portfolio === portfolio);
    if (!hit || hit.lexeme !== lexeme) {
      throw new Error(
        `[codegen] contact_melee_three.rewrite_to must include ${portfolio}:${lexeme}`,
      );
    }
  }
  if (lexemes.some((l) => l.rewrites.some((r) => r.lexeme === 'contact_disperse_core'))) {
    throw new Error('[codegen] rewrite_to must not point at contact_disperse_core');
  }

  const stopCsv = readCsv('contamination-stop-loss.csv');
  const slIdx = Object.fromEntries(stopCsv.header.map((h, i) => [h, i]));
  const stopRequired = ['id', 'continuity', 'coverage', 'family', 'core_policy', 'legal_occupancies'];
  for (const col of stopRequired) {
    if (slIdx[col] === undefined) {
      throw new Error(`[codegen] contamination-stop-loss.csv missing '${col}'`);
    }
  }
  if (stopCsv.rows.length !== 9) {
    throw new Error(`[codegen] contamination-stop-loss.csv must have exactly 9 rows (got ${stopCsv.rows.length})`);
  }
  const FAMILY_OK = new Set(['core_strike', 'scatter_rejoin', 'unkillable']);
  const POLICY_OK = new Set(['exposed', 'standard', 'obscured', 'none']);
  const COVER_OK = new Set(['infiltrate', 'rewrite', 'overwrite']);
  const STOP_CONT_OK = new Set(['monolith', 'colony', 'field']);
  const stopLoss = stopCsv.rows.map((cols, rowI) => {
    if (cols.length !== stopCsv.header.length) {
      throw new Error(
        `[codegen] contamination-stop-loss.csv row ${rowI + 2} has ${cols.length} fields, expected ${stopCsv.header.length} (ASCII comma in a field?)`,
      );
    }
    const id = cols[slIdx.id];
    const continuity = cols[slIdx.continuity];
    const coverage = cols[slIdx.coverage];
    const family = cols[slIdx.family];
    const corePolicy = cols[slIdx.core_policy];
    const legalOccupancies = splitBar(cols[slIdx.legal_occupancies]);
    if (continuity === 'shards' || !STOP_CONT_OK.has(continuity)) {
      throw new Error(`[codegen] contamination-stop-loss.csv ${id}: shards / illegal continuity '${continuity}'`);
    }
    if (!COVER_OK.has(coverage)) {
      throw new Error(`[codegen] contamination-stop-loss.csv ${id}: illegal coverage '${coverage}'`);
    }
    if (id !== `${continuity}_${coverage}`) {
      throw new Error(`[codegen] contamination-stop-loss.csv id '${id}' must be ${continuity}_${coverage}`);
    }
    if (!FAMILY_OK.has(family)) {
      throw new Error(`[codegen] contamination-stop-loss.csv ${id}: illegal family '${family}'`);
    }
    if (!POLICY_OK.has(corePolicy)) {
      throw new Error(`[codegen] contamination-stop-loss.csv ${id}: illegal core_policy '${corePolicy}'`);
    }
    if (family === 'unkillable' && corePolicy !== 'none') {
      throw new Error(`[codegen] contamination-stop-loss.csv ${id}: unkillable core_policy must be none`);
    }
    if (family !== 'unkillable' && corePolicy === 'none') {
      throw new Error(`[codegen] contamination-stop-loss.csv ${id}: ${family} core_policy must not be none`);
    }
    for (const occ of legalOccupancies) {
      if (!OCC_OK.has(occ)) {
        throw new Error(`[codegen] contamination-stop-loss.csv ${id}: illegal occupancy '${occ}'`);
      }
    }
    if (family === 'unkillable') {
      const set = new Set(legalOccupancies);
      if (set.size !== 2 || !set.has('paint') || !set.has('volume')) {
        throw new Error(`[codegen] contamination-stop-loss.csv ${id}: unkillable legal_occupancies must be paint|volume`);
      }
    }
    if (family === 'scatter_rejoin' && legalOccupancies.includes('floor')) {
      throw new Error(`[codegen] contamination-stop-loss.csv ${id}: scatter_rejoin must not include floor`);
    }
    return { id, continuity, coverage, family, corePolicy, legalOccupancies };
  });
  const stopIds = new Set(stopLoss.map((s) => s.id));
  for (const continuity of STOP_CONT_OK) {
    for (const coverage of COVER_OK) {
      const want = `${continuity}_${coverage}`;
      if (!stopIds.has(want)) {
        throw new Error(`[codegen] contamination-stop-loss.csv missing '${want}'`);
      }
    }
  }

  const lines = [
    '// AUTO-GENERATED by tools/csv-codegen/generate.mjs — DO NOT EDIT',
    '',
    "export type CoverageId = 'infiltrate' | 'rewrite' | 'overwrite';",
    "export type OccupancyId = 'floor' | 'wall' | 'paint' | 'volume';",
    "export type ContinuityId = 'monolith' | 'shards' | 'colony' | 'field';",
    "export type PortfolioId = 'jia' | 'yi' | 'bing' | 'ding';",
    "export type LexemeSlot = 'motion' | 'sense' | 'rhythm' | 'contact';",
    "export type PinLayerId = 'waypoints' | 'wall_edge' | 'cluster_core' | 'corridor_aabb';",
    "export type SubstrateEnabledScope = 'sortie' | 'gym';",
    '',
    'export interface SubstrateDef {',
    '  id: string;',
    '  displayToken: string;',
    '  residualVerb: string;',
    '  /** CSV / gym view. */',
    '  legalOccupancies: readonly OccupancyId[];',
    '  /** Sortie view. Pairing: conceptual substrates on sortie ↔ oil_film drops volume. */',
    '  sortieLegalOccupancies: readonly OccupancyId[];',
    '  legalContinuities: readonly ContinuityId[];',
    '  enabledScope: SubstrateEnabledScope;',
    '}',
    '',
    'export interface PortfolioDef {',
    '  id: PortfolioId;',
    '  displayToken: string;',
    '  continuity: ContinuityId;',
    '  occupancy: OccupancyId;',
    '  legalContinuities: readonly ContinuityId[];',
    '  pinLayer: PinLayerId;',
    '  canChase: boolean;',
    '  blockWalk: boolean;',
    '  defaultContact: string;',
    '  detectionPulse: boolean;',
    '}',
    '',
    'export interface LexemeRewrite {',
    '  portfolio: PortfolioId;',
    '  lexeme: string;',
    '}',
    '',
    'export interface LexemeDef {',
    '  id: string;',
    '  slot: LexemeSlot;',
    '  displayToken: string;',
    '  legalPortfolios: readonly PortfolioId[];',
    '  rewrites: readonly LexemeRewrite[];',
    '}',
    '',
    'export interface UtteranceDef {',
    '  id: string;',
    '  internalLabel: string;',
    '  onScreenMark: string;',
    '  coverage: CoverageId;',
    '  substrate: string;',
    '  portfolio: PortfolioId;',
    '  continuity: ContinuityId;',
    '  occupancy: OccupancyId;',
    '  motion: string;',
    '  sense: string;',
    '  rhythm: string;',
    '  contact: string;',
    '}',
    '',
    'export interface DisplayTokenDef {',
    '  id: string;',
    '  kind: string;',
    '  displayToken: string;',
    '}',
    '',
    "export type ObserveSenseId = 'cone' | 'hear' | 'narrow' | '';",
    "export type ObserveCoverageBucket = 'infiltrate' | 'overwrite' | '';",
    '',
    'export interface ObserveLineDef {',
    '  id: string;',
    '  occupancy: OccupancyId | \'\';',
    '  sense: ObserveSenseId;',
    '  coverageBucket: ObserveCoverageBucket;',
    '  utteranceId: string;',
    '  displayToken: string;',
    '}',
    '',
    "export type StopLossFamily = 'core_strike' | 'scatter_rejoin' | 'unkillable';",
    "export type StopLossCorePolicy = 'exposed' | 'standard' | 'obscured' | 'none';",
    '',
    'export interface StopLossDef {',
    '  id: string;',
    '  continuity: ContinuityId;',
    '  coverage: CoverageId;',
    '  family: StopLossFamily;',
    '  corePolicy: StopLossCorePolicy;',
    '  legalOccupancies: readonly OccupancyId[];',
    '}',
    '',
    'export const SUBSTRATE_DATA: Record<string, SubstrateDef> = {',
  ];

  for (const s of substrates) {
    lines.push(`  ${s.id}: {`);
    lines.push(`    id: '${s.id}',`);
    lines.push(`    displayToken: '${escapeStr(s.displayToken)}',`);
    lines.push(`    residualVerb: '${escapeStr(s.residualVerb)}',`);
    lines.push(`    legalOccupancies: [${s.legalOccupancies.map((v) => `'${v}'`).join(', ')}],`);
    lines.push(`    sortieLegalOccupancies: [${s.sortieLegalOccupancies.map((v) => `'${v}'`).join(', ')}],`);
    lines.push(`    legalContinuities: [${s.legalContinuities.map((v) => `'${v}'`).join(', ')}],`);
    lines.push(`    enabledScope: '${s.enabledScope}',`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push('export const PORTFOLIO_DATA: Record<PortfolioId, PortfolioDef> = {');
  for (const p of portfolios) {
    lines.push(`  ${p.id}: {`);
    lines.push(`    id: '${p.id}',`);
    lines.push(`    displayToken: '${escapeStr(p.displayToken)}',`);
    lines.push(`    continuity: '${p.continuity}',`);
    lines.push(`    occupancy: '${p.occupancy}',`);
    lines.push(`    legalContinuities: [${p.legalContinuities.map((v) => `'${v}'`).join(', ')}],`);
    lines.push(`    pinLayer: '${p.pinLayer}',`);
    lines.push(`    canChase: ${p.canChase},`);
    lines.push(`    blockWalk: ${p.blockWalk},`);
    lines.push(`    defaultContact: '${p.defaultContact}',`);
    lines.push(`    detectionPulse: ${p.detectionPulse},`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push('export const LEXEME_DATA: Record<string, LexemeDef> = {');
  for (const l of lexemes) {
    const rewrites = l.rewrites
      .map((r) => `{ portfolio: '${r.portfolio}', lexeme: '${r.lexeme}' }`)
      .join(', ');
    lines.push(`  ${l.id}: {`);
    lines.push(`    id: '${l.id}',`);
    lines.push(`    slot: '${l.slot}',`);
    lines.push(`    displayToken: '${escapeStr(l.displayToken)}',`);
    lines.push(`    legalPortfolios: [${l.legalPortfolios.map((v) => `'${v}'`).join(', ')}],`);
    lines.push(`    rewrites: [${rewrites}],`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push('export const UTTERANCE_DATA: Record<string, UtteranceDef> = {');
  for (const u of utterances) {
    lines.push(`  ${u.id}: {`);
    lines.push(`    id: '${u.id}',`);
    lines.push(`    internalLabel: '${escapeStr(u.internalLabel)}',`);
    lines.push(`    onScreenMark: '${escapeStr(u.onScreenMark)}',`);
    lines.push(`    coverage: '${u.coverage}',`);
    lines.push(`    substrate: '${u.substrate}',`);
    lines.push(`    portfolio: '${u.portfolio}',`);
    lines.push(`    continuity: '${u.continuity}',`);
    lines.push(`    occupancy: '${u.occupancy}',`);
    lines.push(`    motion: '${u.motion}',`);
    lines.push(`    sense: '${u.sense}',`);
    lines.push(`    rhythm: '${u.rhythm}',`);
    lines.push(`    contact: '${u.contact}',`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push('export const DISPLAY_TOKEN_DATA: Record<string, DisplayTokenDef> = {');
  for (const t of displayTokens) {
    lines.push(`  ${t.id}: {`);
    lines.push(`    id: '${t.id}',`);
    lines.push(`    kind: '${t.kind}',`);
    lines.push(`    displayToken: '${escapeStr(t.displayToken)}',`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push('export const OBSERVE_LINE_DATA: Record<string, ObserveLineDef> = {');
  for (const row of observeLines) {
    lines.push(`  ${row.id}: {`);
    lines.push(`    id: '${row.id}',`);
    lines.push(`    occupancy: '${row.occupancy}',`);
    lines.push(`    sense: '${row.sense}',`);
    lines.push(`    coverageBucket: '${row.coverageBucket}',`);
    lines.push(`    utteranceId: '${row.utteranceId}',`);
    lines.push(`    displayToken: '${escapeStr(row.displayToken)}',`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push('export const STOP_LOSS_DATA: Record<string, StopLossDef> = {');
  for (const s of stopLoss) {
    lines.push(`  ${s.id}: {`);
    lines.push(`    id: '${s.id}',`);
    lines.push(`    continuity: '${s.continuity}',`);
    lines.push(`    coverage: '${s.coverage}',`);
    lines.push(`    family: '${s.family}',`);
    lines.push(`    corePolicy: '${s.corePolicy}',`);
    lines.push(`    legalOccupancies: [${s.legalOccupancies.map((v) => `'${v}'`).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push(`export const SUBSTRATE_IDS: readonly string[] = [${substrates.map((s) => `'${s.id}'`).join(', ')}];`);
  lines.push(
    `export const SORTIE_SUBSTRATE_IDS: readonly string[] = [${sortieSubstrates.map((s) => `'${s.id}'`).join(', ')}];`,
  );
  lines.push(
    `export const CONCEPTUAL_SUBSTRATE_IDS: readonly string[] = [${CONCEPTUAL_SUBSTRATE_IDS.map((id) => `'${id}'`).join(', ')}];`,
  );
  lines.push("export const PORTFOLIO_IDS: readonly PortfolioId[] = ['jia', 'yi', 'bing', 'ding'];");
  lines.push(`export const LEXEME_IDS: readonly string[] = [${lexemes.map((l) => `'${l.id}'`).join(', ')}];`);
  lines.push(
    `export const UTTERANCE_IDS: readonly string[] = [${utterances.map((u) => `'${u.id}'`).join(', ')}];`,
  );
  lines.push(`export const STOP_LOSS_IDS: readonly string[] = [${stopLoss.map((s) => `'${s.id}'`).join(', ')}];`);
  lines.push(
    `export const OBSERVE_LINE_IDS: readonly string[] = [${observeLines.map((row) => `'${row.id}'`).join(', ')}];`,
  );
  lines.push('');

  writeFileSync(resolve(OUT_DIR, 'contamination-lexicon-data.ts'), lines.join('\n'), 'utf-8');
  console.log(`  contamination-lexicon-data.ts (${substrates.length} substrates, ${lexemes.length} lexemes, ${stopLoss.length} stop-loss, ${observeLines.length} observe-lines)`);
}

function generateContaminationFamilies() {
  const readRows = (name, columns) => {
    const csv = readCsv(name);
    for (const col of columns) if (!csv.header.includes(col)) throw new Error(`[codegen] ${name}: missing ${col}`);
    return csv.rows.map((row) => {
      if (row.length !== csv.header.length) throw new Error(`[codegen] ${name}: field count mismatch`);
      return Object.fromEntries(csv.header.map((key, i) => [key, row[i]]));
    });
  };
  const substrates = new Map(readRows('contamination-substrates.csv', ['id']).map((row) => [row.id, row]));
  const portfolios = new Map(readRows('contamination-portfolios.csv', ['id']).map((row) => [row.id, row]));
  const lexemes = new Map(readRows('contamination-lexemes.csv', ['id']).map((row) => [row.id, row]));
  const fragments = new Set(readRows('rift-fragments.csv', ['id']).map((row) => row.id));
  const familyKeys = new Set();
  const familyIds = new Set();
  const families = readRows('contamination-families.csv', ['id', 'substrate', 'portfolio', 'motion_ids', 'sense_ids', 'rhythm_ids', 'contact_ids', 'infiltrate_motion']).map((row) => {
    const key = `${row.substrate}|${row.portfolio}`;
    const sub = substrates.get(row.substrate), port = portfolios.get(row.portfolio);
    if (!row.id || familyIds.has(row.id) || familyKeys.has(key) || !sub || !port) throw new Error(`[codegen] invalid/duplicate family ${key}`);
    familyKeys.add(key);
    familyIds.add(row.id);
    if (!splitBar(sub.legal_occupancies).includes(port.occupancy)) throw new Error(`[codegen] ${key}: illegal occupancy`);
    const slots = {};
    for (const slot of ['motion', 'sense', 'rhythm', 'contact']) {
      const ids = splitBar(row[`${slot}_ids`]);
      if (!ids.length || new Set(ids).size !== ids.length) throw new Error(`[codegen] ${key}: empty/duplicate ${slot}`);
      for (const id of ids) {
        const lexeme = lexemes.get(id);
        if (!lexeme || lexeme.slot !== slot || !splitBar(lexeme.legal_portfolios).includes(row.portfolio)) throw new Error(`[codegen] ${key}: illegal ${slot} ${id}`);
      }
      slots[slot] = ids;
    }
    if (!slots.motion.includes(row.infiltrate_motion)) throw new Error(`[codegen] ${key}: unsupported infiltrate motion`);
    return { id: row.id, substrate: row.substrate, portfolio: row.portfolio, ...slots, infiltrateMotion: row.infiltrate_motion };
  });
  const dialects = {};
  for (const row of readRows('contamination-dialects.csv', ['fragment_type_id', 'substrate', 'weight', 'wall_host_weight', 'volume_host_weight'])) {
    if (!fragments.has(row.fragment_type_id) || !substrates.has(row.substrate)) throw new Error('[codegen] unknown dialect fragment/substrate');
    const values = ['weight', 'wall_host_weight', 'volume_host_weight'].map((key) => row[key].trim() ? Number(row[key]) : NaN);
    if (values.some((n) => !Number.isFinite(n) || n < 0)) throw new Error('[codegen] dialect weights must be finite and nonnegative');
    const [weight, wallHostWeight, volumeHostWeight] = values;
    const dialect = dialects[row.fragment_type_id] ??= { substrates: [], wallHostWeight, volumeHostWeight };
    if (dialect.wallHostWeight !== wallHostWeight || dialect.volumeHostWeight !== volumeHostWeight || dialect.substrates.some(([id]) => id === row.substrate)) throw new Error('[codegen] inconsistent or duplicate dialect row');
    dialect.substrates.push([row.substrate, weight]);
  }
  const encounters = {};
  for (const row of readRows('contamination-encounters.csv', ['fragment_type_id', 'hearing_wall_weight', 'hearing_floor_weight'])) {
    const wall = row.hearing_wall_weight.trim() ? Number(row.hearing_wall_weight) : NaN;
    const floor = row.hearing_floor_weight.trim() ? Number(row.hearing_floor_weight) : NaN;
    if (!fragments.has(row.fragment_type_id) || encounters[row.fragment_type_id] || !Number.isFinite(wall) || !Number.isFinite(floor) || wall < 0 || floor <= 0) throw new Error('[codegen] invalid encounter weights (floor fallback requires positive weight)');
    encounters[row.fragment_type_id] = { hearingWallWeight: wall, hearingFloorWeight: floor };
  }
  for (const fragment of Object.keys(dialects)) if (!encounters[fragment]) throw new Error(`[codegen] missing encounter profile ${fragment}`);
  const lines = [
    '// Generated from contamination-families.csv, contamination-dialects.csv and contamination-encounters.csv. Do not edit.',
    "import type { PortfolioId, LexemeSlot } from './contamination-lexicon-data';",
    'export interface FamilyCapability extends Readonly<Record<LexemeSlot, readonly string[]>> { readonly id: string; readonly substrate: string; readonly portfolio: PortfolioId; readonly infiltrateMotion: string; }',
    'export interface ContaminationDialect { readonly substrates: readonly (readonly [string, number])[]; readonly wallHostWeight: number; readonly volumeHostWeight: number; }',
    'export interface ContaminationEncounter { readonly hearingWallWeight: number; readonly hearingFloorWeight: number; }',
    `export const CONTAMINATION_ENCOUNTER_DATA: Readonly<Record<string, ContaminationEncounter>> = ${JSON.stringify(encounters, null, 2)};`,
    `export const FAMILY_CAPABILITY_DATA: readonly FamilyCapability[] = ${JSON.stringify(families, null, 2)};`,
    `export const CONTAMINATION_DIALECT_DATA: Readonly<Record<string, ContaminationDialect>> = ${JSON.stringify(dialects, null, 2)};`,
    '',
  ];
  writeFileSync(resolve(OUT_DIR, 'contamination-family-data.ts'), lines.join('\n'));
  console.log(`  contamination-family-data.ts (${families.length} families, ${Object.keys(dialects).length} dialects)`);
}

function generateContaminationBehaviorProfiles() {
  const csv = readCsv('contamination-behavior-profiles.csv');
  const expected = ['id', 'rest_ms', 'wake_ms', 'active_ms', 'release_ms', 'range_scale', 'cone_deg'];
  if (csv.header.join('|') !== expected.join('|')) throw new Error('[codegen] invalid behavior profile columns');
  const profiles = {};
  for (const row of csv.rows) {
    if (row.length !== expected.length || profiles[row[0]]) throw new Error('[codegen] invalid/duplicate behavior profile');
    const profile = {};
    for (let i = 1; i < expected.length; i++) {
      const value = row[i].trim() ? Number(row[i]) : NaN;
      if (!Number.isFinite(value) || value < 0) throw new Error('[codegen] invalid behavior profile value');
      profile[toCamel(expected[i])] = value;
    }
    profiles[row[0]] = profile;
  }
  writeFileSync(resolve(OUT_DIR, 'contamination-capability-data.ts'), [
    '// Generated from contamination-behavior-profiles.csv. Do not edit.',
    'export interface BehaviorProfile { readonly restMs: number; readonly wakeMs: number; readonly activeMs: number; readonly releaseMs: number; readonly rangeScale: number; readonly coneDeg: number; }',
    `export const BEHAVIOR_PROFILE_DATA: Readonly<Record<string, BehaviorProfile>> = ${JSON.stringify(profiles, null, 2)};`, '',
  ].join('\n'));
}

function generateContaminationBodies() {
  const csv = readCsv('contamination-body-profiles.csv');
  const columns = ['substrate', 'move_scale', 'windup_ms', 'cooldown_ms', 'range_px', 'half_angle_deg'];
  if (csv.header.join('|') !== columns.join('|')) throw new Error('[codegen] invalid body profile columns');
  const substrates = new Set(readCsv('contamination-substrates.csv').rows.map((row) => row[0]));
  const profiles = {};
  for (const row of csv.rows) {
    if (row.length !== columns.length || !substrates.has(row[0]) || profiles[row[0]]) throw new Error('[codegen] invalid/duplicate body substrate');
    const profile = {};
    for (let i = 1; i < columns.length; i++) {
      const value = row[i].trim() ? Number(row[i]) : NaN;
      if (!Number.isFinite(value) || value < 0) throw new Error('[codegen] invalid body profile number');
      profile[toCamel(columns[i])] = value;
    }
    if (profile.windupMs <= 0 || profile.cooldownMs <= 0 || profile.rangePx <= 0 || profile.halfAngleDeg <= 0 || profile.halfAngleDeg > 180) throw new Error('[codegen] body timing/range/angle out of bounds');
    profiles[row[0]] = profile;
  }
  writeFileSync(resolve(OUT_DIR, 'contamination-body-data.ts'), [
    '// Generated from contamination-body-profiles.csv. Do not edit.',
    'export interface ContaminationBodyProfile { readonly moveScale: number; readonly windupMs: number; readonly cooldownMs: number; readonly rangePx: number; readonly halfAngleDeg: number; }',
    `export const BODY_PROFILE_DATA: Readonly<Record<string, ContaminationBodyProfile>> = ${JSON.stringify(profiles, null, 2)};`, '',
  ].join('\n'));
}

function generateVolumeProfiles() {
  const csv = readCsv('contamination-volume-profiles.csv');
  const columns = ['substrate', 'rest_ms', 'gather_ms', 'release_ms', 'disperse_ms', 'radius_scale', 'travel_scale', 'gap_px', 'danger_threshold'];
  if (csv.header.join('|') !== columns.join('|')) throw new Error('[codegen] invalid volume profile columns');
  const substrates = new Set(readCsv('contamination-substrates.csv').rows.map(row => row[0]));
  const profiles = {};
  for (const row of csv.rows) {
    if (row.length !== columns.length || !substrates.has(row[0]) || profiles[row[0]]) throw new Error('[codegen] invalid volume substrate');
    const profile = {};
    for (let i = 1; i < columns.length; i++) {
      const v = row[i].trim() ? Number(row[i]) : NaN;
      if (!Number.isFinite(v) || v < 0) throw new Error('[codegen] invalid volume parameter');
      profile[toCamel(columns[i])] = v;
    }
    if (profile.restMs <= 0 || profile.gatherMs <= 0 || profile.releaseMs <= 0 || profile.disperseMs <= 0 || profile.radiusScale <= 0 || profile.radiusScale > 1 || profile.travelScale > .5 || profile.dangerThreshold <= 0 || profile.dangerThreshold >= 1) throw new Error('[codegen] volume parameter out of range');
    profiles[row[0]] = profile;
  }
  writeFileSync(resolve(OUT_DIR, 'contamination-volume-data.ts'), [
    '// Generated from contamination-volume-profiles.csv. Do not edit.',
    'export interface VolumeProfile { readonly restMs: number; readonly gatherMs: number; readonly releaseMs: number; readonly disperseMs: number; readonly radiusScale: number; readonly travelScale: number; readonly gapPx: number; readonly dangerThreshold: number; }',
    `export const VOLUME_PROFILE_DATA: Readonly<Record<string, VolumeProfile>> = ${JSON.stringify(profiles, null, 2)};`, '',
  ].join('\n'));
}

function generateWeapons() {
  const asRows = (name) => {
    const {header, rows} = readCsv(name);
    return rows.map(row => {
      if (row.length !== header.length) throw new Error('[codegen] invalid columns in ' + name);
      return Object.fromEntries(header.map((key, i) => [key, row[i]]));
    });
  };
  const integer = (value, min, max) => {
    const n = Number(value);
    if (value === '' || !Number.isSafeInteger(n) || n < min || n > max) throw new Error('[codegen] invalid weapon value: ' + value);
    return n;
  };
  const qualities = {};
  for (const row of asRows('weapon-qualities.csv')) {
    if (qualities[row.id]) throw new Error('[codegen] duplicate quality');
    qualities[row.id] = { offeringCharges: integer(row.offering_charges, 1, 999), maxUses: integer(row.max_uses, 1, 9999), name: row.display_name, rank: integer(row.quality_rank, 1, 100), damageMin: integer(row.damage_min, 1, 9999), damageMax: integer(row.damage_max, 1, 9999) };
    if (qualities[row.id].damageMin > qualities[row.id].damageMax) throw new Error('[codegen] inverted damage range');
  }
  const profiles = {};
  const profileColumns = {
    reach_px:'reachPx', arc_deg:'arcDeg', windup_ms:'windupMs', active_ms:'activeMs', recovery_ms:'recoveryMs', min_interval_ms:'minIntervalMs', target_limit:'targetLimit', chaos_per_target:'chaosPerTarget',
    noise_whiff_px:'noiseWhiffPx', noise_hit_px:'noiseHitPx', noise_kill_px:'noiseKillPx', recoil_visual_px:'recoilVisualPx', contact_hold_ms:'contactHoldMs',
  };
  for (const row of asRows('weapon-attack-profiles.csv')) {
    if (profiles[row.weapon_type]) throw new Error('[codegen] duplicate attack profile');
    profiles[row.weapon_type] = Object.fromEntries(Object.entries(profileColumns).map(([column, field]) => [field, integer(row[column], 0, 9999)]));
    const p = profiles[row.weapon_type];
    if (!p.targetLimit || !p.activeMs || p.minIntervalMs < p.windupMs + p.activeMs + p.recoveryMs) throw new Error('[codegen] invalid attack clock');
  }
  const entries = {};
  for (const row of asRows('weapons.csv')) {
    const q = qualities[row.quality_id];
    if (!row.id || entries[row.id] || !q || !profiles[row.weapon_type] || !['standard','light','resistant'].includes(row.variant_id)) throw new Error('[codegen] invalid weapon reference');
    entries[row.id] = { id: row.id, name: row.name, type: row.weapon_type, profileId: row.weapon_type, quality: row.quality_id, qualityName: q.name, qualityRank: q.rank, variant: row.variant_id,
      offeringCharges: q.offeringCharges, maxUses: q.maxUses, weight: integer(row.weight_tenths, 1, 9999), damageMin: q.damageMin, damageMax: q.damageMax, damage: (q.damageMin + q.damageMax) / 2,
      pollutionResistance: integer(row.pollution_resistance, 0, 60), visualKey: row.visual_key };
  }
  if (!entries.crowbar_plain) throw new Error('[codegen] missing starter crowbar');
  const loot = {};
  for (const row of asRows('weapon-loot.csv')) {
    if (!['safe','contested','deep'].includes(row.tier) || loot[row.tier]) throw new Error('[codegen] invalid loot tier');
    const qualityWeights = ['ordinary','good','fine','excellent'].map(key => integer(row[key+'_weight'],0,10000));
    const variantWeights = ['standard','light','resistant'].map(key => integer(row[key+'_weight'],0,10000));
    if (!qualityWeights.some(Boolean) || !variantWeights.some(Boolean)) throw new Error('[codegen] empty loot pool');
    loot[row.tier] = { chancePercent: integer(row.chance_percent,0,100), qualityWeights, variantWeights };
  }
  if (Object.keys(loot).length !== 3) throw new Error('[codegen] missing loot tiers');
  const firstRows = asRows('weapon-first-discovery.csv');
  if (firstRows.length !== 1 || !entries[firstRows[0].definition_id] || !['safe','contested','deep'].includes(firstRows[0].minimum_tier)) throw new Error('[codegen] invalid first weapon rule');
  const firstDiscovery = { minimumTier: firstRows[0].minimum_tier, definitionId: firstRows[0].definition_id };
  writeFileSync(resolve(OUT_DIR, 'weapon-data.ts'), [
    '// Generated from data/weapons.csv, weapon-qualities.csv, weapon-attack-profiles.csv and weapon-loot.csv. Do not edit.',
    'export type WeaponQuality = "ordinary" | "good" | "fine" | "excellent";',
    'export type WeaponVariant = "standard" | "light" | "resistant";',
    '/** Weight is integer tenths. damage is the mean for legacy summaries; combat uses damageMin/Max. */',
    'export interface WeaponDefinition { readonly id: string; readonly name: string; readonly type: string; readonly profileId: string; readonly quality: WeaponQuality; readonly qualityName: string; readonly qualityRank: number; readonly variant: WeaponVariant; readonly weight: number; readonly damageMin: number; readonly damageMax: number; readonly damage: number; readonly pollutionResistance: number; readonly visualKey: string; readonly offeringCharges: number; readonly maxUses: number; }',
    'export interface WeaponAttackProfile { '+Object.values(profileColumns).map(key => 'readonly '+key+': number;').join(' ')+' }',
    'export interface WeaponLootProfile { readonly chancePercent: number; readonly qualityWeights: readonly number[]; readonly variantWeights: readonly number[]; }',
    'export const WEAPON_DATA: Readonly<Record<string, WeaponDefinition>> = '+JSON.stringify(entries,null,2)+';',
    'export const WEAPON_ATTACK_PROFILES: Readonly<Record<string, WeaponAttackProfile>> = '+JSON.stringify(profiles,null,2)+';',
    'export const WEAPON_LOOT_PROFILES: Readonly<Record<"safe"|"contested"|"deep", WeaponLootProfile>> = '+JSON.stringify(loot,null,2)+';',
    'export const WEAPON_FIRST_DISCOVERY = '+JSON.stringify(firstDiscovery)+' as const;', '',
  ].join('\n'));
  const survival = Object.fromEntries(asRows('survival-attributes.csv').map(row => [row.id, Number(row.value)]));
  for (const [id, max] of [['resistance_cap_percent',100],['burden_slow_start_ratio',1],['burden_max_slow_ratio',1]]) {
    if (!Number.isFinite(survival[id]) || survival[id] < 0 || survival[id] >= max) throw new Error('[codegen] invalid survival rule ' + id);
  }
  writeFileSync(resolve(OUT_DIR, 'survival-data.ts'), '// Generated from data/survival-attributes.csv. Do not edit.\nexport const SURVIVAL_RULES = '+JSON.stringify(survival,null,2)+' as const;\n');
}

console.log('[codegen] Generating typed data from CSV...');
generateContaminants();
generateContaminantQualities();
generateUpgrades();
generateRiftFragments();
generateEnemies();
generateContaminationLexicon();
generateContaminationFamilies();
generateContaminationBehaviorProfiles();
generateContaminationBodies();
generateVolumeProfiles();
generateWeapons();
// Migration records retain old capacities even after live definitions change.
{
  const catalog = readCsv('contaminants.csv');
  const catalogRows = catalog.rows.map(row => Object.fromEntries(catalog.header.map((key, i) => [key, row[i]])));
  const knownTypes = new Set(catalogRows.map(row => row.id));
  const activeTypes = new Set(catalogRows.filter(row => row.active === 'true').map(row => row.id));
  const records = readCsv('contaminant-migrations.csv');
  const recordsById = {};
  for (const row of records.rows) {
    const value = Object.fromEntries(records.header.map((key, i) => [key, row[i]]));
    const uses = Number(value.legacy_uses);
    if (!knownTypes.has(value.source) || !activeTypes.has(value.target) || !Number.isSafeInteger(uses) || uses <= 0 || recordsById[value.source]) throw new Error('Invalid contaminant migration');
    recordsById[value.source] = { target: value.target, legacyUses: uses };
  }
  const loot = readCsv('contaminant-loot.csv');
  const profiles = {};
  for (const row of loot.rows) {
    const value = Object.fromEntries(loot.header.map((key, i) => [key, row[i]]));
    const weights = Object.fromEntries(['ordinary','good','fine','excellent'].map(q => [q, Number(value[q+'_weight'])]));
    if (Object.values(weights).some(n => !Number.isFinite(n) || n < 0) || Object.values(weights).reduce((a,b) => a+b,0) <= 0) throw new Error('Invalid contaminant loot weights');
    if (!['safe','contested','deep'].includes(value.tier) || profiles[value.tier]) throw new Error('Invalid or duplicate contaminant loot tier');
    profiles[value.tier] = weights;
  }
  if (Object.keys(profiles).length !== 3) throw new Error('Missing contaminant loot tier');
  writeFileSync(resolve(OUT_DIR, 'contaminant-economy-data.ts'), [
    '// AUTO-GENERATED from contaminant-migrations.csv and contaminant-loot.csv — DO NOT EDIT',
    "import type { LegacyContaminantType as ContaminantType, ContaminantQuality } from '@/types/game-types';",
    "import type { KindlingTier } from '@/types/map-types';",
    'export const CONTAMINANT_MIGRATIONS: Readonly<Partial<Record<ContaminantType, { readonly target: ContaminantType; readonly legacyUses: number }>>> = '+JSON.stringify(recordsById,null,2)+';',
    'export const CONTAMINANT_LOOT_PROFILES: Readonly<Record<KindlingTier, Readonly<Record<ContaminantQuality, number>>>> = '+JSON.stringify(profiles,null,2)+';', ''
  ].join('\n'));
}

// Development encounter source tables use the same one-way pipeline as live content.
{
  const records = filename => {
    const { header, rows } = readCsv(filename);
    return rows.map(row => {
      if (row.length !== header.length) throw new Error(`[codegen] column count in ${filename}: ${row[0]}`);
      return Object.fromEntries(header.map((key, i) => [toCamel(key), row[i]]));
    });
  };
  const scenes = records('build-lab-scenes.csv');
  const placements = records('build-lab-placements.csv');
  const loadouts = records('build-lab-loadouts.csv');
  const knownScenes = new Set(scenes.map(row => row.id));
  const knownItems = new Map(records('contaminants.csv').map(row => [row.id, row]));
  const knownWeapons = new Set(records('weapons.csv').map(row => row.id));
  const knownSubstrates = new Set(records('contamination-substrates.csv').map(row => row.id));
  for (const [label, rows] of [['scene', scenes], ['loadout', loadouts]]) {
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(`[codegen] duplicate build-lab ${label}`);
  }
  for (const row of scenes) {
    row.cols = Number(row.cols); row.rows = Number(row.rows);
    if (![row.cols, row.rows].every(n => Number.isSafeInteger(n) && n >= 8 && n <= 100)) throw new Error('Invalid build-lab dimensions');
  }
  const placementIds = new Set();
  for (const row of placements) {
    const key = row.scene + ':' + row.id;
    if (!knownScenes.has(row.scene) || placementIds.has(key) || !['enemy','volume','kindling','contaminant'].includes(row.kind)) throw new Error('Invalid build-lab placement');
    placementIds.add(key);
    row.col = Number(row.col); row.row = Number(row.row); row.facing = Number(row.facing);
    if (![row.col,row.row,row.facing].every(Number.isFinite)) throw new Error('Invalid build-lab coordinate');
    if (['enemy','volume'].includes(row.kind) && !knownSubstrates.has(row.substrate)) throw new Error('Unknown build-lab substrate');
  }
  for (const row of loadouts) {
    if (!knownWeapons.has(row.weapon)) throw new Error('Unknown build-lab weapon');
    for (const [slot, passive] of [['activeA',false],['activeB',false],['passive',true]]) {
      const item = knownItems.get(row[slot]);
      if (row[slot] && (!item || item.active !== 'true' || (item.toolType === 'passive') !== passive)) throw new Error('Invalid build-lab tool slot');
    }
    for (const pair of row.pair.split('|').filter(Boolean)) if (!loadouts.some(other => other.id === pair)) throw new Error('Invalid build-lab pair');
  }
  writeFileSync(resolve(OUT_DIR, 'build-lab-data.ts'), [
    '// AUTO-GENERATED from data/build-lab-*.csv — DO NOT EDIT',
    'export const BUILD_LAB_SCENES = '+JSON.stringify(scenes,null,2)+' as const;',
    'export const BUILD_LAB_PLACEMENTS = '+JSON.stringify(placements,null,2)+' as const;',
    'export const BUILD_LAB_LOADOUTS = '+JSON.stringify(loadouts,null,2)+' as const;',
    'export type BuildLabSceneId = typeof BUILD_LAB_SCENES[number]["id"];',
    'export type BuildLabLoadoutId = typeof BUILD_LAB_LOADOUTS[number]["id"];',
    '',
  ].join('\n'));
}

// Spatial comparisons author their geometry and environmental cycle in data, too.
{
  const records = filename => {
    const { header, rows } = readCsv(filename);
    return rows.map(row => {
      if (row.length !== header.length) throw new Error(`[codegen] column count in ${filename}: ${row[0]}`);
      return Object.fromEntries(header.map((key, i) => [toCamel(key), row[i]]));
    });
  };
  const scenes = records('spatial-study-scenes.csv');
  const placements = records('spatial-study-placements.csv');
  const water = records('spatial-study-water.csv');
  if (scenes.length !== 1 || water.length !== 1) throw new Error('Spatial study requires one shared fixture and one water cycle');
  const numeric = (rows, keys) => {
    for (const row of rows) for (const key of keys) {
      row[key] = Number(row[key]);
      if (!Number.isFinite(row[key]) || row[key] < 0) throw new Error(`Invalid spatial study ${row.id}.${key}`);
    }
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate spatial study id');
  };
  numeric(scenes, ['cols','rows','seaFrontY','seaBottomHeight','seaTopHeight','reefCol','reefRow','reefHeight']);
  numeric(placements, ['col','row','facing']);
  numeric(water, ['x','y','width','depth','quietMs','warningMs','activeMs','retractMs','damage','hitIntervalMs','contactExtension']);
  const knownSubstrates = new Set(records('contamination-substrates.csv').map(row => row.id));
  const knownLoadouts = new Set(records('build-lab-loadouts.csv').map(row => row.id));
  for (const row of scenes) {
    if (!Number.isSafeInteger(row.cols) || !Number.isSafeInteger(row.rows) || row.cols < 8 || row.rows < 8 || row.cols > 100 || row.rows > 100 || row.seaBottomHeight >= row.seaTopHeight || !knownLoadouts.has(row.loadout)) throw new Error('Invalid spatial study geometry');
  }
  for (const row of placements) {
    if (!Number.isSafeInteger(row.col) || !Number.isSafeInteger(row.row) || !['enemy','kindling','contaminant'].includes(row.kind) || (row.kind === 'enemy' && !knownSubstrates.has(row.substrate))) throw new Error('Invalid spatial study placement');
  }
  for (const row of water) {
    if (['width','depth','quietMs','warningMs','activeMs','retractMs','damage','hitIntervalMs','contactExtension'].some(key => row[key] <= 0) || row.contactExtension > 1 || !['ellipse', 'rectangle'].includes(row.footprint)) throw new Error('Invalid spatial study water cycle');
  }
  writeFileSync(resolve(OUT_DIR, 'spatial-study-data.ts'), [
    '// AUTO-GENERATED from data/spatial-study-*.csv — DO NOT EDIT',
    'export const SPATIAL_STUDY_SCENES = '+JSON.stringify(scenes,null,2)+' as const;',
    'export const SPATIAL_STUDY_PLACEMENTS = '+JSON.stringify(placements,null,2)+' as const;',
    'export const SPATIAL_STUDY_WATER = '+JSON.stringify(water,null,2)+' as const;', '',
  ].join('\n'));

  for (const [prefix, exportPrefix] of [['spatial-slice', 'SPATIAL_SLICE'], ['stage-gameplay', 'STAGE_GAMEPLAY']]) {
    const sliceScenes = records(`${prefix}-scenes.csv`);
    const slicePlacements = records(`${prefix}-placements.csv`);
    const sliceWater = records(`${prefix}-water.csv`);
    const sliceOpenings = records(`${prefix}-openings.csv`);
    const sliceGround = records(`${prefix}-ground.csv`);
    numeric(sliceScenes, ['cols','rows','seaFrontY','seaBottomHeight','seaTopHeight','reefCol','reefRow','reefHeight']);
    numeric(slicePlacements, ['col','row','facing']);
    numeric(sliceWater, ['x','y','width','depth','quietMs','warningMs','activeMs','retractMs','damage','hitIntervalMs','contactExtension','fallTravelMs']);
    numeric(sliceOpenings, ['x','y','radiusX','radiusY','driftX','driftY','phase']);
    numeric(sliceGround, ['x','y','radiusX','radiusY']);
    for (const form of sliceGround) {
      form.angle = Number(form.angle); form.height = Number(form.height);
      if (!['ridge','scour','shelf'].includes(form.kind) || !Number.isFinite(form.angle) || Math.abs(form.angle) > 180
        || !Number.isFinite(form.height) || Math.abs(form.height) > 80 || form.radiusX <= 0 || form.radiusY <= 0) throw new Error(`Invalid spatial slice ground ${form.id}`);
    }
    for (const opening of sliceOpenings) {
      opening.angle = Number(opening.angle);
      if (!Number.isFinite(opening.angle) || Math.abs(opening.angle) > 180) throw new Error(`Invalid spatial slice ${opening.id}.angle`);
    }
    if (sliceScenes.length !== 1 || sliceWater.length !== 1 || sliceOpenings.length < 3) throw new Error('Spatial slices require one common layout, water cycle and distributed openings');
    for (const row of sliceScenes) {
      if (!Number.isSafeInteger(row.cols) || !Number.isSafeInteger(row.rows) || row.cols < 8 || row.rows < 8 || row.cols > 100 || row.rows > 100 || row.seaBottomHeight >= row.seaTopHeight || !knownLoadouts.has(row.loadout)) throw new Error('Invalid spatial slice geometry');
    }
    for (const row of slicePlacements) {
      if (!Number.isSafeInteger(row.col) || !Number.isSafeInteger(row.row) || !['enemy','kindling','contaminant'].includes(row.kind) || (row.kind === 'enemy' && !knownSubstrates.has(row.substrate))) throw new Error('Invalid spatial slice placement');
    }
    for (const row of sliceWater) {
      if (['width','depth','quietMs','warningMs','activeMs','retractMs','damage','hitIntervalMs','contactExtension'].some(key => row[key] <= 0) || row.contactExtension > 1) throw new Error('Invalid spatial slice water cycle');
      if (row.fallTravelMs <= 0 || row.fallTravelMs >= row.warningMs || row.fallTravelMs >= row.activeMs) throw new Error('Water travel must fit its warning and feeding interval');
      const points = row.outline.split('|').map(p => p.split(':').map(Number));
      if (points.length < 5 || points.some(p => p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > row.width / 2 || Math.abs(p[1]) > row.depth / 2)) throw new Error('Invalid spatial slice water outline');
    }
    if (sliceOpenings.some(row => row.radiusX <= 0 || row.radiusY <= 0)) throw new Error('Invalid spatial slice opening');
    writeFileSync(resolve(OUT_DIR, `${prefix}-data.ts`), [
      `// AUTO-GENERATED from data/${prefix}-*.csv — DO NOT EDIT`,
      `export const ${exportPrefix}_SCENES = `+JSON.stringify(sliceScenes,null,2)+' as const;',
      `export const ${exportPrefix}_PLACEMENTS = `+JSON.stringify(slicePlacements,null,2)+' as const;',
      `export const ${exportPrefix}_WATER = `+JSON.stringify(sliceWater,null,2)+' as const;',
      `export const ${exportPrefix}_OPENINGS = `+JSON.stringify(sliceOpenings,null,2)+' as const;', '',
      `export const ${exportPrefix}_GROUND = `+JSON.stringify(sliceGround,null,2)+' as const;', '',
    ].join('\n'));
  }
}

// Explicit native-world data. Old spatial fixtures and global loot defaults do not inherit it.
{
  const records = filename => {
    const { header, rows } = readCsv(filename);
    return rows.map(row => {
      if (row.length !== header.length) throw new Error(`[codegen] column count in ${filename}: ${row[0]}`);
      return Object.fromEntries(header.map((key, i) => [toCamel(key), row[i]]));
    });
  };
  const requireNumber = (row, key, minimum = 0, integer = false) => {
    if (row[key] === '') throw new Error(`[codegen] missing ${row.id ?? row.poolId}.${key}`);
    row[key] = Number(row[key]);
    if (!Number.isFinite(row[key]) || row[key] < minimum || (integer && !Number.isSafeInteger(row[key]))) {
      throw new Error(`[codegen] invalid ${row.id ?? row.poolId}.${key}`);
    }
  };
  const sources = records('contaminant-sources.csv'), sourcePools = {};
  const activeTypes = new Set(records('contaminants.csv').filter(row => row.active === 'true').map(row => row.id));
  const sourceKeys = new Set();
  for (const row of sources) {
    if (!/^[a-z][a-z0-9-]*$/.test(row.poolId) || !activeTypes.has(row.type) || sourceKeys.has(`${row.poolId}:${row.type}`)) throw new Error('[codegen] invalid contaminant source');
    requireNumber(row, 'weight', Number.MIN_VALUE);
    sourceKeys.add(`${row.poolId}:${row.type}`);
    (sourcePools[row.poolId] ??= []).push({ type: row.type, weight: row.weight });
  }
  if (sources.length === 0) throw new Error('[codegen] contaminant sources cannot be empty');
  for (const pool of Object.values(sourcePools)) {
    if (!Number.isFinite(pool.reduce((sum, row) => sum + row.weight, 0))) throw new Error('[codegen] contaminant source weight total must be finite');
  }
  writeFileSync(resolve(OUT_DIR, 'contaminant-sources-data.ts'),
    '// AUTO-GENERATED from data/contaminant-sources.csv — DO NOT EDIT\n'
    + 'export const CONTAMINANT_SOURCE_POOLS = ' + JSON.stringify(sourcePools, null, 2) + ' as const;\n');

  const scenes = records('suspended-sea-scenes.csv'), ground = records('suspended-sea-ground.csv');
  const openings = records('suspended-sea-openings.csv'), water = records('suspended-sea-water.csv');
  const placements = records('suspended-sea-placements.csv');
  const sceneIds = new Set(scenes.map(row => row.id));
  if (sceneIds.size !== scenes.length || scenes.length !== 2) throw new Error('[codegen] suspended sea requires two distinct scenes');
  for (const row of scenes) {
    if (row.worldId !== 'suspended-sea' || !['sea-open-channel', 'sea-folded-ridge'].includes(row.id)) throw new Error('[codegen] unknown suspended sea world/scene');
    for (const key of ['cols','rows','recipeVersion','entryDurationMs']) requireNumber(row,key,1,true);
    for (const key of ['seaFrontY','seaBottomHeight','seaTopHeight']) requireNumber(row,key);
    if (row.cols > 100 || row.rows > 100 || row.cols < 8 || row.rows < 8 || row.seaBottomHeight >= row.seaTopHeight || row.entryDurationMs > 1500) throw new Error('[codegen] invalid suspended sea dimensions or entry');
    const reefKeys = ['reefCol','reefRow','reefHeight'];
    if (reefKeys.some(key => row[key] === '') && !reefKeys.every(key => row[key] === '')) throw new Error('[codegen] partial suspended sea reef');
    for (const key of reefKeys) { if (row[key] === '') row[key] = null; else requireNumber(row,key,0,key !== 'reefHeight'); }
  }
  for (const rows of [ground,openings,water]) {
    const ids = new Set();
    for (const row of rows) {
      const key = `${row.sceneId}:${row.id}`;
      if (!sceneIds.has(row.sceneId) || !row.id || ids.has(key)) throw new Error('[codegen] unknown/duplicate suspended sea row');
      ids.add(key);
      requireNumber(row,'x'); requireNumber(row,'y');
    }
  }
  for (const row of ground) {
    for (const key of ['radiusX','radiusY']) requireNumber(row,key,Number.MIN_VALUE);
    for (const key of ['angle','height']) requireNumber(row,key,-180);
    if (!['ridge','scour','shelf'].includes(row.kind) || Math.abs(row.height)>80 || Math.abs(row.angle)>180) throw new Error('[codegen] invalid suspended sea landform');
  }
  for (const row of openings) {
    for (const key of ['radiusX','radiusY']) requireNumber(row,key,Number.MIN_VALUE);
    for (const key of ['driftX','driftY','phase']) requireNumber(row,key);
    requireNumber(row,'angle',-180);
    if (row.angle>180) throw new Error('[codegen] invalid suspended sea opening');
  }
  const points = (value, minimum) => {
    const parsed = value.split('|').map(point => point.split(':').map(Number));
    if (parsed.length < minimum || parsed.some(point => point.length !== 2 || point.some(n => !Number.isFinite(n)))) throw new Error('[codegen] invalid suspended sea point string');
    return parsed;
  };
  for (const row of water) {
    for (const key of ['width','depth','quietMs','warningMs','activeMs','retractMs','damage','hitIntervalMs','contactExtension','fallTravelMs','divertMs','returnMs']) requireNumber(row,key,Number.MIN_VALUE);
    for (const key of ['shellX','shellY','shellHitX','shellHitY']) requireNumber(row,key);
    if (row.id !== 'folding-shell' || row.contactExtension>1 || row.fallTravelMs>=row.warningMs || row.fallTravelMs>=row.activeMs) throw new Error('[codegen] invalid suspended sea water timing');
    const outline = points(row.outline,5);
    points(row.spillOutline,5); points(row.drainPath,2);
    if (outline.some(([x,y]) => Math.abs(x)>row.width/2 || Math.abs(y)>row.depth/2)) throw new Error('[codegen] suspended sea core outside declared bounds');
  }
  const placementKeys = new Set();
  for (const row of placements) {
    if (!sceneIds.has(row.sceneId) || !row.id || !['enemy','kindling','contaminant'].includes(row.kind)) throw new Error('[codegen] invalid suspended sea placement');
    for (const key of ['col','row']) requireNumber(row,key,0,true);
    requireNumber(row,'facing');
    if (row.variantGroup === '') {
      if (row.variant !== '') throw new Error('[codegen] variant without group');
      row.variant = null;
    } else requireNumber(row,'variant',0,true);
    const key = `${row.sceneId}:${row.id}:${row.variantGroup}:${row.variant}`;
    if (placementKeys.has(key)) throw new Error('[codegen] duplicate suspended sea placement');
    placementKeys.add(key);
    if (row.kind === 'enemy') {
      if (row.substrate !== 'insect_remnant' || row.coverage !== 'infiltrate' || !['sense_hear','sense_cone'].includes(row.sense)
        || row.motion !== 'motion_patrol' || row.rhythm !== 'rhythm_open' || row.contact !== 'contact_melee_three'
        || row.tier || row.lootPoolId || row.allowWeapon) throw new Error('[codegen] unsupported suspended sea enemy');
      points(row.patrol,1);
    } else {
      if (!['safe','contested','deep'].includes(row.tier) || ['substrate','coverage','motion','sense','rhythm','contact','patrol'].some(key => row[key])) throw new Error('[codegen] invalid suspended sea loot');
      if (row.kind === 'contaminant') {
        if (!sourcePools[row.lootPoolId] || row.allowWeapon) throw new Error('[codegen] missing/unknown suspended sea source');
      } else if (!['true','false'].includes(row.allowWeapon) || row.lootPoolId) throw new Error('[codegen] missing suspended sea weapon permission');
    }
    row.allowWeapon = row.allowWeapon === '' ? null : row.allowWeapon === 'true';
  }
  for (const sceneId of sceneIds) {
    if (water.filter(row=>row.sceneId===sceneId).length !== 1 || ground.filter(row=>row.sceneId===sceneId).length < 3 || openings.filter(row=>row.sceneId===sceneId).length < 3) throw new Error('[codegen] incomplete suspended sea scene');
    const rows = placements.filter(row=>row.sceneId===sceneId);
    const groups = new Set(rows.map(row=>row.variantGroup).filter(Boolean));
    if (groups.size === 0) throw new Error('[codegen] suspended sea requires actual content variants');
    const logicalOwners = new Map();
    for (const row of rows) {
      const owner = logicalOwners.get(row.id);
      if (owner !== undefined && owner !== row.variantGroup) throw new Error('[codegen] placement id reused across groups');
      logicalOwners.set(row.id,row.variantGroup);
    }
    for (const group of groups) {
      const variants = [...new Set(rows.filter(row=>row.variantGroup===group).map(row=>row.variant))].sort((a,b)=>a-b);
      if (variants.length<2 || variants.some((variant,i)=>variant!==i)) throw new Error('[codegen] content variants must be contiguous from zero');
      const memberIds = variants.map(variant => rows.filter(row=>row.variantGroup===group && row.variant===variant).map(row=>row.id).sort().join('|'));
      if (memberIds.some(ids=>ids!==memberIds[0])) throw new Error('[codegen] atomic content variants must preserve their members');
    }
  }
  writeFileSync(resolve(OUT_DIR, 'suspended-sea-data.ts'), [
    '// AUTO-GENERATED from data/suspended-sea-*.csv — DO NOT EDIT',
    ...[['SCENES',scenes],['GROUND',ground],['OPENINGS',openings],['WATER',water],['PLACEMENTS',placements]].map(([key,rows]) => `export const SUSPENDED_SEA_${key} = ${JSON.stringify(rows,null,2)} as const;`),
    'export type SuspendedSeaSceneId = typeof SUSPENDED_SEA_SCENES[number]["id"];','',
  ].join('\n'));
}

// The second native world has its own authored support and tension inputs;
// it does not import dummy sea columns or mutate the frozen spatial recipes.
{
  const records = filename => {
    const { header, rows } = readCsv(filename);
    return rows.map(row => {
      if (row.length !== header.length) throw new Error(`[codegen] column count in ${filename}: ${row[0]}`);
      return Object.fromEntries(header.map((key, index) => [toCamel(key), row[index]]));
    });
  };
  const number = (row, key, minimum = 0, integer = false) => {
    if (row[key] === '') throw new Error(`[codegen] missing living landmass ${row.id}.${key}`);
    row[key] = Number(row[key]);
    if (!Number.isFinite(row[key]) || row[key] < minimum || (integer && !Number.isSafeInteger(row[key]))) {
      throw new Error(`[codegen] invalid living landmass ${row.id}.${key}`);
    }
  };
  const points = (text, minimum) => {
    const value = text.split('|').map(pair => pair.split(':').map(Number));
    if (value.length < minimum || value.some(point => point.length !== 2 || !point.every(Number.isFinite))) {
      throw new Error('[codegen] invalid living-landmass point list');
    }
    return value;
  };
  const scenes = records('living-landmass-scenes.csv'), supports = records('living-landmass-supports.csv');
  const tension = records('living-landmass-tension.csv'), placements = records('living-landmass-placements.csv');
  const sceneIds = new Set(scenes.map(row => row.id));
  const poolIds = new Set(records('contaminant-sources.csv').map(row => row.poolId));
  if (scenes.length !== 1 || sceneIds.size !== scenes.length) throw new Error('[codegen] living-landmass first package requires one local scene');
  for (const row of scenes) {
    if (row.worldId !== 'living-landmass' || row.id !== 'living-borne-fin' || !row.name) throw new Error('[codegen] unknown living-landmass identity');
    for (const key of ['recipeVersion', 'cols', 'rows', 'entryDurationMs']) number(row, key, 1, true);
    if (row.cols < 8 || row.rows < 8 || row.cols > 100 || row.rows > 100 || row.entryDurationMs > 1500) {
      throw new Error('[codegen] invalid living-landmass dimensions or entry');
    }
    points(row.spawn, 1); points(row.extract, 1);
  }
  for (const rows of [supports, tension, placements]) {
    const ids = new Set();
    for (const row of rows) {
      const id = `${row.sceneId}:${row.id}`;
      if (!sceneIds.has(row.sceneId) || !/^[a-z][a-z0-9-]*$/.test(row.id) || ids.has(id)) throw new Error('[codegen] duplicate or invalid living-landmass row');
      ids.add(id);
    }
  }
  for (const row of supports) {
    for (const key of ['x', 'y']) number(row, key);
    for (const key of ['radiusX', 'radiusY']) number(row, key, Number.MIN_VALUE);
    number(row, 'angle', -180); number(row, 'height', -80); number(row, 'flexHeight', -80);
    if (!['stable', 'fin'].includes(row.kind) || Math.abs(row.angle) > 180 || Math.abs(row.height) > 80
      || Math.abs(row.flexHeight) > 80 || (row.kind === 'stable' && row.flexHeight !== 0)
      || 1.5 * (Math.abs(row.height) + Math.abs(row.flexHeight)) / Math.min(row.radiusX, row.radiusY) > .4) {
      throw new Error(`[codegen] living-landmass support exceeds smooth traversable slope: ${row.id}`);
    }
  }
  for (const row of tension) {
    for (const key of ['x', 'y', 'hitX', 'hitY']) number(row, key);
    for (const key of ['quietMs', 'warningMs', 'activeMs', 'releaseMs', 'transmissionMs', 'reliefMs', 'damage', 'hitIntervalMs']) number(row, key, Number.MIN_VALUE);
    number(row, 'dangerThreshold', Number.MIN_VALUE);
    if (row.dangerThreshold > 1 || row.transmissionMs + row.reliefMs > row.releaseMs) {
      throw new Error('[codegen] living-landmass relief must finish before the next full warning');
    }
    points(row.outline, 3);
  }
  for (const row of placements) {
    for (const key of ['col', 'row']) number(row, key, 0, true);
    number(row, 'facing');
    if (row.kind === 'enemy') {
      if (row.substrate !== 'insect_remnant' || row.coverage !== 'infiltrate' || row.sense !== 'sense_hear'
        || row.motion !== 'motion_patrol' || row.rhythm !== 'rhythm_open' || row.contact !== 'contact_melee_three'
        || row.tier || row.lootPoolId || row.allowWeapon) throw new Error('[codegen] unsupported living-landmass actor');
      points(row.patrol, 1);
    } else {
      if (!['kindling', 'contaminant'].includes(row.kind) || !['safe', 'contested', 'deep'].includes(row.tier)
        || ['substrate', 'coverage', 'motion', 'sense', 'rhythm', 'contact', 'patrol'].some(key => row[key])) {
        throw new Error('[codegen] invalid living-landmass loot placement');
      }
      if (row.kind === 'contaminant') {
        if (!poolIds.has(row.lootPoolId) || row.allowWeapon) throw new Error('[codegen] unknown living-landmass source pool');
      } else if (!['true', 'false'].includes(row.allowWeapon) || row.lootPoolId) throw new Error('[codegen] missing living-landmass weapon-source permission');
    }
    row.allowWeapon = row.allowWeapon === '' ? null : row.allowWeapon === 'true';
  }
  for (const id of sceneIds) {
    if (tension.filter(row => row.sceneId === id).length !== 1
      || supports.filter(row => row.sceneId === id && row.kind === 'fin').length !== 1
      || placements.filter(row => row.sceneId === id && row.kind === 'enemy').length !== 1
      || placements.filter(row => row.sceneId === id && row.kind === 'kindling').length !== 2
      || placements.filter(row => row.sceneId === id && row.kind === 'contaminant').length !== 2) {
      throw new Error('[codegen] incomplete living-landmass local package');
    }
  }
  writeFileSync(resolve(OUT_DIR, 'living-landmass-data.ts'), [
    '// AUTO-GENERATED from data/living-landmass-*.csv — DO NOT EDIT',
    ...[['SCENES', scenes], ['SUPPORTS', supports], ['TENSION', tension], ['PLACEMENTS', placements]]
      .map(([key, rows]) => `export const LIVING_LANDMASS_${key} = ${JSON.stringify(rows, null, 2)} as const;`),
    'export type LivingLandmassSceneId = typeof LIVING_LANDMASS_SCENES[number]["id"];', '',
  ].join('\n'));
}

console.log('[codegen] Done.');

generateContaminantCatalog(ROOT, OUT_DIR);
