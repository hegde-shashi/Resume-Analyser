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
                {/* Mobile: Left side (Menu) */}
                <div className="mobile-only" style={{ width: '40px' }}>
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu size={20} />
                    </button>
                </div>

                {/* Mobile: Center (Logo) / Desktop: Left */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {sidebarHidden ? (
                            <>
                                <button
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => setSidebarHidden(false)}
                                    title="Show menu"
                                >
                                    <PanelLeftOpen size={20} />
                                </button>
                                <div style={{ paddingTop: '0.5rem' }}>
                                    <a href="/">
                                        <Logo size={75} />
                                    </a>
                                </div>
                            </>
                        ) : (
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => setSidebarHidden(true)}
                                title="Hide menu"
                            >
                                <PanelLeftClose size={20} />
                            </button>
                        )}
                    </div>
                    
                    {/* Centered Logo on Mobile */}
                    <div className="mobile-only" style={{ paddingTop: '0.5rem' , width: '100%', textAlign: 'center' }}>
                        <a href="/">
                            <Logo size={85} />
                        </a>
                    </div>
                </div>

                {/* Right Area (Theme, etc) */}
                <div className="topbar-actions" style={{ width: 'auto', minWidth: '40px', justifyContent: 'flex-end' }}>
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
