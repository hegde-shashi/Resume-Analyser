import React from 'react'
import { createPortal } from 'react-dom'

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Delete', loading = false, isDanger = true }) {
    if (!isOpen) return null

    return createPortal(
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !loading && onCancel()}>
            <div className="modal-box" style={{ maxWidth: 400, margin: 'auto' }}>
                <div className="modal-header">
                    <h3 style={{ color: isDanger ? 'var(--danger)' : 'inherit' }}>{title}</h3>
                    {!loading && <button className="btn btn-ghost btn-icon btn-sm" onClick={onCancel}>✕</button>}
                </div>
                <div className="modal-body" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    {message}
                </div>
                <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
                        Cancel
                    </button>
                    <button className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
                        {loading ? <span className="spinner" /> : confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
