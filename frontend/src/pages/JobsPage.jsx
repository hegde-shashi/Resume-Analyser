import { useEffect, useState } from 'react'

import api from '../api'
import toast from 'react-hot-toast'
import { Plus, Trash2, FileText, Briefcase, ChevronDown, ChevronUp, RefreshCw, Search, Edit2, Check, X, ListFilter, AlertCircle, Mail } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { useData } from '../context/DataContext'
import ConfirmModal from '../components/ConfirmModal'
import ReactMarkdown from 'react-markdown'

const PROGRESS_STAGES = ['Checking', 'Applied', 'Assessment', 'HR Interview', 'Technical Interview', 'Final Round', 'Offer', 'Rejected']
const PROGRESS_COLORS = { Checking: 'badge-danger', Applied: 'badge-accent', Assessment: 'badge-warning', 'HR Interview': 'badge-warning', 'Technical Interview': 'badge-warning', 'Final Round': 'badge-accent', Offer: 'badge-success', Rejected: 'badge-danger' }

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
            const body = tab === 'link' ? { job_link: link, ...llmPayload } : { job_description: jdText, job_link: link, ...llmPayload }
            const { data } = await api.post(endpoint, body)

            if (data.scrape_success === false) {
                toast.error(data.message || 'Scraping failed. Switching to manual paste.');
                if (tab === 'link') setTab('text');
                return;
            }

            if (data.llm_free === false) {
                toast.success('AI is busy. Saving for background processing...');
                let companyDefault = 'Pending...';
                try {
                    if (link) {
                        const urlStr = link.includes('://') ? link : `https://${link}`;
                        companyDefault = new URL(urlStr).hostname.replace('www.', '');
                    }
                } catch { }

                await save({
                    is_parsed: false,
                    job_description: data.raw_content,
                    job_link: link,
                    company: companyDefault,
                    model: llmPayload.model,
                    api_key: llmPayload.api_key
                });
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

    async function save(overrides = null) {
        setSaving(true)
        const payload = overrides || { ...parsed, job_link: link, progress: 'Checking', is_parsed: true, ...llmPayload }
        try {
            await api.post('/save_job', payload)
            onAdded()
            onClose()
        } catch (err) {
            toast.error('Save failed')
        } finally {
            setSaving(false)
        }
    }

    const field = (label, key) => (
        <div className="form-group" key={key}>
            <label className="form-label">{label}</label>
            <input className="form-input" value={parsed?.[key] || ''} onChange={e => setParsed(p => ({ ...p, [key]: e.target.value }))} />
        </div>
    )

    return (
        <div className="modal-overlay">
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
                        </div>
                    ) : (
                        <>
                            <div className="form-group">
                                <label className="form-label">Job URL (Optional)</label>
                                <input className="form-input" placeholder="https://careers.example.com/job/123"
                                    value={link} onChange={e => setLink(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginTop: '0.75rem' }}>
                                <label className="form-label">Job Description</label>
                                <textarea className="form-textarea" style={{ minHeight: 160 }} placeholder="Paste the full job description here…"
                                    value={jdText} onChange={e => setJdText(e.target.value)} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                    <button className="btn btn-primary" onClick={parse} disabled={loading || !jdText || parsedTab === 'text'}>
                                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Parsing...' : 'Parse'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {parsed && (
                        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Review & Edit</div>
                            {field('Job Title', 'job_title')}
                            {field('Company', 'company')}
                            {field('Job URL', 'job_link')}
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
                    {parsed && <button className="btn btn-primary" onClick={() => save()} disabled={saving}>{saving ? <span className="spinner" /> : 'Save Job'}</button>}
                </div>
            </div>
        </div>
    )
}

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

    if (rawStr.includes('\n\n')) return rawStr.split('\n\n').map(s => s.trim()).filter(Boolean);
    if (rawStr.includes('\n') || rawStr.includes('•')) return rawStr.split(/[\n•]+/).map(s => s.replace(/^[*-]\s*/, '').trim()).filter(Boolean);

    return [rawStr.replace(/^"|"$/g, '')]
}

function BulletList({ items, max = 6 }) {
    const [expanded, setExpanded] = useState(false)
    const visible = expanded ? items : items.slice(0, max)
    const hasMore = items.length > max
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

function JobCard({ job, onDelete, onProgressChange, onAnalyse, onReprocess, onGenerateMail, onGenerateCoverLetter, busy }) {
    const [expanded, setExpanded] = useState(false)
    const [updating, setUpdating] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editData, setEditData] = useState({ company: job.company || '', job_title: job.job_title || '', job_link: job.job_link || '' })
    const [savingEdit, setSavingEdit] = useState(false)

    async function updateProgress(progress) {
        setUpdating(true)
        try {
            await api.post('/update_progress', { job_id: job.id, progress })
            onProgressChange(job.id, progress)
            toast.success('Status updated')
        } catch { toast.error('Update failed') } finally { setUpdating(false) }
    }

    async function saveEdit() {
        setSavingEdit(true)
        try {
            await api.post('/update_job', { id: job.id, ...editData })
            job.company = editData.company
            job.job_title = editData.job_title
            job.job_link = editData.job_link
            setIsEditing(false)
            toast.success('Job details updated')
        } catch { toast.error('Failed to update job') } finally { setSavingEdit(false) }
    }

    async function del() {
        setDeleting(true)
        try {
            await api.delete(`/delete_job/${job.id}`)
            onDelete(job.id)
            toast.success('Job deleted')
            setDeleteModalOpen(false)
        } catch (err) {
            toast.error(err.response?.data?.error || 'Delete failed')
            setDeleteModalOpen(false)
        } finally { setDeleting(false) }
    }

    return (
        <div className="job-card">
            <div className="job-card-header" style={{ minHeight: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="job-card-title" style={{ maxWidth: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
                                <input className="form-input" style={{ height: '28px', fontSize: '0.85rem', flex: 1 }} value={editData.company} onChange={e => setEditData({ ...editData, company: e.target.value })} placeholder="Company" />
                                <span style={{ color: 'var(--text-muted)' }}>|</span>
                                <input className="form-input" style={{ height: '28px', fontSize: '0.85rem', flex: 2 }} value={editData.job_link} onChange={e => setEditData({ ...editData, job_link: e.target.value })} placeholder="Job URL" />
                                <button className="btn btn-ghost btn-xs" onClick={saveEdit} disabled={savingEdit}><Check size={14} color="var(--success)" /></button>
                                <button className="btn btn-ghost btn-xs" onClick={() => { setIsEditing(false); setEditData({ company: job.company || '', job_title: job.job_title || '', job_link: job.job_link || '' }); }}><X size={14} color="var(--danger)" /></button>
                            </div>
                        ) : (
                            <>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.company || '—'}</span>
                                {job.job_link && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        | <a href={job.job_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Link</a>
                                    </span>
                                )}
                                <button className="btn btn-ghost btn-xs" style={{ marginLeft: '4px', opacity: 0.5 }} onClick={() => setIsEditing(true)}><Edit2 size={12} /></button>
                            </>
                        )}
                    </div>
                    <div className="job-card-company" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {job.error_message ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>⚠️ Error: {String(job.error_message).split(/\n|\\n/)[0].trim()}</span>
                                <button className="btn btn-ghost btn-xs" onClick={() => onReprocess(job.id)} title="Retry"><RefreshCw size={12} /></button>
                            </div>
                        ) : job.is_parsed === false ? (
                            <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                                <RefreshCw size={12} className="spin" /> AI Processing...
                            </span>
                        ) : isEditing ? (
                            <input className="form-input" style={{ height: '28px', fontSize: '0.85rem', width: '100%', marginTop: '4px' }} value={editData.job_title} onChange={e => setEditData({ ...editData, job_title: e.target.value })} placeholder="Job Title" />
                        ) : (
                            <>{job.job_title}<span className="mobile-hidden">{job.job_id ? ` · ${job.job_id}` : ''}</span></>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', flexShrink: 0 }}>
                    {job.matchScore != null && (
                        <span className={`badge ${job.matchScore >= 70 ? 'badge-success' : job.matchScore >= 45 ? 'badge-warning' : 'badge-danger'}`}>{job.matchScore}/100 Match</span>
                    )}
                    <span className={`badge ${PROGRESS_COLORS[job.progress] || 'badge-muted'}`}>{job.progress || 'Checking'}</span>
                </div>
            </div>

            {expanded && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                    {job.created_at && (
                        <div style={{ marginBottom: '0.6rem' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>Applied Date</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{job.created_at}</div>
                        </div>
                    )}
                    <Section label="Required Skills" items={toList(job.skills_required)} />
                    <Section label="Preferred Skills" items={toList(job.preferred_skills)} />
                    <Section label="Responsibilities" items={toList(job.responsibilities)} />
                    <Section label="Education" items={toList(job.education)} />
                </div>
            )}

            <div className="job-card-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(e => !e)}>
                    {expanded ? <><ChevronUp size={14} /> Less</> : <><ChevronDown size={14} /> Details</>}
                </button>
                <select className="form-select" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', height: 'auto' }}
                    value={job.progress || 'Checking'} onChange={e => updateProgress(e.target.value)} disabled={updating}>
                    {PROGRESS_STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm btn-analyze" onClick={() => onAnalyse(job)} disabled={job.is_parsed === false || busy}>
                    <FileText size={14} /> Analyse
                </button>
                {job.progress !== 'Checking' && (
                    <>
                        <button className="btn btn-secondary btn-sm btn-mail" onClick={() => onGenerateMail(job)} title="Create Cold Mail" disabled={busy}>
                            <Mail size={14} /> Mail
                        </button>
                        <button className="btn btn-secondary btn-sm btn-cover" onClick={() => onGenerateCoverLetter(job)} title="Create Cover Letter" disabled={busy}>
                            <FileText size={14} /> Cover Letter
                        </button>
                    </>
                )}
                <button className="btn btn-ghost btn-sm btn-delete" onClick={() => setDeleteModalOpen(true)} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                </button>
            </div>

            <ConfirmModal isOpen={deleteModalOpen} title="Delete Job" message={`Are you sure you want to delete the job at "${job.company || 'this company'}"?`}
                onConfirm={del} onCancel={() => setDeleteModalOpen(false)} loading={deleting} isDanger={true} />
        </div>
    )
}
export default function JobsPage() {
    const { jobs, setJobs, loading, refresh } = useData()
    const [showAdd, setShowAdd] = useState(false)
    const [analysis, setAnalysis] = useState(null)
    const [analysing, setAnalysing] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState('All')
    const [generatedContent, setGeneratedContent] = useState(null)
    const [generating, setGenerating] = useState(false)
    const { llmPayload } = useSettings()

    const load = refresh;
    useEffect(() => {
        if (sessionStorage.getItem('openAddJob') === 'true') {
            setShowAdd(true)
            sessionStorage.removeItem('openAddJob')
        }
    }, [])

    const remove = (id) => setJobs(js => js.filter(j => j.id !== id))
    const changeProgress = (id, progress) => setJobs(js => js.map(j => j.id === id ? { ...j, progress } : j))

    async function analyse(job, force = false) {
        setAnalysis({ job, result: null, isFetching: true })
        setAnalysing(true)
        try {
            const { data } = await api.post('/analyze_job', { job_id: job.id, force_reanalyze: force, ...llmPayload })
            setAnalysis({ job, result: data.analysis, isStale: data.is_stale, isFetching: false })
            if (data.analysis?.score !== undefined) {
                setJobs(js => js.map(j => j.id === job.id ? { ...j, matchScore: data.analysis.score } : j))
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Analysis failed')
            setAnalysis(null)
        } finally { setAnalysing(false) }
    }

    async function reprocess(jobId) {
        try {
            await api.post('/reprocess_job', { job_id: jobId, ...llmPayload })
            setJobs(js => js.map(j => j.id === jobId ? { ...j, is_parsed: false, error_message: null } : j))
            toast.success('Retry started')
        } catch { toast.error('Failed to retry') }
    }

    async function generateMail(job) {
        setGenerating(true)
        const tid = toast.loading('Generating cold mail...')
        try {
            const { data } = await api.post('/generate_mail', { job_id: job.id, ...llmPayload })
            setGeneratedContent({ title: 'Generated Cold Mail', content: data.mail })
            toast.success('Mail generated!', { id: tid })
        } catch (err) {
            toast.error('Failed to generate mail', { id: tid })
        } finally { setGenerating(false) }
    }

    async function generateCoverLetter(job) {
        setGenerating(true)
        const tid = toast.loading('Generating cover letter...')
        try {
            const { data } = await api.post('/generate_cover_letter', { job_id: job.id, ...llmPayload })
            setGeneratedContent({ title: 'Generated Cover Letter', content: data.cover_letter })
            toast.success('Cover letter generated!', { id: tid })
        } catch (err) {
            toast.error('Failed to generate cover letter', { id: tid })
        } finally { setGenerating(false) }
    }

    const filteredJobs = jobs.filter(j => {
        if (filterStatus !== 'All' && j.progress !== filterStatus) return false;
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return [j.company, j.job_title, j.location].some(f => String(f || '').toLowerCase().includes(q));
    });

    if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>

    return (
        <div className="jobs-container">
            <div className="page-header sticky-header">
                <div className="mobile-hidden">
                    <h2 style={{ margin: 0 }}>My Jobs</h2>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{jobs.length} applications</p>
                </div>
                <div className="search-filter-container">
                    <div className="filter-select-wrapper">
                        <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="All">All Statuses</option>
                            {PROGRESS_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="mobile-only"><ListFilter size={18} /></div>
                    </div>
                    <div className="search-bar-wrapper" style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translate(0, -50%)', color: 'var(--text-muted)' }} />
                        <input type="text" className="form-input" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '0 36px', width: '100%', height: '38px' }} />
                        {searchQuery && (
                            <button className="btn btn-ghost btn-xs" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translate(0, -50%)', padding: 0 }} onClick={() => setSearchQuery('')}>
                                <X size={14} color="var(--text-muted)" />
                            </button>
                        )}
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ height: '38px' }}>
                        <Plus size={16} /> <span className="desktop-only">Add Job</span>
                    </button>
                </div>
            </div>

            <div className="jobs-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 2rem 2rem'}}>
                {filteredJobs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                        <Briefcase size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <h3>No jobs found</h3>
                        <p>Try adjusting your search or filters</p>
                    </div>
                ) : (
                    filteredJobs.map(j => (
                        <JobCard 
                            key={j.id} 
                            job={j} 
                            onDelete={remove} 
                            onProgressChange={changeProgress} 
                            onAnalyse={analyse} 
                            onReprocess={reprocess}
                            onGenerateMail={generateMail}
                            onGenerateCoverLetter={generateCoverLetter}
                            busy={generating}
                        />
                    ))
                )}
            </div>

            {analysis && (
                <div className="modal-overlay">
                    <div className="modal-box" style={{ maxWidth: 800, height: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                        <div className="modal-header">
                            <h3>Analysis — {analysis.job.job_title}</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setAnalysis(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                            {analysing ? (
                                <div className="loading-center"><div className="spinner spinner-lg" /></div>
                            ) : (
                                <>
                                    {analysis.isStale && (
                                        <div className="alert alert-warning" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <AlertCircle size={20} />
                                                <div style={{ fontSize: '0.875rem' }}>
                                                    <strong>New resume detected.</strong> This analysis was based on your old resume.
                                                </div>
                                            </div>
                                            <button 
                                                className="btn btn-primary btn-sm" 
                                                onClick={() => analyse(analysis.job, true)}
                                                style={{ flexShrink: 0 }}
                                            >
                                                Re-analyze Now
                                            </button>
                                        </div>
                                    )}
                                    <AnalysisResult raw={analysis.result} />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {generatedContent && (
                <div className="modal-overlay">
                    <div className="modal-box" style={{ maxWidth: 800, height: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                        <div className="modal-header">
                            <h3>{generatedContent.title}</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setGeneratedContent(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                             <div className="markdown-body" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                <ReactMarkdown>{generatedContent.content}</ReactMarkdown>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => {
                                navigator.clipboard.writeText(generatedContent.content)
                                toast.success('Copied to clipboard!')
                            }}>Copy to Clipboard</button>
                            <button className="btn btn-primary" onClick={() => setGeneratedContent(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showAdd && <AddJobModal onClose={() => setShowAdd(false)} onAdded={load} />}

            <style>{`
                @media (max-width: 1024px) {
                    .jobs-list { padding: 1rem !important; }
                    .sticky-header { border-bottom: 1px solid var(--border-light); margin-bottom: 0 !important; }
                }
            `}</style>
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
                        <ReactMarkdown>{typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2)}</ReactMarkdown>
                    </div>
                </div>
            )}
            <style>{`
                select {
                    appearance: none !important;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'%3E%3C/path%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 0.75rem center !important;
                    background-size: 1rem !important;
                    cursor: pointer !important;
                }

                .sticky-header {
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }

                @media (max-width: 768px) {
                    .mobile-hidden {
                        display: none;
                    }
                    .sticky-header {
                        padding: 1rem !important;
                        margin: -0.75rem -0.75rem 1rem -0.75rem !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                        position: relative !important;
                    }
                }
            `}</style>
        </div>
    )
}
