/**
 * A small opening book: named mainline sequences in SAN, space separated.
 * A played sequence counts as "book" while it is a prefix of (or equal to) one of
 * these lines; `openingName` picks the tightest matching line for display.
 */
export const OPENING_LINES: { name: string; san: string }[] = [
  // Generic branches (short, so early plies get a sensible name)
  { name: 'Open Game', san: 'e4 e5' },
  { name: 'Sicilian Defence', san: 'e4 c5' },
  { name: 'French Defence', san: 'e4 e6' },
  { name: 'Caro-Kann Defence', san: 'e4 c6' },
  { name: 'Scandinavian Defence', san: 'e4 d5' },
  { name: 'Pirc Defence', san: 'e4 d6' },
  { name: 'Modern Defence', san: 'e4 g6' },
  { name: 'Alekhine Defence', san: 'e4 Nf6' },
  { name: "King's Pawn Game", san: 'e4' },
  { name: 'Closed Game', san: 'd4 d5' },
  { name: 'Indian Defence', san: 'd4 Nf6' },
  { name: 'Dutch Defence', san: 'd4 f5' },
  { name: 'Englund Gambit', san: 'd4 e5' },
  { name: "Queen's Pawn Game", san: 'd4' },
  { name: 'English Opening', san: 'c4' },
  { name: 'Réti Opening', san: 'Nf3' },
  { name: "King's Fianchetto Opening", san: 'g3' },
  { name: 'Nimzo-Larsen Attack', san: 'b3' },
  { name: 'Bird Opening', san: 'f4' },
  { name: 'Grob Attack', san: 'g4' },
  { name: 'Polish (Sokolsky) Opening', san: 'b4' },

  // 1.e4 e5 family
  { name: 'Ruy Lopez: Morphy Defence', san: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7' },
  { name: 'Ruy Lopez: Open Variation', san: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5' },
  { name: 'Italian Game', san: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O' },
  { name: 'Italian Game: Giuoco Pianissimo', san: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6' },
  { name: 'Scotch Game', san: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7' },
  { name: 'Four Knights Game', san: 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O' },
  { name: 'Petrov Defence', san: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Be7' },
  { name: 'Philidor Defence', san: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6' },
  { name: 'Vienna Game', san: 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Bg4' },
  { name: "King's Gambit", san: 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ng5 h6 Nxf7' },
  { name: "Bishop's Opening", san: 'e4 e5 Bc4 Nf6 d3 c6 Nf3 d5 exd5 cxd5 Bb5+' },
  { name: 'Centre Game', san: 'e4 e5 d4 exd4 Qxd4 Nc6 Qe3 Nf6 Nc3 Bb4' },
  { name: "King's Indian Attack", san: 'e4 e5 Nf3 Nc6 g3 d5 exd5 Nxd5 Bg2 Nb6 O-O Be7' },
  { name: 'Danish Gambit', san: 'e4 e5 d4 exd4 c3 dxc3 Bc4 cxb2 Bxb2' },
  { name: "Wayward Queen Attack", san: 'e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#' },
  { name: 'Fool’s Mate Setup (Napoleon Attack)', san: 'e4 e5 Bc4 Bc5 Qh5 Nf6 Qxf7#' },
  { name: 'Fried Liver Attack', san: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2 Rf1 Qxe4+' },
  { name: 'Ponziani Opening', san: 'e4 e5 Nf3 Nc6 c3 Nf6 d4 exd4 cxd4 Bb4+' },

  // Sicilian
  { name: 'Sicilian: Najdorf', san: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be7' },
  { name: 'Sicilian: English Attack', san: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 f3 e5 Qd2 Be7' },
  { name: 'Sicilian: Dragon', san: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6' },
  { name: 'Sicilian: Sveshnikov', san: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6' },
  { name: 'Sicilian: Taimanov', san: 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be3 a6' },
  { name: 'Sicilian: Moscow Variation', san: 'e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7 O-O Nf6 Qe2 e6' },
  { name: 'Sicilian: Closed', san: 'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6 Be3 Rb8' },
  { name: 'Sicilian: Alapin', san: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 e6 cxd4 Bb4+' },
  { name: 'Sicilian: Smith-Morra', san: 'e4 c5 Nf3 Nc6 b4 cxb4 a3 bxa3 Nxa3 d6 d4 Nf6' },
  { name: 'Sicilian: O’Kelly', san: 'e4 c5 Nf3 a6' },

  // French / Caro-Kann / semi-open
  { name: 'French: Steinitz', san: 'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5 Nf3 Nc6 Be3' },
  { name: 'French: Tarrasch', san: 'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6 Ne2' },
  { name: 'French: Exchange', san: 'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 c4 c6 Nc3 Be7' },
  { name: 'Caro-Kann: Advance', san: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Nc6' },
  { name: 'Caro-Kann: Classical', san: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf4' },
  { name: 'Caro-Kann: Exchange', san: 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Bb4' },
  { name: 'Caro-Kann: Two Knights', san: 'e4 c6 Nc3 d5 Nf3 Nf6 e5 Ne4 Nxe4 dxe4 Qe2' },
  { name: 'Scandinavian: Modern', san: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5' },
  { name: 'Scandinavian: Iceland Gambit', san: 'e4 d5 exd5 Nf6 c4 c6 d4 cxd5 Nf3 Nxd5 Nc3 Nc6' },
  { name: 'Alekhine Defence', san: 'e4 Nf6 e5 Nd5 d4 d6 Nf3 dxe5 Nxe5 c6 Be2 Bf5' },
  { name: 'Pirc Defence', san: 'e4 g6 d4 Bg7 Nc3 d6 f4 Nf6 Nf3 O-O Be2 Nc6' },
  { name: 'Modern Defence', san: 'e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3 b5' },

  // Queen's pawn openings
  { name: "Queen's Gambit Declined", san: 'd4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bg5 O-O e3 h6 Bh4' },
  { name: "Queen's Gambit Declined: Ragozin", san: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6' },
  { name: 'Slav Defence', san: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5' },
  { name: 'Slav: Main Line', san: 'd4 d5 c4 c6 Nf3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4' },
  { name: "Queen's Gambit Accepted", san: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6' },
  { name: 'Semi-Slav', san: 'd4 d5 c4 e6 Nc3 Nf6 Nf3 d5 Bg5 Be7 e3 c6 Nf3 O-O' },
  { name: 'Catalan Opening', san: 'd4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O Nc3 d5' },
  { name: "King's Indian Defence", san: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5' },
  { name: 'Grünfeld Defence', san: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Bc4 c5' },
  { name: 'Nimzo-Indian Defence', san: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6' },
  { name: "Queen's Indian Defence", san: 'd4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O Nc3 d5' },
  { name: 'Bogo-Indian Defence', san: 'd4 Nf6 c4 e6 Nf3 Bb4 Bd3 O-O' },
  { name: 'London System', san: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O' },
  { name: 'Torre Attack', san: 'd4 d5 Nf3 Nf6 Bf4 e6 e3 Bd6 Bg5 O-O Nbd2 Nbd7' },
  { name: 'Catalan: Open Defence', san: 'd4 d5 Nf3 Nf6 c4 e6 g3 Be7 Bg2 O-O O-O dxc4 Qc2 a6' },
  { name: 'Dutch Defence: Classical', san: 'd4 f5 g3 Nf6 Bg2 e6 Nf3 d5 O-O Bd6 c4 c6' },
  { name: 'Dutch Defence: Stonewall', san: 'd4 e6 c4 f5 g3 Nf6 Bg2 d5 O-O Bd6 Nc3 c6' },
  { name: 'Trompowsky Attack', san: 'd4 Nf6 Bg5 e6 e3 Be7 Nf3 O-O' },
  { name: 'Budapest Gambit', san: 'd4 Nf6 c4 e5 dxe5 Ng4' },
  { name: "King's Indian: Sämisch", san: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be2 e5 d5' },

  // English / Réti / flank
  { name: 'English: Reversed Sicilian', san: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7' },
  { name: 'English: Symmetrical', san: 'c4 c5 Nf3 Nf6 g3 b6 Bg2 Bb7 O-O e6 Nc3 Be7' },
  { name: 'English: Four Knights', san: 'c4 Nf6 Nc3 e6 Nf3 d5 d4 Be7 Bg5 h6 Bh4 O-O e3 b6' },
  { name: 'English: Mikenas-Carls', san: 'c4 Nf6 Nc3 e6 e4 d5 cxd5 exd5 e5 Ne4' },
  { name: 'Réti: Advance', san: 'Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O b3 c5' },
  { name: 'Réti: King’s Indian Attack', san: 'Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d3 O-O Nbd2 c5' },

  // Misc classics
  { name: 'Scotch: Four Knights', san: 'e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4 Nxd4 Bb4 Nxc6 bxc6 Qd4' },
  { name: 'Ruy Lopez: Berlin', san: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5' },
  { name: 'Ruy Lopez: Exchange', san: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d3 Bc5 Nc3' },
  { name: 'Ruy Lopez: Closed, Anti-Marshall', san: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3' },
  { name: 'Four Knights: Spanish', san: 'e4 e5 Nf3 Nf6 Nc3 Nc6 Bb5 Bb4 O-O O-O d3 d6' },
  { name: 'Evans Gambit', san: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4' },
  { name: 'Two Knights Defence', san: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5' },
  { name: 'Italian: Evans Deferred', san: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O a6' },
  { name: 'Sicilian: Grand Prix Attack', san: 'e4 c5 Nc3 Nc6 f4 g6 Nf3 Bg7 Bc4 e6 O-O Nge7' },
  { name: 'French: Winawer', san: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7' },
  { name: 'French: Classical', san: 'e4 e6 d4 d5 Nf3 Nf6 e5 Nfd7 Be2 c5 c3 Nc6' },
  { name: 'Queen’s Gambit: Exchange Slav', san: 'd4 d5 c4 c6 cxd5 cxd5 Nf3 Nf6 Nc3 e6 e3 Nbd7' },
  { name: 'Vienna: Frankenstein-Dracula', san: 'e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nd6 Bb3 Nc6 Nb5' },
]

function buildPrefixes(): Map<string, string> {
  const map = new Map<string, string>()
  // Shortest lines first so bare prefixes (e.g. 'e4') get the generic name.
  const sorted = [...OPENING_LINES].sort((a, b) => a.san.length - b.san.length)
  for (const { name, san } of sorted) {
    const parts = san.split(' ')
    let acc = ''
    for (const p of parts) {
      acc = acc ? `${acc} ${p}` : p
      if (!map.has(acc)) map.set(acc, name)
    }
  }
  return map
}

const prefixMap = buildPrefixes()

/** Name of the longest book prefix of the played SAN sequence, if any. */
export function openingName(sans: string[]): string | null {
  if (sans.length === 0) return null
  const maxLen = Math.max(...OPENING_LINES.map((l) => l.san.split(' ').length))
  for (let k = Math.min(sans.length, maxLen); k > 0; k--) {
    const name = prefixMap.get(sans.slice(0, k).join(' '))
    if (name) return name
  }
  return null
}
