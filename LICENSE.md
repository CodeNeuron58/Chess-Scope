# License

## Application code

The ChessScope source code in `src/` (and this repository generally, excluding the engine
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

## Third-party libraries

- chess.js — BSD-2-Clause
- react, react-dom, react-chessboard — MIT
- vite, vitest, typescript — MIT

## Trademarks

Chess.com™ is a trademark of Chess.com, LLC. This project is an independent, unaffiliated
learning project and is not endorsed by or connected with Chess.com, LLC. Lichess™ belongs
to the Lichess community project.
