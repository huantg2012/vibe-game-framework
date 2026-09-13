/** Native-world admission for complete, same-record recovery. No gameplay simulation here. */
import { saveManager, type SaveStorage } from '@/managers/save-manager';
import { validateSuspendedSeaAdmission } from './recovery-validation';
import { validRiftDeparture, type RiftCheckpoint } from '@/types/rift-checkpoint';
import { createSuspendedSeaWorld, type SuspendedSeaWorld } from './world';

export function suspendedSeaIdentity(world: SuspendedSeaWorld): RiftCheckpoint['identity'] {
  return { worldId: 'suspended-sea', layoutId: world.metadata.sceneId, seed: world.metadata.seed, signature: world.metadata.signature };
}
export class SeaJourneyStorage implements SaveStorage {
  // Independent player record for this native-world review, never the main game's key.
  constructor(private readonly backend: SaveStorage, private readonly prefix = 'coh-suspended-sea-journey:') {}
  getItem(key: string): string | null { return this.backend.getItem(this.prefix + key); }
  setItem(key: string, value: string): void { this.backend.setItem(this.prefix + key, value); }
  removeItem(key: string): void { this.backend.removeItem(this.prefix + key); }
}
export function installSuspendedSeaRecoveryValidation(): void {
  const signatures = new Map<string, string>();
  function current(identity: RiftCheckpoint['identity']): boolean {
    const key = `${identity.layoutId}:${identity.seed}`;
    try {
      let signature = signatures.get(key);
      if (!signature) {
        signature = createSuspendedSeaWorld(identity.seed, identity.layoutId).metadata.signature;
        if (signatures.size >= 16) signatures.clear();
        signatures.set(key, signature);
      }
      return signature === identity.signature;
    } catch { return false; }
  }
  saveManager.setRiftDepartureValidator(intent => validRiftDeparture(intent) && current(intent.identity));
  saveManager.setRiftStateValidator(validateSuspendedSeaAdmission);
}
