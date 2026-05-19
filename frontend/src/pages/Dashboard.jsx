import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { Briefcase, BarChart2, TrendingUp, ArrowRight } from 'lucide-react'

const PROGRESS_COLORS = {
    Applied: 'badge-accent',
    Assessment: 'badge-warning',
    'HR Interview': 'badge-warning',
    'Technical Interview': 'badge-warning',
    'Final Round': 'badge-accent',
    Offer: 'badge-success',
    Rejected: 'badge-danger',
}

export default function Dashboard({ setPage }) {
    const { username } = useAuth()
    const { jobs, resume, loading } = useData()

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
        <div className="dashboard-container">
            <div className="page-header">
                <h2 className="mobile-hidden">Dashboard</h2>
                <p>Hi {username || 'there'}, here's an overview of your job application journey</p>
            </div>

            {/* Stats — each card navigates to its page */}
            <div className="grid-3 stat-grid" style={{ padding: '0 2rem', marginTop: '2rem' }}>
                {stats.map(s => (
                    <div
                        className="stat-card"
                        key={s.label}
                        onClick={() => setPage(s.page)}
                        style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
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
                className="card resume-card"
                style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onClick={() => setPage('resume')}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="card-title">Resume</div>
                        {resume?.resume_exists
                            ? <div className="card-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📄 {resume.resume_name}</div>
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
            <div className="card recent-jobs-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div className="card-title" style={{ margin: 0 }}>Recent Applications</div>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPage('jobs')}
                        style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent)' }}
                    >
                        View all <ArrowRight size={13} />
                    </button>
                </div>

                {jobs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                        <Briefcase size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                        <p>No jobs tracked yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {jobs.slice(0, 5).map(j => (
                            <div
                                key={j.job_id || j.ui_index}
                                onClick={() => setPage('jobs')}
                                className="recent-job-item"
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.75rem', background: 'var(--bg-hover)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer', transition: 'background 0.15s',
                                }}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.company}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {j.error_message ? <span style={{ color: 'var(--danger)' }}>⚠️ Error Processing Job</span> : j.is_parsed === false ? 'AI Processing...' : j.job_title}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                    <span className={`badge ${PROGRESS_COLORS[j.progress] || 'badge-muted'}`} style={{ fontSize: '0.65rem' }}>{j.progress || 'Applied'}</span>
                                    <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @media (max-width: 1024px) {
                    .stat-grid { grid-template-columns: 1fr 1fr !important; padding: 1rem !important; margin: 0 !important; gap: 0.75rem !important; }
                    .stat-grid > :last-child { grid-column: span 2; }
                    .card { margin: 0.75rem 1rem !important; padding: 1.25rem !important; }
                    .resume-card { margin-top: 1rem !important; }
                    .recent-job-item { padding: 1rem !important; }
                }
            `}</style>
        </div>
    )
}
