import type {MasterWorld} from '@/generation/world-study/r100-master-world';

/** Rendering consumes physical matter and appearance, not production admission
 * or deployed gameplay content. A DEV context must not impersonate MasterWorld. */
export type MasterSurfaceWorld=Pick<MasterWorld,'definition'|'raster'|'meshes'|'sample'|'matterAt'|'appearance'>;
