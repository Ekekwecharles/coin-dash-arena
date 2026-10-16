// Coin Dash Arena: a three.js game for start.ng.
// Run around a floating arena as your own start.ng character, grab coins to keep
// the clock alive, and dodge the spike balls that roll across.
import * as THREE from './vendor/three.module.js';
import { buildCharacter, animateCharacter, normalizeStyle, disposeTree, DEFAULT_STYLE } from './character.js';
import * as startng from './startng.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const COVER = params.has('cover');

const ARENA_R = 15;
const PLAY_R = 13.9;
const START_TIME = 30;
const MAX_TIME = 60;
const RUN_SPEED = 7.2;

const rand = (a, b) => a + Math.random() * (b - a);
const fmtTime = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- renderer
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#5d4680', 45, 120);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300);

scene.add(new THREE.HemisphereLight('#dfe9ff', '#4a3550', 1.5));
const sun = new THREE.DirectionalLight('#fff0d8', 2.6);
sun.position.set(10, 22, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun);
const rim = new THREE.DirectionalLight('#ff9fd0', 0.8);
rim.position.set(-12, 6, -14);
scene.add(rim);

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });

// ---------------------------------------------------------------- world
const decor = [];

function buildArena() {
  const g = new THREE.Group();

  const grass = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R, ARENA_R, 0.8, 72), flat('#5fae6e'));
  grass.position.y = -0.4;
  grass.receiveShadow = true;
  g.add(grass);

  const ringMat = flat('#77c585', { polygonOffset: true, polygonOffsetFactor: -1 });
  for (let i = 1; i <= 4; i++) {
    const r = i * 3.2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.07, r + 0.07, 96), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    ring.receiveShadow = true;
    g.add(ring);
  }
  const emblem = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.05, 6),
    flat('#d8fd71', { emissive: '#4c6a10', emissiveIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  emblem.rotation.x = -Math.PI / 2;
  emblem.position.y = 0.01;
  emblem.receiveShadow = true;
  g.add(emblem);

  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 0.05, ARENA_R * 0.96, 1.1, 72), flat('#8a6a52'));
  dirt.position.y = -1.35;
  g.add(dirt);
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R * 0.96, 6.5, 4.5, 20), flat('#6b5868'));
  rock.position.y = -4.15;
  g.add(rock);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(6.5, 6, 14), flat('#574656'));
  tip.rotation.x = Math.PI;
  tip.position.y = -9.4;
  g.add(tip);

  const stone = flat('#ddd6c8');
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R, 0.3, 8, 120), stone);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = 0.05;
  rimRing.receiveShadow = true;
  g.add(rimRing);

  const glow = flat('#d8fd71', { emissive: '#d8fd71', emissiveIntensity: 0.9 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 0.6), stone);
    post.position.set(Math.cos(a) * ARENA_R, 0.65, Math.sin(a) * ARENA_R);
    post.rotation.y = -a;
    post.castShadow = true;
    g.add(post);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.42), glow);
    cap.position.set(post.position.x, 1.42, post.position.z);
    cap.rotation.y = -a;
    g.add(cap);
  }
  scene.add(g);

  // floating rocks in the sky
  const rockMats = [flat('#7b6a86'), flat('#8d7a7a'), flat('#5f5a7a')];
  const grassTop = flat('#6dbb79');
  for (let i = 0; i < 16; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(26, 55);
    const s = rand(1, 3.4);
    const r = new THREE.Group();
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMats[i % 3]);
    body.scale.y = 0.7;
    r.add(body);
    if (i % 2 === 0) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.8, s * 0.85, s * 0.25, 7), grassTop);
      top.position.y = s * 0.55;
      r.add(top);
    }
    r.position.set(Math.cos(a) * d, rand(-12, 10), Math.sin(a) * d);
    r.rotation.y = rand(0, Math.PI);
    r.userData = { baseY: r.position.y, phase: rand(0, 6), speed: rand(0.3, 0.7) };
    scene.add(r);
    decor.push(r);
  }

  // stars
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 500; i++) {
    const th = rand(0, Math.PI * 2);
    const ph = rand(0.05, Math.PI * 0.48);
    const R = 140;
    pts.push(Math.cos(th) * Math.sin(ph) * R, Math.cos(ph) * R, Math.sin(th) * Math.sin(ph) * R);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.7, fog: false, transparent: true, opacity: 0.8 })));
}
buildArena();

// ---------------------------------------------------------------- player
const player = {
  root: new THREE.Group(),
  model: null,
  styleKey: '',
  vel: new THREE.Vector3(),
  knock: new THREE.Vector3(),
  yaw: 0,
  invuln: 0,
  dashT: 0,
  dashCd: 0,
  popT: 0,
};
scene.add(player.root);

// Builds (or rebuilds) the 3D character from a start.ng style. Returns true if it changed.
function setCharacter(style) {
  const key = JSON.stringify(normalizeStyle(style));
  if (key === player.styleKey) return false;
  const hadModel = !!player.model;
  player.styleKey = key;
  if (player.model) {
    player.root.remove(player.model);
    disposeTree(player.model);
  }
  player.model = buildCharacter(style);
  player.root.add(player.model);
  if (hadModel) {
    player.popT = 0.45;
    burst(player.root.position.clone().setY(1.2), '#d8fd71', 18);
  }
  return true;
}

// ---------------------------------------------------------------- pickups
const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24);
const coinInnerGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.13, 24);
const coinMat = new THREE.MeshStandardMaterial({ color: '#ffc93c', metalness: 0.15, roughness: 0.35, emissive: '#b86e00', emissiveIntensity: 0.35 });
const coinInnerMat = new THREE.MeshStandardMaterial({ color: '#f5a623', metalness: 0.15, roughness: 0.4, emissive: '#8a4a00', emissiveIntensity: 0.3 });
const orbGeo = new THREE.IcosahedronGeometry(0.34, 0);
const orbMat = new THREE.MeshStandardMaterial({ color: '#5ee7ff', emissive: '#18a6c8', emissiveIntensity: 0.9, roughness: 0.25, flatShading: true });
const orbRingGeo = new THREE.TorusGeometry(0.55, 0.035, 6, 32);
const shadowGeo = new THREE.CircleGeometry(0.4, 20);
const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false });

const coins = [];
const orbs = [];

function randomSpot(minFromPlayer = 3) {
  for (let i = 0; i < 30; i++) {
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * (PLAY_R - 1.3);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x - player.root.position.x, z - player.root.position.z) >= minFromPlayer) return { x, z };
  }
  return { x: 0, z: 0 };
}

function addShadow(group) {
  const s = new THREE.Mesh(shadowGeo, shadowMat);
  s.rotation.x = -Math.PI / 2;
  s.position.y = 0.02;
  group.add(s);
}

function spawnCoin(at) {
  const { x, z } = at ?? randomSpot();
  const g = new THREE.Group();
  const spin = new THREE.Group();
  const disc = new THREE.Mesh(coinGeo, coinMat);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  const inner = new THREE.Mesh(coinInnerGeo, coinInnerMat);
  inner.rotation.x = Math.PI / 2;
  spin.add(disc, inner);
  spin.position.y = 0.75;
  g.add(spin);
  addShadow(g);
  g.position.set(x, 0, z);
  g.scale.setScalar(0.01);
  scene.add(g);
  coins.push({ group: g, spin, t: rand(0, 6), grow: 0 });
}

function spawnOrb() {
  const { x, z } = randomSpot(5);
  const g = new THREE.Group();
  const spin = new THREE.Group();
  const core = new THREE.Mesh(orbGeo, orbMat);
  core.castShadow = true;
  const ring = new THREE.Mesh(orbRingGeo, orbMat);
  ring.rotation.x = Math.PI / 2;
  spin.add(core, ring);
  spin.position.y = 0.85;
  g.add(spin);
  addShadow(g);
  g.position.set(x, 0, z);
  g.scale.setScalar(0.01);
  scene.add(g);
  orbs.push({ group: g, spin, life: 7, t: 0, grow: 0 });
}

function removeFrom(list, i) {
  scene.remove(list[i].group);
  if (list[i].marker) scene.remove(list[i].marker);
  list.splice(i, 1);
}

// ---------------------------------------------------------------- spike balls
const BALL_R = 0.62;
const ballCoreGeo = new THREE.IcosahedronGeometry(BALL_R, 0);
const ballCoreMat = flat('#2e2a3c');
const spikeGeo = new THREE.ConeGeometry(0.13, 0.4, 5);
const spikeMat = flat('#ff5a5a', { emissive: '#6a0d12', emissiveIntensity: 0.6 });
const markerGeo = new THREE.RingGeometry(0.75, 1.05, 32);
const spikeDirs = (() => {
  const pos = new THREE.IcosahedronGeometry(1, 0).getAttribute('position');
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    seen.set(v.toArray().map((n) => n.toFixed(3)).join(','), v);
  }
  return [...seen.values()];
})();
const UP = new THREE.Vector3(0, 1, 0);
const balls = [];

function makeBall() {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const core = new THREE.Mesh(ballCoreGeo, ballCoreMat);
  core.castShadow = true;
  spin.add(core);
  for (const d of spikeDirs) {
    const s = new THREE.Mesh(spikeGeo, spikeMat);
    s.position.copy(d).multiplyScalar(BALL_R + 0.12);
    s.quaternion.setFromUnitVectors(UP, d);
    s.castShadow = true;
    spin.add(s);
  }
  spin.position.y = 0.82;
  group.add(spin);
  return { group, spin };
}

function spawnBall(speed) {
  const a = rand(0, Math.PI * 2);
  const start = new THREE.Vector3(Math.cos(a) * (PLAY_R - 0.3), 0, Math.sin(a) * (PLAY_R - 0.3));
  // Aim near the player, a little ahead of where they're running.
  const target = player.root.position.clone().addScaledVector(player.vel, 0.35);
  target.x += rand(-2.2, 2.2);
  target.z += rand(-2.2, 2.2);
  const dir = target.sub(start).setY(0);
  if (dir.lengthSq() < 1) dir.set(-start.x, 0, -start.z);
  dir.normalize();

  const { group, spin } = makeBall();
  group.position.copy(start);
  group.scale.setScalar(0.01);
  scene.add(group);

  const marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: '#ff5a5a', transparent: true, opacity: 0.8, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(start.x, 0.03, start.z);
  scene.add(marker);

  balls.push({ group, spin, marker, dir, speed, warn: 0.75, vy: 0, falling: false });
  beep(220, 0.12, 'square', 0.04);
}

function clearWorld() {
  while (coins.length) removeFrom(coins, 0);
  while (orbs.length) removeFrom(orbs, 0);
  while (balls.length) removeFrom(balls, 0);
}

// ---------------------------------------------------------------- particles & popups
const partGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const parts = [];
const partMats = new Map();
function burst(pos, color, n = 12) {
  if (!partMats.has(color)) partMats.set(color, new THREE.MeshBasicMaterial({ color }));
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, partMats.get(color));
    m.position.copy(pos);
    scene.add(m);
    parts.push({ m, v: new THREE.Vector3(rand(-3, 3), rand(2.5, 6), rand(-3, 3)), life: rand(0.45, 0.75) });
  }
}

function popup(text, worldPos, cls) {
  const v = worldPos.clone().project(camera);
  const el = document.createElement('div');
  el.className = `popup ${cls}`;
  el.textContent = text;
  el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
  el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  $('popups').append(el);
  setTimeout(() => el.remove(), 950);
}

// ---------------------------------------------------------------- sound
let actx = null;
let muted = false;
try { muted = localStorage.getItem('cda-muted') === '1'; } catch { /* storage blocked */ }
function beep(freq, dur = 0.12, type = 'sine', vol = 0.12, slideTo = 0) {
  if (muted || COVER) return;
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* no audio */ }
}
function renderMute() {
  $('mute-waves').toggleAttribute('hidden', muted);
  $('mute-x').toggleAttribute('hidden', !muted);
  $('mute').setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
}
$('mute').addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem('cda-muted', muted ? '1' : '0'); } catch { /* storage blocked */ }
  renderMute();
  beep(660, 0.08);
});
renderMute();

// ---------------------------------------------------------------- start.ng identity
const identity = { ready: false, offline: !startng.onStartNg, user: null, guest: null };

function localGuest() {
  // Off start.ng there is no player. ?style={...}&name=... lets you preview looks locally.
  let style = { ...DEFAULT_STYLE, primaryColor: '#d8fd71', secondaryColor: '#3a3d4a', hair: 'short' };
  try {
    if (params.get('style')) style = JSON.parse(params.get('style'));
  } catch { /* ignore bad preview style */ }
  return { name: params.get('name') || 'Guest', style, face: null };
}

let refreshing = false;
async function refreshIdentity() {
  if (refreshing) return;
  refreshing = true;
  try {
    const r = await startng.whoami();
    if (r) {
      identity.offline = false;
      identity.user = r.user;
      identity.guest = r.guest ?? localGuest();
    } else {
      identity.offline = true;
      identity.user = null;
      identity.guest = localGuest();
    }
    identity.ready = true;
    const p = identity.user ?? identity.guest;
    setCharacter(p.style);
    renderIdentity();
  } finally {
    refreshing = false;
  }
}

function renderIdentity() {
  const user = identity.user;
  const p = user ?? identity.guest;
  const face = $('player-face');
  if (p.face) face.src = p.face;
  else face.removeAttribute('src');
  $('player-initial').textContent = (p.name || 'G').trim().charAt(0).toUpperCase() || 'G';
  $('player-name').textContent = p.name || 'Guest';
  $('player-account').textContent = user?.account ? `@${user.account}` : identity.offline ? 'Offline preview' : 'Not signed in';
  $('player-sign-in').hidden = !!user || identity.offline;
  $('player-card').hidden = false;

  $('menu-name').textContent = user ? p.name : `${p.name || 'Guest'} (guest)`;
  const showSignin = !user;
  $('menu-signin').hidden = !showSignin;
  if (showSignin) {
    $('menu-signin-text').textContent = identity.offline
      ? 'Your start.ng character and the leaderboard load once this game is live on start.ng.'
      : 'Sign in on start.ng to play as your own character and save your best run.';
    $('menu-signin-btn').hidden = identity.offline;
  }
  $('over-signin-btn').hidden = !!user || identity.offline;
  $('play-btn').disabled = false;
}

for (const id of ['player-sign-in', 'menu-signin-btn', 'over-signin-btn']) {
  $(id).addEventListener('click', () => startng.signIn());
}

// The player may sign in or change their look on start.ng in another tab.
let lastCheck = 0;
function recheck() {
  if (document.visibilityState !== 'visible' || state.mode === 'playing') return;
  if (performance.now() - lastCheck < 1500) return;
  lastCheck = performance.now();
  refreshIdentity().then(() => state.mode !== 'playing' && refreshBoard());
}
document.addEventListener('visibilitychange', recheck);
addEventListener('focus', recheck);

// ---------------------------------------------------------------- leaderboard
async function refreshBoard() {
  const list = $('board');
  const note = $('board-note');
  const r = await startng.getLeaderboard(10);
  list.replaceChildren();
  if (!r) {
    note.textContent = identity.offline
      ? 'The leaderboard appears once the game is live on start.ng.'
      : 'Could not reach start.ng. Try again in a moment.';
    return;
  }
  const entries = r.ok === false ? [] : (r.entries ?? []);
  note.textContent = entries.length ? '' : 'No runs yet. Be the first on the board.';
  for (const e of entries) {
    const li = document.createElement('li');
    if (identity.user && e.player_id === identity.user.id) li.classList.add('me');
    const cells = [
      ['rank', `#${e.rank}`],
      ['dot', ''],
      ['name', e.name ?? 'Player'],
      ['coins', `${e.stats?.coins ?? e.score ?? 0}`],
      ['time', e.stats?.survived != null ? fmtTime(e.stats.survived) : ''],
    ];
    for (const [cls, text] of cells) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      if (cls === 'dot') span.style.background = /^#[0-9a-f]{6}$/i.test(e.color) ? e.color : '#d8fd71';
      li.append(span);
    }
    list.append(li);
  }
}

// ---------------------------------------------------------------- game state
const state = {
  mode: 'menu', // menu | playing | over
  time: START_TIME,
  coins: 0,
  survived: 0,
  ballTimer: 0,
  orbTimer: 0,
  shake: 0,
  lowWarned: false,
};

function showOverlay(which) {
  $('overlay').hidden = false;
  $('menu').hidden = which !== 'menu';
  $('over').hidden = which !== 'over';
  const col = document.querySelector('.column');
  col.style.animation = 'none';
  void col.offsetWidth;
  col.style.animation = '';
}

function startGame() {
  if (!identity.ready || state.mode === 'playing') return;
  clearWorld();
  Object.assign(state, { mode: 'playing', time: START_TIME, coins: 0, survived: 0, ballTimer: 2.2, orbTimer: rand(9, 12), lowWarned: false });
  player.root.position.set(0, 0, 0);
  player.vel.set(0, 0, 0);
  player.knock.set(0, 0, 0);
  player.yaw = 0;
  player.invuln = 0;
  player.dashT = 0;
  player.dashCd = 0;
  for (let i = 0; i < 4; i++) spawnCoin();
  $('overlay').hidden = true;
  $('hud').hidden = false;
  $('hint').style.opacity = '1';
  setTimeout(() => ($('hint').style.opacity = '0'), 4500);
  $('touch').hidden = !isTouch;
  beep(523, 0.1, 'triangle', 0.1);
  setTimeout(() => beep(784, 0.14, 'triangle', 0.1), 90);
  canvas.focus?.();
}

async function endGame() {
  state.mode = 'over';
  $('hud').hidden = true;
  $('touch').hidden = true;
  joy.x = joy.y = 0;
  beep(392, 0.18, 'sawtooth', 0.07, 196);
  setTimeout(() => beep(262, 0.3, 'sawtooth', 0.07, 130), 160);

  const stats = { coins: state.coins, survived: Math.floor(state.survived) };
  $('over-coins').textContent = stats.coins;
  $('over-survived').textContent = fmtTime(stats.survived);
  const msg = $('over-message');
  msg.className = 'over-message';
  showOverlay('over');
  setTimeout(() => $('again-btn').focus(), 50);

  if (!identity.user) {
    msg.textContent = identity.offline
      ? 'Scores save once the game is live on start.ng.'
      : 'Playing as a guest, so this run was not saved.';
    refreshBoard();
    return;
  }
  msg.textContent = 'Saving your run…';
  const saved = await startng.saveRun(stats);
  if (saved?.ok) {
    const { improved, rank } = saved.result ?? {};
    msg.textContent = improved ? `New best! You're #${rank} on the board.` : `Not your best this time. Your best is #${rank}.`;
    if (improved) msg.classList.add('good');
  } else {
    msg.textContent = saved?.error ?? 'Could not save this run. Check your connection.';
  }
  refreshBoard();
}

$('play-btn').addEventListener('click', startGame);
$('again-btn').addEventListener('click', startGame);

// ---------------------------------------------------------------- input
const keys = new Set();
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (state.mode === 'playing') {
    if (MOVE_KEYS.includes(k)) e.preventDefault();
    keys.add(k);
    if ((k === ' ' || k === 'shift') && !e.repeat) tryDash();
  } else if (k === 'enter' && document.activeElement?.tagName !== 'BUTTON') {
    startGame();
  }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', isTouch);
const joy = { x: 0, y: 0, id: null };
const stick = $('stick');
const knob = $('knob');
function moveStick(e) {
  const r = stick.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const max = r.width / 2 - 10;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / max;
  joy.y = dy / max;
}
stick.addEventListener('pointerdown', (e) => {
  joy.id = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  moveStick(e);
});
stick.addEventListener('pointermove', (e) => e.pointerId === joy.id && moveStick(e));
const releaseStick = (e) => {
  if (e.pointerId !== joy.id) return;
  joy.id = null;
  joy.x = joy.y = 0;
  knob.style.transform = '';
};
stick.addEventListener('pointerup', releaseStick);
stick.addEventListener('pointercancel', releaseStick);
$('dash-btn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tryDash();
});

function tryDash() {
  if (state.mode !== 'playing' || player.dashCd > 0) return;
  player.dashT = 0.2;
  player.dashCd = 1.1;
  player.invuln = Math.max(player.invuln, 0.3);
  burst(player.root.position.clone().setY(0.4), '#d8fd71', 8);
  beep(300, 0.16, 'triangle', 0.08, 900);
}

// ---------------------------------------------------------------- gameplay
const tmp = new THREE.Vector3();

function hitPlayer(ball) {
  state.time -= 5;
  state.shake = 0.45;
  player.invuln = 1.3;
  player.knock.copy(ball.dir).multiplyScalar(13);
  const p = player.root.position.clone().setY(2.3);
  popup('−5s', p, 'red');
  burst(p.setY(1.2), '#ff5a5a', 14);
  beep(140, 0.25, 'sawtooth', 0.12, 60);
  const timer = $('timer');
  timer.classList.remove('hit');
  void timer.offsetWidth;
  timer.classList.add('hit');
}

function updatePlay(dt) {
  state.time -= dt;
  state.survived += dt;

  // movement relative to the camera (camera looks toward -z)
  let ix = joy.x;
  let iz = joy.y;
  if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
  if (keys.has('d') || keys.has('arrowright')) ix += 1;
  if (keys.has('w') || keys.has('arrowup')) iz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) iz += 1;
  let len = Math.hypot(ix, iz);
  if (len > 1) {
    ix /= len;
    iz /= len;
    len = 1;
  }
  if (player.dashT > 0 && len < 0.2) {
    ix = Math.sin(player.yaw);
    iz = Math.cos(player.yaw);
  }
  const speed = RUN_SPEED * (player.dashT > 0 ? 2.7 : 1);
  const k = 1 - Math.exp(-14 * dt);
  player.vel.x += (ix * speed - player.vel.x) * k;
  player.vel.z += (iz * speed - player.vel.z) * k;
  player.knock.multiplyScalar(Math.exp(-6 * dt));

  const pos = player.root.position;
  pos.addScaledVector(player.vel, dt).addScaledVector(player.knock, dt);
  const r = Math.hypot(pos.x, pos.z);
  if (r > PLAY_R) {
    pos.x *= PLAY_R / r;
    pos.z *= PLAY_R / r;
  }

  player.dashT -= dt;
  player.dashCd -= dt;
  player.invuln -= dt;

  // coins
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (Math.hypot(c.group.position.x - pos.x, c.group.position.z - pos.z) < 1.05) {
      state.coins += 1;
      state.time = Math.min(MAX_TIME, state.time + 1.5);
      const at = c.group.position.clone().setY(1.2);
      burst(at, '#ffc93c', 10);
      popup('+1', at.clone().setY(2), 'gold');
      beep(880 + Math.min(state.coins, 30) * 12, 0.09, 'square', 0.05);
      setTimeout(() => beep(1320 + Math.min(state.coins, 30) * 12, 0.08, 'square', 0.04), 60);
      removeFrom(coins, i);
      const el = $('hud-coins').parentElement;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }
  const want = Math.min(7, 4 + Math.floor(state.survived / 20));
  while (coins.length < want) spawnCoin();

  // time orbs
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    if (Math.hypot(o.group.position.x - pos.x, o.group.position.z - pos.z) < 1.1) {
      state.time = Math.min(MAX_TIME, state.time + 5);
      const at = o.group.position.clone().setY(1.2);
      burst(at, '#5ee7ff', 16);
      popup('+5s', at.clone().setY(2.1), 'cyan');
      beep(660, 0.1, 'sine', 0.1);
      setTimeout(() => beep(990, 0.18, 'sine', 0.1), 80);
      removeFrom(orbs, i);
    }
  }
  state.orbTimer -= dt;
  if (state.orbTimer <= 0) {
    if (orbs.length === 0) spawnOrb();
    state.orbTimer = rand(9, 13);
  }

  // spike balls get faster and more frequent the longer you last
  state.ballTimer -= dt;
  if (state.ballTimer <= 0) {
    const speed = Math.min(17, 6.5 + state.survived * 0.13);
    spawnBall(speed);
    if (state.survived > 45 && Math.random() < 0.35) spawnBall(speed * 0.85);
    state.ballTimer = Math.max(0.5, 2.1 - state.survived * 0.028) * rand(0.8, 1.2);
  }

  if (state.time <= 5 && !state.lowWarned) {
    state.lowWarned = true;
    beep(440, 0.15, 'square', 0.05);
  }
  if (state.time > 6) state.lowWarned = false;

  if (state.time <= 0) {
    state.time = 0;
    renderHud();
    endGame();
    return;
  }
  renderHud();
}

function renderHud() {
  $('hud-time').textContent = fmtTime(Math.ceil(state.time));
  $('hud-bar').style.width = `${Math.min(100, (state.time / START_TIME) * 100)}%`;
  $('timer').classList.toggle('low', state.time <= 5);
  $('hud-coins').textContent = state.coins;
  $('hud-survived').textContent = fmtTime(state.survived);
  const ready = player.dashCd <= 0;
  $('dash-fill').style.width = `${ready ? 100 : (1 - player.dashCd / 1.1) * 100}%`;
  $('dash-meter').classList.toggle('ready', ready);
  $('dash-btn').classList.toggle('cooling', !ready);
}

function updateBalls(dt) {
  const pos = player.root.position;
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.warn > 0) {
      b.warn -= dt;
      const s = Math.min(1, 1 - b.warn / 0.75 + 0.15);
      b.group.scale.setScalar(s);
      b.marker.material.opacity = 0.45 + Math.sin(b.warn * 30) * 0.35;
      if (b.warn <= 0) {
        b.group.scale.setScalar(1);
        scene.remove(b.marker);
        b.marker.material.dispose();
        b.marker = null;
      }
      continue;
    }
    b.group.position.addScaledVector(b.dir, b.speed * dt);
    tmp.set(b.dir.z, 0, -b.dir.x);
    b.spin.rotateOnWorldAxis(tmp, (b.speed * dt) / (BALL_R + 0.2));

    const r = Math.hypot(b.group.position.x, b.group.position.z);
    if (!b.falling && r > ARENA_R + 0.4) b.falling = true;
    if (b.falling) {
      b.vy -= 30 * dt;
      b.group.position.y += b.vy * dt;
      if (b.group.position.y < -25) removeFrom(balls, i);
      continue;
    }
    if (
      state.mode === 'playing' &&
      player.invuln <= 0 &&
      Math.hypot(b.group.position.x - pos.x, b.group.position.z - pos.z) < BALL_R + 0.42
    ) {
      hitPlayer(b);
    }
  }
}

// ---------------------------------------------------------------- camera
const viewOffset = { x: 0, y: 0 };
const camTarget = new THREE.Vector3();
let orbit = 0.6;

function updateCamera(dt) {
  const p = player.root.position;
  const W = innerWidth;
  const H = innerHeight;
  const overlayUp = state.mode !== 'playing' && !COVER;
  const wide = W > 820;
  const wantX = overlayUp && wide ? -W * 0.17 : 0;
  const wantY = overlayUp && !wide ? H * 0.2 : 0;
  const k = 1 - Math.exp(-4 * dt);
  viewOffset.x += (wantX - viewOffset.x) * k;
  viewOffset.y += (wantY - viewOffset.y) * k;
  camera.setViewOffset(W, H, viewOffset.x, viewOffset.y, W, H);

  if (COVER) return;
  if (state.mode === 'menu') {
    orbit += dt * 0.28;
    const d = wide ? 5.6 : 6.6;
    tmp.set(p.x + Math.sin(orbit) * d, 2.3, p.z + Math.cos(orbit) * d);
    camTarget.set(p.x, 1.15, p.z);
  } else if (state.mode === 'over') {
    tmp.set(p.x, 5.5, p.z + 7.5);
    camTarget.set(p.x, 1.1, p.z);
  } else {
    const narrow = W / H < 0.8;
    tmp.set(p.x * 0.85, narrow ? 15 : 11, p.z * 0.85 + (narrow ? 12.5 : 10.5));
    camTarget.set(p.x * 0.9, 0.8, p.z * 0.9);
  }
  camera.position.lerp(tmp, 1 - Math.exp(-5 * dt));
  camera.lookAt(camTarget);
  if (state.shake > 0) {
    state.shake -= dt;
    const s = state.shake * 0.5;
    camera.position.x += rand(-s, s);
    camera.position.y += rand(-s, s);
  }
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 58 : 48;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- main loop
const timer = new THREE.Timer();
timer.connect(document);
let elapsed = 0;

function frame(now) {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.05);
  elapsed += dt;

  for (const r of decor) {
    r.position.y = r.userData.baseY + Math.sin(elapsed * r.userData.speed + r.userData.phase) * 0.6;
    r.rotation.y += dt * 0.04;
  }
  for (const c of coins) {
    c.t += dt;
    c.grow = Math.min(1, c.grow + dt * 4);
    c.group.scale.setScalar(c.grow);
    c.spin.rotation.y += dt * 3;
    c.spin.position.y = 0.75 + Math.sin(c.t * 3) * 0.12;
  }
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.t += dt;
    if (state.mode === 'playing') o.life -= dt;
    o.grow = Math.min(1, o.grow + dt * 3);
    const fade = o.life < 1.5 ? (Math.sin(o.t * 20) > 0 ? 1 : 0.4) : 1;
    o.group.scale.setScalar(o.grow * fade);
    o.spin.rotation.y += dt * 2;
    o.spin.rotation.x = Math.sin(o.t) * 0.4;
    o.spin.position.y = 0.85 + Math.sin(o.t * 2.5) * 0.15;
    if (o.life <= 0) removeFrom(orbs, i);
  }

  if (state.mode === 'playing') updatePlay(dt);
  updateBalls(dt);

  // character
  if (player.model) {
    const moving = state.mode === 'playing' ? Math.hypot(player.vel.x, player.vel.z) : COVER ? 7 : 0;
    if (state.mode === 'playing' && moving > 0.6) {
      const target = Math.atan2(player.vel.x, player.vel.z);
      let d = target - player.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      player.yaw += d * (1 - Math.exp(-14 * dt));
    } else if (state.mode !== 'playing' && !COVER) {
      let d = 0 - player.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      player.yaw += d * (1 - Math.exp(-3 * dt));
    }
    player.root.rotation.y = player.yaw;
    animateCharacter(player.model, dt, { speed: moving, wave: state.mode !== 'playing' && !COVER });
    player.model.visible = player.invuln <= 0.3 || player.dashT > 0 || Math.floor(player.invuln * 14) % 2 === 0;
    if (player.popT > 0) {
      player.popT -= dt;
      const t = Math.max(0, player.popT) / 0.45;
      player.model.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.25);
    } else {
      player.model.scale.setScalar(1);
    }
  }

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.v.y -= 14 * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.rotation.x += dt * 8;
    p.m.scale.setScalar(Math.max(0.01, p.life * 1.6));
    if (p.life <= 0) {
      scene.remove(p.m);
      parts.splice(i, 1);
    }
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot
if (COVER) {
  document.body.classList.add('cover');
  setCharacter(localGuest().style);
  identity.ready = true;
  player.root.position.set(3.4, 0, 2.6);
  player.yaw = Math.atan2(0.5 - 3.4, 10.5 - 2.6);
  const coinSpots = [[5.6, 1.2], [1.6, 4.6], [6.4, 4.2], [4.6, -2.2], [1.8, -1.4], [7.8, -0.8]];
  for (const [x, z] of coinSpots) spawnCoin({ x, z });
  for (const c of coins) c.grow = 1;
  const { group, spin } = makeBall();
  group.position.set(7.4, 0, -4.2);
  spin.rotation.set(0.4, 0.3, 0.2);
  scene.add(group);
  camera.position.set(0.5, 4.2, 10.5);
  camera.lookAt(2.2, 1.3, 0.5);
  identity.offline = true;
} else {
  showOverlay('menu');
  if (identity.offline) {
    // Not on start.ng: show the guest look straight away.
    identity.guest = localGuest();
    identity.ready = true;
    setCharacter(identity.guest.style);
    renderIdentity();
    refreshBoard();
  } else {
    refreshIdentity().then(refreshBoard);
  }
}

// small hook for debugging in the console
window.coinDash = { state, player, startGame, endGame };

requestAnimationFrame(frame);
