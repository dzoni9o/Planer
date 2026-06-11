const KAT_BOJE = {
  sklopka:  { color:'#4caf76', bg:'rgba(76,175,118,.15)',  icon:'⬜' },
  utičnica: { color:'#e8a030', bg:'rgba(232,160,48,.15)',  icon:'🔌' },
  usb:      { color:'#9b76c8', bg:'rgba(155,118,200,.15)', icon:'⚡' },
  data:     { color:'#5a9fd4', bg:'rgba(90,159,212,.15)',  icon:'🌐' },
  tel:      { color:'#8a9a82', bg:'rgba(138,154,130,.15)', icon:'📞' },
  antena:   { color:'#3abf9c', bg:'rgba(58,191,156,.15)',  icon:'📡' },
  audio:    { color:'#d45a4a', bg:'rgba(212,90,74,.15)',   icon:'🔊' },
  hdmi:     { color:'#4a8cd4', bg:'rgba(74,140,212,.15)',  icon:'🖥' },
  dimmer:   { color:'#d4882a', bg:'rgba(212,136,42,.15)',  icon:'💡' },
  detektor: { color:'#c8a030', bg:'rgba(200,160,48,.15)',  icon:'👁' },
  ostalo:   { color:'#6a7a64', bg:'rgba(106,122,100,.1)',  icon:'⚙' },
};

const KAT_UTICNICA = Object.keys(KAT_BOJE).find(k=>k.indexOf('uti')===0) || 'uticnica';
const KAT_ALIAS = {
  uticnica: KAT_UTICNICA,
};

function normalizeModule(m, serija){
  return {
    ...m,
    kod: String(m.kod || '').trim(),
    naziv: String(m.naziv || '').trim(),
    serija: String(m.serija || serija || '').trim().toUpperCase(),
    kat: KAT_ALIAS[m.kat] || m.kat || 'ostalo',
    vel: Number(m.vel) || 1,
    opis: String(m.opis || '').trim(),
  };
}

function readModuleCatalog(){
  const data = window.NIKVOLT_MODULES || {};
  const mode = Array.isArray(data.MODE) ? data.MODE : [];
  const exp = Array.isArray(data.EXP) ? data.EXP : [];
  return {
    mode: mode.map(m=>normalizeModule(m, 'MODE')).filter(m=>m.kod && m.naziv),
    exp: exp.map(m=>normalizeModule(m, 'EXP')).filter(m=>m.kod && m.naziv),
  };
}

const _MODULE_CATALOG = readModuleCatalog();
const MODULI_MODE = _MODULE_CATALOG.mode;
const MODULI_EXP = _MODULE_CATALOG.exp;
const SVI_MODULI = [...MODULI_MODE, ...MODULI_EXP];

// Ukupno zauzeto M u dozni
function zauzetM(box){
  return (box.moduli||[]).reduce((s,m)=>s+m.vel,0);
}
function slobodnoM(box){
  return (box.size||1) - zauzetM(box);
}


const LS_KEY = 'nikvolt_v5';
const MATERIJAL_ZIDA = {
  gips:    { label: 'Gipsana ploča',        icon: '⬜', opis: 'Suva gradnja' },
  cigla:   { label: 'Cigla / Blok',         icon: '🧱', opis: 'Zidani zid' },
  siporex: { label: 'Siporex / Ytong',      icon: '🪨', opis: 'Porozni blok' },
  beton:   { label: 'Beton',                icon: '⬛', opis: 'AB zid / ploča' },
};

function uid(){ return Math.random().toString(36).slice(2,8) }
let _tt;
function toast(m){
  const el=document.getElementById('toast');
  el.textContent=m; el.style.opacity='1';
  clearTimeout(_tt); _tt=setTimeout(()=>el.style.opacity='0',2200);
}
function hint(m){ document.getElementById('hint').textContent=m }


function _touchSrc(e){
  // touches[0] for touchstart/touchmove, changedTouches[0] for touchend, e for mouse
  if(e.touches && e.touches.length) return e.touches[0];
  if(e.changedTouches && e.changedTouches.length) return e.changedTouches[0];
  return e;
}

function svgPt(e){
  const svg=document.getElementById('svg');
  const r=svg.getBoundingClientRect();
  const src=_touchSrc(e);
  return screenToCanvas(src.clientX-r.left, src.clientY-r.top);
}

function svgPtRaw(e){
  const svg=document.getElementById('svg');
  const r=svg.getBoundingClientRect();
  const src=_touchSrc(e);
  return {x:src.clientX-r.left, y:src.clientY-r.top};
}
// Returns {x1,y1,x2,y2} of a wall
function wallSeg(r, wall){
  if(wall==='N') return {x1:r.x,       y1:r.y,        x2:r.x+r.wPx, y2:r.y};
  if(wall==='S') return {x1:r.x,       y1:r.y+r.hPx,  x2:r.x+r.wPx, y2:r.y+r.hPx};
  if(wall==='W') return {x1:r.x,       y1:r.y,        x2:r.x,        y2:r.y+r.hPx};
  if(wall==='E') return {x1:r.x+r.wPx, y1:r.y,        x2:r.x+r.wPx, y2:r.y+r.hPx};
}

// Wall length in meters
function wallLenM(r, wall){
  return (wall==='N'||wall==='S') ? r.wM : r.hM;
}

function elemWallPx(el){
  const r = S.rooms.find(x=>x.id===el.roomId);
  if(!r) return null;
  const seg = wallSeg(r, el.wall);
  const lenPx = Math.hypot(seg.x2-seg.x1, seg.y2-seg.y1);
  const lenM  = wallLenM(r, el.wall);
  const offPx = (el.offsetM / lenM) * lenPx;
  const t = el.fromCorner==='start' ? offPx : lenPx - offPx;

  // Wall-aligned position
  const wx = seg.x1 + (seg.x2-seg.x1)*(t/lenPx);
  const wy = seg.y1 + (seg.y2-seg.y1)*(t/lenPx);

  // Normal pointing INTO the room (opposite of outward normal)
  // N wall: outward=up(ny=-1), inward=down(ny=+1)
  // S wall: outward=down(ny=+1), inward=up(ny=-1)
  // W wall: outward=left(nx=-1), inward=right(nx=+1)
  // E wall: outward=right(nx=+1), inward=left(nx=-1)
  const inNx = el.wall==='W' ? 1 : (el.wall==='E' ? -1 : 0);
  const inNy = el.wall==='N' ? 1 : (el.wall==='S' ? -1 : 0);

  return {
    x: wx,
    y: wy,
    wall: el.wall,
    nx: inNx,
    ny: inNy,
  };
}

// Element position in px on canvas
function elemPx(el){
  const p = elemWallPx(el);
  if(!p) return null;
  const INSET = 15; // px inside room

  return {
    x: p.x + p.nx * INSET,
    y: p.y + p.ny * INSET,
    wall: p.wall,
    nx: p.nx,
    ny: p.ny,
  };
}

// Point to segment distance
function ptSegDist(px,py, x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1, l2=dx*dx+dy*dy;
  if(l2===0) return Math.hypot(px-x1,py-y1);
  const t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l2));
  return Math.hypot(px-(x1+t*dx), py-(y1+t*dy));
}

// Hit test: which wall did user tap?
function hitWall(pt){
  const tapR = WALL_TAP / S.vp.scale;
  for(const r of S.rooms){
    for(const wall of ['N','S','W','E']){
      const seg=wallSeg(r,wall);
      const d=ptSegDist(pt.x,pt.y, seg.x1,seg.y1,seg.x2,seg.y2);
      if(d < tapR) return {roomId:r.id, wall};
    }
  }
  return null;
}

// Hit test: which box?
function hitBox(pt){
  const PAD=6/S.vp.scale;
  for(const el of S.elements){
    if(el.type!=='box') continue;
    const p=elemPx(el);
    if(!p) continue;
    const cap=el.size||1;
    const SLOT_W=7, BASE_W=8, H=12;
    const boxW=BASE_W+(cap-1)*SLOT_W;
    const boxH=H;
    const isH=(el.wall==='N'||el.wall==='S');
    let rx,ry,rw,rh;
    if(isH){
      rx=p.x-boxW/2; ry=p.y+(p.ny>0?0:-boxH); rw=boxW; rh=boxH;
    } else {
      rx=p.x+(p.nx>0?0:-boxH); ry=p.y-boxW/2; rw=boxH; rh=boxW;
    }
    if(pt.x>=rx-PAD && pt.x<=rx+rw+PAD && pt.y>=ry-PAD && pt.y<=ry+rh+PAD) return el;
  }
  return null;
}

// Hit test: which room (interior)?
function hitRoom(pt){
  for(const r of S.rooms){
    if(pt.x>=r.x&&pt.x<=r.x+r.wPx&&pt.y>=r.y&&pt.y<=r.y+r.hPx) return r;
  }
  return null;
}

function hitRoomDragZone(pt){
  const margin = ROOM_DRAG_MARGIN / S.vp.scale;
  for(let i=S.rooms.length-1;i>=0;i--){
    const r=S.rooms[i];
    if(pt.x<r.x||pt.x>r.x+r.wPx||pt.y<r.y||pt.y>r.y+r.hPx) continue;
    const inset=Math.min(margin, r.wPx*0.28, r.hPx*0.28);
    if(pt.x>=r.x+inset&&pt.x<=r.x+r.wPx-inset&&pt.y>=r.y+inset&&pt.y<=r.y+r.hPx-inset) return r;
  }
  return null;
}

function intervalGap(a1,a2,b1,b2){
  if(a2<b1) return b1-a2;
  if(b2<a1) return a1-b2;
  return 0;
}

function roomsNearX(a,b){
  return intervalGap(a.x,a.x+a.wPx,b.x,b.x+b.wPx) <= SNAP_NEAR_PX;
}

function roomsNearY(a,b){
  return intervalGap(a.y,a.y+a.hPx,b.y,b.y+b.hPx) <= SNAP_NEAR_PX;
}

function snapRoom(room){
  const guides=[];
  for(const o of S.rooms){
    if(o.id===room.id) continue;

    if(roomsNearY(room,o)){
      const xPairs=[
        {myEdge:room.x+room.wPx, otherEdge:o.x,       set:()=>{ room.x=o.x-room.wPx }, axis:'v', val:o.x},
        {myEdge:room.x,          otherEdge:o.x+o.wPx, set:()=>{ room.x=o.x+o.wPx },    axis:'v', val:o.x+o.wPx},
      ];
      for(const p of xPairs){
        if(Math.abs(p.myEdge-p.otherEdge)<=SNAP_PX){
          p.set();
          guides.push({axis:p.axis, val:p.val});
        }
      }
      if(Math.abs(room.y-o.y)<=SNAP_PX) room.y=o.y;
      if(Math.abs(room.y+room.hPx-(o.y+o.hPx))<=SNAP_PX) room.y=o.y+o.hPx-room.hPx;
    }

    if(roomsNearX(room,o)){
      const yPairs=[
        {myEdge:room.y+room.hPx, otherEdge:o.y,        set:()=>{ room.y=o.y-room.hPx }, axis:'h', val:o.y},
        {myEdge:room.y,          otherEdge:o.y+o.hPx,  set:()=>{ room.y=o.y+o.hPx },    axis:'h', val:o.y+o.hPx},
      ];
      for(const p of yPairs){
        if(Math.abs(p.myEdge-p.otherEdge)<=SNAP_PX){
          p.set();
          guides.push({axis:p.axis, val:p.val});
        }
      }
      if(Math.abs(room.x-o.x)<=SNAP_PX) room.x=o.x;
      if(Math.abs(room.x+room.wPx-(o.x+o.wPx))<=SNAP_PX) room.x=o.x+o.wPx-room.wPx;
    }
  }
  // Clamp to canvas
  room.x=Math.max(0,room.x); room.y=Math.max(0,room.y);
  return guides;
}
function cablePath(pA, pB){
  // Offset from wall surface
  const OFF=10;
  const oA={x:pA.x+pA.nx*OFF, y:pA.y+pA.ny*OFF};
  const oB={x:pB.x+pB.nx*OFF, y:pB.y+pB.ny*OFF};
  // Route: exit wall → L-turn → enter wall
  const midX=(oA.x+oB.x)/2;
  const midY=(oA.y+oB.y)/2;
  let bend;
  // Prefer routing that makes a right angle outside both walls
  if(pA.wall==='N'||pA.wall==='S'){
    bend={x:oA.x, y:oB.y};
  } else {
    bend={x:oB.x, y:oA.y};
  }
  return [pA, oA, bend, oB, pB];
}

function pathLenM(pts, vertCorrection){
  let l=0;
  for(let i=1;i<pts.length;i++) l+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
  const corr = vertCorrection!==undefined ? vertCorrection : 0.3;
  return Math.round((l/PX_PER_M+corr)*10)/10;
}

function ptsToD(pts){
  return pts.map((p,i)=>`${i?'L':'M'}${Math.round(p.x)} ${Math.round(p.y)}`).join(' ');
}

// Full cable length including vertical runs:
// - spuštanje od svake dozne do poda (heightCm/100)
// - penjanje do zone provlačenja blizu plafona (2.7 - 0.2 = 2.5m od poda, tj. 2.5 - heightCm/100)
// - Ukupna vertikalna dionica = visina_A + (2.5 - visina_A) + (2.5 - visina_B) + visina_B
//   = 2 * 2.5 = 5m za svaku vezu? Ne — samo od dozne do zone i nazad.
// Ispravno: od dozne A gore do zone (2.5 - hA), horizontalno, dolje do dozne B (2.5 - hB)
// + od poda do dozne A (hA) + od poda do dozne B (hB) = 2.5 + 2.5 = 5m konstanta?
// Ne — vertikalno u zidu:
//   penjanje od dozne do zone: (ZONA_H - hA) + (ZONA_H - hB)
//   gdje je ZONA_H = 2.5m (zona provlačenja blizu plafona)
// Horizontalna dionica: Manhattan u tlocrtu
function cableLenM(conn){
  const eA=S.elements.find(x=>x.id===conn.aId);
  const eB=S.elements.find(x=>x.id===conn.bId);
  if(!eA||!eB) return 0;
  const pA=elemPx(eA), pB=elemPx(eB);
  if(!pA||!pB) return 0;
  const pts=cablePath(pA,pB);
  const horizM=pts.reduce((s,p,i)=>i===0?0:s+Math.hypot(p.x-pts[i-1].x,p.y-pts[i-1].y),0)/PX_PER_M;
  const ZONA_H=2.5; // m od poda do zone provlačenja
  const hA=(eA.heightCm||110)/100;
  const hB=(eB.heightCm||110)/100;
  const vertM=(ZONA_H-hA)+(ZONA_H-hB); // penjanje od obje dozne do zone
  return Math.round((horizM+vertM)*10)/10;
}

const VP_MIN = 0.25, VP_MAX = 4;

function applyVP(){
  const g = document.getElementById('g-vp');
  g.setAttribute('transform', `translate(${S.vp.x},${S.vp.y}) scale(${S.vp.scale})`);
}

let _zoomBadgeTimer;
function showZoomBadge(){
  const el = document.getElementById('zoom-badge');
  el.textContent = Math.round(S.vp.scale * 100) + '%';
  el.classList.add('visible');
  clearTimeout(_zoomBadgeTimer);
  _zoomBadgeTimer = setTimeout(()=>el.classList.remove('visible'), 1200);
}

// Convert screen point to canvas coords (accounting for VP transform)
function screenToCanvas(sx, sy){
  return { x: (sx - S.vp.x) / S.vp.scale, y: (sy - S.vp.y) / S.vp.scale };
}

// Zoom around a focal point (screen coords)
function zoomAt(sx, sy, delta){
  const oldScale = S.vp.scale;
  let newScale = Math.min(VP_MAX, Math.max(VP_MIN, oldScale * delta));
  // Keep focal point stationary
  S.vp.x = sx - (sx - S.vp.x) * (newScale / oldScale);
  S.vp.y = sy - (sy - S.vp.y) * (newScale / oldScale);
  S.vp.scale = newScale;
  applyVP();
  showZoomBadge();
}

const BOX_STATUS = {
  nova:          {label:'Nova',               color:'#4caf76', fill:'rgba(20,40,28,.92)'},
  postojeca_bez: {label:'Postoji (bez nap.)', color:'#5a9fd4', fill:'rgba(18,28,42,.92)'},
  postojeca_sa:  {label:'Postoji (sa nap.)',  color:'#8ab4d8', fill:'rgba(18,28,42,.92)'},
  tabla:         {label:'Razvodna tabla',     color:'#e8c44a', fill:'rgba(38,32,14,.92)'},
};

// ═══════════════════════════════════════════════════════
// SHEET — bottom drawer + tap system
// ═══════════════════════════════════════════════════════

// Block ghost clicks (synth click 300ms after touchend)
document.addEventListener('click', e=>{
  if(Date.now()-_lastTouchEnd < 400) e.stopPropagation();
}, true);

// ── addTap ───────────────────────────────────────────────
// Attaches a single-fire tap handler to an SVG/DOM element.
// Handles both touch and mouse without double-fire.
function addTap(el, handler){
  let _sx=0, _sy=0;

  el.addEventListener('touchstart', e=>{
    _sx=e.touches[0].clientX;
    _sy=e.touches[0].clientY;
  }, {passive:true});

  el.addEventListener('touchend', e=>{
    const dx=e.changedTouches[0].clientX-_sx;
    const dy=e.changedTouches[0].clientY-_sy;
    if(Math.hypot(dx,dy)>12) return; // scroll, not tap
    e.preventDefault();
    e.stopPropagation();
    _lastTouchEnd=Date.now();
    handler(e);
  }, {passive:false});

  // Mouse only (no touch device)
  el.addEventListener('click', e=>{
    if(Date.now()-_lastTouchEnd < 400) return; // ghost click
    e.stopPropagation();
    handler(e);
  });
}

// ── Sheet open/close ─────────────────────────────────────
function openSheet(html){
  const body=document.getElementById('sheet-body');
  body.innerHTML=`
    <div class="sheet-handle-wrap" id="sheet-handle-wrap">
      <div class="sheet-handle"></div>
    </div>
    <div class="sheet-inner">${html}</div>`;
  document.getElementById('sheet-bg').classList.add('open');
  body.querySelector('.sheet-inner').scrollTop=0;
  initSheetSwipe();
  _attachSheetDelegation(body.querySelector('.sheet-inner'));
}

function closeSheet(){
  document.getElementById('sheet-bg').classList.remove('open');
}

// Close on backdrop tap
const sheetBackdrop=document.getElementById('sheet-bg');
let sheetBackdropStarted=false;
sheetBackdrop.addEventListener('pointerdown', e=>{
  sheetBackdropStarted = e.target === sheetBackdrop;
});
sheetBackdrop.addEventListener('pointercancel', ()=>{
  sheetBackdropStarted = false;
});
sheetBackdrop.addEventListener('click', e=>{
  if(sheetBackdropStarted && e.target===sheetBackdrop) closeSheet();
  sheetBackdropStarted = false;
});

// Swipe handle down to close
function initSheetSwipe(){
  const handle=document.getElementById('sheet-handle-wrap');
  if(!handle) return;
  let sy=0;
  handle.addEventListener('touchstart', e=>{ sy=e.touches[0].clientY; }, {passive:true});
  handle.addEventListener('touchend', e=>{
    if(e.changedTouches[0].clientY - sy > 60) closeSheet();
  }, {passive:true});
  handle.addEventListener('mousedown', e=>{ sy=e.clientY; });
  handle.addEventListener('mouseup',   e=>{ if(e.clientY-sy>60) closeSheet(); });
}

// ── Sheet event delegation ────────────────────────────────
function _attachSheetDelegation(inner){
  const ATTRS='[data-del-idx],[data-add-kod],[data-action],[data-corner],[data-mat],[data-size]';

  function dispatch(e){
    const t=e.target.closest(ATTRS);
    if(!t) return;
    e.stopPropagation();

    if(t.dataset.delIdx!==undefined){ ukloniModul(parseInt(t.dataset.delIdx)); return; }
    if(t.dataset.addKod){ dodajModul(t.dataset.addKod); return; }
    if(t.dataset.corner){ selCorner(t); return; }

    const act=t.dataset.action;
    if(!act) return;
    const [fn,...args]=act.split(':');
    switch(fn){
      case 'setSerijaMode':     setSerijaMode(); break;
      case 'setSerijaExp':      setSerijaExp(); break;
      case 'closeSheet':        closeSheet(); break;
      case 'confirmAddRoom':    confirmAddRoom(); break;
      case 'confirmEditRoom':   confirmEditRoom(args[0]); break;
      case 'confirmDeleteRoom': confirmDeleteRoom(args[0]); break;
      case 'confirmAddBox':     confirmAddBox(args[0],args[1]); break;
      case 'confirmAddDoor':    confirmAddDoor(args[0],args[1]); break;
      case 'confirmAddWindow':  confirmAddWindow(args[0],args[1]); break;
      case 'confirmVeza':       confirmVeza(args[0],args[1]); break;
      case 'cancelVeza':        cancelVeza(); break;
      case 'obrisiVezu':        obrisiVezu(args[0]); break;
      case 'saveBoxEdit':       saveBoxEdit(args[0]); break;
      case 'deleteElem':        deleteElem(args[0]); break;
      case 'setKonfKat':        setKonfKat(args[0]); break;
      case 'setKonfSerija':     setKonfSerija(args[0]); break;
      case 'selKabl':           selKabl(parseInt(args[0])); break;
      case 'selCorner':         selCorner(t); break;
      case 'selOpeningOption':  selOpeningOption(t); break;
      case 'selMat':            selMat(t); break;
      case 'selSize':           selSize(t); break;
    }
  }

  // Touch tap — scroll-safe
  let _tY=0;
  inner.addEventListener('touchstart', e=>{ _tY=e.touches[0].clientY; }, {passive:true});
  inner.addEventListener('touchend', e=>{
    if(!e.target.closest(ATTRS)) return;
    if(Math.abs(e.changedTouches[0].clientY-_tY)>10) return;
    e.preventDefault();
    e.stopPropagation();
    _lastTouchEnd=Date.now();
    dispatch(e);
  }, {passive:false});

  // Mouse click (no ghost after touch)
  inner.addEventListener('click', e=>{
    if(Date.now()-_lastTouchEnd<400) return;
    dispatch(e);
  });
}

function setToolbarDefault(){
  document.getElementById('toolbar').className='toolbar';
  S.selWall=null;
  hint('Tapni zid za doznu, ili dodaj prostoriju');
}
function setToolbarWall(roomId, wall){
  S.selWall={roomId,wall};
  const r=S.rooms.find(x=>x.id===roomId);
  const wLabels={N:'Severni (gornji)',S:'Južni (donji)',W:'Zapadni (lijevi)',E:'Istočni (desni)'};
  document.getElementById('wall-sel-label').textContent=`Zid ${wall} · ${wLabels[wall]}`;
  document.getElementById('toolbar').className='toolbar ctx-wall';
  // Update wall toggle button
  const isOpen=(r?.openWalls||[]).includes(wall);
  const btn=document.getElementById('btn-toggle-wall');
  if(btn){
    btn.title=isOpen?'Vrati zid':'Ukloni zid';
    btn.style.opacity=isOpen?'0.45':'1';
  }
  hint('Selektovan: '+r?.name+' · Zid '+wall+(isOpen?' · OTVOREN':''));
}

function toggleWallOpen(){
  if(!S.selWall) return;
  const {roomId, wall}=S.selWall;
  const r=S.rooms.find(x=>x.id===roomId);
  if(!r) return;
  if(!r.openWalls) r.openWalls=[];
  const idx=r.openWalls.indexOf(wall);
  if(idx>=0){
    r.openWalls.splice(idx,1);
    toast(`Zid ${wall} vraćen`);
  } else {
    r.openWalls.push(wall);
    toast(`Zid ${wall} uklonjen`);
  }
  saveState();
  setToolbarWall(roomId, wall); // refresh button state
  render();
}
function setToolbarConnect(){
  S.connectMode=true; S.connectFrom=null;
  document.getElementById('toolbar').className='toolbar ctx-connect';
  document.getElementById('conn-hint-label').innerHTML='<strong>Poveži dozne</strong>Tapni prvu doznu';
  hint('Poveži: tapni prvu doznu');
}
function exitConnect(){
  S.connectMode=false; S.connectFrom=null;
  setToolbarDefault(); render();
}
function clearSel(){
  setToolbarDefault(); render();
}

function promptAddRoom(){
  openSheet(`
    <div class="sheet-title">＋ Nova prostorija</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="fg">
        <div class="fl">Naziv</div>
        <input class="fi" id="f-name" placeholder="Dnevna soba" value="">
      </div>
      <div class="form-row">
        <div class="fg">
          <div class="fl">Širina (m)</div>
          <input class="fi" id="f-wm" type="number" inputmode="decimal" step="0.1" value="4.5" min="1" max="30">
        </div>
        <div class="fg">
          <div class="fl">Dubina (m)</div>
          <input class="fi" id="f-hm" type="number" inputmode="decimal" step="0.1" value="3.8" min="1" max="30">
        </div>
      </div>
      <div class="sheet-actions">
        <button class="btn btn-primary" data-action="confirmAddRoom">Dodaj prostoriju</button>
        <button class="btn btn-ghost" data-action="closeSheet">Otkaži</button>
      </div>
    </div>
  `);
  setTimeout(()=>document.getElementById('f-name')?.focus(),120);
}

function confirmAddRoom(){
  const name=(document.getElementById('f-name').value.trim())||('Prostorija '+S.nextRoom);
  const wM=parseFloat(document.getElementById('f-wm').value)||4.5;
  const hM=parseFloat(document.getElementById('f-hm').value)||3.8;
  const wPx=Math.round(wM*PX_PER_M);
  const hPx=Math.round(hM*PX_PER_M);
  const svg=document.getElementById('svg');
  const cw=svg.clientWidth, ch=svg.clientHeight;
  // Place rooms side by side automatically
  const placed=S.rooms.length;
  let x=20+placed*(wPx+16);
  let y=Math.max(20,(ch-hPx)/2);
  if(x+wPx>cw-20){ x=20; y+=hPx+16; }
  S.rooms.push({id:'r'+uid(),name,x,y,wPx,hPx,wM,hM});
  S.nextRoom++;
  closeSheet();
  toast(name+' · '+wM+'×'+hM+' m');
  setToolbarDefault();
  render();
  saveState();
}
function promptEditRoom(rid){
  const r=S.rooms.find(x=>x.id===rid);
  if(!r) return;
  const boxCount=S.elements.filter(e=>e.roomId===rid&&e.type==='box').length;
  openSheet(`
    <div class="sheet-title">⬜ ${r.name}</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="fg">
        <div class="fl">Naziv</div>
        <input class="fi" id="er-name" value="${r.name}">
      </div>
      <div class="form-row">
        <div class="fg">
          <div class="fl">Širina (m)</div>
          <input class="fi" id="er-wm" type="number" inputmode="decimal" step="0.1" value="${r.wM}" min="1" max="30">
        </div>
        <div class="fg">
          <div class="fl">Dubina (m)</div>
          <input class="fi" id="er-hm" type="number" inputmode="decimal" step="0.1" value="${r.hM}" min="1" max="30">
        </div>
      </div>
      ${boxCount?`<div style="font-size:10px;color:var(--text2);background:var(--surface3);border-radius:6px;padding:8px 10px;line-height:1.6">
        ⚠️ Prostorija ima <strong style="color:var(--text)">${boxCount} dozni</strong>.<br>
        Dozne koje izlaze van novog zida biće obrisane.
      </div>`:''}
      <div class="sheet-actions">
        <button class="btn btn-primary" data-action="confirmEditRoom:${rid}">Sačuvaj</button>
        <button class="btn btn-danger" data-action="confirmDeleteRoom:${rid}">Obriši sobu</button>
      </div>
      <button class="btn btn-ghost" style="justify-content:center" data-action="closeSheet">Otkaži</button>
    </div>
  `);
}

function confirmEditRoom(rid){
  const r=S.rooms.find(x=>x.id===rid);
  if(!r) return;
  const newName=document.getElementById('er-name').value.trim()||r.name;
  const newWM=parseFloat(document.getElementById('er-wm').value)||r.wM;
  const newHM=parseFloat(document.getElementById('er-hm').value)||r.hM;

  // Find boxes that fall outside new dimensions
  const outside=S.elements.filter(e=>{
    if(e.roomId!==rid||e.type!=='box') return false;
    const lenM=(e.wall==='N'||e.wall==='S')?newWM:newHM;
    return e.offsetM>=lenM;
  });

  if(outside.length){
    const names=outside.map(e=>e.code).join(', ');
    const outIds=outside.map(e=>e.id);
    S.connections=S.connections.filter(c=>!outIds.includes(c.aId)&&!outIds.includes(c.bId));
    S.elements=S.elements.filter(e=>!outIds.includes(e.id));
    toast(`${outside.length} dozna obrisana (${names}) — izlazila van zida`);
  }

  r.name=newName;
  r.wM=newWM; r.hM=newHM;
  r.wPx=Math.round(newWM*PX_PER_M);
  r.hPx=Math.round(newHM*PX_PER_M);

  closeSheet(); setToolbarDefault(); render();
  toast(newName+' · '+newWM+'×'+newHM+' m');
  saveState();
}

function confirmDeleteRoom(rid){
  const elIds=S.elements.filter(e=>e.roomId===rid).map(e=>e.id);
  S.connections=S.connections.filter(c=>!elIds.includes(c.aId)&&!elIds.includes(c.bId));
  S.elements=S.elements.filter(e=>e.roomId!==rid);
  S.rooms=S.rooms.filter(r=>r.id!==rid);
  closeSheet(); setToolbarDefault(); render();
  toast('Prostorija obrisana');
  saveState();
}

function promptAddBox(){
  if(!S.selWall) return;
  // Ako serija nije odabrana — pitaj prvo
  if(!S.serija){ promptSelectSerija(); return; }
  _openAddBoxSheet();
}

function promptSelectSerija(){
  openSheet(`
    <div class="sheet-title">Odaberi seriju</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:16px;line-height:1.6">
      Serija važi za cijeli projekat. Moduli i nosači moraju biti iz iste serije — ne mogu se miješati.
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">

      <div class="katalog-item" data-action="setSerijaMode" style="border:2px solid #1D9E75;padding:14px">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(29,158,117,.15);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🔲</div>
        <div class="modul-info">
          <div class="modul-naziv" style="font-size:13px;color:#1D9E75">Aling MODE</div>
          <div class="modul-opis">Standardna linija · okrugli dizajn · 1M–2M fiksni nosač</div>
        </div>
      </div>

      <div class="katalog-item" data-action="setSerijaExp" style="border:2px solid #378ADD;padding:14px">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(55,138,221,.15);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🔳</div>
        <div class="modul-info">
          <div class="modul-naziv" style="font-size:13px;color:#378ADD">Aling Experience</div>
          <div class="modul-opis">Premium linija · ravni dizajn · veći izbor modula</div>
        </div>
      </div>
    </div>
    <button class="btn btn-ghost" data-action="closeSheet" style="width:100%;justify-content:center">Otkaži</button>
  `);
}

function setSerijaMode(){ S.serija='MODE'; saveState(); toast('Serija: Aling MODE'); _openAddBoxSheet(); }
function setSerijaExp(){  S.serija='EXP';  saveState(); toast('Serija: Aling Experience'); _openAddBoxSheet(); }

function _openAddBoxSheet(){
  const {roomId,wall}=S.selWall;
  const r=S.rooms.find(x=>x.id===roomId);
  const lenM=wallLenM(r,wall);
  const isHoriz=(wall==='N'||wall==='S');
  const corner1=isHoriz?'Lijevi ugao':'Gornji ugao';
  const corner2=isHoriz?'Desni ugao':'Donji ugao';
  const defaultMat = r.materijal || 'cigla';
  const serijaLabel = S.serija==='MODE' ? '🔲 MODE' : '🔳 EXP';
  const serijaColor = S.serija==='MODE' ? '#1D9E75' : '#378ADD';

  openSheet(`
    <div class="sheet-title">⚡ Dozna · Zid ${wall} · ${r.name}</div>
    <div style="display:flex;flex-direction:column;gap:14px">

      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface3);border-radius:8px;padding:8px 12px">
        <span style="font-size:10px;color:var(--text2)">Serija projekta</span>
        <span style="font-size:11px;font-weight:700;color:${serijaColor}">${serijaLabel}</span>
      </div>

      <div class="fg">
        <div class="fl">Materijal zida</div>
        <div class="seg-group" id="mat-group" style="flex-wrap:wrap;gap:4px">
          ${Object.entries(MATERIJAL_ZIDA).map(([v,d])=>`
            <div class="seg-btn${v===defaultMat?' active':''}" data-mat="${v}"
              data-action="selMat" style="flex:1;min-width:calc(50% - 4px);text-align:center">
              ${d.icon} ${d.label}
            </div>`).join('')}
        </div>
      </div>

      <div class="fg">
        <div class="fl">Status dozne</div>
        <select class="fi" id="box-status">
          ${Object.entries(BOX_STATUS).map(([v,d])=>`<option value="${v}">${d.label}</option>`).join('')}
        </select>
      </div>

      <div class="fg">
        <div class="fl">Veličina</div>
        <div class="seg-group" id="size-group" style="flex-wrap:wrap;gap:3px">
          ${[1,2,3,4,5,6,7].map(v=>`
            <div class="seg-btn${v===1?' active':''}" data-size="${v}"
              data-action="selSize" style="flex:1;min-width:calc(14% - 3px);text-align:center;padding:6px 2px;font-size:11px">
              ${v}M
            </div>`).join('')}
        </div>
      </div>

      <div id="nabavka-preview" style="background:var(--surface3);border:1px solid var(--border2);border-radius:8px;padding:10px">
        <div style="font-size:9px;color:var(--text2);letter-spacing:.07em;text-transform:uppercase;margin-bottom:7px">Ide u nabavku</div>
        <div id="nabavka-items"></div>
      </div>

      <div class="fg">
        <div class="fl">Meriti od ugla</div>
        <div class="seg-group" id="corner-group">
          <div class="seg-btn active" data-corner="start" data-action="selCorner">${corner1}</div>
          <div class="seg-btn" data-corner="end" data-action="selCorner">${corner2}</div>
        </div>
      </div>

      <div class="form-row">
        <div class="fg">
          <div class="fl">Udaljenost od ugla (cm)</div>
          <input class="fi" id="box-offset" type="number" inputmode="numeric" value="80" min="1">
          <div style="font-size:9px;color:var(--text3);margin-top:4px">Zid: ${Math.round(lenM*100)} cm</div>
        </div>
        <div class="fg">
          <div class="fl">Visina od poda (cm)</div>
          <input class="fi" id="box-height" type="number" inputmode="numeric" value="110" min="1" max="300">
        </div>
      </div>

      <div class="sheet-actions">
        <button class="btn btn-primary" data-action="confirmAddBox:${roomId}:${wall}">Postavi doznu</button>
        <button class="btn btn-ghost" data-action="closeSheet">Otkaži</button>
      </div>
    </div>
  `);

  updateNabavkaPreview();
}

function selCorner(el){
  document.querySelectorAll('#corner-group .seg-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
}

function selOpeningOption(el){
  el.parentElement.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
}

function selMat(el){
  document.querySelectorAll('#mat-group .seg-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  updateNabavkaPreview();
}

function selSize(el){
  document.querySelectorAll('#size-group .seg-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  updateNabavkaPreview();
}

function getActiveMat(){
  return document.querySelector('#mat-group .seg-btn.active')?.dataset.mat || 'cigla';
}
function getActiveSize(){
  return parseInt(document.querySelector('#size-group .seg-btn.active')?.dataset.size || '1');
}

const TIP_BOJA = {
  dozna:  '#e8a030',
  nosač:  '#5a9fd4',
  maska:  '#4caf76',
  modul:  '#9b76c8',
  kabl:   '#e8c44a',
};

// Tipovi kabla za kućne instalacije (sve PPY)
const KABLI = [
  { sifra:'PPY-3x1.5',  naziv:'Kabl PPY 3×1,5 mm²',  opis:'Rasvjeta, komandni krugovi',    boja:'#8a9a82' },
  { sifra:'PPY-3x2.5',  naziv:'Kabl PPY 3×2,5 mm²',  opis:'Utičnice 16A, opšta potrošnja', boja:'#4caf76' },
  { sifra:'PPY-5x1.5',  naziv:'Kabl PPY 5×1,5 mm²',  opis:'Trofazni 10A (klima, bojler)',  boja:'#5a9fd4' },
  { sifra:'PPY-5x2.5',  naziv:'Kabl PPY 5×2,5 mm²',  opis:'Trofazni 16A',                  boja:'#9b76c8' },
  { sifra:'PPY-5x4',    naziv:'Kabl PPY 5×4 mm²',    opis:'Trofazni 25A (veći uređaji)',    boja:'#d4882a' },
  { sifra:'PPY-5x6',    naziv:'Kabl PPY 5×6 mm²',    opis:'Trofazni 32A (šporet, klima)',   boja:'#d45a4a' },
  { sifra:'PPY-5x10',   naziv:'Kabl PPY 5×10 mm²',   opis:'Trofazni 50A (dovodni kabl)',    boja:'#e8c44a' },
];

function nabavkaZaDoznu(size, materijal){
  const items = [];
  const isGips = materijal === 'gips';
  const matLabel = {gips:'gips', cigla:'čvrst zid', siporex:'siporex', beton:'beton'}[materijal]||materijal;

  // 1. Dozna (uvijek)
  if(size <= 2){
    if(isGips){
      items.push({ sifra:'DOZNA-FI68-GIPS', naziv:'Dozna Ø68×60mm sa krilcima (gips)', opis:`Ø68mm, dubina 60mm, krilca za gips`, kolicina:1, tip:'dozna' });
    } else {
      items.push({ sifra:'DOZNA-FI60', naziv:'Dozna Ø60×45mm (čvrst zid)', opis:`Ø60mm, dubina 45mm, za malter/bušenje`, kolicina:1, tip:'dozna' });
    }
  } else {
    if(isGips){
      items.push({ sifra:`DOZNA-PRAV-${size}M-GIPS`, naziv:`Dozna pravougaona ${size}M (gips)`, opis:`${size}M, krilca, za gipsanu ploču`, kolicina:1, tip:'dozna' });
    } else {
      items.push({ sifra:`DOZNA-PRAV-${size}M-CVRST`, naziv:`Dozna pravougaona ${size}M (${matLabel})`, opis:`${size}M, za malter/bušenje, ${matLabel}`, kolicina:1, tip:'dozna' });
    }
  }

  // 2. Nosač/prirubnica — ide na SVAKU doznu bez iznimke
  const nosacSifre = {1:'70101.0E',2:'70102.0E',3:'71403.0E',4:'71404.0E',5:'71405.0E',6:'71406.0E',7:'71407.0E'};
  items.push({
    sifra: nosacSifre[size]||`7140${size}.0E`,
    naziv: `Nosač prirubnica ${size}M EXP`,
    opis: `Montažna kutija ${size}M — za kačenje modula`,
    kolicina: 1, tip:'nosač',
  });

  // 3. Bijela maska — uvijek
  const maskaSifre = {1:'70801.0',2:'70802.0',3:'70803.0',4:'70804.0',5:'70805.0',6:'70806.0',7:'70807.0'};
  items.push({
    sifra: maskaSifre[size]||`7080${size}.0`,
    naziv: `Maska ${size}M bijela FRAME EXP`,
    opis: `Cover frame ${size}M, bijela`,
    kolicina: 1, tip:'maska',
  });

  return items;
}
