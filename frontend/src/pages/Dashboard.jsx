import { useEffect, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { Briefcase, BarChart2, TrendingUp, ArrowRight } from 'lucide-react'

const PROGRESS_COLORS = {
    Applied: 'badge-accent',
    'HR Interview': 'badge-warning',
    'Technical Interview': 'badge-warning',
    'Final Round': 'badge-accent',
    Offer: 'badge-success',
    Rejected: 'badge-danger',
}

export default function Dashboard({ setPage }) {
    const { username } = useAuth()
    const [jobs, setJobs] = useState([])
    const [resume, setResume] = useState(null)
    const [loading, setLoading] = useState(true)

    const loadData = () => {
        Promise.all([
            api.get('/get_jobs'),
            api.get('/get_resume'),
        ]).then(([j, r]) => {
            setJobs(j.data)
            setResume(r.data)
        }).finally(() => setLoading(false))
    }

    useEffect(() => {
        loadData()

        // 1. Refresh when window gains focus (user comes back from extension)
        const onFocus = () => loadData()
        window.addEventListener('focus', onFocus)

        // 2. Refresh every 30 seconds in the background
        const interval = setInterval(loadData, 30000)

        return () => {
            window.removeEventListener('focus', onFocus)
            clearInterval(interval)
        }
    }, [])

    const counts = jobs.reduce((acc, j) => {
        acc[j.progress] = (acc[j.progress] || 0) + 1
        return acc
    }, {})

    const stats = [
        { label: 'Total Jobs', value: jobs.length, icon: <Briefcase size={20} />, color: 'var(--accent)', page: 'jobs' },
        { label: 'Active', value: jobs.filter(j => !['Rejected', 'Offer'].includes(j.progress)).length, icon: <TrendingUp size={20} />, color: 'var(--warning)', page: 'jobs' },
        { label: 'Offers', value: counts['Offer'] || 0, icon: <BarChart2 size={20} />, color: 'var(--success)', page: 'jobs' },
    ]

    if (loading) return (
        <div className="loading-center">
            <div className="spinner spinner-lg" />
            <span>Loading dashboard…</span>
        </div>
    )

    return (
        <div>
            <div className="page-header">
                <h2 className="mobile-hidden">Dashboard</h2>
                <p>Hi {username || 'there'}, here's an overview of your job application journey</p>
            </div>

            {/* Stats — each card navigates to its page */}
            <div className="grid-3" style={{ marginBottom: '2rem' }}>
                {stats.map(s => (
                    <div
                        className="stat-card"
                        key={s.label}
                        onClick={() => setPage(s.page)}
                        style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
                    >
                        <div className="stat-icon" style={{ background: `${s.color}22` }}>
                            <span style={{ color: s.color }}>{s.icon}</span>
                        </div>
                        <div className="stat-value">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Resume tile — navigates to resume page */}
            <div
                className="card"
                style={{ marginBottom: '1.5rem', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onClick={() => setPage('resume')}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div className="card-title">Resume</div>
                        {resume?.resume_exists
                            ? <div className="card-sub">📄 {resume.resume_name} &nbsp;·&nbsp; Uploaded {resume.created_at}</div>
                            : <div className="card-sub" style={{ color: 'var(--warning)' }}>No resume uploaded yet. Click to upload.</div>
                        }
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`badge ${resume?.resume_exists ? 'badge-success' : 'badge-muted'}`}>
                            {resume?.resume_exists ? 'Uploaded' : 'Missing'}
                        </span>
                        <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                </div>
            </div>

            {/* Recent jobs — each row navigates to jobs page */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div className="card-title" style={{ margin: 0 }}>Recent Applications</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                                sessionStorage.setItem('openAddJob', 'true')
                                setPage('jobs')
                            }}
                            style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)' }}
                        >
                            + Add Job
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPage('jobs')}
                            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                            View all <ArrowRight size={13} />
                        </button>
                    </div>
                </div>

                {jobs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                        <Briefcase size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                        <p>
                            No jobs tracked yet.{' '}
                            <span
                                style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => setPage('jobs')}
                            >
                                Add some in the Jobs tab!
                            </span>
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {jobs.slice(0, 5).map(j => (
                            <div
                                key={j.job_id || j.ui_index}
                                onClick={() => setPage('jobs')}
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.75rem', background: 'transparent',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer', transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-glow)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{j.company}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{j.job_title} <span className="mobile-hidden">· {j.location}</span></div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className={`badge ${PROGRESS_COLORS[j.progress] || 'badge-muted'}`}>{j.progress || 'Applied'}</span>
                                    <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
