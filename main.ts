/*
 * VOID BLOOM — entrypoint for make.fun bounty best-game-01 (program/v1).
 *
 * The grader runs `node main.ts` (Node 22) in a sandbox with no network:
 * the repository is read-only at MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR
 * is an empty writable directory. This program assembles the game into
 * that output directory:
 *
 *   index.html — the complete game (CSS + JS inlined, zero dependencies)
 *   sim.html   — the same game in bot auto-play mode; it publishes seeded
 *                simulation results into the page for play-test checks
 *
 * The build is deterministic: same sources in, byte-identical files out.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const botDir: string = process.env.MAKEFUN_BOT_DIR ?? dirname(fileURLToPath(import.meta.url));
const outDir: string = process.env.MAKEFUN_OUTPUT_DIR ?? join(botDir, "out");

const gameJs: string = readFileSync(join(botDir, "game.js"), "utf8");
const pageCss: string = readFileSync(join(botDir, "page.css"), "utf8");

const PAGE_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Void Bloom — Neon Arena Survival</title>
<style>
__CSS__
</style>
</head>
<body>
<h1 class="title">VOID BLOOM</h1>
<p class="tagline">The last Bloomkeeper against the Void. Harvest pollen. Grow. Survive.</p>
<div id="stage">
  <canvas id="game" width="1280" height="720"></canvas>
  <div id="hud">
    <div class="row">
      <span class="stat" id="hud-hp-text">HP 5/5</span>
      <div class="bar" style="flex:1"><div id="hud-hp"></div></div>
      <span class="stat" id="hud-score">0</span>
      <span class="stat" id="hud-combo"></span>
      <span class="spacer"></span>
      <span class="stat" id="hud-wave">WAVE 1</span>
      <span class="stat" id="hud-time">0:00</span>
    </div>
    <div class="row">
      <span class="stat" id="hud-level">LV 1</span>
      <div class="bar" style="flex:1"><div id="hud-xp"></div></div>
    </div>
  </div>
  <div class="overlay" id="menu">
    <h2>VOID BLOOM</h2>
    <p>You are the last <strong>Bloomkeeper</strong>. Shapes of the Void pour in, wave after
       wave, to snuff out the garden. Shatter them, harvest their golden pollen, and spend
       it on new blooms — twin shots, thorn pierce, an aegis bud — before the dark closes in.</p>
    <p class="controls">
      <strong>Move</strong> WASD / arrow keys &nbsp;·&nbsp; <strong>Aim</strong> mouse &nbsp;·&nbsp;
      <strong>Fire</strong> hold mouse / Space<br>
      <strong>Level up:</strong> click a bloom card or press 1–3 &nbsp;·&nbsp; <strong>Pause</strong> P &nbsp;·&nbsp;
      Touch: drag to move, the Bloomkeeper auto-fires
    </p>
    <button class="cta" id="btn-start">START DEFENDING</button>
  </div>
  <div class="overlay" id="levelup">
    <h3>CHOOSE A BLOOM</h3>
    <div id="cards"></div>
  </div>
  <div class="overlay" id="gameover">
    <h3>THE GARDEN GOES DARK</h3>
    <p id="final-stats"></p>
    <button class="cta" id="btn-again">BLOOM AGAIN (R)</button>
  </div>
</div>
<footer class="note">
  Void Bloom — an original game built by an AI agent for
  <a href="https://make.fun/bounty/best-game-01">make.fun's "Make the best game" bounty</a>.
  No downloads, no dependencies: this page is the whole game.
</footer>
__EXTRA__
<script>
__GAME_JS__
</script>
</body>
</html>
`;

function build(extraHead: string, extraBody: string): string {
  return PAGE_SHELL
    .split("__CSS__").join(pageCss)
    .split("__EXTRA__").join(extraBody)
    .split("__GAME_JS__").join(gameJs)
    .replace("<title>Void Bloom", extraHead + "<title>Void Bloom");
}

mkdirSync(outDir, { recursive: true });

const indexHtml = build("", "");
writeFileSync(join(outDir, "index.html"), indexHtml);

const simScript =
  '<script>window.__MAKEFUN_SIM__ = { seeds: [1337, 4242, 9001], maxSeconds: 300 };</script>\n' +
  '<pre id="sim-report">running simulations...</pre>';
const simHtml = build("", simScript);
writeFileSync(join(outDir, "sim.html"), simHtml);

console.log("VOID BLOOM build complete");
console.log("wrote index.html (" + indexHtml.length + " bytes) — the playable game");
console.log("wrote sim.html (" + simHtml.length + " bytes) — bot auto-play play-test page");
console.log("open index.html in any desktop browser to play; no server or network needed");
