// RM NIERUCHOMOŚCI, Inwentaryzacja, logika aplikacji
// (c) Rafał Lenart, biuro@rmnieruchomosci.pl

// ============ STATE ============
let state = null;
let currentScreen = 'home';

// ============ INDEXEDDB ============
const DB_NAME = 'inwentaryzacja-rm';
const DB_VERSION = 1;
const STORE = 'inventories';
let db = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains(STORE)) {
        const store = idb.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('adres', 'adres', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function dbPut(item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function dbGet(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============ HELPERS ============
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function fmtDate(d) {
  const x = d ? new Date(d) : new Date();
  const day = String(x.getDate()).padStart(2, '0');
  const m = String(x.getMonth() + 1).padStart(2, '0');
  return `${day}.${m}.${x.getFullYear()}`;
}
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1800);
}

function escapeAttr(v) {
  if (v == null) return '';
  return String(v).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============ DANE PRZEKAZUJĄCEGO (localStorage) ============
const LS_PRZEKAZUJACY = 'rm_przekazujacy_v1';

function getPrzekazujacy() {
  try {
    const raw = localStorage.getItem(LS_PRZEKAZUJACY);
    if (raw) return { ...DEFAULT_PRZEKAZUJACY, ...JSON.parse(raw) };
  } catch (e) { console.warn(e); }
  return { ...DEFAULT_PRZEKAZUJACY };
}

function savePrzekazujacy(data) {
  try { localStorage.setItem(LS_PRZEKAZUJACY, JSON.stringify(data)); }
  catch (e) { console.warn(e); }
}

function renderPrzekazujacyOnHome() {
  const d = getPrzekazujacy();
  $('#prz-imie').value = d.imie || '';
  $('#prz-stanowisko').value = d.stanowisko || '';
  $('#prz-dowod').value = d.dowod || '';
  $('#prz-dataWaznosci').value = d.dataWaznosci || '';
  $('#prz-adres').value = d.adres || '';
  $('#prz-telefon').value = d.telefon || '';
  $('#prz-email').value = d.email || '';
}

function bindPrzekazujacyInputs() {
  const fields = ['imie','stanowisko','dowod','dataWaznosci','adres','telefon','email'];
  fields.forEach(f => {
    const inp = document.getElementById('prz-' + f);
    if (!inp) return;
    inp.addEventListener('input', () => {
      const d = getPrzekazujacy();
      d[f] = inp.value;
      savePrzekazujacy(d);
    });
  });
  // toggle collapse
  const toggle = $('#prz-toggle');
  const body = $('#prz-body');
  const card = $('#przekazujacy-card');
  if (toggle && body && card) {
    toggle.addEventListener('click', () => {
      card.classList.toggle('collapsed');
    });
  }
}

// ============ DYKTOWANIE GŁOSOWE ============
function isSpeechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

let _activeMic = null;
let _activeBtn = null;
let _activeBaseValue = '';
let _activeTimeout = null;

function cleanupMic(btn) {
  if (btn) {
    btn.classList.remove('listening');
    btn.textContent = '🎤';
  }
  if (_activeTimeout) { clearTimeout(_activeTimeout); _activeTimeout = null; }
  _activeMic = null;
  _activeBtn = null;
}

function startDictation(targetInput, btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast('Twoja przeglądarka nie obsługuje dyktowania (spróbuj klawiatury z mikrofonem)');
    return;
  }

  // jeśli już nasłuchuje — klik = stop (na ten sam lub inny przycisk)
  if (_activeMic) {
    try { _activeMic.stop(); } catch (e) {}
    try { _activeMic.abort(); } catch (e) {}
    cleanupMic(_activeBtn);
    if (_activeBtn === btn) return;
  }

  const rec = new SR();
  rec.lang = 'pl-PL';
  rec.continuous = false; // single shot — lepiej działa na iOS Safari
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  _activeMic = rec;
  _activeBtn = btn;
  _activeBaseValue = targetInput.value || '';
  btn.classList.add('listening');
  btn.textContent = '⏹';

  // Safety timeout: po 25s automatycznie zatrzymaj (na iOS gdy onend nie przyjdzie)
  _activeTimeout = setTimeout(() => {
    if (_activeMic === rec) {
      try { rec.stop(); } catch (e) {}
      try { rec.abort(); } catch (e) {}
      cleanupMic(btn);
      toast('Czas minął, naciśnij znów żeby kontynuować');
    }
  }, 25000);

  let finalTranscript = '';

  rec.onstart = () => { toast('Słucham...'); };

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const txt = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTranscript += txt;
      else interim += txt;
    }
    const combined = (finalTranscript + interim).trim();
    if (!combined) return;
    const base = _activeBaseValue.trim();
    targetInput.value = base ? (base + ' ' + combined) : combined;
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
  };

  rec.onerror = (e) => {
    console.warn('Speech error', e);
    if (e.error === 'no-speech') {
      toast('Nie usłyszałem, spróbuj ponownie');
    } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      toast('Brak dostępu do mikrofonu. Wejdź w ustawienia Safari i pozwól.');
    } else if (e.error === 'audio-capture') {
      toast('Mikrofon niedostępny');
    } else if (e.error !== 'aborted') {
      toast('Błąd dyktowania: ' + e.error);
    }
    cleanupMic(btn);
  };

  rec.onend = () => {
    cleanupMic(btn);
  };

  try { rec.start(); }
  catch (e) {
    console.warn('rec.start error', e);
    btn.classList.remove('listening');
    btn.textContent = '🎤';
    _activeMic = null;
    _activeBtn = null;
    toast('Nie udało się włączyć mikrofonu');
  }
}

function micButton(targetSelector) {
  if (!isSpeechSupported()) return '';
  return `<button class="mic-btn" type="button" data-mic="${targetSelector}" title="Dyktuj">🎤</button>`;
}

// po renderze: podłącz wszystkie miki w danym kontenerze
function bindMicButtons(root = document) {
  root.querySelectorAll('.mic-btn:not([data-bound])').forEach(btn => {
    btn.setAttribute('data-bound', '1');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const sel = btn.dataset.mic;
      const target = document.querySelector(sel);
      if (!target) return;
      startDictation(target, btn);
    });
  });
}

// ============ ZDJĘCIA: kompresja ============
function compressImage(file, maxDim = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round(height * maxDim / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round(width * maxDim / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============ STATE: tworzenie nowej inwentaryzacji ============
function newInventory(typ) {
  return {
    id: uid(),
    typ,
    adres: '',
    data: todayISO(),
    najemcy: [emptyNajemca()],
    liczniki: DEFAULT_LICZNIKI.map(l => ({
      nazwa: l.nazwa,
      krotkaNazwa: l.krotkaNazwa || null,
      grupa: l.grupa || null,
      numer: '',
      odczyt: '',
      zdjecia: []
    })),
    akcesoria: DEFAULT_AKCESORIA.map(a => ({ ...a })),
    akcesoriaInne: '',
    pomieszczenia: [],
    uwagi: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function emptyNajemca() {
  return { imie: '', pesel: '', adres: '', telefon: '', email: '' };
}

function makePomieszczenie(tpl) {
  return {
    id: uid(),
    nazwa: tpl.nazwa,
    ikona: tpl.ikona || '🚪',
    open: false,
    pozycje: tpl.pozycje.map(p => ({
      id: uid(),
      nazwa: p.nazwa,
      typ: p.typ,
      aktywna: false,
      wartosc: p.typ === 'ilosc' ? null : '',
      marka: p.marka ? '' : null,
      uwagi: '',
      zdjecia: []
    })),
    stanTechniczny: emptyStanTechniczny()
  };
}

const ELEMENTY_TECHNICZNE = [
  { id: 'sciany',  nazwa: 'Ściany',  ikona: '🧱' },
  { id: 'podloga', nazwa: 'Podłoga', ikona: '🟫' },
  { id: 'sufit',   nazwa: 'Sufit',   ikona: '⬜' },
  { id: 'okna',    nazwa: 'Okna',    ikona: '🪟' },
  { id: 'drzwi',   nazwa: 'Drzwi',   ikona: '🚪' }
];

function emptyStanTechniczny() {
  const out = {};
  ELEMENTY_TECHNICZNE.forEach(e => {
    out[e.id] = { stan: '', uwagi: '', zdjecia: [] };
  });
  return out;
}

// ============ NAWIGACJA ============
function showScreen(name) {
  currentScreen = name;
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#screen-${name}`).classList.add('active');
  $('#back-btn').style.display = name === 'home' ? 'none' : 'block';
  $('#actionbar').style.display = name === 'form' ? 'flex' : 'none';

  if (name === 'home') {
    $('#header-subtitle').textContent = 'Inwentaryzacja najmu';
    renderArchive();
  } else if (name === 'rooms-select') {
    $('#header-subtitle').textContent = state.typ + ', wybierz pomieszczenia';
    renderRoomsSelect();
  } else if (name === 'form') {
    const adres = state.adres || 'nowy lokal';
    $('#header-subtitle').textContent = state.typ + ' • ' + adres + ' • ' + fmtDate(state.data);
    renderForm();
  }
  window.scrollTo(0, 0);
}

// ============ EKRAN: WYBÓR POMIESZCZEŃ ============
let _selectedRooms = {};
function renderRoomsSelect() {
  _selectedRooms = {};
  POMIESZCZENIA_DOSTEPNE.forEach((p, i) => {
    _selectedRooms[i] = false;
  });

  const wrap = $('#screen-rooms-select');
  wrap.innerHTML = `
    <div class="card">
      <h2>🏠 Jakie pomieszczenia są w tym mieszkaniu?</h2>
      <p style="font-size: 13px; color: var(--muted); margin: 0 0 12px;">
        Zaznacz tylko te które są w lokalu. Potem przejdziesz do wypełniania, możesz dodać własne.
      </p>
      <div id="rooms-checks" style="display: grid; gap: 8px;"></div>
      <div style="margin-top: 16px;">
        <label>Własne pomieszczenie (opcjonalnie)</label>
        <input type="text" id="custom-room-pick" placeholder="np. Antresola, Garaż, Strych...">
      </div>
      <button class="btn btn-primary btn-full" id="btn-rooms-next" style="margin-top: 16px;">
        Dalej, wypełnianie →
      </button>
    </div>
  `;

  const checks = $('#rooms-checks');
  checks.innerHTML = POMIESZCZENIA_DOSTEPNE.map((p, i) => `
    <div class="room-check ${_selectedRooms[i] ? 'checked' : ''}" data-room-idx="${i}" role="button" tabindex="0">
      <span class="check-indicator">${_selectedRooms[i] ? '✓' : ''}</span>
      <span class="ikona">${p.ikona}</span>
      <span class="nazwa">${p.nazwa}</span>
      <span class="count">${p.pozycje.length} poz.</span>
    </div>
  `).join('');

  function toggleRoom(el) {
    const i = +el.dataset.roomIdx;
    _selectedRooms[i] = !_selectedRooms[i];
    el.classList.toggle('checked', _selectedRooms[i]);
    el.querySelector('.check-indicator').textContent = _selectedRooms[i] ? '✓' : '';
  }

  checks.querySelectorAll('.room-check').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      toggleRoom(el);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleRoom(el);
      }
    });
  });

  $('#btn-rooms-next').addEventListener('click', () => {
    state.pomieszczenia = [];
    POMIESZCZENIA_DOSTEPNE.forEach((p, i) => {
      if (_selectedRooms[i]) {
        state.pomieszczenia.push(makePomieszczenie(p));
      }
    });
    const custom = $('#custom-room-pick').value.trim();
    if (custom) {
      state.pomieszczenia.push(makePomieszczenie({ nazwa: custom, ikona: '🚪', pozycje: [] }));
    }
    if (state.pomieszczenia.length === 0) {
      toast('Wybierz przynajmniej jedno pomieszczenie');
      return;
    }
    showScreen('form');
  });
}

// ============ ARCHIWUM ============
async function renderArchive() {
  const items = await dbGetAll();
  items.sort((a, b) => b.updatedAt - a.updatedAt);
  $('#count-archive').textContent = items.length;
  const wrap = $('#archive-list');

  if (items.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <div>Brak zapisanych inwentaryzacji.</div>
        <div style="font-size: 13px; margin-top: 6px;">Kliknij „Nowy WPIS" lub „Nowy WYPIS" wyżej.</div>
      </div>`;
    return;
  }

  wrap.innerHTML = items.map(it => `
    <div class="list-item" data-id="${it.id}">
      <div style="flex:1; cursor:pointer" onclick="loadInventory('${it.id}')">
        <div class="adres">${it.adres || '(brak adresu)'}</div>
        <div class="meta">${fmtDate(it.data)} • ${countFilled(it)} pozycji</div>
      </div>
      <span class="badge ${it.typ === 'WPIS' ? 'wpis' : 'wypis'}">${it.typ}</span>
      <button class="delete-archive" onclick="deleteInventory('${it.id}')">🗑️</button>
    </div>
  `).join('');
}

function countFilled(inv) {
  let count = 0;
  (inv.pomieszczenia || []).forEach(p => {
    p.pozycje.forEach(poz => { if (poz.aktywna) count++; });
  });
  return count;
}

window.loadInventory = async function(id) {
  state = await dbGet(id);
  if (!state) { toast('Nie znaleziono'); return; }
  if (!state.najemcy) state.najemcy = [emptyNajemca()];
  showScreen('form');
};

window.deleteInventory = async function(id) {
  if (!confirm('Usunąć tę inwentaryzację? Tego nie da się cofnąć.')) return;
  await dbDelete(id);
  toast('Usunięto');
  renderArchive();
};

// ============ FORMULARZ ============
function renderForm() {
  $('#type-wpis').classList.toggle('active', state.typ === 'WPIS');
  $('#type-wypis').classList.toggle('active', state.typ === 'WYPIS');
  $('#f-adres').value = state.adres;
  $('#f-data').value = state.data;

  $('#f-uwagi').value = state.uwagi;
  $('#f-akcesoria-inne').value = state.akcesoriaInne || '';

  renderNajemcy();
  renderLiczniki();
  renderAkcesoria();
  renderRooms();
  renderStanTechniczny();
  bindMicButtons();
}

function renderStanTechniczny() {
  const wrap = $('#stan-techniczny-list');
  if (!state.pomieszczenia || state.pomieszczenia.length === 0) {
    wrap.innerHTML = '<div style="color: var(--muted); font-size: 13px; padding: 12px;">Najpierw dodaj pomieszczenia powyżej.</div>';
    return;
  }

  // upewnij się że wszystkie pomieszczenia mają stanTechniczny (dla starych wpisów)
  state.pomieszczenia.forEach(p => {
    if (!p.stanTechniczny) p.stanTechniczny = emptyStanTechniczny();
    ELEMENTY_TECHNICZNE.forEach(e => {
      if (!p.stanTechniczny[e.id]) p.stanTechniczny[e.id] = { stan: '', uwagi: '', zdjecia: [] };
    });
  });

  // grupa po elementach (Ściany, Podłoga, ...), w środku lista pomieszczeń
  if (!state.techElementOpen) state.techElementOpen = {};

  wrap.innerHTML = ELEMENTY_TECHNICZNE.map(e => `
    <div class="tech-group ${state.techElementOpen[e.id] ? 'open' : ''}" data-tech-group="${e.id}">
      <div class="tech-group-header" data-tech-group-toggle="${e.id}">
        <div class="ikona">${e.ikona || '◻'}</div>
        <div class="nazwa">${e.nazwa}</div>
        ${renderElementProgress(e)}
        <div class="chevron">▾</div>
      </div>
      <div class="tech-group-body">
        ${state.pomieszczenia.map((p, ri) => renderTechItemRow(p, e, ri)).join('')}
      </div>
    </div>
  `).join('');

  // bind: toggle grupy
  wrap.querySelectorAll('[data-tech-group-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const eid = el.dataset.techGroupToggle;
      state.techElementOpen[eid] = !state.techElementOpen[eid];
      renderStanTechniczny();
    });
  });

  // bind: stan buttons
  wrap.querySelectorAll('.tech-stan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ri = +btn.dataset.ri;
      const eid = btn.dataset.eid;
      const v = btn.dataset.stan;
      const obj = state.pomieszczenia[ri].stanTechniczny[eid];
      obj.stan = obj.stan === v ? '' : v;
      renderStanTechniczny();
      autosave();
    });
  });

  // bind: uwagi
  wrap.querySelectorAll('[data-tech-uwagi]').forEach(inp => {
    inp.addEventListener('input', () => {
      const [ri, eid] = inp.dataset.techUwagi.split('::');
      state.pomieszczenia[+ri].stanTechniczny[eid].uwagi = inp.value;
      autosave();
    });
  });

  // bind: photo inputs
  bindPhotoInputs(wrap, (key, photos) => {
    const [, ri, eid] = key.split('::');
    state.pomieszczenia[+ri].stanTechniczny[eid].zdjecia = photos;
    renderStanTechniczny();
    autosave();
  });

  // bind: zastosuj do wszystkich pomieszczeń
  wrap.querySelectorAll('[data-apply-all]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const [riStr, eid] = btn.dataset.applyAll.split('::');
      const ri = +riStr;
      const src = state.pomieszczenia[ri].stanTechniczny[eid];
      const elName = (ELEMENTY_TECHNICZNE.find(e => e.id === eid) || {}).nazwa || eid;
      if (!confirm(`Skopiować "${src.stan ? STAN_OPCJE.find(o => o.id === src.stan)?.label : '(bez stanu)'}"${src.uwagi ? ' i uwagi' : ''} do "${elName}" we WSZYSTKICH pozostałych pomieszczeniach?`)) return;
      state.pomieszczenia.forEach((p, i) => {
        if (i === ri) return;
        if (!p.stanTechniczny) p.stanTechniczny = emptyStanTechniczny();
        if (!p.stanTechniczny[eid]) p.stanTechniczny[eid] = { stan: '', uwagi: '', zdjecia: [] };
        p.stanTechniczny[eid].stan = src.stan;
        p.stanTechniczny[eid].uwagi = src.uwagi;
      });
      toast('Skopiowano do wszystkich pomieszczeń');
      renderStanTechniczny();
      autosave();
    });
  });

  bindMicButtons(wrap);
}

function renderElementProgress(e) {
  const filled = state.pomieszczenia.filter(p => p.stanTechniczny[e.id] && p.stanTechniczny[e.id].stan).length;
  const total = state.pomieszczenia.length;
  const cls = (filled > 0 && filled === total) ? 'complete' : '';
  return `<div class="progress ${cls}">${filled}/${total}</div>`;
}

function renderTechItemRow(p, e, ri) {
  const obj = p.stanTechniczny[e.id];
  const uwagiId = `tech-uwagi-${ri}-${e.id}`;
  const canApplyAll = state.pomieszczenia.length > 1 && (obj.stan || obj.uwagi);
  return `
    <div class="tech-item">
      <div class="tech-item-name">
        <span class="ikona">${p.ikona || '🚪'}</span>
        <span>${escapeAttr(p.nazwa)}</span>
      </div>
      <div class="stan-group" style="margin-bottom: 6px;">
        ${STAN_OPCJE.filter(o => o.id !== 'brak').map(o => `
          <button class="tech-stan-btn stan-btn ${obj.stan === o.id ? 'active' : ''}"
                  data-stan="${o.id}" data-ri="${ri}" data-eid="${e.id}">${o.label}</button>
        `).join('')}
      </div>
      <div class="input-with-mic" style="margin-bottom: 6px;">
        <input type="text" id="${uwagiId}" data-tech-uwagi="${ri}::${e.id}" value="${escapeAttr(obj.uwagi)}" placeholder="uwagi (np. zarysowanie w rogu)">
        ${micButton('#' + uwagiId)}
      </div>
      ${canApplyAll ? `
        <button class="tech-apply-all" data-apply-all="${ri}::${e.id}" type="button" title="Skopiuj ten stan i uwagi do wszystkich pozostałych pomieszczeń">
          📋 Zastosuj do wszystkich pomieszczeń
        </button>
      ` : ''}
      ${renderPhotos(obj.zdjecia, `tech::${ri}::${e.id}`)}
    </div>
  `;
}

function renderNajemcy() {
  const wrap = $('#najemcy-list');
  wrap.innerHTML = state.najemcy.map((n, i) => `
    <div class="najemca-card" data-najemca="${i}">
      <div class="najemca-header">
        <span class="najemca-title">Najemca ${i + 1}</span>
        <button class="btn-mini-scan" data-scan-najemca="${i}" type="button" title="Skanuj dowód lub stronę umowy">📷 Skanuj</button>
        ${state.najemcy.length > 1 ? `<button class="btn-mini-danger" data-del-najemca="${i}">✕ usuń</button>` : ''}
      </div>
      <div class="field">
        <label>Imię i nazwisko</label>
        <div class="input-with-mic">
          <input type="text" id="f-najemca-imie-${i}" value="${escapeAttr(n.imie)}" data-najemca-field="imie" data-najemca-idx="${i}">
          ${micButton(`#f-najemca-imie-${i}`)}
        </div>
      </div>
      <div class="field">
        <label>PESEL</label>
        <div class="input-with-mic">
          <input type="text" id="f-najemca-pesel-${i}" inputmode="numeric" value="${escapeAttr(n.pesel)}" data-najemca-field="pesel" data-najemca-idx="${i}">
          ${micButton(`#f-najemca-pesel-${i}`)}
        </div>
      </div>
      <div class="field">
        <label>Adres zamieszkania</label>
        <div class="input-with-mic">
          <input type="text" id="f-najemca-adres-${i}" value="${escapeAttr(n.adres)}" data-najemca-field="adres" data-najemca-idx="${i}">
          ${micButton(`#f-najemca-adres-${i}`)}
        </div>
      </div>
      <div class="field-row">
        <div>
          <label>Telefon</label>
          <div class="input-with-mic">
            <input type="tel" id="f-najemca-tel-${i}" value="${escapeAttr(n.telefon)}" data-najemca-field="telefon" data-najemca-idx="${i}">
            ${micButton(`#f-najemca-tel-${i}`)}
          </div>
        </div>
        <div>
          <label>Email</label>
          <div class="input-with-mic">
            <input type="email" id="f-najemca-email-${i}" value="${escapeAttr(n.email)}" data-najemca-field="email" data-najemca-idx="${i}">
            ${micButton(`#f-najemca-email-${i}`)}
          </div>
        </div>
      </div>
    </div>
  `).join('');

  if (state.najemcy.length < 3) {
    wrap.innerHTML += `
      <button class="btn btn-secondary btn-full" id="btn-add-najemca" style="margin-top: 8px;">
        + Dodaj kolejnego najemcę (${state.najemcy.length}/3)
      </button>
    `;
    $('#btn-add-najemca').addEventListener('click', () => {
      if (state.najemcy.length >= 3) return;
      state.najemcy.push(emptyNajemca());
      renderNajemcy();
      bindMicButtons();
      autosave();
    });
  }

  wrap.querySelectorAll('input[data-najemca-field]').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = +inp.dataset.najemcaIdx;
      const f = inp.dataset.najemcaField;
      state.najemcy[i][f] = inp.value;
      autosave();
    });
  });
  wrap.querySelectorAll('[data-del-najemca]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.delNajemca;
      if (!confirm('Usunąć tego najemcę?')) return;
      state.najemcy.splice(i, 1);
      if (state.najemcy.length === 0) state.najemcy.push(emptyNajemca());
      renderNajemcy();
      bindMicButtons();
      autosave();
    });
  });
  wrap.querySelectorAll('[data-scan-najemca]').forEach(btn => {
    btn.addEventListener('click', () => {
      openOCRModal(+btn.dataset.scanNajemca);
    });
  });
}

function renderLiczniki() {
  const wrap = $('#liczniki-list');
  let html = '';
  let lastGrupa = null;
  state.liczniki.forEach((l, i) => {
    const grupa = l.grupa || null;
    if (grupa && grupa !== lastGrupa) {
      html += `<div class="licznik-group-header">📍 ${grupa}</div>`;
    } else if (!grupa && lastGrupa !== null) {
      // wracamy do pojedynczych liczników, separator zerowy
    }
    lastGrupa = grupa;
    const displayName = grupa ? (l.krotkaNazwa || l.nazwa) : l.nazwa;
    const numerId = `f-lic-numer-${i}`;
    const odczytId = `f-lic-odczyt-${i}`;
    html += `
      <div class="licznik-card ${grupa ? 'in-group' : ''}">
        <div class="name">${displayName}</div>
        <div class="field">
          <label>Numer / "BRAK"</label>
          <div class="input-with-mic">
            <input type="text" id="${numerId}" data-licznik="${i}" data-field="numer" value="${escapeAttr(l.numer)}">
            ${micButton('#' + numerId)}
          </div>
        </div>
        <div class="field">
          <label>Odczyt</label>
          <div class="input-with-mic">
            <input type="text" id="${odczytId}" data-licznik="${i}" data-field="odczyt" value="${escapeAttr(l.odczyt)}">
            ${micButton('#' + odczytId)}
          </div>
        </div>
        ${renderPhotos(l.zdjecia, 'licznik-' + i)}
      </div>
    `;
  });
  wrap.innerHTML = html;

  wrap.querySelectorAll('input[data-licznik]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = +e.target.dataset.licznik;
      const f = e.target.dataset.field;
      state.liczniki[idx][f] = e.target.value;
      autosave();
    });
  });
  bindPhotoInputs(wrap, (key, photos) => {
    const idx = +key.split('-')[1];
    state.liczniki[idx].zdjecia = photos;
    autosave();
    renderLiczniki();
  });
  bindMicButtons(wrap);
}

function renderAkcesoria() {
  const wrap = $('#akcesoria-list');
  wrap.innerHTML = state.akcesoria.map((a, i) => {
    if (a.typ === 'tekst') {
      return `
        <div class="akcesoria-row">
          <div class="akcesoria-name">${a.nazwa}</div>
          <div class="input-with-mic" style="margin-top: 4px;">
            <input type="text" id="f-akc-tekst-${i}" data-akc-tekst="${i}" value="${escapeAttr(a.wartosc)}" placeholder="np. 1234#">
            ${micButton('#f-akc-tekst-' + i)}
          </div>
        </div>
      `;
    }
    return `
      <div class="akcesoria-row">
        <div class="akcesoria-name">${a.nazwa}</div>
        <div class="ilosc-row">
          <button class="ilosc-btn" data-akc="${i}" data-act="-">−</button>
          <input type="number" class="ilosc-input" data-akc-input="${i}" value="${a.wartosc}" min="0">
          <button class="ilosc-btn" data-akc="${i}" data-act="+">+</button>
        </div>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('[data-akc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.akc;
      const cur = parseInt(state.akcesoria[i].wartosc) || 0;
      state.akcesoria[i].wartosc = Math.max(0, cur + (btn.dataset.act === '+' ? 1 : -1));
      renderAkcesoria();
      autosave();
    });
  });
  wrap.querySelectorAll('[data-akc-input]').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = +inp.dataset.akcInput;
      state.akcesoria[i].wartosc = Math.max(0, parseInt(inp.value) || 0);
      autosave();
    });
  });
  wrap.querySelectorAll('[data-akc-tekst]').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = +inp.dataset.akcTekst;
      state.akcesoria[i].wartosc = inp.value;
      autosave();
    });
  });
  bindMicButtons(wrap);
}

function renderRooms() {
  const wrap = $('#rooms-list');
  wrap.innerHTML = state.pomieszczenia.map((p, ri) => `
    <div class="room ${p.open ? 'open' : ''}" data-room="${ri}">
      <div class="room-header" data-toggle="${ri}">
        <div class="ikona">${p.ikona || '🚪'}</div>
        <div class="nazwa">${p.nazwa}</div>
        ${renderRoomProgress(p)}
        <div class="chevron">▾</div>
      </div>
      <div class="room-body">
        ${p.pozycje.map((poz, pi) => renderPozycja(p, poz, ri, pi)).join('')}
        <div style="display:flex; gap:6px; margin-top: 10px;">
          <button class="btn btn-secondary btn-sm" data-add-pos="${ri}">+ Pozycja</button>
          <button class="btn btn-ghost btn-sm" data-remove-room="${ri}" style="color: var(--danger); margin-left:auto;">🗑 Usuń pokój</button>
        </div>
      </div>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-toggle]').forEach(h => {
    h.addEventListener('click', () => {
      const i = +h.dataset.toggle;
      state.pomieszczenia[i].open = !state.pomieszczenia[i].open;
      renderRooms();
    });
  });

  wrap.querySelectorAll('.stan-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ri = +btn.dataset.ri;
      const pi = +btn.dataset.pi;
      const v = btn.dataset.stan;
      state.pomieszczenia[ri].pozycje[pi].wartosc =
        (state.pomieszczenia[ri].pozycje[pi].wartosc === v) ? '' : v;
      renderRooms();
      autosave();
    });
  });

  wrap.querySelectorAll('[data-ilosc-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ri = +btn.dataset.ri;
      const pi = +btn.dataset.pi;
      const poz = state.pomieszczenia[ri].pozycje[pi];
      const cur = parseInt(poz.wartosc) || 0;
      poz.wartosc = Math.max(0, cur + (btn.dataset.iloscAct === '+' ? 1 : -1));
      renderRooms();
      autosave();
    });
  });
  wrap.querySelectorAll('[data-ilosc-input]').forEach(inp => {
    inp.addEventListener('input', () => {
      const [ri, pi] = inp.dataset.iloscInput.split('-').map(Number);
      state.pomieszczenia[ri].pozycje[pi].wartosc = Math.max(0, parseInt(inp.value) || 0);
      autosave();
    });
  });

  wrap.querySelectorAll('[data-tekst-input]').forEach(inp => {
    inp.addEventListener('input', () => {
      const [ri, pi] = inp.dataset.tekstInput.split('-').map(Number);
      state.pomieszczenia[ri].pozycje[pi].wartosc = inp.value;
      autosave();
    });
  });

  wrap.querySelectorAll('[data-marka-input]').forEach(inp => {
    inp.addEventListener('input', () => {
      const [ri, pi] = inp.dataset.markaInput.split('-').map(Number);
      state.pomieszczenia[ri].pozycje[pi].marka = inp.value;
      autosave();
    });
  });

  wrap.querySelectorAll('[data-uwagi-input]').forEach(inp => {
    inp.addEventListener('input', () => {
      const [ri, pi] = inp.dataset.uwagiInput.split('-').map(Number);
      state.pomieszczenia[ri].pozycje[pi].uwagi = inp.value;
      autosave();
    });
  });

  wrap.querySelectorAll('[data-del-pos]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const [ri, pi] = btn.dataset.delPos.split('-').map(Number);
      if (!confirm('Usunąć tę pozycję?')) return;
      state.pomieszczenia[ri].pozycje.splice(pi, 1);
      renderRooms();
      autosave();
    });
  });

  wrap.querySelectorAll('[data-toggle-pos]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const [ri, pi] = el.dataset.togglePos.split('-').map(Number);
      const poz = state.pomieszczenia[ri].pozycje[pi];
      poz.aktywna = !poz.aktywna;
      renderRooms();
      autosave();
    });
  });

  wrap.querySelectorAll('[data-add-pos]').forEach(btn => {
    btn.addEventListener('click', () => openPosAdder(+btn.dataset.addPos));
  });

  wrap.querySelectorAll('[data-remove-room]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ri = +btn.dataset.removeRoom;
      if (!confirm(`Usunąć pomieszczenie „${state.pomieszczenia[ri].nazwa}"?`)) return;
      state.pomieszczenia.splice(ri, 1);
      renderRooms();
      autosave();
    });
  });

  bindPhotoInputs(wrap, (key, photos) => {
    const [ri, pi] = key.split('-').slice(1).map(Number);
    state.pomieszczenia[ri].pozycje[pi].zdjecia = photos;
    renderRooms();
    autosave();
  });

  bindMicButtons(wrap);
}

function renderRoomProgress(p) {
  const aktywne = p.pozycje.filter(poz => poz.aktywna).length;
  const total = p.pozycje.length;
  const cls = aktywne > 0 ? 'complete' : '';
  return `<div class="progress ${cls}">${aktywne}/${total}</div>`;
}

function renderPozycja(room, poz, ri, pi) {
  // Tryb zwinięty: tylko checkbox + nazwa
  if (!poz.aktywna) {
    return `
      <div class="pos pos-inactive">
        <div class="pos-toggle" data-toggle-pos="${ri}-${pi}">
          <span class="check-indicator"></span>
          <span class="pos-name-text">${poz.nazwa}</span>
        </div>
        <button class="delete-pos" data-del-pos="${ri}-${pi}" title="Usuń pozycję">×</button>
      </div>
    `;
  }

  // Tryb rozwinięty: pełne kontrolki
  let control = '';
  if (poz.typ === 'stan') {
    control = `<div class="stan-group">
      ${STAN_OPCJE.map(o => `
        <button class="stan-btn ${poz.wartosc === o.id ? 'active' : ''}"
                data-stan="${o.id}" data-ri="${ri}" data-pi="${pi}">${o.label}</button>
      `).join('')}
    </div>`;
  } else if (poz.typ === 'ilosc') {
    control = `<div class="ilosc-row">
      <button class="ilosc-btn" data-ilosc-act="-" data-ri="${ri}" data-pi="${pi}">−</button>
      <input type="number" class="ilosc-input" data-ilosc-input="${ri}-${pi}" value="${poz.wartosc ?? 0}" min="0">
      <button class="ilosc-btn" data-ilosc-act="+" data-ri="${ri}" data-pi="${pi}">+</button>
    </div>`;
  } else {
    control = `<input type="text" id="pos-tekst-${ri}-${pi}" data-tekst-input="${ri}-${pi}" value="${escapeAttr(poz.wartosc)}" placeholder="opis / model">`;
  }

  const markaInputId = `pos-marka-${ri}-${pi}`;
  const uwagiInputId = `pos-uwagi-${ri}-${pi}`;

  return `
    <div class="pos pos-active">
      <div class="pos-name">
        <span class="pos-toggle" data-toggle-pos="${ri}-${pi}">
          <span class="check-indicator checked">✓</span>
          ${poz.nazwa}
        </span>
        <button class="delete-pos" data-del-pos="${ri}-${pi}" title="Usuń pozycję">×</button>
      </div>
      ${control}
      <div class="pos-extras">
        ${poz.marka !== null && poz.marka !== undefined ? `
          <div class="marka-row input-with-mic">
            <input type="text" id="${markaInputId}" data-marka-input="${ri}-${pi}" value="${escapeAttr(poz.marka)}" placeholder="marka / model">
            ${micButton('#' + markaInputId)}
          </div>
        ` : ''}
        <div class="uwagi-row input-with-mic">
          <input type="text" id="${uwagiInputId}" data-uwagi-input="${ri}-${pi}" value="${escapeAttr(poz.uwagi)}" placeholder="uwagi (opcjonalnie)">
          ${micButton('#' + uwagiInputId)}
        </div>
        ${renderPhotos(poz.zdjecia, `pos-${ri}-${pi}`)}
      </div>
    </div>
  `;
}

function renderPhotos(photos, key) {
  return `
    <div class="photo-wrap" data-photo-key="${key}">
      ${(photos || []).map((src, i) => `
        <div class="photo-thumb" style="background-image:url('${src}')">
          <button class="del" data-del-photo="${key}-${i}">×</button>
        </div>
      `).join('')}
      <label class="photo-add" title="Zrób zdjęcie">
        📷
        <input type="file" accept="image/*" capture="environment" data-photo-input="${key}">
      </label>
    </div>
  `;
}

function bindPhotoInputs(container, onChange) {
  container.querySelectorAll('input[data-photo-input]').forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        toast('Kompresuję zdjęcie…');
        const dataUrl = await compressImage(file);
        const key = inp.dataset.photoInput;
        const photos = getPhotosByKey(key);
        photos.push(dataUrl);
        onChange(key, photos);
        toast('Zdjęcie dodane');
      } catch (err) {
        console.error(err);
        toast('Błąd zdjęcia');
      }
      inp.value = '';
    });
  });
  container.querySelectorAll('[data-del-photo]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const parts = btn.dataset.delPhoto.split('-');
      const idx = +parts.pop();
      const key = parts.join('-');
      const photos = getPhotosByKey(key);
      photos.splice(idx, 1);
      onChange(key, photos);
    });
  });
}

function getPhotosByKey(key) {
  if (key.startsWith('licznik-')) {
    return state.liczniki[+key.split('-')[1]].zdjecia;
  }
  if (key.startsWith('pos-')) {
    const [, ri, pi] = key.split('-');
    return state.pomieszczenia[+ri].pozycje[+pi].zdjecia;
  }
  if (key.startsWith('tech::')) {
    const [, ri, eid] = key.split('::');
    return state.pomieszczenia[+ri].stanTechniczny[eid].zdjecia;
  }
  return [];
}

// ============ DODAWANIE POKOJU W FORMULARZU ============
function openRoomPicker() {
  const dlg = $('#room-picker');
  const list = $('#room-picker-list');
  list.innerHTML = POMIESZCZENIA_DOSTEPNE.map((p, i) => `
    <button class="btn btn-secondary" data-pick-room="${i}" style="justify-content: flex-start;">
      <span style="font-size: 20px;">${p.ikona}</span>
      ${p.nazwa}
    </button>
  `).join('');
  list.querySelectorAll('[data-pick-room]').forEach(b => {
    b.addEventListener('click', () => {
      const i = +b.dataset.pickRoom;
      addRoomFromTemplate(POMIESZCZENIA_DOSTEPNE[i]);
      dlg.close();
    });
  });
  dlg.showModal();
}

function addRoomFromTemplate(tpl) {
  state.pomieszczenia.push({
    ...makePomieszczenie(tpl),
    open: true
  });
  renderRooms();
  autosave();
}

// ============ DODAWANIE POZYCJI ============
let posAdderRoomIdx = null;
function openPosAdder(ri) {
  posAdderRoomIdx = ri;
  $('#pos-add-name').value = '';
  $('#pos-add-typ').value = 'stan';
  $('#pos-adder').showModal();
  bindMicButtons($('#pos-adder'));
}

// ============ AUTOSAVE ============
let saveTimer = null;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 600);
}
async function saveState() {
  if (!state) return;
  state.adres = $('#f-adres').value.trim();
  state.data = $('#f-data').value || todayISO();
  state.uwagi = $('#f-uwagi').value;
  state.akcesoriaInne = $('#f-akcesoria-inne').value;
  state.updatedAt = Date.now();
  await dbPut(state);
}

// ============ STARTUP FLOW ============
function startNewInventory(typ) {
  state = newInventory(typ);
  showScreen('rooms-select');
}

// ============ OCR: skanowanie dowodu osobistego / dokumentu ============
let _ocrTargetIdx = null;

function openOCRModal(idx) {
  _ocrTargetIdx = idx;
  $('#ocr-file').value = '';
  $('#ocr-preview').style.display = 'none';
  $('#ocr-preview').src = '';
  $('#ocr-results').style.display = 'none';
  $('#ocr-imie').value = '';
  $('#ocr-pesel').value = '';
  $('#ocr-adres').value = '';
  $('#ocr-status').textContent = 'Wybierz zdjęcie albo zrób nowe aparatem.';
  $('#btn-apply-ocr').disabled = true;
  $('#ocr-modal').showModal();
}

async function processOcrImage(file) {
  if (typeof Tesseract === 'undefined') {
    $('#ocr-status').textContent = 'Brak biblioteki OCR. Sprawdź połączenie i odśwież.';
    return;
  }

  // preview
  const reader = new FileReader();
  reader.onload = e => {
    $('#ocr-preview').src = e.target.result;
    $('#ocr-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);

  $('#ocr-status').textContent = 'Rozpoznaję tekst... (może chwilę potrwać, pierwszy raz pobiera dane językowe)';

  try {
    const result = await Tesseract.recognize(file, 'pol', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          $('#ocr-status').textContent = `Rozpoznaję tekst... ${pct}%`;
        } else if (m.status === 'loading language traineddata') {
          $('#ocr-status').textContent = 'Pobieram polski słownik OCR... (jednorazowo, ok. 10MB)';
        } else if (m.status === 'initializing api') {
          $('#ocr-status').textContent = 'Inicjuję rozpoznawanie...';
        }
      }
    });
    const text = result.data.text || '';
    console.log('OCR raw text:', text);

    const parsed = parseDokumentText(text);

    $('#ocr-imie').value = parsed.imie || '';
    $('#ocr-pesel').value = parsed.pesel || '';
    $('#ocr-adres').value = parsed.adres || '';
    $('#ocr-results').style.display = 'block';
    $('#btn-apply-ocr').disabled = false;

    const found = [];
    if (parsed.imie) found.push('imię');
    if (parsed.pesel) found.push('PESEL');
    if (parsed.adres) found.push('adres');
    $('#ocr-status').textContent = found.length
      ? `Znaleziono: ${found.join(', ')}. Sprawdź i popraw przed zatwierdzeniem.`
      : 'Nie udało się rozpoznać danych automatycznie. Wpisz ręcznie lub spróbuj z lepszym zdjęciem.';
  } catch (e) {
    console.error('OCR error', e);
    $('#ocr-status').textContent = 'Błąd OCR: ' + (e.message || e);
  }
}

function parseDokumentText(text) {
  const out = { imie: '', pesel: '', adres: '' };
  if (!text) return out;

  // PESEL: 11 cyfr (preferuj po słowie PESEL)
  let peselMatch = text.match(/PESEL[\s\n:]*([0-9OIo]{11})/i);
  if (!peselMatch) peselMatch = text.match(/\b(\d{11})\b/);
  if (peselMatch) {
    // OCR czasem czyta 0 jako O lub I jako 1 — normalizuję
    out.pesel = peselMatch[1].replace(/[Oo]/g, '0').replace(/[I]/g, '1');
  }

  // Imię i Nazwisko z dowodu osobistego
  const nazwiskoMatch = text.match(/Nazwisko[\s\n:\/]*([A-ZŁŚĆŻŹŃĄĘÓ][A-ZŁŚĆŻŹŃĄĘÓa-złśćżźńąęó'\-]{1,})/);
  const imieMatch = text.match(/Imi[eę](?:[\s\n]*\(?imiona\)?)?[\s\n:\/]*([A-ZŁŚĆŻŹŃĄĘÓ][A-ZŁŚĆŻŹŃĄĘÓa-złśćżźńąęó'\-]{1,}(?:\s+[A-ZŁŚĆŻŹŃĄĘÓ][A-ZŁŚĆŻŹŃĄĘÓa-złśćżźńąęó'\-]{1,})?)/i);
  if (imieMatch && nazwiskoMatch) {
    out.imie = `${imieMatch[1].trim()} ${nazwiskoMatch[1].trim()}`;
  } else if (imieMatch) {
    out.imie = imieMatch[1].trim();
  } else if (nazwiskoMatch) {
    out.imie = nazwiskoMatch[1].trim();
  }

  // Adres - z umów najmu (zamieszkały, zam., adres)
  const adresMatch = text.match(/(?:zamieszkał[yaąe][:\s]+(?:w\s+)?|zam\.[:\s]+(?:w\s+)?|adres[\s:]+)((?:ul\.\s+)?[^\n,;]+(?:,\s*[\d\-]+\s+[A-Za-złśćżźńąęóŁŚĆŻŹŃĄĘÓ\s]+)?)/i);
  if (adresMatch) out.adres = adresMatch[1].trim();

  return out;
}

// ============ PODPISY (signature_pad) ============
let _sigPads = {};

function resizeSigCanvas(canvas) {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
}

function buildSignatureItems() {
  const prz = getPrzekazujacy();
  const items = [
    { key: 'przekazujacy', label: 'PRZEKAZUJĄCY / WYNAJMUJĄCY', name: prz.imie || '' }
  ];
  (state.najemcy || []).forEach((n, i) => {
    const titleBase = state.najemcy.length > 1 ? `ODBIERAJĄCY / NAJEMCA ${i + 1}` : 'ODBIERAJĄCY / NAJEMCA';
    items.push({ key: 'najemca-' + i, label: titleBase, name: n.imie || '' });
  });
  return items;
}

function openSignaturesModal(onDone) {
  if (typeof SignaturePad === 'undefined') {
    toast('Biblioteka podpisów niedostępna (brak internetu?), generuję PDF bez podpisów');
    onDone({});
    return;
  }
  _sigPads = {};
  const items = buildSignatureItems();
  const list = $('#signatures-list');
  list.innerHTML = items.map(it => `
    <div class="sig-item" data-sig-item="${it.key}">
      <div class="sig-label">${escapeAttr(it.label)}${it.name ? ` — <span class="sig-name">${escapeAttr(it.name)}</span>` : ''}</div>
      <canvas class="sig-canvas" data-sig-key="${it.key}"></canvas>
      <button class="btn btn-ghost btn-sm" data-sig-clear="${it.key}" type="button">🗑 Wyczyść</button>
    </div>
  `).join('');

  const dlg = $('#signatures-modal');
  dlg.showModal();

  // init signature_pad po showModal (canvas musi być widoczny dla offsetWidth)
  requestAnimationFrame(() => {
    items.forEach(it => {
      const canvas = list.querySelector(`canvas[data-sig-key="${it.key}"]`);
      if (!canvas) return;
      resizeSigCanvas(canvas);
      const pad = new SignaturePad(canvas, {
        penColor: '#0a0a0a',
        minWidth: 0.8,
        maxWidth: 2.6,
        backgroundColor: 'rgba(255,255,255,0)'
      });
      _sigPads[it.key] = pad;
    });
  });

  list.querySelectorAll('[data-sig-clear]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sigClear;
      _sigPads[key]?.clear();
    });
  });

  const cleanup = () => {
    dlg.close();
  };

  $('#btn-cancel-sig').onclick = () => { cleanup(); };
  $('#btn-skip-sig').onclick = () => {
    cleanup();
    onDone({});
  };
  $('#btn-save-sig').onclick = () => {
    const signatures = {};
    items.forEach(it => {
      const pad = _sigPads[it.key];
      if (pad && !pad.isEmpty()) {
        try { signatures[it.key] = pad.toDataURL('image/png'); }
        catch (e) { console.warn('sig dataURL error', e); }
      }
    });
    cleanup();
    onDone(signatures);
  };
}

// ============ PDF ============
let _logoCache = null;
async function loadLogoAsDataUrl() {
  if (_logoCache) return _logoCache;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      _logoCache = canvas.toDataURL('image/png');
      resolve(_logoCache);
    };
    img.onerror = reject;
    img.src = 'logo.png';
  });
}

async function generatePDF(signatures = {}) {
  toast('Generuję PDF…');
  await new Promise(r => setTimeout(r, 100));
  const prz = getPrzekazujacy();

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  // Zarejestruj font Roboto z polskimi znakami (zastępuje Helvetica)
  let fontReady = false;
  if (typeof window.registerRMFontsOnPdf === 'function') {
    try {
      window.registerRMFontsOnPdf(pdf);
      pdf.setFont('Roboto', 'normal');
      fontReady = true;
    } catch (e) {
      console.warn('font register error', e);
    }
  }
  if (!fontReady) {
    toast('⚠️ Brak fontu Roboto (stary cache). Wyczyść Service Worker i odśwież.');
    console.error('roboto-fonts.js NIE załadowane — polskie znaki będą popsute. Wyczyść cache!');
    pdf.setFont('helvetica', 'normal');
  }

  const M = 18;
  const W = 210 - 2 * M;
  let y = M;
  const PAGE_H = 297 - M;

  function ensureSpace(h) {
    if (y + h > PAGE_H) { pdf.addPage(); y = M; }
  }

  // Wstaw zdjęcia inline (siatka pod opisem pozycji)
  function addInlinePhotos(photos) {
    if (!photos || photos.length === 0) return;
    const photoW = 82;
    const photoH = 58;
    const photoGap = 4;
    const perRow = 2;
    let col = 0;
    let rowStartY = y;
    for (const src of photos) {
      if (col === 0) {
        ensureSpace(photoH + 3);
        rowStartY = y;
      }
      const xp = M + 4 + col * (photoW + photoGap);
      try { pdf.addImage(src, 'JPEG', xp, rowStartY, photoW, photoH); }
      catch (e) { console.warn('inline photo err', e); }
      col++;
      if (col >= perRow) {
        col = 0;
        y = rowStartY + photoH + photoGap;
      }
    }
    if (col > 0) y = rowStartY + photoH + 3;
    else y += 1;
  }

  // HEADER, samo logo (bez tekstu pod spodem)
  try {
    const logoData = await loadLogoAsDataUrl();
    const logoW = 70;
    const logoH = 14;
    pdf.addImage(logoData, 'PNG', M, y - 2, logoW, logoH);
  } catch (e) {
    pdf.setFont('Roboto', 'bold').setFontSize(16).setTextColor(9, 77, 71);
    pdf.text('RM NIERUCHOMOŚCI', M, y + 6);
  }
  pdf.setDrawColor(9, 77, 71).setLineWidth(0.5);
  pdf.line(M, y + 14, M + W, y + 14);
  y += 20;

  // TYTUŁ NA STRONIE TYTUŁOWEJ (wyśrodkowany)
  const cx = M + W / 2;

  pdf.setFontSize(11).setTextColor(60).setFont('Roboto', 'italic');
  pdf.text('Załącznik nr 5', cx, y, { align: 'center' });
  y += 9;

  pdf.setTextColor(9, 77, 71).setFont('Roboto', 'bold').setFontSize(15);
  pdf.text('PROTOKÓŁ ZDAWCZO-ODBIORCZY', cx, y, { align: 'center' });
  y += 7;

  pdf.setFont('Roboto', 'bold').setFontSize(13);
  pdf.text('INWENTARYZACJA', cx, y, { align: 'center' });
  y += 6;

  pdf.setFont('Roboto', 'bold').setFontSize(13);
  pdf.text('STAN TECHNICZNY LOKALU', cx, y, { align: 'center' });
  y += 7;

  pdf.setFontSize(10).setFont('Roboto', 'italic').setTextColor(100);
  pdf.text(state.typ === 'WYPIS' ? '(WYPIS, odbiór od najemcy)' : '(WPIS, przekazanie najemcy)', cx, y, { align: 'center' });
  y += 10;
  pdf.setTextColor(0);

  // Lokalizacja lokalu
  pdf.setFont('Roboto', 'normal').setFontSize(10);
  const lokalTxt = pdf.splitTextToSize(
    `Protokół dotyczy LOKALU zlokalizowanego pod adresem: ${state.adres || '(brak adresu)'}.`,
    W
  );
  pdf.text(lokalTxt, M, y);
  y += lokalTxt.length * 5 + 4;

  // Data przekazania
  pdf.setFont('Roboto', 'bold').setFontSize(10);
  pdf.text('Data przekazania:', M, y);
  pdf.setFont('Roboto', 'normal');
  pdf.text(fmtDate(state.data), M + 38, y);
  y += 8;

  // PRZEKAZUJĄCY / WYNAJMUJĄCY
  y = pdfSection(pdf, 'PRZEKAZUJĄCY / WYNAJMUJĄCY', y, M, W);
  pdf.setFontSize(10).setFont('Roboto', 'normal');
  const stanowiskoTxt = prz.stanowisko ? `, ${prz.stanowisko}` : '';
  const dowodTxt = prz.dowod ? `, legitymujący się dowodem osobistym nr ${prz.dowod}` : '';
  const waznTxt = prz.dataWaznosci ? ` z terminem ważności ${prz.dataWaznosci}` : '';
  const adresTxt = prz.adres ? `, zamieszkały: ${prz.adres}` : '';
  const stronyTxt = pdf.splitTextToSize(
    `${prz.imie || ''}${stanowiskoTxt}${dowodTxt}${waznTxt}${adresTxt}.`,
    W
  );
  pdf.text(stronyTxt, M, y);
  y += stronyTxt.length * 5 + 4;

  // ODBIERAJĄCY / NAJEMCA
  ensureSpace(30);
  y = pdfSection(pdf, 'ODBIERAJĄCY / NAJEMCA', y, M, W);
  pdf.setFontSize(10).setFont('Roboto', 'normal');
  const najemcyAktywni = state.najemcy.filter(n => n.imie || n.pesel || n.adres || n.telefon || n.email);
  if (najemcyAktywni.length === 0) {
    pdf.setTextColor(150).setFont('Roboto', 'italic');
    pdf.text('(brak danych najemcy)', M, y);
    pdf.setTextColor(0).setFont('Roboto', 'normal');
    y += 5;
  }
  najemcyAktywni.forEach((n, idx) => {
    if (najemcyAktywni.length > 1) {
      ensureSpace(6);
      pdf.setFont('Roboto', 'bold');
      pdf.text(`Najemca ${idx + 1}:`, M, y);
      pdf.setFont('Roboto', 'normal');
      y += 5;
    }
    const lines = [];
    lines.push(`Imię i nazwisko: ${n.imie || '(brak)'}`);
    lines.push(`PESEL: ${n.pesel || '(brak)'}`);
    if (n.adres) lines.push(`Adres zamieszkania: ${n.adres}`);
    if (n.telefon) lines.push(`Telefon: ${n.telefon}`);
    if (n.email) lines.push(`Email: ${n.email}`);
    lines.forEach(ln => {
      const wrapped = pdf.splitTextToSize(ln, W);
      ensureSpace(wrapped.length * 5 + 1);
      pdf.text(wrapped, M, y);
      y += wrapped.length * 5 + 1;
    });
    y += 2;
  });
  y += 2;

  // === MASTER: PROTOKÓŁ ZDAWCZO-ODBIORCZY ===
  ensureSpace(50);
  y = pdfMasterSection(pdf, 'Protokół zdawczo-odbiorczy', y, M, W);

  // LICZNIKI
  ensureSpace(40);
  y = pdfSection(pdf, 'STAN LICZNIKÓW', y, M, W);
  pdf.setFontSize(9);
  state.liczniki.forEach(l => {
    if (!l.numer && !l.odczyt && (!l.zdjecia || l.zdjecia.length === 0)) return;
    ensureSpace(7);
    pdf.setFont('Roboto', 'bold');
    pdf.text(`${l.nazwa}:`, M, y);
    pdf.setFont('Roboto', 'normal');
    pdf.text(`nr ${l.numer || '—'} | odczyt ${l.odczyt || '—'}`, M + 55, y);
    y += 5;
    addInlinePhotos(l.zdjecia);
  });
  y += 3;

  // KLUCZE
  ensureSpace(30);
  y = pdfSection(pdf, 'KLUCZE I AKCESORIA', y, M, W);
  pdf.setFontSize(9);
  state.akcesoria.forEach(a => {
    if (a.typ === 'ilosc' && (parseInt(a.wartosc) || 0) <= 0) return;
    if (a.typ === 'tekst' && !a.wartosc) return;
    ensureSpace(5);
    const val = a.typ === 'tekst' ? a.wartosc : (a.wartosc + ' szt.');
    pdf.text(`• ${a.nazwa}: ${val}`, M, y);
    y += 5;
  });
  if (state.akcesoriaInne) {
    ensureSpace(8);
    const inneTxt = pdf.splitTextToSize(`Inne: ${state.akcesoriaInne}`, W);
    pdf.text(inneTxt, M, y);
    y += inneTxt.length * 4;
  }
  y += 3;

  // === MASTER: INWENTARYZACJA ===
  const anyRoomFilled = state.pomieszczenia.some(p => p.pozycje.some(poz => poz.aktywna));
  if (anyRoomFilled) {
    ensureSpace(25);
    y = pdfMasterSection(pdf, 'Inwentaryzacja', y, M, W);
  }

  // POMIESZCZENIA, tylko aktywne pozycje wchodzą do PDF
  for (const pom of state.pomieszczenia) {
    const wypelnione = pom.pozycje.filter(p => p.aktywna);
    if (wypelnione.length === 0) continue;

    ensureSpace(15);
    y = pdfSection(pdf, pom.nazwa.toUpperCase(), y, M, W);

    pdf.setFontSize(9);
    for (const poz of wypelnione) {
      let val = '';
      if (poz.typ === 'stan') {
        const opt = STAN_OPCJE.find(o => o.id === poz.wartosc);
        val = opt ? opt.label : poz.wartosc;
      } else if (poz.typ === 'ilosc') {
        val = poz.wartosc + ' szt.';
      } else {
        val = poz.wartosc;
      }
      const marka = poz.marka ? ` (${poz.marka})` : '';
      const uwagi = poz.uwagi ? `, ${poz.uwagi}` : '';
      const line = `• ${poz.nazwa}${marka}: ${val}${uwagi}`;
      const wrapped = pdf.splitTextToSize(line, W);
      ensureSpace(wrapped.length * 4 + 1);
      pdf.text(wrapped, M, y);
      y += wrapped.length * 4 + 1;
      addInlinePhotos(poz.zdjecia);
    }
    y += 3;
  }

  // STAN TECHNICZNY LOKALU
  const techData = (state.pomieszczenia || []).map(p => {
    const wpisy = ELEMENTY_TECHNICZNE
      .map(e => {
        const o = p.stanTechniczny && p.stanTechniczny[e.id];
        if (!o || (!o.stan && !o.uwagi && (!o.zdjecia || o.zdjecia.length === 0))) return null;
        return { element: e.nazwa, ...o };
      })
      .filter(Boolean);
    return wpisy.length > 0 ? { pomieszczenie: p.nazwa, wpisy } : null;
  }).filter(Boolean);

  if (techData.length > 0) {
    ensureSpace(20);
    y = pdfSection(pdf, 'STAN TECHNICZNY LOKALU', y, M, W);
    pdf.setFontSize(9);
    techData.forEach(td => {
      ensureSpace(8);
      pdf.setFont('Roboto', 'bold');
      pdf.text(td.pomieszczenie, M, y);
      y += 5;
      pdf.setFont('Roboto', 'normal');
      td.wpisy.forEach(w => {
        const stan = STAN_OPCJE.find(o => o.id === w.stan);
        const stanLabel = stan ? stan.label : '—';
        const uwagi = w.uwagi ? `, ${w.uwagi}` : '';
        const line = `   • ${w.element}: ${stanLabel}${uwagi}`;
        const wrapped = pdf.splitTextToSize(line, W);
        ensureSpace(wrapped.length * 4 + 1);
        pdf.text(wrapped, M, y);
        y += wrapped.length * 4 + 1;
        addInlinePhotos(w.zdjecia);
      });
      y += 2;
    });
  }

  // UWAGI
  if (state.uwagi) {
    ensureSpace(20);
    y = pdfSection(pdf, 'UWAGI', y, M, W);
    pdf.setFontSize(9);
    const t = pdf.splitTextToSize(state.uwagi, W);
    ensureSpace(t.length * 4);
    pdf.text(t, M, y);
    y += t.length * 4 + 2;
  }

  // KLAUZULA + PODPISY
  ensureSpace(70);
  y = pdfSection(pdf, 'PODPISY STRON', y, M, W);
  pdf.setFontSize(9).setFont('Roboto', 'normal');
  const klauzula = pdf.splitTextToSize(
    'Strony potwierdzają, że LOKAL opisany powyżej został przekazany w posiadanie w dniu ' +
    'wskazanym w niniejszym protokole. Przekazujący oraz Odbierający oświadczają, że zawartość ' +
    'niniejszego protokołu jest zgodna z faktycznym stanem lokalu w dniu przekazania.',
    W
  );
  pdf.text(klauzula, M, y);
  y += klauzula.length * 5 + 14;

  // Blok podpisu: canvas (jeśli zapisano) + linia + etykieta + imię
  const SIG_H = 22; // mm wysokość obszaru podpisu
  const SIG_BLOCK_H = SIG_H + 12; // + przestrzeń na linię i tekst
  const halfW = (W - 10) / 2;

  function drawSig(xPos, yPos, label, name, dataUrl, blockW) {
    if (dataUrl) {
      try { pdf.addImage(dataUrl, 'PNG', xPos, yPos, blockW, SIG_H); }
      catch (e) { console.warn('sig img error', e); }
    }
    pdf.setDrawColor(80).setLineWidth(0.3);
    pdf.line(xPos, yPos + SIG_H + 1, xPos + blockW, yPos + SIG_H + 1);
    pdf.setFontSize(8).setTextColor(80).setFont('Roboto', 'bold');
    pdf.text(label, xPos, yPos + SIG_H + 5);
    pdf.setFont('Roboto', 'normal').setTextColor(0).setFontSize(9);
    if (name) pdf.text(name, xPos, yPos + SIG_H + 9);
  }

  ensureSpace(SIG_BLOCK_H + 2);
  const yPair = y;
  drawSig(M, yPair, 'PRZEKAZUJĄCY / WYNAJMUJĄCY', prz.imie || '', signatures['przekazujacy'], halfW);
  drawSig(M + halfW + 10, yPair, state.najemcy.length > 1 ? 'ODBIERAJĄCY / NAJEMCA 1' : 'ODBIERAJĄCY / NAJEMCA',
          state.najemcy[0]?.imie || '', signatures['najemca-0'], halfW);
  y += SIG_BLOCK_H;

  // Dodatkowi najemcy w nowych wierszach (po prawej)
  for (let i = 1; i < state.najemcy.length; i++) {
    ensureSpace(SIG_BLOCK_H + 4);
    drawSig(M + halfW + 10, y, `ODBIERAJĄCY / NAJEMCA ${i + 1}`,
            state.najemcy[i].imie || '', signatures['najemca-' + i], halfW);
    y += SIG_BLOCK_H + 2;
  }

  // STOPKA
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7).setTextColor(120);
    pdf.text(
      `RM Nieruchomości | Rafał Lenart | 668 169 986 | strona ${i}/${totalPages}`,
      M, 290
    );
  }

  const fname = `Protokol_${state.typ}_${(state.adres || 'lokal').replace(/[^a-zA-Z0-9]/g, '_')}_${state.data}.pdf`;
  pdf.save(fname);

  // zapisz blob + nazwę dla modalu udostępniania
  try {
    const blob = pdf.output('blob');
    _lastPdfBlob = blob;
    _lastPdfFilename = fname;
    openShareModal();
  } catch (e) {
    console.warn('blob output error', e);
    toast('PDF zapisany');
  }
}

// ============ SHARE / WHATSAPP ============
let _lastPdfBlob = null;
let _lastPdfFilename = '';

function openShareModal() {
  const prz = getPrzekazujacy();
  const phone = (prz.telefon || '668 169 986').trim();
  $('#wa-phone-label').textContent = phone;
  $('#share-modal').showModal();
}

async function shareLastPdf() {
  if (!_lastPdfBlob) {
    toast('Najpierw wygeneruj PDF');
    return;
  }
  const file = new File([_lastPdfBlob], _lastPdfFilename || 'Protokol.pdf', { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Protokół zdawczo-odbiorczy',
        text: `Protokół ${state ? state.typ : ''} ${state && state.adres ? ', ' + state.adres : ''}`.trim(),
        files: [file]
      });
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn(e);
        toast('Nie udało się udostępnić');
      }
    }
  } else {
    toast('Twoja przeglądarka nie wspiera udostępniania plików. Otwórz WhatsApp i dołącz PDF z pobranych.');
  }
}

function openWhatsAppChat() {
  const prz = getPrzekazujacy();
  const phoneRaw = prz.telefon || '668 169 986';
  // do format E.164: usuń wszystko niecyfrowe, dodaj +48 jeśli brak
  let phone = phoneRaw.replace(/\D/g, '');
  if (phone.length === 9) phone = '48' + phone;
  const adres = state && state.adres ? state.adres : 'inwentaryzacja';
  const dataStr = state && state.data ? fmtDate(state.data) : '';
  const typ = state && state.typ ? state.typ : '';
  const txt = encodeURIComponent(
    `Protokół ${typ}, ${adres}, ${dataStr}.\nPDF dołączam w załączniku (z pobranych plików).`
  );
  const url = `https://wa.me/${phone}?text=${txt}`;
  window.open(url, '_blank', 'noopener');
}

function pdfSection(pdf, title, y, M, W) {
  pdf.setFillColor(9, 77, 71);
  pdf.rect(M, y - 4, W, 6, 'F');
  pdf.setTextColor(255).setFont('Roboto', 'bold').setFontSize(10);
  pdf.text(title, M + 2, y);
  pdf.setTextColor(0);
  return y + 6;
}

function pdfMasterSection(pdf, title, y, M, W) {
  const cx = M + W / 2;
  y += 3;
  pdf.setFont('Roboto', 'bold').setFontSize(14).setTextColor(9, 77, 71);
  pdf.text(title.toUpperCase(), cx, y, { align: 'center' });
  y += 2;
  pdf.setDrawColor(9, 77, 71).setLineWidth(0.8);
  pdf.line(M, y, M + W, y);
  pdf.setTextColor(0);
  return y + 7;
}

async function appendPhotosPages(pdf, M, W) {
  const photos = [];
  state.liczniki.forEach(l => {
    l.zdjecia.forEach(src => photos.push({ src, label: `Licznik ${l.nazwa}` }));
  });
  state.pomieszczenia.forEach(p => {
    p.pozycje.forEach(poz => {
      poz.zdjecia.forEach(src => photos.push({ src, label: `${p.nazwa}, ${poz.nazwa}` }));
    });
    if (p.stanTechniczny) {
      ELEMENTY_TECHNICZNE.forEach(e => {
        const obj = p.stanTechniczny[e.id];
        if (obj && obj.zdjecia) {
          obj.zdjecia.forEach(src => photos.push({ src, label: `${p.nazwa}, ${e.nazwa}` }));
        }
      });
    }
  });
  if (photos.length === 0) return;

  pdf.addPage();
  pdf.setFontSize(14).setFont('Roboto', 'bold').setTextColor(9, 77, 71);
  pdf.text('ZAŁĄCZNIK, ZDJĘCIA', M, M + 4);
  pdf.setTextColor(0);

  let y = M + 12;
  const photoW = (W - 5) / 2;
  const photoH = photoW * 0.75;
  let col = 0;

  for (const ph of photos) {
    if (y + photoH + 5 > 290) {
      pdf.addPage();
      y = M;
      col = 0;
    }
    const x = M + col * (photoW + 5);
    try {
      pdf.addImage(ph.src, 'JPEG', x, y, photoW, photoH);
      pdf.setFontSize(7).setTextColor(80);
      const txt = pdf.splitTextToSize(ph.label, photoW);
      pdf.text(txt, x, y + photoH + 3);
    } catch (e) {
      console.warn('PDF photo error', e);
    }
    col++;
    if (col >= 2) {
      col = 0;
      y += photoH + 10;
    }
  }
}

// ============ INIT (po DOM ready) ============
function initApp() {
  // przyciski startowe
  $('#btn-new-wpis').addEventListener('click', () => startNewInventory('WPIS'));
  $('#btn-new-wypis').addEventListener('click', () => startNewInventory('WYPIS'));
  $('#back-btn').addEventListener('click', async () => {
    await saveState();
    showScreen('home');
  });
  $('#btn-add-room').addEventListener('click', openRoomPicker);

  $('#type-wpis').addEventListener('click', () => { state.typ = 'WPIS'; renderForm(); autosave(); });
  $('#type-wypis').addEventListener('click', () => { state.typ = 'WYPIS'; renderForm(); autosave(); });

  ['f-adres','f-data','f-uwagi','f-akcesoria-inne'].forEach(id => {
    document.getElementById(id).addEventListener('input', autosave);
  });

  $('#btn-save').addEventListener('click', async () => {
    await saveState();
    toast('Zapisano');
  });

  $('#btn-pdf').addEventListener('click', async () => {
    await saveState();
    openSignaturesModal(async (signatures) => {
      await generatePDF(signatures);
    });
  });

  // Modal udostępniania PDF
  $('#btn-close-share').addEventListener('click', () => $('#share-modal').close());
  $('#btn-share-pdf').addEventListener('click', shareLastPdf);
  $('#btn-whatsapp-pdf').addEventListener('click', openWhatsAppChat);

  // Modal OCR
  $('#btn-cancel-ocr').addEventListener('click', () => $('#ocr-modal').close());
  $('#ocr-file').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) processOcrImage(f);
  });
  $('#btn-apply-ocr').addEventListener('click', () => {
    const imie = $('#ocr-imie').value.trim();
    const pesel = $('#ocr-pesel').value.trim();
    const adres = $('#ocr-adres').value.trim();
    if (_ocrTargetIdx !== null && state.najemcy[_ocrTargetIdx]) {
      if (imie) state.najemcy[_ocrTargetIdx].imie = imie;
      if (pesel) state.najemcy[_ocrTargetIdx].pesel = pesel;
      if (adres) state.najemcy[_ocrTargetIdx].adres = adres;
      renderNajemcy();
      bindMicButtons();
      autosave();
      toast('Dane najemcy uzupełnione');
    }
    $('#ocr-modal').close();
  });

  // Modale
  $('#btn-cancel-room').addEventListener('click', () => $('#room-picker').close());
  $('#btn-cancel-pos').addEventListener('click', () => $('#pos-adder').close());
  $('#btn-confirm-pos').addEventListener('click', () => {
    const name = $('#pos-add-name').value.trim();
    const typ = $('#pos-add-typ').value;
    if (!name) { toast('Wpisz nazwę'); return; }
    state.pomieszczenia[posAdderRoomIdx].pozycje.push({
      id: uid(),
      nazwa: name,
      typ,
      wartosc: typ === 'ilosc' ? 0 : '',
      marka: null,
      uwagi: '',
      zdjecia: []
    });
    $('#pos-adder').close();
    renderRooms();
    autosave();
  });
}

(async function init() {
  await openDb();
  initApp();
  renderPrzekazujacyOnHome();
  bindPrzekazujacyInputs();
  showScreen('home');

  // Service Worker tylko na produkcji (HTTPS), nie na localhost
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && !isLocalhost) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn(e); }
  } else if (isLocalhost && 'serviceWorker' in navigator) {
    // wyrejestruj ewentualny SW z poprzednich testów
    const regs = await navigator.serviceWorker.getRegistrations();
    regs.forEach(r => r.unregister());
  }
})();
