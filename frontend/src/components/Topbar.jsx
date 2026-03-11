import { useTheme } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import { Sun, Moon, Menu, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { ApiKeyModal, ModelSelector, ApiModeToggle } from './AIOptions'
import Logo from './Logo'

export default function Topbar({ pageTitle, setSidebarOpen, sidebarHidden, setSidebarHidden }) {
    const { theme, toggle } = useTheme()
    const { showKeyModal } = useSettings()

    return (
        <>
            <header className="topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <button
                        className="btn btn-ghost btn-icon mobile-only"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu size={20} />
                    </button>
                    {sidebarHidden ? (
                        <>
                            <button
                                className="btn btn-ghost btn-icon desktop-only"
                                onClick={() => setSidebarHidden(false)}
                                title="Show menu"
                            >
                                <PanelLeftOpen size={20} />
                            </button>
                            <a href="/dashboard">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.5rem', justifyContent: 'center' }}>
                                    <Logo size={75} />
                                </span>
                            </a>
                        </>
                    ) : (
                        <button
                            className="btn btn-ghost btn-icon desktop-only"
                            onClick={() => setSidebarHidden(true)}
                            title="Hide menu"
                        >
                            <PanelLeftClose size={20} />
                        </button>
                    )}
                    {/* <span className="topbar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pageTitle}
                    </span> */}
                </div>


                <div className="topbar-actions">
                    <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ModelSelector />
                        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                        <ApiModeToggle />
                        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={toggle} title="Toggle theme" style={{ flexShrink: 0 }}>
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </div>
            </header>

            {showKeyModal && <ApiKeyModal />}
        </>
    )
}
