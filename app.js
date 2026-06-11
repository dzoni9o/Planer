let _lastTouchEnd = 0; // must be before any usage

const S = {
  rooms: [],
  elements: [],
  connections: [],
  selWall: null,
  connectMode: false,
  connectFrom: null,
  nextRoom: 1,
  nextBox: 1,
  billOpen: false,
  serija: null,        // null | 'MODE' | 'EXP' — bira se pri prvoj dozni, zaključava projekat
  vp: { x: 0, y: 0, scale: 1 },
};

const PX_PER_M = 70;
const SNAP_PX  = 28;
const WALL_TAP = 20;

function saveState(){
  try {
    const data = {
      rooms: S.rooms,
      elements: S.elements,
      connections: S.connections,
      nextRoom: S.nextRoom,
      nextBox: S.nextBox,
      serija: S.serija,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch(e){ console.warn('Save failed', e); }
}

function loadState(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    const data = JSON.parse(raw);
    if(data.rooms)       S.rooms       = data.rooms;
    if(data.elements)    S.elements    = data.elements;
    if(data.connections) S.connections = data.connections;
    if(data.nextRoom)    S.nextRoom    = data.nextRoom;
    if(data.nextBox)     S.nextBox     = data.nextBox;
    if(data.serija)      S.serija      = data.serija;
  } catch(e){ console.warn('Load failed', e); }
}

function projectStatePayload(){
  return {
    app: 'nikvolt',
    version: 1,
    exportedAt: new Date().toISOString(),
    rooms: S.rooms,
    elements: S.elements,
    connections: S.connections,
    nextRoom: S.nextRoom,
    nextBox: S.nextBox,
    serija: S.serija,
  };
}

function exportProjectJson(){
  const data = projectStatePayload();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `nikvolt-projekat-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  toast('JSON izvezen');
}

function triggerImportProject(){
  const input = document.getElementById('import-json-input');
  if(input) input.click();
}

function applyImportedProject(data){
  if(!data || !Array.isArray(data.rooms) || !Array.isArray(data.elements) || !Array.isArray(data.connections)){
    throw new Error('Neispravan NikVolt JSON projekat');
  }
  S.rooms = data.rooms;
  S.elements = data.elements;
  S.connections = data.connections;
  S.nextRoom = data.nextRoom || (S.rooms.length + 1);
  S.nextBox = data.nextBox || (S.elements.filter(e=>e.type==='box').length + 1);
  S.serija = data.serija || null;
  S.selWall = null;
  S.connectMode = false;
  S.connectFrom = null;
  saveState();
  setToolbarDefault();
  applyVP();
  render();
  hint(S.rooms.length ? 'Projekat uvezen' : 'Tapni ＋ Prostorija da počneš');
}

async function importProjectJson(event){
  const input = event?.target;
  const file = input?.files?.[0];
  if(!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const ok = confirm('Uvesti JSON projekat? Trenutni projekat u browseru će biti zamenjen.');
    if(!ok) return;
    applyImportedProject(data);
    toast('JSON uvezen');
  } catch(err) {
    console.error(err);
    toast(err.message || 'Uvoz nije uspeo');
  } finally {
    if(input) input.value = '';
  }
}

function updateNabavkaPreview(){
  const el=document.getElementById('nabavka-items');
  if(!el) return;
  const mat=getActiveMat();
  const size=getActiveSize();
  const items=nabavkaZaDoznu(size, mat);
  el.innerHTML=items.map(it=>`
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
      <div style="width:6px;height:6px;border-radius:50%;background:${TIP_BOJA[it.tip]||'#888'};flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;color:var(--text);line-height:1.3">${it.naziv}</div>
        <div style="font-size:8px;color:var(--text3);margin-top:1px">${it.sifra} · ${it.opis}</div>
      </div>
      <div style="font-size:9px;color:var(--text2);font-family:var(--font);white-space:nowrap">1 kom</div>
    </div>`).join('');
}

function confirmAddBox(roomId, wall){
  // Read all DOM values FIRST — before closeSheet() destroys the DOM
  const statusEl=document.getElementById('box-status');
  const offsetEl=document.getElementById('box-offset');
  const heightEl=document.getElementById('box-height');
  const cornerEl=document.querySelector('#corner-group .seg-btn.active');
  const matEl=document.querySelector('#mat-group .seg-btn.active');
  const sizeEl=document.querySelector('#size-group .seg-btn.active');

  const status=statusEl?.value||'nova';
  const size=parseInt(sizeEl?.dataset.size||'1');
  const materijal=matEl?.dataset.mat||'cigla';
  const fromCorner=cornerEl?.dataset.corner||'start';
  const offsetCm=parseFloat(offsetEl?.value)||80;
  const offsetM=offsetCm/100;
  const heightCm=parseFloat(heightEl?.value)||110;

  const r=S.rooms.find(x=>x.id===roomId);
  const maxM=wallLenM(r,wall);
  if(offsetM<=0||offsetM>=maxM){
    toast('Udaljenost mora biti između 1 i '+Math.round(maxM*100-1)+' cm');
    return;
  }

  r.materijal=materijal;
  const code='D-'+String(S.nextBox).padStart(2,'0');
  const nabavka=nabavkaZaDoznu(size, materijal);

  S.elements.push({
    id:'e'+uid(), roomId, wall, fromCorner, offsetM, heightCm,
    type:'box', status, size, code, materijal, nabavka, moduli:[]
  });
  S.nextBox++;
  closeSheet();
  setToolbarDefault();
  render();
  saveState();
  toast(code+' · '+size+'M · '+(MATERIJAL_ZIDA[materijal]?.label||materijal));
}
let _konfEid=null;
let _konfKat='sve';
let _konfSerija='sve';

function openKonfigurator(eid){
  _konfEid=eid;
  _konfKat='sve';
  _konfSerija='sve';
  renderKonfigurator();
}

function renderKonfigurator(){
  const el=S.elements.find(x=>x.id===_konfEid);
  if(!el) return;
  const r=S.rooms.find(x=>x.id===el.roomId);
  const st=BOX_STATUS[el.status]||BOX_STATUS.nova;
  const cap=el.size||1;
  const moduli=el.moduli||[];
  const zauzeto=zauzetM(el);
  const slobodno=cap-zauzeto;

  // Capacity bar HTML
  const slots=Array.from({length:cap},(_,i)=>{
    const usedSlot=getSlotKat(moduli, i);
    const cls=usedSlot?`kap-slot filled-${usedSlot}`:'kap-slot';
    return `<div class="${cls}"></div>`;
  }).join('');

  // Installed modules list
  let moduliHtml='';
  if(moduli.length===0){
    moduliHtml=`<div style="color:var(--text3);font-size:10px;padding:8px 0;text-align:center">Još nema modula · dodaj ispod ↓</div>`;
  } else {
    moduli.forEach((m,i)=>{
      const kb=KAT_BOJE[m.kat]||KAT_BOJE.ostalo;
      moduliHtml+=`
        <div class="modul-item">
          <div class="modul-icon" style="background:${kb.bg}">${kb.icon}</div>
          <div class="modul-info">
            <div class="modul-naziv">${m.naziv}</div>
            <div class="modul-opis">${m.kod}.0 · ${m.opis}</div>
          </div>
          <div class="modul-vel">${m.vel}M</div>
          <button class="modul-del" data-del-idx="${i}">×</button>
        </div>`;
    });
  }

  // Category filter — dva nivoa
  // Primarne: Sve, Utičnica, Sklopka, Ostalo▸
  // Ostalo expanduje: USB, HDMI, Data, Tel, Antena, Audio, Dimmer, Detektor, Ostalo
  const PRIMARNE = ['sve','utičnica','sklopka'];
  const OSTALE   = ['usb','hdmi','data','tel','antena','audio','dimmer','detektor','ostalo'];
  const uOstalom = OSTALE.includes(_konfKat);

  const primaryTabs = [...PRIMARNE, '_ostalo'].map(k=>{
    const isOstalo = k==='_ostalo';
    const active   = isOstalo ? uOstalom : _konfKat===k;
    const kb       = KAT_BOJE[k]||KAT_BOJE.ostalo;
    const label    = isOstalo ? '••• Ostalo' : (k==='sve' ? 'Sve' : `${kb.icon} ${k.charAt(0).toUpperCase()+k.slice(1)}`);
    const color    = active ? (isOstalo?'var(--text2)':kb.color) : 'var(--text3)';
    const bg       = active ? (isOstalo?'rgba(255,255,255,.08)':`${kb.color}18`) : 'var(--surface3)';
    const border   = active ? (isOstalo?'rgba(255,255,255,.2)':`${kb.color}66`) : 'var(--border2)';
    return `<div data-action="${isOstalo?'setKonfKat:usb':'setKonfKat:'+k}"
      style="flex:1;padding:12px 4px;border-radius:8px;border:1.5px solid ${border};
             background:${bg};color:${color};font-family:var(--font);font-size:11px;
             font-weight:700;text-align:center;cursor:pointer;letter-spacing:.02em">
      ${label}
    </div>`;
  }).join('');

  const secondaryTabs = uOstalom ? OSTALE.map(k=>{
    const kb = KAT_BOJE[k]||KAT_BOJE.ostalo;
    const active = _konfKat===k;
    return `<div data-action="setKonfKat:${k}"
      style="padding:7px 10px;border-radius:6px;border:1px solid ${active?kb.color+'88':'var(--border2)'};
             background:${active?kb.color+'18':'var(--surface3)'};color:${active?kb.color:'var(--text3)'};
             font-family:var(--font);font-size:10px;font-weight:${active?'700':'400'};cursor:pointer;white-space:nowrap">
      ${kb.icon} ${k}
    </div>`;
  }).join('') : '';

  const katHtml = `
    <div style="display:flex;gap:6px;margin-bottom:${uOstalom?'8px':'10px'}">${primaryTabs}</div>
    ${uOstalom ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">${secondaryTabs}</div>` : ''}
  `;

  // Filter by serija and category
  const serijaColor = S.serija==='MODE' ? '#1D9E75' : '#378ADD';
  const filterKat = uOstalom ? _konfKat : _konfKat;
  let filtered=SVI_MODULI.filter(m=>{
    if(S.serija && m.serija!==S.serija) return false;
    if(_konfKat==='sve') return true;
    return m.kat===_konfKat;
  });

  let katalogHtml='';
  if(slobodno===0){
    katalogHtml=`<div style="color:var(--amber);font-size:10px;padding:8px;background:rgba(239,159,39,.08);border-radius:6px;text-align:center">⚠ Dozna je popunjena (${cap}M)</div>`;
  } else {
    filtered.forEach(m=>{
      const fits=m.vel<=slobodno;
      const kb=KAT_BOJE[m.kat]||KAT_BOJE.ostalo;
      katalogHtml+=`
        <div class="katalog-item${fits?'':' disabled'}" data-add-kod="${m.kod}">
          <div class="modul-icon" style="background:${kb.bg};width:28px;height:28px;min-width:28px;font-size:14px;border-radius:5px;display:flex;align-items:center;justify-content:center">${kb.icon}</div>
          <div class="modul-info">
            <div class="modul-naziv">${m.naziv}</div>
            <div class="modul-opis">${m.opis}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
            <span class="katalog-badge ${m.serija.toLowerCase()}">${m.serija}</span>
            <span class="modul-vel">${m.vel}M</span>
          </div>
        </div>`;
    });
    if(!katalogHtml) katalogHtml=`<div style="color:var(--text3);font-size:10px;padding:12px;text-align:center">Nema rezultata</div>`;
  }

  openSheet(`
    <div class="sheet-title" style="color:${st.color}">${el.code} · ${r?.name} · Zid ${el.wall}</div>

    <!-- Kapacitet bar -->
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <span style="font-size:9px;color:var(--text2);letter-spacing:.07em;text-transform:uppercase">Kapacitet</span>
        <span style="font-size:10px;font-weight:700;font-family:var(--font);color:${slobodno===0?'var(--amber)':'var(--text)'}">
          ${zauzeto}/${cap}M · ${slobodno}M slobodno
        </span>
      </div>
      <div class="kap-bar">${slots}</div>
    </div>

    <!-- Instalirani moduli -->
    <div style="margin-bottom:12px">
      <div style="font-size:9px;color:var(--text2);letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px">Moduli u dozni</div>
      ${moduliHtml}
    </div>

    <!-- Separator -->
    <div style="border-top:1px solid var(--border);margin:0 -16px 12px;padding-top:12px;padding-left:16px;padding-right:16px">
      <div style="font-size:9px;color:var(--text2);letter-spacing:.07em;text-transform:uppercase;margin-bottom:8px">Dodaj modul · ${slobodno}M dostupno</div>

      <!-- Serija locked badge + category filter -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:9px;color:var(--text2);letter-spacing:.07em;text-transform:uppercase">Moduli · ${S.serija||'?'}</div>
        <div style="font-size:9px;font-weight:700;color:${serijaColor};background:${serijaColor}18;border:1px solid ${serijaColor}44;border-radius:4px;padding:2px 7px">
          ${S.serija==='MODE'?'🔲 MODE':'🔳 EXP'}
        </div>
      </div>

      <!-- Kategorija filter -->
      ${katHtml}

      <!-- Katalog scroll -->
      <div style="max-height:240px;overflow-y:auto;margin-top:6px;padding-right:2px">
        ${katalogHtml}
      </div>
    </div>

    <!-- Osnovne postavke -->
    <details style="margin-bottom:12px">
      <summary style="font-size:9px;color:var(--text2);letter-spacing:.07em;text-transform:uppercase;cursor:pointer;padding:4px 0">Postavke dozne ▸</summary>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
        <div class="form-row">
          <div class="fg">
            <div class="fl">Status</div>
            <select class="fi" id="es-status">
              ${Object.entries(BOX_STATUS).map(([v,d])=>`<option value="${v}"${el.status===v?' selected':''}>${d.label}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <div class="fl">Kapacitet</div>
            <select class="fi" id="es-size">
              ${[1,2,3,4,5,6,7].map(v=>`<option value="${v}"${el.size===v?' selected':''}>${v}M</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="fg">
          <div class="fl">Serija projekta</div>
          <div style="background:var(--surface2);border-radius:6px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:10px;color:var(--text2)">Zaključano za projekat</span>
            <span style="font-size:11px;font-weight:700;color:${S.serija==='MODE'?'#1D9E75':'#378ADD'}">${S.serija==='MODE'?'🔲 MODE':'🔳 EXP'}</span>
          </div>
        </div>
        <div class="fg">
          <div class="fl">Materijal zida</div>
          <select class="fi" id="es-mat">
            ${Object.entries(MATERIJAL_ZIDA).map(([v,d])=>`<option value="${v}"${el.materijal===v?' selected':''}>${d.icon} ${d.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="fg">
            <div class="fl">Udaljenost od ugla (cm)</div>
            <input class="fi" id="es-offset" type="number" inputmode="numeric" value="${Math.round(el.offsetM*100)}">
          </div>
          <div class="fg">
            <div class="fl">Visina od poda (cm)</div>
            <input class="fi" id="es-height" type="number" inputmode="numeric" value="${el.heightCm||110}">
          </div>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-primary" data-action="saveBoxEdit:${_konfEid}">Sačuvaj postavke</button>
          <button class="btn btn-danger" data-action="deleteElem:${_konfEid}">Obriši doznu</button>
        </div>
      </div>
    </details>

    <!-- Nabavka za ovu doznu -->
    <details style="margin-bottom:12px">
      <summary style="font-size:9px;color:var(--text2);letter-spacing:.07em;text-transform:uppercase;cursor:pointer;padding:4px 0">Nabavka za ovu doznu ▸</summary>
      <div style="margin-top:8px">
        ${(el.nabavka||nabavkaZaDoznu(el.size||1, el.materijal||'cigla')).map(it=>`
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
            <div style="width:6px;height:6px;border-radius:50%;background:${TIP_BOJA[it.tip]||'#888'};flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:10px;color:var(--text)">${it.naziv}</div>
              <div style="font-size:8px;color:var(--text3);margin-top:1px">${it.sifra}</div>
            </div>
            <div style="font-size:9px;color:var(--text2);font-family:var(--font)">1 kom</div>
          </div>`).join('')}
        ${(el.moduli||[]).map(m=>`
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
            <div style="width:6px;height:6px;border-radius:50%;background:${KAT_BOJE[m.kat]?.color||'#888'};flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:10px;color:var(--text)">${m.naziv} (bijela)</div>
              <div style="font-size:8px;color:var(--text3);margin-top:1px">${m.kod}.0</div>
            </div>
            <div style="font-size:9px;color:var(--text2);font-family:var(--font)">1 kom</div>
          </div>`).join('')}
      </div>
    </details>

    <button class="btn btn-ghost" style="width:100%;justify-content:center" data-action="closeSheet">Zatvori</button>
  `);
}

// Returns the kat of the module occupying slot index i
function getSlotKat(moduli, slotIdx){
  let pos=0;
  for(const m of moduli){
    if(slotIdx>=pos && slotIdx<pos+m.vel) return m.kat;
    pos+=m.vel;
  }
  return null;
}
// Alias used in wall preview (same logic)
const getSlotKatSimple=getSlotKat;

function setKonfKat(kat){ _konfKat=kat; renderKonfigurator(); }
function setKonfSerija(s){ _konfSerija=s; renderKonfigurator(); }

function dodajModul(kod){
  const el=S.elements.find(x=>x.id===_konfEid);
  if(!el) return;
  const m=SVI_MODULI.find(x=>x.kod===kod);
  if(!m) return;
  if(slobodnoM(el)<m.vel){
    toast(`Nema mjesta · treba ${m.vel}M, ima ${slobodnoM(el)}M`);
    return;
  }
  if(!el.moduli) el.moduli=[];
  el.moduli.push({...m});
  saveState();
  render();
  renderKonfigurator();
  toast(`${m.naziv} dodan`);
}

function ukloniModul(idx){
  const el=S.elements.find(x=>x.id===_konfEid);
  if(!el||!el.moduli) return;
  const m=el.moduli[idx];
  el.moduli.splice(idx,1);
  saveState();
  render();
  renderKonfigurator();
  toast(`${m.naziv} uklonjen`);
}

function saveBoxEdit(eid){
  const el=S.elements.find(x=>x.id===eid);
  if(!el) return;
  const newStatus=document.getElementById('es-status').value;
  const newSize=parseInt(document.getElementById('es-size').value);
  const newMat=document.getElementById('es-mat').value;

  // Check capacity
  const zauzeto=zauzetM(el);
  if(newSize<zauzeto){
    toast(`Kapacitet ${newSize}M premali — moduli zauzimaju ${zauzeto}M`);
    return;
  }

  el.status=newStatus;
  el.size=newSize;
  el.materijal=newMat;
  // Recalculate nabavka if size or material changed
  el.nabavka=nabavkaZaDoznu(newSize, newMat);

  const newOffsetM=parseFloat(document.getElementById('es-offset').value)/100||el.offsetM;
  const r=S.rooms.find(x=>x.id===el.roomId);
  r.materijal=newMat; // update room default
  const maxM=wallLenM(r,el.wall);
  if(newOffsetM>0&&newOffsetM<maxM) el.offsetM=newOffsetM;
  else toast('Udaljenost van opsega — nije promjenjena');
  el.heightCm=parseFloat(document.getElementById('es-height').value)||110;
  closeSheet(); render(); toast('Dozna ažurirana');
  saveState();
}

function deleteElem(eid){
  S.connections=S.connections.filter(c=>c.aId!==eid&&c.bId!==eid);
  S.elements=S.elements.filter(e=>e.id!==eid);
  closeSheet(); render(); saveState();
  toast('Dozna obrisana');
}

function renderConnections(){
  const g=document.getElementById('g-conns');
  let html='';

  for(const c of S.connections){
    const eA=S.elements.find(x=>x.id===c.aId);
    const eB=S.elements.find(x=>x.id===c.bId);
    if(!eA||!eB) continue;
    const pA=elemPx(eA), pB=elemPx(eB);
    if(!pA||!pB) continue;
    const pts=cablePath(pA,pB);
    const d=ptsToD(pts);
    const lenM=cableLenM(c);
    const kablSifra=c.kabl?.sifra||'PPY-3x2.5';
    const kablDef=KABLI.find(k=>k.sifra===kablSifra)||KABLI[1];
    const kablBoja=kablDef.boja;
    // Update saved kabl color to stay in sync
    if(c.kabl) c.kabl.boja=kablBoja;

    // Cable line
    html+=`<path class="conn-path" d="${d}" data-cid="${c.id}"
      stroke="${kablBoja}" stroke-width="2" fill="none" stroke-dasharray="6 3"/>`;
    // Wide invisible hit target
    html+=`<path d="${d}" stroke="transparent" stroke-width="16" fill="none"
      data-cid="${c.id}" style="cursor:pointer"/>`;

    // True midpoint by arc length
    const totalLen=pts.reduce((s,p,i)=>i===0?0:s+Math.hypot(p.x-pts[i-1].x,p.y-pts[i-1].y),0);
    let half=totalLen/2, walked=0, mx=pts[0].x, my=pts[0].y, cdx=1, cdy=0;
    for(let i=1;i<pts.length;i++){
      const sx=pts[i].x-pts[i-1].x, sy=pts[i].y-pts[i-1].y;
      const seg=Math.hypot(sx,sy);
      if(walked+seg>=half){
        const t=(half-walked)/seg;
        mx=pts[i-1].x+sx*t; my=pts[i-1].y+sy*t;
        cdx=sx; cdy=sy;
        break;
      }
      walked+=seg;
    }

    // Perpendicular, alternate side by index
    const cl=Math.hypot(cdx,cdy)||1;
    let px=-cdy/cl, py=cdx/cl;
    const connIdx=S.connections.indexOf(c);
    if(connIdx%2===0){ if(py>0){px=-px;py=-py;} }
    else             { if(py<0){px=-px;py=-py;} }

    const lx=mx+px*40, ly=my+py*40;

    // Clamp label anchor so it stays within cable bounding box + margin
    const allX=pts.map(p=>p.x), allY=pts.map(p=>p.y);
    const MARGIN=50;
    const clx=Math.max(Math.min(...allX)-MARGIN, Math.min(lx, Math.max(...allX)+MARGIN));
    const cly=Math.max(Math.min(...allY)-MARGIN, Math.min(ly, Math.max(...allY)+MARGIN));

    // Leader line with arrowhead pointing back to cable
    html+=`<line x1="${clx}" y1="${cly}" x2="${mx}" y2="${my}"
      stroke="${kablBoja}" stroke-width="1" opacity=".45" stroke-dasharray="3 2"/>`;
    const adx=(mx-clx)/Math.hypot(mx-clx,my-cly)||0;
    const ady=(my-cly)/Math.hypot(mx-clx,my-cly)||0;
    html+=`<polygon points="${mx},${my} ${mx-adx*7+ady*3},${my-ady*7-adx*3} ${mx-adx*7-ady*3},${my-ady*7+adx*3}"
      fill="${kablBoja}" opacity=".65"/>`;

    // Label
    const txt=`${lenM}m`;
    const tw=txt.length*6+14;
    html+=`<rect x="${clx-tw/2}" y="${cly-9}" width="${tw}" height="16"
      rx="4" fill="var(--bg)" stroke="${kablBoja}" stroke-width="1" opacity=".88"/>`;
    html+=`<text x="${clx}" y="${cly+2}" text-anchor="middle"
      fill="${kablBoja}" font-size="9" font-family="Space Mono,monospace" font-weight="700">${txt}</text>`;
  }
  g.innerHTML=html;

  document.querySelectorAll('[data-cid]').forEach(el=>{
    addTap(el, ()=>{
      const conn=S.connections.find(c=>c.id===el.dataset.cid);
      if(!conn) return;
      const eA=S.elements.find(x=>x.id===conn.aId);
      const eB=S.elements.find(x=>x.id===conn.bId);
      const pts=cablePath(elemPx(eA),elemPx(eB));
      const lenM=cableLenM(conn);
      const kabl=conn.kabl;
      openSheet(`
        <div class="sheet-title" style="color:${kabl?.boja||'var(--accent)'}">〰 ${eA?.code} → ${eB?.code}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="background:var(--surface3);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
            <div style="width:32px;height:4px;background:${kabl?.boja||'var(--accent)'};border-radius:2px;flex-shrink:0"></div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700;color:var(--text)">${kabl?.naziv||'Kabl'}</div>
              <div style="font-size:10px;color:var(--text2);margin-top:2px">${kabl?.opis||''}</div>
            </div>
            <div style="font-size:18px;font-weight:700;color:${kabl?.boja||'var(--accent)'};font-family:var(--font)">${lenM} m</div>
          </div>
          <div class="sheet-actions">
            <button class="btn btn-danger" data-action="obrisiVezu:${conn.id}">Obriši vezu</button>
            <button class="btn btn-ghost" data-action="closeSheet">Zatvori</button>
          </div>
        </div>
      `);
    });
  });
}

const KABL_NAZIV_BOJE = {
  '#e8c44a':'žuta',   '#E8C44A':'žuta',
  '#4caf76':'zelena', '#1D9E75':'zelena',
  '#5a9fd4':'plava',  '#378ADD':'plava',
  '#9b76c8':'ljubičasta', '#9B59B6':'ljubičasta',
  '#d4882a':'narandžasta','#E67E22':'narandžasta','#d4550a':'narandžasta',
  '#d45a4a':'crvena', '#E74C3C':'crvena',
  '#3abf9c':'tirkizna','#1ABC9C':'tirkizna',
  '#8a9a82':'siva',   '#888':'siva','#95A5A6':'siva',
};

function renderLegend(){
  const gl=document.getElementById('g-legend');
  if(!gl) return;
  if(!S.connections.length){ gl.innerHTML=''; return; }

  const svg=document.getElementById('svg');
  const {width:svgW, height:svgH}=svg.getBoundingClientRect();
  if(!svgW||!svgH) return;

  const byType={};
  S.connections.forEach(c=>{
    const eA=S.elements.find(x=>x.id===c.aId);
    const eB=S.elements.find(x=>x.id===c.bId);
    if(!eA||!eB) return;
    const lenM=cableLenM(c);
    const sifra=c.kabl?.sifra||'PPY-3x2.5';
    const kablDef=KABLI.find(k=>k.sifra===sifra)||KABLI[1];
    const naziv=kablDef.naziv;
    const boja=kablDef.boja;
    if(!byType[sifra]) byType[sifra]={naziv,boja,metara:0};
    byType[sifra].metara+=lenM;
  });

  const items=Object.entries(byType);
  if(!items.length){ gl.innerHTML=''; return; }

  const PAD=12, ROW_H=22, SWATCH=10;
  const W=230, totalH=PAD*2+14+items.length*ROW_H;
  const bx=svgW-W-10, by=svgH-totalH-10;

  let h=`<rect x="${bx}" y="${by}" width="${W}" height="${totalH}" rx="8" fill="var(--bg)" stroke="var(--border2)" stroke-width="1" opacity=".96"/>`;
  h+=`<text x="${bx+PAD}" y="${by+PAD+5}" fill="var(--text3)" font-size="9" font-family="Space Mono,monospace" letter-spacing=".06em">LEGENDA KABLOVA</text>`;

  items.forEach(([,{naziv,boja,metara}],i)=>{
    const ry=by+PAD+18+i*ROW_H;
    const colorName=(KABL_NAZIV_BOJE[boja]||'').toUpperCase();
    const shortNaziv=naziv.replace('Kabl ','');
    const mStr=Math.ceil(metara*1.1)+'m';

    // Colour swatch — filled square
    h+=`<rect x="${bx+PAD}" y="${ry}" width="${SWATCH}" height="${SWATCH}" rx="2" fill="${boja}"/>`;

    // Colour name in cable colour — bold
    if(colorName)
      h+=`<text x="${bx+PAD+SWATCH+6}" y="${ry+9}" fill="${boja}" font-size="10" font-weight="700" font-family="Space Mono,monospace">${colorName}</text>`;

    // Short cable name in muted
    const nameX=bx+PAD+SWATCH+6+(colorName?colorName.length*7+4:0);
    h+=`<text x="${nameX}" y="${ry+9}" fill="var(--text3)" font-size="9" font-family="Space Mono,monospace">${shortNaziv.slice(0,18)}</text>`;

    // Metres right-aligned in cable colour
    h+=`<text x="${bx+W-PAD}" y="${ry+9}" text-anchor="end" fill="${boja}" font-size="10" font-weight="700" font-family="Space Mono,monospace">${mStr}</text>`;
  });

  gl.innerHTML=h;
}

function obrisiVezu(cid){
  S.connections=S.connections.filter(c=>c.id!==cid);
  closeSheet(); render(); saveState(); toast('Veza obrisana');
}


function wallCornerLabels(wall){
  const isHoriz=(wall==='N'||wall==='S');
  return {
    start: isHoriz ? 'Lijevi ugao' : 'Gornji ugao',
    end: isHoriz ? 'Desni ugao' : 'Donji ugao',
  };
}

function defaultOpeningOffsetCm(lenM, widthM, fallbackM){
  const half=widthM/2;
  const min=half+0.1;
  const max=Math.max(min, lenM-half-0.1);
  const center=Math.min(Math.max(fallbackM, min), max);
  return Math.round(center*100);
}

function readOpening(prefix, roomId, wall, fallbackOffsetM, fallbackWidthM){
  const r=S.rooms.find(x=>x.id===roomId);
  if(!r) return null;
  const lenM=wallLenM(r,wall);
  const cornerEl=document.querySelector('#corner-group .seg-btn.active');
  const fromCorner=cornerEl?cornerEl.dataset.corner:'start';
  const offsetCm=parseFloat(document.getElementById(prefix+'-offset')?.value);
  const widthCm=parseFloat(document.getElementById(prefix+'-width')?.value);
  const offsetM=(Number.isFinite(offsetCm)?offsetCm:fallbackOffsetM*100)/100;
  const widthM=(Number.isFinite(widthCm)?widthCm:fallbackWidthM*100)/100;

  if(widthM<=0 || widthM>=lenM){
    toast('Sirina mora biti veca od 0 i manja od zida');
    return null;
  }

  const minM=widthM/2;
  const maxM=lenM-widthM/2;
  if(offsetM<minM || offsetM>maxM){
    toast('Centar mora biti izmedju '+Math.ceil(minM*100)+' i '+Math.floor(maxM*100)+' cm');
    return null;
  }

  return {fromCorner, offsetM, widthM};
}

function promptAddDoor(){
  if(!S.selWall) return;
  const {roomId,wall}=S.selWall;
  const r=S.rooms.find(x=>x.id===roomId);
  if(!r) return;
  const lenM=wallLenM(r,wall);
  const labels=wallCornerLabels(wall);
  const widthM=0.9;
  const offsetCm=defaultOpeningOffsetCm(lenM,widthM,1);
  openSheet(`
    <div class="sheet-title">Vrata - Zid ${wall}</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="fg">
        <div class="fl">Meriti od ugla</div>
        <div class="seg-group" id="corner-group">
          <div class="seg-btn active" data-corner="start" data-action="selCorner">${labels.start}</div>
          <div class="seg-btn" data-corner="end" data-action="selCorner">${labels.end}</div>
        </div>
      </div>
      <div class="fg">
        <div class="fl">Pozicija centra vrata (cm)</div>
        <input class="fi" id="d-offset" type="number" inputmode="numeric" min="1" max="${Math.round(lenM*100)}" step="1" value="${offsetCm}">
        <div style="font-size:9px;color:var(--text3);margin-top:4px">Zid: ${Math.round(lenM*100)} cm - vrata se centriraju na ovu tacku</div>
      </div>
      <div class="fg">
        <div class="fl">Sirina vrata (cm)</div>
        <input class="fi" id="d-width" type="number" inputmode="numeric" min="40" max="${Math.round(lenM*100-1)}" step="1" value="90">
      </div>
      <div class="fg">
        <div class="fl">Sarka</div>
        <div class="seg-group" id="hinge-group">
          <div class="seg-btn active" data-hinge="start" data-action="selOpeningOption">Lijevo</div>
          <div class="seg-btn" data-hinge="end" data-action="selOpeningOption">Desno</div>
        </div>
      </div>
      <div class="fg">
        <div class="fl">Smer otvaranja</div>
        <div class="seg-group" id="swing-group">
          <div class="seg-btn active" data-swing="in" data-action="selOpeningOption">Unutra</div>
          <div class="seg-btn" data-swing="out" data-action="selOpeningOption">Spolja</div>
        </div>
      </div>
      <div class="sheet-actions">
        <button class="btn btn-primary" data-action="confirmAddDoor:${roomId}:${wall}">Postavi vrata</button>
        <button class="btn btn-ghost" data-action="closeSheet">Otkazi</button>
      </div>
    </div>
  `);
}

function confirmAddDoor(roomId,wall){
  const opening=readOpening('d',roomId,wall,1,0.9);
  if(!opening) return;
  const hingeEl=document.querySelector('#hinge-group .seg-btn.active');
  const swingEl=document.querySelector('#swing-group .seg-btn.active');
  const hinge=hingeEl?.dataset.hinge||'start';
  const swing=swingEl?.dataset.swing||'in';
  S.elements.push({id:'e'+uid(),roomId,wall,type:'door',...opening,hinge,swing});
  closeSheet(); setToolbarDefault(); render();
  saveState();
  toast('Vrata dodana');
}

function promptAddWindow(){
  if(!S.selWall) return;
  const {roomId,wall}=S.selWall;
  const r=S.rooms.find(x=>x.id===roomId);
  if(!r) return;
  const lenM=wallLenM(r,wall);
  const labels=wallCornerLabels(wall);
  const widthM=1.2;
  const offsetCm=defaultOpeningOffsetCm(lenM,widthM,1.5);
  openSheet(`
    <div class="sheet-title">Prozor - Zid ${wall}</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="fg">
        <div class="fl">Meriti od ugla</div>
        <div class="seg-group" id="corner-group">
          <div class="seg-btn active" data-corner="start" data-action="selCorner">${labels.start}</div>
          <div class="seg-btn" data-corner="end" data-action="selCorner">${labels.end}</div>
        </div>
      </div>
      <div class="fg">
        <div class="fl">Pozicija centra prozora (cm)</div>
        <input class="fi" id="w-offset" type="number" inputmode="numeric" min="1" max="${Math.round(lenM*100)}" step="1" value="${offsetCm}">
        <div style="font-size:9px;color:var(--text3);margin-top:4px">Zid: ${Math.round(lenM*100)} cm - prozor se centrira na ovu tacku</div>
      </div>
      <div class="fg">
        <div class="fl">Sirina prozora (cm)</div>
        <input class="fi" id="w-width" type="number" inputmode="numeric" min="40" max="${Math.round(lenM*100-1)}" step="1" value="120">
      </div>
      <div class="sheet-actions">
        <button class="btn btn-primary" data-action="confirmAddWindow:${roomId}:${wall}">Postavi prozor</button>
        <button class="btn btn-ghost" data-action="closeSheet">Otkazi</button>
      </div>
    </div>
  `);
}

function confirmAddWindow(roomId,wall){
  const opening=readOpening('w',roomId,wall,1.5,1.2);
  if(!opening) return;
  S.elements.push({id:'e'+uid(),roomId,wall,type:'window',...opening});
  closeSheet(); setToolbarDefault(); render();
  saveState();
  toast('Prozor dodan');
}
function promptConnect(){
  if(S.elements.filter(e=>e.type==='box').length<2){
    toast('Potrebne su min. 2 dozne za vezu'); return;
  }
  setToolbarConnect(); render();
}

function onBoxTapConnect(eid){
  if(!S.connectFrom){
    S.connectFrom=eid;
    document.getElementById('conn-hint-label').innerHTML='<strong>Poveži dozne</strong>Tapni drugu doznu';
    hint('Tapni drugu doznu');
    render(); return;
  }
  if(S.connectFrom===eid){ toast('Ista dozna — tapni drugu'); return; }
  const exists=S.connections.find(c=>(c.aId===S.connectFrom&&c.bId===eid)||(c.aId===eid&&c.bId===S.connectFrom));
  if(exists){ toast('Veza već postoji'); S.connectFrom=null; render(); return; }

  // Ask cable type before confirming
  const aId=S.connectFrom;
  const bId=eid;
  const eA=S.elements.find(x=>x.id===aId);
  const eB=S.elements.find(x=>x.id===bId);

  openSheet(`
    <div class="sheet-title">〰 Veza · ${eA?.code} → ${eB?.code}</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="font-size:9px;color:var(--text2);letter-spacing:.07em;text-transform:uppercase">Tip kabla</div>
      ${KABLI.map((k,i)=>`
        <div class="katalog-item${i===1?' active':''}${ i===1?' selected-kabl':''}" id="kabl-${i}"
          data-action="selKabl:${i}"
          style="border:2px solid ${i===1?k.boja:'var(--border2)'}; transition:all .15s">
          <div style="width:28px;height:28px;border-radius:6px;background:${k.boja}22;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <div style="width:14px;height:3px;background:${k.boja};border-radius:2px"></div>
          </div>
          <div class="modul-info">
            <div class="modul-naziv">${k.naziv}</div>
            <div class="modul-opis">${k.opis}</div>
          </div>
          <div style="font-size:10px;font-weight:700;color:${k.boja};font-family:var(--font);flex-shrink:0">${k.sifra.replace('PPY-','')}</div>
        </div>`).join('')}
      <div style="height:4px"></div>
      <div class="sheet-actions">
        <button class="btn btn-primary" data-action="confirmVeza:${aId}:${bId}">Napravi vezu</button>
        <button class="btn btn-ghost" data-action="cancelVeza">Otkaži</button>
      </div>
    </div>
  `);
  // Default select index 1 (PPY 3×2.5)
  _selKabl=1;
}

let _selKabl=1;

function selKabl(i){
  _selKabl=i;
  // Update visual selection
  KABLI.forEach((_,j)=>{
    const el=document.getElementById(`kabl-${j}`);
    if(!el) return;
    el.style.borderColor = j===i ? KABLI[j].boja : 'var(--border2)';
  });
}

function confirmVeza(aId, bId){
  const kabl=KABLI[_selKabl]||KABLI[1];
  S.connections.push({id:'c'+uid(), aId, bId, kabl:{...kabl}});
  S.connectFrom=null;
  closeSheet();
  document.getElementById('conn-hint-label').innerHTML='<strong>Poveži dozne</strong>Tapni sledeću doznu';
  hint('Veza napravljena · tapni sledeću ili Otkaži');
  render();
  saveState();
  toast(`Veza · ${kabl.naziv}`);
}

function cancelVeza(){
  S.connectFrom=null;
  closeSheet();
  render();
}

function render(){
  renderRooms();
  renderElements();
  renderConnections();
  renderLegend();
  if(S.billOpen) renderBill();
}

function renderRooms(){
  const gR=document.getElementById('g-rooms');
  const gW=document.getElementById('g-walls');
  let rHtml='', wHtml='';

  for(const r of S.rooms){
    const isSel=S.selWall?.roomId===r.id;
    // Room fill
    rHtml+=`<rect class="room-bg" x="${r.x}" y="${r.y}" width="${r.wPx}" height="${r.hPx}" data-rid="${r.id}"/>`;
    // Room label
    rHtml+=`<text class="room-label" x="${r.x+r.wPx/2}" y="${r.y+r.hPx/2-8}">${r.name}</text>`;
    rHtml+=`<text class="room-dim" x="${r.x+r.wPx/2}" y="${r.y+r.hPx/2+9}">${r.wM}×${r.hM}m</text>`;

    // Walls
    for(const wall of ['N','S','W','E']){
      const seg=wallSeg(r,wall);
      const isSW=S.selWall?.roomId===r.id&&S.selWall?.wall===wall;
      const isOpen=(r.openWalls||[]).includes(wall);
      wHtml+=`<line class="wall${isSW?' selected':''}${isOpen?' open':''}"
        x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}"/>`;
      wHtml+=`<line class="wall-hit"
        x1="${seg.x1}" y1="${seg.y1}" x2="${seg.x2}" y2="${seg.y2}"
        data-rid="${r.id}" data-wall="${wall}"/>`;
    }
  }
  gR.innerHTML=rHtml;
  gW.innerHTML=wHtml;
  // Wall tap events handled centrally in canvas.js via hitWall()
  // Room dblclick for desktop edit
  document.querySelectorAll('[data-rid]').forEach(el=>{
    if(el.tagName==='rect'){
      el.addEventListener('dblclick', e=>{ e.stopPropagation(); promptEditRoom(el.dataset.rid); });
    }
  });
}

function onWallTap(rid, wall){
  if(S.connectMode) return;
  setToolbarWall(rid, wall);
  render();
}

function renderElements(){
  const gE=document.getElementById('g-elements');
  const gB=document.getElementById('g-boxes');
  let eHtml='', bHtml='';

  for(const el of S.elements){
    const p=(el.type==='door'||el.type==='window') ? elemWallPx(el) : elemPx(el);
    if(!p) continue;
    const isH=(el.wall==='N'||el.wall==='S');

    if(el.type==='door'){
      const wPx=(el.widthM||0.9)*PX_PER_M;
      const hw=wPx/2;
      const ax=isH?1:0, ay=isH?0:1;
      const x1=p.x-ax*hw, y1=p.y-ay*hw;
      const x2=p.x+ax*hw, y2=p.y+ay*hw;
      const hingeIsEnd=el.hinge==='end';
      const hx=hingeIsEnd?x2:x1, hy=hingeIsEnd?y2:y1;
      const vx=hingeIsEnd?-ax:ax, vy=hingeIsEnd?-ay:ay;
      const swingDir=el.swing==='out'?-1:1;
      const nx=(p.nx||0)*swingDir, ny=(p.ny||0)*swingDir;
      const ex=hx+(vx*0.7+nx*0.7)*wPx;
      const ey=hy+(vy*0.7+ny*0.7)*wPx;
      const sweep=(hingeIsEnd?0:1) ^ (el.swing==='out'?1:0);
      const jamb=7;
      const jx=(p.nx||0)*jamb, jy=(p.ny||0)*jamb;
      const kx=hx+(ex-hx)*0.82, ky=hy+(ey-hy)*0.82;
      eHtml+=`<line class="door-gap" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      eHtml+=`<line class="door-body" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      eHtml+=`<line class="door-jamb" x1="${x1-jx}" y1="${y1-jy}" x2="${x1+jx}" y2="${y1+jy}"/>`;
      eHtml+=`<line class="door-jamb" x1="${x2-jx}" y1="${y2-jy}" x2="${x2+jx}" y2="${y2+jy}"/>`;
      eHtml+=`<path class="door-swing" d="M${hx},${hy} A${wPx},${wPx} 0 0,${sweep} ${ex},${ey}"/>`;
      eHtml+=`<line class="door-leaf" x1="${hx}" y1="${hy}" x2="${ex}" y2="${ey}"/>`;
      eHtml+=`<circle class="door-hinge" cx="${hx}" cy="${hy}" r="3.2"/>`;
      eHtml+=`<circle class="door-knob" cx="${kx}" cy="${ky}" r="2"/>`;
    } else if(el.type==='window'){
      const wPx=(el.widthM||1.2)*PX_PER_M;
      const hw=wPx/2;
      if(isH){
        eHtml+=`<line class="win-outer" x1="${p.x-hw}" y1="${p.y}" x2="${p.x+hw}" y2="${p.y}"/>`;
        eHtml+=`<line class="win-inner" x1="${p.x-hw}" y1="${p.y-4}" x2="${p.x+hw}" y2="${p.y-4}"/>`;
        eHtml+=`<line class="win-inner" x1="${p.x-hw}" y1="${p.y+4}" x2="${p.x+hw}" y2="${p.y+4}"/>`;
      } else {
        eHtml+=`<line class="win-outer" x1="${p.x}" y1="${p.y-hw}" x2="${p.x}" y2="${p.y+hw}"/>`;
        eHtml+=`<line class="win-inner" x1="${p.x-4}" y1="${p.y-hw}" x2="${p.x-4}" y2="${p.y+hw}"/>`;
        eHtml+=`<line class="win-inner" x1="${p.x+4}" y1="${p.y-hw}" x2="${p.x+4}" y2="${p.y+hw}"/>`;
      }
    } else if(el.type==='box'){
      const st=BOX_STATUS[el.status]||BOX_STATUS.nova;
      const isCFrom=S.connectFrom===el.id;
      const cap=el.size||1;
      const moduli=el.moduli||[];
      const zauzeto=zauzetM(el);

      // Proportional box shape:
      // 1M = 8×12px, each extra M adds 7px along wall axis
      const SLOT_W=7, BASE_W=8, H=12;
      const boxW=BASE_W+(cap-1)*SLOT_W; // along-wall width
      const boxH=H;                      // perpendicular (into room)
      const isH=(el.wall==='N'||el.wall==='S');

      // Rectangle: centered on p, extends along wall (x if N/S, y if E/W)
      // and inward from wall (nx/ny direction)
      const hw=boxW/2, hh=boxH/2;
      let rx,ry,rw,rh;
      if(isH){
        rx=p.x-hw; ry=p.y+(p.ny>0?0:-boxH);
        rw=boxW; rh=boxH;
      } else {
        rx=p.x+(p.nx>0?0:-boxH); ry=p.y-hw;
        rw=boxH; rh=boxW;
      }

      const sw=isCFrom?3:2;
      // Background rect
      bHtml+=`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}"
        rx="2" fill="${st.fill}" stroke="${st.color}" stroke-width="${sw}"
        data-eid="${el.id}" style="cursor:pointer"/>`;

      // Module slot segments — colored strips inside rect
      if(moduli.length>0){
        let pos=0;
        for(const m of moduli){
          const kb=KAT_BOJE[m.kat]||KAT_BOJE.ostalo;
          const frac0=pos/cap, frac1=(pos+m.vel)/cap;
          if(isH){
            const sx=rx+frac0*rw, sw2=(frac1-frac0)*rw;
            bHtml+=`<rect x="${sx}" y="${ry+1}" width="${sw2}" height="${rh-2}"
              rx="1" fill="${kb.color}" opacity=".45" pointer-events="none"/>`;
          } else {
            const sy=ry+frac0*rh, sh2=(frac1-frac0)*rh;
            bHtml+=`<rect x="${rx+1}" y="${sy}" width="${rw-2}" height="${sh2}"
              rx="1" fill="${kb.color}" opacity=".45" pointer-events="none"/>`;
          }
          pos+=m.vel;
        }
      }

      // Hit target covering the whole rect (already covered by rect data-eid)
      // but also add a transparent wider rect for easier tapping
      bHtml+=`<rect x="${rx-4}" y="${ry-4}" width="${rw+8}" height="${rh+8}"
        rx="3" fill="transparent" stroke="none"
        data-eid="${el.id}" style="cursor:pointer"/>`;

      // Code label — offset away from wall (further to make room for dims)
      const labelOff = hh + 12;
      const lx=p.x+p.nx*labelOff, ly=p.y+p.ny*labelOff;
      bHtml+=`<text class="box-label" x="${lx}" y="${ly}" fill="${st.color}"
        dominant-baseline="middle" text-anchor="middle" data-eid="${el.id}">${el.code}</text>`;

      // Dimension annotations — offset cm and height cm
      // Show only when zoom is sufficient (always show, small text)
      const offCm=Math.round(el.offsetM*100);
      const hCm=el.heightCm||110;
      const dimOff=labelOff+9;
      const dimX=p.x+p.nx*dimOff, dimY=p.y+p.ny*dimOff;
      const dimColor=st.color+'99'; // slightly transparent
      bHtml+=`<text x="${dimX}" y="${dimY-4}" fill="${dimColor}"
        dominant-baseline="middle" text-anchor="middle"
        font-size="6" font-family="Space Mono,monospace"
        pointer-events="none">${offCm}cm</text>`;
      bHtml+=`<text x="${dimX}" y="${dimY+5}" fill="${dimColor}"
        dominant-baseline="middle" text-anchor="middle"
        font-size="6" font-family="Space Mono,monospace"
        pointer-events="none">↑${hCm}</text>`;

      // Size badge inside rect (if 3M+)
      if(cap>=3){
        const cx=isH?p.x:(rx+rw/2);
        const cy=isH?(ry+rh/2):p.y;
        bHtml+=`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
          fill="${st.color}" font-size="6" font-weight="700" font-family="Space Mono,monospace"
          opacity=".8" pointer-events="none">${cap}M</text>`;
      }

      // Selected (connect mode) highlight
      if(isCFrom){
        bHtml+=`<rect x="${rx-2}" y="${ry-2}" width="${rw+4}" height="${rh+4}"
          rx="3" fill="none" stroke="${st.color}" stroke-width="2" stroke-dasharray="3 2"
          opacity=".7" pointer-events="none"/>`;
      }
    }
  }

  gE.innerHTML=eHtml;
  gB.innerHTML=bHtml;
  // Box tap events handled centrally in canvas.js via hitBox()
}

function onBoxTap(eid){
  if(S.connectMode){ onBoxTapConnect(eid); return; }
  openKonfigurator(eid);
}
function showWallPreview(){
  if(!S.selWall) return;
  const {roomId, wall} = S.selWall;
  const r = S.rooms.find(x=>x.id===roomId);
  if(!r) return;

  const lenM  = wallLenM(r, wall);
  const wallH = 2.7;

  const PAD=40, W=600, H=200;
  const scaleX = (W-PAD*2)/lenM;
  const scaleY = (H-PAD*2)/wallH;
  const floorY = PAD+(H-PAD*2);
  const ceilY  = PAD;

  // Pogled IZ SOBE — mirror horizontalne ose:
  // Zid N: gledam sjever, lijeva=zapad=start ugao W kraju → normalno
  // Zid S: gledam jug,   lijeva=istok, start ugao W kraju → MIRROR
  // Zid W: gledam zapad, lijeva=jug,   start ugao N kraju → MIRROR
  // Zid E: gledam istok, lijeva=sjever, start ugao N kraju → normalno
  const mirror = (wall==='S' || wall==='W');

  function xAt(offsetM, fromCorner){
    const raw = fromCorner==='start' ? offsetM : (lenM-offsetM);
    return mirror ? (W-PAD-raw*scaleX) : (PAD+raw*scaleX);
  }

  const leftLabel  = {N:'← Zapad', S:'← Istok', W:'← Jug',    E:'← Sjever'}[wall];
  const rightLabel = {N:'Istok →', S:'Zapad →', W:'Sjever →', E:'Jug →'}[wall];

  const boxes = S.elements.filter(e=>e.roomId===roomId&&e.wall===wall&&e.type==='box');
  const doors = S.elements.filter(e=>e.roomId===roomId&&e.wall===wall&&e.type==='door');
  const wins  = S.elements.filter(e=>e.roomId===roomId&&e.wall===wall&&e.type==='window');

  const COL_WALL = 'var(--border2)';

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H+80}" style="width:100%;background:var(--bg);border-radius:8px;display:block">`;

  svg+=`<line x1="${PAD}" y1="${floorY}" x2="${W-PAD}" y2="${floorY}" stroke="${COL_WALL}" stroke-width="3"/>`;
  svg+=`<line x1="${PAD}" y1="${ceilY}"  x2="${W-PAD}" y2="${ceilY}"  stroke="${COL_WALL}" stroke-width="1" stroke-dasharray="4 3" opacity=".4"/>`;
  svg+=`<line x1="${PAD}" y1="${ceilY}"  x2="${PAD}"   y2="${floorY}" stroke="${COL_WALL}" stroke-width="3"/>`;
  svg+=`<line x1="${W-PAD}" y1="${ceilY}" x2="${W-PAD}" y2="${floorY}" stroke="${COL_WALL}" stroke-width="3"/>`;
  svg+=`<text x="${W/2}" y="${ceilY-10}" text-anchor="middle" fill="var(--text3)" font-size="10" font-family="Space Mono,monospace">${r.name} · Zid ${wall} · pogled iznutra</text>`;
  svg+=`<text x="${PAD+4}" y="${floorY+11}" text-anchor="start" fill="var(--text3)" font-size="8" font-family="Space Mono,monospace">${leftLabel}</text>`;
  svg+=`<text x="${W-PAD-4}" y="${floorY+11}" text-anchor="end" fill="var(--text3)" font-size="8" font-family="Space Mono,monospace">${rightLabel}</text>`;

  const dimY=floorY+24;
  svg+=`<line x1="${PAD}" y1="${dimY}" x2="${W-PAD}" y2="${dimY}" stroke="var(--text3)" stroke-width="1" opacity=".5"/>`;
  svg+=`<line x1="${PAD}" y1="${dimY-4}" x2="${PAD}" y2="${dimY+4}" stroke="var(--text3)" stroke-width="1" opacity=".5"/>`;
  svg+=`<line x1="${W-PAD}" y1="${dimY-4}" x2="${W-PAD}" y2="${dimY+4}" stroke="var(--text3)" stroke-width="1" opacity=".5"/>`;
  svg+=`<text x="${W/2}" y="${dimY+11}" text-anchor="middle" fill="var(--text3)" font-size="9" font-family="Space Mono,monospace">${lenM} m</text>`;

  doors.forEach(d=>{
    const cx=xAt(d.offsetM,d.fromCorner), wPx=(d.widthM||0.9)*scaleX, hPx=wPx*0.85;
    svg+=`<rect x="${cx-wPx/2}" y="${floorY-hPx}" width="${wPx}" height="${hPx}" fill="rgba(232,160,48,.07)" stroke="${BOX_STATUS.tabla.color}" stroke-width="1.5"/>`;
    svg+=`<line x1="${cx-wPx/2}" y1="${floorY}" x2="${cx-wPx/2}" y2="${floorY-hPx}" stroke="${BOX_STATUS.tabla.color}" stroke-width="2"/>`;
    svg+=`<line x1="${cx+wPx/2}" y1="${floorY}" x2="${cx+wPx/2}" y2="${floorY-hPx}" stroke="${BOX_STATUS.tabla.color}" stroke-width="2"/>`;
    svg+=`<text x="${cx}" y="${floorY-hPx-5}" text-anchor="middle" fill="${BOX_STATUS.tabla.color}" font-size="8" font-family="Space Mono,monospace">🚪 ${Math.round((d.widthM||0.9)*100)}cm</text>`;
  });

  wins.forEach(w=>{
    const cx=xAt(w.offsetM,w.fromCorner), wPx=(w.widthM||1.2)*scaleX;
    const yTop=floorY-1.5*scaleY, yBot=floorY-0.9*scaleY;
    svg+=`<rect x="${cx-wPx/2}" y="${yTop}" width="${wPx}" height="${yBot-yTop}" fill="rgba(90,159,212,.1)" stroke="${BOX_STATUS.postojeca_bez.color}" stroke-width="2"/>`;
    svg+=`<line x1="${cx-wPx/2}" y1="${(yTop+yBot)/2}" x2="${cx+wPx/2}" y2="${(yTop+yBot)/2}" stroke="${BOX_STATUS.postojeca_bez.color}" stroke-width="1" opacity=".5"/>`;
    svg+=`<text x="${cx}" y="${yTop-5}" text-anchor="middle" fill="${BOX_STATUS.postojeca_bez.color}" font-size="8" font-family="Space Mono,monospace">🪟 ${Math.round((w.widthM||1.2)*100)}cm</text>`;
  });

  const CABLE_BASE_Y=ceilY+10, CABLE_STEP=12;
  let cLayer=0;
  S.connections.forEach(conn=>{
    const eA=S.elements.find(x=>x.id===conn.aId);
    const eB=S.elements.find(x=>x.id===conn.bId);
    if(!eA||!eB) return;
    const aH=eA.roomId===roomId&&eA.wall===wall&&eA.type==='box';
    const bH=eB.roomId===roomId&&eB.wall===wall&&eB.type==='box';
    const cCol=conn.kabl?.boja||'var(--accent)';
    if(aH&&bH){
      const ax=xAt(eA.offsetM,eA.fromCorner), ay=floorY-((eA.heightCm||110)/100)*scaleY;
      const bx=xAt(eB.offsetM,eB.fromCorner), by=floorY-((eB.heightCm||110)/100)*scaleY;
      const ry=CABLE_BASE_Y+cLayer*CABLE_STEP; cLayer++;
      svg+=`<line x1="${ax}" y1="${ay}" x2="${ax}" y2="${ry}" stroke="${cCol}" stroke-width="1.5" stroke-dasharray="4 2"/>`;
      svg+=`<line x1="${bx}" y1="${by}" x2="${bx}" y2="${ry}" stroke="${cCol}" stroke-width="1.5" stroke-dasharray="4 2"/>`;
      svg+=`<line x1="${ax}" y1="${ry}" x2="${bx}" y2="${ry}" stroke="${cCol}" stroke-width="1.5" stroke-dasharray="4 2"/>`;
      const len=Math.round(((Math.abs(bx-ax)+Math.abs(ay-ry)+Math.abs(by-ry))/scaleX+0.3)*10)/10;
      const mx=(ax+bx)/2;
      svg+=`<rect x="${mx-16}" y="${ry-9}" width="32" height="12" rx="3" fill="var(--bg)" opacity=".9"/>`;
      svg+=`<text x="${mx}" y="${ry-2}" text-anchor="middle" fill="${cCol}" font-size="8" font-family="Space Mono,monospace">${len}m</text>`;
    } else if(aH||bH){
      const on=aH?eA:eB, off=aH?eB:eA;
      const ox=xAt(on.offsetM,on.fromCorner), oy=floorY-((on.heightCm||110)/100)*scaleY;
      const ry=CABLE_BASE_Y+cLayer*CABLE_STEP; cLayer++;
      const exitX=ox<W/2?PAD:W-PAD;
      const ad=exitX===PAD?1:-1;
      svg+=`<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${ry}" stroke="${cCol}" stroke-width="1.5" stroke-dasharray="4 2"/>`;
      svg+=`<line x1="${ox}" y1="${ry}" x2="${exitX}" y2="${ry}" stroke="${cCol}" stroke-width="1.5" stroke-dasharray="4 2"/>`;
      svg+=`<polygon points="${exitX},${ry} ${exitX+ad*7},${ry-4} ${exitX+ad*7},${ry+4}" fill="${cCol}"/>`;
      const offRoom=S.rooms.find(x=>x.id===off.roomId);
      const lx=exitX===PAD?PAD+8:W-PAD-8, anch=exitX===PAD?'start':'end';
      svg+=`<text x="${lx}" y="${ry-6}" text-anchor="${anch}" fill="${(BOX_STATUS[off.status]||BOX_STATUS.nova).color}" font-size="8" font-family="Space Mono,monospace">→ ${off.code} (${offRoom?.name||'?'} · Zid ${off.wall})</text>`;
    }
  });

  const BOX_1M=10, BOX_SLOT=8, BOX_H=16;
  boxes.forEach((b,idx)=>{
    const st=BOX_STATUS[b.status]||BOX_STATUS.nova;
    const cx=xAt(b.offsetM,b.fromCorner), cy=floorY-((b.heightCm||110)/100)*scaleY;
    const cap=b.size||1, moduli=b.moduli||[];
    const bW=BOX_1M+(cap-1)*BOX_SLOT, bH=BOX_H;
    const rx=cx-bW/2, ry=cy-bH/2;
    const hCm=b.heightCm||110;
    const offCm=Math.round(b.offsetM*100);

    // Vertical dashed drop line floor→box
    svg+=`<line x1="${cx}" y1="${floorY}" x2="${cx}" y2="${ry+bH}" stroke="${st.color}" stroke-width="1" stroke-dasharray="3 2" opacity=".2"/>`;

    // Height kota — vertical dimension line on left of box
    const kotaX=rx-18;
    svg+=`<line x1="${kotaX}" y1="${floorY}" x2="${kotaX}" y2="${cy}" stroke="${st.color}" stroke-width="1" opacity=".5"/>`;
    svg+=`<line x1="${kotaX-3}" y1="${floorY}" x2="${kotaX+3}" y2="${floorY}" stroke="${st.color}" stroke-width="1" opacity=".5"/>`;
    svg+=`<line x1="${kotaX-3}" y1="${cy}" x2="${kotaX+3}" y2="${cy}" stroke="${st.color}" stroke-width="1" opacity=".5"/>`;
    svg+=`<text x="${kotaX-4}" y="${(floorY+cy)/2}" text-anchor="end" dominant-baseline="middle" fill="${st.color}" font-size="8" font-family="Space Mono,monospace" font-weight="700">${hCm}cm</text>`;
    // Leader from kota line to box
    svg+=`<line x1="${kotaX}" y1="${cy}" x2="${rx}" y2="${cy}" stroke="${st.color}" stroke-width="1" opacity=".3" stroke-dasharray="2 2"/>`;

    // Box
    svg+=`<rect x="${rx}" y="${ry}" width="${bW}" height="${bH}" rx="2" fill="${st.fill}" stroke="${st.color}" stroke-width="1.5"/>`;
    if(moduli.length>0){
      let pos=0;
      for(const m of moduli){
        const kb=KAT_BOJE[m.kat]||KAT_BOJE.ostalo;
        svg+=`<rect x="${rx+(pos/cap)*bW+1}" y="${ry+1}" width="${((m.vel/cap)*bW)-2}" height="${bH-2}" rx="1" fill="${kb.color}" opacity=".55"/>`;
        pos+=m.vel;
      }
    } else {
      for(let i=1;i<cap;i++){
        const tx=rx+(i/cap)*bW;
        svg+=`<line x1="${tx}" y1="${ry+3}" x2="${tx}" y2="${ry+bH-3}" stroke="${st.color}" stroke-width=".5" opacity=".25"/>`;
      }
    }

    // Code label above box
    svg+=`<text x="${cx}" y="${ry-4}" text-anchor="middle" fill="${st.color}" font-size="8" font-family="Space Mono,monospace" font-weight="bold">${b.code}</text>`;
    if(cap>=3&&moduli.length===0)
      svg+=`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${st.color}" font-size="7" font-family="Space Mono,monospace" opacity=".5">${cap}M</text>`;
    if(moduli.length>0){
      const kb=KAT_BOJE[moduli[0].kat]||KAT_BOJE.ostalo;
      svg+=`<text x="${cx}" y="${ry+bH+9}" text-anchor="middle" fill="${kb.color}" font-size="7" font-family="Space Mono,monospace">${moduli.length===1?moduli[0].naziv.slice(0,14):zauzetM(b)+'/'+cap+'M'}</text>`;
    }

    // Horizontal offset kota — below floor line, alternating rows
    const fromLeft=mirror?b.fromCorner==='end':b.fromCorner==='start';
    const dFromX=fromLeft?PAD:W-PAD;
    const dY=floorY+30+(idx%2)*14;
    svg+=`<line x1="${dFromX}" y1="${dY}" x2="${cx}" y2="${dY}" stroke="${st.color}" stroke-width="1" opacity=".5"/>`;
    svg+=`<line x1="${dFromX}" y1="${dY-3}" x2="${dFromX}" y2="${dY+3}" stroke="${st.color}" stroke-width="1" opacity=".5"/>`;
    svg+=`<line x1="${cx}" y1="${dY-3}" x2="${cx}" y2="${dY+3}" stroke="${st.color}" stroke-width="1" opacity=".5"/>`;
    svg+=`<text x="${(dFromX+cx)/2}" y="${dY+10}" text-anchor="middle" fill="${st.color}" font-size="8" font-family="Space Mono,monospace" font-weight="700">${offCm}cm</text>`;
  });

  svg+=`</svg>`;
  openSheet(`
    <div class="sheet-title">📐 ${r.name} · Zid ${wall}</div>
    <div style="margin-bottom:14px">${svg}</div>
    <div style="font-size:10px;color:var(--text3);margin-bottom:12px;font-family:var(--font)">visina: 2.70m pretpostavljena</div>
    <button class="btn btn-ghost" style="width:100%;justify-content:center" data-action="closeSheet">Zatvori</button>
  `);
}


loadState();
applyVP();
if(S.rooms.length > 0){
  hint('Tapni zid za doznu, ili dodaj prostoriju');
} else {
  hint('Tapni ＋ Prostorija da počneš');
}
render();

function toggleBill(){
  S.billOpen=!S.billOpen;
  document.getElementById('bill-wrap').style.display=S.billOpen?'flex':'none';
  if(S.billOpen) renderBill();
}

function renderBill(){
  const boxes=S.elements.filter(e=>e.type==='box');
  const bySt={};
  boxes.forEach(b=>{ bySt[b.status]=(bySt[b.status]||0)+1; });
  const totalM=S.connections.reduce((s,c)=>{
    const eA=S.elements.find(x=>x.id===c.aId);
    const eB=S.elements.find(x=>x.id===c.bId);
    if(!eA||!eB) return s;
    return s+cableLenM(c);
  },0);
  const doors=S.elements.filter(e=>e.type==='door').length;
  const wins=S.elements.filter(e=>e.type==='window').length;

  const row=(k,v,color='')=>`<div style="display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px;gap:8px">
    <span style="color:var(--text2);flex:1">${k}</span>
    <span style="font-weight:700;font-family:var(--font);white-space:nowrap;${color?'color:'+color:''}">${v}</span>
  </div>`;

  let html='<div style="display:flex;flex-direction:column;gap:0">';

  // Pregled
  Object.entries(bySt).forEach(([s,n])=>{ html+=row(BOX_STATUS[s]?.label||s, n+' kom'); });
  if(doors) html+=row('Vrata', doors+' kom');
  if(wins)  html+=row('Prozori', wins+' kom');
  html+=row('Strujni krugovi', S.connections.length+' kom');
  html+=`<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid var(--border)">
    <span style="color:var(--accent);font-weight:700;letter-spacing:.06em">KABLOVI ~</span>
    <span style="color:var(--accent);font-weight:700;font-family:var(--font);font-size:16px">${Math.round(totalM*10)/10} m</span>
  </div>`;

  html+=`<div style="padding:10px 0 4px;font-size:10px;font-weight:700;color:var(--text);letter-spacing:.05em;border-top:2px solid var(--border2);margin-top:8px">LISTA NABAVKE</div>`;

  if(!boxes.length){
    html+='<div style="color:var(--text3);font-size:10px;padding:8px 0">Nema dozni u projektu.</div>';
  } else {
    const dozneBroj={}, maskeBroj={}, moduliAgg={}, kablAgg={};

    boxes.forEach(b=>{
      const size=b.size||1;
      const mat=b.materijal||'cigla';
      const isGips=mat==='gips';
      const matLabel={gips:'gips',cigla:'čvrst zid',siporex:'siporex',beton:'beton'}[mat]||mat;

      let key, label, tip;
      if(size<=2){
        if(isGips){
          key='A-fi68-'+size+'M'; label='Dozna Ø68×60mm sa krilcima (gips) '+size+'M'; tip='dozna';
        } else {
          key='A-fi60-'+size+'M'; label='Dozna Ø60×45mm ('+matLabel+') '+size+'M'; tip='dozna';
        }
      } else {
        // Pravougaona dozna
        const dKey=isGips
          ? 'A-prav-gips-'+String(size).padStart(2,'0')+'M'
          : 'A-prav-cvrst-'+String(size).padStart(2,'0')+'M';
        const dLabel=isGips
          ? 'Dozna pravougaona '+size+'M (gips)'
          : 'Dozna pravougaona '+size+'M ('+matLabel+')';
        if(!dozneBroj[dKey]) dozneBroj[dKey]={label:dLabel, n:0, tip:'dozna'};
        dozneBroj[dKey].n++;
        key='B-nosac-'+String(size).padStart(2,'0')+'M';
        label='Nosač prirubnica '+size+'M EXP'; tip='nosač';
      }
      if(!dozneBroj[key]) dozneBroj[key]={label, n:0, tip};
      dozneBroj[key].n++;

      // Nosač ide na SVE dozne (i 1M i 2M)
      if(size<=2){
        const nKey='B-nosac-'+String(size).padStart(2,'0')+'M';
        const nLabel='Nosač prirubnica '+size+'M EXP';
        if(!dozneBroj[nKey]) dozneBroj[nKey]={label:nLabel, n:0, tip:'nosač'};
        dozneBroj[nKey].n++;
      }

      const mk=String(size).padStart(2,'0')+'M';
      if(!maskeBroj[mk]) maskeBroj[mk]={label:'Maska '+size+'M bijela FRAME EXP', n:0};
      maskeBroj[mk].n++;

      (b.moduli||[]).forEach(m=>{
        const k=m.kod+'.0';
        if(!moduliAgg[k]) moduliAgg[k]={naziv:m.naziv, sifra:k, kat:m.kat, n:0};
        moduliAgg[k].n++;
      });
    });

    S.connections.forEach(c=>{
      const eA=S.elements.find(x=>x.id===c.aId);
      const eB=S.elements.find(x=>x.id===c.bId);
      if(!eA||!eB) return;
      const len=cableLenM(c);
      const sifra=c.kabl?.sifra||'PPY-3x2.5';
      if(!kablAgg[sifra]) kablAgg[sifra]={naziv:c.kabl?.naziv||sifra, boja:c.kabl?.boja||'#d4550a', metara:0};
      kablAgg[sifra].metara+=len;
    });

    const dk=Object.keys(dozneBroj).sort();
    if(dk.length){
      html+='<div style="font-size:9px;color:var(--text2);letter-spacing:.06em;text-transform:uppercase;padding:6px 0 3px">Dozne / Nosači</div>';
      dk.forEach(k=>{ const d=dozneBroj[k]; html+=row(d.label, d.n+' kom', TIP_BOJA[d.tip]); });
    }

    const mk2=Object.keys(maskeBroj).sort();
    if(mk2.length){
      html+='<div style="font-size:9px;color:var(--text2);letter-spacing:.06em;text-transform:uppercase;padding:8px 0 3px">Maske</div>';
      mk2.forEach(k=>{ html+=row(maskeBroj[k].label, maskeBroj[k].n+' kom', TIP_BOJA.maska); });
    }

    const mods=Object.values(moduliAgg).sort((a,b)=>a.naziv.localeCompare(b.naziv));
    if(mods.length){
      html+='<div style="font-size:9px;color:var(--text2);letter-spacing:.06em;text-transform:uppercase;padding:8px 0 3px">Moduli (bijeli)</div>';
      mods.forEach(m=>{ const kb=KAT_BOJE[m.kat]||KAT_BOJE.ostalo; html+=row(m.naziv+' <small style="color:var(--text3);font-size:8px">'+m.sifra+'</small>', m.n+' kom', kb.color); });
    }

    const kabls=Object.values(kablAgg).sort((a,b)=>a.naziv.localeCompare(b.naziv));
    if(kabls.length){
      html+='<div style="font-size:9px;color:var(--text2);letter-spacing:.06em;text-transform:uppercase;padding:8px 0 3px">Kablovi (+10% rezerva)</div>';
      kabls.forEach(k=>{ html+=row(k.naziv, Math.ceil(k.metara*1.1)+' m', k.boja); });
    }
  }

  html+='</div>';
  document.getElementById('bill-body').innerHTML=html;
}

// ═══════════════════════════════════════════════════════
// CANVAS INPUT — centralizovano, touch-first
// SVG elementi NEMAJU vlastite event listenere.
// Sve se obrađuje ovdje kroz hit-test u canvas koordinatama.
// ═══════════════════════════════════════════════════════

let _drag   = null;  // {room, sx, sy, origX, origY}
let _pan    = null;  // {vpX, vpY, sx, sy}
let _pinch  = null;  // {dist}
let _moved  = false;
let _t0     = null;  // raw screen {x,y} pri touchstart
let _lpTimer= null;

const MOVE_THRESH   = 8;
const LONG_PRESS_MS = 550;

// ── Koordinatne pomoćne funkcije ─────────────────────────
function _raw(e){
  const s = e.touches?.length       ? e.touches[0]
           : e.changedTouches?.length ? e.changedTouches[0]
           : e;
  const r = document.getElementById('svg').getBoundingClientRect();
  return { x: s.clientX - r.left, y: s.clientY - r.top };
}
function _canvas(raw){ return screenToCanvas(raw.x, raw.y); }

// ── TOUCHSTART ───────────────────────────────────────────
function _onTouchStart(e){
  e.preventDefault(); // blokira scroll i ghost click

  if(e.touches.length === 2){
    // Pinch
    _pinch = { dist: _pinchDist(e.touches) };
    _drag = _pan = null; _t0 = null;
    clearTimeout(_lpTimer);
    return;
  }

  _pinch = null;
  const raw = _raw(e);
  const pt  = _canvas(raw);
  _t0    = raw;
  _moved = false;
  clearTimeout(_lpTimer);

  // Dozna — bilježimo, tap će se obraditi u _onTouchEnd
  if(hitBox(pt) && !S.connectMode){ return; }

  // Soba — pripremi drag, long-press za edit
  const room = hitRoom(pt);
  if(room && !S.connectMode){
    _drag = { room, sx:pt.x, sy:pt.y, origX:room.x, origY:room.y };
    const rid = room.id;
    _lpTimer = setTimeout(()=>{
      if(!_moved){ _drag=null; promptEditRoom(rid); }
    }, LONG_PRESS_MS);
    return;
  }

  // Prazno — pan
  _pan = { vpX:S.vp.x, vpY:S.vp.y, sx:raw.x, sy:raw.y };
}

// ── TOUCHMOVE ────────────────────────────────────────────
function _onTouchMove(e){
  e.preventDefault();

  if(e.touches.length === 2 && _pinch){
    const d   = _pinchDist(e.touches);
    const r   = document.getElementById('svg').getBoundingClientRect();
    const mx  = (e.touches[0].clientX + e.touches[1].clientX)/2 - r.left;
    const my  = (e.touches[0].clientY + e.touches[1].clientY)/2 - r.top;
    zoomAt(mx, my, d / _pinch.dist);
    _pinch.dist = d;
    return;
  }

  if(!_t0) return;
  const raw  = _raw(e);
  const dist = Math.hypot(raw.x - _t0.x, raw.y - _t0.y);

  if(dist > MOVE_THRESH){
    _moved = true;
    clearTimeout(_lpTimer);
  }
  if(!_moved) return;

  if(_drag){
    const pt    = _canvas(raw);
    _drag.room.x = _drag.origX + (pt.x - _drag.sx);
    _drag.room.y = _drag.origY + (pt.y - _drag.sy);
    snapRoom(_drag.room);
    render();
    return;
  }

  if(_pan){
    S.vp.x = _pan.vpX + (raw.x - _pan.sx);
    S.vp.y = _pan.vpY + (raw.y - _pan.sy);
    applyVP();
  }
}

// ── TOUCHEND ─────────────────────────────────────────────
function _onTouchEnd(e){
  e.preventDefault();
  _lastTouchEnd = Date.now();
  _pinch = null;
  clearTimeout(_lpTimer);

  if(_drag && _moved){
    saveState();
    _drag = _pan = _t0 = null; _moved = false;
    return;
  }

  if(!_moved && _t0){
    // Bio je tap — odredi šta
    const pt = _canvas(_raw(e));

    // Dozna
    const box = hitBox(pt);
    if(box && !S.connectMode){ openKonfigurator(box.id); _reset(); return; }
    if(box && S.connectMode){ onBoxTapConnect(box.id); _reset(); return; }

    // Zid — hitWall ima veći radius, ali wall-hit elementi su u SVG
    // pa koristimo geometrijski hit-test
    const wall = hitWall(pt);
    if(wall && !S.connectMode){ onWallTap(wall.roomId, wall.wall); _reset(); return; }

    // Prazno — deselect
    if(!S.connectMode){ setToolbarDefault(); render(); }
  }

  _reset();
}

function _reset(){
  _drag = _pan = _t0 = null; _moved = false;
}

// ── MOUSE (desktop) ──────────────────────────────────────
function _onMouseDown(e){
  const raw = _raw(e);
  const pt  = _canvas(raw);
  _t0 = raw; _moved = false;

  if(hitBox(pt) && !S.connectMode) return;

  const room = hitRoom(pt);
  if(room && !S.connectMode){
    _drag = { room, sx:pt.x, sy:pt.y, origX:room.x, origY:room.y };
    _lpTimer = setTimeout(()=>{ if(!_moved){ _drag=null; promptEditRoom(room.id); } }, LONG_PRESS_MS);
    return;
  }
  _pan = { vpX:S.vp.x, vpY:S.vp.y, sx:raw.x, sy:raw.y };
}

function _onMouseMove(e){
  if(!_t0) return;
  const raw  = _raw(e);
  const dist = Math.hypot(raw.x - _t0.x, raw.y - _t0.y);
  if(dist > MOVE_THRESH){ _moved = true; clearTimeout(_lpTimer); }
  if(!_moved) return;

  if(_drag){
    const pt    = _canvas(raw);
    _drag.room.x = _drag.origX + (pt.x - _drag.sx);
    _drag.room.y = _drag.origY + (pt.y - _drag.sy);
    snapRoom(_drag.room); render(); return;
  }
  if(_pan){
    S.vp.x = _pan.vpX + (raw.x - _pan.sx);
    S.vp.y = _pan.vpY + (raw.y - _pan.sy);
    applyVP();
  }
}

function _onMouseUp(e){
  clearTimeout(_lpTimer);
  if(_drag && _moved) saveState();

  if(!_moved && _t0){
    const pt  = _canvas(_raw(e));
    const box = hitBox(pt);
    if(box && !S.connectMode){ openKonfigurator(box.id); _reset(); return; }
    if(box && S.connectMode){ onBoxTapConnect(box.id); _reset(); return; }
    const wall = hitWall(pt);
    if(wall && !S.connectMode){ onWallTap(wall.roomId, wall.wall); _reset(); return; }
    if(!S.connectMode){ setToolbarDefault(); render(); }
  }
  _reset();
}

function _onWheel(e){
  e.preventDefault();
  const r  = document.getElementById('svg').getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1/1.12);
}

function _pinchDist(t){
  return Math.hypot(t[0].clientX-t[1].clientX, t[0].clientY-t[1].clientY);
}

// ── Attach ───────────────────────────────────────────────
const _cw = document.getElementById('canvas-wrap');
_cw.addEventListener('touchstart', _onTouchStart, {passive:false});
_cw.addEventListener('touchmove',  _onTouchMove,  {passive:false});
_cw.addEventListener('touchend',   _onTouchEnd,   {passive:false});
_cw.addEventListener('mousedown',  _onMouseDown);
_cw.addEventListener('mousemove',  _onMouseMove);
_cw.addEventListener('mouseup',    _onMouseUp);
_cw.addEventListener('wheel',      _onWheel, {passive:false});

// ── FIT + RESET ──────────────────────────────────────────
function fitScreen(){
  if(!S.rooms.length){ S.vp={x:0,y:0,scale:1}; applyVP(); return; }
  const svg = document.getElementById('svg');
  const {width:cw, height:ch} = svg.getBoundingClientRect();
  const PAD = 40;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  S.rooms.forEach(r=>{
    minX=Math.min(minX,r.x); minY=Math.min(minY,r.y);
    maxX=Math.max(maxX,r.x+r.wPx); maxY=Math.max(maxY,r.y+r.hPx);
  });
  const cW=maxX-minX+PAD*2, cH=maxY-minY+PAD*2;
  const scale=Math.min(VP_MAX,Math.max(VP_MIN,Math.min(cw/cW,ch/cH)));
  S.vp.scale=scale;
  S.vp.x=(cw-cW*scale)/2-(minX-PAD)*scale;
  S.vp.y=(ch-cH*scale)/2-(minY-PAD)*scale;
  applyVP(); showZoomBadge();
}

function promptReset(){
  S.rooms=[]; S.elements=[]; S.connections=[];
  S.nextRoom=1; S.nextBox=1; S.serija=null;
  S.selWall=null; S.connectMode=false; S.connectFrom=null;
  S.vp={x:0,y:0,scale:1};
  localStorage.removeItem(LS_KEY);
  setToolbarDefault(); applyVP(); render();
  hint('Tapni ＋ Prostorija da počneš');
  toast('Projekat obrisan');
}

loadState();applyVP();hint(S.rooms.length?"Tapni zid za doznu":"Tapni ＋ Prostorija da počneš");render();
