import type { ReviewResult } from '../types'
import { CLASSIFICATION_ORDER } from '../analysis/accuracy'
import { ClassIcon } from './ClassIcon'
import './reviewSummary.css'

interface Props {
  result: ReviewResult
  players: { white: string; black: string }
  opening?: string | null
  onOpenSkills: () => void
  onOpenAdvanced: () => void
  onOpenDrills: () => void
}

function PlayerCard({ name, accuracy, counts }: { name: string; accuracy: number; counts: Partial<Record<string, number>> }) {
  const entries = CLASSIFICATION_ORDER.filter((c) => (counts[c] ?? 0) > 0)
  return (
    <div className="player-card">
      <div className="player-card__top">
        <span className="player-card__name">{name}</span>
        <span className="player-card__acc">
          {accuracy.toFixed(1)}
          <small>ACC</small>
        </span>
      </div>
      <div className="player-card__counts">
        {entries.map((c) => (
          <span className="player-card__count" key={c}>
            <ClassIcon classification={c} size={12} />
            <span>{counts[c]}</span>
          </span>
        ))}
        {entries.length === 0 && <span className="player-card__none">No notable moves</span>}
      </div>
    </div>
  )
}

export function ReviewSummary({ result, players, opening, onOpenSkills, onOpenAdvanced, onOpenDrills }: Props) {
  return (
    <div className="review-summary">
      <div className="review-summary__head">
        <span className="review-summary__title">Game Report</span>
        <span className="review-summary__depth">depth {result.depth}</span>
      </div>
      {opening && <div className="review-summary__opening">Opening: {opening}</div>}
      <div className="review-summary__cards">
        <PlayerCard name={players.white} accuracy={result.whiteAccuracy} counts={result.counts.white} />
        <PlayerCard name={players.black} accuracy={result.blackAccuracy} counts={result.counts.black} />
      </div>
      <div className="review-summary__rating">
        <span className="review-summary__rating-label">Game Rating</span>
        <span className="review-summary__rating-value">{result.gameRating.white}</span>
        <span className="review-summary__rating-value">{result.gameRating.black}</span>
      </div>
      <div className="review-summary__rating review-summary__acpl">
        <span className="review-summary__rating-label">ACPL</span>
        <span className="review-summary__rating-value review-summary__acpl-value">{result.acpl.white.toFixed(0)}</span>
        <span className="review-summary__rating-value review-summary__acpl-value">{result.acpl.black.toFixed(0)}</span>
      </div>
      <div className="review-summary__buttons">
        <button className="btn btn--ghost" onClick={onOpenSkills}>
          🎯 Skills
        </button>
        <button className="btn btn--ghost" onClick={onOpenAdvanced}>
          📈 Advanced
        </button>
        <button className="btn btn--ghost" onClick={onOpenDrills}>
          🥊 Drills
        </button>
      </div>
    </div>
  )
}
