import { ClassIcon } from './ClassIcon'
import './drillPanel.css'

export interface DrillState {
  side: 'w' | 'b'
  list: { ply: number; classification: string }[]
  idx: number
  phase: 'attempt' | 'solved' | 'revealed'
  feedback: string | null
  hints: number
  foundNoHint: number
}

interface Props {
  drill: DrillState
  totalMoves: number
  onHint: () => void
  onShowSolution: () => void
  onNext: () => void
  onExit: () => void
}

const SIDE_NAMES = { w: 'White', b: 'Black' } as const

export function DrillPanel({ drill, totalMoves, onHint, onShowSolution, onNext, onExit }: Props) {
  const current = drill.list[drill.idx]
  const last = drill.idx >= drill.list.length - 1
  return (
    <div className="drill-panel">
      <div className="drill-panel__head">
        <span className="drill-panel__title">
          🎯 Drill {SIDE_NAMES[drill.side]} mistakes
        </span>
        <span className="drill-panel__count">
          {Math.min(drill.idx + 1, drill.list.length)} / {drill.list.length}
        </span>
      </div>

      <div className="drill-panel__body">
        {drill.phase === 'attempt' && (
          <>
            <p className="drill-panel__prompt">
              Position {Math.ceil(current.ply / 2)} — {SIDE_NAMES[drill.side]} to move.
              Your game move is hidden. Find a move as good as the engine's choice.
            </p>
            <div className="drill-panel__meta">
              <span className="drill-panel__badge">
                <ClassIcon classification={current.classification as never} size={12} />
                your game: {current.classification}
              </span>
              <span className="drill-panel__badge">{totalMoves} moves in this game</span>
            </div>
            {drill.feedback && <p className="drill-panel__feedback">{drill.feedback}</p>}
            <div className="drill-panel__hints">
              <span className="drill-panel__hint-label">Hints used: {drill.hints}/3</span>
              {drill.hints < 3 && (
                <button className="btn btn--ghost" onClick={onHint}>
                  💡 Hint
                </button>
              )}
              <button className="btn btn--ghost" onClick={onShowSolution}>
                Show solution
              </button>
            </div>
          </>
        )}
        {drill.phase === 'solved' && (
          <>
            <p className="drill-panel__solved">✅ {drill.feedback}</p>
            <p className="drill-panel__sub">
              {drill.hints === 0 ? 'Found without hints — full credit!' : `Solved with ${drill.hints} hint(s).`}
            </p>
          </>
        )}
        {drill.phase === 'revealed' && (
          <>
            <p className="drill-panel__revealed">Solution shown on the board (green arrow).</p>
            <p className="drill-panel__sub">Study the line, then continue.</p>
          </>
        )}
      </div>

      <div className="drill-panel__actions">
        <button className="btn btn--ghost" onClick={onExit}>
          Exit drills
        </button>
        {drill.phase !== 'attempt' && (
          <button className="btn btn--accent" onClick={onNext}>
            {last ? 'Finish' : 'Next drill'}
          </button>
        )}
      </div>
    </div>
  )
}

interface IntroProps {
  counts: { white: number; black: number }
  onStart: (side: 'w' | 'b') => void
  onExit: () => void
}

export function DrillIntro({ counts, onStart, onExit }: IntroProps) {
  return (
    <div className="drill-panel">
      <div className="drill-panel__head">
        <span className="drill-panel__title">🎯 Mistake drills</span>
      </div>
      <div className="drill-panel__body">
        <p className="drill-panel__prompt">
          Replay every mistake, blunder and missed win from the review — with your move hidden —
          and find the engine's better move yourself.
        </p>
        <div className="drill-panel__choices">
          <button className="btn btn--ghost" disabled={counts.white === 0} onClick={() => onStart('w')}>
            White — {counts.white} mistake{counts.white === 1 ? '' : 's'}
          </button>
          <button className="btn btn--ghost" disabled={counts.black === 0} onClick={() => onStart('b')}>
            Black — {counts.black} mistake{counts.black === 1 ? '' : 's'}
          </button>
        </div>
        {counts.white === 0 && counts.black === 0 && (
          <p className="drill-panel__solved">No drillable mistakes in this review. Nice game!</p>
        )}
      </div>
      <div className="drill-panel__actions">
        <button className="btn btn--ghost" onClick={onExit}>
          Back
        </button>
      </div>
    </div>
  )
}
