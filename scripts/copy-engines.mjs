/**
 * Copies the Stockfish WASM builds + NNUE nets from the npm packages into
 * public/engines/. Runs on postinstall so the large engine binaries never
 * need to be committed to git.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dest = join(root, 'public', 'engines')
mkdirSync(dest, { recursive: true })

const files = [
  ['stockfish19', 'bin/stockfish-19-single.js'],
  ['stockfish19', 'bin/stockfish-19-single.wasm'],
  ['stockfish19', 'bin/stockfish-19-lite-single.js'],
  ['stockfish19', 'bin/stockfish-19-lite-single.wasm'],
  ['stockfish16', 'src/stockfish-nnue-16-single.js'],
  ['stockfish16', 'src/stockfish-nnue-16-single.wasm'],
  ['stockfish16', 'src/nn-5af11540bbfe.nnue'],
]

let copied = 0
for (const [pkg, rel] of files) {
  const src = join(root, 'node_modules', pkg, rel)
  const name = rel.split('/').pop()
  const target = join(dest, name)
  if (existsSync(target) && !existsSync(src)) {
    console.log(`skip ${name} (source missing, already present)`)
    continue
  }
  if (!existsSync(src)) {
    console.warn(`warn: ${pkg}/${rel} not found — run: npm install ${pkg}`)
    continue
  }
  copyFileSync(src, target)
  copied++
}
console.log(`engines ready in public/engines (${copied} files copied)`)
