// Sprite Fighter (Goblins v2)
// Fixes:
// 1) Player punch uses the correct punch row (row 6 on your Adventurer sheet).
// 2) Goblins do real sword attacks: they stop, play attack anim, and only damage on the strike frame.

const PLAYER = {
  src: "assets/player.png",
  cols: 7, rows: 11,
  frameW: 50, frameH: 37,
  row: { idle: 0, run: 1, punch: 6, slide: 9 },
  fps: { idle: 6, run: 12, punch: 16, slide: 14 },
};

const ENEMY = {
  src: "assets/goblin.png",
  cols: 12, rows: 6,
  frameW: null, frameH: null,
  row: { walk: 1, attack: 3, death: 5, hit: 3 },
  fps: { walk: 12, attack: 16, death: 10, hit: 16 },
};

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
function rand(a,b){ return a + Math.random()*(b-a); }
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }

const hpEl = document.getElementById("hp");
const scoreEl = document.getElementById("score");
const waveEl = document.getElementById("wave");

// Desktop keys (optional)
const keys = new Set();
addEventListener("keydown", (e)=> keys.add(e.key.toLowerCase()));
addEventListener("keyup", (e)=> keys.delete(e.key.toLowerCase()));
function down(k){ return keys.has(k); }

// Buttons
let mobilePunch=false, mobileSlide=false;
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
const stick = document.getElementById("joyStick");
const joyState = { active:false, id:null, cx:0, cy:0, dx:0, dy:0, r:55 };

function setStick(px,py){ stick.style.transform = `translate(${px}px, ${py}px)`; }
function resetJoy(){ joyState.active=false; joyState.id=null; joyState.dx=0; joyState.dy=0; setStick(0,0); }

joy.addEventListener("pointerdown", (e)=>{
  e.preventDefault();
  joyState.active=true;
  joyState.id=e.pointerId;
  const r = joy.getBoundingClientRect();
  joyState.cx = r.left + r.width/2;
  joyState.cy = r.top + r.height/2;
  joy.setPointerCapture(e.pointerId);
});
joy.addEventListener("pointermove", (e)=>{
  if(!joyState.active || e.pointerId !== joyState.id) return;
  const dx = e.clientX - joyState.cx;
  const dy = e.clientY - joyState.cy;
  const d = Math.hypot(dx,dy);
  const max = joyState.r;
  const nx = d > 1e-6 ? dx/d : 0;
  const ny = d > 1e-6 ? dy/d : 0;
  const cl = Math.min(d, max);
  const px = nx * cl, py = ny * cl;
  setStick(px,py);
  joyState.dx = px/max;
  joyState.dy = py/max;
});
joy.addEventListener("pointerup", (e)=>{ if(e.pointerId===joyState.id) resetJoy(); });
joy.addEventListener("pointercancel", (e)=>{ if(e.pointerId===joyState.id) resetJoy(); });

// Loading
function loadImage(src){
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = rej;
    img.src = src;
  });
}

let pImg, gImg;

// Game state
let hp = 100, score = 0, wave = 1;

const player = {
  x: innerWidth/2,
  y: innerHeight/2,
  speed: 250,
  state: "idle",
  frame: 0,
  t: 0,
  locked: false,
  facing: 1,
  inv: 0,
  didHit: false,
};

function setPState(next){
  if (player.locked && next !== player.state) return;
  if (player.state === next) return;
  player.state = next;
  player.frame = 0;
  player.t = 0;
  player.locked = (next === "punch" || next === "slide");
  if (next === "punch") player.didHit = false;
}

const goblins = [];

function spawnGoblin(){
  const m = 60;
  const side = (Math.random()*4)|0;
  let x,y;
  if(side===0){ x=-m; y=rand(0,innerHeight); }
  if(side===1){ x=innerWidth+m; y=rand(0,innerHeight); }
  if(side===2){ x=rand(0,innerWidth); y=-m; }
  if(side===3){ x=rand(0,innerWidth); y=innerHeight+m; }

  goblins.push({
    x,y,
    speed: rand(85,120) + wave*2,
    hp: 2 + Math.floor(wave/2),
    state: "walk",   // walk | attack | hit | death
    frame: 0,
    t: 0,
    facing: 1,
    dying: false,
    attackCooldown: rand(0.1, 0.6),
    didDamageThisAttack: false,
    hitStun: 0,
  });
}

function startWave(n){
  wave = n;
  waveEl.textContent = String(wave);
  const count = 4 + wave*2;
  for(let i=0;i<count;i++) spawnGoblin();
}

function playerHitCheck(){
  const range = 46;
  const ax = player.x + player.facing*18;
  const ay = player.y;
  const r2 = range*range;

  for (const g of goblins){
    if (g.dying) continue;
    if (dist2(ax,ay,g.x,g.y) <= r2){
      g.hp -= 1;

      if (g.hp <= 0){
        g.dying = true;
        g.state = "death";
        g.frame = 0;
        g.t = 0;
        score += 10;
        scoreEl.textContent = String(score);
      } else {
        g.state = "hit";
        g.frame = 0;
        g.t = 0;
        g.hitStun = 0.18;
      }
    }
  }
}

function getMoveVector(){
  if (joyState.active && (Math.abs(joyState.dx)>0.02 || Math.abs(joyState.dy)>0.02)){
    let mx = joyState.dx, my = joyState.dy;
    const l = Math.hypot(mx,my);
    if (l>1e-6){ mx/=l; my/=l; }
    return {mx,my,moving:true};
  }
  let mx=0,my=0;
  if(down("a")||down("arrowleft")) mx -= 1;
  if(down("d")||down("arrowright")) mx += 1;
  if(down("w")||down("arrowup")) my -= 1;
  if(down("s")||down("arrowdown")) my += 1;
  const l = Math.hypot(mx,my);
  if(l>0){ mx/=l; my/=l; }
  return {mx,my,moving:l>0};
}

function updatePlayer(dt){
  if(player.inv>0) player.inv -= dt;

  const mv = getMoveVector();
  const mx = mv.mx, my = mv.my, moving = mv.moving;

  if(mx > 0.01) player.facing = 1;
  if(mx < -0.01) player.facing = -1;

  const wantPunch = down("j") || mobilePunch;
  const wantSlide = down("shift") || mobileSlide;

  if(wantPunch) setPState("punch");
  else if(wantSlide) setPState("slide");
  else if(!player.locked) setPState(moving ? "run" : "idle");

  let spd = player.speed;
  if(player.state==="punch") spd *= 0.55;
  if(player.state==="slide") spd *= 1.35;

  player.x += mx * spd * dt;
  player.y += my * spd * dt;

  player.x = clamp(player.x, PLAYER.frameW/2, innerWidth - PLAYER.frameW/2);
  player.y = clamp(player.y, PLAYER.frameH/2, innerHeight - PLAYER.frameH/2);

  if(player.state==="punch" && !player.didHit && player.frame >= 2){
    playerHitCheck();
    player.didHit = true;
  }

  const fps = PLAYER.fps[player.state] ?? 10;
  const spf = 1/fps;
  player.t += dt;
  while(player.t >= spf){
    player.t -= spf;
    player.frame++;

    if(player.frame >= PLAYER.cols){
      if(player.locked){
        player.locked = false;
        setPState(moving ? "run" : "idle");
      } else {
        player.frame = 0;
      }
    }
  }
}

function updateGoblins(dt){
  const attackRange = 34;
  const strikeFrame = 6;
  const damage = 12;
  const cooldownTime = 0.75;

  for(const g of goblins){
    if(g.dying){
      const fps = ENEMY.fps.death;
      const spf = 1/fps;
      g.t += dt;
      while(g.t >= spf){
        g.t -= spf;
        g.frame++;
        if(g.frame >= ENEMY.cols) g.frame = ENEMY.cols - 1;
      }
      continue;
    }

    if(g.attackCooldown > 0) g.attackCooldown -= dt;

    if(g.hitStun > 0){
      g.hitStun -= dt;
      if(g.hitStun <= 0){
        g.state = "walk";
        g.frame = 0;
        g.t = 0;
      }
    }

    const dx = player.x - g.x;
    const dy = player.y - g.y;
    const d = Math.hypot(dx,dy) || 1;
    const mx = dx/d, my = dy/d;
    g.facing = (mx >= 0) ? 1 : -1;

    const closeEnough = dist2(player.x, player.y, g.x, g.y) <= attackRange*attackRange;

    if(g.state === "walk" && g.hitStun <= 0 && g.attackCooldown <= 0 && closeEnough){
      g.state = "attack";
      g.frame = 0;
      g.t = 0;
      g.didDamageThisAttack = false;
    }

    if(g.state === "walk" && g.hitStun <= 0){
      g.x += mx * g.speed * dt;
      g.y += my * g.speed * dt;
    }

    if(g.state === "attack"){
      if(!g.didDamageThisAttack && g.frame >= strikeFrame){
        const stillClose = dist2(player.x, player.y, g.x, g.y) <= (attackRange+10)*(attackRange+10);
        if(stillClose && player.inv <= 0){
          hp = Math.max(0, hp - damage);
          hpEl.textContent = String(hp);
          player.inv = 0.6;
        }
        g.didDamageThisAttack = true;
      }
      if(g.frame === ENEMY.cols - 1){
        g.state = "walk";
        g.frame = 0;
        g.t = 0;
        g.attackCooldown = cooldownTime;
      }
    }

    const anim = g.state;
    const fps = ENEMY.fps[anim] ?? ENEMY.fps.walk;
    const spf = 1/fps;
    g.t += dt;
    while(g.t >= spf){
      g.t -= spf;
      if(g.state === "attack"){
        g.frame = Math.min(g.frame + 1, ENEMY.cols - 1);
      } else {
        g.frame = (g.frame + 1) % ENEMY.cols;
      }
    }
  }

  if(hp > 0 && goblins.length > 0 && goblins.every(g=>g.dying)){
    startWave(wave + 1);
  }
}

function drawBackground(){
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0,0,innerWidth,innerHeight);
}

function drawSprite(img, sheet, x,y, state, frame, facing){
  const row = sheet.row[state] ?? sheet.row.walk ?? 0;
  const sx = frame * sheet.frameW;
  const sy = row * sheet.frameH;

  ctx.save();
  ctx.translate(x|0, y|0);
  ctx.scale(facing, 1);
  ctx.drawImage(img, sx, sy, sheet.frameW, sheet.frameH, -sheet.frameW/2, -sheet.frameH/2, sheet.frameW, sheet.frameH);
  ctx.restore();
}

function draw(){
  ctx.clearRect(0,0,innerWidth,innerHeight);
  drawBackground();
  ctx.imageSmoothingEnabled = false;

  for(const g of goblins){
    drawSprite(gImg, ENEMY, g.x, g.y, g.state, g.frame, g.facing);
  }

  const blink = player.inv > 0 && (Math.floor(performance.now()/80)%2===0);
  if(!blink){
    drawSprite(pImg, PLAYER, player.x, player.y, player.state, player.frame, player.facing);
  }

  ctx.imageSmoothingEnabled = true;

  if(hp <= 0){
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "800 26px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", innerWidth/2, innerHeight/2 - 6);
    ctx.font = "14px system-ui";
    ctx.fillText("Refresh to try again", innerWidth/2, innerHeight/2 + 20);
    ctx.textAlign = "left";
  }
}

let last = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;

  if(hp > 0){
    updatePlayer(dt);
    updateGoblins(dt);
  }
  draw();
  requestAnimationFrame(loop);
}

(async function boot(){
  try{
    [pImg, gImg] = await Promise.all([loadImage(PLAYER.src), loadImage(ENEMY.src)]);
    ENEMY.frameW = gImg.width / ENEMY.cols;
    ENEMY.frameH = gImg.height / ENEMY.rows;

    hpEl.textContent = String(hp);
    scoreEl.textContent = String(score);
    waveEl.textContent = String(wave);

    startWave(1);
    requestAnimationFrame(loop);
  }catch(e){
    console.error(e);
    alert("Missing sprites. Put Adventurer in assets/player.png and Goblin in assets/goblin.png");
  }
})();
