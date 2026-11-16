# void-bloom

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/rismzz/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/rismzz/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

<!-- TODO before submitting: replace OWNER and REPO in the two badge URLs
     above with the real GitHub owner and repository name. The repo_readme
     check refuses badge URLs that still hold a template placeholder. -->

**Void Bloom** — an original neon arena survival shooter. You are the last
Bloomkeeper: shapes of the Void pour in, wave after wave, to snuff out the
garden. Shatter them with petal-fire, harvest their golden pollen, and spend
it on new blooms — twin shots, thorn-piercing rounds, an aegis bud that
swallows a killing blow — while the waves grow teeth: strafing Weavers,
telegraph-and-dash Strikers, and splitting Hex Tanks.

- **Four enemy minds**, each readable at a glance: chasers, sine-strafing
  weavers, dashers that flash a telegraph line before they lunge, and tanks
  whose health ring drains as they break into chasers — and which seed the
  air with drifting void-orbs you have to weave through.
- **A build every run**: XP pollen levels you up and offers a choice of
  1-of-3 blooms from 8 upgrades (plus a heal when you are hurting), so runs
  diverge — glass-cannon multishot, pierce lanes, shield tanking.
- **Escalation with fairness**: spawn pressure, surges that ring you in,
  and wave scaling — every threat is telegraphed, every death is earned.
- **Combo scoring**: chained kills raise a multiplier up to x3.0; one hit
  resets it, so greed and caution pull against each other.
- **Deterministic core**: the whole simulation runs on one seeded RNG
  stream and a fixed timestep, so a seeded bot play-test
  (`runSimulation`) reproduces exactly — see `sim.html` / `test/`.

Controls: WASD / arrows to move, mouse to aim, hold mouse or Space to fire,
1–3 to pick a bloom, P to pause. Touch devices get a drag stick with
auto-aim and auto-fire.

## Run it

```sh
node main.ts
```

That assembles the game into `out/` (or `$MAKEFUN_OUTPUT_DIR` when set):

- `out/index.html` — the complete game in one file. Open it in any desktop
  browser; no server, no network, no dependencies.
- `out/sim.html` — the same game in bot auto-play mode: a built-in bot
  plays seeded runs and publishes their results (survival time, wave,
  kills, score) into the page.

Headless balance/determinism check without a browser:

```sh
node test/simulate.mjs
```

Requires Node.js 22.18 or later (main.ts is TypeScript, run as-is).

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards
