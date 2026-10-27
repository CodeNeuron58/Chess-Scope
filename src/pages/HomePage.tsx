import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { useApp } from '../state/context'
import { useDailyDrills, useDrillProgress } from '../hooks/useDrillProgress'
import { ImportForm } from '../components/ImportForm'
import { StaticBoard } from '../components/StaticBoard'
import { AccuracyCell, ErrorChips, Modal, ResultChip } from '../components/controls'
import { Icon } from '../components/Icon'
import { inWindow, kpis, periodRange, startOfWeek, userColorOf, userGames } from '../library/stats'
import { userDrills, promptFor } from '../library/drills'
import { outcomeFor, tcShort } from '../library/pgnMeta'
import { fmt, greeting, speedLabel, timeAgo } from '../lib/format'
import type { StoredGame } from '../library/types'
import { SAMPLE_GAMES } from '../samples'
import { APP_VERSION, FEEDBACK_URL } from '../lib/constants'
import './homePage.css'

/** FEN after `ply` half-moves of a PGN (null when unreadable). */
function fenAt(pgn: string, ply: number): { fen: string; last: { from: string; to: string } | null } | null {
  try {
    const c = new Chess()
    c.loadPgn(pgn)
    const hist = c.history({ verbose: true })
    const n = Math.min(ply, hist.length)
    if (n === 0) return { fen: hist[0]?.before ?? c.fen(), last: null }
    return { fen: hist[n - 1].after, last: { from: hist[n - 1].from, to: hist[n - 1].to } }
  } catch {
    return null
  }
}

export function HomePage() {
  const app = useApp()
  const { library, names, settings } = app
  const [importOpen, setImportOpen] = useState(false)
  const progress = useDrillProgress()

  const mine = useMemo(() => userGames(library.games, names), [library.games, names])
  const reviewedCount = useMemo(() => library.games.filter((g) => g.summary).length, [library.games])
  const weekCount = useMemo(() => {
    const from = startOfWeek()
    return library.games.filter((g) => g.summary && g.summary.reviewedAt >= from).length
  }, [library.games])
  const waiting = library.games.filter((g) => !g.summary && g.userColor).length

  const now = Date.now()
  const r = periodRange(30, now)
  const cur = kpis(inWindow(mine, r.from, r.to))
  const prev = kpis(inWindow(mine, r.prevFrom, r.from))
  const overall = kpis(mine)
  const k = cur.games > 0 ? cur : overall

  const recent = useMemo(() => [...library.games].sort((a, b) => b.playedAt - a.playedAt).slice(0, 6), [library.games])
  const last = useMemo(
    () => [...library.games].filter((g) => g.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0],
    [library.games],
  )
  const drills = useMemo(() => userDrills(library.games, names), [library.games, names])
  const daily = useDailyDrills(drills, progress)
  const dailyDone = daily.filter((d) => progress.solved.has(d.id)).length
  const firstDrill = daily.find((d) => !progress.solved.has(d.id)) ?? daily[0]

  const user = settings.accounts.chesscom || settings.accounts.lichess
  const lastSyncAt = Math.max(library.lastSync.chesscom ?? 0, library.lastSync.lichess ?? 0)
  const subParts = [
    waiting > 0 ? `${waiting} new game${waiting === 1 ? '' : 's'} waiting for review` : reviewedCount > 0 ? `${reviewedCount} reviewed game${reviewedCount === 1 ? '' : 's'} in your library` : 'Bring in a game to get started',
    library.syncing ? 'Syncing…' : lastSyncAt ? `Synced ${timeAgo(lastSyncAt)}` : null,
    app.queue.current ? `Reviewing in the background (${app.queue.pending.length + 1} left)` : null,
  ].filter(Boolean)

  const delta = (a: number, b: number, digits: number, higherIsBetter: boolean, unit = '') => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    const d = a - b
    if (Math.abs(d) < 10 ** -digits / 2) return { text: 'Same as last month', cls: '' }
    const good = higherIsBetter ? d > 0 : d < 0
    return { text: `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(digits)}${unit} vs last month`, cls: good ? 'stat__delta--good' : 'stat__delta--bad' }
  }
  const accDelta = delta(cur.accuracy, prev.accuracy, 1, true)
  const blDelta = delta(cur.blundersPerGame, prev.blundersPerGame, 1, false)

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar__heading">
          <span className="topbar__brand">Owlchess</span>
          <span className="beta-tag" title={`Version ${APP_VERSION} — early public test`}>Beta</span>
          <span className="topbar__sub">/ Home</span>
        </div>
        <a className="btn btn--quiet" href={FEEDBACK_URL} target="_blank" rel="noreferrer">
          <Icon name="feedback" size={15} />
          Feedback
        </a>
        <button type="button" className="btn btn--primary" onClick={() => setImportOpen(true)}>
          <Icon name="upload" size={15} stroke={2.2} />
          Import game
        </button>
      </header>

      <div className="content home">
        <div className="home__hello">
          <h1>
            {greeting()}
            {user ? `, ${user}` : ''}
          </h1>
          <p>{subParts.join(' · ')}</p>
        </div>

        <div className="home__top">
          <section className="card home__import">
            <ImportForm variant="card" reviewOnLoad title="Review a game" />
          </section>
          <ContinueCard game={last} />
        </div>

        <div className="home__stats">
          <a className="stat" href="#/insights">
            <span className="stat__label">Average accuracy</span>
            <span className="stat__value">{fmt(k.accuracy)}</span>
            <span className={`stat__delta ${accDelta?.cls ?? ''}`}>{accDelta?.text ?? (mine.length ? `${mine.length} of your games` : 'Connect an account to track yours')}</span>
          </a>
          <a className="stat" href="#/library">
            <span className="stat__label">Games reviewed</span>
            <span className="stat__value">{reviewedCount}</span>
            <span className="stat__delta">{weekCount} this week</span>
          </a>
          <a className="stat" href="#/insights">
            <span className="stat__label">Blunders per game</span>
            <span className="stat__value">{fmt(k.blundersPerGame)}</span>
            <span className={`stat__delta ${blDelta?.cls ?? ''}`}>{blDelta?.text ?? 'Across your reviewed games'}</span>
          </a>
          <a className="stat" href="#/insights">
            <span className="stat__label">Est. game rating</span>
            <span className="stat__value">{Number.isFinite(k.rating) ? k.rating : '—'}</span>
            <span className="stat__delta">Average of your reviewed games</span>
          </a>
        </div>

        <div className="home__bottom">
          <section className="card card--flush">
            <div className="card__head">
              <span className="card__title">Recent games</span>
              <a href="#/library" className="link-btn">
                Open library
              </a>
            </div>
            {recent.length === 0 ? (
              <div className="empty">
                <span>No games yet. Load a PGN above, connect an account, or try a classic:</span>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => app.loadPgnText(SAMPLE_GAMES[0].pgn, { review: true })}>
                  Review the Opera Game (1858)
                </button>
              </div>
            ) : (
              <div className="game-table">
                <div className="game-table__head home-grid">
                  <span>RESULT</span>
                  <span>OPPONENT</span>
                  <span>OPENING</span>
                  <span>ACCURACY</span>
                  <span>ERRORS</span>
                  <span />
                </div>
                {recent.map((g) => (
                  <RecentRow key={g.id} game={g} names={names} />
                ))}
              </div>
            )}
          </section>

          <div className="home__side">
            <a className="drill-card" href="#/drills">
              <div className="drill-card__top">
                <span>Daily drill</span>
                <span>
                  {dailyDone} / {daily.length || 5}
                </span>
              </div>
              {firstDrill ? (
                <>
                  <div className="drill-card__title">
                    {daily.length} position{daily.length === 1 ? '' : 's'} from your own mistakes
                  </div>
                  <div className="drill-card__body">
                    <div className="drill-card__board">
                      <StaticBoard fen={firstDrill.fen} orientation={firstDrill.color === 'w' ? 'white' : 'black'} />
                    </div>
                    <p>
                      {firstDrill.color === 'w' ? 'White' : 'Black'} to move. {promptFor(firstDrill)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="drill-card__title">Drills from your own mistakes</div>
                  <p>Review a few of your games and the positions you got wrong turn into daily drills.</p>
                </>
              )}
            </a>
            <section className="card home__accounts">
              <span className="card__title" style={{ fontSize: 15 }}>
                Connected accounts
              </span>
              <AccountRow
                badge="cc"
                name="chess.com"
                user={settings.accounts.chesscom}
                syncedAt={library.lastSync.chesscom}
                syncing={library.syncing}
                onSync={() => void library.sync('chesscom').then(({ fresh, error }) => app.toast(error || `chess.com synced · ${fresh.length} new`))}
              />
              <AccountRow
                badge="Li"
                name="Lichess"
                user={settings.accounts.lichess}
                syncedAt={library.lastSync.lichess}
                syncing={library.syncing}
                onSync={() => void library.sync('lichess').then(({ fresh, error }) => app.toast(error || `Lichess synced · ${fresh.length} new`))}
              />
            </section>
          </div>
        </div>
      </div>

      {importOpen && (
        <Modal title="Import a game" onClose={() => setImportOpen(false)}>
          <ImportForm variant="modal" reviewOnLoad onDone={() => setImportOpen(false)} />
        </Modal>
      )}
    </div>
  )
}

function ContinueCard({ game }: { game: StoredGame | undefined }) {
  const app = useApp()
  const sample = SAMPLE_GAMES[0]
  const pos = useMemo(() => (game ? fenAt(game.pgn, game.lastPly ?? 0) : fenAt(sample.pgn, 31)), [game, sample.pgn])
  if (!game) {
    return (
      <section className="card home__continue">
        <div className="home__continue-board">{pos && <StaticBoard fen={pos.fen} lastMove={pos.last} />}</div>
        <div className="home__continue-body">
          <span className="eyebrow">Try it</span>
          <div className="home__continue-title">Morphy vs Allies, 1858</div>
          <div className="home__continue-sub">The Opera Game · a full review in under a minute</div>
          <div className="home__continue-actions">
            <button type="button" className="btn btn--primary" onClick={() => app.loadPgnText(sample.pgn, { review: true })}>
              Review it
            </button>
          </div>
        </div>
      </section>
    )
  }
  const ply = Math.min(game.lastPly ?? 0, game.plies)
  const title = game.userColor ? `vs ${game.userColor === 'w' ? game.black : game.white}` : `${game.white} vs ${game.black}`
  const reviewed = !!game.summary
  return (
    <section className="card home__continue">
      <div className="home__continue-board">{pos && <StaticBoard fen={pos.fen} lastMove={pos.last} orientation={game.userColor === 'b' ? 'black' : 'white'} />}</div>
      <div className="home__continue-body">
        <span className="eyebrow">Continue</span>
        <div className="home__continue-title">{title}</div>
        <div className="home__continue-sub">
          {reviewed ? 'Guided review' : 'Not reviewed yet'} · move {Math.ceil(ply / 2)} of {Math.ceil(game.plies / 2)}
        </div>
        <span className="meter" style={{ flex: 'none', height: 5 }}>
          <span className="meter__fill" style={{ width: `${game.plies ? (ply / game.plies) * 100 : 0}%` }} />
        </span>
        <div className="home__continue-actions">
          <button type="button" className="btn btn--primary" onClick={() => void app.openGame(game.id, { at: 'last', tab: reviewed ? 'moves' : 'summary' })}>
            Resume
          </button>
          <button type="button" className="btn btn--outline" onClick={() => void app.openGame(game.id, { tab: 'summary', review: !reviewed })}>
            {reviewed ? 'Report' : 'Review'}
          </button>
        </div>
      </div>
    </section>
  )
}

function RecentRow({ game, names }: { game: StoredGame; names: string[] }) {
  const app = useApp()
  const color = userColorOf(game, names)
  const s = game.summary
  const side = color === 'w' ? 'white' : 'black'
  const opp = color === 'w' ? game.black : color === 'b' ? game.white : `${game.white} – ${game.black}`
  const oppElo = color === 'w' ? game.blackElo : color === 'b' ? game.whiteElo : undefined
  const acc = s ? (color ? s.accuracy[side] : (s.accuracy.white + s.accuracy.black) / 2) : null
  const counts = s && color ? s.counts[side] : null
  return (
    <button type="button" className="game-row home-grid" onClick={() => void app.openGame(game.id, { review: !s })}>
      <ResultChip outcome={color ? outcomeFor(game.result, color) : null} result={game.result} />
      <span className="game-row__who">
        <span className="game-row__name">
          {color && <span className={`side-swatch side-swatch--${color}`} />}
          {opp} {oppElo && <span className="game-row__elo">{oppElo}</span>}
        </span>
        <small>
          {[game.timeControl ? `${tcShort(game.timeControl)} ${speedLabel(game.speed).toLowerCase()}` : null, timeAgo(game.playedAt)].filter(Boolean).join(' · ')}
        </small>
      </span>
      <span className="game-row__opening">{game.opening ?? '—'}</span>
      <AccuracyCell value={acc} />
      <ErrorChips blunders={counts ? counts.blunder ?? 0 : null} mistakes={counts ? (counts.mistake ?? 0) + (counts.miss ?? 0) : null} dim={!counts} />
      <span className={`btn btn--sm ${s ? '' : 'btn--primary'}`} style={{ justifySelf: 'end' }}>
        {s ? 'Open' : 'Review'}
      </span>
    </button>
  )
}

function AccountRow({
  badge,
  name,
  user,
  syncedAt,
  syncing,
  onSync,
}: {
  badge: string
  name: string
  user: string
  syncedAt?: number
  syncing: boolean
  onSync: () => void
}) {
  return (
    <div className="account-row">
      <span className="account-row__badge">{badge}</span>
      <div className="account-row__text">
        <span>{user ? `${name} · ${user}` : name}</span>
        <small className={user ? 'account-row__ok' : ''}>{user ? (syncedAt ? `● Synced ${timeAgo(syncedAt)}` : '● Connected') : 'Import by username'}</small>
      </div>
      {user ? (
        <button type="button" className="link-btn" onClick={onSync} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      ) : (
        <a className="link-btn" href="#/settings/accounts">
          Connect
        </a>
      )}
    </div>
  )
}
