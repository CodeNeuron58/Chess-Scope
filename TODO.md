# TODO — what's left

Status as of 2026-10-27: the redesign, chess.com-style move ratings and the fast review pipeline
are shipped. Reference game (33 moves, depth 14, 16-core PC): first report ~4 s, full review
~26 s, re-run ~1.6 s. Accuracy is within ±5 points of chess.com on 40 of 64 player-sides from a
real archive, with no average bias.

Legend: **[R]** needed before the first public release · **[N]** next · **[L]** later

---

## 1. First public release (web)

- [x] **[R] Pick a host for a static site.** GitHub Pages (100 MB per file, ~100 GB/month soft
      bandwidth ≈ 1,000 first-time full-engine downloads). `deploy.yml` builds with
      `BASE_PATH=/<repo>/` and publishes on manual run. **Owner:** set Settings → Pages → Source
      to "GitHub Actions", then run the workflow.
- [ ] **[R] Decide the first-visit engine.** Every new visitor downloads 99 MB for the full
      engine. Options: default to Stockfish 19 lite and offer "full strength" in Settings, or keep
      full (accuracy is calibrated for it) and show a one-time download notice.
- [x] **[R] Engine download progress + friendly failure.** One shared download per engine with
      progress on Review ("Downloading engine · 41%") and Analysis, a 60 s handshake timeout,
      a plain-language error and "Try again".
- [ ] **[R] Production build smoke test** on the chosen host. Done locally against
      `vite preview` at `/Owlchess/` (desktop throttled to 20 MB/s: quick report 3 s, full review
      44 s, no console errors; blocked engine → friendly error + retry). Repeat once on the live
      Pages URL.
- [x] **[R] Feedback channel inside the app**: Feedback in the rail, on Home and in Settings →
      About, and "Report this problem" on the crash screen, all to GitHub issue forms.
- [x] **[R] Privacy note page**: Settings → Privacy and [PRIVACY.md](PRIVACY.md).
- [x] **[R] GPL compliance for Stockfish**: source links and the GPLv3 text
      (`engines/STOCKFISH-COPYING.txt`) in Settings → About and the README.
- [x] **[R] README screenshots** (`docs/screenshots/`). A short GIF of a guided review is still
      nice to have for the launch post.
- [ ] **[R] Mobile check** on a real phone: layout, touch moves on the board, memory with
      4 engines (pool is capped at 2 on ≤ 4 GB devices — verify it holds). iPhone 13 emulation
      passes (review completes, tap-to-move works); a real Android and iPhone are still needed.
- [ ] **[R] chess.com API behaviour at scale**: 403 / 429 handling is in place, the API sends
      `Access-Control-Allow-Origin: *`, and the proxy setting is explained in Settings → Accounts.
      Confirm a sync from the live Pages URL.
- [x] **[R] Engine downloads once.** Browsers' HTTP caches won't hold a 99 MB file, so the live
      site re-downloaded it per engine worker and per visit (~400 MB a review). Engines now go to
      Cache Storage once (Settings → Your data → Downloaded engines shows and removes them), and on
      a first visit the full download waits until the lite engine's quick report is shown.
- [x] **[R] Crash screen**: an error boundary with Reload, "Reset settings and reload" (keeps
      the library) and a prefilled bug report.
- [x] **[R] Version + Beta label** (v0.3.0) on Home and in Settings → About; CI runs lint, tests
      and build on every push.
- [x] **[R] Quick-pass labels**: the depth-8 first report no longer shows Brilliant / Great (they
      appear once the full review lands), and a review whose refine failed says so.
- [ ] **[N] Domain name** (owlchess.* availability) and a simple landing section on Home for
      first-time visitors.
- [ ] **[N] Usage numbers without tracking people**: decide whether to add a cookie-free page
      counter (e.g. Cloudflare Web Analytics) or rely only on feedback/GitHub stars.

## 2. Ratings fidelity (accuracy, move labels, Game Rating)

- [ ] **[N] Same game → same numbers every run.** Re-runs drift ±2 accuracy points because the
      parallel engines share positions differently each time. Use a fixed chunk-per-engine split
      and clear the hash at chunk starts so results are deterministic.
- [ ] **[N] Re-review games rated by the old model.** Stamp each stored review with a model
      version; offer "re-review all" (or do it quietly in the background queue).
- [ ] **[N] Move the calibration tooling into the repo** (`scripts/calibrate/`): fetch a chess.com
      archive, review games headlessly, refit `LOSS_SCALE`, print RMSE/bias. Lets anyone re-run
      the fit as data grows.
- [ ] **[N] Fit Game Rating properly**: collect 5–10 chess.com Game Ratings (screenshots; not in
      their API) across blitz / bullet / rapid and refit `EXPECTED_ACC_AT_1500`,
      `ACC_PER_100_ELO`, `ELO_PER_ACC_POINT` in `src/analysis/accuracy.ts`.
- [ ] **[N] Tune move labels on more games**: compare the classification table against chess.com
      screenshots for several games (only one game compared so far); adjust the Great / Miss /
      Brilliant thresholds in `src/analysis/classify.ts` if they drift.
- [ ] **[L] Per-time-control accuracy scale**: blitz prefers k ≈ 2.5, bullet k ≈ 2.9 on 64 sides;
      split once there are ~20+ more bullet games.
- [ ] **[L] Bigger opening book**: chess.com counts more moves as book (e.g. 2.Nf3 Bb7 in the
      Owen). Option: mark positions with enough Lichess Masters games as book when a token is set.

## 3. Performance & resources

- [ ] **[N] Cap the engine cache** (IndexedDB `evals` grows forever): LRU or a size limit with
      oldest-first eviction; show the size in Settings (count is already shown).
- [ ] **[N] Measure Fast / Deep / Max end to end** with the pool and update the depth labels with
      real timings.
- [ ] **[N] "Light mode" option** for low-end machines: fewer pool engines / lite engine only
      (4 full engines use ~500 MB of memory).
- [ ] **[L] Background review limits**: auto-review currently queues up to 25 recent games per
      sync; add a "pause background reviews" toggle and battery awareness.

## 4. Product & UX backlog

- [ ] **[N] Promotion piece picker** (auto-queen on click-to-move today).
- [ ] **[N] Modal focus trap** and full keyboard navigation audit.
- [ ] **[L] Set-up position board** (FEN import exists; no drag-to-set-up editor).
- [ ] **[L] Variation tree** on the analysis board (playing a new move cuts the line today).
- [ ] **[L] Figurine notation option** in move lists.
- [ ] **[L] Light page theme.**
- [ ] **[L] Insights extras**: accuracy by move number, results by opponent strength,
      "game shapes".
- [ ] **[L] Play from here vs the engine**, repertoire trainer, shareable review export.
- [ ] **[L] Optional LLM coach** (bring-your-own key), template coach stays the default.

## 5. Launch & money (decided order)

1. **Free web release** (section 1) + public GitHub repo.
2. **Ask for feedback** in chess communities with a short, honest post; collect requests in one
   place (GitHub Issues / form).
3. **Tip jar once people use it**: GitHub Sponsors and/or Buy Me a Coffee / Ko-fi links in
   Settings → About and the README. Treat it as validation, not income.
4. **Only with clear traction** (repeat users, feature requests): consider paid extras that cost
   money to run — cloud sync across devices, server-side deep analysis, an AI coach — or a
   packaged desktop/mobile app. Keep what runs locally free; that's the whole pitch.
   Before selling anything closed-source: keep Stockfish a separate GPL component with its source
   offered, and prefer the MIT/Apache piece sets (chessnut, fantasy, celtic) over the GPL ones.
