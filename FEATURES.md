# FEATURES.md — Master Feature Checklist

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

## 3. Build SOON (v2 — differentiators)

- [ ] **Eval cache (IndexedDB)**: FEN→eval store, "cached" badge, instant re-reviews.
- [ ] **WDL bar + sharpness score**: enable `UCI_ShowWDL`, three-segment win/draw/loss bar,
      sharpness = win%+loss% (novel stat, no competitor shows it).
- [ ] **Two-speed analysis**: "Blunder-check" mode (fast pass, flags only ?!/??: ChessBase model)
      for 30-second reviews.
- [ ] **Multi-game import + local archive**: paste/archive PGNs, store analyzed games in IndexedDB.
- [ ] **Local Insights** (chess.com Diamond analytics, free here): accuracy over time, accuracy by
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

- [ ] **Opening explorer**: Lichess free API (masters + lichess DBs, WDL bars per move) with
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
- [ ] **Batch review queue**: review a whole archive overnight-style → feeds Insights.
- [ ] **Desktop app** (Tauri wrapper) as one-time purchase.

---

## 5. Polish, UX & infrastructure (known gaps — the "many things still not done")

- [ ] **Browser-automation note**: synthetic mouse *drags* (`cua.drag`) crash the embedded
      browser's page and close the tab — click-to-move was added for drills partly because of
      this. Don't use drag automation against this app.
- [ ] **Coach audio verification** — toggle + code wired but actual sound never audited (test in
      real Chrome; check autoplay policies).
- [ ] **Mobile / responsive layout** — side panel is fixed 400px; needs stacked layout + touch
      drag support check (react-chessboard touch behavior unverified).
- [ ] **Engine download progress** — 94MB SF19 Full first load has no progress indicator.
- [ ] **Promotion UX** — auto-queen only; add promotion piece picker.
- [ ] **Captured pieces display** in player cards (chess.com shows material).
- [ ] **Accuracy chip clipping** on narrow widths (minor CSS, `ACC` label overflows).
- [ ] **Engine load failure UX** — friendly error + retry button instead of status-line text.
- [ ] **Modal a11y**: focus trap, ESC to close, aria roles; `prefers-reduced-motion` support.
- [ ] **Unit tests** — classify/accuracy/skills/coach are pure functions begging for Vitest suites
      (protect the math when tuning thresholds).
- [ ] **Theme system** — board themes (green/wood/brown) + light/dark page themes; settings drawer.
- [ ] **Figurine notation option** in move list (chess.com uses figurines by default).
- [ ] **FEN / position setup** — Set-Up-Position board (drag pieces, castling rights, side to move).
- [ ] **ESLint/oxlint pass + CI** (GitHub Actions: typecheck + build + tests).
- [ ] **Privacy page** ("no account, no telemetry, runs locally") — core selling point, needs its
      own page.
- [ ] **Landing/marketing page** separate from the app (BUSINESS.md launch needs it).

## 6. Launch checklist (business-side — details in BUSINESS.md)

- [ ] Rename away from anything chess.com; trademark-clean name + domain
- [ ] Keep Stockfish GPL notices + source links (required)
- [ ] GitHub Sponsors + Buy Me a Coffee buttons in repo
- [ ] Waitlist/Pro skeleton on hosted version (don't gate local features)
- [ ] Privacy policy + terms pages before public launch
- [ ] r/chess + Show HN launch kit (GIFs, screenshots, honest positioning)
- [ ] Free Pro for 5–10 streamers
