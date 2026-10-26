import type { MoveReview, PlyReview } from '../types'
import { formatEval, cpFor } from './accuracy'

const PIECE_NAMES: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

export const FUN_FACTS: string[] = [
  'The longest recorded chess game lasted 269 moves and ended in a draw.',
  'The word "checkmate" comes from the Persian "shah mat" — the king is helpless.',
  'A queen and rook coordinated on the 7th rank is often called "cook mating".',
  'The shortest possible chess game ends in just 4 moves by fool\'s mate.',
  'Chess clocks were introduced in the 1880s — before that, games could last for hours.',
  'The en passant capture is over 500 years old.',
  'Deep Blue beat Garry Kasparov in 1997 — the first engine win against a world champion.',
  'There are more possible chess positions than atoms in the observable universe.',
  'Castling is the only move where two pieces move at once.',
  'The folding chessboard was invented to keep knights from wandering off mid-game.',
]

function pick<T>(variants: T[], seed: number): T {
  return variants[Math.abs(seed) % variants.length]
}

function moverName(color: 'w' | 'b'): string {
  return color === 'w' ? 'White' : 'Black'
}

interface SpeechInput {
  review: MoveReview
  before: PlyReview
  after: PlyReview
  bestSan?: string
  bestLine?: string
}

export function coachSpeech(input: SpeechInput): string {
  const { review, after, bestSan } = input
  const { move, classification, ply } = review
  const san = move.san
  const piece = PIECE_NAMES[move.piece] ?? 'piece'
  const captured = move.captured ? PIECE_NAMES[move.captured] : null
  const isMate = san.includes('#')
  const isCheck = san.includes('+')
  const isCastle = move.flags.includes('k') || move.flags.includes('q')
  const isPromo = move.flags.includes('p')
  const mover = move.color
  const evalNow = formatEval(after.whiteCp, after.mateIn)

  let base: string
  switch (classification) {
    case 'book':
      base = pick(
        [
          `Straight from the books — theory approves of ${san}.`,
          `Everyone knows this one. ${san} is standard opening theory.`,
          `A well-trodden path. The opening books nod along.`,
        ],
        ply,
      )
      break
    case 'brilliant':
      base = pick(
        [
          `A sacrifice! Giving up the ${piece} for the initiative — the engine loves it.`,
          `Brilliant!! Material means nothing when the attack is this strong.`,
          `Wow — dropping the ${piece} on purpose, and it completely works.`,
        ],
        ply,
      )
      break
    case 'great':
      base = pick(
        [
          `A critical find! ${san} changes the course of the game.`,
          `The one move that keeps everything together. Well spotted.`,
          `Second-best here was much worse — ${san} is the whole point of the position.`,
        ],
        ply,
      )
      break
    case 'best':
      base = pick(
        [
          `Top choice — ${san} is exactly what the engine wanted.`,
          `Best move on the board. Nothing to improve.`,
          `Clean and precise. ${san} keeps maximum pressure.`,
        ],
        ply,
      )
      break
    case 'excellent':
      base = pick(
        [
          `Strong move — practically as good as the engine's first line.`,
          `${san} keeps everything under control.`,
          `Excellent choice, right in line with the top engines.`,
        ],
        ply,
      )
      break
    case 'good':
      base = pick(
        [
          `A decent move, though ${bestSan ?? 'another path'} had a little more to offer.`,
          `Playable — but the engine liked ${bestSan ?? 'something else'} slightly better.`,
          `Fine move. It keeps the balance without gaining ground.`,
        ],
        ply,
      )
      break
    case 'inaccuracy':
      base = pick(
        [
          `A small concession. ${bestSan ?? 'The top move'} kept more of the edge.`,
          `Slightly imprecise — the evaluation drifts a little.`,
          `Hmm, that lets some of the advantage slip. ${bestSan ?? 'The best move'} was stronger.`,
        ],
        ply,
      )
      break
    case 'mistake':
      base = pick(
        [
          `A real misstep — the evaluation swings the other way. ${bestSan ?? 'The top move'} was the way forward.`,
          `That hands back too much. ${bestSan ?? 'The engine move'} was necessary.`,
          `Careful — that seriously worsens the position. ${bestSan ?? 'Another move'} held firm.`,
        ],
        ply,
      )
      break
    case 'blunder':
      base = pick(
        [
          `That drops real material — ${bestSan ?? 'the top move'} was essential here.`,
          `Ouch! The evaluation collapses after ${san}. ${bestSan ?? 'The best move'} had to be played.`,
          `This seriously changes the game. ${bestSan ?? 'The engine line'} was the only way to hold.`,
        ],
        ply,
      )
      break
    case 'miss':
      base = pick(
        [
          `There was more here — a winning chance slipped away.`,
          `You had bigger fish to catch in this position.`,
          `The chance to pull ahead just walked past. Keep an eye out!`,
        ],
        ply,
      )
      break
    case 'forced':
      base = `Only legal move — nothing to think about here.`
      break
  }

  const notes: string[] = []
  if (isMate) return `Checkmate! ${moverName(mover)} ends it in style. Game over.`
  if (isCastle) return `Castling to safety — the king tucks away and the rook joins the game.`
  if (isPromo) return `Promotion! A brand new ${PIECE_NAMES[move.promotion ?? 'q']} enters the battle. ${base}`
  if (captured && classification !== 'book') {
    notes.push(`Takes the ${captured}.`)
  }
  if (isCheck) notes.push('With check!')
  if (classification === 'brilliant' || classification === 'great') {
    notes.push(`Evaluation now ${evalNow}.`)
  }
  return [base, ...notes].join(' ')
}

export function coachExplain({ review, before, after, bestSan, bestLine }: SpeechInput): string {
  const mover = review.move.color
  const beforeCp = cpFor(before.whiteCp, mover)
  const afterCp = cpFor(after.whiteCp, mover)
  const shift = afterCp - beforeCp
  const shiftText =
    Math.abs(shift) < 25
      ? 'The evaluation barely moved.'
      : shift > 0
        ? `The evaluation improved by about ${(shift / 100).toFixed(1)} pawns from your side.`
        : `The evaluation dropped by about ${(Math.abs(shift) / 100).toFixed(1)} pawns from your side.`
  const parts = [
    `You played ${review.move.san}, which the review rates as "${review.classification}".`,
    shiftText,
  ]
  if (bestSan && bestSan !== review.move.san) {
    parts.push(`The engine preferred ${bestSan}, following ${bestLine}.`)
  } else if (bestLine) {
    parts.push(`The engine's main line continues ${bestLine}.`)
  }
  if (review.materialDelta <= -1.75) {
    parts.push(`Note the sacrifice — about ${Math.abs(review.materialDelta).toFixed(1)} pawns of material invested for long-term compensation.`)
  }
  return parts.join(' ')
}

export function funFactFor(step: number): string {
  return pick(FUN_FACTS, step)
}
