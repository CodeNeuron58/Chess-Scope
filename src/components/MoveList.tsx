import { useEffect, useRef } from 'react'
import type { MoveReview } from '../types'
import { ClassIcon } from './ClassIcon'
import './moveList.css'

interface Props {
  reviews: MoveReview[] | null
  /** SANs when there is no review yet. */
  sens: string[]
  currentPly: number
  onSelectPly: (ply: number) => void
  /** Last ply classified as book — draws the "out of book" divider after it. */
  lastBookPly?: number
}

export function MoveList({ reviews, sens, currentPly, onSelectPly, lastBookPly }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentPly])

  const total = reviews ? reviews.length : sens.length
  const rows: { num: number; white?: number; black?: number }[] = []
  for (let i = 0; i < total; i += 2) {
    rows.push({ num: i / 2 + 1, white: i < total ? i + 1 : undefined, black: i + 1 < total ? i + 2 : undefined })
  }

  const cell = (ply: number | undefined) => {
    if (ply === undefined) return <span className="move-cell move-cell--empty" />
    const review = reviews?.find((r) => r.ply === ply) ?? null
    const san = review ? review.move.san : sens[ply - 1] ?? ''
    const isActive = ply === currentPly
    return (
      <span
        ref={isActive ? activeRef : undefined}
        className={`move-cell ${isActive ? 'move-cell--active' : ''}`}
        onClick={() => onSelectPly(ply)}
      >
        {review && <ClassIcon classification={review.classification} />}
        <span className="move-cell__san">{san}</span>
      </span>
    )
  }

  return (
    <div className="move-list" ref={scroller}>
      {rows.map((r) => (
        <div key={r.num}>
          <div className="move-row">
            <span className="move-num">{r.num}.</span>
            {cell(r.white)}
            {cell(r.black)}
          </div>
          {lastBookPly !== undefined && lastBookPly > 0 && (r.white === lastBookPly || r.black === lastBookPly) && (
            <div className="move-divider">— opening theory ends here —</div>
          )}
        </div>
      ))}
      {rows.length === 0 && (
        <div className="move-list__empty">No moves yet — play on the board or paste a PGN.</div>
      )}
    </div>
  )
}
