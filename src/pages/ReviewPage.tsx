import { useEffect, useMemo, useRef, useState } from 'react'
import type { Classification, MoveReview, ReviewResult } from '../types'
import { useApp } from '../state/context'
import { useBoardKeys, useBoardSize, useCoachMode, useThreats } from '../hooks'
import { downloadText, useEngineDownload } from '../hooks/useEngineDownload'
import { coachText } from '../hooks/useCoachMode'
import { CLASSIFICATION_ORDER, formatEval, winPercent } from '../analysis/accuracy'
import { funFactFor } from '../analysis/coach'
import { buildReviewedPgn } from '../analysis/pgnExport'
import { openingName } from '../analysis/openings'
import { CLASS_STYLE, DEPTH_OPTIONS, ENGINE_OPTIONS, KEY_CLASSES, PALETTE } from '../lib/constants'
import { displayResult, formatLine, gameResult, startPly } from '../lib/chessUtils'
import { moveLabel } from '../library/stats'
import { revealInList } from '../lib/format'
import { outcomeFor } from '../library/pgnMeta'
import { Board, type BoardArrow } from '../components/Board'
import { EvalBar } from '../components/EvalBar'
import { EvalGraph } from '../components/EvalGraph'
import { PlayerBar } from '../components/PlayerBar'
import { ClassChip, Modal, Popover, Segmented } from '../components/controls'
import { DotsIcon, Icon } from '../components/Icon'
import { ImportForm } from '../components/ImportForm'
import { AdvancedModal, SkillsModal } from '../components/GameStatsModals'
import './boardPage.css'
import './reviewPage.css'

const SHORTCUTS = '← → move · Home / End jump · F flip · X threats · Esc close'

/** One-line reason a move is a key moment. */
function momentText(mr: MoveReview, result: ReviewResult): string {
  const best = result.positions[mr.ply - 1]?.lines[0]?.pvSan[0]
  switch (mr.classification) {
    case 'brilliant':
      return 'A sacrifice that works'
    case 'great':
      return 'The only good move here'
    case 'miss':
      return best ? `Missed ${best}` : 'Missed a winning chance'
    default:
      return best ? `Better was ${best}` : CLASS_STYLE[mr.classification].desc
  }
}

export function ReviewPage() {
  const app = useApp()
  const { game, review: rv, settings, currentGame } = app
  const result = rv.review
  const total = game.moves.length
  const ply = Math.min(game.ply, total)
  const tab = app.reviewTab
  const [filter, setFilter] = useState<'all' | 'key'>('all')
  const [moreLines, setMoreLines] = useState(false)
  const [showLoad, setShowLoad] = useState(false)
  const [modal, setModal] = useState<'skills' | 'advanced' | null>(null)
  const boardSize = useBoardSize({ reserveH: 56 + 38 + 96 })

  const empty = total === 0 && game.fens.length === 1 && game.startFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')
  const mode = rv.reviewing ? 'reviewing' : result ? 'report' : empty ? 'empty' : 'loaded'
  const flipped = settings.orientation === 'black'
  const fen = game.fens[ply] ?? game.fens[0]
  const position = result?.positions[ply] ?? null
  const movesTab = mode !== 'empty' && tab === 'moves'

  // engine download progress (the full engine is ~99 MB the first time)
  const download = useEngineDownload()
  const downloading = !!download && download.status === 'downloading' && download.choice === settings.engineChoice
  const downloadPct = download ? Math.round((download.loaded / Math.max(1, download.total)) * 100) : 0
  const overlayDownload = download && download.status === 'downloading' ? download : null

  const coach = useCoachMode({
    ply,
    setPly: game.setPly,
    moves: game.moves,
    review: result,
    active: movesTab && app.route.page === 'review',
    audioOn: settings.audioOn,
    autoAdvance: settings.autoAdvance,
    level: settings.explainLevel,
  })
  const threats = useThreats({ blocked: rv.reviewing || rv.refining, displayedFen: fen, engineChoice: settings.engineChoice, getEngine: app.getEngine })

  const go = (p: number) => {
    if (mode === 'empty' || mode === 'reviewing') return
    const next = Math.max(0, Math.min(total, p))
    if (next !== ply && mode === 'report' && tab === 'summary') app.setReviewTab('moves')
    game.setPly(next)
  }

  useBoardKeys(
    {
      prev: () => go(ply - 1),
      next: () => go(ply + 1),
      first: () => go(0),
      last: () => go(total),
      flip: settings.toggleOrientation,
      threat: threats.toggleThreat,
      escape: () => setShowLoad(false),
    },
    settings.keyboard,
  )

  // a game is waiting to be reviewed: load the engines now so Review starts instantly
  const { warmEngines } = app
  useEffect(() => {
    if (mode === 'loaded' && total > 0) warmEngines()
  }, [mode, total, warmEngines])

  // keep the active move visible
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    revealInList(activeRef.current)
  }, [ply, tab, filter])

  const sans = useMemo(() => game.moves.map((m) => m.san), [game.moves])
  const opening = currentGame?.opening ?? openingName(sans)
  const white = game.players.white
  const black = game.players.black
  const resultText = mode === 'empty' ? '' : displayResult(game.headers, game.gameRef.current)
  const year = game.headers.Date?.slice(0, 4)
  const sub = [game.headers.Event && game.headers.Event !== '?' ? game.headers.Event : null, year && /^\d{4}$/.test(year) ? year : null, opening]
    .filter(Boolean)
    .join(' · ')

  const engineLabel = ENGINE_OPTIONS.find((e) => e.value === settings.engineChoice)?.short ?? 'Stockfish'
  const evalText = position ? formatEval(position.whiteCp, position.mateIn) : ''

  // board decorations
  const lastMove = ply > 0 ? { from: game.moves[ply - 1].from, to: game.moves[ply - 1].to } : null
  const mark = result && ply > 0 && result.moves[ply - 1] ? { square: game.moves[ply - 1].to, cls: result.moves[ply - 1].classification } : null
  const arrows: BoardArrow[] = [...coach.revealArrows]
  if (result && position?.bestUci && !gameOver(fen)) arrows.push({ from: position.bestUci.slice(0, 2), to: position.bestUci.slice(2, 4) })
  if (threats.threatOn && threats.threat) {
    arrows.push({ from: threats.threat.uciFirst.slice(0, 2), to: threats.threat.uciFirst.slice(2, 4), color: PALETTE.arrowThreat })
  }

  const onMove = (from: string, to: string, promotion?: string) => {
    if (rv.reviewing) return false
    const deviates = ply < total
    const ok = game.makeMove(from, to, promotion)
    if (ok && deviates && currentGame) app.toast('New line started · the original stays in your Library')
    return ok
  }

  const copyPgn = async () => {
    if (total === 0) {
      app.toast('Nothing to copy yet')
      return
    }
    try {
      const text = result ? buildReviewedPgn(result.moves, game.players, gameResult(game.gameRef.current), game.fens[0]) : game.pgn()
      await navigator.clipboard.writeText(text)
      app.toast(result ? 'PGN copied with move ratings' : 'PGN copied')
    } catch {
      app.toast('Clipboard unavailable')
    }
  }

  const primary =
    mode === 'reviewing'
      ? { label: 'Cancel', cls: 'btn--danger', on: rv.cancelReview }
      : rv.refining
        ? { label: 'Stop refining', cls: 'btn--outline', on: rv.cancelReview }
      : mode === 'report'
        ? { label: 'Re-run review', cls: '', on: () => void rv.startReview() }
        : { label: 'Review game', cls: 'btn--primary', on: () => (mode === 'empty' ? setShowLoad(true) : void rv.startReview()) }

  const userColor = currentGame?.userColor
  const accuracy = (c: 'w' | 'b') => (result ? (c === 'w' ? result.whiteAccuracy : result.blackAccuracy) : null)
  const topColor = flipped ? 'w' : 'b'
  const bottomColor = flipped ? 'b' : 'w'
  const elo = (c: 'w' | 'b') => (c === 'w' ? game.headers.WhiteElo : game.headers.BlackElo)?.replace('?', '')

  return (
    <div className="page page--board">
      <header className="topbar">
        <div className="topbar__heading">
          <span className="topbar__title">{mode === 'empty' ? 'New board' : `${white} vs ${black}`}</span>
          {resultText && <span className="topbar__chip">{resultText}</span>}
          {mode !== 'empty' && sub && <span className="topbar__sub">{sub}</span>}
          {userColor && <span className="topbar__sub">· you played {userColor === 'w' ? 'White' : 'Black'}</span>}
        </div>
        <Popover
          width={280}
          trigger={({ toggle }) => (
            <button type="button" className="btn btn--quiet" onClick={toggle} title="Engine and depth" disabled={rv.reviewing || rv.refining}>
              <span className="pro-dot" />
              {engineLabel} · depth {settings.depth}
              <Icon name="down" size={11} stroke={2.6} />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="menu__label">ENGINE</div>
              {ENGINE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`menu__item ${o.value === settings.engineChoice ? 'menu__item--on' : ''}`}
                  onClick={() => {
                    settings.setEngineChoice(o.value)
                    app.toast(`${o.label} selected`)
                    close()
                  }}
                >
                  <span className="menu__text">
                    {o.label}
                    <span className="menu__sub">{o.sub}</span>
                  </span>
                  {o.value === settings.engineChoice && <span className="menu__check">✓</span>}
                </button>
              ))}
              <div className="menu__sep" />
              <div className="menu__label">DEPTH</div>
              {DEPTH_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`menu__item ${o.value === settings.depth ? 'menu__item--on' : ''}`}
                  onClick={() => {
                    settings.setDepth(o.value)
                    app.toast(`${o.label} depth (${o.value}) selected`)
                    close()
                  }}
                >
                  <span className="menu__text">
                    {o.label} ({o.value})<span className="menu__sub">{o.sub}</span>
                  </span>
                  {o.value === settings.depth && <span className="menu__check">✓</span>}
                </button>
              ))}
            </>
          )}
        </Popover>
        <Popover
          trigger={({ toggle }) => (
            <button type="button" className="icon-btn" onClick={toggle} title="Game options" aria-label="Game options">
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
                {item('Load PGN or link', 'upload', () => setShowLoad(true), '', rv.reviewing)}
                {item('Copy PGN', 'copy', () => void copyPgn())}
                {item('Flip board', 'flip', settings.toggleOrientation, 'F')}
                {item('Show threats', 'threat', threats.toggleThreat, 'X')}
                {item('Open in analysis', 'analysis', () => app.navigate('analysis'), '', empty)}
                {item(
                  currentGame ? 'Saved in Library' : 'Save to Library',
                  'save',
                  () => {
                    if (app.saveCurrent()) app.toast('Saved to your Library')
                  },
                  '',
                  !!currentGame || total === 0,
                )}
                {item('New board', 'plus', app.newBoard)}
                {item('Keyboard shortcuts', 'keys', () => app.toast(SHORTCUTS), '← →')}
              </>
            )
          }}
        </Popover>
        {rv.refining && (
          <span
            className="refine-chip"
            title={downloading ? 'One-time download of the full engine; the quick report is already shown' : 'The report is from a quick pass; the full-depth review is still running'}
          >
            <span className="spinner spinner--sm" />
            {downloading
              ? `Downloading engine · ${downloadPct}%`
              : `Refining · ${Math.round((rv.progress.done / Math.max(1, rv.progress.total)) * 100)}%`}
          </span>
        )}
        <button type="button" className={`btn ${primary.cls}`} onClick={primary.on} disabled={mode === 'loaded' && total === 0}>
          {primary.label}
        </button>
      </header>

      <div className="board-page">
        <div className="board-col">
          <PlayerBar
            color={topColor}
            name={topColor === 'w' ? white : black}
            elo={elo(topColor)}
            accuracy={accuracy(topColor)}
            fen={fen}
          />
          <div className="board-row">
            <EvalBar whiteWin={position ? winPercent(position.whiteCp) : null} evalText={evalText} height={boardSize} flipped={flipped} />
            <Board
              fen={fen}
              width={boardSize}
              orientation={settings.orientation}
              lastMove={lastMove}
              arrows={arrows}
              mark={mark}
              rings={coach.revealRings}
              interactive={!rv.reviewing && !result}
              onMove={onMove}
              overlay={
                rv.reviewing && (
                  <div className="board-overlay">
                    <div className="board-overlay__card">
                      <div className="spinner" />
                      <div className="board-overlay__title">
                        {rv.loadingEngine && overlayDownload ? 'Downloading engine…' : rv.loadingEngine ? 'Loading engine…' : 'Reviewing game…'}
                      </div>
                      <span className="meter" style={{ width: '100%', flex: 'none' }}>
                        <span
                          className="meter__fill"
                          style={{
                            width: `${rv.loadingEngine && overlayDownload ? Math.round((overlayDownload.loaded / Math.max(1, overlayDownload.total)) * 100) : Math.round((rv.progress.done / Math.max(1, rv.progress.total)) * 100)}%`,
                          }}
                        />
                      </span>
                      <div className="board-overlay__meta">
                        {rv.loadingEngine && overlayDownload
                          ? `${downloadText(overlayDownload)} · first time only`
                          : `${rv.progress.done} / ${rv.progress.total} positions · depth ${settings.depth}`}
                      </div>
                      <div className="board-overlay__fact">{funFactFor(Math.floor(rv.progress.done / 9))}</div>
                    </div>
                  </div>
                )
              }
            />
          </div>
          <PlayerBar
            color={bottomColor}
            name={bottomColor === 'w' ? white : black}
            elo={elo(bottomColor)}
            accuracy={accuracy(bottomColor)}
            fen={fen}
          />
          {rv.engineStatus && (
            <div className="board-status" role="alert">
              {rv.engineStatus}{' '}
              <button type="button" className="link-btn" onClick={() => void rv.startReview()}>
                Try again
              </button>
            </div>
          )}
        </div>

        <aside className="panel" aria-label="Review panel">
          {mode === 'empty' ? (
            <EmptyPanel onLoad={() => setShowLoad(true)} />
          ) : (
            <>
              <div className="panel__tabs">
                <Segmented
                  options={[
                    { value: 'summary', label: 'Summary' },
                    { value: 'moves', label: 'Moves' },
                  ]}
                  value={tab}
                  onChange={app.setReviewTab}
                  label="Panel"
                />
                {movesTab && (
                  <span className="panel__meta">
                    {ply} / {total}
                  </span>
                )}
                {movesTab && result && (
                  <button
                    type="button"
                    className={`icon-btn ${settings.audioOn ? 'icon-btn--on' : ''}`}
                    style={{ width: 32, height: 32, marginLeft: 0 }}
                    title={settings.audioOn ? 'Coach voice on' : 'Coach voice off'}
                    aria-pressed={settings.audioOn}
                    onClick={() => {
                      settings.setAudioOn((a) => !a)
                      app.toast(settings.audioOn ? 'Coach voice off' : 'Coach voice on')
                    }}
                  >
                    <Icon name={settings.audioOn ? 'voiceOn' : 'voiceOff'} />
                  </button>
                )}
              </div>

              {tab === 'summary' && mode === 'loaded' && (
                <div className="review-loaded">
                  <div className="review-loaded__title">Game loaded</div>
                  <p>
                    {Math.ceil(total / 2)} moves{opening ? ` · ${opening}` : ''}. Run a review to get accuracy, move ratings and a coach walkthrough.
                  </p>
                  <button type="button" className="btn btn--primary btn--lg" style={{ alignSelf: 'center', borderRadius: 999 }} onClick={() => void rv.startReview()} disabled={total === 0}>
                    Review game
                  </button>
                  {total === 0 && <p className="field-hint">Play a move on the board first.</p>}
                </div>
              )}

              {tab === 'summary' && mode === 'reviewing' && (
                <div className="review-steps">
                  <div className="review-steps__title">Reviewing…</div>
                  {[
                    ['Read moves', 1],
                    ['Evaluate positions', rv.loadingEngine ? 0 : rv.progress.done >= rv.progress.total ? 1 : 0.5],
                    ['Rate each move', rv.progress.done >= rv.progress.total ? 0.5 : 0],
                    ['Build the report', 0],
                  ].map(([label, st]) => (
                    <div key={label as string} className={`review-step ${st ? 'review-step--on' : ''}`}>
                      <span className={`review-step__dot ${st === 1 ? 'review-step__dot--done' : st ? 'review-step__dot--now' : ''}`}>{st === 1 ? '✓' : st ? '•' : ''}</span>
                      {label}
                    </div>
                  ))}
                </div>
              )}

              {tab === 'summary' && mode === 'report' && result && (
                <ReportPanel
                  result={result}
                  white={white}
                  black={black}
                  sans={sans}
                  ply={ply}
                  onJump={(p) => {
                    game.setPly(p)
                    app.setReviewTab('moves')
                  }}
                  onCoach={() => {
                    game.setPly(0)
                    setFilter('all')
                    app.setReviewTab('moves')
                  }}
                  onSkills={() => setModal('skills')}
                  onAdvanced={() => setModal('advanced')}
                  onDrills={() => app.navigate('drills', { mode: 'game' })}
                />
              )}

              {movesTab && (
                <>
                  {result && (
                    <CoachCard
                      key={ply}
                      result={result}
                      ply={ply}
                      total={total}
                      moreLines={moreLines}
                      onToggleLines={() => setMoreLines((m) => !m)}
                      coach={coach}
                    />
                  )}
                  <div className="moves-head">
                    <span>{filter === 'key' && result ? 'Key moments' : 'Moves'}</span>
                    {result && (
                      <Segmented
                        size="sm"
                        options={[
                          { value: 'all', label: 'All moves' },
                          { value: 'key', label: 'Key moments' },
                        ]}
                        value={filter}
                        onChange={setFilter}
                        label="Move filter"
                      />
                    )}
                  </div>
                  <div className="panel__scroll moves-scroll">
                    {filter === 'key' && result ? (
                      <KeyMoments result={result} ply={ply} onGo={(p) => game.setPly(p)} activeRef={activeRef} />
                    ) : (
                      <MoveGrid sans={sans} result={result} ply={ply} onGo={(p) => game.setPly(p)} activeRef={activeRef} />
                    )}
                  </div>
                  <div className="panel__nav">
                    <button type="button" className="nav-btn" title="First move (Home)" onClick={() => go(0)} disabled={ply === 0}>
                      <Icon name="first" />
                    </button>
                    <button type="button" className="nav-btn" title="Previous (←)" onClick={() => go(ply - 1)} disabled={ply === 0}>
                      <Icon name="prev" stroke={2} />
                    </button>
                    <button type="button" className="nav-btn nav-btn--grow nav-btn--accent" title="Next move (→)" onClick={() => go(ply + 1)} disabled={ply >= total}>
                      {ply === 0 ? 'Start' : ply >= total ? 'End of game' : 'Next'}
                      <Icon name="next" size={15} stroke={2.4} />
                    </button>
                    <button type="button" className="nav-btn" title="Last move (End)" onClick={() => go(total)} disabled={ply >= total}>
                      <Icon name="last" />
                    </button>
                  </div>
                </>
              )}

              {tab === 'summary' && mode !== 'report' && mode !== 'reviewing' && total > 0 && (
                <div className="panel__nav">
                  <button type="button" className="btn btn--quiet btn--block" onClick={() => app.setReviewTab('moves')}>
                    Browse moves
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {showLoad && (
        <Modal title="Load a game" onClose={() => setShowLoad(false)}>
          <ImportForm variant="modal" reviewOnLoad={false} onDone={() => setShowLoad(false)} />
        </Modal>
      )}
      {modal === 'skills' && result && <SkillsModal skills={result.skills} players={game.players} onClose={() => setModal(null)} />}
      {modal === 'advanced' && result && <AdvancedModal advanced={result.advanced} players={game.players} onClose={() => setModal(null)} />}
    </div>
  )
}

function gameOver(fen: string): boolean {
  const board = fen.split(' ')[0] ?? ''
  return !board.includes('K') || !board.includes('k')
}

function EmptyPanel({ onLoad }: { onLoad: () => void }) {
  const { library, openGame } = useApp()
  const recent = [...library.games].sort((a, b) => b.playedAt - a.playedAt).slice(0, 5)
  return (
    <div className="review-empty">
      <div>
        <div className="review-empty__title">Review a game</div>
        <p>Paste a PGN or a game link. You can also play moves on the board.</p>
      </div>
      <button type="button" className="btn btn--primary btn--lg" onClick={onLoad}>
        Load PGN or link
      </button>
      <div className="review-empty__list">
        <div className="review-empty__head">
          <span>Recent games</span>
          <a href="#/library">Library</a>
        </div>
        {recent.length === 0 && <p className="field-hint">Games you load or import appear here.</p>}
        {recent.map((g) => {
          const opp = g.userColor === 'w' ? g.black : g.userColor === 'b' ? g.white : `${g.white} – ${g.black}`
          const out = g.userColor ? outcomeFor(g.result, g.userColor) : null
          return (
            <button key={g.id} type="button" className="review-empty__game" onClick={() => void openGame(g.id)}>
              <span className={`review-empty__dot review-empty__dot--${out ?? 'D'}`} />
              <span className="review-empty__text">
                <span>{g.userColor ? `vs ${opp}` : opp}</span>
                <small>{[g.opening, g.timeControl ? g.timeControl : null].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="review-empty__when">{new Date(g.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ReportPanel({
  result,
  white,
  black,
  sans,
  ply,
  onJump,
  onCoach,
  onSkills,
  onAdvanced,
  onDrills,
}: {
  result: ReviewResult
  white: string
  black: string
  sans: string[]
  ply: number
  onJump: (ply: number) => void
  onCoach: () => void
  onSkills: () => void
  onAdvanced: () => void
  onDrills: () => void
}) {
  const { settings, review } = useApp()
  const refining = review.refining
  const evals = result.positions.map((p) => p.whiteCp)
  const classes = result.moves.map((m) => m.classification)
  const rows = CLASSIFICATION_ORDER.map((cls) => ({
    cls,
    w: result.moves.filter((m) => m.move.color === 'w' && m.classification === cls).length,
    b: result.moves.filter((m) => m.move.color === 'b' && m.classification === cls).length,
  })).filter((r) => r.cls !== 'forced' && (r.w + r.b > 0 || !['excellent', 'book'].includes(r.cls)))
  const jumpTo = (cls: Classification) => {
    const next = result.moves.find((m) => m.classification === cls && m.ply > ply) ?? result.moves.find((m) => m.classification === cls)
    if (next) onJump(next.ply)
  }
  return (
    <div className="panel__scroll report">
      <div className="report__scores">
        <div>
          <div className="report__who">White · {white}</div>
          <div className="report__acc">{result.whiteAccuracy.toFixed(1)}</div>
          <div className="report__rating">
            Game rating <b>{result.gameRating.white}</b>
          </div>
        </div>
        <span className="report__divider" />
        <div>
          <div className="report__who">Black · {black}</div>
          <div className="report__acc">{result.blackAccuracy.toFixed(1)}</div>
          <div className="report__rating">
            Game rating <b>{result.gameRating.black}</b>
          </div>
        </div>
      </div>
      <EvalGraph evals={evals} classifications={classes} sans={sans} currentPly={ply} onSelectPly={onJump} />
      <div className="report__meta">
        {result.preliminary && refining
          ? `Quick pass (depth ${result.depth}) · refining at depth ${settings.depth}…`
          : result.preliminary
            ? `Quick pass (depth ${result.depth}) only — the full review didn’t finish. Re-run to try again.`
          : `Depth ${result.depth} · average centipawn loss ${result.acpl.white.toFixed(0)} / ${result.acpl.black.toFixed(0)}`}
      </div>
      <div className="report__table">
        <div className="report__row report__row--head">
          <span />
          <span>White</span>
          <span>Black</span>
        </div>
        {rows.map((r) => (
          <button key={r.cls} type="button" className="report__row" title={`Jump to the next ${CLASS_STYLE[r.cls].label.toLowerCase()}`} onClick={() => jumpTo(r.cls)}>
            <span className="report__label">
              <ClassChip cls={r.cls} />
              {CLASS_STYLE[r.cls].label}
            </span>
            <b style={{ opacity: r.w ? 1 : 0.28 }}>{r.w}</b>
            <b style={{ opacity: r.b ? 1 : 0.28 }}>{r.b}</b>
          </button>
        ))}
      </div>
      <div className="report__actions">
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={onCoach}>
          Start guided review
        </button>
        <div className="report__extras">
          <button type="button" className="report__extra" onClick={onSkills}>
            <Icon name="target" size={14} stroke={2} />
            Skills
          </button>
          <button type="button" className="report__extra" onClick={onAdvanced}>
            <Icon name="insights" size={14} stroke={2} />
            Advanced
          </button>
          <button type="button" className="report__extra" onClick={onDrills}>
            <Icon name="drills" size={14} stroke={2} />
            Drills
          </button>
        </div>
      </div>
    </div>
  )
}

function CoachCard({
  result,
  ply,
  total,
  moreLines,
  onToggleLines,
  coach,
}: {
  result: ReviewResult
  ply: number
  total: number
  moreLines: boolean
  onToggleLines: () => void
  coach: ReturnType<typeof useCoachMode>
}) {
  const { settings, game } = useApp()
  const base = startPly(game.startFen)
  const [why, setWhy] = useState(false)
  const mr = ply > 0 ? result.moves[ply - 1] : null
  const before = ply > 0 ? result.positions[ply - 1] : null
  const now = result.positions[ply]
  const lines = now?.lines ?? []
  const best = lines[0]
  const ev = (cp?: number, mate?: number) => (cp === undefined ? '' : formatEval(cp, mate))
  const text = mr ? (why && mr.explain ? mr.explain : coachText(mr, settings.explainLevel)) : 'One move at a time. Use Next or the → key, and click any move to jump to it.'
  return (
    <div className="panel__section coach">
      <div className="coach__head">
        {mr && <ClassChip cls={mr.classification} size="lg" />}
        <b className="coach__title">{mr ? `${moveLabel(base + ply, mr.move.san)} ${CLASS_STYLE[mr.classification].verb}` : 'Let’s walk through the game'}</b>
        {mr && before && now && (
          <span className="coach__delta">
            {ev(before.whiteCp, before.mateIn)} → {ev(now.whiteCp, now.mateIn)}
          </span>
        )}
      </div>
      <p className="coach__text">{text}</p>
      {(coach.patterns.fork || coach.patterns.lost || coach.patterns.mate || (mr && mr.explain && settings.explainLevel !== 'detailed')) && (
        <div className="coach__pills">
          {mr?.explain && settings.explainLevel !== 'detailed' && (
            <button type="button" className={`coach__pill ${why ? 'coach__pill--on' : ''}`} onClick={() => setWhy((w) => !w)}>
              Why?
            </button>
          )}
          {coach.patterns.fork && (
            <button type="button" className={`coach__pill ${coach.reveal === 'fork' ? 'coach__pill--on' : ''}`} onClick={() => coach.toggleReveal('fork')}>
              Show fork
            </button>
          )}
          {coach.patterns.lost && (
            <button type="button" className={`coach__pill ${coach.reveal === 'lost' ? 'coach__pill--on' : ''}`} onClick={() => coach.toggleReveal('lost')}>
              Show hanging piece
            </button>
          )}
          {coach.patterns.mate && (
            <button type="button" className={`coach__pill ${coach.reveal === 'mate' ? 'coach__pill--on' : ''}`} onClick={() => coach.toggleReveal('mate')}>
              Show mate
            </button>
          )}
        </div>
      )}
      {best && ply < total && (
        <>
          <button type="button" className="pv-line" onClick={onToggleLines} title="Engine’s best line from here">
            <span className="pv-eval pv-eval--best">{ev(best.whiteCp, best.mateIn)}</span>
            <span className="pv-text">{formatLine(best.pvSan, base + ply, 7)}</span>
            {lines.length > 1 && <span className="pv-toggle">{moreLines ? 'Hide lines' : 'More lines'}</span>}
          </button>
          {moreLines &&
            lines.slice(1).map((l, i) => (
              <div key={i} className="pv-line pv-line--flat">
                <span className="pv-eval">{ev(l.whiteCp, l.mateIn)}</span>
                <span className="pv-text">{formatLine(l.pvSan, base + ply, 7)}</span>
              </div>
            ))}
        </>
      )}
    </div>
  )
}

function MoveGrid({
  sans,
  result,
  ply,
  onGo,
  activeRef,
}: {
  sans: string[]
  result: ReviewResult | null
  ply: number
  onGo: (p: number) => void
  activeRef: React.RefObject<HTMLButtonElement | null>
}) {
  if (sans.length === 0) return <p className="field-hint" style={{ padding: '6px 8px' }}>No moves yet. Play on the board or load a game.</p>
  const rows = []
  for (let i = 0; i < sans.length; i += 2) rows.push(i)
  const cell = (idx: number) => {
    if (idx >= sans.length) return <span />
    const cls = result?.moves[idx]?.classification
    const active = ply - 1 === idx
    return (
      <button type="button" ref={active ? activeRef : undefined} className={`move-cell ${active ? 'move-cell--on' : ''}`} onClick={() => onGo(idx + 1)}>
        <span className="class-glyph" style={{ color: cls ? CLASS_STYLE[cls].color : undefined }}>
          {cls && cls !== 'book' ? CLASS_STYLE[cls].glyph : ''}
        </span>
        {sans[idx]}
      </button>
    )
  }
  return (
    <div className="move-grid">
      {rows.map((i) => (
        <div key={i} className="move-grid__row">
          <span className="move-grid__num">{i / 2 + 1}</span>
          {cell(i)}
          {cell(i + 1)}
        </div>
      ))}
    </div>
  )
}

function KeyMoments({
  result,
  ply,
  onGo,
  activeRef,
}: {
  result: ReviewResult
  ply: number
  onGo: (p: number) => void
  activeRef: React.RefObject<HTMLButtonElement | null>
}) {
  const { game } = useApp()
  const base = startPly(game.startFen)
  const moments = result.moves.filter((m) => KEY_CLASSES.includes(m.classification))
  if (moments.length === 0) return <p className="field-hint" style={{ padding: '6px 8px' }}>No key moments — a clean game.</p>
  return (
    <div className="moments">
      {moments.map((m) => (
        <button
          key={m.ply}
          type="button"
          ref={ply === m.ply ? activeRef : undefined}
          className={`moment ${ply === m.ply ? 'moment--on' : ''}`}
          onClick={() => onGo(m.ply)}
        >
          <ClassChip cls={m.classification} size="lg" />
          <span className="moment__text">
            <b>{moveLabel(base + m.ply, m.move.san)}</b>
            <small>{momentText(m, result)}</small>
          </span>
        </button>
      ))}
    </div>
  )
}
