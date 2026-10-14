/** Runtime spatial identities, distinct from authoring rows and renderer instances. */
import type {Vector2} from '@/types/game-types';
import type {NativeSpatialPrimitive} from './native-spatial-geometry';

export interface NativeSpatialStructure {
  readonly id:string;
  readonly kind:'hole'|'solid';
  readonly assemblyIds:readonly string[];
  readonly instanceIds:readonly number[];
  readonly cells:readonly number[];
  readonly boundary:readonly NativeSpatialPrimitive[];
  readonly bounds:Readonly<{minX:number;minY:number;maxX:number;maxY:number}>;
  readonly areaLowerPx2:number;
  readonly areaUpperPx2:number;
  readonly componentCount:number;
  readonly thickRadiusLowerPx:number;
  readonly distance:(point:Readonly<Vector2>)=>number;
}
export interface NativeSpatialAssemblyPlacement {
  readonly assemblyId:string;
  readonly instanceIds:readonly number[];
  readonly maxSpanPx:number;
}
/** Frozen authored identity before final Boolean erosion and 8px support rasterization. */
export interface NativeSpatialHolePlacement {
  readonly holeId:string;
  readonly profileId:string;
  readonly rects:readonly (readonly [number,number,number,number])[];
}
export interface NativeSpatialBayPlacement {
  readonly bayId:string;readonly profileId:string;
  readonly sourceShore:Readonly<{points:readonly Readonly<Vector2>[];outward:Readonly<Vector2>}>;
  readonly rects:readonly (readonly [number,number,number,number])[];
}
export interface NativeSpatialLandJoin {
  readonly parentIndex:number;readonly childIndex:number;
  readonly rect:readonly [number,number,number,number];
}
export interface NativeSpatialGroupResult {
  readonly structures:readonly NativeSpatialStructure[];
  readonly rejected:readonly {readonly id:string;readonly reasons:readonly string[]}[];
  readonly exteriorVoidCells:number;
  readonly holeLabelByCell:Int32Array;
}
