export type RGB = [number, number, number];
export interface RawImage { data: Buffer; width: number; height: number; }
export interface TargetSize { width: number; height: number; }

export type StageConfig =
  | { name: 'bgRemove';  enabled: boolean; method: 'chroma'; color: RGB; threshold: number }
  | { name: 'colorGrade'; enabled: boolean; brightness?: number; saturation?: number; tint?: RGB; tintAmount?: number }
  | { name: 'downscale'; enabled: boolean; filter: 'nearest' | 'mitchell' | 'lanczos3' }
  | { name: 'quantize';  enabled: boolean }
  | { name: 'cropPad';   enabled: boolean; padding: number };

export interface AcceptanceConfig {
  maxAvgBrightness?: number; paletteConformance?: number; paletteTolerance?: number;
  requireTransparentBg?: boolean; exactSize?: [number, number];
}
export interface PipelineConfig {
  targetSize: TargetSize; sourceDir: string; outputDir: string;
  paletteFile?: string; stages: StageConfig[]; acceptance: AcceptanceConfig;
}
export interface StageContext { config: PipelineConfig; palette: RGB[]; }
export interface Stage<C extends StageConfig = StageConfig> {
  name: C['name'];
  run(img: RawImage, cfg: C, ctx: StageContext): Promise<RawImage>;
}
