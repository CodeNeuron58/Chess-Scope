import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CcGame, CcProfile, CcStats } from '../chesscom/api'
import {
  dateLabel,
  fetchProfile,
  fetchRecentGames,
  fetchStats,
  myColor,
  opponentOf,
  resultFor,
  tcLabel,
} from '../chesscom/api'
import { cacheGet, cachePut } from '../chesscom/idb'
import './chesscomModal.css'

interface Props {
  onPick: (pgn: string) => void
  onClose: () => void
}

const MONTH_STEPS = [3, 6, 12, 24]
const PAGE = 25

interface CachedArchive {
  fetchedAt: number
  games: CcGame[]
}

export function ChesscomModal({ onPick, onClose }: Props) {
  const storedUser = useMemo(() => {
    try {
      return localStorage.getItem('chessscope.ccUser') ?? ''
    } catch {
      return ''
    }
  }, [])

  const [input, setInput] = useState(storedUser)
  const [proxy, setProxy] = useState(() => {
    try {
      return localStorage.getItem('chessscope.ccProxy') ?? ''
    } catch {
      return ''
    }
  })
  const [showProxy, setShowProxy] = useState(false)
  const [username, setUsername] = useState(storedUser)
  const [profile, setProfile] = useState<CcProfile | null>(null)
  const [stats, setStats] = useState<CcStats | null>(null)
  const [games, setGames] = useState<CcGame[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthStep, setMonthStep] = useState(0)
  const [page, setPage] = useState(1)
  const [tcFilter, setTcFilter] = useState('all')
  const [search, setSearch] = useState('')

  const connect = useCallback(async (user: string) => {
    const clean = user.trim()
    if (!clean) return
    setLoading(true)
    setError(null)
    let cachedProfile: CcProfile | null = null
    try {
      // serve cached profile instantly, then refresh
      cachedProfile = await cacheGet<CcProfile>(`profile:${clean.toLowerCase()}`)
      if (cachedProfile) setProfile(cachedProfile)
      const [p, s] = await Promise.all([fetchProfile(clean), fetchStats(clean)])
      setProfile(p)
      setStats(s)
      setUsername(clean)
      try {
        localStorage.setItem('chessscope.ccUser', clean)
        if (p) await cachePut(`profile:${clean.toLowerCase()}`, p)
      } catch {
        /* storage unavailable */
      }
    } catch (e) {
      if (!cachedProfile) setProfile(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // auto-connect from persisted username
  useEffect(() => {
    if (storedUser) void connect(storedUser)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadGames = useCallback(
    async (user: string, months: number) => {
      setLoading(true)
      setError(null)
      try {
        // stale-while-revalidate: show cache, refresh in background
        const now = new Date()
        const yms: string[] = []
        for (let i = 0; i < months; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          yms.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        }
        const cached = await Promise.all(yms.map((ym) => cacheGet<CachedArchive>(`archive:${user.toLowerCase()}:${ym}`)))
        const cachedGames = cached.flatMap((c) => c?.games ?? [])
        if (cachedGames.length > 0) setGames(cachedGames.sort((a, b) => b.end_time - a.end_time))
        const fresh = await fetchRecentGames(user, months)
        setGames(fresh)
        // Never let a flaky empty API response overwrite a non-empty cached month.
        yms.forEach((ym, i) => {
          const monthGames = fresh.filter((g) => {
            const d = new Date(g.end_time * 1000)
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === ym
          })
          const existing = cached[i]
          if (monthGames.length > 0 || !existing || existing.games.length === 0) {
            void cachePut(`archive:${user.toLowerCase()}:${ym}`, { fetchedAt: Date.now(), games: monthGames } satisfies CachedArchive)
          }
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // load games once connected
  useEffect(() => {
    if (username && profile) void loadGames(username, MONTH_STEPS[monthStep])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, profile, monthStep])

  const disconnect = () => {
    try {
      localStorage.removeItem('chessscope.ccUser')
    } catch {
      /* ignore */
    }
    setUsername('')
    setProfile(null)
    setStats(null)
    setGames([])
    setMonthStep(0)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return games.filter(
      (g) =>
        (tcFilter === 'all' || g.time_class === tcFilter) &&
        (!q || opponentOf(g, username).name.toLowerCase().includes(q)),
    )
  }, [games, tcFilter, search, username])

  const tcClasses = useMemo(() => ['all', ...new Set(games.map((g) => g.time_class))], [games])

  const disconnectBtn = (
    <button className="btn btn--ghost" onClick={disconnect}>
      Disconnect
    </button>
  )

  return (
    <div className="cc-modal__backdrop" onClick={onClose}>
      <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cc-modal__head">
          <span>♟ chess.com — your games</span>
          <button className="cc-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {!profile ? (
          <div className="cc-modal__connect">
            <p className="cc-modal__hint">
              Enter your chess.com username — the app reads your <b>public</b> game archive through
              chess.com's official API. No password, ever.
            </p>
            <div className="cc-modal__row">
              <input
                className="cc-modal__input"
                placeholder="chess.com username"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && connect(input)}
                spellCheck={false}
                autoFocus
              />
              <button className="btn btn--accent" disabled={!input.trim() || loading} onClick={() => connect(input)}>
                {loading ? 'Connecting…' : 'Connect'}
              </button>
            </div>
            <button className="cc-modal__link" onClick={() => setShowProxy((s) => !s)}>
              Advanced: proxy / blocked connection
            </button>
            {showProxy && (
              <div className="cc-modal__row">
                <input
                  className="cc-modal__input"
                  placeholder="Optional proxy base, e.g. https://my-worker.dev"
                  value={proxy}
                  onChange={(e) => {
                    setProxy(e.target.value)
                    try {
                      localStorage.setItem('chessscope.ccProxy', e.target.value)
                    } catch {
                      /* ignore */
                    }
                  }}
                  spellCheck={false}
                />
              </div>
            )}
            {error && <div className="cc-modal__error">{error}</div>}
          </div>
        ) : (
          <>
            <div className="cc-modal__profile">
              {profile.avatar && <img className="cc-modal__avatar" src={profile.avatar} alt="" />}
              <div className="cc-modal__who">
                <b>{profile.name || profile.username}</b>
                <span className="cc-modal__ratings">
                  {stats?.bullet ? `Bullet ${stats.bullet} · ` : ''}
                  {stats?.blitz ? `Blitz ${stats.blitz} · ` : ''}
                  {stats?.rapid ? `Rapid ${stats.rapid}` : ''}
                  {!stats?.bullet && !stats?.blitz && !stats?.rapid ? profile.username : ''}
                </span>
              </div>
              {disconnectBtn}
            </div>

            <div className="cc-modal__filters">
              <input
                className="cc-modal__input cc-modal__search"
                placeholder="Search opponent…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
              <select
                className="cc-modal__select"
                value={tcFilter}
                onChange={(e) => {
                  setTcFilter(e.target.value)
                  setPage(1)
                }}
              >
                {tcClasses.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'All time controls' : c}
                  </option>
                ))}
              </select>
            </div>

            {error && <div className="cc-modal__error">{error}</div>}

            <div className="cc-modal__list">
              {filtered.slice(0, page * PAGE).map((g) => {
                const opp = opponentOf(g, username)
                const res = resultFor(g, username)
                const acc = g.accuracies
                const myAcc = myColor(g, username) === 'w' ? acc?.white : acc?.black
                return (
                  <div className="cc-game" key={g.uuid}>
                    <span className={`cc-game__dot cc-game__dot--${res}`} />
                    <div className="cc-game__main">
                      <span className="cc-game__opp">
                        vs <b>{opp.name}</b> ({opp.rating})
                      </span>
                      <span className="cc-game__sub">
                        {tcLabel(g.time_control)} · {g.time_class} · {dateLabel(g.end_time)}
                        {myAcc !== undefined ? ` · chess.com acc ${myAcc.toFixed(1)}%` : ''}
                      </span>
                    </div>
                    <button className="btn btn--accent cc-game__review" onClick={() => onPick(g.pgn)}>
                      Review →
                    </button>
                  </div>
                )
              })}
              {filtered.length === 0 && !loading && (
                <div className="cc-modal__hint">No games found for these filters.</div>
              )}
              {loading && <div className="cc-modal__hint">Loading from chess.com…</div>}
            </div>

            <div className="cc-modal__foot">
              <span className="cc-modal__hint">
                {filtered.length} games{games.length !== filtered.length ? ` (of ${games.length})` : ''}
              </span>
              {monthStep < MONTH_STEPS.length - 1 && (
                <button
                  className="btn btn--ghost"
                  disabled={loading}
                  onClick={() => setMonthStep((s) => Math.min(s + 1, MONTH_STEPS.length - 1))}
                >
                  Load more history
                </button>
              )}
              {filtered.length > page * PAGE && (
                <button className="btn btn--ghost" onClick={() => setPage((p) => p + 1)}>
                  Show more
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
