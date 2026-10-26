import './evalBar.css'

interface Props {
  /** White's win% (0-100), or null when there is no evaluation. */
  whiteWin: number | null
  evalText: string
  height: number
  flipped: boolean
}

/** Vertical evaluation bar; White's share fills from White's side of the board. */
export function EvalBar({ whiteWin, evalText, height, flipped }: Props) {
  const pct = whiteWin === null ? 50 : Math.min(97, Math.max(3, whiteWin))
  return (
    <div
      className={`eval-bar ${flipped ? 'eval-bar--flipped' : ''}`}
      style={{ height }}
      title={whiteWin === null ? 'Run a review to see the evaluation' : `Evaluation ${evalText}`}
    >
      <div className="eval-bar__white" style={{ height: `${pct}%` }}>
        {whiteWin !== null && <span className={`eval-bar__tag ${pct < 50 ? 'eval-bar__tag--out' : ''}`}>{evalText}</span>}
      </div>
    </div>
  )
}
