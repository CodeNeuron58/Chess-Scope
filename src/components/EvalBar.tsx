import './evalBar.css'

interface Props {
  whiteWin: number
  evalText: string
  boardSize: number
}

/** Vertical evaluation bar, white fill anchored to the bottom (white's side). */
export function EvalBar({ whiteWin, evalText, boardSize }: Props) {
  const clamped = Math.min(97, Math.max(3, whiteWin))
  const darkSide = whiteWin < 50
  return (
    <div className="eval-bar" style={{ height: boardSize }} title={`Evaluation ${evalText}`}>
      <div className="eval-bar__white" style={{ height: `${clamped}%` }} />
      <div
        className={`eval-bar__num ${darkSide ? 'eval-bar__num--light' : 'eval-bar__num--dark'}`}
        style={{ bottom: `calc(${clamped}% - 9px)` }}
      >
        {evalText}
      </div>
    </div>
  )
}
