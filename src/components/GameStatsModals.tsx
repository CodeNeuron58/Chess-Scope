import type { PhaseStats, PlayerInfo, PlayerSkills } from '../types'
import { Modal } from './controls'
import './gameStatsModals.css'

function Bar({ value, max, label, dark }: { value: number; max: number; label: string; dark?: boolean }) {
  return (
    <div className="gs-bar">
      <span className="meter meter--thick">
        <span className="meter__fill" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: dark ? '#6f8f7e' : undefined }} />
      </span>
      <span className="gs-bar__num">{label}</span>
    </div>
  )
}

/** Opportunity meters for one game: how often each skill came up and was used. */
export function SkillsModal({ skills, players, onClose }: { skills: { white: PlayerSkills; black: PlayerSkills }; players: PlayerInfo; onClose: () => void }) {
  return (
    <Modal title="Skills in this game" onClose={onClose} wide>
      <p className="field-hint">How many of each opportunity appeared in the game, and how many each player took.</p>
      <div className="gs-table">
        <div className="gs-row gs-row--head">
          <span />
          <span>{players.white}</span>
          <span>{players.black}</span>
        </div>
        {skills.white.meters.map((m, i) => {
          const b = skills.black.meters[i]
          return (
            <div className="gs-row" key={m.key}>
              <span className="gs-row__label">{m.label}</span>
              <Bar value={m.taken} max={m.target} label={`${m.taken}/${m.target}`} />
              <Bar value={b.taken} max={b.target} label={`${b.taken}/${b.target}`} dark />
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

const PHASES: { key: keyof Omit<PhaseStats, 'counts'>; label: string; hint: string }[] = [
  { key: 'opening', label: 'Opening', hint: 'First 8 moves' },
  { key: 'tactics', label: 'Tactics', hint: 'Captures available or a check played' },
  { key: 'strategy', label: 'Strategy', hint: 'Quiet positions' },
  { key: 'endgame', label: 'Endgame', hint: 'Little material left' },
]

/** Accuracy per kind of position for one game. */
export function AdvancedModal({ advanced, players, onClose }: { advanced: { white: PhaseStats; black: PhaseStats }; players: PlayerInfo; onClose: () => void }) {
  return (
    <Modal title="Advanced stats" onClose={onClose} wide>
      <p className="field-hint">Accuracy grouped by the kind of position. Numbers in brackets count the moves in each group.</p>
      <div className="gs-table">
        <div className="gs-row gs-row--head">
          <span />
          <span>{players.white}</span>
          <span>{players.black}</span>
        </div>
        {PHASES.map(({ key, label, hint }) => {
          const w = advanced.white[key]
          const b = advanced.black[key]
          return (
            <div className="gs-row" key={key}>
              <span className="gs-row__label">
                {label}
                <small>{hint}</small>
              </span>
              <Bar value={w} max={100} label={w > 0 ? `${w.toFixed(1)} (${advanced.white.counts[key]})` : '—'} />
              <Bar value={b} max={100} label={b > 0 ? `${b.toFixed(1)} (${advanced.black.counts[key]})` : '—'} dark />
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
