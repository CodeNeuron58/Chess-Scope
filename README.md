# ChessScope — Game Review

A local, private alternative to chess.com's Game Review — built with open-source components and
zero chess.com code or assets. The engine runs **in your browser**: no account, no server, no
telemetry, nothing leaves your machine.

## Run it

```bash
npm install
npm run dev        # → http://localhost:5199
npm run build      # production build
```

## Engines

Stockfish runs locally as WASM (chess.com's own open-source stockfish.js port, GPLv3):

| Engine | Download | Best for |
|---|---|---|
| Stockfish 19 (full) | 94 MB | Deepest analysis — the default |
| Stockfish 19 Lite | 1.7 MB | Instant load, still far above human level |
| Stockfish 16 | 40 MB | Legacy comparison |

## Features

- **chess.com connection** — enter your username (no password, public API only) and browse your
  real game archive; one click loads any game and starts the review automatically.
- **Game Review** — every position analyzed (MultiPV 3), live progress, cancel.
- **Move classifications** — Brilliant !! → Blunder ?? (11 classes with chess.com's color language),
  plus per-player **accuracy** (public chess.com accuracy model) and **Game Rating**.
- **Coach review** — move-by-move commentary, Explain/Best buttons, coach voice (Web Speech API),
  reveal overlays (Show fork / lost piece / mate).
- **Mistake drills** — replay every mistake/blunder/missed win with your move hidden, find the
  better move yourself, engine-validated, hint ladder included.
- **Threat display** (X) — see the opponent's best reply as a red arrow.
- **Skills panel** — captures/checks/castles/free-piece opportunity meters per player.
- **Advanced Stats** — accuracy per phase (opening/tactics/strategy/endgame).
- **Eval graph** (±10), engine lines, best-move arrows, opening name + "out of book" marker.
- **PGN import/export** — export includes classification glyphs as standard PGN NAGs.
- Settings persist locally; keyboard navigation (←/→/Home/End/X); board flip; play new moves
  on the board.

## Project docs

- [FEATURES.md](FEATURES.md) — full feature checklist (shipped / now / later)
- [ROADMAP.md](ROADMAP.md) — prioritized plan
- [ARCHITECTURE.md](ARCHITECTURE.md) — codebase structure and design rules
- [RESEARCH.md](RESEARCH.md) — market research archive
- [BUSINESS.md](BUSINESS.md) — monetization notes

## Project

Built as a self-contained learning project: React + Vite + TypeScript, chess.js for rules,
react-chessboard for the board, and the `stockfish` npm WASM builds (GPL) for analysis — the
same open-source engine family chess.com ships in their own web client. The review experience
follows the UX conventions chess.com established, re-implemented from scratch with original
code and assets. Not affiliated with chess.com.
