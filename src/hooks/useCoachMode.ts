import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Move, MoveReview, ReviewResult } from '../types'
import type { ExplainLevel } from './useSettings'
import type { BoardArrow } from '../components/Board'
import { PALETTE } from '../lib/constants'
import { findForkTargets, findLostPiece, findMatingLine } from '../analysis/patterns'

export interface CoachPatterns {
  fork: boolean
  lost: boolean
  mate: boolean
}

export type RevealKind = keyof CoachPatterns

interface Deps {
  ply: number
  setPly: React.Dispatch<React.SetStateAction<number>>
  moves: Move[]
  review: ReviewResult | null
  /** Narrate while the walkthrough is on screen. */
  active: boolean
  audioOn: boolean
  autoAdvance: boolean
  level: ExplainLevel
}

/** Coach commentary for a move at the chosen explanation level. */
export function coachText(mr: MoveReview, level: ExplainLevel): string {
  if (level === 'detailed') return mr.explain ?? mr.speech
  if (level === 'brief') {
    const first = /^.*?[.!?](\s|$)/.exec(mr.speech)
    return first ? first[0].trim() : mr.speech
  }
  return mr.speech
}

/**
 * Guided review: narration (Web Speech API), optional auto-advance after each
 * explanation, and reveal overlays (fork / lost piece / mating line).
 */
export function useCoachMode({ ply, setPly, moves, review, active, audioOn, autoAdvance, level }: Deps): CoachState {
  const [reveal, setReveal] = useState<RevealKind | null>(null)
  const plyRef = useRef(ply)
  useEffect(() => {
    plyRef.current = ply
  }, [ply])

  // narrate each move while walking through the game
  useEffect(() => {
    if (!active || !review || ply === 0 || !audioOn || !('speechSynthesis' in window)) return
    const mr = review.moves[ply - 1]
    if (!mr) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(coachText(mr, level))
    utterance.rate = 1.02
    const spokenAt = ply
    utterance.onend = () => {
      if (autoAdvance && plyRef.current === spokenAt && spokenAt < moves.length) setPly(spokenAt + 1)
    }
    window.speechSynthesis.speak(utterance)
  }, [active, ply, review, audioOn, autoAdvance, level, moves.length, setPly])

  // stop talking when the walkthrough closes or the voice is switched off
  useEffect(() => {
    if ((!active || !audioOn) && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [active, audioOn])

  const patterns = useMemo<CoachPatterns>(() => {
    if (!review || ply === 0 || ply > moves.length) return { fork: false, lost: false, mate: false }
    const before = review.positions[ply - 1]
    const after = review.positions[ply]
    const mr = review.moves[ply - 1]
    if (!before || !after || !mr) return { fork: false, lost: false, mate: false }
    return {
      fork: !!before.bestUci && before.bestUci !== mr.move.lan && !!findForkTargets(before.fen, before.bestUci),
      lost: !!findLostPiece(after.fen, mr.move.to, mr.move.color),
      mate: !!findMatingLine(after.lines) || !!after.mateIn,
    }
  }, [review, ply, moves.length])

  const revealData = useMemo<{ arrows: BoardArrow[]; rings: Record<string, string> }>(() => {
    const none = { arrows: [], rings: {} }
    if (!reveal || !review || ply === 0 || ply > moves.length) return none
    const before = review.positions[ply - 1]
    const after = review.positions[ply]
    const mr = review.moves[ply - 1]
    if (reveal === 'fork' && before.bestUci) {
      const targets = findForkTargets(before.fen, before.bestUci)
      const from = before.bestUci.slice(2, 4)
      if (targets) return { arrows: targets.map((t) => ({ from, to: t, color: PALETTE.arrowThreat })), rings: {} }
    }
    if (reveal === 'lost') {
      const sq = findLostPiece(after.fen, mr.move.to, mr.move.color)
      if (sq) return { arrows: [], rings: { [sq]: PALETTE.arrowThreat } }
    }
    if (reveal === 'mate') {
      const line = findMatingLine(after.lines)
      if (line) {
        return {
          arrows: line.pvUci.slice(0, 2).map((u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), color: PALETTE.arrowThreat })),
          rings: {},
        }
      }
    }
    return none
  }, [reveal, review, ply, moves.length])

  // reveal markers reset whenever the displayed position changes
  useEffect(() => {
    setReveal(null)
  }, [ply])

  const toggleReveal = useCallback((kind: RevealKind) => setReveal((r) => (r === kind ? null : kind)), [])

  return { reveal, revealArrows: revealData.arrows, revealRings: revealData.rings, patterns, toggleReveal }
}

export interface CoachState {
  reveal: RevealKind | null
  revealArrows: BoardArrow[]
  revealRings: Record<string, string>
  patterns: CoachPatterns
  toggleReveal: (kind: RevealKind) => void
}
