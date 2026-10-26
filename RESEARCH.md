# Owlchess — Research Archive (feature inventory from market scan)

Everything below was researched from official docs, changelogs, and product pages
(Lichess, chess.com, ChessTempo, DecodeChess, Aimchess, ChessBase + 2024–26 indie tools).
This is the "don't forget it" file: behavioral details for each feature worth building.
See ROADMAP.md for the prioritized plan.

## Lichess — analysis features

### Analysis board
- **Infinite local analysis**: Stockfish WASM in workers, runs continuously on every position,
  deepening forever. Shows eval gauge (vertical, advantage fill, mate signs), 1–3 engine lines
  (each: move sequence, cp/mate score, "depth X / Y nodes"), best-move arrow. Gear panel:
  depth cap / infinite toggle, MultiPV count, hide-all-engine-UI toggle (`Z`), local eval toggle (`L`).
- **Best-move keyboard**: `A` draws engine's top choice as arrow; `Space` plays the best move as a
  variation on the board.
- **Threat display (`X`)**: flips the turn, runs the engine from the opponent's perspective, draws
  *their* best move as an arrow — "what does the opponent threaten?". Eval is NOT recalculated
  while threat is shown. Originated in ChessBase, now also in chess.com analysis settings.
- **Server analysis**: queue full-game Stockfish run; results = eval graph, per-move glyphs in
  movelist, accuracy %, "Learn from your mistakes" button. Daily quota (~35/user). We replace
  this with local analysis + local caching.
- **Learn from your mistakes**: jumps to first error, hides played move, user finds the better
  move, then advances to next error — turns your own blunders into ad-hoc puzzles. Known UX gap:
  doesn't say which side it drills.
- **Phase accuracy** (July–Aug 2026): separate Opening/Middlegame/Endgame accuracy + hover eval
  strength + move-times chart. (We already have Advanced Stats.)
- **Variation tree movelist**: alternatives as tree branches; right-click menu (promote variation,
  delete from here / before / after, copy PGN/FEN of variation, prune to mainline). Inline
  comments toggle (`I`), shortcuts sheet (`?`).
- **Continue from here**: start a game vs Stockfish at chosen strength from any position (most
  requested "practice from your game" flow).
- **Cloud eval**: crowdsourced FEN→eval DB checked before local analysis; instant deeper eval with
  a "cloud" tag. Public API: `GET /api/cloud-eval?fen=&multiPv=`. Local substitute: IndexedDB eval
  cache with a "cached" badge.
- **Opening explorer** (sidebar tab): 3 databases — Lichess games (filter by speed + rating
  buckets 1000–2500 + date), Masters (~4M OTB games), WikiBook opening theory. Per position:
  candidate moves sorted by frequency with win/draw/loss bars, games count, avg rating, recent/
  top games. Free unauthenticated APIs: `GET /api/lichess/masters?fen=&topGames=` and
  `GET /api/lichess/lichess?fen=&speeds=&ratings=&topGames=`.
- **Opening pages**: ECO-based browsable encyclopedia linking position → opening name.
- **PGN import**: lichess.org/paste; export *with analysis annotations* baked in. Board editor
  (lichess.org/editor) for FEN setup with castling rights + side-to-move picker.

### Practice / study
- **Practice courses**: Checkmates (7), Fundamental tactics (8), Advanced tactics (10:
  zugzwang, interference, Greek gift, deflection, attraction, underpromotion, zwischenzug...),
  Endgames (opposition, key squares, Lucena/Philidor). Progress % per course.
- **Study Practice mode**: engine defends against you — each of your moves judged by eval change,
  opponent plays engine's best reply. How endgame technique is drilled. Mobile adds Maia
  (human-like) engine.
- **Gamebook / interactive lesson mode**: only author-scripted moves advance; wrong moves get
  instant feedback text and are hidden as deviation nodes. Per-move hints + success text. The
  cloneable pattern for scripted retry lessons.
- **Studies**: ordered chapters, each an analysis board (own tree/comments/glyphs). Roles
  (owner/contributor/reader), real-time sync, per-move comments, glyph toolbar (!, !!, ?!, ?,
  ??, ±, ∓, NAGs), arrows/circles, embed via iframe, export PGN / `.lichess` format.
- **Coordinate trainer**: Find-square and Name-square modes, color/timer options, best scores.

## Chess.com — analysis features beyond Game Review

- **Retry on key moves**: replay position before your suboptimal move, try to find the best;
  correct → shows adjusted score and advances; wrong → coach critiques. Best/great/brilliant are
  not retryable. Known complaint: coach reveals best moves too eagerly → hint ladder is the fix.
- **Reveal buttons per key move**: Best / Show Fork / Show Lost Piece / Show Checkmate / Show
  Idea — overlays the specific visual answer + plays the suggested line.
- **Opening coach in review**: first key move bubble shows opening name + your personal
  win/loss record in that opening.
- **Analysis board toggles**: eval bar, engine lines, suggestion arrows, immediate move feedback
  for experimental moves, threats. Engine settings: max time incl. Unlimited, engine choice, depth,
  line count. "Set Up Position": drag pieces, delete by dragging off, castling checkboxes, FEN/PGN
  paste, import lichess study URL, whole collections, game history.
- **Play from here**: game vs bot from any position, level picker.
- **Game Explorer**: Master games (~3M, weekly update), My Games, other members' games (username
  search). Per position: move frequencies, WDL bars, engine eval per move (masters), notable games.
- **Insights (Diamond)**: analytics over your archive — games over time, avg accuracy over time,
  accuracy *by move number*, results by opponent rating, Similar Players, result breakdowns by
  mechanism (timeout/checkmate/resignation), **Game Shapes** (group games by eval-graph silhouette),
  accuracy per phase, openings performance + "Mastery" (book moves), tactics found vs missed
  (forks/pins/mates/hung pieces with clickable examples), moves % by classification over time,
  accuracy per piece, castling timing vs win rate, calendar (hour/day heatmaps), geography.
  ALL of it is computable client-side from locally stored analyzed games.
- **Drills**: slightly-advantageous positions you must win vs flexible engine (K+Q vs K, Lucena,
  pawn races...); failure → retry. Endgames hub organizes them.
- **Coach personas + audio**: pick coach avatar, personality-toned commentary, TTS readout
  (Web Speech API — no server needed).
- **Depth pricing**: deeper analysis is a paid perk ("Deep"/"Maximum"/Unlimited) because their
  engine runs server-side. Our engine is client-side → depth can be free.

## Market scan — what others do

### ChessTempo
- **Opening repertoire trainer with spaced repetition**: color-coded due dates, reinforcement
  override, error tracking, line-depth config. Engine-verified lines (depth 25 standard, 50 on
  common positions) to flag unsound repertoire moves.
- **Endgame Theory trainer**: 17k+ endgames from real games, play out vs engine, "Theory mode"
  forces the theoretically fastest line, spaced repetition until known, Glicko-rated.
- **Tactics from your games**: problems extracted from your rated games, custom sets targeting
  past mistakes.
- **5M-game database + position search**: server territory; "your own games" explorer is local.

### DecodeChess (the "explain why" specialist)
- Natural-language **function explanations**: tactical motifs by name (fork, pin, deflection,
  lure, removing the defender), positional concepts (files/ranks/diagonals/pawn structure),
  move purpose vocabulary ("removes a supporter of e5"). Template + engine-derived reasoning.
- **Threats tab**: every opponent threat listed, expandable with verbal explanation + annotated
  variation; **before/after your best move toggle** showing how each threat's magnitude changes
  (0.11 → 2.5 pawns) + "solution paragraph". Opponent intentions summary with clickable arrows.
- **Explains YOUR move** (mistake/blunder/decent alternative), not only the engine line.
- **Hint modes**: "learn from my mistakes" or "give me hints" (piece → square → move ladder).

### Aimchess
- Bulk-import ~50 games → weakness scoring across ~8 areas: Openings, Tactics, Endings, Advantage
  Capitalization, Resourcefulness, Time Management, Initiative, Conversion.
- Openings report (per-color win rates + accuracy by opening), blunders per phase, time-management
  analytics (correlates think time with blunders; flags piece-hanging in time trouble),
  repeat-blunder tracking (same motif/piece/phase across games), blunders → puzzles ("single best
  feature" per reviewers), personalized daily workout + streaks + weekly report.
- Positioning gap: diagnostic only — no deep analysis, no explanations, no repertoire trainer.

### ChessBase
- Full annotation symbol set in PGN (NAGs travel with the file).
- Repertoire databases + **Opening Report** (auto-generated stats, typical plans, reference games
  sorted by Elo/annotation quality, "mark move blue" for critical moves).
- **Blunder Check vs Full Analysis** two-speed model: fast shallow pass flags only ?!/??
  with engine stamp; Full adds evals, variations, eval graph, auto-text. (Maps to a "quick review"
  mode.)
- **Show Threat** toggle (the originator of threat display).

### 2024–26 indie landscape
- **Spaced repetition of mistakes**: DiscoChess (mistake review, SR until ~80% mastery),
  ChessFlare (SM-2/Anki quality 1–5), ChessWoodie (wrong puzzles return next day, expanding
  intervals), Blunder Gym + Chess Blunder Trainer (Android), litrainer (open-source Lichess
  mistakes → puzzles). Proven demand; all local-computable (analysis emits
  (position, played, best) tuples; SM-2/FSRS scheduling is ~100 lines).
- **LLM coaches**: Chessvia.ai, CheckMatEx, ChessDNA (free no-login review). Consensus: LLMs are
  weak at board reasoning — winning pattern is **LLM prose grounded in engine output**. BYO API
  key keeps "no account" alive; template coach stays as offline fallback.
- **WDL displays**: LC0 WDL head (2019) → Stockfish emits WDL via `UCI_ShowWDL`; lichess still
  doesn't expose percentages (open request) — a three-segment WDL bar + sharpness score
  (win%+loss% vs draw%) is an open differentiator.
- **Heatmaps**: qxf2/chess-heatmap (per-ply square control), chess-visualizer (attack/defense
  colors), Chessyi (12+ overlays), animated "attack waves". All local computation.
- **Time analytics**: Repertoire Builder "Time Usage Analysis"; lichess ships per-move time graph;
  chess.com users request it. Academic backing: think time tracks "value of computation";
  time pressure → ~10% more risk-taking.
- **Repertoire deviation detection**: chess-analysis.org "My Openings", Reddit deviation-checker,
  ChessAtlas (FSRS trainer listing "deviation detection" as a key criterion). Long-requested.
- **Practical-decision analysis**: confirmed whitespace — "was your choice practically fine even
  if not engine-best?" (complexity = branch count, tactic presence, mate distance heuristics).
- Community proof of demand: a Reddit-built free Game Review clone got significant traction
  (r/chess 2025); chessis (1M+ installs) sells "estimated Elo" + phase breakdowns.

## Chess.com review classifications + colors (verified from their client)
Brilliant !! #1baca6 · Great ! #5c8bb0 · Best ★ #81b64c · Excellent ✓ #96bc4b · Good ✓ #96af8b ·
Book B #a88865 · Forced → #96af8b · Inaccuracy ?! #f7c631 · Mistake ? #ffa459 · Miss ✕ #fa412d ·
Blunder ?? #fa412d. Official definitions: Brilliant = great sacrifice; Great = critical move that
altered the course; Blunder = significantly worsens; Mistake = immediately worsens; Inaccuracy =
not as good as the best; Book = standard opening move; Good = fine but better existed.

## Metric design (v2, 2026-10-24): what "accuracy" actually is

There is no "exact" accuracy — every number is a model-dependent proxy for move quality.
Compared approaches, with measurements from our ground-truth games:

- **Legacy exponential + arithmetic mean** (our shipping model, LOSS_SCALE 3.04): RMSE 5.07 vs
  chess.com's official accuracies; generalizes to held-out games (the Player-A game read within
  +1.8/+4.0).
- **Legacy exponential + harmonic mean** (lichess's documented aggregation): tested — WORSE on
  our data (RMSE 8.1 at best-fit k=0.86). chess.com's current model does not aggregate like
  lichess. Hypothesis tested and refuted.
- **ACPL** (mean centipawn loss): adopted as a displayed transparency metric (lila-style, capped
  1000cp/move). Absolute, additive, comparable to lichess; complementary to the % scale.
- **WDL/expected-score loss** (Lc0-style, most principled): SF19 exposes WDL via UCI_ShowWDL —
  planned v3 refinement (needs a full recalibration pass; groundwork documented here).

**Game Rating** upgraded from a 2-anchor linear fit to a log curve fitted on 4 chess.com anchors:
rating = 2773·ln(acc) − 10881, clamp [100, 2900] (fits 3 of 4 anchors within ~11 points).

Sources: lichess.org/page/accuracy (logistic conversion + harmonic mean, constant 0.00368208),
lila forum "Accuracy is NOT an improvement over centipawn loss" (harmonic mean confirmation +
critique), r/Chesscom accuracy-score investigation thread (community analysis of the
current model), Chess Engine Lab (ACPL distribution analysis), chess.com support (Game Review
runs Stockfish 16 NNUE ~depth 18 server-side — why their evals are more stable than ours).

chess.com's current server-side accuracy model is NOT the legacy public formula — measured
against their official game accuracies (from the archive API `accuracies` field), the legacy
formula under-penalizes errors ~3x, worst for weak performances (a chess.com 59% game read 80%+
uncalibrated). Depth/engine choice barely moves it (SF19 Lite d10 vs Full d14 differ by ~±2).

Fix: single multiplicative loss scale `LOSS_SCALE = 3.04` in `accuracy.ts`, fitted per-move
(6 player-sides × 21-35 moves each, Stockfish 19 Full @ depth 14). Result: RMSE ≈ 5 accuracy
points vs chess.com; validation game read 86.5/83.2 vs their 85.33/77.71.

Validation on the original complaint game (Player-A vs Player-B, Danish Gambit, 108 plies,
Full d14), official chess.com accuracies from their archive API:
Player-A (White) cc 59.5 → ours 63.3 (+3.8); Player-B (Black) cc 62.22 → ours 67.4 (+5.2).
Game Rating 727/861 vs their ~550-600 display (was 1228/1288 uncalibrated). Note chess.com also
scored the LOSING side higher (62.22 vs 59.5) — accuracy measures move quality, not result; our
ordering matches theirs. (Investigation note: the username is "Player-A" — an earlier search
regex "rysnah" silently missed it.) Run-to-run variance: the same game re-reviewed reads ±1-2
accuracy points (Stockfish hash/timing nondeterminism) — total expected deviation from
chess.com ≈ ±5-7 points per game.

Known limits:
- Fitted on only 3 games / 6 sides from one player's archive — more ground-truth games will
  tighten it. The friend's game (chess.com ~59/62 acc) can be pulled by *their* username.
- The scale is fit at SF19 Full depth 14 (the shipping default); Lite/d10 reviews will read
  differently.
- Game Rating's linear map (32.9·acc − 1356) tracks chess.com's ratings once accuracy matches
  (cc acc 59 → ~585 rating ✓ matches their ~550-600 display).
