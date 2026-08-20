/* =========================================================
   Lahans Learning Academy — CMS (sisi pemateri / authoring)
   Mengelola Training Path, Course, Module, Assessment,
   Badge & Sertifikat, dan Knowledge Base.

   Prinsip UX (revisi setelah review client):
   - Dokumen mengalir + anchor-nav, bukan wizard "Next Next".
   - Navigasi antar section bebas urutan — lompat ke mana saja.
   - Minim kotak bersarang; baris berdivider untuk daftar berulang.
   - Kolom ganda hanya kalau kontennya memang seimbang panjangnya.
   - Toolbar format teks pada field naratif yang memang butuh itu.
   ========================================================= */
(() => {

const D = window.LAHANS;
const STORE_KEY = 'lahans-cms-draft';

/* ---------------------------------------------------------
   State — salinan kerja yang bisa diedit & disimpan lokal
   --------------------------------------------------------- */
const CATEGORIES = D.categories.filter(c => c !== 'Semua kategori');
const ROLES = D.roles.filter(r => r !== 'Semua peran');
const LEVELS = D.levels.filter(l => l !== 'Semua level');

/* CMS bekerja LANGSUNG di atas objek yang sama dengan yang dibaca
   learner (window.LAHANS.catalog/paths/knowledge/qfs101Modules) —
   bukan salinan. Jadi begitu disimpan, "Lihat sebagai peserta"
   menampilkan persis apa yang baru diketik pemateri. */
let S = null;
let PRISTINE = null;
const clone = x => JSON.parse(JSON.stringify(x));

function ensureDefaults() {
  S.paths.forEach(p => { if (p.status === undefined) p.status = 'published'; });
  S.courses.forEach(c => {
    if (c.status === undefined) c.status = c.kind === 'qfs' ? 'published' : 'draft';
    if (c.badge === undefined) c.badge = c.credential || '';
    if (c.badgeValidity === undefined) c.badgeValidity = c.kind === 'qfs' ? '12 bulan' : '';
    if (c.passingScore === undefined) c.passingScore = 80;
    if (c.maxAttempt === undefined) c.maxAttempt = 3;
  });
  S.knowledge.forEach(k => { if (k.status === undefined) k.status = 'published'; });
  const qfs101 = S.courses.find(c => c.id === 'QFS-101');
  S.modules.forEach((m, i) => {
    if (m.courseId === undefined) m.courseId = 'QFS-101';
    if (m.idx === undefined) m.idx = i;
    if (m.title === undefined) m.title = (qfs101 && qfs101.modules[i] || {}).title || `Module ${i + 1}`;
    if (m.lesson === undefined) m.lesson = (qfs101 && qfs101.modules[i] || {}).lesson || '';
    if (m.minutes === undefined) m.minutes = (qfs101 && qfs101.modules[i] || {}).minutes || '';
  });
}

function applySnapshot(snap) {
  (snap.paths || []).forEach(sp => { const p = S.paths.find(x => x.id === sp.id); if (p) Object.assign(p, sp); });
  (snap.courses || []).forEach(sc => { const c = S.courses.find(x => x.id === sc.id); if (c) Object.assign(c, sc); });
  (snap.knowledge || []).forEach((sk, i) => { if (S.knowledge[i]) Object.assign(S.knowledge[i], sk); });
  (snap.modules || []).forEach((sm, i) => { if (S.modules[i]) Object.assign(S.modules[i], sm); });
}

function load() {
  S = { paths: D.paths, courses: D.catalog, knowledge: D.knowledge, modules: D.qfs101Modules };
  ensureDefaults();
  if (!PRISTINE) PRISTINE = clone(S);
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) applySnapshot(JSON.parse(raw));
  } catch (e) {}
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  flash('Perubahan tersimpan');
}
function resetAll() {
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  if (PRISTINE) {
    S.paths.length = 0; PRISTINE.paths.forEach(p => S.paths.push(clone(p)));
    S.courses.length = 0; PRISTINE.courses.forEach(c => S.courses.push(clone(c)));
    S.knowledge.length = 0; PRISTINE.knowledge.forEach(k => S.knowledge.push(clone(k)));
    S.modules.length = 0; PRISTINE.modules.forEach(m => S.modules.push(clone(m)));
  }
  flash('Data dikembalikan ke kondisi awal');
}

/* ---------------------------------------------------------
   Helper umum
   --------------------------------------------------------- */
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const stripHtml = s => String(s ?? '').replace(/<[^>]+>/g, ' ');
const icon = (n, c = 'icon') => `<svg class="${c}"><use href="#i-${n}"/></svg>`;
const go = h => { location.hash = h; };

let flashTimer;
function flash(msg) {
  let t = document.getElementById('cmsFlash');
  if (!t) {
    t = document.createElement('div');
    t.id = 'cmsFlash';
    t.className = 'cms-flash';
    document.body.appendChild(t);
  }
  t.innerHTML = `${icon('check-circle', 'icon icon-sm')}<span>${esc(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* Kelengkapan course — dipakai untuk indikator siap-publish */
function courseChecklist(c) {
  const mods = c.modules || [];
  return [
    { key: 'Info dasar', ok: !!(c.title && c.category && c.level && c.duration) },
    { key: 'Ringkasan & target peserta', ok: !!(c.summary && c.audience) },
    { key: 'Hasil belajar', ok: (c.outcomes || []).length > 0 },
    { key: 'Modul', ok: mods.length > 0 },
    { key: 'Pre-test', ok: (c.pretest || []).length > 0 },
    { key: 'Final assessment', ok: (c.posttest || []).length > 0 },
    { key: 'Badge / sertifikat', ok: !!c.badge },
    { key: 'OJT & rubrik', ok: (c.assignment || []).length > 0 && (c.rubric || []).length > 0 },
    { key: 'Sumber referensi', ok: (c.sources || []).length > 0 },
  ];
}
const completeness = c => {
  const l = courseChecklist(c);
  return Math.round((l.filter(x => x.ok).length / l.length) * 100);
};

function statusBadge(st) {
  return st === 'published'
    ? `<span class="badge badge-success">${icon('check', 'icon icon-xs')} Published</span>`
    : `<span class="badge badge-warning">${icon('clock', 'icon icon-xs')} Draft</span>`;
}

function ring(pct, size = 'md') {
  const tone = pct === 100 ? 'ok' : pct >= 60 ? 'mid' : 'low';
  return `<span class="cms-ring ${tone} ${size === 'sm' ? 'sm' : ''}" style="--p:${pct}"><i>${pct}<small>%</small></i></span>`;
}

/* Validasi silang — dipakai di dashboard */
function issues() {
  const out = [];
  const ids = new Set(S.courses.map(c => c.id));
  S.courses.forEach(c => {
    if (c.prerequisite && !ids.has(c.prerequisite))
      out.push({ sev: 'error', txt: `Course ${c.id} punya prasyarat ${c.prerequisite} yang tidak ada di katalog.`, href: `courses/${c.id}` });
    if (c.status === 'published' && completeness(c) < 100)
      out.push({ sev: 'warn', txt: `${c.id} sudah published tapi kelengkapannya baru ${completeness(c)}%.`, href: `courses/${c.id}` });
  });
  S.paths.forEach(p => {
    const missing = (p.courseIds || []).filter(id => !ids.has(id));
    if (missing.length)
      out.push({ sev: 'error', txt: `Path "${p.title}" memuat course yang tidak ada: ${missing.join(', ')}.`, href: `paths/${p.id}` });
    if (!(p.courseIds || []).length)
      out.push({ sev: 'warn', txt: `Path "${p.title}" belum berisi course apa pun.`, href: `paths/${p.id}` });
  });
  S.courses.forEach(c => {
    const seen = new Set();
    let cur = c.prerequisite;
    while (cur) {
      if (seen.has(cur) || cur === c.id) {
        out.push({ sev: 'error', txt: `Rantai prasyarat melingkar terdeteksi di ${c.id}.`, href: `courses/${c.id}` });
        break;
      }
      seen.add(cur);
      cur = (S.courses.find(x => x.id === cur) || {}).prerequisite;
    }
  });
  return out;
}

/* ---------------------------------------------------------
   Rich text field — toolbar ringan untuk field naratif
   (Bold, Italic, Bullet, Numbered). Disimpan sebagai HTML.
   --------------------------------------------------------- */
function richField(label, key, html, hint) {
  return `
  <label class="cms-field">
    <span class="cms-label">${esc(label)}</span>
    <div class="cms-rt">
      <div class="cms-rt-bar" data-rt-bar>
        <button type="button" data-rt-cmd="bold" title="Bold"><b>B</b></button>
        <button type="button" data-rt-cmd="italic" title="Italic"><i>I</i></button>
        <span class="cms-rt-sep"></span>
        <button type="button" data-rt-cmd="insertUnorderedList" title="Bullet list">${icon('layers', 'icon icon-xs')}</button>
        <button type="button" data-rt-cmd="insertOrderedList" title="Numbered list">${icon('clipboard', 'icon icon-xs')}</button>
      </div>
      <div class="cms-rt-body" contenteditable="true" data-rich="${key}">${html || ''}</div>
    </div>
    ${hint ? `<em class="cms-hint">${esc(hint)}</em>` : ''}
  </label>`;
}

document.addEventListener('mousedown', e => {
  const b = e.target.closest('[data-rt-cmd]');
  if (!b) return;
  e.preventDefault();
  document.execCommand(b.dataset.rtCmd, false, null);
});

/* ---------------------------------------------------------
   Dokumen mengalir + anchor-nav
   Menggantikan pola tab bernomor: semua section tersusun
   dalam satu halaman, dinavigasi lewat daftar pintas di kiri
   yang boleh diklik dalam urutan apa saja.
   --------------------------------------------------------- */
function docLayout(sections) {
  const nav = sections.map(s => `
    <a href="#${s.id}" data-doc-jump="${s.id}">
      <span class="dot ${s.ok === false ? '' : s.ok ? 'ok' : 'na'}"></span>
      ${esc(s.label)}
    </a>`).join('');
  const body = sections.map(s => `
    <section class="cms-doc-section" id="${s.id}">
      <h3>${esc(s.label)}</h3>
      ${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ''}
      ${s.html}
    </section>`).join('');
  return `
  <div class="cms-doc">
    <nav class="cms-doc-nav">${nav}</nav>
    <div class="cms-doc-body" data-doc-body>${body}</div>
  </div>`;
}

function initDocNav(root) {
  const links = [...root.querySelectorAll('.cms-doc-nav a')];
  const secs = [...root.querySelectorAll('.cms-doc-section')];
  if (window.__cmsIO) window.__cmsIO.disconnect();
  if (!secs.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(l => l.classList.toggle('active', l.dataset.docJump === en.target.id));
    });
  }, { root: document.querySelector('.main'), rootMargin: '-12% 0px -70% 0px', threshold: 0 });
  secs.forEach(s => io.observe(s));
  window.__cmsIO = io;
  if (links[0]) links[0].classList.add('active');
}

document.addEventListener('click', e => {
  const j = e.target.closest('[data-doc-jump]');
  if (!j) return;
  e.preventDefault();
  const el = document.getElementById(j.dataset.docJump);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ---------------------------------------------------------
   Shell
   --------------------------------------------------------- */
const SECTIONS = [
  { seg: '', label: 'Dashboard', ico: 'grid' },
  { seg: 'paths', label: 'Training Path', ico: 'route', count: () => S.paths.length },
  { seg: 'courses', label: 'Course', ico: 'book', count: () => S.courses.length },
  { seg: 'modules', label: 'Modul & Materi', ico: 'layers', count: () => S.modules.length },
  { seg: 'assessments', label: 'Bank Soal', ico: 'clipboard' },
  { seg: 'badges', label: 'Badge & Sertifikat', ico: 'shield' },
  { seg: 'knowledge', label: 'Knowledge Base', ico: 'stack', count: () => S.knowledge.length },
];

function shell(active, body) {
  return `
  <div class="cms-wrap">
    <aside class="cms-rail">
      <button class="cms-exit" data-cms-exit>${icon('chevron-left', 'icon icon-xs')} Kembali ke Lahans Builder</button>
      <div class="cms-rail-head">
        <span class="cms-tag">${icon('command', 'icon icon-sm')} Content Management</span>
        <p>Ruang kerja pemateri untuk menyusun path, course, dan modul.</p>
      </div>
      <nav class="cms-nav">
        ${SECTIONS.map(s => `
          <button class="cms-nav-item ${active === s.seg ? 'active' : ''}" data-cms-go="${s.seg}">
            ${icon(s.ico, 'icon icon-sm')}<span>${esc(s.label)}</span>
            ${s.count ? `<em>${s.count()}</em>` : ''}
          </button>`).join('')}
      </nav>
      <div class="cms-rail-foot">
        <button class="btn btn-sm" id="cmsSave">${icon('check', 'icon icon-xs')} Simpan draft</button>
        <button class="btn btn-sm btn-ghost" id="cmsReset">Reset data</button>
      </div>
    </aside>
    <section class="cms-body">${body}</section>
  </div>`;
}

function pageHead(kicker, title, desc, actions = '') {
  return `
  <div class="page-head">
    <div>
      <span class="kicker">${esc(kicker)}</span>
      <h1>${esc(title)}</h1>
      ${desc ? `<p>${esc(desc)}</p>` : ''}
    </div>
    ${actions ? `<div class="head-actions">${actions}</div>` : ''}
  </div>`;
}

/* ---------------------------------------------------------
   Dashboard — satu strip statistik + satu panel prioritas,
   bukan tujuh kotak terpisah.
   --------------------------------------------------------- */
function viewDashboard() {
  const pub = S.courses.filter(c => c.status === 'published').length;
  const modTotal = S.courses.reduce((n, c) => n + (c.modules || []).length, 0);
  const qTotal = S.courses.reduce((n, c) => n + (c.pretest || []).length + (c.posttest || []).length + (c.quiz || []).length, 0);
  const withBadge = S.courses.filter(c => c.badge).length;
  const iss = issues();
  const weakest = [...S.courses].sort((a, b) => completeness(a) - completeness(b)).slice(0, 5);

  const priority = [
    ...iss.map(i => ({ type: 'issue', sev: i.sev, txt: i.txt, href: i.href })),
    ...weakest.filter(c => completeness(c) < 100).map(c => ({
      type: 'course', pct: completeness(c), id: c.id, title: c.title,
      category: c.category, level: c.level, status: c.status, href: `courses/${c.id}`,
    })),
  ].slice(0, 9);

  return shell('', `
    ${pageHead('Content management', 'Ruang Kerja Pemateri',
      'Semua yang dibuat di sini langsung membentuk apa yang dilihat peserta di Learning Development.',
      `<button class="btn btn-sm" data-cms-go="courses">${icon('book', 'icon icon-xs')} Kelola Course</button>
       <button class="btn btn-primary btn-sm" data-new-course>${icon('sparkles', 'icon icon-xs')} Course Baru</button>`)}

    <section class="cms-stat-strip">
      <div><b>${S.paths.length}</b><span>Training path</span></div>
      <div><b>${S.courses.length}</b><span>Course · ${pub} published</span></div>
      <div><b>${modTotal}</b><span>Modul · ${S.modules.length} bermateri lengkap</span></div>
      <div><b>${qTotal}</b><span>Soal assessment</span></div>
      <div><b>${withBadge}/${S.courses.length}</b><span>Course ber-badge</span></div>
    </section>

    <section class="card">
      <div class="card-head"><div><h3>Perlu Perhatian</h3><div class="sub">${priority.length ? `${priority.length} hal diurutkan dari yang paling mendesak` : 'Tidak ada temuan'}</div></div></div>
      <div class="cms-flat-list">
        ${priority.length ? priority.map(i => i.type === 'course' ? `
          <button class="cms-flat-row" data-cms-open="${i.href}">
            ${ring(i.pct, 'sm')}
            <span class="cms-row-main">
              <strong>${esc(i.id)} · ${esc(i.title)}</strong>
              <small>${esc(i.category)} · ${esc(i.level)}</small>
            </span>
            ${statusBadge(i.status)}
            ${icon('arrow-right', 'icon icon-xs')}
          </button>` : `
          <button class="cms-flat-row ${i.sev}" data-cms-open="${i.href}">
            ${icon(i.sev === 'error' ? 'shield' : 'info', 'icon icon-sm')}
            <span class="grow-text">${esc(i.txt)}</span>
            ${icon('arrow-right', 'icon icon-xs')}
          </button>`).join('')
          : `<div class="cms-empty">${icon('check-circle')}<p>Semua konten lolos pemeriksaan dan lengkap.</p></div>`}
      </div>
    </section>
  `);
}

/* ---------------------------------------------------------
   Router CMS
   --------------------------------------------------------- */
const ROUTES = {};

function render(seg) {
  if (!S) load();
  const main = document.getElementById('view');
  const [a, b, c2] = seg;
  let html;

  if (!a) html = viewDashboard();
  else if (ROUTES[a]) html = ROUTES[a](b, c2);
  else html = viewDashboard();

  main.innerHTML = html;

  document.getElementById('crumb').innerHTML =
    `<a data-cms-exit>Learning Development</a> <span class="sep">/</span> ` +
    (a ? `<a data-cms-go="">CMS</a> <span class="sep">/</span> <b>${esc((SECTIONS.find(s => s.seg === a) || {}).label || a)}</b>`
       : `<b>CMS</b>`);

  document.querySelectorAll('.nav-sub-item').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('is-parent-active'));
  const cmsBtn = [...document.querySelectorAll('.nav-item')].find(x => /CMS/.test(x.textContent));
  if (cmsBtn) cmsBtn.classList.add('is-parent-active');

  document.querySelector('.main').scrollTop = 0;
  wire();
  const doc = main.querySelector('[data-doc-body]');
  if (doc) initDocNav(main);
}

function wire() {
  const s = document.getElementById('cmsSave');
  if (s) s.onclick = save;
  const r = document.getElementById('cmsReset');
  if (r) r.onclick = () => { if (confirm('Kembalikan semua konten CMS ke kondisi awal?')) { resetAll(); render([]); } };
}

document.addEventListener('click', e => {
  const exit = e.target.closest('[data-cms-exit]');
  if (exit) { go('#/monitoring'); return; }
  const g = e.target.closest('[data-cms-go]');
  if (g) { go('#/cms/' + g.dataset.cmsGo); return; }
  const o = e.target.closest('[data-cms-open]');
  if (o) { go('#/cms/' + o.dataset.cmsOpen); return; }
});

const segs = () => location.hash.split('/').filter(Boolean).slice(2);

window.CMS = {
  render, get state() { return S; }, save, ROUTES, shell, pageHead, esc, stripHtml, icon, flash,
  statusBadge, ring, completeness, courseChecklist, CATEGORIES, ROLES, LEVELS, richField, docLayout, initDocNav, segs,
};

})();
/* =========================================================
   CMS — Training Path
   Satu halaman mengalir: identitas ringkas di atas, lalu
   urutan course jadi konten utama (bukan dibagi kolom sempit).
   ========================================================= */
(() => {
const C = window.CMS, { esc, icon, shell, pageHead, statusBadge, richField, stripHtml } = C;
const S = () => C.state;

const fld = (l, h, hint) => `<label class="cms-field"><span class="cms-label">${esc(l)}</span>${h}${hint ? `<em class="cms-hint">${esc(hint)}</em>` : ''}</label>`;
const inp = (k, v, ph = '') => `<input class="cms-input" data-k="${k}" value="${esc(v || '')}" placeholder="${esc(ph)}" />`;

/* ---------------- List ---------------- */
C.ROUTES.paths = (id) => {
  if (id) return editor(id);
  const rows = S().paths;
  return shell('paths', `
    ${pageHead('Training path', 'Kelola Training Path',
      'Path adalah kurasi urutan course. Peserta memakainya sebagai jalur yang direkomendasikan.',
      `<button class="btn btn-primary btn-sm" data-new-path>${icon('sparkles','icon icon-xs')} Path Baru</button>`)}
    <section class="card">
      <div class="card-head"><div><h3>Daftar Path</h3><div class="sub">${rows.length} path · ${rows.reduce((n,p)=>n+p.courseIds.length,0)} penempatan course</div></div></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>#</th><th>Nama Path</th><th>Kategori</th><th>Target Peserta</th><th>Course</th><th>Estimasi</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${rows.map((p,i)=>`<tr>
            <td class="code">${i+1}</td>
            <td class="t-title">${esc(p.title)}</td>
            <td><span class="badge badge-neutral">${esc(p.eyebrow||'—')}</span></td>
            <td>${esc(stripHtml(p.audience||'—'))}</td>
            <td><span class="badge badge-primary">${p.courseIds.length} course</span></td>
            <td>${esc(p.duration||'—')}</td>
            <td>${statusBadge(p.status)}</td>
            <td style="text-align:right"><button class="btn btn-sm" data-cms-open="paths/${p.id}">Edit</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </section>`);
};

/* ---------------- Editor ---------------- */
function editor(id) {
  const p = S().paths.find(x => x.id === id);
  if (!p) return C.ROUTES.paths();
  const all = S().courses;
  const picked = p.courseIds.map(cid => all.find(c => c.id === cid)).filter(Boolean);
  const totalMin = picked.reduce((n,c)=>n+(parseInt(String(c.duration).replace(/\D/g,''),10)||0),0);

  return shell('paths', `
    ${pageHead('Edit training path', p.title, 'Atur identitas path lalu susun urutan course-nya — semua dalam satu halaman, tidak perlu berpindah tahap.',
      `<button class="btn btn-sm" data-cms-go="paths">${icon('chevron-left','icon icon-xs')} Daftar path</button>
       <button class="btn btn-sm" data-preview-path="${p.id}">${icon('play','icon icon-xs')} Lihat sebagai peserta</button>
       <button class="btn btn-primary btn-sm" data-save-path="${p.id}">${icon('check','icon icon-xs')} Simpan</button>`)}

    <section class="card">
      <div class="card-pad cms-identity-row" data-path-form="${p.id}">
        ${fld('Nama Path *', inp('title', p.title))}
        ${fld('Kategori / Eyebrow', inp('eyebrow', p.eyebrow, 'mis. Mandatory + role-based'))}
        ${fld('Target Peserta', inp('audience', p.audience))}
        ${fld('Estimasi Waktu', inp('duration', p.duration, 'mis. 12–16 jam'))}
        ${fld('Status', `<select class="cms-input" data-k="status">
            <option value="draft" ${p.status==='draft'?'selected':''}>Draft</option>
            <option value="published" ${p.status==='published'?'selected':''}>Published</option>
          </select>`)}
      </div>
      <div class="card-pad" style="padding-top:0" data-path-form="${p.id}">
        ${richField('Deskripsi', 'description', p.description)}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div><h3>Urutan Course</h3><div class="sub">${picked.length} course · ${totalMin} menit materi</div></div>
      </div>
      <div class="card-pad">
        <div class="cms-picker">
          <select class="cms-input" id="pathAddSel">
            <option value="">+ Tambahkan course ke path…</option>
            ${all.filter(c=>!p.courseIds.includes(c.id)).map(c=>`<option value="${c.id}">${esc(c.id)} · ${esc(c.title)}</option>`).join('')}
          </select>
        </div>
        <div class="cms-flat-list" id="pathSeq">
          ${picked.length ? picked.map((c,i)=>`
            <div class="cms-flat-row static" data-cid="${c.id}">
              <span class="cms-seq-num">${String(i+1).padStart(2,'0')}</span>
              <span class="cms-row-main">
                <strong>${esc(c.id)} · ${esc(c.title)}</strong>
                <small>${esc(c.category)} · ${esc(c.level)} · ${esc(c.duration)}${c.prerequisite?` · prasyarat ${esc(c.prerequisite)}`:''}</small>
              </span>
              ${C.ring(C.completeness(c), 'sm')}
              <span class="cms-seq-act">
                <button class="icon-btn" data-mv="up" title="Naik">${icon('chevron-up-down','icon icon-xs')}</button>
                <button class="icon-btn" data-rm title="Hapus dari path">${icon('close','icon icon-xs')}</button>
              </span>
            </div>`).join('')
            : `<div class="cms-empty">${icon('route')}<p>Belum ada course. Tambahkan lewat dropdown di atas.</p></div>`}
        </div>
      </div>
    </section>`);
}

/* ---------------- Interaksi ---------------- */
document.addEventListener('input', e => {
  const form = e.target.closest('[data-path-form]');
  if (!form) return;
  const p = S().paths.find(x => x.id === form.dataset.pathForm);
  if (!p) return;
  const k = e.target.dataset.k;
  if (k) { p[k] = e.target.value; return; }
  const rk = e.target.dataset.rich;
  if (rk) p[rk] = e.target.innerHTML;
});

document.addEventListener('change', e => {
  if (e.target.id === 'pathAddSel' && e.target.value) {
    const id = location.hash.split('/').filter(Boolean).pop();
    const p = S().paths.find(x => x.id === id);
    p.courseIds.push(e.target.value);
    C.render(['paths', id]);
  }
});

document.addEventListener('click', e => {
  const nw = e.target.closest('[data-new-path]');
  if (nw) {
    const id = 'path-' + Date.now().toString(36);
    S().paths.push({ id, title: 'Path Baru', eyebrow: '', description: '', audience: '', duration: '', courseIds: [], letter: 'N', status: 'draft' });
    C.render(['paths', id]);
    return;
  }
  const sv = e.target.closest('[data-save-path]');
  if (sv) { C.save(); return; }
  const pv = e.target.closest('[data-preview-path]');
  if (pv) { location.hash = '#/path'; return; }

  const row = e.target.closest('.cms-flat-row[data-cid]');
  if (!row) return;
  const id = location.hash.split('/').filter(Boolean).pop();
  const p = S().paths.find(x => x.id === id);
  if (!p) return;
  const cid = row.dataset.cid;
  const i = p.courseIds.indexOf(cid);
  if (e.target.closest('[data-rm]')) { p.courseIds.splice(i, 1); C.render(['paths', id]); return; }
  if (e.target.closest('[data-mv]') && i > 0) {
    p.courseIds.splice(i, 1); p.courseIds.splice(i - 1, 0, cid); C.render(['paths', id]);
  }
});

})();
/* =========================================================
   CMS — Course
   Dokumen mengalir dengan anchor-nav: Info, Hasil Belajar,
   Modul, Pre-test, Final Assessment, OJT & Badge, Sumber.
   Semua section terlihat sekaligus lewat scroll; anchor-nav
   di kiri untuk lompat cepat tanpa harus "Next" berurutan.
   ========================================================= */
(() => {
const C = window.CMS, { esc, icon, shell, pageHead, statusBadge, ring, completeness, courseChecklist, richField, docLayout, stripHtml, segs } = C;
const S = () => C.state;
const cur = () => S().courses.find(c => c.id === segs()[1]);

const fld = (l, h, hint) => `<label class="cms-field"><span class="cms-label">${esc(l)}</span>${h}${hint?`<em class="cms-hint">${esc(hint)}</em>`:''}</label>`;
const inp = (k, v, ph='') => `<input class="cms-input" data-k="${k}" value="${esc(v||'')}" placeholder="${esc(ph)}" />`;
const sel = (k, v, opts) => `<select class="cms-input" data-k="${k}">${opts.map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;

/* ---------------- List ---------------- */
let fq = '', fcat = 'Semua kategori', fst = 'Semua status';

C.ROUTES.courses = (id) => {
  if (id) return editor(id);
  let rows = S().courses;
  if (fcat !== 'Semua kategori') rows = rows.filter(c => c.category === fcat);
  if (fst !== 'Semua status') rows = rows.filter(c => c.status === (fst === 'Published' ? 'published' : 'draft'));
  if (fq) rows = rows.filter(c => `${c.id} ${c.title} ${c.category}`.toLowerCase().includes(fq.toLowerCase()));

  return shell('courses', `
    ${pageHead('Course', 'Kelola Course',
      'Setiap course memuat modul, assessment, OJT, dan badge yang diterima peserta.',
      `<button class="btn btn-primary btn-sm" data-new-course>${icon('sparkles','icon icon-xs')} Course Baru</button>`)}

    <div class="card cms-filters">
      <div class="search-input">${icon('search','icon')}<input id="cq" placeholder="Cari kode atau judul course" value="${esc(fq)}" /></div>
      <div class="select-wrap"><select id="ccat">${['Semua kategori',...C.CATEGORIES].map(o=>`<option ${o===fcat?'selected':''}>${esc(o)}</option>`).join('')}</select>${icon('chevron-down','icon')}</div>
      <div class="select-wrap"><select id="cst">${['Semua status','Published','Draft'].map(o=>`<option ${o===fst?'selected':''}>${esc(o)}</option>`).join('')}</select>${icon('chevron-down','icon')}</div>
      <span class="badge badge-neutral">${rows.length} course</span>
    </div>

    <section class="card">
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Kode</th><th>Judul</th><th>Kategori</th><th>Level</th><th>Modul</th><th>Badge</th><th>Kelengkapan</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map(c=>`<tr>
          <td class="code">${esc(c.id)}</td>
          <td class="t-title">${esc(c.title)}</td>
          <td>${esc(c.category)}</td>
          <td>${esc(c.level)}</td>
          <td>${(c.modules||[]).length}</td>
          <td>${c.badge?`<span class="badge badge-success">${icon('shield','icon icon-xs')} Ada</span>`:`<span class="badge badge-error">Belum</span>`}</td>
          <td>${ring(completeness(c),'sm')}</td>
          <td>${statusBadge(c.status)}</td>
          <td style="text-align:right"><button class="btn btn-sm" data-cms-open="courses/${c.id}">Edit</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>`);
};

/* ---------------- Editor: dokumen mengalir ---------------- */
function editor(id) {
  const c = S().courses.find(x => x.id === id);
  if (!c) return C.ROUTES.courses();
  const chk = courseChecklist(c);
  const okFor = label => (chk.find(x => x.key === label) || {}).ok;

  const sections = [
    { id: 'info', label: 'Info Dasar', ok: okFor('Info dasar') && okFor('Ringkasan & target peserta'), html: secInfo(c) },
    { id: 'outcome', label: 'Hasil Belajar', ok: okFor('Hasil belajar'), html: listEditor('outcomes', c, 'Tulis satu hasil belajar…') },
    { id: 'modules', label: 'Modul', ok: okFor('Modul'), html: secModules(c) },
    { id: 'pretest', label: 'Pre-test', ok: (c.pretest||[]).length>0, html: secQuiz(c,'pretest') },
    { id: 'posttest', label: 'Final Assessment', ok: okFor('Final assessment'), html: secQuiz(c,'posttest') },
    { id: 'ojt', label: 'OJT & Badge', ok: okFor('Badge / sertifikat') && okFor('OJT & rubrik'), html: secOjt(c) },
    { id: 'sources', label: 'Sumber', ok: okFor('Sumber referensi'), html: secSources(c) },
  ];

  return shell('courses', `
    <div class="page-head">
      <div>
        <span class="kicker">${esc(c.id)} · ${esc(c.category)}</span>
        <h1>${esc(c.title)}</h1>
        <div class="cms-inline-progress">${ring(completeness(c),'sm')}<span>${completeness(c)}% lengkap — isi bagian mana saja lewat daftar di kiri, urutan bebas.</span></div>
      </div>
      <div class="head-actions">
        <button class="btn btn-sm" data-cms-go="courses">${icon('chevron-left','icon icon-xs')} Daftar course</button>
        <button class="btn btn-sm" data-preview-course="${c.id}">${icon('play','icon icon-xs')} Lihat sebagai peserta</button>
        <button class="btn btn-primary btn-sm" data-save-course>${icon('check','icon icon-xs')} Simpan</button>
      </div>
    </div>
    <div class="cms-form" data-course-form="${c.id}">${docLayout(sections)}</div>`);
}

function secInfo(c) {
  return `
    <div class="cms-field-row-3">
      ${fld('Kode Course *', inp('id', c.id, 'QFS-101'), 'Dipakai sebagai prasyarat course lain.')}
      ${fld('Kategori *', sel('category', c.category, C.CATEGORIES))}
      ${fld('Level *', sel('level', c.level, C.LEVELS))}
    </div>
    ${fld('Judul *', inp('title', c.title))}
    <div class="cms-field-row-2">
      ${fld('Judul Pendek', inp('shortTitle', c.shortTitle), 'Dipakai di stepper training path.')}
      ${fld('Durasi *', inp('duration', c.duration, '95 menit'))}
    </div>
    ${richField('Ringkasan *', 'summary', c.summary, 'Tampil sebagai paragraf utama di halaman course peserta.')}
    ${richField('Target Peserta *', 'audience', c.audience)}
    ${fld('Peran yang Disasar', `<div class="cms-chips">${C.ROLES.map(r=>`
      <button type="button" class="chip ${(c.roles||[]).includes(r)?'active':''}" data-role="${esc(r)}">${esc(r)}</button>`).join('')}</div>`)}
    <div class="cms-field-row-2">
      ${fld('Prasyarat', `<select class="cms-input" data-k="prerequisite">
          <option value="">Tidak ada prasyarat</option>
          ${S().courses.filter(x=>x.id!==c.id).map(x=>`<option value="${esc(x.id)}" ${c.prerequisite===x.id?'selected':''}>${esc(x.id)} · ${esc(x.title)}</option>`).join('')}
        </select>`, 'Course ini terkunci sampai prasyarat selesai.')}
      ${fld('Status Publikasi', `<select class="cms-input" data-k="status">
          <option value="draft" ${c.status==='draft'?'selected':''}>Draft</option>
          <option value="published" ${c.status==='published'?'selected':''}>Published</option></select>`)}
    </div>`;
}

function secModules(c) {
  return `
    <div class="cms-flat-list">
      ${(c.modules||[]).length ? c.modules.map((m,i)=>`
        <div class="cms-flat-row" data-mi="${i}">
          <span class="cms-seq-num">${String(i+1).padStart(2,'0')}</span>
          <span class="cms-row-main">
            <input class="cms-inline" data-mk="title" data-mi="${i}" value="${esc(m.title||'')}" placeholder="Judul modul" />
            <input class="cms-inline sub" data-mk="lesson" data-mi="${i}" value="${esc(m.lesson||'')}" placeholder="Sub-judul / fokus materi" />
          </span>
          <input class="cms-mini" data-mk="minutes" data-mi="${i}" value="${esc(m.minutes||'')}" placeholder="mnt" />
          ${c.id==='QFS-101'?`<button class="btn btn-sm" data-cms-open="modules/${i}/course">Materi</button>`:''}
          <button class="icon-btn" data-rm-mod="${i}">${icon('close','icon icon-xs')}</button>
        </div>`).join('')
        : `<div class="cms-empty">${icon('layers')}<p>Belum ada modul.</p></div>`}
    </div>
    <button class="btn btn-sm" style="margin-top:12px" data-add-mod>${icon('sparkles','icon icon-xs')} Tambah Modul</button>`;
}

function secQuiz(c, key) {
  const qs = c[key] || [];
  return `
    <div class="cms-flat-list">
      ${qs.map((q,i)=>`<div class="cms-q">
        <div class="cms-q-head"><span class="cms-seq-num">${i+1}</span>
          <textarea class="cms-inline grow" data-qk="question" data-qq="${key}|${i}" rows="2" placeholder="Tulis pertanyaan…">${esc(q.question)}</textarea>
          <button class="icon-btn" data-rm-q="${key}|${i}">${icon('close','icon icon-xs')}</button></div>
        <div class="cms-opts">
          ${(q.options||[]).map((o,oi)=>`<label class="cms-opt ${q.answer===oi?'right':''}">
            <input type="radio" name="ans-${key}-${i}" ${q.answer===oi?'checked':''} data-ans="${key}|${i}|${oi}" />
            <input class="cms-inline" data-ok="${key}|${i}|${oi}" value="${esc(o)}" placeholder="Opsi jawaban" />
          </label>`).join('')}
        </div>
        <textarea class="cms-inline pembahasan" data-qk="rationale" data-qq="${key}|${i}" rows="2" placeholder="Pembahasan / rationale…">${esc(q.rationale||'')}</textarea>
      </div>`).join('') || `<div class="cms-empty">${icon('clipboard')}<p>Belum ada soal.</p></div>`}
    </div>
    <button class="btn btn-sm" style="margin-top:12px" data-add-q="${key}">${icon('sparkles','icon icon-xs')} Tambah Soal</button>`;
}

function secOjt(c) {
  return `
    <div class="cms-field-row-badge">
      ${fld('Nama Badge / Credential *', inp('badge', c.badge, 'Sertifikat operasional Lahans'))}
      ${fld('Masa Berlaku', inp('badgeValidity', c.badgeValidity, '12 bulan'))}
      ${fld('Passing Score', inp('passingScore', c.passingScore, '80'))}
      ${fld('Maks. Attempt', inp('maxAttempt', c.maxAttempt, '3'))}
    </div>
    <div class="cms-field-row-2">
      ${richField('Aturan Remedial', 'remedial', c.remedial)}
      ${richField('Critical Behaviour (gagal otomatis)', 'criticalBehavior', c.criticalBehavior)}
    </div>
    <div class="cms-divider"><span>Bobot Rubrik</span></div>
    <div class="cms-flat-list">
      ${(c.rubric||[]).map((r,i)=>`<div class="cms-flat-row">
        <input class="cms-inline" data-rk="label" data-ri="${i}" value="${esc(r.label)}" />
        <input class="cms-mini" data-rk="weight" data-ri="${i}" value="${esc(r.weight)}" />
        <button class="icon-btn" data-rm-rub="${i}">${icon('close','icon icon-xs')}</button>
      </div>`).join('') || `<div class="cms-empty">${icon('clipboard')}<p>Belum ada kriteria.</p></div>`}
    </div>
    <button class="btn btn-sm" style="margin:10px 0 20px" data-add-rub>+ Kriteria</button>
    <div class="cms-divider"><span>Assignment OJT per Modul</span></div>
    ${listEditor('assignment', c, 'Tulis satu assignment…')}
    <div class="cms-divider"><span>Syarat Kelulusan</span></div>
    ${listEditor('completion', c, 'Tulis satu syarat…')}`;
}

function secSources(c) {
  return `
    <div class="cms-flat-list">
      ${(c.sources||[]).map((s,i)=>`<div class="cms-flat-row">
        <span class="cms-row-main">
          <input class="cms-inline" data-sk="label" data-si="${i}" value="${esc(s.label)}" placeholder="Judul sumber" />
          <input class="cms-inline sub" data-sk="url" data-si="${i}" value="${esc(s.url)}" placeholder="https://" />
        </span>
        <input class="cms-mini wide" data-sk="type" data-si="${i}" value="${esc(s.type||'')}" placeholder="Tipe" />
        <button class="icon-btn" data-rm-src="${i}">${icon('close','icon icon-xs')}</button>
      </div>`).join('') || `<div class="cms-empty">${icon('file')}<p>Belum ada sumber.</p></div>`}
    </div>
    <button class="btn btn-sm" style="margin-top:12px" data-add-src>${icon('sparkles','icon icon-xs')} Tambah Sumber</button>`;
}

function listEditor(key, c, ph) {
  const arr = c[key] || [];
  return `
    <div class="cms-flat-list">
      ${arr.map((t,i)=>`<div class="cms-flat-row">
        <span class="cms-seq-num">${i+1}</span>
        <textarea class="cms-inline grow" data-lk="${key}" data-li="${i}" rows="2" placeholder="${esc(ph)}">${esc(t)}</textarea>
        <button class="icon-btn" data-rm-item="${key}|${i}">${icon('close','icon icon-xs')}</button>
      </div>`).join('') || `<div class="cms-empty">${icon('clipboard')}<p>Belum ada isi.</p></div>`}
    </div>
    <button class="btn btn-sm" style="margin-top:12px" data-add-item="${key}">+ Tambah</button>`;
}

/* ---------------- Interaksi ---------------- */
const re = () => C.render(['courses', cur().id]);

document.addEventListener('input', e => {
  const f = e.target.closest('[data-course-form]'); if (!f) return;
  const c = cur(); if (!c) return;
  const t = e.target, d = t.dataset;
  if (d.rich) { c[d.rich] = t.innerHTML; return; }
  if (d.k) { c[d.k] = t.value; return; }
  if (d.mk) { c.modules[+d.mi][d.mk] = d.mk === 'minutes' ? (parseInt(t.value,10)||'') : t.value; return; }
  if (d.lk) { c[d.lk][+d.li] = t.value; return; }
  if (d.rk) { c.rubric[+d.ri][d.rk] = t.value; return; }
  if (d.sk) { c.sources[+d.si][d.sk] = t.value; return; }
  if (d.qk) { const [k,i] = d.qq.split('|'); c[k][+i][d.qk] = t.value; return; }
  if (d.ok) { const [k,i,oi] = d.ok.split('|'); c[k][+i].options[+oi] = t.value; return; }
});

document.addEventListener('change', e => {
  const a = e.target.dataset.ans;
  if (a) { const [k,i,oi] = a.split('|'); cur()[k][+i].answer = +oi; return; }
});

document.addEventListener('input', e => {
  if (e.target.id === 'cq') { fq = e.target.value; C.render(['courses']); const n=document.getElementById('cq'); if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length);} }
});
document.addEventListener('change', e => {
  if (e.target.id === 'ccat') { fcat = e.target.value; C.render(['courses']); }
  if (e.target.id === 'cst') { fst = e.target.value; C.render(['courses']); }
});

document.addEventListener('click', e => {
  if (e.target.closest('[data-new-course]')) {
    const id = 'NEW-' + (S().courses.length + 1);
    S().courses.push({ id, title: 'Course Baru', kind: 'sample', category: C.CATEGORIES[0], level: 'Foundation',
      duration: '', summary: '', audience: '', roles: [], modules: [], outcomes: [], sources: [],
      pretest: [], posttest: [], assignment: [], rubric: [], completion: [], badge: '', badgeValidity: '',
      passingScore: 80, maxAttempt: 3, status: 'draft' });
    C.render(['courses', id]); return;
  }
  if (e.target.closest('[data-save-course]')) { C.save(); return; }
  if (e.target.closest('[data-preview-course]')) { location.hash = '#/course/' + e.target.closest('[data-preview-course]').dataset.previewCourse; return; }

  const c = cur(); if (!c) return;
  const role = e.target.closest('[data-role]');
  if (role) { const r = role.dataset.role; c.roles = c.roles || [];
    const i = c.roles.indexOf(r); i >= 0 ? c.roles.splice(i,1) : c.roles.push(r); re(); return; }

  if (e.target.closest('[data-add-mod]')) { (c.modules = c.modules||[]).push({ title:'Modul baru', lesson:'', minutes:10 }); re(); return; }
  const rmm = e.target.closest('[data-rm-mod]'); if (rmm) { c.modules.splice(+rmm.dataset.rmMod,1); re(); return; }

  const ai = e.target.closest('[data-add-item]'); if (ai) { (c[ai.dataset.addItem] = c[ai.dataset.addItem]||[]).push(''); re(); return; }
  const ri = e.target.closest('[data-rm-item]'); if (ri) { const [k,i]=ri.dataset.rmItem.split('|'); c[k].splice(+i,1); re(); return; }

  if (e.target.closest('[data-add-rub]')) { (c.rubric = c.rubric||[]).push({label:'Kriteria baru',weight:'25%'}); re(); return; }
  const rr = e.target.closest('[data-rm-rub]'); if (rr) { c.rubric.splice(+rr.dataset.rmRub,1); re(); return; }

  if (e.target.closest('[data-add-src]')) { (c.sources = c.sources||[]).push({label:'',url:'',type:'Read more'}); re(); return; }
  const rs = e.target.closest('[data-rm-src]'); if (rs) { c.sources.splice(+rs.dataset.rmSrc,1); re(); return; }

  const aq = e.target.closest('[data-add-q]'); if (aq) { const k=aq.dataset.addQ;
    (c[k] = c[k]||[]).push({question:'',options:['','','',''],answer:0,rationale:''}); re(); return; }
  const rq = e.target.closest('[data-rm-q]'); if (rq) { const [k,i]=rq.dataset.rmQ.split('|'); c[k].splice(+i,1); re(); return; }
});

})();
/* =========================================================
   CMS — Modul & Materi, Bank Soal, Badge, Knowledge Base
   Modul juga dokumen mengalir (2 section, anchor-nav).
   ========================================================= */
(() => {
const C = window.CMS, { esc, icon, shell, pageHead, statusBadge, docLayout, segs } = C;
const S = () => C.state;
const fld = (l,h,hint) => `<label class="cms-field"><span class="cms-label">${esc(l)}</span>${h}${hint?`<em class="cms-hint">${esc(hint)}</em>`:''}</label>`;
const inp = (k,v,ph='') => `<input class="cms-input" data-mk2="${k}" value="${esc(v||'')}" placeholder="${esc(ph)}" />`;

/* ================= Modul & Materi ================= */
C.ROUTES.modules = (i, back) => {
  if (i !== undefined) return modEditor(+i, back);
  const mods = S().modules;
  return shell('modules', `
    ${pageHead('Modul & materi', 'Materi Mendalam Modul',
      'Isi materi yang dibaca peserta: tujuan, materi mendalam, studi kasus, sampai knowledge check.')}
    <div class="cms-note">${icon('info','icon icon-sm')}
      <span>Materi mendalam saat ini tersedia untuk <b>QFS-101</b> (${mods.length} modul). Modul course lain memakai format ringkas dan bisa dilengkapi lewat editor ini.</span></div>
    <section class="card">
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>#</th><th>Judul Modul</th><th>Tujuan</th><th>Materi</th><th>Studi Kasus</th><th>Knowledge Check</th><th></th></tr></thead>
        <tbody>${mods.map((m,idx)=>`<tr>
          <td class="code">${String(idx+1).padStart(2,'0')}</td>
          <td class="t-title">${esc(m.title)}</td>
          <td>${(m.objectives||[]).length}</td>
          <td>${(m.sections||[]).length} bagian</td>
          <td>${(m.cases||[]).length}</td>
          <td>${(m.knowledgeCheck||[]).length} soal</td>
          <td style="text-align:right"><button class="btn btn-sm" data-cms-open="modules/${idx}">Edit Materi</button></td>
        </tr>`).join('')}</tbody></table></div>
    </section>`);
};

function modEditor(i, back) {
  const m = S().modules[i];
  if (!m) return C.ROUTES.modules();
  const sections = [
    { id: 'utama', label: 'Materi Utama', ok: (m.objectives||[]).length>0 && (m.sections||[]).length>0, html: modUtama(m) },
    { id: 'check', label: 'Rangkuman & Knowledge Check', ok: (m.knowledgeCheck||[]).length>0, html: modCheck(m) },
  ];
  const backHref = back === 'course' ? `courses/${m.courseId}` : 'modules';
  const backLabel = back === 'course' ? `Kembali ke ${m.courseId}` : 'Daftar modul';
  return shell('modules', `
    <div class="page-head">
      <div><span class="kicker">Modul ${i+1} · ${esc(m.courseId)}</span><h1>${esc(m.title)}</h1></div>
      <div class="head-actions">
        <button class="btn btn-sm" data-cms-open="${backHref}">${icon('chevron-left','icon icon-xs')} ${esc(backLabel)}</button>
        <button class="btn btn-sm" data-prev-mod="${i}">${icon('play','icon icon-xs')} Lihat sebagai peserta</button>
        <button class="btn btn-primary btn-sm" data-save-mod>${icon('check','icon icon-xs')} Simpan</button>
      </div>
    </div>
    <div class="cms-form" data-mod-form="${i}">${docLayout(sections)}</div>`);
}

function arrCard(key, arr, ph) {
  return `
    <div class="cms-flat-list">
      ${(arr||[]).map((t,x)=>`<div class="cms-flat-row">
        <span class="cms-seq-num">${x+1}</span>
        <textarea class="cms-inline grow" data-marr="${key}|${x}" rows="2" placeholder="${esc(ph)}">${esc(t)}</textarea>
        <button class="icon-btn" data-mrm="${key}|${x}">${icon('close','icon icon-xs')}</button>
      </div>`).join('') || `<div class="cms-empty">${icon('clipboard')}<p>Belum ada isi.</p></div>`}
    </div>
    <button class="btn btn-sm" style="margin-top:12px" data-madd="${key}">+ Tambah</button>`;
}

function modUtama(m) {
  return `
    <div class="cms-field-row-2">
      ${fld('Judul Modul', inp('title', m.title))}
      ${fld('Sub-judul / Fokus', inp('lesson', m.lesson))}
    </div>
    <div class="cms-divider"><span>Tujuan Pembelajaran</span></div>
    ${arrCard('objectives', m.objectives, 'Tulis satu tujuan…')}

    <div class="cms-divider"><span>Materi Mendalam</span></div>
    <div class="cms-flat-list">
      ${(m.sections||[]).map((s,x)=>`<div class="cms-sec">
        <div class="cms-sec-head"><span class="cms-seq-num">${String(x+1).padStart(2,'0')}</span>
          <input class="cms-inline" data-msec="title|${x}" value="${esc(s.title)}" placeholder="Judul bagian" />
          <button class="icon-btn" data-mrm-sec="${x}">${icon('close','icon icon-xs')}</button></div>
        <textarea class="cms-inline" data-msec="paragraphs|${x}" rows="4" placeholder="Paragraf — pisahkan antar paragraf dengan baris kosong">${esc((s.paragraphs||[]).join('\n\n'))}</textarea>
        <textarea class="cms-inline" data-msec="bullets|${x}" rows="3" placeholder="Poin bullet — satu per baris">${esc((s.bullets||[]).join('\n'))}</textarea>
      </div>`).join('') || `<div class="cms-empty">${icon('book')}<p>Belum ada bagian materi.</p></div>`}
    </div>
    <button class="btn btn-sm" style="margin-top:12px" data-madd-sec>+ Bagian Materi</button>

    <div class="cms-divider"><span>Playbook Operasional</span></div>
    ${arrCard('playbook', m.playbook, 'ISTILAH lalu penjelasan…')}

    <div class="cms-field-row-2" style="margin-top:22px">
      <div>
        <div class="cms-label" style="margin-bottom:8px">Red Flags</div>
        ${arrCard('redFlags', m.redFlags, 'Tulis satu red flag…')}
      </div>
      <div>
        <div class="cms-label" style="margin-bottom:8px">Kesalahan Umum</div>
        <div class="cms-flat-list">
          ${(m.mistakes||[]).map((x,idx)=>`<div class="cms-sec">
            <div class="cms-sec-head">
              <input class="cms-inline" data-mmis="title|${idx}" value="${esc(x.title)}" placeholder="Judul kesalahan" />
              <button class="icon-btn" data-mrm-mis="${idx}">${icon('close','icon icon-xs')}</button></div>
            <textarea class="cms-inline" data-mmis="explanation|${idx}" rows="2" placeholder="Penjelasan">${esc(x.explanation)}</textarea>
          </div>`).join('') || `<div class="cms-empty">${icon('info')}<p>Belum ada.</p></div>`}
        </div>
        <button class="btn btn-sm" style="margin-top:12px" data-madd-mis>+ Tambah</button>
      </div>
    </div>

    <div class="cms-divider"><span>Studi Kasus Bertingkat</span></div>
    <div class="cms-flat-list">
      ${(m.cases||[]).map((cs,x)=>`<div class="cms-sec">
        <div class="cms-sec-head">
          <input class="cms-mini wide" data-mcase="level|${x}" value="${esc(cs.level)}" placeholder="Level" />
          <input class="cms-inline" data-mcase="title|${x}" value="${esc(cs.title)}" placeholder="Judul kasus" />
          <button class="icon-btn" data-mrm-case="${x}">${icon('close','icon icon-xs')}</button></div>
        <textarea class="cms-inline" data-mcase="situation|${x}" rows="3" placeholder="Situasi">${esc(cs.situation)}</textarea>
        <textarea class="cms-inline" data-mcase="facts|${x}" rows="3" placeholder="Fakta yang tersedia — satu per baris">${esc((cs.facts||[]).join('\n'))}</textarea>
        <textarea class="cms-inline" data-mcase="prompts|${x}" rows="2" placeholder="Pertanyaan diskusi — satu per baris">${esc((cs.prompts||[]).join('\n'))}</textarea>
        <textarea class="cms-inline" data-mcase="response|${x}" rows="3" placeholder="Respons yang direkomendasikan — satu per baris">${esc((cs.response||[]).join('\n'))}</textarea>
        <input class="cms-inline" data-mcase="lesson|${x}" value="${esc(cs.lesson||'')}" placeholder="Pelajaran utama" />
      </div>`).join('') || `<div class="cms-empty">${icon('message')}<p>Belum ada studi kasus.</p></div>`}
    </div>
    <button class="btn btn-sm" style="margin-top:12px" data-madd-case>+ Studi Kasus</button>`;
}

function modCheck(m) {
  const qs = m.knowledgeCheck || [];
  return `
    <div class="cms-divider" style="margin-top:0"><span>Yang Wajib Diingat</span></div>
    ${arrCard('summary', m.summary, 'Tulis satu poin rangkuman…')}
    <div class="cms-divider"><span>Knowledge Check</span></div>
    <div class="cms-flat-list">
      ${qs.map((q,x)=>`<div class="cms-q">
        <div class="cms-q-head"><span class="cms-seq-num">${x+1}</span>
          <textarea class="cms-inline grow" data-mq="question|${x}" rows="2" placeholder="Pertanyaan…">${esc(q.question)}</textarea>
          <button class="icon-btn" data-mrm-q="${x}">${icon('close','icon icon-xs')}</button></div>
        <div class="cms-opts">${(q.options||[]).map((o,oi)=>`
          <label class="cms-opt ${q.answer===oi?'right':''}">
            <input type="radio" name="mq-${x}" ${q.answer===oi?'checked':''} data-mans="${x}|${oi}" />
            <input class="cms-inline" data-mopt="${x}|${oi}" value="${esc(o)}" placeholder="Opsi jawaban" />
          </label>`).join('')}</div>
        <textarea class="cms-inline pembahasan" data-mq="rationale|${x}" rows="2" placeholder="Pembahasan…">${esc(q.rationale||'')}</textarea>
      </div>`).join('') || `<div class="cms-empty">${icon('clipboard')}<p>Belum ada soal.</p></div>`}
    </div>
    <button class="btn btn-sm" style="margin-top:12px" data-madd-q>${icon('sparkles','icon icon-xs')} Tambah Soal</button>`;
}

/* ================= Bank Soal ================= */
C.ROUTES.assessments = () => {
  const rows = [];
  S().courses.forEach(c => {
    (c.pretest||[]).length && rows.push({ c, k: 'Pre-test', n: c.pretest.length, tone: 'sky' });
    (c.quiz||[]).length && rows.push({ c, k: 'Knowledge Check', n: c.quiz.length, tone: 'violet' });
    (c.posttest||[]).length && rows.push({ c, k: 'Final Assessment', n: c.posttest.length, tone: 'amber' });
  });
  const total = rows.reduce((n,r)=>n+r.n,0);
  const noPre = S().courses.filter(c=>!(c.pretest||[]).length).length;
  return shell('assessments', `
    ${pageHead('Bank soal','Assessment Terpusat',
      'Semua soal yang tersebar di course, dikumpulkan agar mudah diperiksa dan disamakan standarnya.')}
    <section class="cms-stat-strip">
      <div><b>${total}</b><span>Total soal</span></div>
      <div><b>${noPre}</b><span>Course tanpa pre-test</span></div>
      <div><b>${S().courses.filter(c=>(c.posttest||[]).length).length}</b><span>Course ber-assessment</span></div>
    </section>
    <section class="card">
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Course</th><th>Jenis</th><th>Jumlah Soal</th><th>Passing</th><th>Max Attempt</th><th></th></tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td class="t-title">${esc(r.c.id)} · ${esc(r.c.title)}</td>
          <td><span class="badge tone-${r.tone}" style="border:0">${esc(r.k)}</span></td>
          <td>${r.n}</td><td>${esc(r.c.passingScore||80)}</td><td>${esc(r.c.maxAttempt||3)}</td>
          <td style="text-align:right"><button class="btn btn-sm" data-cms-open="courses/${r.c.id}">Buka</button></td>
        </tr>`).join('')}</tbody></table></div>
    </section>`);
};

/* ================= Badge & Sertifikat ================= */
C.ROUTES.badges = () => {
  const cs = S().courses;
  const withB = cs.filter(c=>c.badge);
  return shell('badges', `
    ${pageHead('Badge & sertifikat','Credential yang Diterima Peserta',
      'Badge terbit otomatis setelah peserta lulus final assessment dan OJT. Ubah langsung di tabel.')}
    <section class="cms-stat-strip">
      <div><b>${withB.length}</b><span>Course ber-badge</span></div>
      <div><b>${cs.length-withB.length}</b><span>Belum ada badge</span></div>
      <div><b>${cs.filter(c=>c.badgeValidity).length}</b><span>Berbatas waktu</span></div>
    </section>
    <section class="card">
      <div class="table-wrap"><table class="tbl" style="table-layout:fixed">
        <colgroup><col style="width:12%"><col style="width:46%"><col style="width:18%"><col style="width:12%"><col style="width:12%"></colgroup>
        <thead><tr><th>Course</th><th>Nama Badge</th><th>Masa Berlaku</th><th>Passing</th><th>Status</th></tr></thead>
        <tbody>${cs.map(c=>`<tr>
          <td class="code">${esc(c.id)}</td>
          <td><input class="cms-inline" data-bk="badge|${esc(c.id)}" value="${esc(c.badge||'')}" placeholder="Belum ditetapkan" /></td>
          <td><input class="cms-mini wide" data-bk="badgeValidity|${esc(c.id)}" value="${esc(c.badgeValidity||'')}" placeholder="—" /></td>
          <td><input class="cms-mini" data-bk="passingScore|${esc(c.id)}" value="${esc(c.passingScore||80)}" /></td>
          <td>${c.badge?`<span class="badge badge-success">Siap</span>`:`<span class="badge badge-error">Belum</span>`}</td>
        </tr>`).join('')}</tbody></table></div>
    </section>`);
};

/* ================= Knowledge Base ================= */
C.ROUTES.knowledge = () => {
  const ks = S().knowledge;
  return shell('knowledge', `
    ${pageHead('Knowledge base','Referensi Kerja di Luar Course',
      'Materi pendukung yang tidak menghitung penyelesaian course.',
      `<button class="btn btn-primary btn-sm" data-add-kb>${icon('sparkles','icon icon-xs')} Entri Baru</button>`)}
    <section class="card">
      <div class="table-wrap"><table class="tbl" style="table-layout:fixed">
        <colgroup><col style="width:11%"><col style="width:27%"><col style="width:44%"><col style="width:12%"><col style="width:6%"></colgroup>
        <thead><tr><th>Kode</th><th>Judul</th><th>Deskripsi</th><th>Status</th><th></th></tr></thead>
        <tbody>${ks.map((k,i)=>`<tr>
          <td><input class="cms-mini" data-kk="code|${i}" value="${esc(k.code)}" /></td>
          <td><input class="cms-inline" data-kk="title|${i}" value="${esc(k.title)}" /></td>
          <td><input class="cms-inline" data-kk="description|${i}" value="${esc(k.description)}" /></td>
          <td>${statusBadge(k.status)}</td>
          <td style="text-align:right"><button class="icon-btn" data-rm-kb="${i}">${icon('close','icon icon-xs')}</button></td>
        </tr>`).join('')}</tbody></table></div>
    </section>`);
};

/* ================= Interaksi ================= */
const curMod = () => S().modules[+segs()[1]];
const reMod = () => C.render(['modules', segs()[1], segs()[2]]);
const lines = v => v.split('\n').map(x=>x.trim()).filter(Boolean);

document.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (d.bk) { const [k,id]=d.bk.split('|'); const c=S().courses.find(x=>x.id===id); if(c) c[k]=t.value; return; }
  if (d.kk) { const [k,i]=d.kk.split('|'); S().knowledge[+i][k]=t.value; return; }
  const f = t.closest('[data-mod-form]'); if (!f) return;
  const m = curMod(); if (!m) return;
  if (d.mk2) {
    m[d.mk2] = t.value;
    // judul/sub-judul/menit modul juga tampil di halaman course (tab Modul) —
    // sinkronkan supaya kedua tempat edit selalu selaras.
    const course = S().courses.find(c => c.id === m.courseId);
    if (course && course.modules[m.idx]) course.modules[m.idx][d.mk2] = t.value;
    return;
  }
  if (d.marr) { const [k,x]=d.marr.split('|'); m[k][+x]=t.value; return; }
  if (d.msec) { const [k,x]=d.msec.split('|');
    m.sections[+x][k] = k==='title' ? t.value : (k==='paragraphs' ? t.value.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean) : lines(t.value)); return; }
  if (d.mmis) { const [k,x]=d.mmis.split('|'); m.mistakes[+x][k]=t.value; return; }
  if (d.mcase) { const [k,x]=d.mcase.split('|');
    m.cases[+x][k] = ['facts','prompts','response'].includes(k) ? lines(t.value) : t.value; return; }
  if (d.mq) { const [k,x]=d.mq.split('|'); m.knowledgeCheck[+x][k]=t.value; return; }
  if (d.mopt) { const [x,oi]=d.mopt.split('|'); m.knowledgeCheck[+x].options[+oi]=t.value; return; }
});

document.addEventListener('change', e => {
  const a = e.target.dataset.mans;
  if (a) { const [x,oi]=a.split('|'); curMod().knowledgeCheck[+x].answer=+oi; }
});

document.addEventListener('click', e => {
  if (e.target.closest('[data-save-mod]')) { C.save(); return; }
  const pm = e.target.closest('[data-prev-mod]'); if (pm) { const m=curMod(); location.hash = `#/course/${m.courseId}/m${pm.dataset.prevMod}`; return; }

  if (e.target.closest('[data-add-kb]')) { S().knowledge.push({code:'NEW',title:'Entri baru',description:'',tone:'slate',tabId:'',status:'draft'}); C.render(['knowledge']); return; }
  const rk = e.target.closest('[data-rm-kb]'); if (rk) { S().knowledge.splice(+rk.dataset.rmKb,1); C.render(['knowledge']); return; }

  const m = curMod(); if (!m) return;
  const ad = e.target.closest('[data-madd]'); if (ad) { (m[ad.dataset.madd] = m[ad.dataset.madd]||[]).push(''); reMod(); return; }
  const rm = e.target.closest('[data-mrm]'); if (rm) { const [k,x]=rm.dataset.mrm.split('|'); m[k].splice(+x,1); reMod(); return; }
  if (e.target.closest('[data-madd-sec]')) { (m.sections=m.sections||[]).push({title:'Bagian baru',paragraphs:[],bullets:[]}); reMod(); return; }
  const rsec = e.target.closest('[data-mrm-sec]'); if (rsec) { m.sections.splice(+rsec.dataset.mrmSec,1); reMod(); return; }
  if (e.target.closest('[data-madd-mis]')) { (m.mistakes=m.mistakes||[]).push({title:'',explanation:''}); reMod(); return; }
  const rmis = e.target.closest('[data-mrm-mis]'); if (rmis) { m.mistakes.splice(+rmis.dataset.mrmMis,1); reMod(); return; }
  if (e.target.closest('[data-madd-case]')) { (m.cases=m.cases||[]).push({level:'Dasar',title:'',situation:'',facts:[],prompts:[],response:[],lesson:''}); reMod(); return; }
  const rc = e.target.closest('[data-mrm-case]'); if (rc) { m.cases.splice(+rc.dataset.mrmCase,1); reMod(); return; }
  if (e.target.closest('[data-madd-q]')) { (m.knowledgeCheck=m.knowledgeCheck||[]).push({question:'',options:['','','',''],answer:0,rationale:''}); reMod(); return; }
  const rq = e.target.closest('[data-mrm-q]'); if (rq) { m.knowledgeCheck.splice(+rq.dataset.mrmQ,1); reMod(); return; }
});

})();
