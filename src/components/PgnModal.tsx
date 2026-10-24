import { useState } from 'react'
import { SAMPLE_GAMES } from '../samples'
import './pgnModal.css'

interface Props {
  onLoad: (pgn: string) => string | null
  onClose: () => void
}

export function PgnModal({ onLoad, onClose }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = (pgn: string) => {
    const err = onLoad(pgn)
    if (err) setError(err)
    else onClose()
  }

  return (
    <div className="pgn-modal__backdrop" onClick={onClose}>
      <div className="pgn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pgn-modal__head">
          <span>Load PGN</span>
          <button className="pgn-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <textarea
          className="pgn-modal__area"
          placeholder="Paste a game PGN here…"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          spellCheck={false}
        />
        {error && <div className="pgn-modal__error">{error}</div>}
        <div className="pgn-modal__actions">
          <div className="pgn-modal__samples">
            {SAMPLE_GAMES.map((s) => (
              <button key={s.name} className="btn btn--ghost" onClick={() => load(s.pgn)}>
                {s.name}
              </button>
            ))}
          </div>
          <button className="btn btn--accent" disabled={!text.trim()} onClick={() => load(text)}>
            Load
          </button>
        </div>
      </div>
    </div>
  )
}
