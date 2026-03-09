import { useState, useEffect, useRef } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Send, Bot, User } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'

export default function ChatPage() {
    const { llmPayload } = useSettings()
    const [jobs, setJobs] = useState([])
    const [selectedJob, setSelectedJob] = useState('')
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const bottomRef = useRef()

    useEffect(() => {
        api.get('/get_jobs').then(r => {
            setJobs(r.data)
            if (r.data.length > 0) setSelectedJob(r.data[0].ui_index)
        })
    }, [])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const job = jobs.find(j => j.ui_index === selectedJob || j.ui_index === Number(selectedJob))

    async function send() {
        if (!input.trim() || !job) return
        const userMsg = { role: 'user', text: input }
        setMessages(m => [...m, userMsg])
        setInput('')
        setLoading(true)
        try {
            const { data } = await api.post('/chat', {
                input: userMsg.text,
                job_id: selectedJob,
                ...llmPayload,
            })
            setMessages(m => [...m, { role: 'assistant', text: data.answer || data.response || 'No response' }])
        } catch (err) {
            toast.error(err.response?.data?.error || 'Chat failed')
            setMessages(m => [...m, { role: 'assistant', text: '⚠️ Something went wrong. Please try again.' }])
        } finally { setLoading(false) }
    }

    return (
        <div>
            <div className="page-header">
                <h2>AI Job Assistant</h2>
                <p>Ask questions about your resume, job, or interview preparation</p>
            </div>

            {/* Job selector */}
            <div style={{ marginBottom: '1rem' }}>
                <select
                    className="form-select"
                    value={selectedJob}
                    onChange={e => { setSelectedJob(e.target.value); setMessages([]) }}
                    style={{ maxWidth: 480 }}
                >
                    <option value="">— Select a job —</option>
                    {jobs.map(j => <option key={j.ui_index} value={j.ui_index}>{j.job_title} @ {j.company}</option>)}
                </select>
            </div>

            {/* Quick prompts */}
            {messages.length === 0 && job && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {['How to prepare for this interview?', 'What skills am I missing?', 'Write me a cover letter', 'Mock interview questions'].map(q => (
                        <button key={q} className="btn btn-secondary btn-sm" onClick={() => setInput(q)}>
                            {q}
                        </button>
                    ))}
                </div>
            )}

            <div className="chat-container">
                <div className="chat-messages">
                    {!job && (
                        <div className="empty-state" style={{ padding: '2rem' }}>
                            <Bot size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                            <p>Select a job above to begin chatting</p>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={`chat-msg ${m.role}`}>
                            <div className={`chat-avatar ${m.role === 'assistant' ? 'ai' : 'user'}`}>
                                {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                            </div>
                            <div className="chat-msg-bubble" style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                        </div>
                    ))}
                    {loading && (
                        <div className="chat-msg assistant">
                            <div className="chat-avatar ai"><Bot size={14} /></div>
                            <div className="chat-msg-bubble">
                                <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ animation: 'pulse 1s infinite 0s' }}>●</span>
                                    <span style={{ animation: 'pulse 1s infinite 0.2s' }}>●</span>
                                    <span style={{ animation: 'pulse 1s infinite 0.4s' }}>●</span>
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                <div className="chat-input-row">
                    <input
                        placeholder={job ? 'Ask anything about your application…' : 'Select a job first'}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={!job || loading}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                    />
                    <button className="btn btn-primary btn-icon" onClick={send} disabled={!job || loading || !input.trim()}>
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}
