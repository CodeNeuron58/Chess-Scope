import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Chess } from 'chess.js'
import { useApp } from '../state/context'
import { Segmented, Toggle } from '../components/controls'
import { StaticBoard } from '../components/StaticBoard'
import {
  BOARD_THEMES,
  CLASS_STYLE,
  DEPTH_OPTIONS,
  ENGINE_OPTIONS,
  PIECE_SETS,
  pieceUrl,
  type BoardThemeKey,
  type PieceSetKey,
} from '../lib/constants'
import { CLASSIFICATION_ORDER } from '../analysis/accuracy'
import type { ExplainLevel, LineCount } from '../hooks/useSettings'
import type { SyncSource } from '../hooks/useLibrary'
import { SAMPLE_GAMES } from '../samples'
import { timeAgo } from '../lib/format'
import { href } from '../router'
import './settingsPage.css'

const SECTIONS = [
  ['engine', 'Engine'],
  ['board', 'Board'],
  ['coach', 'Coach'],
  ['review', 'Review'],
  ['accounts', 'Accounts'],
  ['data', 'Your data'],
  ['about', 'About'],
] as const

function Row({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-row__text">
        <div className="set-row__title">{title}</div>
        {sub && <div className="set-row__sub">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export function SettingsPage() {
  const app = useApp()
  const { settings: s, route, library } = app
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const touch = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setSaved(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setSaved(false), 1600)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!route.section) return
    document.getElementById(`settings-${route.section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [route.section])

  const preview = useMemo(() => {
    const c = new Chess()
    c.loadPgn(SAMPLE_GAMES[0].pgn)
    const h = c.history({ verbose: true })
    return { fen: h[11].after, last: { from: h[11].from, to: h[11].to } }
  }, [])

  const reviewed = library.games.filter((g) => g.summary).length

  const exportLibrary = () => {
    const text = library.games.map((g) => g.pgn.trim()).join('\n\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'application/x-chess-pgn' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `owlchess-library-${new Date().toISOString().slice(0, 10)}.pgn`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar__heading">
          <span className="topbar__title">Settings</span>
        </div>
        <span className="set-saved" style={{ color: saved ? 'var(--win)' : 'var(--muted)' }} aria-live="polite">
          {saved ? '✓ Saved' : 'Changes save automatically'}
        </span>
      </header>
      <div className="content settings">
        <nav className="settings__nav" aria-label="Settings sections">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={href('settings', undefined, id)} className={route.section === id ? 'settings__nav--on' : ''}>
              {label}
            </a>
          ))}
        </nav>
        <div className="settings__body">
          <section id="settings-engine" className="card set-card">
            <div className="set-card__title">Engine</div>
            <Row title="Default engine" sub="Runs in your browser. Nothing is uploaded.">
              <Segmented options={ENGINE_OPTIONS.map((o) => ({ value: o.value, label: o.label, title: o.sub }))} value={s.engineChoice} onChange={touch(s.setEngineChoice)} label="Engine" />
            </Row>
            <Row title="Review depth" sub="Deeper is more accurate but slower. Standard (14) matches the calibrated accuracy scale.">
              <Segmented options={DEPTH_OPTIONS.map((o) => ({ value: o.value, label: `${o.label} (${o.value})`, title: o.sub }))} value={s.depth} onChange={touch(s.setDepth)} label="Depth" />
            </Row>
            <Row title="Engine lines" sub="How many best lines to show on the analysis board.">
              <Segmented size="tight" options={([1, 2, 3] as LineCount[]).map((n) => ({ value: n, label: String(n) }))} value={s.lines} onChange={touch(s.setLines)} label="Lines" />
            </Row>
          </section>

          <section id="settings-board" className="card set-card set-card--split">
            <div className="set-card__main">
              <div className="set-card__title">Board</div>
              <div className="set-row set-row--stack">
                <div className="set-row__title">Theme</div>
                <div className="swatches">
                  {(Object.keys(BOARD_THEMES) as BoardThemeKey[]).map((k) => {
                    const t = BOARD_THEMES[k]
                    return (
                      <button key={k} type="button" className={`swatch ${s.boardTheme === k ? 'swatch--on' : ''}`} onClick={() => touch(s.setBoardTheme)(k)} aria-pressed={s.boardTheme === k}>
                        <span className="swatch__board">
                          <span style={{ background: t.light }} />
                          <span style={{ background: t.dark }} />
                          <span style={{ background: t.dark }} />
                          <span style={{ background: t.light }} />
                        </span>
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="set-row set-row--stack">
                <div>
                  <div className="set-row__title">Pieces</div>
                  <div className="set-row__sub">Open-licensed sets. Licence shown under each.</div>
                </div>
                <div className="swatches">
                  {(Object.keys(PIECE_SETS) as PieceSetKey[]).map((k) => (
                    <button key={k} type="button" className={`piece-set ${s.pieceSet === k ? 'swatch--on' : ''}`} onClick={() => touch(s.setPieceSet)(k)} aria-pressed={s.pieceSet === k}>
                      <span className="piece-set__imgs">
                        <img src={pieceUrl(k, 'wN')} alt="" />
                        <img src={pieceUrl(k, 'bQ')} alt="" />
                      </span>
                      {PIECE_SETS[k].label}
                      <small>{PIECE_SETS[k].licence}</small>
                    </button>
                  ))}
                </div>
              </div>
              <Row title="Show coordinates" sub="Files and ranks on the board edge.">
                <Toggle on={s.coords} onChange={touch(s.setCoords)} label="Show coordinates" />
              </Row>
              <Row title="Animate moves" sub="Slide pieces when stepping through a game.">
                <Toggle on={s.animate} onChange={touch(s.setAnimate)} label="Animate moves" />
              </Row>
              <Row title="Move sounds" sub="A short sound for moves, captures and checks.">
                <Toggle on={s.sounds} onChange={touch(s.setSounds)} label="Move sounds" />
              </Row>
            </div>
            <div className="set-card__preview">
              <span className="eyebrow">Preview</span>
              <StaticBoard fen={preview.fen} lastMove={preview.last} coords={s.coords} arrows={[{ from: 'f3', to: 'b3' }]} />
            </div>
          </section>

          <section id="settings-coach" className="card set-card">
            <div className="set-card__title">Coach</div>
            <Row title="Coach voice" sub="Read explanations aloud during the guided review.">
              <Toggle on={s.audioOn} onChange={touch(s.setAudioOn)} label="Coach voice" />
            </Row>
            <Row title="Auto-advance" sub="With the voice on, move to the next position after each explanation.">
              <Toggle on={s.autoAdvance} onChange={touch(s.setAutoAdvance)} label="Auto-advance" />
            </Row>
            <Row title="Explanation level" sub="How much detail the coach gives on each move.">
              <Segmented
                options={[
                  { value: 'brief' as ExplainLevel, label: 'Brief' },
                  { value: 'balanced' as ExplainLevel, label: 'Balanced' },
                  { value: 'detailed' as ExplainLevel, label: 'Detailed' },
                ]}
                value={s.explainLevel}
                onChange={touch(s.setExplainLevel)}
                label="Explanation level"
              />
            </Row>
          </section>

          <section id="settings-review" className="card set-card">
            <div className="set-card__title">Review</div>
            <Row title="Auto-review new games" sub="Up to 5 newly synced games are reviewed in the background.">
              <Toggle on={s.autoReview} onChange={touch(s.setAutoReview)} label="Auto-review new games" />
            </Row>
            <Row title="Keyboard shortcuts" sub="← → to navigate, Home / End to jump, F to flip, X for threats.">
              <Toggle on={s.keyboard} onChange={touch(s.setKeyboard)} label="Keyboard shortcuts" />
            </Row>
            <div className="set-row set-row--stack">
              <div className="set-row__title">Move classifications</div>
              <div className="legend-grid">
                {CLASSIFICATION_ORDER.map((c) => (
                  <div key={c} className="legend-grid__item">
                    <span className="class-chip" style={{ background: CLASS_STYLE[c].color, height: 20, minWidth: 26, fontSize: 11 }}>
                      {CLASS_STYLE[c].glyph}
                    </span>
                    <div>
                      <b>{CLASS_STYLE[c].label}</b>
                      <small>{CLASS_STYLE[c].desc}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="settings-accounts" className="card set-card">
            <div className="set-card__title">Connected accounts</div>
            <p className="set-row__sub" style={{ marginBottom: 6 }}>
              Public games only, read through each site’s official API. No passwords. Your username also tells Owlchess which side you played.
            </p>
            <AccountSetting source="chesscom" label="chess.com" badge="cc" />
            <AccountSetting source="lichess" label="Lichess" badge="Li" />
            <Row
              title="Lichess API token (optional)"
              sub={
                <>
                  Unlocks the Masters and Lichess databases in the Explorer. Create a free token with no scopes at{' '}
                  <a href="https://lichess.org/account/oauth/token" target="_blank" rel="noreferrer">
                    lichess.org/account/oauth/token
                  </a>
                  . Stored only in this browser.
                </>
              }
            >
              <input
                className="input input--pill set-input"
                type="password"
                autoComplete="off"
                placeholder="lip_…"
                value={s.accounts.lichessToken}
                onChange={(e) => touch(s.setAccounts)({ ...s.accounts, lichessToken: e.target.value.trim() })}
                aria-label="Lichess API token"
              />
            </Row>
            <details className="set-advanced">
              <summary>Advanced: chess.com proxy</summary>
              <Row title="Proxy base URL" sub="Only if chess.com blocks direct requests from your network (403 errors).">
                <input
                  className="input input--pill set-input"
                  placeholder="https://my-worker.example.dev"
                  value={s.accounts.chesscomProxy}
                  onChange={(e) => touch(s.setAccounts)({ ...s.accounts, chesscomProxy: e.target.value })}
                  aria-label="chess.com proxy base URL"
                />
              </Row>
            </details>
          </section>

          <section id="settings-data" className="card set-card">
            <div className="set-card__title">Your data</div>
            <Row
              title="Library"
              sub={`${library.games.length} game${library.games.length === 1 ? '' : 's'}, ${reviewed} reviewed — stored only in this browser.`}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--outline btn--sm" onClick={exportLibrary} disabled={library.games.length === 0}>
                  Export PGN
                </button>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  disabled={library.games.length === 0}
                  onClick={() => {
                    if (window.confirm('Remove every game and review from this browser? This cannot be undone.')) {
                      void library.clear().then(() => app.toast('Library cleared'))
                    }
                  }}
                >
                  Clear library
                </button>
              </div>
            </Row>
          </section>

          <section id="settings-about" className="card set-card">
            <div className="set-card__title">About Owlchess</div>
            <p className="about-text">
              Owlchess reviews your games entirely in your browser — the engine, your library and your drills never leave this device. The only network
              requests are to chess.com and Lichess when you import games, and to Lichess’ explorer if you add a token.
            </p>
            <div className="credits">
              <div>
                <b>Engine</b>
                <span>Stockfish 19 and 16 (WebAssembly builds) — GPL-3.0</span>
              </div>
              {(Object.keys(PIECE_SETS) as PieceSetKey[]).map((k) => (
                <div key={k}>
                  <b>{PIECE_SETS[k].label} pieces</b>
                  <span>
                    {PIECE_SETS[k].author} — {PIECE_SETS[k].licence}
                  </span>
                </div>
              ))}
              <div>
                <b>Chess rules</b>
                <span>chess.js — BSD-2-Clause · board: react-chessboard — MIT</span>
              </div>
              <div>
                <b>Fonts</b>
                <span>Figtree and JetBrains Mono — SIL Open Font License</span>
              </div>
            </div>
            <p className="set-row__sub">Not affiliated with chess.com or Lichess.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

function AccountSetting({ source, label, badge }: { source: SyncSource; label: string; badge: string }) {
  const app = useApp()
  const { settings: s, library } = app
  const current = s.accounts[source]
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const connect = async () => {
    const user = name.trim()
    if (!user) return
    setBusy(true)
    setError('')
    const accounts = { ...s.accounts, [source]: user }
    s.setAccounts(accounts)
    const { fresh, error: err } = await library.sync(source, accounts)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setName('')
    app.toast(`${label} connected · ${fresh.length} games imported`)
    if (s.autoReview && fresh.length) app.queue.enqueue(fresh.slice(0, 5))
  }
  const synced = library.lastSync[source]
  return (
    <div className="set-row">
      <span className="account-badge">{badge}</span>
      <div className="set-row__text">
        <div className="set-row__title">{current ? `${label} · ${current}` : label}</div>
        <div className="set-row__sub" style={current ? { color: 'var(--win)' } : undefined}>
          {error ? <span style={{ color: 'var(--loss)' }}>{error}</span> : current ? `● Connected${synced ? ` · synced ${timeAgo(synced)}` : ''}` : 'Not connected'}
        </div>
      </div>
      {current ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            disabled={library.syncing}
            onClick={() => void library.sync(source).then(({ fresh, error: err }) => app.toast(err || `${label} synced · ${fresh.length} new`))}
          >
            {library.syncing ? 'Syncing…' : 'Sync'}
          </button>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => s.setAccounts({ ...s.accounts, [source]: '' })}>
            Disconnect
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input input--pill set-input"
            placeholder={`${label} username`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void connect()}
            aria-label={`${label} username`}
          />
          <button type="button" className="btn btn--primary btn--sm" onClick={() => void connect()} disabled={!name.trim() || busy}>
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      )}
    </div>
  )
}
