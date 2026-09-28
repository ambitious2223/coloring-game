// Color Chaos - SVG board renderer.
// Injects the canvas SVG, indexes paths by region number, draws number labels,
// and exposes color/reset/flash operations. Coloring = setting path fill.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function createBoard({ mount, svgText, meta, palette, onRegionClick, minLabelArea = 900, extraDefs = '' }) {
  mount.innerHTML = '';
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const parsed = doc.querySelector('svg');
  if (!parsed) throw new Error('canvas.svg has no <svg> root');

  parsed.removeAttribute('width');
  parsed.removeAttribute('height');
  parsed.setAttribute('width', '100%');
  parsed.setAttribute('height', '100%');
  parsed.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  parsed.classList.add('cc-svg');
  const root = document.importNode(parsed, true);
  mount.appendChild(root);

  if (extraDefs) {
    try {
      root.insertAdjacentHTML('afterbegin', extraDefs);
    } catch {
      /* ignore */
    }
  }

  const paths = new Map();
  root.querySelectorAll('path[id^="r"]').forEach((p) => {
    const n = Number(p.id.slice(1));
    if (Number.isFinite(n)) {
      paths.set(n, p);
      p.dataset.region = String(n);
    }
  });

  // Number labels drawn by the game (not baked into the SVG). In colour-numbered
  // (pixel) canvases the printed label is the target colour, not the region id,
  // and cells with target 0 are a fixed, non-fillable background.
  const colorNumbering = meta.numbering === 'color';
  const labelMinArea = colorNumbering ? 150 : minLabelArea;

  if (colorNumbering) {
    for (const r of meta.regions || []) {
      if (!r.target) {
        const p = paths.get(r.number);
        if (p) {
          p.style.fill = meta.background || '#ececec';
          p.classList.add('cc-bg');
        }
      }
    }
  }

  const labels = document.createElementNS(SVG_NS, 'g');
  labels.setAttribute('class', 'cc-labels');
  for (const r of meta.regions || []) {
    if (!Array.isArray(r.label) || r.area < labelMinArea) continue;
    if (colorNumbering && !r.target) continue;
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', r.label[0]);
    text.setAttribute('y', r.label[1]);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.textContent = String(colorNumbering ? r.target : r.number);
    labels.appendChild(text);
  }
  root.appendChild(labels);

  if (onRegionClick) {
    root.addEventListener('click', (e) => {
      const path = e.target.closest && e.target.closest('path[data-region]');
      if (path && !path.classList.contains('cc-bg')) onRegionClick(Number(path.dataset.region));
    });
  }

  const hexOf = (color) => (palette[color - 1] ? palette[color - 1].hex : '#ffffff');

  return {
    setColor(number, color) {
      const p = paths.get(number);
      if (p) {
        p.style.fill = hexOf(color);
        p.classList.add('cc-filled');
      }
    },
    setRawFill(number, hex) {
      const p = paths.get(number);
      if (p) {
        p.style.fill = hex;
        p.classList.add('cc-filled');
      }
    },
    applyPaint(number, paint) {
      const p = paths.get(number);
      if (!p || !paint) return;
      p.style.fill = paint.fill;
      p.style.filter = paint.filter || '';
      p.classList.add('cc-filled');
    },
    flash(number) {
      const p = paths.get(number);
      if (!p) return;
      p.classList.add('cc-flash');
      setTimeout(() => p.classList.remove('cc-flash'), 650);
    },
    select(number) {
      paths.forEach((p, n) => p.classList.toggle('cc-selected', n === number));
    },
    clearSelection() {
      paths.forEach((p) => p.classList.remove('cc-selected'));
    },
    reset() {
      paths.forEach((p) => {
        p.style.fill = '';
        p.classList.remove('cc-filled');
      });
    },
    count() {
      return paths.size;
    },
  };
}
