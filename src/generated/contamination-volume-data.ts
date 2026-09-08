// Generated from contamination-volume-profiles.csv. Do not edit.
export interface VolumeProfile { readonly restMs: number; readonly gatherMs: number; readonly releaseMs: number; readonly disperseMs: number; readonly radiusScale: number; readonly travelScale: number; readonly gapPx: number; readonly dangerThreshold: number; }
export const VOLUME_PROFILE_DATA: Readonly<Record<string, VolumeProfile>> = {
  "sound_echo": {
    "restMs": 1000,
    "gatherMs": 1000,
    "releaseMs": 2200,
    "disperseMs": 1200,
    "radiusScale": 0.72,
    "travelScale": 0.1,
    "gapPx": 0,
    "dangerThreshold": 0.22
  },
  "gas_mass": {
    "restMs": 1100,
    "gatherMs": 1300,
    "releaseMs": 650,
    "disperseMs": 1700,
    "radiusScale": 0.84,
    "travelScale": 0,
    "gapPx": 0,
    "dangerThreshold": 0.22
  },
  "mist_bank": {
    "restMs": 800,
    "gatherMs": 1800,
    "releaseMs": 3000,
    "disperseMs": 1800,
    "radiusScale": 0.9,
    "travelScale": 0.12,
    "gapPx": 24,
    "dangerThreshold": 0.22
  },
  "dust_swarm": {
    "restMs": 1300,
    "gatherMs": 1400,
    "releaseMs": 800,
    "disperseMs": 1600,
    "radiusScale": 0.78,
    "travelScale": 0.34,
    "gapPx": 0,
    "dangerThreshold": 0.22
  }
};
