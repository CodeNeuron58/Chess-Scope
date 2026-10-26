import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { useApp } from '../state/context'
import { useBoardSize } from '../hooks'
import { useDailyDrills, useDrillProgress } from '../hooks/useDrillProgress'
import { formatEval } from '../analysis/accuracy'
import { PALETTE } from '../lib/constants'
import {
  choicesFor,
  daySeed,
  gameDrills,
  hintFor,
  judge,
  mixedSet,
  promptFor,
  sideLabel,
  solutionText,
  themeSet,
  userDrills,
  type Choice,
  type DrillCard,
} from '../library/drills'
import { extractMistakes, themeLabel, THEME_LABELS } from '../library/summary'
import { moveLabel } from '../library/stats'
import { openingFamily } from '../library/pgnMeta'
import type { DrillTheme } from '../library/types'
import { Board, type BoardArrow } from '../components/Board'
import { Segmented } from '../components/controls'
import './boardPage.css'
import './drillsPage.css'

type Mode = 'daily' | 'theme' | 'mixed' | 'game' | 'opening'

interface Attempt {
  uci: string
  ok: boolean
  text: string
}

export function DrillsPage() {
  const app = useApp()
  const { library, names, route, review, game, currentGame, settings } = app
  const progress = useDrillProgress()
  const openingParam = route.params.get('opening')
  const [mode, setMode] = useState<Mode>(() => (route.params.get('mode') === 'game' ? 'game' : openingParam ? 'opening' : 'daily'))
  const [theme, setTheme] = useState<DrillTheme>('tactic')
  const [shuffle, setShuffle] = useState(0)
  const [gameSide, setGameSide] = useState<'w' | 'b' | null>(null)
  const boardSize = useBoardSize({ reserveH: 56 + 38 + 66 })

  const mine = useMemo(() => userDrills(library.games, names), [library.games, names])
  const daily = useDailyDrills(mine, progress)

  // "This game": mistakes from the review on the board
  const fromGame = useMemo(() => {
    if (!review.review) return [] as DrillCard[]
    const id = currentGame?.id ?? 'board'
    const items = currentGame?.summary?.mistakes ?? extractMistakes(review.review, id)
    return gameDrills(items, game.players.white, game.players.black, currentGame?.playedAt ?? Date.now())
  }, [review.review, currentGame, game.players])
  const gameUserColor = currentGame?.userColor
  const sideCounts = { w: fromGame.filter((d) => d.color === 'w').length, b: fromGame.filter((d) => d.color === 'b').length }
  const side = gameSide ?? gameUserColor ?? (sideCounts.b > sideCounts.w ? 'b' : 'w')

  const themeCounts = useMemo(() => {
    const c = new Map<DrillTheme, number>()
    for (const d of mine) c.set(d.theme, (c.get(d.theme) ?? 0) + 1)
    return c
  }, [mine])

  const set = useMemo<DrillCard[]>(() => {
    switch (mode) {
      case 'game':
        return fromGame.filter((d) => d.color === side)
      case 'theme':
        return themeSet(mine, theme)
      case 'mixed':
        return mixedSet(mine, daySeed() + shuffle * 7919)
      case 'opening': {
        const ids = new Set(library.games.filter((g) => openingFamily(g.opening) === openingParam).map((g) => g.id))
        return mine.filter((d) => ids.has(d.gameId)).slice(0, 10)
      }
      default:
        return daily
    }
  }, [mode, fromGame, side, mine, theme, shuffle, library.games, openingParam, daily])

  const setKey = `${mode}|${theme}|${shuffle}|${side}|${openingParam}|${set.map((d) => d.id).join(',')}`
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<(boolean | null)[]>([])
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [hints, setHints] = useState(0)
  const [checking, setChecking] = useState(false)
  const lastKey = useRef('')

  const resetDrill = () => {
    setAttempt(null)
    setRevealed(false)
    setHints(0)
    setChecking(false)
  }
  useEffect(() => {
    if (lastKey.current === setKey) return
    lastKey.current = setKey
    setIdx(0)
    setResults(set.map((d) => (mode === 'daily' && progress.solved.has(d.id) ? true : null)))
    resetDrill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setKey])

  const drill = set[Math.min(idx, set.length - 1)]
  const best = drill?.lines[0]
  const choices = useMemo(() => (drill ? choicesFor(drill) : []), [drill])
  const solved = !!attempt?.ok || revealed

  /** The first answer to a drill decides whether it counts as solved. */
  const settle = (ok: boolean) => {
    if (!drill || (results[idx] !== null && results[idx] !== undefined)) return
    progress.record(drill.id, ok)
    setResults((r) => {
      const next = [...r]
      next[idx] = ok
      return next
    })
  }

  const answer = async (uci: string, known?: Choice) => {
    if (!drill || solved || checking) return
    let whiteCp = known?.whiteCp
    let mateIn = known?.mateIn
    let san = known?.san ?? uci
    if (whiteCp === undefined) {
      const line = drill.lines.find((l) => l.uci === uci)
      if (line) {
        whiteCp = line.whiteCp
        mateIn = line.mateIn
        san = line.san
      } else if (uci === drill.played.uci) {
        whiteCp = drill.played.whiteCp
        mateIn = drill.played.mateIn
        san = drill.played.san
      }
    }
    if (whiteCp === undefined) {
      // unknown move: ask the engine
      let after: string
      try {
        const c = new Chess(drill.fen)
        const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
        after = c.fen()
        san = m.san
      } catch {
        return
      }
      setChecking(true)
      setAttempt({ uci, ok: false, text: 'Checking your move…' })
      try {
        const engine = app.getEngine(settings.engineChoice)
        await engine.init()
        const res = await engine.analyse(after, 12, { cancelled: false })
        whiteCp = res.whiteCp
        mateIn = res.mateIn
      } catch {
        setChecking(false)
        setAttempt({ uci, ok: false, text: 'The engine could not check that move. Try again.' })
        return
      }
      setChecking(false)
    }
    const verdict = judge(drill, whiteCp)
    const label = moveLabel(drill.ply, san)
    const evalText = formatEval(whiteCp, mateIn)
    let text: string
    if (verdict.ok && best && best.uci !== uci) text = `${label} works too — the evaluation stays at ${evalText}. The engine’s first choice was ${moveLabel(drill.ply, best.san)}.`
    else if (verdict.ok) text = solutionText(drill)
    else if (uci === drill.played.uci) text = `That’s the move you played in the game — it gave away about ${Math.round(drill.winLoss)}% winning chances.`
    else text = `${label} gives away about ${Math.round(verdict.winLoss)}% winning chances (${evalText}). Try again.`
    setAttempt({ uci, ok: verdict.ok, text })
    settle(verdict.ok)
  }

  const next = () => {
    resetDrill()
    if (idx >= set.length - 1) {
      if (mode === 'mixed') setShuffle((s) => s + 1)
      else setIdx(0)
    } else setIdx(idx + 1)
  }

  if (mine.length === 0 && fromGame.length === 0) {
    return (
      <div className="page">
        <DrillsTopbar mode={mode} setMode={setMode} hasGame={false} />
        <div className="content">
          <div className="card">
            <div className="empty">
              <span className="empty__title">Drills come from your own mistakes</span>
              <span>
                {names.length === 0
                  ? 'Connect your chess.com or Lichess account so Owlchess knows which side you played, then review a few games. Every mistake becomes a position to practise.'
                  : 'Review a few of your games. Every mistake, blunder and missed win becomes a position to practise.'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a className="btn btn--primary" href="#/library">
                  Open your library
                </a>
                {names.length === 0 && (
                  <a className="btn btn--outline" href="#/settings/accounts">
                    Connect an account
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const arrows: BoardArrow[] = []
  if (drill && revealed && best) arrows.push({ from: best.uci.slice(0, 2), to: best.uci.slice(2, 4), color: PALETTE.accent })
  else if (attempt && !checking) arrows.push({ from: attempt.uci.slice(0, 2), to: attempt.uci.slice(2, 4), color: attempt.ok ? PALETTE.arrowGood : PALETTE.arrowBad })
  else if (drill && hints >= 3 && best) arrows.push({ from: best.uci.slice(0, 2), to: best.uci.slice(2, 4), color: PALETTE.accent })
  const rings: Record<string, string> = {}
  if (drill && best && hints >= 1 && !solved) rings[best.uci.slice(0, 2)] = PALETTE.accent
  if (drill && best && hints >= 2 && !solved) rings[best.uci.slice(2, 4)] = PALETTE.accent

  const done = results.filter((r) => r !== null && r !== undefined).length
  const right = results.filter((r) => r === true).length
  const listTitle = mode === 'daily' ? 'Today’s set' : mode === 'game' ? 'This game' : mode === 'theme' ? THEME_LABELS[theme] : mode === 'opening' ? openingParam ?? 'Opening' : 'Mixed set'
  const sourceGame = drill ? library.byId.get(drill.gameId) : undefined

  return (
    <div className="page page--board">
      <DrillsTopbar mode={mode} setMode={setMode} hasGame={fromGame.length > 0} openingName={openingParam} />
      {mode === 'theme' && (
        <div className="drill-themes">
          {(Object.keys(THEME_LABELS) as DrillTheme[]).map((t) => (
            <button key={t} type="button" className={`drill-theme ${t === theme ? 'drill-theme--on' : ''}`} onClick={() => setTheme(t)} disabled={!themeCounts.get(t)}>
              {THEME_LABELS[t]} <span>{themeCounts.get(t) ?? 0}</span>
            </button>
          ))}
        </div>
      )}
      {mode === 'game' && !gameUserColor && (
        <div className="drill-themes">
          <Segmented
            size="sm"
            options={[
              { value: 'w' as const, label: `White · ${sideCounts.w}` },
              { value: 'b' as const, label: `Black · ${sideCounts.b}` },
            ]}
            value={side}
            onChange={setGameSide}
            label="Side to drill"
          />
        </div>
      )}
      {!drill ? (
        <div className="content">
          <div className="card">
            <div className="empty">
              <span className="empty__title">Nothing to drill here</span>
              <span>{mode === 'game' ? 'No mistakes for this side in the current game.' : 'No drills in this set yet. Try another mode.'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="board-page">
          <div className="board-col drill-col">
            <Board
              fen={drill.fen}
              width={boardSize}
              orientation={drill.color === 'w' ? 'white' : 'black'}
              arrows={arrows}
              rings={rings}
              interactive={!solved && !checking}
              onMove={(f, t, p) => {
                void answer(`${f}${t}${p ?? ''}`)
                return false
              }}
            />
            <div className="drill-choices" style={{ width: boardSize }}>
              {choices.map((c) => {
                const picked = attempt?.uci === c.uci && !checking
                const isBest = revealed && best?.uci === c.uci
                const state = picked ? (attempt?.ok ? 'ok' : 'bad') : isBest ? 'ok' : ''
                return (
                  <button key={c.uci} type="button" className={`drill-choice ${state ? `drill-choice--${state}` : ''}`} onClick={() => void answer(c.uci, c)} disabled={solved || checking}>
                    {moveLabel(drill.ply, c.san)}
                  </button>
                )
              })}
            </div>
          </div>

          <aside className="panel" aria-label="Drill panel">
            <div className="panel__tabs drill-head">
              <div className="drill-dots">
                {set.slice(0, 10).map((d, i) => (
                  <span key={d.id} className={`drill-dot ${i === idx ? 'drill-dot--now' : results[i] === true ? 'drill-dot--ok' : results[i] === false ? 'drill-dot--bad' : ''}`} />
                ))}
              </div>
              <span className="panel__meta" style={{ marginLeft: 0 }}>
                Drill {idx + 1} of {set.length}
              </span>
              <span className="pill-tag" style={{ marginLeft: 'auto' }}>
                {themeLabel(drill)}
              </span>
            </div>
            <div className="panel__section drill-prompt">
              <span className="eyebrow">{sideLabel(drill)}</span>
              <div className="drill-prompt__q">{promptFor(drill)}</div>
              <div className="drill-prompt__src">
                From your game vs{' '}
                {sourceGame ? (
                  <button type="button" className="link-btn" onClick={() => void app.openGame(sourceGame.id, { at: drill.ply - 1 })}>
                    {drill.opponent}
                  </button>
                ) : (
                  drill.opponent
                )}{' '}
                · move {Math.ceil(drill.ply / 2)}
              </div>
              {(attempt || revealed || hints > 0) && (
                <div className={`drill-feedback ${revealed && !attempt?.ok ? 'drill-feedback--reveal' : attempt ? (attempt.ok ? 'drill-feedback--ok' : checking ? '' : 'drill-feedback--bad') : ''}`}>
                  <b>{revealed && !attempt?.ok ? `Solution: ${best ? moveLabel(drill.ply, best.san) : ''}` : attempt ? (checking ? 'Checking…' : attempt.ok ? 'Correct' : 'Not quite') : 'Hint'}</b>
                  <p>{revealed && !attempt?.ok ? solutionText(drill) : attempt ? attempt.text : hintFor(drill)}</p>
                </div>
              )}
              <div className="drill-actions">
                <button type="button" className="btn btn--sm" onClick={() => setHints((h) => Math.min(3, h + 1))} disabled={solved || hints >= 3}>
                  {hints === 0 ? 'Hint' : hints >= 3 ? 'Hint shown' : 'More hint'}
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => {
                    setRevealed(true)
                    settle(false)
                  }}
                  disabled={solved}
                >
                  Solution
                </button>
                {attempt && !attempt.ok && !checking && !revealed && (
                  <button type="button" className="btn btn--sm btn--quiet" onClick={() => setAttempt(null)}>
                    Try again
                  </button>
                )}
                <button type="button" className="btn btn--primary btn--sm" style={{ marginLeft: 'auto' }} onClick={next}>
                  {idx >= set.length - 1 ? (mode === 'mixed' ? 'New set' : 'Start over') : 'Next drill'}
                </button>
              </div>
            </div>
            <div className="panel__scroll drill-list">
              <div className="drill-list__head">
                <b>{listTitle}</b>
                <span>
                  {right} / {done} solved
                </span>
              </div>
              {set.map((d, i) => {
                const r = results[i]
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`drill-item ${i === idx ? 'drill-item--on' : ''}`}
                    onClick={() => {
                      resetDrill()
                      setIdx(i)
                    }}
                  >
                    <span className={`drill-item__ic ${r === true ? 'drill-item__ic--ok' : r === false ? 'drill-item__ic--bad' : i === idx ? 'drill-item__ic--now' : ''}`}>
                      {r === true ? '✓' : r === false ? '×' : i + 1}
                    </span>
                    <span className="drill-item__text">
                      <b>{themeLabel(d)}</b>
                      <small>
                        {d.color === 'w' ? 'White' : 'Black'} to move · vs {d.opponent} · move {Math.ceil(d.ply / 2)}
                      </small>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="drill-foot">
              <span>
                <b>{progress.streak}-day</b> streak
              </span>
              <span>
                <b>
                  {progress.weekOk} / {progress.weekTried}
                </b>{' '}
                solved this week
              </span>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function DrillsTopbar({ mode, setMode, hasGame, openingName }: { mode: Mode; setMode: (m: Mode) => void; hasGame: boolean; openingName?: string | null }) {
  const options: { value: Mode; label: string }[] = [
    { value: 'daily', label: 'Today’s set' },
    { value: 'theme', label: 'By theme' },
    { value: 'mixed', label: 'Mixed' },
  ]
  if (hasGame) options.push({ value: 'game', label: 'This game' })
  if (openingName) options.push({ value: 'opening', label: openingName })
  return (
    <header className="topbar">
      <div className="topbar__heading">
        <span className="topbar__title">Drills</span>
        <span className="topbar__sub">Positions taken from your own mistakes</span>
      </div>
      <Segmented variant="raised" options={options} value={mode} onChange={setMode} label="Drill set" />
    </header>
  )
}
