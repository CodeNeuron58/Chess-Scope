/** "12 min ago", "2 h ago", "Yesterday", "3 days ago", "Oct 4". */
export function timeAgo(ms: number, now = Date.now()): string {
  const diff = Math.max(0, now - ms)
  const min = Math.round(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(diff / 86_400_000)
  if (d <= 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  return shortDay(ms, now)
}

export function shortDay(ms: number, now = Date.now()): string {
  const day = (t: number) => new Date(t).toDateString()
  if (day(ms) === day(now)) return 'Today'
  if (day(ms) === day(now - 86_400_000)) return 'Yesterday'
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear()
  return new Date(ms).toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' })
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '—'
}

export function speedLabel(speed?: string): string {
  if (!speed) return '—'
  return speed[0].toUpperCase() + speed.slice(1)
}

/** Scroll `el` into view inside its nearest scrollable parent only (never the page). */
export function revealInList(el: HTMLElement | null) {
  if (!el) return
  let box = el.parentElement
  while (box && !(box.scrollHeight > box.clientHeight && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement
  if (!box || box.classList.contains('page')) return
  const r = el.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  if (r.top < b.top) box.scrollTop -= b.top - r.top + 8
  else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 8
}
