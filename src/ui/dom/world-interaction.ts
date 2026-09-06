/** World-space device projection into the fixed DOM overlay. */
export interface WorldInteractionContext {
  getAnchor: () => { x: number; y: number };
}

/** Keep identity next to the actual device, independently of list rerenders. */
export function bindWorldInteraction(
  panel: HTMLElement,
  backdrop: HTMLElement,
  context: WorldInteractionContext,
  label: string,
  layout: 'inventory' | 'growth',
): () => void {
  panel.classList.add('world-interaction', `world-${layout}`);
  backdrop.className = 'core-allocation-backdrop';
  const identity = document.createElement('div');
  identity.className = 'world-object-name';
  identity.textContent = label;
  panel.parentElement?.appendChild(identity);
  let frame = 0;
  let disposed = false;
  const update = (): void => {
    if (disposed) return;
    const { x, y } = context.getAnchor();
    for (const element of [panel, backdrop, identity]) {
      element.style.setProperty('--core-x', `${x}px`);
      element.style.setProperty('--core-y', `${y}px`);
    }
    frame = requestAnimationFrame(update);
  };
  update();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    identity.remove();
  };
}
