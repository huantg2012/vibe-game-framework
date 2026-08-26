/**
 * 甲信号相 → 簇模式。无 Phaser，基因谱烘焙与旧生产甲共用。
 */
export type ClusterMode = 'patrol' | 'search' | 'chase' | 'strike';

export function clusterModeOf(signal: 'idle' | 'strike' | 'inflated' | 'awake'): ClusterMode {
  if (signal === 'strike') return 'strike';
  if (signal === 'inflated') return 'search';
  if (signal === 'awake') return 'chase';
  return 'patrol';
}
