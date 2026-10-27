import { useEffect, useState } from 'react'
import { onEngineDownload, type DownloadState } from '../engine/download'

/** The latest engine download progress (null until a download starts this session). */
export function useEngineDownload(): DownloadState | null {
  const [state, setState] = useState<DownloadState | null>(null)
  useEffect(() => onEngineDownload(setState), [])
  return state
}

/** "45 of 99 MB" style progress text. */
export function downloadText(d: DownloadState): string {
  const mb = (n: number) => Math.round(n / 1_000_000)
  return `${mb(d.loaded)} of ${mb(d.total)} MB`
}
