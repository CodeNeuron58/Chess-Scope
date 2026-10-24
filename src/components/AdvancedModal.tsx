import type { PhaseStats } from '../types'
import './advancedModal.css'

interface Props {
  advanced: { white: PhaseStats; black: PhaseStats }
  players: { white: string; black: string }
  onClose: () => void
}

const ROWS: { key: keyof Omit<PhaseStats, 'counts'>; label: string; hint: string }[] = [
  { key: 'opening', label: 'Opening', hint: 'First 8 moves' },
  { key: 'tactics', label: 'Tactics', hint: 'Positions with captures available or checks' },
  { key: 'strategy', label: 'Strategy', hint: 'Quiet positions with no captures available' },
  { key: 'endgame', label: 'Endgame', hint: 'Positions with little material left' },
]

export function AdvancedModal({ advanced, players, onClose }: Props) {
  return (
    <div className="advanced-modal__backdrop" onClick={onClose}>
      <div className="advanced-modal" onClick={(e) => e.stopPropagation()}>
        <div className="advanced-modal__head">
          <span>Advanced Stats</span>
          <button className="advanced-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="advanced-modal__hint">
          Per-move accuracy grouped by position type — the part chess.com keeps behind Diamond.
        </p>
        <table className="advanced-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>{players.white}</th>
              <th>{players.black}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, label, hint }) => {
              const w = advanced.white[key]
              const b = advanced.black[key]
              return (
                <tr key={key}>
                  <td>
                    <div className="advanced-table__phase">{label}</div>
                    <div className="advanced-table__hint">{hint}</div>
                  </td>
                  <td>
                    <div className="advanced-table__cell">
                      <div className="advanced-table__bar">
                        <div className="advanced-table__fill" style={{ width: `${w}%` }} />
                      </div>
                      <span className="advanced-table__num">
                        {w > 0 ? w.toFixed(1) : '—'}
                        <small> {w > 0 ? `(${advanced.white.counts[key]})` : ''}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="advanced-table__cell">
                      <div className="advanced-table__bar">
                        <div className="advanced-table__fill advanced-table__fill--b" style={{ width: `${b}%` }} />
                      </div>
                      <span className="advanced-table__num">
                        {b > 0 ? b.toFixed(1) : '—'}
                        <small> {b > 0 ? `(${advanced.black.counts[key]})` : ''}</small>
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="advanced-modal__foot">Numbers in parentheses = moves analyzed in that bucket.</p>
      </div>
    </div>
  )
}
