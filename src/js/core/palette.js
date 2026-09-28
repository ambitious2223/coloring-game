// Color Chaos - default palette. Hex is fixed; the visible name is i18n'd.
export const DEFAULT_PALETTE = [
  { hex: '#e6194b', nameKey: 'colorRed' },
  { hex: '#3cb44b', nameKey: 'colorGreen' },
  { hex: '#4363d8', nameKey: 'colorBlue' },
  { hex: '#ffe119', nameKey: 'colorYellow' },
  { hex: '#f58231', nameKey: 'colorOrange' },
  { hex: '#911eb4', nameKey: 'colorPurple' },
  { hex: '#46f0f0', nameKey: 'colorCyan' },
  { hex: '#f032e6', nameKey: 'colorMagenta' },
  { hex: '#bcf60c', nameKey: 'colorLime' },
  { hex: '#fabebe', nameKey: 'colorPink' },
];

// Build a 1-based palette. Accepts an array of hex strings from canvas.json
// (falls back to the default names when the count matches, else generic names).
export function buildPalette(hexList) {
  const list = Array.isArray(hexList) && hexList.length ? hexList : DEFAULT_PALETTE.map((c) => c.hex);
  return list.map((hex, i) => ({
    index: i + 1,
    hex,
    nameKey: DEFAULT_PALETTE[i] ? DEFAULT_PALETTE[i].nameKey : `color${i + 1}`,
  }));
}
