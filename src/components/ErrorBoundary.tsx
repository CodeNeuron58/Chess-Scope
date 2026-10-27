import { Component, type ErrorInfo, type ReactNode } from 'react'
import { APP_VERSION, REPO_URL } from '../lib/constants'
import './errorBoundary.css'

interface State {
  error: Error | null
}

/** Clears saved preferences (not the game library) — the usual fix for a bad saved setting. */
function resetSettings() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('owlchess.')) localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
  window.location.reload()
}

function reportUrl(error: Error): string {
  const body = [
    '**What were you doing when it broke?**',
    '',
    '',
    '**Error**',
    '```',
    `${error.name}: ${error.message}`,
    (error.stack ?? '').split('\n').slice(1, 6).join('\n'),
    '```',
    `Owlchess ${APP_VERSION} · ${navigator.userAgent}`,
  ].join('\n')
  const params = new URLSearchParams({ title: `Crash: ${error.message.slice(0, 80)}`, body, labels: 'bug' })
  return `${REPO_URL}/issues/new?${params}`
}

/** Shows a recovery screen instead of a blank page when rendering crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Owlchess crashed', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="crash" role="alert">
        <div className="crash__card">
          <img src={`${import.meta.env.BASE_URL}owlchess-mark.png`} alt="" className="crash__logo" />
          <h1>Something went wrong</h1>
          <p>Owlchess hit an unexpected error. Your games and reviews are safe — they're stored in this browser.</p>
          <code className="crash__error">{error.message}</code>
          <div className="crash__actions">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button type="button" className="btn btn--outline" onClick={resetSettings} title="Clears preferences only; your library is kept">
              Reset settings and reload
            </button>
            <a className="btn btn--quiet" href={reportUrl(error)} target="_blank" rel="noreferrer">
              Report this problem
            </a>
          </div>
        </div>
      </div>
    )
  }
}
