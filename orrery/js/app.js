/* =========================================================
   app.js  — shared state, select()/resetView() (the single place
   that keeps 3D view + panels in sync), guided tour, camera entrance,
   animation loop, deep links (#mars), startup.
   ========================================================= */

const state = {
  view: 'hero',         // 'hero' (not entered yet) | 'entering' (warp running) | 'system'
  sel: null,            // currently selected body
  playing: true,
  speed: CONFIG.startSpeed,
  filter: 'All',
  query: '',
  miles: false,         // km / miles switch
  mode: 'free',         // 'free' | 'follow' | 'reset'  (camera behaviour)
  fly: 0,               // seconds left of the fly-to animation
  cmpA: 'earth',        // comparison planet A (follows selection)
  cmpB: 'mars'          // comparison planet B
};
const tour = { on: false, i: 0, timer: null };
const entrance = { on: false, t: 0 };                      // cinematic camera fly-in

/* ---------- SELECT: every panel updates from here ---------- */
function select(id, fromTour) {
  const b = byId(id); if (!b) return;
  if (tour.on && !fromTour) tourStop();                    // manual action ends the tour
  entrance.on = false;
  state.sel = b; state.mode = 'follow'; state.fly = 1.6; homeLocked = false;
  b.focusDist = curSize(b) * CONFIG.focusDistance + 3;
  if (b.id !== 'sun') {                                    // sync comparison with selection
    state.cmpA = b.id;
    if (state.cmpB === b.id) state.cmpB = planets.find(p => p.id !== b.id).id;
  }
  renderList(); renderInfo(); renderCompare();
  BODIES.forEach(p => {
    if (p.line) p.line.material.opacity = p === b ? .75 : .2;
    p.label.classList.toggle('on', p === b);
  });
  selRing.visible = true;
  try { history.replaceState(null, '', '#' + b.id); } catch (e) {}   // shareable link
}

function resetView() {
  if (tour.on) tourStop();
  state.mode = 'reset'; state.sel = null; selRing.visible = false; homeLocked = true;
  BODIES.forEach(p => { if (p.line) p.line.material.opacity = .2; p.label.classList.remove('on'); });
  renderList(); renderInfo();
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
}

function startEntrance() {                                 // camera swoops in from far away
  entrance.on = true; entrance.t = 0; homeLocked = true; state.mode = 'free';
}
controls.addEventListener('start', () => { entrance.on = false; });   // user grabs the camera: stop the animation

/* ---------- GUIDED TOUR ---------- */
function tourGo() {
  clearTimeout(tour.timer);
  select(BODIES[tour.i].id, true); renderTour();
  tour.timer = setTimeout(tourNext, CONFIG.tourSeconds * 1000);
}
function tourStart() { tour.on = true; tour.i = 0; setPlaying(true); tourGo(); }
function tourNext() {
  tour.i++;
  if (tour.i >= BODIES.length) { tourStop(); resetView(); } else tourGo();
}
function tourStop() { tour.on = false; clearTimeout(tour.timer); renderTour(); }

/* ---------- keyboard: P = pause, arrows = next/previous body, R = reset (only while the solar system is on screen; Space keeps scrolling the page) ---------- */
addEventListener('keydown', e => {
  if (state.view !== 'system' || !sysVisible || document.activeElement !== document.body) return;
  if (e.key === 'p' || e.key === 'P') setPlaying(!state.playing);
  if (e.key === 'r' || e.key === 'R') resetView();
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const i = BODIES.indexOf(state.sel), d = e.key === 'ArrowRight' ? 1 : -1;
    select(BODIES[(i + d + BODIES.length) % BODIES.length].id);
  }
});
addEventListener('hashchange', () => {                     // back/forward or pasted #planet links
  const id = location.hash.slice(1);
  if (state.view === 'system' && byId(id) && (!state.sel || state.sel.id !== id)) select(id);
});

/* ---------- animation loop ---------- */
const _tmp = new THREE.Vector3(), _off = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
let last = performance.now();

function loop(now) {
  const dt = Math.min((now - last) / 1000, .1); last = now;

  // 1) advance orbits, spins, clouds, moons, belt (cheap, always runs)
  if (state.playing) belt.rotation.y += dt * .02 * state.speed;
  BODIES.forEach(b => {
    if (state.playing) {
      b.ang += b.w * state.speed * dt;
      b.mesh.rotation.y += dt * .5 * state.speed;
      if (b.clouds) b.clouds.rotation.y += dt * .65 * state.speed;
      if (b.moons) b.moons.forEach(m => m.ang += m.w * state.speed * dt);
    }
    if (b.orbit) b.pivot.position.set(Math.cos(b.ang) * b.orbit, 0, Math.sin(b.ang) * b.orbit);
    if (b.moons) b.moons.forEach(m => m.mesh.position.set(Math.cos(m.ang) * m.orbit, 0, Math.sin(m.ang) * m.orbit));
  });

  if (sysVisible) {                                        // 2D UI + 3D render only while the section is on screen
    // 2) camera: entrance, fly to the selected body then stay locked on it, or reset
    const s = state.sel, k = 1 - Math.pow(.002, dt);
    if (entrance.on && state.mode === 'free') {
      entrance.t += dt / CONFIG.entranceSeconds;
      const t = Math.min(entrance.t, 1), e = 1 - Math.pow(1 - t, 3);
      cam.position.copy(HOME).applyAxisAngle(_Y, 1.4 * (1 - e)).multiplyScalar(1 + 1.1 * (1 - e));
      cam.position.y += 26 * (1 - e);
      controls.target.set(0, 0, 0);
      if (t >= 1) entrance.on = false;
    } else if (state.mode === 'follow' && s) {
      const p = s.pivot.position;
      if (state.fly > 0) {
        state.fly -= dt; _off.copy(cam.position).sub(controls.target);
        const L = _off.length(); _off.setLength(L + (s.focusDist - L) * k);
        controls.target.lerp(p, k); cam.position.copy(controls.target).add(_off);
      } else {
        _tmp.copy(p).sub(controls.target); controls.target.add(_tmp); cam.position.add(_tmp);
      }
    } else if (state.mode === 'reset') {
      controls.target.lerp(_tmp.set(0, 0, 0), k); cam.position.lerp(HOME, k);
      if (cam.position.distanceTo(HOME) < .3) state.mode = 'free';
    }
    controls.update();

    // 3) selection ring, orbit trail, live orbit progress
    updateTrail(s);
    if (s) {
      selRing.position.copy(s.pivot.position); selRing.scale.setScalar(curSize(s)); selRing.lookAt(cam.position);
      const pb = $('#pbar');
      if (s.orbit && pb) {
        const pr = (((s.ang - s.ang0) / 6.2832) % 1 + 1) % 1 * 100;
        pb.style.width = pr + '%'; $('#pct').textContent = pr.toFixed(0) + '%';
      }
    }

    // 4) labels follow bodies on screen (selected body always labelled)
    const w = stage.clientWidth, h = stage.clientHeight;
    BODIES.forEach(b => {
      _tmp.copy(b.pivot.position); _tmp.y += curSize(b) + 1; _tmp.project(cam);
      const vis = (CONFIG.showLabels || b === s) && _tmp.z < 1 && Math.abs(_tmp.x) < 1.1;
      b.label.style.display = vis ? 'block' : 'none';
      if (vis) b.label.style.transform = `translate(${(_tmp.x * .5 + .5) * w + 6}px,${(-_tmp.y * .5 + .5) * h - 10}px)`;
    });
    renderer.render(scene, cam);
  }

  if (story.active) { storyParallax(); storyFrame(dt); }   // big scroll-story planets
  requestAnimationFrame(loop);
}

/* ---------- startup ---------- */
renderChips(); renderList(); renderInfo(); fillSelects(); renderCompare(); setSpeed(state.speed); renderTour(); renderStories();
initSpace(); initFlow();
requestAnimationFrame(loop);
const startId = location.hash.slice(1);
if (byId(startId)) { enterSolarSystem({ skip: true }); select(startId); }   // deep link skips the intro
