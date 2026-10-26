import { useEffect } from 'react'
import { AppProvider } from './state/AppProvider'
import { useApp } from './state/context'
import { Rail } from './components/Rail'
import { HomePage } from './pages/HomePage'
import { ReviewPage } from './pages/ReviewPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { LibraryPage } from './pages/LibraryPage'
import { InsightsPage } from './pages/InsightsPage'
import { DrillsPage } from './pages/DrillsPage'
import { SettingsPage } from './pages/SettingsPage'

const TITLES: Record<string, string> = {
  home: 'Home',
  review: 'Game review',
  analysis: 'Analysis board',
  library: 'Library',
  insights: 'Insights',
  drills: 'Drills',
  settings: 'Settings',
}

function CurrentPage() {
  const { route } = useApp()
  useEffect(() => {
    document.title = `${TITLES[route.page]} · Owlchess`
  }, [route.page])
  switch (route.page) {
    case 'review':
      return <ReviewPage />
    case 'analysis':
      return <AnalysisPage />
    case 'library':
      return <LibraryPage />
    case 'insights':
      return <InsightsPage />
    case 'drills':
      return <DrillsPage />
    case 'settings':
      return <SettingsPage />
    default:
      return <HomePage />
  }
}

/** Composition root: app state provider, navigation rail and the routed page. */
export default function App() {
  return (
    <AppProvider>
      <div className="app">
        <Rail />
        <CurrentPage />
      </div>
    </AppProvider>
  )
}
