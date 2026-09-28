# Chat commands (hub ↔ game contract)

Commands let **free interactions** (chat) trigger game effects, the same way gifts
already do. The **hub** parses the chat and routes an `effect`; the **game** just
handles the effect (it does not parse commands itself).

This builds on the hub's existing chat trigger instead of a new system.

## What the hub does today
`effect_mappings` already supports `trigger_type: 'event'`, `trigger_ref: 'chat'`
with `comment_text` (a **substring** match) and a `who_trigger` filter. So
"comment contains `join`" already works. This contract upgrades that to real
commands.

## Extensions

| Field | Values | Notes |
|---|---|---|
| `match_mode` | `contains` (default) · `token` · `exact` | `contains` = today's behaviour. `token` = first word equals the command (case-insensitive, leading `!` stripped); `comment_text` may list aliases with `\|`. `exact` = whole message equals the command. |
| `per_user_cooldown_ms` | ms (recommended `3000`) | Throttles each viewer, on top of the mapping's global `cooldown_ms`. |

Everything else stays: `trigger_type`, `trigger_ref: 'chat'`, `comment_text`,
`who_trigger` (everyone / follower / subscriber / moderator / topGifter / specific),
`specific_user`, `cooldown_ms`, `play_limit`, `delay_ms`, `priority`, `enabled`.

## Matching (hub side)
1. `who_trigger` filter first (as today).
2. `trigger_type === 'event'` and `trigger_ref === 'chat'`.
3. Normalise the message (trim, lowercase; for `token`, strip a leading `!` from the first word).
4. Apply `match_mode` against `comment_text` (aliases split on `|`).
5. Per-user cooldown for `(mapping_id, username)`.

## Args
Tokens **after** the command word become payload placeholders:

- `{arg1}` `{arg2}` … and `{rest}` (everything after the command), plus the existing
  `{username}`, `{message}`, `{type}`.

Example: message `!spawn dragon left` → `{arg1}=dragon`, `{arg2}=left`, `{rest}=dragon left`.

## Dispatch
A matched command routes an `effect` to the mapped game, exactly like a gift:

- **Direct** — command → an existing effect key. `!wipe` → `wipe_canvas`.
- **Rich** — command → effect `command` with `{ name, args }` for a game that wants its
  own router (best when args matter). Example mapping: effect `command`,
  payload `{ "name": "spawn", "arg1": "{arg1}", "arg2": "{arg2}" }`.

## Game manifest
Games declare the commands they understand so the hub UI can list/prefill them:

```json
"commands": [
  { "key": "join", "label": "Join sign-up" },
  { "key": "color", "label": "Color a region",
    "args": [{ "key": "region", "type": "number" }, { "key": "color", "type": "string" }] }
]
```

`key` is the command word (matched against `comment_text`).

## Reference implementation (this game)
- `src/js/core/commands.js` — `COMMANDS`, `findCommand`, `parseCommand`,
  `commandFromPayload` (a game can accept `{ name, args }` or `{ name, arg1, … }`).
- `src/js/main.js` — `runCommand(name, args, event)` handles the generic `command`
  effect: `join` (adds to the turn queue), `gold` (premium fill), `wipe`, `color <region> <color>`.
- Declared in `tikora.manifest.json` under `commands`.

## Limitation to remember
Role flags (`follower` / `subscriber` / `moderator` / `topGifter`) come from **native
TikTok events only**. The TikFinity bridge does not provide them, so who-gating
silently won't match when the bridge is the event source.

## Hub-side checklist (Tikora)
1. DB: add `match_mode` + `per_user_cooldown_ms` to `effect_mappings` (migration + allow-list).
2. `effects.cjs`: implement `match_mode`, per-user cooldown, and `{arg1}`/`{rest}` in `fillTemplates`.
3. `TriggerEffectMapper.tsx`: for `chat`, add a match-mode selector, aliases, and a per-user cooldown field.
4. Read `commands` from game manifests to prefill the command word + label.
