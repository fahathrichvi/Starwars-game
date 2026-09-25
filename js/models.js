/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Procedural 3D ship models inspired by classic Star Wars designs.
   Convention: every model faces +Z (nose at +Z), +Y is up. */
(function () {
  let M = null;

  function hdr(r, g, b) { return new THREE.Color(r, g, b); }

  function mats() {
    if (M) return M;
    const T = SW.Tex;
    const lightPanels = T.panels('light', { base: [206, 204, 196], vary: 14, seed: 4, cells: 8 });
    const greyPanels = T.panels('grey', { base: [132, 138, 148], vary: 12, seed: 8, cells: 8 });
    const sdPanels = T.panels('sd', { base: [170, 174, 180], vary: 16, seed: 15, cells: 16, line: 0.45 });
    const sdBump = T.panels('sdbump', { base: [128, 128, 128], vary: 40, seed: 15, cells: 16, line: 0.8, bump: true });
    sdPanels.repeat.set(6, 6); sdBump.repeat.set(6, 6);
    M = {
      xwHull: new THREE.MeshStandardMaterial({ color: 0xe4e2da, map: lightPanels, roughness: 0.55, metalness: 0.3 }),
      xwDark: new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.5, metalness: 0.6 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x8a8d93, roughness: 0.35, metalness: 0.8 }),
      red: new THREE.MeshStandardMaterial({ color: 0xb02a1e, roughness: 0.6, metalness: 0.2 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x0b1320, roughness: 0.25, metalness: 0.9 }),
      astro: new THREE.MeshStandardMaterial({ color: 0x2f5fb8, roughness: 0.3, metalness: 0.6 }),
      astroWhite: new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4, metalness: 0.5 }),
      xwEngine: new THREE.MeshBasicMaterial({ color: hdr(1.15, 0.36, 0.26), toneMapped: false }),
      tieHull: new THREE.MeshStandardMaterial({ color: 0x9aa0aa, map: greyPanels, roughness: 0.5, metalness: 0.55 }),
      tiePanel: new THREE.MeshStandardMaterial({ color: 0xffffff, map: T.solar(), roughness: 0.35, metalness: 0.7 }),
      tieFrame: new THREE.MeshStandardMaterial({ color: 0x7c828c, roughness: 0.45, metalness: 0.7 }),
      tieGlass: new THREE.MeshStandardMaterial({ color: 0x0c1a12, roughness: 0.25, metalness: 0.9, emissive: 0x031208 }),
      tieEngine: new THREE.MeshBasicMaterial({ color: hdr(3.2, 0.7, 0.4), toneMapped: false }),
      sdHull: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, map: sdPanels, bumpMap: sdBump, bumpScale: 0.6, roughness: 0.62, metalness: 0.4, flatShading: true, side: THREE.DoubleSide }),
      sdDark: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.7, metalness: 0.5 }),
      sdMid: new THREE.MeshStandardMaterial({ color: 0x9da1a8, map: sdPanels, roughness: 0.6, metalness: 0.4, flatShading: true }),
      sdEngine: new THREE.MeshBasicMaterial({ color: hdr(1.6, 2.4, 4.5), toneMapped: false }),
      sdLight: new THREE.MeshBasicMaterial({ color: hdr(2.5, 2.2, 1.6), toneMapped: false }),
      shieldDome: new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.35, metalness: 0.7 }),
      hangar: new THREE.MeshBasicMaterial({ color: hdr(0.5, 0.7, 1.0), toneMapped: false }),
      rock: new THREE.MeshStandardMaterial({ color: 0x3a342f, roughness: 0.95, metalness: 0.05, flatShading: true }),
    };
    return M;
  }

  function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  }

  function glowSprite(color, scale) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: SW.Tex.glow(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false,
    }));
    s.scale.set(scale, scale, scale);
    return s;
  }

  /* ======================= X-WING (T-65 style) ======================= */
  function createXWing() {
    const m = mats();
    const g = new THREE.Group();
    const cannons = [], engines = [];

    // main fuselage
    g.add(mesh(new THREE.BoxGeometry(1.15, 1.0, 4.4), m.xwHull, 0, 0, -0.8));
    // long tapering nose
    const noseGeo = new THREE.CylinderGeometry(0.16, 0.74, 4.8, 4, 1);
    noseGeo.rotateY(Math.PI / 4); noseGeo.rotateX(Math.PI / 2);
    const nose = mesh(noseGeo, m.xwHull, 0, -0.05, 3.8);
    nose.scale.set(1, 0.85, 1);
    g.add(nose);
    // nose sensor tip
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.18, 0.3), m.xwDark, 0, -0.05, 6.25));
    // red squadron stripes on nose
    [-1, 1].forEach((s) => g.add(mesh(new THREE.BoxGeometry(0.03, 0.16, 2.6), m.red, s * 0.46, 0.0, 3.1)));
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.03, 1.2), m.red, 0, 0.36, 4.2));
    // cockpit canopy
    const canopy = mesh(new THREE.BoxGeometry(0.72, 0.42, 1.5), m.glass, 0, 0.62, 0.9);
    canopy.rotation.x = -0.14;
    canopy.userData.cockpitHide = true;
    g.add(canopy);
    const frame = mesh(new THREE.BoxGeometry(0.76, 0.06, 1.55), m.xwDark, 0, 0.84, 0.88);
    frame.rotation.x = -0.14; frame.userData.cockpitHide = true; g.add(frame);
    // astromech droid behind cockpit
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.35, 16), m.astroWhite, 0, 0.55, -0.4));
    g.add(mesh(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.astro, 0, 0.72, -0.4));
    // rear engine block
    g.add(mesh(new THREE.BoxGeometry(1.6, 1.3, 1.6), m.xwHull, 0, 0, -2.6));
    g.add(mesh(new THREE.BoxGeometry(1.2, 0.9, 0.3), m.xwDark, 0, 0, -3.45));

    // four S-foil wings in attack position
    const wings = [
      { a: 0.21, ey: 0.3 }, { a: -0.21, ey: -0.3 },
      { a: Math.PI - 0.21, ey: -0.3 }, { a: Math.PI + 0.21, ey: 0.3 },
    ];
    const wingGeo = new THREE.BoxGeometry(4.6, 0.08, 2.0);
    const p = wingGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { // taper toward the tip
      if (p.getX(i) > 0) p.setZ(i, p.getZ(i) * 0.55 - 0.35);
    }
    wingGeo.computeVertexNormals();
    wingGeo.translate(2.9, 0, 0);

    wings.forEach((w) => {
      const wg = new THREE.Group();
      wg.rotation.z = w.a;
      wg.position.z = -1.7;
      g.add(wg);
      wg.add(mesh(wingGeo, m.xwHull));
      wg.add(mesh(new THREE.BoxGeometry(1.0, 0.1, 1.1), m.red, 3.4, 0, -0.1));
      // engine nacelle
      const engGeo = new THREE.CylinderGeometry(0.42, 0.46, 3.0, 16);
      engGeo.rotateX(Math.PI / 2);
      wg.add(mesh(engGeo, m.xwHull, 1.35, w.ey, 0));
      const intakeGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.3, 16); intakeGeo.rotateX(Math.PI / 2);
      wg.add(mesh(intakeGeo, m.xwDark, 1.35, w.ey, 1.55));
      const exGeo = new THREE.CircleGeometry(0.33, 16); exGeo.rotateY(Math.PI);
      wg.add(mesh(exGeo, m.xwEngine, 1.35, w.ey, -1.52));
      const eng = new THREE.Object3D(); eng.position.set(1.35, w.ey, -1.7); wg.add(eng);
      engines.push(eng);
      // wingtip laser cannon
      const baseGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.6, 10); baseGeo.rotateX(Math.PI / 2);
      wg.add(mesh(baseGeo, m.xwDark, 5.15, 0, -0.1));
      const barrelGeo = new THREE.CylinderGeometry(0.065, 0.065, 4.4, 8); barrelGeo.rotateX(Math.PI / 2);
      wg.add(mesh(barrelGeo, m.metal, 5.15, 0, 2.6));
      const tipGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.4, 8); tipGeo.rotateX(Math.PI / 2);
      wg.add(mesh(tipGeo, m.xwDark, 5.15, 0, 4.7));
      const c = new THREE.Object3D(); c.position.set(5.15, 0, 5.0); wg.add(c);
      cannons.push(c);
    });

    engines.forEach((e) => {
      const s = glowSprite(hdr(0.75, 0.2, 0.13), 1.0);
      e.add(s); e.userData.glow = s;
    });

    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
    // order cannons so that 0&3 / 1&2 fire as crossed pairs
    return { group: g, cannons, engines, radius: 5.2 };
  }

  /* ======================= TIE cockpit ball ======================= */
  function tieBall(m, g) {
    g.add(mesh(new THREE.SphereGeometry(1.05, 28, 18), m.tieHull));
    // front viewport
    const winGeo = new THREE.CylinderGeometry(0.62, 0.66, 0.3, 24); winGeo.rotateX(Math.PI / 2);
    g.add(mesh(winGeo, m.tieGlass, 0, 0, 0.93));
    const ringGeo = new THREE.TorusGeometry(0.64, 0.07, 6, 28);
    g.add(mesh(ringGeo, m.tieFrame, 0, 0, 1.08));
    for (let i = 0; i < 8; i++) {
      const spoke = mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), m.tieFrame, 0, 0, 1.08);
      spoke.geometry.translate(0, 0.31, 0);
      spoke.rotation.z = (i * Math.PI) / 4;
      g.add(spoke);
    }
    g.add(mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 16), m.tieFrame, 0, 0, 1.09));
    // rear hatch
    const hatchGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.2, 16); hatchGeo.rotateX(Math.PI / 2);
    g.add(mesh(hatchGeo, m.tieFrame, 0, 0, -1.0));
    // chin guns
    [-0.3, 0.3].forEach((x) => {
      const gg = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8); gg.rotateX(Math.PI / 2);
      g.add(mesh(gg, m.xwDark, x, -0.6, 0.85));
    });
    // twin ion engine glow at rear
    const engines = [];
    [-0.25, 0.25].forEach((x) => {
      const e = new THREE.Object3D(); e.position.set(x, 0.05, -1.12); g.add(e);
      const s = glowSprite(hdr(3.0, 0.6, 0.3), 0.9);
      e.add(s); e.userData.glow = s;
      engines.push(e);
    });
    return engines;
  }

  function pylon(m, g, sx, len) {
    const pg = new THREE.CylinderGeometry(0.26, 0.42, len, 14);
    pg.rotateZ(Math.PI / 2);
    g.add(mesh(pg, m.tieHull, sx * (0.9 + len / 2 - 0.1), 0, 0));
    const cap = new THREE.CylinderGeometry(0.45, 0.45, 0.25, 16); cap.rotateZ(Math.PI / 2);
    g.add(mesh(cap, m.tieFrame, sx * (0.85 + len), 0, 0));
  }

  /* ======================= TIE FIGHTER ======================= */
  function createTIE() {
    const m = mats();
    const g = new THREE.Group();
    const engines = tieBall(m, g);
    [-1, 1].forEach((sx) => {
      pylon(m, g, sx, 1.4);
      // hexagonal solar wing, pointed top & bottom, in the YZ plane
      const w = new THREE.Group();
      const R = 2.5;
      const hexGeo = new THREE.CylinderGeometry(R, R, 0.1, 6);
      hexGeo.rotateX(Math.PI / 2);
      w.add(mesh(hexGeo, m.tiePanel));
      const ring = mesh(new THREE.TorusGeometry(R, 0.09, 4, 6), m.tieFrame);
      ring.rotation.z = Math.PI / 2;
      w.add(ring);
      for (let i = 0; i < 6; i++) {
        const sp = mesh(new THREE.BoxGeometry(0.12, R, 0.16), m.tieFrame);
        sp.geometry.translate(0, R / 2, 0);
        sp.rotation.z = (i * Math.PI) / 3;
        w.add(sp);
      }
      w.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 6).rotateX(Math.PI / 2), m.tieFrame));
      w.rotation.y = Math.PI / 2;
      w.scale.set(1, 1.12, 1);
      w.position.x = sx * 2.4;
      g.add(w);
    });
    const cannons = [new THREE.Object3D(), new THREE.Object3D()];
    cannons[0].position.set(-0.3, -0.6, 1.2); cannons[1].position.set(0.3, -0.6, 1.2);
    cannons.forEach((c) => g.add(c));
    return { group: g, cannons, engines, radius: 3.3 };
  }

  /* ======================= TIE INTERCEPTOR ======================= */
  function createInterceptor() {
    const m = mats();
    const g = new THREE.Group();
    const engines = tieBall(m, g);
    const cannons = [];
    // dagger-shaped wing outline (x = forward, y = up)
    const shape = new THREE.Shape();
    const P = [[2.3, 3.0], [0.55, 0.15], [0.55, -0.15], [2.3, -3.0], [-0.7, -2.2], [-1.1, 0], [-0.7, 2.2]];
    shape.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) shape.lineTo(P[i][0], P[i][1]);
    shape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
    wingGeo.translate(0, 0, -0.05);
    wingGeo.rotateY(-Math.PI / 2); // shape x -> +Z
    // map UVs roughly for the solar texture
    wingGeo.computeBoundingBox();
    [-1, 1].forEach((sx) => {
      pylon(m, g, sx, 1.1);
      const w = mesh(wingGeo, m.tiePanel, sx * 2.05, 0, 0);
      g.add(w);
      // frame edges
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(wingGeo), new THREE.LineBasicMaterial({ color: 0x8a909a }));
      edges.position.copy(w.position);
      g.add(edges);
      [1, -1].forEach((sy) => {
        const c = new THREE.Object3D(); c.position.set(sx * 2.05, sy * 2.85, 2.5); g.add(c); cannons.push(c);
        const bg = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6); bg.rotateX(Math.PI / 2);
        g.add(mesh(bg, m.xwDark, sx * 2.05, sy * 2.8, 2.0));
      });
    });
    return { group: g, cannons, engines, radius: 3.4 };
  }

  /* ======================= STAR DESTROYER (Imperial-class style) ======================= */
  const SD = { L: 440, W: 250, H: 46, BOT: 0.6 };

  function sdTop(x, z) { // height of upper hull surface at local (x,z)
    const t = (SD.L / 2 - z) / SD.L;
    return t * SD.H - Math.abs(x) * (2 * SD.H) / SD.W;
  }

  function createStarDestroyer() {
    const m = mats();
    const g = new THREE.Group();
    const { L, W, H, BOT } = SD;
    const N = [0, 0, L / 2], SL = [-W / 2, 0, -L / 2], SR = [W / 2, 0, -L / 2];
    const ST = [0, H, -L / 2], SB = [0, -H * BOT, -L / 2];
    const tris = [N, ST, SL, N, SR, ST, N, SL, SB, N, SB, SR, SL, ST, SB, SB, ST, SR];
    const pos = [], uv = [];
    tris.forEach((v) => { pos.push(v[0], v[1], v[2]); uv.push(v[0] / 60, v[2] / 60 + v[1] / 60); });
    const hullGeo = new THREE.BufferGeometry();
    hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hullGeo.computeVertexNormals();
    const hull = mesh(hullGeo, m.sdHull);
    g.add(hull);

    // medial trench band (dark stripe around the hull edge)
    const trenchGeo = new THREE.BufferGeometry();
    const tp = [];
    const e = 1.2; // slightly outside hull edge
    [[N, SL], [N, SR]].forEach(([a, b]) => {
      const ax = a[0], az = a[2], bx = b[0] * 1.004, bz = b[2];
      tp.push(ax, 1.5, az + e, bx, 1.5, bz, bx, -1.5, bz, ax, 1.5, az + e, bx, -1.5, bz, ax, -1.5, az + e);
    });
    trenchGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    trenchGeo.computeVertexNormals();
    g.add(mesh(trenchGeo, new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.8, side: THREE.DoubleSide })));

    // superstructure terraces
    const boxes = []; // collision boxes (local)
    function block(w, h, d, x, y, z, mat = m.sdMid) {
      const b = mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
      g.add(b);
      boxes.push({ c: new THREE.Vector3(x, y, z), h: new THREE.Vector3(w / 2, h / 2, d / 2) });
      return b;
    }
    block(90, 28, 150, 0, 30, -L / 2 + 78);
    block(64, 14, 110, 0, 50, -L / 2 + 58);
    block(40, 10, 70, 0, 61, -L / 2 + 40);
    // command tower
    block(20, 28, 24, 0, 78, -L / 2 + 32);
    const bridge = block(76, 9, 17, 0, 96, -L / 2 + 32);
    // bridge viewports
    for (let i = -6; i <= 6; i++) g.add(mesh(new THREE.BoxGeometry(3.2, 1.2, 0.3), m.sdLight, i * 5, 96, -L / 2 + 40.7));
    // side stepped blocks
    [-1, 1].forEach((s) => {
      block(26, 16, 60, s * 52, 20, -L / 2 + 40);
      block(18, 10, 40, s * 44, 34, -L / 2 + 30);
    });

    // shield generator domes (objectives) sit on top of the bridge
    const domePos = [new THREE.Vector3(-24, 106, -L / 2 + 30), new THREE.Vector3(24, 106, -L / 2 + 30)];
    const domes = domePos.map((p) => {
      const d = new THREE.Group();
      d.position.copy(p);
      d.add(mesh(new THREE.SphereGeometry(7.5, 24, 16), m.shieldDome));
      d.add(mesh(new THREE.CylinderGeometry(2.5, 3.5, 5, 12), m.sdDark, 0, -6, 0));
      g.add(d);
      return d;
    });

    // engines
    const engineDefs = [[0, 16, 13], [-36, 12, 12], [36, 12, 12], [-62, 6, 5.5], [62, 6, 5.5], [-18, -4, 5], [18, -4, 5]];
    const engineGlows = [];
    engineDefs.forEach(([x, y, r]) => {
      const cg = new THREE.CylinderGeometry(r * 1.12, r * 1.2, 14, 24); cg.rotateX(Math.PI / 2);
      g.add(mesh(cg, m.sdDark, x, y, -L / 2 - 5));
      const dg = new THREE.CircleGeometry(r, 24); dg.rotateY(Math.PI);
      g.add(mesh(dg, m.sdEngine, x, y, -L / 2 - 12.1));
      const s = glowSprite(hdr(1.2, 1.8, 3.5), r * 4.2);
      s.position.set(x, y, -L / 2 - 16);
      g.add(s);
      engineGlows.push(s);
    });

    // hangar bay glow on the underside
    const hg = new THREE.PlaneGeometry(34, 60); hg.rotateX(Math.PI / 2);
    const hangar = mesh(hg, m.hangar, 0, -H * BOT * 0.55 - 0.5, -40);
    g.add(hangar);

    // greebles on upper hull (instanced)
    const rnd = SW.Tex.mulberry(99);
    const greebleGeo = new THREE.BoxGeometry(1, 1, 1);
    const count = 260;
    const inst = new THREE.InstancedMesh(greebleGeo, m.sdMid, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const t = 0.1 + rnd() * 0.88;
      const z = L / 2 - t * L;
      const hw = t * W / 2;
      const x = (rnd() * 2 - 1) * hw * 0.9;
      const y = sdTop(x, z);
      const sx = 2 + rnd() * 9, sy = 1 + rnd() * 4, sz = 2 + rnd() * 14;
      dummy.position.set(x, y + sy * 0.3, z);
      dummy.scale.set(sx, sy, sz);
      dummy.rotation.set(0, 0, x > 0 ? -0.35 : 0.35);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    g.add(inst);
    // running lights along the edges
    const lightInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), m.sdLight, 120);
    for (let i = 0; i < 120; i++) {
      const t = 0.05 + rnd() * 0.95;
      const side = rnd() < 0.5 ? -1 : 1;
      const z = L / 2 - t * L;
      const x = side * t * W / 2 * (0.9 + rnd() * 0.1);
      const y = rnd() < 0.5 ? sdTop(x, z) + 0.4 : -0.5;
      dummy.position.set(x, y, z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      lightInst.setMatrixAt(i, dummy.matrix);
    }
    g.add(lightInst);

    // turret mount positions on the top surfaces
    const turretSpots = [];
    const tDefs = [[0.3, 0.45], [0.3, -0.45], [0.45, 0.6], [0.45, -0.6], [0.55, 0.3], [0.55, -0.3], [0.68, 0.72], [0.68, -0.72], [0.8, 0.5], [0.8, -0.5], [0.4, 0.05]];
    tDefs.forEach(([t, xf]) => {
      const z = L / 2 - t * L;
      const x = xf * t * W / 2;
      turretSpots.push(new THREE.Vector3(x, sdTop(x, z), z));
    });

    return {
      group: g, boxes, domes, domePos, bridge, bridgePos: new THREE.Vector3(0, 96, -L / 2 + 32),
      engineGlows, turretSpots, hangarPos: new THREE.Vector3(0, -H * BOT * 0.6 - 12, -40), dims: SD,
    };
  }

  function createTurret() {
    const m = mats();
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(2.6, 3.2, 2.2, 12), m.sdDark, 0, 0.6, 0));
    const head = new THREE.Group();
    head.position.y = 2.6;
    head.add(mesh(new THREE.BoxGeometry(4, 2.4, 4.4), m.sdMid));
    [-0.9, 0.9].forEach((x) => {
      const bg = new THREE.CylinderGeometry(0.28, 0.28, 5, 8); bg.rotateX(Math.PI / 2);
      head.add(mesh(bg, m.sdDark, x, 0.2, 3.6));
    });
    g.add(head);
    return { group: g, head };
  }

  /* ======================= ASTEROID ======================= */
  function createAsteroid(seed) {
    const m = mats();
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const { fbm } = SW.Tex.makeNoise(seed);
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    const sx = 0.7 + (seed % 7) * 0.08, sy = 0.6 + (seed % 5) * 0.1;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const n = fbm(v.x * 2 + 5 + seed, v.y * 2 + v.z * 1.7 + 5, 4);
      v.multiplyScalar(0.72 + n * 0.55);
      p.setXYZ(i, v.x * sx, v.y * sy, v.z);
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, m.rock);
  }

  SW.Models = { createXWing, createTIE, createInterceptor, createStarDestroyer, createTurret, createAsteroid, glowSprite, mats, SD, sdTop };
})();
