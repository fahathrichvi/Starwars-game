/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Visual effects: GPU particle systems, explosions, debris, shockwaves, flashes, hyperspace streaks */
(function () {
  const { rand, randomUnit } = SW.util;
  const _v = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _p = new THREE.Vector3();
  const ZERO = new THREE.Vector3();

  const PVS = `
    attribute float size; attribute vec3 pcolor; attribute float alpha;
    uniform float scale;
    varying vec3 vColor; varying float vAlpha;
    void main(){
      vColor = pcolor; vAlpha = alpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = min(size * scale / max(-mv.z, 0.1), 900.0);
      gl_Position = projectionMatrix * mv;
    }`;
  const PFS = `
    uniform sampler2D map;
    varying vec3 vColor; varying float vAlpha;
    void main(){
      vec4 t = texture2D(map, gl_PointCoord);
      gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
    }`;

  class ParticleSystem {
    constructor(scene, max, texture, additive) {
      this.max = max; this.count = 0;
      this.pos = new Float32Array(max * 3);
      this.col = new Float32Array(max * 3);
      this.size = new Float32Array(max);
      this.alpha = new Float32Array(max);
      this.vel = new Float32Array(max * 3);
      this.life = new Float32Array(max);
      this.maxLife = new Float32Array(max);
      this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
      this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
      this.a0 = new Float32Array(max);
      this.drag = new Float32Array(max);
      const geo = new THREE.BufferGeometry();
      this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
      this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
      this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
      this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', this.aPos);
      geo.setAttribute('pcolor', this.aCol);
      geo.setAttribute('size', this.aSize);
      geo.setAttribute('alpha', this.aAlpha);
      this.material = new THREE.ShaderMaterial({
        uniforms: { map: { value: texture }, scale: { value: 500 } },
        vertexShader: PVS, fragmentShader: PFS,
        transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      this.points = new THREE.Points(geo, this.material);
      this.points.frustumCulled = false;
      this.points.renderOrder = additive ? 5 : 4;
      scene.add(this.points);
    }

    emit(p, v, life, s0, s1, c0, c1, a0 = 1, drag = 0) {
      let i;
      if (this.count < this.max) i = this.count++;
      else i = Math.floor(Math.random() * this.max);
      const i3 = i * 3;
      this.pos[i3] = p.x; this.pos[i3 + 1] = p.y; this.pos[i3 + 2] = p.z;
      this.vel[i3] = v.x; this.vel[i3 + 1] = v.y; this.vel[i3 + 2] = v.z;
      this.life[i] = this.maxLife[i] = life;
      this.s0[i] = s0; this.s1[i] = s1;
      this.c0[i3] = c0.r; this.c0[i3 + 1] = c0.g; this.c0[i3 + 2] = c0.b;
      this.c1[i3] = c1.r; this.c1[i3 + 1] = c1.g; this.c1[i3 + 2] = c1.b;
      this.a0[i] = a0; this.drag[i] = drag;
      this.size[i] = s0; this.alpha[i] = a0;
      this.col[i3] = c0.r; this.col[i3 + 1] = c0.g; this.col[i3 + 2] = c0.b;
    }

    copy(dst, src) {
      const d3 = dst * 3, s3 = src * 3;
      for (let k = 0; k < 3; k++) {
        this.pos[d3 + k] = this.pos[s3 + k]; this.vel[d3 + k] = this.vel[s3 + k];
        this.c0[d3 + k] = this.c0[s3 + k]; this.c1[d3 + k] = this.c1[s3 + k]; this.col[d3 + k] = this.col[s3 + k];
      }
      this.life[dst] = this.life[src]; this.maxLife[dst] = this.maxLife[src];
      this.s0[dst] = this.s0[src]; this.s1[dst] = this.s1[src];
      this.a0[dst] = this.a0[src]; this.drag[dst] = this.drag[src];
      this.size[dst] = this.size[src]; this.alpha[dst] = this.alpha[src];
    }

    update(dt) {
      let i = 0;
      while (i < this.count) {
        this.life[i] -= dt;
        if (this.life[i] <= 0) {
          this.count--;
          if (i !== this.count) this.copy(i, this.count);
          continue;
        }
        const i3 = i * 3;
        const dr = Math.exp(-this.drag[i] * dt);
        this.vel[i3] *= dr; this.vel[i3 + 1] *= dr; this.vel[i3 + 2] *= dr;
        this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
        const t = 1 - this.life[i] / this.maxLife[i];
        this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
        this.alpha[i] = this.a0[i] * (1 - t) * (t < 0.08 ? t / 0.08 : 1);
        this.col[i3] = this.c0[i3] + (this.c1[i3] - this.c0[i3]) * t;
        this.col[i3 + 1] = this.c0[i3 + 1] + (this.c1[i3 + 1] - this.c0[i3 + 1]) * t;
        this.col[i3 + 2] = this.c0[i3 + 2] + (this.c1[i3 + 2] - this.c0[i3 + 2]) * t;
        i++;
      }
      this.points.geometry.setDrawRange(0, this.count);
      this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
    }

    clear() { this.count = 0; this.points.geometry.setDrawRange(0, 0); }
  }

  const C = (r, g, b) => new THREE.Color(r, g, b);
  const COL = {
    flash: C(6, 5, 4), flashEnd: C(3, 1.2, 0.4),
    fire: C(4, 2.0, 0.6), fireEnd: C(0.9, 0.12, 0.02),
    spark: C(5, 3.5, 1.8), sparkEnd: C(1.4, 0.3, 0.0),
    smoke: C(0.22, 0.21, 0.2), smokeEnd: C(0.08, 0.08, 0.08),
    blueSpark: C(1.5, 3, 6), blueEnd: C(0.2, 0.5, 1.5),
    greenSpark: C(1, 5, 1.4), greenEnd: C(0.1, 1, 0.2),
    redSpark: C(5, 1, 0.8), redEnd: C(1.2, 0.1, 0.05),
    trail: C(1.2, 0.6, 0.4), trailEnd: C(0.1, 0.05, 0.05),
    torp: C(5, 3, 1.5), torpEnd: C(1.5, 0.3, 0.1),
    white: C(4, 4, 4),
  };

  class Effects {
    constructor(scene, camera) {
      this.scene = scene;
      this.camera = camera;
      this.fire = new ParticleSystem(scene, 5000, SW.Tex.glow(), true);
      this.smoke = new ParticleSystem(scene, 1500, SW.Tex.smoke(), false);
      this.debris = [];
      this.rings = [];
      this.shake = 0;
      this.COL = COL;

      // pooled flash lights
      this.lights = [];
      for (let i = 0; i < 4; i++) {
        const l = new THREE.PointLight(0xffaa66, 0, 100, 2);
        scene.add(l);
        this.lights.push({ light: l, t: 0, dur: 1, peak: 0 });
      }

      // debris geometry pool
      this.debrisGeos = [new THREE.BoxGeometry(1, 0.4, 0.8), new THREE.TetrahedronGeometry(0.7), new THREE.BoxGeometry(0.3, 0.3, 1.4)];
      this.debrisMat = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.6, metalness: 0.6, emissive: 0x220800 });
      this.ringGeo = new THREE.RingGeometry(0.85, 1, 64);
    }

    setScale(h, fov) {
      const s = h / (2 * Math.tan((fov * Math.PI) / 360));
      this.fire.material.uniforms.scale.value = s;
      this.smoke.material.uniforms.scale.value = s;
    }

    flashLight(pos, intensity, dist, dur, color) {
      let best = this.lights[0];
      for (const l of this.lights) if (l.t >= l.dur) { best = l; break; }
      best.light.position.copy(pos);
      best.light.color.set(color || 0xffaa66);
      best.light.distance = dist;
      best.peak = intensity; best.t = 0; best.dur = dur;
      best.light.intensity = intensity;
    }

    explosion(pos, scale = 1, opts = {}) {
      const fire = this.fire, smoke = this.smoke;
      const base = opts.velocity || ZERO;
      fire.emit(pos, base, 0.3 * Math.sqrt(scale), 8 * scale, 24 * scale, COL.flash, COL.flashEnd, 0.9, 0);
      const nFire = Math.min(80, 30 + 12 * scale);
      for (let i = 0; i < nFire; i++) {
        randomUnit(_v).multiplyScalar(rand(4, 22) * Math.sqrt(scale)).add(base);
        const p = _p.copy(pos).addScaledVector(_v, 0.05);
        fire.emit(p, _v, rand(0.5, 1.3) * Math.sqrt(scale), rand(2.5, 5) * scale, rand(7, 12) * scale, COL.fire, COL.fireEnd, 0.75, 1.6);
      }
      const nSpark = Math.min(80, 25 + 8 * scale);
      for (let i = 0; i < nSpark; i++) {
        randomUnit(_v).multiplyScalar(rand(40, 140) * Math.sqrt(scale)).add(base);
        fire.emit(pos, _v, rand(0.4, 1.1), rand(0.6, 1.3) * Math.sqrt(scale), 0.2, COL.spark, COL.sparkEnd, 1, 0.8);
      }
      const nSmoke = Math.min(40, 10 + 5 * scale);
      for (let i = 0; i < nSmoke; i++) {
        randomUnit(_v).multiplyScalar(rand(3, 12) * Math.sqrt(scale)).addScaledVector(base, 0.6);
        smoke.emit(pos, _v, rand(1.8, 3.5) * Math.sqrt(scale), rand(4, 7) * scale, rand(16, 26) * scale, COL.smoke, COL.smokeEnd, 0.55, 0.9);
      }
      // debris chunks
      const nDeb = opts.debris !== undefined ? opts.debris : Math.min(14, 5 + scale * 2);
      for (let i = 0; i < nDeb; i++) this.spawnDebris(pos, scale, base);
      // shockwave ring
      this.spawnRing(pos, scale * 26, 0.7, opts.ringColor);
      this.flashLight(pos, 4 * Math.min(scale, 4), 120 * scale, 0.5 + scale * 0.1, 0xffa060);
    }

    spawnDebris(pos, scale, base) {
      let d = this.debris.find((x) => !x.active);
      if (!d) {
        if (this.debris.length > 80) return;
        const m = new THREE.Mesh(SW.util.pick(this.debrisGeos), this.debrisMat);
        this.scene.add(m);
        d = { mesh: m, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, active: false };
        this.debris.push(d);
      }
      d.active = true; d.mesh.visible = true;
      d.mesh.position.copy(pos);
      d.mesh.scale.setScalar(rand(0.5, 1.4) * Math.sqrt(scale));
      randomUnit(d.vel).multiplyScalar(rand(10, 45) * Math.sqrt(scale)).add(base);
      d.spin.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
      d.life = rand(1.5, 3.5);
      d.burn = Math.random() < 0.6;
    }

    spawnRing(pos, size, dur, color) {
      let r = this.rings.find((x) => !x.active);
      if (!r) {
        const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        }));
        this.scene.add(m);
        r = { mesh: m, active: false };
        this.rings.push(r);
      }
      r.active = true; r.mesh.visible = true;
      r.mesh.position.copy(pos);
      r.mesh.quaternion.copy(this.camera.quaternion);
      r.mesh.rotateX(rand(-0.9, 0.9)); r.mesh.rotateY(rand(-0.9, 0.9));
      r.size = size; r.t = 0; r.dur = dur;
      r.mesh.material.color.copy(color || C(2.5, 1.6, 1.0));
      r.mesh.scale.setScalar(0.01);
    }

    sparks(pos, color, n = 10, speed = 40, dir) {
      const c0 = color === 'blue' ? COL.blueSpark : color === 'green' ? COL.greenSpark : color === 'red' ? COL.redSpark : COL.spark;
      const c1 = color === 'blue' ? COL.blueEnd : color === 'green' ? COL.greenEnd : color === 'red' ? COL.redEnd : COL.sparkEnd;
      for (let i = 0; i < n; i++) {
        randomUnit(_v).multiplyScalar(rand(0.3, 1) * speed);
        if (dir) _v.addScaledVector(dir, speed * 0.5);
        this.fire.emit(pos, _v, rand(0.2, 0.6), rand(0.4, 0.9), 0.1, c0, c1, 1, 1);
      }
      this.fire.emit(pos, _v.set(0, 0, 0), 0.15, 4, 7, c0, c1, 1, 0);
    }

    muzzle(pos, vel, red) {
      this.fire.emit(pos, vel, 0.07, 2.2, 3.5, red ? COL.redSpark : COL.greenSpark, COL.white, 1, 0);
    }

    engineTrail(pos, vel, strength = 1) {
      this.fire.emit(pos, vel, 0.25, 0.9 * strength, 0.2, COL.trail, COL.trailEnd, 0.6, 0);
    }

    damageSmoke(pos, vel, heavy) {
      this.smoke.emit(pos, vel, rand(0.8, 1.6), 1.2, heavy ? 6 : 4, COL.smoke, COL.smokeEnd, 0.45, 0.5);
      if (heavy && Math.random() < 0.5) this.fire.emit(pos, vel, 0.3, 1.4, 0.4, COL.fire, COL.fireEnd, 1, 0.5);
    }

    torpedoTrail(pos) {
      this.fire.emit(pos, _v.set(0, 0, 0), 0.35, 2.0, 0.4, COL.torp, COL.torpEnd, 0.9, 0);
      if (Math.random() < 0.5) this.smoke.emit(pos, randomUnit(_v).multiplyScalar(1.5), 1.2, 0.8, 3.5, COL.smoke, COL.smokeEnd, 0.3, 0.2);
    }

    addShake(a) { this.shake = Math.min(1.6, this.shake + a); }

    update(dt) {
      this.fire.update(dt);
      this.smoke.update(dt);
      for (const d of this.debris) {
        if (!d.active) continue;
        d.life -= dt;
        if (d.life <= 0) { d.active = false; d.mesh.visible = false; continue; }
        d.mesh.position.addScaledVector(d.vel, dt);
        d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.y += d.spin.y * dt; d.mesh.rotation.z += d.spin.z * dt;
        if (d.burn && d.life > 0.8 && Math.random() < 0.7) {
          this.fire.emit(d.mesh.position, _v.set(0, 0, 0), 0.35, 1.3, 0.3, COL.fire, COL.fireEnd, 0.9, 0);
          if (Math.random() < 0.3) this.smoke.emit(d.mesh.position, _v, 1.0, 0.8, 3, COL.smoke, COL.smokeEnd, 0.3, 0);
        }
      }
      for (const r of this.rings) {
        if (!r.active) continue;
        r.t += dt;
        const k = r.t / r.dur;
        if (k >= 1) { r.active = false; r.mesh.visible = false; continue; }
        r.mesh.scale.setScalar(0.1 + r.size * (1 - Math.pow(1 - k, 3)));
        r.mesh.material.opacity = (1 - k) * 0.9;
      }
      for (const l of this.lights) {
        if (l.t >= l.dur) { l.light.intensity = 0; continue; }
        l.t += dt;
        l.light.intensity = l.peak * Math.max(0, 1 - l.t / l.dur);
      }
      this.shake = Math.max(0, this.shake - dt * 1.8);
    }

    clear() {
      this.fire.clear(); this.smoke.clear();
      this.debris.forEach((d) => { d.active = false; d.mesh.visible = false; });
      this.rings.forEach((r) => { r.active = false; r.mesh.visible = false; });
      this.lights.forEach((l) => { l.t = l.dur; l.light.intensity = 0; });
      this.shake = 0;
    }
  }

  /* ---------------- hyperspace streaks (attached to the camera) ---------------- */
  class Hyperspace {
    constructor(camera) {
      const n = 450;
      const pos = new Float32Array(n * 6);
      this.base = [];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 4 + Math.pow(Math.random(), 0.6) * 60;
        const z = -rand(20, 900);
        this.base.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z });
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.mat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.7, 1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      this.lines = new THREE.LineSegments(geo, this.mat);
      this.lines.frustumCulled = false;
      this.lines.visible = false;
      camera.add(this.lines);
      this.t = 0; this.active = false; this.duration = 2.6;
    }
    start() { this.t = 0; this.active = true; this.lines.visible = true; }
    stop() { this.active = false; this.lines.visible = false; }
    // returns progress 0..1
    update(dt) {
      if (!this.active) return 1;
      this.t += dt;
      const k = Math.min(1, this.t / this.duration);
      // streak length: grows, then collapses at the end (dropping out of lightspeed)
      const stretch = k < 0.8 ? 40 + k * 300 : Math.max(0.5, 280 * (1 - (k - 0.8) / 0.2));
      const speed = k < 0.8 ? 2500 : 300;
      const p = this.lines.geometry.attributes.position;
      for (let i = 0; i < this.base.length; i++) {
        const b = this.base[i];
        b.z += speed * dt;
        if (b.z > -5) b.z -= 900;
        p.setXYZ(i * 2, b.x, b.y, b.z);
        p.setXYZ(i * 2 + 1, b.x, b.y, b.z - stretch);
      }
      p.needsUpdate = true;
      this.mat.opacity = k < 0.1 ? k / 0.1 : k > 0.9 ? (1 - k) / 0.1 : 1;
      if (k >= 1) this.stop();
      return k;
    }
  }

  SW.Effects = Effects;
  SW.Hyperspace = Hyperspace;
  SW.ParticleSystem = ParticleSystem;
})();
