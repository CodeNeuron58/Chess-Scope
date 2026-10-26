import { useCallback, useMemo, useRef, useState } from 'react'
import { Chess, DEFAULT_POSITION, type Move } from 'chess.js'
import type { PlayerInfo } from '../types'
import { headersOf } from '../lib/chessUtils'

export interface GameState {
  gameRef: React.RefObject<Chess>
  moves: Move[]
  ply: number
  setPly: React.Dispatch<React.SetStateAction<number>>
  players: PlayerInfo
  /** PGN headers of the loaded game (empty for a fresh board). */
  headers: Record<string, string>
  /** Position the game starts from (standard start unless loaded from a FEN). */
  startFen: string
  fens: string[]
  syncFromGame: (g: Chess, newPly?: number) => void
  /** Apply a move at the current ply; later moves are cut, like an analysis board. */
  makeMove: (from: string, to: string, promotion?: string, currentPly?: number) => boolean
  loadPgn: (text: string, atPly?: number) => string | null
  loadFen: (fen: string) => string | null
  resetBoard: () => void
  pgn: () => string
}

/** Board + move state: the single owner of the chess.js game instance. */
export function useGameState(): GameState {
  const gameRef = useRef<Chess>(new Chess())
  const [moves, setMoves] = useState<Move[]>([])
  const [ply, setPly] = useState(0)
  const [players, setPlayers] = useState<PlayerInfo>({ white: 'White', black: 'Black' })
  const [headers, setHeaders] = useState<Record<string, string>>({})
  const [startFen, setStartFen] = useState(DEFAULT_POSITION)

  const fens = useMemo(() => {
    const board = new Chess(startFen)
    const list = [board.fen()]
    for (const m of moves) {
      board.move({ from: m.from, to: m.to, promotion: m.promotion })
      list.push(board.fen())
    }
    return list
  }, [moves, startFen])

  const syncFromGame = useCallback((g: Chess, newPly?: number) => {
    const h = g.getHeaders()
    setMoves(g.history({ verbose: true }) as Move[])
    setPlayers(headersOf(g))
    setHeaders(h)
    setStartFen(h.FEN ?? DEFAULT_POSITION)
    if (newPly !== undefined) setPly(newPly)
  }, [])

  const makeMove = useCallback(
    (from: string, to: string, promotion?: string, currentPly?: number): boolean => {
      const atPly = currentPly ?? ply
      let g = gameRef.current
      try {
        if (atPly < moves.length) {
          const rebuilt = new Chess(startFen)
          if (startFen !== DEFAULT_POSITION) {
            rebuilt.setHeader('SetUp', '1')
            rebuilt.setHeader('FEN', startFen)
          }
          for (let i = 0; i < atPly; i++) {
            rebuilt.move({ from: moves[i].from, to: moves[i].to, promotion: moves[i].promotion })
          }
          g = rebuilt
          gameRef.current = g
        }
        g.move({ from, to, promotion })
        const newPly = (atPly < moves.length ? atPly : moves.length) + 1
        syncFromGame(g, newPly)
        return true
      } catch {
        return false
      }
    },
    [ply, moves, startFen, syncFromGame],
  )

  const loadPgn = useCallback(
    (text: string, atPly = 0): string | null => {
      try {
        const g = new Chess()
        g.loadPgn(text.trim())
        gameRef.current = g
        syncFromGame(g, Math.min(atPly, g.history().length))
        return null
      } catch (e) {
        return `Could not read that PGN: ${e instanceof Error ? e.message : String(e)}`
      }
    },
    [syncFromGame],
  )

  const loadFen = useCallback(
    (fen: string): string | null => {
      try {
        const g = new Chess(fen.trim())
        if (g.fen() !== DEFAULT_POSITION) {
          g.setHeader('SetUp', '1')
          g.setHeader('FEN', g.fen())
        }
        gameRef.current = g
        syncFromGame(g, 0)
        return null
      } catch (e) {
        return `That FEN is not valid: ${e instanceof Error ? e.message : String(e)}`
      }
    },
    [syncFromGame],
  )

  const resetBoard = useCallback(() => {
    gameRef.current = new Chess()
    syncFromGame(gameRef.current, 0)
  }, [syncFromGame])

  const pgn = useCallback(() => gameRef.current.pgn(), [])

  return { gameRef, moves, ply, setPly, players, headers, startFen, fens, syncFromGame, makeMove, loadPgn, loadFen, resetBoard, pgn }
}
