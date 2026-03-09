import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import { Sun, Moon, Key, ChevronDown, Loader2 } from 'lucide-react'
import { useState } from 'react'

/* ─── API Key Modal ───────────────────────────────────────────── */
function ApiKeyModal() {
    const { setShowKeyModal, confirmUserKey } = useSettings()
    const [key, setKey] = useState('')

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowKeyModal(false)}>
            <div className="modal-box" style={{ maxWidth: 440 }}>
                <div className="modal-header">
                    <h3>Custom API Key</h3>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowKeyModal(false)}>✕</button>
                </div>
                <div className="modal-body">
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        Enter your Google Gemini API key. It will be used instead of the default server key
                        and is never stored on disk.
                    </p>
                    <div className="form-group">
                        <label className="form-label">Gemini API Key</label>
                        <input
                            className="form-input"
                            type="password"
                            placeholder="AIzaSy…"
                            value={key}
                            onChange={e => setKey(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && key && confirmUserKey(key)}
                            autoFocus
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setShowKeyModal(false)}>Cancel</button>
                    <button className="btn btn-primary" disabled={!key} onClick={() => confirmUserKey(key)}>
                        <Key size={14} /> Use this key
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ─── Model Selector Dropdown ─────────────────────────────────── */
function ModelSelector() {
    const { model, models, loadingModels, setModel, fetchModels, apiMode, apiKey } = useSettings()
    const [open, setOpen] = useState(false)

    const refresh = (e) => {
        e.stopPropagation()
        fetchModels(apiMode, apiKey)
    }

    return (
        <div style={{ position: 'relative' }}>
            <button
                className="btn btn-secondary btn-sm"
                style={{ gap: '0.4rem', minWidth: 180, justifyContent: 'space-between' }}
                onClick={() => setOpen(o => !o)}
                disabled={loadingModels}
            >
                {loadingModels
                    ? <><Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Loading…</>
                    : <><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{model || 'Select model'}</span><ChevronDown size={13} /></>
                }
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                    minWidth: 220, overflow: 'hidden',
                }}>
                    <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available Models</span>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={refresh}>
                            Refresh
                        </button>
                    </div>
                    {models.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            No models found
                        </div>
                    ) : (
                        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                            {models.map(m => (
                                <button
                                    key={m}
                                    onClick={() => { setModel(m); setOpen(false) }}
                                    style={{
                                        display: 'block', width: '100%', padding: '0.6rem 0.9rem',
                                        textAlign: 'left', background: m === model ? 'var(--accent-glow)' : 'none',
                                        color: m === model ? 'var(--accent)' : 'var(--text-primary)',
                                        border: 'none', cursor: 'pointer', fontSize: '0.85rem',
                                        transition: 'background var(--transition)',
                                        fontWeight: m === model ? 700 : 400,
                                    }}
                                    onMouseEnter={e => { if (m !== model) e.target.style.background = 'var(--bg-hover)' }}
                                    onMouseLeave={e => { if (m !== model) e.target.style.background = 'none' }}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {open && <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setOpen(false)} />}
        </div>
    )
}

/* ─── API Mode Toggle ─────────────────────────────────────────── */
function ApiModeToggle() {
    const { apiMode, apiKey, switchToUser, switchToDefault, setShowKeyModal } = useSettings()

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div className="tabs" style={{ padding: '3px', gap: '2px' }}>
                <button
                    className={`tab ${apiMode === 'default' ? 'active' : ''}`}
                    onClick={switchToDefault}
                    style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem' }}
                >
                    Default Key
                </button>
                <button
                    className={`tab ${apiMode === 'user' ? 'active' : ''}`}
                    onClick={apiMode === 'user' ? () => setShowKeyModal(true) : switchToUser}
                    style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    <Key size={10} />
                    {apiMode === 'user' ? '●' : 'My Key'}
                </button>
            </div>
        </div>
    )
}

/* ─── Topbar ──────────────────────────────────────────────────── */
export default function Topbar({ pageTitle }) {
    const { logout } = useAuth()
    const { theme, toggle } = useTheme()
    const { showKeyModal } = useSettings()

    return (
        <>
            <header className="topbar">
                <span className="topbar-title">{pageTitle}</span>

                <div className="topbar-actions">
                    <ModelSelector />
                    <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                    <ApiModeToggle />
                    <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                    <button className="btn btn-ghost btn-icon" onClick={toggle} title="Toggle theme">
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </div>
            </header>

            {showKeyModal && <ApiKeyModal />}
        </>
    )
}
