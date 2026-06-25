/* =========================================================================
   Mission ESSOC — game.js — moteur principal
   ========================================================================= */
(() => {
"use strict";

/* ----------------------------- Éléments DOM ----------------------------- */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ui = document.getElementById("ui");
const hintEl = document.getElementById("hint");
const helpbar = document.getElementById("helpbar");

ctx.imageSmoothingEnabled = false;

/* ----------------------------- État global ----------------------------- */
const State = {
  screen: "title",       // title | creator | map | play
  scene: null,           // clé de SCENES quand on joue
  player: {
    name:"", service:"", gender:"f", charId:"player_f3",
    x:0.5, y:0.8, dir:"down", moving:false, animPhase:0,
  },
  flags: {
    metLeslie:false, metJerome:false, missionStarted:false, missionDone:false,
    secondAttempt:false, firstTryCorrect:false,
    lienOffered:false, lienMet:false, lienDone:false, lienSecondAttempt:false,
    lienExtSeen:false,
    carpOffered:false, carpMet:false, carpDone:false, carpSecondAttempt:false,
    carpExtSeen:false,
    orangeOffered:false, orangeMet:false, orangeDone:false, orangeSecondAttempt:false,
    orangeExtSeen:false,
    manosqueOffered:false, manosqueMet:false, manosqueExtSeen:false,
    manosqueMatchDone:false, manosqueMatchSecond:false,
    manosqueQDone:false, manosqueQSecond:false,
    coustelletOffered:false, coustelletMet:false, coustelletExtSeen:false,
    coustelletMatchDone:false, coustelletMatchSecond:false,
    coustelletQDone:false, coustelletQSecond:false,
    digneOffered:false, digneMet:false, digneExtSeen:false,
    digneMatchDone:false, digneMatchSecond:false,
    digneQDone:false, digneQSecond:false,
    gapOffered:false, gapMet:false, gapExtSeen:false,
    gapMatchDone:false, gapMatchSecond:false,
    gapQDone:false, gapQSecond:false,
    gapAffichesDone:false, gapAffichesSecond:false, gapAffichesStarted:false,
    endingSequenceStarted:false,
  },
  notes: {},             // id de note -> true (débloquée)
  explored: {},          // id de zone facultative explorée
  scores: { exactitude:0, posture:0, efficacite:0, exploration:0 },
  overlay: null,         // 'journal' | 'dialog' | 'quiz' | null
};

/* ----------------------------- Assets ----------------------------- */
const IMG = {};
function loadImage(src){
  return new Promise((res)=>{
    const im = new Image();
    im.onload = ()=>res(im);
    im.onerror = ()=>{console.warn("Image manquante:",src);res(null);};
    im.src = src;
  });
}

const SPRITE_DIRS = ["down","up","left","right"];
async function loadAllAssets(){
  // fonds : on collecte automatiquement tous les décors référencés par les scènes,
  // plus le fond du menu, pour ne jamais en oublier.
  const bgFiles = new Set(["assets/bg/carte.jpg"]);
  for(const s of Object.values(SCENES)){ if(s.bg) bgFiles.add(s.bg); }
  for(const path of bgFiles){
    const m = /assets\/bg\/([^.]+)\./.exec(path);
    if(m) IMG["bg_"+m[1]] = await loadImage(path);
  }
  // sprites personnages : leslie, jerome, PNJ + tous les jouables
  const chars = new Set(["leslie","jerome","agent_lien","senior_f","senior_m"]);
  PLAYABLE.f.forEach(c=>chars.add(c.id));
  PLAYABLE.m.forEach(c=>chars.add(c.id));
  for(const c of chars){
    for(const d of SPRITE_DIRS){
      IMG[`${c}_${d}`] = await loadImage(`assets/sprites/${c}_${d}.png`);
    }
  }
  // véhicules
  IMG.bus = await loadImage("assets/sprites/bus_side.png");
  IMG.car = await loadImage("assets/sprites/car_side.png");
  // image du menu principal (affichée directement sur le canvas)
  _menuBg = await loadImage("menu_principal.png");
}

/* ----------------------------- Sauvegarde ----------------------------- */
/* localStorage peut être indisponible (mode file://, navigation privée…).
   On encapsule tout pour ne jamais bloquer le jeu. */
let LS = null;
try { LS = window.localStorage; const t="__essoc_test__"; LS.setItem(t,"1"); LS.removeItem(t); }
catch(e){ LS = null; console.warn("localStorage indisponible : la sauvegarde sera désactivée."); }

let memSave = null; // sauvegarde de secours en mémoire si localStorage absent

function hasSave(){
  try{ if(LS) return !!LS.getItem(GAME.saveKey); }catch(e){}
  return !!memSave;
}
function saveGame(){
  const data = {
    v:1,
    player: State.player,
    scene: State.scene,
    flags: State.flags,
    notes: State.notes,
    explored: State.explored,
    scores: State.scores,
  };
  const json = JSON.stringify(data);
  memSave = json;
  try{ if(LS) LS.setItem(GAME.saveKey, json); }catch(e){}
}
function loadGame(){
  try{
    let raw = null;
    try{ if(LS) raw = LS.getItem(GAME.saveKey); }catch(e){}
    if(!raw) raw = memSave;
    if(!raw) return false;
    const d = JSON.parse(raw);
    Object.assign(State.player, d.player||{});
    Object.assign(State.flags, d.flags||{});
    State.notes = d.notes||{};
    State.explored = d.explored||{};
    Object.assign(State.scores, d.scores||{});
    State.scene = d.scene || "exterior";
    return true;
  }catch(e){ return false; }
}
function eraseSave(){
  memSave = null;
  try{ if(LS) LS.removeItem(GAME.saveKey); }catch(e){}
}

/* ----------------------------- Mise à l'échelle canvas ----------------------------- */
let view = { w:GAME.baseW, h:GAME.baseH, scale:1, ox:0, oy:0 };
function resize(){
  const app = document.getElementById("app");
  const aw = app.clientWidth, ah = app.clientHeight;
  const ratio = GAME.baseW/GAME.baseH;
  let w = aw, h = aw/ratio;
  if(h > ah){ h = ah; w = ah*ratio; }
  canvas.style.width = w+"px";
  canvas.style.height = h+"px";
  // canvas interne reste en base resolution -> netteté
  view = { w:GAME.baseW, h:GAME.baseH, scale:w/GAME.baseW, ox:0, oy:0 };
}
window.addEventListener("resize", resize);

/* coordonnées fractionnaires -> pixels canvas */
const PX = (fx)=> fx*GAME.baseW;
const PY = (fy)=> fy*GAME.baseH;

/* ----------------------------- Caméra ----------------------------- */
/* Pour les scènes marquées {camera:{follow:true, zoom:Z}}, la vue est zoomée
   et centrée sur le joueur. La caméra reste bornée à l'image pour ne jamais
   afficher de vide. Renvoie {zoom, tx, ty} en pixels canvas de base. */
let camLerp = {x:0.5, y:0.5, init:false};
function getCamera(){
  const s = SCENES[State.scene];
  if(!s || !s.camera || !s.camera.follow){
    return {zoom:1, tx:0, ty:0};
  }
  const Z = s.camera.zoom || 1.6;
  // cible : centre sur le joueur (lissage léger pour un suivi doux)
  const tx0 = State.player.x, ty0 = State.player.y;
  if(!camLerp.init){ camLerp.x=tx0; camLerp.y=ty0; camLerp.init=true; }
  camLerp.x += (tx0-camLerp.x)*0.18;
  camLerp.y += (ty0-camLerp.y)*0.18;
  // demi-fenêtre visible (en fraction) à ce zoom
  const halfW = 0.5/Z, halfH = 0.5/Z;
  // bornage pour rester dans l'image [0..1]
  let cx = Math.min(1-halfW, Math.max(halfW, camLerp.x));
  let cy = Math.min(1-halfH, Math.max(halfH, camLerp.y));
  // translation en pixels de base : on veut que (cx,cy) -> centre écran
  const tx = GAME.baseW*0.5 - cx*GAME.baseW*Z;
  const ty = GAME.baseH*0.5 - cy*GAME.baseH*Z;
  return {zoom:Z, tx, ty};
}
function resetCamera(){ camLerp.init=false; }
/* projette une coord fraction -> pixel écran (canvas base) en tenant compte caméra */
function projX(fx){ const c=getCamera(); return PX(fx)*c.zoom + c.tx; }
function projY(fy){ const c=getCamera(); return PY(fy)*c.zoom + c.ty; }

/* ----------------------------- Entrées clavier ----------------------------- */
const keys = {};
const KEYMAP = {
  ArrowUp:"up", ArrowDown:"down", ArrowLeft:"left", ArrowRight:"right",
  KeyW:"up", KeyZ:"up", KeyS:"down", KeyA:"left", KeyQ:"left", KeyD:"right",
};
/* Détecte si l'utilisateur est en train de saisir du texte dans un champ.
   Dans ce cas, le jeu ne doit intercepter AUCUNE touche (déplacements,
   interactions, carnet…), pour que les lettres z,q,s,d,a,e,j,w… s'écrivent
   normalement dans le champ nom. */
function isTextEntry(target){
  if(!target) return false;
  const tag = (target.tagName||"").toLowerCase();
  if(tag==="input" || tag==="textarea" || tag==="select") return true;
  if(target.isContentEditable) return true;
  return false;
}
window.addEventListener("keydown",(e)=>{
  // Si on tape dans un champ de saisie, on laisse le navigateur gérer la frappe.
  if(isTextEntry(e.target)) return;
  if(KEYMAP[e.code]){ keys[KEYMAP[e.code]] = true; e.preventDefault(); }
  if(e.code==="KeyE" || e.code==="Enter"){ onInteract(); e.preventDefault(); }
  if(e.code==="KeyJ"){ toggleJournal(); e.preventDefault(); }
  if(e.code==="Escape"){ onEscape(); e.preventDefault(); }
  if(/^Digit[1-4]$/.test(e.code) || /^Key[ABCD]$/.test(e.code)) onQuizKey(e.code);
});
window.addEventListener("keyup",(e)=>{
  if(isTextEntry(e.target)) return;
  if(KEYMAP[e.code]) keys[KEYMAP[e.code]] = false;
});

/* tactile */
function bindTouch(){
  const layer = document.getElementById("touch");
  layer.innerHTML = `
    <div class="dpad">
      <button class="up" data-d="up">▲</button>
      <button class="down" data-d="down">▼</button>
      <button class="left" data-d="left">◀</button>
      <button class="right" data-d="right">▶</button>
    </div>
    <button class="touch-a">E</button>`;
  layer.querySelectorAll(".dpad button").forEach(b=>{
    const d=b.dataset.d;
    const on=(e)=>{e.preventDefault();keys[d]=true;};
    const off=(e)=>{e.preventDefault();keys[d]=false;};
    b.addEventListener("touchstart",on,{passive:false});
    b.addEventListener("touchend",off);b.addEventListener("touchcancel",off);
    b.addEventListener("mousedown",on);b.addEventListener("mouseup",off);b.addEventListener("mouseleave",off);
  });
  layer.querySelector(".touch-a").addEventListener("touchstart",(e)=>{e.preventDefault();onInteract();},{passive:false});
  layer.querySelector(".touch-a").addEventListener("click",()=>onInteract());
  if(matchMedia("(pointer:coarse)").matches) layer.classList.add("on");
}

/* ----------------------------- Collisions ----------------------------- */
function inRect(x,y,r){ return x>=r.x0 && x<=r.x1 && y>=r.y0 && y<=r.y1; }
function canStand(scene, x, y){
  const s = SCENES[scene];
  const b = s.bounds;
  if(x<b.x0||x>b.x1||y<b.y0||y>b.y1) return false;
  for(const c of s.colliders){ if(inRect(x,y,c)) return false; }
  return true;
}

/* ----------------------------- Boucle de jeu ----------------------------- */
let last = 0;
function loop(t){
  const dt = Math.min(40, t-last)/1000; last = t;
  if(State.screen==="play" && !State.overlay) updatePlayer(dt);
  render(t);
  requestAnimationFrame(loop);
}

function updatePlayer(dt){
  const p = State.player;
  let dx=0, dy=0;
  if(keys.up) dy-=1; if(keys.down) dy+=1;
  if(keys.left) dx-=1; if(keys.right) dx+=1;
  p.moving = (dx||dy)!==0;
  if(p.moving){
    if(Math.abs(dx)>Math.abs(dy)) p.dir = dx<0?"left":"right";
    else p.dir = dy<0?"up":"down";
    const speed = 0.30; // fraction/seconde
    const len = Math.hypot(dx,dy)||1;
    const nx = p.x + (dx/len)*speed*dt;
    const ny = p.y + (dy/len)*speed*dt;
    if(canStand(State.scene, nx, p.y)) p.x = nx;
    if(canStand(State.scene, p.x, ny)) p.y = ny;
    p.animPhase += dt*8;
  } else {
    p.animPhase = 0;
  }
  updateHint();
}

/* zone d'interaction la plus proche */
function zoneAvailable(z){
  if(!z.requires) return true;
  return !!State.flags[z.requires];
}
function nearestZone(){
  const s = SCENES[State.scene]; if(!s) return null;
  const p = State.player; let best=null, bd=1e9;
  for(const z of s.zones){
    if(!zoneAvailable(z)) continue;
    const d = Math.hypot(p.x-z.x, p.y-z.y);
    if(d < z.r && d < bd){ bd=d; best=z; }
  }
  return best;
}

/* ----------------------------- Rendu ----------------------------- */
function render(t){
  ctx.clearRect(0,0,GAME.baseW,GAME.baseH);
  if(State.screen==="play"){
    drawScene(t);
  } else if(State.screen==="map"){
    drawMap(t);
  } else if(State.screen==="title"){
    ctx.clearRect(0,0,GAME.baseW,GAME.baseH);
  } else {
    ctx.clearRect(0,0,GAME.baseW,GAME.baseH);
  }
}

function drawScene(t){
  const s = SCENES[State.scene];
  const cam = getCamera();

  ctx.save();
  ctx.translate(cam.tx, cam.ty);
  ctx.scale(cam.zoom, cam.zoom);

  // clé d'image dérivée du nom de fichier de fond de la scène (assets/bg/NOM.jpg)
  const m = /assets\/bg\/([^.]+)\./.exec(s.bg);
  const bg = m ? IMG["bg_"+m[1]] : null;
  if(bg) ctx.drawImage(bg,0,0,GAME.baseW,GAME.baseH);
  else { ctx.fillStyle="#26406f"; ctx.fillRect(0,0,GAME.baseW,GAME.baseH); }

  // Entités triées par Y (profondeur)
  const ents = [];
  for(const pr of s.props){ ents.push({type:"prop", y:pr.y, data:pr}); }
  ents.push({type:"player", y:State.player.y});
  ents.sort((a,b)=>a.y-b.y);

  for(const e of ents){
    if(e.type==="prop"){
      if(e.data.vehicle) drawVehicle(e.data, t);
      else {
        drawCharacter(e.data.sprite, e.data.faces||"down", e.data.x, e.data.y, e.data.scale, false, t);
        if(e.data.name) drawNameTag(e.data.name, e.data.x, e.data.y, e.data.scale);
      }
    } else {
      drawCharacter(State.player.charId, State.player.dir, State.player.x, State.player.y, s.playerScale, State.player.moving, t);
    }
  }

  // surbrillance zone interactive proche
  const z = nearestZone();
  if(z){
    const cx=PX(z.x), cy=PY(z.y);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15*Math.sin(t/300);
    ctx.strokeStyle = "#ffd34d";
    ctx.lineWidth = 4/cam.zoom;
    ctx.beginPath();
    ctx.ellipse(cx, cy, PX(z.r)*0.9, PX(z.r)*0.5, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/* Dessine un véhicule posé sur la scène (ombre au sol, pas de rebond de marche) */
function drawVehicle(pr, t){
  const im = IMG[spriteKeyForVehicle(pr.sprite)];
  if(!im) return;
  const targetH = pr.scale*GAME.baseH;
  const w = targetH*(im.width/im.height);
  const cx = PX(pr.x), footY = PY(pr.y);
  ctx.save();
  ctx.globalAlpha = 0.26; ctx.fillStyle="#000";
  ctx.beginPath();
  ctx.ellipse(cx, footY-2, w*0.42, w*0.12, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(im, cx-w/2, footY-targetH, w, targetH);
}
function spriteKeyForVehicle(sprite){
  if(sprite==="car_side") return "car";
  if(sprite==="bus_side") return "bus";
  return sprite;
}

/* dessine un personnage : ombre au sol + sprite, ancré aux pieds (y = sol) */
function drawCharacter(charId, dir, fx, fy, scaleH, moving, t){
  const im = IMG[`${charId}_${dir}`] || IMG[`${charId}_down`];
  if(!im) return;
  const targetH = scaleH*GAME.baseH;
  const w = targetH * (im.width/im.height);
  const cx = PX(fx);
  const footY = PY(fy);
  // léger rebond de marche (joueur uniquement)
  const bob = moving ? Math.abs(Math.sin(State.player.animPhase))* -targetH*0.035 : 0;
  // ombre au sol, collée aux pieds (légèrement sous footY)
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(cx, footY-targetH*0.012, w*0.30, targetH*0.045, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  // sprite : bas de l'image = footY (pieds posés au sol)
  ctx.drawImage(im, cx - w/2, footY - targetH + bob, w, targetH);
}

/* Étiquette prénom au-dessus d'un PNJ (identifié par son prénom) */
function drawNameTag(name, fx, fy, scaleH){
  const cam = getCamera();
  const targetH = scaleH*GAME.baseH;
  const cx = PX(fx);
  const headY = PY(fy) - targetH - GAME.baseH*0.006;  // juste au-dessus de la tête
  ctx.save();
  const fontPx = Math.max(11, 14/cam.zoom);
  ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const padX = 7/cam.zoom, h = fontPx + 7/cam.zoom;
  const meas = ctx.measureText(name);
  const tw = (meas && meas.width) ? meas.width : name.length * fontPx * 0.55;
  const w = tw + padX*2;
  // petite plaque arrondie bleu MSA, semi-opaque
  const x = cx - w/2, y = headY - h;
  const r = h*0.32;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  ctx.fillStyle = "rgba(20,42,108,0.86)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name, cx, y + h/2);
  ctx.restore();
}

/* ----------------------------- Carte + animation minibus ----------------------------- */
let mapAnim = null;
function startMapTravel(onDone){
  // trajet initial : zone Le Lien (droite) -> Avignon
  startMapTravelToImpl({x:0.86,y:0.30}, {x:AVIGNON_PT.x,y:AVIGNON_PT.y}, "Trajet vers Avignon…", onDone);
}
function startMapTravelTo(from, to, onDone, label){
  startMapTravelToImpl(from, to, label || "Trajet en cours…", onDone);
}
function startMapTravelToImpl(from, to, label, onDone){
  State.screen = "map";
  setSceneTag(false);
  mapAnim = { t0: performance.now(), dur: 3000, sx:from.x, sy:from.y, ex:to.x, ey:to.y, onDone, done:false };
  showToast(label);
}
function drawMap(t){
  const bg = IMG.bg_carte;
  if(bg) ctx.drawImage(bg,0,0,GAME.baseW,GAME.baseH);
  if(!mapAnim) return;
  const k = Math.min(1, (t-mapAnim.t0)/mapAnim.dur);
  const ease = k<0.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2; // easeInOut
  // trajectoire courbe (arc)
  const mx = (mapAnim.sx+mapAnim.ex)/2;
  const my = Math.min(mapAnim.sy,mapAnim.ey) - 0.10;
  const x = (1-ease)*(1-ease)*mapAnim.sx + 2*(1-ease)*ease*mx + ease*ease*mapAnim.ex;
  const y = (1-ease)*(1-ease)*mapAnim.sy + 2*(1-ease)*ease*my + ease*ease*mapAnim.ey;
  // tracé du chemin déjà parcouru
  ctx.save();
  ctx.strokeStyle="rgba(28,63,143,.55)"; ctx.lineWidth=5; ctx.setLineDash([10,9]);
  ctx.beginPath();
  for(let i=0;i<=ease;i+=0.02){
    const px=(1-i)*(1-i)*mapAnim.sx+2*(1-i)*i*mx+i*i*mapAnim.ex;
    const py=(1-i)*(1-i)*mapAnim.sy+2*(1-i)*i*my+i*i*mapAnim.ey;
    if(i===0) ctx.moveTo(PX(px),PY(py)); else ctx.lineTo(PX(px),PY(py));
  }
  ctx.stroke();
  ctx.restore();
  // véhicule de service : la voiture compacte MSA
  const im = IMG.car;
  if(im){
    const h = 0.060*GAME.baseH;
    const w = h*(im.width/im.height);
    // orientation : la voiture pointe vers la gauche par défaut ; miroir si on va vers la droite
    const goingLeft = mapAnim.ex < mapAnim.sx;
    ctx.save();
    ctx.globalAlpha=0.25;ctx.fillStyle="#000";
    ctx.beginPath();ctx.ellipse(PX(x),PY(y)+h*0.42,w*0.36,h*0.12,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(PX(x),PY(y));
    if(!goingLeft) ctx.scale(-1,1);   // par défaut regarde à gauche -> miroir quand on va à droite
    ctx.drawImage(im, -w/2, -h*0.55, w, h);
    ctx.restore();
  }
  // marqueur Avignon pulsant
  ctx.save();
  ctx.globalAlpha=0.5+0.3*Math.sin(t/250);
  ctx.strokeStyle="#c9a227";ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(PX(mapAnim.ex),PY(mapAnim.ey),26,0,Math.PI*2);ctx.stroke();
  ctx.restore();

  if(k>=1 && !mapAnim.done){
    mapAnim.done = true;
    setTimeout(()=>{ const cb=mapAnim.onDone; mapAnim=null; cb&&cb(); }, 500);
  }
}

/* ----------------------------- Transitions ----------------------------- */
let fadeEl=null;
function ensureFade(){
  if(!fadeEl){ fadeEl=document.createElement("div"); fadeEl.id="fade"; document.getElementById("app").appendChild(fadeEl); }
  return fadeEl;
}
function fadeTo(cb){
  const f=ensureFade(); f.classList.add("on");
  setTimeout(()=>{ cb&&cb(); setTimeout(()=>f.classList.remove("on"),60); }, 520);
}

function gotoScene(scene, spawn){
  fadeTo(()=>{
    const prev = State.scene;
    State.scene = scene;
    State.screen = "play";
    if(spawn){ State.player.x=spawn.x; State.player.y=spawn.y; }
    State.player.dir = "up";
    resetCamera();
    setSceneTag(true);
    saveGame();
    onSceneEntered(scene, prev);
  });
}

/* Messages d'accueil contextuels (une seule fois) selon la scène atteinte */
function onSceneEntered(scene, prev){
  if(scene==="lien_exterior" && !State.flags.lienExtSeen){
    State.flags.lienExtSeen = true;
    setTimeout(()=>{ if(State.scene==="lien_exterior")
      openDialog("Le Lien", ["Vous voici sur la place du village : le bus « Le Lien » est garé là, prêt à accueillir.","Approchez-vous du marchepied et montez à bord pour tenir la permanence."], "green", ()=>{}); }, 650);
  }
  else if(scene==="lien_interior" && prev==="lien_exterior" && !State.flags.lienMet){
    setTimeout(()=>{ if(State.scene==="lien_interior")
      openDialog("Le Lien", DIALOG.lien_welcome, "green", ()=>{}); }, 650);
  }
  else if(scene==="carpentras_ext" && !State.flags.carpExtSeen){
    State.flags.carpExtSeen = true;
    setTimeout(()=>{ if(State.scene==="carpentras_ext")
      openDialog("Carpentras", ["Vous arrivez devant l'agence MSA de Carpentras, au pied du Ventoux.","Entrez dans l'agence pour rejoindre l'accueil."], "green", ()=>{}); }, 650);
  }
  else if(scene==="carpentras_hall" && prev==="carpentras_ext" && !State.flags.carpMet){
    setTimeout(()=>{ if(State.scene==="carpentras_hall")
      openDialog("Carpentras", DIALOG.carp_welcome, "green", ()=>{}); }, 650);
  }
  else if(scene==="orange_ext" && !State.flags.orangeExtSeen){
    State.flags.orangeExtSeen = true;
    setTimeout(()=>{ if(State.scene==="orange_ext")
      openDialog("Orange", ["Vous arrivez à l'agence MSA d'Orange, au cœur du pays des Princes.","Entrez dans l'agence pour rejoindre l'accueil."], "green", ()=>{}); }, 650);
  }
  else if(scene==="orange_hall" && prev==="orange_ext" && !State.flags.orangeMet){
    setTimeout(()=>{ if(State.scene==="orange_hall")
      openDialog("Orange", DIALOG.orange_welcome, "green", ()=>{}); }, 650);
  }
  else if(scene==="manosque_ext" && !State.flags.manosqueExtSeen){
    State.flags.manosqueExtSeen = true;
    setTimeout(()=>{ if(State.scene==="manosque_ext")
      openDialog("Manosque", ["Vous arrivez à l'agence MSA de Manosque, en Alpes-de-Haute-Provence.","C'est la plus grande du secteur. Entrez pour rejoindre l'accueil."], "green", ()=>{}); }, 650);
  }
  else if(scene==="manosque_hall" && prev==="manosque_ext" && !State.flags.manosqueMet){
    setTimeout(()=>{ if(State.scene==="manosque_hall")
      openDialog("Manosque", DIALOG.manosque_welcome, "green", ()=>{}); }, 650);
  }
  else if(scene==="coustellet_ext" && !State.flags.coustelletExtSeen){
    State.flags.coustelletExtSeen = true;
    setTimeout(()=>{ if(State.scene==="coustellet_ext")
      openDialog("Coustellet", ["Vous arrivez à l'agence MSA de Coustellet, dans le Luberon.","Entrez pour rejoindre l'accueil."], "green", ()=>{}); }, 650);
  }
  else if(scene==="coustellet_hall" && prev==="coustellet_ext" && !State.flags.coustelletMet){
    setTimeout(()=>{ if(State.scene==="coustellet_hall")
      openDialog("Coustellet", DIALOG.coustellet_welcome, "green", ()=>{}); }, 650);
  }
  else if(scene==="digne_ext" && !State.flags.digneExtSeen){
    State.flags.digneExtSeen = true;
    setTimeout(()=>{ if(State.scene==="digne_ext")
      openDialog("Digne-les-Bains", ["Vous arrivez à l'agence MSA de Digne-les-Bains, préfecture des Alpes-de-Haute-Provence.","Entrez pour rejoindre l'accueil."], "green", ()=>{}); }, 650);
  }
  else if(scene==="digne_hall" && prev==="digne_ext" && !State.flags.digneMet){
    setTimeout(()=>{ if(State.scene==="digne_hall")
      openDialog("Digne-les-Bains", DIALOG.digne_welcome, "green", ()=>{}); }, 650);
  }
  else if(scene==="gap_ext" && !State.flags.gapExtSeen){
    State.flags.gapExtSeen = true;
    setTimeout(()=>{ if(State.scene==="gap_ext")
      openDialog("Gap", ["Vous arrivez à l'agence MSA de Gap, préfecture des Hautes-Alpes.","Entrez pour rejoindre l'accueil."], "green", ()=>{}); }, 650);
  }
  else if(scene==="gap_hall" && prev==="gap_ext" && !State.flags.gapMet){
    setTimeout(()=>{ if(State.scene==="gap_hall")
      openDialog("Gap", DIALOG.gap_welcome, "green", ()=>{}); }, 650);
  }
}

/* ----------------------------- Interaction ----------------------------- */
function onInteract(){
  if(State.overlay==="signage"){ closeSignage(); return; }
  if(State.overlay==="dialog"){ advanceDialog(); return; }
  if(State.screen!=="play" || State.overlay) return;
  const z = nearestZone();
  if(!z) return;
  runAction(z.action, z);
}

function runAction(a, zone){
  if(a.type==="goto"){
    // À la sortie de n'importe quel hall vers l'extérieur : vérifier si toutes
    // les missions principales sont terminées pour déclencher le générique.
    const exitScenes = ["exterior","lien_exterior","carpentras_ext","orange_ext",
                        "manosque_ext","coustellet_ext","digne_ext","gap_ext"];
    if(exitScenes.includes(a.scene) && checkAllChallengesCompleted() && !State.flags.endingSequenceStarted){
      startEndingSequence();
      return;
    }
    gotoScene(a.scene, a.spawn);
  }
  else if(a.type==="dialog"){
    if(a.note) unlockNote(a.note);
    if(zone) markExplored(zone.id);
    openDialog(a.who, a.lines, a.cls||"", ()=>{});
  }
  else if(a.type==="leslie"){ leslieFlow(); }
  else if(a.type==="jerome"){ jeromeFlow(); }
  else if(a.type==="roux"){ rouxFlow(); }
  else if(a.type==="carp"){ carpFlow(); }
  else if(a.type==="orange"){ orangeFlow(); }
  else if(a.type==="manosque_match"){ manosqueMatchFlow(); }
  else if(a.type==="manosque_q"){ manosqueQuestionFlow(); }
  else if(a.type==="coustellet_match"){ coustelletMatchFlow(); }
  else if(a.type==="coustellet_q"){ coustelletQuestionFlow(); }
  else if(a.type==="digne_match"){ digneMatchFlow(); }
  else if(a.type==="digne_q"){ digneQuestionFlow(); }
  else if(a.type==="gap_match"){ gapMatchFlow(); }
  else if(a.type==="gap_q"){ gapQuestionFlow(); }
  else if(a.type==="gap_affiches"){ celineFlow(); }
  else if(a.type==="signage"){ openSignage(); }
  else if(a.type==="travelMenu"){ openTravelMenu(); }
}

/* ----------------------------- Système de dialogue ----------------------------- */
let dlg = null;
function openDialog(speaker, lines, cls, onEnd){
  State.overlay = "dialog";
  dlg = { speaker, lines:[...lines], cls, idx:0, onEnd, typing:false };
  renderDialog();
}
function renderDialog(){
  const cls = dlg.cls ? " "+dlg.cls : "";
  const line = dlg.lines[dlg.idx];
  const isLast = dlg.idx >= dlg.lines.length-1;
  ui.innerHTML = `
    <div class="dialog-wrap">
      <div class="dialog">
        <div class="speaker${cls}">${esc(dlg.speaker)}</div>
        <div class="text" id="dtext"></div>
        <div class="nextcue">${isLast? "▶ Terminer (E)" : "▶ Suite (E)"}</div>
      </div>
    </div>`;
  typeText(document.getElementById("dtext"), line);
}
let typeTimer=null;
function typeText(el, txt){
  dlg.typing = true; el.textContent="";
  let i=0;
  clearInterval(typeTimer);
  typeTimer = setInterval(()=>{
    el.textContent = txt.slice(0,++i);
    if(i>=txt.length){ clearInterval(typeTimer); dlg.typing=false; }
  }, 14);
}
function advanceDialog(){
  if(!dlg) return;
  if(dlg.typing){ // compléter d'un coup
    clearInterval(typeTimer);
    document.getElementById("dtext").textContent = dlg.lines[dlg.idx];
    dlg.typing=false; return;
  }
  if(dlg.idx < dlg.lines.length-1){ dlg.idx++; renderDialog(); }
  else { const cb=dlg.onEnd; dlg=null; State.overlay=null; ui.innerHTML=""; cb&&cb(); }
}

/* ----------------------------- Flux Leslie ----------------------------- */
function leslieFlow(){
  if(!State.flags.metLeslie){
    State.flags.metLeslie = true;
    unlockNote("e_leslie");
    addExploration(8);
  }
  openDialog("Leslie", DIALOG.leslie, "", ()=>saveGame());
}

/* ----------------------------- Flux Jérôme + mission ESSOC ----------------------------- */
function jeromeFlow(){
  if(State.flags.missionDone){
    // Après ESSOC : Jérôme invite à reprendre la route (voiture à l'extérieur)
    if(State.flags.lienDone){
      openDialog("Jérôme", ["Les deux situations sont bien traitées. Écoute, droit à l'erreur, aller vers les gens : vous avez saisi l'essentiel de notre métier.","Vous pouvez revoir tous vos repères dans le carnet (touche J)."], "", ()=>{});
    } else {
      openDialog("Jérôme", DIALOG.jerome_road(State.player.name || "collègue"), "", ()=>{
        showToast("Sortez de l'agence et montez dans la voiture de service.");
      });
    }
    return;
  }
  State.flags.metJerome = true;
  unlockNote("m_jerome");
  const intro = DIALOG.jerome_intro(State.player.name || "collègue");
  openDialog("Jérôme", intro, "", ()=>{
    State.flags.missionStarted = true;
    openDialog("Situation", DIALOG.situation_intro, "gold", ()=>{
      startQuiz(QUESTION_ESSOC, "essoc");
    });
  });
}

/* ----------------------------- Fenêtre signalétique (overlay pixel art) ----------------------------- */
function openSignage(){
  State.overlay = "signage";
  markExplored("totem");
  unlockNote("sp_listen");
  const cards = SIGNAGE_POSTERS.map(p=>`
    <figure class="sign-card">
      <img src="${p.src}" alt="${esc(p.alt)}" loading="lazy">
    </figure>`).join("");
  ui.innerHTML = `
   <div class="signage-overlay" id="signov">
     <div class="signage-frame" role="dialog" aria-label="Signalétique de l'agence">
       <div class="signage-head">
         <h2>📌 Signalétique de l'agence</h2>
         <button class="x" id="signclose" aria-label="Fermer">✕</button>
       </div>
       <div class="signage-grid">${cards}</div>
       <div class="signage-foot"><kbd>E</kbd> ou <kbd>Échap</kbd> pour fermer</div>
     </div>
   </div>`;
  document.getElementById("signclose").addEventListener("click", closeSignage);
  document.getElementById("signov").addEventListener("click",(e)=>{ if(e.target.id==="signov") closeSignage(); });
}
function closeSignage(){ State.overlay=null; ui.innerHTML=""; }

/* ----------------------------- Menu de voyage (carte régionale) ----------------------------- */

/* Renvoie true si la mission principale de l'agence est accomplie */
function isAgenceDone(id){
  const f = State.flags;
  switch(id){
    case "avignon":    return !!f.missionDone;
    case "apt":        return !!f.lienDone;
    case "carpentras": return !!f.carpDone;
    case "orange":     return !!f.orangeDone;
    case "manosque":   return !!(f.manosqueMatchDone && f.manosqueQDone);
    case "coustellet": return !!(f.coustelletMatchDone && f.coustelletQDone);
    case "digne":      return !!(f.digneMatchDone && f.digneQDone);
    case "gap":        return !!(f.gapMatchDone && f.gapQDone);
    default:           return false;
  }
}

function openTravelMenu(){
  State.overlay = "travel";
  const pts = ACCUEIL_POINTS.map(p=>{
    const cur  = (p.id === currentAccueilId());
    const done = !cur && p.playable && isAgenceDone(p.id);
    const cls  = cur ? "cur" : (p.playable ? (done ? "ok done" : "ok") : "soon");
    const sub  = cur  ? "Vous êtes ici"
               : done ? "✓ Mission accomplie"
               : (p.playable ? (p.id==="apt" ? "Permanence Le Lien — disponible" : "Disponible") : "Bientôt disponible");
    return `<button class="dest ${cls}" data-id="${p.id}" ${(!p.playable||cur)?"disabled":""}
              style="left:${(p.pt.x*100).toFixed(2)}%;top:${(p.pt.y*100).toFixed(2)}%">
              <span class="pin"></span><span class="lab">${esc(p.nm)}<small>${sub}</small></span>
            </button>`;
  }).join("");
  ui.innerHTML = `
   <div class="travel-overlay" id="travov">
     <div class="travel-frame" role="dialog" aria-label="Carte régionale — choisir un lieu d'accueil">
       <div class="travel-head">
         <h2>🚗 Où souhaitez-vous vous rendre ?</h2>
         <button class="x" id="travclose" aria-label="Fermer">✕</button>
       </div>
       <div class="travel-map">
         <img src="assets/bg/carte.jpg" alt="Carte régionale MSA Alpes-Vaucluse">
         ${pts}
       </div>
       <div class="travel-foot">Choisissez un lieu d'accueil ouvert. D'autres communes arriveront prochainement.</div>
     </div>
   </div>`;
  document.getElementById("travclose").addEventListener("click", closeTravelMenu);
  document.getElementById("travov").addEventListener("click",(e)=>{ if(e.target.id==="travov") closeTravelMenu(); });
  wireTravelDestinations();
}

/* Câble chaque destination jouable de la carte vers son voyage. Le lieu où le
   joueur se trouve déjà est neutralisé. */
function wireTravelDestinations(){
  const here = currentAccueilId();
  const handlers = {
    carpentras: ()=> travelTo("carpentras"),
    orange:     ()=> travelTo("orange"),
    manosque:   ()=> travelTo("manosque"),
    coustellet: ()=> travelTo("coustellet"),
    digne:      ()=> travelTo("digne"),
    gap:        ()=> travelTo("gap"),
    apt:        ()=> travelTo("apt"),       // Apt = permanence Le Lien
    avignon:    ()=> travelTo("avignon"),
  };
  for(const p of ACCUEIL_POINTS){
    const el = document.querySelector(`.dest[data-id="${p.id}"]`);
    if(!el) continue;
    if(p.id===here){
      el.classList.remove("ok"); el.classList.add("cur"); el.disabled=true;
      el.querySelector(".lab small").textContent = "Vous êtes ici";
      continue;
    }
    if(p.playable && handlers[p.id]){
      const done = isAgenceDone(p.id);
      el.classList.remove("soon");
      el.classList.add("ok");
      if(done) el.classList.add("done"); else el.classList.remove("done");
      el.disabled = false;
      el.querySelector(".lab small").textContent = done
        ? "✓ Mission accomplie"
        : (p.id==="apt" ? "Permanence Le Lien — disponible" : "Disponible");
      el.addEventListener("click", handlers[p.id]);
    }
  }
}

/* Identifiant du lieu d'accueil correspondant à la scène courante */
function currentAccueilId(){
  switch(State.scene){
    case "exterior": case "hall": case "office": return "avignon";
    case "carpentras_ext": case "carpentras_hall": return "carpentras";
    case "orange_ext": case "orange_hall": return "orange";
    case "manosque_ext": case "manosque_hall": return "manosque";
    case "coustellet_ext": case "coustellet_hall": return "coustellet";
    case "digne_ext": case "digne_hall": return "digne";
    case "gap_ext": case "gap_hall": return "gap";
    case "lien_exterior": case "lien_interior": return "apt";
    default: return null;
  }
}
/* Point de départ (sur la carte) selon la scène courante */
function currentMapPoint(){
  const id = currentAccueilId();
  const p = ACCUEIL_POINTS.find(a=>a.id===id);
  return p ? p.pt : {x:AVIGNON_PT.x, y:AVIGNON_PT.y};
}

function closeTravelMenu(){ State.overlay=null; ui.innerHTML=""; }

/* Voyage générique vers une destination, avec animation de carte (voiture) */
function travelTo(destId){
  State.overlay=null; ui.innerHTML="";
  const from = currentMapPoint();
  const dest = ACCUEIL_POINTS.find(a=>a.id===destId);
  const to = dest ? dest.pt : {x:0.395,y:0.775};
  const label = dest ? ("Trajet vers " + dest.nm + "…") : "Trajet en cours…";
  startMapTravelTo(from, to, ()=>{
    if(destId==="apt"){
      // Permanence Le Lien : on arrive à l'EXTÉRIEUR du bus
      State.flags.lienOffered = true;
      unlockNote("l_mission");
      gotoScene("lien_exterior", SCENES.lien_exterior.spawn);
    } else if(destId==="carpentras"){
      State.flags.carpOffered = true;
      unlockNote("c_mission");
      gotoScene("carpentras_ext", SCENES.carpentras_ext.spawn);
    } else if(destId==="orange"){
      State.flags.orangeOffered = true;
      unlockNote("o_mission");
      gotoScene("orange_ext", SCENES.orange_ext.spawn);
    } else if(destId==="manosque"){
      State.flags.manosqueOffered = true;
      unlockNote("m_mission");
      gotoScene("manosque_ext", SCENES.manosque_ext.spawn);
    } else if(destId==="coustellet"){
      State.flags.coustelletOffered = true;
      unlockNote("cou_mission");
      gotoScene("coustellet_ext", SCENES.coustellet_ext.spawn);
    } else if(destId==="digne"){
      State.flags.digneOffered = true;
      unlockNote("dig_mission");
      gotoScene("digne_ext", SCENES.digne_ext.spawn);
    } else if(destId==="gap"){
      State.flags.gapOffered = true;
      unlockNote("gap_mission");
      gotoScene("gap_ext", SCENES.gap_ext.spawn);
    } else if(destId==="avignon"){
      // Retour à Avignon par la carte : on arrive à côté de la voiture (parking droit),
      // et non au centre (le spawn central n'est utilisé qu'à la toute première arrivée).
      gotoScene("exterior", {x:0.70, y:0.84});
    }
  }, label);
}

/* ----------------------------- Flux Mme Roux (mission Le Lien) ----------------------------- */
function rouxFlow(){
  if(State.flags.lienDone){
    openDialog("Mme Roux", DIALOG.roux_thanks, "", ()=>{});
    return;
  }
  State.flags.lienMet = true;
  // présentation puis indices de non-recours, puis QCM
  openDialog("Mme Roux", DIALOG.roux_intro, "", ()=>{
    unlockNote("l_nonrecours");
    openDialog("Mme Roux", DIALOG.roux_hint, "", ()=>{
      startQuiz(QUESTION_LIEN, "lien");
    });
  });
}

/* ----------------------------- QCM générique (2 situations) ----------------------------- */
let quiz = null;
function startQuiz(question, kind){
  State.overlay = "quiz";
  quiz = { answered:false, q:question, kind:kind };
  renderQuiz();
}
function renderQuiz(){
  const q = quiz.q;
  const items = q.choices.map(c=>`
    <button class="choice" data-k="${c.k}">
      <span class="key">${c.k}</span><span>${esc(c.text)}</span>
    </button>`).join("");
  ui.innerHTML = `
    <div class="dialog-wrap">
      <div class="dialog">
        <div class="speaker gold">Décision</div>
        <div class="text"><strong>${esc(q.prompt)}</strong></div>
        <div class="choices" id="choices">${items}</div>
      </div>
    </div>`;
  document.querySelectorAll("#choices .choice").forEach(b=>{
    b.addEventListener("click",()=>answerQuiz(b.dataset.k));
  });
}
function onQuizKey(code){
  if(State.overlay!=="quiz" || !quiz || quiz.answered) return;
  let k=null;
  if(/^Key[ABCD]$/.test(code)) k=code.slice(3);
  if(/^Digit[1-4]$/.test(code)) k="ABCD"[+code.slice(5)-1];
  if(k) answerQuiz(k);
}
function answerQuiz(k){
  if(quiz.answered) return;
  const q = quiz.q;
  const choice = q.choices.find(c=>c.k===k);
  if(!choice) return;
  const correct = choice.correct;
  quiz.answered = true;
  document.querySelectorAll("#choices .choice").forEach(b=>{
    b.disabled = true;
    const cc = q.choices.find(c=>c.k===b.dataset.k);
    if(cc.correct) b.classList.add("correct");
    else if(b.dataset.k===k) b.classList.add("wrong");
  });

  // Configuration par mission : flag de 2e essai, débrief, lignes de relance,
  // intervenant, notes débloquées et fonction de fin.
  const KIND = {
    essoc: { second:"secondAttempt",     who:"Jérôme",         retry:DIALOG.second_try,
             notes:["e_goodfaith","sp_all"], finish:finishMission, firstTryFlag:"firstTryCorrect" },
    lien:  { second:"lienSecondAttempt", who:"Inès"        ,  retry:DIALOG.lien_second_try,
             notes:["l_allervers","sp_all"], finish:finishLien },
    carp:  { second:"carpSecondAttempt", who:"Delphine"      ,retry:DIALOG.carp_second_try,
             notes:["c_transparence","sp_all"], finish:finishCarp },
    orange:{ second:"orangeSecondAttempt", who:"Pascale"       ,retry:DIALOG.orange_second_try,
             notes:["o_reformuler","sp_all"], finish:finishOrange },
    manosque:{ second:"manosqueQSecond", who:"Sophie", retry:DIALOG.manosque_second_try,
             notes:["m_sensible","sp_all"], finish:finishManosqueQuestion },
    coustellet:{ second:"coustelletQSecond", who:"Sanaa", retry:DIALOG.coustellet_second_try,
             notes:["cou_aidant","sp_all"], finish:finishCoustelletQuestion },
    digne:{ second:"digneQSecond", who:"Jennifer", retry:DIALOG.digne_second_try,
             notes:["dig_inclusion","sp_all"], finish:finishDigneQuestion },
    gap:{ second:"gapQSecond", who:"Coraline", retry:DIALOG.gap_second_try,
             notes:["gap_boucle","sp_all"], finish:finishGapQuestion },
    gap_affiches:{ second:"gapAffichesSecond", who:"Céline", retry:DIALOG.celine_second_try,
             notes:["gap_affiches","sp_all"], finish:finishGapAffiches },
  };
  const cfg = KIND[quiz.kind] || KIND.essoc;
  const secondFlag = cfg.second;

  setTimeout(()=>{
    if(correct){
      // scoring commun à toutes les situations
      if(!State.flags[secondFlag]){
        State.scores.exactitude = Math.max(State.scores.exactitude,100);
        State.scores.posture = Math.max(State.scores.posture,100);
        if(cfg.firstTryFlag) State.flags[cfg.firstTryFlag] = true;
      } else {
        State.scores.exactitude = Math.max(State.scores.exactitude,65);
        State.scores.posture = Math.max(State.scores.posture,75);
      }
      State.scores.efficacite = Math.max(State.scores.efficacite, State.flags[secondFlag] ? 70 : 100);
      cfg.notes.forEach(unlockNote);
      cfg.finish();
    } else {
      State.overlay = "dialog";
      State.flags[secondFlag] = true;
      openDialog(cfg.who, cfg.retry, "", ()=>{ startQuiz(q, quiz.kind); });
    }
  }, 850);
}

function finishMission(){
  State.overlay="dialog";
  openDialog("Jérôme", DIALOG.debrief, "green", ()=>{
    State.flags.missionDone = true;
    unlockNote("m_done");
    saveGame();
    showDossierStamp("✓ Régularisation en cours", ()=>{
      // Jérôme invite à reprendre la route : la voiture devient disponible à l'extérieur
      openDialog("Jérôme", DIALOG.jerome_road(State.player.name || "collègue"), "", ()=>{
        showToast("Sortez de l'agence et montez dans la voiture de service.");
      });
    });
  });
}

function finishLien(){
  State.overlay="dialog";
  openDialog("Inès", DIALOG.lien_debrief, "green", ()=>{
    openDialog("Mme Roux", DIALOG.roux_thanks, "", ()=>{
      State.flags.lienDone = true;
      unlockNote("l_done");
      saveGame();
      showDossierStamp("✓ Ouverture de droit engagée", ()=>{
        State.overlay=null; ui.innerHTML="";
      });
    });
  });
}

/* ----------------------------- Flux mission Carpentras (délais / réponse) ----------------------------- */
function carpFlow(){
  if(State.flags.carpDone){
    openDialog("Adhérent", DIALOG.carp_usager_thanks, "", ()=>{});
    return;
  }
  State.flags.carpMet = true;
  // l'agent introduit, puis l'adhérent expose sa situation, puis QCM
  openDialog("Delphine", DIALOG.carp_agent_intro, "", ()=>{
    unlockNote("c_delai");
    openDialog("Adhérent", DIALOG.carp_usager_intro, "", ()=>{
      startQuiz(QUESTION_CARP, "carp");
    });
  });
}

function finishCarp(){
  State.overlay="dialog";
  openDialog("Delphine", DIALOG.carp_debrief, "green", ()=>{
    openDialog("Adhérent", DIALOG.carp_usager_thanks, "", ()=>{
      State.flags.carpDone = true;
      unlockNote("c_done");
      saveGame();
      showDossierStamp("✓ Délai communiqué, dossier suivi", ()=>{
        State.overlay=null; ui.innerHTML="";
      });
    });
  });
}

/* ----------------------------- Flux mission Orange (langage clair) ----------------------------- */
function orangeFlow(){
  if(State.flags.orangeDone){
    openDialog("Adhérent", DIALOG.orange_usager_thanks, "", ()=>{});
    return;
  }
  State.flags.orangeMet = true;
  openDialog("Pascale", DIALOG.orange_agent_intro, "", ()=>{
    unlockNote("o_clair");
    openDialog("Adhérent", DIALOG.orange_usager_intro, "", ()=>{
      startQuiz(QUESTION_ORANGE, "orange");
    });
  });
}

function finishOrange(){
  State.overlay="dialog";
  openDialog("Pascale", DIALOG.orange_debrief, "green", ()=>{
    openDialog("Adhérent", DIALOG.orange_usager_thanks, "", ()=>{
      State.flags.orangeDone = true;
      unlockNote("o_done");
      saveGame();
      showDossierStamp("✓ Courrier expliqué en langage clair", ()=>{
        State.overlay=null; ui.innerHTML="";
      });
    });
  });
}

/* ----------------------------- Manosque : jeu 1 (classement par glisser-déposer) ----------------------------- */
function manosqueMatchFlow(){
  if(State.flags.manosqueMatchDone){
    // déjà fait : Alexia oriente vers Sophie
    openDialog("Alexia", ["Vous avez déjà brillamment relié nos actions à nos engagements !","Allez voir Sophie : elle accompagne Jean-Paul sur un cas plus délicat."], "", ()=>{});
    return;
  }
  State.flags.manosqueMet = true;
  openDialog("Alexia", DIALOG.alexia_intro, "", ()=>{
    unlockNote("m_match");
    openMatchGame();
  });
}

function finishMatchGame(){
  State.overlay="dialog";
  // scoring du jeu de classement (comme un QCM)
  if(!State.flags.manosqueMatchSecond){
    State.scores.exactitude = Math.max(State.scores.exactitude,100);
    State.scores.posture = Math.max(State.scores.posture,100);
  } else {
    State.scores.exactitude = Math.max(State.scores.exactitude,70);
    State.scores.posture = Math.max(State.scores.posture,80);
  }
  State.scores.efficacite = Math.max(State.scores.efficacite, State.flags.manosqueMatchSecond ? 70 : 100);
  openDialog("Alexia", DIALOG.alexia_debrief, "green", ()=>{
    State.flags.manosqueMatchDone = true;
    saveGame();
    showDossierStamp("✓ Actions reliées aux engagements", ()=>{
      State.overlay=null; ui.innerHTML="";
    });
  });
}

/* ----------------------------- Manosque : jeu 2 (question complexe, situation sensible) ----------------------------- */
function manosqueQuestionFlow(){
  if(!State.flags.manosqueMatchDone){
    // il faut d'abord faire le jeu d'Alexia
    openDialog("Sophie", ["Bonjour ! Avant qu'on étudie le cas de Jean-Paul, passez donc voir Alexia à l'accueil.","Son petit exercice vous mettra dans le bon état d'esprit."], "", ()=>{});
    return;
  }
  if(State.flags.manosqueQDone){
    openDialog("Jean-Paul", DIALOG.jeanpaul_thanks, "", ()=>{});
    return;
  }
  openDialog("Sophie", DIALOG.sophie_intro, "", ()=>{
    openDialog("Jean-Paul", DIALOG.jeanpaul_intro, "", ()=>{
      startQuiz(QUESTION_MANOSQUE, "manosque");
    });
  });
}

function finishManosqueQuestion(){
  State.overlay="dialog";
  openDialog("Sophie", DIALOG.manosque_debrief, "green", ()=>{
    openDialog("Jean-Paul", DIALOG.jeanpaul_thanks, "", ()=>{
      State.flags.manosqueQDone = true;
      unlockNote("m_done");
      saveGame();
      showDossierStamp("✓ Situation sensible prise en charge", ()=>{
        State.overlay=null; ui.innerHTML="";
      });
    });
  });
}

/* ----------------------------- Coustellet : jeu 1 (appariement, publics fragiles) ----------------------------- */
function coustelletMatchFlow(){
  if(State.flags.coustelletMatchDone){
    openDialog("Maria", ["Vous avez déjà su adapter chaque réponse à chaque personne !","Allez voir Sanaa : elle reçoit une dame dans une situation délicate."], "", ()=>{});
    return;
  }
  State.flags.coustelletMet = true;
  openDialog("Maria", DIALOG.maria_intro, "", ()=>{
    unlockNote("cou_adapter");
    openMatchGame(MATCH_COUSTELLET, "coustelletMatchSecond", finishCoustelletMatch);
  });
}

function finishCoustelletMatch(){
  State.overlay="dialog";
  if(!State.flags.coustelletMatchSecond){
    State.scores.exactitude = Math.max(State.scores.exactitude,100);
    State.scores.posture = Math.max(State.scores.posture,100);
  } else {
    State.scores.exactitude = Math.max(State.scores.exactitude,70);
    State.scores.posture = Math.max(State.scores.posture,80);
  }
  State.scores.efficacite = Math.max(State.scores.efficacite, State.flags.coustelletMatchSecond ? 70 : 100);
  openDialog("Maria", DIALOG.maria_debrief, "green", ()=>{
    State.flags.coustelletMatchDone = true;
    saveGame();
    showDossierStamp("✓ Chaque fragilité, sa réponse adaptée", ()=>{
      State.overlay=null; ui.innerHTML="";
    });
  });
}

/* ----------------------------- Coustellet : jeu 2 (QCM, proche aidant) ----------------------------- */
function coustelletQuestionFlow(){
  if(!State.flags.coustelletMatchDone){
    openDialog("Sanaa", ["Bonjour ! Avant ce cas délicat, passez donc voir Maria à l'accueil.","Son exercice vous mettra dans le bon état d'esprit."], "", ()=>{});
    return;
  }
  if(State.flags.coustelletQDone){
    openDialog("Adhérente", DIALOG.aidante_thanks, "", ()=>{});
    return;
  }
  openDialog("Sanaa", DIALOG.sanaa_intro, "", ()=>{
    openDialog("Adhérente", DIALOG.aidante_intro, "", ()=>{
      startQuiz(QUESTION_COUSTELLET, "coustellet");
    });
  });
}

function finishCoustelletQuestion(){
  State.overlay="dialog";
  openDialog("Sanaa", DIALOG.coustellet_debrief, "green", ()=>{
    openDialog("Adhérente", DIALOG.aidante_thanks, "", ()=>{
      State.flags.coustelletQDone = true;
      unlockNote("cou_done");
      saveGame();
      showDossierStamp("✓ Aidante accompagnée, secret préservé", ()=>{
        State.overlay=null; ui.innerHTML="";
      });
    });
  });
}

/* ----------------------------- Digne : jeu 1 (appariement, accompagnement numérique) ----------------------------- */
function digneMatchFlow(){
  if(State.flags.digneMatchDone){
    openDialog("Stéphanie", ["Vous avez déjà trouvé le bon niveau d'aide pour chaque usager !","Allez voir Jennifer, près du poste numérique : un monsieur a besoin d'aide."], "", ()=>{});
    return;
  }
  State.flags.digneMet = true;
  openDialog("Stéphanie", DIALOG.stephanie_intro, "", ()=>{
    unlockNote("dig_niveau");
    openMatchGame(MATCH_DIGNE, "digneMatchSecond", finishDigneMatch);
  });
}

function finishDigneMatch(){
  State.overlay="dialog";
  if(!State.flags.digneMatchSecond){
    State.scores.exactitude = Math.max(State.scores.exactitude,100);
    State.scores.posture = Math.max(State.scores.posture,100);
  } else {
    State.scores.exactitude = Math.max(State.scores.exactitude,70);
    State.scores.posture = Math.max(State.scores.posture,80);
  }
  State.scores.efficacite = Math.max(State.scores.efficacite, State.flags.digneMatchSecond ? 70 : 100);
  openDialog("Stéphanie", DIALOG.stephanie_debrief, "green", ()=>{
    State.flags.digneMatchDone = true;
    saveGame();
    showDossierStamp("✓ Le bon niveau d'aide pour chacun", ()=>{
      State.overlay=null; ui.innerHTML="";
    });
  });
}

/* ----------------------------- Digne : jeu 2 (QCM, exclusion numérique) ----------------------------- */
function digneQuestionFlow(){
  if(!State.flags.digneMatchDone){
    openDialog("Jennifer", ["Bonjour ! Avant ce cas, passez donc voir Stéphanie à l'accueil.","Son exercice vous mettra dans le bon état d'esprit."], "", ()=>{});
    return;
  }
  if(State.flags.digneQDone){
    openDialog("Adhérent", DIALOG.digne_usager_thanks, "", ()=>{});
    return;
  }
  openDialog("Jennifer", DIALOG.jennifer_intro, "", ()=>{
    openDialog("Adhérent", DIALOG.digne_usager_intro, "", ()=>{
      startQuiz(QUESTION_DIGNE, "digne");
    });
  });
}

function finishDigneQuestion(){
  State.overlay="dialog";
  openDialog("Jennifer", DIALOG.digne_debrief, "green", ()=>{
    openDialog("Adhérent", DIALOG.digne_usager_thanks, "", ()=>{
      State.flags.digneQDone = true;
      unlockNote("dig_done");
      saveGame();
      showDossierStamp("✓ Inclusion numérique réussie", ()=>{
        State.overlay=null; ui.innerHTML="";
      });
    });
  });
}

/* ----------------------------- Gap : jeu 1 (appariement, écoute -> levier) ----------------------------- */
function gapMatchFlow(){
  if(State.flags.gapMatchDone){
    openDialog("Angélique", ["Vous avez déjà transformé chaque retour en action concrète !","Allez voir Coraline, dans l'espace accompagnement, pour la suite."], "", ()=>{});
    return;
  }
  State.flags.gapMet = true;
  openDialog("Angélique", DIALOG.angelique_intro, "", ()=>{
    unlockNote("gap_levier");
    openMatchGame(MATCH_GAP, "gapMatchSecond", finishGapMatch);
  });
}

function finishGapMatch(){
  State.overlay="dialog";
  if(!State.flags.gapMatchSecond){
    State.scores.exactitude = Math.max(State.scores.exactitude,100);
    State.scores.posture = Math.max(State.scores.posture,100);
  } else {
    State.scores.exactitude = Math.max(State.scores.exactitude,70);
    State.scores.posture = Math.max(State.scores.posture,80);
  }
  State.scores.efficacite = Math.max(State.scores.efficacite, State.flags.gapMatchSecond ? 70 : 100);
  openDialog("Angélique", DIALOG.angelique_debrief, "green", ()=>{
    State.flags.gapMatchDone = true;
    saveGame();
    showDossierStamp("✓ Retours transformés en améliorations", ()=>{
      State.overlay=null; ui.innerHTML="";
    });
  });
}

/* ----------------------------- Gap : jeu 2 (QCM, boucle d'amélioration) ----------------------------- */
function gapQuestionFlow(){
  if(!State.flags.gapMatchDone){
    openDialog("Coraline", ["Bonjour ! Avant ma question, passez donc voir Angélique à l'accueil.","Son exercice vous mettra dans le bon état d'esprit."], "", ()=>{});
    return;
  }
  if(State.flags.gapQDone){
    openDialog("Coraline", DIALOG.coraline_thanks, "", ()=>{});
    return;
  }
  openDialog("Coraline", DIALOG.coraline_intro, "", ()=>{
    openDialog("Coraline", DIALOG.gap_question_intro, "", ()=>{
      startQuiz(QUESTION_GAP, "gap");
    });
  });
}

function finishGapQuestion(){
  State.overlay="dialog";
  openDialog("Coraline", DIALOG.gap_debrief, "green", ()=>{
    openDialog("Coraline", DIALOG.coraline_thanks, "", ()=>{
      State.flags.gapQDone = true;
      unlockNote("gap_done");
      saveGame();
      showDossierStamp("✓ Boucle d'amélioration activée", ()=>{
        State.overlay=null; ui.innerHTML="";
      });
    });
  });
}

/* ----------------------------- Gap : épreuve Céline (affiches obligatoires) ----------------------------- */
function celineFlow(){
  if(State.flags.gapAffichesDone){
    openDialog("Céline", DIALOG.celine_done, "", ()=>{});
    return;
  }
  if(!State.flags.gapQDone){
    openDialog("Céline", ["Bonjour ! Moi c'est Céline. Avant cette dernière épreuve, passez d'abord voir Coraline — elle a une question pour vous.", "Revenez me voir une fois que c'est fait !"], "", ()=>{});
    return;
  }
  // Premier passage ou retour après visite Avignon
  if(State.flags.gapAffichesStarted){
    openDialog("Céline", ["Alors, vous avez bien regardé le panneau d'Avignon ? Prêt(e) pour la question ?"], "", ()=>{
      startQuiz(QUESTION_GAP_AFFICHES, "gap_affiches");
    });
    return;
  }
  State.flags.gapAffichesStarted = true;
  openDialog("Céline", DIALOG.celine_intro, "", ()=>{
    unlockNote("gap_affiches");
    State.overlay = "dialog";
    ui.innerHTML = `
      <div class="dialog-wrap">
        <div class="dialog">
          <div class="speaker">Céline</div>
          <div class="text">Voulez-vous retourner à Avignon consulter le panneau d'entrée, ou êtes-vous prêt(e) à répondre maintenant ?</div>
          <div class="choices" id="celine-choices">
            <button class="choice" id="go-avignon"><span class="key">A</span><span>Aller revoir le panneau d'entrée d'Avignon</span></button>
            <button class="choice" id="answer-now"><span class="key">B</span><span>Je connais la réponse, je réponds maintenant</span></button>
          </div>
        </div>
      </div>`;
    document.getElementById("go-avignon").addEventListener("click", ()=>{
      State.overlay=null; ui.innerHTML="";
      openDialog("Céline", DIALOG.celine_hint_avignon, "", ()=>{
        showToast("Direction Avignon ! Consultez le panneau d'entrée, puis revenez à Gap.");
        travelTo("avignon");
      });
    });
    document.getElementById("answer-now").addEventListener("click", ()=>{
      State.overlay=null; ui.innerHTML="";
      startQuiz(QUESTION_GAP_AFFICHES, "gap_affiches");
    });
  });
}

function finishGapAffiches(){
  State.overlay="dialog";
  openDialog("Céline", DIALOG.celine_debrief, "green", ()=>{
    State.flags.gapAffichesDone = true;
    unlockNote("gap_affiches_done");
    saveGame();
    showDossierStamp("✓ Affiches obligatoires maîtrisées", ()=>{
      State.overlay=null; ui.innerHTML="";
    });
  });
}


/* ===================== Jeu de classement par glisser-déposer (Manosque) ===================== */
function openMatchGame(data, secondFlagKey, onFinish){
  State.overlay = "match";
  data = data || MATCH_MANOSQUE;
  secondFlagKey = secondFlagKey || "manosqueMatchSecond";
  onFinish = onFinish || finishMatchGame;
  // ordre d'affichage des engagements mélangé (déterministe mais brassé)
  const shuffled = data.engagements.slice();
  for(let i=shuffled.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }

  const rows = data.actions.map((a,idx)=>`
    <div class="mg-row">
      <div class="mg-action"><span class="mg-num">${idx+1}</span>${a.text}</div>
      <div class="mg-slot" data-action="${a.id}" aria-label="Déposer ici l'engagement"></div>
    </div>`).join("");

  const bank = shuffled.map(e=>`
    <div class="mg-chip" draggable="true" data-eng="${e.id}">${e.label}</div>`).join("");

  ui.innerHTML = `
   <div class="mg-overlay" id="mgov">
     <div class="mg-frame" role="dialog" aria-label="Jeu de correspondance">
       <div class="mg-head">
         <h2>🧩 Relier les actions aux engagements</h2>
         <button class="x" id="mgClose" aria-label="Fermer">✕</button>
       </div>
       <p class="mg-instr">${data.prompt}<br><span class="mg-hint">Faites glisser chaque engagement (en bas) dans la case en face de l'action correspondante.</span></p>
       <div class="mg-grid">${rows}</div>
       <div class="mg-bank" id="mgBank" aria-label="Engagements à placer">${bank}</div>
       <div class="mg-foot">
         <div class="mg-msg" id="mgMsg"></div>
         <button class="mg-validate" id="mgValidate" disabled>Valider</button>
       </div>
     </div>
   </div>`;

  const ov = document.getElementById("mgov");
  const bankEl = document.getElementById("mgBank");
  const validateBtn = document.getElementById("mgValidate");
  const msgEl = document.getElementById("mgMsg");
  let dragEl = null;

  function refreshValidate(){
    const placed = ov.querySelectorAll(".mg-slot .mg-chip").length;
    validateBtn.disabled = (placed !== data.actions.length);
  }

  // place une puce dans une cible (slot ou banque), en renvoyant l'ancienne occupante à la banque
  function placeChip(chip, target){
    if(target.classList.contains("mg-slot")){
      const existing = target.querySelector(".mg-chip");
      if(existing && existing!==chip) bankEl.appendChild(existing);
      target.appendChild(chip);
    } else {
      bankEl.appendChild(chip);
    }
    refreshValidate();
  }

  // ----- Drag & drop souris (HTML5) -----
  ov.querySelectorAll(".mg-chip").forEach(chip=>{
    chip.addEventListener("dragstart", e=>{ dragEl=chip; chip.classList.add("dragging"); e.dataTransfer.setData("text/plain", chip.dataset.eng); });
    chip.addEventListener("dragend", ()=>{ chip.classList.remove("dragging"); dragEl=null; });
  });
  const dropTargets = [...ov.querySelectorAll(".mg-slot"), bankEl];
  dropTargets.forEach(t=>{
    t.addEventListener("dragover", e=>{ e.preventDefault(); t.classList.add("mg-over"); });
    t.addEventListener("dragleave", ()=>{ t.classList.remove("mg-over"); });
    t.addEventListener("drop", e=>{ e.preventDefault(); t.classList.remove("mg-over"); if(dragEl) placeChip(dragEl, t); });
  });

  // ----- Drag & drop tactile (mobile) -----
  let touchChip=null, ghost=null;
  ov.querySelectorAll(".mg-chip").forEach(chip=>{
    chip.addEventListener("touchstart", e=>{
      touchChip=chip; const t=e.touches[0];
      ghost=chip.cloneNode(true); ghost.classList.add("mg-ghost");
      document.body.appendChild(ghost);
      moveGhost(t.clientX,t.clientY);
      chip.classList.add("dragging");
    }, {passive:true});
  });
  function moveGhost(x,y){ if(ghost){ ghost.style.left=x+"px"; ghost.style.top=y+"px"; } }
  ov.addEventListener("touchmove", e=>{
    if(!touchChip) return;
    const t=e.touches[0]; moveGhost(t.clientX,t.clientY);
    e.preventDefault();
  }, {passive:false});
  ov.addEventListener("touchend", e=>{
    if(!touchChip) return;
    const t=e.changedTouches[0];
    const el=document.elementFromPoint(t.clientX,t.clientY);
    const target = el ? el.closest(".mg-slot, #mgBank") : null;
    if(target) placeChip(touchChip, target);
    touchChip.classList.remove("dragging");
    if(ghost){ ghost.remove(); ghost=null; }
    touchChip=null;
  });

  document.getElementById("mgClose").addEventListener("click", ()=>{ closeMatchGame(); });

  validateBtn.addEventListener("click", ()=>{
    let allOk = true;
    ov.querySelectorAll(".mg-slot").forEach(slot=>{
      const chip = slot.querySelector(".mg-chip");
      const expect = data.actions.find(a=>a.id===slot.dataset.action).match;
      slot.classList.remove("mg-ok","mg-ko");
      if(chip && chip.dataset.eng===expect){ slot.classList.add("mg-ok"); }
      else { slot.classList.add("mg-ko"); allOk=false; }
    });
    if(allOk){
      msgEl.textContent = "Bravo, toutes les correspondances sont justes !";
      msgEl.className = "mg-msg ok";
      validateBtn.disabled = true;
      setTimeout(()=>{ State.overlay=null; ui.innerHTML=""; onFinish(); }, 1100);
    } else {
      State.flags[secondFlagKey] = true;
      msgEl.textContent = "Certaines correspondances sont incorrectes (en rouge). Corrigez-les et revalidez.";
      msgEl.className = "mg-msg ko";
      // on renvoie les puces mal placées à la banque après un court délai
      setTimeout(()=>{
        ov.querySelectorAll(".mg-slot.mg-ko .mg-chip").forEach(c=>bankEl.appendChild(c));
        ov.querySelectorAll(".mg-slot").forEach(s=>s.classList.remove("mg-ok","mg-ko"));
        refreshValidate();
      }, 1300);
    }
  });

  refreshValidate();
}
function closeMatchGame(){ State.overlay=null; ui.innerHTML=""; }

function showDossierStamp(label, onClose){
  State.overlay = "dialog";
  ui.innerHTML = `
   <div class="dialog-wrap">
    <div class="dialog" style="text-align:center">
      <div class="speaker green">Dossier</div>
      <div class="text" style="font-size:18px">
        Statut du dossier mis à jour :<br>
        <strong style="color:var(--msa-green-dark);font-size:24px;display:inline-block;margin-top:8px;
          border:3px solid var(--msa-green);padding:6px 18px;border-radius:10px;transform:rotate(-3deg)">
          ${esc(label)}</strong>
      </div>
      <div style="margin-top:14px">
        <button class="btn" id="endBtn">Continuer</button>
      </div>
    </div>
   </div>`;
  document.getElementById("endBtn").addEventListener("click",()=>{
    State.overlay=null; ui.innerHTML=""; onClose && onClose();
  });
}

/* ----------------------------- Carnet de mission ----------------------------- */
function unlockNote(id){ if(!State.notes[id]){ State.notes[id]=true; const n=findNote(id); if(n) showToast("Carnet : "+truncate(n.text,60)); saveGame(); } }
function findNote(id){
  for(const cat of Object.values(JOURNAL_NOTES)){
    const f = cat.find(n=>n.id===id); if(f) return f;
  }
  return null;
}
function markExplored(id){ if(!State.explored[id]){ State.explored[id]=true; addExploration(10); } }
function addExploration(pts){
  State.scores.exploration = Math.min(100, State.scores.exploration+pts);
  saveGame();
}

function toggleJournal(forceOpen){
  if(State.overlay==="journal" && !forceOpen){ closeJournal(); return; }
  if(State.screen!=="play" && !forceOpen) return;
  if(State.overlay && State.overlay!=="journal" && !forceOpen) return;
  State.overlay = "journal";
  renderJournal();
}
function closeJournal(){ State.overlay=null; ui.innerHTML=""; }
function renderJournal(){
  const sec = (title, notes) => {
    const items = notes.map(n=>{
      const got = State.notes[n.id];
      return `<div class="j-note${got?"":" locked"}">${got?esc(n.text):"— indice non découvert —"}</div>`;
    }).join("");
    return `<div class="j-section"><h3>${title}</h3>${items}</div>`;
  };
  const totalNotes = Object.values(JOURNAL_NOTES).flat().length;
  const got = Object.values(State.notes).filter(Boolean).length;
  const prog = Math.round(got/totalNotes*100);

  ui.innerHTML = `
  <div class="journal-overlay" id="jov">
    <div class="journal" role="dialog" aria-label="Carnet de mission">
      <div class="journal-head">
        <h2>📔 Carnet de mission</h2>
        <button class="x" id="jclose" aria-label="Fermer">✕</button>
      </div>
      <div class="journal-body">
        ${sec("Mission", JOURNAL_NOTES.mission)}
        ${sec("Repères ESSOC", JOURNAL_NOTES.essoc)}
        ${sec("Services Publics +", JOURNAL_NOTES.sp)}
        ${sec("Le Lien — aller vers", JOURNAL_NOTES.lien)}
        ${sec("Carpentras — délais & réponse", JOURNAL_NOTES.carpentras)}
        ${sec("Orange — langage clair", JOURNAL_NOTES.orange)}
        ${sec("Manosque — niveau avancé", JOURNAL_NOTES.manosque)}
        ${sec("Coustellet — publics fragiles", JOURNAL_NOTES.coustellet)}
        ${sec("Digne — accompagnement au numérique", JOURNAL_NOTES.digne)}
        ${sec("Gap — écoute & amélioration", JOURNAL_NOTES.gap)}
        <div class="j-section">
          <h3>Progression</h3>
          <div class="progress-row">
            <div class="progress-bar"><i style="width:${prog}%"></i></div>
            <strong>${prog}%</strong>
          </div>
          <p style="font-size:13px;color:#555;margin-top:6px">
            ${(()=>{ const m1=State.flags.missionDone, m2=State.flags.lienDone;
              if(m1&&m2) return "Les deux missions sont accomplies : régularisation ESSOC engagée et ouverture de droit pour Mme Roux.";
              if(m1) return "Mission ESSOC accomplie. Direction « Le Lien » pour la suite.";
              return "Mission ESSOC en cours."; })()}
          </p>
        </div>
        <div class="j-section">
          <h3>Scores</h3>
          <div class="scores-grid">
            ${scoreCard("Exactitude",State.scores.exactitude)}
            ${scoreCard("Posture de service",State.scores.posture)}
            ${scoreCard("Efficacité",State.scores.efficacite)}
            ${scoreCard("Exploration",State.scores.exploration)}
          </div>
        </div>
      </div>
    </div>
  </div>`;
  document.getElementById("jclose").addEventListener("click",closeJournal);
  document.getElementById("jov").addEventListener("click",(e)=>{ if(e.target.id==="jov") closeJournal(); });
}
function scoreCard(lbl,val){
  return `<div class="score-card"><div class="lbl">${lbl}</div><div class="val">${val}</div></div>`;
}

/* ----------------------------- Échap ----------------------------- */
function onEscape(){
  if(State.overlay==="signage"){ closeSignage(); return; }
  if(State.overlay==="journal"){ closeJournal(); return; }
  if(State.overlay==="match"){ closeMatchGame(); return; }
  if(State.overlay==="travel"){ closeTravelMenu(); return; }
  if(State.overlay==="dialog"){ /* laisser finir via E */ return; }
  if(State.screen==="play"){ /* future : menu pause */ }
}

/* ----------------------------- Indicateur d'interaction ----------------------------- */
function updateHint(){
  const z = (State.screen==="play" && !State.overlay) ? nearestZone() : null;
  if(z){
    const rect = canvas.getBoundingClientRect();
    hintEl.classList.remove("hidden");
    hintEl.innerHTML = `<kbd>E</kbd> ${esc(z.label)}`;
    // projX/projY tiennent compte du zoom + suivi caméra de la scène
    hintEl.style.left = (rect.left + projX(z.x)*view.scale) + "px";
    hintEl.style.top  = (rect.top + projY(z.y)*view.scale - 64) + "px";
  } else {
    hintEl.classList.add("hidden");
  }
}

/* ----------------------------- Bandeaux UI ----------------------------- */
let tagEl=null, jbtnEl=null;
function setSceneTag(show){
  if(!tagEl){
    tagEl=document.createElement("div"); tagEl.className="scene-tag";
    document.getElementById("app").appendChild(tagEl);
    jbtnEl=document.createElement("button"); jbtnEl.className="journal-btn";
    jbtnEl.innerHTML=`<kbd>J</kbd> Carnet`;
    jbtnEl.addEventListener("click",()=>toggleJournal());
    document.getElementById("app").appendChild(jbtnEl);
  }
  if(show && State.scene){
    tagEl.style.display="flex"; jbtnEl.style.display="flex";
    tagEl.innerHTML = `<span class="dot"></span>${esc(SCENES[State.scene].tag)}`;
    helpbar.classList.remove("hidden");
  } else {
    tagEl.style.display="none"; if(jbtnEl) jbtnEl.style.display="none";
    helpbar.classList.add("hidden");
    hintEl.classList.add("hidden");
  }
}

let toastT=null;
function showToast(msg){
  let el=document.querySelector(".toast");
  if(!el){ el=document.createElement("div"); el.className="toast"; document.getElementById("app").appendChild(el); }
  el.innerHTML = `📔 ${esc(msg)}`;
  el.style.opacity="1";
  clearTimeout(toastT);
  toastT=setTimeout(()=>{ el.style.transition="opacity .4s"; el.style.opacity="0"; }, 2600);
}

/* ----------------------------- Écran titre (calibré sur menu_principal) ----------------------------- */
function showTitle(){
  State.screen="title"; State.overlay=null; setSceneTag(false);
  const cont = hasSave();
  _menuUnbindCanvas();

  // Image de fond sur le canvas
  if(_menuBg){
    ctx.drawImage(_menuBg, 0, 0, GAME.baseW, GAME.baseH);
  }

  // Injecter les boutons HTML directement dans #ui (enfants directs = pointer-events ok)
  ui.innerHTML = `
    <div id="menu-bg-div" style="position:absolute;inset:0;background:url('menu_principal.png') center/cover no-repeat;"></div>
    <div id="menu-panel" style="
      position:absolute;
      left:8%; bottom:18%;
      display:flex; flex-direction:column; gap:10px;
      z-index:10;
    ">
      <button class="menu-btn-html" id="startBtn">▶ Nouvelle partie</button>
      <button class="menu-btn-html" id="contBtn" ${cont?'':'disabled'}>⊞ Continuer</button>
      <button class="menu-btn-html" id="creditsBtn">📖 Crédits</button>
    </div>
    ${cont ? '<button id="resetBtn" style="position:absolute;right:12px;bottom:8px;z-index:10;font-size:11px;background:rgba(0,0,0,0.5);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;">Effacer la sauvegarde</button>' : ''}
  `;

  document.getElementById("startBtn").onclick = () => {
    if(cont && !confirm("Démarrer une nouvelle partie ? La sauvegarde sera remplacée.")) return;
    newGame();
  };
  if(cont) document.getElementById("contBtn").onclick = continueGame;
  document.getElementById("creditsBtn").onclick = showCredits;
  const rb = document.getElementById("resetBtn");
  if(rb) rb.onclick = () => {
    if(confirm("Effacer définitivement la sauvegarde ?")){ eraseSave(); showTitle(); }
  };
}

/* ── Menu canvas helpers (conservés pour _menuBg) ─── */
let _menuBg = null;
let _menuClickHandler = null;
let _menuMoveHandler  = null;
function _menuUnbindCanvas(){
  if(_menuClickHandler){ canvas.removeEventListener("click",     _menuClickHandler); _menuClickHandler=null; }
  if(_menuMoveHandler) { canvas.removeEventListener("mousemove", _menuMoveHandler);  _menuMoveHandler=null;  }
  canvas.style.cursor = "";
}


/* ----------------------------- Page Crédits ----------------------------- */
function showCredits(){
  State.screen="credits"; State.overlay=null; setSceneTag(false);
  ui.innerHTML = `
   <div class="screen credits-screen">
     <div class="menu-bg dim" style="background-image:url('menu_principal.png')"></div>
     <div class="credits-card panel">
       <h2>Crédits</h2>

       <section class="cr-block">
         <h3>L'objectif du jeu</h3>
         <p>
           « Jeu MSA SP+ » est un jeu pédagogique qui met en situation les principes
           de <strong>Services Publics +</strong> et de la <strong>loi ESSOC</strong>
           (droit à l'erreur). À travers des situations concrètes du quotidien — accueil
           en agence, permanence du minibus « Le Lien » en milieu rural — il invite chacun
           à écouter, expliquer, orienter et accompagner les adhérents, pour renforcer la
           relation de confiance entre la MSA et ceux qu'elle sert.
         </p>
       </section>

       <section class="cr-block">
         <h3>Réalisation</h3>
         <p>
           Jeu conçu et réalisé sur son temps libre par <strong>Jérôme Mollé</strong>,
           avec le concours de l'intelligence artificielle.
         </p>
       </section>

       <div class="cr-logos">
         <a href="https://alpes-vaucluse.msa.fr/lfp/services-publics-plus" target="_blank" rel="noopener" class="cr-logo-link" aria-label="MSA Alpes-Vaucluse — Services Publics+">
           <img src="${LOGO_MSA_B64}" alt="Logo MSA" class="cr-logo-img">
         </a>
         <a href="https://www.service-public.gouv.fr/" target="_blank" rel="noopener" class="cr-logo-link" aria-label="Services Publics+">
           <img src="${LOGO_SP_B64}" alt="Logo Services Publics+" class="cr-logo-img">
         </a>
       </div>

       <div class="credits-actions">
         <button class="btn" id="creditsBack">← Retour au menu</button>
       </div>
     </div>
   </div>`;
  document.getElementById("creditsBack").addEventListener("click", showTitle);
}

/* ----------------------------- Création de profil ----------------------------- */
function showCreator(){
  State.screen="creator"; setSceneTag(false);
  const servicesOpts = SERVICES.map(s=>`<option>${esc(s)}</option>`).join("");
  ui.innerHTML = `
   <div class="screen">
     <div class="title-bg" style="background-image:url('assets/bg/hall.jpg')"></div>
     <div class="creator panel">
       <div>
         <div class="step-label">Création du profil</div>
         <h2>Votre identité à la MSA</h2>
       </div>

       <div class="field">
         <label class="step-label">Nom, prénom ou pseudonyme</label>
         <input id="nameIn" type="text" maxlength="24" placeholder="Ex. Camille, ou votre pseudo…" autocomplete="off">
       </div>

       <div class="field">
         <label class="step-label">Votre service</label>
         <select id="serviceIn">${servicesOpts}</select>
       </div>

       <div class="field">
         <label class="step-label">Votre personnage</label>
         <div class="gender-tabs" id="genderTabs">
           <button data-g="f" class="on">Personnage féminin</button>
           <button data-g="m">Personnage masculin</button>
         </div>
         <div class="char-grid" id="charGrid"></div>
       </div>

       <div class="creator-actions">
         <button class="btn ghost" id="backBtn">← Retour</button>
         <button class="btn" id="goBtn">Commencer la mission →</button>
       </div>
     </div>
   </div>`;

  let gender="f", charId=PLAYABLE.f[0].id;
  const grid=document.getElementById("charGrid");
  function renderChars(){
    grid.innerHTML = PLAYABLE[gender].map(c=>`
      <div class="char-opt${c.id===charId?" sel":""}" data-id="${c.id}" title="${esc(c.nm)}">
        <img src="assets/sprites/${c.id}_down.png" alt="${esc(c.nm)}">
      </div>`).join("");
    grid.querySelectorAll(".char-opt").forEach(o=>{
      o.addEventListener("click",()=>{ charId=o.dataset.id; renderChars(); });
    });
  }
  renderChars();
  document.querySelectorAll("#genderTabs button").forEach(b=>{
    b.addEventListener("click",()=>{
      gender=b.dataset.g;
      document.querySelectorAll("#genderTabs button").forEach(x=>x.classList.toggle("on",x===b));
      charId=PLAYABLE[gender][0].id; renderChars();
    });
  });
  document.getElementById("backBtn").addEventListener("click",showTitle);
  document.getElementById("goBtn").addEventListener("click",()=>{
    const nm=document.getElementById("nameIn").value.trim();
    State.player.name = nm || "Agent MSA";
    State.player.service = document.getElementById("serviceIn").value;
    State.player.gender = gender;
    State.player.charId = charId;
    unlockNote("m_intro");
    saveGame();
    // animation carte -> Avignon, puis extérieur
    ui.innerHTML="";
    startMapTravel(()=>{ gotoScene("exterior", SCENES.exterior.spawn); });
  });
}

/* ----------------------------- Démarrages ----------------------------- */
function newGame(){
  eraseSave();
  Object.assign(State.flags,{metLeslie:false,metJerome:false,missionStarted:false,missionDone:false,secondAttempt:false,firstTryCorrect:false,lienOffered:false,lienMet:false,lienDone:false,lienSecondAttempt:false,lienExtSeen:false,carpOffered:false,carpMet:false,carpDone:false,carpSecondAttempt:false,carpExtSeen:false,orangeOffered:false,orangeMet:false,orangeDone:false,orangeSecondAttempt:false,orangeExtSeen:false,manosqueOffered:false,manosqueMet:false,manosqueExtSeen:false,manosqueMatchDone:false,manosqueMatchSecond:false,manosqueQDone:false,manosqueQSecond:false,coustelletOffered:false,coustelletMet:false,coustelletExtSeen:false,coustelletMatchDone:false,coustelletMatchSecond:false,coustelletQDone:false,coustelletQSecond:false,digneOffered:false,digneMet:false,digneExtSeen:false,digneMatchDone:false,digneMatchSecond:false,digneQDone:false,digneQSecond:false,gapOffered:false,gapMet:false,gapExtSeen:false,gapMatchDone:false,gapMatchSecond:false,gapQDone:false,gapQSecond:false,gapAffichesDone:false,gapAffichesSecond:false,gapAffichesStarted:false,endingSequenceStarted:false});
  State.notes={}; State.explored={};
  State.scores={exactitude:0,posture:0,efficacite:0,exploration:0};
  showCreator();
}
function continueGame(){
  if(loadGame()){
    ui.innerHTML="";
    State.screen="play";
    resetCamera();
    setSceneTag(true);
    State.player.dir="down";
  } else { showTitle(); }
}

/* ----------------------------- Utilitaires ----------------------------- */
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function truncate(s,n){ return s.length>n? s.slice(0,n-1)+"…" : s; }

/* ----------------------------- Démarrage ----------------------------- */
function showFatal(msg){
  try{
    ui.innerHTML = `
    <div class="screen">
      <div class="panel" style="max-width:560px">
        <h2 style="color:var(--msa-blue-dark);margin-bottom:10px">Le jeu n'a pas pu démarrer</h2>
        <p style="font-size:15px;line-height:1.5">${esc(msg)}</p>
        <p style="font-size:14px;margin-top:14px;color:#555">
          Astuce : si vous avez ouvert <strong>index.html</strong> par double-clic,
          certains navigateurs bloquent les fichiers locaux. Lancez plutôt
          <strong>lancer.bat</strong> (Windows), ou un petit serveur :
          <code>python -m http.server 8000</code> puis ouvrez
          <code>http://localhost:8000</code>.
        </p>
      </div>
    </div>`;
  }catch(e){ /* dernier recours */ document.body.innerHTML = "<p style='color:#fff;padding:20px'>"+msg+"</p>"; }
}

async function init(){
  try{
    resize();
    bindTouch();
  }catch(e){ console.error(e); }

  // L'écran titre ne doit JAMAIS dépendre du chargement complet des images.
  // On l'affiche d'abord, puis on charge les assets en tâche de fond.
  try{
    showTitle();
  }catch(e){
    console.error(e);
    showFatal("Erreur d'initialisation : " + (e && e.message ? e.message : e));
    return;
  }

  requestAnimationFrame(loop);

  // chargement des assets (n'interrompt pas l'affichage du titre)
  try{
    await loadAllAssets();
    resize();
    // rafraîchir le fond du titre maintenant que les images sont prêtes
    if(State.screen==="title") showTitle();
  }catch(e){
    console.warn("Chargement des assets partiel :", e);
  }
}

/* ===========================================================================
   SÉQUENCE DE FIN — module ending
   Déclenchée quand toutes les épreuves sont validées et que le joueur
   sort de l'agence de Gap (dernière agence du parcours).
   =========================================================================== */

/* --- Configuration centralisée des durées et couleurs --- */
const ENDING_CONFIG = {
  msaBlue:           "#003592",
  msaBlueDark:       "#002570",
  gold:              "#F4B223",
  goldLight:         "#FFE08A",
  goldDark:          "#A86500",
  white:             "#FFFFFF",
  fadeDuration:      1300,
  blackDuration:     500,
  congratsDuration:  3500,
  fadeOutCongrats:   800,
  creditsDuration:   26000,
  logosDuration:     5500,
  logoFadeIn:        1000,
};

/* --- Data URIs des logos embarqués --- */
const LOGO_MSA_B64 = 'data:image/png;base64,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';
const LOGO_SP_B64  = 'data:image/png;base64,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';

/* --- Texte du générique --- */
const CREDITS_LINES = [
  { text:"MERCI AUX ÉQUIPES DE LA MSA", style:"title" },
  { text:"", style:"spacer" },
  { text:"Chaque jour, par votre écoute, votre professionnalisme et votre sens du service,", style:"body" },
  { text:"vous faites vivre la qualité de service auprès de nos adhérents.", style:"body" },
  { text:"", style:"spacer" },
  { text:"Derrière chaque accueil, chaque appel, chaque dossier traité", style:"body" },
  { text:"et chaque situation accompagnée, il y a des femmes et des hommes", style:"body" },
  { text:"pleinement engagés.", style:"body" },
  { text:"", style:"spacer" },
  { text:"La qualité de service repose sur cette attention quotidienne,", style:"body" },
  { text:"sur notre capacité à coopérer et sur notre volonté collective", style:"body" },
  { text:"de toujours progresser.", style:"body" },
  { text:"", style:"spacer" },
  { text:"Au-delà du label et de la médaille, l'essentiel demeure", style:"body" },
  { text:"l'engagement de chacun dans la bonne direction :", style:"body" },
  { text:"celle d'un service plus simple, plus proche,", style:"body" },
  { text:"plus accessible et plus humain.", style:"body" },
  { text:"", style:"spacer" },
  { text:"C'est cet engagement collectif, au service de nos adhérents", style:"body" },
  { text:"et de nos territoires, qui constitue notre véritable moteur.", style:"body" },
  { text:"", style:"spacer" },
  { text:"Merci à toutes et à tous pour votre implication,", style:"body" },
  { text:"votre solidarité et votre action au quotidien.", style:"body" },
  { text:"", style:"spacer" },
  { text:"", style:"spacer" },
  { text:"ENSEMBLE, CONTINUONS À FAIRE VIVRE", style:"title" },
  { text:"LA QUALITÉ DE SERVICE.", style:"title" },
];

/* --- État interne de la séquence --- */
let _endingEl = null;
let _endingTimers = [];
let _endingRAF = null;
let _returnEnabled = false;
let _endingKeyHandler = null;
let _endingClickHandler = null;
const PIXEL_FONT = '"Press Start 2P", monospace';

/* Formater un nombre avec séparateur de milliers français (espace insécable) */
function formatScore(n){
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

/* Calculer le score final : moyenne des 4 sous-scores */
function computeFinalScore(){
  const s = State.scores;
  return Math.round((s.exactitude + s.posture + s.efficacite + s.exploration) / 4);
}

/* Vérifier que toutes les épreuves sont terminées */
function checkAllChallengesCompleted(){
  // Vérifie uniquement les missions principales de chaque agence.
  // Les épreuves d'observation (signalétique, épreuve Céline…)
  // sont optionnelles et ne bloquent pas le générique de fin.
  const f = State.flags;
  return !!(
    f.missionDone        &&   // Avignon — ESSOC
    f.lienDone           &&   // Le Lien — non-recours
    f.carpDone           &&   // Carpentras — délais
    f.orangeDone         &&   // Orange — langage clair
    f.manosqueMatchDone  &&   // Manosque — correspondances
    f.manosqueQDone      &&   // Manosque — QCM situation sensible
    f.coustelletMatchDone&&   // Coustellet — publics fragiles
    f.coustelletQDone    &&   // Coustellet — proche aidant
    f.digneMatchDone     &&   // Digne — inclusion numérique
    f.digneQDone         &&   // Digne — QCM numérique
    f.gapMatchDone       &&   // Gap — retours usagers
    f.gapQDone                // Gap — boucle d'amélioration
  );
}

/* Enregistrer la complétion (date + score) dans la sauvegarde existante */
function saveCompletion(){
  const data = {
    v:1,
    player:  State.player,
    scene:   State.scene,
    flags:   State.flags,
    notes:   State.notes,
    explored:State.explored,
    scores:  State.scores,
    completedAt: new Date().toISOString(),
    finalScore:  computeFinalScore(),
  };
  const json = JSON.stringify(data);
  memSave = json;
  try{ if(LS) LS.setItem(GAME.saveKey, json); }catch(e){}
}

/* Timer sûr (référencé pour nettoyage) */
function endingTimeout(fn, ms){
  const id = setTimeout(fn, ms);
  _endingTimers.push(id);
  return id;
}

/* Nettoyer tous les ressources de la séquence de fin */
function cleanupEndingSequence(){
  _endingTimers.forEach(id => clearTimeout(id));
  _endingTimers = [];
  if(_endingRAF){ cancelAnimationFrame(_endingRAF); _endingRAF = null; }
  if(_endingKeyHandler){ window.removeEventListener("keydown", _endingKeyHandler); _endingKeyHandler = null; }
  if(_endingClickHandler && _endingEl){
    _endingEl.removeEventListener("click", _endingClickHandler);
    _endingEl.removeEventListener("touchstart", _endingClickHandler);
    _endingClickHandler = null;
  }
  if(_endingEl && _endingEl.parentNode){ _endingEl.parentNode.removeChild(_endingEl); _endingEl = null; }
  _returnEnabled = false;
}

/* -----------------------------------------------------------------------
   POINT D'ENTRÉE : déclenche toute la séquence de fin
   ----------------------------------------------------------------------- */
function startEndingSequence(){
  if(State.flags.endingSequenceStarted) return;
  State.flags.endingSequenceStarted = true;
  State.overlay = "ending";
  saveCompletion();
  lockPlayerControls();

  // Fondu vers le noir (utilise le div #fade existant du jeu)
  const fadeEl = ensureFade();
  fadeEl.style.transition = "opacity " + ENDING_CONFIG.fadeDuration + "ms ease";
  fadeEl.classList.add("on");

  endingTimeout(function(){
    endingTimeout(function(){
      buildEndingScene();
      showCongratulations();
    }, ENDING_CONFIG.blackDuration);
  }, ENDING_CONFIG.fadeDuration);
}

/* Bloquer les contrôles du joueur */
function lockPlayerControls(){
  Object.keys(keys).forEach(function(k){ keys[k] = false; });
  State.player.moving = false;
}

/* Créer la div racine de la séquence de fin */
function buildEndingScene(){
  cleanupEndingSequence();

  // Retirer le fondu de transition
  const fadeEl = document.getElementById("fade");
  if(fadeEl){ fadeEl.style.transition = "none"; fadeEl.classList.remove("on"); }

  _endingEl = document.createElement("div");
  _endingEl.id = "ending-scene";
  _endingEl.style.cssText = [
    "position:absolute;inset:0;z-index:50;",
    "background:" + ENDING_CONFIG.msaBlue + ";",
    "overflow:hidden;",
    "display:flex;flex-direction:column;align-items:center;justify-content:flex-start;",
  ].join("");
  document.getElementById("app").appendChild(_endingEl);
  setSceneTag(false);
  ui.innerHTML = "";
}

/* -----------------------------------------------------------------------
   ÉTAPE 1 : Félicitations BRAVO [NOM] + score
   ----------------------------------------------------------------------- */
function showCongratulations(){
  const playerName = (State.player.name || "Agent MSA").toUpperCase();
  const scoreStr   = formatScore(computeFinalScore());

  // Injecter la police pixel art si pas déjà présente
  if(!document.getElementById("pixel-font-link")){
    const lnk = document.createElement("link");
    lnk.id   = "pixel-font-link";
    lnk.rel  = "stylesheet";
    lnk.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
    document.head.appendChild(lnk);
  }

  const congrats = document.createElement("div");
  congrats.id = "ending-congrats";
  congrats.style.cssText = [
    "position:absolute;top:50%;left:50%;",
    "transform:translate(-50%,-50%) scale(0.7);",
    "text-align:center;",
    "opacity:0;",
    "transition:transform 600ms cubic-bezier(.22,1,.36,1), opacity 600ms ease;",
    "pointer-events:none;",
    "width:92%;max-width:920px;",
  ].join("");

  // Texte BRAVO en doré avec ombre relief pixel art (ombres franches)
  const bravoDiv = document.createElement("div");
  bravoDiv.style.cssText = [
    "font-family:"+PIXEL_FONT+";",
    "font-size:clamp(32px,6.5vw,82px);",
    "font-weight:900;",
    "letter-spacing:4px;",
    "text-transform:uppercase;",
    "color:" + ENDING_CONFIG.gold + ";",
    "text-shadow:",
    "  4px 4px 0 " + ENDING_CONFIG.goldDark + ",",
    "  -2px -2px 0 " + ENDING_CONFIG.goldDark + ",",
    "  2px -2px 0 " + ENDING_CONFIG.goldDark + ",",
    "  -2px  2px 0 " + ENDING_CONFIG.goldDark + ",",
    "  0 0 18px rgba(244,178,35,0.45);",
    "line-height:1.05;",
  ].join("");
  bravoDiv.textContent = "BRAVO " + playerName + " !";

  // Score final
  const scoreDiv = document.createElement("div");
  scoreDiv.style.cssText = [
    "font-family:"+PIXEL_FONT+";",
    "font-size:clamp(17px,2.8vw,34px);",
    "font-weight:700;",
    "color:" + ENDING_CONFIG.white + ";",
    "letter-spacing:2px;",
    "margin-top:22px;",
    "text-shadow:2px 2px 0 rgba(0,0,0,0.5);",
  ].join("");
  scoreDiv.textContent = "SCORE FINAL\u00a0: " + scoreStr + " POINTS";

  congrats.appendChild(bravoDiv);
  congrats.appendChild(scoreDiv);
  _endingEl.appendChild(congrats);

  // Déclencher l'animation d'apparition
  endingTimeout(function(){
    congrats.style.transform = "translate(-50%,-50%) scale(1)";
    congrats.style.opacity   = "1";
  }, 60);

  // Lancer le générique après la durée d'affichage
  endingTimeout(function(){
    startCreditsScroll(congrats);
  }, ENDING_CONFIG.congratsDuration);
}

/* -----------------------------------------------------------------------
   ÉTAPE 2 : Générique défilant de bas en haut
   ----------------------------------------------------------------------- */
function startCreditsScroll(congratsEl){
  // Disparition progressive du message de félicitations
  congratsEl.style.transition = "opacity " + ENDING_CONFIG.fadeOutCongrats + "ms ease";
  congratsEl.style.opacity = "0";
  endingTimeout(function(){
    if(congratsEl.parentNode) congratsEl.parentNode.removeChild(congratsEl);
  }, ENDING_CONFIG.fadeOutCongrats + 100);

  // Conteneur avec overflow:hidden pour masquer le hors-écran
  const creditsWrap = document.createElement("div");
  creditsWrap.style.cssText = "position:absolute;inset:0;overflow:hidden;";
  _endingEl.appendChild(creditsWrap);

  // Bloc de texte positionné absolument (animé par top)
  const creditsContent = document.createElement("div");
  creditsContent.style.cssText = [
    "position:absolute;left:50%;",
    "transform:translateX(-50%);",
    "width:min(780px,88vw);",
    "text-align:center;",
    "padding:0 20px 60px;",
  ].join("");

  CREDITS_LINES.forEach(function(line){
    const el = document.createElement("div");
    if(line.style === "title"){
      el.style.cssText = [
        "font-family:"+PIXEL_FONT+";",
        "font-size:clamp(19px,3vw,30px);",
        "font-weight:900;",
        "color:" + ENDING_CONFIG.white + ";",
        "letter-spacing:2px;",
        "margin:8px 0 5px;",
        "text-transform:uppercase;",
        "line-height:1.25;",
      ].join("");
    } else if(line.style === "spacer"){
      el.style.cssText = "height:clamp(12px,2vw,22px);display:block;";
    } else {
      el.style.cssText = [
        "font-family:"+PIXEL_FONT+";",
        "font-size:clamp(14px,2vw,21px);",
        "font-weight:400;",
        "color:rgba(255,255,255,0.90);",
        "line-height:1.7;",
        "margin:1px 0;",
      ].join("");
    }
    el.textContent = line.text;
    creditsContent.appendChild(el);
  });

  creditsWrap.appendChild(creditsContent);

  // Attendre que le DOM soit rendu pour mesurer la hauteur réelle
  endingTimeout(function(){
    const appH = document.getElementById("app").clientHeight || window.innerHeight;
    const contentH = creditsContent.scrollHeight;
    const startY = appH;
    const totalDist = startY + contentH + 60;

    creditsContent.style.top = startY + "px";
    var startTime = null;

    function animateCredits(ts){
      if(!startTime) startTime = ts;
      const elapsed  = ts - startTime;
      const progress = Math.min(1, elapsed / ENDING_CONFIG.creditsDuration);
      creditsContent.style.top = (startY - progress * totalDist) + "px";

      if(progress < 1){
        _endingRAF = requestAnimationFrame(animateCredits);
      } else {
        // Générique terminé -> transition vers les logos
        creditsWrap.style.transition = "opacity 600ms ease";
        creditsWrap.style.opacity = "0";
        endingTimeout(function(){
          if(creditsWrap.parentNode) creditsWrap.parentNode.removeChild(creditsWrap);
          showFinalLogos();
        }, 700);
      }
    }
    _endingRAF = requestAnimationFrame(animateCredits);
  }, 200);
}

/* -----------------------------------------------------------------------
   ÉTAPE 3 : Affichage des deux logos côte à côte
   ----------------------------------------------------------------------- */
function showFinalLogos(){
  const logosSection = document.createElement("div");
  logosSection.style.cssText = [
    "position:absolute;inset:0;",
    "display:flex;flex-direction:column;align-items:center;justify-content:center;",
    "gap:clamp(22px,4vw,48px);",
    "opacity:0;",
    "transition:opacity " + ENDING_CONFIG.logoFadeIn + "ms ease;",
  ].join("");

  // Rangée horizontale des logos
  const logoRow = document.createElement("div");
  logoRow.style.cssText = [
    "display:flex;flex-direction:row;align-items:center;justify-content:center;",
    "gap:clamp(28px,5vw,72px);flex-wrap:wrap;",
  ].join("");

  const imgMsa = document.createElement("img");
  imgMsa.src   = LOGO_MSA_B64;
  imgMsa.alt   = "MSA — santé famille retraite services";
  imgMsa.style.cssText = [
    "height:clamp(72px,11vw,148px);width:auto;",
    "object-fit:contain;",
    "image-rendering:pixelated;image-rendering:crisp-edges;",
    "border-radius:6px;",
  ].join("");

  // Séparateur doré vertical
  const sep = document.createElement("div");
  sep.setAttribute("aria-hidden","true");
  sep.style.cssText = [
    "width:3px;height:clamp(50px,9vw,110px);flex-shrink:0;",
    "background:linear-gradient(180deg,transparent," + ENDING_CONFIG.gold + ",transparent);",
  ].join("");

  const imgSp = document.createElement("img");
  imgSp.src   = LOGO_SP_B64;
  imgSp.alt   = "Services Publics+";
  imgSp.style.cssText = [
    "height:clamp(72px,11vw,148px);width:auto;",
    "object-fit:contain;",
    "image-rendering:pixelated;image-rendering:crisp-edges;",
    "border-radius:6px;",
  ].join("");

  logoRow.appendChild(imgMsa);
  logoRow.appendChild(sep);
  logoRow.appendChild(imgSp);

  // Message d'instruction discret
  const returnMsg = document.createElement("div");
  returnMsg.id = "ending-return-msg";
  returnMsg.style.cssText = [
    "color:rgba(255,255,255,0.50);",
    "font-family:"+PIXEL_FONT+";",
    "font-size:clamp(12px,1.7vw,17px);letter-spacing:1px;text-align:center;",
    "padding:0 20px;opacity:0;transition:opacity 600ms ease;",
  ].join("");
  const isTouchDevice = matchMedia("(pointer:coarse)").matches;
  returnMsg.textContent = isTouchDevice
    ? "Touchez l\'écran pour revenir au menu principal"
    : "Appuyez sur Entrée ou Espace pour revenir au menu principal";

  logosSection.appendChild(logoRow);
  logosSection.appendChild(returnMsg);
  _endingEl.appendChild(logosSection);

  endingTimeout(function(){
    logosSection.style.opacity = "1";
    endingTimeout(function(){
      returnMsg.style.opacity = "1";
    }, ENDING_CONFIG.logoFadeIn + 400);
  }, 60);

  // Activer le retour après la durée d'affichage des logos
  endingTimeout(function(){
    enableReturnToMenu();
  }, ENDING_CONFIG.logosDuration);
}

/* -----------------------------------------------------------------------
   ÉTAPE 4 : Autoriser le retour au menu
   ----------------------------------------------------------------------- */
function enableReturnToMenu(){
  _returnEnabled = true;

  _endingKeyHandler = function(e){
    if(!_returnEnabled) return;
    if(e.code === "Enter" || e.code === "Space"){
      e.preventDefault();
      doReturnToMenu();
    }
  };
  window.addEventListener("keydown", _endingKeyHandler);

  _endingClickHandler = function(e){
    if(!_returnEnabled) return;
    e.preventDefault();
    doReturnToMenu();
  };
  if(_endingEl){
    _endingEl.addEventListener("click",     _endingClickHandler);
    _endingEl.addEventListener("touchstart",_endingClickHandler, {passive:false});
  }
}

/* Effectuer le retour au menu avec fondu */
function doReturnToMenu(){
  if(!_returnEnabled) return;
  _returnEnabled = false;

  const fadeEl = ensureFade();
  fadeEl.style.transition = "opacity 600ms ease";
  fadeEl.classList.add("on");
  endingTimeout(function(){
    cleanupEndingSequence();
    const fe = document.getElementById("fade");
    if(fe){ fe.style.transition = "opacity .5s ease"; fe.classList.remove("on"); }
    State.overlay = null;
    State.screen  = "title";
    showTitle();
  }, 680);
}

/* Prise en charge de prefers-reduced-motion */
(function patchReducedMotion(){
  try{
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if(mq && mq.matches){
      ENDING_CONFIG.fadeDuration    = 300;
      ENDING_CONFIG.fadeOutCongrats = 150;
      ENDING_CONFIG.creditsDuration = 1;    // quasi-instantané
      ENDING_CONFIG.logoFadeIn      = 150;
    }
  }catch(e){}
})();

window.addEventListener("error", (ev)=>{
  console.error("Erreur:", ev.message);
});

init();

})();
