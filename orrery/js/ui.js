/* =========================================================
   ui.js  — everything in the HTML layer:
   hero + warp transition, view flow (hero → system → stories),
   drawers, dock, search, floating info card, compare chart,
   tour bar, help, controls, story sections.
   Reads the shared `state`, `tour`, `entrance` objects from app.js.
   ========================================================= */

/* ---------- formatting helpers ---------- */
const fmt = n => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
const fmtPeriod = d => d ? fmt(d) + ' days' + (d > 400 ? ' (' + (d / 365.25).toFixed(1) + ' yr)' : '') : 'Not applicable';
const fmtDay = h => h < 48 ? fmt(h) + ' h' : fmt(h / 24) + ' days';
const toMi = n => state.miles ? n * 0.621371 : n;          // km -> miles when the unit switch is on
const unitLen = () => state.miles ? 'mi' : 'km';
const byId = id => BODIES.find(b => b.id === id);
const planets = BODIES.filter(b => b.id !== 'sun');        // bodies offered in the comparison
const isMobile = () => matchMedia('(max-width:760px)').matches;
let sysVisible = false;                                     // is the solar-system section on screen?

/* =========================================================
   VIEW FLOW: hero → warp → solar system → stories
   The page scrolls natively everywhere: no scroll lock, no snapping.
   state.view: 'hero' (not entered yet) | 'entering' (warp running) | 'system'
   ========================================================= */
const space = { on: false, visible: true, mode: 'hero', t0: 0, finished: false, stars: [], mx: 0, my: 0, kick() {} };

function initSpace() {                                      // hero starfield + warp streaks (2D canvas)
  const c = $('#space'), g = c.getContext('2d'); let W = 0, H = 0, dpr = 1, last = 0;
  const fit = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; };
  fit(); addEventListener('resize', fit);
  for (let i = 0; i < 520; i++) space.stars.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * .95 + .05, wz: 1, tw: Math.random() * 6.28 });
  addEventListener('pointermove', e => { space.mx = e.clientX / innerWidth - .5; space.my = e.clientY / innerHeight - .5; });
  let gen = 0, lastDraw = 0;                                // gen: only the newest loop may draw
  const paintDark = () => { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#03050f'; g.fillRect(0, 0, W, H); };
  const frame = (now, id) => {
    if (id !== gen) return;
    if (space.mode === 'hero' && !space.visible) { paintDark(); space.on = false; return; }   // hero scrolled out of view: stop drawing (never leave a stale frame)
    lastDraw = performance.now();
    const dt = Math.min((now - last) / 1000, .05); last = now;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createRadialGradient(W * .5, H * .55, 0, W * .5, H * .55, Math.max(W, H) * .8);
    bg.addColorStop(0, '#0d1638'); bg.addColorStop(.55, '#070b1f'); bg.addColorStop(1, '#03050f');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    [[.25 + space.mx * .06, .35, 'rgba(120,80,220,.14)'], [.78 - space.mx * .06, .65, 'rgba(50,130,255,.11)']].forEach(n => {   // soft nebula
      const r = Math.max(W, H) * .5, ng = g.createRadialGradient(W * n[0], H * n[1], 0, W * n[0], H * n[1], r);
      ng.addColorStop(0, n[2]); ng.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ng; g.fillRect(0, 0, W, H);
    });
    if (space.mode === 'hero') {                            // twinkling, drifting stars with mouse parallax
      space.stars.forEach(s => {
        s.y -= dt * .006 * s.z; if (s.y < -1) s.y = 1;
        const px = (s.x * .5 + .5) * W - space.mx * s.z * 46, py = (s.y * .5 + .5) * H - space.my * s.z * 46;
        g.fillStyle = `rgba(215,228,255,${.25 + .7 * Math.abs(Math.sin(now * .0012 + s.tw))})`;
        g.beginPath(); g.arc(px, py, s.z * 1.5 + .3, 0, 6.283); g.fill();
      });
    } else {                                                // warp: stars stream toward the camera
      const t = Math.min((now - space.t0) / (CONFIG.introSeconds * 1000), 1.2), sp = .12 + 2.5 * Math.pow(Math.min(t, 1), 2.2);
      g.lineCap = 'round';
      space.stars.forEach(s => {
        const zp = Math.min(1.3, s.wz + sp * .07); s.wz -= sp * dt;
        if (s.wz < .02) { s.wz = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; return; }
        const k = 1 - s.wz;
        g.strokeStyle = `rgba(${190 + 65 * k},${208 + 47 * k},255,${Math.min(1, k * 1.5 + .15)})`; g.lineWidth = k * 2.4 + .4;
        g.beginPath(); g.moveTo(W / 2 + s.x / zp * W * .28, H / 2 + s.y / zp * H * .28); g.lineTo(W / 2 + s.x / s.wz * W * .28, H / 2 + s.y / s.wz * H * .28); g.stroke();
      });
      const glow = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .6);   // core glow grows with speed
      glow.addColorStop(0, `rgba(170,195,255,${.5 * Math.pow(Math.min(t, 1), 3)})`); glow.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
      const f = Math.max(0, Math.min(1, (t - .78) / .14));                                        // flash into the solar system
      if (f > 0) { g.fillStyle = `rgba(255,255,255,${f})`; g.fillRect(0, 0, W, H); }
      if (t >= .92 && !space.finished) { space.finished = true; setTimeout(() => finishEnter('instant'), 0); }
    }
    requestAnimationFrame(t => frame(t, id));
  };
  space.kick = () => {                                      // (re)start drawing; also revives a loop that stopped unexpectedly
    if (space.on && performance.now() - lastDraw < 300) return;
    const id = ++gen; space.on = true; last = lastDraw = performance.now();
    requestAnimationFrame(t => frame(t, id));
  };
  new IntersectionObserver(es => { space.visible = es[es.length - 1].isIntersecting; if (space.visible) space.kick(); }).observe($('#hero'));
  space.kick();
}

function enterSolarSystem(opts = {}) {                      // ENTER button / skip / deep link
  if (state.view !== 'hero') return;
  state.view = 'entering';
  if (opts.skip || matchMedia('(prefers-reduced-motion: reduce)').matches) { finishEnter(opts.smooth ? 'smooth' : 'instant'); return; }
  $('#space').classList.add('fixed'); $('#hero').classList.add('warping'); document.body.classList.add('warping');
  space.mode = 'warp'; space.t0 = performance.now(); space.finished = false; space.kick();
}
function finishEnter(how = 'instant') {                     // how: 'instant' (hidden by the flash) | 'smooth' | 'none' (user already scrolled)
  if (state.view === 'system') return;
  space.finished = true; state.view = 'system'; sysVisible = true;
  if (how !== 'none') $('#system').scrollIntoView({ behavior: how === 'smooth' ? 'smooth' : 'auto', block: 'start' });
  $('#hero').classList.remove('warping'); document.body.classList.remove('warping'); document.body.classList.add('entered');
  startEntrance();
  if (space.mode === 'warp') {                              // fade the warp canvas out, then hand it back to the hero
    $('#space').classList.add('out');
    setTimeout(() => { $('#space').classList.remove('fixed', 'out'); space.mode = 'hero'; space.kick(); }, 1100);
  }
  if (window.requestIdleCallback) requestIdleCallback(() => initStoryScene(), { timeout: 2500 });   // prepare the story planets in the background
  else setTimeout(initStoryScene, 2500);
}
function goStories() {                                      // plain smooth scroll, interruptible by the user at any time
  if (tour.on) tourStop();
  setDrawer(''); initStoryScene();
  $('#stories').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function goSystem(cb) {                                     // smooth scroll back up; optional action (e.g. select a planet)
  if (cb) cb();
  if (!state.sel) startEntrance();
  $('#system').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function initFlow() {
  $('#enterBtn').onclick = () => state.view === 'hero' ? enterSolarSystem() : goSystem();
  $('#skipIntro').onclick = () => state.view === 'hero' ? enterSolarSystem({ skip: true, smooth: true }) : goSystem();
  $('#skipWarp').onclick = () => { if (state.view === 'entering' && !space.finished) finishEnter('instant'); };
  $('#toStories').onclick = goStories;
  $('#backTop').onclick = () => goSystem();
  $('#ctaBtn').onclick = () => goSystem();
  new IntersectionObserver(es => {                          // which section is on screen
    const e = es[es.length - 1]; sysVisible = e.isIntersecting;
    if (e.intersectionRatio >= .15 && state.view === 'hero') finishEnter('none');   // scrolled down by hand: reveal the UI, no jump
  }, { threshold: [0, .15] }).observe($('#system'));
  new IntersectionObserver(es => {
    const on = es[es.length - 1].isIntersecting;
    if (on) initStoryScene();
    story.active = on && story.ready;
    document.body.classList.toggle('in-stories', on); $('#storyGL').classList.toggle('on', on);
  }).observe($('#stories'));
}

/* ---------- drawers (one open at a time; body[data-panel] drives the CSS) ---------- */
const DRAWERS = ['search', 'filter', 'controls', 'compare'];
function setDrawer(name) {
  document.body.dataset.panel = name || '';
  DRAWERS.forEach(n => {
    const open = n === name;
    $('#dr-' + n).setAttribute('aria-hidden', String(!open));
    document.querySelector(`.dock-btn[data-drawer="${n}"]`).setAttribute('aria-expanded', String(open));
  });
  if (name === 'search') setTimeout(() => $('#q').focus(), 380);
}
const toggleDrawer = n => setDrawer(document.body.dataset.panel === n ? '' : n);
document.querySelector('.dock').addEventListener('click', e => {
  const b = e.target.closest('.dock-btn[data-drawer]'); if (b) toggleDrawer(b.dataset.drawer);
});
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => setDrawer('')));
addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.dataset.panel) setDrawer(''); });
const markTouched = () => { if (state.view === 'system') { document.body.classList.add('touched'); removeEventListener('pointerdown', markTouched); } };
addEventListener('pointerdown', markTouched);               // fades the title and hint after the first interaction

/* ---------- filter chips + list (Filters drawer) ---------- */
function visibleBodies() {
  const q = state.query.trim().toLowerCase();
  return BODIES.filter(b =>
    (state.filter === 'All' || b.group === state.filter) &&
    (!q || b.name.toLowerCase().includes(q) || b.type.toLowerCase().includes(q)));
}
function renderChips() {
  $('#chips').innerHTML = FILTERS.map(f => `<button class="chip" data-f="${f}" aria-pressed="${f === state.filter}">${f}</button>`).join('');
}
function renderList() {
  const v = visibleBodies();
  $('#list').innerHTML = v.length
    ? v.map(b => `<li class="item ${state.sel === b ? 'on' : ''}" tabindex="0" role="button" data-id="${b.id}">
        <i class="dot" style="background:${b.color}"></i>${b.name}<span class="t">${b.type}</span></li>`).join('')
    : '<li class="empty">No match. Try another name or clear the filter.</li>';
}
function pickFromList(li) { select(li.dataset.id); if (isMobile()) setDrawer(''); }
$('#chips').addEventListener('click', e => { const f = e.target.dataset.f; if (f) { state.filter = f; renderChips(); renderList(); } });
$('#list').addEventListener('click', e => { const li = e.target.closest('.item'); if (li) pickFromList(li); });
$('#list').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { const li = e.target.closest('.item'); if (li) { e.preventDefault(); pickFromList(li); } }
});

/* ---------- search (Search drawer) ---------- */
function searchMatches() {
  const q = $('#q').value.trim().toLowerCase();
  return q ? BODIES.filter(b => b.name.toLowerCase().includes(q) || b.type.toLowerCase().includes(q)) : [];
}
function renderResults() {
  const ul = $('#results'), q = $('#q').value.trim();
  if (!q) { ul.innerHTML = ''; return; }
  const m = searchMatches();
  ul.innerHTML = m.length
    ? m.map(b => `<li role="option" tabindex="0" data-id="${b.id}"><i class="dot" style="background:${b.color}"></i>${b.name}<span>${b.type}</span></li>`).join('')
    : '<li class="none">No match found</li>';
}
function clearSearch() { $('#q').value = ''; state.query = ''; $('#results').innerHTML = ''; renderList(); }
function pickResult(id) { select(id); clearSearch(); setDrawer(''); }
$('#q').addEventListener('input', e => { state.query = e.target.value; renderList(); renderResults(); });
$('#q').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const v = searchMatches(); if (v[0]) pickResult(v[0].id); }
  if (e.key === 'Escape') { clearSearch(); setDrawer(''); }
});
$('#results').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) pickResult(li.dataset.id); });
$('#results').addEventListener('keydown', e => { if (e.key === 'Enter') { const li = e.target.closest('li[data-id]'); if (li) pickResult(li.dataset.id); } });

/* ---------- floating info card (only while a body is selected) ---------- */
function renderInfo() {
  const card = $('#info'), b = state.sel;
  card.classList.toggle('show', !!b);
  card.setAttribute('aria-hidden', String(!b));
  document.body.classList.toggle('has-sel', !!b);
  if (!b) return;                                           // keep old content so the card can fade out
  b.texURL = b.texURL || planetCanvas(b).toDataURL();       // spinning mini planet in the card header
  card.style.setProperty('--pc', b.color);
  card.innerHTML = `<div class="ic-in">
    <div class="ic-head">
      <i class="orb" style="background-image:url(${b.texURL})"></i>
      <div><h1>${b.name}</h1><div class="type">${b.type}</div></div>
      <button class="x" id="icClose" aria-label="Close details">×</button>
    </div>
    <p class="about">${b.about}</p>
    <dl class="stats">
      <div class="stat big"><dt>Diameter</dt><dd>${fmt(toMi(b.diam))} ${unitLen()}</dd></div>
      <div class="stat big"><dt>Distance from Sun</dt><dd>${b.dist ? fmt(toMi(b.dist)) + ' million ' + unitLen() : 'Centre'}</dd></div>
      <div class="stat big"><dt>Orbital period</dt><dd>${fmtPeriod(b.period)}</dd></div>
      <div class="stat"><dt>Surface gravity</dt><dd>${fmt(b.g)} m/s²</dd></div>
      <div class="stat"><dt>Day length</dt><dd>${fmtDay(b.day)}</dd></div>
      <div class="stat"><dt>Temperature</dt><dd>${fmt(b.temp)} °C</dd></div>
    </dl>
    ${b.orbit ? '<div class="orbitprog"><span>Orbit progress</span><span id="pct">0%</span></div><div class="prog"><i id="pbar"></i></div>' : ''}
    ${b.id !== 'sun' ? '<div class="ic-actions"><button class="btn small" id="cmpOpen">Compare</button></div>' : ''}
  </div>`;
}
$('#info').addEventListener('click', e => {
  if (e.target.closest('#icClose')) resetView();
  if (e.target.closest('#cmpOpen')) {                       // general Compare: this planet is A, the user picks B
    state.cmpA = state.sel.id;
    if (state.cmpB === state.cmpA) state.cmpB = planets.find(p => p.id !== state.cmpA).id;
    renderCompare(); setDrawer('compare'); setTimeout(() => $('#selB').focus(), 450);
  }
});

/* ---------- comparison (Compare drawer) ---------- */
function fillSelects() {
  const opts = planets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  $('#selA').innerHTML = opts; $('#selB').innerHTML = opts;
}
function renderCompare() {
  $('#selA').value = state.cmpA; $('#selB').value = state.cmpB;
  const A = byId(state.cmpA), B = byId(state.cmpB);
  $('#chart').innerHTML = PARAMS.map(p => {
    const f = (state.miles && p.f) ? p.f : 1, u = (state.miles && p.mi) ? p.mi : p.unit;
    const av = A[p.k] * f, bv = B[p.k] * f, max = Math.max(av, bv) || 1;
    return `<div class="row"><div class="nm">${p.label}${u ? ' (' + u + ')' : ''}</div>
      <div class="bar a"><i style="width:${av / max * 100}%">${A.name} ${fmt(av)}</i></div>
      <div class="bar b"><i style="width:${bv / max * 100}%">${B.name} ${fmt(bv)}</i></div></div>`;
  }).join('');
  $('#ratios').innerHTML = PARAMS.map(p => {                // plain-language ratios under the chart
    const r = A[p.k] / B[p.k];
    const txt = r >= 1 ? r.toFixed(1) + '× larger' : (1 / r).toFixed(1) + '× smaller';
    return `<li>${p.label}: <b>${A.name}</b> is ${txt} than <b>${B.name}</b></li>`;
  }).join('');
}
$('#selA').onchange = e => { state.cmpA = e.target.value; renderCompare(); };
$('#selB').onchange = e => { state.cmpB = e.target.value; renderCompare(); };

/* ---------- guided tour (dock button + bar) ---------- */
function renderTour() {
  const bar = $('#tourBar');
  $('#tourBtn span').textContent = tour.on ? 'Stop' : 'Tour';
  $('#tourBtn').setAttribute('aria-pressed', String(tour.on));
  document.body.classList.toggle('touring', tour.on);
  bar.hidden = !tour.on;
  if (tour.on) {
    const b = BODIES[tour.i];
    bar.innerHTML = `<div><b>${b.name}</b> <span>(${tour.i + 1} of ${BODIES.length})</span><p>${b.about}</p></div>
      <div class="tb-actions"><button class="btn small" id="tourNext">Next</button><button class="btn small" id="tourStopBtn">Stop</button></div>`;
  }
}
$('#tourBar').addEventListener('click', e => {
  if (e.target.id === 'tourNext') tourNext();
  if (e.target.id === 'tourStopBtn') tourStop();
});
$('#tourBtn').onclick = () => { if (tour.on) tourStop(); else { setDrawer(''); tourStart(); } };

/* ---------- help + units ---------- */
$('#helpBtn').onclick = () => $('#help').showModal();
$('#units').addEventListener('click', e => {
  const u = e.target.dataset.u; if (!u) return;
  state.miles = (u === 'mi');
  document.querySelectorAll('#units button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.u === u)));
  renderInfo(); renderCompare();
});

/* ---------- controls drawer ---------- */
function setPlaying(p) {
  state.playing = p;
  $('#play').textContent = p ? 'Pause' : 'Resume';
  $('#play').setAttribute('aria-pressed', String(!p));
}
function setSpeed(s) {
  state.speed = s;
  $('#speed').value = Math.round(50 * Math.log10(s / 0.1));   // slider 0..100 maps to 0.1×..10×
  $('#speedOut').textContent = s.toFixed(1) + '×';
}
$('#play').onclick = () => setPlaying(!state.playing);
$('#speed').oninput = e => setSpeed(0.1 * Math.pow(10, e.target.value / 50));
$('#reset').onclick = () => resetView();
$('#tOrbits').onchange = e => { CONFIG.showOrbits = e.target.checked; BODIES.forEach(b => { if (b.line) b.line.visible = CONFIG.showOrbits; }); };
$('#tLabels').onchange = e => { CONFIG.showLabels = e.target.checked; };
$('#tScale').onchange = e => {
  setProportions(e.target.checked);
  if (state.sel) { state.sel.focusDist = curSize(state.sel) * CONFIG.focusDistance + 3; state.fly = 1.2; }
};

/* =========================================================
   STORIES: scroll sections built from STORIES (data.js)
   ========================================================= */
let storyEls = [];
function renderStories() {
  $('#stories').innerHTML = STORIES.map((s, i) => {
    const b = byId(s.id);
    return `<article class="story planet-${s.side}" id="story-${s.id}">
      <div class="story-copy">
        <div class="eyebrow reveal">0${i + 1} · ${s.kicker}</div>
        <h2 class="story-name reveal">${b.name.toUpperCase()}</h2>
        <h3 class="story-title reveal">${s.title}</h3>
        <p class="reveal">${s.text}</p>
        <ul class="facts reveal">${s.facts.map(f => `<li><b>${f[1]}</b><span>${f[0]}</span></li>`).join('')}</ul>
        <button class="btn reveal" data-view="${s.id}">View ${b.name} in the solar system →</button>
      </div></article>`;
  }).join('') + `<nav class="story-dots" id="storyDots" aria-label="Story navigation">${STORIES.map((s, i) => `<button data-i="${i}" aria-label="${byId(s.id).name}"></button>`).join('')}</nav>`;
  storyEls = [...document.querySelectorAll('.story')];
  $('#stories').addEventListener('click', e => {
    const v = e.target.closest('[data-view]'), d = e.target.closest('[data-i]');
    if (v) goSystem(() => select(v.dataset.view));
    if (d) storyEls[+d.dataset.i].scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .25 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}
function storyParallax() {                                  // called every frame while the stories are on screen
  const H = innerHeight; let best = 0, bd = 9;
  storyEls.forEach((el, i) => {
    const r = el.getBoundingClientRect(), off = (r.top + r.height / 2 - H / 2) / H;
    el.style.setProperty('--off', off.toFixed(3));
    if (Math.abs(off) < bd) { bd = Math.abs(off); best = i; }
  });
  document.querySelectorAll('.story-dots button').forEach((b, i) => b.classList.toggle('on', i === best));
}
