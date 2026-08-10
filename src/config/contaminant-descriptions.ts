/**
 * Contaminant effect descriptions for UI display.
 * Re-exports from generated data for backward compatibility with existing panel code.
 */

import type { ContaminantType } from '@/types/game-types';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';

export { CONTAMINANT_DATA } from '@/generated/contaminant-data';

export const CONTAMINANT_DESCRIPTIONS: Record<ContaminantType, { defense: string; tool: string }> =
  Object.fromEntries(
    Object.entries(CONTAMINANT_DATA).map(([id, def]) => [
      id,
      {
        defense: def.descriptionDefense,
        tool: `${def.displayNameTool}: ${def.descriptionTool}`,
      },
    ]),
  ) as Record<ContaminantType, { defense: string; tool: string }>;
