# Pixel mode — suggested gift wiring (1 coin each)

For **Pixel mode**, map nine popular **1-coin** gifts to the nine fill effects, one per
colour. The game reads `src/js/data/pixel-gifts.json` and shows each gift's name in the
palette beside the canvas.

| Colour | Swatch | Effect key | Gift (1 coin) | Gift id |
|---|---|---|---|---|
| 1 black | `#111111` | `fill_1` | GG | 6064 |
| 2 white | `#ffffff` | `fill_2` | Ice Cream Cone | 5827 |
| 3 red | `#e6194b` | `fill_3` | Rose | 5655 |
| 4 orange | `#f58231` | `fill_4` | Blow a kiss | 10716 |
| 5 yellow | `#ffe119` | `fill_5` | Thumbs Up | 6246 |
| 6 green | `#3cb44b` | `fill_6` | Go Popular | 13651 |
| 7 cyan | `#46f0f0` | `fill_7` | TikTok | 5269 |
| 8 blue | `#4363d8` | `fill_8` | Love you | 6890 |
| 9 magenta | `#f032e6` | `fill_9` | Heart | 6247 |

(`Heart Me` is intentionally excluded.)

## How to apply (in Tikora)

For each row above, create a **Trigger → Effect** mapping on the `color-chaos` game:

- **Trigger:** gift → the gift (e.g. *Rose*)
- **Effect:** `fill_N` (e.g. `fill_3`)

One gift fills one pixel of that colour, at a random unfilled cell. That's it — no payload
needed (each colour is its own effect key).

## Bigger gifts → power-ups

Map larger gifts to the power-ups (optional):

- `reveal_color` — finish a whole colour (closest to done)
- `fill_brush` — fill several cells (count = gift coins)
- `reveal_all` — complete the mural
- `golden_pixel` — a golden cell

To change a gift later, edit both the hub mapping and `src/js/data/pixel-gifts.json`
(the latter only affects the palette label).
