// Color Chaos - per-user rate limiting / fairness.
// check() is advisory (does not mutate); record() commits an accepted action.
export function createRateLimiter({ cooldownMs = 4000, shareCap = 0 } = {}) {
  const state = new Map();

  return {
    check(user) {
      const st = state.get(user) || { last: 0, count: 0 };
      const now = Date.now();
      if (now - st.last < cooldownMs) return { ok: false, reason: 'cooldown' };
      if (shareCap && st.count >= shareCap) return { ok: false, reason: 'cap' };
      return { ok: true };
    },
    record(user) {
      const st = state.get(user) || { last: 0, count: 0 };
      st.last = Date.now();
      st.count += 1;
      state.set(user, st);
      return st;
    },
    countFor(user) {
      return (state.get(user) || { count: 0 }).count;
    },
    reset() {
      state.clear();
    },
  };
}
