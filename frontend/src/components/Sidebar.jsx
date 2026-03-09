import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { LayoutDashboard, FileText, Briefcase, MessageSquare, LogOut, Sun, Moon } from 'lucide-react'

const NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { key: 'resume', label: 'Resume', icon: <FileText size={16} /> },
    { key: 'jobs', label: 'Jobs', icon: <Briefcase size={16} /> },
    { key: 'chat', label: 'AI Chat', icon: <MessageSquare size={16} /> },
]

export default function Sidebar({ page, setPage }) {
    const { logout } = useAuth()
    const { theme, toggle } = useTheme()

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <h1>Resume<br />Analyser</h1>
                <span>AI Job Assistant</span>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section-label">Navigation</div>
                {NAV.map(n => (
                    <button
                        key={n.key}
                        className={`nav-item ${page === n.key ? 'active' : ''}`}
                        onClick={() => setPage(n.key)}
                    >
                        {n.icon} {n.label}
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                {/* Theme toggle */}
                <div className="theme-toggle" onClick={toggle} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div className={`theme-toggle-option ${theme === 'light' ? 'active' : ''}`}><Sun size={12} /></div>
                    <div className={`theme-toggle-option ${theme === 'dark' ? 'active' : ''}`}><Moon size={12} /></div>
                </div>

                <button className="nav-item" onClick={logout} style={{ color: 'var(--danger)' }}>
                    <LogOut size={16} /> Sign Out
                </button>
            </div>
        </aside>
    )
}
