/** Shared bottom-edge search/extraction readout. Timing and eligibility belong
 * to the caller; this component only displays the supplied prompt and progress.
 */
import type { ContaminantRarity } from '@/types/game-types';
import { t } from '@/i18n';
import {
  injectPanelStyles,
  showToastInline,
} from '@/ui/dom/panel-styles';

export type LootSearchPromptKind = 'search' | 'extract' | 'pickup' | null;

export interface LootSearchHudOptions {
  readonly showKindling?: boolean;
}

const KINDLING_COLOR = '#c4873a';
const RARITY_COLOR: Record<ContaminantRarity, string> = {
  common: '#8a8f96',
  fine: '#1aad96',
  rare: '#3cffd4',
};
const STARS: Record<ContaminantRarity, string> = {
  common: '★',
  fine: '★★',
  rare: '★★★',
};

export class LootSearchHud {
  private root: HTMLElement | null = null;
  private promptEl: HTMLDivElement | null = null;
  private promptKeyEl: HTMLSpanElement | null = null;
  private promptActionEl: HTMLSpanElement | null = null;
  private channelEl: HTMLDivElement | null = null;
  private fillEl: HTMLDivElement | null = null;
  private kindlingValueEl: HTMLSpanElement | null = null;
  private promptKind: LootSearchPromptKind = null;
  private channelVisible = false;
  private sourceHint = '';

  create(overlayRoot: HTMLElement, options?: LootSearchHudOptions): void {
    this.destroy();
    injectPanelStyles();
    this.root = overlayRoot;

    if (options?.showKindling) {
      const kindling = document.createElement('div');
      kindling.id = 'loot-search-kindling';
      kindling.className = 'device-plate';
      const kindlingLabel = document.createElement('span');
      kindlingLabel.className = 'kindling-label';
      kindlingLabel.textContent = t('hud.kindling.label');
      const kindlingValue = document.createElement('span');
      kindlingValue.className = 'kindling-value';
      kindlingValue.textContent = '0';
      kindling.appendChild(kindlingLabel);
      kindling.appendChild(kindlingValue);
      overlayRoot.appendChild(kindling);
      this.kindlingValueEl = kindlingValue;
    }

    const prompt = document.createElement('div');
    prompt.id = 'loot-search-prompt';
    prompt.className = 'device-plate';
    const key = document.createElement('span');
    key.className = 'prompt-key';
    const action = document.createElement('span');
    action.className = 'prompt-action';
    prompt.appendChild(key);
    prompt.appendChild(action);
    overlayRoot.appendChild(prompt);
    this.promptEl = prompt;
    this.promptKeyEl = key;
    this.promptActionEl = action;

    const channel = document.createElement('div');
    channel.id = 'loot-search-channel';
    channel.className = 'device-plate';
    const track = document.createElement('div');
    track.className = 'channel-track';
    const fill = document.createElement('div');
    fill.className = 'channel-fill';
    track.appendChild(fill);
    channel.appendChild(track);
    overlayRoot.appendChild(channel);
    this.channelEl = channel;
    this.fillEl = fill;
  }

  setPrompt(kind: LootSearchPromptKind, sourceHint = ''): void {
    if (kind === this.promptKind && sourceHint === this.sourceHint) return;
    this.sourceHint = sourceHint;
    this.promptKind = kind;
    const prompt = this.promptEl;
    const key = this.promptKeyEl;
    const action = this.promptActionEl;
    if (!prompt || !key || !action) return;
    if (kind === null) {
      prompt.style.display = 'none';
      return;
    }
    key.textContent = '[E]';
    action.textContent = kind === 'extract' ? t('hud.prompt.extract')
      : kind === 'pickup' ? t('hud.prompt.pickup') : `${t('hud.prompt.search')}${sourceHint ? ` · ${sourceHint}` : ''}`;
    prompt.style.display = 'block';
  }

  setChannel(progress01: number | null): void {
    const channel = this.channelEl;
    const fill = this.fillEl;
    if (!channel || !fill) return;
    if (progress01 === null) {
      if (this.channelVisible) {
        channel.style.display = 'none';
        fill.style.width = '0%';
        this.channelVisible = false;
      }
      return;
    }
    if (!this.channelVisible) {
      channel.style.display = 'block';
      this.channelVisible = true;
    }
    const pct = progress01 <= 0 ? 0 : progress01 >= 1 ? 100 : progress01 * 100;
    fill.style.width = `${pct}%`;
  }

  setKindling(total: number): void {
    if (this.kindlingValueEl) this.kindlingValueEl.textContent = String(total);
  }

  flashKindling(amount: number): void {
    if (!this.root) return;
    showToastInline(`+${amount}`, {
      host: this.root,
      skipQueue: true,
      position: 'top:66px;right:12px;',
      color: KINDLING_COLOR,
      extraStyle: 'font-size:12px;background:#0f1114;padding:4px 8px;',
      durationMs: 800,
    });
  }

  flashResidue(rarity: ContaminantRarity, qualityLabel?: string): void {
    if (!this.root) return;
    const color = qualityLabel ? '#a3b3a0' : RARITY_COLOR[rarity];
    showToastInline(
      `<span>${t('hud.residue.label')}</span> <span>${qualityLabel ?? STARS[rarity]}</span>`,
      {
        host: this.root,
        skipQueue: true,
        position: 'top:98px;right:12px;',
        color,
        extraStyle: 'font-size:12px;background:#0f1114;padding:4px 8px;',
        durationMs: 1200,
      },
    );
  }

  destroy(): void {
    this.promptEl?.remove();
    this.channelEl?.remove();
    this.kindlingValueEl?.parentElement?.remove();
    this.root = null;
    this.promptEl = null;
    this.promptKeyEl = null;
    this.promptActionEl = null;
    this.channelEl = null;
    this.fillEl = null;
    this.kindlingValueEl = null;
    this.promptKind = null;
    this.sourceHint = '';
    this.channelVisible = false;
  }
}
