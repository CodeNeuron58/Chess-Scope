# FEATURES.md — Owlchess Master Feature Checklist

The single list: what's shipped, what to build now, later, and everything to polish.
Details live in [ROADMAP.md](ROADMAP.md) (priorities), [RESEARCH.md](RESEARCH.md) (behavior specs
from Lichess/chess.com/market), [BUSINESS.md](BUSINESS.md) (money + launch).

Legend: [x] shipped & verified · [~] partial · [ ] not started

---

## 1. Shipped — v1 (verified in browser)

### Engine & review
- [x] Stockfish in-browser analysis of every position (UCI worker, MultiPV 3)
- [x] Engine selector: Stockfish 19 Full (94MB, best) / Stockfish 19 Lite (1.7MB, fast) / Stockfish 16 (legacy)
- [x] Depth presets: Fast (10) / Standard (14) / Deep (18)
- [x] Review progress overlay with position counter, cancel button, rotating chess fun-facts
- [x] Per-position evals (white-persp cp + mate normalization), top-3 engine lines (UCI → SAN)
- [x] Evaluation bar on board edge (win% fill + eval chip)
- [x] Best-move arrows (green = best, gray = 2nd line) from stored review data

### Scoring & classification
- [x] Win% model + per-move accuracy + per-player accuracy (public chess.com formula)
- [x] 11 classifications: Brilliant/Great/Best/Excellent/Good/Book/Forced/Inaccuracy/Mistake/Miss/Blunder
- [x] Sacrifice detection measured after opponent's reply; book via ~70-line prefix table; forced = single legal move
- [x] Classification icons w/ chess.com-matching colors + official definitions as tooltips
- [x] Game Rating per player (linear fit to chess.com's two observed data points)
- [x] Advanced Stats modal: accuracy per bucket (Opening/Tactics/Strategy/Endgame) with move counts — chess.com sells this for Diamond

### Coach layer
- [x] Interactive coach review: avatar bubble, Next flow, per-move contextual commentary
- [x] Explain (long-form: eval shift, engine line, sacrifice note) + Best (alternative move) buttons on key moves
- [x] Coach voice toggle (Web Speech API)
- [x] Skills panel: Captures/Checks/Castles/Checkmates/Free Pieces/Defends Pieces/Retreats meters per player

### Board & navigation
- [x] Board play (drag & drop, auto-queen), mid-game truncation like an analysis board
- [x] Move list with classification icons, click-to-jump, auto-scroll
- [x] Eval graph (−10…+10 axis, classification dots, clickable, current-ply cursor)
- [x] Engine lines panel with move-numbered SAN lines
- [x] Keyboard: ←/→/Home/End; board flip; last-move highlight

### Import / export / platform
- [x] **chess.com connection** (Public API, username-based — no passwords): profile + ratings,
      games browser with filters/search, IndexedDB caching (stale-while-revalidate), one-click
      review of any archived game with auto-start, chess.com's own accuracy shown where present,
      optional proxy base URL if chess.com blocks direct calls. Verified live.
- [x] PGN import (modal, error handling, player names from headers), PGN copy to clipboard
      (with NAGs when reviewed)
- [x] Sample games (Opera Game, Immortal Game)
- [x] Engine files vendored in `public/engines/`; runs 100% locally, no account, no telemetry
- [x] TypeScript strict clean; production build verified (dist ~136MB with all engines)

---

## 2. Build NOW (next release — DONE, verified in browser)

- [x] **Mistake drills** ("Learn from your mistakes" / chess.com Retry): after review, jump through
      your errors with the played move hidden; user finds the better move; engine validates
      attempts (win% tolerance ≈ excellent); hint ladder (piece → square → arrow); show solution;
      per-side intro with counts. Click-to-move supported (click piece, click target).
- [x] **Threat display (X key)**: flip turn, one engine query, opponent's best move drawn as red
      arrow. Accept: toggles off cleanly, disabled during review/drills.
- [x] **PGN NAG export**: classifications → standard NAGs ($3 !!, $1 !, $4 ?!, $2 ?, $6 ??, $7 forced).
      Copy PGN button exports reviewed PGN when a review exists.
- [x] **Reveal overlays on key moves** (coach mode): Show fork (arrows to both targets) /
      Show lost piece (red ring) / Show mate (mating-line arrows) — pattern-detected per position.
- [x] **Opening name display**: ECO-style name from the named book ("Philidor Defence") in the
      Game Report + "— opening theory ends here —" divider in the move list.
- [x] **Persist settings** (engine choice, depth, audio, flip) in localStorage — verified across reload.
- [x] **README refresh**: documents 3 engines, coach mode, Skills, Advanced Stats, docs links.

---

## 2b. v2 — Owlchess redesign (shipped, verified in browser)

New name (Owlchess), new forest design system and a multi-page app shell: left rail with
Home · Review · Analysis · Library · Insights · Drills · Settings (hash routes, phone bottom bar).

- [x] **Design system**: palette/typography tokens from the design (Figtree + JetBrains Mono,
      bundled locally — no font CDN), pill buttons, segmented controls, cards, toggles, toasts.
- [x] **Board**: 5 board themes (Forest, Walnut, Slate, Olive, Ash) and 5 open-licensed piece sets
      (cburnett, merida, chessnut, fantasy, celtic); classification chip on the moved piece's
      square; design-style arrows; click-to-move with legal-move dots; captured pieces + material.
- [x] **Local game library (IndexedDB)**: every loaded/imported/reviewed game; full reviews stored
      so reviewed games reopen instantly; search, filters, sort, pagination, multi-select, remove,
      export as PGN.
- [x] **Accounts**: chess.com and Lichess by username (public APIs), auto-sync when stale (15 min),
      sync status; the username marks which side is "you".
- [x] **Import**: game link (Lichess fetched directly; chess.com via synced library), PGN (multi-game
      files go to the Library), FEN (opens the analysis board), username, .pgn upload.
- [x] **Background batch review queue** ("Review selected", auto-review of up to 5 new synced
      games); yields the engine to foreground reviews/analysis.
- [x] **Game Review page**: report (accuracy, game rating, eval graph, classification table with
      jump-to), guided coach walkthrough (explanation level, voice, auto-advance, reveal overlays),
      key-moments filter, engine/depth menu, per-game Skills/Advanced dialogs kept.
- [x] **Analysis board**: live Stockfish with progressive depth (to 30), 1–3 lines, clickable lines,
      threat arrow, Explorer tab — "My games" (local) + Masters/Lichess (needs a free Lichess token).
- [x] **Insights**: KPIs with period deltas, accuracy over time vs opponents, skills by position type
      (vs opponents in the same games), accuracy by phase as White/Black, where win% was lost, clock
      stats from `%clk`, openings table with common mistakes → drills.
- [x] **Drills page**: daily set (fixed per day), by theme (mate/fork/hanging/tactic/missed win/
      positional), mixed, this game, per opening; multiple choice + free moves (engine-checked);
      hint ladder; streak + weekly tally.
- [x] **Settings**: engine, depth (incl. Max 22), lines, board/pieces/coords/animation/move sounds,
      coach, review, accounts (+ Lichess token, chess.com proxy), data, About/credits & licences.
- [x] Engine fixes found during the redesign: positions with fewer than 3 legal moves no longer fall
      back to depth-1 data (MultiPV capped by legal moves); `init()` is idempotent; `stop()` only
      stops its own caller's search; stalled searches are stopped before resolving.
- [x] Drill answers judged on win% lost (≤ 1.5) instead of calibrated move accuracy ≥ 96, which
      after the ×3.04 calibration only accepted moves within ~3 centipawns of best.

---

## 3. Build SOON (v2 — differentiators)

- [ ] **Eval cache (IndexedDB)**: FEN→eval store, "cached" badge, instant re-reviews.
- [ ] **WDL bar + sharpness score**: enable `UCI_ShowWDL`, three-segment win/draw/loss bar,
      sharpness = win%+loss% (novel stat, no competitor shows it).
- [ ] **Two-speed analysis**: "Blunder-check" mode (fast pass, flags only ?!/??: ChessBase model)
      for 30-second reviews.
- [x] **Multi-game import + local archive**: paste/archive PGNs, store analyzed games in IndexedDB.
- [~] **Local Insights** (shipped: accuracy over time, phases, openings, leaks, clock stats; still
      open: accuracy by move number, results by opponent strength, "game shapes") (chess.com Diamond analytics, free here): accuracy over time, accuracy by
      move number, performance by opening/ECO, results by opponent strength, repeat-blunder
      clustering (motif/phase/piece), "game shapes".
- [ ] **Time-vs-eval overlay**: parse `%clk` comments, think-time graph over eval graph, flag
      "blundered with <10s".
- [ ] **Play from here vs engine**: continue any position vs Stockfish with adjustable strength
      (UCI Skill Level / UCI_LimitStrength) + clock.
- [ ] **Threat list à la DecodeChess**: enumerate opponent threats, before/after-best-move diff
      with magnitude change + arrows.
- [ ] **"Explain why" upgrade**: name motifs (fork/pin/hanging/defender removal) from engine data;
      "practical decision" lens (was the played move humanly fine? — confirmed market gap).

---

## 4. LATER (big bets / platform)

- [~] **Opening explorer** (shipped: local "My games" + token-gated Lichess Masters/Online): Lichess free API (masters + lichess DBs, WDL bars per move) with
      bundled offline fallback.
- [ ] **Repertoire trainer**: spaced repetition (SM-2) over opening lines + deviation detection
      from real games.
- [ ] **Variation tree**: alternative moves as branches, promote/delete context menu.
- [ ] **Study documents**: chapters + comments + glyphs as importable/exportable files.
- [ ] **Square-control heatmap overlay**; animated attack waves.
- [ ] **Coordinate trainer + blindfold mode**.
- [ ] **LLM coach layer (BYO API key)**: LLM prose grounded in engine output; template coach stays
      as offline fallback. Off by default.
- [ ] **Shareable review**: self-contained HTML export / annotated PGN.
- [x] **Batch review queue**: review a whole archive overnight-style → feeds Insights.
- [ ] **Desktop app** (Tauri wrapper) as one-time purchase.

---

## 5. Polish, UX & infrastructure (known gaps — the "many things still not done")

- [ ] **Browser-automation note**: synthetic mouse *drags* (`cua.drag`) crash the embedded
      browser's page and close the tab — click-to-move was added for drills partly because of
      this. Don't use drag automation against this app.
- [ ] **Coach audio verification** — toggle + code wired but actual sound never audited (test in
      real Chrome; check autoplay policies).
- [~] **Mobile / responsive layout** (stacked layout + phone tab bar shipped; touch drag unverified) — side panel is fixed 400px; needs stacked layout + touch
      drag support check (react-chessboard touch behavior unverified).
- [ ] **Engine download progress** — 94MB SF19 Full first load has no progress indicator.
- [ ] **Promotion UX** — auto-queen only; add promotion piece picker.
- [x] **Captured pieces display** in player cards (chess.com shows material).
- [ ] **Accuracy chip clipping** on narrow widths (minor CSS, `ACC` label overflows).
- [ ] **Engine load failure UX** — friendly error + retry button instead of status-line text.
- [ ] **Modal a11y**: focus trap, ESC to close, aria roles; `prefers-reduced-motion` support.
- [x] **Unit tests** (accuracy, classify, PGN export, library metadata/summaries/drills/stats/explorer) — classify/accuracy/skills/coach are pure functions begging for Vitest suites
      (protect the math when tuning thresholds).
- [~] **Theme system** (5 board themes + 5 piece sets shipped; no light page theme yet) — board themes (green/wood/brown) + light/dark page themes; settings drawer.
- [ ] **Figurine notation option** in move list (chess.com uses figurines by default).
- [~] **FEN / position setup** (FEN import shipped; set-up board still open) — Set-Up-Position board (drag pieces, castling rights, side to move).
- [ ] **ESLint/oxlint pass + CI** (GitHub Actions: typecheck + build + tests).
- [ ] **Privacy page** ("no account, no telemetry, runs locally") — core selling point, needs its
      own page.
- [ ] **Landing/marketing page** separate from the app (BUSINESS.md launch needs it).

## 6. Launch checklist (business-side — details in BUSINESS.md)

- [x] Rename away from anything chess.com — now **Owlchess** (domain still open)
- [ ] Keep Stockfish GPL notices + source links (required)
- [ ] GitHub Sponsors + Buy Me a Coffee buttons in repo
- [ ] Waitlist/Pro skeleton on hosted version (don't gate local features)
- [ ] Privacy policy + terms pages before public launch
- [ ] r/chess + Show HN launch kit (GIFs, screenshots, honest positioning)
- [ ] Free Pro for 5–10 streamers
