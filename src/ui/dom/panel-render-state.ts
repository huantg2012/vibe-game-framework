/**
 * Preserve reading position when a panel refreshes its contents. Selection changes
 * keep the list nodes alive: replacing the hovered row can itself trigger another
 * enter event and cancel an in-progress wheel/trackpad scroll.
 */
export function renderPanelContent(
  panel: HTMLElement,
  html: string,
  selectionOnly: boolean,
  resetScroll = false,
): void {
  const scrollSelector = '.scroll-area, .decision-aside, .module-report-layout > .readout-detail';
  const positions = resetScroll ? [] : Array.from(panel.querySelectorAll<HTMLElement>(scrollSelector), (area) => ({
    top: area.scrollTop,
    left: area.scrollLeft,
  }));

  if (selectionOnly) {
    const next = document.createElement('template');
    next.innerHTML = html;
    const rowSelector = '.slot-cell, .item-tile, .upgrade-card, .module-report-row';
    const nextRows = next.content.querySelectorAll<HTMLElement>(rowSelector);
    panel.querySelectorAll<HTMLElement>(rowSelector).forEach((row, index) => {
      const nextRow = nextRows[index];
      if (nextRow) row.className = nextRow.className;
    });
    for (const selector of ['.decision-aside', '.module-report-layout > .readout-detail', '.key-hint-bar']) {
      const current = panel.querySelector<HTMLElement>(selector);
      const replacement = next.content.querySelector<HTMLElement>(selector);
      if (current && replacement) current.innerHTML = replacement.innerHTML;
    }
  } else {
    panel.innerHTML = html;
  }

  panel.querySelectorAll<HTMLElement>(scrollSelector).forEach((area, index) => {
    const position = positions[index];
    if (!position) return;
    area.scrollTop = position.top;
    area.scrollLeft = position.left;
  });
}
