import { useState, useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SettingsProvider } from './context/SettingsContext'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import ResumePage from './pages/ResumePage'
import JobsPage from './pages/JobsPage'
import ChatPage from './pages/ChatPage'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  resume: 'My Resume',
  jobs: 'Job Tracker',
  chat: 'AI Chat Assistant',
}

function AppShell() {
  const { isAuth } = useAuth()
  const [page, setPage] = useState(() => localStorage.getItem('lastPage') || 'dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(false)

  useEffect(() => {
    localStorage.setItem('lastPage', page)
  }, [page])

  if (!isAuth) return <AuthPage />

  const PageComponent = {
    dashboard: Dashboard,
    resume: ResumePage,
    jobs: JobsPage,
    chat: ChatPage,
  }[page] || Dashboard

  return (
    <div className={`app-shell page-${page} ${sidebarHidden ? 'sidebar-hidden' : ''}`}>
      <Sidebar page={page} setPage={setPage} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} hidden={sidebarHidden} setHidden={setSidebarHidden} />
      <div className="main-content">
        <Topbar pageTitle={PAGE_TITLES[page]} setSidebarOpen={setSidebarOpen} sidebarHidden={sidebarHidden} setSidebarHidden={setSidebarHidden} />
        <main className="page-body">
          <PageComponent setPage={setPage} />
        </main>
      </div>
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                },
              }}
            />
            <AppShell />
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
