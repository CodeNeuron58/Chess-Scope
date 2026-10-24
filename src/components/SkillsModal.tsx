import type { PlayerSkills } from '../types'
import './skillsModal.css'

interface Props {
  skills: { white: PlayerSkills; black: PlayerSkills }
  players: { white: string; black: string }
  onClose: () => void
}

export function SkillsModal({ skills, players, onClose }: Props) {
  return (
    <div className="skills-modal__backdrop" onClick={onClose}>
      <div className="skills-modal" onClick={(e) => e.stopPropagation()}>
        <div className="skills-modal__head">
          <span>Skills</span>
          <button className="skills-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="skills-modal__hint">
          How many of each opportunity appeared in the game, and how many each player used.
        </p>
        <div className="skills-modal__grid">
          <table className="skills-table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>{players.white}</th>
                <th>{players.black}</th>
              </tr>
            </thead>
            <tbody>
              {skills.white.meters.map((m, idx) => {
                const b = skills.black.meters[idx]
                return (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td>
                      <div className="skills-table__bar">
                        <div
                          className="skills-table__fill"
                          style={{ width: `${Math.min(100, (m.taken / Math.max(1, m.target)) * 100)}%` }}
                        />
                        <span>
                          {m.taken}/{m.target}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="skills-table__bar">
                        <div
                          className="skills-table__fill"
                          style={{ width: `${Math.min(100, (b.taken / Math.max(1, b.target)) * 100)}%` }}
                        />
                        <span>
                          {b.taken}/{b.target}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
