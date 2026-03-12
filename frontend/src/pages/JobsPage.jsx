import { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Plus, Trash2, FileText, MapPin, Briefcase, ChevronDown, ChevronUp, RefreshCw, Mail, FileSignature } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import ConfirmModal from '../components/ConfirmModal'
import ReactMarkdown from 'react-markdown'
import Draggable from 'react-draggable'

const PROGRESS_STAGES = ['Checking', 'Applied', 'HR Interview', 'Technical Interview', 'Final Round', 'Offer', 'Rejected']
const PROGRESS_COLORS = { Checking: 'badge-danger', Applied: 'badge-accent', 'HR Interview': 'badge-warning', 'Technical Interview': 'badge-warning', 'Final Round': 'badge-accent', Offer: 'badge-success', Rejected: 'badge-danger' }

function AddJobModal({ onClose, onAdded }) {
    const [tab, setTab] = useState('link')
    const [link, setLink] = useState('')
    const [jdText, setJdText] = useState('')
    const [parsed, setParsed] = useState(null)
    const [parsedTab, setParsedTab] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const { llmPayload } = useSettings()

    async function parse() {
        setLoading(true)
        try {
            const endpoint = tab === 'link' ? '/parse_job' : '/parse_jd_txt'
            const body = tab === 'link' ? { job_link: link, ...llmPayload } : { job_description: jdText, ...llmPayload }
            const { data } = await api.post(endpoint, body)
            if (data.scrape_success === false) {
                toast.error(data.message || 'Scraping failed. Switching to manual paste.');
                if (tab === 'link') setTab('text');
                return;
            }
            setParsed(data.job_data)
            setParsedTab(tab)
            toast.success('Job parsed!')
        } catch (err) {
            toast.error(err.response?.data?.message || 'Parsing failed');
            if (tab === 'link') setTab('text');
        } finally { setLoading(false) }
    }

    async function save() {
        setSaving(true)
        const payload = { ...parsed, job_link: link, progress: 'Checking', ...llmPayload }
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
                            <div className="parse-input-row" style={{ display: 'flex', gap: '0.5rem' }}>
                                <input className="form-input" style={{ flex: 1 }} placeholder="https://careers.example.com/job/123"
                                    value={link} onChange={e => setLink(e.target.value)} />
                                <button className="btn btn-primary" onClick={parse} disabled={loading || !link || parsedTab === 'link'}>
                                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Parsing...' : 'Parse'}
                                </button>
                            </div>
                            {loading && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Getting data... this can take a few minutes</div>}
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Job Description</label>
                            <textarea className="form-textarea" style={{ minHeight: 160 }} placeholder="Paste the full job description here…"
                                value={jdText} onChange={e => setJdText(e.target.value)} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                <button className="btn btn-primary" onClick={parse} disabled={loading || !jdText || parsedTab === 'text'}>
                                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Parsing...' : 'Parse'}
                                </button>
                                {loading && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Getting data... this can take a few minutes</div>}
                            </div>
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
                            <div className="form-group">
                                <label className="form-label">Progress</label>
                                <select className="form-select" value={parsed.progress || 'Checking'} onChange={e => setParsed(p => ({ ...p, progress: e.target.value }))}>
                                    {PROGRESS_STAGES.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
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

// Split arrays or strings safely into a clean list
function toList(v) {
    if (!v) return []
    if (Array.isArray(v)) return v;
    try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch { }

    let rawStr = String(v).trim();
    if (rawStr.startsWith('[') && rawStr.endsWith(']')) {
        let inner = rawStr.slice(1, -1);
        let matches = inner.match(/'([^']+)'|"([^"]+)"/g);
        if (matches) return matches.map(s => s.replace(/^['"]|['"]$/g, '')).filter(Boolean);
        return inner.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (rawStr.startsWith('{') && rawStr.endsWith('}')) {
        let inner = rawStr.slice(1, -1);
        let matches = inner.match(/'([^']+)'|"([^"]+)"/g);
        if (matches) return matches.map(s => s.replace(/^['"]|['"]$/g, '')).filter(Boolean);
        return inner.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    }

    if (rawStr.includes('\n\n')) { // Prioritize double newlines for LLM summaries
        return rawStr.split('\n\n').map(s => s.trim()).filter(Boolean);
    }
    if (rawStr.includes('\n') || rawStr.includes('•')) {
        return rawStr.split(/[\n•]+/).map(s => s.replace(/^[*-]\s*/, '').trim()).filter(Boolean);
    }

    // Normal sentences or strings without explicit breaks shouldn't be butchered into multi-bullets
    return [rawStr.replace(/^"|"$/g, '')]
}

function BulletList({ items, max = 6 }) {
    const [expanded, setExpanded] = useState(false)
    const visible = expanded ? items : items.slice(0, max)
    const hasMore = items.length > max

    // If there is only one item, remove the bullet disc styling so it effectively renders like a normal paragraph
    const isSingle = items.length === 1;

    return (
        <div>
            <ul style={{ margin: 0, paddingLeft: isSingle ? 0 : '1.1rem', listStyle: isSingle ? 'none' : 'disc', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {visible.map((s, i) => <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s}</li>)}
            </ul>
            {hasMore && (
                <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.78rem', padding: '0.2rem 0.4rem', marginTop: '0.4rem', color: 'var(--accent)', marginLeft: isSingle ? 0 : '-0.4rem' }}
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'Show less' : `+${items.length - max} more…`}
                </button>
            )}
        </div>
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

function JobCard({ job, onDelete, onProgressChange, onAnalyse, onMail, onCoverLetter }) {
    const [expanded, setExpanded] = useState(false)
    const [updating, setUpdating] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    async function updateProgress(progress) {
        setUpdating(true)
        try {
            await api.post('/update_progress', { job_id: job.id, progress })
            onProgressChange(job.id, progress)
            toast.success('Status updated')
        } catch { toast.error('Update failed') } finally { setUpdating(false) }
    }

    async function del() {
        setDeleting(true)
        try {
            await api.delete(`/delete_job/${job.id}`)
            onDelete(job.id)
            toast.success('Job deleted')
            setDeleteModalOpen(false)
        } catch (err) {
            console.error(err)
            toast.error(err.response?.data?.error || 'Delete failed')
            setDeleteModalOpen(false)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="job-card">
            {/* ── Collapsed header (fixed height, truncated) ── */}
            <div className="job-card-header" style={{ minHeight: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="job-card-title" style={{
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem'
                    }}>
                        <span>{job.company || '—'}</span>
                        {job.job_link && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                                | <a href={job.job_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Link</a>
                            </span>
                        )}
                    </div>
                    <div className="job-card-company" style={{
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%'
                    }}>
                        {job.job_title}
                        <span className="mobile-hidden">{job.job_id ? ` · ${job.job_id}` : ''}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', flexShrink: 0 }}>
                    {job.matchScore != null && (
                        <span className={`badge ${job.matchScore >= 70 ? 'badge-success' : job.matchScore >= 45 ? 'badge-warning' : 'badge-danger'}`}>
                            {job.matchScore}/100 Match
                        </span>
                    )}
                    <span className={`badge ${PROGRESS_COLORS[job.progress] || 'badge-muted'}`}>
                        {job.progress || 'Checking'}
                    </span>
                </div>
            </div>

            {/* ── Meta chips (truncated if long) ── */}
            <div className="job-card-meta mobile-hidden" style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>
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
                    <div className="mobile-only" style={{ flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                        {job.location && (
                            <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <MapPin size={14} style={{ color: 'var(--accent)' }} /> <strong>Location:</strong> {job.location}
                            </div>
                        )}
                        {job.experience_required && (
                            <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Briefcase size={14} style={{ color: 'var(--accent)' }} /> <strong>Experience:</strong> {job.experience_required}
                            </div>
                        )}
                    </div>
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
                    value={job.progress || 'Checking'} onChange={e => updateProgress(e.target.value)} disabled={updating}>
                    {PROGRESS_STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm" onClick={() => onAnalyse(job)}>
                    <FileText size={14} /> Analyse
                </button>
                {job.progress !== 'Checking' && (
                    <>
                        <button className="btn btn-secondary btn-sm" onClick={() => onMail(job)}>
                            <Mail size={14} /> Mail
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => onCoverLetter(job)}>
                            <FileSignature size={14} /> Cover Letter
                        </button>
                    </>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setDeleteModalOpen(true)} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                </button>
            </div>

            <ConfirmModal
                isOpen={deleteModalOpen}
                title="Delete Job"
                message={`Are you sure you want to delete the job at "${job.company || 'this company'}"?`}
                onConfirm={del}
                onCancel={() => setDeleteModalOpen(false)}
                loading={deleting}
                isDanger={true}
            />
        </div>
    )
}


export default function JobsPage() {
    const [jobs, setJobs] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [analysis, setAnalysis] = useState(null)
    const [analysing, setAnalysing] = useState(false)
    const [mailResult, setMailResult] = useState(null)
    const [generatingMail, setGeneratingMail] = useState(false)
    const [coverLetterResult, setCoverLetterResult] = useState(null)
    const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false)
    const { llmPayload } = useSettings()

    const load = () => api.get('/get_jobs').then(r => setJobs(r.data)).finally(() => setLoading(false))
    useEffect(() => { 
        load()
        if (sessionStorage.getItem('openAddJob') === 'true') {
            setShowAdd(true)
            sessionStorage.removeItem('openAddJob')
        }

        // 1. Refresh when window gains focus (user comes back from extension)
        const onFocus = () => load()
        window.addEventListener('focus', onFocus)

        // 2. Refresh every 30 seconds in the background
        const interval = setInterval(load, 30000)

        return () => {
            window.removeEventListener('focus', onFocus)
            clearInterval(interval)
        }
    }, [])

    const remove = (id) => setJobs(js => js.filter(j => j.id !== id))
    const changeProgress = (id, progress) => setJobs(js => js.map(j => j.id === id ? { ...j, progress } : j))

    async function analyse(job) {
        setAnalysis({ job, result: null, isFetching: true })
        setAnalysing(true)
        try {
            const { data } = await api.post('/analyze_job', { job_id: job.id, ...llmPayload })
            setAnalysis({ job, result: data.analysis, isFetching: false })
            if (data.analysis?.score !== undefined) {
                setJobs(js => js.map(j => j.id === job.id ? { ...j, matchScore: data.analysis.score } : j))
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Analysis failed')
            setAnalysis(null)
        } finally { setAnalysing(false) }
    }

    async function generateMail(job) {
        setMailResult({ job, result: null, isFetching: true })
        setGeneratingMail(true)
        try {
            const { data } = await api.post('/generate_mail', { job_id: job.id, ...llmPayload })
            setMailResult({ job, result: data.mail, isFetching: false })
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to generate mail')
            setMailResult(null)
        } finally { setGeneratingMail(false) }
    }

    async function generateCoverLetter(job) {
        setCoverLetterResult({ job, result: null, isFetching: true })
        setGeneratingCoverLetter(true)
        try {
            const { data } = await api.post('/generate_cover_letter', { job_id: job.id, ...llmPayload })
            setCoverLetterResult({ job, result: data.cover_letter, isFetching: false })
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to generate cover letter')
            setCoverLetterResult(null)
        } finally { setGeneratingCoverLetter(false) }
    }

    if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 className="mobile-hidden">My Jobs</h2>
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
                            onDelete={remove} onProgressChange={changeProgress} onAnalyse={analyse}
                            onMail={generateMail} onCoverLetter={generateCoverLetter} />
                    ))}
                </div>
            )}

            {/* Analysis Panel */}
            {analysis && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAnalysis(null)}>
                    <Draggable handle=".drag-handle">
                        <div className="modal-box" style={{ maxWidth: 800, margin: 'auto', resize: 'both', overflow: 'hidden', minWidth: '350px', minHeight: '300px', height: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                            <div className="modal-header drag-handle" style={{ cursor: 'grab' }}>
                                <h3>Analysis — {analysis.job.job_title}</h3>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setAnalysis(null)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
                                {analysing ? (
                                    <div className="loading-center">
                                        <div className="spinner spinner-lg" />
                                        <span>Getting analysis... this can take 1-2 minutes</span>
                                    </div>
                                ) : analysis.result ? (
                                    <AnalysisResult raw={analysis.result} />
                                ) : null}
                            </div>
                        </div>
                    </Draggable>
                </div>
            )}

            {/* Mail Panel */}
            {mailResult && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMailResult(null)}>
                    <Draggable handle=".drag-handle">
                        <div className="modal-box" style={{ maxWidth: 800, margin: 'auto', resize: 'both', overflow: 'hidden', minWidth: '350px', minHeight: '300px', height: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                            <div className="modal-header drag-handle" style={{ cursor: 'grab' }}>
                                <h3>Mail — {mailResult.job.job_title}</h3>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setMailResult(null)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
                                {generatingMail ? (
                                    <div className="loading-center">
                                        <div className="spinner spinner-lg" />
                                        <span>Drafting email...</span>
                                    </div>
                                ) : mailResult.result ? (
                                    <div className="markdown-body" style={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                        {mailResult.result}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </Draggable>
                </div>
            )}

            {/* Cover Letter Panel */}
            {coverLetterResult && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCoverLetterResult(null)}>
                    <Draggable handle=".drag-handle">
                        <div className="modal-box" style={{ maxWidth: 800, margin: 'auto', resize: 'both', overflow: 'hidden', minWidth: '350px', minHeight: '300px', height: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                            <div className="modal-header drag-handle" style={{ cursor: 'grab' }}>
                                <h3>Cover Letter — {coverLetterResult.job.job_title}</h3>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setCoverLetterResult(null)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
                                {generatingCoverLetter ? (
                                    <div className="loading-center">
                                        <div className="spinner spinner-lg" />
                                        <span>Drafting cover letter...</span>
                                    </div>
                                ) : coverLetterResult.result ? (
                                    <div className="markdown-body" style={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                        {coverLetterResult.result}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </Draggable>
                </div>
            )}

            {showAdd && <AddJobModal onClose={() => setShowAdd(false)} onAdded={load} />}
        </div>
    )
}

function AnalysisResult({ raw }) {
    let parsed = null
    if (typeof raw === 'object' && raw !== null) {
        parsed = raw
    } else {
        try {
            const match = String(raw).match(/\{[\s\S]*\}/)
            if (match) parsed = JSON.parse(match[0])
        } catch { }
    }

    if (!parsed) return (
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            {String(raw)}
        </div>
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
                    <div className="analysis-section-title" style={{ color: 'var(--success)' }}>✅ Matched Skills ({matched.length})</div>
                    <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {matched.map(s => <li key={s}>{s}</li>)}
                    </ul>
                </div>
            )}
            {missing.length > 0 && (
                <div className="analysis-section">
                    <div className="analysis-section-title" style={{ color: 'var(--danger)' }}>❌ Missing Skills ({missing.length})</div>
                    <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {missing.map(s => <li key={s}>{s}</li>)}
                    </ul>
                </div>
            )}
            {suggestions.length > 0 && (
                <div className="analysis-section">
                    <div className="analysis-section-title" style={{ color: 'var(--warning)' }}>💡 Suggestions</div>
                    <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {suggestions.map((s, i) => <li key={i}>{String(s).replace(/\*\*/g, '')}</li>)}
                    </ul>
                </div>
            )}
            {(summary && typeof summary === 'object' ? Object.keys(summary).length > 0 : !!summary) && (
                <div className="analysis-section">
                    <div className="analysis-section-title" style={{ color: 'var(--accent)' }}>📊 Evaluation Summary</div>
                    <div className="markdown-body" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {typeof summary === 'string' || Array.isArray(summary) ? (
                            <ReactMarkdown>
                                {typeof summary === 'string'
                                    ? summary.replace(/\\n/g, '\n').replace(/^\s*[*-]\s*(?=\*\*)/gm, '\n')

                                    : summary.map(s => String(s).replace(/^\s*[*-]\s*/, '')).join('\n\n')
                                }

                            </ReactMarkdown>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {Object.entries(summary).map(([k, v]) => {
                                    const cleanKey = k.replace(/^\d+\.\s*/, '').replace(/:$/, '').trim();
                                    return (
                                        <div key={k}>
                                            <ReactMarkdown>{`**${cleanKey}**\n\n${v}`}</ReactMarkdown>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
