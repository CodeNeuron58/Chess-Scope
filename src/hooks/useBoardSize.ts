import { useEffect, useState } from 'react'

interface Options {
  /** Vertical space around the board on its page (top bar, player rows, padding). */
  reserveH?: number
  /** Width taken next to the board in the board column (eval bar + gap). */
  reserveW?: number
  /** Width of the side panel. */
  panel?: number
}

/** Responsive board size: fills the space beside the side panel, clamped to the viewport. */
export function useBoardSize({ reserveH = 190, reserveW = 30, panel = 400 }: Options = {}): number {
  const [size, setSize] = useState(560)
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const rail = vw < 720 ? 0 : 76
      if (vw < 1100) {
        // stacked layout: board above the panel, page scrolls
        setSize(Math.max(260, Math.min(vw - rail - 32 - reserveW, 640)))
        return
      }
      const byHeight = vh - reserveH
      const byWidth = vw - rail - panel - 24 - 48 - reserveW
      setSize(Math.max(360, Math.min(byHeight, byWidth, 880)))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [reserveH, reserveW, panel])
  return size
}
