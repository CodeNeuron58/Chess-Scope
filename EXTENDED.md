# Owlchess — Extended Vision

What could make Owlchess a serious alternative to chess.com and Lichess.
Release work lives in [TODO.md](TODO.md); money and launch in [BUSINESS_PLAN.md](BUSINESS_PLAN.md).

**Effort:** S = days · M = 1–3 weeks · L = a month or more.
**Server:** ✗ runs in the browser (free to run) · ✓ needs a backend (costs money).

---

## The strategy: be the best place to *improve*, not another place to *play*

chess.com and Lichess are playing sites first. Their moat is millions of players, matchmaking,
anti-cheat and servers — very hard to beat head-on. Their weak spot is **what happens after the
game**: chess.com paywalls it, Lichess keeps it minimal. Owlchess wins by being the improvement
companion that works with **both** sites at once:

> Play anywhere. Get better on Owlchess.

Everything below serves that: understand your games, train your weaknesses, track progress —
free, private and fast.

---

## 1. A review that beats chess.com's

| Idea | Why it wins | Effort | Server |
|---|---|---|---|
| **Name the idea, not just the move.** Detect motifs — fork, pin, skewer, discovered attack, overload, back-rank, trapped piece, removal of the defender, zwischenzug — and say "you missed a knight fork on e6", not just "best was Ne6" | chess.com's coach is often generic; this teaches patterns | M | ✗ |
| **"What was my opponent threatening?"** before each mistake, shown automatically | Most blunders come from missing a threat | S | ✗ |
| **Human-likely moves** (Maia-style models): "a 1600 player usually plays X here, the engine wants Y" | Separates "engine-only" moves from mistakes a human should avoid | L | ✗ (model in browser) |
| **Practical grading with the clock**: use `%clk` to judge moves in context ("fine for 3 seconds left") and flag where time was wasted | Bullet/blitz players care; nobody grades time use well | M | ✗ |
| **Turning-points timeline**: the 3–5 moments that decided the game, each explained in a sentence | Faster than scrolling a move list | S | ✗ |
| **Win / draw / loss bar + "sharpness"** from Stockfish's WDL output | Clearer than a single eval number | S | ✗ |
| **Retry inline**: at each mistake, "try again" without leaving the review | chess.com paywalls this | S | ✗ |
| **Theory check**: "you left book at move 9; masters play Bb5 here" | Turns every game into opening study | S | ✗ (with Lichess token) |
| **Perfect endgame verdicts** from tablebases (Lichess tablebase API) | "This was a theoretical draw you lost" | S | ✗ |
| **Plain-English plans**: recognise pawn structures (isolated pawn, minority attack, opposite-side castling) and explain the usual plans | Strategic understanding, not just tactics | L | ✗ |
| **Shareable review card**: one image or link with accuracy, the brilliant move and the key blunder | Free marketing every time someone shares | S | ✗ (image) / ✓ (link) |
| **Optional AI coach** (bring your own key, or Plus): a conversational explanation grounded in the engine's lines | Matches Chessiro/DecodeChess-style explanations | M | ✓ or BYO key |

---

## 2. Training built from *your* games

| Idea | Why it wins | Effort | Server |
|---|---|---|---|
| **Spaced repetition of your mistakes** (SM-2 scheduling) instead of a fixed daily set | Mistakes come back until they stick — like Anki for your chess | S | ✗ |
| **Themed puzzle packs from the Lichess puzzle database** (CC0, millions of puzzles), matched to your weak themes from Insights | Unlimited personalised puzzles, free | M | ✗ (bundle a subset) |
| **Repertoire builder + trainer**: build lines, drill them with spaced repetition, and get "you left your prep here" alerts from your real games | ChessTempo/Chessable-level feature, free | L | ✗ |
| **Endgame trainer**: key positions (Lucena, Philidor, K+P) played against tablebase-perfect defence | Endgames are where club players bleed points | M | ✗ |
| **Weekly plan**: generated from Insights — "this week: 20 fork puzzles, 2 rook endgames, review 3 losses" | Turns stats into action | S | ✗ |
| **Guess-the-move** through famous games and your own wins | Calculation practice | S | ✗ |
| **Visualisation**: blindfold mode, coordinate trainer, "count the attackers" drills | Cheap to build, popular | S | ✗ |
| **Time-management drills**: positions where you overthought — solve them in 10 seconds | Unique for bullet/blitz players | M | ✗ |

---

## 3. Insights that beat paid analytics

| Idea | Why it wins | Effort | Server |
|---|---|---|---|
| **One profile across chess.com + Lichess + over-the-board** | Neither site can show your whole chess life | S | ✗ |
| **Opponent scouting**: enter a username → their openings, weak phases, typical mistakes | Prep for club matches and tournaments | M | ✗ |
| **Tilt & habit detection**: results after a loss, by time of day, by session length | Practical, motivating, rarely offered | S | ✗ |
| **Progress reports** (weekly/monthly) with goals ("blunders per game below 1.0") | Keeps people coming back | S | ✗ |
| **Accuracy by move number, opponent strength, "game shapes"** | Deeper than chess.com Insights | M | ✗ |
| **"Compared with players at your rating"** (anonymous, opt-in aggregates) | Context for your numbers | M | ✓ |

---

## 4. Playing — carefully

Don't build a matchmaking site (anti-cheat, servers, empty lobbies). Instead:

| Idea | Why it wins | Effort | Server |
|---|---|---|---|
| **Play from any position vs the engine** (adjustable strength, takebacks, hints) | Practise the exact positions you got wrong | S | ✗ |
| **Human-like bots at set ratings** (Maia-style) with personalities | Realistic sparring partners, free | M | ✗ |
| **Over-the-board import**: photo of a scoresheet or board → PGN/FEN | Club and tournament players' biggest gap | L | ✓ (ML) or on-device model |

**Fair-play rule:** never help with a game in progress. Only review finished games; reject
positions from ongoing games where possible. This protects users and the project's reputation.

---

## 5. Community — later, needs a backend

| Idea | Effort | Server |
|---|---|---|
| Share a review by link; comment on a friend's game | M | ✓ |
| Coach ↔ student mode: coaches see students' reviews and assign drills | L | ✓ |
| Clubs: shared study collections, drill leaderboards | L | ✓ |
| Studies (chapters, comments, arrows) — start as local files, sync later | M | ✗ → ✓ |
| Public profiles with accuracy trends (opt-in) | M | ✓ |

---

## 6. Platform & speed

| Idea | Why it wins | Effort | Server |
|---|---|---|---|
| **Installable app (PWA) with offline mode** | App feel without store fees | S | ✗ |
| **Desktop app (Tauri) with native multi-threaded Stockfish** | Native engines are far faster than browser WASM → near-instant reviews, the closest thing to chess.com's servers | M | ✗ |
| **Browser extension**: "Review in Owlchess" button on finished chess.com/Lichess games | Best acquisition channel there is — meets players where they play | M | ✗ |
| **Optional cloud review** for phones and old laptops | Fast everywhere | M | ✓ |
| **Mobile apps** (wrap the web app) | Where most casual players are | M | ✗ |
| **Accessibility**: screen-reader move announcements, colour-blind palettes, larger text mode | Underserved players notice | S | ✗ |
| **Languages**: Spanish, Hindi, Portuguese, Russian, French first | Chess is global; few improvement tools are | M | ✗ |

---

## 7. Trust & quality (what makes people stay)

- **"How we rate moves" page**: the expected-points bands, accuracy calibration results and known
  limits, in plain language. Transparency is a feature chess.com doesn't offer.
- **Same game → same numbers, every time** (deterministic reviews, versioned rating model).
- **Privacy you can verify**: open source, no trackers, "your games never leave this device".
- **Fast feedback loop**: public roadmap, "you asked, we built" changelog.

---

## 8. What to build first (highest impact for the effort)

1. **Retry inline + spaced repetition of mistakes** (S) — turns reviews into training.
2. **Motif names in the coach** — fork/pin/hanging/back-rank (M) — the "aha" feature.
3. **Threat display before mistakes + turning-points timeline** (S) — clearer reviews.
4. **Shareable review card** (S) — free growth.
5. **Browser extension "Review in Owlchess"** (M) — acquisition.
6. **PWA + offline** (S) — app feel.
7. **Puzzle packs from the Lichess database, matched to your weaknesses** (M).
8. **Opponent scouting** (M) — tournament players will share it.
9. **Play-from-position vs engine** (S).
10. **Desktop app with native Stockfish** (M) — speed parity with chess.com.

---

## 9. What *not* to do

- Don't build a live playing site with matchmaking — that's chess.com's and Lichess's fortress.
- Don't paywall anything that runs on the user's device.
- Don't copy chess.com's branding, wording or assets; be recognisably your own.
- Don't add features nobody asked for before launch — let the feedback tally decide.
- Never assist games in progress.

---

## 10. Data & licensing notes for these ideas

- **Lichess puzzle database and chess-openings** are CC0 — free to bundle.
- **Lichess APIs** (games, explorer, tablebase) are free but rate-limited; the explorer needs a
  personal token.
- **Maia-style human-move models**: check the licence of any weights before shipping them.
- **Stockfish** is GPLv3 — keep it a separate component and link its source, in every edition
  (web, desktop, mobile).
