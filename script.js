(() => {
  const $ = id => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- clock (?demo=10 pretends midnight is 10 seconds away) ----------
  const nextNewYear = d => new Date(d.getFullYear() + 1, 0, 1);
  let offset = 0;
  const demo = Number(q.get('demo'));
  if (demo > 0) offset = nextNewYear(new Date()) - Date.now() - demo * 1000;
  const now = () => new Date(Date.now() + offset);

  // ---------- personal card ----------
  const clean = s => (s || '').trim().slice(0, 160);
  const to = clean(q.get('to')), from = clean(q.get('from')), msg = clean(q.get('msg'));
  if (to) { $('dear').textContent = `Dear ${to},`; $('dear').hidden = false; }
  if (msg || from) { $('msg').textContent = `${msg ? `“${msg}”` : ''}${from ? `${msg ? ' — ' : '— '}${from}` : ''}`; $('msg').hidden = false; }
  if (to) document.title = `Happy New Year, ${to} ✦`;

  // ---------- year with flipping digits ----------
  const yearEl = $('year');
  function setYear(y, flip) {
    const s = String(y);
    if (yearEl.children.length !== s.length) yearEl.innerHTML = [...s].map(c => `<span class="d">${c}</span>`).join('');
    [...yearEl.children].forEach((el, i) => {
      if (el.textContent === s[i]) return;
      if (flip && !reduce) { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); setTimeout(() => { el.textContent = s[i]; }, 400); }
      else el.textContent = s[i];
    });
    yearEl.setAttribute('aria-label', s);
  }

  // ---------- wishes ----------
  const wishes = ['May your year be bright and kind', 'New year, new chapters, same good heart', 'Health, laughter and many small joys',
    'May every day bring something to look forward to', 'Brave starts and gentle endings', 'More sunrises, fewer worries'];
  let w = 0; const wishEl = $('wish');
  wishEl.textContent = wishes[0];
  setInterval(() => { wishEl.classList.add('out'); setTimeout(() => { w = (w + 1) % wishes.length; wishEl.textContent = wishes[w]; wishEl.classList.remove('out'); }, 600); }, 4800);

  // ---------- countdown ----------
  const pad = n => String(n).padStart(2, '0');
  let shown = 0, celebrated = false;
  function tick() {
    const t = now(), y = t.getFullYear();
    const festive = t.getMonth() === 0 && t.getDate() <= 7;      // the first week of January
    const target = nextNewYear(t), left = target - t;
    // the coming year, except in the last minute: show this year so it can flip at midnight
    const year = festive || left > 60000 ? (festive ? y : y + 1) : y;
    if (year !== shown) { setYear(year, shown !== 0); shown = year; }
    const chip = $('chip'), count = $('count');
    if (festive) {
      chip.textContent = `Welcome, ${y} ✦`;
      count.hidden = true; document.body.classList.remove('counting');
      if (!celebrated && t.getDate() === 1 && t.getHours() === 0 && t.getMinutes() < 1) { celebrated = true; finale(); }
    } else {
      const s = Math.floor(left / 1000), d = Math.floor(s / 86400);
      chip.textContent = d > 0 ? `${d} ${d === 1 ? 'day' : 'days'} · ${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)} until ${y + 1}`
        : `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)} until ${y + 1}`;
      document.body.classList.toggle('counting', s < 10 && s >= 0);
      if (s < 10 && s >= 0) {
        count.hidden = false;
        if (count.textContent !== String(s + 1)) { count.textContent = s + 1; count.classList.remove('tick'); void count.offsetWidth; count.classList.add('tick'); }
      } else count.hidden = true;
    }
  }
  setInterval(tick, 250); tick();

  // ---------- city skyline (drawn once per resize) ----------
  const city = $('city'), cx = city.getContext('2d');
  const sky = $('sky'), ctx = sky.getContext('2d');
  let W = 0, H = 0, dpr = 1, stars = [], horizon = 0;
  function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function drawCity() {
    cx.clearRect(0, 0, W, H);
    const r = rand(7), base = H, top = H * .72;
    horizon = top;
    const glow = cx.createLinearGradient(0, top - 80, 0, H);
    glow.addColorStop(0, 'rgba(255,150,90,0)'); glow.addColorStop(.5, 'rgba(255,150,90,.10)'); glow.addColorStop(1, 'rgba(255,150,90,.18)');
    cx.fillStyle = glow; cx.fillRect(0, top - 80, W, H);
    for (const layer of [{ c: '#141238', h: .55, w: [40, 90] }, { c: '#0b0a24', h: 1, w: [30, 70] }]) {
      let x = -10;
      while (x < W + 10) {
        const bw = layer.w[0] + r() * (layer.w[1] - layer.w[0]);
        let bh = (H - top) * layer.h * (.35 + r() * .65);
        if (r() < .06) bh *= 1.7;                                   // the odd tower
        const y = base - bh;
        cx.fillStyle = layer.c; cx.fillRect(x, y, bw - 2, bh);
        if (layer.h === 1 && bh > 120 && r() < .25) { cx.fillRect(x + bw / 2 - 2, y - 26, 3, 26); }   // antenna
        cx.fillStyle = 'rgba(255, 214, 140, .55)';
        for (let wy = y + 10; wy < base - 8; wy += 11) for (let wx = x + 6; wx < x + bw - 10; wx += 9) if (r() < .18) cx.fillRect(wx, wy, 3, 4);
        x += bw;
      }
    }
  }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    for (const c of [city, sky]) { c.width = W * dpr; c.height = H * dpr; }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round(W * H / 4500) }, () => ({ x: Math.random() * W, y: Math.random() * H * .75, r: Math.random() * 1.1 + .2, p: Math.random() * 6.3 }));
    drawCity();
  }
  addEventListener('resize', resize); resize();

  // ---------- fireworks (engine in fireworks.js) ----------
  const fw = createFireworks($('fx'), { reduceMotion: reduce });
  const finale = () => fw.play(fw.programs.finale);
  fw.play(fw.programs.ambient, { loop: true });                // a choreographed show, about 40 s per round
  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) { ctx.globalAlpha = reduce ? .6 : .3 + .5 * Math.sin(t / 900 + s.p) ** 2; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  sky.addEventListener('pointerdown', e => fw.launch({ x: e.clientX, y: Math.min(e.clientY, horizon - 40) }));
  $('launch').addEventListener('click', finale);

  // ---------- send a card ----------
  const sheet = $('sheet'), form = $('form'), hint = $('hint');
  const cardUrl = () => {
    const u = new URL(location.origin + location.pathname);
    for (const k of ['to', 'from', 'msg']) { const v = form.elements[k].value.trim(); if (v) u.searchParams.set(k, v); }
    return u.toString();
  };
  $('send').addEventListener('click', () => { hint.textContent = ''; if (to) form.elements.to.value = ''; sheet.showModal(); });
  if (navigator.share) $('share').hidden = false;
  $('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(cardUrl()); hint.textContent = 'Link copied — paste it anywhere ✦'; }
    catch { hint.textContent = cardUrl(); }
  });
  $('share').addEventListener('click', () => navigator.share({ title: 'Happy New Year ✦', text: 'A little New Year card for you', url: cardUrl() }).catch(() => {}));
})();
