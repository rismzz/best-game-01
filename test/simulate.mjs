/*
 * Headless play-test for Void Bloom: loads game.js without any DOM,
 * runs the built-in bot on fixed seeds, and checks that
 *   1. two runs of the same seed produce identical results (determinism),
 *   2. the bot actually plays: survives, kills, levels up, reaches wave 3+,
 *   3. different seeds produce different runs (the seed really matters).
 *
 * Usage: node test/simulate.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, "..", "game.js"), "utf8");

const mod = { exports: {} };
new Function("module", "exports", code)(mod, mod.exports);
const { runSimulation, Game, botInput } = mod.exports;

// A naive player: same movement/aim bot, but always takes the first
// upgrade card offered instead of building deliberately.
function runNaive(seed, maxSeconds) {
  const g = new Game(seed);
  g.start();
  const dt = 1 / 60;
  const cap = Math.floor((maxSeconds || 600) * 60);
  let steps = 0;
  while (g.state !== "over" && steps < cap) {
    if (g.state === "levelup") { g.chooseUpgrade(0); continue; }
    g.step(dt, botInput(g));
    steps++;
  }
  return { survivedSec: Math.round(g.time * 100) / 100, ended: g.state, level: g.player.level };
}

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? " — " + detail : ""));
  if (!ok) failures++;
}

const seeds = [1337, 4242, 9001];
const results = {};
for (const s of seeds) {
  results[s] = runSimulation(s, 600);
  console.log("seed " + s + ": " + JSON.stringify(results[s]));
}

for (const s of seeds) {
  const again = runSimulation(s, 600);
  check("determinism seed " + s, JSON.stringify(again) === JSON.stringify(results[s]));
}

const r = results[1337];
check("bot survives at least 75s", r.survivedSec >= 75, "survived " + r.survivedSec + "s");
check("bot kills at least 40", r.kills >= 40, r.kills + " kills");
check("bot reaches wave 3+", r.wave >= 3, "wave " + r.wave);
check("bot levels up (level 3+)", r.level >= 3, "level " + r.level);
check("bot hits-per-shot sane (>0.22; pierce can exceed 1)", r.shots > 0 && r.hits / r.shots > 0.22,
  (r.hits / Math.max(1, r.shots)).toFixed(2) + " hits/shot over " + r.shots + " shots");
check("run ends by death or cap, never a crash", r.ended === "over" || r.survivedSec >= 599, "ended=" + r.ended);

// Difficulty curve, both sides: a deliberate build is strong and long-lived
// (the genre's power fantasy), while a naive build gets overwhelmed —
// builds must matter, and the Void must be able to win.
const naive = {};
for (const s of seeds) {
  naive[s] = runNaive(s, 600);
  console.log("naive seed " + s + ": " + JSON.stringify(naive[s]));
}
const naiveDeaths = seeds.filter((s) => naive[s].ended === "over").length;
check("naive build dies on at least 2 of 3 seeds", naiveDeaths >= 2, naiveDeaths + "/3 deaths");
check("naive build is not crushed instantly (>=45s)", seeds.every((s) => naive[s].survivedSec >= 45),
  "min " + Math.min(...seeds.map((s) => naive[s].survivedSec)) + "s");
check("deliberate build outlives naive build", r.survivedSec > naive[1337].survivedSec,
  "deliberate " + r.survivedSec + "s vs naive " + naive[1337].survivedSec + "s");
check("seeds diverge", JSON.stringify(results[1337]) !== JSON.stringify(results[4242]));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
