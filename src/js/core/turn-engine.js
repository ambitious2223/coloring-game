// Color Chaos - turn-relay state machine (DOM-free, unit-testable).
//
// States:
//   signup      - collecting players, not started
//   waiting     - started but no players yet
//   await-color - spotlighting a player, waiting for their colour reply
//   complete    - every section has been coloured
//
// A turn colours the NEXT unfilled section. Skip passes the turn to the next
// player but leaves the section for them (same rule as the queue loop).
export function createTurnEngine({ sections, queue }) {
  const total = Array.isArray(sections) ? sections.length : 0;
  let state = 'signup';
  let nextIndex = 0;
  const done = [];

  function refreshState() {
    if (nextIndex >= total) state = 'complete';
    else if (queue.size() === 0) state = 'waiting';
    else state = 'await-color';
  }

  const api = {
    get state() {
      return state;
    },
    get current() {
      return queue.current();
    },
    total: () => total,

    openSignup() {
      state = 'signup';
    },

    start() {
      refreshState();
      return state;
    },

    addPlayer(user, opts) {
      const added = queue.add(user, opts);
      // During sign-up we stay in 'signup'; only a start() begins play. But if
      // the relay already started with an empty queue, a join wakes it up.
      if (added && state === 'waiting') refreshState();
      return added;
    },

    removePlayer(userId) {
      const removed = queue.remove(userId);
      if (removed) refreshState();
      return removed;
    },

    // Apply the current player's colour to the next section.
    // Returns { index, regions, color, author } or null.
    setColor(color) {
      if (state !== 'await-color') return null;
      const regions = sections[nextIndex];
      const author = queue.current();
      const entry = { index: nextIndex, regions, color, author };
      done.push(entry);
      nextIndex += 1;
      queue.advance();
      refreshState();
      return entry;
    },

    // Pass the turn; the section stays unfilled for the next player.
    skip() {
      if (state !== 'await-color') return null;
      queue.advance();
      refreshState();
      return queue.current();
    },

    progress() {
      return { done: done.length, total };
    },

    results() {
      return done.slice();
    },
  };

  return api;
}
