import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import toast from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'
import { Sun, Moon, ArrowLeft } from 'lucide-react'
import Logo from '../components/Logo'

export default function AuthPage() {
    const { login } = useAuth()
    const { theme, toggle } = useTheme()
    const [mode, setMode] = useState('login') // 'login', 'register', 'forgot', 'reset'
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
    const [resetToken, setResetToken] = useState(null)

    useEffect(() => {
        const path = window.location.pathname
        if (path.startsWith('/reset-password/')) {
            const token = path.split('/').pop()
            setResetToken(token)
            setMode('reset')
        }
    }, [])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)
        try {
            if (mode === 'login') {
                const { data } = await api.post('/login', { email: form.email, password: form.password })
                login(data.token, data.user_id, data.username)
                toast.success('Welcome back!')
            } else if (mode === 'register') {
                await api.post('/register', { username: form.username, email: form.email, password: form.password })
                toast.success('Account created! Please log in.')
                setMode('login')
            } else if (mode === 'forgot') {
                const { data } = await api.post('/forgot-password', { email: form.email })
                if (data.reset_link) {
                    window.open(data.reset_link, '_blank')
                    toast.success('Reset link opened in new tab.')
                }
                setMode('login')
            } else if (mode === 'reset') {
                if (form.password !== form.confirmPassword) {
                    toast.error('Passwords do not match')
                    return
                }
                const { data } = await api.post('/reset-password', { token: resetToken, password: form.password })
                toast.success('Password reset successful!')
                
                // Automatically log the user in after reset
                if (data.token) {
                    login(data.token, data.user_id, data.username)
                } else {
                    setMode('login')
                }
                
                setResetToken(null);
                window.history.pushState({}, '', '/')
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    const renderHeader = () => {
        if (mode === 'forgot') return 'Reset Password'
        if (mode === 'reset') return 'Create New Password'
        return 'Optimize Your Career Path'
    }

    return (
        <div className="auth-page">
            <div style={{ position: 'fixed', top: '1rem', right: '1rem' }}>
                <button className="btn btn-ghost btn-icon" onClick={toggle} title="Toggle theme">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            <div className="auth-card">
                <div className="auth-logo" style={{ marginBottom: '2.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Logo size={200} />
                    </div>
                    <p style={{ color: 'var(--text-muted)' }}>{renderHeader()}</p>
                </div>

                {(mode === 'login' || mode === 'register') && (
                    <div className="tabs" style={{ margin: '0 auto 1.5rem', display: 'flex' }}>
                        <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Sign In</button>
                        <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Register</button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-grid">
                    {mode === 'forgot' && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                Enter your email address and we'll send you a link to reset your password.
                            </p>
                        </div>
                    )}

                    {mode === 'register' && (
                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input className="form-input" placeholder="Enter full name" value={form.username}
                                onChange={e => set('username', e.target.value)} required />
                        </div>
                    )}

                    {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" placeholder="you@example.com" value={form.email}
                                onChange={e => set('email', e.target.value)} required />
                        </div>
                    )}

                    {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label className="form-label">{mode === 'reset' ? 'New Password' : 'Password'}</label>
                                {mode === 'login' && (
                                    <button type="button" className="btn btn-link btn-xs" onClick={() => setMode('forgot')} style={{ padding: 0, height: 'auto', fontWeight: 500 }}>
                                        Forgot password?
                                    </button>
                                )}
                            </div>
                            <input className="form-input" type="password" placeholder="••••••••" value={form.password}
                                onChange={e => set('password', e.target.value)} required />
                        </div>
                    )}

                    {mode === 'reset' && (
                        <div className="form-group">
                            <label className="form-label">Confirm New Password</label>
                            <input className="form-input" type="password" placeholder="••••••••" value={form.confirmPassword}
                                onChange={e => set('confirmPassword', e.target.value)} required />
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                            {loading ? <span className="spinner" /> : 
                             mode === 'login' ? 'Sign In' : 
                             mode === 'register' ? 'Create Account' : 
                             mode === 'forgot' ? 'Send Reset Link' : 'Reset Password'}
                        </button>

                        {(mode === 'forgot' || mode === 'reset') && (
                            <button type="button" className="btn btn-ghost" onClick={() => {
                                setMode('login');
                                window.history.pushState({}, '', '/');
                            }} style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}>
                                <ArrowLeft size={16} /> Back to Sign In
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}
