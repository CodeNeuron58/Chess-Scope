import { useCallback, useEffect, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Square } from 'chess.js'
import type { EngineLine } from './types'
import { ENGINE_LABELS } from './engine/engineClient'
import {
  useBoardSize,
  useCoachMode,
  useDrills,
  useEngine,
  useGameState,
  useReview,
  useSettings,
  useThreats,
} from './hooks'
import { formatEval, winPercent } from './analysis/accuracy'
import { PALETTE } from './lib/constants'
import { gameResult, uciToSquares } from './lib/chessUtils'
import { EvalBar } from './components/EvalBar'
import { EvalGraph } from './components/EvalGraph'
import { MoveList } from './components/MoveList'
import { ReviewSummary } from './components/ReviewSummary'
import { EngineLines } from './components/EngineLines'
import { PgnModal } from './components/PgnModal'
import { ChesscomModal } from './components/ChesscomModal'
import { SkillsModal } from './components/SkillsModal'
import { AdvancedModal } from './components/AdvancedModal'
import { CoachBubble } from './components/CoachBubble'
import { DrillIntro, DrillPanel } from './components/DrillPanel'
import { coachAlternative, funFactFor } from './analysis/coach'
import { buildReviewedPgn } from './analysis/pgnExport'
import './app.css'

const DEPTH_OPTIONS = [
  { value: 10, label: 'Fast (10)' },
  { value: 14, label: 'Standard (14)' },
  { value: 18, label: 'Deep (18)' },
]

export default function App() {
  const game = useGameState()
  const settings = useSettings()
  const engine = useEngine()
  const boardSize = useBoardSize()

  const [showPgnModal, setShowPgnModal] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showChesscom, setShowChesscom] = useState(false)
  const [copied, setCopied] = useState(false)

  const review = useReview({
    moves: game.moves,
    depth: settings.depth,
    engineChoice: settings.engineChoice,
    getEngine: engine.getEngine,
    destroyEngine: engine.destroyEngine,
  })
  const { reviewing, progress, engineStatus } = review

  const coach = useCoachMode({
    ply: game.ply,
    setPly: game.setPly,
    moves: game.moves,
    review: review.review,
    audioOn: settings.audioOn,
  })

  const drills = useDrills({
    review: review.review,
    engineChoice: settings.engineChoice,
    whiteAtBottom: settings.orientation === 'white',
    getEngine: engine.getEngine,
    setPly: game.setPly,
    onExit: () => {},
  })

  const threats = useThreats({
    enabled: true,
    blocked: reviewing || !!drills.panel,
    displayedFen: drills.boardFen ?? game.fens[Math.min(game.ply, game.fens.length - 1)] ?? game.fens[0],
    engineChoice: settings.engineChoice,
    getEngine: engine.getEngine,
  })

  const displayedFen = drills.boardFen ?? game.fens[Math.min(game.ply, game.fens.length - 1)] ?? game.fens[0]
  const currentPosition = review.review?.positions[Math.min(game.ply, review.review.positions.length - 1)] ?? null
  const lines: EngineLine[] = currentPosition?.lines ?? []

  const goToPly = useCallback(
    (p: number) => {
      game.setPly(p)
      coach.setCoachView('speech')
    },
    [game, coach],
  )

  // keyboard: ←/→ navigation, Home/End jump, X threat toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.key === 'x' || e.key === 'X') {
        threats.toggleThreat()
        return
      }
      if (drills.panel) return
      if (e.key === 'ArrowLeft') game.setPly((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowRight') game.setPly((p) => Math.min(game.moves.length, p + 1))
      else if (e.key === 'Home') game.setPly(0)
      else if (e.key === 'End') game.setPly(game.moves.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game, coach, drills.panel, threats])


  const squareStyles = useMemo(() => {
    const styles: Record<string, { backgroundColor?: string; boxShadow?: string }> = {}
    if (!drills.panel && game.ply > 0 && game.ply <= game.moves.length) {
      const m = game.moves[game.ply - 1]
      styles[m.from] = { ...styles[m.from], backgroundColor: PALETTE.highlightLastMove }
      styles[m.to] = { ...styles[m.to], backgroundColor: PALETTE.highlightLastMove }
    }
    for (const sq of drills.hintSquares) styles[sq] = { ...styles[sq], boxShadow: PALETTE.ringAccent }
    if (drills.selection) styles[drills.selection] = { ...styles[drills.selection], boxShadow: PALETTE.ringSelection }
    if (coach.revealStyle) {
      for (const [sq, style] of Object.entries(coach.revealStyle)) styles[sq] = { ...styles[sq], ...style }
    }
    return styles
  }, [game.ply, game.moves, drills.panel, drills.hintSquares, drills.selection, coach.revealStyle])

  const arrows = useMemo(() => {
    const out: [Square, Square, string?][] = []
    if (drills.panel) {
      if (drills.hintArrow) out.push([...drills.hintArrow, PALETTE.arrowBest] as [Square, Square, string?])
      return out
    }
    for (const [f, t, c] of coach.revealArrows) out.push([f, t, c])
    if (threats.threatOn && threats.threat) {
      const [f, t] = uciToSquares(threats.threat.uciFirst)
      out.push([f, t, PALETTE.arrowThreat])
    }
    if (!currentPosition || game.ply >= game.moves.length || lines.length === 0) return out
    const second = lines[1]
    if (second) out.push([...uciToSquares(second.uciFirst), PALETTE.arrowSecond] as [Square, Square, string?])
    const best = lines[0]
    if (best) out.push([...uciToSquares(best.uciFirst), PALETTE.arrowBest] as [Square, Square, string?])
    return out
  }, [currentPosition, lines, game.ply, game.moves.length, drills.panel, drills.hintArrow, coach.revealArrows, threats.threatOn, threats.threat])

  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square, piece: string): boolean => {
      if (drills.panel || reviewing) return false
      const target = game.gameRef.current.get(sourceSquare)
      let promotion: string | undefined
      if (target?.type === 'p' && (targetSquare[1] === '8' || targetSquare[1] === '1')) {
        const kind = piece[1]?.toLowerCase()
        promotion = kind && kind !== 'p' && 'qrbn'.includes(kind) ? kind : 'q'
      }
      return game.makeMove(sourceSquare, targetSquare, promotion)
    },
    [game, drills.panel, reviewing],
  )

  const copyPgn = async () => {
    try {
      const text = review.review
        ? buildReviewedPgn(review.review.moves, game.players, gameResult(game.gameRef.current), game.fens[0])
        : game.gameRef.current.pgn()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  const handleChesscomPick = useCallback(
    (pgn: string) => {
      setShowChesscom(false)
      const err = game.loadPgn(pgn, 0)
      if (err) {
        review.setEngineStatus(`PGN error: ${err}`)
        return
      }
      review.markAutoReview()
    },
    [game, review],
  )

  const sens = useMemo(() => game.moves.map((m) => m.san), [game.moves])
  const graphEvals = useMemo(() => review.review?.positions.map((p) => p.whiteCp) ?? [], [review.review])
  const graphClasses = useMemo(() => review.review?.moves.map((m) => m.classification) ?? [], [review.review])
  const lastBookPly = useMemo(() => {
    let last = 0
    for (const m of review.review?.moves ?? []) if (m.isBook) last = m.ply
    return last
  }, [review.review])

  const evalWhite = currentPosition ? winPercent(currentPosition.whiteCp) : 50
  const evalText = currentPosition ? formatEval(currentPosition.whiteCp, currentPosition.mateIn) : '·'
  const topPlayer = settings.orientation === 'white' ? game.players.black : game.players.white
  const bottomPlayer = settings.orientation === 'white' ? game.players.white : game.players.black
  const topColor = settings.orientation === 'white' ? 'black' : 'white'
  const bottomColor = settings.orientation === 'white' ? 'white' : 'black'
  const accuracyFor = (c: 'white' | 'black') =>
    review.review ? (c === 'white' ? review.review.whiteAccuracy : review.review.blackAccuracy) : null

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo">♞</span>
          <div className="topbar__brand-text">
            <strong>ChessScope</strong>
            <span>Game Review</span>
          </div>
        </div>
        <div className="topbar__spacer" />
        <select
          className="select"
          value={settings.engineChoice}
          onChange={(e) => settings.setEngineChoice(e.target.value as typeof settings.engineChoice)}
          disabled={reviewing}
          title="Analysis engine"
        >
          {(Object.keys(ENGINE_LABELS) as Array<keyof typeof ENGINE_LABELS>).map((c) => (
            <option key={c} value={c}>
              {ENGINE_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={settings.depth}
          onChange={(e) => settings.setDepth(Number(e.target.value))}
          disabled={reviewing}
        >
          {DEPTH_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <button className="btn btn--ghost" onClick={() => setShowPgnModal(true)} disabled={reviewing}>
          Load PGN
        </button>
        <button className="btn btn--ghost" onClick={() => setShowChesscom(true)} disabled={reviewing}>
          ♟ chess.com
        </button>
        <button className="btn btn--ghost" onClick={copyPgn} disabled={reviewing}>
          {copied ? 'Copied ✓' : 'Copy PGN'}
        </button>
        <button className="btn btn--ghost" onClick={settings.toggleOrientation}>
          ⇅ Flip
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => settings.setAudioOn((a) => !a)}
          disabled={!review.review}
          title="Speak coach commentary during the interactive review"
        >
          {settings.audioOn ? '🔊' : '🔇'} Coach voice
        </button>
        <button className="btn btn--ghost" onClick={game.resetBoard} disabled={reviewing}>
          New board
        </button>
        {reviewing ? (
          <button className="btn btn--danger" onClick={review.cancelReview}>
            Cancel
          </button>
        ) : (
          <button className="btn btn--accent" onClick={review.startReview} disabled={game.moves.length === 0}>
            ⚡ Review game
          </button>
        )}
      </header>

      <main className="main">
        <section className="board-col">
          <PlayerRow name={topPlayer} accuracy={accuracyFor(topColor)} />
          <div className="board-row" style={{ height: boardSize }}>
            <EvalBar whiteWin={evalWhite} evalText={evalText} boardSize={boardSize} />
            <div
              className="board-wrap"
              style={{ width: boardSize, height: boardSize }}
              onClick={drills.panel ? (e) => drills.onBoardClick(e.clientX, e.clientY) : undefined}
            >
              <Chessboard
                position={displayedFen}
                boardWidth={boardSize}
                boardOrientation={settings.orientation}
                onPieceDrop={onPieceDrop}
                customArrows={arrows}
                customSquareStyles={squareStyles}
                customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
                customDarkSquareStyle={{ backgroundColor: '#739552' }}
                animationDuration={180}
                arePiecesDraggable={!reviewing && !drills.panel}
              />
              {reviewing && (
                <div className="review-overlay">
                  <div className="review-overlay__card">
                    <div className="review-overlay__spinner" />
                    <div className="review-overlay__title">Reviewing game…</div>
                    <div className="review-overlay__bar">
                      <div
                        className="review-overlay__fill"
                        style={{
                          width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="review-overlay__count">
                      {progress.done} / {progress.total} positions · depth {settings.depth}
                    </div>
                    <div className="review-overlay__fact">{funFactFor(progress.done)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <PlayerRow name={bottomPlayer} accuracy={accuracyFor(bottomColor)} />
          <div className="status-line">
            {engineStatus || (
              <span className="status-line__hint">
                Keyboard: ← → navigate · Home/End jump · X threat · arrows show the engine's best line
              </span>
            )}
          </div>
        </section>

        <aside className="side">
          {drills.intro && review.review ? (
            <DrillIntro counts={drills.counts} onStart={drills.start} onExit={drills.exit} />
          ) : drills.panel ? (
            <DrillPanel
              drill={drills.panel}
              totalMoves={game.moves.length}
              onHint={drills.hint}
              onShowSolution={drills.showSolution}
              onNext={drills.next}
              onExit={drills.exit}
            />
          ) : coach.coachMode && review.review ? (
            <>
              <CoachBubble
                review={game.ply > 0 ? review.review.moves[game.ply - 1] ?? null : null}
                evalText={evalText === '·' ? '0.0' : evalText}
                mode={coach.coachView}
                alternativeText={coachAlternative(
                  game.ply > 0 ? review.review?.positions[game.ply - 1]?.lines[0]?.pvSan[0] : undefined,
                )}
                patterns={coach.patterns}
                revealActive={coach.reveal}
                onReveal={coach.toggleReveal}
                onExplain={() => coach.setCoachView((v) => (v === 'explain' ? 'speech' : 'explain'))}
                onBest={() => coach.setCoachView((v) => (v === 'alternative' ? 'speech' : 'alternative'))}
                onNext={() => game.setPly((p) => Math.min(game.moves.length, p + 1))}
                onBack={coach.exitCoach}
              />
              <MoveList reviews={review.review.moves} sens={sens} currentPly={game.ply} onSelectPly={goToPly} />
            </>
          ) : (
            <>
              {review.review && (
                <ReviewSummary
                  result={review.review}
                  players={game.players}
                  onOpenSkills={() => setShowSkills(true)}
                  onOpenAdvanced={() => setShowAdvanced(true)}
                  onOpenDrills={() => drills.start('w')}
                />
              )}
              <EvalGraph evals={graphEvals} classifications={graphClasses} currentPly={game.ply} onSelectPly={goToPly} />
              <MoveList
                reviews={review.review?.moves ?? null}
                sens={sens}
                currentPly={game.ply}
                onSelectPly={goToPly}
                lastBookPly={lastBookPly}
              />
              <EngineLines lines={lines} depth={review.review?.depth ?? settings.depth} ply={game.ply} />
              {review.review && (
                <button className="btn btn--accent side__start-review" onClick={coach.startCoach}>
                  ▶ Start Review
                </button>
              )}
            </>
          )}
        </aside>

        {showPgnModal && (
          <PgnModal onLoad={(pgn) => game.loadPgn(pgn, 0)} onClose={() => setShowPgnModal(false)} />
        )}
        {showChesscom && <ChesscomModal onPick={handleChesscomPick} onClose={() => setShowChesscom(false)} />}
        {showSkills && review.review && (
          <SkillsModal skills={review.review.skills} players={game.players} onClose={() => setShowSkills(false)} />
        )}
        {showAdvanced && review.review && (
          <AdvancedModal advanced={review.review.advanced} players={game.players} onClose={() => setShowAdvanced(false)} />
        )}
      </main>
    </div>
  )
}

function PlayerRow({ name, accuracy }: { name: string; accuracy: number | null }) {
  return (
    <div className="player-row">
      <span className="player-row__dot" />
      <span className="player-row__name">{name}</span>
      {accuracy !== null && <span className="player-row__acc">{accuracy.toFixed(1)}%</span>}
    </div>
  )
}
