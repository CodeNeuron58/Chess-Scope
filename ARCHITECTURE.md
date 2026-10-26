# Architecture

Owlchess is a client-side React app: the chess engine (Stockfish WASM), the game library
(IndexedDB) and all analysis run in the browser. There is no backend.

```
src/
├── main.tsx / App.tsx        # entry; App = AppProvider + Rail + the routed page
├── router.ts                 # dependency-free hash router (#/review, #/settings/accounts …)
├── state/
│   ├── context.ts            # AppState type + useApp()
│   └── AppProvider.tsx       # composition root: wires the hooks below, opens/saves games
├── pages/                    # one component per rail entry (+ colocated CSS)
│   ├── HomePage · ReviewPage · AnalysisPage · LibraryPage
│   └── InsightsPage · DrillsPage · SettingsPage   (boardPage.css = shared board layout)
├── components/               # presentational pieces: Board, StaticBoard, EvalBar, EvalGraph,
│                             # PlayerBar, Rail, ImportForm, controls (Segmented, Toggle,
│                             # Popover, Modal, ClassChip …), GameStatsModals, Icon, Toast
├── hooks/                    # state domains, one hook each
│   ├── useSettings.ts        # persisted prefs + accounts (owlchess.* keys, ChessScope migration)
│   ├── useEngine.ts          # engine client lifecycle (one client per engine choice)
│   ├── useGameState.ts       # the chess.js instance: moves, ply, FENs, start FEN, headers
│   ├── useReview.ts          # foreground review: progress, cancel, restore a stored review
│   ├── useReviewQueue.ts     # background batch reviews on the shared engine
│   ├── useLiveAnalysis.ts    # analysis-board search with per-depth updates
│   ├── useLibrary.ts         # in-memory library mirrored to IndexedDB + account sync
│   ├── useCoachMode.ts       # guided review narration + reveal overlays
│   ├── useDrillProgress.ts   # solved drills, streak, weekly tally, today's set
│   ├── useThreats.ts · useBoardKeys.ts · useBoardSize.ts
├── analysis/                 # pure chess logic (no React), unit-tested
│   ├── review.ts · accuracy.ts · classify.ts · coach.ts · skills.ts
│   ├── openings.ts (+ openingBook.json, generated from scripts/openings/*.tsv)
│   ├── patterns.ts · pgnExport.ts
├── library/                  # pure library logic (no React), unit-tested
│   ├── types.ts              # StoredGame, ReviewSummary, DrillItem, Accounts
│   ├── db.ts                 # IndexedDB: `games` (light records) + `reviews` (full results)
│   ├── pgnMeta.ts            # PGN → record (players, result, speed, opening, clocks, ids)
│   ├── summary.ts            # ReviewResult → ReviewSummary (per-move stats, themed mistakes)
│   ├── stats.ts              # Home/Insights aggregations
│   ├── drills.ts             # drill sets, multiple-choice answers, judging
│   ├── explorer.ts           # "My games" opening explorer index
│   └── lichess.ts            # Lichess API (user games, game export, explorer)
├── chesscom/api.ts           # chess.com Public API client + record conversion
├── engine/engineClient.ts    # UCI worker client (MultiPV per search, live updates, stop,
│                             # time caps) + EnginePool (engines side by side for reviews)
├── lib/                      # constants (classification styles, themes, piece sets), chess
│                             # utils, formatting, synthesised move sounds
└── styles/                   # base.css (design tokens) + ui.css (shared components)
public/
├── engines/                  # Stockfish WASM builds + NNUE net (GPL, copied on install)
├── pieces/                   # open-licensed piece sets + LICENSES.md
└── owlchess-*.png, favicon.png
```

## Design rules

1. **One-way dependency flow**: `pages → components → hooks → (engine | analysis | library |
   chesscom) → lib/types`. `analysis/` and `library/` never import React; pages and components
   never talk to the engine worker directly.
2. **The game on the board is owned by `useGameState`** — exactly one chess.js instance (ref).
   `AppProvider` tracks which library record it came from; the link holds only while the moves are
   unchanged (playing a new move starts a new, unsaved line).
3. **One engine pool, shared**: `useEngine` owns an `EnginePool` per engine choice. Reviews and
   the background queue use the whole pool (`getPool`), splitting a game's positions into short
   chunks each engine pulls when free; single-position work (analysis board, threats, drill checks)
   uses the pool's main engine (`getEngine`). Searches are serialized per engine. The quick first
   pass runs on a separate lite pool (`getQuickPool`) that loads in under a second. The queue
   yields whenever a review or the analysis board needs the engines; `stop(signal)` only ever
   stops the caller's own search. Engine results are cached per position in IndexedDB.
4. **Reviews are immutable results keyed by their moves**: `useReview` exposes a review only while
   its move list matches the board. Completed reviews are saved to the library (summary on the game
   record, full result in the `reviews` store) and restored without re-analysis when reopened.
5. **Pure logic lives in `analysis/` and `library/` and is unit-tested** (`npm run test`).
   Classification thresholds, the accuracy calibration and the rating curve are documented where
   they are defined, with the reasoning in RESEARCH.md.
6. **Design tokens, not literals**: colours, radii and fonts come from `styles/base.css`; board
   themes, piece sets and classification styles from `lib/constants.ts`.

## Engine configuration

Each engine runs in a Web Worker (`public/engines/`) speaking UCI over `postMessage`. Three
single-threaded builds are selectable (Stockfish 19 / 19 lite / 16); the multi-threaded WASM builds
were measured to reach a fixed depth no faster, so parallelism comes from the pool instead. Reviews
use MultiPV 2 (capped by the number of legal moves) and a per-position time cap by depth; the
analysis board searches as many lines as it shows, to depth 30, reporting every completed depth.

## Move classification

`analysis/classify.ts` follows chess.com's published expected-points bands (Excellent ≤ .02,
Good ≤ .05, Inaccuracy ≤ .10, Mistake ≤ .20, Blunder above), with a rating-aware win curve, and
rules for Great (only good move, not a recapture), Brilliant (a sacrifice that holds along the
engine line), Miss (failing to punish the opponent's error) and Book (positions on the Lichess
opening dataset, transpositions included). Accuracy keeps its own calibrated curve; Game Rating is
anchored on the players' ratings when the PGN has them. Details and measurements: RESEARCH.md.

## Data & privacy

No account system, no server, no telemetry. Network calls happen only when the user asks for them:
chess.com / Lichess public APIs for imports and sync, Lichess game export for pasted links, and the
Lichess explorer when a personal token is set. Fonts are bundled; nothing loads from a CDN.
