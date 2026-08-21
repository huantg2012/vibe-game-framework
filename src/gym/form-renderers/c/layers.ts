import type { ContaminationForm } from '@/generation/contamination-draw';
import type { CoverageId, OccupancyId } from '@/generated/contamination-lexicon-data';
import { STAMP_KEY, type StampKey } from '@/gym/form-renderers/c/stamps';

export function occupancyStamp(occupancy: OccupancyId): StampKey {
  switch (occupancy) {
    case 'wall':
      return STAMP_KEY.occWall;
    case 'paint':
      return STAMP_KEY.occPaint;
    case 'volume':
      return STAMP_KEY.occVolume;
    default:
      return STAMP_KEY.occFloor;
  }
}

export function substrateStamp(substrate: string): StampKey {
  switch (substrate) {
    case 'lamp_pillar':
      return STAMP_KEY.subLamp;
    case 'doorframe':
      return STAMP_KEY.subDoor;
    case 'wall_rust':
      return STAMP_KEY.subRust;
    case 'fungal_mat':
      return STAMP_KEY.subFungal;
    case 'oil_film':
      return STAMP_KEY.subOil;
    default:
      return STAMP_KEY.subOrganic;
  }
}

export function veilStamp(coverage: CoverageId): StampKey {
  if (coverage === 'overwrite') return STAMP_KEY.veilThick;
  if (coverage === 'rewrite') return STAMP_KEY.veilHalf;
  return STAMP_KEY.veilThin;
}

export function senseStamp(sense: string): StampKey {
  if (sense === 'sense_touch') return STAMP_KEY.senseTouch;
  if (sense === 'sense_hear' || sense === 'sense_scent' || sense === 'sense_domain') {
    return STAMP_KEY.senseCavity;
  }
  return STAMP_KEY.senseSeam;
}

export function utteranceStamp(utteranceId: string | undefined): StampKey | null {
  switch (utteranceId) {
    case 'door_still_closing':
      return STAMP_KEY.uttOpen;
    case 'eye_in_the_seam':
      return STAMP_KEY.uttSeam;
    case 'cluster_lung':
      return STAMP_KEY.uttBreath;
    case 'corridor_watching':
      return STAMP_KEY.uttWatch;
    default:
      return null;
  }
}

export function rhythmPeriodMs(rhythm: string): number {
  switch (rhythm) {
    case 'rhythm_sleep':
      return 4200;
    case 'rhythm_pulse':
      return 900;
    case 'rhythm_cluster':
      return 3100;
    case 'rhythm_sky':
      return 5200;
    default:
      return 2400;
  }
}

export function salt32(seed: number, n: number): number {
  return (Math.imul(seed ^ Math.imul(n + 1, 0x9e3779b9), 0x85ebca6b) >>> 0);
}

export function signedSalt(seed: number, n: number, span: number): number {
  return (salt32(seed, n) % (span * 2 + 1)) - span;
}

export function usesDust(form: ContaminationForm): boolean {
  const id = form.lexemes.contact;
  return id === 'contact_melee_three' || id === 'contact_disperse_core';
}

export function usesStain(form: ContaminationForm): boolean {
  const id = form.lexemes.contact;
  return id === 'contact_step_chaos' || id === 'contact_volume_chaos';
}

export function usesStrike(form: ContaminationForm): boolean {
  const id = form.lexemes.contact;
  return id === 'contact_adjacent_strike' || id === 'contact_disperse_core';
}
