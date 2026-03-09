import { useEffect, useState, useRef } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Upload, Trash2, FileText, CheckCircle } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import ConfirmModal from '../components/ConfirmModal'

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

    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    async function deleteResume() {
        setDeleting(true)
        try {
            await api.delete('/delete_resume')
            toast.success('Resume deleted')
            setResume({ resume_exists: false })
            setDeleteModalOpen(false)
        } catch (err) {
            console.error(err)
            toast.error(err.response?.data?.error || 'Delete failed')
            setDeleteModalOpen(false)
        } finally {
            setDeleting(false)
        }
    }

    if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>

    return (
        <div>
            <div className="page-header">
                <h2 className="mobile-hidden">My Resume</h2>
                <p>Upload your PDF resume for AI-powered analysis</p>
            </div>

            {resume?.resume_exists ? (
                <div className="card">
                    <div className="resume-card-inner">
                        <div className="resume-icon-box">
                            <FileText size={32} color="var(--success)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', overflow: 'hidden' }}>
                                <CheckCircle size={14} color="var(--success)" style={{ flexShrink: 0 }} />
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resume.resume_name}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uploaded {resume.created_at}</div>
                        </div>
                        <div className="resume-card-actions">
                            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current.click()}>
                                <Upload size={14} /> Replace
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => setDeleteModalOpen(true)}>
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

            <ConfirmModal
                isOpen={deleteModalOpen}
                title="Delete Resume"
                message="Are you sure you want to delete your resume? This action cannot be undone."
                onConfirm={deleteResume}
                onCancel={() => setDeleteModalOpen(false)}
                loading={deleting}
                isDanger={true}
            />
        </div>
    )
}
