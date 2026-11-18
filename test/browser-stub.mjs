/*
 * Browser-boot smoke test: loads game.js against a stub DOM (no real
 * browser), clicks Start, plays with keyboard+mouse events through the
 * real boot code, exercises the level-up overlay, and — in a second
 * load — the sim.html auto-play mode. Any typo in element ids or a
 * thrown exception in boot/render/HUD code fails this test.
 *
 * Usage: node test/browser-stub.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, "..", "game", "game.js"), "utf8");

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? " — " + detail : ""));
  if (!ok) failures++;
}

function makeElement(id) {
  const listeners = {};
  const el = {
    id: id,
    style: {},
    textContent: "",
    innerHTML: "",
    children: [],
    listeners: listeners,
    addEventListener: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    appendChild: function (c) { el.children.push(c); return c; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 1280, height: 720 }; },
    fire: function (type, ev) {
      (listeners[type] || []).forEach(function (fn) { fn(ev || {}); });
    },
  };
  return el;
}

function makeCtx() {
  const gradient = { addColorStop: function () {} };
  const target = {
    canvas: null,
    createRadialGradient: function () { return gradient; },
    createLinearGradient: function () { return gradient; },
  };
  return new Proxy(target, {
    get: function (t, prop) {
      if (prop in t) return t[prop];
      return function () {};
    },
    set: function (t, prop, v) { t[prop] = v; return true; },
  });
}

const IDS = ["game", "hud-hp", "hud-hp-text", "hud-xp", "hud-level", "hud-score",
  "hud-combo", "hud-wave", "hud-time", "menu", "gameover", "levelup", "cards",
  "btn-start", "btn-again", "final-stats", "sim-report"];

function makeWorld(simCfg) {
  const elements = {};
  for (const id of IDS) elements[id] = makeElement(id);
  elements["game"].getContext = function () { return makeCtx(); };
  const winListeners = {};
  const documentStub = {
    readyState: "complete",
    title: "",
    getElementById: function (id) { return elements[id] || null; },
    createElement: function () { return makeElement("dyn"); },
    addEventListener: function () {},
  };
  let rafCallback = null;
  const windowStub = {
    document: documentStub,
    addEventListener: function (type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
  };
  if (simCfg) windowStub.__MAKEFUN_SIM__ = simCfg;
  const perf = { now: function () { return 0; } };
  const raf = function (cb) { rafCallback = cb; };
  const mod = { exports: {} };
  new Function("module", "exports", "window", "document", "performance", "requestAnimationFrame",
    code)(mod, mod.exports, windowStub, documentStub, perf, raf);
  return {
    elements: elements,
    document: documentStub,
    window: windowStub,
    key: function (type, key) {
      (winListeners[type] || []).forEach(function (fn) { fn({ key: key, preventDefault: function () {} }); });
    },
    frame: function (t) { const cb = rafCallback; rafCallback = null; if (cb) cb(t); },
    hasRaf: function () { return !!rafCallback; },
  };
}

// ---- world 1: a human-ish session through the real boot code ----
{
  const w = makeWorld(null);
  check("boot registers a frame loop", w.hasRaf());
  check("menu overlay visible at boot", w.elements["menu"].style.display === "flex");

  w.elements["btn-start"].fire("click");
  check("start hides the menu", w.elements["menu"].style.display === "none");

  // Drive the real boot input path (keyboard/mouse events) with the
  // game's own bot brain, read through the __bootGame handle.
  const VB = w.window.VoidBloom;
  const held = {};
  let mouseDown = false;
  function drive() {
    const g = VB.__bootGame;
    if (!g || g.state !== "playing") return;
    const inp = VB.botInput(g);
    const want = {};
    if (inp.mx < -0.25) want["a"] = true;
    if (inp.mx > 0.25) want["d"] = true;
    if (inp.my < -0.25) want["w"] = true;
    if (inp.my > 0.25) want["s"] = true;
    for (const k of ["a", "d", "w", "s"]) {
      if (want[k] && !held[k]) { w.key("keydown", k); held[k] = true; }
      if (!want[k] && held[k]) { w.key("keyup", k); held[k] = false; }
    }
    if (inp.aimX !== null && inp.aimX !== undefined) {
      w.elements["game"].fire("mousemove", { clientX: inp.aimX, clientY: inp.aimY });
    }
    if (inp.firing && !mouseDown) {
      w.elements["game"].fire("mousedown", { clientX: inp.aimX || 640, clientY: inp.aimY || 360 });
      mouseDown = true;
    } else if (!inp.firing && mouseDown) {
      w.key("mouseup", "");
      mouseDown = false;
    }
  }

  let t = 0, sawLevelup = false, clickedCard = false, frames = 0;
  while (frames < 60 * 180) {
    drive();
    t += 16.7;
    w.frame(t);
    frames++;
    if (!sawLevelup && w.elements["levelup"].style.display === "flex") {
      sawLevelup = true;
      check("level-up overlay shows 3 cards", w.elements["cards"].children.length === 3,
        w.elements["cards"].children.length + " cards");
      w.elements["cards"].children[0].fire("click");
      clickedCard = true;
    }
    if (sawLevelup && clickedCard && w.elements["levelup"].style.display === "none") break;
    if (w.elements["gameover"].style.display === "flex") break;
  }
  check("reached a level-up through real play events", sawLevelup, "after " + frames + " frames");
  check("score HUD is live", Number(w.elements["hud-score"].textContent) >= 0 &&
    w.elements["hud-score"].textContent !== "", "score=" + w.elements["hud-score"].textContent);

  // pause toggle through the real key handler
  w.key("keydown", "p");
  t += 16.7; w.frame(t);
  w.key("keydown", "p");
  t += 16.7; w.frame(t);
  check("pause toggle survived two frames", true);
}

// ---- world 2: sim.html auto-play mode ----
{
  const w = makeWorld({ seeds: [7, 8], maxSeconds: 45 });
  const report = w.elements["sim-report"].textContent;
  let parsed = null;
  try { parsed = JSON.parse(report); } catch (e) { /* handled below */ }
  check("sim mode publishes JSON results", Array.isArray(parsed) && parsed.length === 2,
    parsed ? "seeds " + parsed.map(function (r) { return r.seed; }).join(",") : "unparseable");
  check("sim mode marks the page done", w.document.title.indexOf("SIM DONE") >= 0);
  let t = 0;
  for (let i = 0; i < 120; i++) { t += 16.7; w.frame(t); }
  check("sim world renders frames without errors", true);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
