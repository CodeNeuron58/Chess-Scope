/**
 * Builds src/analysis/openingBook.json from the Lichess chess-openings dataset
 * (scripts/openings/*.tsv, CC0 — https://github.com/lichess-org/chess-openings).
 *
 * Every position reached by a named line is "book". Positions are keyed by an
 * FNV-1a hash of placement + side to move + castling rights, so transpositions
 * match. Named positions point at their [ECO, name]; intermediate ones get -1.
 *
 * Run: node scripts/build-openings.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

function fnv1a(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function positionKey(fen) {
  return fnv1a(fen.split(' ').slice(0, 3).join(' '))
}

const names = []
const book = new Map()
let lines = 0
for (const vol of ['a', 'b', 'c', 'd', 'e']) {
  const rows = readFileSync(join(root, 'scripts', 'openings', `${vol}.tsv`), 'utf8').trim().split('\n').slice(1)
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t')
    const chess = new Chess()
    try {
      chess.loadPgn(pgn)
    } catch {
      console.warn(`skip ${eco} ${name}`)
      continue
    }
    const history = chess.history({ verbose: true })
    history.forEach((m, i) => {
      const key = positionKey(m.after)
      const last = i === history.length - 1
      if (last) {
        const idx = names.push([eco, name]) - 1
        // a position named by several lines keeps its shortest (first) name
        if (book.get(key) === undefined || book.get(key) === -1) book.set(key, idx)
      } else if (!book.has(key)) {
        book.set(key, -1)
      }
    })
    lines++
  }
}

const out = { names, book: Object.fromEntries(book) }
writeFileSync(join(root, 'src', 'analysis', 'openingBook.json'), JSON.stringify(out))
console.log(`${lines} lines, ${names.length} names, ${book.size} book positions`)
