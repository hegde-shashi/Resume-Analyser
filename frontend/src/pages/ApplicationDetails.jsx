import { useState, useEffect, useCallback } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Save, RefreshCw } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'

export default function ApplicationDetails() {
    const { llmPayload } = useSettings()
    const [details, setDetails] = useState({
        name: '', first_name: '', middle_name: '', last_name: '',
        email: '', phone: '', address: '', city: '', state: '', country: '', pincode: '',
        linkedin_link: '', github_link: '', portfolio_link: '', summary: '', primary_skills: '', languages: '',
        education: [{ college: '', degree: '', field_of_study: '', start_date: '', end_date: '' }],
        experience: [{ company: '', position: '', start_date: '', end_date: '', description: '' }],
        is_citizen_of_india: false, requires_visa_sponsorship: false
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const SIMPLE_FIELDS = [
        { key: 'name', label: 'Full Name' },
        { key: 'first_name', label: 'First Name' },
        { key: 'middle_name', label: 'Middle Name' },
        { key: 'last_name', label: 'Last Name' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone' },
        { key: 'address', label: 'Address' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'country', label: 'Country' },
        { key: 'pincode', label: 'Pincode' },
        { key: 'linkedin_link', label: 'LinkedIn URL' },
        { key: 'github_link', label: 'GitHub URL' },
        { key: 'portfolio_link', label: 'Portfolio URL' },
        { key: 'date_of_birth', label: 'Date of Birth (DD/MM/YYYY)', type: 'date' },
        { key: 'summary', label: 'Summary', type: 'textarea' },
        { key: 'primary_skills', label: 'Primary Skills (comma separated)', type: 'textarea' },
        { key: 'languages', label: 'Languages (comma separated)', type: 'textarea' },
        { key: 'is_citizen_of_india', label: 'Is Citizen of India?', type: 'checkbox' },
        { key: 'requires_visa_sponsorship', label: 'Requires Visa Sponsorship?', type: 'checkbox' },
    ]

    const loadDetails = useCallback(async (forceRefresh = false) => {
        setLoading(true)
        try {
            const res = await api.post('/get_resume_details', { 
                force_refresh: forceRefresh,
                ...llmPayload 
            })
            if (res.data && !res.data.error) {
                const data = { ...res.data }
                // Ensure arrays are initialized
                if (!Array.isArray(data.education) || data.education.length === 0) {
                    data.education = [{ college: '', degree: '', field_of_study: '', start_date: '', end_date: '' }]
                }
                if (!Array.isArray(data.experience) || data.experience.length === 0) {
                    data.experience = [{ company: '', position: '', start_date: '', end_date: '', description: '' }]
                }
                
                // Handle languages array to comma-separated string for UI
                if (Array.isArray(data.languages)) {
                    data.languages = data.languages.join(', ')
                }
                
                setDetails(data)
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load application details.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadDetails() }, [loadDetails])

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await api.post('/update_resume_details', {
                ...details,
                ...llmPayload
            })
            toast.success('Application details updated!')
        } catch (err) {
            toast.error('Failed to update details.')
        } finally {
            setSaving(false)
        }
    }

    const handleChange = (key, value) => {
        setDetails(prev => ({ ...prev, [key]: value }))
    }

    const updateArrayItem = (arrayKey, index, field, value) => {
        const newArray = [...details[arrayKey]]
        newArray[index] = { ...newArray[index], [field]: value }
        setDetails(prev => ({ ...prev, [arrayKey]: newArray }))
    }

    const addArrayItem = (arrayKey, template) => {
        setDetails(prev => ({ ...prev, [arrayKey]: [...prev[arrayKey], template] }))
    }

    const removeArrayItem = (arrayKey, index) => {
        const newArray = [...details[arrayKey]]
        if (newArray.length > 1) {
            newArray.splice(index, 1)
            setDetails(prev => ({ ...prev, [arrayKey]: newArray }))
        }
    }
    
    const normalizeToInputDate = (val) => {
        if (!val || val === 'Present') return '';
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

    if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>

    return (
        <div>
            <div className="page-header" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 className="mobile-hidden">Application Details</h2>
                    <p>Manage the profile data used by the autofill extension.</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => loadDetails(true)} disabled={loading}>
                    <RefreshCw size={14} /> Refresh AI Extraction
                </button>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    {SIMPLE_FIELDS.map(f => {
                        const val = details[f.key]
                        if (f.type === 'checkbox') {
                            return (
                                <div key={f.key} className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                                    <input type="checkbox" checked={val === true || val === 'true'} onChange={e => handleChange(f.key, e.target.checked)} style={{ width: '1rem', height: '1rem' }} />
                                    <label className="form-label" style={{ margin: 0 }}>{f.label}</label>
                                </div>
                            )
                        }
                        if (f.type === 'date') {
                            return (
                                <div key={f.key} className="form-group">
                                    <label className="form-label">{f.label}</label>
                                    <input 
                                        type="date" 
                                        className="form-input" 
                                        value={normalizeToInputDate(val) || ''} 
                                        onChange={e => handleChange(f.key, e.target.value)} 
                                        onClick={e => e.target.showPicker?.()}
                                    />
                                </div>
                            )
                        }
                        return (
                            <div key={f.key} className="form-group" style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                                <label className="form-label">{f.label}</label>
                                {f.type === 'textarea' ? (
                                    <textarea className="form-input" rows="3" value={val || ''} onChange={e => handleChange(f.key, e.target.value)} />
                                ) : (
                                    <input type={f.type || 'text'} className="form-input" value={val || ''} onChange={e => handleChange(f.key, e.target.value)} />
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Experience</h3>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => addArrayItem('experience', { company: '', position: '', start_date: '', end_date: '', description: '' })}>+ Add Experience</button>
                    </div>
                    {details.experience.map((exp, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', position: 'relative' }}>
                            {details.experience.length > 1 && <button type="button" onClick={() => removeArrayItem('experience', idx)} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group"><label className="form-label">Company Name</label><input className="form-input" value={exp.company || ''} onChange={e => updateArrayItem('experience', idx, 'company', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Position / Title</label><input className="form-input" value={exp.position || ''} onChange={e => updateArrayItem('experience', idx, 'position', e.target.value)} /></div>
                                <div className="form-group">
                                    <label className="form-label">From Date (DD/MM/YYYY)</label>
                                    <input type="date" className="form-input" value={normalizeToInputDate(exp.start_date) || ''} onChange={e => updateArrayItem('experience', idx, 'start_date', e.target.value)} onClick={e => e.target.showPicker?.()} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">To Date (DD/MM/YYYY)</label>
                                    <input type="date" className="form-input" value={normalizeToInputDate(exp.end_date) || ''} onChange={e => updateArrayItem('experience', idx, 'end_date', e.target.value)} onClick={e => e.target.showPicker?.()} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}><label className="form-label">Description</label><textarea className="form-input" rows="2" value={exp.description || ''} onChange={e => updateArrayItem('experience', idx, 'description', e.target.value)} /></div>
                        </div>
                    ))}
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Education</h3>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => addArrayItem('education', { college: '', degree: '', field_of_study: '', start_date: '', end_date: '' })}>+ Add Education</button>
                    </div>
                    {details.education.map((edu, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', position: 'relative' }}>
                            {details.education.length > 1 && <button type="button" onClick={() => removeArrayItem('education', idx)} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>}
                            <div className="form-group"><label className="form-label">College / University</label><input className="form-input" value={edu.college || ''} onChange={e => updateArrayItem('education', idx, 'college', e.target.value)} /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group"><label className="form-label">Degree (e.g. Bachelor's)</label><input className="form-input" value={edu.degree || ''} onChange={e => updateArrayItem('education', idx, 'degree', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Field of Study</label><input className="form-input" value={edu.field_of_study || ''} onChange={e => updateArrayItem('education', idx, 'field_of_study', e.target.value)} /></div>
                                <div className="form-group">
                                    <label className="form-label">From Date (DD/MM/YYYY)</label>
                                    <input type="date" className="form-input" value={normalizeToInputDate(edu.start_date) || ''} onChange={e => updateArrayItem('education', idx, 'start_date', e.target.value)} onClick={e => e.target.showPicker?.()} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">To Date (DD/MM/YYYY)</label>
                                    <input type="date" className="form-input" value={normalizeToInputDate(edu.end_date) || ''} onChange={e => updateArrayItem('education', idx, 'end_date', e.target.value)} onClick={e => e.target.showPicker?.()} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? <div className="spinner" /> : <Save size={16} />} 
                        {saving ? 'Saving...' : 'Save Details'}
                    </button>
                </div>
            </form>
            </div>
        </div>
    )
}
