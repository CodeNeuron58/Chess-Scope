# License

## Application code

The Owlchess source code in `src/` (and this repository generally, excluding the engine
binaries described below) is released under the **MIT License**:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this
> software and associated documentation files (the "Software"), to deal in the Software
> without restriction, including without limitation the rights to use, copy, modify, merge,
> publish, distribute, sublicense, and/or sell copies of the Software, subject to the
> following conditions: The above copyright notice and this permission notice shall be
> included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
> INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
> PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
> FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
> DEALINGS IN THE SOFTWARE.

## Stockfish engines (GPLv3)

The chess engine builds in `public/engines/` — **Stockfish 19 and Stockfish 16**, including
the NNUE networks — are Copyright the Stockfish developers and Chess.com LLC, licensed under
the **GNU General Public License version 3**:

- Upstream: https://github.com/official-stockfish/Stockfish (GPLv3)
- WASM port: https://github.com/nmrugg/stockfish.js (GPLv3)

The engines are downloaded from their official npm packages at install time
(`npm run postinstall`) and are not part of this repository's source. If you distribute
them (with this app or otherwise), the GPLv3 terms apply to those files: keep the license
notices and make the corresponding source available. See `Copying.txt` inside the engine
packages for the full text.

## Piece sets

The piece images in `public/pieces/` come from the lichess-org/lila repository. Each set
keeps its own licence (see `public/pieces/LICENSES.md`, which must ship with the assets):

| Set | Author | Licence |
|---|---|---|
| cburnett (Classic) | Colin M.L. Burnett | GPLv2+ |
| merida | Armando Hernandez Marroquin | GPLv2+ |
| chessnut | Alexis Luengas | Apache 2.0 |
| fantasy, celtic | Maurizio Monge | MIT |

The GPL-licensed sets carry copyleft terms when distributed; the Apache 2.0 and MIT sets are
the simplest for commercial use.

## Opening book

`src/analysis/openingBook.json` is generated (by `scripts/build-openings.mjs`) from the
[Lichess chess-openings](https://github.com/lichess-org/chess-openings) dataset in
`scripts/openings/`, released under the **CC0 Public Domain Dedication**.

## Third-party libraries

- chess.js — BSD-2-Clause
- react, react-dom, react-chessboard — MIT
- vite, vitest, typescript — MIT
- Figtree and JetBrains Mono fonts (bundled via @fontsource) — SIL Open Font License 1.1

## Trademarks

Chess.com™ is a trademark of Chess.com, LLC. Owlchess is an independent, unaffiliated
project and is not endorsed by or connected with Chess.com, LLC. Lichess™ belongs to the
Lichess community project.
