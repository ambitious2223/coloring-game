// Color Chaos - palette bar UI.
export function createPaletteBar({ root, palette, i18n, onPick }) {
  root.innerHTML = '';
  for (const c of palette) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cc-swatch';
    btn.dataset.color = String(c.index);
    btn.title = `${c.index} - ${i18n.t(c.nameKey)}`;
    btn.innerHTML =
      `<span class="cc-swatch-chip" style="background:${c.hex}"></span>` +
      `<span class="cc-swatch-num">${c.index}</span>` +
      `<span class="cc-swatch-name">${i18n.t(c.nameKey)}</span>`;
    btn.addEventListener('click', () => onPick && onPick(c));
    root.appendChild(btn);
  }
  return {
    highlight(index) {
      root.querySelectorAll('.cc-swatch').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.color) === index);
      });
    },
  };
}
