/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Space environment: nebula sky, stars, sun, gas giant, battle station, asteroid field, space dust */
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

  class World {
    constructor(scene) {
      this.scene = scene;
      this.skyGroup = new THREE.Group(); // follows the camera
      scene.add(this.skyGroup);
      this.sunDir = new THREE.Vector3(-0.35, 0.42, -0.84).normalize();
      this.asteroids = [];

      this.buildSky();
      this.buildLights();
      this.buildPlanet();
      this.buildBattleStation();
      this.buildAsteroids();
      this.buildDust();
    }

    buildSky() {
      const skyTex = SW.Tex.nebulaSky();
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(30000, 64, 32),
        new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, toneMapped: false, color: 0x9a9aa8 })
      );
      sky.renderOrder = -10;
      this.skyGroup.add(sky);

      // bright individual stars with varied size and color
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
        const mat = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, map: SW.Tex.glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
        const pts = new THREE.Points(geo, mat);
        pts.renderOrder = -9;
        this.skyGroup.add(pts);
      };
      makeStars(6000, 2.2, 28000);
      makeStars(900, 4.0, 28000);
      makeStars(120, 7.0, 28000);

      // sun
      const sunPos = this.sunDir.clone().multiplyScalar(26000);
      const sunCore = SW.Models.glowSprite(new THREE.Color(6, 5.2, 4), 1400);
      sunCore.position.copy(sunPos);
      const sunHalo = SW.Models.glowSprite(new THREE.Color(1.0, 0.7, 0.45), 6000);
      sunHalo.position.copy(sunPos);
      sunCore.renderOrder = sunHalo.renderOrder = -8;
      this.skyGroup.add(sunHalo, sunCore);
    }

    buildLights() {
      const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
      sun.position.copy(this.sunDir).multiplyScalar(1000);
      this.scene.add(sun);
      this.scene.add(sun.target);
      this.sunLight = sun;
      this.scene.add(new THREE.HemisphereLight(0x39507a, 0x1a0f0a, 0.45));
      this.scene.add(new THREE.AmbientLight(0x404656, 0.25));
    }

    buildPlanet() {
      const g = new THREE.Group();
      g.position.set(-12000, -5000, 22000);
      const R = 4300;
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(R, 96, 64),
        new THREE.MeshStandardMaterial({ map: SW.Tex.gasGiant(), roughness: 1, metalness: 0 })
      );
      planet.rotation.z = 0.35;
      g.add(planet);
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 64, 48), fresnelMaterial(0xffc890, 3.0, 1.4));
      g.add(atmo);
      // rings
      const ringGeo = new THREE.RingGeometry(R * 1.35, R * 2.3, 128, 1);
      const p = ringGeo.attributes.position, uv = ringGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const r = Math.hypot(p.getX(i), p.getY(i));
        uv.setXY(i, (r - R * 1.35) / (R * 0.95), 0.5);
      }
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
        map: SW.Tex.ring(), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1, metalness: 0,
      }));
      ring.rotation.x = Math.PI / 2 - 0.25;
      ring.rotation.y = 0.35;
      g.add(ring);
      this.planet = g;
      this.scene.add(g);
    }

    buildBattleStation() {
      const g = new THREE.Group();
      g.position.set(7500, 4200, 21000);
      const R = 1500;
      const ds = new THREE.Mesh(
        new THREE.SphereGeometry(R, 96, 64),
        new THREE.MeshStandardMaterial({ map: SW.Tex.battleStation(), roughness: 0.85, metalness: 0.2 })
      );
      ds.rotation.y = 2.3;
      ds.rotation.x = 0.15;
      g.add(ds);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.01, 48, 32), fresnelMaterial(0x6688aa, 4.0, 0.4)));
      this.station = g;
      this.scene.add(g);
    }

    buildAsteroids() {
      const group = new THREE.Group();
      for (let i = 0; i < 70; i++) {
        const a = SW.Models.createAsteroid(i * 17 + 3);
        // ring-shaped field around the arena, thicker on one side
        const ang = rand(0, Math.PI * 2);
        const r = rand(1300, 2900);
        const s = Math.random() < 0.15 ? rand(40, 90) : rand(6, 30);
        a.position.set(Math.cos(ang) * r, rand(-500, 500), Math.sin(ang) * r);
        a.scale.setScalar(s);
        a.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
        a.userData.spin = new THREE.Vector3(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(-0.2, 0.2));
        a.userData.radius = s * 0.95;
        group.add(a);
        this.asteroids.push(a);
      }
      this.scene.add(group);
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

    update(dt, camera) {
      this.skyGroup.position.copy(camera.position);
      this.asteroids.forEach((a) => {
        const s = a.userData.spin;
        a.rotation.x += s.x * dt; a.rotation.y += s.y * dt; a.rotation.z += s.z * dt;
      });
      this.planet.children[0].rotation.y += dt * 0.004;
      // wrap dust around the camera so it never runs out
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
