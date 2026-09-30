/* One More Rep — app logic. Plain JS, no build step.
   Everything is saved in this browser (localStorage). Use the backup button
   in Grand scheme to move your diary to another device. */
(() => {
  'use strict';

  /* ---------------- helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

  /* ---------------- constants ---------------- */
  const DAY_MS = 864e5;
  const ROLL_H = 4;           // a day ends at 4am, so a 1am rep counts for the day before
  const SEASON = 30;
  const MIN_REPS = 2;
  const LS_DATA = 'omr-data-v1';
  const LS_BENCH = 'omr-bench-v1';
  const COLORS = ['mint', 'lilac', 'peach', 'butter', 'rose', 'sky', 'sage', 'sand', 'coral'];
  const HEADS = ['quiet', 'humming', 'buzzing', 'loud', 'sirens']; // value = index + 1
  const EFFORTS = ['light', 'solid', 'heavy'];
  const MODES = [0, 300, 900, 1500, 2700];
  const GENERIC_TINY = ['Open it and look at it for 5 minutes', 'Write 3 lines about where you left off', 'Do the smallest next step'];

  const DEFAULT_TRACKS = [
    { id: 'upwork', name: 'Upwork', color: 'mint', tiny: ['Read 3 job posts and save 1', 'Write the first 2 lines of a proposal', 'Fix one line on your profile'] },
    { id: 'jobs', name: 'Job hunt', color: 'sky', tiny: ['Find 1 posting and save the link', 'Tweak one CV bullet', 'Send 1 application, even a rough one'] },
    { id: 'github', name: 'GitHub', color: 'lilac', tiny: ['Push one commit', 'Write 3 lines of a README', 'Open an old repo and fix one thing'] },
    { id: 'linkedin', name: 'LinkedIn', color: 'rose', tiny: ['Leave 1 real comment on a post', 'Draft 3 lines of a post', 'Update one line of your profile'] },
    { id: 'youtube', name: 'YouTube', color: 'coral', tiny: ['Write down 1 video idea', 'Record a 30-second test clip', 'Write the first line of a script'] },
    { id: 'editing', name: 'Editing', color: 'peach', tiny: ['Cut one 20-second clip', 'Learn 1 shortcut and use it', 'Caption 10 seconds of footage'] },
    { id: 'skills', name: 'Learn a skill', color: 'sage', tiny: ['Watch 10 minutes, write 3 notes', 'Redo one example on your own', 'Explain one idea in 3 lines'] },
    { id: 'cp', name: 'CP / DSA', color: 'butter', tiny: ['Read 1 problem, write the brute force', 'Re-solve yesterday’s problem', 'Read one editorial slowly'] },
    { id: 'uni', name: 'Uni', color: 'sand', tiny: ['Open the slides and do 1 page', 'Write 5 lines of the assignment', 'List what’s due this week'] },
  ];

  const WEEKS = {
    0: { name: 'Warm-up', title: 'Nothing yet. That’s the point.', rule: 'Day 1 starts the second you log your first rep. Pick a machine below and press start.' },
    1: { name: 'Bike week', title: 'Two rides, sirens or not', rule: 'Two reps a day, every day this week. Size doesn’t matter. Showing up does.' },
    2: { name: 'Same road', title: 'Same road again', rule: 'Two reps a day, and one of them on a machine you also hit yesterday.' },
    3: { name: 'Add a plate', title: 'Add a plate', rule: 'Two reps a day, and one of them longer than your usual.' },
    4: { name: 'Failure +1', title: 'Failure, then one more', rule: 'Two reps a day. When a set ends and you want to stop, press one more. Once a day.' },
    5: { name: 'Film day', title: 'Film day', rule: 'Your outline is waiting in Grand scheme. Hit record. The first take is allowed to be ugly.' },
    6: { name: 'Season done', title: 'Season done', rule: 'You got to the end of the month. Film it, then start the next season.' },
  };

  /* ---------------- dates ---------------- */
  function dayKeyOf(ms) {
    const d = new Date(ms - ROLL_H * 3600e3);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const todayKey = () => dayKeyOf(Date.now());
  function keyUTC(k) { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); }
  const diffDays = (a, b) => Math.round((keyUTC(b) - keyUTC(a)) / DAY_MS);
  function addDays(k, n) {
    const d = new Date(keyUTC(k) + n * DAY_MS);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const fmtDay = (k, o = { weekday: 'short', day: 'numeric', month: 'short' }) =>
    new Date(keyUTC(k)).toLocaleDateString(undefined, { ...o, timeZone: 'UTC' });
  const fmtTime = ms => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  function fmtMins(m) {
    m = Math.round(m || 0);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }
  function ago(ms) {
    const s = (Date.now() - ms) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < DAY_MS / 1000) return `${Math.floor(s / 3600)}h ago`;
    const d = Math.floor(s / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  function clock(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  /* ---------------- state ---------------- */
  const S = { profile: null, reps: new Map(), thoughts: new Map(), days: new Map(), volatile: false, full: false };
  let dirty = false;
  let cache = null;
  const bump = () => { cache = null; };

  function defaultProfile() {
    return { tracks: DEFAULT_TRACKS.map(t => ({ ...t, tiny: [...t.tiny], hidden: false })), seasons: [], goal: '', lastBackup: 0, createdAt: Date.now() };
  }
  function normTrack(t) {
    return {
      id: String(t.id),
      name: String(t.name || 'Machine').slice(0, 40),
      color: COLORS.includes(t.color) ? t.color : 'sand',
      tiny: Array.isArray(t.tiny) ? t.tiny.map(String).slice(0, 8) : [],
      hidden: !!t.hidden,
    };
  }
  function normProfile(d) {
    const p = JSON.parse(JSON.stringify(d || {}));
    p.tracks = Array.isArray(p.tracks) && p.tracks.length ? p.tracks.filter(t => t && t.id).map(normTrack) : defaultProfile().tracks;
    p.seasons = Array.isArray(p.seasons) ? p.seasons.filter(s => s && /^\d{4}-\d{2}-\d{2}$/.test(s.start)).map(s => ({ n: +s.n || 1, start: s.start })) : [];
    p.goal = typeof p.goal === 'string' ? p.goal : '';
    p.lastBackup = +p.lastBackup || 0;
    p.createdAt = +p.createdAt || Date.now();
    return p;
  }
  const P = () => (S.profile ||= defaultProfile());
  const visTracks = () => P().tracks.filter(t => !t.hidden);
  function trackById(id, fallbackName) {
    return P().tracks.find(t => t.id === id) || { id, name: fallbackName || 'Old machine', color: 'sand', tiny: [], hidden: true };
  }
  const season = () => { const s = P().seasons; return s.length ? s[s.length - 1] : null; };
  const dayIdx = (s, k = todayKey()) => (s ? diffDays(s.start, k) + 1 : 0);
  function weekOf(n) {
    if (n <= 0) return 0;
    if (n <= 7) return 1;
    if (n <= 14) return 2;
    if (n <= 21) return 3;
    if (n <= 29) return 4;
    if (n === 30) return 5;
    return 6;
  }
  function numLabel(n) {
    const w = weekOf(n);
    if (w === 0) return '0.0';
    if (w <= 4) return `${w}.${n - (w - 1) * 7}`;
    if (w === 5) return '4.9';
    return `${n}`;
  }
  function seasonOfDay(k) {
    const ss = P().seasons;
    for (let i = ss.length - 1; i >= 0; i--) {
      const n = diffDays(ss[i].start, k) + 1;
      if (n >= 1 && n <= SEASON) return { s: ss[i], n };
    }
    return null;
  }

  /* derived indexes, rebuilt only when data changes */
  function I() {
    if (cache) return cache;
    const list = [...S.reps.values()].sort((a, b) => a.at - b.at);
    const byDay = new Map(), byTrack = new Map();
    for (const r of list) {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day).push(r);
      if (!byTrack.has(r.track)) byTrack.set(r.track, []);
      byTrack.get(r.track).push(r);
    }
    return (cache = { list, byDay, byTrack });
  }
  const repsOn = k => I().byDay.get(k) || [];
  const xpOf = r => (Number(r.mins) || 0) + 10 + 5 * (r.plus || 0);
  const need = L => 25 * L * L + 35 * L;
  function levelOf(xp) { let L = 0; while (xp >= need(L + 1)) L++; return L; }
  function trackStats(id) {
    const rs = I().byTrack.get(id) || [];
    const xp = sum(rs, xpOf);
    return { reps: rs.length, mins: sum(rs, r => +r.mins || 0), xp, lvl: levelOf(xp), first: rs[0], last: rs[rs.length - 1] };
  }
  function seasonStats(s) {
    const n = Math.max(0, Math.min(SEASON, diffDays(s.start, todayKey()) + 1));
    let shown = 0, met = 0, run = 0, best = 0, mins = 0, reps = 0;
    for (let i = 0; i < n; i++) {
      const rs = repsOn(addDays(s.start, i));
      if (rs.length) { shown++; run++; best = Math.max(best, run); } else run = 0;
      if (rs.length >= MIN_REPS) met++;
      reps += rs.length;
      mins += sum(rs, r => +r.mins || 0);
    }
    return { n, shown, met, best, mins, reps };
  }

  /* ---------------- storage ---------------- */
  function exportData() {
    return {
      app: 'one-more-rep', v: 1, exportedAt: Date.now(),
      profile: S.profile, reps: [...S.reps.values()], thoughts: [...S.thoughts.values()],
      days: Object.fromEntries(S.days),
    };
  }
  function cleanRep(r) {
    if (!r || !r.id || !r.track || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return null;
    return {
      id: String(r.id), track: String(r.track), trackName: String(r.trackName || ''), mins: Math.max(0, Math.min(600, +r.mins || 0)),
      note: String(r.note || '').slice(0, 280), effort: EFFORTS.includes(r.effort) ? r.effort : 'solid', plus: +r.plus || 0,
      at: +r.at || keyUTC(r.day), day: r.day, how: r.how === 'log' ? 'log' : 'timer',
    };
  }
  function cleanThought(t) {
    if (!t || !t.id) return null;
    return {
      id: String(t.id), text: String(t.text || '').slice(0, 500), kind: t.kind === 'noise' ? 'noise' : 'idea',
      track: t.track ? String(t.track) : null, at: +t.at || Date.now(), day: /^\d{4}-\d{2}-\d{2}$/.test(t.day) ? t.day : dayKeyOf(+t.at || Date.now()),
      kept: !!t.kept, done: !!t.done, repId: t.repId ? String(t.repId) : null,
    };
  }
  /* mode "replace" loads saved data; mode "merge" adds a backup without overwriting anything */
  function ingest(d, mode) {
    const counts = { reps: 0, thoughts: 0, days: 0 };
    if (!d || typeof d !== 'object') return counts;
    if (mode === 'replace') {
      S.profile = d.profile ? normProfile(d.profile) : null;
    } else if (d.profile) {
      const inc = normProfile(d.profile), p = P();
      for (const t of inc.tracks) if (!p.tracks.some(x => x.id === t.id)) p.tracks.push(t);
      if (!p.seasons.length && inc.seasons.length) p.seasons = inc.seasons;
      if (!p.goal && inc.goal) p.goal = inc.goal;
    }
    for (const raw of Array.isArray(d.reps) ? d.reps : []) {
      const r = cleanRep(raw);
      if (r && !S.reps.has(r.id)) { S.reps.set(r.id, r); counts.reps++; }
    }
    for (const raw of Array.isArray(d.thoughts) ? d.thoughts : []) {
      const t = cleanThought(raw);
      if (t && !S.thoughts.has(t.id)) { S.thoughts.set(t.id, t); counts.thoughts++; }
    }
    if (d.days && typeof d.days === 'object') {
      for (const [k, v] of Object.entries(d.days)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
        const cur = S.days.get(k) || {};
        const next = { siren: cur.siren || (+v.siren || 0), line: cur.line || String(v.line || '').slice(0, 300) };
        if (!S.days.has(k)) counts.days++;
        S.days.set(k, next);
      }
    }
    bump();
    return counts;
  }
  function load() {
    S.profile = null; S.reps = new Map(); S.thoughts = new Map(); S.days = new Map();
    let raw = null;
    try {
      raw = localStorage.getItem(LS_DATA);
      localStorage.setItem('omr-probe', '1');
      localStorage.removeItem('omr-probe');
    } catch (e) { S.volatile = true; }
    if (raw) {
      try { ingest(JSON.parse(raw), 'replace'); } catch (e) { console.warn('Saved data could not be read', e); }
    }
    bump();
  }
  let saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 150); }
  function saveNow() {
    clearTimeout(saveT);
    if (!dirty || S.volatile) return;
    try {
      localStorage.setItem(LS_DATA, JSON.stringify(exportData()));
      dirty = false;
      if (S.full) { S.full = false; renderFooter(); }
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        if (!S.full) { S.full = true; toast('Browser storage is full. Save a backup from Grand scheme so nothing gets lost.', 6000); renderFooter(); }
      } else {
        S.volatile = true;
        toast('This browser won’t let the page save. Save a backup before you close it.', 6000);
        renderFooter();
      }
    }
  }
  function changed() { dirty = true; bump(); save(); schedule(); }
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  window.addEventListener('storage', e => {
    if (e.key === LS_DATA && !dirty) { load(); schedule(); }
  });
  let askedPersist = false;
  function askPersist() {
    if (askedPersist) return;
    askedPersist = true;
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch (e) { /* optional */ }
  }

  /* mutations */
  function putRep(r) { S.reps.set(r.id, r); changed(); }
  function delRep(id) { S.reps.delete(id); changed(); }
  function putThought(t) { S.thoughts.set(t.id, t); changed(); }
  function delThought(id) { S.thoughts.delete(id); changed(); }
  function putDay(k, d) { S.days.set(k, d); changed(); }
  function saveProfile() { P(); changed(); }

  /* the ugly voice fades: its words are erased after 24 hours, only the count stays */
  function fadeNoise() {
    let n = 0;
    for (const [id, t] of S.thoughts) {
      if (t.kind === 'noise' && t.text && Date.now() - t.at > DAY_MS) { S.thoughts.set(id, { ...t, text: '' }); n++; }
    }
    if (n) changed();
  }

  /* ---------------- bench (timer) state ---------------- */
  function freshBench(keep = {}) {
    return { status: 'idle', track: keep.track || null, mode: keep.mode ?? 0, target: 0, startedAt: null, acc: 0, plus: 0, note: '', mins: null, effort: 'solid', thoughtId: null };
  }
  let B = freshBench();
  try {
    const raw = localStorage.getItem(LS_BENCH);
    if (raw) B = { ...freshBench(), ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  function saveBench() { try { localStorage.setItem(LS_BENCH, JSON.stringify(B)); } catch (e) { /* ignore */ } }
  const elapsed = () => B.acc + (B.startedAt ? Date.now() - B.startedAt : 0);

  /* other UI state */
  const L = { track: null, effort: 'solid' };            // log-without-timer form
  const D = { kind: 'idea', track: null };                // brain dump form
  const Z = { track: null, tiny: null };                  // sirens mode
  const V = { k: null, si: null, outline: '', outlineOpen: false, recapLines: true }; // look back + video
  const E = { id: null, name: '', color: 'mint', tiny: '' }; // machine editor
  let view = 'today';

  /* ---------------- rendering helpers ---------------- */
  const ICONS = {
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 11 3.5 3.5 0 0 0 7 18z"/>',
    siren: '<path d="M6 18v-5a6 6 0 0 1 12 0v5"/><path d="M4 18h16"/><path d="M12 3v2M4.6 6.6l1.4 1.4M19.4 6.6 18 8"/>',
    plate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>',
  };
  const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

  /* Only touch the DOM when the HTML really changed, and never while someone is typing inside it. */
  function paint(el, html) {
    if (!el || el._h === html) return false;
    const a = document.activeElement;
    if (a && el.contains(a) && a.matches('input, textarea, select')) { el._dirty = true; return false; }
    el.innerHTML = html;
    el._h = html;
    el._dirty = false;
    return true;
  }
  document.addEventListener('focusout', () => {
    setTimeout(() => { if ($$('[id]').some(e => e._dirty)) schedule(); }, 350);
  });

  function chipList(scope, selected, { none = false } = {}) {
    const ts = visTracks();
    if (!ts.length) return '<p class="small muted">No machines yet. Add one in Grand scheme.</p>';
    return ts.map(t => `<button type="button" class="chip" style="--c:var(--${t.color})" data-a="pick" data-scope="${scope}" data-id="${esc(t.id)}" aria-pressed="${selected === t.id}">${esc(t.name)}</button>`).join('')
      + (none && selected ? `<button type="button" class="btn ghost sm" data-a="pick" data-scope="${scope}" data-id="">clear</button>` : '');
  }
  const tagFor = r => { const t = trackById(r.track, r.trackName); return `<span class="tag" style="--c:var(--${t.color})">${esc(t.name)}</span>`; };
  function repRow(r, del = true) {
    return `<li class="rep"><span class="rep-time">${fmtTime(r.at)}</span>${tagFor(r)}<span class="rep-note">${r.note ? esc(r.note) : '<span class="muted">no note</span>'}${r.plus ? ` <span class="plus">+${r.plus}</span>` : ''}</span><span class="rep-min">${fmtMins(r.mins)}</span>${del ? `<button type="button" class="x" data-a="del-rep" data-id="${esc(r.id)}" aria-label="Delete this rep">&times;</button>` : '<span></span>'}</li>`;
  }
  function heroHTML(o) {
    return `<nav class="crumbs" aria-label="Where you are">${o.crumbs.map((c, i) => `<span>${esc(c)}</span>${i < o.crumbs.length - 1 ? '<span aria-hidden="true">&rsaquo;</span>' : ''}`).join('')}</nav>
<p class="kicker">${icon(o.icon || 'plate')} ${esc(o.kicker)}</p>
<h1>${o.num ? `<span class="num">${esc(o.num)}</span> ` : ''}${esc(o.title)}</h1>
<p class="byline">${esc(o.byline)}</p>
${o.rule ? `<p class="rule">${esc(o.rule)}</p>` : ''}
${o.actions || ''}
${o.note ? `<p class="note">${esc(o.note)}</p>` : ''}
${o.extra || ''}`;
  }
  const plateSVG = on => `<svg viewBox="0 0 46 46" class="plate${on ? ' on' : ''}" aria-hidden="true"><circle class="o" cx="23" cy="23" r="21"/><circle class="ring" cx="23" cy="23" r="13"/><circle class="hole" cx="23" cy="23" r="4.5"/></svg>`;

  /* ---------------- TODAY ---------------- */
  function heroNote(s, n, k, reps) {
    if (!s || n > SEASON) return '';
    if (reps.length >= MIN_REPS) return 'Minimum done. Anything else today is bonus.';
    if (n === 3) return 'Day 3 is where your old diaries stopped. Log a rep and you’re past it.';
    if (n === 4) return 'Day 4. Further than any diary you kept before. Every day from here is new ground.';
    if (n > 1 && !repsOn(addDays(k, -1)).length && !reps.length) return 'Yesterday was a zero. One zero is allowed. Two in a row is how the old diaries died, so one tiny rep today breaks it.';
    return '';
  }
  function extraFor(n, k) {
    const w = weekOf(n), today = repsOn(k);
    if (w === 2) {
      const y = repsOn(addDays(k, -1));
      if (!y.length) return { text: 'One rep on a machine you hit yesterday (yesterday was empty, so any machine counts)', done: today.length > 0 };
      const ys = new Set(y.map(r => r.track));
      return { text: 'One rep on a machine you also hit yesterday', done: today.some(r => ys.has(r.track)) };
    }
    if (w === 3) {
      const prev = [];
      for (let i = 1; i <= 7; i++) prev.push(...repsOn(addDays(k, -i)));
      const usual = prev.length ? Math.round(sum(prev, r => +r.mins || 0) / prev.length) : 20;
      return { text: `One rep longer than ${usual} min, your usual`, done: today.some(r => r.mins > usual) };
    }
    if (w === 4) return { text: 'Press one more at least once', done: today.some(r => r.plus > 0) };
    if (w === 5) return { text: 'Record the video. The outline is in Grand scheme.', done: null };
    return null;
  }
  function renderToday() {
    const s = season(), k = todayKey(), n = dayIdx(s, k), w = s ? weekOf(n) : 0, W = WEEKS[w];
    const reps = repsOn(k), last = I().list[I().list.length - 1];
    const sReps = s ? seasonStats(s).reps : 0;
    const crumbs = s
      ? [`Season ${s.n}`, w <= 5 ? `Week ${Math.min(4, Math.ceil(n / 7))} · ${W.name}` : W.name, n <= SEASON ? `Day ${n} of ${SEASON}` : `Day ${n}`]
      : ['Season 1', 'Warm-up', 'Day 0'];
    const actions = `<div class="actions">
      <button type="button" class="btn primary" data-a="go-bench">${icon('play')} ${s ? 'start a rep' : 'start rep #1'}</button>
      <button type="button" class="btn" data-a="park">${icon('cloud')} park a thought</button>
      <button type="button" class="btn" data-a="siren">${icon('siren')} sirens mode</button></div>`;
    paint($('#t-hero'), heroHTML({
      crumbs,
      kicker: fmtDay(k, { weekday: 'long', day: 'numeric', month: 'long' }),
      num: s ? (w === 6 ? '' : numLabel(n)) : '0.0',
      title: s && w === 6 ? `Season ${s.n} is done` : W.title,
      byline: `Written by you · ${last ? `last rep ${ago(last.at)}` : 'no reps yet'}${s ? ` · ${plural(sReps, 'rep')} this season` : ''}`,
      rule: W.rule, actions, note: heroNote(s, n, k, reps),
    }));

    /* minimum / onboarding / season done */
    let m = '';
    if (!s) {
      m = `<div class="how"><h2>How this works</h2><ul>
        <li><b>A rep is any honest attempt.</b> Five minutes counts. Ugly counts. Opening the thing and starting counts.</li>
        <li><b>Two reps a day.</b> Like learning the bike: twice a day, sirens or not, until it stops being scary.</li>
        <li><b>Thirty days, then film it.</b> The site writes your video outline from what you logged.</li>
      </ul><p class="small muted">Everything else here is optional.</p></div>`;
    } else if (n > SEASON) {
      const st = seasonStats(s);
      const low = st.shown < 15;
      m = `<div class="done-card"><h2>Season ${s.n}: ${st.shown} of ${SEASON} days shown up</h2>
        <p>${plural(st.reps, 'rep')} · ${fmtMins(st.mins)} · longest run ${plural(st.best, 'day')}.${low ? ` That’s ${st.shown} more days than zero.` : ''}</p>
        <div class="row"><button type="button" class="btn primary" data-a="tab" data-view="scheme">Get the video outline</button><button type="button" class="btn black" data-a="new-season">Start season ${s.n + 1} today</button></div></div>`;
    } else {
      const c = reps.length, ex = extraFor(n, k);
      const text = c === 0 ? 'Two reps. Any size.' : c === 1 ? 'One more and today counts.' : 'Done. Everything else today is bonus.';
      m = `<div class="min"><div class="min-row"><div class="plates">${plateSVG(c >= 1)}${plateSVG(c >= 2)}${c > 2 ? `<span class="bonus">+${c - 2} bonus</span>` : ''}</div>
        <div><span class="label">Today’s minimum · ${Math.min(c, MIN_REPS)} of ${MIN_REPS}</span><p class="min-text">${text}</p></div></div>
        ${ex ? `<p class="extra${ex.done ? ' done' : ''}"><span class="ck">${ex.done === null ? '›' : ex.done ? '✓' : '○'}</span><span>This week: ${esc(ex.text)}</span></p>` : ''}</div>`;
    }
    paint($('#t-min'), m);

    const cur = (S.days.get(k) || {}).siren || 0;
    paint($('#t-head'), `<span class="label">How loud is your head today?</span><div class="seg" role="group" aria-label="Head noise">${HEADS.map((h, i) => `<button type="button" class="seg-b hd" data-a="head" data-v="${i + 1}" aria-pressed="${cur === i + 1}">${h}</button>`).join('')}</div>`);

    renderBench();
    paint($('#log-chips'), chipList('log', L.track));
    paint($('#log-effort'), EFFORTS.map(x => `<button type="button" class="seg-b" data-a="effort" data-scope="log" data-v="${x}" aria-pressed="${L.effort === x}">${x}</button>`).join(''));

    paint($('#t-reps'), reps.length
      ? `<h2>Today’s reps</h2><ul class="reps">${reps.slice().reverse().map(r => repRow(r)).join('')}</ul>`
      : `<h2>Today’s reps</h2><p class="muted">None yet today. The first one is the heaviest.</p>`);

    const tl = $('#t-line'), line = (S.days.get(k) || {}).line || '';
    if (document.activeElement !== tl && tl.value !== line) tl.value = line;
  }

  function renderBench() {
    const el = $('#bench');
    const t = B.track ? trackById(B.track) : null;
    const tag = t ? `<span class="tag" style="--c:var(--${t.color})">${esc(t.name)}</span>` : '';
    let h = '';
    if (B.status === 'idle') {
      const tiny = t ? (t.tiny.length ? t.tiny : GENERIC_TINY) : [];
      h = `<div class="bench-top"><span class="label">Rep bench</span><span class="small muted">machine, then time, then start</span></div>
        <div class="chips" role="group" aria-label="Machine">${chipList('bench', B.track)}</div>
        <div class="seg" role="group" aria-label="Timer">${MODES.map(s => `<button type="button" class="seg-b" data-a="mode" data-sec="${s}" aria-pressed="${B.mode === s}">${s ? `${s / 60} min` : 'count up'}</button>`).join('')}</div>
        <div class="digits" id="b-digits">${clock(B.mode)}</div>
        <div><label class="label" for="b-plan">The rep (optional)</label><input id="b-plan" class="field" maxlength="200" placeholder="what you’re about to do" autocomplete="off"></div>
        ${tiny.length ? `<div class="tiny"><span class="small muted">Stuck? The smallest reps for ${esc(t.name)}:</span>${tiny.map(x => `<button type="button" class="tiny-b" data-a="tiny" data-scope="bench" data-text="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
        <button type="button" class="btn black big" data-a="start">${icon('play')} Start rep</button>`;
    } else if (B.status === 'running' || B.status === 'paused') {
      const e = elapsed();
      const shown = B.target ? clock(Math.ceil((B.target * 1000 - e) / 1000)) : clock(e / 1000);
      h = `<div class="bench-top">${tag}<span class="label">${B.status === 'paused' ? 'paused' : `set ${B.plus + 1}`}</span></div>
        ${B.note ? `<p class="plan">${esc(B.note)}</p>` : ''}
        <div class="digits" id="b-digits" role="timer" aria-live="off">${shown}</div>
        ${B.target ? `<div class="prog" aria-hidden="true"><i id="b-prog" style="width:${Math.min(100, e / (B.target * 10))}%"></i></div>` : ''}
        <div class="row">${B.status === 'running' ? '<button type="button" class="btn" data-a="pause">Pause</button>' : '<button type="button" class="btn" data-a="resume">Resume</button>'}<button type="button" class="btn black" data-a="finish">Finish rep</button></div>
        <p class="small muted" style="text-align:center">${B.target ? 'When it rings you can stop. Or go one more.' : 'Counting up. Stop whenever you want. It still counts.'}</p>`;
    } else if (B.status === 'setdone') {
      h = `<div class="bench-top">${tag}<span class="label">set done</span></div>
        <div class="digits" id="b-digits">${clock(B.target)}</div>
        <div class="prog" aria-hidden="true"><i style="width:100%"></i></div>
        <p class="big-q">Set done. This is exactly where you’d normally stop.</p>
        <div class="row"><button type="button" class="btn primary big" data-a="one-more">+1 · five more minutes</button><button type="button" class="btn black" data-a="finish">Finish rep</button></div>`;
    } else {
      h = `<div class="bench-top">${tag}<span class="label">rep done · ${fmtMins(Math.max(1, Math.round(B.acc / 60000)))}</span></div>
        <div><label class="label" for="f-note">What did you do?</label><input id="f-note" class="field" maxlength="280" placeholder="ugly is fine: read 2 posts, understood half" autocomplete="off"></div>
        <div class="f-row">
          <div><span class="label">How heavy</span><div class="seg" role="group" aria-label="How heavy">${EFFORTS.map(x => `<button type="button" class="seg-b" data-a="effort" data-scope="bench" data-v="${x}" aria-pressed="${B.effort === x}">${x}</button>`).join('')}</div></div>
          <div><label class="label" for="f-mins">Minutes</label><input id="f-mins" class="field num" type="number" min="1" max="600" inputmode="numeric"></div>
        </div>
        <div class="row"><button type="button" class="btn black big" data-a="save-rep">Save rep</button><button type="button" class="btn" data-a="one-more">+1 · five more</button><button type="button" class="btn ghost" data-a="toss">toss it</button></div>
        <p class="small muted" style="text-align:center">Future you only needs a clue, not an essay.</p>`;
    }
    if (paint(el, h)) {
      const plan = $('#b-plan'); if (plan) plan.value = B.note || '';
      const fn = $('#f-note'); if (fn) fn.value = B.note || '';
      const fm = $('#f-mins'); if (fm) fm.value = B.mins ?? Math.max(1, Math.round(B.acc / 60000));
    }
  }

  /* ---------------- BRAIN DUMP ---------------- */
  function renderDump() {
    const s = season();
    const all = [...S.thoughts.values()].sort((a, b) => b.at - a.at);
    const ideas = all.filter(t => t.kind !== 'noise');
    const parked = ideas.filter(t => !t.done).sort((a, b) => (b.kept - a.kept) || (b.at - a.at));
    const done = ideas.filter(t => t.done);
    const noise = all.filter(t => t.kind === 'noise');
    paint($('#d-hero'), heroHTML({
      crumbs: [`Season ${s ? s.n : 1}`, 'Brain dump'], kicker: 'The parking lot', icon: 'brain',
      title: 'Park it. Stop carrying it.',
      byline: `${plural(parked.length, 'thought')} parked · ${plural(done.length, 'thought')} turned into reps`,
      rule: 'Your head runs a million tabs at once. Type one out, press Enter, and it’s parked. Nothing here is a promise. Ideas wait until you want them. The ugly voice gets written down, and its words disappear after a day.',
    }));
    paint($('#dump-kind'), [['idea', 'an idea or a to-do'], ['noise', 'the ugly voice']].map(([v, l]) => `<button type="button" class="seg-b" data-a="kind" data-v="${v}" aria-pressed="${D.kind === v}">${l}</button>`).join(''));
    $('#dump-about').hidden = D.kind === 'noise';
    paint($('#dump-tracks'), chipList('dump', D.track, { none: true }));

    paint($('#d-parked'), `<h2>Parked (${parked.length})</h2>${parked.length ? `<ul class="thoughts">${parked.map(t => `<li class="thought${t.kept ? ' kept' : ''}">
      <p class="th-text">${esc(t.text)}</p>
      <div class="th-meta"><span class="small muted">${ago(t.at)}</span>${t.track ? `<span class="tag" style="--c:var(--${trackById(t.track).color})">${esc(trackById(t.track).name)}</span>` : ''}</div>
      <div class="row"><button type="button" class="btn sm black" data-a="th-do" data-id="${esc(t.id)}">Do it now</button><button type="button" class="btn sm" data-a="th-keep" data-id="${esc(t.id)}" aria-pressed="${t.kept}">${t.kept ? 'Kept' : 'Keep'}</button><button type="button" class="btn sm ghost" data-a="th-go" data-id="${esc(t.id)}">let it go</button></div>
    </li>`).join('')}</ul>` : '<p class="muted">Nothing parked. Your head might be quieter than you think.</p>'}`);

    const noiseDays = new Set(noise.map(t => t.day));
    const anyway = I().list.filter(r => noiseDays.has(r.day)).length;
    const fresh = noise.filter(t => t.text && Date.now() - t.at < DAY_MS);
    paint($('#d-noise'), noise.length ? `<div class="noise"><h2>The ugly voice</h2>
      <p class="noise-stats"><span>heard: ${noise.length}</span><span>reps done anyway on those days: ${anyway}</span></p>
      ${fresh.length ? `<ul>${fresh.map(t => `<li><s>${esc(t.text)}</s><span class="small muted">gone in ${Math.max(1, Math.ceil((DAY_MS - (Date.now() - t.at)) / 3600e3))}h</span></li>`).join('')}</ul>` : '<p class="small muted">Nothing from the last 24 hours. Older ones are already erased.</p>'}
      <p class="small muted">Written down, it’s just a sentence. You don’t have to argue with it.</p></div>` : '');

    paint($('#d-done'), done.length ? `<details class="log"><summary>Turned into reps (${done.length})</summary><ul class="mini" style="margin-top:10px">${done.map(t => `<li>${esc(t.text)} <span class="small muted">· ${ago(t.at)}</span></li>`).join('')}</ul></details>` : '');
  }

  /* ---------------- LOOK BACK ---------------- */
  function niceMax(m) {
    const steps = [30, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 900, 1200];
    return steps.find(x => x >= m) || Math.ceil(m / 300) * 300;
  }
  const axLabel = v => (v === 0 ? '0' : v < 60 ? `${v}m` : `${+(v / 60).toFixed(1)}h`);
  function chartSVG(s, selK, width) {
    const W = Math.max(300, Math.round(width)), H = 170, Lp = 38, Rp = 6, T = 20, Bt = 26;
    const today = todayKey(), cw = (W - Lp - Rp) / SEASON, bw = Math.max(4, Math.min(22, cw - 4));
    const data = Array.from({ length: SEASON }, (_, i) => {
      const k = addDays(s.start, i), rs = repsOn(k);
      return { i, k, m: sum(rs, r => +r.mins || 0), n: rs.length, fut: k > today };
    });
    const mx = niceMax(Math.max(...data.map(d => d.m)));
    const y = v => T + (H - T - Bt) * (1 - v / mx), base = y(0);
    let g = '', bars = '', hits = '', xl = '';
    for (const v of [0, mx / 2, mx]) g += `<line class="grid" x1="${Lp}" x2="${W - Rp}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${Lp - 6}" y="${y(v) + 4}" text-anchor="end">${axLabel(v)}</text>`;
    for (const d of data) {
      const x = Lp + d.i * cw + (cw - bw) / 2;
      if (d.m > 0) {
        const top = y(d.m), r = Math.min(4, base - top, bw / 2);
        bars += `<path class="bar${d.k === selK ? ' sel' : ''}" d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z"/>`;
      }
      if (!d.fut) hits += `<rect class="hit" x="${Lp + d.i * cw}" y="${T}" width="${cw}" height="${H - T - Bt + 4}" data-a="day" data-k="${d.k}" data-tip="Day ${d.i + 1} · ${fmtMins(d.m)} · ${plural(d.n, 'rep')}"/>`;
      if ([0, 9, 19, 29].includes(d.i)) xl += `<text class="ax" x="${Lp + d.i * cw + cw / 2}" y="${H - 8}" text-anchor="middle">${d.i + 1}</text>`;
      if (d.k === today) xl += `<text class="ax today" x="${Math.min(W - 20, Math.max(Lp + 14, Lp + d.i * cw + cw / 2))}" y="12" text-anchor="middle">today</text>`;
    }
    return `<span class="label">Minutes per day · season ${s.n}</span><svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Minutes logged per day in season ${s.n}">${g}${bars}${xl}${hits}</svg>`;
  }
  function stripHTML(s, selK) {
    const today = todayKey();
    let h = `<span class="label">The 30 days</span><div class="strip" role="group" aria-label="Days of the season">`;
    for (let i = 0; i < SEASON; i++) {
      const k = addDays(s.start, i), c = repsOn(k).length, fut = k > today;
      h += `<button type="button" class="cell${c >= MIN_REPS ? ' l2' : c === 1 ? ' l1' : ''}${k === today ? ' now' : ''}" data-a="day" data-k="${k}" ${fut ? 'disabled' : ''} aria-pressed="${k === selK}" aria-label="Day ${i + 1}: ${fut ? 'not yet' : plural(c, 'rep')}">${i + 1}</button>`;
    }
    return `${h}</div><div class="legend"><span><i class="lg0"></i>zero day</span><span><i class="lg1"></i>1 rep</span><span><i class="lg2"></i>minimum met</span><span><i style="outline:2px solid var(--ink)"></i>today</span></div>`;
  }
  function dayPageHTML(s, n) {
    const k = addDays(s.start, n - 1), rs = repsOn(k), d = S.days.get(k) || {}, w = weekOf(n);
    const ideas = [...S.thoughts.values()].filter(t => t.kind !== 'noise' && t.day === k);
    const status = rs.length >= MIN_REPS ? 'minimum met' : rs.length ? 'one short' : 'zero day';
    return `<article class="daypage">
      <span class="label">${numLabel(n)} · ${esc(WEEKS[w].name)} · day ${n} of ${SEASON}</span>
      <h2>${fmtDay(k, { weekday: 'long', day: 'numeric', month: 'long' })}${k === todayKey() ? ' · today' : ''}</h2>
      <p class="daymeta">head: ${d.siren ? HEADS[d.siren - 1] : 'not logged'} · ${plural(rs.length, 'rep')} · ${fmtMins(sum(rs, r => +r.mins || 0))} · ${status}</p>
      <div><label class="label" for="b-line">One line for this day</label><input id="b-line" class="field" data-k="${k}" maxlength="300" placeholder="how it went, in one line" autocomplete="off"></div>
      ${rs.length ? `<ul class="reps">${rs.map(r => repRow(r)).join('')}</ul>` : `<p class="muted">Nothing logged this day. That’s data too.${k === todayKey() ? ' <button type="button" class="btn sm" data-a="go-bench">Log a rep</button>' : ''}</p>`}
      ${ideas.length ? `<div><span class="label">Thoughts parked this day</span><ul class="mini">${ideas.map(t => `<li>${esc(t.text)}</li>`).join('')}</ul></div>` : ''}
    </article>`;
  }
  function exampleDayHTML() {
    const ex = [
      ['9:40 PM', 'GitHub', 'lilac', 'pushed a README fix for the CP repo', '25 min', '+1'],
      ['11:15 PM', 'Upwork', 'mint', 'read 3 posts, saved one about n8n agents', '15 min', ''],
    ];
    return `<article class="daypage example"><span class="ex-badge">example</span>
      <span class="label">1.3 · Bike week · day 3 of 30</span>
      <h2>A day, once you’ve logged it</h2>
      <p class="daymeta">head: loud · 2 reps · 40 min · minimum met</p>
      <p class="dayline">“Didn’t want to. Did it anyway.”</p>
      <ul class="reps">${ex.map(([t, n, c, note, m, p]) => `<li class="rep"><span class="rep-time">${t}</span><span class="tag" style="--c:var(--${c})">${n}</span><span class="rep-note">${note}${p ? ` <span class="plus">${p}</span>` : ''}</span><span class="rep-min">${m}</span><span></span></li>`).join('')}</ul>
    </article>`;
  }
  function setPager(s, n, maxN) {
    const pv = $('#pg-prev'), nx = $('#pg-next');
    if (!s) { pv.disabled = nx.disabled = true; pv.textContent = '← back'; nx.textContent = 'next →'; return; }
    pv.disabled = n <= 1;
    nx.disabled = n >= maxN;
    pv.textContent = n > 1 ? `← ${numLabel(n - 1)} back` : '← day 1';
    nx.textContent = n < maxN ? `next → ${numLabel(n + 1)}` : (maxN < SEASON ? 'next → tomorrow' : 'last day');
  }
  function backState() {
    const ss = P().seasons;
    if (!ss.length) return null;
    const si = V.si != null && ss[V.si] ? V.si : ss.length - 1;
    const s = ss[si];
    const maxN = Math.max(1, Math.min(SEASON, diffDays(s.start, todayKey()) + 1));
    let n = V.k ? diffDays(s.start, V.k) + 1 : maxN;
    if (!(n >= 1 && n <= maxN)) n = maxN;
    V.k = addDays(s.start, n - 1);
    return { ss, si, s, maxN, n };
  }
  function renderBack() {
    const st = backState();
    if (!st) {
      paint($('#b-hero'), heroHTML({ crumbs: ['Season 1', 'Look back'], kicker: 'Your timeline', icon: 'clock', title: 'Look back', byline: 'Nothing logged yet', rule: 'Every rep you log lands here, day by day. Tap a day to read it back. Below is what a day will look like.' }));
      paint($('#b-chart'), '');
      paint($('#b-strip'), '');
      paint($('#b-day'), exampleDayHTML());
      setPager(null);
      return;
    }
    const { ss, si, s, maxN, n } = st;
    const stats = seasonStats(s);
    const pick = ss.length > 1 ? `<div class="row" style="justify-content:center">${ss.map((x, i) => `<button type="button" class="btn sm" data-a="season-pick" data-i="${i}" aria-pressed="${i === si}">Season ${x.n}</button>`).join('')}</div>` : '';
    paint($('#b-hero'), heroHTML({
      crumbs: [`Season ${s.n}`, 'Look back'], kicker: 'Your timeline', icon: 'clock', title: 'Look back',
      byline: `${stats.shown} of ${stats.n} days shown up · ${plural(stats.reps, 'rep')} · ${fmtMins(stats.mins)}`,
      rule: 'Every rep lands here. The bars are minutes per day. Tap a day to read it back.', extra: pick,
    }));
    const box = $('#b-chart');
    paint(box, chartSVG(s, V.k, box.clientWidth || 640));
    paint($('#b-strip'), stripHTML(s, V.k));
    if (paint($('#b-day'), dayPageHTML(s, n))) {
      const bl = $('#b-line'); if (bl) bl.value = (S.days.get(V.k) || {}).line || '';
    }
    setPager(s, n, maxN);
  }

  /* ---------------- GRAND SCHEME ---------------- */
  function barbellSVG(color, L) {
    const shown = Math.min(L, 8);
    let plates = '';
    for (let i = 0; i < shown; i++) {
      const h = Math.max(30, 66 - i * 5), w = 9, y = 45 - h / 2;
      plates += `<rect x="${92 - (i + 1) * (w + 2)}" y="${y}" width="${w}" height="${h}" rx="2"/><rect x="${190 + i * (w + 2)}" y="${y}" width="${w}" height="${h}" rx="2"/>`;
    }
    const label = L === 0 ? 'just the bar' : L > 8 ? `+${L - 8} more plates` : '';
    return `<svg class="barbell" viewBox="0 0 280 92" role="img" aria-label="${plural(L, 'plate')} on the bar">
      <rect class="bb-sleeve" x="4" y="41" width="88" height="8" rx="2"/><rect class="bb-sleeve" x="188" y="41" width="88" height="8" rx="2"/>
      <rect class="bb-bar" x="96" y="43" width="88" height="4" rx="2"/>
      <rect class="bb-collar" x="92" y="35" width="4" height="20" rx="1"/><rect class="bb-collar" x="184" y="35" width="4" height="20" rx="1"/>
      <g class="bb-plates" style="--c:var(--${color})">${plates}</g>
      ${label ? `<text class="bb-t" x="140" y="88">${label}</text>` : ''}</svg>`;
  }
  function machineHTML(t) {
    if (E.id === t.id) {
      return `<article class="machine editing">
        <div><label class="label" for="e-name">Name</label><input id="e-name" class="field" maxlength="40" autocomplete="off"></div>
        <div><span class="label">Colour</span><div class="swatches">${COLORS.map(c => `<button type="button" class="sw" style="--c:var(--${c})" data-a="e-color" data-v="${c}" aria-pressed="${E.color === c}" aria-label="${c}"></button>`).join('')}</div></div>
        <div><label class="label" for="e-tiny">Smallest reps, one per line</label><textarea id="e-tiny" class="field" rows="3"></textarea></div>
        <div class="row"><button type="button" class="btn black sm" data-a="e-save">Save</button><button type="button" class="btn sm" data-a="e-cancel">Cancel</button><button type="button" class="btn sm ghost" data-a="e-remove">remove machine</button></div>
        <p class="small muted">Removing only hides it from the lists. Its reps stay in your timeline.</p></article>`;
    }
    const st = trackStats(t.id), Lv = st.lvl, into = st.xp - need(Lv), span = need(Lv + 1) - need(Lv);
    const proof = st.first
      ? `<dl class="m-proof"><div><dt>First rep</dt><dd>${esc(st.first.note || 'no note')} <span class="muted small">· ${fmtDay(st.first.day, { day: 'numeric', month: 'short' })}</span></dd></div>${st.reps > 1 ? `<div><dt>Latest</dt><dd>${esc(st.last.note || 'no note')} <span class="muted small">· ${fmtDay(st.last.day, { day: 'numeric', month: 'short' })}</span></dd></div>` : ''}</dl>`
      : `<p class="small muted">No reps yet. Smallest one: ${esc((t.tiny[0] || GENERIC_TINY[0]).toLowerCase())}.</p>`;
    return `<article class="machine">
      <header class="m-top"><span class="tag" style="--c:var(--${t.color})">${esc(t.name)}</span><span class="m-lvl">Lv ${Lv}</span></header>
      ${barbellSVG(t.color, Lv)}
      <p class="m-stats">${plural(st.reps, 'rep')} · ${fmtMins(st.mins)}${st.last ? ` · last ${ago(st.last.at)}` : ''}</p>
      <div class="m-next"><div class="prog sm" aria-hidden="true"><i style="width:${Math.round((into / span) * 100)}%"></i></div><span class="small muted">${need(Lv + 1) - st.xp} xp to plate ${Lv + 1}</span></div>
      ${proof}
      <button type="button" class="link-b" data-a="edit-track" data-id="${esc(t.id)}">edit</button>
    </article>`;
  }
  function seasonBarHTML(s) {
    const today = todayKey();
    let h = '';
    for (let i = 0; i < SEASON; i++) {
      const k = addDays(s.start, i), c = repsOn(k).length, fut = k > today;
      h += `<i class="sb ${fut ? 'fut' : c >= MIN_REPS ? 'met' : c ? 'one' : 'zero'}${k === today ? ' now' : ''}" title="Day ${i + 1}: ${fut ? 'ahead' : plural(c, 'rep')}"></i>`;
    }
    return `<div class="sbar" role="img" aria-label="Season ${s.n}, one bar per day">${h}</div>`;
  }
  function renderScheme() {
    const s = season(), today = todayKey(), n = dayIdx(s, today), vt = visTracks();
    const total = I().list.length;
    const film = s ? addDays(s.start, SEASON - 1) : null, fd = film ? diffDays(today, film) : null;
    const filmTxt = !s ? '30 days after rep 1' : fd > 0 ? `film day in ${plural(fd, 'day')}` : fd === 0 ? 'film day is today' : `film day was ${fmtDay(film, { day: 'numeric', month: 'short' })}`;
    const chain = `<div class="chain" aria-label="How it links up">
      <div class="lnk"><b>${total}</b><span>reps</span></div>${icon('arrow')}
      <div class="lnk"><b>${vt.length}</b><span>machines</span></div>${icon('arrow')}
      <div class="lnk"><b>${s ? (n <= SEASON ? `day ${n}/${SEASON}` : 'done') : 'day 0'}</b><span>season ${s ? s.n : 1}</span></div>${icon('arrow')}
      <div class="lnk"><b>1 video</b><span>${esc(filmTxt)}</span></div></div>`;
    paint($('#s-hero'), heroHTML({
      crumbs: [`Season ${s ? s.n : 1}`, 'Grand scheme'], kicker: 'How it all links up', icon: 'link', title: 'The grand scheme',
      byline: P().goal ? `All of it feeds: ${P().goal}` : 'Written by you',
      rule: 'Every rep feeds a machine. Every machine feeds the season. The season ends in a video.', extra: chain,
    }));

    if (s) {
      const st = seasonStats(s);
      paint($('#s-season'), `<h2>Season ${s.n}</h2>${seasonBarHTML(s)}<p class="stats"><span><b>${st.shown}</b> of ${st.n} days shown up</span><span><b>${st.met}</b> minimum days</span><span>longest run <b>${st.best}</b></span><span><b>${fmtMins(st.mins)}</b> total</span></p>`);
    } else {
      paint($('#s-season'), `<h2>Season 1</h2><p class="muted">Starts with your first rep. Thirty days, one bar each. A dashed bar is a zero day, a full bar means you hit the minimum.</p>`);
    }
    const gi = $('#s-goal');
    if (document.activeElement !== gi && gi.value !== P().goal) gi.value = P().goal;

    const hiddenWithReps = P().tracks.filter(t => t.hidden && (I().byTrack.get(t.id) || []).length);
    if (paint($('#s-machines'), vt.map(machineHTML).join('') + (hiddenWithReps.length ? `<p class="small muted">Removed machines with history: ${hiddenWithReps.map(t => esc(t.name)).join(', ')}.</p>` : ''))) {
      const en = $('#e-name'); if (en) en.value = E.name;
      const et = $('#e-tiny'); if (et) et.value = E.tiny;
    }

    const filmLine = !s ? 'Film day is 30 days after your first rep.'
      : fd > 0 ? `Film day: ${fmtDay(film, { weekday: 'long', day: 'numeric', month: 'long' })}, in ${plural(fd, 'day')}.`
        : fd === 0 ? 'Film day is today. Hit record.' : `Film day was ${fmtDay(film, { day: 'numeric', month: 'long' })}. Still worth filming.`;
    if (paint($('#s-video'), `<h2>Month video</h2><p class="film">${esc(filmLine)}</p>
      <p class="small muted">The outline writes itself from your reps: a hook, the rules, each machine’s first rep next to its latest rep, the hardest day, and the numbers.</p>
      <div class="row"><button type="button" class="btn primary" data-a="outline">${V.outlineOpen ? 'Rebuild the outline' : 'Build my outline'}</button></div>
      ${V.outlineOpen ? `<textarea id="outline" class="field outline" readonly rows="18" aria-label="Video outline"></textarea>
        <div class="row"><button type="button" class="btn black" data-a="copy-outline">Copy</button><button type="button" class="btn" data-a="save-outline">Save as .md</button></div>` : ''}
      ${s ? `<div style="border-top:1px dashed var(--line);padding-top:12px;display:flex;flex-direction:column;gap:10px">
        <span class="label">Public recap page</span>
        <p class="small">Want it public, like a blog? This saves a standalone page with your numbers and rep notes. Head levels, the brain dump and the ugly voice are never included. Put the file in your repo’s <code>public/posts</code> folder and it goes live on your site.</p>
        <label class="check"><input type="checkbox" id="recap-lines"> include my one-line diary entries</label>
        <div class="row"><button type="button" class="btn" data-a="save-recap">Save recap page (.html)</button></div></div>` : ''}`)) {
      const o = $('#outline'); if (o) o.value = V.outline;
      const rl = $('#recap-lines'); if (rl) rl.checked = V.recapLines;
    }

    const lb = P().lastBackup;
    const needBackup = total >= 5 && (!lb || Date.now() - lb > 7 * DAY_MS);
    const ns = s && n > SEASON
      ? `<div class="row"><button type="button" class="btn black" data-a="new-season">Start season ${s.n + 1} today</button></div>`
      : `<p class="small muted">${s ? `Season ${s.n + 1} unlocks after film day.` : 'Season 1 starts with your first rep.'} There’s no reset button on purpose.</p>`;
    paint($('#s-data'), `<h2>Your data</h2>
      <p>Everything lives in this browser on this device. Nobody else who opens the site can see it, and it doesn’t sync to your phone by itself.</p>
      ${needBackup ? `<p class="warn">Last backup: ${lb ? ago(lb) : 'never'}. If this browser’s data gets cleared, the diary goes with it.</p>` : `<p class="small muted">Last backup: ${lb ? ago(lb) : 'never'}.</p>`}
      <div class="row"><button type="button" class="btn black" data-a="backup">Save a backup (.json)</button><button type="button" class="btn" data-a="import">Load a backup</button><button type="button" class="btn" data-a="diary-md">Save diary as text (.md)</button></div>
      <p class="small muted">To use it on another device: save a backup here, open the site there, and load the backup. Loading adds entries and never deletes any.</p>
      ${ns}`);
  }

  /* ---------------- outline, diary, recap ---------------- */
  function buildOutline() {
    const s = season();
    if (!s) return 'Log your first rep. This outline fills itself in from what you do.';
    const end = addDays(s.start, SEASON - 1), st = seasonStats(s);
    const reps = I().list.filter(r => r.day >= s.start && r.day <= end);
    const dn = r => diffDays(s.start, r.day) + 1;
    const used = [...new Set(reps.map(r => r.track))];
    const noise = [...S.thoughts.values()].filter(t => t.kind === 'noise' && t.day >= s.start && t.day <= end);
    const out = [];
    out.push(`SEASON ${s.n} · VIDEO OUTLINE`, `${fmtDay(s.start, { day: 'numeric', month: 'short' })} to ${fmtDay(end, { day: 'numeric', month: 'short' })}`, '');
    out.push('TITLE IDEAS', `- I put ${reps.length} reps into everything for 30 days`, `- 30 days of showing up ugly (${fmtMins(st.mins)} of work)`, '- Day 1 vs day 30: what tiny reps actually did', '');
    out.push('HOOK', `A month ago I couldn’t keep a diary past day 3. This month I logged ${plural(reps.length, 'rep')} across ${plural(used.length, 'thing')}: ${fmtMins(st.mins)} of actual work.`, '');
    if (P().goal) out.push('WHAT IT’S ALL FOR', P().goal, '');
    out.push('THE RULES', '- A rep is any honest attempt. Five minutes counts. Ugly counts.', '- Two reps a day, like the week I learned to ride the bike: twice a day, sirens or not.', '- Each week added one rule: same road, add a plate, failure +1.', '');
    out.push('THE NUMBERS', `- Showed up ${st.shown} of ${st.n} days`, `- Hit the two-rep minimum on ${plural(st.met, 'day')}`, `- Longest run: ${plural(st.best, 'day')}`, `- Pressed “one more” ${reps.filter(r => r.plus).length} times`);
    if (noise.length) out.push(`- The ugly voice got written down ${noise.length} times. I did the reps anyway.`);
    out.push('', 'MACHINE BY MACHINE');
    const byT = used.map(id => ({ id, rs: reps.filter(r => r.track === id) })).sort((a, b) => sum(b.rs, r => +r.mins || 0) - sum(a.rs, r => +r.mins || 0));
    for (const { id, rs } of byT) {
      const t = trackById(id, rs[0].trackName);
      out.push('', `${t.name}: ${plural(rs.length, 'rep')}, ${fmtMins(sum(rs, r => +r.mins || 0))}, level ${trackStats(id).lvl}`);
      out.push(`  First rep (day ${dn(rs[0])}): ${rs[0].note || 'no note'}`);
      if (rs.length > 1) out.push(`  Latest rep (day ${dn(rs[rs.length - 1])}): ${rs[rs.length - 1].note || 'no note'}`);
    }
    if (!byT.length) out.push('', '(no reps yet)');
    let hard = null, big = null;
    for (let i = 0; i < st.n; i++) {
      const k = addDays(s.start, i), rs = repsOn(k), d = S.days.get(k) || {}, m = sum(rs, r => +r.mins || 0);
      if (rs.length && d.siren >= 4 && (!hard || d.siren > hard.h || (d.siren === hard.h && rs.length > hard.c))) hard = { i, h: d.siren, c: rs.length, line: d.line };
      if (m && (!big || m > big.m)) big = { i, m, c: rs.length };
    }
    if (hard) out.push('', 'THE HARDEST DAY', `Day ${hard.i + 1}: my head was on “${HEADS[hard.h - 1]}” and I still did ${plural(hard.c, 'rep')}.${hard.line ? ` That day I wrote: “${hard.line}”` : ''}`);
    if (big) out.push('', 'BIGGEST DAY', `Day ${big.i + 1}: ${fmtMins(big.m)} across ${plural(big.c, 'rep')}.`);
    out.push('', 'WHAT CHANGED', '[Say it in your own words. Read a first rep and a latest rep out loud.]', '', 'NEXT SEASON', '[Which machine gets a heavier plate next month?]');
    return out.join('\n');
  }
  function diaryMD() {
    const keys = [...new Set([...I().byDay.keys(), ...S.days.keys()])].sort();
    let out = `# One More Rep diary\n\nSaved ${fmtDay(todayKey(), { day: 'numeric', month: 'long', year: 'numeric' })}\n`;
    if (P().goal) out += `\nWhat it all feeds: ${P().goal}\n`;
    for (const k of keys) {
      const rs = repsOn(k), d = S.days.get(k) || {}, sd = seasonOfDay(k);
      if (!rs.length && !d.line && !d.siren) continue;
      out += `\n## ${fmtDay(k, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${sd ? ` · season ${sd.s.n}, day ${sd.n}` : ''}${d.siren ? ` · head: ${HEADS[d.siren - 1]}` : ''}\n`;
      if (d.line) out += `\n> ${d.line}\n`;
      if (rs.length) out += '\n' + rs.map(r => `- ${fmtTime(r.at)} · ${trackById(r.track, r.trackName).name} · ${fmtMins(r.mins)}${r.plus ? ` · +${r.plus}` : ''}${r.note ? ` · ${r.note}` : ''}`).join('\n') + '\n';
    }
    const ideas = [...S.thoughts.values()].filter(t => t.kind !== 'noise').sort((a, b) => a.at - b.at);
    if (ideas.length) out += `\n## Parked thoughts\n\n${ideas.map(t => `- [${t.done ? 'x' : ' '}] ${t.text}`).join('\n')}\n`;
    return out;
  }
  function recapHTML(withLines) {
    const s = season(), end = addDays(s.start, SEASON - 1), st = seasonStats(s);
    const reps = I().list.filter(r => r.day >= s.start && r.day <= end);
    const used = [...new Set(reps.map(r => r.track))].map(id => ({ t: trackById(id, (reps.find(r => r.track === id) || {}).trackName), rs: reps.filter(r => r.track === id) }))
      .sort((a, b) => sum(b.rs, r => +r.mins || 0) - sum(a.rs, r => +r.mins || 0));
    const pal = { mint: '#bfe7e1', lilac: '#d8ccfb', peach: '#ffd4bf', butter: '#f5e59c', rose: '#f7c8db', sky: '#c5dbfb', sage: '#d2e6bd', sand: '#eadbc6', coral: '#ffc0b4' };
    let days = '';
    for (let i = 0; i < st.n; i++) {
      const k = addDays(s.start, i), rs = repsOn(k), line = withLines ? (S.days.get(k) || {}).line : '';
      if (!rs.length && !line) continue;
      days += `<section class="day"><h3><span>${numLabel(i + 1)}</span> ${esc(fmtDay(k, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>${line ? `<p class="line">“${esc(line)}”</p>` : ''}<ul>${rs.map(r => { const t = trackById(r.track, r.trackName); return `<li><span class="tag" style="background:${pal[t.color] || pal.sand}">${esc(t.name)}</span> ${esc(r.note || 'no note')} <span class="m">${fmtMins(r.mins)}${r.plus ? ` · +${r.plus}` : ''}</span></li>`; }).join('')}</ul></section>`;
    }
    const title = `Season ${s.n}: ${reps.length} reps in 30 days`;
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&family=Roboto+Mono:wght@500;700&family=Sora:wght@700;800&display=swap">
<style>
:root{--paper:#fbfbfd;--ink:#15161b;--ink2:#4b4e5a;--line:#e2e4ec;--band:#cdebea}
@media (prefers-color-scheme:dark){:root{--paper:#131419;--ink:#eef0f5;--ink2:#b9bdc9;--line:#2d303a;--band:#193334}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 Figtree,system-ui,sans-serif}
header{background:var(--band);padding:40px 16px;text-align:center;border-bottom:1px solid var(--line)}
header p{margin:0;color:var(--ink2);font-size:13px}h1{font:800 clamp(28px,6vw,44px)/1.1 Sora,system-ui,sans-serif;letter-spacing:-.02em;margin:10px auto;max-width:20ch}
main{max-width:720px;margin:0 auto;padding:28px 16px 60px}.stats{display:flex;flex-wrap:wrap;gap:6px 20px;font:500 14px 'Roboto Mono',monospace;color:var(--ink2);justify-content:center;margin-top:14px}.stats b{color:var(--ink)}
h2{font:700 20px Sora,system-ui,sans-serif;margin:34px 0 12px}h3{font:700 16px Sora,system-ui,sans-serif;margin:0 0 6px}h3 span{font-family:'Roboto Mono',monospace;color:var(--ink2);margin-right:6px}
.day{padding:14px 0;border-bottom:1px dashed var(--line)}.line{font-style:italic;margin:0 0 6px}ul{margin:0;padding:0;list-style:none}li{margin:4px 0;overflow-wrap:anywhere}
.tag{display:inline-block;font:600 12px/1 Figtree,sans-serif;padding:4px 8px;border-radius:99px;color:#17181e;margin-right:4px}.m{font:500 12.5px 'Roboto Mono',monospace;color:var(--ink2)}
.mach{padding:10px 0;border-bottom:1px dashed var(--line)}.mach p{margin:4px 0}footer{text-align:center;color:var(--ink2);font-size:12.5px;padding:0 16px 40px}
</style></head><body>
<header><p>${esc(fmtDay(s.start, { day: 'numeric', month: 'long' }))} to ${esc(fmtDay(end, { day: 'numeric', month: 'long', year: 'numeric' }))}</p><h1>${esc(title)}</h1>
<div class="stats"><span><b>${st.shown}</b>/30 days shown up</span><span><b>${fmtMins(st.mins)}</b> of work</span><span>longest run <b>${st.best}</b> days</span></div></header>
<main>${P().goal ? `<p style="text-align:center">What it all feeds: <b>${esc(P().goal)}</b></p>` : ''}
<h2>Machine by machine</h2>${used.map(({ t, rs }) => `<div class="mach"><span class="tag" style="background:${pal[t.color] || pal.sand}">${esc(t.name)}</span> <span class="m">${plural(rs.length, 'rep')} · ${fmtMins(sum(rs, r => +r.mins || 0))}</span><p><b>First rep:</b> ${esc(rs[0].note || 'no note')}</p>${rs.length > 1 ? `<p><b>Latest:</b> ${esc(rs[rs.length - 1].note || 'no note')}</p>` : ''}</div>`).join('')}
<h2>Day by day</h2>${days || '<p>No reps logged yet.</p>'}</main>
<footer>Logged one rep at a time with One More Rep.</footer></body></html>`;
  }
  function download(name, text, type) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch (e) {
      toast('This browser couldn’t create the file. Try Copy instead.');
      return false;
    }
  }
  function copyText(text, ta) {
    const fallback = () => { if (ta) { ta.focus(); ta.select(); } toast('Selected. Press Ctrl+C, or long-press and choose Copy.'); };
    try {
      const p = navigator.clipboard && navigator.clipboard.writeText(text);
      if (p) p.then(() => toast('Copied.'), fallback); else fallback();
    } catch (e) { fallback(); }
  }

  /* ---------------- footer, pill, title ---------------- */
  function renderFooter() {
    const msg = S.volatile ? 'This browser isn’t letting the page save anything, so entries vanish when you close it. Save a backup before you leave.'
      : S.full ? 'Browser storage is full. Save a backup, then delete old reps you don’t need.'
        : 'Saved in this browser only. Nobody else who opens the site sees your entries.';
    paint($('#foot'), `<p>${esc(msg)}</p><p>Days roll over at 4am, so a 1am rep counts for the day before.</p>`);
  }
  function benchText() {
    const e = elapsed();
    if (B.status === 'running') return B.target ? clock(Math.ceil((B.target * 1000 - e) / 1000)) : clock(e / 1000);
    if (B.status === 'paused') return 'paused';
    if (B.status === 'setdone') return 'set done';
    return 'save it';
  }
  function renderPill() {
    const p = $('#pill'), active = B.status !== 'idle';
    p.hidden = !active;
    if (!active) { if (document.title !== 'One More Rep') document.title = 'One More Rep'; return; }
    const t = trackById(B.track), txt = benchText();
    const html = `<span class="dot${B.status === 'running' ? ' on' : ''}"></span>${esc(txt)}<span class="pill-name"> · ${esc(t.name)}</span>`;
    if (p.innerHTML !== html) p.innerHTML = html;
    const title = `${txt} · ${t.name} · One More Rep`;
    if (document.title !== title) document.title = title;
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; renderAll(); });
  }
  function renderAll() {
    if (view === 'today') renderToday();
    else if (view === 'dump') renderDump();
    else if (view === 'back') renderBack();
    else renderScheme();
    renderFooter();
    renderPill();
  }

  /* ---------------- views ---------------- */
  const VIEWS = ['today', 'dump', 'back', 'scheme'];
  function setView(v, scroll = true) {
    if (!VIEWS.includes(v)) v = 'today';
    view = v;
    for (const s of $$('.view')) s.hidden = s.id !== `v-${v}`;
    for (const t of $$('.tab')) t.setAttribute('aria-selected', String(t.dataset.view === v));
    $('#pager').hidden = v !== 'back';
    try { history.replaceState(null, '', `#${v}`); } catch (e) { /* ignore */ }
    if (scroll) window.scrollTo(0, 0);
    renderAll();
  }
  function scrollToBench() {
    const b = $('#bench');
    requestAnimationFrame(() => {
      b.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
    });
  }

  /* ---------------- sound + wake lock ---------------- */
  let actx = null, wake = null;
  function initAudio() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
  }
  function chime() {
    if (!actx) return;
    try {
      const t0 = actx.currentTime;
      [660, 880, 1320].forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = t0 + i * 0.18;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g).connect(actx.destination);
        o.start(t); o.stop(t + 0.55);
      });
    } catch (e) { /* ignore */ }
  }
  async function lockOn() { try { wake = navigator.wakeLock ? await navigator.wakeLock.request('screen') : null; } catch (e) { wake = null; } }
  function lockOff() { try { wake && wake.release(); } catch (e) { /* ignore */ } wake = null; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && B.status === 'running' && !wake) lockOn(); });

  /* ---------------- toast ---------------- */
  let toastT = 0;
  function toast(msg, ms = 2800) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), ms);
  }
  function arm(b, label) {
    if (b.dataset.armed === '1') return true;
    const old = b.innerHTML;
    b.dataset.armed = '1'; b.classList.add('armed'); b.textContent = label;
    setTimeout(() => { if (b.isConnected) { b.dataset.armed = ''; b.classList.remove('armed'); b.innerHTML = old; } }, 3000);
    return false;
  }

  /* ---------------- bench actions ---------------- */
  function start() {
    if (!B.track || !P().tracks.some(t => t.id === B.track)) { toast('Pick a machine first. Any one.'); return; }
    initAudio();
    Object.assign(B, { status: 'running', target: B.mode, acc: 0, plus: 0, startedAt: Date.now(), mins: null });
    saveBench(); lockOn(); renderBench(); renderPill();
  }
  function pause() { B.acc = elapsed(); B.startedAt = null; B.status = 'paused'; saveBench(); lockOff(); renderBench(); renderPill(); }
  function resume() { initAudio(); B.startedAt = Date.now(); B.status = 'running'; saveBench(); lockOn(); renderBench(); renderPill(); }
  function finish() {
    B.acc = elapsed(); B.startedAt = null; B.status = 'finishing';
    B.mins = Math.max(1, Math.round(B.acc / 60000));
    saveBench(); lockOff(); renderBench(); renderPill();
    setTimeout(() => { const f = $('#f-note'); if (f && !f.value) f.focus(); }, 60);
  }
  function oneMore() {
    initAudio();
    const e = elapsed();
    Object.assign(B, { target: Math.ceil(e / 1000) + 300, plus: B.plus + 1, acc: e, startedAt: Date.now(), status: 'running', mins: null });
    saveBench(); lockOn(); renderBench(); renderPill();
    toast(`+${B.plus}. Five more minutes. This is the rep that counts.`);
  }
  function resetBench() { B = freshBench({ track: B.track, mode: B.mode }); saveBench(); }
  function addRep(r) {
    const before = trackStats(r.track).lvl;
    putRep(r);
    askPersist();
    const p = P();
    if (!p.seasons.length) {
      p.seasons = [{ n: 1, start: r.day }];
      saveProfile();
      toast('Day 1. Season 1 has started.', 3500);
    } else if (p.seasons.length === 1 && r.day < p.seasons[0].start) {
      p.seasons[0].start = r.day; saveProfile();
    } else {
      const after = trackStats(r.track).lvl, t = trackById(r.track);
      const count = repsOn(r.day).length;
      toast(after > before ? `New plate on ${t.name}. Level ${after}.` : count === MIN_REPS && r.day === todayKey() ? 'Two reps. Today counts.' : `Rep saved. ${t.name} +${xpOf(r)} xp.`);
    }
  }
  function saveRepFromBench() {
    const fm = $('#f-mins'), fn = $('#f-note');
    let mins = parseInt(fm ? fm.value : B.mins, 10);
    if (!(mins >= 1)) mins = Math.max(1, Math.round(B.acc / 60000));
    mins = Math.min(mins, 600);
    const note = String(fn ? fn.value : B.note || '').trim().slice(0, 280);
    const t = trackById(B.track), now = Date.now();
    const r = { id: uid('r'), track: B.track, trackName: t.name, mins, note, effort: B.effort || 'solid', plus: B.plus || 0, at: now, day: dayKeyOf(now), how: 'timer' };
    const thoughtId = B.thoughtId;
    resetBench();
    addRep(r);
    if (thoughtId && S.thoughts.has(thoughtId)) putThought({ ...S.thoughts.get(thoughtId), done: true, repId: r.id });
    renderBench(); renderPill();
  }
  function logSave() {
    if (!L.track) { toast('Pick which machine it was.'); return; }
    const mi = $('#log-mins'), m = parseInt(mi.value, 10);
    if (!(m >= 1)) { toast('Roughly how many minutes? A guess is fine.'); mi.focus(); return; }
    const at = $('#log-when').value === 'yesterday' ? Date.now() - DAY_MS : Date.now();
    const t = trackById(L.track);
    addRep({ id: uid('r'), track: L.track, trackName: t.name, mins: Math.min(m, 600), note: $('#log-note').value.trim().slice(0, 280), effort: L.effort, plus: 0, at, day: dayKeyOf(at), how: 'log' });
    mi.value = ''; $('#log-note').value = '';
  }
  function setHead(v) {
    const k = todayKey(), d = { ...(S.days.get(k) || {}) };
    d.siren = d.siren === v ? 0 : v;
    putDay(k, d);
    if (d.siren === 5 && !repsOn(k).length) openSiren();
    else if (d.siren === 4) toast('Loud is allowed. Keep the reps small today.');
  }
  const lineT = {};
  function queueLine(k, val, now) {
    clearTimeout(lineT[k]);
    const run = () => {
      const d = { ...(S.days.get(k) || {}) };
      const v = val.slice(0, 300);
      if ((d.line || '') === v) return;
      d.line = v; putDay(k, d);
    };
    if (now) run(); else lineT[k] = setTimeout(run, 700);
  }
  let goalT = 0;
  function queueGoal(val, now) {
    clearTimeout(goalT);
    const run = () => { const v = val.slice(0, 160); if (P().goal !== v) { P().goal = v; saveProfile(); } };
    if (now) run(); else goalT = setTimeout(run, 800);
  }

  /* ---------------- sirens mode ---------------- */
  function openSiren() {
    const last = I().list[I().list.length - 1];
    Z.track = last && visTracks().some(t => t.id === last.track) ? last.track : (visTracks()[0] || {}).id || null;
    Z.tiny = null;
    renderSiren();
    $('#siren').hidden = false;
    document.body.classList.add('lock');
    setTimeout(() => $('#siren .sheet').focus(), 30);
  }
  function closeSiren() { $('#siren').hidden = true; document.body.classList.remove('lock'); }
  function renderSiren() {
    $('#z-tracks').innerHTML = chipList('siren', Z.track);
    const t = Z.track ? trackById(Z.track) : null;
    const list = t ? (t.tiny.length ? t.tiny : GENERIC_TINY) : [];
    if (!Z.tiny || !list.includes(Z.tiny)) Z.tiny = list[0] || null;
    $('#z-tiny').innerHTML = list.map(x => `<button type="button" class="tiny-b" data-a="tiny" data-scope="siren" data-text="${esc(x)}" aria-pressed="${Z.tiny === x}">${esc(x)}</button>`).join('');
  }
  function sirenStart() {
    if (!Z.track) { toast('Pick one machine.'); return; }
    if (B.status !== 'idle') { closeSiren(); setView('today', false); scrollToBench(); toast('A rep is already going. Finish that one first.'); return; }
    initAudio();
    Object.assign(B, { status: 'running', track: Z.track, target: 300, startedAt: Date.now(), acc: 0, plus: 0, note: Z.tiny || '', effort: 'light', mins: null, thoughtId: null });
    saveBench(); lockOn(); closeSiren(); setView('today', false); scrollToBench();
  }

  /* ---------------- brain dump actions ---------------- */
  function park() {
    const ta = $('#dump-text'), text = ta.value.trim();
    if (!text) { toast('Type the thought first. Messy is fine.'); ta.focus(); return; }
    putThought({ id: uid('t'), text: text.slice(0, 500), kind: D.kind, track: D.kind === 'noise' ? null : D.track, at: Date.now(), day: todayKey(), kept: false, done: false, repId: null });
    ta.value = '';
    toast(D.kind === 'noise' ? 'Heard. Its words disappear in a day.' : 'Parked. It’ll wait for you.');
    D.kind = 'idea';
    ta.focus();
  }
  function thDo(id) {
    const t = S.thoughts.get(id);
    if (!t) return;
    if (B.status !== 'idle') { toast('Finish the rep that’s going first.'); setView('today', false); scrollToBench(); return; }
    B.track = t.track && P().tracks.some(x => x.id === t.track) ? t.track : (B.track || (visTracks()[0] || {}).id || null);
    B.note = t.text.slice(0, 200);
    B.thoughtId = id;
    saveBench();
    setView('today', false);
    scrollToBench();
    toast('Loaded into the rep bench. Press start.');
  }

  /* ---------------- machines ---------------- */
  function addTrack() {
    const inp = $('#s-add-name'), name = inp.value.trim().slice(0, 40);
    if (!name) { toast('Name the machine first.'); inp.focus(); return; }
    const p = P();
    const existing = p.tracks.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (existing.hidden) { existing.hidden = false; saveProfile(); toast(`${existing.name} is back.`); } else toast('That machine is already here.');
      inp.value = '';
      return;
    }
    const usedC = new Set(p.tracks.filter(t => !t.hidden).map(t => t.color));
    const color = COLORS.find(c => !usedC.has(c)) || COLORS[p.tracks.length % COLORS.length];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'machine';
    p.tracks.push({ id: `${slug}-${Math.random().toString(36).slice(2, 6)}`, name, color, tiny: [], hidden: false });
    saveProfile();
    inp.value = '';
    toast(`${name} added. First rep: open it for five minutes.`);
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a, id = b.dataset.id;
    if (b.tagName === 'A') e.preventDefault();
    switch (a) {
      case 'tab': setView(b.dataset.view); break;
      case 'go-bench': if (view !== 'today') setView('today', false); scrollToBench(); break;
      case 'park': setView('dump'); setTimeout(() => $('#dump-text').focus(), 60); break;
      case 'siren': openSiren(); break;
      case 'siren-close': closeSiren(); break;
      case 'siren-start': sirenStart(); break;
      case 'pick': {
        const sc = b.dataset.scope;
        if (sc === 'bench') { if (B.status === 'idle') { B.track = id; saveBench(); renderBench(); } }
        else if (sc === 'log') { L.track = id; renderToday(); }
        else if (sc === 'dump') { D.track = id && D.track !== id ? id : null; renderDump(); }
        else if (sc === 'siren') { Z.track = id; Z.tiny = null; renderSiren(); }
        break;
      }
      case 'mode': if (B.status === 'idle') { B.mode = +b.dataset.sec; saveBench(); renderBench(); } break;
      case 'tiny':
        if (b.dataset.scope === 'bench') { B.note = b.dataset.text; saveBench(); const p = $('#b-plan'); if (p) p.value = B.note; }
        else { Z.tiny = b.dataset.text; renderSiren(); }
        break;
      case 'start': start(); break;
      case 'pause': pause(); break;
      case 'resume': resume(); break;
      case 'finish': finish(); break;
      case 'one-more': oneMore(); break;
      case 'toss': if (arm(b, 'tap again to toss')) { resetBench(); renderBench(); renderPill(); toast('Tossed. Nothing saved.'); } break;
      case 'save-rep': saveRepFromBench(); break;
      case 'effort':
        if (b.dataset.scope === 'bench') { B.effort = b.dataset.v; saveBench(); renderBench(); }
        else { L.effort = b.dataset.v; renderToday(); }
        break;
      case 'log-save': logSave(); break;
      case 'head': setHead(+b.dataset.v); break;
      case 'del-rep': if (arm(b, 'delete?')) { delRep(id); toast('Rep deleted.'); } break;
      case 'kind': D.kind = b.dataset.v; renderDump(); break;
      case 'park-go': park(); break;
      case 'th-do': thDo(id); break;
      case 'th-keep': { const t = S.thoughts.get(id); if (t) putThought({ ...t, kept: !t.kept }); break; }
      case 'th-go': {
        const li = b.closest('.thought');
        if (li) { li.classList.add('leaving'); setTimeout(() => delThought(id), 250); } else delThought(id);
        break;
      }
      case 'day': if (b.dataset.k) { V.k = b.dataset.k; if (view !== 'back') setView('back'); else renderBack(); } break;
      case 'prev': case 'next': if (V.k) { V.k = addDays(V.k, a === 'prev' ? -1 : 1); renderBack(); } break;
      case 'season-pick': V.si = +b.dataset.i; V.k = null; renderBack(); break;
      case 'edit-track': { const t = trackById(id); Object.assign(E, { id, name: t.name, color: t.color, tiny: t.tiny.join('\n') }); renderScheme(); setTimeout(() => { const n = $('#e-name'); if (n) n.focus(); }, 30); break; }
      case 'e-color': E.color = b.dataset.v; renderScheme(); break;
      case 'e-cancel': E.id = null; renderScheme(); break;
      case 'e-save': {
        const t = P().tracks.find(x => x.id === E.id);
        if (t) {
          t.name = E.name.trim().slice(0, 40) || t.name;
          t.color = E.color;
          t.tiny = E.tiny.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8);
        }
        E.id = null; saveProfile(); toast('Saved.');
        break;
      }
      case 'e-remove': if (arm(b, 'tap again to remove')) { const t = P().tracks.find(x => x.id === E.id); if (t) t.hidden = true; if (B.track === E.id && B.status === 'idle') B.track = null; E.id = null; saveProfile(); toast('Removed. Its reps stay in your timeline.'); } break;
      case 'add-track': addTrack(); break;
      case 'outline': V.outline = buildOutline(); V.outlineOpen = true; $('#s-video')._h = ''; renderScheme(); break;
      case 'copy-outline': copyText(V.outline, $('#outline')); break;
      case 'save-outline': download(`season-${(season() || { n: 1 }).n}-video-outline.md`, V.outline, 'text/markdown'); break;
      case 'save-recap': if (season()) download(`season-${season().n}.html`, recapHTML(V.recapLines), 'text/html'); break;
      case 'backup':
        if (download(`one-more-rep-backup-${todayKey()}.json`, JSON.stringify({ ...exportData(), profile: P() }, null, 2), 'application/json')) {
          P().lastBackup = Date.now(); saveProfile(); toast('Backup saved. Keep it somewhere safe, like Google Drive.');
        }
        break;
      case 'import': $('#import-file').click(); break;
      case 'diary-md': download(`one-more-rep-diary-${todayKey()}.md`, diaryMD(), 'text/markdown'); break;
      case 'new-season': {
        const s = season();
        if (s && dayIdx(s) > SEASON && arm(b, 'tap again to start')) {
          P().seasons.push({ n: s.n + 1, start: todayKey() }); V.si = null; V.k = null; V.outlineOpen = false;
          saveProfile(); toast(`Season ${s.n + 1}, day 1. Same bike, longer road.`);
        }
        break;
      }
      default: break;
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    switch (t.id) {
      case 'b-plan': case 'f-note': B.note = t.value; saveBench(); break;
      case 'f-mins': B.mins = t.value; saveBench(); break;
      case 't-line': queueLine(todayKey(), t.value); break;
      case 'b-line': queueLine(t.dataset.k, t.value); break;
      case 's-goal': queueGoal(t.value); break;
      case 'e-name': E.name = t.value; break;
      case 'e-tiny': E.tiny = t.value; break;
      default: break;
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 't-line') queueLine(todayKey(), t.value, true);
    else if (t.id === 'b-line') queueLine(t.dataset.k, t.value, true);
    else if (t.id === 's-goal') queueGoal(t.value, true);
    else if (t.id === 'recap-lines') V.recapLines = t.checked;
    else if (t.id === 'import-file' && t.files && t.files[0]) {
      const f = t.files[0];
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(String(rd.result));
          if (!d || (!Array.isArray(d.reps) && !d.profile)) throw new Error('not a backup');
          const c = ingest(d, 'merge');
          changed();
          toast(`Loaded ${plural(c.reps, 'rep')}, ${plural(c.thoughts, 'thought')} and ${plural(c.days, 'day')}. Nothing was deleted.`, 4500);
        } catch (err) {
          toast('That file isn’t a One More Rep backup. Pick the .json file the backup button saved.', 5000);
        }
        t.value = '';
      };
      rd.onerror = () => { toast('Couldn’t read that file.'); t.value = ''; };
      rd.readAsText(f);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#siren').hidden) closeSiren();
    if (e.target.id === 'dump-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); park(); }
    if (e.target.id === 's-add-name' && e.key === 'Enter') { e.preventDefault(); addTrack(); }
    if (e.target.id === 'f-note' && e.key === 'Enter') { e.preventDefault(); saveRepFromBench(); }
  });
  document.addEventListener('pointermove', e => {
    const el = e.target.closest ? e.target.closest('[data-tip]') : null, tip = $('#tip');
    if (!el || e.pointerType === 'touch') { if (!tip.hidden) tip.hidden = true; return; }
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 12);
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, e.clientY - tip.offsetHeight - 12)}px`;
  });
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (view === 'back') { $('#b-chart')._h = ''; renderBack(); } }, 150); });
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== view) setView(v); });

  /* ---------------- clock ---------------- */
  function tick() {
    if (B.status === 'running') {
      const e = elapsed();
      if (B.target && e >= B.target * 1000) {
        Object.assign(B, { acc: B.target * 1000, startedAt: null, status: 'setdone' });
        saveBench(); chime(); lockOff();
        if (view === 'today') renderBench();
        toast('Set done. One more?');
      } else if (view === 'today') {
        const d = $('#b-digits');
        if (d) d.textContent = B.target ? clock(Math.ceil((B.target * 1000 - e) / 1000)) : clock(e / 1000);
        const p = $('#b-prog');
        if (p) p.style.width = `${Math.min(100, e / (B.target * 10))}%`;
      }
    }
    renderPill();
  }

  /* ---------------- boot ---------------- */
  load();
  fadeNoise();
  setInterval(tick, 500);
  setInterval(() => { fadeNoise(); schedule(); }, 60e3);
  setView(VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today', false);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
