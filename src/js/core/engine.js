// Color Chaos - game state engine (DOM-free, so it is unit-testable).
//
// Modes:
//   lock  - first valid color locks the region; later colors are rejected
//           unless applied with override (the gift-purchased overwrite).
//   chaos - any color overwrites; regions are never "locked".
export function createEngine({ regionNumbers, paletteSize, mode = 'lock' }) {
  const regions = new Map();
  for (const n of regionNumbers) {
    regions.set(n, { number: n, color: null, locked: false, user: null, name: null });
  }
  let currentMode = mode;

  function coloredCount() {
    let c = 0;
    for (const r of regions.values()) if (r.color != null) c += 1;
    return c;
  }

  const api = {
    get mode() {
      return currentMode;
    },
    setMode(next) {
      currentMode = next === 'chaos' ? 'chaos' : 'lock';
      return currentMode;
    },
    has(number) {
      return regions.has(number);
    },
    region(number) {
      return regions.get(number) || null;
    },
    total() {
      return regions.size;
    },
    progress() {
      const colored = coloredCount();
      return { colored, total: regions.size };
    },

    // Apply a color. Returns { ok, reason, region, verb }.
    apply({ regionNumber, color, user = null, override = false }) {
      const r = regions.get(regionNumber);
      if (!r) return { ok: false, reason: 'unknown-region' };
      if (!Number.isInteger(color) || color < 1 || color > paletteSize) {
        return { ok: false, reason: 'bad-color' };
      }
      if (currentMode === 'lock' && r.locked && !override) {
        return { ok: false, reason: 'locked' };
      }
      const hadColor = r.color != null;
      r.color = color;
      r.user = user;
      if (currentMode === 'lock') r.locked = true;
      const verb = override && hadColor ? 'overwrote' : hadColor ? 'recolored' : 'colored';
      return { ok: true, region: r, verb };
    },

    // Clear one region (gift effect / reset).
    clear(number) {
      const r = regions.get(number);
      if (!r) return { ok: false, reason: 'unknown-region' };
      r.color = null;
      r.locked = false;
      r.user = null;
      return { ok: true, region: r };
    },

    clearAll() {
      for (const r of regions.values()) {
        r.color = null;
        r.locked = false;
        r.user = null;
      }
    },

    // Random helpers for gift effects.
    randomUncolored(rng = Math.random) {
      const pool = [...regions.values()].filter((r) => r.color == null);
      if (!pool.length) return null;
      return pool[Math.floor(rng() * pool.length)];
    },
    randomColored(rng = Math.random) {
      const pool = [...regions.values()].filter((r) => r.color != null);
      if (!pool.length) return null;
      return pool[Math.floor(rng() * pool.length)];
    },

    snapshot() {
      return { mode: currentMode, ...api.progress() };
    },
  };

  return api;
}
