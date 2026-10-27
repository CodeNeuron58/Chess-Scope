import { href, type Page } from '../router'
import { useApp } from '../state/context'
import { FEEDBACK_URL } from '../lib/constants'
import { Icon, type IconName } from './Icon'
import './rail.css'

const ITEMS: { page: Page; label: string; icon: IconName }[] = [
  { page: 'home', label: 'Home', icon: 'home' },
  { page: 'review', label: 'Review', icon: 'review' },
  { page: 'analysis', label: 'Analysis', icon: 'analysis' },
  { page: 'library', label: 'Library', icon: 'library' },
  { page: 'insights', label: 'Insights', icon: 'insights' },
  { page: 'drills', label: 'Drills', icon: 'drills' },
]

function initials(name: string): string {
  const parts = name.replace(/[_\-.]+/g, ' ').trim().split(/\s+/)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase()
}

export function Rail() {
  const { route, settings, queue, review } = useApp()
  const user = settings.accounts.chesscom || settings.accounts.lichess
  const busy = review.reviewing || !!queue.current
  const link = (page: Page, label: string, icon: IconName) => {
    const active = route.page === page
    return (
      <a key={page} href={href(page)} className={`rail__item ${active ? 'rail__item--on' : ''}`} aria-current={active ? 'page' : undefined}>
        <Icon name={icon} size={20} stroke={1.8} />
        {label}
        {page === 'review' && busy && <span className="rail__busy" title="Reviewing" />}
      </a>
    )
  }
  return (
    <nav className="rail" aria-label="Main">
      <a href={href('home')} className="rail__brand" title="Owlchess">
        <span className="rail__logo">
          <img src={`${import.meta.env.BASE_URL}owlchess-mark.png`} alt="" />
        </span>
        <span className="rail__name">Owlchess</span>
      </a>
      <div className="rail__items">{ITEMS.map((i) => link(i.page, i.label, i.icon))}</div>
      <div className="rail__foot">
        <a className="rail__item rail__item--feedback" href={FEEDBACK_URL} target="_blank" rel="noreferrer" title="Report a bug or ask for a feature">
          <Icon name="feedback" size={20} stroke={1.8} />
          Feedback
        </a>
        {link('settings', 'Settings', 'settings')}
        <a
          href={href('settings', undefined, 'accounts')}
          className="rail__avatar"
          title={user ? `Signed in as ${user} (local)` : 'Connect a chess account'}
        >
          {user ? initials(user) : <Icon name="user" size={16} />}
        </a>
      </div>
    </nav>
  )
}
