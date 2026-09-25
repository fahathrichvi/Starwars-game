/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Fighters (player, wingmen, Imperial TIEs), AI dogfighting, laser bolts and proton torpedoes */
(function () {
  const { rand, clamp, damp, randomUnit, leadPoint } = SW.util;
  const ZERO = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _qi = new THREE.Quaternion();
  const _up = new THREE.Vector3();
  const _d = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _t2 = new THREE.Vector3();
  const _lead = new THREE.Vector3();
  const _aim = new THREE.Vector3();
  const _cp = new THREE.Vector3();
  const _av = new THREE.Vector3();

  const SPECS = {
    xwing: {
      name: 'X-WING', build: () => SW.Models.createXWing(),
      hp: 100, shield: 100, min: 25, cruise: 75, max: 115, boost: 210, turn: 1.55, roll: 2.6, accel: 45,
      fireInterval: 0.13, damage: 10, boltSpeed: 700, laser: 'rebel', score: 0,
    },
    tie: {
      name: 'TIE FIGHTER', build: () => SW.Models.createTIE(),
      hp: 30, shield: 0, min: 40, cruise: 88, max: 122, turn: 1.45, accel: 50,
      fireInterval: 0.45, damage: 5, boltSpeed: 600, laser: 'empire', score: 100,
    },
    interceptor: {
      name: 'TIE INTERCEPTOR', build: () => SW.Models.createInterceptor(),
      hp: 45, shield: 0, min: 50, cruise: 108, max: 142, turn: 1.9, accel: 60,
      fireInterval: 0.3, damage: 5, boltSpeed: 640, laser: 'empire', score: 150,
    },
    advanced: {
      name: 'TIE ADVANCED', build: () => SW.Models.createTIEAdvanced(),
      hp: 900, shield: 350, min: 50, cruise: 118, max: 140, turn: 2.1, accel: 70,
      fireInterval: 0.2, damage: 7, boltSpeed: 700, laser: 'empire', score: 5000,
    },
  };

  /* ============================== SHIP ============================== */
  class Ship {
    constructor(game, type, team, opts = {}) {
      this.game = game;
      this.type = type;
      this.team = team;
      this.spec = SPECS[type];
      const m = this.spec.build();
      this.obj = new THREE.Group();
      this.model = m.group;
      this.obj.add(this.model);
      this.cannons = m.cannons;
      this.engines = m.engines;
      this.radius = m.radius;
      this.maxHp = this.hp = opts.hp || this.spec.hp;
      this.maxShield = this.shield = opts.shield !== undefined ? opts.shield : this.spec.shield;
      this.name = opts.name || this.spec.name;
      this.isPlayer = !!opts.player;
      this.isWingman = !!opts.wingman;
      this.isBoss = !!opts.boss;
      this.fireMul = 1;
      this.kind = 'fighter';
      this.velocity = new THREE.Vector3();
      this.prevPos = new THREE.Vector3();
      this.fwd = new THREE.Vector3(0, 0, 1);
      this.speed = this.spec.cruise;
      this.alive = true;
      this.fireTimer = rand(0.5, 2);
      this.cannonIdx = 0;
      this.lastHit = -100;
      this.bank = 0;
      this.burst = 0;
      this.shieldFlash = 0;
      this.ai = { state: 'attack', timer: 0, target: null, retarget: 0, evadeDir: new THREE.Vector3(), skill: opts.skill !== undefined ? opts.skill : 0.5 };
      if (this.maxShield > 0) {
        this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius * 1.15, 24, 16), SW.fresnelMaterial(0x4aa8ff, 1.6, 1.6));
        this.shieldMesh.material.uniforms.opacity.value = 0;
        this.shieldMesh.scale.set(1.05, 0.55, 1.35);
        this.shieldMesh.visible = false;
        this.obj.add(this.shieldMesh);
      }
      game.scene.add(this.obj);
    }

    get pos() { return this.obj.position; }

    updateFwd() { this.fwd.set(0, 0, 1).applyQuaternion(this.obj.quaternion); }

    steer(desired, dt, rate) {
      _up.set(0, 1, 0).applyQuaternion(this.obj.quaternion);
      _m.lookAt(desired, ZERO, _up);
      _q.setFromRotationMatrix(_m);
      _qi.copy(this.obj.quaternion).invert();
      const lx = _t.copy(desired).applyQuaternion(_qi).x;
      this.bank += (clamp(-lx * 2.4, -1.3, 1.3) - this.bank) * damp(4, dt);
      this.model.rotation.z = this.bank;
      this.obj.quaternion.rotateTowards(_q, rate * dt);
    }

    update(dt) {
      if (!this.alive) return;
      if (!this.isPlayer) this.updateAI(dt);
      this.updateFwd();
      this.velocity.copy(this.fwd).multiplyScalar(this.speed);
      this.prevPos.copy(this.obj.position);
      this.obj.position.addScaledVector(this.velocity, dt);
      this.fireTimer -= dt;

      // shield regeneration
      if (this.maxShield > 0 && this.game.time - this.lastHit > 4) {
        this.shield = Math.min(this.maxShield, this.shield + this.maxShield * 0.09 * dt);
      }
      if (this.shieldMesh) {
        this.shieldFlash = Math.max(0, this.shieldFlash - dt * 3);
        this.shieldMesh.visible = this.shieldFlash > 0.01 && !(this.isPlayer && this.game.cockpit);
        this.shieldMesh.material.uniforms.opacity.value = this.shieldFlash;
      }

      // engine glow pulses with speed; rebel engines leave a faint trail
      const sp = this.speed / this.spec.max;
      const fx = this.game.fx;
      for (const e of this.engines) {
        const s = e.userData.glow;
        if (s) {
          const base = this.type === 'xwing' ? 0.7 + sp * 0.6 : 0.6 + sp * 0.6;
          s.scale.setScalar(base * (0.92 + Math.random() * 0.16));
        }
        if (this.type === 'xwing' && this.game.frame % 2 === 0) {
          e.getWorldPosition(_cp);
          fx.engineTrail(_cp, _t.copy(this.velocity).multiplyScalar(0.2), 0.6 + sp);
        }
      }
      // damage smoke
      const hpf = this.hp / this.maxHp;
      if (hpf < 0.5 && Math.random() < (hpf < 0.25 ? 0.8 : 0.35)) {
        _cp.copy(this.pos).addScaledVector(randomUnit(_t), this.radius * 0.3);
        fx.damageSmoke(_cp, _t2.copy(this.velocity).multiplyScalar(0.3), hpf < 0.25);
      }
    }

    /* ---------------- AI dogfighting ---------------- */
    updateAI(dt) {
      const g = this.game, ai = this.ai, spec = this.spec, P = this.pos, F = this.fwd;
      ai.retarget -= dt;
      if (!ai.target || !ai.target.alive || ai.retarget <= 0) {
        ai.target = g.pickTarget(this);
        ai.retarget = rand(5, 10);
      }
      const T = ai.target;
      let wantSpeed = spec.cruise;
      let canFire = false;
      let dist = 1e9;

      if (ai.state === 'evade') {
        ai.timer -= dt;
        _d.copy(ai.evadeDir);
        wantSpeed = spec.max;
        if (ai.timer <= 0) ai.state = 'attack';
      } else if (T) {
        dist = P.distanceTo(T.pos);
        leadPoint(_lead, P, this.velocity, T.pos, T.velocity, spec.boltSpeed);
        _aim.copy(T.pos).lerp(_lead, ai.skill);
        _d.subVectors(_aim, P).normalize();
        const facing = F.dot(_d);
        if (dist < (T.kind === 'fighter' ? 60 + this.speed * 0.35 : 170)) {
          // about to overshoot / collide — break away and come around again
          ai.state = 'evade';
          ai.timer = rand(1.6, 3.2);
          randomUnit(ai.evadeDir).addScaledVector(F, 0.8).normalize();
        }
        wantSpeed = dist > 600 ? spec.max : dist < 220 ? spec.cruise * 0.85 : spec.cruise;
        const cone = 0.992 - (1 - ai.skill) * 0.01;
        if (dist < 750 && facing > cone) canFire = true;
      } else {
        _d.copy(P).multiplyScalar(-1).normalize();
      }

      // keep inside the combat zone
      const r = P.length();
      const ARENA = g.arenaRadius;
      if (r > ARENA) {
        const w = clamp((r - ARENA) / 500, 0, 0.9);
        _d.lerp(_t.copy(P).multiplyScalar(-1 / r), w).normalize();
      }
      // avoid capital ship hull and asteroids
      const avoid = g.avoidance(this, _av);
      if (avoid > 0) _d.lerp(_av, clamp(avoid, 0, 0.95)).normalize();

      this.steer(_d, dt, spec.turn * (ai.state === 'evade' ? 1.1 : 1));
      const acc = spec.accel * dt;
      this.speed += clamp(wantSpeed - this.speed, -acc, acc);

      if (canFire && this.fireTimer <= 0) {
        this.fire(null, (1 - ai.skill) * 0.03 + 0.008);
        if (this.burst > 0) { this.burst--; this.fireTimer = spec.fireInterval * 0.5 * this.fireMul; }
        else {
          this.burst = this.team === 'empire' ? Math.floor(rand(1, 4)) : Math.floor(rand(2, 5));
          this.fireTimer = spec.fireInterval * rand(1.2, 2.4) * this.fireMul * (this.team === 'empire' ? g.enemyFireMul : 1);
        }
      }
    }

    fire(aimPoint, spread = 0) {
      const g = this.game, spec = this.spec;
      let list;
      const c = this.cannons;
      if (this.type === 'xwing' || this.type === 'interceptor') list = this.cannonIdx++ % 2 === 0 ? [c[0], c[3]] : [c[1], c[2]];
      else list = c;
      for (const cn of list) {
        cn.getWorldPosition(_cp);
        if (aimPoint) _d.subVectors(aimPoint, _cp).normalize();
        else _d.copy(this.fwd);
        if (spread > 0) _d.addScaledVector(randomUnit(_t), spread).normalize();
        g.bolts.spawn(_cp, _d, spec.boltSpeed + this.speed, this.team, spec.damage, this);
        g.fx.muzzle(_cp, this.velocity, this.team === 'rebel');
      }
      g.sound3D('laser', this.pos, spec.laser, this.isPlayer ? 0.8 : 1);
      if (this.isPlayer) g.stats.shots += list.length;
    }

    takeDamage(amount, source, hitPos) {
      if (!this.alive) return;
      const g = this.game;
      if (this.isBoss && this.invulnerable) { if (hitPos) g.fx.sparks(hitPos, 'blue', 6, 30); return; }
      this.lastHit = g.time;
      if (this.isPlayer) amount *= g.playerDamageMul;
      let shieldHit = false;
      if (this.shield > 0) {
        const a = Math.min(this.shield, amount);
        this.shield -= a; amount -= a; shieldHit = true;
        this.shieldFlash = 1;
      }
      if (amount > 0) this.hp -= amount;
      if (hitPos) g.fx.sparks(hitPos, shieldHit ? 'blue' : null, shieldHit ? 6 : 12, 30);
      if (source && source.isPlayer && !this.isPlayer) g.stats.hits++;
      if (this.isPlayer) g.onPlayerHit(shieldHit, source);
      if (this.isBoss) g.onBossDamaged(this);
      if (this.hp <= 0) { this.destroy(source); return; }
      if (!this.isPlayer && this.ai.state !== 'evade' && Math.random() < (this.isBoss ? 0.2 : 0.35)) {
        this.ai.state = 'evade';
        this.ai.timer = rand(0.8, 1.8);
        randomUnit(this.ai.evadeDir).addScaledVector(this.fwd, 0.5).normalize();
      }
      if (this.isWingman && Math.random() < 0.08) g.wingmanHurt(this);
    }

    destroy(source) {
      if (!this.alive) return;
      this.alive = false;
      const g = this.game;
      const scale = this.isBoss ? 3.5 : this.type === 'xwing' ? 1.6 : 1.3;
      g.fx.explosion(this.pos, scale, { velocity: _t.copy(this.velocity).multiplyScalar(0.4) });
      g.sound3D('explosion', this.pos, scale);
      g.breakApart(this);
      g.scene.remove(this.obj);
      g.onShipDestroyed(this, source);
    }

    dispose() { this.game.scene.remove(this.obj); }
  }

  /* ============================== PLAYER CONTROL ============================== */
  class PlayerControl {
    constructor(ship) {
      this.ship = ship;
      this.ang = new THREE.Vector3();
      this.throttle = 0.55;
      this.heat = 0;
      this.overheated = false;
      this.boost = 100;
      this.boosting = false;
      this.torps = 6;
      this.target = null;
      this.lockTimer = 0;
      this.locked = false;
      this.lockBeep = 0;
      this.prevRight = false;
      this.aimPoint = new THREE.Vector3();
      this.assist = false;
      this.torpCooldown = 0;
    }

    update(dt, controlsEnabled) {
      const s = this.ship, g = s.game, I = SW.Input, spec = s.spec;
      let pitch = 0, yaw = 0, roll = 0;
      if (controlsEnabled) {
        const sx = I.stick.x, sy = I.stick.y;
        const mag = Math.hypot(sx, sy);
        const dz = 0.06;
        if (mag > dz) {
          const k = (mag - dz) / (1 - dz) / mag;
          yaw = sx * k;
          pitch = sy * k * (SW.settings.invert ? -1 : 1);
        }
        if (I.keys.ArrowUp) pitch -= 1;
        if (I.keys.ArrowDown) pitch += 1;
        if (I.keys.ArrowLeft) yaw -= 1;
        if (I.keys.ArrowRight) yaw += 1;
        if (I.keys.KeyA) roll -= 1;
        if (I.keys.KeyD) roll += 1;
        pitch = clamp(pitch, -1, 1); yaw = clamp(yaw, -1, 1);
        if (I.consume('KeyX')) I.centerStick();
        // gentle self-centering of the virtual stick when the mouse is idle
        if (I.pointerLocked && performance.now() - I.lastMouseMove > 250) {
          const k = Math.exp(-1.6 * dt);
          I.stick.x *= k; I.stick.y *= k;
        }
      }
      const k = damp(7, dt);
      this.ang.x += (pitch * spec.turn - this.ang.x) * k;
      this.ang.y += (yaw * spec.turn * 0.85 - this.ang.y) * k;
      this.ang.z += (roll * spec.roll - this.ang.z) * k;
      s.obj.rotateX(this.ang.x * dt);
      s.obj.rotateY(-this.ang.y * dt);
      s.obj.rotateZ(this.ang.z * dt);
      s.bank += (this.ang.y * 0.3 - s.bank) * damp(5, dt);
      s.model.rotation.z = s.bank;

      // leaving the combat zone: gently turn the ship back
      const r = s.pos.length();
      if (r > g.arenaRadius + 500) {
        _d.copy(s.pos).multiplyScalar(-1 / r);
        _m.lookAt(_d, ZERO, _up.set(0, 1, 0).applyQuaternion(s.obj.quaternion));
        _q.setFromRotationMatrix(_m);
        s.obj.quaternion.rotateTowards(_q, 0.9 * dt);
      }

      // throttle & boost
      if (controlsEnabled) {
        if (I.keys.KeyW) this.throttle = Math.min(1, this.throttle + 0.8 * dt);
        if (I.keys.KeyS) this.throttle = Math.max(0, this.throttle - 0.8 * dt);
      }
      const wantBoost = controlsEnabled && (I.keys.ShiftLeft || I.keys.ShiftRight);
      if (wantBoost && this.boost > 0) { this.boosting = true; this.boost = Math.max(0, this.boost - 32 * dt); }
      else { this.boosting = false; if (!wantBoost) this.boost = Math.min(100, this.boost + 11 * dt); }
      const targetSpeed = this.boosting ? spec.boost : spec.min + (spec.max - spec.min) * this.throttle;
      const acc = (this.boosting ? 120 : spec.accel) * dt;
      s.speed += clamp(targetSpeed - s.speed, -acc, acc);

      // targeting
      if (this.target && !this.target.alive) { this.target = null; this.lockTimer = 0; }
      if (controlsEnabled) {
        if (I.consume('KeyT')) this.target = g.nearestEnemy(s, false) || this.target;
        if (I.consume('KeyR')) this.target = g.nearestEnemy(s, true) || this.target;
        if (I.consume('KeyE')) this.target = g.cycleTarget(this.target, 1);
        if (I.consume('KeyQ')) this.target = g.cycleTarget(this.target, -1);
      }
      if (!this.target) this.target = g.nearestEnemy(s, true);

      // aim assist: converge bolts on the lead point when target is near the reticle
      const T = this.target;
      this.assist = false;
      s.updateFwd();
      if (T) {
        leadPoint(_lead, s.pos, s.velocity, T.pos, T.velocity, spec.boltSpeed + s.speed);
        _t.subVectors(_lead, s.pos);
        const dist = _t.length();
        const ang = Math.acos(clamp(_t.normalize().dot(s.fwd), -1, 1));
        if (ang < 0.07 && dist < 900) { this.assist = true; this.aimPoint.copy(_lead); }
        // missile lock
        _t2.subVectors(T.pos, s.pos);
        const tDist = _t2.length();
        const tAng = Math.acos(clamp(_t2.normalize().dot(s.fwd), -1, 1));
        if (tDist < 1200 && tAng < 0.16) this.lockTimer = Math.min(1.2, this.lockTimer + dt);
        else this.lockTimer = Math.max(0, this.lockTimer - dt * 2);
      } else this.lockTimer = 0;
      const wasLocked = this.locked;
      this.locked = this.lockTimer >= 1.0 && !!T;
      this.lockBeep -= dt;
      if (this.torps > 0 && this.lockTimer > 0.05 && !this.locked && this.lockBeep <= 0) { SW.Audio.beep(1000, 0.05, 0.12); this.lockBeep = 0.18; }
      if (this.locked && !wasLocked && this.torps > 0) SW.Audio.beep(1500, 0.3, 0.15);
      if (!this.assist) this.aimPoint.copy(s.pos).addScaledVector(s.fwd, 400);

      // lasers with heat management
      this.heat = Math.max(0, this.heat - 30 * dt);
      if (this.overheated && this.heat < 35) this.overheated = false;
      if (controlsEnabled && (I.mouse[0] || I.keys.Space) && s.fireTimer <= 0 && !this.overheated) {
        s.fire(this.aimPoint, 0.002);
        s.fireTimer = spec.fireInterval;
        this.heat += 5.2;
        if (this.heat >= 100) { this.heat = 100; this.overheated = true; g.hud.flashSub('LASERS OVERHEATED', 1.5); SW.Audio.beep(300, 0.25, 0.2); }
      }
      // proton torpedoes
      this.torpCooldown -= dt;
      const right = I.mouse[2];
      const fireTorp = controlsEnabled && ((right && !this.prevRight) || I.consume('KeyF'));
      this.prevRight = right;
      if (fireTorp && this.torpCooldown <= 0) {
        if (this.torps > 0) {
          this.torps--;
          this.torpCooldown = 0.6;
          g.torpedoes.launch(s, this.locked ? T : null);
          SW.Audio.torpedo();
        } else { SW.Audio.beep(220, 0.15, 0.2); g.hud.flashSub('NO TORPEDOES REMAINING', 1.2); }
      }
      SW.Audio.setEngine(this.throttle, this.boosting);
    }
  }

  /* ============================== LASER BOLTS ============================== */
  class Bolts {
    constructor(game) {
      this.game = game;
      this.list = [];
      this.pool = { rebel: [], empire: [] };
      const geo = new THREE.CylinderGeometry(0.13, 0.13, 6, 6, 1);
      geo.rotateX(Math.PI / 2);
      const geoCore = new THREE.CylinderGeometry(0.3, 0.3, 7, 6, 1);
      geoCore.rotateX(Math.PI / 2);
      this.geo = geo; this.geoGlow = geoCore;
      this.mat = {
        rebel: new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.9, 0.6), toneMapped: false }),
        empire: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 8, 1.2), toneMapped: false }),
      };
      this.glowMat = {
        rebel: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.08, 0.04), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
        empire: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 1.2, 0.15), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      };
      this.zAxis = new THREE.Vector3(0, 0, 1);
    }

    spawn(pos, dir, speed, team, damage, owner, scale = 1) {
      let b = this.pool[team].pop();
      if (!b) {
        const mesh = new THREE.Mesh(this.geo, this.mat[team]);
        mesh.add(new THREE.Mesh(this.geoGlow, this.glowMat[team]));
        b = { mesh, vel: new THREE.Vector3(), prev: new THREE.Vector3(), team };
      }
      b.mesh.visible = true;
      b.mesh.position.copy(pos);
      b.mesh.quaternion.setFromUnitVectors(this.zAxis, dir);
      b.mesh.scale.setScalar(scale);
      b.prev.copy(pos);
      b.vel.copy(dir).multiplyScalar(speed);
      b.life = 1.7;
      b.damage = damage;
      b.owner = owner;
      b.nearMiss = false;
      this.game.scene.add(b.mesh);
      this.list.push(b);
      return b;
    }

    kill(i) {
      const b = this.list[i];
      this.game.scene.remove(b.mesh);
      b.owner = null;
      this.pool[b.team].push(b);
      this.list[i] = this.list[this.list.length - 1];
      this.list.pop();
    }

    update(dt) {
      const g = this.game;
      const rebels = g.getTargets('rebel');
      const empire = g.getTargets('empire');
      for (let i = this.list.length - 1; i >= 0; i--) {
        const b = this.list[i];
        b.prev.copy(b.mesh.position);
        b.mesh.position.addScaledVector(b.vel, dt);
        b.life -= dt;
        if (b.life <= 0) { this.kill(i); continue; }
        const P = b.mesh.position;
        const targets = b.team === 'rebel' ? empire : rebels;
        let hit = false;
        for (let j = 0; j < targets.length; j++) {
          const t = targets[j];
          if (!t.alive || t === b.owner) continue;
          if (t.hitTest ? t.hitTest(b.prev, P, 0) : SW.util.segmentSphere(b.prev, P, t.pos, t.radius)) {
            t.takeDamage(b.damage, b.owner, P);
            hit = true;
            break;
          }
        }
        if (!hit && g.hullHit(P)) {
          g.fx.sparks(P, b.team === 'rebel' ? 'red' : 'green', 8, 25);
          g.sound3D('spark', P);
          hit = true;
        }
        if (!hit) {
          for (const a of g.world.asteroids) {
            if (P.distanceToSquared(a.position) < a.userData.radius * a.userData.radius) {
              g.fx.sparks(P, null, 8, 20);
              if (b.owner && b.owner.isPlayer && g.world.damageAsteroid(a, b.damage, g.fx)) g.sound3D('explosion', P, 0.6);
              hit = true; break;
            }
          }
        }
        // enemy near-miss whoosh
        if (!hit && b.team === 'empire' && !b.nearMiss && g.player && g.player.alive) {
          if (P.distanceToSquared(g.player.pos) < 100) { b.nearMiss = true; SW.Audio.spark(0.15, 0); }
        }
        if (hit) this.kill(i);
      }
    }

    clear() { for (let i = this.list.length - 1; i >= 0; i--) this.kill(i); }
  }

  /* ============================== PROTON TORPEDOES ============================== */
  class Torpedoes {
    constructor(game) {
      this.game = game;
      this.list = [];
    }

    launch(ship, target) {
      const s = SW.Models.glowSprite(new THREE.Color(6, 3.5, 1.8), 3.2);
      ship.updateFwd();
      s.position.copy(ship.pos).addScaledVector(ship.fwd, 6).add(_t.set(0, -1, 0).applyQuaternion(ship.obj.quaternion));
      this.game.scene.add(s);
      this.list.push({
        sprite: s, dir: ship.fwd.clone(), speed: ship.speed + 40, target, life: 7, owner: ship, team: ship.team, prev: s.position.clone(),
      });
      if (!target) this.game.hud.flashSub('DUMB-FIRE — NO LOCK', 1);
    }

    update(dt) {
      const g = this.game;
      for (let i = this.list.length - 1; i >= 0; i--) {
        const t = this.list[i];
        t.life -= dt;
        t.speed = Math.min(320, t.speed + 260 * dt);
        const T = t.target && t.target.alive ? t.target : null;
        if (T) {
          _d.subVectors(T.pos, t.sprite.position).normalize();
          t.dir.lerp(_d, Math.min(1, 3.2 * dt)).normalize();
        }
        t.prev.copy(t.sprite.position);
        t.sprite.position.addScaledVector(t.dir, t.speed * dt);
        t.sprite.scale.setScalar(3 + Math.random() * 1.2);
        g.fx.torpedoTrail(t.sprite.position);
        let boom = false;
        const P = t.sprite.position;
        const targets = g.getTargets(t.team === 'rebel' ? 'empire' : 'rebel');
        for (const x of targets) {
          if (!x.alive) continue;
          const touch = x.hitTest ? x.hitTest(t.prev, P, 3) : SW.util.segmentSphere(t.prev, P, x.pos, x.radius + 3);
          if (touch) { x.takeDamage(160, t.owner, P, 'torpedo'); boom = true; break; }
        }
        if (!boom && g.hullHit(P)) boom = true;
        if (!boom) {
          for (const a of g.world.asteroids) {
            if (P.distanceToSquared(a.position) < a.userData.radius * a.userData.radius) { g.world.damageAsteroid(a, 200, g.fx); boom = true; break; }
          }
        }
        if (boom || t.life <= 0) {
          g.fx.explosion(P, boom ? 1.4 : 0.8, { debris: 2 });
          g.sound3D('explosion', P, 1);
          g.scene.remove(t.sprite);
          this.list.splice(i, 1);
        }
      }
    }

    clear() { this.list.forEach((t) => this.game.scene.remove(t.sprite)); this.list = []; }
  }

  /* ============================== TRANSPORTS & FREIGHTERS ============================== */
  class Transport {
    constructor(game, variant, pos, dest, name, opts = {}) {
      this.game = game;
      this.variant = variant;
      this.team = variant === 'rebel' ? 'rebel' : 'empire';
      const m = SW.Models.createTransport(variant);
      this.obj = new THREE.Group();
      this.model = m.group;
      this.obj.add(this.model);
      this.engines = m.engines;
      this.obj.position.copy(pos);
      this.dest = dest.clone();
      this.obj.lookAt(this.dest);
      this.kind = 'transport';
      this.name = name;
      this.hp = this.maxHp = opts.hp || 650;
      this.shield = this.maxShield = opts.shield !== undefined ? opts.shield : 250;
      this.radius = 16;
      this.speed = opts.speed || 24;
      this.velocity = new THREE.Vector3();
      this.fwd = new THREE.Vector3(0, 0, 1);
      this.alive = true;
      this.jumped = false;
      this.jumping = false;
      this.jumpT = 0;
      this.lastHit = -100;
      this.isPlayer = false;
      this.shieldFlash = 0;
      this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), SW.fresnelMaterial(this.team === 'rebel' ? 0x4aa8ff : 0x66ff99, 1.6, 1.4));
      this.shieldMesh.scale.set(15, 13, 38);
      this.shieldMesh.material.uniforms.opacity.value = 0;
      this.shieldMesh.visible = false;
      this.obj.add(this.shieldMesh);
      game.scene.add(this.obj);
    }

    get pos() { return this.obj.position; }

    // long hull approximated by five spheres along its axis
    hitTest(p0, p1, extra = 0) {
      for (let k = -2; k <= 2; k++) {
        _cp.copy(this.obj.position).addScaledVector(this.fwd, k * 13);
        if (SW.util.segmentSphere(p0, p1, _cp, 10 + extra)) return true;
      }
      return false;
    }

    update(dt) {
      if (!this.alive) return;
      const g = this.game;
      if (this.jumping) {
        this.jumpT += dt;
        this.obj.scale.z = 1 + this.jumpT * 40;
        this.obj.position.addScaledVector(this.fwd, (200 + this.jumpT * 5000) * dt);
        if (this.jumpT > 0.6) {
          this.alive = false;
          this.jumped = true;
          g.scene.remove(this.obj);
          g.onTransportJumped(this);
        }
        return;
      }
      this.fwd.set(0, 0, 1).applyQuaternion(this.obj.quaternion);
      this.velocity.copy(this.fwd).multiplyScalar(this.speed);
      this.obj.position.addScaledVector(this.velocity, dt);
      if (g.time - this.lastHit > 5) this.shield = Math.min(this.maxShield, this.shield + this.maxShield * 0.04 * dt);
      this.shieldFlash = Math.max(0, this.shieldFlash - dt * 2.5);
      this.shieldMesh.visible = this.shieldFlash > 0.01;
      this.shieldMesh.material.uniforms.opacity.value = this.shieldFlash;
      for (const e of this.engines) e.scale.setScalar((e.userData.base || (e.userData.base = e.scale.x)) * (0.9 + Math.random() * 0.2));
      const hpf = this.hp / this.maxHp;
      if (hpf < 0.5 && Math.random() < (hpf < 0.25 ? 0.9 : 0.4)) {
        _cp.copy(this.pos).addScaledVector(this.fwd, rand(-25, 25)).addScaledVector(randomUnit(_t), 6);
        g.fx.damageSmoke(_cp, _t2.copy(this.velocity).multiplyScalar(0.3), hpf < 0.25);
      }
      _t.subVectors(this.dest, this.pos);
      if (_t.length() < 60 || _t.dot(this.fwd) < 0) {
        this.jumping = true;
        g.fx.flashLight(this.pos, 6, 400, 0.6, 0xaaccff);
        g.sound3D('explosion', this.pos, 0.5);
      }
    }

    takeDamage(amount, source, hitPos) {
      if (!this.alive || this.jumping) return;
      const g = this.game;
      this.lastHit = g.time;
      let shieldHit = false;
      if (this.shield > 0) {
        const a = Math.min(this.shield, amount);
        this.shield -= a; amount -= a; shieldHit = true;
        this.shieldFlash = 0.8;
      }
      if (amount > 0) this.hp -= amount;
      if (hitPos) g.fx.sparks(hitPos, shieldHit ? 'blue' : null, shieldHit ? 5 : 10, 30);
      if (source && source.isPlayer) g.stats.hits++;
      g.onTransportHit(this);
      if (this.hp <= 0) this.destroy(source);
    }

    destroy(source) {
      if (!this.alive) return;
      this.alive = false;
      const g = this.game;
      for (let k = -1; k <= 1; k++) {
        _cp.copy(this.pos).addScaledVector(this.fwd, k * 22);
        g.fx.explosion(_cp, 3.2, { debris: 6 });
      }
      g.fx.flashLight(this.pos, 10, 800, 1, 0xffa060);
      g.sound3D('explosion', this.pos, 3);
      g.scene.remove(this.obj);
      g.onTransportDestroyed(this, source);
    }

    dispose() { this.game.scene.remove(this.obj); }
  }

  SW.SPECS = SPECS;
  SW.Transport = Transport;
  SW.Ship = Ship;
  SW.PlayerControl = PlayerControl;
  SW.Bolts = Bolts;
  SW.Torpedoes = Torpedoes;
})();
