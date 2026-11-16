"use strict";
/*
 * VOID BLOOM — an original neon arena survival shooter.
 *
 * You are the last Bloomkeeper. The Void sends its shapes in waves;
 * harvest their pollen, grow new blooms, and do not let the garden go dark.
 *
 * Pure game logic (class Game) is DOM-free and fully deterministic for a
 * given seed: every random decision flows from one mulberry32 stream.
 * The browser layer at the bottom only renders and feeds input.
 */

const VB_W = 1280;
const VB_H = 720;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

const ENEMY_TYPES = {
  chaser: { r: 13, hp: 3,  speed: 150, damage: 1, score: 10, xp: 1, color: "#ff4d6d" },
  weaver: { r: 12, hp: 2,  speed: 168, damage: 1, score: 15, xp: 1, color: "#ffa94d" },
  dasher: { r: 11, hp: 2,  speed: 110, damage: 1, score: 20, xp: 2, color: "#4dd8ff" },
  tank:   { r: 25, hp: 16, speed: 55,  damage: 2, score: 50, xp: 4, color: "#b44dff" },
};

const UPGRADES = [
  { id: "multishot", name: "Twin Bloom",   desc: "+1 projectile",                    max: 3 },
  { id: "damage",    name: "Heavy Petals", desc: "+1 bullet damage",                 max: 5 },
  { id: "rapid",     name: "Rapid Bloom",  desc: "+18% fire rate",                   max: 6 },
  { id: "pierce",    name: "Thorn Pierce", desc: "Bullets pierce +1 enemy",          max: 3 },
  { id: "shield",    name: "Aegis Bud",    desc: "A shield blocks one hit (10s recharge)", max: 1 },
  { id: "vitality",  name: "Deep Roots",   desc: "+1 max HP and heal 1",             max: 5 },
  { id: "magnet",    name: "Pollen Magnet", desc: "+45% pickup radius",              max: 4 },
  { id: "speed",     name: "Swift Roots",  desc: "+8% move speed",                   max: 5 },
  { id: "heal",      name: "Second Wind",  desc: "Heal 2 HP right now",              max: 99 },
];

function xpNextFor(level) { return 8 + (level - 1) * 7; }

class Game {
  constructor(seed) {
    this.rng = mulberry32(seed === undefined ? 1 : seed);
    this.state = "menu"; // menu | playing | levelup | over
    this.reset();
  }

  reset() {
    this.time = 0;
    this.wave = 1;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboT = 0;
    this.shakeT = 0;
    this.flashT = 0;
    this.spawnT = 0.6;
    this.surgeT = 40;
    this.banner = null;
    this.bullets = [];
    this.ebullets = [];
    this.enemies = [];
    this.shards = [];
    this.parts = [];
    this.texts = [];
    this.pendingUpgrades = [];
    this.stats = { shots: 0, hits: 0 };
    this.player = {
      x: VB_W / 2, y: VB_H / 2, vx: 0, vy: 0, r: 13,
      hp: 5, maxHp: 5, speed: 246,
      fireT: 0, fireInterval: 0.21, damage: 1, projectiles: 1,
      pierce: 0, bulletSpeed: 660, magnetR: 92,
      shield: false, shieldReady: false, shieldT: 0,
      invulnT: 0, aimX: 1, aimY: 0,
      xp: 0, level: 1, xpNext: xpNextFor(1),
      upCounts: {},
    };
  }

  start() {
    this.reset();
    this.state = "playing";
    this.banner = { text: "WAVE 1", t: 2.2 };
  }

  comboMul() { return 1 + Math.min(this.combo, 40) * 0.05; }

  // ---------------- spawning ----------------

  spawnInterval() {
    return clamp(1.05 - this.time * 0.0075, 0.15, 1.05);
  }

  pickType() {
    const t = this.time;
    const r = this.rng();
    let wTank = 0, wDash = 0, wWeave = 0;
    if (t >= 70) wTank = 0.08 + Math.min(0.06, (t - 70) * 0.0005);
    if (t >= 55) wDash = 0.20;
    if (t >= 18) wWeave = 0.30;
    if (r < wTank) return "tank";
    if (r < wTank + wDash) return "dasher";
    if (r < wTank + wDash + wWeave) return "weaver";
    return "chaser";
  }

  edgePoint() {
    const p = this.player;
    for (let tries = 0; tries < 8; tries++) {
      const side = Math.floor(this.rng() * 4);
      let x = 0, y = 0;
      if (side === 0) { x = this.rng() * VB_W; y = -30; }
      else if (side === 1) { x = VB_W + 30; y = this.rng() * VB_H; }
      else if (side === 2) { x = this.rng() * VB_W; y = VB_H + 30; }
      else { x = -30; y = this.rng() * VB_H; }
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy > 280 * 280 || tries === 7) return { x: clamp(x, 8, VB_W - 8), y: clamp(y, 8, VB_H - 8) };
    }
    return { x: 8, y: 8 };
  }

  spawnEnemy(type, x, y, spawnIn) {
    const base = ENEMY_TYPES[type];
    const hpMul = (1 + Math.max(0, this.wave - 2) * 0.18) * (1 + this.time * 0.006);
    const spMul = 1 + Math.min(0.6, this.time * 0.0016);
    this.enemies.push({
      type: type, x: x, y: y, vx: 0, vy: 0, kx: 0, ky: 0,
      r: base.r, hp: Math.round(base.hp * hpMul), maxHp: Math.round(base.hp * hpMul),
      speed: base.speed * spMul * (0.85 + this.rng() * 0.4),
      damage: base.damage, score: base.score, xp: base.xp, color: base.color,
      phase: this.rng() * Math.PI * 2,
      mode: "stalk", modeT: 2 + this.rng() * 2.5, dashX: 0, dashY: 0,
      spawnIn: spawnIn === undefined ? 0.55 : spawnIn,
      flashT: 0,
    });
  }

  spawnSurge() {
    const n = 6 + this.wave;
    const p = this.player;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng() * 0.3;
      const x = clamp(p.x + Math.cos(a) * 350, 16, VB_W - 16);
      const y = clamp(p.y + Math.sin(a) * 350, 16, VB_H - 16);
      let type = "chaser";
      if (this.wave >= 4 && i % 5 === 4) type = "dasher";
      else if (this.wave >= 3 && i % 3 === 2) type = "weaver";
      this.spawnEnemy(type, x, y, 0.9);
    }
    this.banner = { text: "THE VOID SURGES", t: 1.8 };
  }

  tankBurst(e) {
    const n = 6 + Math.min(6, Math.floor(this.wave / 2));
    const off = this.rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      this.ebullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * 212, vy: Math.sin(a) * 212,
        r: 6, life: 3.4,
      });
    }
  }

  // ---------------- combat ----------------

  fireBullets() {
    const p = this.player;
    const n = p.projectiles;
    const baseA = Math.atan2(p.aimY, p.aimX);
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.085;
      const a = baseA + off;
      this.bullets.push({
        x: p.x + Math.cos(baseA) * (p.r + 6),
        y: p.y + Math.sin(baseA) * (p.r + 6),
        vx: Math.cos(a) * p.bulletSpeed,
        vy: Math.sin(a) * p.bulletSpeed,
        r: 4, dmg: p.damage, pierceLeft: p.pierce, life: 0.85,
      });
      this.stats.shots++;
    }
  }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = (0.25 + this.rng() * 0.75) * speed;
      this.parts.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0, maxLife: 0.35 + this.rng() * 0.4,
        size: 1.5 + this.rng() * 2.5, color: color,
      });
    }
  }

  addText(x, y, str, color) {
    this.texts.push({ x: x, y: y, vy: -46, life: 0, maxLife: 0.9, str: str, color: color });
  }

  killEnemy(e) {
    this.kills++;
    this.combo++;
    this.comboT = 2.2;
    const gained = Math.round(e.score * this.comboMul());
    this.score += gained;
    if (e.score >= 20 || this.combo % 10 === 0) {
      this.addText(e.x, e.y - 14, "+" + gained, e.color);
    }
    this.burst(e.x, e.y, e.color, e.type === "tank" ? 26 : 12, 260);
    for (let i = 0; i < e.xp; i++) {
      const a = this.rng() * Math.PI * 2;
      this.shards.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
        value: 1, r: 5,
      });
    }
    if (e.type === "tank") {
      for (let i = 0; i < 2; i++) {
        this.spawnEnemy("chaser", e.x + (this.rng() - 0.5) * 30, e.y + (this.rng() - 0.5) * 30, 0.3);
      }
      this.shakeT = Math.max(this.shakeT, 0.18);
    }
  }

  damagePlayer(dmg) {
    const p = this.player;
    if (p.invulnT > 0 || this.state !== "playing") return;
    if (p.shield && p.shieldReady) {
      p.shieldReady = false;
      p.shieldT = 10;
      p.invulnT = 0.9;
      this.burst(p.x, p.y, "#7dffce", 14, 220);
      this.addText(p.x, p.y - 24, "SHIELD DOWN", "#7dffce");
      return;
    }
    p.hp -= dmg;
    p.invulnT = 0.95;
    this.flashT = 0.25;
    this.shakeT = Math.max(this.shakeT, 0.28);
    this.combo = 0;
    this.burst(p.x, p.y, "#ff5d7a", 16, 280);
    if (p.hp <= 0) {
      p.hp = 0;
      this.state = "over";
      this.burst(p.x, p.y, "#ffe066", 60, 380);
      this.burst(p.x, p.y, "#ff4d6d", 40, 300);
    }
  }

  // ---------------- upgrades ----------------

  rollUpgrades() {
    const p = this.player;
    const pool = UPGRADES.filter(function (u) {
      if (u.id === "heal") return p.hp < p.maxHp;
      return (p.upCounts[u.id] || 0) < u.max;
    });
    const picks = [];
    const copy = pool.slice();
    while (picks.length < 3 && copy.length > 0) {
      const i = Math.floor(this.rng() * copy.length);
      picks.push(copy.splice(i, 1)[0]);
    }
    if (picks.length === 0) picks.push(UPGRADES[UPGRADES.length - 1]);
    this.pendingUpgrades = picks;
  }

  chooseUpgrade(i) {
    const p = this.player;
    const u = this.pendingUpgrades[i];
    if (!u || this.state !== "levelup") return;
    p.upCounts[u.id] = (p.upCounts[u.id] || 0) + 1;
    if (u.id === "rapid") p.fireInterval = Math.max(0.07, p.fireInterval * 0.85);
    else if (u.id === "damage") p.damage += 1;
    else if (u.id === "multishot") p.projectiles += 1;
    else if (u.id === "pierce") p.pierce += 1;
    else if (u.id === "speed") p.speed *= 1.08;
    else if (u.id === "magnet") p.magnetR *= 1.45;
    else if (u.id === "shield") { p.shield = true; p.shieldReady = true; p.shieldT = 0; }
    else if (u.id === "vitality") { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); }
    else if (u.id === "heal") p.hp = Math.min(p.maxHp, p.hp + 2);
    this.pendingUpgrades = [];
    if (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = xpNextFor(p.level);
      this.rollUpgrades();
      this.banner = { text: "LEVEL " + p.level, t: 1.4 };
    } else {
      this.state = "playing";
    }
  }

  gainXp(v) {
    const p = this.player;
    p.xp += v;
    if (p.xp >= p.xpNext && this.state === "playing") {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = xpNextFor(p.level);
      this.state = "levelup";
      this.rollUpgrades();
      this.banner = { text: "LEVEL " + p.level + " — CHOOSE A BLOOM", t: 1.6 };
    }
  }

  // ---------------- main step ----------------

  step(dt, input) {
    if (this.state !== "playing") return;
    const p = this.player;
    this.time += dt;

    // wave banner
    const w = Math.floor(this.time / 30) + 1;
    if (w !== this.wave) {
      this.wave = w;
      this.banner = { text: "WAVE " + w, t: 2.0 };
    }
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }

    // combo decay
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (p.invulnT > 0) p.invulnT -= dt;
    if (p.shield && !p.shieldReady) {
      p.shieldT -= dt;
      if (p.shieldT <= 0) { p.shieldReady = true; this.addText(p.x, p.y - 24, "SHIELD READY", "#7dffce"); }
    }

    // spawning
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT += this.spawnInterval();
      const pt = this.edgePoint();
      this.spawnEnemy(this.pickType(), pt.x, pt.y);
      // late-game packs: a few chasers arrive shoulder to shoulder
      if (this.time > 150 && this.rng() < 0.3) {
        const extra = 2 + Math.floor(this.rng() * 2);
        for (let k = 0; k < extra; k++) {
          this.spawnEnemy("chaser",
            clamp(pt.x + (this.rng() - 0.5) * 90, 10, VB_W - 10),
            clamp(pt.y + (this.rng() - 0.5) * 90, 10, VB_H - 10));
        }
      }
    }
    this.surgeT -= dt;
    if (this.surgeT <= 0) {
      this.surgeT = 34;
      this.spawnSurge();
    }

    // player movement
    let mx = input.mx || 0, my = input.my || 0;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const blend = 1 - Math.exp(-11 * dt);
    p.vx += (mx * p.speed - p.vx) * blend;
    p.vy += (my * p.speed - p.vy) * blend;
    p.x = clamp(p.x + p.vx * dt, p.r, VB_W - p.r);
    p.y = clamp(p.y + p.vy * dt, p.r, VB_H - p.r);

    // aim
    if (input.aimX !== undefined && input.aimX !== null) {
      const dx = input.aimX - p.x, dy = input.aimY - p.y;
      if (dx * dx + dy * dy > 4) {
        const d = Math.hypot(dx, dy);
        p.aimX = dx / d; p.aimY = dy / d;
      }
    } else if (ml > 0.1) {
      p.aimX = mx; p.aimY = my;
    }

    // firing
    p.fireT -= dt;
    if (input.firing && p.fireT <= 0) {
      p.fireT = Math.max(p.fireT + p.fireInterval, 0.001);
      this.fireBullets();
    }

    // bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > VB_W + 20 || b.y < -20 || b.y > VB_H + 20) {
        this.bullets.splice(i, 1);
      }
    }

    // enemies
    const speedScale = 1;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.flashT > 0) e.flashT -= dt;
      if (e.spawnIn > 0) { e.spawnIn -= dt; continue; }
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      let vx = 0, vy = 0;
      if (e.type === "chaser") {
        vx = ux * e.speed; vy = uy * e.speed;
      } else if (e.type === "weaver") {
        const s = Math.sin(this.time * 3.1 + e.phase) * 74;
        vx = ux * e.speed + (-uy) * s;
        vy = uy * e.speed + ux * s;
      } else if (e.type === "dasher") {
        e.modeT -= dt;
        if (e.mode === "stalk") {
          vx = ux * e.speed; vy = uy * e.speed;
          if (d < 320 && e.modeT <= 0) { e.mode = "aim"; e.modeT = 0.55; }
        } else if (e.mode === "aim") {
          vx = ux * e.speed * 0.25; vy = uy * e.speed * 0.25;
          if (e.modeT <= 0) {
            e.mode = "dash"; e.modeT = 0.32;
            e.dashX = ux; e.dashY = uy;
          }
        } else if (e.mode === "dash") {
          // slight homing so a dash stays dangerous, capped turn rate
          const cur = Math.atan2(e.dashY, e.dashX);
          const want = Math.atan2(uy, ux);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = clamp(diff, -1.15 * dt, 1.15 * dt);
          const na = cur + turn;
          e.dashX = Math.cos(na); e.dashY = Math.sin(na);
          vx = e.dashX * 600; vy = e.dashY * 600;
          if (e.modeT <= 0) { e.mode = "rest"; e.modeT = 0.95; }
        } else { // rest
          vx = ux * e.speed * 0.4; vy = uy * e.speed * 0.4;
          if (e.modeT <= 0) e.mode = "stalk";
        }
      } else { // tank: slow chase + periodic radial orb burst
        vx = ux * e.speed; vy = uy * e.speed;
        e.modeT -= dt;
        if (e.modeT <= 0) {
          e.modeT = 4.2;
          this.tankBurst(e);
        }
      }
      e.x += (vx + e.kx) * dt * speedScale;
      e.y += (vy + e.ky) * dt * speedScale;
      e.kx *= Math.exp(-7 * dt);
      e.ky *= Math.exp(-7 * dt);
      e.x = clamp(e.x, e.r * 0.5, VB_W - e.r * 0.5);
      e.y = clamp(e.y, e.r * 0.5, VB_H - e.r * 0.5);

      // touch player
      const rr = e.r + p.r - 2;
      if ((e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) < rr * rr) {
        this.damagePlayer(e.damage);
        // bounce the enemy back a little so one contact = one hit
        e.x -= ux * 26; e.y -= uy * 26;
        if (this.state !== "playing") return;
      }
    }

    // gentle separation so enemies do not fully stack
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.spawnIn > 0) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.spawnIn > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.r + b.r) * 0.82;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
        }
      }
    }

    // bullet vs enemy
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let consumed = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.spawnIn > 0) continue;
        const rr = e.r + b.r;
        if ((e.x - b.x) * (e.x - b.x) + (e.y - b.y) * (e.y - b.y) < rr * rr) {
          this.stats.hits++;
          e.hp -= b.dmg;
          e.flashT = 0.08;
          const kb = e.type === "tank" ? 26 : 95;
          const bl = Math.hypot(b.vx, b.vy) || 1;
          e.kx += (b.vx / bl) * kb;
          e.ky += (b.vy / bl) * kb;
          if (e.hp <= 0) {
            this.enemies.splice(j, 1);
            this.killEnemy(e);
          }
          if (b.pierceLeft > 0) { b.pierceLeft--; }
          else { consumed = true; }
          break;
        }
      }
      if (consumed) this.bullets.splice(i, 1);
    }

    // enemy orbs
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -16 || b.x > VB_W + 16 || b.y < -16 || b.y > VB_H + 16;
      if (!dead) {
        const rr = b.r + p.r - 2;
        if ((b.x - p.x) * (b.x - p.x) + (b.y - p.y) * (b.y - p.y) < rr * rr) {
          this.damagePlayer(1);
          dead = true;
          if (this.state !== "playing") return;
        }
      }
      if (dead) this.ebullets.splice(i, 1);
    }

    // shards
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      const dx = p.x - s.x, dy = p.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < p.magnetR) {
        s.vx += (dx / d) * 1500 * dt;
        s.vy += (dy / d) * 1500 * dt;
      }
      s.vx *= Math.exp(-2.2 * dt);
      s.vy *= Math.exp(-2.2 * dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (d < p.r + 11) {
        this.shards.splice(i, 1);
        this.gainXp(s.value);
        if (this.state !== "playing") {
          // level-up opened mid-step: finish particles below next frame
        }
      }
    }

    // particles & texts
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const pt = this.parts[i];
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.exp(-2.6 * dt);
      pt.vy *= Math.exp(-2.6 * dt);
      if (pt.life >= pt.maxLife) this.parts.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      t.y += t.vy * dt;
      if (t.life >= t.maxLife) this.texts.splice(i, 1);
    }
  }
}

// ---------------- bot + headless simulation ----------------

function botInput(g) {
  const p = g.player;
  let mx = 0, my = 0;
  let nearest = null, nd = Infinity;
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    if (e.spawnIn > 0) continue;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < nd) { nd = d2; nearest = e; }
    const R = 175;
    if (d2 < R * R) {
      const d = Math.sqrt(d2) || 1;
      const w = (1 - d / R) * 2.4;
      mx += (dx / d) * w;
      my += (dy / d) * w;
    }
  }
  let shard = null, sd = 320 * 320;
  for (let i = 0; i < g.shards.length; i++) {
    const s = g.shards[i];
    const dx = s.x - p.x, dy = s.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < sd) { sd = d2; shard = s; }
  }
  if (shard) {
    const d = Math.sqrt(sd) || 1;
    mx += ((shard.x - p.x) / d) * 0.55;
    my += ((shard.y - p.y) / d) * 0.55;
  }
  for (let i = 0; i < g.ebullets.length; i++) {
    const b = g.ebullets[i];
    const dx = p.x - b.x, dy = p.y - b.y;
    const d2 = dx * dx + dy * dy;
    const R = 115;
    if (d2 < R * R) {
      const d = Math.sqrt(d2) || 1;
      const w = (1 - d / R) * 1.6;
      mx += (dx / d) * w;
      my += (dy / d) * w;
    }
  }
  mx += ((VB_W / 2 - p.x) / VB_W) * 0.4;
  my += ((VB_H / 2 - p.y) / VB_H) * 0.4;
  // only fire when the target is inside bullet range (~560px of travel)
  const input = { mx: mx, my: my, firing: !!nearest && nd < 560 * 560, aimX: null, aimY: null };
  if (nearest) { input.aimX = nearest.x; input.aimY = nearest.y; }
  return input;
}

const BOT_PRIORITY = ["multishot", "damage", "rapid", "pierce", "shield", "vitality", "magnet", "speed", "heal"];

function botPickUpgrade(g) {
  let best = 0, bestRank = Infinity;
  for (let i = 0; i < g.pendingUpgrades.length; i++) {
    const rank = BOT_PRIORITY.indexOf(g.pendingUpgrades[i].id);
    if (rank >= 0 && rank < bestRank) { bestRank = rank; best = i; }
  }
  return best;
}

function runSimulation(seed, maxSeconds) {
  const g = new Game(seed);
  g.start();
  const dt = 1 / 60;
  const cap = Math.floor((maxSeconds || 600) * 60);
  let steps = 0;
  while (g.state !== "over" && steps < cap) {
    if (g.state === "levelup") { g.chooseUpgrade(botPickUpgrade(g)); continue; }
    g.step(dt, botInput(g));
    steps++;
  }
  return {
    seed: seed,
    survivedSec: Math.round(g.time * 100) / 100,
    wave: g.wave,
    kills: g.kills,
    score: g.score,
    level: g.player.level,
    shots: g.stats.shots,
    hits: g.stats.hits,
    hpLeft: Math.max(0, g.player.hp),
    enemiesLeft: g.enemies.length,
    ended: g.state,
  };
}

// ---------------- rendering (browser only) ----------------

function poly(ctx, x, y, r, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawGame(ctx, g, stars) {
  const p = g.player;
  ctx.save();
  if (g.shakeT > 0) {
    const s = g.shakeT * 22;
    ctx.translate(Math.sin(g.time * 91) * s, Math.cos(g.time * 83) * s);
  }
  // background
  const grad = ctx.createRadialGradient(VB_W / 2, VB_H / 2, 80, VB_W / 2, VB_H / 2, 780);
  grad.addColorStop(0, "#0a1030");
  grad.addColorStop(1, "#04050f");
  ctx.fillStyle = grad;
  ctx.fillRect(-30, -30, VB_W + 60, VB_H + 60);
  ctx.strokeStyle = "rgba(90,110,255,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= VB_W; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, VB_H); }
  for (let y = 0; y <= VB_H; y += 64) { ctx.moveTo(0, y); ctx.lineTo(VB_W, y); }
  ctx.stroke();
  ctx.fillStyle = "rgba(200,215,255,0.5)";
  for (let i = 0; i < stars.length; i++) {
    const st = stars[i];
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(g.time * 0.7 + st.p));
    ctx.globalAlpha = tw * st.a;
    ctx.fillRect((st.x - p.x * st.d + VB_W) % VB_W, (st.y - p.y * st.d + VB_H) % VB_H, st.s, st.s);
  }
  ctx.globalAlpha = 1;

  // shards
  for (let i = 0; i < g.shards.length; i++) {
    const s = g.shards[i];
    const pulse = 1 + Math.sin(g.time * 6 + s.x) * 0.15;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = "#ffe066";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffe066";
    const r = s.r * pulse;
    ctx.fillRect(-r / 1.6, -r / 1.6, r * 1.25, r * 1.25);
    ctx.restore();
  }

  // enemies
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.spawnIn > 0) {
      const k = 1 - Math.max(0, e.spawnIn) / 0.9;
      ctx.globalAlpha = 0.25 + 0.55 * k;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 12 * (1 - k), 0, Math.PI * 2);
      ctx.stroke();
    }
    const flash = e.flashT > 0;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = flash ? "#ffffff" : e.color;
    ctx.fillStyle = "rgba(6,8,24,0.9)";
    const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x);
    if (e.type === "chaser") {
      poly(ctx, 0, 0, e.r, 3, ang);
      ctx.fill(); ctx.stroke();
    } else if (e.type === "weaver") {
      poly(ctx, 0, 0, e.r, 4, g.time * 2.4 + e.phase);
      ctx.fill(); ctx.stroke();
    } else if (e.type === "dasher") {
      poly(ctx, 0, 0, e.r, 3, ang);
      ctx.fill(); ctx.stroke();
      if (e.mode === "aim") {
        ctx.rotate(-ang);
        ctx.setLineDash([6, 7]);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(77,216,255," + (0.35 + 0.4 * Math.abs(Math.sin(g.time * 16))) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.r + 2, 0);
        ctx.lineTo(300, 0);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else { // tank
      poly(ctx, 0, 0, e.r, 6, g.time * 0.5 + e.phase);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.62, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // enemy orbs
  ctx.save();
  for (let i = 0; i < g.ebullets.length; i++) {
    const b = g.ebullets[i];
    ctx.shadowColor = "#ff4dd2";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ff8ae6";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // bullets
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < g.bullets.length; i++) {
    const b = g.bullets[i];
    const bl = Math.hypot(b.vx, b.vy) || 1;
    const tx = (b.vx / bl) * 13, ty = (b.vy / bl) * 13;
    ctx.strokeStyle = "#a5ffef";
    ctx.shadowColor = "#3dffc8";
    ctx.shadowBlur = 9;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(b.x - tx, b.y - ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // particles
  for (let i = 0; i < g.parts.length; i++) {
    const pt = g.parts[i];
    const a = 1 - pt.life / pt.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * a + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // player
  if (g.state !== "over") {
    ctx.save();
    ctx.translate(p.x, p.y);
    const blink = p.invulnT > 0 && Math.sin(g.time * 34) > 0;
    ctx.globalAlpha = blink ? 0.35 : 1;
    if (p.shield && p.shieldReady) {
      ctx.strokeStyle = "rgba(125,255,206,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 8 + Math.sin(g.time * 3) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    const ang = Math.atan2(p.aimY, p.aimX);
    ctx.rotate(ang);
    // engine flame
    const fl = 8 + Math.sin(g.time * 31) * 3;
    ctx.fillStyle = "rgba(255,170,60,0.85)";
    ctx.beginPath();
    ctx.moveTo(-p.r - 1, 4.5);
    ctx.lineTo(-p.r - 1 - fl, 0);
    ctx.lineTo(-p.r - 1, -4.5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "#3dffc8";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#0b2d26";
    ctx.strokeStyle = "#3dffc8";
    ctx.lineWidth = 2.4;
    poly(ctx, 0, 0, p.r + 2, 3, 0);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d8fff3";
    ctx.beginPath();
    ctx.arc(2, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // floating texts
  ctx.save();
  ctx.font = "700 15px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < g.texts.length; i++) {
    const t = g.texts[i];
    ctx.globalAlpha = 1 - t.life / t.maxLife;
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
  }
  ctx.restore();

  // banner
  if (g.banner) {
    ctx.save();
    ctx.globalAlpha = clamp(g.banner.t / 0.6, 0, 1);
    ctx.font = "800 44px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "#7a5cff";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "#eef";
    ctx.fillText(g.banner.text, VB_W / 2, 120);
    ctx.restore();
  }

  // damage flash
  if (g.flashT > 0) {
    ctx.fillStyle = "rgba(255,40,70," + (g.flashT * 0.55) + ")";
    ctx.fillRect(-30, -30, VB_W + 60, VB_H + 60);
  }
  ctx.restore();
}

// ---------------- browser boot ----------------

function bootBrowser() {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const el = function (id) { return document.getElementById(id); };
  const hud = {
    hp: el("hud-hp"), hpText: el("hud-hp-text"), xp: el("hud-xp"),
    level: el("hud-level"), score: el("hud-score"), combo: el("hud-combo"),
    wave: el("hud-wave"), time: el("hud-time"),
  };
  const menuEl = el("menu"), overEl = el("gameover"), upEl = el("levelup");
  const cardsEl = el("cards");

  const stars = [];
  const srng = mulberry32(20261116);
  for (let i = 0; i < 130; i++) {
    stars.push({ x: srng() * VB_W, y: srng() * VB_H, s: srng() < 0.8 ? 1.6 : 2.6, a: 0.25 + srng() * 0.6, d: 0.01 + srng() * 0.03, p: srng() * 6 });
  }

  let game = new Game((Date.now() % 2147483647) + 1);
  VoidBloom.__bootGame = game; // handle for automated play-tests
  let paused = false;
  const keys = {};
  const mouse = { x: VB_W / 2 + 120, y: VB_H / 2, down: false };
  const touch = { active: false, ox: 0, oy: 0, mx: 0, my: 0 };

  function toGameCoords(ev) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * VB_W,
      y: ((ev.clientY - r.top) / r.height) * VB_H,
    };
  }

  window.addEventListener("keydown", function (ev) {
    keys[ev.key.toLowerCase()] = true;
    if (ev.key === " " || ev.key.indexOf("Arrow") === 0) ev.preventDefault();
    if (game.state === "levelup") {
      if (ev.key === "1" || ev.key === "2" || ev.key === "3") {
        game.chooseUpgrade(Number(ev.key) - 1);
        syncOverlays();
      }
    } else if (game.state === "menu" && (ev.key === "Enter" || ev.key === " ")) {
      startRun();
    } else if (game.state === "over" && (ev.key === "Enter" || ev.key.toLowerCase() === "r")) {
      startRun();
    } else if (ev.key.toLowerCase() === "p" || ev.key === "Escape") {
      if (game.state === "playing") paused = !paused;
    }
  });
  window.addEventListener("keyup", function (ev) { keys[ev.key.toLowerCase()] = false; });
  canvas.addEventListener("mousemove", function (ev) {
    const c = toGameCoords(ev); mouse.x = c.x; mouse.y = c.y;
  });
  canvas.addEventListener("mousedown", function (ev) { mouse.down = true; const c = toGameCoords(ev); mouse.x = c.x; mouse.y = c.y; });
  window.addEventListener("mouseup", function () { mouse.down = false; });
  canvas.addEventListener("touchstart", function (ev) {
    ev.preventDefault();
    const t = ev.changedTouches[0];
    const c = toGameCoords(t);
    touch.active = true; touch.ox = c.x; touch.oy = c.y; touch.mx = 0; touch.my = 0;
  }, { passive: false });
  canvas.addEventListener("touchmove", function (ev) {
    ev.preventDefault();
    if (!touch.active) return;
    const c = toGameCoords(ev.changedTouches[0]);
    touch.mx = clamp((c.x - touch.ox) / 46, -1, 1);
    touch.my = clamp((c.y - touch.oy) / 46, -1, 1);
  }, { passive: false });
  canvas.addEventListener("touchend", function (ev) {
    ev.preventDefault();
    touch.active = false; touch.mx = 0; touch.my = 0;
  }, { passive: false });
  window.addEventListener("blur", function () { if (game.state === "playing") paused = true; });

  el("btn-start").addEventListener("click", startRun);
  el("btn-again").addEventListener("click", startRun);

  function startRun() {
    game = new Game((Date.now() % 2147483647) + 1);
    VoidBloom.__bootGame = game;
    game.start();
    paused = false;
    syncOverlays();
  }

  function currentInput() {
    let mx = 0, my = 0;
    if (keys["a"] || keys["arrowleft"]) mx -= 1;
    if (keys["d"] || keys["arrowright"]) mx += 1;
    if (keys["w"] || keys["arrowup"]) my -= 1;
    if (keys["s"] || keys["arrowdown"]) my += 1;
    if (touch.active) { mx = touch.mx; my = touch.my; }
    let aimX = mouse.x, aimY = mouse.y, firing = mouse.down || !!keys[" "];
    if (touch.active) {
      // touch play: auto-aim at the nearest active enemy and auto-fire
      let best = null, bd = Infinity;
      for (let i = 0; i < game.enemies.length; i++) {
        const e = game.enemies[i];
        if (e.spawnIn > 0) continue;
        const d = (e.x - game.player.x) ** 2 + (e.y - game.player.y) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) { aimX = best.x; aimY = best.y; firing = true; }
      else firing = false;
    }
    return { mx: mx, my: my, aimX: aimX, aimY: aimY, firing: firing };
  }

  let lastState = "";
  function syncOverlays() {
    const s = game.state;
    menuEl.style.display = s === "menu" ? "flex" : "none";
    overEl.style.display = s === "over" ? "flex" : "none";
    upEl.style.display = s === "levelup" ? "flex" : "none";
    if (s === "over" && lastState !== "over") {
      el("final-stats").textContent =
        "Score " + game.score + " · Wave " + game.wave + " · " + game.kills +
        " kills · Level " + game.player.level + " · Survived " + fmtTime(game.time);
    }
    if (s === "levelup" && lastState !== "levelup") {
      cardsEl.innerHTML = "";
      game.pendingUpgrades.forEach(function (u, i) {
        const card = document.createElement("button");
        card.className = "card";
        card.innerHTML = "<span class='card-key'>" + (i + 1) + "</span><strong>" +
          u.name + "</strong><span>" + u.desc + "</span>";
        card.addEventListener("click", function () {
          game.chooseUpgrade(i);
          lastState = "";
          syncOverlays();
        });
        cardsEl.appendChild(card);
      });
    }
    lastState = s;
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function syncHud() {
    const p = game.player;
    hud.hp.style.width = (100 * Math.max(0, p.hp) / p.maxHp) + "%";
    hud.hpText.textContent = "HP " + Math.max(0, p.hp) + "/" + p.maxHp +
      (p.shield ? (p.shieldReady ? " · SHIELD" : " · shield " + Math.ceil(p.shieldT) + "s") : "");
    hud.xp.style.width = (100 * p.xp / p.xpNext) + "%";
    hud.level.textContent = "LV " + p.level;
    hud.score.textContent = String(game.score);
    hud.combo.textContent = game.combo >= 2 ? "COMBO x" + game.comboMul().toFixed(1) + " (" + game.combo + ")" : "";
    hud.wave.textContent = "WAVE " + game.wave;
    hud.time.textContent = fmtTime(game.time);
  }

  // Simulation page mode: auto-play with the bot and publish the results.
  if (window.__MAKEFUN_SIM__) {
    const cfg = window.__MAKEFUN_SIM__;
    const results = [];
    const seeds = cfg.seeds || [1337];
    for (let i = 0; i < seeds.length; i++) results.push(runSimulation(seeds[i], cfg.maxSeconds || 300));
    const report = document.getElementById("sim-report");
    if (report) report.textContent = JSON.stringify(results, null, 2);
    document.title = "VOID BLOOM — SIM DONE";
    // leave one simulated game on screen mid-action for screenshots
    game = new Game(seeds[0]);
    VoidBloom.__bootGame = game;
    game.start();
    for (let i = 0; i < 60 * 45; i++) game.step(1 / 60, botInput(game));
  }

  let last = performance.now(), acc = 0;
  const STEP = 1000 / 60;
  function frame(now) {
    requestAnimationFrame(frame);
    let delta = now - last;
    last = now;
    if (delta > 250) delta = 250;
    acc += delta;
    let n = 0;
    while (acc >= STEP && n < 5) {
      if (!paused && game.state === "playing") game.step(1 / 60, currentInput());
      acc -= STEP;
      n++;
    }
    if (n === 5) acc = 0;
    drawGame(ctx, game, stars);
    syncHud();
    syncOverlays();
    if (paused && game.state === "playing") {
      ctx.save();
      ctx.fillStyle = "rgba(3,4,12,0.55)";
      ctx.fillRect(0, 0, VB_W, VB_H);
      ctx.fillStyle = "#eef";
      ctx.font = "800 40px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED — P to resume", VB_W / 2, VB_H / 2);
      ctx.restore();
    }
  }
  syncOverlays();
  requestAnimationFrame(frame);
}

const VoidBloom = {
  Game: Game,
  runSimulation: runSimulation,
  botInput: botInput,
  botPickUpgrade: botPickUpgrade,
  W: VB_W,
  H: VB_H,
  UPGRADES: UPGRADES,
  ENEMY_TYPES: ENEMY_TYPES,
};

if (typeof window !== "undefined") {
  window.VoidBloom = VoidBloom;
  if (window.document) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootBrowser);
    } else {
      bootBrowser();
    }
  }
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = VoidBloom;
}
