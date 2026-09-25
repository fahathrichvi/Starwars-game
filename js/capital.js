/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Large targets: Star Destroyer / Dreadnought capital ships, Imperial relay outposts and the battle station (final boss).
   Every "big" object implements: state, group, name, kind, radius, targets(), hitsHull(p, m), avoid(ship, out), update(dt), dispose() */
(function () {
  const { rand, randomUnit, leadPoint, pick } = SW.util;
  const _v = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _l = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);

  /* ============================== SUBSYSTEM ============================== */
  class Subsystem {
    constructor(owner, type, name, hp, radius, localPos, mesh) {
      this.cap = owner;
      this.type = type;
      this.kind = 'subsystem';
      this.team = 'empire';
      this.name = name;
      this.hp = this.maxHp = hp;
      this.radius = radius;
      this.localPos = localPos.clone();
      this.pos = new THREE.Vector3();
      this.velocity = new THREE.Vector3();
      this.mesh = mesh;
      this.alive = true;
      this.fireTimer = rand(1, 4);
    }

    updateWorld() { this.pos.copy(this.localPos).applyMatrix4(this.cap.group.matrixWorld); }

    takeDamage(amount, source, hitPos, weapon) {
      if (!this.alive || this.cap.state !== 'active') return;
      const g = this.cap.game;
      if (source && source.isPlayer) g.stats.hits++;
      if (this.cap.blockDamage && this.cap.blockDamage(this, source, hitPos, weapon)) return;
      this.hp -= amount;
      if (hitPos) g.fx.sparks(hitPos, null, 10, 35);
      if (this.hp <= 0) this.destroy(source);
    }

    destroy(source) {
      this.alive = false;
      const g = this.cap.game;
      const scale = { turret: 2.2, shield: 5, bridge: 7, relay: 6, emitter: 5, port: 4 }[this.type] || 3;
      g.fx.explosion(this.pos, scale);
      g.sound3D('explosion', this.pos, scale * 0.6);
      if (this.mesh) this.mesh.visible = false;
      this.cap.onSubsystemDestroyed(this, source);
    }
  }

  // shared turbolaser logic for any object owning `turrets`
  function fireTurrets(owner, dt, range = 950) {
    const g = owner.game;
    const player = g.player;
    for (const t of owner.turrets) {
      if (!t.alive) continue;
      let target = player && player.alive ? player : null;
      if (!target || t.pos.distanceTo(target.pos) > range) {
        target = g.ships.find((s) => s.alive && s.team === 'rebel' && s.pos.distanceTo(t.pos) < range * 0.85) || null;
      }
      if (!target) continue;
      t.head.lookAt(target.pos);
      t.fireTimer -= dt;
      if (t.fireTimer <= 0) {
        t.fireTimer = rand(1.3, 2.6) * g.enemyFireMul;
        t.head.getWorldPosition(_v);
        leadPoint(_v2, _v, ZERO3, target.pos, target.velocity, 520);
        _v2.sub(_v).normalize();
        for (let i = 0; i < 2; i++) {
          const d = _l.copy(_v2).addScaledVector(randomUnit(new THREE.Vector3()), 0.025).normalize();
          g.bolts.spawn(_v, d, 520, 'empire', 7, t, 1.8);
        }
        g.sound3D('laser', _v, 'turret', 1.2);
      }
    }
  }
  const ZERO3 = new THREE.Vector3();

  function boxesInside(boxes, l, margin) {
    for (const b of boxes) {
      if (Math.abs(l.x - b.c.x) < b.h.x + margin && Math.abs(l.y - b.c.y) < b.h.y + margin && Math.abs(l.z - b.c.z) < b.h.z + margin) return true;
    }
    return false;
  }

  /* ============================== CAPITAL SHIP ============================== */
  class Capital {
    constructor(game, finalPos, yaw, opts = {}) {
      this.game = game;
      const m = SW.Models.createStarDestroyer();
      this.m = m;
      this.group = m.group;
      this.S = opts.scale || 1.6;
      this.group.rotation.y = yaw;
      this.group.scale.setScalar(this.S);
      this.group.position.copy(finalPos);
      this.finalPos = finalPos.clone();
      this.dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y, yaw);
      this.group.visible = false;
      game.scene.add(this.group);
      this.state = 'hidden';
      this.kind = 'capital';
      this.radarShape = 'tri';
      this.name = opts.name || 'STAR DESTROYER "DOMINION"';
      this.radius = 230 * this.S;
      this.pos = this.group.position;
      this.velocity = new THREE.Vector3();
      this.alive = true;
      this.inv = new THREE.Matrix4();
      this.launchTimer = 6;
      this.maxFighters = opts.maxFighters || 6;
      this.launchTypes = opts.launch || ['tie', 'tie', 'interceptor'];
      this.isBossObj = !!opts.boss;
      this.t = 0;

      if (opts.tint) {
        const mats = SW.Models.mats();
        const hull = mats.sdHull.clone(); hull.color.set(opts.tint);
        const mid = mats.sdMid.clone(); mid.color.set(opts.tint);
        this.group.traverse((o) => {
          if (o.material === mats.sdHull) o.material = hull;
          else if (o.material === mats.sdMid) o.material = mid;
        });
      }

      this.subsystems = [];
      const domePos = m.domePos.slice();
      const domes = m.domes.slice();
      if (opts.shields === 4) {
        const L = SW.Models.SD.L;
        const mats = SW.Models.mats();
        [-1, 1].forEach((s) => {
          const p = new THREE.Vector3(s * 52, 35, -L / 2 + 40);
          const d = new THREE.Group();
          d.position.copy(p);
          d.add(new THREE.Mesh(new THREE.SphereGeometry(7.5, 24, 16), mats.shieldDome));
          const st = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 5, 12), mats.sdDark);
          st.position.y = -6; d.add(st);
          this.group.add(d);
          domePos.push(p); domes.push(d);
        });
      }
      const letters = 'ABCD';
      const shieldHp = opts.shieldHp || 320;
      this.shields = domes.map((d, i) => {
        const s = new Subsystem(this, 'shield', 'SHIELD GENERATOR ' + letters[i], shieldHp, 10, domePos[i], d);
        this.subsystems.push(s);
        return s;
      });
      this.bridge = new Subsystem(this, 'bridge', 'COMMAND BRIDGE', opts.bridgeHp || 800, 17, m.bridgePos, null);
      this.subsystems.push(this.bridge);
      this.bridgeShield = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), SW.fresnelMaterial(0x55aaff, 2.0, 1.2));
      this.bridgeShield.scale.set(48, 22, 22);
      this.bridgeShield.position.copy(m.bridgePos);
      this.bridgeShield.material.uniforms.opacity.value = 0;
      this.group.add(this.bridgeShield);

      const spots = m.turretSpots.slice();
      if (opts.moreTurrets) {
        const { L, W } = SW.Models.SD;
        for (let i = 0; i < 10; i++) {
          const t = 0.2 + (i / 10) * 0.7;
          const xf = (i % 2 ? 1 : -1) * (0.25 + (i % 3) * 0.2);
          const z = L / 2 - t * L, x = xf * t * W / 2;
          spots.push(new THREE.Vector3(x, SW.Models.sdTop(x, z), z));
        }
      }
      this.turrets = spots.map((spot, i) => {
        const tm = SW.Models.createTurret();
        tm.group.position.copy(spot);
        this.group.add(tm.group);
        const s = new Subsystem(this, 'turret', 'TURBOLASER TURRET', 60, 5.5, _v.copy(spot).add(_v2.set(0, 2.6, 0)), tm.group);
        s.head = tm.head;
        s.index = i;
        this.subsystems.push(s);
        return s;
      });
    }

    activateNow() {
      this.state = 'active';
      this.group.visible = true;
      this.group.updateMatrixWorld(true);
      this.inv.copy(this.group.matrixWorld).invert();
    }

    shieldsUp() { return this.shields.some((s) => s.alive); }

    bossHealth() {
      let hp = 0, max = 0;
      for (const s of this.shields.concat([this.bridge])) { hp += Math.max(0, s.alive ? s.hp : 0); max += s.maxHp; }
      return hp / max;
    }

    arrive() {
      this.state = 'arriving';
      this.t = 0;
      this.group.visible = true;
      SW.Audio.hyperspace();
    }

    targets() {
      if (this.state !== 'active') return [];
      return this.subsystems.filter((s) => s.alive);
    }

    blockDamage(s, source, hitPos) {
      if (s.type !== 'bridge' || !this.shieldsUp()) return false;
      const g = this.game;
      if (hitPos) g.fx.sparks(hitPos, 'blue', 10, 30);
      this.bridgeShield.material.uniforms.opacity.value = 1;
      if (source && source.isPlayer && g.time - (this.lastShieldMsg || -99) > 6) {
        this.lastShieldMsg = g.time;
        g.comms('R2 UNIT', '*urgent beeping* Bridge deflector shield is up! Take out the shield generator domes first.', 'command');
      }
      return true;
    }

    onSubsystemDestroyed(s) {
      const g = this.game;
      if (s.type === 'turret') { g.addScore(75); g.stats.kills++; }
      if (s.type === 'shield') {
        g.addScore(750);
        const left = this.shields.filter((x) => x.alive).length;
        if (left > 0) g.comms('RED LEADER', `Shield generator down! ${left} to go!`);
        else {
          g.comms('REBEL COMMAND', 'The bridge deflector shield is down! All fighters — hit that bridge with everything you have!', 'command');
          g.hud.flashCenter('BRIDGE SHIELDS DOWN', 2.5);
          this.bridgeShield.visible = false;
        }
        g.onObjectiveProgress();
      }
      if (s.type === 'bridge') {
        g.addScore(this.isBossObj ? 6000 : 2500);
        this.startDying();
        g.onObjectiveProgress();
      }
    }

    startDying() {
      this.state = 'dying';
      this.t = 0;
      this.subsystems.forEach((s) => { s.alive = false; });
      const g = this.game;
      g.comms('RED THREE', "She's breaking up! Pull away, pull away!");
      g.hud.flashCenter(this.isBossObj ? 'DREADNOUGHT CRITICAL' : 'STAR DESTROYER CRITICAL', 3, true);
    }

    hitsHull(p, margin = 0) {
      if (this.state !== 'active' && this.state !== 'dying') return false;
      _l.copy(p).applyMatrix4(this.inv);
      return this.localInside(_l, margin / this.S);
    }

    localInside(l, margin) {
      const { L, W, H, BOT } = this.m.dims;
      const t = (L / 2 - l.z) / L;
      if (t >= -margin / L && t <= 1 + margin / L) {
        const ax = Math.abs(l.x);
        const hw = Math.max(0, t) * W / 2 + margin;
        if (ax < hw) {
          const top = t * H - ax * (2 * H) / W + margin;
          const bot = -(t * H * BOT - ax * (2 * H * BOT) / W) - margin;
          if (l.y < top && l.y > bot) return true;
        }
      }
      return boxesInside(this.m.boxes, l, margin);
    }

    avoid(ship, out) {
      if (this.state !== 'active' && this.state !== 'dying') return 0;
      const P = ship.pos;
      if (P.distanceTo(this.group.position) > 420 * this.S) return 0;
      const look = 30 + ship.speed * 1.2;
      _v.copy(P).addScaledVector(ship.fwd, look);
      _l.copy(_v).applyMatrix4(this.inv);
      if (!this.localInside(_l, 18)) {
        _l.copy(P).applyMatrix4(this.inv);
        if (!this.localInside(_l, 22)) return 0;
      }
      _l.copy(P).applyMatrix4(this.inv);
      out.set(Math.sign(_l.x) * 0.5, _l.y > -5 ? 1 : -1, 0).applyQuaternion(this.group.quaternion).normalize();
      return 0.85;
    }

    update(dt) {
      const g = this.game;
      if (this.state === 'hidden' || this.state === 'dead') return;
      this.t += dt;
      if (this.state === 'arriving') {
        const k = Math.min(1, this.t / 1.8);
        const e = 1 - Math.pow(1 - k, 4);
        this.group.position.copy(this.finalPos).addScaledVector(this.dir, -(1 - e) * 7000);
        this.group.scale.set(this.S, this.S, this.S * (1 + (1 - e) * 14));
        if (k >= 1) {
          this.state = 'active';
          this.group.scale.setScalar(this.S);
          this.group.position.copy(this.finalPos);
          g.fx.flashLight(this.finalPos, 8, 1500, 1.2, 0xaaccff);
          g.fx.addShake(0.6);
        }
        this.group.updateMatrixWorld(true);
        this.inv.copy(this.group.matrixWorld).invert();
      }
      this.subsystems.forEach((s) => s.updateWorld());
      if (!this.scaledRadii) { this.scaledRadii = true; this.subsystems.forEach((s) => { s.radius *= this.S; }); }

      const on = this.state !== 'dying';
      this.m.engineGlows.forEach((s) => {
        const base = s.userData.base || (s.userData.base = s.scale.x);
        s.scale.setScalar(on ? base * (0.95 + Math.random() * 0.1) : base * Math.max(0.05, 1 - this.t / 2));
      });
      const bs = this.bridgeShield.material.uniforms.opacity;
      bs.value = Math.max(this.shieldsUp() ? 0.12 : 0, bs.value - dt * 1.5);

      if (this.state === 'active') {
        fireTurrets(this, dt);
        this.launchTimer -= dt;
        if (this.launchTimer <= 0 && !this.attract) {
          this.launchTimer = rand(7, 11) * g.launchMul;
          if (g.countEnemyFighters() < this.maxFighters + g.difficulty) {
            const n = Math.random() < 0.5 ? 2 : 1;
            for (let i = 0; i < n; i++) {
              const p = this.m.hangarPos.clone().add(new THREE.Vector3(rand(-10, 10), 0, rand(-15, 15))).applyMatrix4(this.group.matrixWorld);
              const ship = g.spawnEnemy(pick(this.launchTypes), p);
              _v.copy(this.dir).add(_v2.set(0, -0.8, 0)).normalize();
              ship.obj.lookAt(_v.add(p));
            }
          }
        }
      }

      if (this.state === 'dying') {
        if (Math.random() < 0.35) {
          const { L, W } = this.m.dims;
          const tt = Math.random();
          const x = (Math.random() * 2 - 1) * tt * W / 2 * 0.9;
          const z = L / 2 - tt * L;
          const y = SW.Models.sdTop(x, z) + rand(-5, 5);
          _v.set(x, y, z).applyMatrix4(this.group.matrixWorld);
          g.fx.explosion(_v, rand(3, 7) * this.S / 1.6, { debris: 3 });
          g.sound3D('explosion', _v, 3);
        }
        g.fx.addShake(0.02);
        this.group.rotation.z += dt * 0.03;
        this.group.position.y -= dt * 4;
        this.group.updateMatrixWorld(true);
        this.inv.copy(this.group.matrixWorld).invert();
        if (this.t > 5.5) {
          this.state = 'dead';
          this.alive = false;
          const c = this.group.position.clone();
          g.fx.explosion(c, 22 * this.S / 1.6, { debris: 14, ringColor: new THREE.Color(2, 2.2, 3) });
          for (let i = 0; i < 8; i++) {
            _v.copy(c).addScaledVector(randomUnit(_v2), rand(40, 160) * this.S / 1.6);
            g.fx.explosion(_v, rand(6, 12), { debris: 4 });
          }
          g.fx.flashLight(c, 20, 3000, 2.5, 0xffc080);
          g.fx.addShake(1.5);
          SW.Audio.explosion(4, 1.3, 0);
          g.hud.whiteFlash();
          this.group.visible = false;
          g.onCapitalDestroyed(this);
        }
      }
    }

    dispose() { this.game.scene.remove(this.group); }
  }

  /* ============================== RELAY OUTPOST ============================== */
  class Outpost {
    constructor(game, pos, name) {
      this.game = game;
      const m = SW.Models.createRelay();
      this.m = m;
      this.group = m.group;
      this.group.position.copy(pos);
      this.group.rotation.y = rand(0, Math.PI * 2);
      game.scene.add(this.group);
      this.group.updateMatrixWorld(true);
      this.inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
      this.state = 'active';
      this.kind = 'outpost';
      this.radarShape = 'square';
      this.name = name;
      this.radius = 60;
      this.pos = this.group.position;
      this.velocity = new THREE.Vector3();
      this.alive = true;
      this.destroyed = false;
      this.core = new Subsystem(this, 'relay', name, 420, 14, m.corePos, m.core);
      this.subsystems = [this.core];
      this.turrets = m.turretSpots.map((spot) => {
        const tm = SW.Models.createTurret();
        tm.group.position.copy(spot);
        this.group.add(tm.group);
        const s = new Subsystem(this, 'turret', 'DEFENSE TURRET', 55, 5.5, _v.copy(spot).add(_v2.set(0, 2.6, 0)), tm.group);
        s.head = tm.head;
        this.subsystems.push(s);
        return s;
      });
      this.subsystems.forEach((s) => s.updateWorld());
      this.t = rand(0, 3);
    }

    targets() { return this.destroyed ? [] : this.subsystems.filter((s) => s.alive); }

    hitsHull(p, margin = 0) {
      if (p.distanceToSquared(this.group.position) > 90 * 90) return false;
      _l.copy(p).applyMatrix4(this.inv);
      return boxesInside(this.m.boxes, _l, margin);
    }

    avoid(ship, out) {
      const P = ship.pos;
      if (P.distanceTo(this.group.position) > 160) return 0;
      _v.copy(P).addScaledVector(ship.fwd, 30 + ship.speed * 0.8);
      if (!this.hitsHull(_v, 15) && !this.hitsHull(P, 20)) return 0;
      out.subVectors(P, this.group.position).normalize();
      return 0.85;
    }

    onSubsystemDestroyed(s) {
      const g = this.game;
      if (s.type === 'turret') { g.addScore(75); g.stats.kills++; return; }
      this.destroyed = true;
      this.turrets.forEach((t) => { if (t.alive) { t.alive = false; g.fx.explosion(t.pos, 2); t.mesh.visible = false; } });
      this.m.lights.forEach((l) => { l.visible = false; });
      g.fx.explosion(this.group.position, 6, { debris: 10 });
      g.fx.flashLight(this.group.position, 10, 600, 1, 0xff9050);
      g.fx.addShake(0.4);
      g.addScore(1000);
      g.onRelayDestroyed(this);
    }

    update(dt) {
      this.t += dt;
      if (this.destroyed) {
        if (Math.random() < 0.05) {
          _v.copy(this.group.position).addScaledVector(randomUnit(_v2), 25);
          this.game.fx.damageSmoke(_v, ZERO3, true);
        }
        return;
      }
      const blink = Math.sin(this.t * 4) > 0;
      this.m.lights.forEach((l) => { l.visible = blink; });
      this.m.beacon.scale.setScalar(6 + Math.sin(this.t * 6) * 2);
      fireTurrets(this, dt, 900);
    }

    dispose() { this.game.scene.remove(this.group); }
  }

  /* ============================== BATTLE STATION (final boss) ============================== */
  class Station {
    constructor(game, pos, facing, opts = {}) {
      this.game = game;
      const R = (this.R = opts.radius || 620);
      const mats = SW.Models.mats();
      const g = (this.group = new THREE.Group());
      g.position.copy(pos);
      game.scene.add(g);
      this.state = 'active';
      this.kind = 'station';
      this.radarShape = 'circle';
      this.name = opts.name || 'IMPERIAL BATTLE STATION';
      this.radius = R;
      this.pos = g.position;
      this.velocity = new THREE.Vector3();
      this.alive = true;
      this.t = 0;
      this.charge = 0;
      this.launchTimer = 5;
      this.maxFighters = opts.maxFighters || 7;

      const body = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), new THREE.MeshStandardMaterial({ map: SW.Tex.battleStation(false), roughness: 0.85, metalness: 0.25 }));
      g.add(body);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.01, 64, 48), SW.fresnelMaterial(0x6688aa, 4.0, 0.5)));
      const trench = new THREE.Mesh(new THREE.TorusGeometry(R + 1, 9, 8, 200), new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.8, metalness: 0.4 }));
      trench.rotation.x = Math.PI / 2;
      g.add(trench);

      // superlaser dish faces the target, tilted up into the northern hemisphere
      const dd = (this.dishDir = facing.clone().sub(pos).normalize());
      dd.y += 0.45; dd.normalize();
      const dish = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 64, 12, 0, Math.PI * 2, 0, 0.3),
        new THREE.MeshStandardMaterial({ map: SW.Tex.dish(), roughness: 0.7, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      dish.quaternion.setFromUnitVectors(Y, dd);
      g.add(dish);
      this.focus = SW.Models.glowSprite(new THREE.Color(0.8, 4, 1.0), 40);
      this.focus.position.copy(dd).multiplyScalar(R + 12);
      g.add(this.focus);

      const u = new THREE.Vector3().crossVectors(dd, Y).normalize();
      const v = new THREE.Vector3().crossVectors(u, dd).normalize();
      this.subsystems = [];
      const emMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3.5, 0.9), toneMapped: false });
      this.emitters = [0, 1, 2, 3].map((k) => {
        const a = k * Math.PI / 2 + Math.PI / 4;
        const dir = dd.clone().multiplyScalar(Math.cos(0.27)).add(u.clone().multiplyScalar(Math.cos(a) * Math.sin(0.27))).add(v.clone().multiplyScalar(Math.sin(a) * Math.sin(0.27))).normalize();
        const grp = new THREE.Group();
        grp.position.copy(dir).multiplyScalar(R);
        grp.quaternion.setFromUnitVectors(Y, dir);
        const py = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, 18, 10), mats.sdDark); py.position.y = 9; grp.add(py);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), emMat); orb.position.y = 20; grp.add(orb);
        const gl = SW.Models.glowSprite(new THREE.Color(0.6, 3.5, 0.9), 22); gl.position.y = 20; grp.add(gl);
        g.add(grp);
        const s = new Subsystem(this, 'emitter', 'SUPERLASER EMITTER ' + (k + 1), 380, 14, dir.clone().multiplyScalar(R + 18), grp);
        this.subsystems.push(s);
        return s;
      });

      // thermal exhaust port on the equator trench
      const pd = new THREE.Vector3(dd.x, 0, dd.z).normalize().applyAxisAngle(Y, 0.45);
      const port = new THREE.Group();
      port.position.copy(pd).multiplyScalar(R + 2);
      port.quaternion.setFromUnitVectors(Y, pd);
      port.add(new THREE.Mesh(new THREE.BoxGeometry(16, 3, 10), mats.sdDark));
      const pg = SW.Models.glowSprite(new THREE.Color(4, 1.6, 0.4), 16); pg.position.y = 2; port.add(pg);
      g.add(port);
      this.portGlow = pg;
      this.port = new Subsystem(this, 'port', 'THERMAL EXHAUST PORT', 320, 9, pd.clone().multiplyScalar(R + 4), port);
      this.subsystems.push(this.port);

      // turbolaser turrets on the near hemisphere
      const toF = facing.clone().sub(pos).normalize();
      this.turrets = [];
      let guard = 0;
      while (this.turrets.length < (opts.turrets || 18) && guard++ < 500) {
        const d = randomUnit(new THREE.Vector3());
        if (d.dot(toF) < 0.15 || d.dot(dd) > Math.cos(0.36)) continue;
        const tm = SW.Models.createTurret();
        tm.group.scale.setScalar(1.6);
        tm.group.position.copy(d).multiplyScalar(R);
        tm.group.quaternion.setFromUnitVectors(Y, d);
        g.add(tm.group);
        const s = new Subsystem(this, 'turret', 'TURBOLASER TOWER', 70, 8, d.clone().multiplyScalar(R + 4.5), tm.group);
        s.head = tm.head;
        this.subsystems.push(s);
        this.turrets.push(s);
      }

      // surface greebles and lights
      const dummy = new THREE.Object3D();
      const gi = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mats.sdMid, 700);
      for (let i = 0; i < 700; i++) {
        const d = randomUnit(new THREE.Vector3());
        if (d.dot(dd) > Math.cos(0.32)) { i--; continue; }
        dummy.position.copy(d).multiplyScalar(R);
        dummy.quaternion.setFromUnitVectors(Y, d);
        dummy.scale.set(rand(6, 34), rand(3, 14), rand(6, 34));
        dummy.updateMatrix();
        gi.setMatrixAt(i, dummy.matrix);
      }
      g.add(gi);
      const li = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mats.sdLight, 500);
      for (let i = 0; i < 500; i++) {
        const d = randomUnit(new THREE.Vector3());
        dummy.position.copy(d).multiplyScalar(R + 1);
        dummy.quaternion.identity(); dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        li.setMatrixAt(i, dummy.matrix);
      }
      g.add(li);

      // superlaser beam (shown only when it fires)
      const beamGeo = new THREE.CylinderGeometry(22, 22, 1, 16, 1, true);
      beamGeo.translate(0, 0.5, 0);
      this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 6, 1.5), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.beam.position.copy(this.focus.position);
      this.beam.quaternion.setFromUnitVectors(Y, dd);
      this.beam.scale.set(1, 24000, 1);
      this.beam.visible = false;
      g.add(this.beam);

      g.updateMatrixWorld(true);
      this.subsystems.forEach((s) => s.updateWorld());
    }

    emittersAlive() { return this.emitters.filter((e) => e.alive).length; }

    bossHealth() {
      let hp = 0, max = 0;
      for (const s of this.emitters.concat([this.port])) { hp += s.alive ? Math.max(0, s.hp) : 0; max += s.maxHp; }
      return hp / max;
    }

    targets() {
      if (this.state !== 'active') return [];
      return this.subsystems.filter((s) => s.alive);
    }

    blockDamage(s, source, hitPos, weapon) {
      if (s.type !== 'port') return false;
      const g = this.game;
      if (this.emittersAlive() > 0) {
        if (hitPos) g.fx.sparks(hitPos, 'blue', 8, 25);
        if (source && source.isPlayer && g.time - (this.lastMsg || -99) > 6) {
          this.lastMsg = g.time;
          g.comms('R2 UNIT', '*whistle* The port is sealed while the superlaser emitters are powered. Destroy the emitters!', 'command');
        }
        return true;
      }
      if (weapon !== 'torpedo') {
        if (hitPos) g.fx.sparks(hitPos, null, 8, 25);
        if (source && source.isPlayer && g.time - (this.lastMsg || -99) > 5) {
          this.lastMsg = g.time;
          g.comms('REBEL COMMAND', "Lasers won't penetrate the port shielding — use your PROTON TORPEDOES!", 'command');
        }
        return true;
      }
      return false;
    }

    onSubsystemDestroyed(s) {
      const g = this.game;
      if (s.type === 'turret') { g.addScore(90); g.stats.kills++; return; }
      if (s.type === 'emitter') {
        g.addScore(900);
        const left = this.emittersAlive();
        if (left > 0) g.comms('RED LEADER', `Emitter destroyed! ${left} left!`);
        else {
          g.hud.flashCenter('EXHAUST PORT EXPOSED', 3);
          g.comms('REBEL COMMAND', 'All emitters are down! The exhaust port on the equatorial trench is exposed — torpedoes only!', 'command');
          SW.Audio.droid();
        }
        g.onObjectiveProgress();
      }
      if (s.type === 'port') {
        g.addScore(8000);
        this.startDying();
        g.onObjectiveProgress();
      }
    }

    startDying() {
      this.state = 'dying';
      this.t = 0;
      this.subsystems.forEach((s) => { s.alive = false; });
      const g = this.game;
      g.hud.flashCenter('REACTOR CHAIN REACTION', 3, true);
      g.comms('RED LEADER', "Direct hit! The reactor's going critical — everyone get clear!");
    }

    fireSuperlaser() {
      if (this.state !== 'active') return;
      this.state = 'firing';
      this.beam.visible = true;
      this.focus.scale.setScalar(420);
      const g = this.game;
      g.fx.flashLight(this.focus.getWorldPosition(new THREE.Vector3()), 20, 4000, 3, 0x66ff88);
      g.fx.addShake(1.5);
      g.hud.whiteFlash();
      SW.Audio.explosion(4, 1.4, 0);
    }

    hitsHull(p, margin = 0) {
      if (this.state === 'dead') return false;
      return p.distanceToSquared(this.group.position) < (this.R + margin) * (this.R + margin);
    }

    avoid(ship, out) {
      if (this.state === 'dead') return 0;
      const P = ship.pos;
      const d = P.distanceTo(this.group.position);
      if (d > this.R + 250) return 0;
      _v.copy(P).addScaledVector(ship.fwd, 40 + ship.speed * 1.2);
      if (_v.distanceTo(this.group.position) > this.R + 45 && d > this.R + 60) return 0;
      out.subVectors(P, this.group.position).normalize();
      return 0.9;
    }

    update(dt) {
      const g = this.game;
      if (this.state === 'dead') return;
      this.t += dt;
      this.subsystems.forEach((s) => s.updateWorld());
      if (this.state === 'active') {
        this.focus.scale.setScalar(40 + this.charge * 240 + Math.sin(this.t * 8) * 6 * this.charge);
        this.portGlow.scale.setScalar(this.emittersAlive() ? 10 : 16 + Math.sin(this.t * 10) * 5);
        fireTurrets(this, dt, 1100);
        this.launchTimer -= dt;
        if (this.launchTimer <= 0) {
          this.launchTimer = rand(6, 9) * g.launchMul;
          if (g.countEnemyFighters() < this.maxFighters + g.difficulty) {
            for (let i = 0; i < 2; i++) {
              const a = rand(0, Math.PI * 2);
              const d = _v.set(Math.cos(a), 0, Math.sin(a));
              const p = d.clone().multiplyScalar(this.R + 40).add(this.group.position);
              const ship = g.spawnEnemy(Math.random() < 0.4 ? 'interceptor' : 'tie', p);
              ship.obj.lookAt(p.clone().add(d));
            }
          }
        }
      }
      if (this.state === 'dying') {
        if (Math.random() < 0.5) {
          const d = randomUnit(_v2);
          _v.copy(d).multiplyScalar(this.R).add(this.group.position);
          g.fx.explosion(_v, rand(8, 18), { debris: 3 });
          g.sound3D('explosion', _v, 4);
        }
        g.fx.addShake(0.03);
        if (this.t > 7) {
          this.state = 'dead';
          this.alive = false;
          const c = this.group.position.clone();
          g.fx.explosion(c, 45, { debris: 14, ringColor: new THREE.Color(2.5, 2.5, 3.2), ringDur: 3 });
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), Y);
          g.fx.spawnRing(c, this.R * 5, 4, new THREE.Color(3, 2.6, 2.2), q);
          g.fx.spawnRing(c, this.R * 3.5, 3, new THREE.Color(2, 2.4, 3.2), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.4)));
          g.fx.flashLight(c, 30, 8000, 3, 0xffe0b0);
          g.fx.addShake(1.6);
          SW.Audio.explosion(4, 1.4, 0);
          g.hud.whiteFlash();
          this.group.visible = false;
          g.onStationDestroyed(this);
        }
      }
    }

    dispose() { this.game.scene.remove(this.group); }
  }

  SW.Capital = Capital;
  SW.Outpost = Outpost;
  SW.Station = Station;
  SW.fireTurrets = fireTurrets;
})();
