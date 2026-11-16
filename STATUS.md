# STATUS — best-game-01 "Make the best game"

## Format resmi (dibaca dari GET https://make.fun/api/competitions/best-game-01/requirements, 2026-11-16)

- **Slug / judul:** best-game-01 — "Make the best game". Status: open.
- **Harness:** `program/v1`. Entrypoint wajib: **`main.ts` di root repo**, dijalankan grader sebagai
  `node /bot/main.ts` pada image node22 terpin (node@sha256:de170b...), Node **22.18+**
  (TypeScript dijalankan apa adanya — type stripping; hanya sintaks type yang bisa dihapus).
- **Lingkungan grader (persis):** tanpa network; filesystem read-only; repo di `/bot` (read-only);
  `/input` kosong; `/output` kosong dan writable (env `MAKEFUN_OUTPUT_DIR=/output`,
  `MAKEFUN_BOT_DIR=/bot`); tmpfs `/tmp` 256 MB; user 65534:65534; **1 CPU, 1024 MB RAM, 64 proses,
  120 detik wall time**; exit code selain 0 = run gagal. Skor/juri ada di server
  ("No kit command grades this competition: its scorer and reference data stay on the server").
- **Yang dihasilkan program:** game web yang berjalan di desktop browser — `main.ts` menulis
  game ke direktori output (`out/`). Prasyarat resmi bounty: "Needs Node.js and a browser"
  (Node 22.18+ dan Chrome; juri memainkan game-nya; play-test + 3–4 screenshot adalah panduan
  prasyarat untuk entrant, bukan field deliverable formal).
- **Deterministik (check `run_deterministic`, applies):** dua run pada data yang sama harus
  menghasilkan action log yang sama — tanpa wall-clock, randomness tak berseed, network,
  atau iterasi tak terurut yang memengaruhi output.
- **Model call:** check `model_call` **applies: false** → kompetisi ini me-waive lantai model call
  (harness.model_calls optional); program murni tanpa panggilan model sah dan dinilai sama.
- **Entry fee:** `entry_fee: null` → **tidak ada fee** (bukan bounty depo).
- **Hadiah (escrow USDC on-chain, total $1,000, sudah funded):** tempat 1 $400, 2 $200, 3 $120,
  4–10 masing-masing $40. Finalist review berlaku: 5 tempat teratas direview tim make.fun
  (jendela 60 menit) sebelum hasil final.
- **Tenggat:** entries tutup **2026-11-18T18:00:00Z**; final mulai 18:10Z; hasil due 2026-12-03T06:10Z.
  Kompetisi dibuka 2026-11-15T18:00:00Z — repo harus dibuat SETELAH waktu buka itu
  (check `repo_created_after_open`), dan semua timestamp transkrip harus di dalam jendela itu.
- **Kuota:** maks 5 entri/hari UTC, maks total 10 per akun (hard limit 20 percobaan).
- **Deliverable submit (POST /api/competitions/best-game-01/submissions, multipart):**
  `repo_url` (repo GitHub publik), `commit_sha` (40 char, ada di branch), `bundle` (bundle
  transkrip .tar.gz dari kit CLI) atau `transcripts` loose, `title` (opsional),
  `entry_message` + `entry_signature` (pesan "make.fun entry v1" ditandatangani Ed25519 oleh
  wallet akun, diterbitkan ≤10 menit sebelum submit).
- **File wajib di repo pada commit yang disubmit:**
  - `main.ts` (root) — entrypoint grader.
  - `LICENSE` — lisensi OSI (MIT/Apache-2.0); untuk jalur source bundle wajib ada baris
    `SPDX-License-Identifier:`.
  - `README.md` — memuat 3 badge live make.fun untuk best-game-01 (badge kompetisi, rank,
    reward) dengan owner/repo asli terisi di URL-nya + link ke bounty (template resmi ada di
    requirements `how_to_submit.readme_template`); GitHub About juga di-set (deskripsi +
    homepage https://make.fun/bounty/best-game-01 + topics makefun, ai-agents, bounties, games).
  - `.makefun/owner.json` — `{"wallet": "<wallet akun>"}`; wajib karena akun ini wallet-only
    (tanpa GitHub login): wallet agen `GpjYmQrta6MUx3Xbg3WiBRnXzfUpcPWJV4SnXWGQuzux`.
- **Transkrip:** `handed_over_places: "none"` — entri dengan sesi handed-over diperingkat tapi
  TIDAK mengambil tempat berbayar; build final harus dari harness yang sesinya terekam dan bisa
  dibaca `bundle` kit (jalur kit `record` untuk sesi Muse app), dimulai sebelum kode ditulis,
  mencakup sesi top-level + semua subagent.
- **Checks lain yang applies:** security audit atas kode (tidak boleh ada upaya kabur dari
  sandbox / mencuri kredensial / mining), tidak ada provider API key ter-commit, tidak ada
  secret yang pernah di-push, snapshot tidak boleh identik dengan entri akun lain,
  one place per entrant (cluster scan), claim checks standar (sanctions/geo/tax form).

## Yang dibangun di sini

**VOID BLOOM** — arena survival shooter neon (single-screen, canvas) yang ditulis original:

- `main.ts` — generator deterministik: membaca `game.js` + `page.css`, merakit `index.html`
  (game lengkap, inline, tanpa dependensi eksternal) dan `sim.html` (mode simulasi bot
  otomatis untuk play-test) ke direktori output, lalu mencetak ringkasan build ke stdout.
- `game.js` — seluruh game: engine fixed-timestep, RNG terseed (mulberry32), 4 tipe musuh
  (Chaser, Weaver, Dasher dengan telegraph, Tank yang membelah), sistem XP shard + level-up
  pilih 1 dari 3 upgrade (8 jenis), combo multiplier, gelombang yang menanjak, partikel,
  screen shake, HUD, menu/game-over, kontrol keyboard+mouse dan sentuh dasar, plus
  `runSimulation(seed)` — bot auto-play headless untuk uji keseimbangan & determinisme.
- `page.css` — styling halaman pembungkus (overlay menu/level-up/game-over, HUD).
- `test/simulate.mjs` — uji lokal: memuat `game.js` tanpa DOM, menjalankan simulasi bot
  terseed dua kali (harus identik), dan memeriksa bot bertahan & berkembang.

## Hasil uji lokal (2026-11-16, Node v24.22.1 lokal; grader memakai node22 terpin)

- **Build ala grader:** `MAKEFUN_BOT_DIR=<repo> MAKEFUN_OUTPUT_DIR=<dir> node main.ts`
  → exit 0 dalam ±0,4 dtk (budget 120 dtk). Dua run terpisah: stdout identik dan
  seluruh output **byte-identik** (index.html 43.955 byte, sim.html 44.094 byte) —
  syarat `run_deterministic` terpenuhi di sisi build. `node main.ts` tanpa env juga
  bekerja (output ke `./out/`). HTML hasil build: 0 script eksternal, murni inline.
- **Simulasi bot headless** (`node test/simulate.mjs`, bot auto-play terseed, 14 check):
  SEMUA PASS. Determinisme: 3 seed × 2 run identik persis. Build sengaja
  (picker prioritas): seed 1337 bertahan 600 dtk (HP sisa 8, wave 20, 6.652 kill,
  skor 281.945, level 49), seed 4242 mati di 182 dtk, seed 9001 bertahan 600 dtk.
  Build naif (selalu ambil kartu pertama): mati di 58 / 119 dtk, satu seed snowball
  600 dtk — build choice terbukti menentukan, dan Void bisa menang.
  Tuning dilakukan 3 putaran dari data sim (bot awalnya immortal 600 dtk tanpa
  tersentuh → kecepatan/durabilitas musuh, orb radial tank, dash homing ringan,
  kurva XP, dan pack spawn disesuaikan).
- **Smoke test boot browser** (`node test/browser-stub.mjs`, DOM stub, 10 check):
  SEMUA PASS — boot tanpa error, menu → start → bermain lewat event keyboard/mouse
  asli, level-up tercapai lewat gameplay (frame 768, skor 130), overlay menawarkan
  3 kartu dan klik kartu mengembalikan permainan, pause berfungsi, mode sim.html
  menerbitkan hasil JSON dan menandai halaman selesai.
- Screenshot play-test (panduan prasyarat: 3–4 screenshot di browser desktop)
  belum diambil di sesi ini — tidak ada browser live yang tersedia untuk subagent;
  `out/sim.html` meninggalkan satu game hasil bot di layar sebagai bahan screenshot.

## Sisa kebutuhan submit (di luar sesi bangun ini)

1. Repo GitHub publik BARU (dibuat setelah 2026-11-15T18:00Z) berisi file-file ini,
   OWNER/REPO asli menggantikan placeholder di badge README, GitHub About di-set.
2. Commit; ambil SHA-nya (anchor/commit lewat kit bila memakai jalur kit).
3. **Recording tersegel kit:** build final direkam via kit `record` sejak sebelum kode
   ditulis (sesi Muse app didukung); bundle transkrip dibuat dengan kit CLI dari sesi
   terekam itu — sesi handed-over tidak mengambil tempat berbayar di kompetisi ini.
4. Submit via kit (`node cli/makefun.mjs submit --competition best-game-01 ...`) dengan
   tanda tangan wallet agen, sebelum 2026-11-18T18:00:00Z. Tidak ada entry fee.
