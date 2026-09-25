/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Imperial Star Destroyer: hyperspace arrival, turbolaser turrets, shield generators, bridge, destruction */
(function () {
  const { rand, randomUnit, leadPoint, clamp } = SW.util;
  const _v = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _l = new THREE.Vector3();

  class Subsystem {
    constructor(cap, type, name, hp, radius, localPos, mesh) {
      this.cap = cap;
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

    takeDamage(amount, source, hitPos) {
      if (!this.alive || this.cap.state !== 'active') return;
      const g = this.cap.game;
      if (source && source.isPlayer) g.stats.hits++;
      if (this.type === 'bridge' && this.cap.shieldsUp()) {
        if (hitPos) g.fx.sparks(hitPos, 'blue', 10, 30);
        this.cap.bridgeShield.material.uniforms.opacity.value = 1;
        if (source && source.isPlayer && g.time - (this.cap.lastShieldMsg || -99) > 6) {
          this.cap.lastShieldMsg = g.time;
          g.comms('R2 UNIT', '*urgent beeping* Bridge deflector shield is up! Take out the shield generator domes first.', 'command');
          SW.Audio.droid();
        }
        return;
      }
      this.hp -= amount;
      if (hitPos) g.fx.sparks(hitPos, null, 10, 35);
      if (this.hp <= 0) this.destroy(source);
    }

    destroy(source) {
      this.alive = false;
      const g = this.cap.game;
      const scale = this.type === 'turret' ? 2.2 : this.type === 'shield' ? 5 : 7;
      g.fx.explosion(this.pos, scale);
      g.sound3D('explosion', this.pos, scale * 0.6);
      if (this.mesh) this.mesh.visible = false;
      this.cap.onSubsystemDestroyed(this, source);
    }
  }

  class Capital {
    constructor(game, finalPos, yaw) {
      this.game = game;
      const m = SW.Models.createStarDestroyer();
      this.m = m;
      this.group = m.group;
      this.S = 1.6;
      this.group.rotation.y = yaw;
      this.group.scale.setScalar(this.S);
      this.group.position.copy(finalPos);
      this.finalPos = finalPos.clone();
      this.dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      this.group.visible = false;
      game.scene.add(this.group);
      this.state = 'hidden';
      this.kind = 'capital';
      this.name = 'STAR DESTROYER "DOMINION"';
      this.radius = 230 * 1.6;
      this.pos = this.group.position;
      this.velocity = new THREE.Vector3();
      this.alive = true;
      this.inv = new THREE.Matrix4();
      this.launchTimer = 6;
      this.maxFighters = 6;
      this.t = 0;

      this.subsystems = [];
      this.shields = m.domes.map((d, i) => {
        const s = new Subsystem(this, 'shield', 'SHIELD GENERATOR ' + (i ? 'B' : 'A'), 320, 10, m.domePos[i], d);
        this.subsystems.push(s);
        return s;
      });
      this.bridge = new Subsystem(this, 'bridge', 'COMMAND BRIDGE', 800, 17, m.bridgePos, null);
      this.subsystems.push(this.bridge);
      // bridge deflector bubble
      this.bridgeShield = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), SW.fresnelMaterial(0x55aaff, 2.0, 1.2));
      this.bridgeShield.scale.set(48, 22, 22);
      this.bridgeShield.position.copy(m.bridgePos);
      this.bridgeShield.material.uniforms.opacity.value = 0;
      this.group.add(this.bridgeShield);

      this.turrets = m.turretSpots.map((spot, i) => {
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

    onSubsystemDestroyed(s, source) {
      const g = this.game;
      if (s.type === 'turret') { g.addScore(75, s.pos); g.stats.kills++; }
      if (s.type === 'shield') {
        g.addScore(750, s.pos);
        const left = this.shields.filter((x) => x.alive).length;
        if (left > 0) g.comms('RED LEADER', 'One shield generator down! Hit the other one!');
        else {
          g.comms('REBEL COMMAND', 'The bridge deflector shield is down! All fighters — hit that bridge with everything you have!', 'command');
          g.hud.flashCenter('BRIDGE SHIELDS DOWN', 2.5);
          this.bridgeShield.visible = false;
        }
        g.onObjectiveProgress();
      }
      if (s.type === 'bridge') {
        g.addScore(2500, s.pos);
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
      g.hud.flashCenter('STAR DESTROYER CRITICAL', 3, true);
    }

    hitsHull(p, margin = 0) {
      if (this.state !== 'active' && this.state !== 'dying') return false;
      _l.copy(p).applyMatrix4(this.inv);
      return this.localInside(_l, margin);
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
      for (const b of this.m.boxes) {
        if (Math.abs(l.x - b.c.x) < b.h.x + margin && Math.abs(l.y - b.c.y) < b.h.y + margin && Math.abs(l.z - b.c.z) < b.h.z + margin) return true;
      }
      return false;
    }

    // steering direction away from the hull for a ship about to hit it; returns weight 0..1
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
      // push away: up if above the hull's midline, else down, plus sideways outward
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

      // engine flicker
      const on = this.state !== 'dying';
      this.m.engineGlows.forEach((s, i) => {
        const base = s.userData.base || (s.userData.base = s.scale.x);
        s.scale.setScalar(on ? base * (0.95 + Math.random() * 0.1) : base * Math.max(0.05, 1 - this.t / 2));
      });
      const bs = this.bridgeShield.material.uniforms.opacity;
      bs.value = Math.max(this.shieldsUp() ? 0.12 : 0, bs.value - dt * 1.5);

      if (this.state === 'active') {
        this.updateTurrets(dt);
        // launch TIE fighters from the hangar
        this.launchTimer -= dt;
        if (this.launchTimer <= 0 && !this.attract) {
          this.launchTimer = rand(7, 11) * g.launchMul;
          if (g.countEnemyFighters() < this.maxFighters + g.difficulty) {
            const n = Math.random() < 0.5 ? 2 : 1;
            for (let i = 0; i < n; i++) {
              const p = this.m.hangarPos.clone().add(new THREE.Vector3(rand(-10, 10), 0, rand(-15, 15))).applyMatrix4(this.group.matrixWorld);
              const type = g.missionIndex >= 2 && Math.random() < 0.35 ? 'interceptor' : 'tie';
              const ship = g.spawnEnemy(type, p);
              // drop out of the hangar heading down and forward
              _v.copy(this.dir).add(_v2.set(0, -0.8, 0)).normalize();
              ship.obj.lookAt(_v.add(p));
            }
          }
        }
      }

      if (this.state === 'dying') {
        if (Math.random() < 0.35) {
          const { L, W, H } = this.m.dims;
          const tt = Math.random();
          const x = (Math.random() * 2 - 1) * tt * W / 2 * 0.9;
          const z = L / 2 - tt * L;
          const y = SW.Models.sdTop(x, z) + rand(-5, 5);
          _v.set(x, y, z).applyMatrix4(this.group.matrixWorld);
          g.fx.explosion(_v, rand(3, 7), { debris: 3 });
          g.sound3D('explosion', _v, 3);
        }
        g.fx.addShake(0.02);
        // the ship slowly lists and sinks
        this.group.rotation.z += dt * 0.03;
        this.group.position.y -= dt * 4;
        this.group.updateMatrixWorld(true);
        this.inv.copy(this.group.matrixWorld).invert();
        if (this.t > 5.5) {
          this.state = 'dead';
          this.alive = false;
          const c = this.group.position.clone();
          g.fx.explosion(c, 22, { debris: 14, ringColor: new THREE.Color(2, 2.2, 3) });
          for (let i = 0; i < 8; i++) {
            _v.copy(c).addScaledVector(randomUnit(_v2), rand(40, 160));
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

    updateTurrets(dt) {
      const g = this.game;
      const player = g.player;
      for (const t of this.turrets) {
        if (!t.alive) continue;
        let target = player && player.alive ? player : null;
        if (!target || t.pos.distanceTo(target.pos) > 950) {
          target = g.ships.find((s) => s.alive && s.team === 'rebel' && s.pos.distanceTo(t.pos) < 800) || null;
        }
        if (!target) continue;
        t.head.lookAt(target.pos);
        t.fireTimer -= dt;
        if (t.fireTimer <= 0) {
          t.fireTimer = rand(1.3, 2.6) * g.enemyFireMul;
          t.head.getWorldPosition(_v);
          leadPoint(_v2, _v, this.velocity, target.pos, target.velocity, 520);
          _v2.sub(_v).normalize();
          const spread = 0.025;
          for (let i = 0; i < 2; i++) {
            const d = _l.copy(_v2).addScaledVector(randomUnit(new THREE.Vector3()), spread).normalize();
            g.bolts.spawn(_v, d, 520, 'empire', 7, t, 1.8);
          }
          g.sound3D('laser', _v, 'turret', 1.2);
        }
      }
    }

    dispose() { this.game.scene.remove(this.group); }
  }

  SW.Capital = Capital;
})();
