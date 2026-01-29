// Sprite Fighter + Goblin Enemies
// Player: assets/player.png (7x11, 50x37)
// Enemy:  assets/goblin.png (12x6 grid)

const PLAYER = {
  src: "assets/player.png",
  cols: 7, rows: 11,
  frameW: 50, frameH: 37,
  row: { idle:0, run:1, punch:6, slide:9 },
  fps: { idle:6, run:12, punch:16, slide:14 },
};

const ENEMY = {
  src: "assets/goblin.png",
  cols: 12, rows: 6,
  // frame size will be computed from image width/height
  frameW: null, frameH: null,
  // Guess: row1=walk, row3=sword, row5=death (we'll adjust if needed)
  row: { walk:1, attack:3, death:5 },
  fps: { walk:12, attack:16, death:10 },
};

const canvas=document.getElementById("c");
const ctx=canvas.getContext("2d");
function resize(){
  const dpr=Math.max(1,Math.min(2,devicePixelRatio||1));
  canvas.width=innerWidth*dpr; canvas.height=innerHeight*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize",resize); resize();
const hpEl=document.getElementById("hp");
const scoreEl=document.getElementById("score");
const waveEl=document.getElementById("wave");
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function rand(a,b){return a+Math.random()*(b-a);}
function dist2(ax,ay,bx,by){const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;}

let keys=new Set();
addEventListener("keydown",e=>keys.add(e.key.toLowerCase()));
addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
function down(k){return keys.has(k);}

let mobilePunch=false,mobileSlide=false;
function bindButton(id,setter){
  const el=document.getElementById(id);
  const on=e=>{e.preventDefault();setter(true);};
  const off=e=>{e.preventDefault();setter(false);};
  el.addEventListener("pointerdown",on);
  el.addEventListener("pointerup",off);
  el.addEventListener("pointercancel",off);
  el.addEventListener("pointerleave",off);
}
bindButton("btnPunch",v=>mobilePunch=v);
bindButton("btnSlide",v=>mobileSlide=v);

// Joystick
const joy=document.getElementById("joy");
const stick=document.getElementById("joyStick");
const joyState={active:false,id:null,cx:0,cy:0,dx:0,dy:0,r:55};
function setStick(px,py){stick.style.transform=`translate(${px}px,${py}px)`;}
function resetJoy(){joyState.active=false;joyState.id=null;joyState.dx=0;joyState.dy=0;setStick(0,0);}
joy.addEventListener("pointerdown",e=>{
  e.preventDefault(); joyState.active=true; joyState.id=e.pointerId;
  const r=joy.getBoundingClientRect();
  joyState.cx=r.left+r.width/2; joyState.cy=r.top+r.height/2;
  joy.setPointerCapture(e.pointerId);
});
joy.addEventListener("pointermove",e=>{
  if(!joyState.active||e.pointerId!==joyState.id) return;
  const dx=e.clientX-joyState.cx, dy=e.clientY-joyState.cy;
  const d=Math.hypot(dx,dy), max=joyState.r;
  const nx=d>1e-6?dx/d:0, ny=d>1e-6?dy/d:0;
  const cl=Math.min(d,max);
  const px=nx*cl, py=ny*cl;
  setStick(px,py);
  joyState.dx=px/max; joyState.dy=py/max;
});
joy.addEventListener("pointerup",e=>{if(e.pointerId===joyState.id) resetJoy();});
joy.addEventListener("pointercancel",e=>{if(e.pointerId===joyState.id) resetJoy();});

function loadImage(src){
  return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});
}

let pImg,eImg;
let hp=100,score=0,wave=1;
const player={x:innerWidth/2,y:innerHeight/2,speed:250,state:"idle",frame:0,t:0,locked:false,facing:1,inv:0};
function setPState(n){
  if(player.locked && n!==player.state) return;
  if(player.state===n) return;
  player.state=n; player.frame=0; player.t=0;
  player.locked=(n==="punch"||n==="slide");
}

const enemies=[];
function spawnGoblin(){
  const m=50;
  const side=(Math.random()*4)|0;
  let x,y;
  if(side===0){x=-m;y=rand(0,innerHeight);}
  if(side===1){x=innerWidth+m;y=rand(0,innerHeight);}
  if(side===2){x=rand(0,innerWidth);y=-m;}
  if(side===3){x=rand(0,innerWidth);y=innerHeight+m;}
  enemies.push({x,y,speed:rand(85,120)+wave*2,hp:2+wave,state:"walk",frame:0,t:0,facing:1,dying:false});
}
function startWave(n){
  wave=n; waveEl.textContent=wave;
  for(let i=0;i<4+wave*2;i++) spawnGoblin();
}

function attackHit(){
  const range=46;
  const ax=player.x+player.facing*18, ay=player.y;
  for(const g of enemies){
    if(g.dying) continue;
    if(dist2(ax,ay,g.x,g.y)<=range*range){
      g.hp--;
      g.state="attack"; g.frame=0; g.t=0;
      if(g.hp<=0){
        g.dying=true;
        g.state="death"; g.frame=0; g.t=0;
        score+=10; scoreEl.textContent=score;
      }
    }
  }
}

function updatePlayer(dt){
  if(player.inv>0) player.inv-=dt;
  let mx=0,my=0,moving=false;
  if(joyState.active && (Math.abs(joyState.dx)>0.02||Math.abs(joyState.dy)>0.02)){
    mx=joyState.dx; my=joyState.dy; moving=true;
    const l=Math.hypot(mx,my); mx/=l; my/=l;
  } else {
    if(down("a")) mx-=1; if(down("d")) mx+=1;
    if(down("w")) my-=1; if(down("s")) my+=1;
    const l=Math.hypot(mx,my);
    if(l>0){mx/=l;my/=l;moving=true;}
  }
  if(mx>0.01) player.facing=1;
  if(mx<-0.01) player.facing=-1;

  const wantPunch=down("j")||mobilePunch;
  const wantSlide=down("shift")||mobileSlide;
  if(wantPunch) setPState("punch");
  else if(wantSlide) setPState("slide");
  else if(!player.locked) setPState(moving?"run":"idle");

  let spd=player.speed;
  if(player.state==="punch") spd*=0.55;
  if(player.state==="slide") spd*=1.35;
  player.x+=mx*spd*dt; player.y+=my*spd*dt;
  player.x=clamp(player.x,PLAYER.frameW/2,innerWidth-PLAYER.frameW/2);
  player.y=clamp(player.y,PLAYER.frameH/2,innerHeight-PLAYER.frameH/2);

  // hit once during punch
  if(player.state==="punch" && player.frame===2 && player.t<0.02){
    attackHit();
  }

  const fps=PLAYER.fps[player.state]; const spf=1/fps;
  player.t+=dt;
  while(player.t>=spf){
    player.t-=spf; player.frame++;
    if(player.frame>=PLAYER.cols){
      if(player.locked){player.locked=false; setPState(moving?"run":"idle");}
      else player.frame=0;
    }
  }
}

function updateGoblins(dt){
  for(const g of enemies){
    if(g.dying){
      const fps=ENEMY.fps.death, spf=1/fps;
      g.t+=dt;
      while(g.t>=spf){
        g.t-=spf; g.frame++;
        if(g.frame>=ENEMY.cols){ g.frame=ENEMY.cols-1; }
      }
      continue;
    }

    const dx=player.x-g.x, dy=player.y-g.y;
    const d=Math.hypot(dx,dy)||1;
    const mx=dx/d, my=dy/d;
    g.facing = mx>=0?1:-1;
    g.x+=mx*g.speed*dt; g.y+=my*g.speed*dt;

    const hit=22;
    if(dist2(player.x,player.y,g.x,g.y)<=hit*hit && player.inv<=0){
      hp=Math.max(0,hp-6); hpEl.textContent=hp;
      player.inv=0.5;
    }

    const fps=ENEMY.fps.walk, spf=1/fps;
    g.t+=dt;
    while(g.t>=spf){
      g.t-=spf; g.frame=(g.frame+1)%ENEMY.cols;
    }
  }

  // remove fully dead after a bit
  for(let i=enemies.length-1;i>=0;i--){
    if(enemies[i].dying && enemies[i].frame===ENEMY.cols-1){
      // keep corpse a moment? simple remove:
      // enemies.splice(i,1);
      continue;
    }
  }

  if(enemies.every(e=>e.dying) && hp>0){
    startWave(wave+1);
  }
}

function drawBackground(){
  ctx.fillStyle="#0b0f14";
  ctx.fillRect(0,0,innerWidth,innerHeight);
}

function drawSprite(img, sheet, x,y, state, frame, facing){
  const row = sheet.row[state] ?? sheet.row.walk ?? 0;
  const sx = frame*sheet.frameW;
  const sy = row*sheet.frameH;
  ctx.save();
  ctx.translate(x|0,y|0);
  ctx.scale(facing,1);
  ctx.drawImage(img,sx,sy,sheet.frameW,sheet.frameH,-sheet.frameW/2,-sheet.frameH/2,sheet.frameW,sheet.frameH);
  ctx.restore();
}

function draw(){
  ctx.clearRect(0,0,innerWidth,innerHeight);
  drawBackground();
  ctx.imageSmoothingEnabled=false;

  for(const g of enemies){
    drawSprite(eImg, ENEMY, g.x,g.y, g.state, g.frame, g.facing);
  }
  // player blink inv
  const blink = player.inv>0 && (Math.floor(performance.now()/80)%2===0);
  if(!blink){
    drawSprite(pImg, PLAYER, player.x,player.y, player.state, player.frame, player.facing);
  }
}

let last=performance.now();
function loop(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  if(hp>0){
    updatePlayer(dt);
    updateGoblins(dt);
  }
  draw();
  requestAnimationFrame(loop);
}

(async function boot(){
  try{
    [pImg,eImg]=await Promise.all([loadImage(PLAYER.src),loadImage(ENEMY.src)]);
    ENEMY.frameW = eImg.width/ENEMY.cols;
    ENEMY.frameH = eImg.height/ENEMY.rows;
    startWave(1);
    requestAnimationFrame(loop);
  }catch(e){
    alert("Missing sprites. Put Adventurer in assets/player.png and Goblin in assets/goblin.png");
  }
})();
