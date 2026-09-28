// Color Chaos - command table + parsing for hub-routed chat commands.
//
// The HUB is the command parser (see docs/COMMANDS.md): a chat trigger with
// match_mode 'token' routes an effect to the game carrying `{ name, args }`.
// This module is the game's side of that contract - the commands it understands,
// plus a local parser used by the tests and as the reference implementation.

export const COMMANDS = [
  { key: 'join', label: 'Join sign-up', args: [] },
  { key: 'gold', label: 'Gold a region', args: [] },
  { key: 'wipe', label: 'Wipe the canvas', args: [] },
  {
    key: 'color',
    label: 'Color a region',
    args: [
      { key: 'region', type: 'number' },
      { key: 'color', type: 'string' },
    ],
  },
];

export function findCommand(name) {
  const key = String(name == null ? '' : name).replace(/^!/, '').trim().toLowerCase();
  return COMMANDS.find((c) => c.key === key) || null;
}

// Parse a raw chat message into { name, args } (first token = command word).
export function parseCommand(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return null;
  const parts = raw.split(/\s+/);
  const name = parts[0].replace(/^!/, '').toLowerCase();
  if (!name) return null;
  return { name, args: parts.slice(1) };
}

// Normalise a hub effect payload into { name, args:[...] }.
// Accepts either { name, args:[...] } or { name, arg1, arg2, rest }.
export function commandFromPayload(payload) {
  const p = payload || {};
  const name = String(p.name || p.command || '').trim();
  if (!name) return null;
  if (Array.isArray(p.args)) return { name, args: p.args.map(String) };
  const args = [];
  if (p.arg1 != null && p.arg1 !== '') args.push(String(p.arg1));
  if (p.arg2 != null && p.arg2 !== '') args.push(String(p.arg2));
  if (p.rest != null && p.rest !== '') args.push(String(p.rest));
  return { name, args };
}
