import { useMemo, useState } from 'react'
import { useApp } from '../state/context'
import { Segmented } from '../components/controls'
import {
  accuracySeries,
  bySpeed,
  inWindow,
  kpis,
  leaks,
  openingRows,
  periodRange,
  phaseAccuracy,
  skills,
  timeStats,
  userGames,
} from '../library/stats'
import type { Color, Speed } from '../library/types'
import { fmt } from '../lib/format'
import './insightsPage.css'

type Period = '30' | '90' | 'all'
type TimeFilter = 'all' | Speed

export function InsightsPage() {
  const app = useApp()
  const [period, setPeriod] = useState<Period>('90')
  const [tc, setTc] = useState<TimeFilter>('all')
  const [side, setSide] = useState<Color>('w')

  const all = useMemo(() => bySpeed(userGames(app.library.games, app.names), tc), [app.library.games, app.names, tc])
  const days = period === 'all' ? null : Number(period)
  const range = useMemo(() => periodRange(days), [days])
  const list = useMemo(() => (days === null ? all : inWindow(all, range.from, range.to)), [all, days, range.from, range.to])
  const prevList = useMemo(() => (days === null ? [] : inWindow(all, range.prevFrom, range.from)), [all, days, range.prevFrom, range.from])

  const k = kpis(list)
  const kPrev = kpis(prevList)
  const series = useMemo(() => accuracySeries(list, days === null ? list.at(-1)?.game.playedAt ?? 0 : range.from, range.to), [list, days, range.from, range.to])
  const skillRows = useMemo(() => skills(list), [list])
  const phases = useMemo(() => phaseAccuracy(list), [list])
  const leakRows = useMemo(() => leaks(list), [list])
  const time = useMemo(() => timeStats(list), [list])
  const openings = useMemo(() => openingRows(list, side), [list, side])

  const reviewedAny = app.library.games.some((g) => g.summary)
  const header = (
    <header className="topbar">
      <div className="topbar__heading">
        <span className="topbar__title">Insights</span>
        <span className="topbar__sub">
          Based on {list.length} reviewed game{list.length === 1 ? '' : 's'}
        </span>
      </div>
      <Segmented
        variant="raised"
        options={[
          { value: '30' as Period, label: '30 days' },
          { value: '90' as Period, label: '90 days' },
          { value: 'all' as Period, label: 'All time' },
        ]}
        value={period}
        onChange={setPeriod}
        label="Period"
      />
      <Segmented
        variant="raised"
        options={(['all', 'blitz', 'rapid', 'classical'] as TimeFilter[]).map((v) => ({ value: v, label: v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1) }))}
        value={tc}
        onChange={setTc}
        label="Time control"
      />
    </header>
  )

  if (list.length === 0) {
    const noAccount = app.names.length === 0
    return (
      <div className="page">
        {header}
        <div className="content insights">
          <div className="card">
            <div className="empty">
              <span className="empty__title">{all.length > 0 ? 'No games in this period' : 'Insights need a few of your reviewed games'}</span>
              <span>
                {all.length > 0
                  ? 'Try a longer period or another time control.'
                  : noAccount
                    ? 'Connect your chess.com or Lichess username so Owlchess knows which side you played, then review a few games.'
                    : reviewedAny
                      ? 'None of your reviewed games include your connected username yet. Review a few of your own games.'
                      : 'Review a few of your games — accuracy trends, skills and opening stats build up from there.'}
              </span>
              <a className="btn btn--primary" href={noAccount ? '#/settings/accounts' : '#/library'}>
                {noAccount ? 'Connect an account' : 'Open your library'}
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const kpiTile = (label: string, value: string, cur: number, prev: number, digits: number, better: 'up' | 'down', unit = '', fallback = '') => {
    let delta = fallback
    let cls = ''
    if (days !== null && Number.isFinite(cur) && Number.isFinite(prev)) {
      const d = cur - prev
      delta = `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(digits)}${unit} vs previous ${days} days`
      cls = (better === 'up' ? d >= 0 : d <= 0) ? 'stat__delta--good' : 'stat__delta--bad'
    }
    return (
      <div className="stat">
        <span className="stat__label">{label}</span>
        <span className="stat__value">{value}</span>
        <span className={`stat__delta ${cls}`}>{delta || ' '}</span>
      </div>
    )
  }

  return (
    <div className="page">
      {header}
      <div className="content insights">
        <div className="insights__kpis">
          {kpiTile('Average accuracy', fmt(k.accuracy), k.accuracy, kPrev.accuracy, 1, 'up', '', `${list.length} game${list.length === 1 ? '' : 's'}`)}
          {kpiTile('Score', Number.isFinite(k.score) ? `${Math.round(k.score)}%` : '—', k.score, kPrev.score, 0, 'up', ' pts', 'Points won')}
          {kpiTile('Blunders per game', fmt(k.blundersPerGame), k.blundersPerGame, kPrev.blundersPerGame, 1, 'down', '', 'All reviewed games')}
          {kpiTile('Est. game rating', Number.isFinite(k.rating) ? String(k.rating) : '—', k.rating, kPrev.rating, 0, 'up', '', 'From your accuracy')}
        </div>

        <div className="insights__row insights__row--wide">
          <AccuracyChart series={series} />
          <section className="card">
            <div className="card__head">
              <span className="card__title">Skills</span>
              <span className="card__note">accuracy by kind of position</span>
            </div>
            {skillRows.map((s) => {
              const ok = Number.isFinite(s.me)
              return (
                <div key={s.key} className="skill" title={s.hint}>
                  <div className="skill__top">
                    <span>{s.label}</span>
                    <span>
                      <b>{ok ? s.me.toFixed(1) : '—'}</b>
                      {Number.isFinite(s.opp) && <span className="skill__opp"> · opponents {s.opp.toFixed(1)}</span>}
                    </span>
                  </div>
                  <div className="skill__bar">
                    <div className="skill__fill" style={{ width: ok ? `${s.me}%` : 0, background: ok && Number.isFinite(s.opp) && s.me < s.opp - 3 ? 'var(--loss)' : undefined }} />
                    {Number.isFinite(s.opp) && <span className="skill__tick" style={{ left: `${s.opp}%` }} />}
                  </div>
                </div>
              )
            })}
            <div className="card__note" style={{ color: 'var(--muted)', fontSize: 12 }}>
              Grey tick = your opponents in the same games
            </div>
          </section>
        </div>

        <div className="insights__row insights__row--three">
          <section className="card">
            <span className="card__title">Accuracy by phase</span>
            <div className="phase-bars">
              {phases.map((p) => (
                <div key={p.key} className="phase-bars__col">
                  <div className="phase-bars__pair">
                    <div className="phase-bars__bar phase-bars__bar--w" style={{ height: barH(p.white) }} title={`As White ${fmt(p.white)}`} />
                    <div className="phase-bars__bar phase-bars__bar--b" style={{ height: barH(p.black) }} title={`As Black ${fmt(p.black)}`} />
                  </div>
                  <div className="phase-bars__label">
                    {p.label}
                    <br />
                    <b>
                      {fmt(p.white, 0)} / {fmt(p.black, 0)}
                    </b>
                  </div>
                </div>
              ))}
            </div>
            <div className="legend">
              <span>
                <i style={{ background: 'var(--text)' }} />
                As White
              </span>
              <span>
                <i style={{ background: '#3f5a4c' }} />
                As Black
              </span>
            </div>
          </section>

          <section className="card">
            <span className="card__title">Where you lose points</span>
            {leakRows.length === 0 && <p className="card__note">No costly mistakes in these games. Nice.</p>}
            {leakRows.map((l) => (
              <div key={l.key} className="skill">
                <div className="skill__top">
                  <span>{l.label}</span>
                  <span className="skill__opp">{Math.round(l.share)}%</span>
                </div>
                <div className="skill__bar">
                  <div className="skill__fill" style={{ width: `${l.share}%`, background: 'var(--loss)' }} />
                </div>
              </div>
            ))}
            <a href="#/drills" className="link-btn" style={{ marginTop: 'auto' }}>
              Train these in Drills →
            </a>
          </section>

          <section className="card" id="advanced">
            <span className="card__title">Advanced · time</span>
            {[
              ['Avg. time per move', Number.isFinite(time.avgSeconds) ? `${time.avgSeconds.toFixed(1)} s` : '—'],
              ['Moves played under 30 s left', Number.isFinite(time.lowClockShare) ? `${Math.round(time.lowClockShare)}%` : '—'],
              ['Mistakes made in time trouble', Number.isFinite(time.errorsInTimeTrouble) ? `${Math.round(time.errorsInTimeTrouble)}%` : '—'],
              ['Accuracy after a mistake', fmt(time.accuracyAfterMistake)],
            ].map(([label, value]) => (
              <div key={label} className="adv-row">
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
            {!Number.isFinite(time.avgSeconds) && <p className="card__note">Clock stats need games with clock data (chess.com and Lichess include it).</p>}
          </section>
        </div>

        <section className="card card--flush">
          <div className="card__head">
            <span className="card__title">Openings</span>
            <Segmented
              options={[
                { value: 'w' as Color, label: 'As White' },
                { value: 'b' as Color, label: 'As Black' },
              ]}
              value={side}
              onChange={setSide}
              label="Side"
            />
          </div>
          {openings.length === 0 ? (
            <p className="card__note" style={{ padding: '0 12px 12px' }}>
              No reviewed games as {side === 'w' ? 'White' : 'Black'} in this period.
            </p>
          ) : (
            <>
              <div className="open-grid open-head">
                <span>OPENING</span>
                <span>GAMES</span>
                <span>SCORE</span>
                <span>ACCURACY</span>
                <span>COMMON MISTAKE</span>
                <span />
              </div>
              {openings.map((o) => (
                <div key={o.name} className="open-grid open-row">
                  <div className="game-row__who">
                    <span className="game-row__opening" style={{ fontWeight: 500 }}>
                      {o.name}
                    </span>
                    <small className="mono">{o.eco ?? ''}</small>
                  </div>
                  <span>{o.games}</span>
                  <div className="open-score">
                    <span className="open-score__bar">
                      <span style={{ width: `${o.win}%`, background: 'var(--win)' }} />
                      <span style={{ width: `${o.draw}%`, background: 'var(--muted)' }} />
                      <span style={{ flex: 1, background: 'var(--loss)' }} />
                    </span>
                    <b>{Math.round(o.score)}%</b>
                  </div>
                  <span>{fmt(o.accuracy)}</span>
                  <span className="open-row__mistake" title={o.commonMistake}>
                    {o.commonMistake}
                  </span>
                  <a className="btn btn--sm" style={{ justifySelf: 'end' }} href={`#/drills?opening=${encodeURIComponent(o.name)}`}>
                    Drill
                  </a>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function barH(v: number): string {
  return Number.isFinite(v) ? `${Math.max(4, (v - 50) * 2)}%` : '0%'
}

function AccuracyChart({ series }: { series: ReturnType<typeof accuracySeries> }) {
  const W = 600
  const H = 240
  const vals = series.flatMap((p) => [p.me, p.opp]).filter(Number.isFinite)
  // round axis: three equal steps of 5, 10 or 20 points ending at a multiple of 10
  const hi = Math.min(100, Math.ceil((Math.max(...vals, 90) + 2) / 10) * 10)
  const step = [5, 10, 20, 30].find((s) => hi - 3 * s <= Math.min(...vals, 70) - 3) ?? 30
  const lo = Math.max(0, hi - 3 * step)
  const y = (v: number) => H - 20 - ((v - lo) / Math.max(1, hi - lo)) * (H - 40)
  const x = (i: number) => (series.length <= 1 ? W / 2 : (i / (series.length - 1)) * W)
  const path = (key: 'me' | 'opp') =>
    series
      .map((p, i) => [x(i), p[key]] as const)
      .filter(([, v]) => Number.isFinite(v))
      .map(([xx, v], i) => `${i ? 'L' : 'M'}${xx.toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ')
  const me = path('me')
  const grid = [hi, hi - step, hi - 2 * step, lo]
  const ticks = series.length <= 5 ? series.map((p) => p.label) : [0, 0.25, 0.5, 0.75, 1].map((f) => series[Math.round(f * (series.length - 1))].label)
  return (
    <section className="card">
      <div className="card__head">
        <span className="card__title">Accuracy over time</span>
        <span className="legend">
          <span>
            <i style={{ background: 'var(--accent)', height: 3, width: 14 }} />
            You
          </span>
          <span>
            <i style={{ background: 'var(--muted)', height: 3, width: 14 }} />
            Opponents
          </span>
        </span>
      </div>
      <div className="acc-chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Your accuracy over time compared with your opponents">
          {grid.map((v) => (
            <line key={v} x1={0} y1={y(v)} x2={W} y2={y(v)} stroke="var(--row)" vectorEffect="non-scaling-stroke" />
          ))}
          {series.length > 1 && <path d={`${me} L${x(series.length - 1)},${H} L${x(0)},${H} Z`} fill="var(--accent)" fillOpacity={0.12} />}
          <path d={path('opp')} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <path d={me} fill="none" stroke="var(--accent)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {series.map((p, i) => (
          <span
            key={i}
            className="acc-chart__dot"
            style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(p.me) / H) * 100}%` }}
            title={`${p.label} · you ${p.me.toFixed(1)} · opponents ${fmtNum(p.opp)}${p.games > 1 ? ` · ${p.games} games` : ''}`}
          />
        ))}
        {grid.map((v) => (
          <span key={v} className="acc-chart__y" style={{ top: `calc(${(y(v) / H) * 100}% - 8px)` }}>
            {v}
          </span>
        ))}
      </div>
      {series.length < 2 && <p className="card__note">Review a few more games to see a trend.</p>}
      <div className="acc-chart__x">
        {ticks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </section>
  )
}

function fmtNum(v: number) {
  return Number.isFinite(v) ? v.toFixed(1) : '—'
}
