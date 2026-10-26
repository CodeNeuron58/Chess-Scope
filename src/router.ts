import { useCallback, useEffect, useState } from 'react'

export type Page = 'home' | 'review' | 'analysis' | 'library' | 'insights' | 'drills' | 'settings'

const PAGES: Page[] = ['home', 'review', 'analysis', 'library', 'insights', 'drills', 'settings']

export interface Route {
  page: Page
  params: URLSearchParams
  /** In-page anchor, e.g. "#/settings/accounts" → "accounts". */
  section: string
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '')
  const [path, query = ''] = raw.split('?')
  const [first = '', section = ''] = path.split('/')
  const page = (PAGES as string[]).includes(first) ? (first as Page) : 'home'
  return { page, params: new URLSearchParams(query), section }
}

export function href(page: Page, params?: Record<string, string>, section?: string): string {
  const q = params && Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''
  return `#/${page === 'home' ? '' : page}${section ? `/${section}` : ''}${q}`
}

/** Minimal hash router: no dependency, works from file:// and any static host. */
export function useRoute(): [Route, (page: Page, params?: Record<string, string>, section?: string) => void] {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = useCallback((page: Page, params?: Record<string, string>, section?: string) => {
    window.location.hash = href(page, params, section)
  }, [])
  return [route, navigate]
}
