import { useState, useEffect, useRef } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { FileText, Sparkles, Briefcase, Download, Upload, List, ChevronDown, Check } from 'lucide-react'
import { renderAsync } from 'docx-preview'
import { useSettings } from '../context/SettingsContext'
import { useData } from '../context/DataContext'
import ConfirmModal from '../components/ConfirmModal'

export default function GeneratorPage({ setPage }) {

    const { llmPayload } = useSettings()
    const { jobs, resume, loading: dataLoading } = useData()
    const [mode, setMode] = useState('resume_structured')
    const [loading, setLoading] = useState(false)
    const [selectedJobId, setSelectedJobId] = useState('')
    const [previewData, setPreviewData] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [showCloseConfirm, setShowCloseConfirm] = useState(false)
    const docxContainerRef = useRef(null)

    const resumeExists = !!resume?.resume_exists;

    const formatResumeDate = (val) => {
        if (!val || val === 'Present' || !val.includes('-')) return val;
        const parts = val.split('-');
        if (parts.length < 2) return val;
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]);
        const d = new Date(y, m - 1);
        return d.toLocaleString('default', { month: 'short', year: 'numeric' });
    };

    // Use current date for defaults if needed
    
    const normalizeToInputDate = (val) => {
        if (!val || val === 'Present') return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        const d_m_y = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (d_m_y) return `${d_m_y[3]}-${d_m_y[2].padStart(2,'0')}-${d_m_y[1].padStart(2,'0')}`;
        const moMap = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
        const match = val.match(/^([a-z]+)\s*(\d{4})$/i);
        if (match) {
            const m = moMap[match[1].toLowerCase().substring(0,3)] || '01';
            return `${match[2]}-${m}-01`;
        }
        return val;
    };

    const [formData, setFormData] = useState({
        name: '',
        mobile_number: '',
        mail_id: '',
        linkedin_link: '',
        github_link: '',
        portfolio_link: '',
        date_of_birth: '',
        summary: '',
        skills: [{ main_skill: '', sub_skills: '' }],
        companies: [{ position: '', name: '', from: '', to: '', experience: '' }],
        projects: [{ title: '', tools_used: '', project_link: '', project_details: '' }],
        educations: [{ field: '', subject: '', college: '', college_from: '', college_to: '' }],
        certificates: [{ name: '', issuer: '' }],
        job_description: '',
        job_link: ''
    })

    const addListItem = (field) => {
        const templates = {
            skills: { main_skill: '', sub_skills: '' },
            companies: { position: '', name: '', from: '', to: '', experience: '' },
            projects: { title: '', tools_used: '', project_link: '', project_details: '' },
            educations: { field: '', subject: '', college: '', college_from: '', college_to: '' },
            certificates: { name: '', issuer: '' }
        }
        setFormData({ ...formData, [field]: [...formData[field], templates[field]] })
    }

    const removeListItem = (field, index) => {
        if (formData[field].length <= 1) return
        const newList = [...formData[field]]
        newList.splice(index, 1)
        setFormData({ ...formData, [field]: newList })
    }

    const updateListItem = (field, index, key, value) => {
        const newList = [...formData[field]]
        newList[index] = { ...newList[index], [key]: value }
        setFormData({ ...formData, [field]: newList })
    }

    const handleGenerate = async (e) => {
        if (e) e.preventDefault()

        if (mode === 'form_basic' || mode === 'form_ai') {
            if (!formData.name || !formData.mail_id || !formData.mobile_number || !formData.summary) {
                return toast.error('Please fill in all mandatory contact details and summary')
            }
            if (!formData.skills[0].main_skill || !formData.companies[0].name || !formData.projects[0].title || !formData.educations[0].college) {
                return toast.error('Please add at least one entry for Skills, Experience, Projects and Education')
            }
        }

        if (mode === 'job_specific' && !selectedJobId && !formData.job_description) {
            return toast.error('Please select a job or paste a job description')
        }

        setLoading(true)
        const toastId = toast.loading('AI is processing your resume data...')

        try {
            let payload = { mode, llm_config: llmPayload }

            if (mode === 'resume_structured' || mode === 'job_specific') {
                if (mode === 'job_specific') {
                    const job = (selectedJobId && selectedJobId !== 'manual') 
                        ? jobs.find(j => j.id === parseInt(selectedJobId)) 
                        : null
                    const jd = job ? `${job.job_title}\n${job.company}\n${job.raw_content || ''}` : formData.job_description
                    payload.job_description = jd
                }
            } else {
                const formattedData = {
                    ...formData,
                    companies: formData.companies.map(c => ({
                        ...c,
                        from: formatResumeDate(c.from),
                        to: formatResumeDate(c.to)
                    })),
                    educations: formData.educations.map(e => ({
                        ...e,
                        college_from: formatResumeDate(e.college_from),
                        college_to: formatResumeDate(e.college_to)
                    }))
                }
                payload = { ...payload, ...formattedData }
            }

            const response = await api.post('/resume/preview', payload)

            if (response.data.success) {
                const data = response.data.data
                setPreviewData(data)
                setShowModal(true)
                
                toast.loading('Rendering document preview...', { id: toastId })
                try {
                    const docResp = await api.post('/resume/generate-resume', data, {
                        responseType: 'blob'
                    })
                    
                    const checkInterval = setInterval(async () => {
                        if (docxContainerRef.current) {
                            clearInterval(checkInterval)
                            const originalWarn = console.warn
                            console.warn = (...args) => {
                                if (typeof args[0] === 'string' && (args[0].includes('[WARN]') || args[0].includes('font') || args[0].includes('Unsupported'))) return
                                originalWarn.apply(console, args)
                            }
                            try {
                                docxContainerRef.current.innerHTML = ''
                                await renderAsync(docResp.data, docxContainerRef.current, null, {
                                    className: "docx-preview",
                                    inWrapper: true,
                                    ignoreWidth: true,
                                    ignoreHeight: true,
                                    ignoreFonts: true,
                                    breakPages: true,
                                    debug: false,
                                })
                            } finally {
                                console.warn = originalWarn
                            }
                            toast.success('Preview ready!', { id: toastId })
                        }
                    }, 50)
                    setTimeout(() => clearInterval(checkInterval), 10000)
                } catch (renderErr) {
                    console.error("Render error:", renderErr)
                    toast.error('Could not render DOCX preview, but data is ready.', { id: toastId })
                }
            } else {
                throw new Error('Failed to generate preview')
            }
        } catch (err) {
            console.error(err)
            toast.error('Generation failed. Please check your settings.', { id: toastId })
        } finally {
            setLoading(false)
        }
    }

    const handleDownload = async () => {
        if (!previewData) return
        const toastId = toast.loading('Preparing your DOCX file...')
        try {
            const response = await api.post('/resume/generate-resume', previewData, {
                responseType: 'blob'
            })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `${previewData.name || 'Resume'}_Generated.docx`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            toast.success('Download complete!', { id: toastId })
            setFormData({
                name: '', mobile_number: '', mail_id: '', linkedin_link: '', github_link: '', portfolio_link: '',
                summary: '', skills: [{ main_skill: '', sub_skills: '' }],
                companies: [{ position: '', name: '', from: '', to: '', experience: '' }],
                projects: [{ title: '', tools_used: '', project_link: '', project_details: '' }],
                educations: [{ field: '', subject: '', college: '', college_from: '', college_to: '' }],
                certificates: [{ name: '', issuer: '' }], job_description: '', job_link: ''
            })
            setShowModal(false)
            setPreviewData(null)
        } catch (err) {
            console.error(err)
            toast.error('Download failed.', { id: toastId })
        }
    }

    const handleCloseModal = () => setShowCloseConfirm(true)
    const confirmClose = () => { setShowModal(false); setShowCloseConfirm(false); setPreviewData(null); }

    const CustomSelect = ({ value, options, onChange, placeholder, icon: Icon }) => {
        const [isOpen, setIsOpen] = useState(false);
        const dropdownRef = useRef(null);
        const selectedOption = options.find(opt => opt.value === value);

        useEffect(() => {
            const handleClickOutside = (event) => {
                if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, [dropdownRef]);

        return (
            <div className="custom-dropdown" ref={dropdownRef}>
                <div className={`dropdown-header ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
                    <div className="header-left">
                        {Icon && <Icon size={18} className="header-icon" />}
                        <span>{selectedOption ? selectedOption.label : placeholder}</span>
                    </div>
                    <ChevronDown size={18} className={`chevron ${isOpen ? 'open' : ''}`} />
                </div>
                {isOpen && (
                    <div className="dropdown-list card animate-in">
                        {options.map((opt) => (
                            <div key={opt.value} className={`dropdown-item ${value === opt.value ? 'selected' : ''}`}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}>
                                <span className="item-label">{opt.label}</span>
                                {value === opt.value && <Check size={16} className="check-icon" />}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (dataLoading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>

    return (
        <div style={{ width: '100%' }}>
            <div className="page-header">
                <h2>Resume Generator</h2>
                <p>Create high-impact, ATS-friendly resumes in seconds</p>
            </div>

            <div className="generator-container">
                <div className="generator-tabs">
                    <button className={`gen-tab ${mode === 'resume_structured' ? 'active' : ''}`} onClick={() => { setMode('resume_structured'); setPreviewData(null); }}>
                        <FileText size={18} /><span>From Resume</span>
                    </button>
                    <button className={`gen-tab ${mode === 'form_basic' ? 'active' : ''}`} onClick={() => { setMode('form_basic'); setPreviewData(null); }}>
                        <List size={18} /><span>Manual Builder</span>
                    </button>
                    <button className={`gen-tab ${mode === 'form_ai' ? 'active' : ''}`} onClick={() => { setMode('form_ai'); setPreviewData(null); }}>
                        <Sparkles size={18} /><span>AI Enhanced</span>
                    </button>
                    <button className={`gen-tab ${mode === 'job_specific' ? 'active' : ''}`} onClick={() => { setMode('job_specific'); setPreviewData(null); }}>
                        <Briefcase size={18} /><span>Job Tailored</span>
                    </button>
                </div>

                <div className="mobile-mode-switcher">
                    <label className="form-label">Select Creation Mode</label>
                    <CustomSelect value={mode} onChange={(val) => { setMode(val); setPreviewData(null); }}
                        options={[{ value: 'resume_structured', label: 'Restructure Resume' }, { value: 'form_basic', label: 'Manual Builder' }, { value: 'form_ai', label: 'AI Enhanced Builder' }, { value: 'job_specific', label: 'Target Job Match' }]}
                        icon={Sparkles} />
                </div>

                <div className="generator-content card">
                    {mode === 'resume_structured' && (
                        <div className="gen-mode-view">
                            <h3>Smart Restructuring</h3>
                            <p>Format your current resume into a clean, modern, ATS-friendly structure using AI.</p>
                            {resumeExists ? (
                                <div className="saved-resume-info">
                                    <FileText size={24} color="var(--accent)" /><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Using your saved resume</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ready to restructure</div></div>
                                </div>
                            ) : (
                                <div className="no-resume-alert"><Upload size={24} /><div>No resume found. <button className="btn-link" onClick={() => setPage('resume')}>Upload one now</button> to use this feature.</div></div>
                            )}
                            <button className="btn btn-primary btn-lg gen-btn" onClick={handleGenerate} disabled={loading || !resumeExists}>
                                {loading ? <span className="spinner" /> : <><Download size={18} /> Generate Structured Resume</>}
                            </button>
                        </div>
                    )}

                    {(mode === 'form_basic' || mode === 'form_ai') && (
                        <div className="gen-mode-view">
                            <h3>{mode === 'form_ai' ? 'AI-Powered Builder' : 'Fast Manual Builder'}</h3>
                            <p>{mode === 'form_ai' ? 'Fill in your details and AI will polish your descriptions into professional action-oriented bullet points.' : 'Simply enter your details to generate a perfectly formatted DOCX resume.'}</p>
                            
                            <div className="gen-form-grid">
                                <div className="form-group"><label className="form-label">Full Name*</label><input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" /></div>
                                <div className="form-group"><label className="form-label">Email*</label><input className="form-input" value={formData.mail_id} onChange={e => setFormData({ ...formData, mail_id: e.target.value })} placeholder="john@example.com" /></div>
                                <div className="form-group"><label className="form-label">Mobile*</label><input className="form-input" value={formData.mobile_number} onChange={e => setFormData({ ...formData, mobile_number: e.target.value })} placeholder="+1 234 567 890" /></div>
                                <div className="form-group"><label className="form-label">LinkedIn</label><input className="form-input" value={formData.linkedin_link} onChange={e => setFormData({ ...formData, linkedin_link: e.target.value })} placeholder="linkedin.com/in/..." /></div>
                                <div className="form-group"><label className="form-label">GitHub</label><input className="form-input" value={formData.github_link} onChange={e => setFormData({ ...formData, github_link: e.target.value })} placeholder="github.com/..." /></div>
                                <div className="form-group"><label className="form-label">Portfolio</label><input className="form-input" value={formData.portfolio_link} onChange={e => setFormData({ ...formData, portfolio_link: e.target.value })} placeholder="portfolio.com" /></div>
                                <div className="form-group">
                                    <label className="form-label">Date of Birth (DD/MM/YYYY)*</label>
                                    <input type="date" className={`form-input date-input ${formData.date_of_birth ? 'has-value' : ''}`} value={normalizeToInputDate(formData.date_of_birth)} onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} onClick={(e) => e.target.showPicker?.()} />
                                </div>
                            </div>
                            
                            <div className="form-group"><label className="form-label">Professional Summary*</label><textarea className="form-input" rows={3} value={formData.summary} onChange={e => setFormData({ ...formData, summary: e.target.value })} placeholder="Brief overview..." /></div>

                            {/* DYNAMIC SECTIONS */}
                            <div className="dynamic-section">
                                <div className="section-header-flex"><label className="form-label">Technical Skills*</label><button className="btn btn-ghost btn-xs" onClick={() => addListItem('skills')}>+ Add Category</button></div>
                                {formData.skills.map((skill, idx) => (
                                    <div key={idx} className="dynamic-row">
                                        <div className="gen-form-grid" style={{ marginBottom: 0 }}>
                                            <input className="form-input" value={skill.main_skill} onChange={e => updateListItem('skills', idx, 'main_skill', e.target.value)} placeholder="Category" />
                                            <input className="form-input" value={skill.sub_skills} onChange={e => updateListItem('skills', idx, 'sub_skills', e.target.value)} placeholder="Skills (comma separated)" />
                                        </div>
                                        {formData.skills.length > 1 && <button className="btn-remove" onClick={() => removeListItem('skills', idx)}>✕</button>}
                                    </div>
                                ))}
                            </div>

                            <div className="dynamic-section">
                                <div className="section-header-flex"><label className="form-label">Professional Experience*</label><button className="btn btn-ghost btn-xs" onClick={() => addListItem('companies')}>+ Add Experience</button></div>
                                {formData.companies.map((company, idx) => (
                                    <div key={idx} className="dynamic-box">
                                        {formData.companies.length > 1 && <button className="btn-remove-box" onClick={() => removeListItem('companies', idx)}>✕</button>}
                                        <div className="gen-form-grid">
                                            <input className="form-input" value={company.name} onChange={e => updateListItem('companies', idx, 'name', e.target.value)} placeholder="Company" />
                                            <input className="form-input" value={company.position} onChange={e => updateListItem('companies', idx, 'position', e.target.value)} placeholder="Position" />
                                        </div>
                                        <div className="gen-form-grid" style={{ marginTop: '0.75rem' }}>
                                            <input type="date" className="form-input" value={normalizeToInputDate(company.from)} onChange={e => updateListItem('companies', idx, 'from', e.target.value)} />
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <input type="date" className="form-input" value={company.to === 'Present' ? '' : normalizeToInputDate(company.to)} onChange={e => updateListItem('companies', idx, 'to', e.target.value)} disabled={company.to === 'Present'} />
                                                <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <input type="checkbox" checked={company.to === 'Present'} onChange={e => updateListItem('companies', idx, 'to', e.target.checked ? 'Present' : '')} /> Present
                                                </label>
                                            </div>
                                        </div>
                                        <textarea className="form-input" rows={4} style={{ marginTop: '1rem' }} value={company.experience} onChange={e => updateListItem('companies', idx, 'experience', e.target.value)} placeholder="Bullet points..." />
                                    </div>
                                ))}
                            </div>

                            <div className="dynamic-section">
                                <div className="section-header-flex"><label className="form-label">Projects*</label><button className="btn btn-ghost btn-xs" onClick={() => addListItem('projects')}>+ Add Project</button></div>
                                {formData.projects.map((project, idx) => (
                                    <div key={idx} className="dynamic-box">
                                        {formData.projects.length > 1 && <button className="btn-remove-box" onClick={() => removeListItem('projects', idx)}>✕</button>}
                                        <div className="gen-form-grid">
                                            <input className="form-input" value={project.title} onChange={e => updateListItem('projects', idx, 'title', e.target.value)} placeholder="Project Title" />
                                            <input className="form-input" value={project.tools_used} onChange={e => updateListItem('projects', idx, 'tools_used', e.target.value)} placeholder="Tools Used" />
                                        </div>
                                        <input className="form-input" style={{ marginTop: '0.75rem' }} value={project.project_link} onChange={e => updateListItem('projects', idx, 'project_link', e.target.value)} placeholder="Project Link" />
                                        <textarea className="form-input" rows={4} style={{ marginTop: '1rem' }} value={project.project_details} onChange={e => updateListItem('projects', idx, 'project_details', e.target.value)} placeholder="Details..." />
                                    </div>
                                ))}
                            </div>

                            <div className="dynamic-section">
                                <div className="section-header-flex"><label className="form-label">Education*</label><button className="btn btn-ghost btn-xs" onClick={() => addListItem('educations')}>+ Add Education</button></div>
                                {formData.educations.map((edu, idx) => (
                                    <div key={idx} className="dynamic-box">
                                        {formData.educations.length > 1 && <button className="btn-remove-box" onClick={() => removeListItem('educations', idx)}>✕</button>}
                                        <input className="form-input" style={{ marginBottom: '0.75rem' }} value={edu.college} onChange={e => updateListItem('educations', idx, 'college', e.target.value)} placeholder="College/University" />
                                        <div className="gen-form-grid">
                                            <input className="form-input" value={edu.field} onChange={e => updateListItem('educations', idx, 'field', e.target.value)} placeholder="Field (e.g. B.Tech)" />
                                            <input className="form-input" value={edu.subject} onChange={e => updateListItem('educations', idx, 'subject', e.target.value)} placeholder="Subject" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button className="btn btn-primary btn-lg gen-btn" style={{ marginTop: '2rem' }} onClick={handleGenerate} disabled={loading || !formData.name}>
                                {loading ? <span className="spinner" /> : (mode === 'form_ai' ? <><Sparkles size={18} /> Generate AI Resume</> : <><Download size={18} /> Generate Plain Resume</>)}
                            </button>
                        </div>
                    )}

                    {mode === 'job_specific' && (
                        <div className="gen-mode-view">
                            <h3>Tailor to Job</h3>
                            {resumeExists ? (
                                <div className="saved-resume-info" style={{ marginBottom: '1.5rem' }}>
                                    <FileText size={24} color="var(--accent)" /><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Using your saved resume</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ready for matching</div></div>
                                </div>
                            ) : (
                                <div className="no-resume-alert" style={{ marginBottom: '1.5rem' }}><Upload size={24} /><div>No resume found. <button className="btn-link" onClick={() => setPage('resume')}>Upload one now</button> to use this feature.</div></div>
                            )}
                            <div className="form-group">
                                <label className="form-label">Select Job</label>
                                <CustomSelect value={selectedJobId} placeholder="-- Choose a Job --" onChange={(val) => setSelectedJobId(val)}
                                    options={[{ value: '', label: '-- Choose a Job --' }, ...jobs.map(j => ({ value: j.id, label: `${j.job_title} @ ${j.company}` })), { value: 'manual', label: 'Manual Input' }]}
                                    icon={Briefcase} />
                            </div>
                            <button className="btn btn-primary btn-lg gen-btn" onClick={handleGenerate} disabled={loading || !resumeExists || (!selectedJobId && !formData.job_description)}>
                                {loading ? <span className="spinner" /> : <><Sparkles size={18} /> Generate Tailored Resume</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="preview-modal-overlay">
                    <div className="preview-modal-content card" onClick={e => e.stopPropagation()}>
                        <div className="preview-header">
                            <div className="header-title"><h3>Resume Preview</h3><span className="badge">Draft</span></div>
                            <div className="preview-actions"><button className="btn btn-secondary" onClick={handleCloseModal}>Close</button><button className="btn btn-primary" onClick={handleDownload}><Download size={16} /> Download</button></div>
                        </div>
                        <div className="resume-preview-wrapper"><div id="resume-preview" ref={docxContainerRef}><div className="p-4 text-center text-muted"><span className="spinner" /> Rendering...</div></div></div>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={showCloseConfirm} title="Discard Draft?" message="Are you sure?" onConfirm={confirmClose} onCancel={() => setShowCloseConfirm(false)} isDanger={true} />

            <style>{`
                .generator-container { max-width: 1000px; margin: 0 auto; padding: 1rem; }
                .generator-tabs { display: flex; gap: 0.5rem; margin-bottom: 2rem; background: var(--bg-hover); padding: 0.4rem; border-radius: var(--radius-lg); }
                .gen-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.6rem; padding: 0.8rem; border: none; background: transparent; border-radius: var(--radius-md); cursor: pointer; color: var(--text-muted); font-weight: 600; transition: all 0.2s; }
                .gen-tab.active { background: var(--bg-card); color: var(--accent); box-shadow: var(--shadow-sm); }
                .gen-mode-view h3 { margin-bottom: 0.5rem; font-size: 1.25rem; }
                .gen-mode-view p { color: var(--text-muted); margin-bottom: 1.5rem; }
                .gen-form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
                .dynamic-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-light); }
                .section-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
                .dynamic-row { display: flex; gap: 0.5rem; align-items: flex-start; margin-bottom: 0.75rem; }
                .dynamic-box { position: relative; padding: 1.25rem; background: var(--bg-hover); border-radius: var(--radius-md); margin-bottom: 1rem; }
                .btn-remove, .btn-remove-box { background: var(--danger-soft); color: var(--danger); border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .btn-remove-box { position: absolute; top: -10px; right: -10px; box-shadow: var(--shadow-sm); }
                .gen-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.75rem; height: 52px; font-size: 1.05rem; }
                .saved-resume-info { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--accent-glow); border: 1px solid var(--accent); border-radius: var(--radius-md); margin-bottom: 2rem; }
                .no-resume-alert { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--danger-soft); color: var(--danger); border-radius: var(--radius-md); margin-bottom: 2rem; }
                
                .preview-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 2rem; }
                .preview-modal-content { width: 100%; max-width: 1000px; height: 90vh; display: flex; flexDirection: column; padding: 0; overflow: hidden; }
                .preview-header { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); }
                .resume-preview-wrapper { flex: 1; overflow-y: auto; background: #525659; padding: 2rem; }
                #resume-preview { background: white; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3); min-height: 100%; width: 100%; max-width: 800px; }
                
                .mobile-mode-switcher { display: none; margin-bottom: 1.5rem; }
                .mobile-mode-switcher .form-label { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem; display: block; }
                
                .custom-dropdown { position: relative; width: 100%; }
                .dropdown-header { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s; }
                .dropdown-header.active { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
                .header-left { display: flex; align-items: center; gap: 0.75rem; font-weight: 600; font-size: 1rem; }
                .header-icon { color: var(--accent); }
                .chevron { transition: transform 0.2s; color: var(--text-muted); }
                .chevron.open { transform: rotate(180deg); }
                
                .dropdown-list { position: absolute; top: calc(100% + 0.5rem); left: 0; right: 0; z-index: 100; padding: 0.5rem; max-height: 300px; overflow-y: auto; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); }
                .dropdown-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-radius: var(--radius-md); cursor: pointer; transition: background 0.2s; margin-bottom: 2px; }
                .dropdown-item:hover { background: var(--bg-hover); }
                .dropdown-item.selected { background: var(--accent-glow); color: var(--accent); }
                .item-label { font-weight: 500; font-size: 0.95rem; }

                @media (max-width: 1024px) {
                    .gen-form-grid { grid-template-columns: 1fr !important; gap: 0.75rem !important; }
                    .generator-tabs { display: none !important; }
                    .mobile-mode-switcher { display: block !important; }
                    .preview-modal-overlay { padding: 0 !important; }
                    .preview-modal-content { height: 100vh !important; border-radius: 0 !important; }
                }
            `}</style>
        </div>
    )
}
