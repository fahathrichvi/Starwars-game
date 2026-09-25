/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Main game: renderer, state machine, mission director, collisions, camera and UI wiring */
(function () {
  const { rand, clamp, damp, pick, randomUnit } = SW.util;
  const ZERO = new THREE.Vector3();
  const _v = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const $ = (id) => document.getElementById(id);
  const ACTIVE = ['playing', 'complete', 'failed'];

  class Game {
    constructor() {
      this.initRenderer();
      this.world = new SW.World(this.scene);
      this.fx = new SW.Effects(this.scene, this.camera);
      this.hyper = new SW.Hyperspace(this.camera);
      this.bolts = new SW.Bolts(this);
      this.torpedoes = new SW.Torpedoes(this);
      this.hud = new SW.HUD(this);

      this.ships = [];
      this.transports = [];
      this.bigs = [];
      this.wrecks = [];
      this.events = [];
      this.capital = null;
      this.station = null;
      this.boss = null;
      this.waypoint = null;
      this.player = null;
      this.pc = null;
      this.time = 0;
      this.frame = 0;
      this.state = 'title';
      this.mode = 'attract';
      this.cockpit = false;
      this.arenaRadius = 2200;
      this.stats = { kills: 0, shots: 0, hits: 0 };
      this.score = 0;
      this.missionTime = 0;
      this.missionIndex = 0;
      this.missionKills = 0;
      this.lastChatter = 0;
      this._tg = { rebel: [], empire: [] };
      this.camTarget = new THREE.Vector3();
      this.attractAngle = 0;
      this.applyDifficulty();

      SW.Input.init(this.renderer.domElement);
      SW.Input.onLockChange = (locked) => {
        if (!locked && (ACTIVE.includes(this.state) || this.state === 'hyperspace')) this.pause();
      };
      this.bindUI();
      window.addEventListener('resize', () => this.onResize());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && ACTIVE.includes(this.state)) this.pause();
      });
      this.onResize();

      this.startAttract();
      this.showScreen('title');
      $('loading').classList.add('hidden');

      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    /* ======================== RENDERER ======================== */
    initRenderer() {
      const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      r.setSize(window.innerWidth, window.innerHeight);
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;
      $('game-container').appendChild(r.domElement);
      this.renderer = r;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x000000);
      this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 70000);
      this.scene.add(this.camera);
      this.baseFov = 70;

      const size = r.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
      this.composer = new THREE.EffectComposer(r, rt);
      this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
      this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.95, 0.55, 0.87);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
    }

    onResize() {
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h);
      if (this.composer.setPixelRatio) this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.fx.setScale(h * this.renderer.getPixelRatio(), this.camera.fov);
      this.hud.resize();
    }

    applyDifficulty() {
      const d = +SW.settings.difficulty;
      this.difficulty = d;
      this.playerDamageMul = [0.45, 0.75, 1.05][d];
      this.enemyFireMul = [1.6, 1.15, 0.85][d];
      this.baseSkill = [0.3, 0.5, 0.72][d];
      this.launchMul = [1.4, 1.0, 0.75][d];
      this.aggro = [0.4, 0.55, 0.7][d];
    }

    /* ======================== UI ======================== */
    showScreen(name) {
      ['title', 'crawl', 'briefing', 'pause', 'result'].forEach((s) => $('screen-' + s).classList.toggle('hidden', s !== name));
    }

    bindUI() {
      const menu = $('main-menu');
      const sub = { select: $('mission-menu'), controls: $('controls-panel'), settings: $('settings-panel') };
      const showSub = (k) => {
        menu.classList.toggle('hidden', !!k);
        Object.keys(sub).forEach((x) => sub[x].classList.toggle('hidden', x !== k));
      };
      document.addEventListener('click', () => { SW.Audio.resume(); SW.Audio.startMusic(); });
      document.querySelectorAll('[data-action]').forEach((b) => {
        b.addEventListener('click', () => {
          SW.Audio.resume(); SW.Audio.beep(660, 0.04, 0.1, 'sine');
          const a = b.dataset.action;
          if (a === 'campaign') this.playCrawl();
          else if (a === 'select') { this.buildMissionMenu(showSub); showSub('select'); }
          else if (a === 'controls') showSub('controls');
          else if (a === 'settings') showSub('settings');
          else if (a === 'back') showSub(null);
        });
      });

      const sens = $('set-sens'), vol = $('set-vol'), inv = $('set-invert'), bloom = $('set-bloom'), diff = $('set-diff');
      sens.value = SW.settings.sens; vol.value = SW.settings.volume; inv.checked = SW.settings.invert;
      bloom.checked = SW.settings.bloom; diff.value = SW.settings.difficulty;
      sens.oninput = () => { SW.settings.sens = +sens.value; SW.saveSettings(); };
      vol.oninput = () => { SW.Audio.setVolume(+vol.value); SW.saveSettings(); };
      inv.onchange = () => { SW.settings.invert = inv.checked; SW.saveSettings(); };
      bloom.onchange = () => { SW.settings.bloom = bloom.checked; SW.saveSettings(); };
      diff.onchange = () => { SW.settings.difficulty = +diff.value; SW.saveSettings(); this.applyDifficulty(); };

      $('btn-launch').onclick = () => this.launch();
      $('btn-brief-back').onclick = () => this.toMenu();
      $('btn-resume').onclick = () => this.resume();
      $('btn-restart').onclick = () => { this.showScreen(null); this.startMission(this.missionIndex); SW.Input.requestLock(); };
      $('btn-quit').onclick = () => this.toMenu();
      $('btn-next').onclick = () => this.showBriefing(this.missionIndex + 1);
      $('btn-retry').onclick = () => this.showBriefing(this.missionIndex);
      $('btn-menu').onclick = () => this.toMenu();
      $('screen-crawl').addEventListener('click', () => this.endCrawl());

      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && this.state === 'crawl') this.endCrawl();
        if (e.code === 'Enter' && this.state === 'briefing') this.launch();
        if ((e.code === 'KeyP' || e.code === 'Escape') && ACTIVE.includes(this.state)) this.pause();
        else if (e.code === 'KeyP' && this.state === 'paused') this.resume();
        if (e.code === 'KeyM') { const m = SW.Audio.toggleMute(); if (this.player) this.hud.flashSub(m ? 'SOUND MUTED' : 'SOUND ON', 1); }
        if (e.code === 'KeyN') { const m = SW.Audio.toggleMusic(); if (this.player) this.hud.flashSub(m ? 'MUSIC ON' : 'MUSIC OFF', 1); }
        if (e.code === 'KeyC' && this.player && this.player.alive) { this.cockpit = !this.cockpit; this.hud.flashSub(this.cockpit ? 'COCKPIT VIEW' : 'CHASE VIEW', 1); }
      });
    }

    buildMissionMenu(showSub) {
      const el = $('mission-menu');
      el.innerHTML = '';
      SW.MISSIONS.forEach((m, i) => {
        const b = document.createElement('button');
        b.className = 'btn mission-btn' + (m.boss ? ' boss' : '');
        const locked = i + 1 > SW.settings.unlocked;
        b.disabled = locked;
        const env = SW.ENVS[m.env];
        b.innerHTML = `${locked ? '🔒 ' : ''}${m.title}<span class="m-sub">${m.sub}${env ? ' · ' + env.name.split(' — ')[0] : ''}</span>`;
        b.onclick = () => { SW.Audio.beep(660, 0.04, 0.1, 'sine'); showSub(null); this.showBriefing(i); };
        el.appendChild(b);
      });
      const hs = document.createElement('div');
      hs.className = 'tip';
      hs.textContent = 'High score: ' + (SW.settings.highScore || 0).toLocaleString();
      el.appendChild(hs);
      const back = document.createElement('button');
      back.className = 'btn small'; back.textContent = 'BACK';
      back.onclick = () => showSub(null);
      el.appendChild(back);
    }

    playCrawl() {
      this.state = 'crawl';
      this.showScreen('crawl');
      const c = $('screen-crawl');
      c.classList.remove('play'); void c.offsetWidth; c.classList.add('play');
      SW.Audio.setIntensity(0.5);
      clearTimeout(this.crawlTimer);
      this.crawlTimer = setTimeout(() => this.endCrawl(), 52000);
    }

    endCrawl() {
      if (this.state !== 'crawl') return;
      clearTimeout(this.crawlTimer);
      $('screen-crawl').classList.remove('play');
      this.showBriefing(0);
    }

    envKeyFor(m) {
      if (m.env !== 'random') return m.env;
      return pick(Object.keys(SW.ENVS).filter((k) => k !== 'imperialis' && k !== 'moraxa' && k !== 'glacius'));
    }

    showBriefing(i) {
      i = clamp(i, 0, SW.MISSIONS.length - 1);
      const m = SW.MISSIONS[i];
      this.missionIndex = i;
      this.state = 'briefing';
      SW.Input.enabled = false;
      SW.Input.exitLock();
      SW.Audio.stopEngine();
      this.hud.show(false);
      this.showScreen(null);
      const envKey = this.envKeyFor(m);
      this.missionEnvKey = envKey;
      const env = SW.ENVS[envKey];
      const build = () => {
        this.world.setEnvironment(env);
        this.startAttract();
        $('brief-title').textContent = m.title;
        $('brief-sub').textContent = m.sub;
        $('brief-loc').textContent = '◉ ' + env.name.toUpperCase();
        $('brief-boss').classList.toggle('hidden', !m.boss);
        $('brief-text').textContent = m.briefing;
        $('brief-objectives').innerHTML = m.objectives.map((o) => `<li>${o.text}</li>`).join('') +
          (m.timeLimit ? `<li>Time limit: ${SW.util.fmtTime(m.timeLimit)}</li>` : '') +
          (m.countdown ? `<li>Superlaser fires in ${SW.util.fmtTime(m.countdown)}</li>` : '');
        $('loading').classList.add('hidden');
        this.showScreen('briefing');
        SW.Audio.droid();
      };
      if (this.world.envKey !== envKey) {
        $('loading').querySelector('.load-text').textContent = 'PLOTTING COURSE TO ' + env.name.split(' — ')[0].toUpperCase() + '…';
        $('loading').classList.remove('hidden');
        setTimeout(build, 60);
      } else build();
    }

    launch() {
      if (this.state !== 'briefing') return;
      SW.Audio.resume();
      this.showScreen(null);
      SW.Input.enabled = true;
      SW.Input.requestLock();
      this.startMission(this.missionIndex);
    }

    toMenu() {
      SW.Input.enabled = false;
      SW.Input.exitLock();
      SW.Audio.stopEngine();
      this.hud.show(false);
      this.world.setEnvironment(SW.ENVS.kessra);
      this.startAttract();
      this.state = 'title';
      this.showScreen('title');
      SW.Audio.setIntensity(0.3);
    }

    pause() {
      if (this.state === 'paused') return;
      this.prevState = this.state;
      this.state = 'paused';
      SW.Input.enabled = false;
      SW.Input.exitLock();
      SW.Audio.setEngine(0, false);
      this.showScreen('pause');
    }

    resume() {
      if (this.state !== 'paused') return;
      this.state = this.prevState || 'playing';
      this.showScreen(null);
      SW.Input.enabled = true;
      SW.Input.requestLock();
      this.last = performance.now();
    }

    /* ======================== BATTLE SETUP ======================== */
    clearBattle() {
      this.ships.forEach((s) => { s.dispose(); disposeObject(s.obj); });
      this.ships = [];
      this.transports.forEach((t) => { t.dispose(); disposeObject(t.obj); });
      this.transports = [];
      this.wrecks.forEach((w) => { this.scene.remove(w.obj); disposeObject(w.obj); });
      this.wrecks = [];
      this.bigs.forEach((b) => { b.dispose(); disposeObject(b.group); });
      this.bigs = [];
      this.capital = null;
      this.station = null;
      this.boss = null;
      this.waypoint = null;
      if (this.beacon) { this.scene.remove(this.beacon); disposeObject(this.beacon); this.beacon = null; }
      this.bolts.clear();
      this.torpedoes.clear();
      this.fx.clear();
      this.events = [];
      this.player = null;
      this.pc = null;
      this.hud.clearComms();
    }

    startAttract() {
      this.clearBattle();
      this.mode = 'attract';
      this.world.setAsteroids(this.world.env.asteroids || { mode: 'ring', count: 70 });
      this.setWorldVisible(true);
      for (let i = 0; i < 4; i++) this.spawnAttract('rebel');
      for (let i = 0; i < 5; i++) this.spawnAttract('empire');
      const cap = new SW.Capital(this, new THREE.Vector3(-520, -220, 950), Math.PI * 0.8);
      cap.attract = true;
      cap.activateNow();
      this.bigs.push(cap);
    }

    spawnAttract(team) {
      const s = team === 'rebel'
        ? new SW.Ship(this, 'xwing', 'rebel', { wingman: true, hp: 200, shield: 150, skill: 0.6, name: '' })
        : new SW.Ship(this, Math.random() < 0.3 ? 'interceptor' : 'tie', 'empire', { skill: 0.45 });
      randomUnit(_v).multiplyScalar(rand(200, 500));
      _v.y *= 0.4;
      s.obj.position.copy(_v);
      s.obj.lookAt(0, 0, 0);
      this.ships.push(s);
      return s;
    }

    startMission(idx) {
      this.clearBattle();
      this.applyDifficulty();
      this.mode = 'mission';
      this.missionIndex = idx;
      const M = SW.MISSIONS[idx];
      this.mission = M;
      this.world.setEnvironment(SW.ENVS[this.missionEnvKey || this.envKeyFor(M)]);
      this.baseSkill = Math.min(0.9, this.baseSkill + idx * 0.012);
      this.score = 0;
      this.stats = { kills: 0, shots: 0, hits: 0 };
      this.missionKills = 0;
      this.missionTime = 0;
      this.wave = 0;
      this.waveIdx = 0;
      this.waveCooldown = 999;
      this.completing = false;
      this.lowHullWarned = false;
      this.cockpit = false;
      this.cockpitApplied = false;
      this.arenaRadius = M.arena || 2200;
      this.relaysDestroyed = 0;
      this.jumpedCount = 0; this.lostCount = 0;
      this.freightersDestroyed = 0; this.freightersEscaped = 0;
      this.bossDefeated = false; this.bossPhase = 0;
      this.reached = false;
      this.survTimer = 4;
      this.warn60 = this.warn30 = false;
      this.lastTransportMsg = -99;

      // player
      const start = M.start ? new THREE.Vector3(...M.start)
        : M.transports && !M.transports.imperial ? new THREE.Vector3(0, 40, M.transports.startZ - 140)
          : new THREE.Vector3(0, 30, -950);
      const p = new SW.Ship(this, 'xwing', 'rebel', { player: true, name: 'RED LEADER' });
      p.obj.position.copy(start);
      p.obj.lookAt(start.x, start.y, start.z + 100);
      p.speed = 110;
      this.ships.push(p);
      this.player = p;
      this.pc = new SW.PlayerControl(p);
      this.pc.torps = M.torps;

      const offs = [[-28, 6, -22], [28, -6, -22], [-56, 0, -44], [56, 0, -44]];
      M.wingmen.forEach((name, i) => {
        const w = new SW.Ship(this, 'xwing', 'rebel', { wingman: true, name, hp: 170, shield: 120, skill: 0.62 });
        w.obj.position.copy(p.pos).add(_v.set(offs[i][0], offs[i][1], offs[i][2]));
        w.obj.quaternion.copy(p.obj.quaternion);
        w.speed = 110;
        this.ships.push(w);
      });

      this.setupMission(M, start);

      SW.Input.centerStick();
      this.setWorldVisible(false);
      this.state = 'hyperspace';
      this.hyper.start();
      SW.Audio.hyperspace();
      SW.Audio.startEngine();
      this.hud.show(true);
      this.updateObjectives();
      this.snapCamera();
    }

    setupMission(M, start) {
      // asteroid field
      if (M.field) {
        const f = M.field;
        const goal = new THREE.Vector3(0, 0, f.goalZ);
        this.world.setAsteroids({ mode: 'field', count: f.count, mat: f.mat, box: f.box, clear: [{ pos: start, r: 140 }, { pos: goal, r: 180 }] });
        this.waypoint = { pos: goal };
        this.makeBeacon(goal);
        this.debrisTimer = 5;
      } else {
        this.world.setAsteroids(this.world.env.asteroids || { mode: 'ring', count: 70 });
      }
      // capital ship (Star Destroyer or Dreadnought boss)
      if (M.capital) {
        const cp = M.capitalPos ? new THREE.Vector3(...M.capitalPos) : new THREE.Vector3(0, -60, 950);
        this.capital = new SW.Capital(this, cp, Math.PI, M.capital);
        this.bigs.push(this.capital);
        if (M.boss) this.boss = this.capital;
      }
      // relay outposts
      if (M.relays) {
        M.relays.forEach((pp, i) => this.bigs.push(new SW.Outpost(this, new THREE.Vector3(...pp), 'RELAY ' + 'ABC'[i])));
      }
      // transports / freighters
      if (M.transports) {
        const T = M.transports;
        for (let i = 0; i < T.count; i++) {
          const x = (i - (T.count - 1) / 2) * 95;
          const pos = new THREE.Vector3(x, rand(-15, 15), T.startZ + Math.abs(x) * 0.3);
          const dest = new THREE.Vector3(x, 0, T.destZ);
          const hpMul = T.imperial ? 1 : [1.4, 1, 0.8][this.difficulty];
          this.transports.push(new SW.Transport(this, T.imperial ? 'imperial' : 'rebel', pos, dest, T.names[i], { hp: T.hp * hpMul, shield: T.shield, speed: T.speed }));
        }
      }
      // battle station
      if (M.type === 'station') {
        this.station = new SW.Station(this, new THREE.Vector3(...M.stationPos), start);
        this.bigs.push(this.station);
        this.boss = this.station;
      }
    }

    makeBeacon(pos) {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.6, 3.2), toneMapped: false });
      const t1 = new THREE.Mesh(new THREE.TorusGeometry(45, 2.2, 8, 64), mat);
      const t2 = new THREE.Mesh(new THREE.TorusGeometry(30, 1.5, 8, 64), mat);
      g.add(t1, t2);
      const glow = SW.Models.glowSprite(new THREE.Color(0.4, 2.2, 3), 140);
      g.add(glow);
      g.position.copy(pos);
      g.userData = { t1, t2 };
      this.scene.add(g);
      this.beacon = g;
    }

    setWorldVisible(v) {
      this.world.setVisible(v);
      for (const b of this.bigs) if (b.state !== 'hidden' && b.state !== 'dead') b.group.visible = v;
      for (const t of this.transports) t.obj.visible = v;
      if (this.beacon) this.beacon.visible = v;
    }

    onHyperspaceEnd() {
      this.setWorldVisible(true);
      this.hud.whiteFlash();
      this.hud.whiteV = 0.6;
      this.state = 'playing';
      const M = this.mission;
      this.hud.flashCenter(M.title, 3);
      M.intro.forEach((line, i) => this.after(1.2 + i * 3.2, () => this.comms(line[0], line[1], line[2])));
      if (M.type === 'endless') this.after(2.5, () => this.nextEndlessWave());
      this.waveCooldown = 2;
      if (M.capital) {
        this.after(6, () => {
          this.hud.flashCenter(M.boss ? 'WARNING: DREADNOUGHT' : 'WARNING: STAR DESTROYER', 3, true);
          SW.Audio.alarm();
          this.after(1.3, () => SW.Audio.alarm());
        });
        this.after(8, () => {
          this.capital.arrive();
          this.after(2.5, () => this.comms('RED LEADER', M.boss ? "Look at the size of that thing! Hit the shield generators — all four of them!" : "It's a Star Destroyer! All wings, target the shield generators on the command tower!"));
          this.after(7, () => this.comms('R2 UNIT', '*beep-boop* Shield generator targets marked in gold.', 'command'));
        });
      }
      if (M.type === 'station') {
        this.after(4, () => { this.hud.flashCenter('SUPERLASER CHARGING', 3, true); SW.Audio.alarm(); });
      }
    }

    after(delay, fn) { this.events.push({ t: this.time + delay, fn }); }

    spawnEnemy(type, pos) {
      const skill = clamp(this.baseSkill + rand(-0.1, 0.1) + (type === 'interceptor' ? 0.08 : 0), 0.1, 0.95);
      const s = new SW.Ship(this, type, 'empire', { skill });
      s.obj.position.copy(pos);
      this.ships.push(s);
      return s;
    }

    spawnWave(list, opts = {}) {
      const p = this.player;
      const base = p && p.alive ? p.pos : ZERO;
      const fwd = p && p.alive ? p.fwd : new THREE.Vector3(0, 0, 1);
      let center;
      if (opts.behind) {
        center = base.clone().addScaledVector(fwd, -rand(900, 1200)).add(randomUnit(_v).multiplyScalar(150));
      } else if (this.mission && this.mission.type === 'escort') {
        const tr = this.transports.filter((t) => t.alive);
        const focus = tr.length ? tr[0].pos : base;
        center = focus.clone().add(randomUnit(_v).multiplyScalar(1300));
      } else {
        const dir = fwd.clone().add(randomUnit(_v).multiplyScalar(0.9)).normalize();
        center = base.clone().addScaledVector(dir, rand(1200, 1600));
      }
      if (center.length() > this.arenaRadius) center.setLength(this.arenaRadius * 0.9);
      let i = 0;
      list.forEach(([type, n]) => {
        for (let k = 0; k < n; k++) {
          const row = Math.floor(i / 3), col = (i % 3) - 1;
          const pos = center.clone().add(_v2.set(col * 22 + rand(-5, 5), row * 10 + rand(-5, 5), row * 25));
          const s = this.spawnEnemy(type, pos);
          s.obj.lookAt(base);
          i++;
        }
      });
      if (Math.random() < 0.5) this.after(1.5, () => this.comms('TIE SQUADRON', pick(SW.CHATTER.empire), 'empire'));
    }

    nextEndlessWave() {
      this.wave++;
      const n = Math.min(14, 3 + this.wave);
      const inter = Math.min(0.7, 0.08 * this.wave);
      const ni = Math.round(n * inter);
      this.spawnWave([['tie', n - ni], ['interceptor', ni]]);
      this.hud.flashCenter('WAVE ' + this.wave, 2.5);
      if (this.wave > 1 && this.wave % 3 === 1 && this.pc) {
        this.pc.torps += 3;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
        this.comms('REBEL COMMAND', 'Supply drop delivered: +3 proton torpedoes and hull patch applied.', 'command');
      }
      const wings = this.ships.filter((s) => s.alive && s.isWingman).length;
      if (this.wave % 4 === 0 && wings < 2 && this.player) {
        const w = new SW.Ship(this, 'xwing', 'rebel', { wingman: true, name: pick(['GOLD TWO', 'BLUE SIX', 'GREEN THREE']), hp: 170, shield: 120, skill: 0.62 });
        w.obj.position.copy(this.player.pos).add(_v.set(rand(-60, 60), rand(-20, 20), -80));
        w.obj.quaternion.copy(this.player.obj.quaternion);
        this.ships.push(w);
        this.comms(w.name, 'Reinforcements have arrived. Forming up on you, Leader!');
      }
      this.updateObjectives();
    }

    spawnBoss() {
      const d = this.mission.bossDef;
      const p = this.player;
      const hpMul = [0.7, 1, 1.25][this.difficulty];
      const b = new SW.Ship(this, 'advanced', 'empire', { boss: true, skill: 0.92, hp: d.hp * hpMul, shield: d.shield, name: d.name });
      const base = p && p.alive ? p.pos : ZERO;
      const fwd = p && p.alive ? p.fwd : new THREE.Vector3(0, 0, 1);
      b.obj.position.copy(base).addScaledVector(fwd, 1300).add(randomUnit(_v).multiplyScalar(200));
      b.obj.lookAt(base);
      this.ships.push(b);
      this.boss = b;
      this.hud.flashCenter('WARNING: ' + d.name, 3, true);
      SW.Audio.alarm();
      this.after(1.5, () => this.comms(d.name, pick(SW.BOSS_TAUNTS.arrive), 'empire'));
      this.after(4.5, () => this.comms('RED TWO', "That's the black TIE! Watch it, Leader — it has shields!"));
      this.updateObjectives();
    }

    onBossDamaged(b) {
      const r = b.hp / b.maxHp;
      const phaseUp = (count, enrage) => {
        this.bossPhase++;
        b.shield = b.maxShield;
        b.invulnerable = true;
        this.after(2.5, () => { b.invulnerable = false; });
        if (enrage) { b.fireMul = 0.6; b.ai.skill = 1; }
        for (let i = 0; i < count; i++) {
          const s = this.spawnEnemy('interceptor', b.pos.clone().add(randomUnit(_v).multiplyScalar(250)));
          s.obj.lookAt(this.player ? this.player.pos : ZERO);
        }
        this.hud.flashCenter(enrage ? 'THE INQUISITOR IS ENRAGED' : 'REINFORCEMENTS INBOUND', 2.5, true);
        this.comms(b.name, pick(SW.BOSS_TAUNTS.phase), 'empire');
        SW.Audio.alarm();
      };
      if (this.bossPhase === 0 && r < 0.6) phaseUp(3, false);
      else if (this.bossPhase === 1 && r < 0.3) phaseUp(4, true);
    }

    /* ======================== QUERIES used by AI & weapons ======================== */
    getTargets(team) { return this._tg[team]; }

    refreshTargets() {
      const r = this._tg.rebel, e = this._tg.empire;
      r.length = 0; e.length = 0;
      for (const s of this.ships) if (s.alive) (s.team === 'rebel' ? r : e).push(s);
      for (const t of this.transports) if (t.alive && !t.jumping) (t.team === 'rebel' ? r : e).push(t);
      for (const b of this.bigs) for (const t of b.targets()) e.push(t);
    }

    pickTarget(ship) {
      const M = this.mission;
      if (ship.team === 'empire') {
        if (ship.isBoss && this.player && this.player.alive && Math.random() < 0.85) return this.player;
        const rt = this.transports.filter((t) => t.alive && !t.jumping && t.team === 'rebel');
        if (rt.length && Math.random() < ((M && M.transportAggro) || 0.4)) return pick(rt);
        if (this.player && this.player.alive && Math.random() < this.aggro) return this.player;
        return this.nearestOf(ship, this._tg.rebel.filter((s) => s.kind === 'fighter'));
      }
      const it = this.transports.filter((t) => t.alive && !t.jumping && t.team === 'empire');
      if (it.length && Math.random() < 0.45) return pick(it);
      const fighters = this._tg.empire.filter((s) => s.kind === 'fighter');
      if (fighters.length) {
        const sorted = fighters.sort((a, b) => a.pos.distanceToSquared(ship.pos) - b.pos.distanceToSquared(ship.pos));
        return sorted[Math.min(sorted.length - 1, Math.floor(Math.random() * 2))];
      }
      const subs = [];
      for (const b of this.bigs) if (!b.attract) for (const t of b.targets()) if (t.type !== 'port') subs.push(t);
      const pri = subs.filter((s) => s.type !== 'turret' && s.type !== 'bridge');
      if (pri.length) return pick(pri);
      const br = subs.find((s) => s.type === 'bridge');
      if (br) return br;
      return subs.length ? pick(subs) : null;
    }

    nearestOf(ship, list) {
      let best = null, bd = Infinity;
      for (const s of list) {
        if (!s.alive || s === ship) continue;
        const d = s.pos.distanceToSquared(ship.pos);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    }

    nearestEnemy(ship, inFront) {
      let best = null, bs = Infinity;
      for (const t of this._tg.empire) {
        if (!t.alive) continue;
        _v.subVectors(t.pos, ship.pos);
        const d = _v.length();
        const dot = _v.divideScalar(d || 1).dot(ship.fwd);
        if (inFront && (dot < 0.8 || d > 2500)) continue;
        const score = (inFront ? (1 - dot) * 4000 + d * 0.3 : d) + (t.type === 'turret' ? 1500 : 0) - (t.isBoss ? 800 : 0);
        if (score < bs) { bs = score; best = t; }
      }
      return best;
    }

    cycleTarget(cur, dir) {
      const p = this.player;
      const list = this._tg.empire.filter((t) => t.alive).sort((a, b) => a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos));
      if (!list.length) return null;
      let i = list.indexOf(cur);
      i = (i + dir + list.length) % list.length;
      return list[i];
    }

    countEnemyFighters() {
      let n = 0;
      for (const s of this.ships) if (s.alive && s.team === 'empire') n++;
      return n;
    }

    hudObjects() {
      const list = [];
      for (const s of this.ships) if (s.alive && !s.isPlayer) list.push(s);
      for (const t of this.transports) if (t.alive) list.push(t);
      for (const b of this.bigs) if (!b.attract) for (const t of b.targets()) list.push(t);
      return list;
    }

    hullHit(p) {
      for (const b of this.bigs) if (b.hitsHull(p, 0)) return true;
      return false;
    }

    avoidance(ship, out) {
      for (const b of this.bigs) {
        const w = b.avoid(ship, out);
        if (w > 0) return w;
      }
      const look = 60 + ship.speed * 1.5;
      for (const a of this.world.asteroids) {
        const r = a.userData.radius + 12;
        _v.subVectors(a.position, ship.pos);
        const along = _v.dot(ship.fwd);
        if (along < 0 || along > look + r) continue;
        _v2.copy(ship.fwd).multiplyScalar(along);
        const lateral = _v2.sub(_v).multiplyScalar(-1);
        if (lateral.length() < r) {
          out.copy(lateral).multiplyScalar(-1);
          if (out.lengthSq() < 1e-4) out.set(0, 1, 0);
          out.normalize();
          return 0.8;
        }
      }
      return 0;
    }

    bossInfo() {
      const b = this.boss;
      if (!b || this.mode !== 'mission') return null;
      if (b.kind === 'fighter') {
        if (!b.alive) return null;
        return { name: b.name + ' — TIE ADVANCED', ratio: (b.hp + b.shield) / (b.maxHp + b.maxShield), shielded: b.shield > 0 };
      }
      if (b.state === 'hidden' || b.state === 'arriving' || b.state === 'dead') return null;
      return { name: b.name, ratio: b.bossHealth(), shielded: b.shieldsUp ? b.shieldsUp() : b.emittersAlive() > 0 };
    }

    timerInfo() {
      const M = this.mission;
      if (!M || this.mode !== 'mission' || !ACTIVE.includes(this.state)) return null;
      if (M.timeLimit) { const s = M.timeLimit - this.missionTime; return { label: 'ESCAPE WINDOW', secs: s, urgent: s < 30 }; }
      if (M.countdown) { if (this.station && this.station.state !== 'active' && this.station.state !== 'firing') return null; const s = M.countdown - this.missionTime; return { label: 'SUPERLASER CHARGE', secs: s, urgent: s < 60 }; }
      const sv = M.objectives.find((o) => o.type === 'survive');
      if (sv) { const s = sv.time - this.missionTime; return { label: 'HOLD OUT', secs: s, urgent: false }; }
      return null;
    }

    /* ======================== EVENTS ======================== */
    addScore(n) { if (this.mode === 'mission') this.score += Math.round(n * (1 + this.difficulty * 0.25)); }

    comms(who, text, cls) {
      if (this.mode !== 'mission') return;
      this.hud.comms(who, text, cls);
      if (who.startsWith('R2')) SW.Audio.droid();
      else SW.Audio.beep(1800, 0.03, 0.05, 'sine');
    }

    chatter(who, list, chance = 1) {
      if (this.time - this.lastChatter < 3.5 || Math.random() > chance) return;
      this.lastChatter = this.time;
      this.comms(who, pick(list));
    }

    onShipDestroyed(ship, source) {
      if (this.mode === 'attract') {
        this.after(2.5, () => { if (this.mode === 'attract') this.spawnAttract(ship.team); });
        return;
      }
      if (ship.isPlayer) { this.playerDied(); return; }
      if (ship.team === 'empire') {
        this.missionKills++;
        if (ship.isBoss) {
          this.bossDefeated = true;
          this.addScore(5000);
          this.comms(ship.name, pick(SW.BOSS_TAUNTS.death), 'empire');
          this.hud.flashCenter(ship.name + ' DEFEATED', 3);
          this.fx.flashLight(ship.pos, 12, 800, 1.2, 0xffa060);
          this.after(2.5, () => this.comms('RED TWO', 'You got the Inquisitor! Incredible flying, Leader!'));
          if (source && source.isPlayer) this.stats.kills++;
          this.onObjectiveProgress();
          return;
        }
        if (source && source.isPlayer) {
          this.stats.kills++;
          this.addScore(ship.spec.score * (this.mission.type === 'endless' ? 1 + this.wave * 0.1 : 1));
          const wm = this.ships.find((s) => s.alive && s.isWingman);
          if (wm) this.chatter(wm.name, SW.CHATTER.playerKill, 0.45);
          this.hud.flashSub('+' + ship.spec.score + '  ' + ship.name + ' DESTROYED', 1.3);
        } else if (source && source.isWingman) {
          this.chatter(source.name, SW.CHATTER.rebelKill, 0.4);
        }
        this.onObjectiveProgress();
      } else if (ship.isWingman) {
        this.comms(ship.name, pick(SW.CHATTER.wingLost));
        this.after(2, () => this.comms('RED LEADER', `We've lost ${ship.name}! Stay focused!`));
      }
    }

    wingmanHurt(ship) { this.chatter(ship.name, SW.CHATTER.wingHurt, 0.6); }

    onPlayerHit(shieldHit, source) {
      this.hud.damageFlash(shieldHit ? 0.12 : 0.4);
      this.fx.addShake(shieldHit ? 0.12 : 0.35);
      SW.Audio.hit(shieldHit);
      const p = this.player;
      if (!shieldHit && p.hp < p.maxHp * 0.3 && !this.lowHullWarned) {
        this.lowHullWarned = true;
        this.comms('R2 UNIT', pick(SW.CHATTER.lowHull), 'command');
        SW.Audio.alarm();
      }
      if (source && source.kind === 'fighter' && Math.random() < 0.15) {
        const wm = this.ships.find((s) => s.alive && s.isWingman);
        if (wm) this.chatter(wm.name, SW.CHATTER.playerHurt, 0.5);
      }
    }

    onTransportHit(t) {
      if (t.team !== 'rebel' || this.time - this.lastTransportMsg < 9) return;
      if (t.hp < t.maxHp * 0.7) {
        this.lastTransportMsg = this.time;
        this.comms(t.name, pick(SW.CHATTER.transportHit));
      }
    }

    onTransportDestroyed(t, source) {
      if (t.team === 'rebel') {
        this.lostCount++;
        this.comms('RED LEADER', `We've lost the ${t.name.replace('TRANSPORT ', '')}!`);
        this.hud.flashCenter(t.name + ' DESTROYED', 2.5, true);
      } else {
        this.freightersDestroyed++;
        this.addScore(1500);
        if (source && source.isPlayer) this.stats.kills++;
        this.hud.flashSub('+1500  ' + t.name + ' DESTROYED', 1.8);
        this.comms('RED THREE', 'Freighter down! That hurts them!');
      }
      this.onObjectiveProgress();
    }

    onTransportJumped(t) {
      if (t.team === 'rebel') {
        this.jumpedCount++;
        this.addScore(1500);
        this.comms(t.name, 'We made the jump! Thank you, Red Squadron!');
      } else {
        this.freightersEscaped++;
        this.comms('REBEL COMMAND', `${t.name} has escaped to hyperspace.`, 'command');
      }
      this.onObjectiveProgress();
    }

    onRelayDestroyed(o) {
      this.relaysDestroyed++;
      this.hud.flashCenter(o.name + ' DESTROYED', 2.5);
      const left = this.mission.relays.length - this.relaysDestroyed;
      this.comms('RED LEADER', left ? `Relay down! ${left} to go.` : 'That was the last relay. The Empire is blind!');
      this.onObjectiveProgress();
    }

    onObjectiveProgress() { this.updateObjectives(); }

    updateObjectives() {
      const M = this.mission;
      if (!M || this.mode !== 'mission') return;
      const cap = this.capital, st = this.station;
      const shieldsDone = !!cap && cap.state !== 'hidden' && cap.state !== 'arriving' && !cap.shieldsUp();
      const emittersDone = !!st && st.emittersAlive() === 0;
      let fail = null;
      const out = M.objectives.map((o) => {
        switch (o.type) {
          case 'kills': return { done: this.missionKills >= o.count, text: `${o.text} (${Math.min(this.missionKills, o.count)}/${o.count})` };
          case 'shields': {
            const total = cap ? cap.shields.length : 2;
            const left = cap ? cap.shields.filter((s) => s.alive).length : total;
            return { done: shieldsDone, text: `${o.text} (${total - left}/${total})` };
          }
          case 'bridge': return { done: !!cap && !cap.bridge.alive, locked: !shieldsDone, text: o.text };
          case 'reach': {
            const d = this.player && this.waypoint ? Math.round(this.player.pos.distanceTo(this.waypoint.pos)) : 0;
            return { done: this.reached, text: this.reached ? o.text : `${o.text} (${d}m)` };
          }
          case 'escort': {
            const flying = this.transports.filter((t) => t.alive).length;
            if (this.jumpedCount + flying < o.need) fail = 'Too many transports were destroyed. The evacuation has failed.';
            return { done: this.jumpedCount >= o.need && flying === 0, text: `${o.text} (${this.jumpedCount} safe · ${flying} en route · need ${o.need})` };
          }
          case 'relays': return { done: this.relaysDestroyed >= o.count, text: `${o.text} (${this.relaysDestroyed}/${o.count})` };
          case 'boss': return { done: this.bossDefeated, locked: !this.boss && !this.bossDefeated, text: o.text };
          case 'convoy': {
            const total = M.transports.count;
            if (this.freightersEscaped > total - o.need) fail = 'Too many freighters escaped with their cargo.';
            return { done: this.freightersDestroyed >= o.need, text: `${o.text} (${this.freightersDestroyed}/${o.need} · ${this.freightersEscaped} escaped)` };
          }
          case 'survive': return { done: this.missionTime >= o.time, text: o.text };
          case 'emitters': return { done: emittersDone, text: `${o.text} (${st ? 4 - st.emittersAlive() : 0}/4)` };
          case 'port': return { done: !!st && !st.port.alive, locked: !emittersDone, text: o.text };
          case 'endless': return { done: false, text: `${o.text} — WAVE ${this.wave}` };
          default: return { done: false, text: o.text };
        }
      });
      this.hud.setMission(M.title, out);
      if (fail) { this.failMission(fail); return; }
      const all = out.every((o) => o.done);
      if (all && !this.completing && this.state === 'playing') {
        this.completing = true;
        if (M.type === 'capital' || M.type === 'station' || M.type === 'asteroidRun') return; // completion driven by their own events
        this.after(2.5, () => this.completeMission());
      }
    }

    onCapitalDestroyed() {
      if (this.mode !== 'mission') return;
      this.addScore(5000);
      this.after(1.5, () => this.comms('REBEL COMMAND', this.mission.boss ? 'The Tyrant is destroyed! You have done the impossible, Red Squadron!' : 'The Dominion is destroyed! Outstanding work, Red Squadron!', 'command'));
      this.after(4, () => this.completeMission());
    }

    onStationDestroyed() {
      if (this.mode !== 'mission') return;
      this.addScore(10000);
      this.after(2, () => this.comms('REBEL COMMAND', 'The battle station is gone! The Rebellion has won! Come home, Red Squadron.', 'command'));
      this.after(5, () => this.completeMission());
    }

    reachBeacon() {
      if (this.reached || this.state !== 'playing') return;
      this.reached = true;
      this.updateObjectives();
      this.addScore(3000 + Math.max(0, Math.round((this.mission.timeLimit - this.missionTime) * 40)));
      this.state = 'complete';
      this.hud.flashCenter('JUMPING TO LIGHTSPEED', 3);
      this.comms('RED LEADER', 'Beacon reached — punch it!');
      this.hyper.start();
      SW.Audio.hyperspace();
      this.after(3.2, () => this.showResult(true));
    }

    completeMission() {
      if (this.state !== 'playing' || !this.player || !this.player.alive) return;
      this.state = 'complete';
      this.hud.flashCenter(this.mission.final ? 'VICTORY' : 'MISSION COMPLETE', 4);
      this.comms('RED LEADER', 'Nice work, everyone. Form up and prepare for the jump home.');
      this.after(4.5, () => this.showResult(true));
    }

    failMission(reason) {
      if (this.state !== 'playing') return;
      this.state = 'failed';
      this.failReason = reason;
      this.hud.flashCenter('MISSION FAILED', 3.5, true);
      SW.Audio.alarm();
      this.after(4, () => this.showResult(false, reason));
    }

    playerDied() {
      if (this.state === 'complete') return; // already jumping out / won
      const wasFailed = this.state === 'failed';
      this.state = 'dead';
      this.deathPos = this.player.pos.clone();
      this.fx.explosion(this.deathPos, 2.5);
      this.fx.addShake(1.2);
      SW.Audio.stopEngine();
      this.hud.flashCenter('YOUR X-WING HAS BEEN DESTROYED', 3.5, true);
      const wm = this.ships.find((s) => s.alive && s.isWingman);
      if (wm) this.after(1, () => this.comms(wm.name, "No! We've lost Red Leader!"));
      if (!wasFailed) this.after(4, () => this.showResult(false));
    }

    showResult(success, reason) {
      if (this.state === 'result') return;
      const M = this.mission;
      this.state = 'result';
      SW.Input.enabled = false;
      SW.Input.exitLock();
      SW.Audio.stopEngine();
      this.hud.show(false);
      const acc = this.stats.shots ? Math.round((100 * this.stats.hits) / this.stats.shots) : 0;
      let bonus = 0;
      if (success) {
        bonus += Math.max(0, Math.round(3000 - this.missionTime * 8));
        bonus += Math.round(Math.max(0, this.player ? this.player.hp : 0) * 15);
        bonus += acc * 20;
        if (M.boss) bonus += 3000;
      }
      if (M.type === 'endless') bonus = this.wave * 250;
      this.score += bonus;
      if (this.score > (SW.settings.highScore || 0)) SW.settings.highScore = this.score;
      if (success) SW.settings.unlocked = Math.max(SW.settings.unlocked, Math.min(SW.MISSIONS.length, this.missionIndex + 2));
      SW.saveSettings();

      const title = $('result-title');
      if (M.type === 'endless') {
        title.textContent = 'THE LINE HAS FALLEN';
        title.className = 'fail';
        $('result-text').textContent = `You held out for ${this.wave} waves against the Imperial onslaught. The Rebellion will remember your sacrifice.`;
      } else if (success) {
        title.textContent = M.final ? 'THE GALAXY IS FREE' : M.boss ? 'BOSS DEFEATED' : 'MISSION COMPLETE';
        title.className = '';
        $('result-text').textContent = (M.outro || 'Outstanding flying, Red Leader. The Alliance is one step closer to victory.') +
          (M.final ? ' CAMPAIGN COMPLETE — ENDLESS MODE UNLOCKED.' : '');
      } else {
        title.textContent = 'MISSION FAILED';
        title.className = 'fail';
        $('result-text').textContent = reason || 'Your X-wing was destroyed. Regroup and try again, pilot — the Rebellion needs you.';
      }
      const rows = [
        ['Location', SW.ENVS[this.missionEnvKey] ? SW.ENVS[this.missionEnvKey].name.split(' — ')[0] : '—'],
        ['Imperial kills', this.stats.kills],
        ['Accuracy', acc + '%'],
        ['Mission time', SW.util.fmtTime(this.missionTime)],
      ];
      if (M.type === 'endless') rows.push(['Waves survived', this.wave]);
      rows.push(['Bonus', bonus.toLocaleString()], ['FINAL SCORE', this.score.toLocaleString()], ['High score', (SW.settings.highScore || 0).toLocaleString()]);
      $('result-stats').innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
      $('btn-next').classList.toggle('hidden', !(success && this.missionIndex < SW.MISSIONS.length - 1));
      $('btn-retry').textContent = success ? 'REPLAY' : 'RETRY';
      this.showScreen('result');
    }

    breakApart(ship) {
      const parts = ship.model.children.filter((c) => c.isGroup || (c.isMesh && Math.abs(c.position.x) > 1.8));
      const n = Math.min(parts.length, ship.type === 'xwing' ? 3 : 2);
      for (let i = 0; i < n; i++) {
        const part = parts.splice(Math.floor(Math.random() * parts.length), 1)[0];
        this.scene.attach(part);
        part.getWorldPosition(_v);
        const out = _v.clone().sub(ship.pos);
        if (out.lengthSq() < 0.01) randomUnit(out);
        out.normalize().multiplyScalar(rand(12, 30)).addScaledVector(ship.velocity, 0.5);
        this.wrecks.push({ obj: part, vel: out, spin: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-3, 3)), life: rand(3, 5) });
      }
    }

    sound3D(kind, pos, arg, mul = 1) {
      if (!SW.Audio.ready || this.state === 'paused') return;
      _v.copy(pos).applyMatrix4(this.camera.matrixWorldInverse);
      const d = _v.length();
      const pan = clamp(_v.x / (Math.abs(_v.z) + 40), -1, 1) * 0.8;
      if (kind === 'laser') SW.Audio.laser(arg, mul * Math.min(1, 50 / (d + 20)), pan);
      else if (kind === 'explosion') SW.Audio.explosion(Math.min(arg || 1, 4), Math.min(1.3, (150 * (arg || 1)) / (d + 80)), pan);
      else if (kind === 'spark') SW.Audio.spark(Math.min(0.4, 20 / (d + 20)), pan);
    }

    /* ======================== MAIN LOOP ======================== */
    loop(now) {
      requestAnimationFrame((t) => this.loop(t));
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.state !== 'paused') this.update(dt);
      this.render();
      SW.Input.endFrame();
    }

    update(dt) {
      this.time += dt;
      this.frame++;
      const st = this.state;
      if (ACTIVE.includes(st)) this.missionTime += dt;

      if (this.events.length) {
        const due = this.events.filter((e) => e.t <= this.time);
        if (due.length) {
          this.events = this.events.filter((e) => e.t > this.time);
          due.forEach((e) => e.fn());
        }
      }

      this.refreshTargets();

      if (st === 'hyperspace') {
        const k = this.hyper.update(dt);
        this.fx.addShake(0.02);
        if (k >= 0.82 && !this.world.visible) this.onHyperspaceEnd();
      } else if (this.hyper.active) this.hyper.update(dt);

      if (this.player && this.player.alive && this.pc) {
        this.pc.update(dt, ACTIVE.includes(this.state));
        if (this.state === 'hyperspace') this.player.speed = 110;
      }

      for (const s of this.ships) {
        if (this.state === 'hyperspace' && !s.isPlayer) {
          s.speed = this.player ? this.player.speed : s.speed;
          s.updateFwd();
          s.velocity.copy(s.fwd).multiplyScalar(s.speed);
          s.obj.position.addScaledVector(s.velocity, dt);
          continue;
        }
        s.update(dt);
      }
      if (this.state !== 'hyperspace') for (const t of this.transports) t.update(dt);
      for (const b of this.bigs) b.update(dt);
      this.bolts.update(dt);
      this.torpedoes.update(dt);
      this.collisions(dt);
      if (this.mode === 'mission' && this.mission) this.updateMission(dt);

      for (const s of this.ships) {
        if (!s.alive || s.team !== 'empire') continue;
        const d = s.pos.distanceTo(this.camera.position);
        if (d < 55 && !s.screamed) { s.screamed = true; SW.Audio.scream(Math.min(1, 40 / d), 0); }
        else if (d > 200) s.screamed = false;
      }

      for (let i = this.wrecks.length - 1; i >= 0; i--) {
        const w = this.wrecks[i];
        w.life -= dt;
        w.obj.position.addScaledVector(w.vel, dt);
        w.obj.rotation.x += w.spin.x * dt; w.obj.rotation.y += w.spin.y * dt; w.obj.rotation.z += w.spin.z * dt;
        if (w.life > 1.5 && Math.random() < 0.5) {
          w.obj.getWorldPosition(_v);
          this.fx.damageSmoke(_v, ZERO, true);
        }
        if (w.life <= 0) { this.scene.remove(w.obj); disposeObject(w.obj); this.wrecks.splice(i, 1); }
      }

      if (this.frame % 30 === 0) {
        const dead = this.ships.filter((s) => !s.alive);
        if (dead.length) {
          dead.forEach((s) => disposeObject(s.obj));
          this.ships = this.ships.filter((s) => s.alive);
        }
        const gone = this.transports.filter((t) => !t.alive);
        if (gone.length) {
          gone.forEach((t) => disposeObject(t.obj));
          this.transports = this.transports.filter((t) => t.alive);
        }
      }

      if (this.beacon) {
        this.beacon.userData.t1.rotation.z += dt * 0.8;
        this.beacon.userData.t2.rotation.z -= dt * 1.3;
      }

      this.world.update(dt, this.camera);
      this.fx.update(dt);
      this.updateCamera(dt);

      if (this.player && this.player.alive && this.mode === 'mission') {
        let n = 0;
        for (const s of this._tg.empire) if (s.kind === 'fighter' && s.pos.distanceTo(this.player.pos) < 900) n++;
        SW.Audio.setIntensity(clamp(0.3 + n * 0.12 + (this.boss ? 0.3 : 0), 0.3, 1));
      }

      const cs = this.state;
      const inGame = this.mode === 'mission' && (ACTIVE.includes(cs) || cs === 'hyperspace' || cs === 'dead');
      if (inGame) {
        this.hud.update(dt);
        this.hud.draw(this.camera);
      } else if (this.hud.whiteV > 0) this.hud.update(dt);
    }

    // per-frame mission logic: waves, timers, debris, beacons, bosses
    updateMission(dt) {
      const M = this.mission;
      const p = this.player;
      if (this.state !== 'playing') return;

      // waves
      this.waveCooldown -= dt;
      const alive = this.countEnemyFighters();
      if (M.type === 'endless') {
        if (this.wave > 0 && alive <= 1 && this.waveCooldown <= 0) { this.nextEndlessWave(); this.waveCooldown = 6; }
      } else if (M.survival) {
        this.survTimer -= dt;
        const sv = M.objectives[0];
        if (this.missionTime < sv.time - 8 && (this.survTimer <= 0 || (alive <= 1 && this.survTimer < 14))) {
          this.wave++;
          const n = Math.min(12, 3 + this.wave);
          const ni = Math.round(n * Math.min(0.6, 0.1 * this.wave));
          this.spawnWave([['tie', n - ni], ['interceptor', ni]]);
          this.hud.flashCenter('WAVE ' + this.wave, 2);
          this.survTimer = 24;
        }
      } else if (M.waves && M.waves.length) {
        if (this.waveIdx >= M.waves.length && M.loopFrom !== undefined) this.waveIdx = M.loopFrom;
        const W = M.waves[this.waveIdx];
        if (W && this.waveCooldown <= 0) {
          const ready = W.at !== undefined ? this.missionTime >= W.at : alive <= (W.when || 0);
          if (ready) {
            if (W.boss) this.spawnBoss();
            if (W.spawn) this.spawnWave(W.spawn, { behind: W.behind });
            this.waveIdx++;
            this.waveCooldown = 6;
          }
        }
      }

      // mission clocks
      if (M.timeLimit && this.missionTime >= M.timeLimit) { this.failMission(M.timeoutText); return; }
      if (M.countdown && this.station) {
        const left = M.countdown - this.missionTime;
        this.station.charge = clamp(this.missionTime / M.countdown, 0, 1);
        if (left < 60 && !this.warn60) { this.warn60 = true; this.hud.flashCenter('SUPERLASER: 60 SECONDS', 2.5, true); this.comms('REBEL COMMAND', 'One minute until the superlaser fires! Hurry!', 'command'); SW.Audio.alarm(); }
        if (left < 30 && !this.warn30) { this.warn30 = true; this.hud.flashCenter('SUPERLASER: 30 SECONDS', 2.5, true); SW.Audio.alarm(); }
        if (left <= 0 && this.station.state === 'active') {
          this.station.fireSuperlaser();
          this.failMission(M.timeoutText);
          return;
        }
      }
      const sv = M.objectives.find((o) => o.type === 'survive');
      if (sv && this.missionTime >= sv.time && !this.completing) {
        this.completing = true;
        this.hud.flashCenter('SHIELD ONLINE', 3);
        this.comms('BASE COMMAND', 'Planetary shield is up! You did it, Red Squadron!', 'command');
        this.after(2, () => this.completeMission());
      }

      // escort / convoy / reach objectives update periodically
      if (this.frame % 20 === 0 && (M.transports || M.field)) this.updateObjectives();

      // asteroid run: beacon + incoming debris
      if (M.field && p && p.alive) {
        if (p.pos.distanceTo(this.waypoint.pos) < 90) { this.reachBeacon(); return; }
        this.debrisTimer -= dt;
        if (this.debrisTimer <= 0 && p.pos.z < M.field.goalZ - 400) {
          this.debrisTimer = M.field.debrisRate * rand(0.6, 1.4);
          const n = Math.random() < 0.3 ? 2 : 1;
          for (let i = 0; i < n; i++) {
            const pos = p.pos.clone().addScaledVector(p.fwd, rand(600, 850)).add(randomUnit(_v).multiplyScalar(rand(20, 160)));
            const size = Math.random() < 0.15 ? rand(35, 55) : rand(8, 26);
            const vel = p.pos.clone().addScaledVector(p.velocity, 1.2).sub(pos).normalize().multiplyScalar(rand(45, 90));
            this.world.addAsteroid(pos, size, { vel, life: 22, spin: 1.2 });
          }
          if (Math.random() < 0.18) this.chatter('R2 UNIT', SW.CHATTER.debris, 1);
        }
        for (let i = this.world.asteroids.length - 1; i >= 0; i--) {
          const a = this.world.asteroids[i];
          if (a.userData.life === undefined) continue;
          a.userData.life -= dt;
          if (a.userData.life <= 0) this.world.removeAsteroid(a);
        }
      }
    }

    collisions(dt) {
      const p = this.player;
      for (const s of this.ships) {
        if (!s.alive || s.isPlayer) continue;
        if (this.hullHit(s.pos)) { s.destroy(null); continue; }
        for (const a of this.world.asteroids) {
          const r = a.userData.radius + s.radius * 0.5;
          if (s.pos.distanceToSquared(a.position) < r * r) {
            if (s.team === 'rebel') { // wingmen glance off rocks instead of dying outright
              s.obj.position.copy(s.prevPos);
              s.takeDamage(30, null, s.pos);
              s.ai.state = 'evade'; s.ai.timer = 1;
              s.ai.evadeDir.subVectors(s.pos, a.position).normalize();
            } else s.destroy(null);
            break;
          }
        }
      }
      if (!p || !p.alive || this.state === 'hyperspace') return;
      this.bumpCooldown = (this.bumpCooldown || 0) - dt;
      if (this.bumpCooldown > 0) return;
      let bump = null, bumpBig = null;
      for (const b of this.bigs) if (b.hitsHull(p.pos, 1.5)) { bump = 'hull'; bumpBig = b; break; }
      if (!bump) {
        for (const a of this.world.asteroids) {
          const r = a.userData.radius + 3;
          if (p.pos.distanceToSquared(a.position) < r * r) { bump = a; break; }
        }
      }
      if (!bump) {
        for (const t of this.transports) if (t.alive && t.hitTest(p.prevPos, p.pos, 2)) { bump = 'transport'; bumpBig = t; break; }
      }
      if (bump) {
        const dmg = 12 + p.speed * 0.25;
        p.takeDamage(dmg, null, p.pos);
        if (!p.alive) return;
        p.obj.position.copy(p.prevPos);
        if (bump === 'hull') { if (!bumpBig.avoid(p, _v)) _v.subVectors(p.pos, bumpBig.group.position).normalize(); }
        else if (bump === 'transport') _v.subVectors(p.pos, bumpBig.pos).normalize();
        else _v.subVectors(p.pos, bump.position).normalize();
        const m = new THREE.Matrix4().lookAt(_v, ZERO, _v2.set(0, 1, 0).applyQuaternion(p.obj.quaternion));
        _q.setFromRotationMatrix(m);
        p.obj.quaternion.rotateTowards(_q, 0.8);
        p.speed *= 0.4;
        this.fx.sparks(p.pos, null, 30, 60);
        this.fx.addShake(0.8);
        this.hud.flashSub('COLLISION WARNING', 1.2);
        this.bumpCooldown = 0.4;
        return;
      }
      for (const s of this.ships) {
        if (!s.alive || s.team !== 'empire') continue;
        const r = p.radius * 0.6 + s.radius * 0.7;
        if (p.pos.distanceToSquared(s.pos) < r * r) {
          if (s.isBoss) s.takeDamage(120, p, s.pos); else s.destroy(p);
          p.takeDamage(35, s, p.pos);
          this.bumpCooldown = 0.4;
          break;
        }
      }
    }

    snapCamera() {
      if (!this.player) return;
      this.player.obj.updateMatrixWorld();
      this.camera.position.copy(this.player.obj.localToWorld(_v.set(0, 3.6, -16)));
      this.camera.quaternion.copy(this.player.obj.quaternion).multiply(FLIP);
    }

    updateCamera(dt) {
      const cam = this.camera;
      const p = this.player;
      let fov = this.baseFov;
      if (this.mode === 'attract' || (this.state === 'result' && !(p && p.alive))) {
        let n = 0;
        _v2.set(0, 0, 0);
        for (const s of this.ships) if (s.alive) { _v2.add(s.pos); n++; }
        if (n) _v2.divideScalar(n);
        this.camTarget.lerp(_v2, damp(0.8, dt));
        this.attractAngle += dt * 0.07;
        const R = this.state === 'crawl' ? 60 : 190;
        _v.set(Math.cos(this.attractAngle) * R, 45 + Math.sin(this.attractAngle * 0.7) * 25, Math.sin(this.attractAngle) * R).add(this.camTarget);
        cam.position.lerp(_v, damp(2, dt));
        if (this.state === 'crawl') cam.lookAt(_v.set(cam.position.x + 30, cam.position.y + 100, cam.position.z + 10));
        else cam.lookAt(this.camTarget);
      } else if (this.state === 'dead' && this.deathPos) {
        this.attractAngle += dt * 0.25;
        _v.set(Math.cos(this.attractAngle) * 60, 20, Math.sin(this.attractAngle) * 60).add(this.deathPos);
        cam.position.lerp(_v, damp(1.5, dt));
        cam.lookAt(this.deathPos);
      } else if (p && p.alive) {
        p.obj.updateMatrixWorld();
        if (this.cockpit) {
          cam.position.copy(p.obj.localToWorld(_v.set(0, 1.12, 0.55)));
          cam.quaternion.copy(p.obj.quaternion).multiply(FLIP);
        } else {
          const back = -16 - (p.speed - 75) * 0.03;
          _v.set(0, 3.8, back);
          p.obj.localToWorld(_v);
          cam.position.lerp(_v, damp(14, dt));
          _q.copy(p.obj.quaternion).multiply(FLIP);
          cam.quaternion.slerp(_q, damp(10, dt));
        }
        if (this.pc && this.pc.boosting) fov += 12;
        if (this.state === 'hyperspace' || (this.reached && this.hyper.active)) fov += 20;
      }
      const sh = this.fx.shake;
      if (sh > 0.001) {
        cam.position.add(_v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(sh * 0.6));
        cam.rotateZ(rand(-1, 1) * sh * 0.01);
      }
      if (Math.abs(cam.fov - fov) > 0.05) {
        cam.fov += (fov - cam.fov) * damp(4, dt);
        cam.updateProjectionMatrix();
        this.fx.setScale(window.innerHeight * this.renderer.getPixelRatio(), cam.fov);
      }
      cam.updateMatrixWorld();
      if (p && p.alive && this.cockpitApplied !== this.cockpit) {
        this.cockpitApplied = this.cockpit;
        p.model.traverse((o) => { if (o.userData.cockpitHide) o.visible = !this.cockpit; });
      }
    }

    render() {
      if (SW.settings.bloom) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
    }
  }

  function disposeObject(obj) {
    obj.traverse((o) => {
      if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose();
      if (o.material && (o.isSprite || o.material.isShaderMaterial || o.material.isLineBasicMaterial)) o.material.dispose();
    });
  }

  window.addEventListener('load', () => {
    try {
      SW.game = new Game();
    } catch (e) {
      console.error(e);
      document.querySelector('#loading .load-text').textContent = 'ERROR: ' + e.message + ' — WebGL is required.';
    }
  });
})();
