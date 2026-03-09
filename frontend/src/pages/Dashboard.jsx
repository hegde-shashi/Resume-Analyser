import { useEffect, useState } from 'react'
import api from '../api'
import { Briefcase, FileText, BarChart2, TrendingUp } from 'lucide-react'

const PROGRESS_COLORS = {
    Applied: 'badge-accent',
    'HR Interview': 'badge-warning',
    'Technical Interview': 'badge-warning',
    'Final Round': 'badge-accent',
    Offer: 'badge-success',
    Rejected: 'badge-danger',
}

export default function Dashboard() {
    const [jobs, setJobs] = useState([])
    const [resume, setResume] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            api.get('/get_jobs'),
            api.get('/get_resume'),
        ]).then(([j, r]) => {
            setJobs(j.data)
            setResume(r.data)
        }).finally(() => setLoading(false))
    }, [])

    const counts = jobs.reduce((acc, j) => {
        acc[j.progress] = (acc[j.progress] || 0) + 1
        return acc
    }, {})

    const stats = [
        { label: 'Total Jobs', value: jobs.length, icon: <Briefcase size={20} />, color: 'var(--accent)' },
        { label: 'Active', value: jobs.filter(j => !['Rejected', 'Offer'].includes(j.progress)).length, icon: <TrendingUp size={20} />, color: 'var(--warning)' },
        { label: 'Offers', value: counts['Offer'] || 0, icon: <BarChart2 size={20} />, color: 'var(--success)' },
        { label: 'Resume', value: resume?.resume_exists ? '✓' : '—', icon: <FileText size={20} />, color: resume?.resume_exists ? 'var(--success)' : 'var(--text-muted)' },
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
                <h2>Dashboard</h2>
                <p>Overview of your job application journey</p>
            </div>

            {/* Stats */}
            <div className="grid-3" style={{ marginBottom: '2rem' }}>
                {stats.map(s => (
                    <div className="stat-card" key={s.label}>
                        <div className="stat-icon" style={{ background: `${s.color}22` }}>
                            <span style={{ color: s.color }}>{s.icon}</span>
                        </div>
                        <div className="stat-value">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Resume status */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div className="card-title">Resume</div>
                        {resume?.resume_exists
                            ? <div className="card-sub">📄 {resume.resume_name} &nbsp;·&nbsp; Uploaded {resume.created_at}</div>
                            : <div className="card-sub" style={{ color: 'var(--warning)' }}>No resume uploaded yet. Go to the Resume tab to upload.</div>
                        }
                    </div>
                    <span className={`badge ${resume?.resume_exists ? 'badge-success' : 'badge-muted'}`}>
                        {resume?.resume_exists ? 'Uploaded' : 'Missing'}
                    </span>
                </div>
            </div>

            {/* Recent jobs */}
            <div className="card">
                <div className="card-title" style={{ marginBottom: '1rem' }}>Recent Applications</div>
                {jobs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                        <Briefcase size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                        <p>No jobs tracked yet. Add some in the Jobs tab!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {jobs.slice(0, 5).map(j => (
                            <div key={j.job_id || j.ui_index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{j.job_title}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{j.company} · {j.location}</div>
                                </div>
                                <span className={`badge ${PROGRESS_COLORS[j.progress] || 'badge-muted'}`}>{j.progress || 'Applied'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
