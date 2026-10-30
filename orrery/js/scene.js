/* =========================================================
   scene.js  — everything 3D: renderer, camera, bodies, orbits,
   moons, stars, selection ring, click picking.
   Depends on: data.js, Three.js, OrbitControls
   ========================================================= */

const $ = s => document.querySelector(s);
const stage = $('#stage'), canvas = $('#gl'), labelsEl = $('#labels');

/* ---------- renderer, camera, controls ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 1, .1, 1200);
const HOME = new THREE.Vector3(...CONFIG.homeCamera);
const HOME_DIR = HOME.clone().normalize(), HOME_DIST = HOME.length();
let homeLocked = true;     // true until the camera is moved; keeps the full system framed when the window resizes
cam.position.copy(HOME);
const controls = new THREE.OrbitControls(cam, canvas);
Object.assign(controls, { enableDamping: true, dampingFactor: .08, minDistance: 2, maxDistance: 420, enablePan: false });

controls.addEventListener('start', () => { homeLocked = false; });

/* Page scroll always wins: the wheel only zooms the 3D view while Ctrl/⌘ is held (trackpad pinch counts).
   One-finger vertical drags scroll the page, horizontal drags rotate, two fingers pinch-zoom. */
stage.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) e.stopPropagation(); }, { capture: true, passive: true });
let _t0 = null;
stage.addEventListener('touchstart', e => { _t0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, v: null } : null; }, { capture: true, passive: true });
stage.addEventListener('touchmove', e => {
  if (e.touches.length !== 1 || !_t0) return;
  if (_t0.v === null) { const dx = Math.abs(e.touches[0].clientX - _t0.x), dy = Math.abs(e.touches[0].clientY - _t0.y); if (dx + dy > 8) _t0.v = dy > dx; }
  if (_t0.v) e.stopPropagation();                           // vertical swipe: leave it to the page
}, { capture: true, passive: true });

scene.add(new THREE.AmbientLight(0xffffff, .28));
scene.add(new THREE.PointLight(0xffffff, 1.7, 0, 0));   // the Sun's light

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  // frame the whole system: back the home camera off on narrow screens so Neptune's orbit fits
  const t = Math.tan(cam.fov * Math.PI / 360);
  HOME.copy(HOME_DIR).multiplyScalar(Math.max(HOME_DIST, CONFIG.systemRadius / (t * cam.aspect)));
  if (homeLocked) cam.position.copy(HOME);
}
new ResizeObserver(resize).observe(stage); resize();

/* ---------- helpers ---------- */
function makeTex(a, b, bands, blots = 0) {          // simple striped planet texture
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = a; x.fillRect(0, 0, 256, 128); x.fillStyle = b;
  for (let i = 0; i < bands; i++) { x.globalAlpha = .12 + Math.random() * .28; x.fillRect(0, Math.random() * 128, 256, 3 + Math.random() * 13); }
  x.globalAlpha = .18; for (let i = 0; i < blots; i++) { x.beginPath(); x.arc(Math.random() * 256, Math.random() * 128, 3 + Math.random() * 14, 0, 6.283); x.fill(); }
  x.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}

(function stars() {
  const n = CONFIG.starCount, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, t = Math.random() * 6.283, r = Math.sqrt(1 - u * u) * 500; p[i*3] = r * Math.cos(t); p[i*3+1] = u * 500; p[i*3+2] = r * Math.sin(t); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const col = new Float32Array(n * 3);                                      // tinted stars: blue, warm, white
  for (let i = 0; i < n; i++) { const k = Math.random(); col.set(k < .2 ? [.7, .82, 1] : k < .35 ? [1, .85, .7] : [1, 1, 1], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size: 1.5, sizeAttenuation: false, transparent: true, opacity: .85 })));
})();

/* ---------- procedural planet textures (periodic noise, so the wrap-around seam is invisible) ---------- */
const _T = (() => { const t = new Float32Array(65536); let s = 1234567; for (let i = 0; i < 65536; i++) { s = (s * 1664525 + 1013904223) >>> 0; t[i] = s / 4294967296; } return t; })();   // random lattice table
const _hash = (x, y) => _T[((y & 255) << 8) | (x & 255)];
function _vn(x, y, P) {                                   // value noise, periodic in x with period P
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x0 = ((xi % P) + P) % P, x1 = (x0 + 1) % P, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (_hash(x0, yi) * (1 - u) + _hash(x1, yi) * u) * (1 - v) + (_hash(x0, yi + 1) * (1 - u) + _hash(x1, yi + 1) * u) * v;
}
function _fbm(x, y, oct, P) { let s = 0, a = .5, f = 1, t = 0; for (let o = 0; o < oct; o++) { s += a * _vn(x * f, y * f, P * f); t += a; a *= .5; f *= 2; } return s / t; }
const _rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const _mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const _texCache = {};

function paintPlanet(b, w, h) {                           // one canvas per body+size, cached
  const key = b.id + w; if (_texCache[key]) return _texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const A = _rgb(b.color), B = _rgb(b.c2), P = 8, id = b.id;
  for (let py = 0; py < h; py++) {
    const lat = py / h, pole = Math.abs(lat - .5) * 2;
    for (let px = 0; px < w; px++) {
      const X = px / w * P, Y = lat * P / 2, n = _fbm(X, Y, 5, P);
      let col;
      if (id === 'earth') {
        const m = _fbm(X + 17, Y + 9, 4, P);
        if (n > .52) { col = _mix([47, 122, 58], [140, 123, 75], m); col = _mix(col, [225, 215, 190], Math.max(0, (n - .62) * 2.5) * m); }
        else col = _mix([8, 40, 100], [31, 111, 208], Math.min(1, n * 1.5));
        if (pole > .86) col = _mix(col, [240, 246, 255], Math.min(1, (pole - .86) * 9));
      } else if (id === 'mars') {
        col = _mix(A, B, n); if (n > .56) col = _mix(col, [70, 34, 22], (n - .56) * 3.2);
        if (pole > .93) col = _mix(col, [245, 240, 235], Math.min(1, (pole - .93) * 14));
      } else if (id === 'jupiter' || id === 'saturn') {
        const bands = .5 + .5 * Math.sin(lat * Math.PI * (id === 'jupiter' ? 15 : 11) + 3.2 * (n - .5));
        const s = .88 + .24 * _fbm(X * 2, Y * 6, 3, P * 2); col = _mix(A, B, bands * .85).map(v => v * s);
      } else if (id === 'uranus' || id === 'neptune') {
        col = _mix(A, B, .5 + .35 * Math.sin(lat * Math.PI * 6 + n * 2.5));
      } else if (id === 'venus') {
        col = _mix(A, B, _fbm(X, Y * 2 + n * 2, 4, P));
      } else if (id === 'mercury') {
        col = _mix(A, B, n); const cr = _fbm(X * 3, Y * 3, 3, P * 3); if (cr > .62) col = _mix(col, [60, 56, 52], (cr - .62) * 3);
      } else if (id === 'sun') {
        col = _mix(A, B, n).map(v => Math.min(255, v * (1.05 + .25 * _fbm(X * 4, Y * 4, 3, P * 4))));
      } else col = _mix(A, B, n);
      const i = (py * w + px) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (id === 'jupiter') {                                 // Great Red Spot
    g.save(); g.translate(w * .3, h * .64); g.scale(1, .55);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w * .055);
    gr.addColorStop(0, 'rgba(170,70,45,.95)'); gr.addColorStop(.6, 'rgba(190,100,70,.6)'); gr.addColorStop(1, 'rgba(190,100,70,0)');
    g.fillStyle = gr; g.fillRect(-w * .06, -w * .06, w * .12, w * .12); g.restore();
  }
  return (_texCache[key] = c);
}
const _isStory = b => STORIES.some(s => s.id === b.id);   // story planets get a sharper texture
const planetCanvas = b => _isStory(b) ? paintPlanet(b, 512, 256) : paintPlanet(b, 256, 128);
const planetTex = b => new THREE.CanvasTexture(planetCanvas(b));

let _cloud = null;
function cloudTex() {                                     // Earth cloud layer (white with alpha)
  if (!_cloud) {
    const w = 512, h = 256; _cloud = document.createElement('canvas'); _cloud.width = w; _cloud.height = h;
    const g = _cloud.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const n = _fbm(px / w * 8 + 40, py / h * 4 + 7, 5, 8), i = (py * w + px) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, Math.max(0, (n - .5) * 3.2) * 217);
    }
    g.putImageData(img, 0, 0);
  }
  return new THREE.CanvasTexture(_cloud);
}
function ringGeometry(inner, outer) {                     // RingGeometry with radial UVs so a texture can run across the ring
  const g = new THREE.RingGeometry(inner, outer, 128), p = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, (v.length() - inner) / (outer - inner), .5); }
  return g;
}
function ringMaterial() {                                 // banded, semi-transparent ring with a Cassini-style gap
  const c = document.createElement('canvas'); c.width = 256; c.height = 4; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 0);
  [[0, 'rgba(120,105,80,0)'], [.06, 'rgba(140,122,92,.45)'], [.2, 'rgba(205,185,138,.8)'], [.42, 'rgba(232,214,168,.92)'], [.5, 'rgba(60,50,40,.12)'],
   [.55, 'rgba(222,203,155,.88)'], [.78, 'rgba(184,165,125,.62)'], [.92, 'rgba(150,132,100,.3)'], [1, 'rgba(150,132,100,0)']].forEach(s => gr.addColorStop(s[0], s[1]));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 4);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide, transparent: true, depthWrite: false });
}

/* ---------- build every body from BODIES ---------- */
const pickable = [];
BODIES.forEach(b => {
  b.ang0 = b.ang = Math.random() * 6.283;
  b.w = b.period ? CONFIG.orbitRate / Math.sqrt(b.period / 365.25) : 0;   // visual orbit speed
  b.pivot = new THREE.Group(); scene.add(b.pivot);                          // pivot = position in orbit

  const isSun = b.id === 'sun';
  const mat = isSun ? new THREE.MeshBasicMaterial({ map: planetTex(b) })
                    : new THREE.MeshStandardMaterial({ map: planetTex(b), roughness: .92 });
  b.mesh = new THREE.Mesh(new THREE.SphereGeometry(b.size, 48, 32), mat);
  b.mesh.userData.id = b.id; b.pivot.add(b.mesh); pickable.push(b.mesh);

  if (isSun) {                                                              // glow
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 8, 64, 64, 64); g.addColorStop(0, 'rgba(255,190,90,.9)'); g.addColorStop(1, 'rgba(255,140,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(b.size * 4.2, b.size * 4.2, 1); b.pivot.add(s);
    const s2 = s.clone(); s2.material = s.material.clone(); s2.material.opacity = .35;   // outer corona
    s2.scale.set(b.size * 8, b.size * 8, 1); b.pivot.add(s2);
  }
  if (b.ring) {                                                             // ring
    const r = new THREE.Mesh(ringGeometry(b.size * 1.45, b.size * 2.4),
      ringMaterial());
    r.rotation.x = Math.PI / 2 - .45; b.pivot.add(r);
  }
  if (b.atmo) b.pivot.add(new THREE.Mesh(new THREE.SphereGeometry(b.size * 1.12, 32, 24),   // atmosphere glow
    new THREE.MeshBasicMaterial({ color: b.atmo, transparent: true, opacity: .2, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
  if (b.id === 'earth') {                                                   // cloud layer
    b.clouds = new THREE.Mesh(new THREE.SphereGeometry(b.size * 1.015, 48, 32), new THREE.MeshStandardMaterial({ map: cloudTex(), transparent: true, depthWrite: false, roughness: 1 }));
    b.pivot.add(b.clouds);
  }
  if (b.moons) b.moons.forEach(m => {                                       // moons
    m.ang = Math.random() * 6.283;
    m.w = CONFIG.orbitRate * 3 / Math.sqrt(m.period / 365.25) / 3;
    m.mesh = new THREE.Mesh(new THREE.SphereGeometry(m.size, 24, 16), new THREE.MeshStandardMaterial({ color: m.color, roughness: 1 }));
    b.pivot.add(m.mesh);
  });
  if (b.orbit) {                                                            // orbit line
    const pts = []; for (let k = 0; k <= 128; k++) { const a = k / 128 * 6.2832; pts.push(new THREE.Vector3(Math.cos(a) * b.orbit, 0, Math.sin(a) * b.orbit)); }
    b.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x6f86d6, transparent: true, opacity: .2 }));
    b.line.visible = CONFIG.showOrbits; scene.add(b.line);
  }
  b.label = document.createElement('div'); b.label.className = 'lbl'; b.label.textContent = b.name;
  b.label.onclick = () => select(b.id); labelsEl.appendChild(b.label);      // select() lives in app.js
});

/* ring drawn around the selected body */
const selRing = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.38, 64),
  new THREE.MeshBasicMaterial({ color: 0xffb454, side: THREE.DoubleSide, transparent: true, opacity: .9, depthTest: false }));
selRing.visible = false; scene.add(selRing);

/* ---------- click a body in 3D to select it (ignores drags) ---------- */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let downAt = null;
canvas.addEventListener('pointerdown', e => downAt = { x: e.clientX, y: e.clientY });
canvas.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  const r = canvas.getBoundingClientRect();
  mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, cam);
  const hit = ray.intersectObjects(pickable)[0];
  if (hit) select(hit.object.userData.id);
});

/* ---------- asteroid belt (between Mars and Jupiter) ---------- */
const belt = (function () {
  const n = CONFIG.beltCount, [r0, r1] = CONFIG.beltRadius, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, r = r0 + Math.random() * (r1 - r0); p[i*3] = Math.cos(a) * r; p[i*3+1] = (Math.random() - .5) * .9; p[i*3+2] = Math.sin(a) * r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xa39a8c, size: .22, transparent: true, opacity: .85 }));
  scene.add(pts); return pts;
})();

/* ---------- glowing orbit trail behind the selected planet ---------- */
const TRAIL_N = 48;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffb454, transparent: true, opacity: .85 }));
trail.visible = false; trail.frustumCulled = false; scene.add(trail);
function updateTrail(b) {
  if (!b || !b.orbit) { trail.visible = false; return; }
  const a = trailGeo.attributes.position;
  for (let i = 0; i < TRAIL_N; i++) { const t = b.ang - (i / (TRAIL_N - 1)) * CONFIG.trailArc; a.setXYZ(i, Math.cos(t) * b.orbit, 0, Math.sin(t) * b.orbit); }
  a.needsUpdate = true; trail.visible = true;
}

/* ---------- true proportions toggle (planets sized by real diameter; Sun stays as is) ---------- */
const curSize = b => b.size * b.pivot.scale.x;
function setProportions(on) {
  BODIES.forEach(b => {
    const f = (on && b.id !== 'sun') ? (CONFIG.trueScaleFactor * b.diam / 12756) / b.size : 1;
    b.pivot.scale.setScalar(f);
  });
}

/* ---------- hover tooltip ---------- */
const tip = $('#tip');
canvas.addEventListener('pointermove', e => {
  if (e.buttons) { tip.hidden = true; return; }
  const r = canvas.getBoundingClientRect();
  mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, cam);
  const hit = ray.intersectObjects(pickable)[0];
  if (hit) {
    const b = BODIES.find(p => p.id === hit.object.userData.id);
    tip.innerHTML = `<b>${b.name}</b><span>${b.type}</span>`;
    tip.style.transform = `translate(${e.clientX - r.left + 14}px,${e.clientY - r.top + 14}px)`;
    tip.hidden = false; canvas.style.cursor = 'pointer';
  } else { tip.hidden = true; canvas.style.cursor = 'grab'; }
});
canvas.addEventListener('pointerleave', () => { tip.hidden = true; });


/* ---------- distant nebula glow (depth behind the stars) ---------- */
(function nebula() {
  [[-300, 120, -380, 'rgba(110,80,220,.30)', 760], [320, -80, -420, 'rgba(50,130,255,.24)', 860], [40, 200, 420, 'rgba(255,120,160,.14)', 760]].forEach(n => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, n[3]); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    s.position.set(n[0], n[1], n[2]); s.scale.set(n[4], n[4], 1); s.renderOrder = -1; scene.add(s);
  });
})();

/* =========================================================
   STORY SCENE: large planets for the scroll sections.
   Own renderer on #storyGL (fixed, transparent). Each planet follows
   its section on screen with a little parallax, and is only drawn
   while the stories are visible. Built lazily by initStoryScene().
   ========================================================= */
const story = { ready: false, active: false, meshes: [] };

function initStoryScene() {
  if (story.ready) return; story.ready = true;
  const cv = $('#storyGL');
  story.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  story.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  story.scene = new THREE.Scene();
  story.cam = new THREE.PerspectiveCamera(35, 1, .1, 100); story.cam.position.z = 10;
  story.scene.add(new THREE.AmbientLight(0xffffff, .38));
  const sunlight = new THREE.DirectionalLight(0xfff1dd, 1.9); sunlight.position.set(-5, 3, 6); story.scene.add(sunlight);
  STORIES.forEach(s => {
    const b = BODIES.find(p => p.id === s.id), group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ map: planetTex(b), roughness: .95 }));
    group.add(mesh);
    let clouds = null;
    if (b.atmo) group.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), new THREE.MeshBasicMaterial({ color: b.atmo, transparent: true, opacity: .22, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    if (b.id === 'earth') { clouds = new THREE.Mesh(new THREE.SphereGeometry(1.015, 64, 48), new THREE.MeshStandardMaterial({ map: cloudTex(), transparent: true, depthWrite: false, roughness: 1 })); group.add(clouds); }
    if (b.ring) { const r = new THREE.Mesh(ringGeometry(1.45, 2.4), ringMaterial()); r.rotation.x = Math.PI / 2; group.add(r); }
    group.rotation.z = s.tilt; group.visible = false; story.scene.add(group);
    story.meshes.push({ s, group, mesh, clouds, el: document.getElementById('story-' + s.id), r0: Math.random() * 6 });
  });
  storyResize(); addEventListener('resize', storyResize);
}
function storyResize() {
  if (!story.ready) return;
  story.renderer.setSize(innerWidth, innerHeight, false);
  story.cam.aspect = innerWidth / innerHeight; story.cam.updateProjectionMatrix();
}
function storyFrame() {
  const W = innerWidth, H = innerHeight, k = 2 * 10 * Math.tan(17.5 * Math.PI / 180) / H, narrow = W < 860, t = performance.now() * .001;
  story.meshes.forEach(m => {
    if (!m.el) return;
    const r = m.el.getBoundingClientRect(), cy = r.top + r.height * (narrow ? .27 : .5), off = (cy - H / 2) / H;   // -1..1 around the viewport centre
    const vis = Math.abs(off) < 1.1; m.group.visible = vis; if (!vis) return;
    const ease = 1 - Math.min(1, Math.abs(off) * 1.1), e = ease * ease * (3 - 2 * ease);
    const side = narrow ? 0 : (m.s.side === 'left' ? -1 : 1);
    m.group.position.set(side * W * .22 * k, -(cy - H / 2) * k * .92, 0);                                          // .92 = slight parallax lag
    m.group.scale.setScalar(m.s.scale * (narrow ? .62 : 1) * (.78 + .22 * e));
    m.mesh.rotation.y = m.r0 + t * .1 + scrollY * .0016;
    if (m.clouds) m.clouds.rotation.y = m.mesh.rotation.y * 1.25;
    m.group.rotation.x = off * .25;
  });
  story.renderer.render(story.scene, story.cam);
}
