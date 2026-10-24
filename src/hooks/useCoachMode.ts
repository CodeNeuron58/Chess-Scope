import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Square } from 'chess.js'
import type { Move, ReviewResult } from '../types'
import { PALETTE } from '../lib/constants'
import { uciToSquares } from '../lib/chessUtils'
import { findForkTargets, findLostPiece, findMatingLine } from '../analysis/patterns'

export type CoachView = 'speech' | 'explain' | 'alternative'

export interface CoachPatterns {
  fork: boolean
  lost: boolean
  mate: boolean
}

export interface RevealMarkers {
  arrows: [Square, Square, string?][]
  style: Record<string, { boxShadow: string }> | null
}

interface Deps {
  ply: number
  setPly: (p: number) => void
  moves: Move[]
  review: ReviewResult | null
  audioOn: boolean
  onExit?: () => void
}

/**
 * Interactive coach mode: move-by-move walkthrough with reveal overlays
 * (fork / lost piece / mating line) computed from the stored review.
 */
export function useCoachMode({ ply, setPly, moves, review, audioOn }: Deps): CoachState {
  const [coachMode, setCoachMode] = useState(false)
  const [coachView, setCoachView] = useState<CoachView>('speech')
  const [reveal, setReveal] = useState<'fork' | 'lost' | 'mate' | null>(null)

  const speak = useCallback(
    (text: string) => {
      if (!audioOn || !('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.02
      window.speechSynthesis.speak(utterance)
    },
    [audioOn],
  )

  // narrate each move while walking through the game
  useEffect(() => {
    if (!coachMode || !review || ply === 0) return
    const mr = review.moves[ply - 1]
    if (mr) speak(mr.speech)
  }, [coachMode, ply]) // eslint-disable-line react-hooks/exhaustive-deps

  const startCoach = useCallback(() => {
    setCoachMode(true)
    setCoachView('speech')
    setPly(0)
  }, [setPly])

  const exitCoach = useCallback(() => {
    setCoachMode(false)
    setCoachView('speech')
  }, [])

  const patterns = useMemo<CoachPatterns>(() => {
    if (!review || ply === 0 || ply > moves.length) return { fork: false, lost: false, mate: false }
    const before = review.positions[ply - 1]
    const after = review.positions[ply]
    const mr = review.moves[ply - 1]
    return {
      fork: !!before.bestUci && !!findForkTargets(before.fen, before.bestUci),
      lost: !!findLostPiece(after.fen, mr.move.to, mr.move.color),
      mate: !!findMatingLine(after.lines) || !!after.mateIn,
    }
  }, [review, ply, moves.length])

  const revealData = useMemo<RevealMarkers | null>(() => {
    if (!reveal || !review || ply === 0 || ply > moves.length) return null
    const before = review.positions[ply - 1]
    const after = review.positions[ply]
    const mr = review.moves[ply - 1]
    if (reveal === 'fork' && before.bestUci) {
      const targets = findForkTargets(before.fen, before.bestUci)
      if (targets) {
        const from = before.bestUci.slice(2, 4)
        return {
          arrows: targets.map((t) => [...uciToSquares(from + t), PALETTE.arrowReveal] as [Square, Square, string?]),
          style: null,
        }
      }
    }
    if (reveal === 'lost') {
      const sq = findLostPiece(after.fen, mr.move.to, mr.move.color)
      if (sq) return { arrows: [], style: { [sq]: { boxShadow: PALETTE.ringDanger } } }
    }
    if (reveal === 'mate') {
      const line = findMatingLine(after.lines)
      if (line) {
        return {
          arrows: line.pvUci.slice(0, 2).map((u) => [...uciToSquares(u), PALETTE.arrowReveal] as [Square, Square, string?]),
          style: null,
        }
      }
    }
    return null
  }, [reveal, review, ply, moves.length])

  // reveal markers reset whenever the displayed position changes
  useEffect(() => {
    setReveal(null)
  }, [ply])

  return {
    coachMode,
    coachView,
    reveal,
    revealArrows: revealData?.arrows ?? [],
    revealStyle: revealData?.style ?? null,
    patterns,
    setCoachView,
    toggleReveal: (kind) => setReveal((r) => (r === kind ? null : kind)),
    startCoach,
    exitCoach,
  }
}

export interface CoachState {
  coachMode: boolean
  coachView: CoachView
  reveal: 'fork' | 'lost' | 'mate' | null
  revealArrows: [Square, Square, string?][]
  revealStyle: RevealMarkers['style']
  patterns: CoachPatterns
  setCoachView: React.Dispatch<React.SetStateAction<CoachView>>
  toggleReveal: (kind: 'fork' | 'lost' | 'mate') => void
  startCoach: () => void
  exitCoach: () => void
}
