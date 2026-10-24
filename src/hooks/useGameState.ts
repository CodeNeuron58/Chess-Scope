import { useCallback, useMemo, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import type { PlayerInfo } from '../types'
import { headersOf } from '../lib/chessUtils'

function freshGame(): Chess {
  return new Chess()
}

export interface GameState {
  gameRef: React.RefObject<Chess>
  moves: Move[]
  ply: number
  setPly: React.Dispatch<React.SetStateAction<number>>
  players: PlayerInfo
  fens: string[]
  syncFromGame: (g: Chess, newPly?: number) => void
  /** Apply a move to the current game (caller guards reviewing/drill modes). */
  makeMove: (from: string, to: string, promotion?: string, currentPly?: number) => boolean
  loadPgn: (text: string, atPly?: number) => string | null
  resetBoard: () => void
}

/** Board + move state: the single owner of the chess.js game instance. */
export function useGameState(): GameState {
  const gameRef = useRef<Chess>(freshGame())
  const [moves, setMoves] = useState<Move[]>([])
  const [ply, setPly] = useState(0)
  const [players, setPlayers] = useState<PlayerInfo>({ white: 'White', black: 'Black' })

  const fens = useMemo(() => {
    const board = new Chess()
    const list = [board.fen()]
    for (const m of moves) {
      board.move({ from: m.from, to: m.to, promotion: m.promotion })
      list.push(board.fen())
    }
    return list
  }, [moves])

  const syncFromGame = useCallback((g: Chess, newPly?: number) => {
    setMoves(g.history({ verbose: true }) as Move[])
    setPlayers(headersOf(g))
    if (newPly !== undefined) setPly(newPly)
  }, [])

  const makeMove = useCallback(
    (from: string, to: string, promotion?: string, currentPly?: number): boolean => {
      const atPly = currentPly ?? ply
      let g = gameRef.current
      try {
        if (atPly < moves.length) {
          const rebuilt = new Chess()
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
    [ply, moves, syncFromGame],
  )

  const loadPgn = useCallback(
    (text: string, atPly = 0): string | null => {
      try {
        const g = new Chess()
        g.loadPgn(text.trim())
        gameRef.current = g
        syncFromGame(g, atPly)
        return null
      } catch (e) {
        return `Could not load PGN: ${e instanceof Error ? e.message : String(e)}`
      }
    },
    [syncFromGame],
  )

  const resetBoard = useCallback(() => {
    gameRef.current = freshGame()
    syncFromGame(gameRef.current, 0)
  }, [syncFromGame])

  return { gameRef, moves, ply, setPly, players, fens, syncFromGame, makeMove, loadPgn, resetBoard }
}
