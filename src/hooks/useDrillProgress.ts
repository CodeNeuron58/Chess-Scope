import { useCallback, useEffect, useMemo } from 'react'
import { usePersistedState } from './useSettings'
import { dailySet, type DrillCard } from '../library/drills'

interface Progress {
  /** Drill id → when it was solved. */
  solved: Record<string, number>
  /** 'YYYY-MM-DD' → attempts that day. */
  days: Record<string, { ok: number; tried: number }>
  /** Today's fixed set, so it doesn't reshuffle as drills get solved. */
  daily?: { day: string; ids: string[] }
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Drill results kept in localStorage: solved drills, daily streak, this week's tally, today's set. */
export function useDrillProgress() {
  const [p, setP] = usePersistedState<Progress>('drills', { solved: {}, days: {} })

  const record = useCallback(
    (id: string, ok: boolean) => {
      setP((prev) => {
        const key = dayKey(new Date())
        const day = prev.days[key] ?? { ok: 0, tried: 0 }
        return {
          ...prev,
          solved: ok ? { ...prev.solved, [id]: Date.now() } : prev.solved,
          days: { ...prev.days, [key]: { ok: day.ok + (ok ? 1 : 0), tried: day.tried + 1 } },
        }
      })
    },
    [setP],
  )

  const setDaily = useCallback((ids: string[]) => setP((prev) => ({ ...prev, daily: { day: dayKey(new Date()), ids } })), [setP])

  const stats = useMemo(() => {
    const today = new Date()
    let streak = 0
    const cursor = new Date(today)
    if (!(p.days[dayKey(cursor)]?.ok > 0)) cursor.setDate(cursor.getDate() - 1)
    while (p.days[dayKey(cursor)]?.ok > 0) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    let weekOk = 0
    let weekTried = 0
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    for (let d = new Date(monday); d <= today; d.setDate(d.getDate() + 1)) {
      const day = p.days[dayKey(d)]
      if (day) {
        weekOk += day.ok
        weekTried += day.tried
      }
    }
    return { streak, weekOk, weekTried, solved: new Set(Object.keys(p.solved)) }
  }, [p])

  const dailyIds = p.daily?.day === dayKey(new Date()) ? p.daily.ids : null
  return { ...stats, record, dailyIds, setDaily }
}

/** Today's drill set (fixed for the day once chosen). */
export function useDailyDrills(all: DrillCard[], progress: ReturnType<typeof useDrillProgress>): DrillCard[] {
  const { dailyIds, solved, setDaily } = progress
  const byId = useMemo(() => new Map(all.map((d) => [d.id, d])), [all])
  const stored = useMemo(() => (dailyIds ? dailyIds.map((id) => byId.get(id)).filter((d): d is DrillCard => !!d) : null), [dailyIds, byId])
  const fresh = useMemo(() => dailySet(all, solved), [all, solved])
  const needsPick = (!stored || stored.length === 0) && fresh.length > 0
  useEffect(() => {
    if (needsPick) setDaily(fresh.map((d) => d.id))
  }, [needsPick, fresh, setDaily])
  return stored && stored.length > 0 ? stored : fresh
}
