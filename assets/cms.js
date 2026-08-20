/* =========================================================
   Lahans Learning Academy — CMS (sisi pemateri / authoring)
   Mengelola Training Path, Course, Module, Assessment,
   Badge & Sertifikat, dan Knowledge Base.
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

function seed() {
  return {
    paths: D.paths.map(p => ({ ...p, status: 'published' })),
    courses: D.catalog.map(c => ({
      ...c,
      status: c.kind === 'qfs' ? 'published' : 'draft',
      badge: c.credential || '',
      badgeValidity: c.kind === 'qfs' ? '12 bulan' : '',
      passingScore: 80,
      maxAttempt: 3,
    })),
    knowledge: D.knowledge.map(k => ({ ...k, status: 'published' })),
    modules: D.qfs101Modules.map((m, i) => ({
      idx: i,
      courseId: 'QFS-101',
      title: (D.catalog.find(c => c.id === 'QFS-101').modules[i] || {}).title || `Module ${i + 1}`,
      ...m,
    })),
  };
}

let S = null;
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { S = JSON.parse(raw); return; }
  } catch (e) {}
  S = seed();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  flash('Perubahan tersimpan');
}
function resetAll() {
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  S = seed();
  flash('Data dikembalikan ke kondisi awal');
}

/* ---------------------------------------------------------
   Helper
   --------------------------------------------------------- */
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
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

function ring(pct) {
  const tone = pct === 100 ? 'ok' : pct >= 60 ? 'mid' : 'low';
  return `<span class="cms-ring ${tone}" style="--p:${pct}"><i>${pct}<small>%</small></i></span>`;
}

/* Validasi silang — dipakai di dashboard */
function issues() {
  const out = [];
  const ids = new Set(S.courses.map(c => c.id));
  S.courses.forEach(c => {
    if (c.prerequisite && !ids.has(c.prerequisite))
      out.push({ sev: 'error', txt: `Course ${c.id} punya prasyarat ${c.prerequisite} yang tidak ada di katalog.`, href: `#/cms/courses/${c.id}` });
    if (c.status === 'published' && completeness(c) < 100)
      out.push({ sev: 'warn', txt: `${c.id} sudah published tapi kelengkapannya baru ${completeness(c)}%.`, href: `#/cms/courses/${c.id}` });
  });
  S.paths.forEach(p => {
    const missing = (p.courseIds || []).filter(id => !ids.has(id));
    if (missing.length)
      out.push({ sev: 'error', txt: `Path "${p.title}" memuat course yang tidak ada: ${missing.join(', ')}.`, href: `#/cms/paths/${p.id}` });
    if (!(p.courseIds || []).length)
      out.push({ sev: 'warn', txt: `Path "${p.title}" belum berisi course apa pun.`, href: `#/cms/paths/${p.id}` });
  });
  // rantai prasyarat melingkar
  S.courses.forEach(c => {
    const seen = new Set();
    let cur = c.prerequisite;
    while (cur) {
      if (seen.has(cur) || cur === c.id) {
        out.push({ sev: 'error', txt: `Rantai prasyarat melingkar terdeteksi di ${c.id}.`, href: `#/cms/courses/${c.id}` });
        break;
      }
      seen.add(cur);
      cur = (S.courses.find(x => x.id === cur) || {}).prerequisite;
    }
  });
  return out;
}

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
   Dashboard
   --------------------------------------------------------- */
function viewDashboard() {
  const pub = S.courses.filter(c => c.status === 'published').length;
  const draft = S.courses.length - pub;
  const modTotal = S.courses.reduce((n, c) => n + (c.modules || []).length, 0);
  const qTotal = S.courses.reduce((n, c) => n + (c.pretest || []).length + (c.posttest || []).length + (c.quiz || []).length, 0);
  const withBadge = S.courses.filter(c => c.badge).length;
  const iss = issues();
  const weakest = [...S.courses].sort((a, b) => completeness(a) - completeness(b)).slice(0, 6);

  return shell('', `
    ${pageHead('Content management', 'Ruang Kerja Pemateri',
      'Semua yang dibuat di sini langsung membentuk apa yang dilihat peserta di Learning Development.',
      `<button class="btn btn-sm" data-cms-go="courses">${icon('book', 'icon icon-xs')} Kelola Course</button>
       <button class="btn btn-primary btn-sm" data-cms-new="course">${icon('sparkles', 'icon icon-xs')} Course Baru</button>`)}

    <div class="grid g-4">
      ${kpi('route', 'blue', 'Training Path', S.paths.length, `${S.paths.reduce((n, p) => n + p.courseIds.length, 0)} penempatan course`)}
      ${kpi('book', 'sky', 'Course', S.courses.length, `${pub} published · ${draft} draft`)}
      ${kpi('layers', 'violet', 'Modul', modTotal, `${S.modules.length} modul bermateri lengkap`)}
      ${kpi('clipboard', 'amber', 'Soal Assessment', qTotal, 'pre-test, knowledge check, post-test')}
    </div>

    <div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr)">
      <section class="card">
        <div class="card-head">
          <div><h3>Course Paling Perlu Dilengkapi</h3><div class="sub">Diurutkan dari kelengkapan terendah</div></div>
          <div class="right"><button class="btn btn-sm btn-ghost" data-cms-go="courses">Lihat semua</button></div>
        </div>
        <div class="card-pad cms-list">
          ${weakest.map(c => `
            <button class="cms-row" data-cms-open="courses/${c.id}">
              ${ring(completeness(c))}
              <span class="cms-row-main">
                <strong>${esc(c.id)} · ${esc(c.title)}</strong>
                <small>${esc(c.category)} · ${esc(c.level)}</small>
              </span>
              ${statusBadge(c.status)}
              ${icon('arrow-right', 'icon icon-xs')}
            </button>`).join('')}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h3>Perlu Diperiksa</h3><div class="sub">${iss.length} temuan</div></div></div>
        <div class="card-pad cms-list">
          ${iss.length ? iss.slice(0, 8).map(i => `
            <button class="cms-issue ${i.sev}" data-cms-open="${i.href.replace('#/cms/', '')}">
              ${icon(i.sev === 'error' ? 'shield' : 'info', 'icon icon-sm')}
              <span>${esc(i.txt)}</span>
            </button>`).join('')
            : `<div class="cms-empty">${icon('check-circle')}<p>Semua konten lolos pemeriksaan.</p></div>`}
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><div><h3>Cakupan Badge &amp; Sertifikat</h3><div class="sub">Course yang sudah punya credential</div></div>
        <div class="right"><span class="badge badge-primary">${withBadge} / ${S.courses.length}</span></div></div>
      <div class="card-pad">
        <div class="bar"><i style="width:${Math.round(withBadge / S.courses.length * 100)}%"></i></div>
        <p style="font-size:12.5px;color:var(--text-2);margin-top:10px">
          ${S.courses.length - withBadge} course belum menetapkan badge. Peserta tidak akan menerima bukti kompetensi untuk course tersebut.</p>
        <button class="btn btn-sm" style="margin-top:12px" data-cms-go="badges">${icon('shield', 'icon icon-xs')} Atur Badge</button>
      </div>
    </section>
  `);
}

function kpi(ico, tone, title, value, desc) {
  return `
  <div class="card kpi">
    <div class="kpi-top"><div class="kpi-icon tone-${tone}">${icon(ico, 'icon icon-sm')}</div><div class="kpi-title">${esc(title)}</div></div>
    <div class="kpi-value">${esc(value)}</div>
    <div class="kpi-desc">${esc(desc)}</div>
  </div>`;
}

/* ---------------------------------------------------------
   Router CMS
   --------------------------------------------------------- */
const ROUTES = {};

function render(seg) {
  if (!S) load();
  const main = document.getElementById('view');
  const [a, b] = seg;
  let html;

  if (!a) html = viewDashboard();
  else if (ROUTES[a]) html = ROUTES[a](b);
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

window.CMS = { render, get state() { return S; }, save, ROUTES, shell, pageHead, esc, icon, flash,
  statusBadge, ring, completeness, courseChecklist, CATEGORIES, ROLES, LEVELS };

})();
/* =========================================================
   CMS — Training Path
   ========================================================= */
(() => {
const C = window.CMS, { esc, icon, shell, pageHead, statusBadge } = C;
const S = () => C.state;

function field(label, html, hint) {
  return `<label class="cms-field"><span class="cms-label">${esc(label)}</span>${html}${hint ? `<em class="cms-hint">${esc(hint)}</em>` : ''}</label>`;
}
const input = (k, v, ph = '') => `<input class="cms-input" data-k="${k}" value="${esc(v || '')}" placeholder="${esc(ph)}" />`;
const area = (k, v, r = 3) => `<textarea class="cms-input" data-k="${k}" rows="${r}">${esc(v || '')}</textarea>`;

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
            <td>${esc(p.audience||'—')}</td>
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
    ${pageHead('Edit training path', p.title, 'Atur identitas path lalu susun urutan course-nya.',
      `<button class="btn btn-sm" data-cms-go="paths">${icon('chevron-left','icon icon-xs')} Kembali</button>
       <button class="btn btn-sm" data-preview-path="${p.id}">${icon('play','icon icon-xs')} Lihat sebagai peserta</button>
       <button class="btn btn-primary btn-sm" data-save-path="${p.id}">${icon('check','icon icon-xs')} Simpan</button>`)}

    <div class="cms-cols">
      <section class="card">
        <div class="card-head"><div><h3>1 · Identitas Path</h3></div></div>
        <div class="card-pad cms-form" data-path-form="${p.id}">
          ${field('Nama Path *', input('title', p.title))}
          ${field('Kategori / Eyebrow', input('eyebrow', p.eyebrow, 'mis. Mandatory + role-based'))}
          ${field('Deskripsi', area('description', p.description))}
          ${field('Target Peserta', input('audience', p.audience))}
          ${field('Estimasi Waktu', input('duration', p.duration, 'mis. 12–16 jam'))}
          ${field('Status', `<select class="cms-input" data-k="status">
              <option value="draft" ${p.status==='draft'?'selected':''}>Draft</option>
              <option value="published" ${p.status==='published'?'selected':''}>Published</option>
            </select>`)}
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <div><h3>2 · Urutan Course</h3><div class="sub">${picked.length} course · ${totalMin} menit materi</div></div>
        </div>
        <div class="card-pad">
          <div class="cms-picker">
            <select class="cms-input" id="pathAddSel">
              <option value="">+ Tambahkan course ke path…</option>
              ${all.filter(c=>!p.courseIds.includes(c.id)).map(c=>`<option value="${c.id}">${esc(c.id)} · ${esc(c.title)}</option>`).join('')}
            </select>
          </div>
          <div class="cms-seq" id="pathSeq">
            ${picked.length ? picked.map((c,i)=>`
              <div class="cms-seq-row" data-cid="${c.id}">
                <span class="cms-seq-num">${String(i+1).padStart(2,'0')}</span>
                <span class="cms-row-main">
                  <strong>${esc(c.id)} · ${esc(c.title)}</strong>
                  <small>${esc(c.category)} · ${esc(c.level)} · ${esc(c.duration)}${c.prerequisite?` · prasyarat ${esc(c.prerequisite)}`:''}</small>
                </span>
                ${C.ring(C.completeness(c))}
                <span class="cms-seq-act">
                  <button class="icon-btn" data-mv="up" title="Naik">${icon('chevron-up-down','icon icon-xs')}</button>
                  <button class="icon-btn" data-rm title="Hapus dari path">${icon('close','icon icon-xs')}</button>
                </span>
              </div>`).join('')
              : `<div class="cms-empty">${icon('route')}<p>Belum ada course. Tambahkan lewat dropdown di atas.</p></div>`}
          </div>
        </div>
      </section>
    </div>`);
}

/* ---------------- Interaksi ---------------- */
document.addEventListener('input', e => {
  const form = e.target.closest('[data-path-form]');
  if (!form) return;
  const p = S().paths.find(x => x.id === form.dataset.pathForm);
  const k = e.target.dataset.k;
  if (p && k) p[k] = e.target.value;
});

document.addEventListener('change', e => {
  if (e.target.id === 'pathAddSel' && e.target.value) {
    const id = location.hash.split('/').pop();
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

  const row = e.target.closest('.cms-seq-row');
  if (!row) return;
  const id = location.hash.split('/').pop();
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
   CMS — Course (info, outcome, modul, assessment, OJT, badge)
   ========================================================= */
(() => {
const C = window.CMS, { esc, icon, shell, pageHead, statusBadge, ring, completeness, courseChecklist } = C;
const S = () => C.state;
const cur = () => S().courses.find(c => c.id === location.hash.split('/').pop());

const fld = (l, h, hint) => `<label class="cms-field"><span class="cms-label">${esc(l)}</span>${h}${hint?`<em class="cms-hint">${esc(hint)}</em>`:''}</label>`;
const inp = (k, v, ph='') => `<input class="cms-input" data-k="${k}" value="${esc(v||'')}" placeholder="${esc(ph)}" />`;
const ta  = (k, v, r=3) => `<textarea class="cms-input" data-k="${k}" rows="${r}">${esc(v||'')}</textarea>`;
const sel = (k, v, opts) => `<select class="cms-input" data-k="${k}">${opts.map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;

let TAB = 'info';
const TABS = [['info','Info Dasar'],['outcome','Hasil Belajar'],['modules','Modul'],
              ['pretest','Pre-test'],['posttest','Final Assessment'],['ojt','OJT & Badge'],['sources','Sumber']];

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
          <td>${ring(completeness(c))}</td>
          <td>${statusBadge(c.status)}</td>
          <td style="text-align:right"><button class="btn btn-sm" data-cms-open="courses/${c.id}">Edit</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>`);
};

/* ---------------- Editor ---------------- */
function editor(id) {
  const c = S().courses.find(x => x.id === id);
  if (!c) return C.ROUTES.courses();
  const chk = courseChecklist(c);

  return shell('courses', `
    ${pageHead(`${c.id} · ${c.category}`, c.title, '',
      `<button class="btn btn-sm" data-cms-go="courses">${icon('chevron-left','icon icon-xs')} Kembali</button>
       <button class="btn btn-sm" data-preview-course="${c.id}">${icon('play','icon icon-xs')} Lihat sebagai peserta</button>
       <button class="btn btn-primary btn-sm" data-save-course>${icon('check','icon icon-xs')} Simpan</button>`)}

    <div class="cms-checkbar">
      ${ring(completeness(c))}
      <div class="cms-checkitems">
        ${chk.map(x=>`<span class="cms-check ${x.ok?'ok':''}">${icon(x.ok?'check-circle':'close','icon icon-xs')}${esc(x.key)}</span>`).join('')}
      </div>
    </div>

    <div class="tabbar">${TABS.map(([k,l],i)=>`
      <button class="tab ${TAB===k?'active':''}" data-cstab="${k}"><span class="tnum">${i+1}</span>${esc(l)}</button>`).join('')}</div>

    <div class="cms-form" data-course-form="${c.id}">${body(c)}</div>`);
}

function body(c) {
  if (TAB === 'info') return `
    <div class="cms-cols">
      <section class="card"><div class="card-head"><div><h3>Identitas Course</h3></div></div>
        <div class="card-pad">
          ${fld('Kode Course *', inp('id', c.id, 'QFS-101'), 'Kode dipakai sebagai prasyarat course lain.')}
          ${fld('Judul *', inp('title', c.title))}
          ${fld('Judul Pendek', inp('shortTitle', c.shortTitle), 'Dipakai di stepper training path.')}
          ${fld('Ringkasan *', ta('summary', c.summary))}
          ${fld('Kategori *', sel('category', c.category, C.CATEGORIES))}
          ${fld('Level *', sel('level', c.level, C.LEVELS))}
          ${fld('Durasi *', inp('duration', c.duration, '95 menit'))}
        </div></section>
      <section class="card"><div class="card-head"><div><h3>Sasaran &amp; Akses</h3></div></div>
        <div class="card-pad">
          ${fld('Target Peserta *', ta('audience', c.audience, 2))}
          ${fld('Peran yang Disasar', `<div class="cms-chips">${C.ROLES.map(r=>`
            <button class="chip ${(c.roles||[]).includes(r)?'active':''}" data-role="${esc(r)}">${esc(r)}</button>`).join('')}</div>`)}
          ${fld('Prasyarat', `<select class="cms-input" data-k="prerequisite">
              <option value="">Tidak ada prasyarat</option>
              ${S().courses.filter(x=>x.id!==c.id).map(x=>`<option value="${esc(x.id)}" ${c.prerequisite===x.id?'selected':''}>${esc(x.id)} · ${esc(x.title)}</option>`).join('')}
            </select>`, 'Course ini terkunci sampai prasyarat selesai.')}
          ${fld('Status Publikasi', `<select class="cms-input" data-k="status">
              <option value="draft" ${c.status==='draft'?'selected':''}>Draft</option>
              <option value="published" ${c.status==='published'?'selected':''}>Published</option></select>`)}
        </div></section>
    </div>`;

  if (TAB === 'outcome') return listEditor('outcomes', c, 'Hasil Belajar',
    'Kemampuan yang harus terbukti setelah peserta menyelesaikan course.', 'Tulis satu hasil belajar…');

  if (TAB === 'modules') return `
    <section class="card">
      <div class="card-head"><div><h3>Modul Course</h3><div class="sub">${(c.modules||[]).length} modul · urutan menentukan alur belajar</div></div>
        <div class="right"><button class="btn btn-sm btn-primary" data-add-mod>${icon('sparkles','icon icon-xs')} Tambah Modul</button></div></div>
      <div class="card-pad cms-list">
        ${(c.modules||[]).length ? c.modules.map((m,i)=>`
          <div class="cms-seq-row" data-mi="${i}">
            <span class="cms-seq-num">${String(i+1).padStart(2,'0')}</span>
            <span class="cms-row-main">
              <input class="cms-inline" data-mk="title" data-mi="${i}" value="${esc(m.title||'')}" placeholder="Judul modul" />
              <input class="cms-inline sub" data-mk="lesson" data-mi="${i}" value="${esc(m.lesson||'')}" placeholder="Sub-judul / fokus materi" />
            </span>
            <input class="cms-mini" data-mk="minutes" data-mi="${i}" value="${esc(m.minutes||'')}" placeholder="mnt" />
            ${c.id==='QFS-101'?`<button class="btn btn-sm" data-cms-open="modules/${i}">Materi</button>`:''}
            <button class="icon-btn" data-rm-mod="${i}">${icon('close','icon icon-xs')}</button>
          </div>`).join('')
          : `<div class="cms-empty">${icon('layers')}<p>Belum ada modul.</p></div>`}
      </div>
    </section>`;

  if (TAB === 'pretest')  return quizEditor(c, 'pretest', 'Pre-test',
    'Mengukur pemahaman awal sebelum materi. Tidak mengunci akses modul.');
  if (TAB === 'posttest') return quizEditor(c, 'posttest', 'Final Assessment',
    'Penutup course. Sertifikat terbit bila lulus passing score.');

  if (TAB === 'ojt') return `
    <div class="cms-cols">
      <section class="card"><div class="card-head"><div><h3>Badge &amp; Sertifikat</h3></div></div>
        <div class="card-pad">
          ${fld('Nama Badge / Credential *', inp('badge', c.badge, 'Sertifikat operasional Lahans'), 'Ini yang diterima peserta setelah lulus.')}
          ${fld('Masa Berlaku', inp('badgeValidity', c.badgeValidity, '12 bulan'))}
          ${fld('Passing Score', inp('passingScore', c.passingScore, '80'))}
          ${fld('Maksimal Attempt', inp('maxAttempt', c.maxAttempt, '3'))}
          ${fld('Aturan Remedial', ta('remedial', c.remedial, 3))}
          ${fld('Critical Behaviour (gagal otomatis)', ta('criticalBehavior', c.criticalBehavior, 3))}
        </div></section>
      <div style="display:flex;flex-direction:column;gap:16px">
        <section class="card"><div class="card-head"><div><h3>Bobot Rubrik</h3></div>
          <div class="right"><button class="btn btn-sm" data-add-rub>+ Kriteria</button></div></div>
          <div class="card-pad cms-list">
            ${(c.rubric||[]).map((r,i)=>`<div class="cms-seq-row">
              <input class="cms-inline" data-rk="label" data-ri="${i}" value="${esc(r.label)}" />
              <input class="cms-mini" data-rk="weight" data-ri="${i}" value="${esc(r.weight)}" />
              <button class="icon-btn" data-rm-rub="${i}">${icon('close','icon icon-xs')}</button>
            </div>`).join('') || `<div class="cms-empty">${icon('clipboard')}<p>Belum ada kriteria.</p></div>`}
          </div></section>
        ${listEditor('assignment', c, 'Assignment OJT per Modul', 'Praktik kerja yang dinilai atasan atau Quality.', 'Tulis satu assignment…')}
        ${listEditor('completion', c, 'Syarat Kelulusan', '', 'Tulis satu syarat…')}
      </div>
    </div>`;

  if (TAB === 'sources') return `
    <section class="card">
      <div class="card-head"><div><h3>Sumber Referensi</h3><div class="sub">Standar &amp; materi resmi yang mendasari course</div></div>
        <div class="right"><button class="btn btn-sm btn-primary" data-add-src>+ Sumber</button></div></div>
      <div class="card-pad cms-list">
        ${(c.sources||[]).map((s,i)=>`<div class="cms-seq-row">
          <span class="cms-row-main">
            <input class="cms-inline" data-sk="label" data-si="${i}" value="${esc(s.label)}" placeholder="Judul sumber" />
            <input class="cms-inline sub" data-sk="url" data-si="${i}" value="${esc(s.url)}" placeholder="https://" />
          </span>
          <input class="cms-mini wide" data-sk="type" data-si="${i}" value="${esc(s.type||'')}" placeholder="Tipe" />
          <button class="icon-btn" data-rm-src="${i}">${icon('close','icon icon-xs')}</button>
        </div>`).join('') || `<div class="cms-empty">${icon('file')}<p>Belum ada sumber.</p></div>`}
      </div>
    </section>`;
  return '';
}

function listEditor(key, c, title, sub, ph) {
  const arr = c[key] || [];
  return `<section class="card">
    <div class="card-head"><div><h3>${esc(title)}</h3>${sub?`<div class="sub">${esc(sub)}</div>`:''}</div>
      <div class="right"><button class="btn btn-sm" data-add-item="${key}">+ Tambah</button></div></div>
    <div class="card-pad cms-list">
      ${arr.map((t,i)=>`<div class="cms-seq-row">
        <span class="cms-seq-num">${i+1}</span>
        <textarea class="cms-inline grow" data-lk="${key}" data-li="${i}" rows="2" placeholder="${esc(ph)}">${esc(t)}</textarea>
        <button class="icon-btn" data-rm-item="${key}|${i}">${icon('close','icon icon-xs')}</button>
      </div>`).join('') || `<div class="cms-empty">${icon('clipboard')}<p>Belum ada isi.</p></div>`}
    </div></section>`;
}

function quizEditor(c, key, title, sub) {
  const qs = c[key] || [];
  return `<section class="card">
    <div class="card-head"><div><h3>${esc(title)}</h3><div class="sub">${esc(sub)}</div></div>
      <div class="right"><span class="badge badge-neutral">${qs.length} soal</span>
        <button class="btn btn-sm btn-primary" data-add-q="${key}">+ Soal</button></div></div>
    <div class="card-pad cms-list">
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
    </div></section>`;
}

/* ---------------- Interaksi ---------------- */
const re = () => C.render(['courses', cur().id]);

document.addEventListener('input', e => {
  const f = e.target.closest('[data-course-form]'); if (!f) return;
  const c = cur(); if (!c) return;
  const t = e.target, d = t.dataset;
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
  if (a) { const [k,i,oi] = a.split('|'); cur()[k][+i].answer = +oi; re(); return; }
  if (e.target.id === 'cq' || e.target.id === 'ccat' || e.target.id === 'cst') return;
});

document.addEventListener('input', e => {
  if (e.target.id === 'cq') { fq = e.target.value; C.render(['courses']); const n=document.getElementById('cq'); if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length);} }
});
document.addEventListener('change', e => {
  if (e.target.id === 'ccat') { fcat = e.target.value; C.render(['courses']); }
  if (e.target.id === 'cst') { fst = e.target.value; C.render(['courses']); }
});

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-cstab]');
  if (tab) { TAB = tab.dataset.cstab; re(); return; }

  if (e.target.closest('[data-new-course]')) {
    const id = 'NEW-' + (S().courses.length + 1);
    S().courses.push({ id, title: 'Course Baru', kind: 'sample', category: C.CATEGORIES[0], level: 'Foundation',
      duration: '', summary: '', audience: '', roles: [], modules: [], outcomes: [], sources: [],
      pretest: [], posttest: [], assignment: [], rubric: [], completion: [], badge: '', badgeValidity: '',
      passingScore: 80, maxAttempt: 3, status: 'draft' });
    TAB = 'info'; C.render(['courses', id]); return;
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
   ========================================================= */
(() => {
const C = window.CMS, { esc, icon, shell, pageHead, statusBadge, ring, completeness } = C;
const S = () => C.state;
const fld = (l,h,hint) => `<label class="cms-field"><span class="cms-label">${esc(l)}</span>${h}${hint?`<em class="cms-hint">${esc(hint)}</em>`:''}</label>`;
const inp = (k,v,ph='') => `<input class="cms-input" data-mk2="${k}" value="${esc(v||'')}" placeholder="${esc(ph)}" />`;

/* ================= Modul & Materi ================= */
let MTAB = 'utama';

C.ROUTES.modules = (i) => {
  if (i !== undefined) return modEditor(+i);
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

function modEditor(i) {
  const m = S().modules[i];
  if (!m) return C.ROUTES.modules();
  return shell('modules', `
    ${pageHead(`Modul ${i+1} · ${m.courseId}`, m.title, '',
      `<button class="btn btn-sm" data-cms-go="modules">${icon('chevron-left','icon icon-xs')} Kembali</button>
       <button class="btn btn-sm" data-prev-mod="${i}">${icon('play','icon icon-xs')} Lihat sebagai peserta</button>
       <button class="btn btn-primary btn-sm" data-save-mod>${icon('check','icon icon-xs')} Simpan</button>`)}
    <div class="tabbar">
      <button class="tab ${MTAB==='utama'?'active':''}" data-mtab2="utama"><span class="tnum">1</span>Materi Utama</button>
      <button class="tab ${MTAB==='check'?'active':''}" data-mtab2="check"><span class="tnum">2</span>Rangkuman &amp; Knowledge Check</button>
    </div>
    <div class="cms-form" data-mod-form="${i}">${MTAB==='utama'?modUtama(m,i):modCheck(m,i)}</div>`);
}

function arrCard(title, sub, key, arr, i, ph) {
  return `<section class="card">
    <div class="card-head"><div><h3>${esc(title)}</h3>${sub?`<div class="sub">${esc(sub)}</div>`:''}</div>
      <div class="right"><button class="btn btn-sm" data-madd="${key}">+ Tambah</button></div></div>
    <div class="card-pad cms-list">
      ${(arr||[]).map((t,x)=>`<div class="cms-seq-row">
        <span class="cms-seq-num">${x+1}</span>
        <textarea class="cms-inline grow" data-marr="${key}|${x}" rows="2" placeholder="${esc(ph)}">${esc(t)}</textarea>
        <button class="icon-btn" data-mrm="${key}|${x}">${icon('close','icon icon-xs')}</button>
      </div>`).join('') || `<div class="cms-empty">${icon('clipboard')}<p>Belum ada isi.</p></div>`}
    </div></section>`;
}

function modUtama(m, i) {
  return `
    <section class="card"><div class="card-head"><div><h3>Identitas Modul</h3></div></div>
      <div class="card-pad cms-cols2">
        ${fld('Judul Modul', inp('title', m.title))}
        ${fld('Sub-judul / Fokus', inp('lesson', m.lesson))}
      </div></section>
    ${arrCard('Tujuan Pembelajaran','Ditampilkan sebagai grid di awal modul.','objectives',m.objectives,i,'Tulis satu tujuan…')}
    <section class="card">
      <div class="card-head"><div><h3>Materi Mendalam</h3><div class="sub">${(m.sections||[]).length} bagian bernomor</div></div>
        <div class="right"><button class="btn btn-sm btn-primary" data-madd-sec>+ Bagian</button></div></div>
      <div class="card-pad cms-list">
        ${(m.sections||[]).map((s,x)=>`<div class="cms-sec">
          <div class="cms-sec-head"><span class="cms-seq-num">${String(x+1).padStart(2,'0')}</span>
            <input class="cms-inline" data-msec="title|${x}" value="${esc(s.title)}" placeholder="Judul bagian" />
            <button class="icon-btn" data-mrm-sec="${x}">${icon('close','icon icon-xs')}</button></div>
          <textarea class="cms-inline" data-msec="paragraphs|${x}" rows="4" placeholder="Paragraf — pisahkan antar paragraf dengan baris kosong">${esc((s.paragraphs||[]).join('\n\n'))}</textarea>
          <textarea class="cms-inline" data-msec="bullets|${x}" rows="3" placeholder="Poin bullet — satu per baris">${esc((s.bullets||[]).join('\n'))}</textarea>
        </div>`).join('') || `<div class="cms-empty">${icon('book')}<p>Belum ada bagian materi.</p></div>`}
      </div></section>
    ${arrCard('Playbook Operasional','Langkah praktis bernomor.','playbook',m.playbook,i,'ISTILAH lalu penjelasan…')}
    <div class="cms-cols">
      ${arrCard('Red Flags','Tanda bahaya yang harus dikenali.','redFlags',m.redFlags,i,'Tulis satu red flag…')}
      <section class="card">
        <div class="card-head"><div><h3>Kesalahan Umum</h3></div>
          <div class="right"><button class="btn btn-sm" data-madd-mis>+ Tambah</button></div></div>
        <div class="card-pad cms-list">
          ${(m.mistakes||[]).map((x,idx)=>`<div class="cms-sec">
            <div class="cms-sec-head">
              <input class="cms-inline" data-mmis="title|${idx}" value="${esc(x.title)}" placeholder="Judul kesalahan" />
              <button class="icon-btn" data-mrm-mis="${idx}">${icon('close','icon icon-xs')}</button></div>
            <textarea class="cms-inline" data-mmis="explanation|${idx}" rows="2" placeholder="Penjelasan">${esc(x.explanation)}</textarea>
          </div>`).join('') || `<div class="cms-empty">${icon('info')}<p>Belum ada.</p></div>`}
        </div></section>
    </div>
    <section class="card">
      <div class="card-head"><div><h3>Studi Kasus Bertingkat</h3><div class="sub">${(m.cases||[]).length} kasus</div></div>
        <div class="right"><button class="btn btn-sm btn-primary" data-madd-case>+ Kasus</button></div></div>
      <div class="card-pad cms-list">
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
      </div></section>`;
}

function modCheck(m, i) {
  const qs = m.knowledgeCheck || [];
  return `
    ${arrCard('Yang Wajib Diingat','Rangkuman inti modul.','summary',m.summary,i,'Tulis satu poin rangkuman…')}
    <section class="card">
      <div class="card-head"><div><h3>Knowledge Check</h3><div class="sub">Peserta melihat pembahasan langsung setelah menjawab</div></div>
        <div class="right"><span class="badge badge-neutral">${qs.length} soal</span>
          <button class="btn btn-sm btn-primary" data-madd-q>+ Soal</button></div></div>
      <div class="card-pad cms-list">
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
      </div></section>`;
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
    <div class="grid g-3">
      ${kpiMini('clipboard','sky','Total Soal',total)}
      ${kpiMini('shield','amber','Course Tanpa Pre-test',noPre)}
      ${kpiMini('check-circle','green','Course Ber-assessment',S().courses.filter(c=>(c.posttest||[]).length).length)}
    </div>
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

const kpiMini = (ico,tone,t,v) => `<div class="card kpi">
  <div class="kpi-top"><div class="kpi-icon tone-${tone}">${icon(ico,'icon icon-sm')}</div><div class="kpi-title">${esc(t)}</div></div>
  <div class="kpi-value">${esc(v)}</div></div>`;

/* ================= Badge & Sertifikat ================= */
C.ROUTES.badges = () => {
  const cs = S().courses;
  const withB = cs.filter(c=>c.badge);
  return shell('badges', `
    ${pageHead('Badge & sertifikat','Credential yang Diterima Peserta',
      'Badge terbit otomatis setelah peserta lulus final assessment dan OJT.')}
    <div class="grid g-3">
      ${kpiMini('shield','green','Course Ber-badge',withB.length)}
      ${kpiMini('close','rose','Belum Ada Badge',cs.length-withB.length)}
      ${kpiMini('clock','amber','Berbatas Waktu',cs.filter(c=>c.badgeValidity).length)}
    </div>
    <section class="card">
      <div class="card-head"><div><h3>Daftar Badge</h3><div class="sub">Ubah langsung di tabel</div></div></div>
      <div class="table-wrap"><table class="tbl">
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
      <div class="table-wrap"><table class="tbl">
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
const curMod = () => S().modules[+(location.hash.split('/').pop())];
const reMod = () => C.render(['modules', location.hash.split('/').pop()]);
const lines = v => v.split('\n').map(x=>x.trim()).filter(Boolean);

document.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (d.bk) { const [k,id]=d.bk.split('|'); const c=S().courses.find(x=>x.id===id); if(c) c[k]=t.value; return; }
  if (d.kk) { const [k,i]=d.kk.split('|'); S().knowledge[+i][k]=t.value; return; }
  const f = t.closest('[data-mod-form]'); if (!f) return;
  const m = curMod(); if (!m) return;
  if (d.mk2) { m[d.mk2] = t.value; return; }
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
  if (a) { const [x,oi]=a.split('|'); curMod().knowledgeCheck[+x].answer=+oi; reMod(); }
});

document.addEventListener('click', e => {
  const tb = e.target.closest('[data-mtab2]'); if (tb) { MTAB = tb.dataset.mtab2; reMod(); return; }
  if (e.target.closest('[data-save-mod]')) { C.save(); return; }
  const pm = e.target.closest('[data-prev-mod]'); if (pm) { location.hash = `#/course/QFS-101/m${pm.dataset.prevMod}`; return; }

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
