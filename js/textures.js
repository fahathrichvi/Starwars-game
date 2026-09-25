/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Procedurally generated canvas textures: hull panels, nebula sky, planets, particles */
(function () {
  // ---- seeded random + value noise ----
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(seed) {
    const rnd = mulberry(seed);
    const perm = new Uint8Array(512);
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rnd(); }
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const fade = (t) => t * t * (3 - 2 * t);
    // periodic in x with period px (for seamless equirect wrap)
    function noise2(x, y, px) {
      let xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const x0 = px ? ((xi % px) + px) % px : xi & 255;
      const x1 = px ? (x0 + 1) % px : (x0 + 1) & 255;
      const y0 = yi & 255, y1 = (yi + 1) & 255;
      const a = vals[perm[(x0 & 255) + perm[y0]]], b = vals[perm[(x1 & 255) + perm[y0]]];
      const c = vals[perm[(x0 & 255) + perm[y1]]], d = vals[perm[(x1 & 255) + perm[y1]]];
      const u = fade(xf), v = fade(yf);
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }
    function fbm(x, y, oct, px) {
      let s = 0, amp = 0.5, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) {
        s += amp * noise2(x * f, y * f, px ? px * f : 0);
        norm += amp; amp *= 0.5; f *= 2;
      }
      return s / norm;
    }
    return { noise2, fbm };
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function tex(c, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  const T = {};
  const cache = {};

  T.glow = function () {
    if (cache.glow) return cache.glow;
    const c = canvas(128, 128), g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.25)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return (cache.glow = tex(c, false));
  };

  T.smoke = function () {
    if (cache.smoke) return cache.smoke;
    const c = canvas(128, 128), g = c.getContext('2d');
    const rnd = mulberry(7);
    for (let i = 0; i < 26; i++) {
      const x = 64 + (rnd() - 0.5) * 50, y = 64 + (rnd() - 0.5) * 50, r = 18 + rnd() * 26;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.22)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    }
    // soften edges
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, 128, 128);
    return (cache.smoke = tex(c, false));
  };

  // Hull plating with panel lines and greebles
  T.panels = function (key, opts) {
    if (cache['p' + key]) return cache['p' + key];
    const o = Object.assign({ size: 512, base: [200, 200, 196], vary: 18, line: 0.35, seed: 1, cells: 10, dark: false, bump: false }, opts);
    const c = canvas(o.size, o.size), g = c.getContext('2d');
    const rnd = mulberry(o.seed);
    const [br, bg, bb] = o.base;
    g.fillStyle = `rgb(${br},${bg},${bb})`; g.fillRect(0, 0, o.size, o.size);
    const cell = o.size / o.cells;
    // recursive panel subdivision
    function panel(x, y, w, h, depth) {
      if (depth > 0 && (w > cell * 0.6 || h > cell * 0.6) && rnd() < 0.8) {
        if (w > h) { const s = w * (0.3 + rnd() * 0.4); panel(x, y, s, h, depth - 1); panel(x + s, y, w - s, h, depth - 1); }
        else { const s = h * (0.3 + rnd() * 0.4); panel(x, y, w, s, depth - 1); panel(x, y + s, w, h - s, depth - 1); }
        return;
      }
      const v = (rnd() - 0.5) * o.vary * 2;
      g.fillStyle = `rgb(${br + v | 0},${bg + v | 0},${bb + v * 1.1 | 0})`;
      g.fillRect(x, y, w, h);
      g.strokeStyle = `rgba(0,0,0,${o.line})`;
      g.lineWidth = 1.2;
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      if (rnd() < 0.25) { // greeble
        g.fillStyle = `rgba(0,0,0,${0.12 + rnd() * 0.2})`;
        g.fillRect(x + w * 0.2, y + h * 0.2, w * 0.3 * rnd() + 2, h * 0.3 * rnd() + 2);
      }
      if (rnd() < 0.15) { // light scratch / wear
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + 2, y + 2, w - 4, 2);
      }
    }
    for (let y = 0; y < o.size; y += cell * 2) for (let x = 0; x < o.size; x += cell * 2) panel(x, y, cell * 2, cell * 2, 5);
    // grime
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(${o.dark ? 255 : 0},${o.dark ? 255 : 0},${o.dark ? 255 : 0},${rnd() * 0.04})`;
      const r = 4 + rnd() * 30;
      g.beginPath(); g.arc(rnd() * o.size, rnd() * o.size, r, 0, Math.PI * 2); g.fill();
    }
    const t = tex(c, !o.bump);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (cache['p' + key] = t);
  };

  // TIE solar panels: dark with a fine grid
  T.solar = function () {
    if (cache.solar) return cache.solar;
    const s = 512, c = canvas(s, s), g = c.getContext('2d');
    g.fillStyle = '#16191e'; g.fillRect(0, 0, s, s);
    const rnd = mulberry(3);
    const n = 16;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 18 + rnd() * 10;
      g.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
      g.fillRect(x * s / n + 1, y * s / n + 1, s / n - 2, s / n - 2);
    }
    g.strokeStyle = 'rgba(90,100,115,0.5)'; g.lineWidth = 2;
    for (let i = 0; i <= n; i += 4) {
      g.beginPath(); g.moveTo(i * s / n, 0); g.lineTo(i * s / n, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * s / n); g.lineTo(s, i * s / n); g.stroke();
    }
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (cache.solar = t);
  };

  // Equirectangular nebula / milky-way background, tinted per location
  T.nebulaSky = function (o = {}) {
    const key = 'sky' + JSON.stringify(o);
    if (cache[key]) return cache[key];
    const seed = o.seed || 11;
    const c1 = o.c1 || [170, 40, 120], c2 = o.c2 || [60, 40, 190], dustC = o.dust || [150, 140, 170];
    const bandK = o.band !== undefined ? o.band : 1, nebK = o.neb !== undefined ? o.neb : 1;
    const W = 2048, H = 1024;
    const c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#000003'; g.fillRect(0, 0, W, H);
    const { fbm } = makeNoise(seed);
    const lw = 512, lh = 256;
    const lc = canvas(lw, lh), lg = lc.getContext('2d');
    const img = lg.createImageData(lw, lh);
    const tilt = ((seed * 37) % 100) / 100 * 0.2 + 0.08;
    for (let y = 0; y < lh; y++) {
      for (let x = 0; x < lw; x++) {
        const u = x / lw, v = y / lh;
        const bandY = 0.5 + Math.sin(u * Math.PI * 2 + seed) * tilt;
        const band = Math.exp(-Math.pow((v - bandY) / 0.09, 2)) * bandK;
        const n1 = fbm(u * 8, v * 4, 6, 8);
        const n2 = fbm(u * 4 + 10, v * 2 + 5, 5, 4);
        const n3 = fbm(u * 16 + 3, v * 8, 4, 16);
        let r = 0, gr = 0, b = 0;
        const dust = band * Math.pow(n1, 1.6) * 1.4;
        r += dust * dustC[0]; gr += dust * dustC[1]; b += dust * dustC[2];
        const lane = band * Math.max(0, n3 - 0.5) * 2;
        r -= lane * 90; gr -= lane * 90; b -= lane * 90;
        const neb = Math.pow(Math.max(0, n2 - 0.45) * 2.2, 2.2) * nebK;
        let hue = fbm(u * 3 + 40, v * 3, 3, 3);
        hue = Math.min(1, Math.max(0, (hue - 0.4) * 5));
        const k = neb * n1 * 1.6;
        r += k * (c1[0] * hue + c2[0] * (1 - hue));
        gr += k * (c1[1] * hue + c2[1] * (1 - hue));
        b += k * (c1[2] * hue + c2[2] * (1 - hue));
        const i = (y * lw + x) * 4;
        img.data[i] = Math.max(0, Math.min(255, r));
        img.data[i + 1] = Math.max(0, Math.min(255, gr));
        img.data[i + 2] = Math.max(0, Math.min(255, b));
        img.data[i + 3] = 255;
      }
    }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(lc, 0, 0, W, H);
    const rnd = mulberry(seed + 5);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(255,255,255,${rnd() * 0.5})`;
      g.fillRect(rnd() * W, rnd() * H, 1, 1);
    }
    return (cache[key] = tex(c));
  };

  const GAS_PALETTES = {
    amber: [[196, 160, 120], [150, 105, 70], [220, 196, 160], [120, 80, 55], [205, 170, 130], [170, 130, 95]],
    cyan: [[170, 215, 225], [130, 185, 205], [205, 232, 238], [110, 165, 190], [185, 222, 232], [150, 200, 215]],
    purple: [[130, 85, 160], [90, 50, 125], [170, 130, 190], [70, 40, 95], [150, 105, 175], [110, 70, 140]],
    rust: [[190, 100, 70], [140, 60, 45], [220, 150, 110], [110, 45, 35], [200, 120, 85], [160, 80, 60]],
  };

  // Banded gas giant
  T.gasGiant = function (palette = 'amber', seed = 21) {
    const key = 'gas' + palette + seed;
    if (cache[key]) return cache[key];
    const W = 1024, H = 512;
    const c = canvas(W, H), g = c.getContext('2d');
    const { fbm } = makeNoise(seed);
    const img = g.createImageData(W, H);
    const pal = GAS_PALETTES[palette] || GAS_PALETTES.amber;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const turb = fbm(u * 10, v * 20, 5, 10) * 0.08;
        const bands = (v + turb) * 14;
        const i0 = Math.floor(bands) % pal.length;
        const i1 = (i0 + 1) % pal.length;
        const f = bands - Math.floor(bands);
        const s = f * f * (3 - 2 * f);
        const n = 0.85 + fbm(u * 30, v * 60, 3, 30) * 0.3;
        const o = (y * W + x) * 4;
        img.data[o] = (pal[i0][0] * (1 - s) + pal[i1][0] * s) * n;
        img.data[o + 1] = (pal[i0][1] * (1 - s) + pal[i1][1] * s) * n;
        img.data[o + 2] = (pal[i0][2] * (1 - s) + pal[i1][2] * s) * n;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const sc = pal[3];
    const grd = g.createRadialGradient(700, 660, 0, 700, 660, 60);
    grd.addColorStop(0, `rgba(${sc[0] + 40},${sc[1]},${sc[2]},0.9)`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.scale(1, 0.5); g.fillStyle = grd; g.beginPath(); g.arc(700, 660, 60, 0, Math.PI * 2); g.fill(); g.restore();
    return (cache[key] = tex(c));
  };

  // Rocky / terrestrial worlds. Returns { map, emissive }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const sat = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  T.planet = function (type, seed = 1) {
    const key = 'pl' + type + seed;
    if (cache[key]) return cache[key];
    const W = 1024, H = 512;
    const c = canvas(W, H), g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const needE = type === 'lava' || type === 'city';
    let ec, eg, eimg;
    if (needE) { ec = canvas(W, H); eg = ec.getContext('2d'); eimg = eg.createImageData(W, H); }
    const { fbm } = makeNoise(seed);
    const rnd = mulberry(seed * 7 + 1);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      const polar = Math.abs(v - 0.5) * 2;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const h = fbm(u * 6, v * 3, 6, 6);
        const d = fbm(u * 24 + 7, v * 12 + 3, 4, 24);
        const ridge = 1 - Math.abs(2 * d - 1);
        let col, e = null;
        switch (type) {
          case 'ocean': {
            if (h < 0.52) col = mix([8, 30, 80], [30, 105, 165], sat(h / 0.52) ** 3);
            else {
              const t = sat((h - 0.52) / 0.2);
              col = t < 0.08 ? [196, 182, 130] : t < 0.6 ? mix([45, 110, 45], [95, 120, 60], t) : mix([110, 95, 70], [235, 235, 240], sat((t - 0.6) / 0.4));
            }
            if (polar > 0.84 + d * 0.06) col = [235, 240, 248];
            break;
          }
          case 'forest': {
            if (h < 0.4) col = mix([15, 45, 70], [30, 80, 100], sat(h / 0.4));
            else col = mix(mix([28, 70, 32], [70, 115, 45], d), [100, 85, 60], sat((h - 0.62) * 5));
            if (polar > 0.9) col = [225, 232, 238];
            break;
          }
          case 'ice': {
            col = mix([150, 185, 220], [238, 244, 250], sat(h * 1.4 - 0.2));
            if (ridge > 0.93) col = mix(col, [60, 100, 150], 0.7);
            break;
          }
          case 'desert': {
            col = mix([168, 108, 58], [222, 172, 112], sat(h * 1.6 - 0.3));
            const dune = Math.sin(u * 700 + d * 60 + v * 90) * 0.06;
            col = col.map((q) => q * (1 + dune));
            if (h > 0.62) col = mix(col, [130, 80, 50], sat((h - 0.62) * 6));
            if (polar > 0.93) col = mix(col, [230, 220, 200], 0.6);
            break;
          }
          case 'lava': {
            col = mix([28, 24, 22], [78, 66, 58], d);
            const crack = ridge > 0.9 ? sat((ridge - 0.9) * 12) : 0;
            const lake = h < 0.36 ? sat((0.36 - h) * 12) : 0;
            const heat = Math.max(crack, lake);
            if (heat > 0) {
              const lc = mix([255, 70, 10], [255, 190, 60], heat);
              col = mix(col, lc, heat);
              e = lc.map((q) => q * heat);
            }
            break;
          }
          case 'toxic': {
            col = mix([85, 115, 30], [185, 200, 70], sat(h * 1.5 - 0.25));
            const swirl = Math.sin(v * 40 + h * 20) * 0.5 + 0.5;
            col = mix(col, [210, 215, 140], swirl * 0.25);
            break;
          }
          case 'dead': {
            col = mix([70, 62, 56], [150, 138, 122], sat(h * 1.4 - 0.2));
            col = col.map((q) => q * (0.85 + d * 0.3));
            break;
          }
          case 'city': {
            const land = h > 0.47;
            col = land ? mix([55, 58, 66], [95, 98, 108], d) : [14, 22, 40];
            if (land) {
              const grid = (Math.floor(u * 400) % 4 === 0 || Math.floor(v * 200) % 4 === 0) ? 1 : 0;
              if (rnd() < 0.22 + grid * 0.35) {
                const b = 0.5 + rnd() * 0.5;
                e = [255 * b, 200 * b, 120 * b];
              }
            }
            break;
          }
          default: col = [128, 128, 128];
        }
        const o = (y * W + x) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
        if (needE) {
          eimg.data[o] = e ? e[0] : 0; eimg.data[o + 1] = e ? e[1] : 0; eimg.data[o + 2] = e ? e[2] : 0; eimg.data[o + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
    if (type === 'dead') { // craters
      for (let i = 0; i < 140; i++) {
        const x = rnd() * W, y = H * 0.1 + rnd() * H * 0.8, r = 3 + Math.pow(rnd(), 3) * 40;
        g.save(); g.translate(x, y); g.scale(1.6, 1);
        g.fillStyle = 'rgba(30,26,22,0.35)'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(200,190,170,0.25)'; g.lineWidth = Math.max(1, r * 0.15); g.beginPath(); g.arc(-r * 0.1, -r * 0.1, r, Math.PI, Math.PI * 1.8); g.stroke();
        g.restore();
      }
    }
    const out = { map: tex(c) };
    if (needE) { eg.putImageData(eimg, 0, 0); out.emissive = tex(ec); }
    return (cache[key] = out);
  };

  T.clouds = function (seed = 3) {
    const key = 'cl' + seed;
    if (cache[key]) return cache[key];
    const W = 1024, H = 512;
    const c = canvas(W, H), g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const { fbm } = makeNoise(seed + 100);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const n = fbm(u * 8 + fbm(u * 4, v * 2, 3, 4) * 0.8, v * 4, 5, 8);
        const a = sat((n - 0.5) * 4) * 230;
        const o = (y * W + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = a;
      }
    }
    g.putImageData(img, 0, 0);
    return (cache[key] = tex(c));
  };

  // Planetary ring (u = radial)
  T.ring = function () {
    if (cache.ring) return cache.ring;
    const W = 512, c = canvas(W, 4), g = c.getContext('2d');
    const rnd = mulberry(9);
    for (let x = 0; x < W; x++) {
      const a = (0.15 + rnd() * 0.5) * Math.sin(Math.PI * x / W) * (x % 97 < 8 ? 0.1 : 1);
      const v = 150 + rnd() * 60;
      g.fillStyle = `rgba(${v},${v * 0.9 | 0},${v * 0.8 | 0},${a})`;
      g.fillRect(x, 0, 1, 4);
    }
    return (cache.ring = tex(c));
  };

  // Battle station surface (optionally without the painted dish)
  T.battleStation = function (withDish = true) {
    const key = 'bs' + withDish;
    if (cache[key]) return cache[key];
    const W = 1024, H = 512;
    const c = canvas(W, H), g = c.getContext('2d');
    const rnd = mulberry(33);
    g.fillStyle = '#7d8187'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      const v = 95 + rnd() * 60;
      g.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 20, 1 + rnd() * 6);
    }
    g.strokeStyle = 'rgba(40,40,45,0.35)';
    for (let y = 0; y < H; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = '#26282c'; g.fillRect(0, H / 2 - 4, W, 8);
    g.fillStyle = 'rgba(255,220,160,0.6)';
    for (let x = 0; x < W; x += 5) if (rnd() < 0.3) g.fillRect(x, H / 2 - 1, 2, 2);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(255,${200 + rnd() * 55 | 0},150,${rnd() * 0.5})`;
      g.fillRect(rnd() * W, rnd() * H, 1, 1);
    }
    if (withDish) {
      const cx = 330, cy = 150, r = 70;
      g.save(); g.translate(cx, cy); g.scale(1.25, 1);
      const grd = g.createRadialGradient(-12, 10, 5, 0, 0, r);
      grd.addColorStop(0, '#3b3e44'); grd.addColorStop(0.7, '#62666c'); grd.addColorStop(1, '#8a8e94');
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(30,30,34,0.6)'; g.lineWidth = 2;
      for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(0, 0, r * k / 5, 0, Math.PI * 2); g.stroke(); }
      for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(k * Math.PI / 4) * r, Math.sin(k * Math.PI / 4) * r); g.stroke(); }
      g.fillStyle = '#1e2024'; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    return (cache[key] = tex(c));
  };

  // Superlaser dish texture for a sphere cap: v = radial (1 at centre), u = around
  T.dish = function () {
    if (cache.dish) return cache.dish;
    const W = 512, H = 256;
    const c = canvas(W, H), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#1d2024'); grd.addColorStop(0.5, '#4a4e55'); grd.addColorStop(1, '#8b9097');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(15,15,18,0.7)'; g.lineWidth = 2;
    for (let y = 16; y < H; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    return (cache.dish = tex(c));
  };

  T.makeNoise = makeNoise;
  T.mulberry = mulberry;
  SW.Tex = T;
})();
