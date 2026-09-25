/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Space environment: per-location sky, suns, planets, fog, battle station backdrop, asteroid fields, space dust */
(function () {
  const { rand } = SW.util;

  const fresnelVS = `
    varying vec3 vN; varying vec3 vV;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  const fresnelFS = `
    uniform vec3 color; uniform float power; uniform float strength; uniform float opacity;
    varying vec3 vN; varying vec3 vV;
    void main(){
      float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), power) * strength;
      gl_FragColor = vec4(color * f, f * opacity);
    }`;

  function fresnelMaterial(color, power, strength, side = THREE.FrontSide) {
    return new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, strength: { value: strength }, opacity: { value: 1 } },
      vertexShader: fresnelVS, fragmentShader: fresnelFS,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side,
    });
  }

  const ATMO = { ocean: 0x7fbfff, forest: 0x9fd0ff, ice: 0xbfe6ff, desert: 0xffc98a, lava: 0xff6a30, toxic: 0xc8ff70, dead: 0xaa9988, city: 0x88aaff, gas: 0xffc890 };

  class World {
    constructor(scene) {
      this.scene = scene;
      this.skyGroup = new THREE.Group(); // follows the camera
      scene.add(this.skyGroup);
      this.sunDir = new THREE.Vector3(-0.35, 0.42, -0.84).normalize();
      this.sun2Dir = new THREE.Vector3(0, 1, 0);
      this.asteroids = [];
      this.asteroidGroup = new THREE.Group();
      scene.add(this.asteroidGroup);
      this.fogged = false;
      this.visible = true;

      this.buildSky();
      this.buildLights();
      this.buildBattleStation();
      this.buildAsteroidAssets();
      this.buildDust();
      this.setEnvironment(SW.ENVS.kessra);
    }

    buildSky() {
      this.sky = new THREE.Mesh(
        new THREE.SphereGeometry(30000, 64, 32),
        new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, toneMapped: false, color: 0x9a9aa8, fog: false })
      );
      this.sky.renderOrder = -10;
      this.skyGroup.add(this.sky);

      this.starGroup = new THREE.Group();
      this.skyGroup.add(this.starGroup);
      const makeStars = (n, size, radius) => {
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        const v = new THREE.Vector3(), c = new THREE.Color();
        for (let i = 0; i < n; i++) {
          SW.util.randomUnit(v).multiplyScalar(radius);
          pos.set([v.x, v.y, v.z], i * 3);
          const tint = Math.random();
          if (tint < 0.15) c.setRGB(1.0, 0.8, 0.6);
          else if (tint < 0.3) c.setRGB(0.7, 0.8, 1.0);
          else c.setRGB(1, 1, 1);
          c.multiplyScalar(0.5 + Math.random() * 1.2);
          col.set([c.r, c.g, c.b], i * 3);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mat = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, map: SW.Tex.glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
        const pts = new THREE.Points(geo, mat);
        pts.renderOrder = -9;
        this.starGroup.add(pts);
      };
      makeStars(6000, 2.2, 28000);
      makeStars(900, 4.0, 28000);
      makeStars(120, 7.0, 28000);

      const mkSun = (size, color) => {
        const s = SW.Models.glowSprite(color, size);
        s.material.fog = false;
        s.renderOrder = -8;
        this.skyGroup.add(s);
        return s;
      };
      this.sunHalo = mkSun(6000, new THREE.Color(1.0, 0.7, 0.45));
      this.sunCore = mkSun(1400, new THREE.Color(6, 5.2, 4));
      this.sun2Halo = mkSun(4000, new THREE.Color(1.0, 0.6, 0.3));
      this.sun2Core = mkSun(1000, new THREE.Color(5, 3.5, 2));
    }

    buildLights() {
      this.sunLight = new THREE.DirectionalLight(0xfff1dc, 2.4);
      this.scene.add(this.sunLight, this.sunLight.target);
      this.sun2Light = new THREE.DirectionalLight(0xffb070, 0);
      this.scene.add(this.sun2Light, this.sun2Light.target);
      this.hemi = new THREE.HemisphereLight(0x39507a, 0x1a0f0a, 0.45);
      this.scene.add(this.hemi);
      this.scene.add(new THREE.AmbientLight(0x404656, 0.25));
    }

    buildBattleStation() {
      const g = new THREE.Group();
      g.position.set(7500, 4200, 21000);
      const R = 1500;
      const ds = new THREE.Mesh(
        new THREE.SphereGeometry(R, 96, 64),
        new THREE.MeshStandardMaterial({ map: SW.Tex.battleStation(true), roughness: 0.85, metalness: 0.2 })
      );
      ds.rotation.y = 2.3;
      ds.rotation.x = 0.15;
      g.add(ds);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.01, 48, 32), fresnelMaterial(0x6688aa, 4.0, 0.4)));
      this.station = g;
      this.scene.add(g);
    }

    /* ------------------------ location ------------------------ */
    setEnvironment(env) {
      if (!env || this.envKey === env.key) return;
      this.envKey = env.key;
      this.env = env;
      const sky = env.sky || {};
      this.sky.material.map = SW.Tex.nebulaSky(sky);
      this.sky.material.color.set(sky.tint || 0x9a9aa8);
      this.sky.material.needsUpdate = true;

      // primary sun
      const sun = env.sun || {};
      this.sunDir.set(...(sun.dir || [-0.35, 0.42, -0.84])).normalize();
      this.sunLight.color.set(sun.color || 0xfff1dc);
      this.sunLight.intensity = sun.intensity !== undefined ? sun.intensity : 2.4;
      this.sunLight.position.copy(this.sunDir).multiplyScalar(1000);
      const sp = this.sunDir.clone().multiplyScalar(26000);
      this.sunCore.position.copy(sp); this.sunHalo.position.copy(sp);
      this.sunCore.material.color.setRGB(...(sun.glow || [6, 5.2, 4]));
      this.sunHalo.material.color.setRGB(...(sun.halo || [1.0, 0.7, 0.45]));
      const ss = sun.size || 1;
      this.sunCore.scale.setScalar(1400 * ss); this.sunHalo.scale.setScalar(6000 * ss);
      // second sun (binary systems)
      const s2 = env.sun2;
      this.sun2Core.visible = this.sun2Halo.visible = !!s2;
      this.sun2Light.intensity = s2 ? (s2.intensity || 1.2) : 0;
      if (s2) {
        this.sun2Dir.set(...s2.dir).normalize();
        this.sun2Light.color.set(s2.color || 0xffb070);
        this.sun2Light.position.copy(this.sun2Dir).multiplyScalar(1000);
        const p2 = this.sun2Dir.clone().multiplyScalar(26000);
        this.sun2Core.position.copy(p2); this.sun2Halo.position.copy(p2);
        this.sun2Core.material.color.setRGB(...(s2.glow || [5, 3.5, 2]));
      }
      const hemi = env.hemi || [0x39507a, 0x1a0f0a];
      this.hemi.color.set(hemi[0]); this.hemi.groundColor.set(hemi[1]);

      // fog (nebula missions)
      if (env.fog) {
        this.scene.fog = new THREE.FogExp2(env.fog.color, env.fog.density);
        this.scene.background = new THREE.Color(env.fog.color);
        this.fogged = true;
      } else {
        this.scene.fog = null;
        this.scene.background = new THREE.Color(0x000000);
        this.fogged = false;
      }
      this.sky.visible = !this.fogged;
      this.starGroup.visible = !this.fogged;

      this.buildPlanet(env.planet, env.moon);
      this.dust.material.color.set(env.dust || 0x9aa8c0);
      this.setAsteroids(env.asteroids || { mode: 'ring', count: 70, mat: 'rock' });
      this.setVisible(this.visible);
    }

    buildPlanet(p, moon) {
      if (this.planet) {
        this.scene.remove(this.planet);
        this.planet.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        this.planet = null;
      }
      const g = new THREE.Group();
      this.planet = g;
      this.planetBody = null;
      this.planetClouds = null;
      this.scene.add(g);
      if (p) this.addBody(g, p, true);
      if (moon) this.addBody(g, moon, false);
    }

    addBody(g, p, primary) {
      const body = new THREE.Group();
      body.position.set(...p.pos);
      g.add(body);
      const R = p.R;
      let mat;
      if (p.type === 'gas') {
        mat = new THREE.MeshStandardMaterial({ map: SW.Tex.gasGiant(p.palette, p.seed), color: 0xc4c4c4, roughness: 1, metalness: 0 });
      } else {
        const t = SW.Tex.planet(p.type, p.seed);
        mat = new THREE.MeshStandardMaterial({
          map: t.map, color: 0xbdbdbd, roughness: p.type === 'ocean' ? 0.85 : 0.95, metalness: 0,
          emissiveMap: t.emissive || null, emissive: t.emissive ? 0xffffff : 0x000000,
          emissiveIntensity: p.type === 'lava' ? 0.9 : 0.5,
        });
      }
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), mat);
      sphere.rotation.z = p.tilt !== undefined ? p.tilt : 0.35;
      body.add(sphere);
      if (primary) this.planetBody = sphere;
      body.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 64, 48), fresnelMaterial(p.atmo || ATMO[p.type] || 0xffc890, 3.0, p.atmoStrength || 1.4)));
      if (p.clouds) {
        const cl = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 96, 64), new THREE.MeshStandardMaterial({
          map: SW.Tex.clouds(p.seed), color: 0xd8d8d8, opacity: 0.8, transparent: true, depthWrite: false, roughness: 1, metalness: 0,
        }));
        cl.rotation.z = sphere.rotation.z;
        body.add(cl);
        if (primary) this.planetClouds = cl;
      }
      if (p.ring) {
        const ringGeo = new THREE.RingGeometry(R * 1.35, R * 2.3, 128, 1);
        const pa = ringGeo.attributes.position, uv = ringGeo.attributes.uv;
        for (let i = 0; i < pa.count; i++) {
          const r = Math.hypot(pa.getX(i), pa.getY(i));
          uv.setXY(i, (r - R * 1.35) / (R * 0.95), 0.5);
        }
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
          map: SW.Tex.ring(), color: p.ringTint || 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1, metalness: 0,
        }));
        ring.rotation.x = Math.PI / 2 - 0.25;
        ring.rotation.y = 0.35;
        body.add(ring);
      }
    }

    /* ------------------------ asteroids ------------------------ */
    buildAsteroidAssets() {
      this.asteroidGeos = [];
      for (let i = 0; i < 10; i++) this.asteroidGeos.push(SW.Models.createAsteroid(i * 17 + 3).geometry);
      const base = SW.Models.mats().rock;
      this.rockMats = {
        rock: base,
        ice: new THREE.MeshStandardMaterial({ color: 0x6d8aa0, roughness: 0.65, metalness: 0.05, flatShading: true }),
        dark: new THREE.MeshStandardMaterial({ color: 0x2c2724, roughness: 0.9, metalness: 0.1, flatShading: true }),
        red: new THREE.MeshStandardMaterial({ color: 0x5a3326, roughness: 0.9, metalness: 0.05, flatShading: true }),
      };
    }

    clearAsteroids() {
      this.asteroidGroup.clear();
      this.asteroids = [];
    }

    addAsteroid(pos, size, opts = {}) {
      const a = new THREE.Mesh(SW.util.pick(this.asteroidGeos), this.rockMats[opts.mat || this.asteroidMat || 'rock']);
      a.position.copy(pos);
      a.scale.setScalar(size);
      a.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      const spin = opts.spin !== undefined ? opts.spin : (size > 40 ? 0.08 : 0.5);
      a.userData = {
        spin: new THREE.Vector3(rand(-spin, spin), rand(-spin, spin), rand(-spin, spin)),
        radius: size * 0.95,
        vel: opts.vel ? opts.vel.clone() : null,
        hp: size < 16 ? 20 + size * 2 : undefined,
        life: opts.life,
      };
      this.asteroidGroup.add(a);
      this.asteroids.push(a);
      return a;
    }

    removeAsteroid(a) {
      this.asteroidGroup.remove(a);
      const i = this.asteroids.indexOf(a);
      if (i >= 0) this.asteroids.splice(i, 1);
    }

    // cfg: { mode: 'ring' | 'field' | 'none', count, mat, box: {x, y, z0, z1}, clear: [{pos, r}] }
    setAsteroids(cfg) {
      this.clearAsteroids();
      this.asteroidMat = cfg.mat || 'rock';
      const v = new THREE.Vector3();
      if (cfg.mode === 'ring') {
        for (let i = 0; i < (cfg.count || 70); i++) {
          const ang = rand(0, Math.PI * 2);
          const r = rand(1300, 2900);
          const s = Math.random() < 0.15 ? rand(40, 90) : rand(6, 30);
          this.addAsteroid(v.set(Math.cos(ang) * r, rand(-500, 500), Math.sin(ang) * r), s);
        }
      } else if (cfg.mode === 'field') {
        const b = cfg.box;
        let placed = 0, guard = 0;
        while (placed < cfg.count && guard++ < cfg.count * 5) {
          v.set(rand(-b.x, b.x), rand(-b.y, b.y), rand(b.z0, b.z1));
          const roll = Math.random();
          const s = roll < 0.06 ? rand(60, 140) : roll < 0.3 ? rand(20, 45) : rand(5, 18);
          if ((cfg.clear || []).some((c) => v.distanceTo(c.pos) < c.r + s)) continue;
          const drift = Math.random() < 0.35 ? new THREE.Vector3(rand(-12, 12), rand(-8, 8), rand(-12, 12)) : null;
          this.addAsteroid(v, s, { vel: drift });
          placed++;
        }
      }
    }

    // lasers can chip away small rocks; returns true if destroyed
    damageAsteroid(a, dmg, fx) {
      const u = a.userData;
      if (u.hp === undefined) return false;
      u.hp -= dmg;
      if (u.hp > 0) return false;
      const s = a.scale.x;
      fx.rockBurst(a.position, s);
      this.removeAsteroid(a);
      return true;
    }

    buildDust() {
      const n = 900;
      const pos = new Float32Array(n * 3);
      this.dustRange = 120;
      for (let i = 0; i < n * 3; i++) pos[i] = rand(-this.dustRange, this.dustRange);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: 0x9aa8c0, size: 0.35, transparent: true, opacity: 0.55, map: SW.Tex.glow(), depthWrite: false, blending: THREE.AdditiveBlending });
      this.dust = new THREE.Points(geo, mat);
      this.dust.frustumCulled = false;
      this.scene.add(this.dust);
    }

    setVisible(v) {
      this.visible = v;
      this.skyGroup.visible = v;
      if (this.planet) this.planet.visible = v;
      this.station.visible = v && !!(this.env && this.env.station);
      this.dust.visible = v;
      this.asteroidGroup.visible = v;
    }

    update(dt, camera) {
      this.skyGroup.position.copy(camera.position);
      for (const a of this.asteroids) {
        const u = a.userData;
        a.rotation.x += u.spin.x * dt; a.rotation.y += u.spin.y * dt; a.rotation.z += u.spin.z * dt;
        if (u.vel) a.position.addScaledVector(u.vel, dt);
      }
      if (this.planetBody) this.planetBody.rotation.y += dt * 0.004;
      if (this.planetClouds) this.planetClouds.rotation.y += dt * 0.006;
      const p = this.dust.geometry.attributes.position;
      const R = this.dustRange, c = camera.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (x - c.x > R) x -= 2 * R; else if (x - c.x < -R) x += 2 * R;
        if (y - c.y > R) y -= 2 * R; else if (y - c.y < -R) y += 2 * R;
        if (z - c.z > R) z -= 2 * R; else if (z - c.z < -R) z += 2 * R;
        p.setXYZ(i, x, y, z);
      }
      p.needsUpdate = true;
    }
  }

  SW.World = World;
  SW.fresnelMaterial = fresnelMaterial;
})();
