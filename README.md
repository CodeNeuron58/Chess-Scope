# Owlchess

Private chess game review that runs entirely in your browser. Stockfish analyses every move,
rates it (Brilliant → Blunder), scores both players' accuracy, and a coach walks you through the
game. Your games build into a local library that powers Insights and drills made from your own
mistakes. No account, no server, no telemetry — nothing leaves your machine except the imports
you ask for.

## Run it

```bash
npm install        # also copies the Stockfish builds into public/engines/
npm run dev        # → http://localhost:5173
npm run build      # production build
npm run test       # unit tests (vitest)
npm run lint       # oxlint
```

## Pages

| Page | What it does |
|---|---|
| **Home** | Import a game (link, PGN, FEN, username, .pgn file), continue where you left off, your headline stats, recent games, today's drill, connected accounts |
| **Review** | Game report (accuracy, game rating, eval graph, move classifications), guided coach walkthrough with voice, key moments, engine lines, per-game Skills and Advanced stats |
| **Analysis** | Free analysis board with live Stockfish (to depth 30, 1–3 lines), threat arrow, opening explorer |
| **Library** | Every game you've loaded, imported or synced; search, filter, batch review, export |
| **Insights** | Accuracy over time, skills by position type, accuracy by phase, where you lose points, clock stats, openings |
| **Drills** | Positions from your own mistakes: daily set, by theme, mixed, this game, per opening |
| **Settings** | Engine and depth, board theme and pieces, coach, review, accounts, your data, credits |

## Engines

Stockfish runs locally as WebAssembly (GPLv3):

| Engine | Download | Best for |
|---|---|---|
| Stockfish 19 | 94 MB | Deepest analysis — the default, and what accuracy is calibrated against (depth 14) |
| Stockfish 19 lite | 1.7 MB | Instant load, slightly weaker |
| Stockfish 16 | 40 MB | Previous generation |

## Accounts and network use

- **chess.com** and **Lichess**: enter a username; recent public games are imported through each
  site's official public API (no password). Owlchess re-syncs when the last sync is over 15 minutes
  old and can review up to five new games in the background.
- **Lichess opening explorer**: Lichess has required a personal API token for its explorer since
  March 2026. Add a free token (no scopes) in Settings → Accounts to use the Masters and Lichess
  databases. The "My games" explorer works offline from your library.
- Everything else — the engine, your library (IndexedDB), drills progress and settings
  (localStorage) — stays in the browser.

## Project docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — codebase structure and design rules
- [FEATURES.md](FEATURES.md) — feature checklist (shipped / now / later)
- [ROADMAP.md](ROADMAP.md) — prioritised plan
- [RESEARCH.md](RESEARCH.md) — market research and accuracy calibration archive
- [LICENSE.md](LICENSE.md) — MIT app code; GPL engines; piece-set licences

Built with React, Vite and TypeScript, chess.js for rules, react-chessboard for the board and the
`stockfish` npm WebAssembly builds. Piece sets come from lichess-org/lila under their own licences
(see `public/pieces/LICENSES.md`). Not affiliated with chess.com or Lichess.
