import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, FileText, Briefcase, MessageSquare, LogOut, Settings, User, Key, UserX, ChevronRight, ChevronDown } from 'lucide-react'
import { ModelSelector, ApiModeToggle } from './AIOptions'
import Logo from './Logo'
import ConfirmModal from './ConfirmModal'
import api from '../api'
import toast from 'react-hot-toast'

const NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { key: 'resume', label: 'Resume', icon: <FileText size={16} /> },
    { key: 'jobs', label: 'Jobs', icon: <Briefcase size={16} /> },
    { key: 'chat', label: 'AI Chat', icon: <MessageSquare size={16} /> },
]

export default function Sidebar({ page, setPage, isOpen, setIsOpen, hidden, setHidden }) {
    const { logout, username } = useAuth()
    const [profileExpanded, setProfileExpanded] = useState(false)
    const [showChangePassword, setShowChangePassword] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleteInput, setDeleteInput] = useState('')
    const [loading, setLoading] = useState(false)

    const [passwordForm, setPasswordForm] = useState({ old: '', new: '', confirm: '' })

    const handleNav = (key) => {
        setPage(key)
        setIsOpen(false)
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        if (passwordForm.new !== passwordForm.confirm) {
            return toast.error('Passwords do not match')
        }
        setLoading(true)
        try {
            await api.post('/change-password', {
                old_password: passwordForm.old,
                new_password: passwordForm.new
            })
            toast.success('Password updated successfully')
            setShowChangePassword(false)
            setPasswordForm({ old: '', new: '', confirm: '' })
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to change password')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteUser = async () => {
        if (deleteInput !== 'delete') {
            return toast.error('Please type "delete" to confirm')
        }
        setLoading(true)
        try {
            await api.delete('/delete')
            toast.success('Account deleted successfully')
            logout()
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete account')
        } finally {
            setLoading(false)
        }
    }

    const [touchStart, setTouchStart] = useState(null)
    const [touchEnd, setTouchEnd] = useState(null)

    // Minimum swipe distance in pixels
    const minSwipeDistance = 50

    const onTouchStart = (e) => {
        setTouchEnd(null)
        setTouchStart(e.targetTouches[0].clientX)
    }

    const onTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX)
    }

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return
        const distance = touchStart - touchEnd
        const isLeftSwipe = distance > minSwipeDistance
        if (isLeftSwipe) {
            setIsOpen(false)
        }
    }

    return (
        <aside 
            className={`sidebar ${isOpen ? 'open' : ''}`}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <div className="sidebar-logo">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem' }}>
                    <Logo size={200} />
                </div>

                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginTop: '0.4rem', fontWeight: 600, textAlign: 'center' }}>
                    Optimize Your Career Path
                </span>
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

            <div className="sidebar-footer">
                <div className="profile-section">
                    <button 
                        className={`nav-item profile-trigger ${profileExpanded ? 'active' : ''}`}
                        onClick={() => setProfileExpanded(!profileExpanded)}
                    >
                        <User size={16} />
                        <span style={{ flex: 1, textAlign: 'left' }}>{username || 'Profile'}</span>
                        {profileExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    
                    {profileExpanded && (
                        <div className="profile-menu">
                            <button className="nav-item sub-item" onClick={() => { setShowChangePassword(true); setIsOpen(false); }}>
                                <Key size={14} /> Change Password
                            </button>
                            <button className="nav-item sub-item delete-action" onClick={() => { setShowDeleteConfirm(true); setIsOpen(false); }}>
                                <UserX size={14} /> Delete User
                            </button>
                            <button className="nav-item sub-item" onClick={() => { logout(); setIsOpen(false); }} style={{ color: 'var(--danger)' }}>
                                <LogOut size={14} /> Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Change Password Modal */}
            {showChangePassword && createPortal(
                <div className="modal-overlay" onClick={() => !loading && setShowChangePassword(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, margin: 'auto' }}>
                        <div className="modal-header">
                            <h3>Change Password</h3>
                            {!loading && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowChangePassword(false)}>✕</button>}
                        </div>
                        <form onSubmit={handleChangePassword} className="modal-body auth-grid">
                            <div className="form-group">
                                <label className="form-label">Old Password</label>
                                <input 
                                    className="form-input" 
                                    type="password" 
                                    required 
                                    value={passwordForm.old}
                                    onChange={e => setPasswordForm({...passwordForm, old: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">New Password</label>
                                <input 
                                    className="form-input" 
                                    type="password" 
                                    required 
                                    value={passwordForm.new}
                                    onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirm New Password</label>
                                <input 
                                    className="form-input" 
                                    type="password" 
                                    required 
                                    value={passwordForm.confirm}
                                    onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                                />
                            </div>
                            <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowChangePassword(false)} disabled={loading}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? <span className="spinner" /> : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete User Confirmation Modal */}
            <ConfirmModal 
                isOpen={showDeleteConfirm}
                title="Delete Account"
                isDanger={true}
                loading={loading}
                confirmDisabled={deleteInput !== 'delete'}
                onCancel={() => {
                    setShowDeleteConfirm(false)
                    setDeleteInput('')
                }}
                onConfirm={handleDeleteUser}
                message={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <p>This action is <strong>permanent</strong> and cannot be undone. This will delete your account and all associated data including resumes and job history.</p>
                        <div className="form-group">
                            <label className="form-label">Please type <strong>delete</strong> to confirm:</label>
                            <input 
                                className="form-input" 
                                value={deleteInput}
                                onChange={e => setDeleteInput(e.target.value)}
                                placeholder="type delete"
                                autoFocus
                            />
                        </div>
                    </div>
                }
                confirmText="Permanently Delete My Account"
            />
        </aside>
    )
}
