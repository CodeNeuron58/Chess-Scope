# ChessScope — Feature Roadmap

Research basis: feature inventory of Lichess + chess.com analysis ecosystems, and a market scan
(ChessTempo, DecodeChess, Aimchess, ChessBase, 2024–2026 indie tools). Everything below is
client-side-feasible unless marked otherwise. Current app already has: full SF19/16 analysis,
classifications, accuracy, Game Rating, eval bar/graph, MultiPV lines, coach mode, Skills,
Advanced Stats, PGN I/O, 3-engine selector.

## Tier 1 — Quick wins (high value, days)

1. **Mistake drills ("Learn from your mistakes" / chess.com Retry).** After a review, jump to
   each of your mistakes/blunders, hide the played move, and let the user find the better move;
   engine validates the attempt. Add a hint ladder (piece → square → move). Reviewers across
   6+ products call this the single best feature of the genre. 100% local.
2. **Threat display (press X).** ChessBase-originated, copied by Lichess/chess.com: re-run the
   engine with the turn flipped and draw *the opponent's best move* as a red arrow — "what am I
   threatening?". One extra engine query per position.
3. **PGN NAG export.** Map classifications to standard NAGs (!! = $3, ! = $1, ?! = $2, ? = $4,
   ?? = $6...) so reviews become portable into ChessBase/Lichess. Pure string work.
4. **Eval cache (IndexedDB).** Persist FEN→eval per depth; instant re-reviews and a "cached"
   badge — the local equivalent of lichess cloud evals / chess.com cloud analysis, minus the server.
5. **Time-vs-eval overlay.** Chess.com/Lichess PGNs embed `%clk` comments; overlay a think-time
   graph on the eval graph and flag "blundered with <10s" points (Aimchess-style insight).
6. **WDL bar + sharpness.** Stockfish emits win/draw/loss when `UCI_ShowWDL` is on — a
   three-segment bar is a stronger UX than a bare eval number, and WDL spread gives a
   "position sharpness" stat (novel, from LC0's WDL head).

## Tier 2 — Big differentiators (weeks)

7. **Local Insights** (chess.com's Diamond analytics, computed free): accuracy over time,
   accuracy-by-move-number, results by opponent strength, "game shapes" (group games by eval-graph
   silhouette), repeat-blunder clustering by motif/phase/piece. Requires multi-game import +
   local storage of analyzed games (IndexedDB) — no account system needed.
8. **Opening explorer.** Two paths: (a) Lichess's free, unauthenticated explorer API (masters +
   lichess databases, win/draw/loss bars per move), or (b) a bundled master-game sample DB.
   Shows candidate moves with statistics next to engine lines, like both big sites.
9. **Repertoire trainer + deviation detection.** Spaced repetition (SM-2) over your opening
   lines; then compare future games against the repertoire to flag "you left your prep here"
   (ChessTempo/Aimchess/ChessAtlas pattern; long-requested feature).
10. **Play from here vs the engine.** "Continue from here" exists on both sites; we already run
    the engine — add adjustable strength (UCI Skill Level / UCI_LimitStrength) and a game clock.
11. **"Explain why" upgrade (DecodeChess-style).** Name the motif (fork, pin, hanging piece,
    defender removal) and the move's function; add a "practical decision" lens — was the played
    move *practically* fine even if not engine-best? (confirmed market gap: nobody does this).
12. **Two-speed analysis.** ChessBase's blunder-check (fast, flags only errors) vs full analysis —
    our Fast/Standard/Deep presets can grow a "blunder-check only" mode for 30-second reviews.

## Tier 3 — Platform / later

13. **Variation tree.** Alternative moves as tree branches, promote/delete via right-click
    (Lichess model), instead of a single line.
14. **Study documents.** Save analysis + comments + glyphs as a JSON/PGN document with multiple
    chapters; export/import files instead of a server (Lichess studies without the backend).
15. **Square-control heatmap overlay.** Attack/defense maps per position (qxf2/chess-heatmap,
    Chessyi pattern) — locally computed, visually striking.
16. **Coordinate trainer + blindfold mode.** Trivial add-ons from Lichess's playbook.
17. **LLM coach layer (BYO API key).** Research consensus: engine-grounded LLM commentary is the
    winning pattern; our template coach stays as the offline fallback. Optional, off by default.
18. **Shareable review.** Export the whole review as a self-contained HTML file or annotated PGN.
19. **Batch review.** Import a Chess.com/Lichess export archive, review all games overnight-style,
    feeding #7 and #9.

## Recommended build order

1 → 2 → 3 (a weekend: drills + threat + NAG export = the biggest UX leap for the least work),
then 4 + 6 (persistence + WDL), then 7 (Local Insights) once multi-game import exists.
