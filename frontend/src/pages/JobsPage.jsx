import { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Plus, Trash2, FileText, MapPin, Briefcase, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'

const PROGRESS_STAGES = ['Applied', 'HR Interview', 'Technical Interview', 'Final Round', 'Offer', 'Rejected']
const PROGRESS_COLORS = { Applied: 'badge-accent', 'HR Interview': 'badge-warning', 'Technical Interview': 'badge-warning', 'Final Round': 'badge-accent', Offer: 'badge-success', Rejected: 'badge-danger' }

function AddJobModal({ onClose, onAdded }) {
    const [tab, setTab] = useState('link')
    const [link, setLink] = useState('')
    const [jdText, setJdText] = useState('')
    const [parsed, setParsed] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const { llmPayload } = useSettings()

    async function parse() {
        setLoading(true)
        try {
            const endpoint = tab === 'link' ? '/parse_job' : '/parse_jd_txt'
            const body = tab === 'link' ? { job_link: link, ...llmPayload } : { job_description: jdText, ...llmPayload }
            const { data } = await api.post(endpoint, body)
            if (data.scrape_success === false) { toast.error(data.message); return }
            setParsed(data.job_data)
            toast.success('Job parsed!')
        } catch (err) {
            toast.error(err.response?.data?.message || 'Parsing failed')
        } finally { setLoading(false) }
    }

    async function save() {
        setSaving(true)
        const payload = { ...parsed, job_link: link, progress: 'Applied', ...llmPayload }
        try {
            await api.post('/save_job', payload)
            toast.success('Job saved!')
            onAdded()
            onClose()
        } catch { toast.error('Save failed') } finally { setSaving(false) }
    }

    const field = (label, key) => (
        <div className="form-group" key={key}>
            <label className="form-label">{label}</label>
            <input className="form-input" value={parsed?.[key] || ''} onChange={e => setParsed(p => ({ ...p, [key]: e.target.value }))} />
        </div>
    )

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h3>Add Job</h3>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div className="tabs" style={{ marginBottom: '1rem' }}>
                        <button className={`tab ${tab === 'link' ? 'active' : ''}`} onClick={() => setTab('link')}>From URL</button>
                        <button className={`tab ${tab === 'text' ? 'active' : ''}`} onClick={() => setTab('text')}>Paste JD</button>
                    </div>

                    {tab === 'link' ? (
                        <div className="form-group">
                            <label className="form-label">Job URL</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input className="form-input" style={{ flex: 1 }} placeholder="https://careers.example.com/job/123"
                                    value={link} onChange={e => setLink(e.target.value)} />
                                <button className="btn btn-primary" onClick={parse} disabled={loading || !link}>
                                    {loading ? <span className="spinner" /> : <><RefreshCw size={14} /> Parse</>}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Job Description</label>
                            <textarea className="form-textarea" style={{ minHeight: 160 }} placeholder="Paste the full job description here…"
                                value={jdText} onChange={e => setJdText(e.target.value)} />
                            <button className="btn btn-primary" onClick={parse} disabled={loading || !jdText}>
                                {loading ? <span className="spinner" /> : <><RefreshCw size={14} /> Parse</>}
                            </button>
                        </div>
                    )}

                    {parsed && (
                        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Review & Edit</div>
                            {field('Job Title', 'job_title')}
                            {field('Company', 'company')}
                            {field('Location', 'location')}
                            {field('Job Type', 'job_type')}
                            {field('Experience Required', 'experience_required')}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    {parsed && <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : 'Save Job'}</button>}
                </div>
            </div>
        </div>
    )
}

// Split comma/semi-colon separated strings or PostgreSQL arrays into a clean list
function toList(v) {
    if (!v) return []
    const raw = String(v)
        .replace(/^\{/, '').replace(/\}$/, '')   // strip PG array braces
        .replace(/^"|"$/g, '')                   // strip outer quotes
    return raw.split(/[,;]+/).map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean)
}

function BulletList({ items, max = 6 }) {
    const visible = items.slice(0, max)
    return (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {visible.map((s, i) => <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s}</li>)}
            {items.length > max && <li style={{ fontSize: '0.78rem', color: 'var(--text-muted)', listStyle: 'none' }}>+{items.length - max} more…</li>}
        </ul>
    )
}

function Section({ label, items }) {
    if (!items || items.length === 0) return null
    return (
        <div style={{ marginBottom: '0.6rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>{label}</div>
            <BulletList items={items} />
        </div>
    )
}

function JobCard({ job, onDelete, onProgressChange, onAnalyse }) {
    const [expanded, setExpanded] = useState(false)
    const [updating, setUpdating] = useState(false)

    async function updateProgress(progress) {
        setUpdating(true)
        try {
            await api.post('/update_progress', { job_id: job.id, progress })
            onProgressChange(job.id, progress)
            toast.success('Status updated')
        } catch { toast.error('Update failed') } finally { setUpdating(false) }
    }

    async function del() {
        if (!confirm(`Delete "${job.job_title}"?`)) return
        try {
            await api.delete(`/delete_job/${job.id}`)
            onDelete(job.id)
            toast.success('Job deleted')
        } catch (err) {
            toast.error(err.response?.data?.error || 'Delete failed')
        }
    }

    return (
        <div className="job-card">
            {/* ── Collapsed header (fixed height, truncated) ── */}
            <div className="job-card-header" style={{ minHeight: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="job-card-title" style={{
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%'
                    }}>{job.job_title || '—'}</div>
                    <div className="job-card-company" style={{
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%'
                    }}>{job.company}{job.location ? ` · ${job.location}` : ''}</div>
                </div>
                <span className={`badge ${PROGRESS_COLORS[job.progress] || 'badge-muted'}`} style={{ flexShrink: 0 }}>
                    {job.progress || 'Applied'}
                </span>
            </div>

            {/* ── Meta chips (truncated if long) ── */}
            <div className="job-card-meta" style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>
                {job.job_type && <span className="chip" style={{ flexShrink: 0 }}><Briefcase size={10} style={{ marginRight: 3 }} />{job.job_type}</span>}
                {job.experience_required &&
                    <span className="chip" style={{
                        maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block'
                    }} title={job.experience_required}>
                        {job.experience_required}
                    </span>
                }
                <span className="chip" style={{ flexShrink: 0 }}><MapPin size={10} style={{ marginRight: 3 }} />{job.location || 'Remote'}</span>
            </div>

            {/* ── Expanded details (bullet points) ── */}
            {expanded && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                    <Section label="Required Skills" items={toList(job.skills_required)} />
                    <Section label="Preferred Skills" items={toList(job.preferred_skills)} />
                    <Section label="Responsibilities" items={toList(job.responsibilities)} />
                    <Section label="Education" items={toList(job.education)} />
                    {job.created_at && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Added {job.created_at}</div>
                    )}
                </div>
            )}

            {/* ── Action bar ── */}
            <div className="job-card-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(e => !e)}>
                    {expanded ? <><ChevronUp size={14} /> Less</> : <><ChevronDown size={14} /> Details</>}
                </button>
                <select className="form-select" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', height: 'auto' }}
                    value={job.progress || 'Applied'} onChange={e => updateProgress(e.target.value)} disabled={updating}>
                    {PROGRESS_STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm" onClick={() => onAnalyse(job)}>
                    <FileText size={14} /> Analyse
                </button>
                <button className="btn btn-ghost btn-sm" onClick={del} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    )
}


export default function JobsPage() {
    const [jobs, setJobs] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [analysis, setAnalysis] = useState(null)
    const [analysing, setAnalysing] = useState(false)
    const { llmPayload } = useSettings()

    const load = () => api.get('/get_jobs').then(r => setJobs(r.data)).finally(() => setLoading(false))
    useEffect(() => { load() }, [])

    const remove = (id) => setJobs(js => js.filter(j => j.id !== id))
    const changeProgress = (id, progress) => setJobs(js => js.map(j => j.id === id ? { ...j, progress } : j))

    async function analyse(job) {
        setAnalysis({ job, result: null })
        setAnalysing(true)
        try {
            const { data } = await api.post('/analyze_job', { job_id: job.id, ...llmPayload })
            setAnalysis({ job, result: data.analysis })
        } catch (err) {
            toast.error(err.response?.data?.error || 'Analysis failed')
            setAnalysis(null)
        } finally { setAnalysing(false) }
    }

    if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2>My Jobs</h2>
                    <p>{jobs.length} job{jobs.length !== 1 ? 's' : ''} tracked</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                        <Plus size={16} /> Add Job
                    </button>
                </div>
            </div>

            {jobs.length === 0 ? (
                <div className="empty-state">
                    <Briefcase size={48} />
                    <h3>No jobs yet</h3>
                    <p>Click "Add Job" to track your first application</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {jobs.map(j => (
                        <JobCard key={j.id} job={j}
                            onDelete={remove} onProgressChange={changeProgress} onAnalyse={analyse} />
                    ))}
                </div>
            )}

            {/* Analysis Panel */}
            {analysis && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAnalysis(null)}>
                    <div className="modal-box" style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <h3>Analysis — {analysis.job.job_title}</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setAnalysis(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {analysing ? (
                                <div className="loading-center"><div className="spinner spinner-lg" /><span>Analysing with AI…</span></div>
                            ) : analysis.result ? (
                                <AnalysisResult raw={analysis.result} />
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {showAdd && <AddJobModal onClose={() => setShowAdd(false)} onAdded={load} />}
        </div>
    )
}

function AnalysisResult({ raw }) {
    // Try parse JSON from the response
    let parsed = null
    try {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
    } catch { }

    if (!parsed) return (
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>{raw}</div>
    )

    const score = parsed.score || parsed.match_score || parsed['Match Score'] || parsed.matchScore || 0
    const matched = parsed.matched_skills || parsed['Matched Skills'] || parsed.matchedSkills || []
    const missing = parsed.missing_skills || parsed['Missing Skills'] || parsed.missingSkills || []
    const suggestions = parsed.suggestions || parsed['Suggestions'] || []
    const summary = parsed.evaluation_summary || parsed['Evaluation summary'] || {}

    const scoreColor = score >= 70 ? 'var(--success)' : score >= 45 ? 'var(--warning)' : 'var(--danger)'
    const r = 54, circ = 2 * Math.PI * r
    const dash = (score / 100) * circ

    return (
        <div>
            {/* Score ring */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                <div className="score-ring-wrap">
                    <svg width={130} height={130} viewBox="0 0 130 130">
                        <circle cx={65} cy={65} r={r} fill="none" stroke="var(--bg-hover)" strokeWidth={10} />
                        <circle cx={65} cy={65} r={r} fill="none" stroke={scoreColor} strokeWidth={10}
                            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
                            transform="rotate(-90 65 65)" />
                        <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize="22" fontWeight="800" fill={scoreColor}>{score}</text>
                        <text x="50%" y="66%" textAnchor="middle" fontSize="10" fill="var(--text-muted)">/ 100</text>
                    </svg>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Match Score</div>
                </div>
            </div>

            {/* Skills */}
            {matched.length > 0 && (
                <div className="analysis-section">
                    <div className="analysis-section-title">✅ Matched Skills ({matched.length})</div>
                    <div className="chip-list">{matched.map(s => <span className="chip chip-matched" key={s}>{s}</span>)}</div>
                </div>
            )}
            {missing.length > 0 && (
                <div className="analysis-section">
                    <div className="analysis-section-title">❌ Missing Skills ({missing.length})</div>
                    <div className="chip-list">{missing.map(s => <span className="chip chip-missing" key={s}>{s}</span>)}</div>
                </div>
            )}
            {suggestions.length > 0 && (
                <div className="analysis-section">
                    <div className="analysis-section-title">💡 Suggestions</div>
                    <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {suggestions.map((s, i) => <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{s}</li>)}
                    </ul>
                </div>
            )}
            {Object.keys(summary).length > 0 && (
                <div className="analysis-section">
                    <div className="analysis-section-title">📊 Evaluation Summary</div>
                    {Object.entries(summary).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: '0.5rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '0.25rem' }}>{k}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{v}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
