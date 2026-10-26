import { useMemo } from 'react'
import { pieceUrl } from '../lib/constants'
import { captures } from '../lib/chessUtils'
import { useApp } from '../state/context'

interface Props {
  color: 'w' | 'b'
  name: string
  elo?: string | number
  accuracy?: number | null
  fen: string
  /** Show the side-to-move dot (analysis board). */
  turn?: boolean
}

export function PlayerBar({ color, name, elo, accuracy, fen, turn }: Props) {
  const { settings } = useApp()
  const cap = useMemo(() => captures(fen), [fen])
  const taken = color === 'w' ? cap.byWhite : cap.byBlack
  const lead = color === 'w' ? cap.balance : -cap.balance
  const enemy = color === 'w' ? 'b' : 'w'
  return (
    <div className="player-bar">
      <span className={`player-bar__icon player-bar__icon--${color}`}>
        <img src={pieceUrl(settings.pieceSet, `${color}K`)} alt="" />
      </span>
      <b className="player-bar__name">{name}</b>
      {elo !== undefined && elo !== '' && <span className="player-bar__elo">{elo}</span>}
      {accuracy !== undefined && accuracy !== null && <span className="player-bar__chip">{accuracy.toFixed(1)}%</span>}
      {turn && <span className="player-bar__turn" title="To move" />}
      <div className="player-bar__caps">
        {taken.map((p, i) => (
          <img key={i} src={pieceUrl(settings.pieceSet, `${enemy}${p.toUpperCase()}`)} alt="" />
        ))}
        {lead > 0 && <span className="player-bar__lead">+{lead}</span>}
      </div>
    </div>
  )
}
