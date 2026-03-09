import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import toast from 'react-hot-toast'
import { useTheme } from '../context/ThemeContext'
import { Sun, Moon, FileText } from 'lucide-react'

export default function AuthPage() {
    const { login } = useAuth()
    const { theme, toggle } = useTheme()
    const [mode, setMode] = useState('login')
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ username: '', email: '', password: '' })

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)
        try {
            if (mode === 'login') {
                const { data } = await api.post('/login', { email: form.email, password: form.password })
                login(data.token, data.user_id)
                toast.success('Welcome back!')
            } else {
                await api.post('/register', { username: form.username, email: form.email, password: form.password })
                toast.success('Account created! Please log in.')
                setMode('login')
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <div style={{ position: 'fixed', top: '1rem', right: '1rem' }}>
                <button className="btn btn-ghost btn-icon" onClick={toggle} title="Toggle theme">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            <div className="auth-card">
                <div className="auth-logo">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div style={{ background: 'var(--accent)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
                            <FileText size={22} color="#fff" />
                        </div>
                    </div>
                    <h1>Resume Analyser</h1>
                    <p>AI-powered job application assistant</p>
                </div>

                <div className="tabs" style={{ margin: '0 auto 1.5rem', display: 'flex' }}>
                    <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Sign In</button>
                    <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Register</button>
                </div>

                <form onSubmit={handleSubmit} className="auth-grid">
                    {mode === 'register' && (
                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input className="form-input" placeholder="johndoe" value={form.username}
                                onChange={e => set('username', e.target.value)} required />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" placeholder="you@example.com" value={form.email}
                            onChange={e => set('email', e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input className="form-input" type="password" placeholder="••••••••" value={form.password}
                            onChange={e => set('password', e.target.value)} required />
                    </div>
                    <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                        {loading ? <span className="spinner" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    )
}
