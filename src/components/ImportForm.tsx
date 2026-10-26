import { useRef, useState } from 'react'
import { useApp } from '../state/context'
import { fetchLichessGamePgn, lichessIdFromUrl } from '../library/lichess'
import { splitPgn } from '../library/pgnMeta'
import { SAMPLE_GAMES } from '../samples'
import { Segmented } from './controls'
import { Icon, PlayIcon } from './Icon'
import './importForm.css'

export type ImportTab = 'link' | 'pgn' | 'fen' | 'username'

const TABS: { value: ImportTab; label: string }[] = [
  { value: 'link', label: 'Game link' },
  { value: 'pgn', label: 'PGN' },
  { value: 'fen', label: 'FEN' },
  { value: 'username', label: 'Username' },
]

const COPY: Record<ImportTab, { placeholder: string; hint: string }> = {
  link: { placeholder: 'https://lichess.org/… or a chess.com game link', hint: 'Lichess links are fetched for you. chess.com games come in through your username.' },
  pgn: { placeholder: '[Event "Casual game"]\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 …', hint: 'Paste the full PGN. Headers are optional; several games go to your Library.' },
  fen: { placeholder: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', hint: 'Opens the analysis board at this position.' },
  username: { placeholder: 'Your username', hint: 'Imports your recent games into the Library and keeps them in sync. No password needed.' },
}

const CHESSCOM_GAME = /chess\.com\/(?:game\/(?:live|daily)|live\/game|daily\/game|analysis\/game\/live)\/(\d+)/

interface Props {
  variant: 'card' | 'modal'
  /** Start the review right after loading (Home). */
  reviewOnLoad: boolean
  onDone?: () => void
  /** Rendered next to the tabs (card header). */
  title?: string
}

/** The four ways to bring a game in: link, PGN, FEN position, account username. */
export function ImportForm({ variant, reviewOnLoad, onDone, title }: Props) {
  const app = useApp()
  const [tab, setTab] = useState<ImportTab>(variant === 'modal' ? 'pgn' : 'link')
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState<'lichess' | 'chesscom'>('chesscom')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const finish = () => {
    setText('')
    setError('')
    onDone?.()
  }

  const loadPgn = async (pgn: string, extra: { source?: 'lichess' | 'upload'; id?: string } = {}) => {
    const games = splitPgn(pgn)
    if (games.length > 1) {
      const added = await app.importPgnFile(pgn)
      app.toast(`${games.length} games imported · ${added} new`)
      app.navigate('library')
      finish()
      return
    }
    const err = app.loadPgnText(pgn, { review: reviewOnLoad, ...extra })
    if (err) setError(err)
    else {
      app.toast(reviewOnLoad ? 'Game loaded · reviewing' : 'Game loaded')
      finish()
    }
  }

  const submit = async () => {
    const value = text.trim()
    if (!value || busy) return
    setError('')
    setBusy(true)
    try {
      if (tab === 'pgn') await loadPgn(value)
      else if (tab === 'fen') {
        const err = app.loadFenText(value)
        if (err) setError(err)
        else finish()
      } else if (tab === 'link') {
        const li = lichessIdFromUrl(value)
        const cc = CHESSCOM_GAME.exec(value)
        if (li) {
          const pgn = await fetchLichessGamePgn(li)
          await loadPgn(pgn, { source: 'lichess', id: `li:${li}` })
        } else if (cc) {
          const hit = app.library.games.find((g) => g.source === 'chesscom' && g.url?.includes(cc[1]))
          if (hit) {
            await app.openGame(hit.id, { review: reviewOnLoad })
            finish()
          } else {
            setError('chess.com does not share single games by link. Connect your chess.com username and the game shows up in your Library.')
          }
        } else {
          setError('Paste a Lichess or chess.com game link.')
        }
      } else {
        const accounts = { ...app.settings.accounts, [platform]: value }
        app.settings.setAccounts(accounts)
        const { fresh, error: syncErr } = await app.library.sync(platform, accounts)
        if (syncErr) {
          setError(syncErr)
          return
        }
        app.toast(`${platform === 'chesscom' ? 'chess.com' : 'Lichess'} connected · ${fresh.length} new games`)
        app.queueNewGames(fresh)
        app.navigate('library')
        finish()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const content = await file.text()
    await loadPgn(content)
  }

  const multiline = tab === 'pgn'
  const copy = COPY[tab]
  const submitLabel = tab === 'username' ? 'Connect' : tab === 'fen' ? 'Analyse' : reviewOnLoad ? 'Review' : 'Load game'

  return (
    <div className={`import import--${variant}`}>
      <div className="import__head">
        {title && <span className="import__title">{title}</span>}
        <Segmented
          options={TABS}
          value={tab}
          onChange={(t) => {
            setTab(t)
            setError('')
          }}
          label="Import method"
        />
      </div>
      <div className={`import__row ${multiline ? 'import__row--stack' : ''}`}>
        {tab === 'username' && (
          <Segmented
            size="sm"
            options={[
              { value: 'chesscom', label: 'chess.com' },
              { value: 'lichess', label: 'Lichess' },
            ]}
            value={platform}
            onChange={setPlatform}
            label="Platform"
          />
        )}
        {multiline ? (
          <textarea
            className="textarea import__area"
            placeholder={copy.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={variant === 'card' ? 3 : 7}
          />
        ) : (
          <input
            className="input import__input"
            placeholder={copy.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            spellCheck={false}
            aria-label={TABS.find((t) => t.value === tab)?.label}
          />
        )}
        {variant === 'card' && (
          <button type="button" className="btn btn--primary btn--lg import__go" onClick={() => void submit()} disabled={!text.trim() || busy}>
            {busy ? <span className="spinner spinner--sm" /> : <PlayIcon />}
            {submitLabel}
          </button>
        )}
      </div>
      {error ? <div className="field-error">{error}</div> : <div className="field-hint">{copy.hint}</div>}
      <input ref={fileRef} type="file" accept=".pgn,text/plain,application/x-chess-pgn" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      {variant === 'card' ? (
        <div className="import__quick">
          <button type="button" className="import__quicklink" onClick={() => fileRef.current?.click()}>
            <Icon name="file" size={14} stroke={2} />
            Upload .pgn file
          </button>
          <button
            type="button"
            className="import__quicklink"
            onClick={() => {
              app.newBoard()
              app.navigate('analysis')
            }}
          >
            <Icon name="analysis" size={14} stroke={2} />
            Empty analysis board
          </button>
          <a className="import__quicklink" href="#/library">
            <Icon name="library" size={14} stroke={2} />
            Browse library
          </a>
        </div>
      ) : (
        <div className="import__foot">
          <div className="import__samples">
            <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
              Upload .pgn
            </button>
            {SAMPLE_GAMES.map((s) => (
              <button key={s.name} type="button" className="link-btn" onClick={() => void loadPgn(s.pgn)}>
                {s.short}
              </button>
            ))}
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--quiet" onClick={onDone}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={!text.trim() || busy}>
              {busy && <span className="spinner spinner--sm" />}
              {submitLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
