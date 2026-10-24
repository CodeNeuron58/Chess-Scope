import { useEffect, useState } from 'react'

/** Responsive board size, clamped to the viewport. */
export function useBoardSize(): number {
  const [boardSize, setBoardSize] = useState(560)
  useEffect(() => {
    const calc = () => {
      const byHeight = window.innerHeight - 235
      const byWidth = window.innerWidth - 500
      setBoardSize(Math.max(340, Math.min(byHeight, byWidth, 600)))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])
  return boardSize
}
