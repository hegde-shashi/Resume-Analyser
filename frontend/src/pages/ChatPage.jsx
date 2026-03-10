import { useState, useEffect, useRef } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Send, Bot } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import ReactMarkdown from 'react-markdown'

export default function ChatPage() {
    const { llmPayload } = useSettings()
    const [jobs, setJobs] = useState([])
    const [selectedJob, setSelectedJob] = useState('')
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const bottomRef = useRef()

    function handleSelectJob(newJobId) {
        setSelectedJob(newJobId)
        if (!newJobId) {
            setMessages([])
            return
        }
        const saved = sessionStorage.getItem(`chat_${newJobId}`)
        if (saved) {
            try {
                setMessages(JSON.parse(saved))
            } catch {
                setMessages([])
            }
        } else {
            setMessages([])
        }
    }

    useEffect(() => {
        api.get('/get_jobs').then(r => {
            setJobs(r.data)
            if (r.data.length > 0 && !selectedJob) handleSelectJob(r.data[0].id)
        })
    }, [selectedJob])

    useEffect(() => {
        if (selectedJob && messages.length > 0) {
            sessionStorage.setItem(`chat_${selectedJob}`, JSON.stringify(messages))
        }
    }, [messages, selectedJob])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const job = jobs.find(j => j.id === selectedJob || j.id === Number(selectedJob))

    async function send() {
        if (!input.trim() || !job) return
        const userMsg = { role: 'user', text: input }
        const currentHistory = messages.slice(-15).map(m => ({ role: m.role, content: m.text }))

        setMessages(m => [...m, userMsg])
        setInput('')
        setLoading(true)

        try {
            const token = localStorage.getItem('token')
            let baseUrl = '';
            try {
                baseUrl = process.env.REACT_APP_API_URL || '';
            } catch (e) { }

            const res = await fetch(`${baseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    question: userMsg.text,
                    history: currentHistory,
                    job_id: selectedJob,
                    ...llmPayload,
                })
            })

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || 'Chat failed')
            }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let aiText = ''
            let firstChunk = true

            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                const chunk = decoder.decode(value, { stream: true })
                aiText += chunk

                const currentText = aiText

                if (firstChunk) {
                    setLoading(false)
                    setMessages(prev => [...prev, { role: 'assistant', text: currentText }])
                    firstChunk = false
                } else {
                    setMessages(prev => {
                        const newM = [...prev]
                        newM[newM.length - 1] = { role: 'assistant', text: currentText }
                        return newM
                    })
                }
            }
        } catch (err) {
            toast.error(err.message || 'Chat failed')
            setMessages(m => [...m, { role: 'assistant', text: '⚠️ Something went wrong. Please try again.' }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="chat-page-wrapper" style={{ display: 'flex', flexDirection: 'row', height: '100%', minHeight: 0, gap: '1rem' }}>

            {/* Left sidebar: Job Sessions (Desktop only) */}
            <div className="chat-sidebar desktop-only" style={{ width: 260, borderRight: '1px solid var(--border-light)', paddingRight: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Chat Sessions</h3>
                {jobs.map(j => (
                    <div
                        key={j.id}
                        onClick={() => handleSelectJob(j.id)}
                        style={{
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            background: selectedJob === j.id ? 'var(--accent-glow)' : 'transparent',
                            border: selectedJob === j.id ? '1px solid var(--accent)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all var(--transition)'
                        }}
                    >
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: selectedJob === j.id ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.company}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{j.job_title}</div>
                    </div>
                ))}
            </div>

            {/* Right side: Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                {/* Mobile Job selector */}
                <div className="mobile-only" style={{ marginBottom: '0.75rem' }}>
                    <select
                        className="form-select"
                        value={selectedJob}
                        onChange={e => handleSelectJob(e.target.value)}
                        style={{ width: '100%' }}
                    >
                        <option value="">— Select a job session —</option>
                        {jobs.map(j => <option key={j.id} value={j.id}>{j.job_title} @ {j.company}</option>)}
                    </select>
                </div>

                <div className="chat-container hide-scrollbar" style={{ margin: 0, border: 'none', background: 'transparent', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div className="chat-messages hide-scrollbar" style={{ background: 'transparent', border: 'none', padding: '0 0.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {!job ? (
                            <div className="empty-state" style={{ margin: 'auto', padding: '2rem' }}>
                                <Bot size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                                <p>Select a job session to begin chatting</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '2.5rem', padding: '2rem 1rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(120deg, var(--accent), var(--accent-hover))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                        AI Job Assistant
                                    </h2>
                                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '1.1rem' }}>How can I help you with this application today?</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 650 }}>
                                    {['How to prepare for this interview?', 'What skills am I missing?', 'Write me a cover letter', 'Mock interview questions'].map(q => (
                                        <button key={q} onClick={() => setInput(q)}
                                            style={{
                                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                borderRadius: '99px', fontSize: '0.85rem', padding: '0.75rem 1.25rem',
                                                color: 'var(--text-primary)', cursor: 'pointer', transition: 'all var(--transition)',
                                                boxShadow: 'var(--shadow-sm)', fontWeight: 500
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="chat-center-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
                                {messages.map((m, i) => (
                                    <div key={i} className={`chat-msg ${m.role}`} style={{ marginBottom: i === messages.length - 1 ? 0 : '1rem' }}>
                                        <div className="chat-msg-bubble" style={m.role === 'user' ? { whiteSpace: 'pre-wrap' } : {}}>
                                            {m.role === 'assistant' ? (
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ node, ...props }) => <p style={{ margin: '0 0 0.5rem 0', '&:last-child': { margin: 0 } }} {...props} />,
                                                        ul: ({ node, ...props }) => <ul style={{ margin: '0 0 0.5rem 0', paddingLeft: '1.2rem' }} {...props} />,
                                                        li: ({ node, ...props }) => <li style={{ marginBottom: '0.2rem' }} {...props} />
                                                    }}
                                                >
                                                    {m.text}
                                                </ReactMarkdown>
                                            ) : (
                                                m.text
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="chat-msg assistant" style={{ marginTop: '1rem' }}>

                                        <div className="chat-msg-bubble">
                                            <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <span style={{ animation: 'pulse 1s infinite 0s' }}>●</span>
                                                <span style={{ animation: 'pulse 1s infinite 0.2s' }}>●</span>
                                                <span style={{ animation: 'pulse 1s infinite 0.4s' }}>●</span>
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <div ref={bottomRef} style={{ height: 1 }} />
                    </div>

                    <div style={{ padding: '1rem 0 0' }}>
                        <div className="chat-center-wrapper" style={{
                            display: 'flex', alignItems: 'flex-end', gap: '0.5rem',
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: '24px', padding: '0.5rem 0.5rem 0.5rem 1.25rem',
                            boxShadow: 'var(--shadow-md)'
                        }}>
                            <textarea
                                className="hide-scrollbar"
                                placeholder={job ? 'Chat With AI' : 'Select a job first'}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={!job || loading}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                                }}
                                style={{
                                    flex: 1, border: 'none', background: 'transparent', outline: 'none',
                                    padding: '0.6rem 0', minHeight: '24px', maxHeight: '150px', resize: 'none',
                                    fontFamily: 'inherit', fontSize: '0.95rem', color: 'var(--text-primary)',
                                    lineHeight: 1.4, overflowY: 'auto'
                                }}
                                rows={1}
                            />
                            <button className="btn btn-primary btn-icon" onClick={send} disabled={!job || loading || !input.trim()} style={{ borderRadius: '50%', padding: '0.7rem', flexShrink: 0, alignSelf: 'flex-end', marginBottom: '4px' }}>
                                <Send size={18} />
                            </button>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.75rem' }}>
                            AI can make mistakes. Verify important information.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
