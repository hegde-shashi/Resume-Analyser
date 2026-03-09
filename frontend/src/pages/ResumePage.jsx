import { useEffect, useState, useRef } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Upload, Trash2, FileText, CheckCircle } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'

export default function ResumePage() {
    const { llmPayload } = useSettings()
    const [resume, setResume] = useState(null)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [dragover, setDragover] = useState(false)
    const fileRef = useRef()

    const load = () => api.get('/get_resume')
        .then(r => setResume(r.data))
        .finally(() => setLoading(false))

    useEffect(() => { load() }, [])

    const toBase64 = file => new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
    })

    async function handleFile(file) {
        if (!file) return
        const ext = file.name.split('.').pop().toLowerCase()
        if (!['pdf', 'docx', 'doc', 'txt'].includes(ext)) {
            toast.error('Please upload a PDF, Word (.docx/.doc), or TXT file')
            return
        }
        setUploading(true)
        try {
            const b64 = await toBase64(file)
            await api.post('/upload_resume', {
                file: b64,
                file_name: file.name,
                ...llmPayload,
            })
            toast.success('Resume uploaded and processed!')
            await load()
        } catch (err) {
            toast.error(err.response?.data?.error || 'Upload failed')
        } finally {
            setUploading(false)
        }
    }

    async function deleteResume() {
        if (!confirm('Delete your resume? This cannot be undone.')) return
        try {
            await api.delete('/delete_resume')
            toast.success('Resume deleted')
            setResume({ resume_exists: false })
        } catch { toast.error('Delete failed') }
    }

    if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>

    return (
        <div>
            <div className="page-header">
                <h2>My Resume</h2>
                <p>Upload your PDF resume for AI-powered analysis</p>
            </div>

            {resume?.resume_exists ? (
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'var(--success-soft)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex' }}>
                            <FileText size={32} color="var(--success)" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <CheckCircle size={16} color="var(--success)" />
                                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{resume.resume_name}</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Uploaded on {resume.created_at}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current.click()}>
                                <Upload size={14} /> Replace
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={deleteResume}>
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    className={`upload-zone ${dragover ? 'dragover' : ''}`}
                    onClick={() => !uploading && fileRef.current.click()}
                    onDragOver={e => { e.preventDefault(); setDragover(true) }}
                    onDragLeave={() => setDragover(false)}
                    onDrop={e => { e.preventDefault(); setDragover(false); handleFile(e.dataTransfer.files[0]) }}
                >
                    {uploading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <div className="spinner spinner-lg" />
                            <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Parsing &amp; embedding your resume…</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>This may take 30–60 seconds</p>
                        </div>
                    ) : (
                        <>
                            <Upload className="upload-zone-icon" />
                            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Drop your resume here</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>or click to browse · PDF, Word (.docx), TXT</div>
                        </>
                    )}
                </div>
            )}

            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
        </div>
    )
}
