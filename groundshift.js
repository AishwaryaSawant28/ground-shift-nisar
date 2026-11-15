'use strict';
/* GROUND SHIFT — investigation logic */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SAVE_KEY = 'groundshift.case.v1';

const DEFAULT_STATE = () => ({
  xp: 0, cred: 100, done: [], best: {},
  settings: { motion: 'on', sound: 'off', text: 'md' }
});

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT_STATE();
    const p = JSON.parse(raw);
    const d = DEFAULT_STATE();
    return {
      xp: Number.isFinite(p.xp) ? Math.max(0, p.xp) : 0,
      cred: Number.isFinite(p.cred) ? clamp(p.cred, 0, 100) : 100,
      done: Array.isArray(p.done) ? p.done.filter(n => n >= 0 && n < 4) : [],
      best: p.best && typeof p.best === 'object' ? p.best : {},
      settings: Object.assign(d.settings, p.settings || {})
    };
  } catch (e) { return DEFAULT_STATE(); }
}
let S = loadState();

function saveState() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* private mode */ }
}

/* settings */
const root = document.documentElement;
function applySettings() {
  const st = S.settings;
  root.classList.toggle('reduce-motion', st.motion === 'off');
  root.classList.toggle('txt-lg', st.text === 'lg');
  root.classList.toggle('txt-sm', st.text === 'sm');
  $$('#setMotion span').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.v === st.motion)));
  $$('#setSound span').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.v === st.sound)));
  $$('#setText span').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.v === st.text)));
}
applySettings();

/* micro-feedback */
let toastTimer = 0;
function toast(html, ms = 2600) {
  const t = $('#toast');
  if (!t) return;
  t.innerHTML = html;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* synthesised sound (optional, off by default) */
let audioCtx = null;
function ping(freq = 880, dur = 0.18, type = 'sine', gain = 0.05) {
  if (S.settings.sound !== 'on') return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* audio unavailable */ }
}

/* score */
function addXP(n) {
  if (runtime && S.done.includes(runtime.i)) return; /* practice run: no repeat XP */
  S.xp += n; saveState(); syncHUD();
}
function loseCred(n, why) {
  const before = S.cred;
  S.cred = clamp(S.cred - n, 0, 100);
  saveState(); syncHUD();
  const lost = before - S.cred;
  if (lost > 0 && why) toast(`<b>−${lost} credibility</b> · ${why}`);
}
function syncHUD() {
  const xp = $('#xpVal'), cred = $('#credVal'), prog = $('#progVal');
  if (xp) xp.textContent = S.xp;
  if (cred) cred.innerHTML = S.cred + '<i>%</i>';
  if (prog) prog.innerHTML = S.done.length + '<i>/4</i>';
}
function completeMission(idx, earned) {
  const prev = S.best[idx] || 0;
  S.best[idx] = Math.max(prev, earned);
  if (!S.done.includes(idx)) S.done.push(idx);
  const first = S.done.length;
  saveState(); syncHUD(); renderRail();
  toast(`<b>Mission ${String(idx + 1).padStart(2, '0')} closed</b> · ${earned} XP · ${first}/4 complete`, 3200);
  ping(660, 0.12, 'sine', 0.04);
  setTimeout(() => ping(990, 0.3, 'sine', 0.035), 140);
}

/* ══════════ ambient starfield ══════════ */
const starCanvas = $('#stars');
const sctx = starCanvas.getContext('2d');
let stars = [], starW = 0, starH = 0, starRAF = 0, starLast = 0;
function sizeStars() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  starW = innerWidth; starH = innerHeight;
  starCanvas.width = starW * dpr; starCanvas.height = starH * dpr;
  starCanvas.style.width = starW + 'px'; starCanvas.style.height = starH + 'px';
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.round(clamp(starW * starH / 11000, 60, 190));
  stars = Array.from({ length: count }, (_, i) => {
    const layer = i % 3;
    return { x: Math.random() * starW, y: Math.random() * starH, r: [0.5, 0.9, 1.4][layer], a: 0.25 + Math.random() * 0.6,
      depth: [0.004, 0.009, 0.016][layer], tw: Math.random() * 6.283, tws: 0.4 + Math.random() * 0.9 };
  });
  drawStars(0);
}
function drawStars(t) {
  sctx.clearRect(0, 0, starW, starH);
  for (const s of stars) {
    const a = s.a * (0.7 + 0.3 * Math.sin(t * 0.001 * s.tws + s.tw));
    sctx.fillStyle = `rgba(${s.r > 1.2 ? '185,235,255' : '225,240,250'},${a})`;
    sctx.beginPath(); sctx.arc(s.x, s.y, s.r, 0, 6.283); sctx.fill();
  }
}
function starLoop(now) {
  if (!starLast) starLast = now;
  const dt = Math.min(64, now - starLast); starLast = now;
  if (S.settings.motion === 'on') for (const s of stars) { s.y += s.depth * dt * 0.055; if (s.y > starH + 3) { s.y = -3; s.x = Math.random() * starW; } }
  drawStars(now);
  starRAF = requestAnimationFrame(starLoop);
}
function startStars() { if (!starRAF && S.settings.motion === 'on') { starLast = 0; starRAF = requestAnimationFrame(starLoop); } }
function stopStars() { if (starRAF) cancelAnimationFrame(starRAF); starRAF = 0; }
sizeStars(); startStars();
addEventListener('resize', () => { sizeStars(); startStars(); });

/* ══════════ animated Earth + satellite ══════════ */
const globe = $('#globe');
const gctx = globe.getContext('2d');
let gW = 0, gH = 0, gRAF = 0, gPing = [], gPinged = false;

function sizeGlobe() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  gW = globe.clientWidth || 400; gH = globe.clientHeight || 400;
  globe.width = Math.round(gW * dpr); globe.height = Math.round(gH * dpr);
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawGlobe(performance.now());
}

function drawGlobe(now) {
  if (!gW) return;
  const w = gW, h = gH, cx = w * 0.5, cy = h * 0.51, R = Math.min(w, h) * 0.325;
  const TAU = Math.PI * 2, t = now * 0.001;
  gctx.clearRect(0, 0, w, h);

  /* atmosphere */
  let g = gctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.55);
  g.addColorStop(0, 'rgba(72,190,225,0.20)');
  g.addColorStop(0.45, 'rgba(48,140,190,0.08)');
  g.addColorStop(1, 'rgba(20,70,110,0)');
  gctx.fillStyle = g; gctx.beginPath(); gctx.arc(cx, cy, R * 1.55, 0, TAU); gctx.fill();

  /* orbit path */
  const ox = R * 1.42, oy = R * 0.43, tilt = -0.34;
  gctx.save(); gctx.translate(cx, cy); gctx.rotate(tilt);
  gctx.strokeStyle = 'rgba(99,226,238,0.20)'; gctx.lineWidth = 1; gctx.setLineDash([2, 5]);
  gctx.beginPath(); gctx.ellipse(0, 0, ox, oy, 0, 0, TAU); gctx.stroke();
  gctx.setLineDash([]);
  gctx.restore();

  /* planet */
  g = gctx.createRadialGradient(cx - R * 0.42, cy - R * 0.46, R * 0.06, cx, cy, R * 1.04);
  g.addColorStop(0, '#a5d9ec'); g.addColorStop(0.12, '#579cc2'); g.addColorStop(0.34, '#1f5b82');
  g.addColorStop(0.62, '#0c304b'); g.addColorStop(0.85, '#04121f'); g.addColorStop(1, '#01060c');
  gctx.fillStyle = g; gctx.beginPath(); gctx.arc(cx, cy, R, 0, TAU); gctx.fill();

  gctx.save(); gctx.beginPath(); gctx.arc(cx, cy, R, 0, TAU); gctx.clip();

  /* latitude grid */
  gctx.lineWidth = 0.7;
  for (let i = -4; i <= 4; i++) {
    const lat = i * 0.19;
    const yy = cy + Math.sin(lat) * R;
    const rx = Math.cos(lat) * R;
    gctx.strokeStyle = `rgba(150,235,255,${i === 0 ? 0.16 : 0.07})`;
    gctx.beginPath(); gctx.ellipse(cx, yy, rx, rx * 0.12, 0, 0, TAU); gctx.stroke();
  }
  /* rotating meridians */
  const spin = t * 0.05;
  for (let k = 0; k < 6; k++) {
    const a = spin + k * Math.PI / 6;
    const rx = Math.abs(Math.cos(a)) * R;
    const front = Math.cos(a) > 0;
    gctx.strokeStyle = `rgba(150,235,255,${front ? 0.10 : 0.035})`;
    gctx.beginPath(); gctx.ellipse(cx, cy, Math.max(1, rx), R, 0, 0, TAU); gctx.stroke();
  }

  /* terminator + city lights */
  g = gctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  g.addColorStop(0.32, 'rgba(0,4,10,0)'); g.addColorStop(0.72, 'rgba(0,3,9,0.55)'); g.addColorStop(1, 'rgba(0,2,6,0.88)');
  gctx.fillStyle = g; gctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  /* radar sweep */
  const sa = (t * 0.55) % TAU;
  gctx.beginPath(); gctx.moveTo(cx, cy); gctx.arc(cx, cy, R * 1.02, sa, sa + 0.62); gctx.closePath();
  gctx.fillStyle = 'rgba(99,226,238,0.07)'; gctx.fill();
  gctx.beginPath(); gctx.moveTo(cx, cy); gctx.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R);
  gctx.strokeStyle = 'rgba(160,245,255,0.35)'; gctx.lineWidth = 1; gctx.stroke();

  /* fine scanlines */
  gctx.fillStyle = 'rgba(175,240,255,0.028)';
  for (let y = cy - R; y < cy + R; y += 5) gctx.fillRect(cx - R, y, R * 2, 1);

  /* target marker */
  const mx = cx - R * 0.24, my = cy + R * 0.04;
  const pulse = 1 + 0.55 * Math.sin(t * 2.2);
  gctx.strokeStyle = 'rgba(255,199,130,0.55)'; gctx.lineWidth = 0.8;
  gctx.beginPath(); gctx.arc(mx, my, 5 * pulse, 0, TAU); gctx.stroke();
  gctx.fillStyle = '#ffd9a3'; gctx.beginPath(); gctx.arc(mx, my, 1.8, 0, TAU); gctx.fill();
  gctx.strokeStyle = 'rgba(255,214,160,0.28)';
  gctx.beginPath(); gctx.moveTo(mx + 7, my); gctx.lineTo(mx + 26, my - 10); gctx.lineTo(mx + 58, my - 10); gctx.stroke();
  gctx.font = '8px Consolas, monospace'; gctx.fillStyle = 'rgba(255,224,186,0.8)'; gctx.textAlign = 'left';
  gctx.fillText('MEXICO CITY', mx + 30, my - 14);
  gctx.restore();

  /* rim light */
  gctx.strokeStyle = 'rgba(170,240,255,0.35)'; gctx.lineWidth = 1;
  gctx.beginPath(); gctx.arc(cx, cy, R, 0, TAU); gctx.stroke();
  gctx.strokeStyle = 'rgba(99,226,238,0.10)'; gctx.lineWidth = 8;
  gctx.beginPath(); gctx.arc(cx, cy, R + 5, 0, TAU); gctx.stroke();

  /* satellite */
  const ang = t * 0.18 - 0.6;
  const sx = cx + Math.cos(ang) * ox * Math.cos(tilt) - Math.sin(ang) * oy * Math.sin(tilt);
  const sy = cy + Math.cos(ang) * ox * Math.sin(tilt) + Math.sin(ang) * oy * Math.cos(tilt);
  gctx.strokeStyle = 'rgba(255,199,130,0.20)'; gctx.lineWidth = 1; gctx.setLineDash([3, 6]);
  gctx.beginPath(); gctx.moveTo(sx, sy); gctx.lineTo(mx, my); gctx.stroke(); gctx.setLineDash([]);
  gctx.save(); gctx.translate(sx, sy); gctx.rotate(ang + tilt);
  gctx.fillStyle = 'rgba(10,26,44,0.95)'; gctx.strokeStyle = 'rgba(150,220,240,0.55)'; gctx.lineWidth = 0.8;
  for (const dx of [-19, 8]) { gctx.fillRect(dx, -4.5, 11, 9); gctx.strokeRect(dx, -4.5, 11, 9); gctx.beginPath(); gctx.moveTo(dx + 3.5, -4.5); gctx.lineTo(dx + 3.5, 4.5); gctx.stroke(); }
  gctx.fillStyle = '#e7b27a'; gctx.fillRect(-7, -4, 14, 8);
  gctx.fillStyle = 'rgba(255,245,220,0.9)'; gctx.fillRect(-7, -1, 14, 1);
  gctx.restore();
  gctx.strokeStyle = 'rgba(231,178,122,0.35)';
  gctx.beginPath(); gctx.moveTo(sx, sy); gctx.lineTo(sx, sy - 16); gctx.lineTo(sx + 12, sy - 22); gctx.stroke();
  gctx.font = '7px Consolas, monospace'; gctx.fillStyle = 'rgba(231,178,122,0.8)';
  gctx.fillText('NISAR', sx + 15, sy - 23);

  /* HUD ticks */
  gctx.strokeStyle = 'rgba(160,210,230,0.18)'; gctx.lineWidth = 1;
  for (let k = 0; k < 72; k++) {
    const a = k * TAU / 72, r1 = R * 1.20, r2 = R * (k % 6 === 0 ? 1.235 : 1.215);
    gctx.beginPath(); gctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    gctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); gctx.stroke();
  }

  /* click pings */
  gPing = gPing.filter(p => now - p < 1500);
  for (const p of gPing) {
    const k = (now - p) / 1500;
    gctx.strokeStyle = `rgba(99,226,238,${0.55 * (1 - k)})`; gctx.lineWidth = 1;
    gctx.beginPath(); gctx.arc(cx, cy, R * (0.35 + k * 0.75), 0, TAU); gctx.stroke();
    gctx.beginPath(); gctx.arc(cx, cy, R * (0.2 + k * 0.5), 0, TAU); gctx.stroke();
  }
}

function globeLoop(now) { drawGlobe(now); gRAF = requestAnimationFrame(globeLoop); }
function startGlobe() {
  if (!globe) return;
  if (!gW) sizeGlobe();
  if (S.settings.motion === 'on' && !gRAF) { gRAF = requestAnimationFrame(globeLoop); }
  else drawGlobe(performance.now());
}
function stopGlobe() { if (gRAF) cancelAnimationFrame(gRAF); gRAF = 0; }
if (globe) {
  new ResizeObserver(sizeGlobe).observe(globe);
  globe.addEventListener('pointerdown', e => {
    const r = globe.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < Math.min(r.width, r.height) * 0.36) {
      gPing.push(performance.now());
      ping(720 + Math.random() * 260, 0.16, 'sine', 0.035);
      if (!gPinged) { gPinged = true; toast('<b>Radar ping</b> · return signal received', 1800); }
    }
  });
}

/* ══════════ navigation ══════════ */
const SCREENS = { menu: 'scr-menu', archive: 'scr-archive', lab: 'scr-lab', settings: 'scr-settings', game: 'scr-game', report: 'scr-report' };
let screenNow = 'menu';

function showScreen(name) {
  if (!SCREENS[name]) return;
  $$('.screen').forEach(el => el.classList.remove('on'));
  const target = document.getElementById(SCREENS[name]);
  if (target) target.classList.add('on');
  screenNow = name;
  $('#toast').classList.remove('show');
  $('#novaPanel').classList.remove('open');
  const novaToggle = $('#novaToggle');
  if (novaToggle) novaToggle.setAttribute('aria-expanded', 'false');
  if (name === 'menu') startGlobe(); else stopGlobe();
  if (name === 'archive') renderArchive();
  if (name === 'settings') applySettings();
  window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
}

$$('[data-go]').forEach(btn => btn.addEventListener('click', () => {
  ping(540, 0.06, 'triangle', 0.02);
  showScreen(btn.dataset.go);
}));

function canOpen(i) { return i === 0 || S.done.includes(i - 1) || S.done.includes(i); }

function updateMenuState() {
  const doneAll = S.done.length === 4;
  const started = S.done.length > 0 || S.xp > 0;
  const lab = $('#menuStart .lab'), sub = $('#startSub');
  if (lab) lab.textContent = doneAll ? 'Review final report' : started ? 'Resume investigation' : 'Start investigation';
  if (sub) sub.textContent = doneAll
    ? 'Case closed · open your investigator report'
    : started
      ? `Case ${S.done.length}/4 closed · ${S.xp} XP · credibility ${S.cred}%`
      : 'Mexico City · NASA NISAR evidence · four linked missions';
  const asub = $('#archiveSub');
  if (asub) asub.textContent = S.done.length ? `${S.done.length}/4 missions closed · review the record` : 'Review the case record and published evidence';
}

$('#menuStart').addEventListener('click', () => {
  ping(620, 0.1, 'sine', 0.03);
  if (S.done.length === 4) { renderReport(); showScreen('report'); return; }
  const next = [0, 1, 2, 3].find(i => !S.done.includes(i));
  openMission(next === undefined ? 0 : next);
});

/* ══════════ archive ══════════ */
const MISSION_META = [
  { title: 'Detect the movement', sub: 'Read the published deformation map and find the strongest reported subsidence.' },
  { title: 'Decode the radar', sub: 'See how repeat radar acquisitions reveal surface motion through phase.' },
  { title: 'Signal or noise?', sub: 'Triage map patches using uncertainty and NASA’s noise note.' },
  { title: 'Solve the mystery', sub: 'Connect groundwater, compaction and infrastructure strain.' }
];

function renderArchive() {
  const host = $('#archiveList');
  if (!host) return;
  $('#archProgress').textContent = `${S.done.length} / 4 closed`;
  host.innerHTML = MISSION_META.map((m, i) => {
    const done = S.done.includes(i), locked = !canOpen(i);
    return `<button class="record${locked ? ' locked' : ''}" data-m="${i}" ${locked ? 'aria-disabled="true"' : ''}>
      <span class="rn">${String(i + 1).padStart(2, '0')}</span>
      <span><span class="rt">${m.title}</span><span class="rp">${m.sub}</span></span>
      <span class="rstat ${done ? 'done' : ''}">${done ? 'Replay' : locked ? 'Sealed' : 'Open'}</span>
      <span class="rscore">${done ? (S.best[i] || 0) + ' XP' : '—'}</span>
    </button>`;
  }).join('');
  $$('#archiveList .record').forEach(row => row.addEventListener('click', () => {
    const i = +row.dataset.m;
    if (!canOpen(i)) { toast('Seal is intact · close the previous mission first'); return; }
    openMission(i);
  }));
}

/* ══════════ mission rail + shell ══════════ */
function renderRail() {
  const rail = $('#gbRail'), list = $('#mrailList');
  if (!rail || !list) return;
  const tabs = MISSION_META.map((m, i) => {
    const done = S.done.includes(i), locked = !canOpen(i), active = i === currentMission;
    return `<button class="gbtab${active ? ' active' : ''}${done ? ' done' : ''}${locked ? ' locked' : ''}" data-m="${i}" ${locked ? 'disabled aria-disabled="true"' : ''}>
      <span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${m.title.split(' ').slice(0, 2).join(' ')}</span></button>`;
  }).join('');
  rail.innerHTML = tabs;
  list.innerHTML = MISSION_META.map((m, i) => {
    const done = S.done.includes(i), locked = !canOpen(i), active = i === currentMission;
    return `<button class="mitem${active ? ' active' : ''}${done ? ' done' : ''}${locked ? ' locked' : ''}" data-m="${i}" ${locked ? 'disabled' : ''}>
      <span class="n">${String(i + 1).padStart(2, '0')}</span><span><b>${m.title}</b><small>${done ? 'Closed' : m.sub.split('.')[0]}</small></span></button>`;
  }).join('');
  $$('[data-m]', rail).concat($$('[data-m]', list)).forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.m;
    if (!canOpen(i)) { toast('Seal is intact · close the previous mission first'); return; }
    openMission(i);
  }));
  syncHUD(); updateMenuState();
}

function missionHead(num, title, desc, stamp) {
  return `<div class="mission-head">
    <div>
      <div class="eyebrow">Investigation ${String(num).padStart(2, '0')} / 04 · Case GS-001</div>
      <h1>${title}</h1>
      <p class="mdesc">${desc}</p>
    </div>
    <div class="stamp">${stamp}</div>
  </div>`;
}

function stepBar(labels, state) {
  return `<div class="stepbar">${labels.map((l, i) => {
    const cls = state[i] === 1 ? ' ok' : state[i] === 2 ? ' now' : '';
    return `<span class="st${cls}"><i>${state[i] === 1 ? '✓' : i + 1}</i>${l}</span>${i < labels.length - 1 ? '<span class="sep"></span>' : ''}`;
  }).join('')}</div>`;
}

function clearStage() {
  const stage = $('#stage');
  if (stage) { stage.innerHTML = ''; stage.scrollTop = 0; }
  stopInSAR();
}

function openMission(i) {
  currentMission = i;
  runtime = makeRuntime(i);
  closeNova();
  showScreen('game');
  renderRail();
  renderMission();
  openNovaContext();
  setTimeout(() => { const st = $('#stage'); if (st) st.focus({ preventScroll: true }); }, 60);
}

function backToMenu() {
  stopGlobe(); clearStage(); stopInSAR();
  renderRail(); updateMenuState();
  showScreen('menu');
}
$('#toMenu').addEventListener('click', backToMenu);

/* ══════════ question component ══════════ */
function mountQuestion(host, opts) {
  if (!host) return;
  host.innerHTML = `<div class="qbox">
    <div class="qnum">${opts.label || 'Analysis question'}</div>
    <p class="qtext">${opts.q}</p>
    <div class="choices" role="group" aria-label="${opts.label || 'Answer choices'}"></div>
    <div class="feedback" aria-live="polite">Choose the reading best supported by the evidence.</div>
  </div>`;
  const box = $('.choices', host), fb = $('.feedback', host);
  let firstTry = true, solved = false;

  const order = opts.options.map((o, i) => ({ o, i }));
  for (let k = order.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  order.forEach(({ o, i }) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.type = 'button';
    b.innerHTML = `<span class="k">${String.fromCharCode(65 + i)}</span><span>${o.t}</span>`;
    b.addEventListener('click', () => {
      if (solved || b.disabled) return;
      if (i === opts.correct) {
        solved = true;
        b.classList.add('ok');
        $$('.choice', box).forEach(x => x.disabled = true);
        fb.className = 'feedback show good';
        fb.innerHTML = `<b>Reading accepted${firstTry ? ' · clean analysis' : ''}</b>${opts.explain}`;
        ping(880, 0.13, 'sine', 0.035);
        if (firstTry) addXP(60); else addXP(30);
        opts.onSolved && opts.onSolved(firstTry);
      } else {
        firstTry = false;
        b.classList.add('bad'); b.disabled = true;
        fb.className = 'feedback show bad';
        fb.innerHTML = `<b>Not supported by the evidence</b>${o.why || 'Re-read the evidence and try another reading.'}`;
        loseCred(5, 'unsupported reading');
        ping(240, 0.12, 'triangle', 0.03);
      }
    });
    box.appendChild(b);
  });
}

/* ══════════ runtime ══════════ */
let currentMission = 0;
let runtime = null;

function makeRuntime(i) {
  return {
    i: Number.isFinite(i) ? i : 0,
    wrong: 0, hints: 0, earned: 0,
    m1: { found: new Set(), probes: 0, q2Ready: false },
    m2: { pass: 0, seen: new Set(), q: 0 },
    m3: { solved: new Set(), wrap: false },
    m4: { slots: [null, null, null, null, null], validated: false, q: 0 }
  };
}

function renderMission() {
  if (!runtime) runtime = makeRuntime();
  if (runtime.i === 0) renderM1();
  else if (runtime.i === 1) renderM2();
  else if (runtime.i === 2) renderM3();
  else renderM4();
  renderRail();
}

function missionComplete(uiIndex, xp) {
  runtime.earned += xp;
  addXP(xp);
  completeMission(uiIndex, runtime.earned);
}

/* ══════════ mission 01 · detect the movement ══════════ */
const MAP_ZONES = [
  { key: 'north', x: 0.563, y: 0.305, r: 0.078, name: 'NORTH CORE CLUSTER' },
  { key: 'central', x: 0.58, y: 0.581, r: 0.095, name: 'CENTRAL CORRIDOR' }
];
const MAP_NOISE = [
  { x: 0.30, y: 0.08, label: 'NORTH-WEST YELLOW FIELD' },
  { x: 0.86, y: 0.62, label: 'SOUTH-EAST RED SPECKLE' },
  { x: 0.08, y: 0.30, label: 'WESTERN MARGIN' }
];
let mapCtrl = null;

function renderM1() {
  clearStage();
  const stage = $('#stage');
  stage.innerHTML = `<div class="mission">${missionHead(1, 'Detect the movement',
    'A radar satellite has measured the ground beneath Mexico City. The map is NASA’s published NISAR-derived result for 25 October 2025 to 17 January 2026. Find the two strongest reported subsidence clusters, then read the colour scale honestly.',
    'NASA PUBLISHED FIGURE ·<br>NOT A LIVE MAP')}
    ${stepBar(['Locate the signal', 'Read the scale', 'Interpret limits'], [0, 0, 0])}
    <div class="evidence-grid">
      <div class="map-col">
        <div class="mapframe corner">
          <div class="maphud"><span>Figure A · ground displacement</span><span class="live"><i></i>Archived 17 Jan 2026 · not live</span></div>
          <div class="mapview" id="mapView" tabindex="0" role="group" aria-label="Interactive NASA deformation map of Mexico City. Click, or focus and use arrow keys then Enter, to probe locations.">
            <div class="mapstage" id="mapStage">
              <img id="mapImg" src="PIA26709_figA.png" alt="NASA NISAR-derived map of Mexico City ground deformation, with dark blue areas of strong subsidence and scattered yellow and red patches." draggable="false">
              <div class="maplayer" id="mapLayer"></div>
            </div>
            <div class="reticle" id="reticle" aria-hidden="true"><i></i><u></u></div>
            <div class="coordread" id="coordread">Probe position · X 0.50 / Y 0.50</div>
            <div class="maptools">
              <button type="button" id="zoomIn" aria-label="Zoom in">+</button>
              <button type="button" id="zoomOut" aria-label="Zoom out">−</button>
              <button type="button" id="zoomReset" aria-label="Reset map view">⤾</button>
            </div>
          </div>
          <div class="legend">
            <div><i class="b"></i><span><b>Dark blue</b>Areas NASA reports sinking more than 2 cm/month</span></div>
            <div><i class="c"></i><span><b>Cyan / green</b>Little or no change shown in this scale</span></div>
            <div><i class="n"></i><span><b>Yellow / red</b>Likely residual noise in this preliminary product</span></div>
          </div>
        </div>
        <div class="map-src"><span>PIA26709 Fig. A · NASA Science Photojournal · NASA–ISRO NISAR</span><a href="https://science.nasa.gov/photojournal/us-indian-spacecraft-captures-mexico-city-subsidence/" target="_blank" rel="noopener">Open source ↗</a></div>
        <div class="map-log" id="mapLog" aria-live="polite"><p>Drag to pan when zoomed. Click any location to probe the published map.</p></div>
      </div>
      <aside class="fieldpanel">
        <div class="fp-head"><span>Field tasks</span><b id="m1count">0 / 2</b></div>
        <ul class="tasklist" id="m1tasks">
          <li data-t="north"><i></i><span>Locate the northern strong-subsidence cluster</span></li>
          <li data-t="central"><i></i><span>Locate the central strong-subsidence cluster</span></li>
        </ul>
        <div id="m1q"></div>
        <div class="fp-foot"><button class="hintbtn" id="m1hint" type="button">Request a hint</button></div>
        <div id="m1hintbox"></div>
      </aside>
    </div></div>`;
  setupMissionMap();
  $('#m1hint').addEventListener('click', () => {
    if (runtime.hints++ > 1) return;
    loseCred(3, 'hint used');
    $('#m1hintbox').innerHTML = '<div class="hintbox">Look for the two large dark-blue masses — one in the upper third, one across the middle. Yellow and red speckle is likely residual noise, not your target.</div>';
    $('#m1hint').style.display = 'none';
  });
}

function setupMissionMap() {
  const view = $('#mapView'), stageEl = $('#mapStage'), layer = $('#mapLayer'), img = $('#mapImg');
  if (!view || !stageEl) return;
  let z = 1, tx = 0, ty = 0, dragging = false, moved = false, sx = 0, sy = 0, stx = 0, sty = 0;
  let kx = 0.5, ky = 0.5;
  const reticle = $('#reticle'), readout = $('#coordread');

  const clampPan = () => {
    const maxX = (z - 1) * view.clientWidth / 2, maxY = (z - 1) * view.clientHeight / 2;
    tx = clamp(tx, -maxX, maxX); ty = clamp(ty, -maxY, maxY);
  };
  const apply = () => {
    clampPan();
    stageEl.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
    layer.style.setProperty('--inv', String(1 / z));
  };
  const zoomBy = f => { z = clamp(z * f, 1, 2.8); if (z === 1) { tx = 0; ty = 0; } apply(); ping(520, 0.05, 'triangle', 0.02); };

  $('#zoomIn').onclick = () => zoomBy(1.35);
  $('#zoomOut').onclick = () => zoomBy(1 / 1.35);
  $('#zoomReset').onclick = () => { z = 1; tx = ty = 0; apply(); };

  view.addEventListener('pointerdown', e => {
    dragging = true; moved = false;
    sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
    try { view.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  });
  view.addEventListener('pointermove', e => {
    const r = view.getBoundingClientRect();
    const nx = clamp((e.clientX - r.left) / r.width, 0, 1), ny = clamp((e.clientY - r.top) / r.height, 0, 1);
    reticle.style.left = (e.clientX - r.left) + 'px';
    reticle.style.top = (e.clientY - r.top) + 'px';
    readout.textContent = `Probe position · X ${nx.toFixed(2)} / Y ${ny.toFixed(2)}`;
    if (dragging) {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 5) moved = true;
      if (z > 1) { tx = stx + dx; ty = sty + dy; apply(); }
    }
  });
  const end = e => {
    if (!dragging) return;
    dragging = false;
    if (!moved) {
      const r = img.getBoundingClientRect();
      kx = clamp((e.clientX - r.left) / r.width, 0, 1);
      ky = clamp((e.clientY - r.top) / r.height, 0, 1);
      probeMap(kx, ky);
    }
  };
  const showKeyboardReticle = () => {
    const r = view.getBoundingClientRect();
    reticle.style.left = (kx * r.width) + 'px';
    reticle.style.top = (ky * r.height) + 'px';
    reticle.style.opacity = '.95';
    readout.textContent = `Probe position · X ${kx.toFixed(2)} / Y ${ky.toFixed(2)} · arrows + Enter`;
  };
  view.addEventListener('focus', showKeyboardReticle);
  view.addEventListener('keydown', e => {
    const step = e.shiftKey ? 0.01 : 0.025;
    if (e.key === 'ArrowUp') ky = clamp(ky - step, 0, 1);
    else if (e.key === 'ArrowDown') ky = clamp(ky + step, 0, 1);
    else if (e.key === 'ArrowLeft') kx = clamp(kx - step, 0, 1);
    else if (e.key === 'ArrowRight') kx = clamp(kx + step, 0, 1);
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); probeMap(kx, ky); return; }
    else if (e.key === 'Home') { kx = ky = 0.5; }
    else return;
    e.preventDefault();
    showKeyboardReticle();
  });
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', () => { dragging = false; });
  view.addEventListener('pointerleave', () => { reticle.style.opacity = '0'; });
  view.addEventListener('pointerenter', () => { reticle.style.opacity = ''; });
  apply();
  mapCtrl = { reset: apply };
}

function setSteps(states) {
  $$('#stage .stepbar .st').forEach((el, i) => {
    el.classList.toggle('ok', states[i] === 1);
    el.classList.toggle('now', states[i] === 2);
    const icon = $('i', el);
    if (icon) icon.textContent = states[i] === 1 ? '✓' : String(i + 1);
  });
}

function mapLog(msg, cls) {
  const log = $('#mapLog');
  if (!log) return;
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.textContent = msg;
  log.prepend(p);
  while (log.children.length > 4) log.lastElementChild.remove();
}

function probeMap(nx, ny) {
  if (!runtime || runtime.i !== 0 || !Number.isFinite(nx) || !Number.isFinite(ny)) return;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
  runtime.m1.probes++;
  const hit = MAP_ZONES.find(z => !runtime.m1.found.has(z.key) &&
    Math.hypot((nx - z.x) / z.r, (ny - z.y) / (z.r * 1.1)) <= 1);

  if (hit) {
    runtime.m1.found.add(hit.key);
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = (hit.x * 100) + '%';
    marker.style.top = (hit.y * 100) + '%';
    marker.innerHTML = `<b>${hit.name}</b>`;
    const layer = $('#mapLayer');
    if (layer) layer.appendChild(marker);
    mapLog(`Signal confirmed at X ${nx.toFixed(2)} / Y ${ny.toFixed(2)} — ${hit.name.toLowerCase()}.`, 'good');
    ping(920, 0.14, 'sine', 0.04);
    addXP(25);
    updateM1Tasks();
    return;
  }

  if (runtime.m1.found.size < 2) {
    const noise = MAP_NOISE.find(z => Math.hypot(nx - z.x, ny - z.y) < 0.055);
    if (noise) {
      mapLog(`Probe ${runtime.m1.probes}: yellow/red speckle near ${noise.label.toLowerCase()}. NASA flags this as likely residual noise.`, 'warn');
      ping(300, 0.1, 'triangle', 0.025);
      return;
    }
    mapLog(`Probe ${runtime.m1.probes}: no strong signal at X ${nx.toFixed(2)} / Y ${ny.toFixed(2)}. Keep searching the dark-blue masses.`);
    ping(420, 0.07, 'sine', 0.02);
  } else {
    mapLog(`Probe ${runtime.m1.probes}: outside the two confirmed clusters.`);
  }
}

function updateM1Tasks() {
  const found = runtime.m1.found;
  const north = $('#m1tasks li[data-t="north"]'), central = $('#m1tasks li[data-t="central"]');
  if (north) { north.classList.toggle('ok', found.has('north')); const i = $('i', north); if (i) i.textContent = found.has('north') ? '✓' : ''; }
  if (central) { central.classList.toggle('ok', found.has('central')); const i = $('i', central); if (i) i.textContent = found.has('central') ? '✓' : ''; }
  const count = $('#m1count');
  if (count) count.textContent = `${found.size} / 2`;
  if (found.size === 2) {
    setSteps([1, 2, 0]);
    showM1Question(1);
  } else if (found.size === 1) {
    setSteps([2, 0, 0]);
  }
}

function showM1Question(n) {
  const host = $('#m1q');
  if (!host) return;
  if (n === 1) {
    mountQuestion(host, {
      label: 'Interpretation · 1 of 2',
      q: 'The two dark-blue masses mark areas of strong subsidence. What does this published map actually establish?',
      options: [
        { t: 'Those areas were sinking faster than 2 cm per month during the observation window.', why: '' },
        { t: 'Every building above those areas is structurally unsafe.', why: 'The product shows surface displacement, not structural condition. Safety needs engineering inspection.' },
        { t: 'Groundwater pumping has been measured as the cause.', why: 'The map measures motion. The pumping link is a geological inference, not a measurement in this figure.' },
        { t: 'The ground in those areas rose by 2 cm per month.', why: 'Read the sign: these are subsidence — downward motion — not uplift.' }
      ],
      correct: 0,
      explain: 'This is an observation: line-of-sight displacement over 25 Oct 2025 – 17 Jan 2026, with dark blue reporting more than 2 cm/month of sinking. Cause and building safety are separate questions.',
      onSolved: () => { setSteps([1, 1, 2]); showM1Question(2); }
    });
  } else {
    mountQuestion(host, {
      label: 'Uncertainty · 2 of 2',
      q: 'Yellow and red patches are scattered across the same map. What is the defensible reading?',
      options: [
        { t: 'They are likely residual noise in a preliminary product and should not be read as ground motion.', why: '' },
        { t: 'They show even faster subsidence than the dark-blue areas.', why: 'NASA describes these patches as likely residual noise, not a stronger deformation signal.' },
        { t: 'They prove the entire map is unusable.', why: 'Localised noise does not invalidate the whole product; it limits interpretation of those specific patches.' },
        { t: 'They can be averaged into the blue zones to make the map cleaner.', why: 'Smoothing noise into a signal would manufacture certainty the data does not support.' }
      ],
      correct: 0,
      explain: 'Uncertainty is part of the evidence. Treat flagged patches as unreliable, keep the confirmed clusters, and state the limit in your report.',
      onSolved: () => {
        setSteps([1, 1, 1]);
        closeMissionM1();
      }
    });
  }
}

function closeMissionM1() {
  const panel = $('.fieldpanel');
  if (!panel) return;
  missionComplete(0, 100);
  panel.innerHTML = `<div class="fp-head"><span>Mission closed</span><b>01 / 04</b></div>
    <div class="qbox"><div class="qnum">Finding logged</div>
    <p class="qtext">Two clusters of strong subsidence confirmed, and the map’s noise flags read correctly.</p>
    <div class="feedback show good"><b>Observation vs inference</b>You have a measured pattern, not a proven cause. The next mission shows how the radar obtained that measurement.</div>
    <div class="fp-foot"><button class="btn primary" id="m1next" type="button">Decode the radar →</button></div></div>`;
  const next = $('#m1next');
  if (next) next.addEventListener('click', () => openMission(1));
}

/* ══════════ mission 02 · decode the radar ══════════ */
const PASSES = [
  { d: '25 Oct 2025', tag: 'Acquisition A', note: 'First radar pass · reference phase recorded' },
  { d: '05 Dec 2025', tag: 'Acquisition B', note: '41 days later · phase compared with A' },
  { d: '17 Jan 2026', tag: 'Acquisition C', note: 'Final pass · closes the published window' }
];
let insarRAF = 0, insarT = 0, insarPass = 0, insarSeen = new Set();

function stopInSAR() { if (insarRAF) cancelAnimationFrame(insarRAF); insarRAF = 0; }

function renderM2() {
  clearStage();
  insarPass = 0;
  insarSeen = new Set([0]);
  const stage = $('#stage');
  stage.innerHTML = `<div class="mission">${missionHead(2, 'Decode the radar',
    'The map is not a photograph. NISAR sends microwave pulses and records their phase. Compare acquisitions from different dates and the phase difference becomes a ruler for ground motion.',
    'SCHEMATIC ·<br>NOT A NISAR PRODUCT')}
    ${stepBar(['Inspect passes', 'Read phase', 'State the limit'], [0, 0, 0])}
    <div class="explainer">
      <div>
        <div class="insar-stage corner">
          <canvas id="insarCanvas" aria-label="Animated schematic of radar fringes changing between satellite acquisitions. Decorative illustration, not NISAR data."></canvas>
          <div class="insar-cap"><span>Line-of-sight phase difference</span><span id="insarState"><b>Schematic</b> · not measured data</span></div>
        </div>
        <div class="explain-note"><div><b>How to read it</b>Each colour band is one phase cycle. Where bands crowd together, the path length changed quickly. Turning that pattern into centimetres requires processing, a reference and assumptions — which is why this loop is an illustration, not evidence.</div></div>
        <div class="plate">
          <div class="thumb"><span>Evidence</span><img src="PIA26709_figA.png" alt="NASA PIA26709 Figure A, the published Mexico City deformation map."></div>
          <div><h3>The real product</h3><p>The published figure you probed is a processed, wrapped visualisation of surface displacement. The dark-blue clusters are the interpreted signal; the fringe pattern above is a teaching schematic of the phase comparison behind such products.</p>
          <div class="meta"><span>Source <b>NASA PIA26709</b></span><span>Window <b>25 Oct 2025 — 17 Jan 2026</b></span><span>Band <b>L-band SAR</b></span></div></div>
        </div>
      </div>
      <aside class="fieldpanel">
        <div class="fp-head"><span>Acquisition log</span><b id="m2count">1 / 3</b></div>
        <div class="passctl" id="passctl">${PASSES.map((p, i) => `<button type="button" data-p="${i}" class="${i === 0 ? 'on' : ''}">
          <i class="pi">${String.fromCharCode(65 + i)}</i><span><b>${p.d}</b><small>${p.tag}</small></span><span class="chk">${i === 0 ? '✓' : ''}</span></button>`).join('')}</div>
        <div id="m2q"></div>
        <div class="fp-foot"><button class="hintbtn" id="m2hint" type="button">Request a hint</button></div>
        <div id="m2hintbox"></div>
      </aside>
    </div></div>`;
  setupInSAR();
  $$('#passctl button').forEach(b => b.addEventListener('click', () => selectPass(+b.dataset.p)));
  $('#m2hint').addEventListener('click', () => {
    if (runtime.hints++ > 0) return;
    loseCred(3, 'hint used');
    $('#m2hintbox').innerHTML = '<div class="hintbox">Phase is a property of the returning wave. The technique works because the satellite revisits nearly the same geometry and the phase difference tracks a change in range.</div>';
    $('#m2hint').style.display = 'none';
  });
}

function selectPass(i) {
  insarPass = i;
  insarSeen.add(i);
  insarT = 0;
  $$('#passctl button').forEach(b => {
    const on = +b.dataset.p === i;
    b.classList.toggle('on', on);
    const chk = $('.chk', b);
    if (chk) chk.textContent = insarSeen.has(+b.dataset.p) ? '✓' : '';
  });
  const st = $('#insarState');
  if (st) st.innerHTML = `<b>${PASSES[i].tag}</b> · ${PASSES[i].d} · schematic`;
  const count = $('#m2count');
  if (count) count.textContent = `${insarSeen.size} / 3`;
  ping(560 + i * 90, 0.09, 'sine', 0.03);
  if (insarSeen.size === 3 && !$('#m2q .qbox')) {
    setSteps([1, 2, 0]);
    showM2Question(1);
  } else if (insarSeen.size < 3) {
    setSteps([2, 0, 0]);
  }
}

function setupInSAR() {
  stopInSAR();
  const cv = $('#insarCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d', { alpha: false });
  let w = 0, h = 0, insarBuf = null;
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    w = Math.max(240, r.width); h = Math.max(140, r.height);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawInSAR();
  };
  const ro = new ResizeObserver(size);
  ro.observe(cv);
  size();

  let last = 0;
  const loop = ts => {
    if (!last) last = ts;
    const dt = ts - last; last = ts;
    if (S.settings.motion === 'on') insarT += dt * 0.001;
    else insarT = 0.6;
    drawInSAR();
    insarRAF = requestAnimationFrame(loop);
  };
  insarRAF = requestAnimationFrame(loop);

  function drawInSAR() {
    const lw = w, lh = h;
    const gx = lw * 0.30, gy = lh * 0.36, gw = lw * 0.62, gh = lh * 0.56;
    ctx.fillStyle = '#02060b';
    ctx.fillRect(0, 0, lw, lh);
    let g = ctx.createRadialGradient(lw * 0.6, lh * 0.64, 8, lw * 0.6, lh * 0.64, lw * 0.62);
    g.addColorStop(0, 'rgba(22,62,82,.55)'); g.addColorStop(1, 'rgba(2,6,11,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, lw, lh);

    insarBuf = insarBuf || document.createElement('canvas');
    const iw = Math.max(2, Math.round(gw)), ih = Math.max(2, Math.round(gh));
    if (insarBuf.width !== iw || insarBuf.height !== ih) { insarBuf.width = iw; insarBuf.height = ih; }
    const bctx = insarBuf.getContext('2d', { alpha: false });
    const img = bctx.createImageData(iw, ih), d = img.data;
    const t = insarT, ph = insarPass * 1.15;
    for (let y = 0; y < ih; y++) {
      const ny = y / ih;
      for (let x = 0; x < iw; x++) {
        const nx = x / iw;
        const r1 = Math.hypot(nx - 0.53, (ny - 0.42) * 0.92);
        const r2 = Math.hypot(nx - 0.44, (ny - 0.66) * 1.15);
        const wave = Math.cos(r1 * 52 + r2 * 26 + ph + t * 0.32);
        const v = Math.pow(0.5 + 0.5 * wave, 1.35);
        const halo = Math.max(0, 1 - Math.hypot(nx - 0.52, ny - 0.5) * 1.5);
        const k = 0.22 + 0.78 * v;
        const q = k * (0.55 + 0.45 * halo);
        const i = (y * iw + x) * 4;
        d[i]     = 5 + q * 118;
        d[i + 1] = 14 + q * 205;
        d[i + 2] = 26 + q * 200;
        d[i + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);

    ctx.save();
    ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(insarBuf, gx, gy, gw, gh);

    /* phase contour lines */
    ctx.strokeStyle = 'rgba(210,255,255,.09)';
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 9; k++) {
      const rr = (k + 1) / 10;
      ctx.beginPath();
      ctx.ellipse(gx + gw * 0.53, gy + gh * 0.44, gw * rr * 0.9, gh * rr * 0.82, 0.18, 0, 6.283);
      ctx.stroke();
    }

    /* low-coherence speckle, echoed from the published product */
    for (let i = 0; i < 70; i++) {
      const rx = gx + gw * 0.76 + (i * 37.7 % (gw * 0.2));
      const ry = gy + gh * 0.03 + (i * 53.3 % (gh * 0.24));
      ctx.fillStyle = i % 3 ? 'rgba(255,214,64,.5)' : 'rgba(255,92,72,.55)';
      ctx.fillRect(rx, ry, 1.6, 1.6);
    }

    /* scanlines + vignette */
    ctx.fillStyle = 'rgba(2,10,18,.16)';
    for (let y = gy; y < gy + gh; y += 4) ctx.fillRect(gx, y, gw, 1);
    const vig = ctx.createRadialGradient(gx + gw / 2, gy + gh / 2, gw * 0.2, gx + gw / 2, gy + gh / 2, gw * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,4,9,.72)');
    ctx.fillStyle = vig; ctx.fillRect(gx, gy, gw, gh);
    ctx.restore();

    ctx.strokeStyle = 'rgba(120,180,210,.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
    ctx.font = '7.5px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(185,222,236,.6)';
    ctx.fillText('INTERFEROGRAM SCHEMATIC · PHASE DIFFERENCE', gx + 5, gy + 12);
    ctx.fillText('1 CYCLE = HALF WAVELENGTH PATH DIFFERENCE', gx + 5, gy + gh - 7);

    /* satellite + acquisition beam */
    const sx = lw * 0.155, sy = lh * 0.155;
    ctx.strokeStyle = 'rgba(99,226,238,.18)';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(gx + gw * 0.5, gy + gh * 0.46); ctx.stroke();
    ctx.fillStyle = 'rgba(99,226,238,.055)';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(gx + gw * 0.25, gy + gh); ctx.lineTo(gx + gw * 0.92, gy + gh); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.translate(sx, sy);
    ctx.shadowColor = 'rgba(99,226,238,.55)'; ctx.shadowBlur = 9;
    ctx.fillStyle = '#c9e9f2'; ctx.fillRect(-3.5, -5, 7, 10);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2c7b93';
    ctx.fillRect(-18, -2.5, 12, 5); ctx.fillRect(6, -2.5, 12, 5);
    ctx.strokeStyle = 'rgba(140,220,235,.45)'; ctx.lineWidth = 0.7;
    for (const dx of [-18, 6]) { ctx.strokeRect(dx, -2.5, 12, 5); ctx.beginPath(); ctx.moveTo(dx + 4, -2.5); ctx.lineTo(dx + 4, 2.5); ctx.stroke(); }
    ctx.restore();
    ctx.font = '7px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(160,230,240,.7)';
    ctx.fillText('NISAR', sx + 20, sy - 8);

    /* pass marker */
    ctx.fillStyle = 'rgba(231,178,122,.85)';
    ctx.font = '7px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('PASS ' + 'ABC'[insarPass] + ' · ' + PASSES[insarPass].d.toUpperCase(), lw - 11, lh - 10);
    ctx.textAlign = 'left';
  }
}

function showM2Question(n) {
  const host = $('#m2q');
  if (!host) return;
  if (n === 1) {
    mountQuestion(host, {
      label: 'Method · 1 of 2',
      q: 'Two acquisitions are combined into an interferogram. What is actually being compared?',
      options: [
        { t: 'The phase of the radar return from each acquisition.', why: '' },
        { t: 'The visible colour of the ground in two optical photos.', why: 'SAR is not a camera. It records the amplitude and phase of its own microwave echo, not visible colour.' },
        { t: 'A laser rangefinder reading taken from orbit.', why: 'NISAR is radar, not a laser altimeter. Range change is inferred from phase, not a direct laser measurement.' },
        { t: 'The surface temperature on each date.', why: 'Thermal brightness is a different measurement and is not what forms the interferometric fringes.' }
      ],
      correct: 0,
      explain: 'Phase is the position within the returning wave cycle. If the ground moves closer or farther, the round-trip path length changes and the phase shifts. Comparing two phase images produces the fringe pattern.',
      onSolved: () => { setSteps([1, 1, 2]); showM2Question(2); }
    });
  } else {
    mountQuestion(host, {
      label: 'Measurement limit · 2 of 2',
      q: 'The product reports displacement along the radar line of sight. Which statement is honest about that?',
      options: [
        { t: 'It is one component of motion; a single viewing geometry does not give full vertical and horizontal motion.', why: '' },
        { t: 'It gives complete three-dimensional ground motion at every pixel.', why: 'One line of sight cannot resolve three independent components without additional geometries or assumptions.' },
        { t: 'It directly measures how much each building has tilted.', why: 'The product resolves ground surface displacement at a spatial scale, not individual structural tilt.' },
        { t: 'It only works on clear, sunny days.', why: 'Radar provides its own illumination and works day or night, through cloud — that is a core advantage of SAR.' }
      ],
      correct: 0,
      explain: 'Line-of-sight geometry mixes vertical and horizontal motion. Interpreting the map as pure “sinking” is a reasonable approximation here only because the setting and published result support it — and it should still be stated as an inference.',
      onSolved: () => { setSteps([1, 1, 1]); closeMissionM2(); }
    });
  }
}

function closeMissionM2() {
  stopInSAR();
  const panel = $('.fieldpanel');
  if (!panel) return;
  missionComplete(1, 100);
  panel.innerHTML = `<div class="fp-head"><span>Mission closed</span><b>02 / 04</b></div>
    <div class="qbox"><div class="qnum">Method logged</div>
    <p class="qtext">You can now explain how repeat radar passes become a displacement map — and what the method cannot resolve.</p>
    <div class="feedback show good"><b>Key distinction</b>Phase comparison measures change in range. Colour on the published map is an interpreted product, not a raw photograph of the ground.</div>
    <div class="fp-foot"><button class="btn primary" id="m2next" type="button">Triage the patches →</button></div></div>`;
  const next = $('#m2next');
  if (next) next.addEventListener('click', () => openMission(2));
}

/* ══════════ mission 03 · signal or noise ══════════ */
const PATCHES = [
  { id: 'A', x: 0.563, y: 0.305, title: 'Northern dark mass', note: 'A broad, coherent dark-blue area with sharp internal structure against the surrounding cyan.', answer: 'signal' },
  { id: 'B', x: 0.58, y: 0.581, title: 'Central corridor', note: 'A second large, spatially continuous dark-blue zone crossing the urban core.', answer: 'signal' },
  { id: 'C', x: 0.30, y: 0.08, title: 'North-west patch field', note: 'Scattered yellow and red speckle with no coherent shape at the northern edge of the map.', answer: 'noise' },
  { id: 'D', x: 0.86, y: 0.62, title: 'South-east speckle', note: 'Isolated red and yellow flecks near the southern margin, mixed with green background.', answer: 'noise' },
  { id: 'E', x: 0.90, y: 0.50, title: 'Eastern margin', note: 'A faint patch near the edge of the processed area where the signal fades into background.', answer: 'uncertain' }
];
const TRIAGE_OPTS = [
  { k: 'signal', label: 'Signal', hint: 'coherent deformation' },
  { k: 'noise', label: 'Noise', hint: 'likely residual artefact' },
  { k: 'uncertain', label: 'Uncertain', hint: 'not enough to decide' }
];

function renderM3() {
  clearStage();
  runtime.m3.solved = new Set();
  const stage = $('#stage');
  stage.innerHTML = `<div class="mission">${missionHead(3, 'Signal or noise?',
    'Five patches are pulled from the published figure at native resolution. Classify each one using shape, coherence and NASA’s own note that yellow and red areas are likely residual noise. Overclaiming costs credibility.',
    'PATCH CROPS ·<br>FROM PIA26709')}
    ${stepBar(['Classify patches', 'Justify flags', 'Close triage'], [2, 0, 0])}
    <div class="triage-summary" id="m3summary">
      <div><span>Reviewed</span><b id="m3reviewed">0 / 5</b></div>
      <div><span>Agreement</span><b id="m3agree">—</b></div>
      <div><span>Credibility</span><b id="m3cred">${S.cred}%</b></div>
      <div><span>Status</span><b id="m3status">Open</b></div>
    </div>
    <div class="triage" id="triage"></div>
    <div class="explain-note"><div><b>Rule of the exercise</b>Label a patch “signal” only when the pattern is spatially coherent and consistent with the published subsidence interpretation. Label “noise” when NASA’s own description applies. If the crop genuinely cannot support a call, say uncertain — that is a scientific answer, not a failure.</div></div>
    <div class="fp-foot" style="margin-top:16px"><button class="hintbtn" id="m3hint" type="button">Request a hint</button></div>
    <div id="m3hintbox"></div>
    </div>`;
  const host = $('#triage');
  host.innerHTML = PATCHES.map(p => `<div class="patchrow" data-p="${p.id}">
    <div class="patchthumb" style="--cx:${p.x};--cy:${p.y}"><span class="pid">PATCH ${p.id}</span>
      <img src="PIA26709_figA.png" alt="Cropped region ${p.id} of the NASA deformation map.">
    </div>
    <div class="patchmeta"><h3>${p.title}</h3><p class="pnote">${p.note}</p><div class="pstate" data-state>Unclassified</div></div>
    <div class="triageopts">${TRIAGE_OPTS.map(o => `<button class="topt" type="button" data-k="${o.k}"><i></i><span>${o.label} <small style="opacity:.6">· ${o.hint}</small></span></button>`).join('')}</div>
  </div>`).join('');

  $$('#triage .patchrow').forEach(row => {
    const patch = PATCHES.find(p => p.id === row.dataset.p);
    $$('.topt', row).forEach(btn => btn.addEventListener('click', () => classifyPatch(patch, btn, row)));
  });
  $('#m3hint').addEventListener('click', () => {
    if (runtime.hints++ > 0) return;
    loseCred(3, 'hint used');
    $('#m3hintbox').innerHTML = '<div class="hintbox">Coherent, large dark-blue masses are the published signal. Yellow/red speckle is likely residual noise. A faint marginal patch that could be either is a legitimate “uncertain”.</div>';
    $('#m3hint').style.display = 'none';
  });
  updateTriageSummary();
}

function classifyPatch(patch, btn, row) {
  if (runtime.m3.solved.has(patch.id)) return;
  const state = $('[data-state]', row);
  if (btn.dataset.k === patch.answer) {
    runtime.m3.solved.add(patch.id);
    row.classList.add('solved');
    $$('.topt', row).forEach(b => { b.disabled = true; if (b === btn) b.classList.add('ok'); });
    if (state) {
      state.className = 'pstate ok';
      state.textContent = patch.answer === 'signal' ? 'Confirmed · coherent deformation signal'
        : patch.answer === 'noise' ? 'Confirmed · likely residual noise'
        : 'Accepted · unresolved at this resolution';
    }
    addXP(20);
    ping(820, 0.1, 'sine', 0.03);
    updateTriageSummary();
    if (runtime.m3.solved.size === 5) {
      setSteps([1, 2, 0]);
      const host = document.createElement('div');
      host.id = 'm3q';
      host.style.marginTop = '20px';
      $('#triage').after(host);
      showM3Question();
      host.scrollIntoView({ behavior: S.settings.motion === 'on' ? 'smooth' : 'auto', block: 'nearest' });
    }
  } else {
    btn.classList.add('bad');
    btn.disabled = true;
    if (state) { state.className = 'pstate no'; state.textContent = 'That label is not supported · re-read the patch'; }
    loseCred(4, 'unsupported patch label');
    ping(250, 0.1, 'triangle', 0.03);
  }
}

function updateTriageSummary() {
  const n = runtime.m3.solved.size;
  const rev = $('#m3reviewed'), agr = $('#m3agree'), cred = $('#m3cred'), status = $('#m3status');
  if (rev) rev.textContent = `${n} / 5`;
  if (agr) agr.textContent = n ? Math.round(n / 5 * 100) + '%' : '—';
  if (cred) cred.textContent = S.cred + '%';
  if (status) { status.textContent = n === 5 ? 'Verified' : n ? 'In progress' : 'Open'; status.style.color = n === 5 ? 'var(--green)' : ''; }
}

function showM3Question() {
  const host = $('#m3q');
  if (!host) return;
  mountQuestion(host, {
    label: 'Why the flags stay visible',
    q: 'The published product keeps yellow and red noise patches visible instead of painting over them. Why does that matter for an investigator?',
    options: [
      { t: 'It shows where values are unreliable, so interpretation can stay honest.', why: '' },
      { t: 'It makes the map look more dramatic for public outreach.', why: 'Visual drama is not a scientific rationale; the flags encode reliability.' },
      { t: 'The noise is actually a second, faster subsidence signal.', why: 'NASA describes these patches as likely residual noise — not as additional deformation.' },
      { t: 'It proves the satellite sensor failed during the observation window.', why: 'Localised noise is expected in a preliminary product; it does not mean the mission or the whole map failed.' }
    ],
    correct: 0,
    explain: 'Uncertainty is information. The flags tell you which pixels to trust, which to set aside, and where to say “not enough evidence” — exactly the discipline this case rewards.',
    onSolved: () => { setSteps([1, 1, 1]); closeMissionM3(); }
  });
}

function closeMissionM3() {
  missionComplete(2, 100);
  const host = $('#m3q');
  if (!host) return;
  host.innerHTML = `<div class="qbox"><div class="qnum">Triage closed · finding logged</div>
    <p class="qtext">Five patches classified, two confirmed signals, two likely noise fields, one honestly unresolved.</p>
    <div class="feedback show good"><b>Credibility check</b>Restraint is part of the result. The final mission asks what physical process could produce the pattern you confirmed.</div>
    <div class="fp-foot"><button class="btn primary" id="m3next" type="button">Solve the mystery →</button></div></div>`;
  const next = $('#m3next');
  if (next) next.addEventListener('click', () => openMission(3));
}

/* ══════════ mission 04 · solve the mystery ══════════ */
const CHAIN_NODES = [
  { id: 'pump', t: 'Groundwater is pumped from the aquifer beneath the city.' },
  { id: 'pore', t: 'Pore pressure in the clay-rich sediments falls.' },
  { id: 'compact', t: 'The sediments compact and the surface sinks.' },
  { id: 'uneven', t: 'The former lakebed subsides unevenly across the city.' },
  { id: 'strain', t: 'Infrastructure is strained where the ground drops differentially.' },
  { id: 'radar', t: 'Radar pulses physically push the ground downward.' },
  { id: 'rock', t: 'The city rests on rigid volcanic rock that cannot compact.' },
  { id: 'rain', t: 'Seasonal rainfall alone explains the dark-blue pattern.' }
];
const CHAIN_ORDER = ['pump', 'pore', 'compact', 'uneven', 'strain'];

function renderM4() {
  clearStage();
  runtime.m4.slots = [null, null, null, null, null];
  runtime.m4.validated = false;
  runtime.m4.bankOrder = CHAIN_NODES.map(n => n.id);
  for (let k = runtime.m4.bankOrder.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [runtime.m4.bankOrder[k], runtime.m4.bankOrder[j]] = [runtime.m4.bankOrder[j], runtime.m4.bankOrder[k]];
  }
  const stage = $('#stage');
  stage.innerHTML = `<div class="mission">${missionHead(4, 'Solve the mystery',
    'The map gives you the pattern. Geology, water use and published context give you the mechanism. Build a causal chain that separates what was measured from what is inferred — then answer for its limits.',
    'CASE SYNTHESIS ·<br>GS-001')}
    ${stepBar(['Build the chain', 'Test the reasoning', 'Close the case'], [2, 0, 0])}
    <div class="chain-wrap">
      <div>
        <div class="chain-label"><span>Proposed mechanism · drag-free ordering</span><b id="m4progress">0 / 5</b></div>
        <div class="chain" id="m4chain"></div>
        <div class="chain-label" style="margin-top:16px"><span>Evidence nodes · click to place</span><span>${CHAIN_NODES.length} available</span></div>
        <div class="bank" id="m4bank"></div>
        <div class="fp-foot" style="margin-top:14px">
          <button class="btn primary" id="m4validate" type="button" disabled>Validate chain</button>
          <button class="hintbtn" id="m4hint" type="button">Request a hint</button>
        </div>
        <div id="m4hintbox"></div>
        <div id="m4q"></div>
      </div>
      <aside class="chain-side">
        <div class="chain-label"><span>Evidence on file</span><span>Case GS-001</span></div>
        <div class="obs"><b>Observed</b>Dark-blue clusters in NASA’s published product report subsidence of more than 2 cm per month between 25 Oct 2025 and 17 Jan 2026. Yellow/red areas are likely residual noise.</div>
        <div class="obs"><b>Context · published</b>Mexico City is built on a former lakebed with clay-rich sediments and draws much of its water from the underlying aquifer. Long-term subsidence has been documented by generations of ground and space measurements.</div>
        <div class="obs"><b>Inference</b>Groundwater extraction lowering pore pressure, followed by sediment compaction, is the leading <em>explanation</em> for the observed sinking. The map alone does not prove it pixel by pixel.</div>
        <div class="distinguish">
          <div><span>Observation</span><p>Surface displacement measured over a stated window, with known uncertainty and noise flags.</p></div>
          <div><span>Inference</span><p>A proposed mechanism that fits the observation, regional geology and water-use history — and remains open to revision.</p></div>
        </div>
      </aside>
    </div></div>`;
  renderChain();
  $('#m4validate').addEventListener('click', validateChain);
  $('#m4hint').addEventListener('click', () => {
    if (runtime.hints++ > 0) return;
    loseCred(3, 'hint used');
    $('#m4hintbox').innerHTML = '<div class="hintbox">Start with the human action, then the physical change in the aquifer, then the ground response. Ask what the radar could and could not cause.</div>';
    $('#m4hint').style.display = 'none';
  });
}

function renderChain() {
  const chain = $('#m4chain'), bank = $('#m4bank');
  if (!chain || !bank) return;
  const slots = runtime.m4.slots;
  chain.innerHTML = slots.map((id, i) => {
    const node = CHAIN_NODES.find(n => n.id === id);
    return `<button class="slot${node ? ' filled' : ''}" data-slot="${i}" type="button" ${runtime.m4.validated ? 'disabled' : ''}>
      <span class="sl">${i + 1}</span><span>${node ? node.t : 'Select the next step in the mechanism…'}</span></button>`;
  }).join('');
  bank.innerHTML = (runtime.m4.bankOrder || CHAIN_NODES.map(n => n.id)).map(id => CHAIN_NODES.find(n => n.id === id)).map(n => `<button class="nodebtn${slots.includes(n.id) ? ' used' : ''}" data-node="${n.id}" type="button" ${slots.includes(n.id) || runtime.m4.validated ? 'disabled' : ''}>${n.t}</button>`).join('');
  const filled = slots.filter(Boolean).length;
  const prog = $('#m4progress');
  if (prog) prog.textContent = `${filled} / 5`;
  const val = $('#m4validate');
  if (val) val.disabled = filled < 5 || runtime.m4.validated;

  $$('#m4chain .slot').forEach(b => b.addEventListener('click', () => {
    if (runtime.m4.validated) return;
    const i = +b.dataset.slot;
    if (runtime.m4.slots[i]) { runtime.m4.slots[i] = null; renderChain(); }
  }));
  $$('#m4bank .nodebtn').forEach(b => b.addEventListener('click', () => {
    if (runtime.m4.validated) return;
    const i = runtime.m4.slots.indexOf(null);
    if (i === -1) { toast('All five steps are filled · click a step to remove it'); return; }
    runtime.m4.slots[i] = b.dataset.node;
    ping(500 + i * 60, 0.06, 'sine', 0.025);
    renderChain();
  }));
}

function validateChain() {
  if (runtime.m4.validated) return;
  const slots = runtime.m4.slots;
  const bad = [];
  slots.forEach((id, i) => { if (id !== CHAIN_ORDER[i]) bad.push(i); });
  if (bad.length) {
    $$('#m4chain .slot').forEach((el, i) => { if (bad.includes(i)) el.classList.add('wrong'); });
    loseCred(6, 'causal chain does not hold');
    toast('<b>Chain rejected</b> · check the order of cause and effect');
    ping(230, 0.16, 'triangle', 0.035);
    setTimeout(() => { $$('#m4chain .slot.wrong').forEach(el => el.classList.remove('wrong')); }, 1400);
    return;
  }
  runtime.m4.validated = true;
  renderChain();
  setSteps([1, 2, 0]);
  addXP(50);
  ping(680, 0.12, 'sine', 0.04);
  setTimeout(() => ping(1010, 0.25, 'sine', 0.035), 130);
  showM4Question(1);
}

function showM4Question(n) {
  const host = $('#m4q');
  if (!host) return;
  if (n === 1) {
    mountQuestion(host, {
      label: 'Reasoning check · 1 of 2',
      q: 'Which sentence keeps observation and inference in their proper places?',
      options: [
        { t: 'The radar product shows the ground sinking; groundwater extraction is the leading published explanation for why.', why: '' },
        { t: 'The radar product proves pumping caused the sinking at every pixel.', why: 'The map measures motion. Attribution to pumping draws on geology and water-use context, not on the displacement image alone.' },
        { t: 'Because the cause is known, the map certifies which buildings are safe.', why: 'Structural safety is outside what a regional displacement product can establish.' },
        { t: 'Subsidence of this kind cannot have a human cause.', why: 'The published context points to groundwater extraction and sediment compaction — a human-linked mechanism.' }
      ],
      correct: 0,
      explain: 'Observation: measured displacement over a stated window. Inference: the mechanism that best fits that pattern plus regional geology. Good reports label both.',
      onSolved: () => { setSteps([1, 1, 2]); showM4Question(2); }
    });
  } else {
    mountQuestion(host, {
      label: 'Limits · 2 of 2',
      q: 'A resident asks: “Does this map mean my building is safe?” What is the accurate answer?',
      options: [
        { t: 'The map shows surface motion over a period; structural safety needs an engineering inspection.', why: '' },
        { t: 'Yes — if the building is outside a dark-blue area, it is certified safe.', why: 'Absence of a strong signal is not a safety certification; many factors affect a structure.' },
        { t: 'No — every building in the city must be evacuated.', why: 'The product does not support that conclusion, and it is not an emergency directive.' },
        { t: 'The map is a live monitor, so the resident should check it every day.', why: 'This is an archived result for a fixed window, not a live monitoring service.' }
      ],
      correct: 0,
      explain: 'The honest answer states what the evidence covers and what it does not. That limitation is part of the finding, not a weakness in your investigation.',
      onSolved: () => { setSteps([1, 1, 1]); closeMissionM4(); }
    });
  }
}

function closeMissionM4() {
  missionComplete(3, 100);
  const host = $('#m4q');
  if (!host) return;
  host.innerHTML = `<div class="qbox"><div class="qnum">Case synthesis closed</div>
    <p class="qtext">Mechanism built, reasoning tested, limits stated. The investigation is ready to report.</p>
    <div class="feedback show good"><b>Case GS-001</b>Your report will combine the confirmed deformation pattern, the radar method, the noise assessment and the inferred mechanism.</div>
    <div class="fp-foot"><button class="btn primary" id="m4report" type="button">Open final report →</button></div></div>`;
  const btn = $('#m4report');
  if (btn) btn.addEventListener('click', () => { renderReport(); showScreen('report'); });
}

/* ══════════ NOVA · curated knowledge base ══════════ */
const NOVA_KB = [
  { keys: ['subsid', 'sink', 'rate', '2 cm', '2cm', 'fast', 'how much', 'movement'],
    a: 'NASA’s published figure reports areas of Mexico City sinking by <b>more than 2 cm per month</b> during 25 October 2025 to 17 January 2026. That is the figure’s statement for those areas — not an average for the whole city, and not a live reading.',
    src: 'NASA PIA26709 · observation window' },
  { keys: ['colour', 'color', 'blue', 'yellow', 'red', 'cyan', 'green', 'legend', 'map mean'],
    a: 'Dark blue marks the areas the published product reports as sinking more than 2 cm/month. Cyan/green shows little or no change at this scale. Yellow and red speckle is described by NASA as <b>likely residual noise</b> in this preliminary product — not stronger subsidence.',
    src: 'NASA PIA26709 · figure legend' },
  { keys: ['noise', 'artefact', 'artifact', 'uncertain', 'error', 'reliable', 'trust'],
    a: 'Residual noise is signal left after processing that is not a dependable ground-motion measurement. NASA flags the yellow/red patches this way. The right response is to exclude those patches from conclusions, not to discard the entire map or relabel them as signal.',
    src: 'NASA PIA26709 · preliminary product note' },
  { keys: ['insar', 'phase', 'interferogram', 'fringe', 'wavelength', 'radar work', 'how does'],
    a: 'InSAR compares the <b>phase</b> of radar returns from repeat passes. A change in the satellite–ground distance shifts the phase; combining two acquisitions produces fringes. One full fringe cycle corresponds to half the radar wavelength of path difference — about 12 cm for NISAR’s L-band — before processing converts phase to displacement.',
    src: 'InSAR method · general explanation' },
  { keys: ['nisar', 'satellite', 'l-band', 'nasa', 'isro', 'sensor'],
    a: 'NISAR is the NASA–ISRO Synthetic Aperture Radar mission. Its L-band radar (about 24 cm wavelength) observes day or night and through cloud, and is designed to map subtle surface deformation. This case uses one published NISAR-derived figure, not a live data feed.',
    src: 'Mission context · NASA–ISRO NISAR' },
  { keys: ['groundwater', 'pump', 'aquifer', 'water', 'cause', 'why', 'compaction', 'clay'],
    a: 'The leading published explanation is groundwater extraction: pumping lowers pore pressure in the clay-rich former-lakebed sediments, which then compact and the surface sinks. That mechanism <b>explains</b> the observed pattern — the displacement map itself measures motion, not the pumping.',
    src: 'Published geology/context · inference' },
  { keys: ['safe', 'building', 'structural', 'evacuat', 'collapse', 'damage'],
    a: 'This product cannot certify a building as safe or unsafe. It shows regional surface displacement over a fixed window; structural condition depends on foundations, construction and local ground, and needs an engineering inspection. The game will never tell you a specific building is safe.',
    src: 'Measurement limits · not a safety map' },
  { keys: ['live', 'real time', 'realtime', 'current', 'today', 'update', 'feed'],
    a: 'No. The evidence is an archived published result for 25 Oct 2025 – 17 Jan 2026. GROUND SHIFT has no backend, no live feed and no connection to NISAR operations. Treat every date and value as part of that fixed case file.',
    src: 'Case file · archived evidence' },
  { keys: ['raw', 'process', 'algorithm', 'your own', 'calculate', 'data analys'],
    a: 'No raw-data processing happens here. The game displays NASA’s published, processed visualisation and asks you to interpret it. Any statement about metres of motion beyond the published “more than 2 cm/month” would be invented, so NOVA will not produce one.',
    src: 'Scope · published product only' },
  { keys: ['los', 'line of sight', 'vertical', 'horizontal', '3d', 'component'],
    a: 'Interferometry measures displacement along the radar <b>line of sight</b> — a mix of vertical and horizontal motion set by viewing geometry. One geometry cannot separate all three components. Describing the blue areas as “sinking” is an interpretation supported by the setting, not a raw three-dimensional measurement.',
    src: 'InSAR geometry · general explanation' },
  { keys: ['lakebed', 'lake', 'geology', 'soil', 'mexico city', 'city'],
    a: 'Mexico City sits on a former lakebed with soft, clay-rich sediments. That geology makes the ground prone to compaction when water is removed, and helps explain why subsidence is uneven across the urban area. The map shows the modern pattern; the geology is context.',
    src: 'Published context · former lakebed' },
  { keys: ['hint', 'help', 'stuck', 'next', 'what do i'],
    a: 'Check the current mission’s task list first. Mission 1: probe the two large dark-blue masses. Mission 2: view all three acquisition passes. Mission 3: judge coherence, not colour alone. Mission 4: order cause before effect, then answer the reasoning checks.',
    src: 'Case guidance · not evidence' },
  { keys: ['ai', 'model', 'chatgpt', 'generative', 'llm', 'are you real'],
    a: 'NOVA is a curated, source-grounded knowledge base written for this case — not a live generative AI model, and it makes no external API calls. It matches your question to prepared answers limited to the NASA source and general InSAR education. That disclosure is also in Settings.',
    src: 'Disclosure · curated companion' },
  { keys: ['credib', 'score', 'xp', 'rank', 'grade'],
    a: 'Credibility starts at 100% and falls when you choose an unsupported reading or take a hint. XP rewards correct reasoning, including first-try answers. The final report ranks the investigation on both — a clean, restrained case scores better than a lucky one.',
    src: 'Game mechanics · not scientific evidence' }
];
const NOVA_FALLBACK = 'I can only answer from this case file: the NASA PIA26709 subsidence figure, the 25 Oct 2025 – 17 Jan 2026 window, InSAR basics and the groundwater/compaction context. Try asking about the colours, noise, phase, NISAR, the cause, or the limits of the map.';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function novaInit() {
  const chips = $('#novaChips');
  if (chips) {
    chips.innerHTML = ['What do the colours mean?', 'What is InSAR?', 'Is this map live?', 'Can it tell if a building is safe?'].map(q => `<button type="button">${q}</button>`).join('');
    $$('button', chips).forEach(b => b.addEventListener('click', () => novaAsk(b.textContent)));
  }
  const send = $('#novaSend'), input = $('#novaInput');
  if (send) send.addEventListener('click', () => { if (input) novaAsk(input.value); });
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); novaAsk(input.value); } });
  const close = $('#novaClose');
  if (close) close.addEventListener('click', closeNova);
  const toggle = $('#novaToggle');
  if (toggle) toggle.addEventListener('click', () => {
    const p = $('#novaPanel');
    if (!p) return;
    const open = p.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

function novaPush(who, html, src) {
  const log = $('#novaLog');
  if (!log) return;
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.innerHTML = `<div class="who">${who === 'user' ? 'Investigator' : 'NOVA'}</div><p>${html}</p>` + (src ? `<span class="src">${src}</span>` : '');
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

function novaAsk(text) {
  const q = String(text || '').trim();
  if (!q) return;
  const input = $('#novaInput');
  if (input) input.value = '';
  novaPush('user', esc(q).slice(0, 220));
  const t = q.toLowerCase();
  let best = null, bestScore = 0;
  for (const e of NOVA_KB) {
    let score = 0;
    for (const k of e.keys) if (t.includes(k)) score += k.length > 4 ? 2 : 1;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  setTimeout(() => {
    if (best) novaPush('nova', best.a, best.src);
    else novaPush('nova', NOVA_FALLBACK, 'No matching entry · nothing invented');
    ping(720, 0.1, 'sine', 0.025);
  }, 260);
}

function openNovaContext() {
  const log = $('#novaLog');
  if (log && !log.children.length) {
    const intro = currentMission === 0
      ? 'Case file open. Ask me about the colours, the noise flags, or what the map can and cannot prove.'
      : MISSION_META[currentMission].title + ' is in progress. Ask about the method or the evidence — I will not invent numbers.';
    novaPush('nova', intro, 'Case GS-001 · curated briefing');
  }
  if (log) log.scrollTop = log.scrollHeight;
}

function closeNova() {
  const p = $('#novaPanel');
  if (p) p.classList.remove('open');
  const toggle = $('#novaToggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}
function openNovaPanel() {
  const p = $('#novaPanel');
  if (p) p.classList.add('open');
  const toggle = $('#novaToggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
  const input = $('#novaInput');
  if (input && window.innerWidth > 860) input.focus({ preventScroll: true });
}

/* ══════════ final report ══════════ */
function reportRank(xp) {
  if (xp >= 850) return 'Lead investigator';
  if (xp >= 700) return 'Field analyst';
  if (xp >= 500) return 'Research assistant';
  return 'Trainee investigator';
}

function renderReport() {
  const host = $('#reportBody');
  if (!host) return;
  const reviewed = Math.round(S.done.length / 4 * 100);
  const all = S.done.length === 4;
  const rank = reportRank(S.xp);
  const verdict = S.cred >= 90
    ? 'Mexico City’s ground is moving, the published radar product localises the strongest sinking, and the evidence supports a clear but carefully bounded explanation.'
    : S.cred >= 70
      ? 'The subsidence pattern is confirmed; some readings overreached, but the final account keeps observation and inference mostly separate.'
      : 'A signal was found, yet the investigation accepted claims the evidence does not support. The mechanism is plausible; the confidence should be lower.';
  host.innerHTML = `<div class="report-top">
      <div class="brand"><span class="brand-mark" aria-hidden="true"></span><div><div class="brand-word">Ground Shift</div><div class="brand-sub">Earth Observation Division · Case GS-001</div></div></div>
      <div class="report-date">Final report<br>${all ? 'Case closed' : 'Case incomplete'} · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br>Evidence window 25 Oct 2025 — 17 Jan 2026</div>
    </div>
    <h1>${all ? 'The sinking city, explained within limits' : 'Investigation in progress'}</h1>
    <p class="verdict">${verdict}</p>
    <div class="rankbox">
      <div><div class="rl">Investigator classification</div><div class="rank">${rank}</div></div>
      <div class="seal">GS-001<br>${all ? 'Case closed' : 'Open'}<br>${new Date().getFullYear()}</div>
    </div>
    <div class="statgrid">
      <div><span>Science XP</span><b>${S.xp}</b></div>
      <div><span>Credibility</span><b>${S.cred}<small>%</small></b></div>
      <div><span>Missions closed</span><b>${S.done.length}<small>/4</small></b></div>
      <div><span>Evidence reviewed</span><b>${all ? 'Full' : reviewed + '%'}</b></div>
    </div>
    <div class="findings">
      <div class="finding"><span class="fn">01</span><div><b>Observation</b><p>NASA’s published NISAR-derived figure shows two large, coherent dark-blue clusters in Mexico City reporting subsidence of more than 2 cm per month between 25 October 2025 and 17 January 2026. Yellow and red patches are flagged as likely residual noise and were excluded from the finding.</p></div></div>
      <div class="finding"><span class="fn">02</span><div><b>Method</b><p>The pattern comes from repeat-pass radar interferometry: comparing the phase of radar returns measures change in range along the satellite’s line of sight. One viewing geometry gives a component of motion, not a full three-dimensional solution.</p></div></div>
      <div class="finding"><span class="fn">03</span><div><b>Uncertainty</b><p>The product is preliminary and spatially variable. Noise patches, processing assumptions and line-of-sight geometry limit what any single pixel can support. Restraint — including “uncertain” where the crop cannot decide — improves the credibility of the account.</p></div></div>
      <div class="finding"><span class="fn">04</span><div><b>Inference</b><p>The leading published explanation is groundwater extraction from the aquifer beneath the former lakebed. Falling pore pressure allows clay-rich sediments to compact, producing uneven subsidence that strains infrastructure. This is a mechanism consistent with the observation, not something the displacement map proves pixel by pixel.</p></div></div>
    </div>
    <div class="report-caveat"><b>Scope and limits</b>
      This is an educational interpretation of one published NASA figure. It is not raw NISAR processing, not a live monitoring service, and not a structural-safety assessment. No building can be certified safe or unsafe from this map. NOVA is a curated, source-grounded companion, not a live generative AI model. Source: NASA Science Photojournal, “US-Indian Spacecraft Captures Mexico City Subsidence”, PIA26709 Figure A.
    </div>
    <div class="report-actions">
      <button class="btn primary" id="repPrint" type="button">Print / save PDF</button>
      <button class="btn" id="repArchive" type="button">Mission archive</button>
      <button class="btn" id="repMenu" type="button">Return to menu</button>
    </div>`;
  const p = $('#repPrint'); if (p) p.addEventListener('click', () => window.print());
  const a = $('#repArchive'); if (a) a.addEventListener('click', () => { renderArchive(); showScreen('archive'); });
  const m = $('#repMenu'); if (m) m.addEventListener('click', backToMenu);
}

/* ══════════ settings + boot ══════════ */
function bindSettings() {
  $$('#setMotion span').forEach(sp => sp.addEventListener('click', () => {
    S.settings.motion = sp.dataset.v;
    saveState(); applySettings();
    if (S.settings.motion === 'off') { stopStars(); stopGlobe(); }
    else { startStars(); if (screenNow === 'menu') startGlobe(); }
    if (screenNow === 'game') renderMission();
    toast(`<b>Motion</b> · ${sp.dataset.v === 'on' ? 'full animation' : 'reduced'}`);
  }));
  $$('#setSound span').forEach(sp => sp.addEventListener('click', () => {
    S.settings.sound = sp.dataset.v;
    saveState(); applySettings();
    if (S.settings.sound === 'on') ping(720, 0.14, 'sine', 0.035);
    toast(`<b>Sound</b> · ${S.settings.sound === 'on' ? 'on' : 'off'}`);
  }));
  $$('#setText span').forEach(sp => sp.addEventListener('click', () => {
    S.settings.text = sp.dataset.v;
    saveState(); applySettings();
    toast('<b>Text size</b> · preference saved');
  }));
  const reset = $('#setReset');
  if (reset) reset.addEventListener('click', () => {
    if (!window.confirm('Reset the entire case? XP, credibility, mission progress and NOVA memory will be cleared. This cannot be undone.')) return;
    S = DEFAULT_STATE();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    saveState();
    applySettings(); syncHUD(); updateMenuState(); renderArchive();
    const log = $('#novaLog'); if (log) log.innerHTML = '';
    closeNova();
    toast('<b>Case reset</b> · new investigation ready', 3000);
    showScreen('menu');
  });
}

function boot() {
  bindSettings();
  novaInit();
  syncHUD();
  updateMenuState();
  renderArchive();
  startStars();
  sizeGlobe();
  startGlobe();
  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('#novaPanel') && $('#novaPanel').classList.contains('open')) { closeNova(); return; }
      if (screenNow === 'game') backToMenu();
    }
  });
  const stage = $('#stage');
  if (stage) stage.addEventListener('scroll', () => {}, { passive: true });
  console.info('GROUND SHIFT ready · case GS-001');
}
boot();
