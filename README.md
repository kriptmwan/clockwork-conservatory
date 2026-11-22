# The Clockwork Conservatory

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/kriptmwan/clockwork-conservatory/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/kriptmwan/clockwork-conservatory/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

A top-down stealth heist in a Victorian glasshouse at night. You are Wren, a
thief slipping through five glasshouses to steal the curios — and, in the last
one, the Clockwork Orchid itself — while clockwork sentinels patrol with
raycast vision cones, cameras sweep the halls, lasers blink on and off, and
tripwires sing if you walk over them.

Built for the [make.fun competition "Make the best stealth game"](https://make.fun/bounty/best-stealth-game-20261121-1759).

## Play

Open `game/index.html` in a desktop browser — no build step, no network
requests, everything runs from static files. Or serve it locally:

```sh
node serve.ts
# open http://localhost:8080
```

## Controls

- **WASD / arrows** — move
- **Shift** — sneak (slower, quieter, harder to spot, slips under tripwires)
- **F** or **click** — toss a coin to lure a sentinel to the clink
- **E** — drop a smoke vial (blocks vision for a few seconds)
- **Esc / P** — pause · **R** — retry a heist · **M** — mute

## The five heists

| # | Glasshouse | Sentinels | Cameras | Lasers | Tripwires | Loot |
|---|------------|-----------|---------|--------|-----------|------|
| 1 | The Palm House | 3 | 1 | 0 | 0 | 4 |
| 2 | The Orchid Gallery | 4 | 2 | 2 | 0 | 6 |
| 3 | The Fern Vault | 5 | 3 | 3 | 2 | 8 |
| 4 | The Brass Menagerie | 6 | 4 | 4 | 3 | 10 |
| 5 | The Heart of the Glasshouse | 7 | 5 | 5 | 4 | 12 |

Each heist is a hand-designed floor plan. Lift enough loot and the exit lock
clicks open; lift it all, stay unseen, and beat par time for three stars.

## How it plays

- **Sentinels** run a five-state mind — Patrol, Inspect, Alert, Search,
  Return — with A* pathfinding, a hearing radius, and a detection meter that
  fills while you are in their raycast vision cone.
- **Cameras** sweep their cones; being seen raises the alarm and calls the
  sentinels to your last known spot.
- **Timed lasers** switch on and off; crossing a live beam trips the alarm.
- **Pulsing tripwires** trip when walked over — sneak under them.
- **Planters** hide you (a sentinel must get very close to spot you inside
  one); **dark beds** halve a sentinel's sight; **smoke** blinds everything
  for a few seconds.
- **Alarm stages** — Calm, Suspicious, Hunted — speed up the sentinels and
  the cameras while they last, then the glasshouse settles again.
- A **tactical minimap** shows sentinels, cameras, loot, and the exit.
- Synthesized Web Audio: footsteps, coin clinks, pickup chimes, alarm stings,
  and a low ambient hum. No audio files, no network.

## How it is built

Plain JavaScript ES modules under `game/src/`, no libraries, no build step:

- `levels.js` — the five hand-designed heists
- `world.js` — tilemap, collision, line of sight
- `raycast.js` — vision-cone polygons and sight checks
- `pathfind.js` — A* on the tile grid
- `guard.js` — the sentinel finite-state machine
- `camera.js`, `laser.js` — sweeping cameras, timed lasers, tripwires
- `gadgets.js` — coin lure and smoke vial
- `player.js`, `particles.js` — the thief and the dust in the air
- `game.js` — state machine, alarm stages, scoring, stars
- `render.js`, `hud.js` — canvas drawing, lighting, minimap, screens
- `audio.js` — synthesized sound · `input.js` — keyboard and mouse
- `shots.js` — deterministic staging for the screenshots (`?shot=`)

The entry point is `main.ts` (Node 22, standard library only): it copies
`game/` and `screenshots/` to the output and writes the dossier with the
vendored `vendor/makefun-game.ts`.

## Tests

```sh
node tests/validate-levels.mjs  # grid shape, borders, reachability
node tests/playtest.mjs         # vision, cover, coin, smoke, laser,
                                # tripwire, camera — plus a cautious bot
                                # that plays level 1 to completion
```

## License

MIT — see [LICENSE](LICENSE).
