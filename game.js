// ===========================
// Sprite Fighter (GitHub Pages) + Mobile Joystick
// Sprite sheet: 7 cols x 11 rows, 350x407 px => frame 50x37
// Put your original sprite sheet here: assets/character.png
// ===========================

const SHEET_SRC = "assets/character.png";
const COLS = 7;
const ROWS = 11;
const FRAME_W = 50;
const FRAME_H = 37;

// Row mapping (your sheet)
const ANIM_ROW = {
  idle: 0,
  run:  1,
  punch: 6, // change to 7 if you prefer slash row
  slide: 9,
};

const FPS = { idle: 6, run: 12, punch: 16, slide: 14 };

// Canvas
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

// Keyboard
const keys = new Set();
addEventListener("keydown", (e)=>{
  keys.add(e.key.toLowerCase());
  if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase())) e.preventDefault();
});
addEventListener("keyup", (e)=> keys.delete(e.key.toLowerCase()));
function down(k){ return keys.has(k); }

// Buttons
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

// Joystick
const joy = document.getElementById("joy");
const joyStick = document.getElementById("joyStick");

const joystick = {
  active: false,
  pointerId: null,
  centerX: 0,
  centerY: 0,
  dx: 0,
  dy: 0,
  radius: 55
};

function setStickVisual(px, py){
  joyStick.style.transform = `translate(${px}px, ${py}px)`;
}
function resetJoystick(){
  joystick.active = false;
  joystick.pointerId = null;
  joystick.dx = 0;
  joystick.dy = 0;
  setStickVisual(0,0);
}

joy.addEventListener("pointerdown", (e)=>{
  e.preventDefault();
  joystick.active = true;
  joystick.pointerId = e.pointerId;
  const rect = joy.getBoundingClientRect();
  joystick.centerX = rect.left + rect.width/2;
  joystick.centerY = rect.top + rect.height/2;
  joy.setPointerCapture(e.pointerId);
});

joy.addEventListener("pointermove", (e)=>{
  if (!joystick.active || e.pointerId !== joystick.pointerId) return;

  const dx = e.clientX - joystick.centerX;
  const dy = e.clientY - joystick.centerY;

  const dist = Math.hypot(dx, dy);
  const max = joystick.radius;

  const nx = dist > 1e-6 ? dx / dist : 0;
  const ny = dist > 1e-6 ? dy / dist : 0;

  const clamped = Math.min(dist, max);
  const px = nx * clamped;
  const py = ny * clamped;

  setStickVisual(px, py);

  joystick.dx = px / max;
  joystick.dy = py / max;
});

joy.addEventListener("pointerup", (e)=>{ if (e.pointerId === joystick.pointerId) resetJoystick(); });
joy.addEventListener("pointercancel", (e)=>{ if (e.pointerId === joystick.pointerId) resetJoystick(); });

// Loading
function loadImage(src){
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// Player
const player = {
  x: innerWidth/2,
  y: innerHeight/2,
  speed: 240,
  state: "idle",
  frame: 0,
  t: 0,
  locked: false,
  facing: 1
};

function setState(next){
  if (player.locked && next !== player.state) return;
  if (player.state === next) return;
  player.state = next;
  player.frame = 0;
  player.t = 0;
  player.locked = (next === "punch" || next === "slide");
}

function getMoveVector(){
  // Joystick takes priority if being used
  if (joystick.active && (Math.abs(joystick.dx) > 0.02 || Math.abs(joystick.dy) > 0.02)){
    let mx = joystick.dx, my = joystick.dy;
    const len = Math.hypot(mx,my);
    if (len > 1e-6){ mx/=len; my/=len; }
    return {mx, my, moving: true};
  }

  // Keyboard fallback
  let mx=0,my=0;
  if (down("a") || down("arrowleft")) mx -= 1;
  if (down("d") || down("arrowright")) mx += 1;
  if (down("w") || down("arrowup")) my -= 1;
  if (down("s") || down("arrowdown")) my += 1;
  const len = Math.hypot(mx,my);
  if (len>0){ mx/=len; my/=len; }
  return {mx, my, moving: len>0};
}

function update(dt){
  const mv = getMoveVector();
  const mx = mv.mx, my = mv.my;
  const moving = mv.moving;

  if (mx > 0.01) player.facing = 1;
  if (mx < -0.01) player.facing = -1;

  const wantPunch = down("j") || mobilePunch;
  const wantSlide = down("shift") || mobileSlide;

  if (wantPunch) setState("punch");
  else if (wantSlide) setState("slide");
  else if (!player.locked) setState(moving ? "run" : "idle");

  let spd = player.speed;
  if (player.state === "punch") spd *= 0.5;
  if (player.state === "slide") spd *= 1.35;

  player.x += mx * spd * dt;
  player.y += my * spd * dt;

  player.x = clamp(player.x, FRAME_W/2, innerWidth - FRAME_W/2);
  player.y = clamp(player.y, FRAME_H/2, innerHeight - FRAME_H/2);

  const fps = FPS[player.state] || 10;
  const spf = 1/fps;

  player.t += dt;
  while (player.t >= spf){
    player.t -= spf;
    player.frame++;

    if (player.frame >= COLS){
      if (player.locked){
        player.locked = false;
        setState(moving ? "run" : "idle");
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
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "12px system-ui";
  ctx.fillText(`state:${player.state}`, 10, 18);
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
    alert("Couldn't load assets/character.png — upload your original sprite sheet there.");
  }
})();
