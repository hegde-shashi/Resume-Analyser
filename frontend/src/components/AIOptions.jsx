import { useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { Key, ChevronDown, Loader2 } from 'lucide-react'

/* ─── API Key Modal ───────────────────────────────────────────── */
export function ApiKeyModal() {
    const { setShowKeyModal, confirmUserKey } = useSettings()
    const [key, setKey] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onConfirm = async () => {
        if (!key) return;
        setLoading(true)
        setError('')
        const res = await confirmUserKey(key)
        if (!res.success) setError(res.error)
        setLoading(false)
    }

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !loading && setShowKeyModal(false)}>
            <div className="modal-box" style={{ maxWidth: 440 }}>
                <div className="modal-header">
                    <h3>Custom API Key</h3>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowKeyModal(false)} disabled={loading}>✕</button>
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
                            onKeyDown={e => e.key === 'Enter' && !loading && onConfirm()}
                            autoFocus
                            disabled={loading}
                        />
                        {error && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.5rem', display: 'flex', gap: '4px' }}>
                                ✕ {error}
                            </div>
                        )}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setShowKeyModal(false)} disabled={loading}>Cancel</button>
                    <button className="btn btn-primary" disabled={!key || loading} onClick={onConfirm}>
                        {loading ? <Loader2 size={14} className="spin" /> : <Key size={14} />}
                        {loading ? 'Checking…' : 'Use this key'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ─── Model Selector Dropdown ─────────────────────────────────── */
export function ModelSelector({ vertical = false }) {
    const { model, models, loadingModels, setModel, fetchModels, apiMode, apiKey } = useSettings()
    const [open, setOpen] = useState(false)

    const refresh = (e) => {
        e.stopPropagation()
        fetchModels(apiMode, apiKey)
    }

    return (
        <div style={{ position: 'relative', width: vertical ? '100%' : 'auto' }}>
            <button
                className="btn btn-secondary btn-sm"
                style={{ gap: '0.4rem', minWidth: vertical ? '100%' : 180, justifyContent: 'space-between' }}
                onClick={() => setOpen(o => !o)}
                disabled={loadingModels}
            >
                {loadingModels
                    ? <><Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Loading…</>
                    : <><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: vertical ? 'none' : 140 }}>{model || 'Select model'}</span><ChevronDown size={13} /></>
                }
            </button>

            {open && (
                <div style={{
                    position: vertical ? 'static' : 'absolute',
                    top: vertical ? 0 : 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 300,
                    marginTop: vertical ? '0.5rem' : 0,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                    minWidth: vertical ? '100%' : 220, overflow: 'hidden',
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
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {open && !vertical && <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setOpen(false)} />}
        </div>
    )
}

/* ─── API Mode Toggle ─────────────────────────────────────────── */
export function ApiModeToggle() {
    const { apiMode, switchToUser, switchToDefault, setShowKeyModal } = useSettings()

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div className="tabs" style={{ padding: '3px', gap: '2px', width: '100%' }}>
                <button
                    className={`tab ${apiMode === 'default' ? 'active' : ''}`}
                    onClick={switchToDefault}
                    style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', flex: 1 }}
                >
                    Default
                </button>
                <button
                    className={`tab ${apiMode === 'user' ? 'active' : ''}`}
                    onClick={apiMode === 'user' ? () => setShowKeyModal(true) : switchToUser}
                    style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'center' }}
                >
                    <Key size={10} />
                    {apiMode === 'user' ? 'Custom' : 'Custom'}
                </button>
            </div>
        </div>
    )
}
