/**
 * 翻找交互 HUD（迭代 10 / DEC-109）。
 *
 * in-game-ux 开工闸门（写样式前）：
 * 1. 载体：[E] 提示 = A 世界内装置（随身罩上下文读数，与既有撤离提示同元素位）；
 *    读条 = A 世界内装置（device-plate 族，底中细条）；toast-inline = A 贴源短闪。
 *    屏幕空间挂调用方传入的 overlay 根（练习场 = 课覆盖层；出击 = #dom-ui-root）。
 * 2. 具名参考：[E] Signalis 装置读数 / FTL 贴边决策 / Darkest Dungeon 对照一眼可辨
 *    （不学确认对话框链、OS toast、教程气泡）。
 *    读条 Signalis 随身设备读数 / Barotrauma 按住读条节奏（不学显像管畸变、潜艇仪表密度）。
 *    本屏不像：OS 进度条、居中弹窗、设置页滑块。
 * 3. P0 读条进行中：进度几何 400ms 内可辨。P1 走近即现 `[E] 翻找`。
 *    玩家必须回答：按 E 会做什么（撤离或翻找，同一时刻一条）。
 *    表名/数值/档位分开：键印与动作名两个节点；残渣标签与星等分开。
 * 4. 哪台机器：裂隙随身罩磷光字 / 磷光填充。强调原因 = 装置在报上下文，不是网页高亮。
 * 5. 复用 Kit：`.device-plate`、`.toast-inline`、Courier 12/13、teal 谱、warm-dim 薪柴。
 *    禁止圆角卡片、投影、紫谱、通用软件词。
 * 6. 打开：进入 48px 且对象可见 → 提示；按住 E → 装置读数；完成 → toast。不居中、不阻断。
 *
 * 画完自检见文件末。机械层已扫；审美待人终审。
 */

import type { ContaminantRarity } from '@/types/game-types';
import { t } from '@/i18n';
import {
  injectPanelStyles,
  showToastInline,
} from '@/ui/dom/panel-styles';

export type LootSearchPromptKind = 'search' | 'extract' | null;

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

  create(overlayRoot: HTMLElement, options?: LootSearchHudOptions): void {
    this.destroy();
    injectPanelStyles();
    this.root = overlayRoot;

    if (options?.showKindling) {
      const kindling = document.createElement('div');
      kindling.id = 'loot-search-kindling';
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

  setPrompt(kind: LootSearchPromptKind): void {
    if (kind === this.promptKind) return;
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
    action.textContent = kind === 'extract' ? t('hud.prompt.extract') : t('hud.prompt.search');
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
      position: 'top:12px;right:70px;',
      color: KINDLING_COLOR,
      extraStyle: 'font-size:13px;font-weight:bold;',
      durationMs: 800,
    });
  }

  flashResidue(rarity: ContaminantRarity): void {
    if (!this.root) return;
    const color = RARITY_COLOR[rarity];
    showToastInline(
      `<span>${t('hud.residue.label')}</span> <span>${STARS[rarity]}</span>`,
      {
        host: this.root,
        skipQueue: true,
        position: 'top:32px;right:12px;',
        color,
        extraStyle: 'font-size:13px;',
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
    this.channelVisible = false;
  }
}

/*
 * 画完自检（skill）：
 * 1. 载体 A；挂调用方 overlay 根，不挂 body、不随 camera zoom 角锚。
 * 2. 参考见文件头；本屏不像 OS 进度条 / 居中弹窗 / 设置页滑块。
 * 3. P0 读条：装置细条；P1 提示 `[E]` + 动作名分节点。
 * 4. 随身罩磷光。无投影/圆角「好看」。
 * 5. 无不可用变灰态（不可见 = 无提示）。
 * 6. 薪柴 vs 残渣靠通道 + 星等，不靠紫谱。表名数值档位分开。
 * 7. 走近打开；无阻断确认。
 * 8. 词来自术语表；键印 = 绑定键 E。
 * 机械层已扫；审美待人终审。
 */
