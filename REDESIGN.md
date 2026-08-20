# Lahans Learning Academy — Catatan Redesign UI/UX

Sumber konten: `https://lahans-qfs-academy-prototype.dxkhshyg.chatgpt.site/`
Brand color: **#203468** · Logo: `logo.jpeg`

Seluruh teks, angka, 10 training path, 40 course, 46 module QFS, materi mendalam,
studi kasus, knowledge check, pre-test, post-test, OJT assignment, rubrik, dan 6 kartu
Knowledge Base **di-extract langsung dari bundle aplikasi prototype lama**, bukan diketik
ulang, lalu disimpan di `assets/data.js`. Yang diubah hanya UI, layout, dan arsitektur navigasi.

---

## 1. Temuan UX pada prototype lama

| # | Masalah | Bukti |
|---|---------|-------|
| 1 | **10 sub-menu, hanya 4 tujuan.** Semua item sidebar adalah anchor ke halaman yang sama. | `Learning Monitoring` → `#progress`, `Learning Status` → `#progress`, `Training Path` → `#path`, `E-Learning` / `Training Event` / `Approval` / `Feedback` → `#courses` |
| 2 | **Menu mati.** `Competency Matrix` dan `Career Path` (badge NEW) tidak punya `href`. | — |
| 3 | **Halaman terlalu panjang.** Satu halaman = 10.921 px berisi hero + status + 10 path + detail path + 40 course + knowledge base. | scrollHeight @1440 |
| 4 | **Path detail jauh dari daftar path.** Memilih path memicu scroll ke bawah. | — |
| 5 | **Filter katalog hilang saat scroll.** 40 kartu tanpa jumlah hasil per filter. | — |
| 6 | **Materi course terkubur.** Detail course, silabus, materi mendalam, dan knowledge check sudah ada di kode, tetapi hanya bisa dicapai lewat rantai klik di dalam satu halaman panjang. | — |
| 7 | **Informasi duplikat.** Kartu "My Learning" di hero mengulang seluruh angka section "Learning Status". | — |

---

## 2. Arsitektur navigasi baru

Routing hash memberi tiap sub-menu halaman sendiri:

| Menu | Route | Isi |
|------|-------|-----|
| Learning Monitoring | `#/monitoring` | Hero + 4 KPI + progres path + QFS module activity + tabel assigned training |
| Learning Status | `#/status` | KPI + tabel course di-enroll + mandatory compliance + completed |
| Training Path | `#/path` | Master–detail 10 path |
| E-Learning | `#/elearning` | Course Catalog 40 course + filter sticky |
| Knowledge Base | `#/knowledge` | 2 grup + 6 kartu (link ke master document) |
| **Course detail** | `#/course/<id>` | 6 tab: About this Course · Pre-test · Course Content · Final Assessment · OJT & Certificate · Resources |
| **Module reader** | `#/course/<id>/m<n>` | 2 bagian: Materi Utama · Rangkuman & Knowledge Check |
| Competency Matrix, Career Path, Training Event, Approval, Feedback | `#/…` | Empty state eksplisit "belum tersedia di prototype" |

Course dan module kini punya URL sendiri — bisa di-bookmark, dibagikan manager ke peserta,
dan tombol back browser bekerja.

---

## 3. Halaman course & module (tambahan besar)

### Course detail — `#/course/QFS-101`

Hero navy dengan judul, meta (jumlah item, durasi, status enrollment), progress bar, dan
kartu credential (credential, durasi, passing score 80%, upaya maks. 3×). Di bawahnya tab
bar pill:

- **About this Course** — hasil belajar, target peserta, peran, ringkasan course, path terkait
- **Pre-test** — bank soal diagnostik, interaktif
- **Course Content** — daftar module yang **bisa diklik** menuju module reader
- **Final Assessment** — post-test 7 soal, passing 80
- **OJT & Certificate** — assignment per module, bobot rubrik, syarat kelulusan, critical behaviour, aturan remedial
- **Resources** — sumber resmi (WHO, Codex, BPOM, dsb.)

Course terkunci menampilkan lock banner dengan jalan pintas ke prerequisite-nya; silabus dan
resources tetap bisa dipreview — persis aturan prototype lama.

33 course contoh ("Example course") menampilkan 2 tab saja: About this Course dan Course
Content, sesuai konten yang memang tersedia di prototype.

### Module reader — `#/course/QFS-101/m0`

Bukan drawer lagi, tetapi **halaman penuh** karena isinya materi panjang dan soal.

**Bagian 1 · Materi Utama**
banner "QFS-101 Complete" → tujuan pembelajaran → interactive visual (decision flow, hazard
map, entry sequence, dst. — node bisa diklik) → materi mendalam bersection → playbook
operasional → red flags & kesalahan umum → studi kasus bertingkat (situasi, fakta, pertanyaan
diskusi, respons yang direkomendasikan) → **praktik di tempat kerja** → media, artikel & PDF.

**Bagian 2 · Rangkuman & Knowledge Check**
"Yang wajib diingat" + knowledge check interaktif: pilih jawaban → langsung terlihat benar/salah
beserta rationale, dengan skor berjalan.

Navigasi bawah: module sebelumnya / bagian berikutnya / module berikutnya, dan di module
terakhir langsung menuju Final Assessment.

> **Catatan perubahan:** tab **"Assignment / Praktik"** dihapus sesuai permintaan, jadi tinggal
> 2 bagian. Supaya tidak ada konten yang hilang, isi assignment per module dipindahkan ke
> kartu **"Praktik di tempat kerja · module ini"** di dalam Bagian 1, lengkap dengan bobot
> rubriknya. Versi lengkap seluruh assignment tetap ada di tab **OJT & Certificate** pada
> halaman course.

**Cakupan materi:** QFS-101 punya 8 module dengan materi mendalam penuh; QFS-201 sampai
QFS-301 punya materi lesson (intro, konsep utama, studi kasus, pertanyaan refleksi) — sama
persis dengan yang tersedia di prototype lama. 33 course contoh memang belum memiliki materi
module di prototype, jadi ditandai eksplisit di footer Course Content.

---

## 4. Layout & sistem visual

**Floating shell** — mengikuti referensi dashboard yang diberikan:

- Canvas: gradasi navy `#24396f → #203468 → #16224a → #101a3a` dengan dua radial highlight, fixed.
- Sidebar: **glassmorphism** — `rgba(255,255,255,.20 → .03)`, `backdrop-filter: blur(18px)`,
  border putih tipis, inner highlight, shadow dalam. Logo Lahans Builder di atas kartu putih
  supaya tetap terbaca di atas panel gelap.
- Main: panel mengambang radius 24px dengan **background sendiri** (gradasi `#f6f8fd → #eef1f8 → #e9edf7`
  plus radial biru lembut), scroll di dalam panel, topbar sticky di dalamnya.
- Menu aktif: pill putih dengan teks navy; hero, tombol primary, chip, stepper, dan tab aktif
  memakai gradasi `#203468 → #33539f`.

**Token lain:** border `#e3e7f0`, radius card 18px / button pill / input 12px, ikon outline 1.6px
monokrom, Inter (heading 600, body 400, caption 11–12px), semantic hijau `#12855b`,
oranye `#b76e00`, merah `#c72c2c`.

---

## 5. Struktur file

```
index.html          shell + sprite ikon
logo.jpeg           logo Lahans Builder (dipakai di sidebar)
assets/styles.css   design system
assets/app.js       routing, view, course page, module reader, quiz
assets/data.js      konten (40 course, 10 path, 46 module QFS, soal, KB)
```

Jalankan lokal:

```bash
python3 -m http.server 4321
```

---

## 6. Ide lanjutan (belum diterapkan)

1. Tab "Path saya" vs "Semua path" pada Training Path.
2. Menyimpan progres module/knowledge check ke localStorage agar status 0% ikut bergerak.
3. Deep link per path (`#/path/qfs`).
4. Menghidupkan Competency Matrix & Career Path — datanya sebenarnya sudah ada di bundle prototype lama tetapi tidak pernah dirender.
5. Rekomendasi path berbasis peran memakai field `audience`.
