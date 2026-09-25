/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Core namespace, math helpers, input and persistent settings */
window.SW = window.SW || {};

(function () {
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _v3 = new THREE.Vector3();

  SW.util = {
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    // frame-rate independent smoothing factor
    damp: (lambda, dt) => 1 - Math.exp(-lambda * dt),

    randomUnit(out) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return out.set(s * Math.cos(th), u, s * Math.sin(th));
    },

    // does segment p0->p1 pass within r of c ?
    segmentSphere(p0, p1, c, r) {
      const d = _v1.subVectors(p1, p0);
      const f = _v2.subVectors(c, p0);
      const dd = d.lengthSq();
      let t = dd > 0 ? f.dot(d) / dd : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      _v3.copy(p0).addScaledVector(d, t);
      return _v3.distanceToSquared(c) <= r * r;
    },

    // first-order intercept: where to aim to hit a moving target with a projectile
    leadPoint(out, shooterPos, shooterVel, targetPos, targetVel, projSpeed) {
      const rel = _v1.subVectors(targetPos, shooterPos);
      const relV = _v2.subVectors(targetVel, shooterVel);
      const a = relV.lengthSq() - projSpeed * projSpeed;
      const b = 2 * rel.dot(relV);
      const c = rel.lengthSq();
      let t;
      if (Math.abs(a) < 1e-6) t = -c / b;
      else {
        const disc = b * b - 4 * a * c;
        if (disc < 0) t = rel.length() / projSpeed;
        else {
          const s = Math.sqrt(disc);
          const t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
          t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
        }
      }
      if (!(t > 0) || t > 5) t = rel.length() / projSpeed;
      return out.copy(targetPos).addScaledVector(targetVel, t);
    },

    fmtTime(s) {
      s = Math.floor(s);
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
  };

  /* ---------------- persistent settings ---------------- */
  const DEFAULTS = { sens: 1, volume: 0.8, invert: false, bloom: true, difficulty: 1, unlocked: 1, highScore: 0 };
  SW.settings = Object.assign({}, DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem('sw-hyperspace-assault') || '{}');
    Object.assign(SW.settings, saved);
  } catch (e) { /* storage unavailable */ }
  SW.saveSettings = function () {
    try { localStorage.setItem('sw-hyperspace-assault', JSON.stringify(SW.settings)); } catch (e) { /* ignore */ }
  };

  /* ---------------- input ---------------- */
  const Input = {
    keys: {},
    pressed: {},
    mouse: [false, false, false],
    stick: { x: 0, y: 0 },
    pointerLocked: false,
    lastMouseMove: 0,
    element: null,
    enabled: false,

    init(el) {
      this.element = el;
      window.addEventListener('keydown', (e) => {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (!this.keys[e.code]) this.pressed[e.code] = true;
        this.keys[e.code] = true;
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
      window.addEventListener('blur', () => { this.keys = {}; this.mouse = [false, false, false]; });

      window.addEventListener('mousedown', (e) => {
        this.mouse[e.button] = true;
        if (this.enabled && !this.pointerLocked && e.target === this.element) this.requestLock();
      });
      window.addEventListener('mouseup', (e) => { this.mouse[e.button] = false; });
      window.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });

      window.addEventListener('mousemove', (e) => {
        if (!this.enabled) return;
        const sens = SW.settings.sens;
        if (this.pointerLocked) {
          const mx = SW.util.clamp(e.movementX, -60, 60);
          const my = SW.util.clamp(e.movementY, -60, 60);
          this.stick.x += mx * 0.0032 * sens;
          this.stick.y += my * 0.0032 * sens;
        } else {
          // absolute mode: cursor offset from screen centre
          const r = Math.min(window.innerWidth, window.innerHeight) * 0.33 / sens;
          this.stick.x = (e.clientX - window.innerWidth / 2) / r;
          this.stick.y = (e.clientY - window.innerHeight / 2) / r;
        }
        const len = Math.hypot(this.stick.x, this.stick.y);
        if (len > 1) { this.stick.x /= len; this.stick.y /= len; }
        this.lastMouseMove = performance.now();
      });

      document.addEventListener('pointerlockchange', () => {
        this.pointerLocked = document.pointerLockElement === this.element;
        if (this.onLockChange) this.onLockChange(this.pointerLocked);
      });
    },

    requestLock() {
      if (!this.element || !this.element.requestPointerLock) return;
      try {
        const p = this.element.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* ignore */ }
    },

    exitLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },

    consume(code) {
      const p = !!this.pressed[code];
      this.pressed[code] = false;
      return p;
    },

    endFrame() { this.pressed = {}; },
    centerStick() { this.stick.x = 0; this.stick.y = 0; },
  };
  SW.Input = Input;
})();
