import type { Classification, MoveReview, PlayerInfo } from '../types'

const NAGS: Partial<Record<Classification, string>> = {
  brilliant: '$3',
  great: '$1',
  forced: '$7',
  inaccuracy: '$4',
  mistake: '$2',
  miss: '$2',
  blunder: '$6',
}

function wrap(tokens: string[], width = 78): string {
  const lines: string[] = []
  let cur = ''
  for (const t of tokens) {
    if (cur.length + t.length + 1 > width) {
      lines.push(cur)
      cur = t
    } else {
      cur = cur ? `${cur} ${t}` : t
    }
  }
  if (cur) lines.push(cur)
  return lines.join('\n')
}

/** PGN with classification glyphs as standard NAGs, portable to ChessBase/Lichess. */
export function buildReviewedPgn(
  moves: MoveReview[],
  players: PlayerInfo,
  result: string,
  fen?: string,
): string {
  const headers = [
    `[Event "Owlchess Game Review"]`,
    `[White "${players.white}"]`,
    `[Black "${players.black}"]`,
    `[Result "${result}"]`,
  ]
  if (fen && fen !== 'rnbqkbnr/pppppppp/8/8/8/8/8/RNBQKBNR w - - 0 1') {
    headers.push(`[SetUp "1"]`, `[FEN "${fen}"]`)
  }
  const tokens: string[] = []
  moves.forEach((mr, idx) => {
    const ply = mr.ply ?? idx + 1
    if (mr.move.color === 'w') tokens.push(`${Math.ceil(ply / 2)}.`)
    else if (ply === 1) tokens.push('1...')
    const nag = NAGS[mr.classification]
    tokens.push(nag ? `${mr.move.san} ${nag}` : mr.move.san)
  })
  tokens.push(result)
  return `${headers.join('\n')}\n\n${wrap(tokens)}`
}
