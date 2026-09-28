// Color Chaos - turn-relay sections.
// A "section" is the unit a single turn colors: 1..N adjacent regions taken in
// the canvas fill order. For a mandala the region numbers run centre-outward,
// so ascending order makes the mural bloom outward.

export function buildFillOrder(regions) {
  return (regions || [])
    .map((r) => (r && typeof r.number === 'number' ? r.number : NaN))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

export function buildSections(regions, perTurn = 1) {
  const n = Math.max(1, Math.floor(perTurn) || 1);
  const order = buildFillOrder(regions);
  const sections = [];
  for (let i = 0; i < order.length; i += n) sections.push(order.slice(i, i + n));
  return sections;
}
