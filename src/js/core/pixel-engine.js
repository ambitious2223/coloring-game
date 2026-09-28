// Color Chaos - pixel fill engine (DOM-free, unit-testable).
//
// A pixel canvas has fillable cells (target colour 1..9) and background cells
// (target 0). Fills are one cell per gift by default; the power-ups fill more.
// Milestones fire automatically as the fill percentage crosses thresholds.
export function createPixelEngine({ regions, milestones = [0.25, 0.5, 0.75, 1] }) {
  const target = new Map(); // region number -> colour index (1..9)
  const buckets = new Map(); // colour -> Set(number) of unfilled cells
  let total = 0;

  for (const r of regions || []) {
    const t = r && Number(r.target);
    if (t > 0) {
      target.set(r.number, t);
      if (!buckets.has(t)) buckets.set(t, new Set());
      buckets.get(t).add(r.number);
      total += 1;
    }
  }

  const filled = new Set();
  const fired = new Set();
  const thresholds = [...milestones].filter((n) => n > 0 && n <= 1).sort((a, b) => a - b);

  function takeRandom(set, n) {
    const arr = [...set];
    const out = [];
    while (out.length < n && arr.length) {
      out.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
    }
    return out;
  }

  function mark(numbers) {
    const out = [];
    for (const num of numbers) {
      if (filled.has(num)) continue;
      const color = target.get(num);
      filled.add(num);
      const b = buckets.get(color);
      if (b) b.delete(num);
      out.push({ number: num, color });
    }
    return out;
  }

  const api = {
    total: () => total,
    remaining(color) {
      const b = buckets.get(Number(color));
      return b ? b.size : 0;
    },
    // Baseline: one gift fills one random unfilled cell of its colour.
    fillRandom(color, count = 1) {
      const b = buckets.get(Number(color));
      if (!b || b.size === 0) return [];
      return mark(takeRandom(b, count));
    },
    // Power-up: finish a whole colour.
    fillColor(color) {
      const b = buckets.get(Number(color));
      return b ? mark([...b]) : [];
    },
    // Power-up: fill the colour that is closest to being done.
    fillNearestColor() {
      let best = null;
      let bestSize = Infinity;
      for (const [c, b] of buckets) {
        if (b.size > 0 && b.size < bestSize) {
          bestSize = b.size;
          best = c;
        }
      }
      return best == null ? [] : api.fillColor(best);
    },
    // Power-up: fill N random cells anywhere.
    fillAny(count = 1) {
      const all = new Set();
      for (const b of buckets.values()) for (const n of b) all.add(n);
      return mark(takeRandom(all, count));
    },
    progress() {
      return { filled: filled.size, total, percent: total ? filled.size / total : 0 };
    },
    // Returns the milestone thresholds crossed since the last call (e.g. [0.25]).
    checkMilestones() {
      const p = api.progress().percent;
      const crossed = [];
      for (const t of thresholds) {
        if (p >= t && !fired.has(t)) {
          fired.add(t);
          crossed.push(t);
        }
      }
      return crossed;
    },
    filledNumbers: () => [...filled],
    reset() {
      filled.clear();
      fired.clear();
      buckets.clear();
      for (const [num, t] of target) {
        if (!buckets.has(t)) buckets.set(t, new Set());
        buckets.get(t).add(num);
      }
    },
  };

  return api;
}
