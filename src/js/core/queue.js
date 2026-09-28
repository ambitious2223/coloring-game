// Color Chaos - circular player queue for turn-relay mode.
// The queue loops forever: A, B, C, A, B, ... so even two people can fill the
// whole mural by alternating. Deduped by userId. Gift "priority" inserts the
// player right after the current one (they play next).
export function createQueue() {
  const players = [];
  const index = new Map();
  let cursor = 0;

  function clampCursor() {
    if (players.length === 0) cursor = 0;
    else cursor = ((cursor % players.length) + players.length) % players.length;
  }

  const api = {
    size: () => players.length,
    has: (userId) => index.has(String(userId)),
    list: () => players.slice(),
    current: () => (players.length ? players[cursor] : null),
    cursorIndex: () => cursor,

    add(user, { priority = false } = {}) {
      if (!user) return false;
      const userId = String(user.userId || user.username || user.name || '');
      if (!userId || index.has(userId)) return false;
      const player = {
        userId,
        name: String(user.name || user.username || userId),
        avatar: String(user.avatar || ''),
        joinedAt: Date.now(),
      };
      index.set(userId, player);
      if (priority && players.length) {
        const at = Math.min(cursor + 1, players.length);
        players.splice(at, 0, player);
      } else {
        players.push(player);
      }
      clampCursor();
      return true;
    },

    remove(userId) {
      const id = String(userId);
      const i = players.findIndex((p) => p.userId === id);
      if (i < 0) return false;
      players.splice(i, 1);
      index.delete(id);
      if (i < cursor) cursor -= 1;
      clampCursor();
      return true;
    },

    advance() {
      if (!players.length) return null;
      cursor = (cursor + 1) % players.length;
      return players[cursor];
    },

    setCursor(userId) {
      const id = String(userId);
      const i = players.findIndex((p) => p.userId === id);
      if (i < 0) return false;
      cursor = i;
      return true;
    },

    clear() {
      players.length = 0;
      index.clear();
      cursor = 0;
    },
  };

  return api;
}
