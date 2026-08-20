/* =========================================================
   Lahans Learning Academy — shell, routing, views
   Konten sepenuhnya berasal dari prototype Lahans (assets/data.js)
   ========================================================= */

const DATA = window.LAHANS;
const COURSES = DATA.catalog;
const PATHS = DATA.paths;
const byId = Object.fromEntries(COURSES.map(c => [c.id, c]));
const MASTER_DOC = 'https://docs.google.com/document/d/1DEEDvIkvGHfUQeMqncARatVoWRT-JZ5TPQQTieLNVv8';

/* ---------- Learner state (sama dengan prototype: belum ada progres) ---------- */
const STATE = {
  enrolled: ['QFS-101', 'ONB-101', 'COM-101'],
  assigned: [
    { id: 'QFS-101', type: 'Wajib' },
    { id: 'ONB-101', type: 'Wajib' },
    { id: 'COM-101', type: 'Pengembangan' },
  ],
  completed: [],
  mandatory: ['QFS-101', 'ONB-101'],
  featuredPaths: ['qfs', 'onboarding', 'leadership'],
};

const QFS_MODULE_TOTAL = COURSES.filter(c => c.kind === 'qfs').reduce((n, c) => n + c.moduleCount, 0);

const isDone = id => STATE.completed.includes(id);
const isUnlocked = c => !c.prerequisite || isDone(c.prerequisite);
const pathProgress = p => Math.round((p.courseIds.filter(isDone).length / p.courseIds.length) * 100);

/* ---------- helpers ---------- */
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const icon = (name, cls = 'icon') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
const minutesOf = c => parseInt(String(c.duration).replace(/\D/g, ''), 10) || 0;
const LETTER = ['A', 'B', 'C', 'D', 'E'];

/* =========================================================
   Navigation
   ========================================================= */

const NAV = [
  { label: 'Overview Company', icon: 'grid' },
  { label: 'Human Capital', icon: 'users' },
  {
    label: 'Learning Development', icon: 'book', open: true, children: [
      { label: 'Learning Monitoring', route: 'monitoring' },
      { label: 'Learning Status', route: 'status' },
      { label: 'Training Path', route: 'path', count: () => PATHS.length },
      { label: 'Competency Matrix', route: 'competency', badge: 'NEW' },
      { label: 'Career Path', route: 'career', badge: 'NEW' },
      { label: 'E-Learning', route: 'elearning', count: () => COURSES.length },
      { label: 'Knowledge Base', route: 'knowledge', count: () => DATA.knowledge.length },
      { label: 'Training Event', route: 'events' },
      { label: 'Approval Training Event', route: 'approval' },
      { label: 'Feedback Training Event', route: 'feedback' },
    ]
  },
  { label: 'Document Control', icon: 'file' },
  { label: 'IT Ticketing', icon: 'ticket' },
  { label: 'Information', icon: 'info' },
  { label: 'LMS', icon: 'layers' },
  { label: 'CMS', icon: 'command' },
  { label: 'Pengaturan', icon: 'settings' },
];

function renderNav() {
  const nav = document.getElementById('sideNav');
  nav.innerHTML = '<div class="nav-group-label">General</div>';

  NAV.forEach((group, gi) => {
    const hasKids = !!group.children;
    const btn = el(`
      <button class="nav-item" ${hasKids ? `aria-expanded="${group.open ? 'true' : 'false'}"` : ''}>
        ${icon(group.icon)}
        <span>${esc(group.label)}</span>
        ${icon('chevron-right', 'icon chev')}
      </button>`);
    nav.appendChild(btn);

    if (!hasKids) {
      btn.addEventListener('click', () => toast(`Menu "${group.label}" belum tersedia pada prototype ini.`));
      return;
    }

    const sub = el('<div class="nav-sub open"></div>');
    group.children.forEach(child => {
      const item = el(`
        <button class="nav-sub-item" data-route="${child.route}">
          <span>${esc(child.label)}</span>
          ${child.badge ? `<span class="pill-badge">${child.badge}</span>` : ''}
          ${child.count && !child.badge ? `<span class="count">${child.count()}</span>` : ''}
        </button>`);
      item.addEventListener('click', () => { location.hash = '#/' + child.route; closeMobileNav(); });
      sub.appendChild(item);
    });
    nav.appendChild(sub);

    btn.addEventListener('click', () => {
      if (document.getElementById('sidebar').classList.contains('collapsed')) {
        setSidebarCollapsed(false);
        sub.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        return;
      }
      const open = sub.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });

    if (gi === 2) nav.appendChild(el('<div class="nav-group-label">Other</div>'));
  });
}

function markActiveNav(route) {
  document.querySelectorAll('.nav-sub-item').forEach(b => b.classList.toggle('active', b.dataset.route === route));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('is-parent-active'));
  const active = document.querySelector('.nav-sub-item.active');
  if (active) {
    const parentBtn = active.closest('.nav-sub').previousElementSibling;
    parentBtn.classList.add('is-parent-active');
    parentBtn.setAttribute('aria-expanded', 'true');
    active.closest('.nav-sub').classList.add('open');
  }
}

function closeMobileNav() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('scrim').classList.remove('open');
}

/* =========================================================
   Shared partials
   ========================================================= */

function kpiCard({ ico, tone = 'blue', title, value, desc, trend, trendClass = 'flat' }) {
  return `
  <div class="card kpi">
    <div class="kpi-top">
      <div class="kpi-icon tone-${tone}">${icon(ico, 'icon icon-sm')}</div>
      <div class="kpi-title">${esc(title)}</div>
      ${trend ? `<span class="trend ${trendClass}">${esc(trend)}</span>` : ''}
    </div>
    <div class="kpi-value">${esc(value)}</div>
    <div class="kpi-desc">${esc(desc)}</div>
  </div>`;
}

function levelBadge(level) {
  const cls = level === 'Foundation' ? 'badge-success' : level === 'Intermediate' ? 'badge-primary' : 'badge-warning';
  return `<span class="badge ${cls}">${esc(level)}</span>`;
}

function courseCard(c) {
  const unlocked = isUnlocked(c);
  return `
  <article class="course-card ${unlocked ? '' : 'locked'}" data-course="${c.id}" tabindex="0" role="button">
    <div class="cc-top">
      <span class="cc-code">${esc(c.id)}</span>
      ${levelBadge(c.level)}
      <span class="cc-lock">${icon(unlocked ? 'play' : 'lock', 'icon icon-sm')}</span>
    </div>
    <div>
      <div class="cc-cat">${esc(c.category)}</div>
      <h3 class="cc-title">${esc(c.title)}</h3>
    </div>
    <p class="cc-sum">${esc(c.summary)}</p>
    <div class="cc-meta">
      <span>${icon('clock', 'icon icon-xs')} ${esc(c.duration)}</span>
      <span>${icon('book', 'icon icon-xs')} ${c.moduleCount} modul</span>
    </div>
    <div class="cc-foot">
      ${c.prerequisite
        ? `<span class="badge badge-neutral">${icon('lock', 'icon icon-xs')} Prasyarat ${esc(c.prerequisite)}</span>`
        : `<span class="badge badge-success">${icon('check', 'icon icon-xs')} Tanpa Prasyarat</span>`}
      <span class="go">${unlocked ? 'Buka Course' : 'Lihat Silabus'} ${icon('arrow-right', 'icon icon-xs')}</span>
    </div>
  </article>`;
}

function emptyState({ title, body, action }) {
  return `
  <div class="card empty">
    <div class="ico">${icon('sparkles')}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(body)}</p>
    ${action ? `<button class="btn btn-primary btn-sm" data-goto="${action.route}">${esc(action.label)} ${icon('arrow-right', 'icon icon-xs')}</button>` : ''}
  </div>`;
}

/* =========================================================
   Quiz component (shared: knowledge check, pre-test, final assessment)
   ========================================================= */

const QUIZ_STATE = {};

function quizBlock(quizId, questions, { title, subtitle, passing } = {}) {
  QUIZ_STATE[quizId] = QUIZ_STATE[quizId] || {};
  return `
  <div class="dsec" data-quiz="${quizId}">
    <div class="quiz-head">
      <div>
        <small>${esc(subtitle || 'Knowledge check formatif')}</small>
        <strong>${esc(title || `${questions.length} pertanyaan`)}</strong>
      </div>
      <div class="quiz-score">
        <span class="badge badge-neutral" data-quiz-score="${quizId}">0 / ${questions.length} terjawab</span>
        ${passing ? `<span class="badge badge-primary">Passing score ${passing}</span>` : ''}
      </div>
    </div>
    <div>
      ${questions.map((q, qi) => `
      <div class="qcard">
        <div class="qnum">Pertanyaan ${qi + 1}</div>
        <div class="qtext">${esc(q.question)}</div>
        <div class="qopts">
          ${q.options.map((opt, oi) => `
            <button class="qopt" data-q="${quizId}" data-qi="${qi}" data-oi="${oi}">
              <span class="mark">${LETTER[oi]}</span>
              <span>${esc(opt)}</span>
            </button>`).join('')}
        </div>
        <div class="rationale" hidden>${icon('info', 'icon icon-sm')}<span>${esc(q.rationale || '')}</span></div>
      </div>`).join('')}
    </div>
  </div>`;
}

function handleQuizClick(btn) {
  const { q: quizId, qi, oi } = btn.dataset;
  const card = btn.closest('.qcard');
  const wrap = btn.closest('[data-quiz]');
  const questions = QUIZ_DATA[quizId];
  if (!questions) return;
  const question = questions[+qi];
  const answered = QUIZ_STATE[quizId][qi] !== undefined;
  if (answered) return;

  QUIZ_STATE[quizId][qi] = +oi;
  card.querySelectorAll('.qopt').forEach(o => {
    const idx = +o.dataset.oi;
    o.disabled = true;
    if (idx === question.answer) o.classList.add('correct');
    else if (idx === +oi) o.classList.add('wrong');
  });
  card.querySelector('.rationale').hidden = false;

  const done = Object.keys(QUIZ_STATE[quizId]).length;
  const correct = Object.entries(QUIZ_STATE[quizId]).filter(([k, v]) => questions[+k].answer === v).length;
  const badge = wrap.querySelector(`[data-quiz-score="${quizId}"]`);
  badge.textContent = done === questions.length
    ? `Skor ${Math.round((correct / questions.length) * 100)} · ${correct}/${questions.length} benar`
    : `${done} / ${questions.length} terjawab`;
  badge.className = 'badge ' + (done < questions.length ? 'badge-neutral'
    : correct / questions.length >= 0.8 ? 'badge-success' : 'badge-warning');
}

/** questions registry so the click handler can score without re-render */
const QUIZ_DATA = {};
function registerQuiz(id, questions) { QUIZ_DATA[id] = questions; return id; }

/* =========================================================
   Views
   ========================================================= */

const VIEWS = {};

/* ---------------- Learning Monitoring ---------------- */
VIEWS.monitoring = () => {
  const pathRows = STATE.featuredPaths.map(id => PATHS.find(p => p.id === id));
  return {
    crumb: [['Learning Development'], ['Learning Monitoring']],
    html: `
    <section class="hero">
      <div>
        <span class="kicker">Lahans Learning Academy</span>
        <h2>Belajar Lewat Path.<br><em>Atau Pilih Course.</em></h2>
        <p>Training Path membantu peserta mengikuti urutan yang direkomendasikan. Course Catalog tetap dapat diakses langsung—dengan prerequisite yang otomatis menjaga urutan 101, 201, hingga level lanjutan.</p>
        <div class="hero-cta">
          <button class="btn btn-white" data-goto="elearning">Lanjutkan Course ${icon('arrow-right', 'icon icon-xs')}</button>
          <button class="btn btn-outline" data-goto="path">Jelajahi Training Path</button>
        </div>
        <div class="hero-stats">
          <div><b>${PATHS.length}</b> Contoh Path</div>
          <div><b>${COURSES.length}</b> Course di Katalog</div>
          <div><b>Aktif</b> Completion Engine</div>
        </div>
      </div>
      <div class="hero-panel">
        <div class="row"><span>My Learning</span><b>0%</b></div>
        <div class="hero-ring" style="--p:0"><div><b>${STATE.enrolled.length}</b><small>Course Aktif</small></div></div>
        <div class="row"><span>Assigned Training</span><b>${STATE.assigned.length}</b></div>
        <div class="row"><span>Completed Courses</span><b>${STATE.completed.length}</b></div>
        <p class="cap">Hanya menghitung course yang di-enroll, bukan seluruh katalog.</p>
      </div>
    </section>

    <div class="page-head">
      <div>
        <span class="kicker">Learning status</span>
        <h1>My Learning Overview</h1>
        <p>Status dipisahkan agar jumlah course dalam katalog tidak tercampur dengan course yang sedang ditugaskan kepada peserta.</p>
      </div>
      <div class="head-actions"><button class="btn btn-sm" data-goto="status">Detail Status ${icon('arrow-right', 'icon icon-xs')}</button></div>
    </div>

    <div class="grid g-4">
      ${kpiCard({ ico: 'book', tone: 'blue', title: 'Enrolled Courses', value: STATE.enrolled.length, desc: STATE.enrolled.join(', '), trend: 'Aktif', trendClass: 'up' })}
      ${kpiCard({ ico: 'clock', tone: 'amber', title: 'Assigned Training', value: STATE.assigned.length, desc: '1 wajib · 2 pengembangan', trend: 'Berjalan', trendClass: 'warn' })}
      ${kpiCard({ ico: 'check-circle', tone: 'green', title: 'Completed Courses', value: STATE.completed.length, desc: 'Selesai setelah sertifikat terbit', trend: '0%', trendClass: 'flat' })}
      ${kpiCard({ ico: 'shield', tone: 'rose', title: 'Mandatory Compliance', value: `${STATE.mandatory.filter(isDone).length}/${STATE.mandatory.length}`, desc: STATE.mandatory.join(' dan '), trend: 'Perlu aksi', trendClass: 'warn' })}
    </div>

    <div class="grid" style="grid-template-columns: minmax(0,1.6fr) minmax(280px,1fr)">
      <section class="card">
        <div class="card-head">
          <div><h3>Progres Training Path</h3><div class="sub">Path yang sedang diikuti peserta</div></div>
          <div class="right"><button class="btn btn-sm btn-ghost" data-goto="path">Lihat Semua Path</button></div>
        </div>
        <div class="card-pad" style="display:flex;flex-direction:column;gap:18px">
          ${pathRows.map(p => `
            <div>
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <div class="pi-mark">${p.letter}</div>
                <div style="flex:1">
                  <div style="font-size:13.5px;font-weight:600">${esc(p.title)}</div>
                  <div style="font-size:11.5px;color:var(--text-3)">${p.courseIds.length} course · ${esc(p.duration)}</div>
                </div>
                <b style="font-size:13px">${pathProgress(p)}% selesai</b>
              </div>
              <div class="bar"><i style="width:${pathProgress(p)}%"></i></div>
            </div>`).join('')}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h3>QFS Module Activity</h3><div class="sub">Aktivitas modul QFS Academy</div></div></div>
        <div class="card-pad" style="display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">
          <div class="ring" style="--p:0"><div><b>0%</b><small>Module Selesai</small></div></div>
          <p style="font-size:12.5px;color:var(--text-2)">0 dari ${QFS_MODULE_TOTAL} module selesai</p>
          <button class="btn btn-sm" data-path="qfs">Buka QFS Academy ${icon('arrow-right', 'icon icon-xs')}</button>
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head">
        <div><h3>Assigned Training</h3><div class="sub">Course yang ditugaskan kepada peserta</div></div>
        <div class="right"><button class="btn btn-sm btn-ghost" data-goto="status">Kelola Status</button></div>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Kode</th><th>Course</th><th>Kategori</th><th>Level</th><th>Durasi</th><th>Tipe</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${STATE.assigned.map(a => { const c = byId[a.id]; return `
            <tr>
              <td class="code">${esc(c.id)}</td>
              <td class="t-title">${esc(c.title)}</td>
              <td>${esc(c.category)}</td>
              <td>${levelBadge(c.level)}</td>
              <td>${esc(c.duration)}</td>
              <td>${a.type === 'Wajib' ? '<span class="badge badge-error">Wajib</span>' : '<span class="badge badge-neutral">Pengembangan</span>'}</td>
              <td><span class="badge badge-warning">Belum dimulai · 0%</span></td>
              <td style="text-align:right"><button class="btn btn-sm" data-course="${c.id}">Buka</button></td>
            </tr>`; }).join('')}
          </tbody>
        </table>
      </div>
    </section>`
  };
};

/* ---------------- Learning Status ---------------- */
VIEWS.status = () => ({
  crumb: [['Learning Development'], ['Learning Status']],
  html: `
  <div class="page-head">
    <div>
      <span class="kicker">Learning status</span>
      <h1>Status Belajar Saya</h1>
      <p>Hanya menghitung course yang di-enroll, bukan seluruh katalog. Bukti kompetensi tetap berasal dari assessment dan praktik.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-sm" data-goto="monitoring">${icon('trend-up', 'icon icon-xs')} Ringkasan Monitoring</button>
      <button class="btn btn-primary btn-sm" data-goto="elearning">Tambah Course ${icon('arrow-right', 'icon icon-xs')}</button>
    </div>
  </div>

  <div class="grid g-4">
    ${kpiCard({ ico: 'book', tone: 'blue', title: 'Enrolled Courses', value: STATE.enrolled.length, desc: STATE.enrolled.join(', ') })}
    ${kpiCard({ ico: 'clock', tone: 'amber', title: 'Assigned Training', value: STATE.assigned.length, desc: '1 wajib · 2 pengembangan' })}
    ${kpiCard({ ico: 'check-circle', tone: 'green', title: 'Completed Courses', value: STATE.completed.length, desc: 'Selesai setelah sertifikat terbit' })}
    ${kpiCard({ ico: 'shield', tone: 'rose', title: 'Mandatory Compliance', value: `${STATE.mandatory.filter(isDone).length}/${STATE.mandatory.length}`, desc: STATE.mandatory.join(' dan ') })}
  </div>

  <section class="card">
    <div class="card-head">
      <div><h3>Course yang Di-enroll</h3><div class="sub">Progres per course dan modul</div></div>
      <div class="right"><span class="badge badge-neutral">${STATE.enrolled.length} course</span></div>
    </div>
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>Kode</th><th>Course</th><th>Kategori</th><th>Modul</th><th>Durasi</th><th style="width:190px">Progres</th><th>Tipe</th><th></th></tr></thead>
        <tbody>
          ${STATE.enrolled.map(id => byId[id]).map(c => `
          <tr>
            <td class="code">${esc(c.id)}</td>
            <td class="t-title">${esc(c.title)}</td>
            <td>${esc(c.category)}</td>
            <td>0 / ${c.moduleCount}</td>
            <td>${esc(c.duration)}</td>
            <td><div class="bar"><i style="width:0%"></i></div><small style="font-size:11px;color:var(--text-3)">0%</small></td>
            <td>${STATE.mandatory.includes(c.id) ? '<span class="badge badge-error">Wajib</span>' : '<span class="badge badge-neutral">Pengembangan</span>'}</td>
            <td style="text-align:right"><button class="btn btn-sm btn-primary" data-course="${c.id}">Lanjutkan</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>

  <div class="grid g-2">
    <section class="card">
      <div class="card-head"><div><h3>Mandatory Compliance</h3><div class="sub">Wajib diselesaikan seluruh karyawan</div></div></div>
      <div class="card-pad" style="display:flex;flex-direction:column;gap:10px">
        ${STATE.mandatory.map(id => { const c = byId[id]; return `
          <button class="module-item" data-course="${c.id}">
            <span class="module-number">${icon(isDone(id) ? 'check' : 'lock', 'icon icon-xs')}</span>
            <span class="module-copy"><strong>${esc(c.id)} · ${esc(c.title)}</strong><small>${esc(c.duration)} · ${c.moduleCount} modul</small></span>
            <span class="badge ${isDone(id) ? 'badge-success' : 'badge-warning'}">${isDone(id) ? 'Selesai' : 'Belum selesai'}</span>
          </button>`; }).join('')}
        <p style="font-size:12px;color:var(--text-3)">Sertifikat terbit otomatis setelah assessment lulus.</p>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><div><h3>Completed Courses</h3><div class="sub">Riwayat penyelesaian</div></div></div>
      <div class="empty" style="padding:40px 24px">
        <div class="ico">${icon('check-circle')}</div>
        <h3>Belum Ada Course Selesai</h3>
        <p>Selesaikan modul dan assessment untuk menerbitkan sertifikat pertama Anda.</p>
        <button class="btn btn-primary btn-sm" data-course="QFS-101">Mulai QFS-101 ${icon('arrow-right', 'icon icon-xs')}</button>
      </div>
    </section>
  </div>`
});

/* ---------------- Training Path ---------------- */
let activePathId = PATHS[0].id;
let pathQuery = '';

VIEWS.path = () => ({
  crumb: [['Learning Development'], ['Training Path']],
  html: `
  <div class="page-head">
    <div>
      <span class="kicker">Training path library</span>
      <h1>Jalur Belajar Sesuai Kebutuhan</h1>
      <p>Path adalah kurasi course untuk tujuan tertentu—bukan syarat untuk menemukan atau membuka course dari katalog.</p>
    </div>
    <div class="head-actions"><button class="btn btn-sm" data-goto="elearning">${icon('play', 'icon icon-xs')} Buka Course Catalog</button></div>
  </div>

  <div class="split">
    <aside class="card rail">
      <div class="rail-head">
        <div style="display:flex;align-items:center;gap:8px">
          <h3 style="font-size:14px">Semua Path</h3>
          <span class="badge badge-neutral" style="margin-left:auto">${PATHS.length}</span>
        </div>
        <div class="rail-search">${icon('search', 'icon')}<input id="pathSearch" type="search" placeholder="Cari path" value="${esc(pathQuery)}" /></div>
      </div>
      <div class="rail-list" id="pathList"></div>
    </aside>
    <section class="card" id="pathDetail"></section>
  </div>`,
  after: () => {
    document.getElementById('pathSearch').addEventListener('input', e => { pathQuery = e.target.value; renderPathList(); });
    renderPathList();
    renderPathDetail();
  }
});

function renderPathList() {
  const q = pathQuery.trim().toLowerCase();
  const list = document.getElementById('pathList');
  if (!list) return;
  const items = PATHS.filter(p => !q || `${p.title} ${p.eyebrow} ${p.description}`.toLowerCase().includes(q));
  list.innerHTML = items.length ? items.map(p => `
    <button class="path-item ${p.id === activePathId ? 'active' : ''}" data-path="${p.id}">
      <span class="pi-mark">${p.letter}</span>
      <span style="flex:1;min-width:0">
        <span class="pi-title" style="display:block">${esc(p.title)}</span>
        <span class="pi-meta">${p.courseIds.length} course · ${esc(p.duration)}</span>
        <span class="bar pi-bar"><i style="width:${pathProgress(p)}%"></i></span>
      </span>
    </button>`).join('')
    : '<p style="padding:18px;font-size:12.5px;color:var(--text-3)">Tidak ada path yang cocok.</p>';
}

function renderPathDetail() {
  const p = PATHS.find(x => x.id === activePathId);
  const node = document.getElementById('pathDetail');
  if (!p || !node) return;
  const courses = p.courseIds.map(id => byId[id]).filter(Boolean);
  const totalMinutes = courses.reduce((n, c) => n + minutesOf(c), 0);

  node.innerHTML = `
  <div class="detail-hero">
    <div class="detail-mark">${p.letter}</div>
    <div style="flex:1;min-width:220px">
      <span class="kicker">${esc(p.eyebrow)}</span>
      <h2 style="margin-top:4px">${esc(p.title)}</h2>
      <p>${esc(p.description)}</p>
    </div>
    <div class="detail-actions">
      <button class="btn btn-sm" data-goto="elearning">Lihat di Katalog</button>
      <button class="btn btn-primary btn-sm" data-course="${courses[0]?.id}">Mulai Path ${icon('arrow-right', 'icon icon-xs')}</button>
    </div>
  </div>

  <div class="meta-strip">
    <div><small>Target Peserta</small><b>${esc(p.audience)}</b></div>
    <div><small>Estimasi</small><b>${esc(p.duration)}</b></div>
    <div><small>Jumlah Course</small><b>${courses.length} course · ${totalMinutes} menit materi</b></div>
    <div><small>Progres Path</small><b>${pathProgress(p)}%</b><div class="bar" style="margin-top:6px"><i style="width:${pathProgress(p)}%"></i></div></div>
  </div>

  <div class="stepper">
    ${courses.map((c, i) => {
      const done = isDone(c.id), unlocked = isUnlocked(c);
      return `
      <div class="step ${done ? 'done' : unlocked ? 'available' : 'locked'}">
        <div class="step-rail">
          <div class="step-dot">${done ? icon('check', 'icon icon-xs') : String(i + 1).padStart(2, '0')}</div>
          <div class="step-line"></div>
        </div>
        <div class="step-body">
          <div class="sb-main">
            <div class="step-code">${esc(c.id)} · ${esc(c.category)}</div>
            <div class="step-title">${esc(c.shortTitle || c.title)}</div>
            <div class="step-sub">${esc(c.duration)} · ${c.moduleCount} modul${c.prerequisite ? ` · Setelah ${esc(c.prerequisite)}` : ''}</div>
          </div>
          <div class="sb-actions">
            ${done ? '<span class="badge badge-success">Selesai</span>'
              : unlocked ? '<span class="badge badge-primary">Tersedia</span>'
              : `<span class="badge badge-neutral">${icon('lock', 'icon icon-xs')} Terkunci</span>`}
            <button class="btn btn-sm ${unlocked ? 'btn-primary' : ''}" data-course="${c.id}">${unlocked ? 'Mulai' : 'Lihat Silabus'}</button>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>

  <div class="note">${icon('info', 'icon icon-sm')}
    <div><b>Path ini opsional.</b> Peserta tetap boleh membuka course dari Course Catalog. Saat menekan “Mulai”, sistem memeriksa prerequisite yang sama.</div>
  </div>`;
}

/* ---------------- E-Learning / Course Catalog ---------------- */
const filters = { q: '', category: 'Semua kategori', role: 'Semua peran', level: 'Semua level' };

VIEWS.elearning = () => ({
  crumb: [['Learning Development'], ['E-Learning']],
  html: `
  <div class="page-head">
    <div>
      <span class="kicker">Direct access · Course catalog</span>
      <h1>Pilih Course tanpa Masuk Training Path</h1>
      <p>Course 101 bisa langsung dimulai. Course 201 dan seterusnya tetap terlihat, tetapi tombol belajar terkunci sampai prerequisite selesai. Silabus tetap dapat dipreview.</p>
    </div>
    <div class="head-actions"><button class="btn btn-sm" data-goto="path">${icon('route', 'icon icon-xs')} Lihat Training Path</button></div>
  </div>

  <div class="filterbar">
    <div class="filter-row">
      <div class="search-input">${icon('search', 'icon')}<input id="fq" type="search" placeholder="Cari kode, judul, atau topik course" value="${esc(filters.q)}" /></div>
      <div class="select-wrap"><select id="frole">${DATA.roles.map(r => `<option ${r === filters.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>${icon('chevron-down', 'icon')}</div>
      <div class="select-wrap"><select id="flevel">${DATA.levels.map(r => `<option ${r === filters.level ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>${icon('chevron-down', 'icon')}</div>
      <button class="btn btn-sm btn-ghost" id="freset">${icon('sliders', 'icon icon-xs')} Reset</button>
    </div>
    <div class="chips" id="fchips">
      ${DATA.categories.map(c => `<button class="chip ${c === filters.category ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <div class="result-line" id="fcount"></div>
  </div>

  <div class="course-grid" id="courseGrid"></div>`,
  after: () => {
    document.getElementById('fq').addEventListener('input', e => { filters.q = e.target.value; renderCatalog(); });
    document.getElementById('frole').addEventListener('change', e => { filters.role = e.target.value; renderCatalog(); });
    document.getElementById('flevel').addEventListener('change', e => { filters.level = e.target.value; renderCatalog(); });
    document.getElementById('fchips').addEventListener('click', e => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      filters.category = chip.dataset.cat;
      document.querySelectorAll('#fchips .chip').forEach(c => c.classList.toggle('active', c === chip));
      renderCatalog();
    });
    document.getElementById('freset').addEventListener('click', () => {
      Object.assign(filters, { q: '', category: 'Semua kategori', role: 'Semua peran', level: 'Semua level' });
      document.getElementById('fq').value = '';
      document.getElementById('frole').value = filters.role;
      document.getElementById('flevel').value = filters.level;
      document.querySelectorAll('#fchips .chip').forEach(c => c.classList.toggle('active', c.dataset.cat === filters.category));
      renderCatalog();
    });
    renderCatalog();
  }
});

function filteredCourses() {
  const q = filters.q.trim().toLowerCase();
  return COURSES
    .filter(c => filters.category === 'Semua kategori' || c.category === filters.category)
    .filter(c => filters.role === 'Semua peran' || (c.roles || []).includes(filters.role))
    .filter(c => filters.level === 'Semua level' || c.level === filters.level)
    .filter(c => !q || `${c.id} ${c.title} ${c.category} ${c.summary}`.toLowerCase().includes(q));
}

function renderCatalog() {
  const list = filteredCourses();
  const grid = document.getElementById('courseGrid');
  const count = document.getElementById('fcount');
  if (!grid) return;
  const active = [
    filters.category !== 'Semua kategori' && filters.category,
    filters.role !== 'Semua peran' && filters.role,
    filters.level !== 'Semua level' && filters.level,
  ].filter(Boolean);

  count.innerHTML = `
    <span><b>${list.length}</b> dari ${COURSES.length} course</span>
    ${active.map(a => `<span class="badge badge-primary">${esc(a)}</span>`).join('')}
    <span class="right">
      <span class="badge badge-success">${list.filter(isUnlocked).length} siap dimulai</span>
      <span class="badge badge-neutral">${list.filter(c => !isUnlocked(c)).length} terkunci</span>
    </span>`;

  grid.innerHTML = list.length ? list.map(courseCard).join('') : `
    <div class="card empty" style="grid-column:1/-1">
      <div class="ico">${icon('search')}</div>
      <h3>Course Tidak Ditemukan</h3>
      <p>Coba ubah kata kunci, kategori, peran, atau level.</p>
    </div>`;
}

/* ---------------- Knowledge Base ---------------- */
VIEWS.knowledge = () => ({
  crumb: [['Learning Development'], ['Knowledge Base']],
  html: `
  <div class="page-head">
    <div>
      <span class="kicker">Knowledge base · linked to master document</span>
      <h1>Referensi Kerja di Luar Course</h1>
      <p>Knowledge Base mendukung belajar dan pekerjaan sehari-hari. Membaca referensi tidak otomatis menandai course selesai; bukti kompetensi tetap berasal dari assessment dan praktik.</p>
    </div>
  </div>

  <div class="grid g-2">
    <div class="card kb-group">
      <div class="num">10</div>
      <div>
        <div style="font-size:13.5px;font-weight:600">Product &amp; Commercial</div>
        <div style="font-size:12px;color:var(--text-3);margin:2px 0 4px">Produk, brand, dan pasar</div>
        <p style="font-size:12.5px;color:var(--text-2)">Materi yang membantu onboarding, product knowledge, sales, marketing, dan customer conversation.</p>
      </div>
    </div>
    <div class="card kb-group">
      <div class="num">20</div>
      <div>
        <div style="font-size:13.5px;font-weight:600">Operations, Quality &amp; Compliance</div>
        <div style="font-size:12px;color:var(--text-3);margin:2px 0 4px">Material, supplier, dan standar</div>
        <p style="font-size:12.5px;color:var(--text-2)">Referensi untuk packaging, OEM, QFS, procurement, R&amp;D, manufacturing, dan audit readiness.</p>
      </div>
    </div>
  </div>

  <div class="kb-grid">
    ${DATA.knowledge.map(k => `
      <a class="card kb-card" href="${MASTER_DOC}/edit?tab=${esc(k.tabId)}" target="_blank" rel="noopener">
        <div class="kb-code tone-${esc(k.tone)}">${esc(k.code)}</div>
        <h3 style="font-size:15px">${esc(k.title)}</h3>
        <p style="font-size:12.5px;color:var(--text-2)">${esc(k.description)}</p>
        <div class="cc-foot">
          <span class="badge badge-neutral">Master Document</span>
          <span class="go">Buka Knowledge Base ${icon('arrow-up-right', 'icon icon-xs')}</span>
        </div>
      </a>`).join('')}
  </div>`
});

/* ---------------- Placeholder menus ---------------- */
const PLACEHOLDER = {
  competency: ['Competency Matrix', 'Matriks kompetensi per job family, level target, dan bukti penilaian belum tersedia pada prototype ini.'],
  career: ['Career Path', 'Jalur karier, readiness, dan rencana pengembangan belum tersedia pada prototype ini.'],
  events: ['Training Event', 'Jadwal kelas, sesi, dan kuota peserta belum tersedia pada prototype ini.'],
  approval: ['Approval Training Event', 'Alur pengajuan dan persetujuan training event belum tersedia pada prototype ini.'],
  feedback: ['Feedback Training Event', 'Formulir dan rekap feedback peserta belum tersedia pada prototype ini.'],
};
Object.entries(PLACEHOLDER).forEach(([route, [title, body]]) => {
  VIEWS[route] = () => ({
    crumb: [['Learning Development'], [title]],
    html: `
    <div class="page-head">
      <div>
        <span class="kicker">Learning development</span>
        <h1>${esc(title)}</h1>
        <p>Halaman ini ditandai eksplisit agar navigasi tidak mengarahkan peserta ke konten yang berbeda.</p>
      </div>
    </div>
    ${emptyState({ title: 'Belum Tersedia di Prototype', body, action: { route: 'path', label: 'Kembali ke Training Path' } })}`
  });
});

/* =========================================================
   Course detail page
   ========================================================= */

const courseTab = {};

function courseView(courseId) {
  const c = byId[courseId];
  if (!c) return VIEWS.elearning();
  const unlocked = isUnlocked(c);
  const isQfs = c.kind === 'qfs';
  const tabs = isQfs
    ? [['overview', 'About this Course'], ['pretest', 'Pre-test'], ['modules', 'Course Content'],
       ['assessment', 'Final Assessment'], ['assignment', 'OJT & Certificate'], ['sources', 'Resources']]
    : [['overview', 'About this Course'], ['modules', 'Course Content']];
  const tab = tabs.some(t => t[0] === courseTab[courseId]) ? courseTab[courseId] : 'overview';
  const locked = !unlocked;
  const openable = ['overview', 'modules', 'sources'];

  return {
    crumb: [['Learning Development'], ['E-Learning', 'elearning'], [c.id]],
    html: `
    <section class="course-hero">
      <div class="ch-main">
        <span class="kicker">${esc(c.id)} · ${esc(c.level)} · ${esc(c.category)}</span>
        <h1>${esc(c.title)}</h1>
        <p>${esc(c.summary)}</p>
        <div class="ch-meta">
          <span>${icon('book', 'icon icon-xs')} ${c.moduleCount} Items</span>
          <span>${icon('clock', 'icon icon-xs')} ${esc(c.duration)} · Self-paced</span>
          <span>${icon(unlocked ? 'check-circle' : 'lock', 'icon icon-xs')} ${unlocked ? 'Enrolled' : `Locked · ${esc(c.prerequisite)}`}</span>
        </div>
        <div class="ch-progress">
          <div class="bar"><i style="width:0%"></i></div>
          <small>0% selesai · 0 dari ${c.moduleCount} module</small>
        </div>
      </div>
      <aside class="ch-side">
        <div class="cred-mark">L</div>
        <small>Credential</small>
        <strong>${esc(c.credential || 'Belum ditentukan')}</strong>
        <dl>
          <div><dt>Durasi</dt><dd>${esc(c.duration)}</dd></div>
          <div><dt>Passing</dt><dd>80%</dd></div>
          <div><dt>Upaya</dt><dd>Maks. 3×</dd></div>
        </dl>
        <button class="btn btn-primary btn-sm" ${unlocked ? `data-mod="${c.id}|0"` : 'disabled'}>
          ${unlocked ? 'Mulai Course' : 'Prerequisite belum selesai'} ${icon('arrow-right', 'icon icon-xs')}
        </button>
        <button class="btn btn-sm" data-ctab="${c.id}|modules">Lihat Course Content</button>
      </aside>
    </section>

    ${locked ? `
    <div class="lock-banner">
      ${icon('lock')}
      <div>
        <strong>Course terkunci untuk aktivitas belajar</strong>
        <p>Selesaikan dan dapatkan sertifikat ${esc(c.prerequisite)} terlebih dahulu. Silabus serta sumber tetap dapat dipreview.</p>
      </div>
      <button class="btn btn-sm btn-primary" data-course="${esc(c.prerequisite)}">Buka ${esc(c.prerequisite)} ${icon('arrow-right', 'icon icon-xs')}</button>
    </div>` : ''}

    <div class="tabbar" role="tablist">
      ${tabs.map(([key, label], i) => `
        <button class="tab ${tab === key ? 'active' : ''}" role="tab" aria-selected="${tab === key}"
          data-ctab="${c.id}|${key}" ${locked && !openable.includes(key) ? 'disabled' : ''}>
          <span class="tnum">${i + 1}</span>${esc(label)}
        </button>`).join('')}
    </div>

    ${courseTabBody(c, tab)}`
  };
}

function courseTabBody(c, tab) {
  const unlocked = isUnlocked(c);

  if (tab === 'overview') {
    return `
    <div class="two-col">
      <section class="card">
        <div class="card-head"><div><h3>Hasil Belajar</h3><div class="sub">Kemampuan yang harus terbukti setelah course</div></div></div>
        <div class="card-pad" style="display:flex;flex-direction:column;gap:18px">
          ${(c.outcomes || []).length ? `<ul class="outcome-list">${c.outcomes.map(o => `<li>${icon('check-circle', 'icon icon-sm')}<span>${esc(o)}</span></li>`).join('')}</ul>`
            : `<p style="font-size:13.5px;color:var(--text-2)">${esc(c.summary)}</p>`}
          <div>
            <h4 style="font-size:13px;margin-bottom:6px">Target Peserta</h4>
            <p style="font-size:13.5px;color:var(--text-2);line-height:1.7">${esc(c.audience)}</p>
            ${(c.roles || []).length ? `<div class="chips" style="margin-top:10px">${c.roles.map(r => `<span class="badge badge-neutral">${esc(r)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><div><h3>Ringkasan Course</h3></div></div>
        <div class="card-pad">
          <div class="kv">
            <div><small>Durasi</small><b>${esc(c.duration)}</b></div>
            <div><small>Jumlah Modul</small><b>${c.moduleCount} modul</b></div>
            <div><small>Prasyarat</small><b>${c.prerequisite ? esc(c.prerequisite) + ' harus selesai' : 'Tidak ada prerequisite'}</b></div>
            <div><small>Assessment</small><b>${esc(c.assessment || (c.posttest ? `Post-test ${c.posttest.length} soal · passing 80` : 'Knowledge check'))}</b></div>
            <div><small>Credential</small><b>${esc(c.credential || 'Belum ditentukan')}</b></div>
            <div><small>Status Enrollment</small><b>${unlocked ? 'Tersedia untuk dimulai' : `Terkunci sampai ${esc(c.prerequisite)} selesai`}</b></div>
          </div>
          <p style="font-size:12px;color:var(--text-3);margin-top:12px">Preview silabus selalu terbuka; prerequisite hanya mengunci aktivitas belajar.</p>
          ${PATHS.filter(p => p.courseIds.includes(c.id)).length ? `
          <div class="dsec" style="margin-top:18px">
            <h4>Bagian dari Training Path</h4>
            <div class="dlist">
              ${PATHS.filter(p => p.courseIds.includes(c.id)).map(p => `
                <button class="src-link" style="width:100%;cursor:pointer" data-path="${p.id}">
                  <span class="pi-mark" style="width:26px;height:26px;font-size:11px">${p.letter}</span>
                  <span class="grow" style="text-align:left">${esc(p.title)}</span>
                  ${icon('arrow-right', 'icon icon-xs')}
                </button>`).join('')}
            </div>
          </div>` : ''}
        </div>
      </section>
    </div>`;
  }

  if (tab === 'modules') {
    const done = 0;
    return `
    <section class="card">
      <div class="card-head">
        <div><h3>Isi Course</h3><div class="sub">Setiap module berisi materi terpadu, rangkuman &amp; knowledge check, serta assignment bila relevan.</div></div>
        <div class="right"><strong style="font-size:15px">0%</strong></div>
      </div>
      <div class="card-pad">
        <div class="module-list">
          ${c.modules.map((m, i) => `
            <button class="module-item" data-mod="${c.id}|${i}" ${isUnlocked(c) && c.kind === 'qfs' ? '' : (c.kind === 'qfs' ? 'disabled' : '')}>
              <span class="module-number">${String(i + 1).padStart(2, '0')}</span>
              <span class="module-copy">
                <strong>${esc(m.title)}</strong>
                <small>${esc(m.lesson || (i === c.modules.length - 1 ? 'Knowledge check + application' : 'Theory · case · knowledge check'))} · 2 bagian</small>
              </span>
              <span class="module-time">${m.minutes ? m.minutes + ' mnt' : ''} ${icon('arrow-right', 'icon icon-xs')}</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="module-footer">
        <span>${c.kind === 'qfs'
          ? 'Selesaikan semua module dan knowledge check sebelum Final Assessment.'
          : 'Course contoh: silabus tersedia untuk preview, materi modul belum dipublikasikan pada prototype ini.'}</span>
        ${c.kind === 'qfs'
          ? `<button class="btn btn-primary btn-sm" data-ctab="${c.id}|assessment" ${isUnlocked(c) ? '' : 'disabled'}>${c.modules.length} module tersisa ${icon('arrow-right', 'icon icon-xs')}</button>`
          : `<button class="btn btn-sm" data-goto="elearning">Kembali ke Katalog</button>`}
      </div>
    </section>`;
  }

  if (tab === 'pretest' || tab === 'assessment') {
    const isPre = tab === 'pretest';
    const questions = isPre ? (c.pretest || c.quiz || []) : (c.posttest || []);
    const quizId = `${c.id}-${tab}`;
    registerQuiz(quizId, questions);
    return `
    <section class="card">
      <div class="card-head">
        <div>
          <h3>${isPre ? 'Pre-test' : 'Final Assessment'}</h3>
          <div class="sub">${isPre
            ? 'Mengukur pemahaman awal sebelum mempelajari modul. Hasil pre-test tidak mengunci akses materi.'
            : 'Post-test penutup course. Passing score 80 dan critical item harus benar sebelum sertifikat terbit.'}</div>
        </div>
      </div>
      <div class="card-pad">
        ${questions.length
          ? quizBlock(quizId, questions, {
              subtitle: isPre ? 'Pre-test diagnostik' : 'Final assessment',
              title: `${questions.length} pertanyaan`,
              passing: isPre ? null : '80',
            })
          : '<p style="font-size:13px;color:var(--text-2)">Bank soal belum tersedia untuk course ini.</p>'}
      </div>
    </section>`;
  }

  if (tab === 'assignment') {
    return `
    <div class="two-col">
      <section class="card">
        <div class="card-head"><div><h3>OJT &amp; Praktik Kerja</h3><div class="sub">Assignment per module yang dinilai atasan atau Quality</div></div></div>
        <div class="card-pad">
          <ol class="playbook">
            ${(c.assignment || []).map(a => `<li><span>${esc(a)}</span></li>`).join('')}
          </ol>
        </div>
      </section>
      <div style="display:flex;flex-direction:column;gap:16px">
        <section class="card">
          <div class="card-head"><div><h3>Bobot Penilaian</h3></div></div>
          <div class="card-pad" style="display:flex;flex-direction:column;gap:8px">
            ${(c.rubric || []).map(r => `
              <div style="display:flex;align-items:center;gap:12px">
                <span style="flex:1;font-size:13px;color:var(--text-2)">${esc(r.label)}</span>
                <span class="badge badge-primary">${esc(r.weight)}</span>
              </div>`).join('')}
          </div>
        </section>
        <section class="card">
          <div class="card-head"><div><h3>Syarat Kelulusan</h3></div></div>
          <div class="card-pad" style="display:flex;flex-direction:column;gap:14px">
            <ul class="checklist">
              ${(c.completion || []).map(x => `<li>${icon('check-circle', 'icon icon-sm')}<span>${esc(x)}</span></li>`).join('')}
            </ul>
            ${c.criticalBehavior ? `
            <div class="risk-box flags">
              <small>Critical behaviour · gagal otomatis</small>
              <div class="risk-flag">${icon('shield', 'icon icon-xs')}<span>${esc(c.criticalBehavior)}</span></div>
            </div>` : ''}
            ${c.remedial ? `<div class="rationale">${icon('info', 'icon icon-sm')}<span><b>Remedial.</b> ${esc(c.remedial)}</span></div>` : ''}
          </div>
        </section>
      </div>
    </div>`;
  }

  if (tab === 'sources') {
    return `
    <section class="card">
      <div class="card-head"><div><h3>Sumber Referensi</h3><div class="sub">Standar dan materi resmi yang mendasari course</div></div></div>
      <div class="card-pad">
        <div class="media-grid">
          ${(c.sources || []).map(s => `
            <a class="media ${/youtube/i.test(s.type) ? 'video' : ''}" href="${esc(s.url)}" target="_blank" rel="noopener">
              <span class="media-thumb">${icon(/youtube/i.test(s.type) ? 'play' : 'file', 'icon')}</span>
              <span class="media-copy">
                <small>${esc(s.type)}</small>
                <strong>${esc(s.label)}</strong>
                <p>Baca sumber resmi untuk memahami dasar dan konteks penerapannya.</p>
                <i>Buka Sumber ${icon('arrow-up-right', 'icon icon-xs')}</i>
              </span>
            </a>`).join('')}
        </div>
      </div>
    </section>`;
  }
  return '';
}

/* =========================================================
   Module reader page (2 bagian)
   ========================================================= */

const moduleTab = {};
const visualNode = {};

function moduleView(courseId, idx) {
  const c = byId[courseId];
  if (!c || !c.modules[idx] || c.kind !== 'qfs') return courseView(courseId);
  const m = c.modules[idx];
  const key = `${courseId}-${idx}`;
  const part = moduleTab[key] || 0;
  const deep = courseId === 'QFS-101' ? DATA.qfs101Modules[idx] : null;
  const lesson = (c.lessons || [])[idx];
  const visual = courseId === 'QFS-101' ? DATA.visuals[idx] : null;
  const practice = (c.assignment || [])[idx];

  const parts = ['Materi Utama', 'Rangkuman & Knowledge Check'];

  return {
    crumb: [['Learning Development'], ['E-Learning', 'elearning'], [c.id, `course/${c.id}`], [`Module ${idx + 1}`]],
    html: `
    <section class="reader-hero">
      <div class="rh-top">
        <div>
          <small>${esc(c.id)} · Module ${idx + 1} dari ${c.modules.length}</small>
          <h1>${esc(m.title)}</h1>
          <p>${esc(m.lesson || '')}</p>
        </div>
        <button class="btn btn-sm btn-outline" data-goback="${c.id}">${icon('close', 'icon icon-xs')} Tutup Materi</button>
      </div>
      <div class="bar"><i style="width:${((part + 1) / parts.length) * 100}%"></i></div>
      <div class="rh-legend"><span>Bagian ${part + 1} dari ${parts.length}</span><span>·</span><span>${m.minutes ? m.minutes + ' menit' : 'Self-paced'}</span></div>
    </section>

    <div class="tabbar" role="tablist">
      ${parts.map((p, i) => `
        <button class="tab ${part === i ? 'active' : ''}" role="tab" aria-selected="${part === i}" data-mtab="${key}|${i}">
          <span class="tnum">${i + 1}</span>${esc(p)}
        </button>`).join('')}
    </div>

    ${part === 0 ? readerPartOne(c, idx, m, deep, lesson, visual, practice) : readerPartTwo(c, idx, m, deep, lesson)}

    <div class="reader-foot">
      <button class="btn btn-sm" ${idx > 0 ? `data-mod="${c.id}|${idx - 1}"` : 'disabled'}>${icon('arrow-right', 'icon icon-xs')} Module Sebelumnya</button>
      <span class="grow">Module ${idx + 1} dari ${c.modules.length} · ${esc(c.title)}</span>
      ${part === 0
        ? `<button class="btn btn-primary btn-sm" data-mtab="${key}|1">Bagian Berikutnya ${icon('arrow-right', 'icon icon-xs')}</button>`
        : idx < c.modules.length - 1
          ? `<button class="btn btn-primary btn-sm" data-mod="${c.id}|${idx + 1}">Module Berikutnya ${icon('arrow-right', 'icon icon-xs')}</button>`
          : `<button class="btn btn-primary btn-sm" data-ctab="${c.id}|assessment">Final Assessment ${icon('arrow-right', 'icon icon-xs')}</button>`}
    </div>`
  };
}

function readerPartOne(c, idx, m, deep, lesson, visual, practice) {
  const blocks = [];
  blocks.push(`<span class="section-label">Bagian 1 · Materi Utama</span>`);

  if (deep) {
    blocks.push(`
    <div class="depth-note">
      <span>QFS-101 Complete</span>
      <p>Materi acuan berbasis BPOM, WHO, dan Codex. Parameter operasional tetap mengikuti SOP serta spesifikasi Lahans yang telah disetujui.</p>
    </div>`);

    blocks.push(`
    <div class="dsec">
      <h4>Tujuan Pembelajaran</h4>
      <ul class="objective-grid">
        ${deep.objectives.map(o => `<li>${icon('target', 'icon icon-sm')}<span>${esc(o)}</span></li>`).join('')}
      </ul>
    </div>`);

    if (visual) {
      const active = visualNode[`${c.id}-${idx}`] || 0;
      blocks.push(`
      <div class="visual-card" data-visual="${c.id}-${idx}">
        <div class="visual-heading">
          <div>
            <small class="section-label">${esc(visual.eyebrow)}</small>
            <h4>${esc(visual.title)}</h4>
            <p>${esc(visual.caption)}</p>
          </div>
          <span class="tag">Interactive visual</span>
        </div>
        <div class="visual-flow">
          ${visual.nodes.map((n, i) => `
            <button class="vnode ${i === active ? 'active' : ''}" data-vnode="${c.id}-${idx}|${i}">
              <span>${String(i + 1).padStart(2, '0')}</span>
              <strong>${esc(n.label)}</strong>
            </button>`).join('')}
        </div>
        <div class="visual-explanation">
          <strong data-vlabel>${esc(visual.nodes[active].label)}</strong>
          <p data-vdetail>${esc(visual.nodes[active].detail)}</p>
        </div>
      </div>`);
    }

    blocks.push(`<div class="divider"><span>Materi mendalam</span></div>`);
    blocks.push(`
    <div class="card card-pad">
      <div class="deep-sections">
        ${deep.sections.map((s, i) => `
          <article>
            <span class="section-count">${String(i + 1).padStart(2, '0')}</span>
            <div>
              <h4>${esc(s.title)}</h4>
              ${s.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}
              ${s.bullets ? `<ul>${s.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
            </div>
          </article>`).join('')}
      </div>
    </div>`);

    if (deep.playbook) {
      blocks.push(`<div class="divider"><span>Playbook operasional</span></div>`);
      blocks.push(`<ol class="playbook">${deep.playbook.map(p => {
        const [head, ...rest] = String(p).split(' ');
        return `<li><strong>${esc(head)}</strong><span>${esc(rest.join(' '))}</span></li>`;
      }).join('')}</ol>`);
    }

    if (deep.redFlags || deep.mistakes) {
      blocks.push(`
      <div class="risk-grid">
        <div class="risk-box flags">
          <small>Red flags</small>
          ${(deep.redFlags || []).map(f => `<div class="risk-flag">${icon('shield', 'icon icon-xs')}<span>${esc(f)}</span></div>`).join('')}
        </div>
        <div class="risk-box mistakes">
          <small>Kesalahan yang sering terjadi</small>
          ${(deep.mistakes || []).map(x => `<div class="mistake"><strong>${esc(x.title)}</strong><p>${esc(x.explanation)}</p></div>`).join('')}
        </div>
      </div>`);
    }

    if (deep.cases) {
      blocks.push(`<div class="divider"><span>Studi kasus bertingkat</span></div>`);
      blocks.push(`<div class="case-stack">${deep.cases.map((cs, i) => `
        <details class="case" ${i === 0 ? 'open' : ''}>
          <summary><span class="lvl">${esc(cs.level)}</span><strong>${esc(cs.title)}</strong>${icon('chevron-down', 'icon icon-sm')}</summary>
          <div class="case-body">
            <p class="situation">${esc(cs.situation)}</p>
            <div><h5>Fakta yang tersedia</h5><ul>${cs.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>
            <div><h5>Pertanyaan diskusi</h5><ol>${cs.prompts.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>
            <div class="recommended">
              <small>Respons yang direkomendasikan</small>
              <ol>${cs.response.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
              <p class="lesson-key"><b>Pelajaran utama:</b> ${esc(cs.lesson)}</p>
            </div>
          </div>
        </details>`).join('')}</div>`);
    }
  } else if (lesson) {
    blocks.push(`<div class="card card-pad" style="display:flex;flex-direction:column;gap:16px">
      <p style="font-size:14.5px;line-height:1.75;color:var(--text)">${esc(lesson.intro)}</p>
      <div>
        <h4 style="font-size:13px;margin-bottom:10px">Konsep Utama</h4>
        <ul class="checklist">${lesson.points.map(p => `<li>${icon('check-circle', 'icon icon-sm')}<span>${esc(p)}</span></li>`).join('')}</ul>
      </div>
    </div>`);
    blocks.push(`<div class="divider"><span>Studi kasus</span></div>`);
    blocks.push(`
    <div class="visual-card">
      <small class="section-label">Scenario / aplikasi</small>
      <p style="font-size:13.5px;color:var(--text-2);line-height:1.75;margin-top:8px">${esc(lesson.scenario)}</p>
      <div class="rationale" style="margin-top:14px">${icon('info', 'icon icon-sm')}<span>Identifikasi risiko, keputusan yang tepat, siapa yang perlu dihubungi, dan bukti apa yang harus dicatat.</span></div>
    </div>`);
  }

  /* Praktik: konten tab "Assignment / Praktik" lama dipindahkan ke sini (tab dihapus, isi tetap) */
  if (practice) {
    blocks.push(`
    <div class="practice-card">
      <div class="ph">${icon('clipboard')}<h4>Praktik di Tempat Kerja · Module ini</h4></div>
      <p class="pbody">${esc(practice)}</p>
      ${(c.rubric || []).length ? `<div class="prubric">${c.rubric.map(r => `<span class="badge badge-neutral">${esc(r.label)} · ${esc(r.weight)}</span>`).join('')}</div>` : ''}
    </div>`);
  }

  /* Media */
  const media = [];
  if (visual?.video) {
    media.push(`
      <a class="media video" href="${esc(visual.video.url)}" target="_blank" rel="noopener">
        <span class="media-thumb">${icon('play', 'icon')}<small>${esc(visual.video.duration)}</small></span>
        <span class="media-copy">
          <small>Video resmi · ${esc(visual.video.source)}</small>
          <strong>${esc(visual.video.title)}</strong>
          <p>${esc(visual.video.description)}</p>
          <i>Tonton video ${icon('arrow-up-right', 'icon icon-xs')}</i>
        </span>
      </a>`);
  }
  (deep?.sources || []).forEach(s => {
    media.push(`
      <a class="media" href="${esc(s.url)}" target="_blank" rel="noopener">
        <span class="media-thumb">${icon('file', 'icon')}</span>
        <span class="media-copy">
          <small>Artikel / standar · ${esc(s.organization || 'Official')}</small>
          <strong>${esc(s.label)}</strong>
          <p>Baca sumber resmi untuk memahami dasar dan konteks penerapannya.</p>
          <i>Baca artikel ${icon('arrow-up-right', 'icon icon-xs')}</i>
        </span>
      </a>`);
  });
  if (!deep) {
    (c.sources || []).filter(s => s.type !== 'YouTube').slice(0, 2).forEach(s => {
      media.push(`
        <a class="media" href="${esc(s.url)}" target="_blank" rel="noopener">
          <span class="media-thumb">${icon('file', 'icon')}</span>
          <span class="media-copy">
            <small>${esc(s.type)}</small>
            <strong>${esc(s.label)}</strong>
            <p>Baca sumber resmi untuk memahami dasar dan konteks penerapannya.</p>
            <i>Read more ${icon('arrow-up-right', 'icon icon-xs')}</i>
          </span>
        </a>`);
    });
    media.push(`
      <a class="media video" href="https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + ' food safety training')}" target="_blank" rel="noopener">
        <span class="media-thumb">${icon('play', 'icon')}</span>
        <span class="media-copy">
          <small>YouTube</small>
          <strong>${esc(m.title)}</strong>
          <p>Cari video relevan untuk memperkuat pemahaman module ini.</p>
          <i>Cari video ${icon('arrow-up-right', 'icon icon-xs')}</i>
        </span>
      </a>`);
  }
  if (visual) {
    media.push(`
      <a class="media pdf" href="#" onclick="return false">
        <span class="media-thumb">PDF<small>1 page</small></span>
        <span class="media-copy">
          <small>Downloadable job aid · ${esc(c.id)}</small>
          <strong>${esc(m.title)}</strong>
          <p>Ringkasan visual satu halaman untuk briefing, refresh, atau ditempel di area kerja.</p>
          <i>Halaman ${visual.jobAidPage} pada job aid pack</i>
        </span>
      </a>`);
  }
  if (media.length) {
    blocks.push(`<div class="divider"><span>Media, artikel &amp; PDF</span></div>`);
    blocks.push(`<div class="media-grid">${media.join('')}</div>`);
  }

  return blocks.join('');
}

function readerPartTwo(c, idx, m, deep, lesson) {
  const summary = deep?.summary || lesson?.points || [];
  const questions = deep?.knowledgeCheck || [];
  const checks = !deep && lesson?.checks ? lesson.checks : [];
  const quizId = `${c.id}-${idx}-kc`;
  if (questions.length) registerQuiz(quizId, questions);

  return `
  <span class="section-label">Bagian 2 · Rangkuman &amp; Knowledge Check</span>

  <section class="card">
    <div class="card-head"><div><h3>Yang Wajib Diingat</h3><div class="sub">Ringkasan inti module ${idx + 1}</div></div></div>
    <div class="card-pad">
      <ul class="key-summary">
        ${summary.map((s, i) => `<li><span>${i + 1}</span><p>${esc(s)}</p></li>`).join('')}
      </ul>
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <div><h3>Knowledge Check</h3><div class="sub">${questions.length ? 'Pilih jawaban untuk melihat pembahasannya langsung.' : 'Pertanyaan refleksi untuk didiskusikan bersama atasan atau Quality.'}</div></div>
    </div>
    <div class="card-pad">
      ${questions.length
        ? quizBlock(quizId, questions, { subtitle: 'Knowledge check formatif', title: `${questions.length} pertanyaan` })
        : `<ol class="playbook">${checks.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ol>`}
    </div>
  </section>`;
}

/* =========================================================
   Router
   ========================================================= */

function parseRoute() {
  const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] === 'course' && parts[1]) {
    const mod = parts[2] && /^m\d+$/.test(parts[2]) ? parseInt(parts[2].slice(1), 10) : null;
    return { name: 'course', courseId: decodeURIComponent(parts[1]), module: mod };
  }
  const key = parts[0];
  return { name: VIEWS[key] ? key : 'monitoring' };
}

function render() {
  const r = parseRoute();
  const view = r.name === 'course'
    ? (r.module !== null ? moduleView(r.courseId, r.module) : courseView(r.courseId))
    : VIEWS[r.name]();

  const main = document.getElementById('view');
  main.innerHTML = view.html;
  document.getElementById('crumb').innerHTML = view.crumb.map(([label, href], i) => {
    const last = i === view.crumb.length - 1;
    const text = last ? `<b>${esc(label)}</b>` : (href ? `<a data-goto="${href}">${esc(label)}</a>` : esc(label));
    return text + (last ? '' : ' <span class="sep">/</span>');
  }).join(' ');

  markActiveNav(r.name === 'course' ? 'elearning' : r.name);
  if (view.after) view.after();
  document.querySelector('.main').scrollTop = 0;
}

/* Delegated actions */
document.addEventListener('click', e => {
  const goto = e.target.closest('[data-goto]');
  if (goto) { location.hash = '#/' + goto.dataset.goto; return; }

  const qopt = e.target.closest('.qopt');
  if (qopt) { handleQuizClick(qopt); return; }

  const vnode = e.target.closest('[data-vnode]');
  if (vnode) {
    const [key, i] = vnode.dataset.vnode.split('|');
    visualNode[key] = +i;
    const wrap = vnode.closest('[data-visual]');
    wrap.querySelectorAll('.vnode').forEach(n => n.classList.toggle('active', n === vnode));
    const idx = +key.split('-').pop();
    const node = DATA.visuals[idx].nodes[+i];
    wrap.querySelector('[data-vlabel]').textContent = node.label;
    wrap.querySelector('[data-vdetail]').textContent = node.detail;
    return;
  }

  const mtab = e.target.closest('[data-mtab]');
  if (mtab) {
    const [key, i] = mtab.dataset.mtab.split('|');
    moduleTab[key] = +i;
    render();
    return;
  }

  const ctab = e.target.closest('[data-ctab]');
  if (ctab) {
    const [id, tab] = ctab.dataset.ctab.split('|');
    courseTab[id] = tab;
    if (parseRoute().name === 'course') render(); else location.hash = `#/course/${id}`;
    return;
  }

  const mod = e.target.closest('[data-mod]');
  if (mod) {
    const [id, i] = mod.dataset.mod.split('|');
    location.hash = `#/course/${id}/m${i}`;
    return;
  }

  const back = e.target.closest('[data-goback]');
  if (back) { courseTab[back.dataset.goback] = 'modules'; location.hash = `#/course/${back.dataset.goback}`; return; }

  const pathBtn = e.target.closest('[data-path]');
  if (pathBtn) {
    activePathId = pathBtn.dataset.path;
    if (parseRoute().name === 'path') { renderPathList(); renderPathDetail(); }
    else location.hash = '#/path';
    return;
  }

  const courseBtn = e.target.closest('[data-course]');
  if (courseBtn) { location.hash = `#/course/${courseBtn.dataset.course}`; return; }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeMobileNav(); closeNotifPanel(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.getElementById('globalSearch').focus(); }
  const card = e.target.closest?.('.course-card');
  if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); location.hash = `#/course/${card.dataset.course}`; }
});

document.getElementById('scrim').addEventListener('click', closeMobileNav);
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('scrim').classList.toggle('open');
});

document.getElementById('globalSearch').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  filters.q = e.target.value;
  if (parseRoute().name === 'elearning') { document.getElementById('fq').value = filters.q; renderCatalog(); }
  else location.hash = '#/elearning';
});

document.getElementById('exportBtn').addEventListener('click', () => toast('Export tersedia setelah prototype terhubung ke data HCMS.'));

/* =========================================================
   Sidebar collapse
   ========================================================= */

const sidebarEl = document.getElementById('sidebar');
const btnSidebarCollapse = document.getElementById('sidebarCollapse');
function setSidebarCollapsed(collapsed) {
  sidebarEl.classList.toggle('collapsed', collapsed);
  btnSidebarCollapse.setAttribute('aria-pressed', String(collapsed));
  btnSidebarCollapse.setAttribute('aria-label', collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar');
  btnSidebarCollapse.innerHTML = `<svg class="icon icon-sm"><use href="#i-chevron-${collapsed ? 'right' : 'left'}"/></svg>`;
  try { localStorage.setItem('lahans-sidebar-collapsed', collapsed ? '1' : '0'); } catch (e) {}
}
let savedCollapsed = false;
try { savedCollapsed = localStorage.getItem('lahans-sidebar-collapsed') === '1'; } catch (e) {}
setSidebarCollapsed(savedCollapsed);
btnSidebarCollapse.addEventListener('click', () => setSidebarCollapsed(!sidebarEl.classList.contains('collapsed')));

/* =========================================================
   Topbar actions — tema, layar penuh, notifikasi
   ========================================================= */

/* Tema (light/dark), disimpan di localStorage supaya bertahan antar sesi */
const btnTheme = document.getElementById('btnTheme');
function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  btnTheme.setAttribute('aria-pressed', String(mode === 'dark'));
  btnTheme.innerHTML = `<svg class="icon icon-sm"><use href="#i-${mode === 'dark' ? 'moon' : 'sun'}"/></svg>`;
  btnTheme.setAttribute('aria-label', mode === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap');
  const logoImg = document.getElementById('brandLogoImg');
  if (logoImg) logoImg.src = mode === 'dark' ? 'logo-white.svg' : 'logo.png';
  try { localStorage.setItem('lahans-theme', mode); } catch (e) {}
}
let savedTheme = 'light';
try { savedTheme = localStorage.getItem('lahans-theme') || 'light'; } catch (e) {}
applyTheme(savedTheme);
btnTheme.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

/* Layar penuh */
const btnFullscreen = document.getElementById('btnFullscreen');
function syncFullscreenIcon() {
  const isFs = !!document.fullscreenElement;
  btnFullscreen.setAttribute('aria-pressed', String(isFs));
  btnFullscreen.innerHTML = `<svg class="icon icon-sm"><use href="#i-${isFs ? 'shrink' : 'expand'}"/></svg>`;
  btnFullscreen.setAttribute('aria-label', isFs ? 'Keluar dari layar penuh' : 'Layar penuh');
}
btnFullscreen.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => toast('Browser ini tidak mendukung mode layar penuh.'));
});
document.addEventListener('fullscreenchange', syncFullscreenIcon);
syncFullscreenIcon();

/* Notifikasi — hover untuk desktop, klik untuk sentuh/keyboard */
const NOTIFICATIONS = [
  { title: 'QFS-101 wajib diselesaikan sebelum masuk area produksi', meta: 'Mandatory compliance · 2 jam lalu', read: false },
  { title: 'Training path baru dirilis: Data, AI & Digital Productivity', meta: 'Training path · Kemarin', read: false },
  { title: 'Sertifikat ONB-101 menunggu verifikasi supervisor', meta: 'Approval · Kemarin', read: false },
  { title: 'Reminder: Feedback Training Event QFS Academy jatuh tempo', meta: 'Feedback · 3 hari lalu', read: true },
];
const notifWrap = document.getElementById('notifWrap');
const notifList = document.getElementById('notifList');
const notifDot = document.getElementById('notifDot');

function renderNotifList() {
  notifList.innerHTML = NOTIFICATIONS.map(n => `
    <div class="notif-item ${n.read ? 'read' : ''}">
      <span class="ni-dot"></span>
      <div class="ni-body"><div class="ni-title">${esc(n.title)}</div><div class="ni-meta">${esc(n.meta)}</div></div>
    </div>`).join('');
  notifDot.classList.toggle('is-read', NOTIFICATIONS.every(n => n.read));
}
renderNotifList();

function closeNotifPanel() {
  notifWrap.classList.remove('open');
  document.getElementById('btnNotif').setAttribute('aria-expanded', 'false');
}
document.getElementById('btnNotif').addEventListener('click', e => {
  e.stopPropagation();
  const open = notifWrap.classList.toggle('open');
  document.getElementById('btnNotif').setAttribute('aria-expanded', String(open));
});
document.getElementById('notifMarkRead').addEventListener('click', e => {
  e.stopPropagation();
  NOTIFICATIONS.forEach(n => n.read = true);
  renderNotifList();
});
document.addEventListener('click', e => { if (!notifWrap.contains(e.target)) closeNotifPanel(); });

/* Toast */
let toastTimer;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = el(`<div id="toast" style="position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(12px);z-index:90;
      background:#131a2e;color:#fff;font-size:13px;padding:11px 18px;border-radius:999px;box-shadow:0 24px 50px -24px rgba(0,0,0,.8);
      opacity:0;transition:opacity .18s, transform .18s;pointer-events:none"></div>`);
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(12px)'; }, 2600);
}

window.addEventListener('hashchange', render);
renderNav();
render();
