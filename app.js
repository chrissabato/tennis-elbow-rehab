'use strict';

const APP_VERSION = '1.2.1';
const RING_LEN = 2 * Math.PI * 52;
const $ = (id) => document.getElementById(id);
const getPhoto = (id, step) => `photos/${id}-${step}.jpg`;

/* ---------- storage ---------- */

const DEFAULT_SETTINGS = {
  rest: 30, relax: 2, ready: 5,
  sound: true, voice: true, vibrate: true, wake: true,
  remind: false, rem1: '09:00', rem2: '19:00',
};

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let settings = { ...DEFAULT_SETTINGS, ...load('ter.settings', {}) };
let history = load('ter.history', []);

const saveSettings = () => save('ter.settings', settings);
const saveHistory = () => save('ter.history', history);

/* ---------- date helpers ---------- */

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const todayKey = () => dayKey(Date.now());
const sessionsOn = (key) => history.filter((h) => dayKey(h.ts) === key);

function startOfWeek(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - offset);
  return x;
}

function streak() {
  const d = new Date();
  if (!sessionsOn(dayKey(d)).length) d.setDate(d.getDate() - 1);
  let n = 0;
  while (sessionsOn(dayKey(d)).length) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function fmtDuration(sec) {
  const m = Math.round(sec / 60);
  return m < 1 ? `${Math.round(sec)} s` : `${m} min`;
}

/* ---------- toast ---------- */

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}

/* ---------- views ---------- */

const TITLES = { today: 'Today', exercises: 'Exercises', history: 'History', settings: 'Settings' };

function showView(name) {
  for (const v of Object.keys(TITLES)) $(`view-${v}`).hidden = v !== name;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $('view-title').textContent = TITLES[name];
  if (name === 'today') renderToday();
  if (name === 'history') renderHistory();
  window.scrollTo(0, 0);
}

function doseText(ex) {
  return `${ex.sets} × ${ex.reps} reps · hold ${ex.hold}s`;
}

function exerciseSeconds(ex) {
  return settings.ready
    + ex.sets * ex.reps * ex.hold
    + ex.sets * (ex.reps - 1) * settings.relax
    + (ex.sets - 1) * settings.rest;
}

function renderToday() {
  const n = sessionsOn(todayKey()).length;
  const goal = PROGRAM.dailySessions;
  $('today-count').textContent = `${n}/${goal}`;
  $('today-ring').style.strokeDashoffset = RING_LEN * (1 - Math.min(n, goal) / goal);
  $('today-ring').style.opacity = n ? 1 : 0;
  $('today-msg').textContent =
    n === 0 ? 'Ready for your first session of the day.'
    : n < goal ? 'Nice work. One more session later today.'
    : 'Both sessions done today. Rest that elbow!';
  $('start-btn').textContent = n >= goal ? 'Start extra session' : `Start session ${n + 1}`;

  const week = $('week-strip');
  week.innerHTML = '';
  const start = startOfWeek();
  let activeDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = dayKey(d);
    const count = sessionsOn(k).length;
    if (count) activeDays++;
    const el = document.createElement('div');
    el.className = 'day' + (k === todayKey() ? ' today' : '');
    el.innerHTML = `<span>${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
      <span class="dots">${[0, 1].map((j) => `<span class="dot${count > j ? ' on' : ''}"></span>`).join('')}</span>
      <span>${d.getDate()}</span>`;
    week.appendChild(el);
  }
  $('week-count').textContent = `${activeDays}/${PROGRAM.weeklyDays} days`;

  $('routine-list').innerHTML = EXERCISES.map((ex) =>
    `<li>${ex.name}<span class="dose-inline">${doseText(ex)}</span></li>`).join('');
  $('est-min').textContent = Math.round(EXERCISES.reduce((s, ex) => s + exerciseSeconds(ex), 0) / 60);
}

function photoPairHtml(ex) {
  const a = getPhoto(ex.id, 1), b = getPhoto(ex.id, 2);
  return `<div class="photos">
    <figure><img src="${a}" alt="${ex.name}: step 1"><figcaption>Step 1</figcaption></figure>
    <figure><img src="${b}" alt="${ex.name}: step 2"><figcaption>Step 2</figcaption></figure>
  </div>`;
}

function renderLibrary() {
  $('exercise-library').innerHTML = EXERCISES.map((ex, i) => `
    <details class="card ex">
      <summary>
        <div><div class="ex-title">${i + 1}. ${ex.name}</div><div class="ex-dose">${doseText(ex)}</div></div>
      </summary>
      <div class="ex-body">
        ${photoPairHtml(ex)}
        <div class="dose">
          <span>Reps <b>${ex.reps}</b></span><span>Sets <b>${ex.sets}</b></span>
          <span>Hold <b>${ex.hold}s</b></span><span><b>2×</b> daily</span><span><b>5×</b> weekly</span>
        </div>
        <dl class="instr">
          <dt>Equipment</dt><dd>${ex.equipment}</dd>
          <dt>Setup</dt><dd>${ex.setup}</dd>
          <dt>Movement</dt><dd>${ex.movement}</dd>
          <dt>Tip</dt><dd>${ex.tip}</dd>
        </dl>
      </div>
    </details>`).join('');
  $('src-link').href = PROGRAM.sourceUrl;
  $('video-link').href = PROGRAM.videoUrl;
}

function renderHistory() {
  $('stat-total').textContent = history.length;
  $('stat-streak').textContent = streak();
  const weekAgo = Date.now() - 7 * 864e5;
  const recent = history.filter((h) => h.ts > weekAgo && typeof h.pain === 'number');
  $('stat-pain').textContent = recent.length
    ? (recent.reduce((s, h) => s + h.pain, 0) / recent.length).toFixed(1) : '–';

  const chart = $('pain-chart');
  const pts = history.filter((h) => typeof h.pain === 'number').slice(-20);
  chart.innerHTML = pts.length
    ? pts.map((h) => `<div class="bar${h.pain >= 7 ? ' high' : h.pain >= 4 ? ' mid' : ''}"
        style="height:${Math.max(h.pain * 10, 3)}%" title="${new Date(h.ts).toLocaleString()}: ${h.pain}/10"></div>`).join('')
    : '<span class="empty">No sessions logged yet</span>';

  const list = $('history-list');
  list.innerHTML = history.length ? '' : '<li class="muted">No sessions yet.</li>';
  [...history].reverse().forEach((h) => {
    const li = document.createElement('li');
    const when = new Date(h.ts).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const info = document.createElement('div');
    info.innerHTML = `<strong>${when}</strong>
      <span class="note">${h.done.length}/${EXERCISES.length} exercises · ${fmtDuration(h.durationSec || 0)}</span>`;
    if (h.notes) {
      const note = document.createElement('span');
      note.className = 'note';
      note.textContent = h.notes;
      info.appendChild(note);
    }
    const right = document.createElement('div');
    right.innerHTML = `<span class="pain-badge">${typeof h.pain === 'number' ? `Pain ${h.pain}` : ''}</span>
      <button class="del" aria-label="Delete entry">✕</button>`;
    right.querySelector('.del').onclick = () => {
      if (!confirm('Delete this session?')) return;
      history = history.filter((x) => x.id !== h.id);
      saveHistory();
      renderHistory();
    };
    li.append(info, right);
    list.appendChild(li);
  });
}

/* ---------- settings ---------- */

function bindSettings() {
  const nums = { 'set-rest': 'rest', 'set-relax': 'relax', 'set-ready': 'ready' };
  const bools = { 'set-sound': 'sound', 'set-voice': 'voice', 'set-vibrate': 'vibrate', 'set-wake': 'wake', 'set-remind': 'remind' };
  const times = { 'set-rem1': 'rem1', 'set-rem2': 'rem2' };

  for (const [id, key] of Object.entries(nums)) {
    $(id).value = settings[key];
    $(id).onchange = (e) => {
      const v = Math.max(0, Math.min(Number(e.target.max), Math.round(Number(e.target.value) || 0)));
      e.target.value = v;
      settings[key] = v;
      saveSettings();
    };
  }
  for (const [id, key] of Object.entries(bools)) {
    $(id).checked = settings[key];
    $(id).onchange = async (e) => {
      settings[key] = e.target.checked;
      if (key === 'remind' && e.target.checked) {
        if (!('Notification' in window)) {
          toast('Notifications are not supported here');
        } else if ((await Notification.requestPermission()) !== 'granted') {
          toast('Notification permission was denied');
          e.target.checked = settings.remind = false;
        }
      }
      saveSettings();
    };
  }
  for (const [id, key] of Object.entries(times)) {
    $(id).value = settings[key];
    $(id).onchange = (e) => { settings[key] = e.target.value; saveSettings(); };
  }

  $('export-btn').onclick = () => {
    const blob = new Blob([JSON.stringify({ version: 1, history, settings }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `elbow-rehab-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('import-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.history)) throw new Error();
      const ids = new Set(history.map((h) => h.id));
      history = [...history, ...data.history.filter((h) => h && h.id && h.ts && Array.isArray(h.done) && !ids.has(h.id))]
        .sort((a, b) => a.ts - b.ts);
      saveHistory();
      toast('History imported');
    } catch {
      toast('That file could not be imported');
    }
    e.target.value = '';
  };
  $('reset-btn').onclick = () => {
    if (!confirm('Erase all session history on this device?')) return;
    history = [];
    saveHistory();
    toast('History erased');
  };
  $('app-version').textContent = APP_VERSION;
}

/* ---------- cues: sound, voice, vibration, wake lock ---------- */

let audioCtx;
function initAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function beep(freq = 880, ms = 120, vol = 0.25) {
  if (!settings.sound || !audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.frequency.value = freq;
  o.type = 'sine';
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  o.connect(g).connect(audioCtx.destination);
  o.start(t);
  o.stop(t + ms / 1000 + 0.02);
}
function say(text) {
  if (!settings.voice || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  speechSynthesis.speak(u);
}
function buzz(pattern) {
  if (settings.vibrate && navigator.vibrate) navigator.vibrate(pattern);
}

let wakeLock = null;
async function lockScreen() {
  if (!settings.wake || !('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {}
}
function unlockScreen() {
  if (wakeLock) wakeLock.release();
  wakeLock = null;
}

/* ---------- session player ---------- */

const S = {
  active: false,
  ei: 0,              // exercise index
  mode: 'intro',      // intro | timer | finish
  phases: [],
  pi: 0,              // phase index
  endAt: 0,
  pausedLeft: null,
  lastSec: null,
  done: new Set(),
  startedAt: 0,
  pain: null,
  timer: null,
};

function buildPhases(ex) {
  const p = [];
  if (settings.ready > 0) p.push({ kind: 'ready', secs: settings.ready, set: 1, rep: 1 });
  for (let s = 1; s <= ex.sets; s++) {
    for (let r = 1; r <= ex.reps; r++) {
      p.push({ kind: 'hold', secs: ex.hold, set: s, rep: r });
      if (r < ex.reps && settings.relax > 0) p.push({ kind: 'relax', secs: settings.relax, set: s, rep: r });
    }
    if (s < ex.sets && settings.rest > 0) p.push({ kind: 'rest', secs: settings.rest, set: s, rep: ex.reps });
  }
  return p;
}

function openPlayer() {
  initAudio();
  Object.assign(S, { active: true, ei: 0, mode: 'intro', done: new Set(), startedAt: Date.now(), pain: null });
  $('p-notes').value = '';
  $('player').hidden = false;
  document.body.style.overflow = 'hidden';
  lockScreen();
  showIntro();
}

function closePlayer() {
  stopTimer();
  S.active = false;
  $('player').hidden = true;
  $('player').className = 'player';
  document.body.style.overflow = '';
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  unlockScreen();
  renderToday();
}

function setProgress() {
  $('p-progress').style.width = `${(S.mode === 'finish' ? 1 : S.ei / EXERCISES.length) * 100}%`;
  $('p-step').textContent = S.mode === 'finish' ? 'Done' : `${S.ei + 1}/${EXERCISES.length}`;
}

function showPane(name) {
  $('p-intro').hidden = name !== 'intro';
  $('p-timer').hidden = name !== 'timer';
  $('p-finish').hidden = name !== 'finish';
  $('p-body').scrollTop = 0;
}

function showIntro() {
  stopTimer();
  S.mode = 'intro';
  $('player').className = 'player';
  const ex = EXERCISES[S.ei];
  $('p-type').textContent = ex.type === 'stretch' ? 'Stretch' : 'Strengthen';
  $('p-name').textContent = ex.name;
  $('p-dose').innerHTML = `<span>Sets <b>${ex.sets}</b></span><span>Reps <b>${ex.reps}</b></span><span>Hold <b>${ex.hold}s</b></span><span>≈ <b>${fmtDuration(exerciseSeconds(ex))}</b></span>`;
  $('p-photos').innerHTML = photoPairHtml(ex);
  $('p-equip').textContent = ex.equipment;
  $('p-setup').textContent = ex.setup;
  $('p-move').textContent = ex.movement;
  $('p-tip').textContent = ex.tip;
  showPane('intro');
  $('p-main').textContent = 'Start exercise';
  $('p-prev').textContent = 'Back';
  $('p-prev').disabled = S.ei === 0;
  $('p-next').textContent = 'Skip';
  $('p-next').disabled = false;
  setProgress();
}

function startExercise() {
  const ex = EXERCISES[S.ei];
  S.mode = 'timer';
  S.phases = buildPhases(ex);
  S.pi = 0;
  $('p-tname').textContent = ex.name;
  $('p-tip2').textContent = ex.tip;
  showPane('timer');
  $('p-prev').textContent = 'Restart';
  $('p-prev').disabled = false;
  $('p-next').textContent = 'Skip';
  enterPhase(Date.now());
  startTimer();
}

function enterPhase(startTs) {
  const ex = EXERCISES[S.ei];
  const ph = S.phases[S.pi];
  S.endAt = startTs + ph.secs * 1000;
  S.pausedLeft = null;
  S.lastSec = null;
  const player = $('player');
  player.className = 'player' + (ph.kind === 'rest' || ph.kind === 'relax' ? ' resting' : ph.kind === 'ready' ? ' ready' : '');

  const labels = { ready: 'GET READY', hold: 'HOLD', relax: 'RELAX', rest: 'REST' };
  $('p-phase').textContent = labels[ph.kind];
  $('p-cue').textContent =
    ph.kind === 'hold' ? ex.cue
    : ph.kind === 'relax' ? 'Slowly return to start'
    : ph.kind === 'rest' ? `Next: set ${ph.set + 1} of ${ex.sets}`
    : ex.equipment === 'None' ? 'Get into position' : `Grab: ${ex.equipment.toLowerCase()}`;
  const photo = getPhoto(ex.id, ph.kind === 'hold' ? 2 : 1);
  $('p-photo').src = photo;
  $('p-photo').alt = `${ex.name}: ${ph.kind === 'hold' ? 'step 2' : 'step 1'}`;
  $('p-set').textContent = `${ph.set}/${ex.sets}`;
  $('p-rep').textContent = `${ph.rep}/${ex.reps}`;
  $('p-main').textContent = 'Pause';

  if (ph.kind === 'hold') {
    beep(988, 160);
    buzz(80);
    say(ph.rep === 1 ? `Set ${ph.set}. ${ex.cue}` : `${ph.rep}`);
  } else if (ph.kind === 'relax') {
    beep(660, 120);
    say('Relax');
  } else if (ph.kind === 'rest') {
    beep(523, 250);
    buzz([60, 60, 60]);
    say(`Rest ${ph.secs} seconds`);
  } else if (ph.kind === 'ready') {
    say(`${ex.name}. Get ready.`);
  }
  updateTimer();
}

function startTimer() {
  stopTimer();
  S.timer = setInterval(updateTimer, 100);
}
function stopTimer() {
  clearInterval(S.timer);
  S.timer = null;
}

function updateTimer() {
  if (S.mode !== 'timer' || S.pausedLeft !== null) return;
  const now = Date.now();
  // Advance through any phases that elapsed (e.g. while the tab was in the background).
  while (now >= S.endAt) {
    const prevEnd = S.endAt;
    S.pi++;
    if (S.pi >= S.phases.length) return finishExercise();
    enterPhase(prevEnd);
  }
  const ph = S.phases[S.pi];
  const left = (S.endAt - now) / 1000;
  const sec = Math.ceil(left);
  $('p-secs').textContent = sec;
  $('p-ring').style.strokeDashoffset = RING_LEN * (1 - left / ph.secs);
  if (sec !== S.lastSec) {
    S.lastSec = sec;
    // Count-in ticks before a hold starts.
    const next = S.phases[S.pi + 1];
    if (sec <= 3 && sec > 0 && ph.kind !== 'hold' && ph.secs > 3 && next && next.kind === 'hold') beep(440, 80, 0.18);
  }
}

function finishExercise() {
  stopTimer();
  S.done.add(EXERCISES[S.ei].id);
  beep(784, 140); setTimeout(() => beep(1047, 220), 160);
  buzz([100, 80, 200]);
  if (S.ei < EXERCISES.length - 1) {
    S.ei++;
    say(`Done. Next: ${EXERCISES[S.ei].name}`);
    showIntro();
  } else {
    say('Session complete. Great work.');
    showFinish();
  }
}

function togglePause() {
  if (S.pausedLeft === null) {
    S.pausedLeft = Math.max(0, S.endAt - Date.now());
    $('player').classList.add('paused');
    $('p-main').textContent = 'Resume';
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  } else {
    S.endAt = Date.now() + S.pausedLeft;
    S.pausedLeft = null;
    $('player').classList.remove('paused');
    $('p-main').textContent = 'Pause';
    updateTimer();
  }
}

function skipPhase() {
  const wasPaused = S.pausedLeft !== null;
  S.pi++;
  if (S.pi >= S.phases.length) return finishExercise();
  enterPhase(Date.now());
  if (wasPaused) togglePause();
}

function showFinish() {
  stopTimer();
  S.mode = 'finish';
  $('player').className = 'player';
  const mins = fmtDuration((Date.now() - S.startedAt) / 1000);
  $('p-summary').textContent = `${S.done.size} of ${EXERCISES.length} exercises · ${mins}`;
  const scale = $('pain-scale');
  scale.innerHTML = '';
  for (let i = 0; i <= 10; i++) {
    const b = document.createElement('button');
    b.textContent = i;
    b.onclick = () => {
      S.pain = i;
      scale.querySelectorAll('button').forEach((x, j) => x.classList.toggle('sel', j === i));
    };
    scale.appendChild(b);
  }
  showPane('finish');
  $('p-main').textContent = 'Save session';
  $('p-prev').textContent = 'Discard';
  $('p-prev').disabled = false;
  $('p-next').textContent = '';
  $('p-next').disabled = true;
  setProgress();
}

function saveSession() {
  history.push({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    done: [...S.done],
    pain: S.pain,
    notes: $('p-notes').value.trim(),
    durationSec: Math.round((Date.now() - S.startedAt) / 1000),
  });
  saveHistory();
  closePlayer();
  const n = sessionsOn(todayKey()).length;
  toast(n >= PROGRAM.dailySessions ? 'Saved. Daily goal reached!' : 'Session saved');
  if (S.pain !== null && S.pain >= 7) {
    setTimeout(() => alert('You rated your pain 7 or higher. Consider easing off (lighter weight or a gentler stretch) and check in with your physical therapist.'), 300);
  }
}

function bindPlayer() {
  $('start-btn').onclick = openPlayer;

  $('p-main').onclick = () => {
    initAudio();
    if (S.mode === 'intro') startExercise();
    else if (S.mode === 'timer') togglePause();
    else if (S.mode === 'finish') saveSession();
  };
  $('p-prev').onclick = () => {
    if (S.mode === 'intro' && S.ei > 0) { S.ei--; showIntro(); }
    else if (S.mode === 'timer') showIntro();
    else if (S.mode === 'finish' && confirm('Discard this session without saving?')) closePlayer();
  };
  $('p-next').onclick = () => {
    if (S.mode === 'intro') {
      if (S.ei < EXERCISES.length - 1) { S.ei++; showIntro(); } else showFinish();
    } else if (S.mode === 'timer') skipPhase();
  };
  $('p-close').onclick = () => {
    if (S.mode === 'finish') { if (confirm('Discard this session without saving?')) closePlayer(); return; }
    if (!confirm('End this session now?')) return;
    if (S.done.size) showFinish(); else closePlayer();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.active) {
      lockScreen();
      updateTimer();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!S.active || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); $('p-main').click(); }
    if (e.code === 'ArrowRight') $('p-next').click();
  });
}

/* ---------- reminders (while app is running) ---------- */

function checkReminders() {
  if (!settings.remind || !('Notification' in window) || Notification.permission !== 'granted' || S.active) return;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const n = sessionsOn(todayKey()).length;
  const sent = load('ter.reminded', {});
  [settings.rem1, settings.rem2].forEach((time, i) => {
    const tag = `${todayKey()}-${i}`;
    if (!time || hhmm < time || n > i || sent[tag]) return;
    sent[tag] = true;
    save('ter.reminded', Object.fromEntries(Object.entries(sent).filter(([k]) => k.startsWith(todayKey()))));
    const opts = { body: `Time for session ${i + 1} of your tennis elbow exercises.`, icon: 'icons/icon-192.png', tag };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification('Elbow Rehab', opts))
        .catch(() => new Notification('Elbow Rehab', opts));
    } else {
      new Notification('Elbow Rehab', opts);
    }
  });
}

/* ---------- install prompt ---------- */

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('install-card').hidden = false;
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  $('install-card').hidden = true;
  toast('App installed');
});
$('install-btn').onclick = async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('install-card').hidden = true;
};

/* ---------- init ---------- */

document.querySelectorAll('.tabbar button').forEach((b) => { b.onclick = () => showView(b.dataset.view); });
renderLibrary();
bindSettings();
bindPlayer();
showView('today');
setInterval(checkReminders, 30000);
checkReminders();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
