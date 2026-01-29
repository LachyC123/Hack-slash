// Sprite Fighter + Goblin Enemies (v2)
// - Player Attack uses correct row (swap punch/sword easily)
// - Goblins play attack animation and only damage during the swing

const PLAYER = {
  src: "assets/player.png",
  cols: 7, rows: 11,
  frameW: 50, frameH: 37,

  // If your player is using the wrong attack row, swap 6 <-> 7 here.
  // row 6 is often punch, row 7 often sword slash.
  row: { idle: 0, run: 1, attack: 6, slide: 9 },

  fps: { idle: 6, run: 12, attack: 16, slide: 14 },
};

const GOBLIN = {
  src: "assets/goblin.png",
  cols: 12, rows: 6,
  frameW: null, frameH: null, // computed
  row: { walk: 1, attack: 3, death: 5 },
  fps: { walk: 12, attack: 16, death: 10 },
};

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

function resize() {
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

// HUD
const hpEl = document.getElementById("hp");
const scoreEl = document.getElementById("score");
const waveEl = document.getElementById("wave");

// Keyboard
const keys = new Set();
addEventListener("keydown", e => keys.add(e.key.toLowerCase()));
addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
function down(k) { return keys.has(k); }

// Buttons
let mobileAttack = false, mobileSlide = false;
function bindButton(id, setter) {
  const el = document.getElementById(id);
  const on = (e) => { e.preventDefault(); setter(true); };
  const off = (e) => { e.preventDefault(); setter(false); };
  el.addEventListener("pointerdown", on);
  el.addEventListener("pointerup", off);
  el.addEventListener("pointercancel", off);
  el.addEventListener("pointerleave", off);
}
bindButton("btnAttack", v => mobileAttack = v);
bindButton("btnSlide", v => mobileSlide = v);

// Joystick
const joy = document.getElementById("joy");
const stick = document.getElementById("joyStick");
const joyState = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0, r: 55 };
function setStick(px, py) { stick.style.transform = `translate(${px}px, ${py}px)`; }
function resetJoy() { joyState.active = false; joyState.id = null; joyState.dx = 0; joyState.dy = 0; setStick(0, 0); }

joy.addEventListener("pointerdown", e => {
  e.preventDefault();
  joyState.active = true; joyState.id = e.pointerId;
  const r = joy.getBoundingClientRect();
  joyState.cx = r.left + r.width / 2;
  joyState.cy = r.top + r.height / 2;
  joy.setPointerCapture(e.pointerId);
});
joy.addEventListener("pointermove", e => {
  if (!joyState.active || e.pointerId !== joyState.id) return;
  const dx = e.clientX - joyState.cx, dy = e.clientY - joyState.cy;
  const d = Math.hypot(dx, dy), max = joyState.r;
  const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 0;
  const cl = Math.min(d, max);
  const px = nx * cl, py = ny * cl;
  setStick(px, py);
  joyState.dx = px / max; joyState.dy = py / max;
});
joy.addEventListener("pointerup", e => { if (e.pointerId === joyState.id) resetJoy(); });
joy.addEventListener("pointercancel", e => { if (e.pointerId === joyState.id) resetJoy(); });

// Loading
function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}
let pImg, gImg;

// State
let hp = 100, score = 0, wave = 1;

const player = {
  x: innerWidth / 2,
  y: innerHeight / 2,
  speed: 250,
  state: "idle",
  frame: 0,
  t: 0,
  locked: false,
  facing: 1,
  inv: 0,
  atkDidHit: false,
};

function setPState(s) {
  if (player.locked && s !== player.state) return;
  if (player.state === s) return;
  player.state = s;
  player.frame = 0;
  player.t = 0;
  player.locked = (s === "attack" || s === "slide");
  if (s === "attack") player.atkDidHit = false;
}

const goblins = [];

function spawnGoblin() {
  const m = 60;
  const side = (Math.random() * 4) | 0;
  let x, y;
  if (side === 0) { x = -m; y = rand(0, innerHeight); }
  if (side === 1) { x = innerWidth + m; y = rand(0, innerHeight); }
  if (side === 2) { x = rand(0, innerWidth); y = -m; }
  if (side === 3) { x = rand(0, innerWidth); y = innerHeight + m; }

  goblins.push({
    x, y,
    speed: rand(85, 120) + wave * 2,
    hp: 2 + Math.floor(wave / 2),
    state: "walk",
    frame: 0,
    t: 0,
    facing: 1,
    dying: false,

    atkCd: rand(0.2, 0.6),
    atkWind: 0,
    didDamage: false,
  });
}

function startWave(n) {
  wave = n; waveEl.textContent = String(wave);
  const count = 4 + wave * 2;
  for (let i = 0; i < count; i++) spawnGoblin();
}

// Combat
function playerAttackHit() {
  const range = 48;
  const ax = player.x + player.facing * 20;
  const ay = player.y;
  const r2 = range * range;

  for (const g of goblins) {
    if (g.dying) continue;
    if (dist2(ax, ay, g.x, g.y) <= r2) {
      g.hp -= 1;
      if (g.hp <= 0) {
        g.dying = true;
        g.state = "death"; g.frame = 0; g.t = 0;
        score += 10;
        scoreEl.textContent = String(score);
      }
    }
  }
}

function updatePlayer(dt) {
  if (player.inv > 0) player.inv -= dt;

  let mx = 0, my = 0, moving = false;
  if (joyState.active && (Math.abs(joyState.dx) > 0.02 || Math.abs(joyState.dy) > 0.02)) {
    mx = joyState.dx; my = joyState.dy; moving = true;
    const l = Math.hypot(mx, my); mx /= l; my /= l;
  } else {
    if (down("a") || down("arrowleft")) mx -= 1;
    if (down("d") || down("arrowright")) mx += 1;
    if (down("w") || down("arrowup")) my -= 1;
    if (down("s") || down("arrowdown")) my += 1;
    const l = Math.hypot(mx, my);
    if (l > 0) { mx /= l; my /= l; moving = true; }
  }

  if (mx > 0.01) player.facing = 1;
  if (mx < -0.01) player.facing = -1;

  const wantAttack = down("j") || mobileAttack;
  const wantSlide = down("shift") || mobileSlide;

  if (wantAttack) setPState("attack");
  else if (wantSlide) setPState("slide");
  else if (!player.locked) setPState(moving ? "run" : "idle");

  let spd = player.speed;
  if (player.state === "attack") spd *= 0.55;
  if (player.state === "slide") spd *= 1.35;

  player.x += mx * spd * dt;
  player.y += my * spd * dt;
  player.x = clamp(player.x, PLAYER.frameW / 2, innerWidth - PLAYER.frameW / 2);
  player.y = clamp(player.y, PLAYER.frameH / 2, innerHeight - PLAYER.frameH / 2);

  const fps = PLAYER.fps[player.state] ?? 10;
  const spf = 1 / fps;
  player.t += dt;

  while (player.t >= spf) {
    player.t -= spf;
    player.frame++;

    // hit once per attack, after a tiny wind-up (~3 frames)
    if (player.state === "attack" && !player.atkDidHit && player.frame >= 3) {
      playerAttackHit();
      player.atkDidHit = true;
    }

    if (player.frame >= PLAYER.cols) {
      if (player.locked) {
        player.locked = false;
        setPState(moving ? "run" : "idle");
      } else {
        player.frame = 0;
      }
    }
  }
}

function updateGoblins(dt) {
  for (const g of goblins) {
    if (g.dying) {
      const fps = GOBLIN.fps.death;
      const spf = 1 / fps;
      g.t += dt;
      while (g.t >= spf) {
        g.t -= spf;
        g.frame++;
        if (g.frame >= GOBLIN.cols) g.frame = GOBLIN.cols - 1;
      }
      continue;
    }

    const dx = player.x - g.x;
    const dy = player.y - g.y;
    const d = Math.hypot(dx, dy) || 1;
    const mx = dx / d;
    const my = dy / d;

    g.facing = (mx >= 0) ? 1 : -1;

    const attackRange = 28;
    const inRange = dist2(player.x, player.y, g.x, g.y) <= attackRange * attackRange;

    if (g.state !== "attack") {
      g.atkCd -= dt;

      if (inRange && g.atkCd <= 0) {
        g.state = "attack";
        g.frame = 0; g.t = 0;
        g.didDamage = false;
        g.atkWind = 0.10; // small wind-up before damage
      } else {
        g.state = "walk";
        g.x += mx * g.speed * dt;
        g.y += my * g.speed * dt;
      }
    } else {
      // wind-up then apply damage once if still close
      g.atkWind -= dt;

      if (!g.didDamage && g.atkWind <= 0) {
        const dmgRange = 34;
        if (dist2(player.x, player.y, g.x, g.y) <= dmgRange * dmgRange) {
          if (player.inv <= 0) {
            hp = Math.max(0, hp - 10);
            hpEl.textContent = String(hp);
            player.inv = 0.55;
          }
        }
        g.didDamage = true;
      }
    }

    // Animate goblin
    const fps = (g.state === "attack") ? GOBLIN.fps.attack : GOBLIN.fps.walk;
    const spf = 1 / fps;
    g.t += dt;
    while (g.t >= spf) {
      g.t -= spf;
      g.frame++;
      if (g.frame >= GOBLIN.cols) {
        if (g.state === "attack") {
          // finish attack -> cooldown
          g.state = "walk";
          g.atkCd = rand(0.6, 1.1);
          g.didDamage = false;
        }
        g.frame = 0;
      }
    }
  }

  // next wave once all are dead (dying)
  if (goblins.length > 0 && goblins.every(e => e.dying) && hp > 0) {
    startWave(wave + 1);
  }
}

function drawBackground() {
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, innerWidth, innerHeight);
}

function drawSprite(img, sheet, x, y, state, frame, facing) {
  const row = sheet.row[state] ?? sheet.row.walk ?? 0;
  const sx = frame * sheet.frameW;
  const sy = row * sheet.frameH;

  ctx.save();
  ctx.translate(x | 0, y | 0);
  ctx.scale(facing, 1);
  ctx.drawImage(img, sx, sy, sheet.frameW, sheet.frameH, -sheet.frameW / 2, -sheet.frameH / 2, sheet.frameW, sheet.frameH);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  drawBackground();
  ctx.imageSmoothingEnabled = false;

  // goblins
  for (const g of goblins) {
    const s = g.dying ? "death" : (g.state === "attack" ? "attack" : "walk");
    drawSprite(gImg, GOBLIN, g.x, g.y, s, g.frame, g.facing);
  }

  // player (blink when invuln)
  const blink = player.inv > 0 && (Math.floor(performance.now() / 80) % 2 === 0);
  if (!blink) {
    drawSprite(pImg, PLAYER, player.x, player.y, player.state, player.frame, player.facing);
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (hp > 0) {
    updatePlayer(dt);
    updateGoblins(dt);
  }
  draw();
  requestAnimationFrame(loop);
}

(async function boot() {
  try {
    [pImg, gImg] = await Promise.all([loadImage(PLAYER.src), loadImage(GOBLIN.src)]);
    GOBLIN.frameW = gImg.width / GOBLIN.cols;
    GOBLIN.frameH = gImg.height / GOBLIN.rows;
    startWave(1);
    requestAnimationFrame(loop);
  } catch (e) {
    console.error(e);
    alert("Missing sprites. Put Adventurer in assets/player.png and Goblin in assets/goblin.png");
  }
})();
