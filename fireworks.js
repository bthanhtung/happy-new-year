/*
 * Fireworks engine shared by happy-new-year and count-down.
 *
 * Physics run in real seconds (not per frame), so the show looks the same on 60 Hz and 120 Hz screens.
 * Timings follow real aerial shells: a shell climbs for 2-3 s, its stars burst out fast, slow down in the air,
 * hang for a moment and fall; plain stars burn about 2 s, gold willows droop for 5 s or more.
 *
 *   const fw = createFireworks(canvas, { reduceMotion });
 *   fw.launch({ x, y, type: 'peony', colors: ['#ffd36e', '#fff1c2'] });
 *   fw.play(fw.programs.ambient, { loop: true });   // choreographed show
 *   fw.play(fw.programs.finale);
 */
(function (global) {
  'use strict';

  const PALETTES = {
    gold: ['#ffd36e', '#fff1c2'], red: ['#ff4d4d', '#ffd2c2'], pink: ['#ff6f91', '#ffd2dd'],
    blue: ['#7ad7ff', '#e0f6ff'], violet: ['#b28cff', '#eadfff'], green: ['#7dffb2', '#e6fff0'],
    orange: ['#ff8a3d', '#ffe0c7'], white: ['#ffffff', '#fff6dc'],
  };
  const NAMES = Object.keys(PALETTES);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rand = (a, b) => a + Math.random() * (b - a);

  function createFireworks(canvas, options = {}) {
    const ctx = canvas.getContext('2d');
    const reduce = !!options.reduceMotion;
    let W = 0, H = 0, dpr = 1;
    let shells = [], stars = [], flashes = [], cues = [], clock = 0, running = false, lastT = 0;
    let loopProgram = null, loopEnd = 0;

    function resize() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      W = canvas.clientWidth || global.innerWidth;
      H = canvas.clientHeight || global.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    global.addEventListener('resize', resize);

    const scale = () => Math.min(H, W * 1.3);             // burst size follows the smaller screen side
    const density = () => (W < 600 ? 0.6 : 1);           // fewer stars on phones

    /** Fires one shell. x/y are the burst point (defaults are random); `delay` is in seconds. */
    function launch(o = {}) {
      if (reduce) return;
      const caliber = o.caliber ?? rand(0.8, 1.2);
      const x = o.x ?? W * rand(0.15, 0.85);
      const y = o.y ?? H * rand(0.14, 0.4);
      const fromX = o.fromX ?? x + rand(-0.04, 0.04) * W;
      const rise = o.rise ?? 2.0 + caliber * rand(0.6, 1.0);            // seconds to the top
      const h = H + 10 - y;
      shells.push({
        x: fromX, y: H + 10, vx: (x - fromX) / rise, vy: -2 * h / rise, g: 2 * h / (rise * rise),
        t: 0, rise, caliber, type: o.type ?? pick(['peony', 'peony', 'chrysanthemum', 'pistil', 'ring', 'crossette']),
        colors: o.colors ?? PALETTES[o.palette ?? pick(NAMES)], trail: o.trail ?? true, emit: 0,
      });
      ensureRunning();
    }

    function addStar(s, angle, speed, extra) {
      stars.push(Object.assign({
        x: s.x, y: s.y, px: s.x, py: s.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        drag: 1.9, g: H * 0.045, life: rand(1.8, 2.5), age: 0, size: 1.7, color: s.colors[0],
        change: Math.random() < 0.5 ? s.colors[1] : null, glitter: false, split: 0, trail: false,
      }, extra));
    }

    /** Uniform directions on a sphere, projected: denser at the rim, like a real round shell seen from below. */
    function sphereSpeed(v) {
      const z = rand(-1, 1);
      return v * Math.sqrt(1 - z * z) * rand(0.9, 1.05);
    }

    function burst(s) {
      const R = scale() * 0.17 * s.caliber;               // final radius of the burst
      const k = 1.9;                                       // air drag; a star travels about v0 / k
      const n = Math.round(90 * s.caliber * density());
      flashes.push({ x: s.x, y: s.y, r: R * 0.35, age: 0, life: 0.18, color: s.colors[1] });   // brief: it accumulates over frames
      switch (s.type) {
        case 'willow': {
          for (let i = 0; i < n * 0.8; i++) {
            addStar(s, rand(0, Math.PI * 2), sphereSpeed(R * 1.25), {
              drag: 1.25, g: H * 0.03, life: rand(4.5, 6), color: '#ffcf6b', change: '#c8822e', size: 1.5,
              glitter: true, trail: true,
            });
          }
          break;
        }
        case 'ring': {
          const tilt = rand(0.25, 1), rot = rand(0, Math.PI);
          for (let i = 0; i < n * 0.7; i++) {
            const a = (i / (n * 0.7)) * Math.PI * 2;
            const vx = Math.cos(a) * R * k, vy = Math.sin(a) * R * k * tilt;
            const ang = Math.atan2(vy, vx) + rot, sp = Math.hypot(vx, vy);
            addStar(s, ang, sp, { life: rand(1.6, 2.1) });
          }
          break;
        }
        case 'crossette': {
          for (let i = 0; i < 12; i++) {
            addStar(s, (i / 12) * Math.PI * 2, R * k * 0.75, { split: 0.75, size: 2.2, trail: true, life: 2.6 });
          }
          break;
        }
        case 'pistil': {                                   // peony with an inner core of another colour
          const core = PALETTES[pick(NAMES)];
          for (let i = 0; i < n; i++) addStar(s, rand(0, Math.PI * 2), sphereSpeed(R * k));
          for (let i = 0; i < n * 0.35; i++) {
            addStar(s, rand(0, Math.PI * 2), sphereSpeed(R * k * 0.42), { color: core[0], change: core[1], life: rand(1.3, 1.7) });
          }
          break;
        }
        case 'chrysanthemum': {                            // stars leave glittering trails
          for (let i = 0; i < n; i++) addStar(s, rand(0, Math.PI * 2), sphereSpeed(R * k), { trail: true, glitter: Math.random() < 0.4 });
          break;
        }
        case 'strobe': {                                   // white flashing stars, used in the finale
          for (let i = 0; i < n * 0.6; i++) {
            addStar(s, rand(0, Math.PI * 2), sphereSpeed(R * k * 0.9), { color: '#ffffff', change: null, strobe: rand(0, 6), life: rand(2.2, 3) });
          }
          break;
        }
        case 'heart': {
          for (let i = 0; i < 80 * density(); i++) {
            const t = (i / (80 * density())) * Math.PI * 2;
            const hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
            stars.push({
              x: s.x, y: s.y, px: s.x, py: s.y, vx: hx * R * k / 17, vy: hy * R * k / 17, drag: k, g: H * 0.02,
              life: 2.2, age: 0, size: 1.9, color: s.colors[0], change: s.colors[1], glitter: false, split: 0, trail: false,
            });
          }
          break;
        }
        default: {                                         // peony
          for (let i = 0; i < n; i++) addStar(s, rand(0, Math.PI * 2), sphereSpeed(R * k));
        }
      }
    }

    function splitStar(p) {
      for (let j = 0; j < 4; j++) {
        const a = (j * Math.PI) / 2 + Math.PI / 4 + Math.atan2(p.vy, p.vx);
        stars.push({ ...p, px: p.x, py: p.y, vx: p.vx * 0.3 + Math.cos(a) * scale() * 0.12, vy: p.vy * 0.3 + Math.sin(a) * scale() * 0.12,
          age: 0, life: 1.2, split: 0, size: 1.5, trail: true });
      }
    }

    function step(dt) {
      const wind = H * 0.012;
      // fade what was drawn before: this leaves short light trails, like long-exposure eyes see them
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${1 - Math.exp(-dt * 7)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      flashes = flashes.filter(f => {
        f.age += dt;
        const a = 1 - f.age / f.life;
        if (a <= 0) return false;
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        grad.addColorStop(0, `rgba(255,250,235,${0.07 * a})`);
        grad.addColorStop(1, 'rgba(255,250,235,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
        return true;
      });

      shells = shells.filter(s => {
        s.t += dt;
        s.x += s.vx * dt + Math.sin(s.t * 20) * 0.15;        // a little wobble on the way up
        s.y += s.vy * dt;
        s.vy += s.g * dt;
        if (s.trail) {
          s.emit += dt;
          while (s.emit > 0.016) {
            s.emit -= 0.016;
            stars.push({ x: s.x + rand(-1, 1), y: s.y + 4, px: s.x, py: s.y + 4, vx: rand(-6, 6), vy: rand(10, 30), drag: 2, g: H * 0.02,
              life: rand(0.35, 0.6), age: 0, size: 1.1, color: '#ffc985', change: null, glitter: true, split: 0, trail: false });
          }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff2cf';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.8, 0, 7);
        ctx.fill();
        if (s.t >= s.rise) {
          burst(s);
          return false;
        }
        return true;
      });

      const born = [];
      stars = stars.filter(p => {
        p.age += dt;
        if (p.age >= p.life) return false;
        const decay = Math.exp(-p.drag * dt);
        p.px = p.x;
        p.py = p.y;
        p.vx = p.vx * decay + wind * dt * 0.6;
        p.vy = p.vy * decay + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.split && p.age >= p.split) {
          p.split = 0;
          born.push(p);
          return false;
        }
        const t = p.age / p.life;
        let alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        if (p.glitter && t > 0.45 && Math.random() < 0.35) alpha *= 0.25;
        if (p.strobe !== undefined) alpha *= Math.sin(p.age * 28 + p.strobe) > 0.2 ? 1 : 0.1;
        ctx.globalAlpha = Math.max(0, alpha);
        const color = p.change && t > 0.55 ? p.change : p.color;
        ctx.strokeStyle = color;
        ctx.lineWidth = p.size * (p.trail ? 1 : 1.15);
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        return true;
      });
      born.forEach(splitStar);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function frame(t) {
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
      lastT = t;
      clock += dt;
      while (cues.length && cues[0].at <= clock) launch(cues.shift().shell);
      if (loopProgram && !cues.length && clock >= loopEnd) schedule(loopProgram);
      step(dt);
      if (shells.length || stars.length || flashes.length || cues.length || loopProgram) {
        global.requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, W, H);
        running = false;
      }
    }

    function ensureRunning() {
      if (running || reduce) return;
      running = true;
      lastT = global.performance.now();
      global.requestAnimationFrame(frame);
    }

    function schedule(program) {
      const list = program(W, H);
      let end = 0;
      for (const c of list) {
        cues.push({ at: clock + c.at, shell: c });
        end = Math.max(end, c.at);
      }
      cues.sort((a, b) => a.at - b.at);
      loopEnd = clock + end + (program.rest ?? 0);
    }

    /** Plays a choreographed program; with loop: true it repeats until stop(). */
    function play(program, opts = {}) {
      if (reduce) return;
      if (opts.loop) loopProgram = program;
      schedule(program);
      ensureRunning();
    }

    function stop() {
      loopProgram = null;
      cues = [];
    }

    return { launch, play, stop, resize, programs: PROGRAMS, palettes: PALETTES };
  }

  // ---------- choreography ----------
  // A program returns cues { at (s), x, y, type, palette, caliber }. Positions are fractions of the screen.
  const at = (W, H, fx, fy) => ({ x: W * fx, y: H * fy });

  /** About 34 s, modelled on the structure of Vietnamese New Year art displays: an opening salvo, single shells in
   *  tempo, symmetric pairs, a fan of gold willows, a themed centrepiece, then a breath of dark sky. */
  function ambient(W, H) {
    const c = [];
    const side = pick(['gold', 'red']);
    // opening: three shells together
    [0.25, 0.5, 0.75].forEach((fx, i) => c.push({ at: 0, ...at(W, H, fx, i === 1 ? 0.18 : 0.26), type: 'peony', palette: side, caliber: 1.1 }));
    // tempo: one shell every 2.6 s
    ['pistil', 'chrysanthemum', 'ring', 'pistil'].forEach((type, i) =>
      c.push({ at: 4.5 + i * 2.6, ...at(W, H, rand(0.25, 0.75), rand(0.16, 0.32)), type, palette: pick(NAMES) }));
    // symmetric pairs
    for (let i = 0; i < 2; i++) {
      const p = pick(NAMES), y = rand(0.2, 0.3);
      c.push({ at: 15.5 + i * 2.8, ...at(W, H, 0.28, y), type: 'crossette', palette: p });
      c.push({ at: 15.5 + i * 2.8, ...at(W, H, 0.72, y), type: 'crossette', palette: p });
    }
    // fan of gold willows
    [0.2, 0.35, 0.5, 0.65, 0.8].forEach((fx, i) => c.push({ at: 22 + i * 0.35, ...at(W, H, fx, 0.2 + Math.abs(fx - 0.5) * 0.25), type: 'willow', caliber: 1 }));
    // centrepiece
    c.push({ at: 28.5, ...at(W, H, 0.5, 0.22), type: 'heart', palette: pick(['pink', 'red']), caliber: 1.2 });
    c.push({ at: 29.2, ...at(W, H, 0.5, 0.22), type: 'ring', palette: 'gold', caliber: 1.3 });
    return c;
  }
  ambient.rest = 5;

  /** About 16 s: a crescendo that ends with a wall of gold willows and strobes, then silence. */
  function finale(W, H) {
    const c = [];
    let t = 0, gap = 1.1;
    while (t < 10) {                                         // shells come faster and faster
      c.push({ at: t, ...at(W, H, rand(0.15, 0.85), rand(0.14, 0.34)), type: pick(['peony', 'chrysanthemum', 'pistil', 'ring', 'crossette']), palette: pick(NAMES) });
      t += gap;
      gap = Math.max(0.28, gap * 0.86);
    }
    for (let i = 0; i < 7; i++) c.push({ at: 10.5 + i * 0.12, ...at(W, H, 0.12 + i * 0.127, rand(0.16, 0.24)), type: 'willow', caliber: 1.15 });
    for (let i = 0; i < 4; i++) c.push({ at: 11.2 + i * 0.2, ...at(W, H, rand(0.25, 0.75), rand(0.2, 0.3)), type: 'strobe', caliber: 1 });
    return c;
  }

  /** A short salvo for a button press: three shells 0.7 s apart. */
  function salvo(W, H) {
    return [0, 0.7, 1.4].map((t, i) => ({ at: t, ...at(W, H, 0.3 + i * 0.2, rand(0.18, 0.3)), palette: pick(NAMES) }));
  }

  const PROGRAMS = { ambient, finale, salvo };
  global.createFireworks = createFireworks;
})(window);
