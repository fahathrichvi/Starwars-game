/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Heads-up display: targeting brackets, lead indicator, reticle, radar scope, comms and status panels */
(function () {
  const { clamp } = SW.util;
  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const $ = (id) => document.getElementById(id);

  class HUD {
    constructor(game) {
      this.game = game;
      this.canvas = $('hud-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.el = {
        root: $('hud'), mission: $('hud-mission-title'), objectives: $('hud-objectives'),
        score: $('hud-score-val'), kills: $('hud-kills-val'), time: $('hud-time-val'),
        comms: $('hud-comms'),
        shield: $('bar-shield'), hull: $('bar-hull'), heat: $('bar-heat'), boost: $('bar-boost'), throttle: $('bar-throttle'),
        speed: $('hud-speed-val'),
        tName: $('hud-target-name'), tDist: $('hud-target-dist'), tBar: $('bar-target'), torps: $('hud-torps-val'), lock: $('hud-lock'),
        center: $('hud-center-msg'), sub: $('hud-sub-msg'), flash: $('damage-flash'),
      };
      this.centerTimer = 0; this.subTimer = 0; this.flashV = 0; this.whiteV = 0;
      this.slowTimer = 0;
      this.resize();
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
      this.w = window.innerWidth; this.h = window.innerHeight;
    }

    show(v) { this.el.root.classList.toggle('hidden', !v); if (!v) this.clear(); }
    clear() { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }

    setMission(title, objectives) {
      this.el.mission.textContent = title;
      this.el.objectives.innerHTML = objectives.map((o) => `<li class="${o.done ? 'done' : o.locked ? 'locked' : ''}">${o.done ? '✔' : '▸'} ${o.text}</li>`).join('');
    }

    comms(who, text, cls) {
      const d = document.createElement('div');
      d.className = 'comm ' + (cls || '');
      d.innerHTML = `<span class="who">${who}:</span>${text}`;
      this.el.comms.appendChild(d);
      while (this.el.comms.children.length > 4) this.el.comms.removeChild(this.el.comms.firstChild);
      const life = 4500 + text.length * 45;
      setTimeout(() => d.classList.add('fade'), life);
      setTimeout(() => d.remove(), life + 900);
    }
    clearComms() { this.el.comms.innerHTML = ''; }

    flashCenter(text, dur = 2, warn = false) {
      this.el.center.textContent = text;
      this.el.center.classList.toggle('warn', warn);
      this.el.center.style.opacity = 1;
      this.centerTimer = dur;
    }
    flashSub(text, dur = 1.5) {
      this.el.sub.textContent = text;
      this.el.sub.style.opacity = 1;
      this.subTimer = dur;
    }
    damageFlash(v) { this.flashV = Math.min(1, this.flashV + v); }
    whiteFlash() { this.whiteV = 1; }

    update(dt) {
      const g = this.game, e = this.el;
      this.centerTimer -= dt; this.subTimer -= dt;
      if (this.centerTimer <= 0) e.center.style.opacity = 0;
      if (this.subTimer <= 0) e.sub.style.opacity = 0;
      this.flashV = Math.max(0, this.flashV - dt * 2.5);
      this.whiteV = Math.max(0, this.whiteV - dt * 0.8);
      if (this.whiteV > 0) {
        e.flash.style.background = `rgba(255,245,230,${this.whiteV})`;
        e.flash.style.opacity = 1;
      } else {
        e.flash.style.background = '';
        e.flash.style.opacity = this.flashV;
      }

      const p = g.player, pc = g.pc;
      if (p && pc) {
        e.shield.style.width = (100 * p.shield / p.maxShield) + '%';
        e.hull.style.width = Math.max(0, 100 * p.hp / p.maxHp) + '%';
        e.hull.classList.toggle('crit', p.hp / p.maxHp < 0.3);
        e.heat.style.width = pc.heat + '%';
        e.heat.classList.toggle('over', pc.overheated);
        e.boost.style.width = pc.boost + '%';
        e.throttle.style.width = (pc.boosting ? 100 : pc.throttle * 100) + '%';
      }

      this.slowTimer -= dt;
      if (this.slowTimer <= 0 && p && pc) {
        this.slowTimer = 0.1;
        e.score.textContent = g.score.toLocaleString();
        e.kills.textContent = g.stats.kills;
        e.time.textContent = SW.util.fmtTime(g.missionTime);
        e.speed.textContent = Math.round(p.speed * 3.6) + ' KPH' + (pc.boosting ? '  ▲ BOOST' : '');
        e.torps.textContent = pc.torps;
        const T = pc.target;
        if (T && T.alive) {
          e.tName.textContent = T.name;
          e.tDist.textContent = Math.round(T.pos.distanceTo(p.pos)) + ' m';
          e.tBar.style.width = Math.max(0, 100 * T.hp / T.maxHp) + '%';
        } else {
          e.tName.textContent = '— NO TARGET —';
          e.tDist.textContent = '';
          e.tBar.style.width = '0%';
        }
        if (pc.locked && pc.torps > 0) { e.lock.textContent = '◆ LOCKED ◆'; e.lock.className = 'locked'; }
        else if (pc.lockTimer > 0.05 && pc.torps > 0) { e.lock.textContent = 'LOCKING…'; e.lock.className = 'locking'; }
        else { e.lock.textContent = ''; e.lock.className = ''; }
      }
    }

    project(pos, camera) {
      _v.copy(pos).project(camera);
      const behind = _v.z > 1;
      return { x: (_v.x * 0.5 + 0.5) * this.w, y: (-_v.y * 0.5 + 0.5) * this.h, behind, z: _v.z };
    }

    draw(camera) {
      const g = this.game, c = this.ctx;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.clearRect(0, 0, this.w, this.h);
      const p = g.player, pc = g.pc;
      if (!p || !p.alive || !pc) return;
      c.lineWidth = 1.5;
      c.font = '12px "Share Tech Mono", monospace';

      if (g.cockpit) this.drawCockpitFrame(c);

      const T = pc.target && pc.target.alive ? pc.target : null;
      // brackets on all combatants
      const list = g.hudObjects();
      for (const o of list) {
        if (!o.alive) continue;
        const d = o.pos.distanceTo(p.pos);
        if (d > 3000) continue;
        const s = this.project(o.pos, camera);
        if (s.behind || s.x < -50 || s.x > this.w + 50 || s.y < -50 || s.y > this.h + 50) continue;
        const isT = o === T;
        const size = clamp((o.radius * 900) / Math.max(d, 1), 7, 70);
        let col;
        if (o.team === 'rebel') col = 'rgba(90,176,255,0.85)';
        else if (o.kind === 'subsystem') col = o.type === 'turret' ? 'rgba(255,140,60,0.7)' : 'rgba(255,190,60,0.95)';
        else col = 'rgba(255,77,58,0.9)';
        if (isT) col = '#ffd84a';
        this.bracket(c, s.x, s.y, size, col, isT ? 2.2 : 1.3);
        if (o.team === 'rebel' && o !== p && o.name) {
          c.fillStyle = col; c.fillText(o.name, s.x + size + 4, s.y - size + 8);
        } else if (o.kind === 'subsystem' && o.type !== 'turret' && !isT && d < 450) {
          c.fillStyle = col; c.fillText(o.name, s.x + size + 4, s.y - size + 8);
        }
      }
      // capital ship label
      if (g.capital && (g.capital.state === 'active' || g.capital.state === 'dying')) {
        const s = this.project(g.capital.group.position, camera);
        if (!s.behind) {
          c.fillStyle = 'rgba(255,90,70,0.8)';
          c.font = '13px Orbitron, sans-serif';
          c.fillText('◢ ' + g.capital.name, s.x - 110, s.y + 60);
          c.font = '12px "Share Tech Mono", monospace';
        }
      }

      // target details, lead indicator, lock diamond, off-screen arrow
      if (T) {
        const s = this.project(T.pos, camera);
        const onScreen = !s.behind && s.x > 0 && s.x < this.w && s.y > 0 && s.y < this.h;
        if (onScreen) {
          const d = T.pos.distanceTo(p.pos);
          const size = clamp((T.radius * 900) / Math.max(d, 1), 7, 70);
          c.fillStyle = '#ffd84a';
          c.fillText(T.name, s.x - size, s.y + size + 14);
          c.fillText(Math.round(d) + 'm', s.x - size, s.y + size + 27);
          // lead indicator
          SW.util.leadPoint(_v, p.pos, p.velocity, T.pos, T.velocity, p.spec.boltSpeed + p.speed);
          const l = this.project(_v, camera);
          if (!l.behind) {
            c.strokeStyle = pc.assist ? '#ff5a3a' : 'rgba(255,216,74,0.9)';
            c.lineWidth = 1.5;
            c.beginPath(); c.arc(l.x, l.y, 7, 0, Math.PI * 2); c.stroke();
            c.beginPath(); c.moveTo(l.x - 11, l.y); c.lineTo(l.x - 4, l.y); c.moveTo(l.x + 4, l.y); c.lineTo(l.x + 11, l.y); c.stroke();
            c.setLineDash([2, 4]);
            c.strokeStyle = 'rgba(255,216,74,0.35)';
            c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(l.x, l.y); c.stroke();
            c.setLineDash([]);
          }
          // lock progress
          if (pc.lockTimer > 0 && pc.torps > 0) {
            const k = Math.min(1, pc.lockTimer / 1.0);
            const r = size + 10 + (1 - k) * 40;
            c.save();
            c.translate(s.x, s.y);
            c.rotate(pc.locked ? g.time * 3 : k * Math.PI / 2);
            c.strokeStyle = pc.locked ? '#ff3a2a' : 'rgba(255,216,74,0.8)';
            c.lineWidth = pc.locked ? 2.5 : 1.5;
            c.beginPath(); c.moveTo(0, -r); c.lineTo(r, 0); c.lineTo(0, r); c.lineTo(-r, 0); c.closePath(); c.stroke();
            c.restore();
          }
        } else {
          this.edgeArrow(c, T.pos, camera);
        }
      }

      this.drawReticle(c, camera, T);
      this.drawRadar(c);
    }

    bracket(c, x, y, s, col, lw) {
      const k = s * 0.45;
      c.strokeStyle = col; c.lineWidth = lw;
      c.beginPath();
      c.moveTo(x - s, y - s + k); c.lineTo(x - s, y - s); c.lineTo(x - s + k, y - s);
      c.moveTo(x + s - k, y - s); c.lineTo(x + s, y - s); c.lineTo(x + s, y - s + k);
      c.moveTo(x + s, y + s - k); c.lineTo(x + s, y + s); c.lineTo(x + s - k, y + s);
      c.moveTo(x - s + k, y + s); c.lineTo(x - s, y + s); c.lineTo(x - s, y + s - k);
      c.stroke();
    }

    edgeArrow(c, pos, camera) {
      // direction to target in camera space
      _v.copy(pos).applyMatrix4(camera.matrixWorldInverse);
      let ang = Math.atan2(-_v.y, _v.x);
      const cx = this.w / 2, cy = this.h / 2;
      const r = Math.min(this.w, this.h) * 0.36;
      const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
      c.save();
      c.translate(x, y); c.rotate(ang);
      c.fillStyle = '#ffd84a';
      c.beginPath(); c.moveTo(16, 0); c.lineTo(-6, -10); c.lineTo(-1, 0); c.lineTo(-6, 10); c.closePath(); c.fill();
      c.restore();
    }

    drawReticle(c, camera, T) {
      const g = this.game, p = g.player, pc = g.pc;
      _v.copy(p.pos).addScaledVector(p.fwd, 400);
      const s = this.project(_v, camera);
      if (s.behind) return;
      const x = s.x, y = s.y;
      const hot = pc.assist;
      c.strokeStyle = hot ? 'rgba(255,90,58,0.95)' : 'rgba(127,216,255,0.85)';
      c.lineWidth = 1.6;
      // outer broken circle
      for (let i = 0; i < 4; i++) {
        const a0 = i * Math.PI / 2 + 0.25, a1 = (i + 1) * Math.PI / 2 - 0.25;
        c.beginPath(); c.arc(x, y, 26, a0, a1); c.stroke();
      }
      c.beginPath();
      c.moveTo(x - 42, y); c.lineTo(x - 16, y); c.moveTo(x + 16, y); c.lineTo(x + 42, y);
      c.moveTo(x, y - 42); c.lineTo(x, y - 16); c.moveTo(x, y + 16); c.lineTo(x, y + 30);
      c.stroke();
      c.fillStyle = c.strokeStyle;
      c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill();
      // heat arc
      if (pc.heat > 1) {
        c.strokeStyle = pc.overheated ? '#ff3a2a' : 'rgba(255,190,60,0.8)';
        c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, 34, Math.PI * 0.75, Math.PI * 0.75 + (pc.heat / 100) * Math.PI * 0.5); c.stroke();
      }
      // flight-stick indicator
      const st = SW.Input.stick;
      const R = 70;
      c.strokeStyle = 'rgba(127,216,255,0.18)'; c.lineWidth = 1;
      c.beginPath(); c.arc(this.w / 2, this.h / 2, R, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(127,216,255,0.7)';
      const mx = this.w / 2 + st.x * R, my = this.h / 2 + st.y * R;
      c.beginPath(); c.moveTo(mx - 6, my); c.lineTo(mx + 6, my); c.moveTo(mx, my - 6); c.lineTo(mx, my + 6); c.stroke();
    }

    drawRadar(c) {
      const g = this.game, p = g.player;
      const R = Math.min(90, this.h * 0.11);
      const cx = this.w / 2, cy = this.h - R - 22;
      c.fillStyle = 'rgba(4,16,28,0.6)';
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(127,216,255,0.45)'; c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(127,216,255,0.15)';
      c.beginPath(); c.arc(cx, cy, R * 0.5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke();
      // sweep
      const a = (g.time * 2) % (Math.PI * 2);
      const grd = c.createLinearGradient(cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      grd.addColorStop(0, 'rgba(127,216,255,0)'); grd.addColorStop(1, 'rgba(127,216,255,0.35)');
      c.strokeStyle = grd; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke();

      _q.copy(p.obj.quaternion).invert();
      const range = 1600;
      const plot = (pos, col, size, shape) => {
        _v.subVectors(pos, p.pos).applyQuaternion(_q);
        const d = _v.length();
        let x = -_v.x / range, y = -_v.z / range;
        const len = Math.hypot(x, y);
        if (len > 1) { x /= len; y /= len; }
        const px = cx + x * R, py = cy + y * R;
        const above = _v.y > 0;
        c.fillStyle = col;
        c.globalAlpha = d > range ? 0.45 : 1;
        if (shape === 'tri') {
          c.beginPath(); c.moveTo(px, py - size); c.lineTo(px + size, py + size); c.lineTo(px - size, py + size); c.closePath(); c.fill();
        } else if (above) c.fillRect(px - size, py - size, size * 2, size * 2);
        else { c.beginPath(); c.arc(px, py, size, 0, Math.PI * 2); c.fill(); }
        c.globalAlpha = 1;
      };
      if (g.capital && (g.capital.state === 'active' || g.capital.state === 'dying')) plot(g.capital.group.position, '#ff7a5a', 7, 'tri');
      for (const s of g.ships) {
        if (!s.alive || s === p) continue;
        plot(s.pos, s.team === 'rebel' ? '#5ab0ff' : '#ff4d3a', 2.5);
      }
      const T = g.pc.target;
      if (T && T.alive) {
        _v.subVectors(T.pos, p.pos).applyQuaternion(_q);
        let x = -_v.x / range, y = -_v.z / range;
        const len = Math.hypot(x, y); if (len > 1) { x /= len; y /= len; }
        c.strokeStyle = '#ffd84a'; c.lineWidth = 1.5;
        c.strokeRect(cx + x * R - 5, cy + y * R - 5, 10, 10);
      }
      // own ship
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(cx, cy - 5); c.lineTo(cx + 4, cy + 4); c.lineTo(cx - 4, cy + 4); c.closePath(); c.fill();
    }

    drawCockpitFrame(c) {
      const w = this.w, h = this.h;
      c.fillStyle = 'rgba(8,10,14,0.92)';
      // canopy struts
      c.beginPath();
      c.moveTo(0, 0); c.lineTo(w * 0.16, 0); c.lineTo(w * 0.36, h * 0.3); c.lineTo(w * 0.34, h * 0.32); c.lineTo(0, h * 0.06); c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(w, 0); c.lineTo(w * 0.84, 0); c.lineTo(w * 0.64, h * 0.3); c.lineTo(w * 0.66, h * 0.32); c.lineTo(w, h * 0.06); c.closePath(); c.fill();
      c.fillRect(w * 0.34, h * 0.3, w * 0.32, 5);
      // lower dashboard
      c.beginPath();
      c.moveTo(0, h); c.lineTo(0, h * 0.8); c.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.8); c.lineTo(w, h); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(127,216,255,0.25)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, h * 0.8); c.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.8); c.stroke();
    }
  }

  SW.HUD = HUD;
})();
