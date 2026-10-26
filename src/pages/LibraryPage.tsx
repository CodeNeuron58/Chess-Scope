import { useMemo, useState } from 'react'
import { useApp } from '../state/context'
import { ImportForm } from '../components/ImportForm'
import { AccuracyCell, ErrorChips, Modal, ResultChip, Segmented } from '../components/controls'
import { Icon } from '../components/Icon'
import { userColorOf } from '../library/stats'
import { outcomeFor, tcShort } from '../library/pgnMeta'
import type { GameSource, Speed, StoredGame } from '../library/types'
import { shortDay, speedLabel, timeAgo } from '../lib/format'
import './libraryPage.css'

const PAGE = 25
const SOURCE_LABEL: Record<GameSource, string> = { chesscom: 'chess.com', lichess: 'Lichess', upload: 'PGN upload', board: 'Played on board' }
type Status = 'all' | 'reviewed' | 'unreviewed'
type TimeFilter = 'all' | Speed

export function LibraryPage() {
  const app = useApp()
  const { library, names, queue, settings } = app
  const [q, setQ] = useState('')
  const [tc, setTc] = useState<TimeFilter>('all')
  const [results, setResults] = useState<('W' | 'L' | 'D')[]>([])
  const [status, setStatus] = useState<Status>('all')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [asc, setAsc] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return library.games
      .filter((g) => {
        if (tc !== 'all' && (tc === 'classical' ? g.speed !== 'classical' && g.speed !== 'daily' : g.speed !== tc)) return false
        if (status === 'reviewed' && !g.summary) return false
        if (status === 'unreviewed' && g.summary) return false
        if (results.length) {
          const c = userColorOf(g, names)
          const o = c ? outcomeFor(g.result, c) : g.result === '1/2-1/2' ? 'D' : null
          if (!o || !results.includes(o)) return false
        }
        if (needle && !`${g.white} ${g.black} ${g.opening ?? ''} ${g.eco ?? ''}`.toLowerCase().includes(needle)) return false
        return true
      })
      .sort((a, b) => (asc ? a.playedAt - b.playedAt : b.playedAt - a.playedAt))
  }, [library.games, q, tc, status, results, names, asc])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const cur = Math.min(page, pages - 1)
  const rows = filtered.slice(cur * PAGE, cur * PAGE + PAGE)
  const allOn = rows.length > 0 && rows.every((g) => sel.has(g.id))
  const sources = new Set(library.games.map((g) => g.source)).size
  const accounts = [settings.accounts.chesscom && 'chess.com', settings.accounts.lichess && 'Lichess'].filter(Boolean) as string[]
  const lastSyncAt = Math.max(library.lastSync.chesscom ?? 0, library.lastSync.lichess ?? 0)

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAll = () =>
    setSel((s) => {
      const n = new Set(s)
      for (const g of rows) {
        if (allOn) n.delete(g.id)
        else n.add(g.id)
      }
      return n
    })

  const reviewSelected = () => {
    const ids = [...sel].filter((id) => !library.byId.get(id)?.summary)
    if (ids.length === 0) {
      app.toast('Those games are already reviewed')
      return
    }
    queue.enqueue(ids)
    app.toast(`${ids.length} game${ids.length === 1 ? '' : 's'} queued for review`)
    setSel(new Set())
  }
  const deleteSelected = async () => {
    const n = sel.size
    if (!window.confirm(`Remove ${n} game${n === 1 ? '' : 's'} and ${n === 1 ? 'its' : 'their'} reviews from this browser?`)) return
    await library.remove([...sel])
    setSel(new Set())
    app.toast(`${n} game${n === 1 ? '' : 's'} removed`)
  }
  const sync = () => void library.sync().then(({ fresh, error }) => {
    app.toast(error || `Synced · ${fresh.length} new game${fresh.length === 1 ? '' : 's'}`)
    if (!error && settings.autoReview && fresh.length) queue.enqueue(fresh.slice(0, 5))
  })

  const queueTotal = queue.pending.length + (queue.current ? 1 : 0)
  const currentGame = queue.current ? library.byId.get(queue.current) : null

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar__heading">
          <span className="topbar__title">Library</span>
          <span className="topbar__sub">
            {library.games.length} game{library.games.length === 1 ? '' : 's'} · {sources} source{sources === 1 ? '' : 's'}
          </span>
        </div>
        {queue.current && (
          <span className="sync-pill" title={currentGame ? `${currentGame.white} vs ${currentGame.black}` : undefined}>
            <span className="spinner spinner--sm" />
            Reviewing · {queueTotal} left · {Math.round((queue.progress.done / Math.max(1, queue.progress.total)) * 100)}%
            <button type="button" className="link-btn" onClick={queue.cancel}>
              Stop
            </button>
          </span>
        )}
        {accounts.length > 0 && (
          <span className="sync-pill">
            <span className="pro-dot" style={library.syncError ? { background: 'var(--loss)' } : undefined} />
            {library.syncing ? 'Syncing…' : library.syncError ? 'Sync failed' : lastSyncAt ? `${accounts.join(' & ')} synced ${timeAgo(lastSyncAt)}` : `${accounts.join(' & ')} connected`}
          </span>
        )}
        {accounts.length > 0 ? (
          <button type="button" className="btn btn--outline" onClick={sync} disabled={library.syncing}>
            {library.syncing ? 'Syncing…' : 'Sync now'}
          </button>
        ) : (
          <a className="btn btn--outline" href="#/settings/accounts">
            Connect account
          </a>
        )}
        <button type="button" className="btn btn--primary" onClick={() => setImportOpen(true)}>
          Import game
        </button>
      </header>

      <div className="content library">
        {library.syncError && <div className="library__error">{library.syncError}</div>}
        <div className="library__filters">
          <label className="library__search">
            <Icon name="search" size={15} stroke={2} />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
              placeholder="Search opponent or opening"
              aria-label="Search games"
            />
          </label>
          <Segmented
            variant="raised"
            options={(['all', 'bullet', 'blitz', 'rapid', 'classical'] as TimeFilter[]).map((v) => ({ value: v, label: v === 'all' ? 'All' : speedLabel(v) }))}
            value={tc}
            onChange={(v) => {
              setTc(v)
              setPage(0)
            }}
            label="Time control"
          />
          <div className="library__results">
            {(['W', 'L', 'D'] as const).map((r) => {
              const on = results.includes(r)
              return (
                <button
                  key={r}
                  type="button"
                  className={`result-toggle result-toggle--${r} ${on ? 'result-toggle--on' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    setResults((x) => (on ? x.filter((y) => y !== r) : [...x, r]))
                    setPage(0)
                  }}
                >
                  {r === 'W' ? 'Won' : r === 'L' ? 'Lost' : 'Drawn'}
                </button>
              )
            })}
          </div>
          <Segmented
            variant="raised"
            options={[
              { value: 'all' as Status, label: 'All' },
              { value: 'reviewed' as Status, label: 'Reviewed' },
              { value: 'unreviewed' as Status, label: 'Not reviewed' },
            ]}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            label="Review status"
          />
        </div>

        {sel.size > 0 && (
          <div className="library__selbar">
            <b>
              {sel.size} game{sel.size === 1 ? '' : 's'} selected
            </b>
            <button type="button" className="btn btn--primary btn--sm" onClick={reviewSelected}>
              Review selected
            </button>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => void deleteSelected()}>
              Remove
            </button>
            <button type="button" className="btn btn--quiet btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setSel(new Set())}>
              Clear
            </button>
          </div>
        )}

        <section className="library__table">
          {library.games.length === 0 ? (
            <div className="empty">
              <span className="empty__title">Your library is empty</span>
              <span>Import a PGN, paste a game link, or connect chess.com / Lichess to bring in your games automatically.</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--primary" onClick={() => setImportOpen(true)}>
                  Import a game
                </button>
                <a className="btn btn--outline" href="#/settings/accounts">
                  Connect an account
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="lib-grid lib-head">
                <Check on={allOn} onClick={toggleAll} label="Select all on this page" />
                <span>RESULT</span>
                <span>OPPONENT</span>
                <span>OPENING</span>
                <span>TIME</span>
                <span>MOVES</span>
                <span>ACCURACY</span>
                <span>ERRORS</span>
                <button type="button" className="lib-head__sort" onClick={() => setAsc((a) => !a)}>
                  DATE {asc ? '▴' : '▾'}
                </button>
                <span />
              </div>
              {rows.map((g) => (
                <LibraryRow key={g.id} game={g} selected={sel.has(g.id)} onToggle={() => toggle(g.id)} queued={queue.current === g.id || queue.pending.includes(g.id)} />
              ))}
              {rows.length === 0 && <div className="empty">No games match these filters.</div>}
              <div className="library__foot">
                <span>
                  Showing {rows.length} of {filtered.length} game{filtered.length === 1 ? '' : 's'}
                </span>
                {pages > 1 && (
                  <div className="pager">
                    <button type="button" className="pager__btn" onClick={() => setPage(cur - 1)} disabled={cur === 0} aria-label="Previous page">
                      ‹
                    </button>
                    {pageList(cur, pages).map((p, i) =>
                      p === null ? (
                        <span key={`gap${i}`} className="pager__gap">
                          …
                        </span>
                      ) : (
                        <button key={p} type="button" className={`pager__btn ${p === cur ? 'pager__btn--on' : ''}`} onClick={() => setPage(p)}>
                          {p + 1}
                        </button>
                      ),
                    )}
                    <button type="button" className="pager__btn" onClick={() => setPage(cur + 1)} disabled={cur >= pages - 1} aria-label="Next page">
                      ›
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {importOpen && (
        <Modal title="Import a game" onClose={() => setImportOpen(false)}>
          <ImportForm variant="modal" reviewOnLoad onDone={() => setImportOpen(false)} />
        </Modal>
      )}
    </div>
  )
}

function pageList(cur: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i)
  const out: (number | null)[] = [0]
  const lo = Math.max(1, cur - 1)
  const hi = Math.min(pages - 2, cur + 1)
  if (lo > 1) out.push(null)
  for (let i = lo; i <= hi; i++) out.push(i)
  if (hi < pages - 2) out.push(null)
  out.push(pages - 1)
  return out
}

function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`check ${on ? 'check--on' : ''}`} role="checkbox" aria-checked={on} aria-label={label} onClick={onClick}>
      {on ? '✓' : ''}
    </button>
  )
}

function LibraryRow({ game, selected, onToggle, queued }: { game: StoredGame; selected: boolean; onToggle: () => void; queued: boolean }) {
  const app = useApp()
  const color = userColorOf(game, app.names)
  const s = game.summary
  const side = color === 'w' ? 'white' : 'black'
  const opp = color === 'w' ? game.black : color === 'b' ? game.white : `${game.white} – ${game.black}`
  const oppElo = color === 'w' ? game.blackElo : color === 'b' ? game.whiteElo : undefined
  const acc = s ? (color ? s.accuracy[side] : null) : null
  const counts = s && color ? s.counts[side] : null
  return (
    <div className={`lib-grid lib-row ${selected ? 'lib-row--on' : ''}`}>
      <Check on={selected} onClick={onToggle} label={`Select game vs ${opp}`} />
      <ResultChip outcome={color ? outcomeFor(game.result, color) : null} result={game.result} />
      <div className="game-row__who">
        <span className="game-row__name">
          {color && <span className={`side-swatch side-swatch--${color}`} />}
          {opp} {oppElo && <span className="game-row__elo">({oppElo})</span>}
        </span>
        <small>{SOURCE_LABEL[game.source]}</small>
      </div>
      <div className="game-row__who">
        <span className="game-row__opening">{game.opening ?? '—'}</span>
        <small className="mono">{game.eco ?? ''}</small>
      </div>
      <div className="game-row__who">
        <span style={{ fontSize: 13 }}>{speedLabel(game.speed)}</span>
        {game.timeControl && <small>{tcShort(game.timeControl)}</small>}
      </div>
      <span className="lib-row__moves">{Math.ceil(game.plies / 2)}</span>
      {s && !color ? (
        <span className="lib-row__both" title="White / Black accuracy">
          {s.accuracy.white.toFixed(1)} / {s.accuracy.black.toFixed(1)}
        </span>
      ) : (
        <AccuracyCell value={acc} />
      )}
      <ErrorChips blunders={counts ? counts.blunder ?? 0 : null} mistakes={counts ? (counts.mistake ?? 0) + (counts.miss ?? 0) : null} dim={!counts} />
      <span className="lib-row__date">{game.yearOnly ? new Date(game.playedAt).getUTCFullYear() : shortDay(game.playedAt)}</span>
      {queued ? (
        <span className="lib-row__queued">
          <span className="spinner spinner--sm" /> Queued
        </span>
      ) : (
        <button type="button" className={`btn btn--sm ${s ? '' : 'btn--primary'}`} style={{ justifySelf: 'end' }} onClick={() => void app.openGame(game.id, { review: !s })}>
          {s ? 'Open' : 'Review'}
        </button>
      )}
    </div>
  )
}
