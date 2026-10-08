/**
 * Slice 9 audio asset registry. Keys match docs/specs/system-audio.md.
 * BootScene preloads every entry as .ogg + .mp3 under /assets/audio/.
 */

export type AudioGroup = 'Master' | 'BGM' | 'Ambient' | 'SFX';

export type RiftLayer = 'base' | 'tension' | 'threat' | 'proximity';

export type AudioDir = 'bgm' | 'ambient' | 'sfx/ui' | 'sfx/player' | 'sfx/enemy' | 'sfx/system';

export type SpatialCurve = 'none' | 'enemy' | 'point' | 'rewriter-hum' | 'boundary';

export interface AudioAssetDef {
  readonly key: string;
  readonly dir: AudioDir;
  readonly group: Exclude<AudioGroup, 'Master'>;
  readonly loop: boolean;
  readonly spatial: SpatialCurve;
}

export const AUDIO_ASSETS: readonly AudioAssetDef[] = [
  { key: 'bgm-menu-void-pad', dir: 'bgm', group: 'BGM', loop: true, spatial: 'none' },
  { key: 'bgm-pp-isolation-drone', dir: 'bgm', group: 'BGM', loop: true, spatial: 'none' },
  { key: 'bgm-rift-base-drone', dir: 'bgm', group: 'BGM', loop: true, spatial: 'none' },
  { key: 'bgm-rift-high-chaos', dir: 'bgm', group: 'BGM', loop: true, spatial: 'none' },
  { key: 'bgm-impact-pressure', dir: 'bgm', group: 'BGM', loop: false, spatial: 'none' },
  { key: 'bgm-rift-threat', dir: 'bgm', group: 'BGM', loop: true, spatial: 'none' },
  { key: 'amb-rift-proximity', dir: 'ambient', group: 'Ambient', loop: true, spatial: 'none' },
  { key: 'amb-pp-mechanical-hum', dir: 'ambient', group: 'Ambient', loop: true, spatial: 'none' },
  { key: 'amb-rift-alien-atmosphere', dir: 'ambient', group: 'Ambient', loop: true, spatial: 'none' },

  { key: 'sfx-ui-click', dir: 'sfx/ui', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-ui-hover', dir: 'sfx/ui', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-ui-open', dir: 'sfx/ui', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-ui-close', dir: 'sfx/ui', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-ui-allocate', dir: 'sfx/ui', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-ui-warning', dir: 'sfx/ui', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-ui-error', dir: 'sfx/ui', group: 'SFX', loop: false, spatial: 'none' },

  { key: 'sfx-shared-player-step-metal', dir: 'sfx/player', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-player-step-organic', dir: 'sfx/player', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-player-step-crystal', dir: 'sfx/player', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-player-hurt', dir: 'sfx/player', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-player-attack', dir: 'sfx/player', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-player-pickup', dir: 'sfx/player', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-player-use-item', dir: 'sfx/player', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-player-search-loop', dir: 'sfx/player', group: 'SFX', loop: true, spatial: 'none' },
  { key: 'sfx-shared-player-search-interrupt', dir: 'sfx/player', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-player-search-reveal-kindling', dir: 'sfx/player', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-player-search-reveal-residue', dir: 'sfx/player', group: 'SFX', loop: false, spatial: 'none' },

  { key: 'sfx-rift-enemy-idle', dir: 'sfx/enemy', group: 'SFX', loop: true, spatial: 'enemy' },
  { key: 'sfx-rift-enemy-alert', dir: 'sfx/enemy', group: 'SFX', loop: false, spatial: 'enemy' },
  { key: 'sfx-rift-enemy-chase', dir: 'sfx/enemy', group: 'SFX', loop: true, spatial: 'enemy' },
  { key: 'sfx-rift-enemy-hit', dir: 'sfx/enemy', group: 'SFX', loop: false, spatial: 'enemy' },
  { key: 'sfx-rift-enemy-die', dir: 'sfx/enemy', group: 'SFX', loop: false, spatial: 'enemy' },
  { key: 'sfx-rift-enemy-overwriter-hum', dir: 'sfx/enemy', group: 'SFX', loop: true, spatial: 'rewriter-hum' },

  { key: 'sfx-rift-enter', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-rift-exit', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-chaos-tick', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-chaos-threshold', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-impact-start', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-impact-hit', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-impact-survive', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-impact-break', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-shared-module-repair', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'none' },
  { key: 'sfx-pp-boundary-pulse', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'boundary' },
  { key: 'amb-suspended-sea-pressure', dir: 'ambient', group: 'Ambient', loop: true, spatial: 'none' },
  { key: 'sfx-suspended-sea-gather', dir: 'sfx/system', group: 'SFX', loop: true, spatial: 'point' },
  { key: 'sfx-suspended-sea-fall', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'point' },
  { key: 'sfx-suspended-sea-contact', dir: 'sfx/system', group: 'SFX', loop: true, spatial: 'point' },
  { key: 'sfx-suspended-sea-drain', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'point' },
  { key: 'sfx-suspended-sea-shell-hit', dir: 'sfx/system', group: 'SFX', loop: false, spatial: 'point' },
] as const;

if (AUDIO_ASSETS.length !== 49 || new Set(AUDIO_ASSETS.map(asset => asset.key)).size !== AUDIO_ASSETS.length) {
  throw new Error(`Expected 49 unique audio assets, got ${AUDIO_ASSETS.length}`);
}

export const LAYER_ASSET_KEY: Record<RiftLayer, string> = {
  base: 'bgm-rift-base-drone',
  tension: 'bgm-rift-high-chaos',
  threat: 'bgm-rift-threat',
  proximity: 'amb-rift-proximity',
};

export const AUDIO_PUBLIC_PREFIX = '/assets/audio';

export function audioUrlsFor(asset: AudioAssetDef): [string, string] {
  const base = `${AUDIO_PUBLIC_PREFIX}/${asset.dir}/${asset.key}`;
  return [`${base}.ogg`, `${base}.mp3`];
}

export function findAudioAsset(key: string): AudioAssetDef | undefined {
  return AUDIO_ASSETS.find((asset) => asset.key === key);
}
