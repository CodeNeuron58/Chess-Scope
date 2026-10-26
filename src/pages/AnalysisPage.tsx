import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { useApp } from '../state/context'
import { useBoardKeys, useBoardSize, useLiveAnalysis, useThreats } from '../hooks'
import { formatEval, winPercent } from '../analysis/accuracy'
import { openingName } from '../analysis/openings'
import { ENGINE_OPTIONS, LIVE_MAX_DEPTH, PALETTE } from '../lib/constants'
import { formatLine, startPly } from '../lib/chessUtils'
import { buildExplorerIndex, lookupExplorer, type ExplorerIndex } from '../library/explorer'
import { fetchExplorer, type ExplorerDb, type ExplorerResult } from '../library/lichess'
import { isStandardStart } from '../library/pgnMeta'
import { revealInList } from '../lib/format'
import { Board, type BoardArrow } from '../components/Board'
import { EvalBar } from '../components/EvalBar'
import { PlayerBar } from '../components/PlayerBar'
import { Modal, Popover, Segmented, Toggle } from '../components/controls'
import { DotsIcon, Icon } from '../components/Icon'
import { ImportForm } from '../components/ImportForm'
import type { LineCount } from '../hooks/useSettings'
import './boardPage.css'
import './analysisPage.css'

type ExplorerSource = 'mine' | ExplorerDb

function gameEndText(fen: string): string | null {
  try {
    const c = new Chess(fen)
    if (c.isCheckmate()) return c.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
    if (c.isStalemate()) return 'Draw by stalemate'
    if (c.isInsufficientMaterial()) return 'Draw · insufficient material'
    if (c.isDraw()) return 'Draw'
  } catch {
    return null
  }
  return null
}

export function AnalysisPage() {
  const app = useApp()
  const { game, settings, review: rv, currentGame } = app
  const total = game.moves.length
  const ply = Math.min(game.ply, total)
  const fen = game.fens[ply] ?? game.fens[0]
  const [tab, setTab] = useState<'engine' | 'explorer'>('engine')
  const [showLoad, setShowLoad] = useState(false)
  const boardSize = useBoardSize({ reserveH: 56 + 38 + 96 })
  const flipped = settings.orientation === 'black'
  const whiteToMove = fen.split(' ')[1] !== 'b'
  const ended = gameEndText(fen)

  const live = useLiveAnalysis({
    fen,
    enabled: app.liveEngine && !rv.reviewing && !rv.refining && !ended,
    engineChoice: settings.engineChoice,
    getEngine: app.getEngine,
    lines: settings.lines,
  })
  const threats = useThreats({ blocked: rv.reviewing || rv.refining || app.liveEngine, displayedFen: fen, engineChoice: settings.engineChoice, getEngine: app.getEngine })
  const lines = (live.result?.lines ?? []).slice(0, settings.lines)
  const top = live.result?.lines[0]
  const evalCp = top?.whiteCp ?? live.result?.whiteCp
  const evalText = evalCp !== undefined ? formatEval(evalCp, top?.mateIn ?? live.result?.mateIn) : ''

  /** Step forward along the game when the move is the game's next one; otherwise branch. */
  const play = (uci: string) => {
    const next = game.moves[ply]
    if (next && next.lan === uci) {
      game.setPly(ply + 1)
      return true
    }
    const promo = uci.length > 4 ? uci[4] : undefined
    const deviates = ply < total
    const ok = game.makeMove(uci.slice(0, 2), uci.slice(2, 4), promo)
    if (ok && deviates && currentGame) app.toast('New line started · the original stays in your Library')
    return ok
  }

  const go = (p: number) => game.setPly(Math.max(0, Math.min(total, p)))
  useBoardKeys(
    {
      prev: () => go(ply - 1),
      next: () => go(ply + 1),
      first: () => go(0),
      last: () => go(total),
      flip: settings.toggleOrientation,
      threat: threats.toggleThreat,
    },
    settings.keyboard,
  )

  const arrows: BoardArrow[] = []
  if (app.liveEngine && top) arrows.push({ from: top.uciFirst.slice(0, 2), to: top.uciFirst.slice(2, 4) })
  if (threats.threatOn && threats.threat) arrows.push({ from: threats.threat.uciFirst.slice(0, 2), to: threats.threat.uciFirst.slice(2, 4), color: PALETTE.arrowThreat })
  const lastMove = ply > 0 ? { from: game.moves[ply - 1].from, to: game.moves[ply - 1].to } : null

  const sans = useMemo(() => game.moves.map((m) => m.san), [game.moves])
  const base = startPly(game.startFen)
  const title = total === 0 && isStandardStart(game.startFen) ? 'Empty board' : `${game.players.white} vs ${game.players.black}`
  const opening = isStandardStart(game.startFen) ? openingName(sans.slice(0, ply)) : null
  const engineLabel = ENGINE_OPTIONS.find((e) => e.value === settings.engineChoice)?.short ?? 'Stockfish'

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      app.toast(`${what} copied`)
    } catch {
      app.toast('Clipboard unavailable')
    }
  }

  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    revealInList(activeRef.current)
  }, [ply])

  const reviewThis = () => {
    app.navigate('review')
    if (!rv.review && total > 0) void rv.startReview()
  }

  return (
    <div className="page page--board">
      <header className="topbar">
        <div className="topbar__heading">
          <span className="topbar__title">Analysis board</span>
          <span className="topbar__sub">{[title, opening].filter(Boolean).join(' · ')}</span>
        </div>
        <label className="engine-switch" title={app.liveEngine ? 'Turn the engine off' : 'Turn the engine on'}>
          <Toggle on={app.liveEngine} onChange={app.setLiveEngine} label="Engine" size="sm" />
          {app.liveEngine ? engineLabel : 'Engine off'}
        </label>
        <Popover
          trigger={({ toggle }) => (
            <button type="button" className="icon-btn" onClick={toggle} title="Board options" aria-label="Board options">
              <DotsIcon />
            </button>
          )}
        >
          {(close) => {
            const item = (label: string, icon: Parameters<typeof Icon>[0]['name'], on: () => void, key = '', disabled = false) => (
              <button
                type="button"
                className="menu__item"
                disabled={disabled}
                onClick={() => {
                  close()
                  on()
                }}
              >
                <Icon name={icon} />
                <span className="menu__text">{label}</span>
                <span className="menu__key">{key}</span>
              </button>
            )
            return (
              <>
                {item('Flip board', 'flip', settings.toggleOrientation, 'F')}
                {item('Show threats', 'threat', threats.toggleThreat, 'X', app.liveEngine)}
                {item('Copy FEN', 'copy', () => void copy(fen, 'FEN'))}
                {item('Copy PGN', 'copy', () => void copy(game.pgn(), 'PGN'), '', total === 0)}
                {item('Load PGN, link or FEN', 'upload', () => setShowLoad(true))}
                {item(currentGame ? 'Saved in Library' : 'Save to Library', 'save', () => app.saveCurrent() && app.toast('Saved to your Library'), '', !!currentGame || total === 0)}
                {item('New board', 'plus', app.newBoard)}
              </>
            )
          }}
        </Popover>
        <button type="button" className="btn btn--primary" onClick={reviewThis} disabled={total === 0}>
          Review this game
        </button>
      </header>

      <div className="board-page">
        <div className="board-col">
          <PlayerBar color={flipped ? 'w' : 'b'} name={flipped ? game.players.white : game.players.black} fen={fen} turn={flipped ? whiteToMove : !whiteToMove} />
          <div className="board-row">
            <EvalBar whiteWin={app.liveEngine && evalCp !== undefined ? winPercent(evalCp) : null} evalText={evalText} height={boardSize} flipped={flipped} />
            <Board fen={fen} width={boardSize} orientation={settings.orientation} lastMove={lastMove} arrows={arrows} interactive onMove={(f, t, p) => play(`${f}${t}${p ?? ''}`)} />
          </div>
          <PlayerBar color={flipped ? 'b' : 'w'} name={flipped ? game.players.black : game.players.white} fen={fen} turn={flipped ? !whiteToMove : whiteToMove} />
        </div>

        <aside className="panel" aria-label="Analysis panel">
          <div className="panel__tabs">
            <Segmented
              options={[
                { value: 'engine', label: 'Engine' },
                { value: 'explorer', label: 'Explorer' },
              ]}
              value={tab}
              onChange={setTab}
              label="Panel"
            />
            <span className="panel__meta">{ply === 0 ? 'Start' : `Move ${Math.ceil(ply / 2)} · ${whiteToMove ? 'White' : 'Black'} to move`}</span>
          </div>

          {tab === 'engine' ? (
            <>
              <div className="panel__section">
                <div className="engine-head">
                  <span className="engine-head__eval">{ended ? '—' : app.liveEngine && evalText ? evalText : '–'}</span>
                  <div className="engine-head__depth">
                    <span>{ended ?? (!app.liveEngine ? 'Off' : rv.reviewing || rv.refining ? 'Paused during review' : live.error ? live.error : `Depth ${live.depth} of ${LIVE_MAX_DEPTH}`)}</span>
                    <span className="meter" style={{ flex: 'none', height: 3 }}>
                      <span className="meter__fill" style={{ width: app.liveEngine && !ended ? `${(live.depth / LIVE_MAX_DEPTH) * 100}%` : '0%' }} />
                    </span>
                  </div>
                  <Segmented
                    size="tight"
                    options={([1, 2, 3] as LineCount[]).map((n) => ({ value: n, label: String(n), title: `${n} line${n > 1 ? 's' : ''}` }))}
                    value={settings.lines}
                    onChange={settings.setLines}
                    label="Engine lines"
                  />
                </div>
                {!app.liveEngine && <p className="field-hint">Engine is off. Switch it on in the top bar.</p>}
                {app.liveEngine && !ended && lines.length === 0 && <p className="field-hint">Thinking…</p>}
                {app.liveEngine &&
                  lines.map((l, i) => (
                    <button key={i} type="button" className="pv-line" onClick={() => play(l.uciFirst)} title="Play this line’s first move">
                      <span className={`pv-eval ${i === 0 ? 'pv-eval--best' : ''}`}>{formatEval(l.whiteCp, l.mateIn)}</span>
                      <span className="pv-text">{formatLine(l.pvSan, base + ply, 10)}</span>
                    </button>
                  ))}
              </div>
              <div className="panel__scroll analysis-moves">
                <div className="analysis-moves__title">Moves</div>
                {total === 0 ? (
                  <p className="field-hint">Drag a piece or click a square to play. Load a game from the ⋯ menu.</p>
                ) : (
                  <div className="tokens">
                    {game.moves.map((m, i) => {
                      const p = base + i
                      return (
                      <span key={i} className="tokens__pair">
                        {(p % 2 === 0 || i === 0) && <span className="tokens__num">{Math.floor(p / 2) + 1}{p % 2 === 0 ? '.' : '…'}</span>}
                        <button type="button" ref={ply - 1 === i ? activeRef : undefined} className={`tokens__move ${ply - 1 === i ? 'tokens__move--on' : ''}`} onClick={() => go(i + 1)}>
                          {m.san}
                        </button>
                      </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <ExplorerTab fen={fen} sans={sans.slice(0, ply)} onPlay={play} />
          )}

          <div className="panel__nav">
            <button type="button" className="nav-btn" title="Start (Home)" onClick={() => go(0)} disabled={ply === 0}>
              <Icon name="first" />
            </button>
            <button type="button" className="nav-btn" title="Back (←)" onClick={() => go(ply - 1)} disabled={ply === 0}>
              <Icon name="prev" stroke={2} />
            </button>
            <button type="button" className="nav-btn nav-btn--grow" title="Next move (→)" onClick={() => go(ply + 1)} disabled={ply >= total}>
              Next
              <Icon name="next" size={15} stroke={2.4} />
            </button>
            <button type="button" className="nav-btn" title="Last move (End)" onClick={() => go(total)} disabled={ply >= total}>
              <Icon name="last" />
            </button>
          </div>
        </aside>
      </div>

      {showLoad && (
        <Modal title="Load a game or position" onClose={() => setShowLoad(false)}>
          <ImportForm variant="modal" reviewOnLoad={false} onDone={() => setShowLoad(false)} />
        </Modal>
      )}
    </div>
  )
}

function ExplorerTab({ fen, sans, onPlay }: { fen: string; sans: string[]; onPlay: (uci: string) => boolean }) {
  const app = useApp()
  const token = app.settings.accounts.lichessToken.trim()
  const [source, setSource] = useState<ExplorerSource>('mine')
  const [remote, setRemote] = useState<{ key: string; data?: ExplorerResult; error?: string } | null>(null)

  const index = useMemo<ExplorerIndex>(() => buildExplorerIndex(app.library.games, app.names), [app.library.games, app.names])
  const local = useMemo(() => lookupExplorer(index, fen), [index, fen])

  const key = `${source}|${fen}`
  useEffect(() => {
    if (source === 'mine' || !token) return
    let alive = true
    fetchExplorer(source, fen, token)
      .then((data) => alive && setRemote({ key, data }))
      .catch((e: unknown) => alive && setRemote({ key, error: e instanceof Error ? e.message : String(e) }))
    return () => {
      alive = false
    }
  }, [source, fen, token, key])

  const remoteNow = remote && remote.key === key ? remote : null
  const rows =
    source === 'mine'
      ? local.moves.map((m) => ({ uci: m.uci, san: m.san, n: m.total, w: m.white, d: m.draws, b: m.black }))
      : (remoteNow?.data?.moves ?? []).map((m) => ({ uci: m.uci, san: m.san, n: m.white + m.draws + m.black, w: m.white, d: m.draws, b: m.black }))
  const name = remoteNow?.data?.opening?.name ?? openingName(sans) ?? (sans.length === 0 ? 'Starting position' : 'Unnamed position')
  const eco = remoteNow?.data?.opening?.eco
  const next = app.game.moves[sans.length]?.lan
  const count = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n))
  const pct = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0)

  return (
    <div className="panel__scroll explorer">
      <div>
        <div className="explorer__name">{name}</div>
        {eco && <div className="explorer__eco mono">{eco}</div>}
      </div>
      <Segmented
        size="sm"
        options={[
          { value: 'mine', label: 'My games' },
          { value: 'masters', label: 'Masters' },
          { value: 'lichess', label: 'Lichess' },
        ]}
        value={source}
        onChange={setSource}
        label="Database"
      />
      {source !== 'mine' && !token ? (
        <div className="explorer__note">
          Lichess now asks for a free personal API token to use its opening explorer. Add one in{' '}
          <a href="#/settings/accounts">Settings → Accounts</a> to see master and online games here.
        </div>
      ) : source !== 'mine' && remoteNow?.error ? (
        <div className="explorer__note">{remoteNow.error}</div>
      ) : source !== 'mine' && !remoteNow ? (
        <div className="explorer__note">
          <span className="spinner spinner--sm" /> Loading…
        </div>
      ) : (
        <div className="explorer__table">
          <div className="explorer__row explorer__row--head">
            <span>Move</span>
            <span>Games</span>
            <span>White · Draw · Black</span>
          </div>
          {rows.map((r) => {
            const w = pct(r.w, r.n)
            const d = pct(r.d, r.n)
            return (
              <button key={r.uci} type="button" className={`explorer__row ${r.uci === next ? 'explorer__row--next' : ''}`} onClick={() => onPlay(r.uci)}>
                <b>{r.san}</b>
                <span className="explorer__n">{count(r.n)}</span>
                <span className="wdl">
                  <span className="wdl__w" style={{ width: `${w}%` }}>
                    {w >= 12 ? `${w}%` : ''}
                  </span>
                  <span className="wdl__d" style={{ width: `${d}%` }}>
                    {d >= 12 ? `${d}%` : ''}
                  </span>
                  <span className="wdl__b">{100 - w - d >= 12 ? `${100 - w - d}%` : ''}</span>
                </span>
              </button>
            )
          })}
          {rows.length === 0 && (
            <p className="explorer__note">
              {source === 'mine' ? 'None of your library games reached this position.' : 'Out of book. No games in this database reached this position.'}
            </p>
          )}
        </div>
      )}
      <div className="explorer__mine">
        <div>
          <div className="explorer__mine-title">Your games from here</div>
          <div className="field-hint">
            {local.reached === 0
              ? 'No library games reached this position yet'
              : `${local.reached} game${local.reached === 1 ? '' : 's'}${local.userGames ? ` · you scored ${local.userPoints} / ${local.userGames}` : ''}`}
          </div>
        </div>
        <a href="#/drills" className="link-btn">
          Train it
        </a>
      </div>
    </div>
  )
}
