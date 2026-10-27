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

## Metric design v3 (2026-10-27): matching chess.com's move ratings, and speed

Reference game (user-supplied, chess.com review screenshot): naguel14 (2025) vs Srijita_24 (2027),
1-minute bullet, 1-0, 33 moves. chess.com: accuracy 71.7 / 70.8, Game Rating 1900 / 1900,
W/B counts — Great 0/1, Book 2/2, Best 10/8, Excellent 5/7, Good 5/4, Inaccuracy 3/5,
Mistake 4/2, Miss 0/2, Blunder 3/1 (Forced moves are not counted in their table).

v2 (win% thresholds 0.5 / 1.2 / 2.2 / 5, cp-based Great, one-ply Brilliant): Blunder 8/6,
Mistake 6/7, Inaccuracy 1/0, Great 1/4, Brilliant 0/2, Game Rating 949/1053.

Root causes and fixes:
- **Thresholds ~4× too strict.** chess.com's support article publishes expected-points bands:
  Best 0, Excellent ≤ .02, Good ≤ .05, Inaccuracy ≤ .10, Mistake ≤ .20, Blunder > .20. Adopted.
- **Rating-blind curve.** chess.com's expected points depend on rating. Classification now uses
  the lichess logistic with its slope scaled 0.6× (800) → 1.0× (2300), 1.1× cap. Accuracy keeps the
  calibrated rating-free curve. A slope sweep on the reference game moved the error count by at
  most 3 (9–12 across 0.8×–2.4×): residual differences are engine-evaluation differences that push
  moves across a band edge (e.g. 15.c4 at .097), not the curve.
- **Great** now needs the engine move, a ≥ .10 expected-points gap to the second line, a result
  ≥ .40, not a recapture and not grabbing material the opponent just hung. **Brilliant** needs a
  sacrifice that still holds along the engine's PV (≥ 2 points down after the reply and after our
  next move), not in already-won positions (< .95). **Miss** = the opponent's last move handed over
  ≥ .10 and the reply gives ≥ .10 back without ending up worse than before the gift. **Best** also
  covers moves within .002 of the engine's choice.
- **Book** from the Lichess chess-openings dataset (CC0), matched by position. The reference game
  is only "book" for 1.e4 b6 there (chess.com also counts 2.Nf3 Bb7 — their book is larger).
- **Game Rating** is not a function of accuracy alone: chess.com gave ~59.5% → ~575 between
  beginners and ~71% → 1900 between 2025-rated bullet players. New model: player rating ± 50 Elo
  per accuracy point versus a typical accuracy for that rating and time control, rounded to 50.
  Provisional constants (one anchor per time control at most); accuracy-only fallback without
  ratings. Needs more chess.com Game Ratings (not exposed by their API) to refit.

v3 on the reference game (SF19 full, depth 14): Great 0/1, Best 10/11, Excellent 7/7, Good 7/3,
Book 1/1, Inaccuracy 4/7, Mistake 1/0, Miss 1/1, Blunder 1/1; accuracy 69.9 / 71.8; Game Rating
1850 / 1950. Per-move agreement on the decisive moments: 22.Nh4 blunder, 22…e4 miss, 24…Qxh4
great, 31…Nxh2 blunder.

### Speed (Chrome, 16-core machine, the 66-position reference game, depth 14, MultiPV 2)

| Setup | Time |
|---|---|
| v2: one single-threaded engine, MultiPV 3, depth 14 | ~164 s |
| one multi-threaded engine, 8 threads | 288 s (slower!) |
| 2 engines × 2 threads | 45 s |
| 4 engines × 2 threads | 24 s |
| 8 engines × 1 thread | 55 s (memory contention) |
| **4 single-threaded engines** | **20–22 s** |
| 8 lite engines, depth 14 | 8 s |
| 8 engines, depth 8 | 0.7 s |

Lazy-SMP threads in the WASM build barely shorten a fixed-depth search (one quiet position:
977 ms single vs 609 ms with 8 threads, at 5.5× the nodes) and did not deepen the live analysis
either, so v3 stays single-threaded (no COOP/COEP headers needed) and runs a pool of engines
(half the cores, max 4; 2 on ≤ 4 GB devices). Profiling showed the engine is 99% of review time;
the skills pass was the largest non-engine cost (~2 s per pass) and now uses attack tables.
End to end in the app: first report ~4 s (quick pass on lite engines that load instantly), full
review ~26 s, cached re-run ~1.6 s (IndexedDB eval cache).

### Accuracy recalibration (2026-10-27)

Calibration set: the 32 games in Srijita_24's chess.com archive (Sept–Oct 2026) that carry
chess.com's official `accuracies` (20 blitz, 12 bullet → 64 player-sides), reviewed headlessly with
Stockfish 19 Full, depth 14, MultiPV 2 (~29 s per 68-ply game with the engine pool).

| Model | Fitted k | RMSE | Bias |
|---|---|---|---|
| shipped, arithmetic mean, k = 3.04 (6-side fit) | — | 5.90 | −2.18 |
| arithmetic mean, refit | 2.64 | 5.56 | −0.30 |
| arithmetic mean, skip book + forced | 2.36 | 5.81 | −0.21 |
| (mean + harmonic) / 2 (lichess-style) | 1.00 | 11.45 | +2.04 |

Leave-one-game-out RMSE: refit 5.66 vs 3.04's 5.90. Per time control the best k differs (blitz
2.46, bullet 2.94), and fitting on one predicts the other worse than either own fit — a hint that
chess.com's accuracy depends on time control or rating, but 12 bullet games are too few to split.
Shipped: k = 2.64. 27 of 64 sides land within ±3 of chess.com, 40 within ±5; the worst outliers
(−14 / +12) are short games where a single eval disagreement dominates the average.

## Game Rating v4 (2026-10-28): typical accuracy measured, 35 Elo per point

Report: a game between 922- and 946-rated players read 100 / 300 in Owlchess and 350 / 550 on
chess.com, with accuracies close to chess.com's. chess.com's help article ("How is Game Rating
calculated?") gives no formula, only the principle: compare move quality "to what is expected from
a player at your rating level", averaging out to the player's rating over time.

Data: chess.com's own `accuracies` from the public archive API — 9,032 player-sides of rated,
reviewed games (≥ 10 moves) from 250 random players (country lists) plus Srijita_24's archive and
25 titled players each of NM / CM / WFM / WCM / FM / WIM / IM. Mean accuracy by 200-Elo band:

| Rating | Bullet | Blitz | Rapid | old model (rapid) |
|---|---|---|---|---|
| 300 | 63.2 | 62.2 | 59.9 | 68.3 |
| 900 | 71.0 | 70.6 | 71.0 | 71.9 |
| 1300 | — | 74.7 | — | 74.3 |
| 2100 | 75.3 | 79.4 | 83.2 | 79.1 |
| 2500 | 79.0 | 82.5 | 86.4 | 81.5 |

Findings:
- Near 900 the old typical accuracy was already about right, so the 250-Elo gap came from the step
  size: 50 Elo per accuracy point against chess.com's ~31–35 (their gaps from the players' ratings
  are 0.6–0.7× ours on the reported game). Two players of one game, 85.3 → 1450 and 77.7 → 1200,
  give ~33 per point independently of the rating curve.
- The old straight line (0.6 per 100 Elo) was 8 points too high for beginners and 3–4 too low
  above 2000; real accuracy climbs ~1–1.5 per 100 Elo below 1100 and flattens above.

Model: typical accuracy = per-time-control knots (band means, made non-decreasing with weighted
isotonic regression, bands under 40 games dropped, linear in between); daily = rapid + 3.5 (140
sides only); classical = rapid. Game Rating = rating + 35 × (accuracy − typical), rounded to 50,
clamped 100–3000. Checks: the 2025 / 2027 bullet game at 71.7 / 70.8 → 1900 / 1900 (chess.com
1900 / 1900; 33 gives 1950 / 1900, 40 gives 1900 / 1850); mean Game Rating per 400-Elo band
lands within ~15 Elo of the band's mean rating for bullet, blitz and rapid. Home / Insights now
average each game's Game Rating (with that game's rating and time control) instead of mapping the
average accuracy alone, and the Review page recomputes it from accuracy so stored reviews update.

