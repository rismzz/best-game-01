# STATUS — best-game-01 "Make the best game" — VOID BLOOM, ROUND 3

## Format resmi (dari GET https://make.fun/api/competitions/best-game-01/requirements + RULES.txt kit)

- **Slug / judul:** best-game-01 — "Make the best game". Status: open. **Harness:** `program/v1`.
- **Entrypoint:** `main.ts` di root repo (Node 22.18+, tanpa network, repo read-only di
  `MAKEFUN_BOT_DIR`, output writable di `MAKEFUN_OUTPUT_DIR`, 1 CPU / 1024 MB / 120 dtk,
  dua run harus byte-identik). `main.ts` membaca `game.js` + `page.css` dan merakit
  `index.html` (game lengkap, inline, nol dependensi) + `sim.html` (mode bot auto-play).
- **File wajib di repo:** `main.ts`, `LICENSE` (MIT), `README.md` (3 badge live make.fun,
  owner `rismzz` / repo `best-game-01` + link bounty), `.makefun/owner.json`
  (`{"wallet": "GpjYmQrta6MUx3Xbg3WiBRnXzfUpcPWJV4SnXWGQuzux"}`).
- **Transkrip:** kompetisi bundle (bukan strict-recording); `handed_over_places: "none"`.
- **Hadiah:** total $1.000 — 1: $400, 2: $200, 3: $120, 4–10: $40. Kuota 5/hari, 10 total.
- **Tenggat round 2:** entries tutup **2026-11-18T18:00:00Z = 2026-11-19 01:00 WIB**.

## Round 1 (referensi)

"VOID BLOOM" — arena survival shooter neon deterministik (seeded mulberry32, fixed
timestep): 4 tipe musuh (Chaser, Weaver, Dasher telegraph, Tank pecah + orb radial),
9 upgrade, combo multiplier, surge berkala. Ter-submit (submission
`01a1e400-f9d8-70f5-a698-ae2557b9fd6e`) dan **scored**; peringkat final belum diputuskan.

## Yang berubah di round 2 (semua di `game.js`, kecuali teks kontrol di `main.ts`)

1. **Musuh baru — Spitter** (muncul t≥170 dtk): menjaga jarak ±320px, strafe menyamping,
   menembakkan orb terarah (215 px/dtk) tiap ±3,4 dtk dengan **telegraph glow** 0,55 dtk
   sebelum menembak. Ancaman jarak jauh pertama selain orb radial Tank.
2. **Mini-boss — Dreadnought** (setiap wave kelipatan 5): hull `64 + 5×wave`, burst spiral
   12 orb yang berotasi tiap tembakan (interval 4,2 dtk), **nova radial** pada 66% dan 33%
   HP, mati → pecah jadi 2 Dasher + 2 Chaser, skor 500 / XP 12, banner "A DREADNOUGHT
   STIRS", ring HP di badan + **health bar khusus** di bawah arena.
3. **Dash pemain** (Shift): burst 0,16 dtk pada 1060 px/dtk, **invulnerable selama dash**,
   cooldown 2,6 dtk; indikator ring cooldown + ghost trail di render, status dash di HUD.
   Arah dash = arah gerak (atau arah bidik bila diam).
4. **2 upgrade baru** (total 10 + heal):
   - *Swift Petals* (maks 3): +20% kecepatan peluru, +0,15 dtk umur peluru (jangkauan).
   - *Photosynthesis* (maks 3): regen 1 HP tiap 16/14/12 dtk.
5. **Jaminan kartu ofensif**: setiap tawaran level-up selalu memuat ≥1 bloom ofensif
   (multishot/damage/rapid/pierce/swiftpetals) bila masih tersedia — memperbaiki kematian
   dini akibat tawaran "dead" (lihat metrik: seed 31337 round-2-awal mati 53 dtk tanpa
   pernah ditawari damage; sesudah jaminan ini bertahan 589 dtk).
6. **Kurva XP dilandaikan**: `xpNext = 7 + (level−1)×6` (dari `8 + (level−1)×7`) —
   kompensasi pool upgrade yang membesar (9 → 11 kartu) agar build jadi tepat waktu.
7. **Suara sintesis WebAudio** (lapisan browser saja, tanpa aset): shot/kill/boss-kill/
   hurt/shield-break/level-up/pickup/dash/boss-arrival/game-over, dideteksi dari perubahan
   state per frame; **M** untuk mute; aman no-op bila AudioContext tidak ada.
8. **Juice visual**: muzzle flash, vignette merah berdenyut saat HP ≤ 2, teks
   "DREADNOUGHT FELLED", burst partikel saat dash & regen.
9. **Bot pengukur diperbarui** (alat tuning, bukan gameplay): dodge orb **prediktif**
   (titik pendekatan terdekat), radius flee Dreadnought 300px, prioritas build memuat 2
   upgrade baru. Bot sengaja **tidak memakai dash** — angka sim adalah lantai konservatif
   untuk pemain manusia.

## Tuning — proses & temuan (simulasi headless, bot prioritas vs bot naif, cap 600 dtk, 8 seed)

- Diagnosis round 1: build prioritas snowball — 5/8 seed mentok cap 600 dtk dengan HP
  sisa 4–9; late game kurang gigi. Bot naif mati 7/8 (satu seed snowball).
- Iterasi terukur (median survival bot prioritas): konten baru tanpa tuning 139–164 dtk
  (Spitter + Dreadnought terlalu menekan di 110–180 dtk) → pelunakan ancaman + kurva XP
  → jaminan kartu ofensif. Setiap perubahan dinilai dari **distribusi 8 seed**, bukan seed
  tunggal: game ini memakai satu stream RNG bersama, jadi draw kosmetik pun mengocok run.
- Pelajaran yang diterapkan: `spin` Dreadnought diturunkan dari `phase` yang sudah
  di-draw (tanpa draw RNG baru), dan bot tidak di-dash-kan (rule dash sederhana terbukti
  menabrakkan bot ke kerumunan — dash adalah alat refleks manusia).

## Metrik sebelum / sesudah (bot prioritas, 8 seed: 1337, 4242, 9001, 7, 21, 555, 2024, 31337)

| Metrik | Round 1 | Round 2 |
|---|---|---|
| Median survival | 600 dtk (5/8 mentok cap, HP sisa 4–9) | **589 dtk** (6/8 mencapai wave 19–20; 1 cap penuh dengan HP 2; 2 mati di wave 5 — gerbang boss pertama) |
| Skor run panjang | 281.945–291.703 | 277.442–293.449 (pita skor sebanding) |
| Level run panjang | 49–50 | 53–55 |
| Bot naif (build asal pilih) | median 111 dtk, mati 7/8, 1 snowball 600 dtk | **median 87 dtk, mati 8/8** (52–149 dtk) — build choice kini selalu menentukan |
| Seed 1337 (test resmi) | 600 dtk, wave 20, 6.652 kill | 571 dtk, wave 20, 6.486 kill, skor 279.397, level 53 |

## Hasil verifikasi round 2 (2026-11-17, Node v24 lokal)

- `node test/simulate.mjs` — **14/14 PASS**: determinisme 3 seed × 2 run identik persis;
  bot bertahan 571 dtk / wave 20 / level 53 di seed 1337; bot naif mati 3/3 di seed uji.
- `node test/browser-stub.mjs` — **10/10 PASS**: boot tanpa error, menu → start →
  level-up lewat event keyboard/mouse asli (3 kartu, klik memulihkan permainan), pause,
  mode sim.html menerbitkan JSON hasil.
- **Build ala grader**: `MAKEFUN_BOT_DIR=<repo> MAKEFUN_OUTPUT_DIR=<dir> node main.ts`
  dua kali → stdout sama dan output **byte-identik** (`index.html` 57.339 byte,
  `sim.html` 57.478 byte); 0 referensi script/link eksternal di HTML hasil build.
- `out/` lokal sudah diregenerasi dari sumber round 2 (gitignored, bukan bagian entri).

## Cara menjalankan

```sh
node main.ts                 # merakit game ke out/ (atau $MAKEFUN_OUTPUT_DIR)
node test/simulate.mjs       # uji determinisme + keseimbangan headless
node test/browser-stub.mjs   # smoke test boot browser (DOM stub)
# buka out/index.html di browser desktop untuk bermain; out/sim.html = play-test bot
```

Kontrol: WASD/panah gerak, mouse bidik, tahan mouse/Spasi tembak, **Shift dash**,
1–3 pilih bloom, P pause, **M mute**. Sentuh: drag untuk gerak, auto-aim + auto-fire.

## Round 3 (2026-11-17) — tuning rasa, bukan fitur baru

Round 2 ter-submit pagi 2026-11-17. Round 3 berangkat dari **diagnostik
terukur** build round 2 (bot prioritas, telemetri per 10 detik, 8 seed),
bukan asal tambah konten:

**Kelemahan yang ditemukan di round 2:**
1. **30 detik pertama paling sepi**: bucket 0–10 dtk rata-rata cuma 1,2 musuh
   aktif, 16% dead-air; level-up pertama baru di 14–23 dtk.
2. **Wave 5 jurang frustrasi**: kematian bot menumpuk di boss pertama, dan
   penyebabnya bukan boss-nya — boss muncul saat arena sudah berisi 23–27
   musuh, jadi pemain melawan boss + kerumunan sekaligus.
3. **Boss membosankan di pengulangan**: Dreadnought wave 10/15/20 identik
   dengan wave 5, hanya HP lebih besar.
4. **Momen penting tanpa feedback**: combo naik ke ribuan tanpa satu pun
   pengumuman milestone; jatuh ke 1 HP hanya vignette; boss mati tanpa
   hitstop.

**Perubahan (semua di `game.js`, deterministik, tanpa draw RNG baru):**
1. **Hook awal**: `start()` menanam ring pembuka 5 chaser (radius 330,
   spawnIn 0,35) + surge pertama dimajukan (34 dtk) dan dibuat lebih ramah
   (5 musuh, radius 430, aktivasi berurutan 1,15 + 0,15×i — surround menutup
   bertahap, selalu ada celah). Hasil: kill pertama 0,9–1,8 dtk (dari
   1,9–3,1), level-up pertama 6–7 dtk (dari 14–23), dead-air bucket pertama
   4,1% (dari 16,1%).
2. **Fokus boss**: selama Dreadnought hidup, interval trickle ×1,7, surge
   ditahan (surgeT dijaga ≥ 6), pack larut malam tidak ikut campur; sesudah
   boss mati ada **breather** (spawnT ≥ 1,4, surgeT ≥ 11) untuk memanen XP
   dan pulih. Hull boss 64 + 5×wave → 58 + 5×wave; kunjungan pertama
   (wave 5) spiral lebih lambat (4,8 dtk) dan nova pertamanya disimpan.
3. **Eskalasi boss**: wave ≥ 10 Dreadnought bergantian spiral dengan
   **fan 3 orb terarah** ke pemain; wave ≥ 15 spiral melebar 12 → 14 orb.
4. **Feedback momen penting**: hitstop 0,14 dtk (dt ×0,12) saat boss mati;
   pengumuman milestone combo ×1,5 / ×2,0 / **COMBO MAX ×3,0** di posisi
   pemain; banner **"THE GARDEN FADES"** saat HP jatuh ke 1 + vignette
   kritis lebih keras dan cepat di 1 HP.
5. **Asuransi dead-air**: arena kosong tidak pernah menunggu trickle
   (spawnT ditarik ke 0,3 bila tak ada musuh aktif).

**Proses tuning — pelajaran stream RNG:** game ini memakai satu stream RNG
bersama, jadi perubahan gameplay apa pun mengocok ulang nasib tiap seed;
median survival 20 seed terbukti tidak stabil antar-varian (162–542 dtk)
sementara metrik agregat stabil. Karena itu varian final dipilih dari
**distribusi 40 seed** melawan round 2 yang ter-commit, bukan seed tunggal:

| Metrik (bot prioritas, 40 seed, cap 600 dtk) | Round 2 | Round 3 |
|---|---|---|
| Mean survival | 357 dtk | 352 dtk |
| Mencapai 300 dtk | 20/40 | 19/40 |
| Mencapai wave 10 | 20/40 | 19/40 |
| **Cap penuh 600 dtk** | 1/40 | **9/40** |
| **Mati dini (wave ≤ 5)** | 17/40 | **12/40** |
| Kematian tercepat | 85 dtk | 74 dtk (tak ada kematian < 60 dtk) |

Kurva round 3: frustrasi dini turun, run penuh naik tajam, daya tahan
menengah setara — kematian menumpuk di wave 4–6 (zona roguelite wajar)
dan di atrisi wave 19–20. Bot pengukur tetap **tidak memakai dash**, jadi
angka ini lantai konservatif untuk pemain manusia (dash i-frame adalah
jawaban manusia untuk surround dan fan boss).

**Verifikasi round 3 (2026-11-17, Node v24 lokal):**
- `node test/simulate.mjs` — **14/14 PASS**: determinisme 3 seed × 2 run
  identik; seed 1337 bertahan 596,6 dtk / wave 20 / level 53 / 6.469 kill;
  seed 4242 597,3 dtk wave 20; bot naif mati 3/3 (55–111 dtk).
- `node test/browser-stub.mjs` — **10/10 PASS**: boot, menu → start →
  level-up lewat event asli, pause, mode sim.html menerbitkan JSON.
- **Build ala grader** dua kali → stdout sama, output **byte-identik**
  (`index.html` 61.716 byte, `sim.html` 61.855 byte); satu-satunya href
  eksternal adalah anchor footer ke make.fun (bukan resource yang dimuat).
- `out/` lokal diregenerasi dari sumber round 3 (gitignored).

## Sisa kebutuhan submit round 3 (di luar sesi ini)

1. Commit perubahan (`game.js`, `STATUS.md`) ke repo `rismzz/best-game-01`;
   ambil SHA-nya.
2. Bundle transkrip sesi pembangunan round 3 (sesi ini + sesi terkait)
   dengan kit CLI.
3. Submit via kit sebagai round 3 sebelum **2026-11-19 01:00 WIB**
   (entries tutup 2026-11-18T18:00Z; kuota harian 5). Tidak ada entry fee.
