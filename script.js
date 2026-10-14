/* ============================================================
   Os projetos, o showreel e os dados de contato ficam em projects.json.
   Para editar, use o painel: http://localhost:3000/admin
   (abra com o arquivo iniciar.bat)
   ============================================================ */
let SHOWREEL = { title: 'Showreel', category: '', video: '' };
let PROJECTS = [];
let PROFILE = {};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = navigator.connection?.saveData;

const ART = {
  run:    '<div class="art art-run"><i></i><i></i><i></i><i></i><span class="runner"></span></div>',
  tv:     '<div class="art art-tv"><div class="set"><div class="scr"><i></i><i></i></div></div></div>',
  glitch: '<div class="art art-glitch"><i></i><i></i><i></i><span class="tri"></span></div>',
  eq:     '<div class="art art-eq"><div class="bars"><i></i><i></i><i></i><i></i><i></i></div></div>',
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isFile = v => /\.(mp4|webm|mov)(\?|$)/i.test(v || '');
const ytId = url => (url || '').match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/)?.[1];
const vimeoId = url => (url || '').match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([\da-f]{6,}))?/);

// Nome com letras animadas
const nameEl = $('#name');
let n = 0;
nameEl.innerHTML = nameEl.textContent.trim().split(' ').map(w =>
  `<span class="word" aria-hidden="true">${[...w].map(c => `<span class="ch" style="--i:${n++}">${c}</span>`).join('')}</span>`
).join(' ');

// ---------- Players ----------
// Player completo (com som, controles e em loop) para quando o visitante clica
function toEmbed(url) {
  const yt = ytId(url), vm = vimeoId(url);
  if (yt) return `https://www.youtube.com/embed/${yt}?autoplay=1&rel=0&loop=1&playlist=${yt}`;
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&loop=1&dnt=1${vm[2] ? '&h=' + vm[2] : ''}`;
  return url;
}
// Prévia: toca mudo, em loop e sem controles dentro do card
function previewSrc(url) {
  const yt = ytId(url), vm = vimeoId(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&controls=0&loop=1&playlist=${yt}&playsinline=1&rel=0&disablekb=1&iv_load_policy=3&modestbranding=1`;
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?background=1&autoplay=1&muted=1&loop=1&autopause=0&dnt=1&quality=540p${vm[2] ? '&h=' + vm[2] : ''}`;
  return null;
}
function makePreview(p) {
  if (!p?.video || reduced || saveData) return null;
  let el;
  if (isFile(p.video)) {
    el = document.createElement('video');
    Object.assign(el, { src: p.video, muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' });
    if (p.cover) el.poster = p.cover;
    el.addEventListener('playing', () => el.classList.add('on'), { once: true });
  } else {
    const src = previewSrc(p.video);
    if (!src) return null;
    el = document.createElement('iframe');
    Object.assign(el, { src, title: '', tabIndex: -1, allow: 'autoplay; encrypted-media' });
    el.setAttribute('aria-hidden', 'true');
    // espera o player começar a tocar antes de aparecer, para não piscar tela preta
    el.addEventListener('load', () => setTimeout(() => el.classList.add('on'), 900), { once: true });
  }
  el.className = 'prev';
  return el;
}
function startPreview(card, p) {
  if (card._prev || paused) return;
  const el = makePreview(p);
  if (!el) return;
  card._prev = el;
  ($('.thumb', card) || card).append(el); // no showreel, o próprio quadro recebe a prévia
  card.classList.add('playing');
}
function stopPreview(card) {
  const el = card._prev;
  if (!el) return;
  card._prev = null;
  card.classList.remove('playing');
  el.classList.remove('on');
  setTimeout(() => el.remove(), 450);
}

// Os vídeos tocam sozinhos enquanto o card está bem visível e param quando ele sai.
// Os players entram um de cada vez (fila) para a página não travar ao carregar vários juntos.
let paused = false;
const watched = new Set();
const queue = [];
let queueBusy = false;
const itemFor = el => el.id === 'srVideo' ? SHOWREEL : PROJECTS[el.dataset.i];
function enqueue(el) {
  if (el._queued || el._prev || paused) return;
  el._queued = true;
  queue.push(el);
  if (!queueBusy) runQueue();
}
function runQueue() {
  const el = queue.shift();
  if (!el) { queueBusy = false; return; }
  queueBusy = true;
  el._queued = false;
  if (el._visible) startPreview(el, itemFor(el));
  setTimeout(runQueue, 300);
}
const autoIO = new IntersectionObserver(es => es.forEach(en => {
  const el = en.target;
  el._visible = en.isIntersecting;
  if (en.isIntersecting) enqueue(el); else stopPreview(el);
}), { threshold: .35 });
function watch(el) { watched.add(el); autoIO.observe(el); }
// Com o vídeo aberto em tela cheia, as prévias param (economiza processador e rede)
function pauseAll() { paused = true; watched.forEach(stopPreview); }
function resumeAll() { paused = false; watched.forEach(el => el._visible && enqueue(el)); }
// Aba do navegador em segundo plano: também para tudo
document.addEventListener('visibilitychange', () => document.hidden ? pauseAll() : !modal.classList.contains('open') && resumeAll());

// ---------- Projetos ----------
function thumbHTML(p, i) {
  const alt = esc(`Capa do projeto ${p.title}`);
  const eager = i < 2 ? 'eager" fetchpriority="high' : 'lazy';
  if (p.cover) return `<img src="${esc(p.cover)}" alt="${alt}" loading="${eager}" decoding="async" width="1280" height="720">`;
  if (isFile(p.video)) return `<video src="${esc(p.video)}#t=0.5" muted playsinline preload="metadata"></video>`;
  if (ytId(p.video)) return `<img src="https://i.ytimg.com/vi/${ytId(p.video)}/hqdefault.jpg" alt="${alt}" loading="${eager}" decoding="async">`;
  return ART[p.art] || ART.run;
}
function renderCards() {
  const grid = $('#cards');
  if (!PROJECTS.length) { grid.innerHTML = '<p class="hint">Nenhum projeto ainda.</p>'; return; }
  $('#count').textContent = `${PROJECTS.length} trabalhos`;
  grid.innerHTML = PROJECTS.map((p, i) => `
    <button class="card reveal" data-i="${i}" style="transition-delay:${(i % 2) * 90}ms" aria-label="Assistir: ${esc(p.title)}">
      <div class="thumb">${thumbHTML(p, i)}</div>
      <div class="card-info">
        <div><p>${esc(p.category)}</p><h3>${esc(p.title)}</h3></div>
        <span class="arrow" aria-hidden="true"><svg viewBox="0 0 12 12" width="12"><path d="M2 10L10 2M4 2h6v6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>
    </button>`).join('');
  $$('.card', grid).forEach(card => {
    io.observe(card);
    if (!PROJECTS[card.dataset.i].video) return;
    card.classList.add('has-video');
    watch(card);
  });
}

// Showreel: toca em loop no quadro grande enquanto estiver na tela
function setupShowreel() {
  const box = $('#srVideo');
  if (SHOWREEL.title) $('#srTitle').textContent = SHOWREEL.title;
  if (SHOWREEL.category) $('#srDesc').textContent = SHOWREEL.category;
  if (SHOWREEL.cover) box.insertAdjacentHTML('afterbegin', `<img class="sr-cover" src="${esc(SHOWREEL.cover)}" alt="" decoding="async">`);
  if (!SHOWREEL.video) return;
  box.classList.add('has-video');
  watch(box);
}

// ---------- Contato (vem do painel) ----------
const SOCIALS = [
  ['instagram', 'Instagram', h => `https://instagram.com/${h}`],
  ['behance', 'Behance', h => `https://behance.net/${h}`],
  ['linkedin', 'LinkedIn', h => `https://linkedin.com/in/${h}`],
  ['vimeo', 'Vimeo', h => `https://vimeo.com/${h}`],
  ['youtube', 'YouTube', h => `https://youtube.com/@${h}`],
];
// Aceita tanto o link completo quanto só o @usuario
const toUrl = (v, build) => /^https?:\/\//i.test(v) ? v : build(v.replace(/^@/, '').trim());
function setupProfile() {
  const email = PROFILE.email;
  if (email) {
    $('#copyMail').dataset.mail = email;
    $('#mailText').textContent = email;
    $('#mailBtn').href = `mailto:${email}?subject=${encodeURIComponent('Projeto de motion design')}`;
  }
  const wa = (PROFILE.whatsapp || '').replace(/\D/g, '');
  if (wa) {
    const num = wa.length <= 11 ? '55' + wa : wa; // número brasileiro sem o 55 na frente
    $('#waBtn').href = `https://wa.me/${num}?text=${encodeURIComponent('Oi Gabriel! Vi seu portfólio e quero falar sobre um projeto.')}`;
    $('#waBtn').hidden = false;
  }
  $('#socials').innerHTML = SOCIALS.filter(([k]) => PROFILE[k]).map(([k, label, build]) =>
    `<a href="${esc(toUrl(PROFILE[k], build))}" target="_blank" rel="noopener">${label} <span aria-hidden="true">↗</span></a>`).join('');
  if (PROFILE.photo) {
    const box = $('#aboutImg');
    box.insertAdjacentHTML('afterbegin', `<img src="${esc(PROFILE.photo)}" alt="Foto de Gabriel José" loading="lazy" decoding="async">`);
    box.classList.add('has-photo');
  }
}

// ---------- Player em tela cheia (modal) ----------
const modal = $('#modal'), player = $('#player');
let lastFocus, current = -1; // -1 = showreel
function show(p) {
  $('#mTitle').textContent = p.title;
  $('#mCat').textContent = p.category && current >= 0 ? p.category : '';
  $('#mCount').textContent = current >= 0 ? `${String(current + 1).padStart(2, '0')} / ${String(PROJECTS.length).padStart(2, '0')}` : 'Em destaque';
  $('.m-nav').hidden = current < 0 || PROJECTS.length < 2;
  if (!p.video) player.innerHTML = '<p>Este vídeo ainda não foi adicionado.</p>';
  else if (isFile(p.video)) player.innerHTML = `<video src="${esc(p.video)}" controls autoplay loop playsinline${p.cover ? ` poster="${esc(p.cover)}"` : ''}></video>`;
  else player.innerHTML = `<iframe src="${esc(toEmbed(p.video))}" title="${esc(p.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
}
function openModal(i) {
  lastFocus = document.activeElement;
  current = i;
  pauseAll();
  show(i >= 0 ? PROJECTS[i] : SHOWREEL);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('locked');
  $('.close').focus();
}
function step(d) {
  if (current < 0 || PROJECTS.length < 2) return;
  current = (current + d + PROJECTS.length) % PROJECTS.length;
  show(PROJECTS[current]);
}
function closeModal() {
  if (!modal.classList.contains('open')) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('locked');
  setTimeout(() => { player.innerHTML = ''; resumeAll(); }, 300);
  lastFocus?.focus();
}
$('#cards').addEventListener('click', e => {
  const c = e.target.closest('.card');
  if (c) openModal(+c.dataset.i);
});
$$('[data-video="SHOWREEL"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openModal(-1); }));
$('.close').addEventListener('click', closeModal);
$('#mPrev').addEventListener('click', () => step(-1));
$('#mNext').addEventListener('click', () => step(1));
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
addEventListener('keydown', e => {
  if (!modal.classList.contains('open')) return;
  if (e.key === 'Escape') closeModal();
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'Tab') { // mantém o foco do teclado dentro do player
    const f = $$('button:not([hidden] *):not([hidden]), iframe, video', modal).filter(x => x.offsetParent);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
// Arrastar para o lado no celular troca de projeto
let touchX = null;
modal.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
modal.addEventListener('touchend', e => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  touchX = null;
});

// ---------- Navegação ----------
const menu = $('#menu'), burger = $('#burger');
const setMenu = open => {
  menu.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
};
burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
$$('#menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));

const nav = $('#nav');
const onScroll = () => nav.classList.toggle('scrolled', scrollY > 30);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const links = $$('#menu a');
const spy = new IntersectionObserver(es => es.forEach(en => {
  if (en.isIntersecting) links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
$$('section[id]').forEach(s => spy.observe(s));

// Entrada dos blocos ao rolar
const io = new IntersectionObserver(es => es.forEach(en => {
  if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}), { threshold: .1 });
$$('.reveal').forEach(el => io.observe(el));

// ---------- Topo animado ----------
const hero = $('.hero');
hero.addEventListener('pointermove', e => {
  const r = hero.getBoundingClientRect();
  hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
  hero.style.setProperty('--my', `${e.clientY - r.top}px`);
});
// Timeline: playhead + timecode a 24 fps, só enquanto o topo está na tela
const playhead = $('#playhead'), tc = $('#tc'), tracks = $('.tracks');
const LOOP = 6000, FPS = 24, pad = v => String(v).padStart(2, '0');
let heroVisible = true, raf = 0;
function tick(now) {
  const t = (now % LOOP) / LOOP;
  playhead.style.transform = `translateX(${t * tracks.clientWidth}px)`;
  const frames = Math.floor(now / (1000 / FPS));
  const s = Math.floor(frames / FPS);
  tc.textContent = `00:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(frames % FPS)}`;
  raf = heroVisible && !reduced ? requestAnimationFrame(tick) : 0;
}
new IntersectionObserver(([en]) => {
  heroVisible = en.isIntersecting;
  hero.classList.toggle('offscreen', !heroVisible); // pausa as animações em CSS também
  if (heroVisible && !raf) raf = requestAnimationFrame(tick);
}).observe(hero);

// Parallax da cena do showreel (aparece enquanto não há vídeo)
const sr = $('#srVideo');
sr.addEventListener('pointermove', e => {
  if (sr._prev) return;
  const r = sr.getBoundingClientRect();
  sr.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5).toFixed(3));
  sr.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5).toFixed(3));
});
sr.addEventListener('pointerleave', () => { sr.style.setProperty('--px', 0); sr.style.setProperty('--py', 0); });

// ---------- Copiar e-mail ----------
const mail = $('#copyMail'), msg = $('#copyMsg');
mail.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(mail.dataset.mail); msg.textContent = 'copiado!'; }
  catch { location.href = 'mailto:' + mail.dataset.mail; }
  setTimeout(() => (msg.textContent = 'copiar'), 2000);
});

$('#year').textContent = new Date().getFullYear();

// ---------- Carrega os dados de projects.json ----------
fetch('projects.json', { cache: 'no-cache' })
  .then(r => r.json())
  .then(d => {
    SHOWREEL = d.showreel || SHOWREEL;
    PROJECTS = d.projects || [];
    PROFILE = d.profile || {};
  })
  .catch(() => console.warn('Não consegui ler projects.json. Abra o site pelo iniciar.bat.'))
  .finally(() => { renderCards(); setupShowreel(); setupProfile(); });
