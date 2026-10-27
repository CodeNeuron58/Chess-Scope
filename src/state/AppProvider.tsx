import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRoute } from '../router'
import { useEngine, useGameState, useLibrary, useReview, useReviewQueue, useSettings } from '../hooks'
import { accountNames } from '../hooks/useSettings'
import { movesKey } from '../hooks/useReview'
import { syncIsStale } from '../hooks/useLibrary'
import { gameFromPgn, speedOf, splitPgn } from '../library/pgnMeta'
import { buildSummary } from '../library/summary'
import type { GameSource, StoredGame } from '../library/types'
import type { ReviewResult } from '../types'
import { playMoveSound, soundFor } from '../lib/sound'
import { AppContext, type AppState, type OpenOptions, type ReviewTab } from './context'
import { Toast } from '../components/Toast'
import { engineDownloadedBefore } from '../engine/download'

/** Newly synced games played within this window are reviewed in the background… */
const AUTO_REVIEW_DAYS = 14
/** …up to this many per sync, newest first. */
const AUTO_REVIEW_LIMIT = 25

export function AppProvider({ children }: { children: ReactNode }) {
  const [route, navigate] = useRoute()
  const settings = useSettings()
  const names = useMemo(() => accountNames(settings.accounts), [settings.accounts])
  const game = useGameState()
  const { getEngine, getPool, getQuickPool, destroyEngine } = useEngine()
  const library = useLibrary(settings.accounts)
  const [toastMsg, setToastMsg] = useState<{ text: string; id: number } | null>(null)
  const [reviewTab, setReviewTab] = useState<ReviewTab>('summary')
  const [liveEngine, setLiveEngine] = useState(true)

  // the library record behind the board, valid only while its moves are untouched
  const [loaded, setLoaded] = useState<{ id: string; key: string; source: GameSource } | null>(null)
  const boardKey = useMemo(() => movesKey(game.moves), [game.moves])
  const currentGame = loaded && loaded.key === boardKey ? library.byId.get(loaded.id) ?? null : null

  const toast = useCallback((text: string) => setToastMsg({ text, id: Date.now() }), [])

  const stateRef = useRef({ currentGame, loaded, game, names, settings })
  stateRef.current = { currentGame, loaded, game, names, settings }

  const onReviewComplete = useCallback(
    (result: ReviewResult) => {
      const { currentGame: cur, loaded: ld, game: g, names: nm, settings: st } = stateRef.current
      let record = cur
      if (!record) {
        try {
          record = gameFromPgn(g.pgn(), ld?.source === 'upload' ? 'upload' : 'board', nm)
        } catch {
          return
        }
        void library.upsert([record])
        setLoaded({ id: record.id, key: movesKey(result.moves.map((m) => m.move)), source: record.source })
      }
      const summary = buildSummary(result, { gameId: record.id, pgn: record.pgn, timeControl: record.timeControl, engine: st.engineChoice })
      void library.saveReview(record.id, result, summary)
      const marks = result.moves.filter((m) => ['brilliant', 'great', 'mistake', 'blunder', 'miss'].includes(m.classification)).length
      toast(`Review complete · ${marks} key moment${marks === 1 ? '' : 's'}`)
    },
    [library, toast],
  )

  // ratings + time control from the PGN feed the rating-aware classification and Game Rating
  const { WhiteElo, BlackElo, TimeControl } = game.headers
  const reviewContext = useMemo(() => {
    const elo = (v?: string) => (v && Number(v) > 0 ? Number(v) : undefined)
    return { whiteElo: elo(WhiteElo), blackElo: elo(BlackElo), speed: speedOf(TimeControl) }
  }, [WhiteElo, BlackElo, TimeControl])

  const review = useReview({
    moves: game.moves,
    context: reviewContext,
    depth: settings.depth,
    engineChoice: settings.engineChoice,
    getPool,
    getQuickPool,
    destroyEngine,
    onComplete: onReviewComplete,
  })

  const liveActive = route.page === 'analysis' && liveEngine && !review.reviewing
  const queue = useReviewQueue({
    library,
    engineChoice: settings.engineChoice,
    depth: settings.depth,
    getPool,
    paused: review.reviewing || review.refining || liveActive,
  })

  const openGame = useCallback(
    async (id: string, opts: OpenOptions = {}) => {
      const record = library.byId.get(id)
      if (!record) return
      const stored = record.summary ? await library.loadReview(id) : null
      const at = opts.at === 'last' ? record.lastPly ?? 0 : opts.at ?? 0
      const err = game.loadPgn(record.pgn, at)
      if (err) {
        toast(err)
        return
      }
      if (stored) {
        // re-attach chess.js moves: the stored copy holds plain objects
        const fresh = game.gameRef.current.history({ verbose: true })
        stored.moves.forEach((m, i) => {
          if (fresh[i]) m.move = fresh[i]
        })
        review.adoptReview(stored)
      } else if (opts.review) {
        review.markAutoReview()
      }
      setLoaded({ id, key: movesKey(game.gameRef.current.history({ verbose: true })), source: record.source })
      setReviewTab(opts.tab ?? 'summary')
      library.update(id, { lastOpenedAt: Date.now(), lastPly: at })
      navigate(opts.page ?? 'review')
    },
    [library, game, review, navigate, toast],
  )

  const loadPgnText = useCallback(
    (pgn: string, opts: Omit<OpenOptions, 'at'> & { source?: GameSource; id?: string } = {}) => {
      const first = splitPgn(pgn)[0] ?? pgn
      const err = game.loadPgn(first, 0)
      if (err) return err
      const source = opts.source ?? 'upload'
      try {
        const parsed = gameFromPgn(first, source, names)
        const record = opts.id ? { ...parsed, id: opts.id } : parsed
        const existing = library.byId.get(record.id)
        void library.upsert([record])
        setLoaded({ id: record.id, key: movesKey(game.gameRef.current.history({ verbose: true })), source })
        if (existing?.summary) {
          void library.loadReview(record.id).then((stored) => {
            if (!stored) return
            const fresh = game.gameRef.current.history({ verbose: true })
            stored.moves.forEach((m, i) => {
              if (fresh[i]) m.move = fresh[i]
            })
            review.adoptReview(stored)
          })
        } else if (opts.review) {
          review.markAutoReview()
        }
      } catch {
        /* the board still has the game; it just isn't in the library */
      }
      setReviewTab('summary')
      navigate(opts.page ?? 'review')
      return null
    },
    [game, library, names, review, navigate],
  )

  const importPgnFile = useCallback(
    async (text: string) => {
      const records: StoredGame[] = []
      for (const pgn of splitPgn(text)) {
        try {
          records.push(gameFromPgn(pgn, 'upload', names))
        } catch {
          /* skip games chess.js cannot read */
        }
      }
      const fresh = await library.upsert(records)
      return fresh.length
    },
    [library, names],
  )

  const loadFenText = useCallback(
    (fen: string) => {
      const err = game.loadFen(fen)
      if (err) return err
      setLoaded(null)
      navigate('analysis')
      return null
    },
    [game, navigate],
  )

  const newBoard = useCallback(() => {
    if (review.reviewing) review.cancelReview()
    game.resetBoard()
    setLoaded(null)
    setReviewTab('summary')
  }, [game, review])

  const saveCurrent = useCallback((): StoredGame | null => {
    if (currentGame) return currentGame
    if (game.moves.length === 0) return null
    try {
      const record = gameFromPgn(game.pgn(), 'board', names)
      void library.upsert([record])
      setLoaded({ id: record.id, key: boardKey, source: 'board' })
      return record
    } catch {
      return null
    }
  }, [currentGame, game, names, library, boardKey])

  const warmEngines = useCallback(() => {
    const choice = settings.engineChoice
    // a first visit loads only the small engine the quick report needs (see useReview)
    const pools = engineDownloadedBefore(choice) ? [getPool(choice), getQuickPool(choice)] : [getQuickPool(choice)]
    for (const e of pools.flat()) void e.init().catch(() => undefined)
  }, [getPool, getQuickPool, settings.engineChoice])

  // background-review freshly synced games so they open instantly
  const libraryRef = useRef(library)
  useEffect(() => {
    libraryRef.current = library
  }, [library])
  const queueNewGames = useCallback(
    (ids: string[]) => {
      if (!settings.autoReview || ids.length === 0) return
      const since = Date.now() - AUTO_REVIEW_DAYS * 86_400_000
      // ids arrive newest first; records may not be in this render's map yet
      const recent = ids.filter((id) => {
        const g = libraryRef.current.byId.get(id)
        return !g || g.playedAt >= since
      })
      queue.enqueue(recent.slice(0, AUTO_REVIEW_LIMIT))
    },
    [settings.autoReview, queue],
  )

  // remember where the user is in a library game (for "Continue"), debounced
  const currentId = currentGame?.id
  useEffect(() => {
    if (!currentId) return
    const t = setTimeout(() => library.update(currentId, { lastPly: game.ply, lastOpenedAt: Date.now() }), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, game.ply])

  // move sounds when stepping forward one move on a board page
  const prevPly = useRef(game.ply)
  useEffect(() => {
    const prev = prevPly.current
    prevPly.current = game.ply
    if (!settings.sounds || game.ply !== prev + 1) return
    if (route.page !== 'review' && route.page !== 'analysis') return
    const m = game.moves[game.ply - 1]
    if (m) playMoveSound(soundFor(m.san))
  }, [game.ply, game.moves, settings.sounds, route.page])

  // sync connected accounts on start-up when stale; queue the newest games for review
  const syncedOnce = useRef(false)
  useEffect(() => {
    if (!library.loaded || syncedOnce.current) return
    syncedOnce.current = true
    if (!syncIsStale(settings.accounts, library.lastSync)) return
    void library.sync().then(({ fresh }) => queueNewGames(fresh))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library.loaded])

  const value: AppState = {
    route,
    navigate,
    settings,
    names,
    game,
    getEngine,
    review,
    library,
    queue,
    currentGame,
    openGame,
    loadPgnText,
    importPgnFile,
    loadFenText,
    newBoard,
    saveCurrent,
    reviewTab,
    setReviewTab,
    liveEngine,
    setLiveEngine,
    toast,
    queueNewGames,
    warmEngines,
  }

  return (
    <AppContext.Provider value={value}>
      {children}
      {toastMsg && <Toast key={toastMsg.id} text={toastMsg.text} onDone={() => setToastMsg(null)} />}
    </AppContext.Provider>
  )
}
