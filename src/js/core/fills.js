// Color Chaos - premium fills for gift-purchased styles.
// Free colouring uses the flat 10-colour palette; these are special SVG paints
// (gradients / patterns / glow) that only a gift effect applies. Injected once
// into the canvas SVG's <defs>, then referenced with fill="url(#...)".
export const PREMIUM_STYLES = ['gold', 'neon', 'rainbow', 'stripes', 'dots'];

export function premiumPaint(style) {
  switch (style) {
    case 'gold':
      return { fill: 'url(#cc-gold)' };
    case 'neon':
      return { fill: 'url(#cc-neon)', filter: 'url(#cc-glow)' };
    case 'rainbow':
      return { fill: 'url(#cc-rainbow)' };
    case 'stripes':
      return { fill: 'url(#cc-stripes)' };
    case 'dots':
      return { fill: 'url(#cc-dots)' };
    default:
      return null;
  }
}

export function premiumDefs() {
  return `<defs>
    <linearGradient id="cc-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff3b0"/>
      <stop offset="50%" stop-color="#f5c542"/>
      <stop offset="100%" stop-color="#b8860b"/>
    </linearGradient>
    <linearGradient id="cc-neon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#e879f9"/>
    </linearGradient>
    <linearGradient id="cc-rainbow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#e6194b"/>
      <stop offset="25%" stop-color="#f58231"/>
      <stop offset="50%" stop-color="#ffe119"/>
      <stop offset="75%" stop-color="#3cb44b"/>
      <stop offset="100%" stop-color="#4363d8"/>
    </linearGradient>
    <pattern id="cc-stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="14" height="14" fill="#ffffff"/>
      <rect width="7" height="14" fill="#111111"/>
    </pattern>
    <pattern id="cc-dots" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#ffffff"/>
      <circle cx="5" cy="5" r="3" fill="#111111"/>
      <circle cx="13" cy="13" r="3" fill="#111111"/>
    </pattern>
    <filter id="cc-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
}
