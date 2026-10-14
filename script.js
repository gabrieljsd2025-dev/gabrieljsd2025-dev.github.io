/* ============================================================
   Os projetos ficam em projects.json.
   Para adicionar ou remover, use o painel: http://localhost:3000/admin
   (abra com o arquivo iniciar.bat)
   ============================================================ */
let SHOWREEL = { title: 'Showreel', category: '', video: '' };
let PROJECTS = [];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const ART = {
  run:    '<div class="art art-run"><i></i><i></i><i></i><i></i><span class="runner"></span></div>',
  tv:     '<div class="art art-tv"><div class="set"><div class="scr"><i></i><i></i></div></div></div>',
  glitch: '<div class="art art-glitch"><i></i><i></i><i></i><span class="tri"></span></div>',
  eq:     '<div class="art art-eq"><div class="bars"><i></i><i></i><i></i><i></i><i></i></div></div>',
};

// Nome com letras animadas
const nameEl = $('#name');
let n = 0;
nameEl.innerHTML = nameEl.textContent.trim().split(' ').map(w =>
  `<span class="word" aria-hidden="true">${[...w].map(c => `<span class="ch" style="--i:${n++}">${c}</span>`).join('')}</span>`
).join(' ');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isFile = v => /\.(mp4|webm|mov)(\?|$)/i.test(v);

const ytId = url => (url || '').match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/)?.[1];
const vimeoId = url => (url || '').match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([\da-f]{6,}))?/);

// Aceita links normais do YouTube/Vimeo e devolve o link do player (com som, controles e em loop)
function toEmbed(url) {
  const yt = ytId(url), vm = vimeoId(url);
  if (yt) return `https://www.youtube.com/embed/${yt}?autoplay=1&rel=0&loop=1&playlist=${yt}`;
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&loop=1&dnt=1${vm[2] ? '&h=' + vm[2] : ''}`;
  return url;
}

// ---------- Prévia animada: o vídeo toca mudo, em loop e sem controles ----------
function previewSrc(url) {
  const yt = ytId(url), vm = vimeoId(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&controls=0&loop=1&playlist=${yt}&playsinline=1&rel=0&disablekb=1&iv_load_policy=3&modestbranding=1`;
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?background=1&autoplay=1&muted=1&loop=1&autopause=0&dnt=1${vm[2] ? '&h=' + vm[2] : ''}`;
  return null;
}
const saveData = navigator.connection?.saveData;
function makePreview(p) {
  if (!p?.video || reduced || saveData) return null;
  let el;
  if (isFile(p.video)) {
    el = document.createElement('video');
    Object.assign(el, { src: p.video, muted: true, loop: true, playsInline: true, autoplay: true });
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
  if (card._prev) return;
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

// Os vídeos tocam sozinhos enquanto o card está na tela e param quando ele sai.
// Os players entram um de cada vez (fila) para a página não travar ao carregar vários juntos.
const queue = [];
let queueBusy = false;
function enqueue(card, p) {
  if (card._queued || card._prev) return;
  card._queued = true;
  queue.push([card, p]);
  if (!queueBusy) runQueue();
}
function runQueue() {
  const next = queue.shift();
  if (!next) { queueBusy = false; return; }
  queueBusy = true;
  const [card, p] = next;
  card._queued = false;
  if (card._visible) startPreview(card, p);
  setTimeout(runQueue, 350);
}
const autoIO = new IntersectionObserver(es => es.forEach(en => {
  const card = en.target;
  card._visible = en.isIntersecting;
  if (en.isIntersecting) enqueue(card, card === $('#srVideo') ? SHOWREEL : PROJECTS[card.dataset.i]);
  else stopPreview(card);
}), { rootMargin: '150px 0px', threshold: .15 });

// Cards de projeto
function thumbHTML(p) {
  if (p.cover) return `<img src="${esc(p.cover)}" alt="" loading="lazy">`;
  if (isFile(p.video)) return `<video src="${esc(p.video)}#t=0.5" muted playsinline preload="metadata"></video>`;
  if (ytId(p.video)) return `<img src="https://i.ytimg.com/vi/${ytId(p.video)}/hqdefault.jpg" alt="" loading="lazy">`;
  return ART[p.art] || ART.run;
}
function renderCards() {
  const grid = $('#cards');
  if (!PROJECTS.length) { grid.innerHTML = '<p class="hint">Nenhum projeto ainda.</p>'; return; }
  grid.innerHTML = PROJECTS.map((p, i) => `
    <button class="card reveal" data-i="${i}" style="transition-delay:${(i % 4) * 90}ms">
      <div class="thumb">${thumbHTML(p)}</div>
      <div class="card-info">
        <div><h3>${esc(p.title)}</h3><p>${esc(p.category)}</p></div>
        <span class="arrow" aria-hidden="true"><svg viewBox="0 0 12 12" width="11"><path d="M2 10L10 2M4 2h6v6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>
    </button>`).join('');
  $$('.card', grid).forEach(card => {
    io.observe(card);
    const p = PROJECTS[card.dataset.i];
    if (!p.video) return;
    card.classList.add('has-video');
    autoIO.observe(card);
  });
}

// Showreel: toca em loop no quadro grande enquanto estiver na tela
function setupShowreel() {
  const box = $('#srVideo');
  if (!SHOWREEL.video) return;
  box.classList.add('has-video');
  autoIO.observe(box);
}

// Modal de vídeo
const modal = $('#modal'), player = $('#player');
let lastFocus;
function openModal(p) {
  lastFocus = document.activeElement;
  $('#mTitle').textContent = p.title;
  $('#mCat').textContent = p.category;
  if (!p.video) player.innerHTML = '<p>Este vídeo ainda não foi adicionado.</p>';
  else if (isFile(p.video)) player.innerHTML = `<video src="${esc(p.video)}" controls autoplay loop playsinline></video>`;
  else player.innerHTML = `<iframe src="${esc(toEmbed(p.video))}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  $('.close').focus();
}
function closeModal() {
  if (!modal.classList.contains('open')) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  setTimeout(() => (player.innerHTML = ''), 300);
  lastFocus?.focus();
}
$('#cards').addEventListener('click', e => {
  const c = e.target.closest('.card');
  if (c) openModal(PROJECTS[c.dataset.i]);
});
$$('[data-video="SHOWREEL"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openModal(SHOWREEL); }));
$('.close').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Menu mobile
const menu = $('#menu'), burger = $('#burger');
const setMenu = open => { menu.classList.toggle('open', open); burger.setAttribute('aria-expanded', open); };
burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
$$('#menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));

// Nav: fundo ao rolar + link ativo
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

// Brilho que segue o mouse no hero
const hero = $('.hero');
hero.addEventListener('pointermove', e => {
  const r = hero.getBoundingClientRect();
  hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
  hero.style.setProperty('--my', `${e.clientY - r.top}px`);
});

// Parallax da cena do showreel
const sr = $('#srVideo');
sr.addEventListener('pointermove', e => {
  const r = sr.getBoundingClientRect();
  sr.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5).toFixed(3));
  sr.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5).toFixed(3));
});
sr.addEventListener('pointerleave', () => { sr.style.setProperty('--px', 0); sr.style.setProperty('--py', 0); });

// Timeline: playhead + timecode a 24 fps
const playhead = $('#playhead'), tc = $('#tc'), tracks = $('.tracks');
const LOOP = 6000, FPS = 24, pad = v => String(v).padStart(2, '0');
function tick(now) {
  const t = (now % LOOP) / LOOP;
  playhead.style.transform = `translateX(${t * tracks.clientWidth}px)`;
  const frames = Math.floor(now / (1000 / FPS));
  const s = Math.floor(frames / FPS);
  tc.textContent = `00:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(frames % FPS)}`;
  if (!reduced) requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Copiar e-mail
const mail = $('#copyMail'), msg = $('#copyMsg');
mail.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(mail.dataset.mail); msg.textContent = 'copiado!'; }
  catch { location.href = 'mailto:' + mail.dataset.mail; }
  setTimeout(() => (msg.textContent = 'copiar'), 2000);
});

$('#year').textContent = new Date().getFullYear();

// Carrega os projetos de projects.json
fetch('projects.json', { cache: 'no-store' })
  .then(r => r.json())
  .then(d => {
    SHOWREEL = d.showreel || SHOWREEL;
    PROJECTS = d.projects || [];
    if (SHOWREEL.title) $('#srTitle').textContent = SHOWREEL.title;
    if (SHOWREEL.category) $('#srDesc').textContent = SHOWREEL.category;
    if (SHOWREEL.cover)$('#srVideo').insertAdjacentHTML('afterbegin', `<img class="sr-cover" src="${esc(SHOWREEL.cover)}" alt="">`);
  })
  .catch(() => console.warn('Não consegui ler projects.json. Abra o site pelo iniciar.bat.'))
  .finally(() => { renderCards(); setupShowreel(); });
