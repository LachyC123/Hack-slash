// ===========================
// Sprite Fighter (GitHub Pages)
// Works with your itch.io sprite sheet:
// - 7 columns (frames)
// - 11 rows (different ACTIONS)
// IMPORTANT: Use the ORIGINAL PNG from itch.io (not a screenshot/jpeg),
// so the sheet is exactly 350x407 -> 50x37 per frame.
// Put it here: assets/character.png
// ===========================

const SHEET_SRC = "assets/character.png";

// Layout (from your pack)
const COLS = 7;
const ROWS = 11;

// If your PNG is 350x407, these are correct:
const FRAME_W = 50;
const FRAME_H = 37;

// Row mapping (based on your uploaded sheet)
const ANIM_ROW = {
  idle: 0,   // standing idle
  run:  1,   // run cycle
  punch: 6,  // quick punch row (change to 7 if you prefer the slash row)
  slide: 9,  // slide/dash
};

// ---------------- Canvas ----------------
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

function resize(){
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// ---------------- Input ----------------
const keys = new Set();
addEventListener("keydown", (e)=>{
  keys.add(e.key.toLowerCase());
  if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase())) e.preventDefault();
});
addEventListener("keyup", (e)=> keys.delete(e.key.toLowerCase()));
function down(k){ return keys.has(k); }

// Mobile buttons
let mobilePunch = false, mobileSlide = false;
function bindButton(id, setter){
  const el = document.getElementById(id);
  const on = (e)=>{ e.preventDefault(); setter(true); };
  const off = (e)=>{ e.preventDefault(); setter(false); };
  el.addEventListener("pointerdown", on);
  el.addEventListener("pointerup", off);
  el.addEventListener("pointercancel", off);
  el.addEventListener("pointerleave", off);
}
bindButton("btnPunch", v=>mobilePunch=v);
bindButton("btnSlide", v=>mobileSlide=v);

// ---------------- Load sprite ----------------
function loadImage(src){
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// ---------------- Player ----------------
const FPS = { idle: 6, run: 12, punch: 16, slide: 14 };

const player = {
  x: innerWidth/2,
  y: innerHeight/2,
  speed: 240,
  state: "idle",
  frame: 0,
  t: 0,
  locked: false,
  facing: 1, // 1 = right, -1 = left
};

function setState(next){
  if (player.locked && next !== player.state) return;
  if (player.state === next) return;
  player.state = next;
  player.frame = 0;
  player.t = 0;
  player.locked = (next === "punch" || next === "slide");
}

function update(dt){
  let mx=0, my=0;
  if (down("a") || down("arrowleft")) mx -= 1;
  if (down("d") || down("arrowright")) mx += 1;
  if (down("w") || down("arrowup")) my -= 1;
  if (down("s") || down("arrowdown")) my += 1;

  const len = Math.hypot(mx,my);
  if (len>0){ mx/=len; my/=len; }

  // Facing based on horizontal input
  if (mx > 0.01) player.facing = 1;
  if (mx < -0.01) player.facing = -1;

  const wantPunch = down("j") || mobilePunch;
  const wantSlide = down("shift") || mobileSlide;

  if (wantPunch) setState("punch");
  else if (wantSlide) setState("slide");
  else if (!player.locked) setState(len>0 ? "run" : "idle");

  // Move (slow during punch, faster during slide)
  let spd = player.speed;
  if (player.state === "punch") spd *= 0.5;
  if (player.state === "slide") spd *= 1.35;

  player.x += mx * spd * dt;
  player.y += my * spd * dt;

  player.x = clamp(player.x, FRAME_W/2, innerWidth - FRAME_W/2);
  player.y = clamp(player.y, FRAME_H/2, innerHeight - FRAME_H/2);

  // Animate
  const fps = FPS[player.state] || 10;
  const spf = 1 / fps;

  player.t += dt;
  while (player.t >= spf){
    player.t -= spf;
    player.frame++;

    if (player.frame >= COLS){
      if (player.locked){
        player.locked = false;
        setState(len>0 ? "run" : "idle");
      } else {
        player.frame = 0;
      }
    }
  }
}

function drawBackground(){
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0,0,innerWidth,innerHeight);

  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = "#ffffff";
  const size = 40;
  for (let x=0;x<innerWidth;x+=size){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,innerHeight); ctx.stroke(); }
  for (let y=0;y<innerHeight;y+=size){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(innerWidth,y); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

function draw(sheet){
  ctx.clearRect(0,0,innerWidth,innerHeight);
  drawBackground();

  ctx.imageSmoothingEnabled = false;

  const row = ANIM_ROW[player.state] ?? 0;
  const sx = player.frame * FRAME_W;
  const sy = row * FRAME_H;

  const dx = Math.floor(player.x);
  const dy = Math.floor(player.y);

  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(player.facing, 1);

  ctx.drawImage(sheet, sx, sy, FRAME_W, FRAME_H, -FRAME_W/2, -FRAME_H/2, FRAME_W, FRAME_H);

  ctx.restore();

  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "12px system-ui";
  ctx.fillText(`state:${player.state} frame:${player.frame} row:${row}`, 10, 18);
}

let last = performance.now();
function loop(now, sheet){
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;
  update(dt);
  draw(sheet);
  requestAnimationFrame((t)=>loop(t, sheet));
}

(async function boot(){
  try{
    const sheet = await loadImage(SHEET_SRC);
    requestAnimationFrame((t)=>loop(t, sheet));
  }catch(e){
    console.error(e);
    alert(
      "Couldn't load assets/character.png\n\n" +
      "Make sure you:\n" +
      "1) created an assets folder\n" +
      "2) put your ORIGINAL PNG in there\n" +
      "3) named it character.png"
    );
  }
})();
