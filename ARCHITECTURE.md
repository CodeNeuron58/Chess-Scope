# Architecture

ChessScope is a client-side React app: the chess engine (Stockfish WASM), the game database
(IndexedDB), and all analysis run entirely in the browser. There is no backend.

```
src/
├── main.tsx / App.tsx        # composition root: wires hooks to the layout, no logic
├── hooks/                    # state domains, one hook each (see below)
│   ├── useSettings.ts        # persisted prefs (engine, depth, orientation, audio)
│   ├── useEngine.ts          # engine client lifecycle (one client per engine choice)
│   ├── useGameState.ts       # the chess.js instance: moves, ply, FENs, makeMove, PGN
│   ├── useReview.ts          # review orchestration: progress, cancel, auto-review
│   ├── useCoachMode.ts       # interactive coach: narration, reveal overlays
│   ├── useDrills.ts          # mistake drills: attempt validation, hints, progression
│   ├── useThreats.ts         # opponent-threat arrow (turn-flipped engine query)
│   └── useBoardSize.ts       # responsive board sizing
├── analysis/                 # pure, testable chess logic (no React)
│   ├── engineClient.ts → ../engine/   # UCI worker client (search parsing, MultiPV)
│   ├── review.ts             # orchestrates per-position analysis → ReviewResult
│   ├── accuracy.ts           # win% model, calibrated accuracy, ACPL, Game Rating
│   ├── classify.ts           # move classification (brilliant → blunder)
│   ├── coach.ts              # coach commentary templates + fun facts
│   ├── skills.ts             # opportunity meters (captures, checks, hangs…)
│   ├── openings.ts           # opening book + ECO-style names
│   ├── patterns.ts           # fork / hanging-piece / mate detection
│   ├── pgnExport.ts          # PGN writer with NAG classification glyphs
│   └── __tests__/            # vitest suites for the pure modules
├── chesscom/                 # chess.com Public API client + IndexedDB cache
├── components/               # presentational components (+ colocated CSS)
├── lib/                      # shared constants (palette, class lists) + chess utils
├── types.ts                  # shared domain types
└── samples.ts                # bundled example games
public/engines/               # Stockfish WASM builds + NNUE net (GPL)
```

## Design rules

1. **One-way dependency flow**: `components → hooks → (engine | analysis | chesscom) → lib/types`.
   Analysis modules never import React; components never import the engine worker directly.
2. **The game state is owned by `useGameState`** — exactly one chess.js instance (ref). Every
   other domain reads derived data (moves, FENs) or receives callbacks.
3. **The engine client is owned by `useEngine`** — one live client per engine choice; review,
   drills, and threats request it via `getEngine(choice)` and all searches are serialized
   inside the client.
4. **Pure logic lives in `analysis/` and is unit-tested** (`vitest`, `npm run test`).
   Classification thresholds, the accuracy calibration scale, and the rating curve are
   documented where they are defined, with the reasoning in RESEARCH.md.
5. **Reviews are immutable results**: a `ReviewResult` is produced once per completed review
   and cleared automatically whenever the game moves change (see `useReview`).

## Engine configuration

The engine runs in a Web Worker (`public/engines/`), speaking UCI over `postMessage`.
Three builds are selectable at runtime (Stockfish 19 full / 19 Lite / 16). Searches use
MultiPV 3 and are serialized; a per-position timeout falls back to the deepest completed
depth if a search stalls.

## Data & privacy

No account system, no server, no telemetry. The only network calls are to chess.com's
read-only Public API (user-initiated game import) and engine downloads.
