import type { Classification, MoveReview } from '../types'
import { ClassIcon, classificationColor } from './ClassIcon'
import './coachBubble.css'

export type CoachMode = 'speech' | 'explain' | 'alternative'

interface Props {
  review: MoveReview | null
  evalText: string
  mode: CoachMode
  alternativeText: string
  patterns: { fork: boolean; lost: boolean; mate: boolean }
  revealActive: string | null
  onReveal: (kind: 'fork' | 'lost' | 'mate') => void
  onExplain: () => void
  onBest: () => void
  onNext: () => void
  onBack: () => void
}

const NOTABLE: Classification[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder', 'miss']

export function CoachBubble({
  review,
  evalText,
  mode,
  alternativeText,
  patterns,
  revealActive,
  onReveal,
  onExplain,
  onBest,
  onNext,
  onBack,
}: Props) {
  const classification: Classification | undefined = review?.classification
  const color = classification ? classificationColor(classification) : '#81b64c'
  const isKey = review ? NOTABLE.includes(review.classification) : false
  return (
    <div className="coach-bubble">
      <div className="coach-bubble__row">
        <div className="coach-bubble__avatar" style={{ borderColor: color }}>
          <span>🐺</span>
        </div>
        <div className="coach-bubble__speech">
          {review ? (
            <>
              <div className="coach-bubble__meta">
                {classification && (
                  <span className="coach-bubble__class" style={{ color }}>
                    <ClassIcon classification={classification} size={13} />
                    {classification.charAt(0).toUpperCase() + classification.slice(1)}
                  </span>
                )}
                <span className="coach-bubble__eval">{evalText}</span>
              </div>
              <p className="coach-bubble__text">
                {mode === 'speech' ? review.speech : mode === 'explain' ? review.explain ?? review.speech : alternativeText}
              </p>
            </>
          ) : (
            <p className="coach-bubble__text">
              Let's walk through the game together, one move at a time. Hit Next when you're ready.
            </p>
          )}
        </div>
      </div>
      <div className="coach-bubble__actions">
        {isKey && (
          <>
            <button className={`btn ${mode === 'explain' ? 'btn--accent' : 'btn--ghost'}`} onClick={onExplain}>
              Explain
            </button>
            <button className={`btn ${mode === 'alternative' ? 'btn--accent' : 'btn--ghost'}`} onClick={onBest}>
              Best
            </button>
          </>
        )}
        {patterns.fork && (
          <button
            className={`btn ${revealActive === 'fork' ? 'btn--accent' : 'btn--ghost'}`}
            onClick={() => onReveal('fork')}
          >
            Show fork
          </button>
        )}
        {patterns.lost && (
          <button
            className={`btn ${revealActive === 'lost' ? 'btn--accent' : 'btn--ghost'}`}
            onClick={() => onReveal('lost')}
          >
            Show lost piece
          </button>
        )}
        {patterns.mate && (
          <button
            className={`btn ${revealActive === 'mate' ? 'btn--accent' : 'btn--ghost'}`}
            onClick={() => onReveal('mate')}
          >
            Show mate
          </button>
        )}
        <button className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn btn--accent coach-bubble__next" onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  )
}
