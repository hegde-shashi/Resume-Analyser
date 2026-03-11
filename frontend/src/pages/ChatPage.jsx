import { useState, useEffect, useRef } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Send, Bot } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function ChatPage() {
    const { llmPayload } = useSettings()
    const [jobs, setJobs] = useState([])
    const [selectedJob, setSelectedJob] = useState(() => localStorage.getItem('lastChatJobId') || '')
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const bottomRef = useRef()
    const inputRef = useRef()

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = '24px'; // Reset height
            const scrollHeight = inputRef.current.scrollHeight;
            // Cap at ~4 lines (approx 100px given 24px base and 1.4 line-height)
            inputRef.current.style.height = Math.min(scrollHeight, 100) + 'px';
        }
    }, [input])

    function handleSelectJob(newJobId) {
        const id = String(newJobId)
        setSelectedJob(id)
        if (id) {
            localStorage.setItem('lastChatJobId', id)
        }
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
            const savedId = localStorage.getItem('lastChatJobId')
            const exists = r.data.find(j => String(j.id) === String(savedId))
            
            // If we have a valid saved job, always call handleSelectJob to load messages
            if (exists) {
                handleSelectJob(savedId)
            } else if (r.data.length > 0) {
                handleSelectJob(r.data[0].id)
            }
        })
    }, [])

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
                            background: String(selectedJob) === String(j.id) ? 'var(--accent-glow)' : 'transparent',
                            border: String(selectedJob) === String(j.id) ? '1px solid var(--accent)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all var(--transition)'
                        }}
                    >
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: String(selectedJob) === String(j.id) ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.company}</div>
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
                    <div className="chat-messages hide-scrollbar" style={{ background: 'transparent', border: 'none', flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        p: ({ node, ...props }) => <p style={{ margin: '0 0 0.5rem 0', '&:last-child': { margin: 0 } }} {...props} />,
                                                        ul: ({ node, ...props }) => <ul style={{ margin: '0 0 0.5rem 0', paddingLeft: '1.2rem' }} {...props} />,
                                                        li: ({ node, ...props }) => <li style={{ marginBottom: '0.2rem' }} {...props} />,
                                                        a: ({ node, children, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                                                    }}
                                                >
                                                    {m.text}
                                                </ReactMarkdown>
                                            ) : (
                                                <ReactMarkdown 
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        p: ({ node, ...props }) => <p style={{ margin: 0 }} {...props} />,
                                                        a: ({ node, children, ...props }) => <a target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }} {...props}>{children}</a>
                                                    }}
                                                >
                                                    {m.text}
                                                </ReactMarkdown>
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

                    <div style={{ padding: '1rem 0 0', position: 'relative' }}>
                        {/* Slash Command Suggestions */}
                        {input.startsWith('/') && input.length === 1 && (
                            <div className="command-suggestions" style={{
                                position: 'absolute', bottom: '100%', left: '1.25rem', marginBottom: '0.5rem',
                                background: 'var(--bg-card)', backdropFilter: 'blur(10px)',
                                border: '1px solid var(--border)', borderRadius: '12px', padding: '0.5rem',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
                                gap: '2px', minWidth: '180px', zIndex: 100, animation: 'slideUp 0.2s ease-out'
                            }}>
                                <div 
                                    onClick={() => setInput('/interview ')}
                                    style={{
                                        padding: '0.6rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <span style={{ fontStyle: 'italic', fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem' }}>/interview</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Start mock interview</span>
                                </div>
                                <div 
                                    onClick={() => setInput('/normal ')}
                                    style={{
                                        padding: '0.6rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <span style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: '0.9rem', background: 'var(--border)', padding: '1px 4px', borderRadius: '4px' }}>/normal</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Regular chat mode</span>
                                </div>
                            </div>
                        )}

                        <div className="chat-center-wrapper" style={{
                            display: 'flex', alignItems: 'flex-end', gap: '0.5rem',
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: '24px', padding: '0.5rem 0.5rem 0.5rem 1.25rem',
                            boxShadow: 'var(--shadow-md)'
                        }}>
                            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <textarea
                                    ref={inputRef}
                                    className="hide-scrollbar"
                                    placeholder={job ? 'Chat With AI (use / for commands)' : 'Select a job first'}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    disabled={!job || loading}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                                    }}
                                    style={{
                                        flex: 1, border: 'none', background: 'transparent', outline: 'none',
                                        padding: '0.6rem 0', minHeight: '24px', maxHeight: '150px', resize: 'none',
                                        fontFamily: 'inherit', fontSize: '0.95rem', 
                                        color: input.startsWith('/interview') ? 'var(--accent)' : 'var(--text-primary)',
                                        fontStyle: input.startsWith('/interview') ? 'italic' : 'normal',
                                        fontWeight: input.startsWith('/normal') ? '700' : 'normal',
                                        lineHeight: 1.4, overflowY: 'auto'
                                    }}
                                    rows={1}
                                />
                            </div>
                            <button className="btn btn-primary btn-icon" onClick={send} disabled={!job || loading || !input.trim()} style={{ borderRadius: '50%', padding: '0.7rem', flexShrink: 0, alignSelf: 'flex-end'}}>
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
