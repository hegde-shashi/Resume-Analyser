import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, FileText, Briefcase, MessageSquare, LogOut, Settings } from 'lucide-react'
import { ModelSelector, ApiModeToggle } from './AIOptions'

const NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { key: 'resume', label: 'Resume', icon: <FileText size={16} /> },
    { key: 'jobs', label: 'Jobs', icon: <Briefcase size={16} /> },
    { key: 'chat', label: 'AI Chat', icon: <MessageSquare size={16} /> },
]

export default function Sidebar({ page, setPage, isOpen, setIsOpen, hidden, setHidden }) {
    const { logout } = useAuth()

    const handleNav = (key) => {
        setPage(key)
        setIsOpen(false)
    }

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-logo">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ background: 'linear-gradient(90deg, var(--text-primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>Resume<br />Analyser</h1>
                    <button className="btn btn-ghost btn-sm mobile-only" onClick={() => setIsOpen(false)}>✕</button>
                </div>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginTop: '0.4rem', fontWeight: 600 }}>Your AI Career Partner</span>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section-label">Navigation</div>
                {NAV.map(n => (
                    <button
                        key={n.key}
                        className={`nav-item ${page === n.key ? 'active' : ''}`}
                        onClick={() => handleNav(n.key)}
                    >
                        {n.icon} {n.label}
                    </button>
                ))}

                {/* Mobile specific AI settings */}
                <div className="mobile-only" style={{ flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem', padding: '0 0.5rem' }}>
                    <div className="nav-section-label" style={{ paddingLeft: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Settings size={12} /> AI Settings
                    </div>
                    <ApiModeToggle />
                    <ModelSelector vertical={true} />
                </div>
            </nav>

            <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <button className="nav-item" onClick={logout} style={{ color: 'var(--danger)' }}>
                    <LogOut size={16} /> Sign Out
                </button>
            </div>
        </aside>
    )
}
