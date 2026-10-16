// Builds the player's start.ng character in three.js from their `style`.
// Every field start.ng sends is drawn: body, the four colours, hair, hat and accessory.
// Unknown or missing values fall back to sensible defaults, as the start.ng docs ask.
import * as THREE from './vendor/three.module.js';

export const DEFAULT_STYLE = {
  body: 'male',
  primaryColor: '#4b7bec',
  secondaryColor: '#2b2f4a',
  skinColor: '#c68642',
  hairColor: '#17120f',
  hair: 'short',
  hat: 'none',
  accessory: 'none',
};

const OPTIONS = {
  body: ['female', 'male'],
  hair: ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'],
  hat: ['none', 'cap', 'beanie', 'tophat', 'crown'],
  accessory: ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'],
};
const COLOR_KEYS = ['primaryColor', 'secondaryColor', 'skinColor', 'hairColor'];
const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeStyle(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of Object.keys(OPTIONS)) {
    out[key] = OPTIONS[key].includes(s[key]) ? s[key] : DEFAULT_STYLE[key];
  }
  for (const key of COLOR_KEYS) {
    out[key] = typeof s[key] === 'string' && HEX.test(s[key]) ? s[key] : DEFAULT_STYLE[key];
  }
  return out;
}

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function shade(hex, amount) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
  return '#' + c.getHexString();
}

function complement(hex) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL((hsl.h + 0.5) % 1, Math.max(0.55, hsl.s), THREE.MathUtils.clamp(hsl.l, 0.45, 0.6));
  return '#' + c.getHexString();
}

// ---------- hair (built around the head's centre; the head is a 0.44 cube)
function hairCap(m) {
  const g = new THREE.Group();
  g.add(box(0.48, 0.13, 0.47, m, 0, 0.215, -0.01));
  g.add(box(0.48, 0.34, 0.1, m, 0, 0.06, -0.205));
  g.add(box(0.05, 0.2, 0.36, m, 0.235, 0.12, -0.04));
  g.add(box(0.05, 0.2, 0.36, m, -0.235, 0.12, -0.04));
  return g;
}

function buildHair(type, m) {
  const g = new THREE.Group();
  let top = 0.28;
  switch (type) {
    case 'bald':
      top = 0.22;
      break;
    case 'afro': {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), m);
      puff.scale.set(1.05, 0.95, 0.85);
      puff.position.set(0, 0.17, -0.15);
      g.add(puff);
      top = 0.52;
      break;
    }
    case 'braids': {
      g.add(hairCap(m));
      const geo = new THREE.CylinderGeometry(0.035, 0.03, 0.55, 5);
      const bead = new THREE.SphereGeometry(0.045, 6, 4);
      const spots = [[-0.17, -0.22], [-0.06, -0.24], [0.06, -0.24], [0.17, -0.22], [-0.24, -0.1], [0.24, -0.1]];
      for (const [x, z] of spots) {
        const b = new THREE.Mesh(geo, m);
        b.position.set(x, -0.2, z);
        g.add(b);
        const end = new THREE.Mesh(bead, m);
        end.position.set(x, -0.48, z);
        g.add(end);
      }
      break;
    }
    case 'bun': {
      g.add(hairCap(m));
      const bun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), m);
      bun.position.set(0, 0.33, -0.1);
      g.add(bun);
      top = 0.45;
      break;
    }
    case 'ponytail': {
      g.add(hairCap(m));
      const tie = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), m);
      tie.position.set(0, 0.13, -0.27);
      g.add(tie);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.035, 0.46, 6), m);
      tail.position.set(0, -0.08, -0.33);
      tail.rotation.x = 0.35;
      tail.name = 'ponytail';
      g.add(tail);
      break;
    }
    case 'dreads': {
      g.add(hairCap(m));
      const geo = new THREE.BoxGeometry(0.06, 0.48, 0.06);
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * 0.2 + (i / 10) * Math.PI * 1.6; // around the sides and back
        const d = new THREE.Mesh(geo, m);
        d.position.set(Math.cos(a) * 0.24, -0.12, -Math.abs(Math.sin(a)) * 0.24 - 0.02);
        d.rotation.z = Math.cos(a) * 0.12;
        g.add(d);
      }
      break;
    }
    case 'short':
    default:
      g.add(hairCap(m));
      g.add(box(0.5, 0.06, 0.12, m, 0, 0.27, 0.16)); // a little quiff at the front
      top = 0.3;
  }
  return { group: g, top };
}

// ---------- hats (sit on top of the hair)
function buildHat(type, top, st) {
  const g = new THREE.Group();
  g.position.y = top;
  switch (type) {
    case 'cap': {
      const m = mat(shade(st.primaryColor, -0.08));
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.16, 10), m);
      crown.position.y = 0.04;
      g.add(crown);
      g.add(box(0.36, 0.035, 0.24, m, 0, -0.02, 0.3));
      g.add(box(0.05, 0.04, 0.05, mat('#ffffff'), 0, 0.13, 0));
      break;
    }
    case 'beanie': {
      const m = mat(complement(st.primaryColor));
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m);
      body.position.y = -0.04;
      g.add(body);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.08, 12), mat(shade(complement(st.primaryColor), -0.12)));
      cuff.position.y = -0.03;
      g.add(cuff);
      const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), mat('#fffefa'));
      pom.position.y = 0.26;
      g.add(pom);
      break;
    }
    case 'tophat': {
      const dark = mat('#1b1b22', { roughness: 0.5 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.035, 16), dark);
      g.add(brim);
      const tall = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.44, 16), dark);
      tall.position.y = 0.23;
      g.add(tall);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.07, 16), mat(st.primaryColor));
      band.position.y = 0.06;
      g.add(band);
      break;
    }
    case 'crown': {
      const gold = mat('#f5c542', { metalness: 0.7, roughness: 0.3, emissive: '#5a3c00', emissiveIntensity: 0.4 });
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.21, 0.12, 10, 1, true), gold);
      ring.material.side = THREE.DoubleSide;
      ring.position.y = 0.03;
      g.add(ring);
      const spike = new THREE.ConeGeometry(0.055, 0.15, 4);
      const gem = new THREE.OctahedronGeometry(0.035);
      const red = mat('#e8384f', { emissive: '#5a0010', emissiveIntensity: 0.6 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const s = new THREE.Mesh(spike, gold);
        s.position.set(Math.sin(a) * 0.22, 0.16, Math.cos(a) * 0.22);
        g.add(s);
        const j = new THREE.Mesh(gem, red);
        j.position.set(Math.sin(a) * 0.235, 0.03, Math.cos(a) * 0.235);
        g.add(j);
      }
      break;
    }
    default:
      break;
  }
  return g;
}

// ---------- accessories
function addAccessory(type, st, parts) {
  const { head, body, torsoW } = parts;
  switch (type) {
    case 'glasses': {
      const frame = mat('#121218', { roughness: 0.3 });
      const lens = mat('#7fc8ff', { metalness: 0.3, roughness: 0.15, emissive: '#123a5a', emissiveIntensity: 0.4 });
      for (const x of [-0.1, 0.1]) {
        head.add(box(0.15, 0.11, 0.02, frame, x, 0.03, 0.222));
        head.add(box(0.11, 0.07, 0.02, lens, x, 0.03, 0.232));
      }
      head.add(box(0.06, 0.02, 0.02, frame, 0, 0.05, 0.225));
      head.add(box(0.02, 0.02, 0.2, frame, 0.225, 0.04, 0.12));
      head.add(box(0.02, 0.02, 0.2, frame, -0.225, 0.04, 0.12));
      break;
    }
    case 'earrings': {
      const gold = mat('#f5c542', { metalness: 0.8, roughness: 0.25, emissive: '#5a3c00', emissiveIntensity: 0.5 });
      const geo = new THREE.TorusGeometry(0.045, 0.014, 6, 12);
      for (const x of [-0.235, 0.235]) {
        const e = new THREE.Mesh(geo, gold);
        e.position.set(x, -0.1, 0.02);
        e.rotation.y = Math.PI / 2;
        head.add(e);
      }
      break;
    }
    case 'beard': {
      const m = mat(st.hairColor);
      head.add(box(0.46, 0.2, 0.1, m, 0, -0.15, 0.19));
      head.add(box(0.07, 0.24, 0.3, m, 0.205, -0.1, 0.07));
      head.add(box(0.07, 0.24, 0.3, m, -0.205, -0.1, 0.07));
      head.add(box(0.16, 0.04, 0.03, m, 0, -0.06, 0.235)); // moustache
      break;
    }
    case 'scarf': {
      const m = mat(complement(st.primaryColor));
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.065, 6, 12), m);
      wrap.rotation.x = Math.PI / 2;
      wrap.position.set(0, 1.5, 0);
      body.add(wrap);
      const tail = box(0.11, 0.32, 0.05, m, 0.1, 1.33, 0.19);
      tail.rotation.z = 0.08;
      body.add(tail);
      break;
    }
    case 'backpack': {
      const m = mat(shade(st.secondaryColor, 0.12));
      const strap = mat(shade(st.secondaryColor, -0.05));
      body.add(box(torsoW * 0.75, 0.5, 0.2, m, 0, 1.18, -0.26));
      body.add(box(torsoW * 0.55, 0.18, 0.06, strap, 0, 1.07, -0.38));
      for (const x of [-0.14, 0.14]) body.add(box(0.06, 0.6, 0.03, strap, x, 1.18, 0.16));
      break;
    }
    default:
      break;
  }
}

export function buildCharacter(rawStyle) {
  const st = normalizeStyle(rawStyle);
  const female = st.body === 'female';

  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs while running
  root.add(body);

  const skin = mat(st.skinColor);
  const top = mat(st.primaryColor);
  const bottom = mat(st.secondaryColor);
  const hairM = mat(st.hairColor);
  const shoe = mat('#23232b');
  const dark = mat('#141418');

  const hipY = 0.85;
  const torsoW = female ? 0.5 : 0.6;

  // legs
  const legs = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (female ? 0.11 : 0.13), hipY, 0);
    pivot.add(box(female ? 0.17 : 0.2, 0.72, 0.21, female ? skin : bottom, 0, -0.36, 0));
    pivot.add(box(0.21, 0.12, 0.3, shoe, 0, -0.79, 0.04));
    body.add(pivot);
    legs.push(pivot);
  }

  // hips: trousers or skirt
  if (female) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 0.42, 8), bottom);
    skirt.position.y = hipY - 0.06;
    body.add(skirt);
  } else {
    body.add(box(torsoW * 0.95, 0.16, 0.26, bottom, 0, hipY - 0.02, 0));
  }

  // torso
  const torso = box(torsoW, 0.64, 0.3, top, 0, hipY + 0.32, 0);
  body.add(torso);
  if (female) body.add(box(torsoW * 0.98, 0.08, 0.31, mat(shade(st.primaryColor, -0.12)), 0, hipY + 0.06, 0));

  // arms (index 0 = character's left at +x, 1 = right at -x)
  const arms = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (torsoW / 2 + 0.09), 1.42, 0);
    pivot.add(box(0.16, 0.34, 0.18, top, 0, -0.15, 0));
    pivot.add(box(0.14, 0.24, 0.16, skin, 0, -0.42, 0));
    pivot.add(box(0.15, 0.13, 0.17, skin, 0, -0.58, 0));
    body.add(pivot);
    arms.push(pivot);
  }

  // neck and head
  body.add(box(0.16, 0.1, 0.16, skin, 0, 1.52, 0));
  const head = new THREE.Group();
  head.position.y = 1.78;
  body.add(head);
  head.add(box(0.44, 0.44, 0.42, skin));
  for (const x of [-0.1, 0.1]) {
    head.add(box(0.06, 0.09, 0.02, dark, x, 0.02, 0.215));
    head.add(box(0.02, 0.03, 0.01, mat('#ffffff'), x + 0.015, 0.04, 0.226));
  }
  head.add(box(0.12, 0.025, 0.02, mat(shade(st.skinColor, -0.2)), 0, -0.1, 0.215));
  if (female) {
    for (const x of [-0.1, 0.1]) head.add(box(0.08, 0.02, 0.02, dark, x, 0.08, 0.216));
  }

  const hair = buildHair(st.hair, hairM);
  head.add(hair.group);
  if (st.hat !== 'none') head.add(buildHat(st.hat, hair.top, st));
  addAccessory(st.accessory, st, { head, body, torsoW });

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

  root.userData = { body, legs, arms, head, style: st, phase: 0, t: 0 };
  return root;
}

// Animates a character built above. `speed` is the ground speed (units a second).
export function animateCharacter(model, dt, { speed = 0, wave = false } = {}) {
  const u = model.userData;
  u.t += dt;
  const moving = Math.min(1, speed / 6);
  u.phase += dt * (5 + speed * 1.3);
  const swing = Math.sin(u.phase) * 0.8 * moving;
  const k = 1 - Math.exp(-14 * dt);
  const ease = (obj, prop, target) => (obj.rotation[prop] += (target - obj.rotation[prop]) * k);

  ease(u.legs[0], 'x', swing);
  ease(u.legs[1], 'x', -swing);
  ease(u.arms[0], 'x', -swing * 0.9);
  ease(u.arms[0], 'z', 0.06);

  if (wave) {
    ease(u.arms[1], 'x', 0);
    ease(u.arms[1], 'z', -2.55 + Math.sin(u.t * 9) * 0.35);
  } else {
    ease(u.arms[1], 'x', swing * 0.9);
    ease(u.arms[1], 'z', -0.06);
  }

  const breathe = Math.sin(u.t * 2.2) * 0.012;
  u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.09 * moving + breathe;
  u.body.rotation.x += (0.14 * moving - u.body.rotation.x) * k;
  u.head.rotation.y = wave ? Math.sin(u.t * 1.3) * 0.15 : 0;
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      const m = o.material;
      (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
    }
  });
}
