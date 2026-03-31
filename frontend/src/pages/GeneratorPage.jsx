import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { FileText, Sparkles, Briefcase, Download, Upload, List, ChevronDown, Check } from 'lucide-react'
import { renderAsync } from 'docx-preview'
import { useSettings } from '../context/SettingsContext'

export default function GeneratorPage({ setPage }) {

    const { llmPayload } = useSettings()
    const [mode, setMode] = useState('resume_structured')
    const [loading, setLoading] = useState(false)
    const [jobs, setJobs] = useState([])
    const [selectedJobId, setSelectedJobId] = useState('')
    const [resumeExists, setResumeExists] = useState(false)
    const [previewData, setPreviewData] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [showCloseConfirm, setShowCloseConfirm] = useState(false)
    const docxContainerRef = useRef(null)

    const formatResumeDate = (val) => {
        if (!val || val === 'Present' || !val.includes('-')) return val;
        const parts = val.split('-');
        if (parts.length < 2) return val;
        // Handle both YYYY-MM and YYYY-MM-DD
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]);
        const d = new Date(y, m - 1);
        return d.toLocaleString('default', { month: 'short', year: 'numeric' });
    };

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const futureMonth = `${now.getFullYear() + 5}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const normalizeToInputDate = (val) => {
        if (!val || val === 'Present') return '';
        // If already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        // If MM/YYYY or DD/MM/YYYY
        const d_m_y = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (d_m_y) return `${d_m_y[3]}-${d_m_y[2].padStart(2,'0')}-${d_m_y[1].padStart(2,'0')}`;
        // If Month YYYY (e.g. Aug 2022)
        const moMap = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
        const match = val.match(/^([a-z]+)\s*(\d{4})$/i);
        if (match) {
            const m = moMap[match[1].toLowerCase().substring(0,3)] || '01';
            return `${match[2]}-${m}-01`;
        }
        return val;
    };

    // User data form for manual builder
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
        if (formData[field].length <= 1) return // Keep at least one
        const newList = [...formData[field]]
        newList.splice(index, 1)
        setFormData({ ...formData, [field]: newList })
    }

    const updateListItem = (field, index, key, value) => {
        const newList = [...formData[field]]
        newList[index] = { ...newList[index], [key]: value }
        setFormData({ ...formData, [field]: newList })
    }

    const loadJobs = useCallback(() => {
        api.get('/get_jobs').then(r => setJobs(r.data || []))
        api.get('/get_resume').then(r => setResumeExists(r.data.resume_exists))
    }, [])

    useEffect(() => {
        loadJobs()
        window.addEventListener('focus', loadJobs)
        return () => window.removeEventListener('focus', loadJobs)
    }, [loadJobs])

    const handleGenerate = async (e) => {
        if (e) e.preventDefault()

        // Validation for manual/AI modes
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
                // Clone and format dates for basic/AI form modes
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
                
                // Immediately generate the DOCX for preview
                toast.loading('Rendering document preview...', { id: toastId })
                try {
                    const docResp = await api.post('/resume/generate-resume', data, {
                        responseType: 'blob'
                    })
                    
                    // Simple interval check because state update might not be instant
                    const checkInterval = setInterval(async () => {
                        if (docxContainerRef.current) {
                            clearInterval(checkInterval)
                            
                            // Suppress docx-preview console noise for custom fonts & unsupported tags
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
                    
                    // Safety timeout to clear interval if modal fails to render
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
            
            // Clear form and data after download as requested
            setFormData({
                name: '',
                mobile_number: '',
                mail_id: '',
                linkedin_link: '',
                github_link: '',
                portfolio_link: '',
                summary: '',
                skills: [{ main_skill: '', sub_skills: '' }],
                companies: [{ position: '', name: '', from: '', to: '', experience: '' }],
                projects: [{ title: '', tools_used: '', project_link: '', project_details: '' }],
                educations: [{ field: '', subject: '', college: '', college_from: '', college_to: '' }],
                certificates: [{ name: '', issuer: '' }],
                job_description: '',
                job_link: ''
            })
            setShowModal(false)
            setPreviewData(null)
        } catch (err) {
            console.error(err)
            toast.error('Download failed.', { id: toastId })
        }
    }

    const handleCloseModal = () => {
        setShowCloseConfirm(true)
    }

    const confirmClose = () => {
        setShowModal(false)
        setShowCloseConfirm(false)
        setPreviewData(null)
    }

    // Custom Dropdown Component
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
                            <div 
                                key={opt.value} 
                                className={`dropdown-item ${value === opt.value ? 'selected' : ''}`}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                            >
                                <span className="item-label">{opt.label}</span>
                                {value === opt.value && <Check size={16} className="check-icon" />}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };


    return (
        <div className="generator-container">
            <div className="page-header">
                <h2>Resume Generator</h2>
                <p>Create high-impact, ATS-friendly resumes in seconds</p>
            </div>

            <div className="generator-tabs">
                <button
                    className={`gen-tab ${mode === 'resume_structured' ? 'active' : ''}`}
                    onClick={() => { setMode('resume_structured'); setPreviewData(null); }}
                >
                    <FileText size={18} />
                    <span>From Resume</span>
                </button>
                <button
                    className={`gen-tab ${mode === 'form_basic' ? 'active' : ''}`}
                    onClick={() => { setMode('form_basic'); setPreviewData(null); }}
                >
                    <List size={18} />
                    <span>Manual Builder</span>
                </button>
                <button
                    className={`gen-tab ${mode === 'form_ai' ? 'active' : ''}`}
                    onClick={() => { setMode('form_ai'); setPreviewData(null); }}
                >
                    <Sparkles size={18} />
                    <span>AI Enhanced</span>
                </button>
                <button
                    className={`gen-tab ${mode === 'job_specific' ? 'active' : ''}`}
                    onClick={() => { setMode('job_specific'); setPreviewData(null); }}
                >
                    <Briefcase size={18} />
                    <span>Job Tailored</span>
                </button>
            </div>

            <div className="mobile-mode-switcher">
                <label className="form-label">Select Creation Mode</label>
                <CustomSelect 
                    value={mode}
                    onChange={(val) => { setMode(val); setPreviewData(null); }}
                    options={[
                        { value: 'resume_structured', label: 'Restructure Resume' },
                        { value: 'form_basic', label: 'Manual Builder' },
                        { value: 'form_ai', label: 'AI Enhanced Builder' },
                        { value: 'job_specific', label: 'Target Job Match' }
                    ]}
                    icon={Sparkles}
                />
            </div>

            <div className="generator-content card">
                {mode === 'resume_structured' && (
                    <div className="gen-mode-view">
                        <h3>Smart Restructuring</h3>
                        <p>Format your current resume into a clean, modern, ATS-friendly structure using AI.</p>

                        {resumeExists ? (
                            <div className="saved-resume-info">
                                <FileText size={24} color="var(--accent)" />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>Using your saved resume</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ready to restructure</div>
                                </div>
                            </div>
                        ) : (
                            <div className="no-resume-alert">
                                <Upload size={24} />
                                <div>No resume found. <button className="btn-link" onClick={() => setPage('resume')}>Upload one now</button> to use this feature.</div>
                            </div>
                        )}

                        <button className="btn btn-primary btn-lg gen-btn" onClick={handleGenerate} disabled={loading || !resumeExists}>
                            {loading ? <span className="spinner" /> : <><Download size={18} /> Generate Structured Resume</>}
                        </button>
                    </div>
                )}


                {(mode === 'form_basic' || mode === 'form_ai') && (
                    <div className="gen-mode-view">
                        <h3>{mode === 'form_ai' ? 'AI-Powered Builder' : 'Fast Manual Builder'}</h3>
                        <p>
                            {mode === 'form_ai'
                                ? 'Fill in your details and AI will polish your descriptions into professional action-oriented bullet points.'
                                : 'Simply enter your details to generate a perfectly formatted DOCX resume.'}
                        </p>

                        <div className="gen-form-grid">
                            <div className="form-group">
                                <label className="form-label">Full Name*</label>
                                <input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email*</label>
                                <input className="form-input" value={formData.mail_id} onChange={e => setFormData({ ...formData, mail_id: e.target.value })} placeholder="john@example.com" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mobile*</label>
                                <input className="form-input" value={formData.mobile_number} onChange={e => setFormData({ ...formData, mobile_number: e.target.value })} placeholder="+1 234 567 890" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">LinkedIn</label>
                                <input className="form-input" value={formData.linkedin_link} onChange={e => setFormData({ ...formData, linkedin_link: e.target.value })} placeholder="linkedin.com/in/..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">GitHub</label>
                                <input className="form-input" value={formData.github_link} onChange={e => setFormData({ ...formData, github_link: e.target.value })} placeholder="github.com/..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Portfolio</label>
                                <input className="form-input" value={formData.portfolio_link} onChange={e => setFormData({ ...formData, portfolio_link: e.target.value })} placeholder="portfolio.com" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date of Birth (DD/MM/YYYY)*</label>
                                <input 
                                    type="date" 
                                    className={`form-input date-input ${formData.date_of_birth ? 'has-value' : ''}`}
                                    value={normalizeToInputDate(formData.date_of_birth)} 
                                    onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} 
                                    onClick={(e) => e.target.showPicker?.()} 
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Professional Summary*</label>
                            <textarea className="form-input" rows={3} value={formData.summary} onChange={e => setFormData({ ...formData, summary: e.target.value })} placeholder="Brief overview of your career and goals..." />
                        </div>

                        {/* SKILLS SECTION */}
                        <div className="dynamic-section">
                            <div className="section-header-flex">
                                <label className="form-label">Technical Skills*</label>
                                <button className="btn btn-ghost btn-xs" onClick={() => addListItem('skills')}>+ Add Category</button>
                            </div>
                            {formData.skills.map((skill, idx) => (
                                <div key={idx} className="dynamic-row">
                                    <div className="gen-form-grid" style={{ marginBottom: 0 }}>
                                        <input className="form-input" value={skill.main_skill} onChange={e => updateListItem('skills', idx, 'main_skill', e.target.value)} placeholder="Category (e.g. Languages)" />
                                        <input className="form-input" value={skill.sub_skills} onChange={e => updateListItem('skills', idx, 'sub_skills', e.target.value)} placeholder="Skills (e.g. Python, Java, C++)" />
                                    </div>
                                    {formData.skills.length > 1 && <button className="btn-remove" onClick={() => removeListItem('skills', idx)}>✕</button>}
                                </div>
                            ))}
                        </div>

                        {/* EXPERIENCE SECTION */}
                        <div className="dynamic-section">
                            <div className="section-header-flex">
                                <label className="form-label">Professional Experience* (Use 'Enter' for each bullet point)</label>
                                <button className="btn btn-ghost btn-xs" onClick={() => addListItem('companies')}>+ Add Experience</button>
                            </div>
                            {formData.companies.map((company, idx) => (
                                <div key={idx} className="dynamic-box">
                                    {formData.companies.length > 1 && <button className="btn-remove-box" onClick={() => removeListItem('companies', idx)}>✕</button>}
                                    <div className="gen-form-grid">
                                        <div className="form-group">
                                            <input className="form-input" value={company.name} onChange={e => updateListItem('companies', idx, 'name', e.target.value)} placeholder="Company Name" />
                                        </div>
                                        <div className="form-group">
                                            <input className="form-input" value={company.position} onChange={e => updateListItem('companies', idx, 'position', e.target.value)} placeholder="Position" />
                                        </div>
                                    </div>
                                    <div className="gen-form-grid" style={{ marginTop: '0.75rem' }}>
                                        <div className="form-group">
                                            <label className="form-label-xs">From Date (DD/MM/YYYY)</label>
                                            <input 
                                                type="date" 
                                                className={`form-input date-input ${company.from ? 'has-value' : ''}`}
                                                max={currentMonth + "-31"} 
                                                value={normalizeToInputDate(company.from)} 
                                                onChange={e => updateListItem('companies', idx, 'from', e.target.value)} 
                                                onClick={(e) => e.target.showPicker?.()} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label className="form-label-xs">To Date (DD/MM/YYYY)</label>
                                                <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={company.to === 'Present'} onChange={e => updateListItem('companies', idx, 'to', e.target.checked ? 'Present' : '')} />
                                                    Present
                                                </label>
                                            </div>
                                            <input 
                                                type="date" 
                                                className={`form-input date-input ${company.to && company.to !== 'Present' ? 'has-value' : ''}`}
                                                max={currentMonth + "-31"} 
                                                value={company.to === 'Present' ? '' : normalizeToInputDate(company.to)} 
                                                onChange={e => updateListItem('companies', idx, 'to', e.target.value)} 
                                                disabled={company.to === 'Present'} 
                                                onClick={(e) => e.target.showPicker?.()} 
                                            />
                                        </div>
                                    </div>
                                    <textarea className="form-input" rows={4} style={{ marginTop: '1rem' }} value={company.experience} onChange={e => updateListItem('companies', idx, 'experience', e.target.value)} placeholder="Enter points here... use 'Enter' for new point" />
                                </div>
                            ))}
                        </div>

                        {/* PROJECTS SECTION */}
                        <div className="dynamic-section">
                            <div className="section-header-flex">
                                <label className="form-label">Projects* (Use 'Enter' for each bullet point)</label>
                                <button className="btn btn-ghost btn-xs" onClick={() => addListItem('projects')}>+ Add Project</button>
                            </div>
                            {formData.projects.map((project, idx) => (
                                <div key={idx} className="dynamic-box">
                                    {formData.projects.length > 1 && <button className="btn-remove-box" onClick={() => removeListItem('projects', idx)}>✕</button>}
                                    <div className="gen-form-grid">
                                        <input className="form-input" value={project.title} onChange={e => updateListItem('projects', idx, 'title', e.target.value)} placeholder="Project Title" />
                                        <input className="form-input" value={project.tools_used} onChange={e => updateListItem('projects', idx, 'tools_used', e.target.value)} placeholder="Tools/Tech Used" />
                                    </div>
                                    <div className="form-group" style={{ marginTop: '1rem' }}>
                                        <input className="form-input" value={project.project_link} onChange={e => updateListItem('projects', idx, 'project_link', e.target.value)} placeholder="Project Link (Optional)" />
                                    </div>
                                    <textarea className="form-input" rows={4} style={{ marginTop: '1rem' }} value={project.project_details} onChange={e => updateListItem('projects', idx, 'project_details', e.target.value)} placeholder="Enter points here... use 'Enter' for new point" />
                                </div>
                            ))}
                        </div>

                        {/* EDUCATION SECTION */}
                        <div className="dynamic-section">
                            <div className="section-header-flex">
                                <label className="form-label">Education*</label>
                                <button className="btn btn-ghost btn-xs" onClick={() => addListItem('educations')}>+ Add Education</button>
                            </div>
                            {formData.educations.map((edu, idx) => (
                                <div key={idx} className="dynamic-box">
                                    {formData.educations.length > 1 && <button className="btn-remove-box" onClick={() => removeListItem('educations', idx)}>✕</button>}
                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <input className="form-input" value={edu.college} onChange={e => updateListItem('educations', idx, 'college', e.target.value)} placeholder="College / University" />
                                    </div>
                                    <div className="gen-form-grid">
                                        <div className="form-group">
                                            <label className="form-label-xs">Field</label>
                                            <input className="form-input" value={edu.field} onChange={e => updateListItem('educations', idx, 'field', e.target.value)} placeholder="e.g. Bachelor's" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label-xs">Subject</label>
                                            <input className="form-input" value={edu.subject} onChange={e => updateListItem('educations', idx, 'subject', e.target.value)} placeholder="e.g. Computer Science" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label-xs">From Date (DD/MM/YYYY)</label>
                                            <input 
                                                type="date" 
                                                className={`form-input date-input ${edu.college_from ? 'has-value' : ''}`}
                                                max={futureMonth + "-12-31"} 
                                                value={normalizeToInputDate(edu.college_from)} 
                                                onChange={e => updateListItem('educations', idx, 'college_from', e.target.value)} 
                                                onClick={(e) => e.target.showPicker?.()} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label className="form-label-xs">To Date (DD/MM/YYYY)</label>
                                                <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={edu.college_to === 'Present'} onChange={e => updateListItem('educations', idx, 'college_to', e.target.checked ? 'Present' : '')} />
                                                    Present
                                                </label>
                                            </div>
                                            <input 
                                                type="date" 
                                                className={`form-input date-input ${edu.college_to && edu.college_to !== 'Present' ? 'has-value' : ''}`}
                                                max={futureMonth + "-12-31"} 
                                                value={edu.college_to === 'Present' ? '' : normalizeToInputDate(edu.college_to)} 
                                                onChange={e => updateListItem('educations', idx, 'college_to', e.target.value)} 
                                                disabled={edu.college_to === 'Present'} 
                                                onClick={(e) => e.target.showPicker?.()} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* CERTIFICATIONS SECTION */}
                        <div className="dynamic-section">
                            <div className="section-header-flex">
                                <label className="form-label">Certifications</label>
                                <button className="btn btn-ghost btn-xs" onClick={() => addListItem('certificates')}>+ Add Certification</button>
                            </div>
                            {formData.certificates.map((cert, idx) => (
                                <div key={idx} className="dynamic-row">
                                    <div className="gen-form-grid" style={{ marginBottom: 0 }}>
                                        <input className="form-input" value={cert.name} onChange={e => updateListItem('certificates', idx, 'name', e.target.value)} placeholder="Certification Name" />
                                        <input className="form-input" value={cert.issuer} onChange={e => updateListItem('certificates', idx, 'issuer', e.target.value)} placeholder="Issuer (e.g. Google, AWS)" />
                                    </div>
                                    {formData.certificates.length > 1 && <button className="btn-remove" onClick={() => removeListItem('certificates', idx)}>✕</button>}
                                </div>
                            ))}
                        </div>

                        <button className="btn btn-primary btn-lg gen-btn" style={{ marginTop: '2rem' }} onClick={handleGenerate} disabled={loading || !formData.name}>
                            {loading ? <span className="spinner" /> : (
                                mode === 'form_ai' ? <><Sparkles size={18} /> Generate AI-Polished Resume</> : <><Download size={18} /> Generate Plain Resume</>
                            )}
                        </button>
                    </div>
                )}

                {mode === 'job_specific' && (
                    <div className="gen-mode-view">
                        <h3>Tailor to Job</h3>
                        <p>Our AI will rewrite your resume specifically for this job, emphasizing the most relevant keywords and experiences.</p>

                        {resumeExists ? (
                            <div className="saved-resume-info" style={{ marginBottom: '1.5rem' }}>
                                <FileText size={24} color="var(--accent)" />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>Using your saved resume</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ready for matching</div>
                                </div>
                            </div>
                        ) : (
                            <div className="no-resume-alert" style={{ marginBottom: '1.5rem' }}>
                                <Upload size={24} />
                                <div>No resume found. <button className="btn-link" onClick={() => setPage('resume')}>Upload one now</button> to use this feature.</div>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Select Job from Tracker</label>
                            <CustomSelect 
                                value={selectedJobId}
                                placeholder="-- Choose a Job --"
                                onChange={(val) => setSelectedJobId(val)}
                                options={[
                                    { value: '', label: '-- Choose a Job --' },
                                    ...jobs.map(j => ({ value: j.id, label: `${j.job_title} @ ${j.company}` })),
                                    { value: 'manual', label: 'Manual Input Description' }
                                ]}
                                icon={Briefcase}
                            />
                        </div>

                        {selectedJobId === 'manual' && (
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Job Link (Optional)</label>
                                    <input
                                        className="form-input"
                                        value={formData.job_link || ''}
                                        onChange={e => setFormData({ ...formData, job_link: e.target.value })}
                                        placeholder="Paste the job URL here..."
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Paste Job Description</label>
                                    <textarea
                                        className="form-input"
                                        rows={6}
                                        value={formData.job_description || ''}
                                        onChange={e => setFormData({ ...formData, job_description: e.target.value })}
                                        placeholder="Paste the target job description here..."
                                    />
                                </div>
                            </div>
                        )}

                        <button className="btn btn-primary btn-lg gen-btn" style={{ marginTop: '1rem' }} onClick={handleGenerate} disabled={loading || !resumeExists || (!selectedJobId && !formData.job_description)}>
                            {loading ? <span className="spinner" /> : <><Sparkles size={18} /> Generate Job-Specific Resume</>}
                        </button>
                    </div>
                )}
                {showModal && (
                    <div className="preview-modal-overlay">
                        <div className="preview-modal-content card" onClick={e => e.stopPropagation()}>
                            <div className="preview-header">
                                <div className="header-title">
                                    <h3>Resume Preview</h3>
                                    <span className="badge">Draft</span>
                                </div>
                                <div className="preview-actions" style={{ display: 'flex' }}>
                                    <button className="btn btn-secondary" onClick={handleCloseModal}>Close & Clear</button>
                                    <button className="btn btn-primary" onClick={handleDownload}>
                                        <Download size={16} /> Download DOCX
                                    </button>
                                </div>
                            </div>
                            <div className="resume-preview-wrapper">
                                <div id="resume-preview" ref={docxContainerRef}>
                                    <div className="p-4 text-center text-muted">
                                        <span className="spinner" style={{ marginRight: '10px' }} />
                                        Rendering document...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showCloseConfirm && (
                    <div className="confirm-modal-overlay">
                        <div className="confirm-modal-content card" onClick={e => e.stopPropagation()}>
                            <h3>Discard Draft?</h3>
                            <p>Are you sure you want to close the preview? Your current draft will be cleared.</p>
                            <div className="confirm-modal-actions">
                                <button className="btn btn-ghost" onClick={() => setShowCloseConfirm(false)}>Cancel</button>
                                <button className="btn btn-primary" style={{ background: '#dc2626' }} onClick={confirmClose}>Yes, Discard</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                /* Global Select Styling */
                select {
                    appearance: none !important;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'%3E%3C/path%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 1rem center !important;
                    background-size: 1rem !important;
                    padding-right: 3rem !important;
                    cursor: pointer !important;
                }
                .mobile-mode-switcher {
                    display: none;
                    margin-bottom: 1.5rem;
                }
                .mobile-mode-switcher select {
                    background-color: var(--bg-primary) !important;
                }
                
                /* New Custom Dropdown Styles */
                .custom-dropdown {
                    position: relative;
                    width: 100%;
                    z-index: 10;
                }
                .dropdown-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0 1.25rem;
                    height: 50px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all 0.2s;
                    user-select: none;
                }
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    flex: 1;
                    margin-right: 1rem;
                }
                .header-left span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .dropdown-header:hover {
                    border-color: var(--accent);
                }
                .dropdown-header.active {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.1);
                }
                .form-label {
                    display: block;
                    font-size: 0.875rem;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                    color: var(--text-primary);
                }
                .form-label-xs {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                }
                .header-icon {
                    color: var(--accent);
                }
                .chevron {
                    color: var(--text-muted);
                    transition: transform 0.2s;
                }
                .chevron.open {
                    transform: rotate(180deg);
                }
                .dropdown-list {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    right: 0;
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    box-shadow: 0 15px 30px rgba(0,0,0,0.2) !important;
                    padding: 0.5rem;
                    z-index: 100;
                    overflow: hidden;
                }
                .dropdown-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    transition: all 0.2s;
                    color: var(--text-secondary);
                }
                .dropdown-item:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }
                .dropdown-item.selected {
                    background: rgba(var(--accent-rgb), 0.1);
                    color: var(--accent);
                    font-weight: 600;
                }
                .check-icon {
                    color: var(--accent);
                }

                [data-theme='dark'] .dropdown-list {
                    background: #2b2b2b;
                    border: 1px solid #444;
                }
                [data-theme='dark'] .dropdown-item:hover {
                    background: #3d3d3d;
                }
                [data-theme='dark'] .dropdown-header {
                    background: #2b2b2b;
                }

                .confirm-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 3000;
                    backdrop-filter: blur(4px);
                }
                .confirm-modal-content {
                    width: 90%;
                    max-width: 400px;
                    padding: 2rem;
                    text-align: center;
                    animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                @keyframes popIn {
                    from { transform: scale(0.8); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .confirm-modal-actions {
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                    margin-top: 2rem;
                }

                .preview-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.75);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    backdrop-filter: blur(8px);
                    padding: 2rem;
                    animation: fadeIn 0.2s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .preview-modal-content {
                    width: 95vw;
                    max-width: 1200px;
                    height: 92vh;
                    max-height: 92vh;
                    display: flex;
                    flex-direction: column;
                    padding: 0;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    border: 1px solid var(--border);
                    animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes scaleUp {
                    from { opacity: 0; transform: scale(0.9) translateY(40px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .preview-header {
                    padding: 1rem 2rem;
                    background: var(--bg-hover);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--border);
                    flex-shrink: 0;
                }
                .resume-preview-wrapper {
                    width: 100%;
                    // height: 80vh;
                    overflow: auto;
                    display: flex;
                    justify-content: center;
                    background: #fff;
                }

                #resume-preview {
                    // transform: scale(0.9);
                    transform-origin: top center;
                    // background: white;
                    // box-shadow: 0 0 40px rgba(0,0,0,0.2);
                    // width: 850px;
                    // min-height: 1100px;
                }
                /* Higher specificity override for docx-preview */
                #resume-preview .docx-preview {
                    margin: 0 !important;
                    padding: 2rem !important;
                    width: 100% !important;
                    min-width: 100% !important;
                    background: transparent !important;
                    border: none !important;
                }
            .docx-preview-wrapper {
                background: transparent !important;
                display: flex;
                justify-content: center;
                padding: 0 !important;
            }
            .resume-header {
                text-align: center;
                margin-bottom: 2rem;
                border-bottom: 2px solid #333;
                padding-bottom: 1rem;
            }
            .resume-header h1 {
                font-size: 2.25rem;
                margin: 0;
                color: #000;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .contact-line {
                font-size: 0.9rem;
                margin-top: 0.5rem;
                color: #555;
            }
            .resume-section {
                margin-top: 1.25rem;
            }
            .section-title {
                font-size: 1rem;
                color: #000;
                border-bottom: 2px solid #000;
                padding-bottom: 0.1rem;
                margin-top: 1rem;
                margin-bottom: 0.6rem;
                text-transform: uppercase;
                font-weight: bold;
                letter-spacing: 0.5px;
            }
            .section-content {
                font-size: 1rem;
            }
            .text-justify { text-align: justify; }
            .pre-wrap { white-space: pre-wrap; }
            .skill-item {
                font-size: 1rem;
                margin-bottom: 0.2rem;
            }
            .experience-item {
                margin-bottom: 1rem;
            }
            .item-title {
                font-weight: bold;
                font-size: 1.05rem;
                margin-bottom: 0.25rem;
            }
            .item-details {
                font-size: 1rem;
            }
            .bullet-list {
                margin: 0.25rem 0 0.5rem 1.25rem;
                padding: 0;
            }
            .bullet-list li {
                font-size: 1rem;
                margin-bottom: 0.15rem;
                list-style-type: disc;
            }
            .p-link {
                font-size: 0.8rem;
                color: var(--accent);
                font-weight: normal;
            }
            .animate-in {
                animation: scaleFade 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
            }
            @keyframes scaleFade {
                from { opacity: 0; transform: scale(0.95) translateY(20px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }


                .generator-container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                .generator-tabs {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                }
                .gen-tab {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 1rem 0.5rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .gen-tab.active {
                    border-color: var(--accent);
                    color: var(--accent);
                    background: rgba(var(--accent-rgb), 0.05);
                }
                .gen-tab:hover:not(.active) {
                    background: var(--bg-hover);
                }
                .gen-mode-view h3 {
                    margin-bottom: 0.5rem;
                    color: var(--text-primary);
                }
                .gen-mode-view p {
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    margin-bottom: 1.5rem;
                }
                .saved-resume-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: var(--bg-hover);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    margin-bottom: 1.5rem;
                }
                .no-resume-alert {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: rgba(var(--warning-rgb), 0.1);
                    border: 1px solid var(--warning);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.9rem;
                }
                .btn-link {
                    background: none;
                    border: none;
                    color: var(--accent);
                    text-decoration: underline;
                    cursor: pointer;
                    padding: 0;
                    font: inherit;
                }
                .gen-btn {
                    width: 100%;
                    gap: 0.75rem;
                    padding: 1rem;
                }

                .gen-form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }
                .dynamic-section {
                    margin-top: 1.5rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid var(--border);
                }
                .section-header-flex {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .dynamic-row {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }
                .dynamic-box {
                    position: relative;
                    padding: 1.25rem;
                    background: var(--bg-hover);
                    border: 1px dashed var(--border);
                    border-radius: var(--radius-md);
                    margin-bottom: 1.5rem;
                }
                .btn-remove {
                    background: rgba(220, 38, 38, 0.1);
                    color: #dc2626;
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: all 0.2s;
                }
                .btn-remove:hover {
                    background: #dc2626;
                    color: white;
                }
                .btn-remove-box {
                    position: absolute;
                    top: -10px;
                    right: -10px;
                    background: white;
                    color: #dc2626;
                    border: 1px solid var(--border);
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                [data-theme='dark'] .btn-remove-box {
                    background: #2b2b2b;
                }
                .form-input {
                    width: 100%;
                }
                .date-input {
                    color: var(--text-muted);
                    opacity: 0.8;
                    cursor: pointer;
                }
                .date-input:focus, .date-input.has-value {
                    color: var(--text-primary);
                    opacity: 1;
                }
                /* Style the internal date parts to match placeholder look when empty */
                .date-input::-webkit-datetime-edit-text,
                .date-input::-webkit-datetime-edit-month-field,
                .date-input::-webkit-datetime-edit-day-field,
                .date-input::-webkit-datetime-edit-year-field {
                    color: inherit;
                }
                .date-input::-webkit-calendar-picker-indicator {
                    cursor: pointer;
                    filter: var(--calendar-icon-filter);
                }
                textarea.form-input {
                    resize: vertical;
                    min-height: 100px;
                    max-width: 100%;
                }
                .dynamic-row .gen-form-grid {
                    flex: 1;
                }
                @media (max-width: 1024px) {
                    .preview-modal-content {
                        max-width: 95%;
                    }
                }

                @media (max-width: 930px) {
                    .generator-tabs {
                        display: none;
                    }
                    .mobile-mode-switcher {
                        display: block;
                    }
                    .preview-modal-overlay {
                        padding: 0;
                    }
                    .preview-modal-content {
                        height: 100vh;
                        max-height: 100vh;
                        width: 100vw;
                        max-width: 100vw;
                        border-radius: 0;
                        border: none;
                    }
                    .preview-header {
                        padding: 1rem;
                        flex-direction: column;
                        gap: 0.75rem;
                        align-items: center;
                        text-align: center;
                    }
                    .header-title h3 {
                        font-size: 1.1rem;
                    }
                    .preview-actions {
                        width: 100%;
                        justify-content: center;
                        gap: 0.5rem;
                    }
                    .preview-actions .btn {
                        padding: 0.5rem 0.75rem;
                        font-size: 0.85rem;
                        flex: 1;
                    }
                    .resume-preview-wrapper {
                        padding: 0;
                        overflow-x: hidden;
                        display: block; /* Ensure normal flow for scaling */
                    }
                    #resume-preview {
                        // max-width: none;
                        // width: 800px; /* Base width for scaling */
                        // margin: 0;
                        // transform: scale(0.45); /* Base scale for 360-380px screens */
                        transform-origin: top left;
                    }
                }

                @media (max-width: 500px) {
                    .generator-tabs {
                        grid-template-columns: 1fr;
                    }
                    .gen-form-grid {
                        grid-template-columns: 1fr;
                    }
                    .section-header-flex {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 0.5rem;
                    }
                    .dynamic-row {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .btn-remove {
                        align-self: flex-end;
                    }
                }

                /* Large display optimization to prevent extreme stretching */
                @media (min-width: 1400px) {
                    .generator-container {
                        max-width: 1200px;
                        margin-left: auto;
                        margin-right: auto;
                    }
                }
            `}</style>
        </div>
    )
}
