// Color Chaos - chat parser.
// Turns a viewer comment into { region, color } (color is a 1-based palette
// index) or null. Accepts: "12 green", "12 3", "#12 green", "12 #ff0000".
// Color words are matched in any supported language (via the i18n index).

const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .trim();

function resolveColor(token, palette, colorIndex) {
  if (/^\d+$/.test(token)) {
    const i = parseInt(token, 10);
    return i >= 1 && i <= palette.length ? i : null;
  }
  const t = token.toLowerCase();
  const byHex = palette.find((p) => p.hex.toLowerCase() === t || p.hex.toLowerCase() === `#${t}`);
  if (byHex) return byHex.index;
  const byName = colorIndex.get(norm(token));
  return byName || null;
}

export function parseChat(text, palette, colorIndex) {
  if (text == null) return null;
  const raw = String(text).trim();
  if (!raw) return null;

  const parts = raw.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 2) return null;

  const regionToken = parts[0].replace(/^#/, '');
  if (!/^\d+$/.test(regionToken)) return null;
  const region = parseInt(regionToken, 10);

  const colorToken = parts.slice(1).join(' ').replace(/^#/, '').trim();
  const color = resolveColor(colorToken, palette, colorIndex);
  if (!color) return null;

  return { region, color };
}
