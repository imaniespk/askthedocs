import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import client, { API } from '../api/client'

type Document = {
  id: string
  filename: string
  status: string
}

type Source = {
  chunk_id: string
  filename: string
  page_number: number
  content: string
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  sources?: Source[]
}

type Conversation = {
  id: string
  title: string | null
  created_at: string
}

type PreviewState =
  | { type: 'loading' }
  | { type: 'pdf'; url: string }
  | { type: 'txt'; content: string }
  | { type: 'docx'; html: string }
  | { type: 'error' }

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [pinnedPreviewId, setPinnedPreviewId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pdfBlobRef = useRef<string | null>(null)

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => client.get(`${API}/documents/`).then(r => r.data),
  })

  const readyDocs = documents.filter(d => d.status === 'ready')

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await client.get(`${API}/conversations/`)
        const convs: Conversation[] = res.data
        setConversations(convs)
        if (convs.length > 0) {
          const latest = convs[0]
          await switchConversation(latest.id)
        }
      } catch {
        // endpoint not yet available — start fresh
      }
    }
    loadHistory()
  }, [])

  // Update previewDoc when selectedDocs or pinnedPreviewId changes
  useEffect(() => {
    const ids = Array.from(selectedDocs)
    if (ids.length === 0) {
      setPreviewDoc(null)
      setPinnedPreviewId(null)
      return
    }
    // Use pinned doc if it's still selected, otherwise fall back to first
    const targetId = pinnedPreviewId && selectedDocs.has(pinnedPreviewId) ? pinnedPreviewId : ids[0]
    const doc = readyDocs.find(d => d.id === targetId) ?? null
    setPreviewDoc(doc)
  }, [selectedDocs, documents, pinnedPreviewId])

  // Fetch preview content when previewDoc changes
  useEffect(() => {
    if (!previewDoc) {
      setPreview(null)
      return
    }
    setPreview({ type: 'loading' })

    const ext = previewDoc.filename.split('.').pop()?.toLowerCase()

    if (pdfBlobRef.current) {
      URL.revokeObjectURL(pdfBlobRef.current)
      pdfBlobRef.current = null
    }

    if (ext === 'pdf') {
      client
        .get(`${API}/documents/${previewDoc.id}/file`, { responseType: 'blob' })
        .then(res => {
          const url = URL.createObjectURL(res.data)
          pdfBlobRef.current = url
          setPreview({ type: 'pdf', url })
        })
        .catch(() => setPreview({ type: 'error' }))
    } else if (ext === 'docx') {
      client
        .get(`${API}/documents/${previewDoc.id}/content`)
        .then(res => {
          const clean = DOMPurify.sanitize(res.data.content as string)
          setPreview({ type: 'docx', html: clean })
        })
        .catch(() => setPreview({ type: 'error' }))
    } else {
      client
        .get(`${API}/documents/${previewDoc.id}/file`, { responseType: 'text' })
        .then(res => setPreview({ type: 'txt', content: res.data as string }))
        .catch(() => setPreview({ type: 'error' }))
    }

    return () => {
      if (pdfBlobRef.current) {
        URL.revokeObjectURL(pdfBlobRef.current)
        pdfBlobRef.current = null
      }
    }
  }, [previewDoc?.id])

  const ask = useMutation({
    mutationFn: async (question: string) => {
      let convId = conversationId
      if (!convId) {
        const res = await client.post(`${API}/conversations/`)
        convId = res.data.id
        setConversationId(convId)
        setConversations(prev => [{ ...res.data, title: question.slice(0, 60) }, ...prev])
      }
      const body: { question: string; document_ids?: string[] } = { question }
      if (selectedDocs.size > 0) body.document_ids = Array.from(selectedDocs)
      const res = await client.post(`${API}/conversations/${convId}/messages`, body)
      return res.data
    },
    onSuccess: data => {
      setMessages(prev => [
        ...prev,
        { id: data.id, role: 'assistant', text: data.content, sources: data.sources },
      ])
    },
  })

  async function switchConversation(id: string) {
    try {
      const res = await client.get(`${API}/conversations/${id}/messages`)
      setConversationId(id)
      setMessages(
        res.data.map((m: { id: string; role: 'user' | 'assistant'; content: string; sources?: Source[] }) => ({
          id: m.id,
          role: m.role,
          text: m.content,
          sources: m.sources ?? [],
        }))
      )
    } catch {
      setConversationId(id)
      setMessages([])
    }
  }

  function startNewConversation() {
    setConversationId(null)
    setMessages([])
  }

  async function handleRename(id: string, newTitle: string) {
    if (!newTitle.trim()) return
    try {
      const res = await client.patch(`${API}/conversations/${id}/title`, { title: newTitle.trim() })
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: res.data.title } : c))
    } catch {
      // ignore
    } finally {
      setRenamingId(null)
    }
  }

  async function handleDeleteConversation(id: string) {
    try {
      await client.delete(`${API}/conversations/${id}`)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (conversationId === id) {
        setConversationId(null)
        setMessages([])
      }
    } catch {
      // ignore
    }
  }

  function handleSend() {
    const text = input.trim()
    if (!text || ask.isPending) return
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text }])
    setInput('')
    ask.mutate(text)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend()
  }

  function toggleDoc(id: string) {
    setSelectedDocs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-1 overflow-hidden bg-gray-50">

      {/* Conversation sidebar */}
      <aside className="w-44 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-3 py-3 border-b border-gray-100">
          <button
            onClick={startNewConversation}
            className="w-full text-left text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {conversations.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-400">No past conversations.</p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`group relative flex items-center px-3 py-2 text-xs transition-colors ${
                  conv.id === conversationId
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {renamingId === conv.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(conv.id, renameValue)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(conv.id, renameValue)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    className="flex-1 min-w-0 text-xs bg-white border border-indigo-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-800"
                  />
                ) : (
                  <button
                    onClick={() => switchConversation(conv.id)}
                    className="flex-1 min-w-0 text-left truncate"
                  >
                    {conv.title ?? `Chat ${new Date(conv.created_at).toLocaleDateString()}`}
                  </button>
                )}
                {renamingId !== conv.id && (
                  <div className="hidden group-hover:flex items-center gap-1 ml-1 shrink-0">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setRenamingId(conv.id)
                        setRenameValue(conv.title ?? '')
                      }}
                      title="Rename"
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteConversation(conv.id) }}
                      title="Delete"
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Document preview panel */}
      {previewDoc && (
        <div className="w-2/5 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">{previewDoc.filename}</p>
              <p className="text-xs text-gray-400">Preview</p>
            </div>
            <button
              onClick={() => setSelectedDocs(prev => { const n = new Set(prev); n.delete(previewDoc.id); return n })}
              className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
              title="Close preview"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {preview?.type === 'loading' && (
              <div className="flex items-center justify-center h-full">
                <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {preview?.type === 'pdf' && (
              <iframe src={preview.url} className="w-full h-full border-0" title={previewDoc.filename} />
            )}
            {preview?.type === 'txt' && (
              <pre className="p-4 text-xs text-gray-700 font-mono overflow-auto h-full whitespace-pre-wrap leading-relaxed">
                {preview.content}
              </pre>
            )}
            {preview?.type === 'docx' && (
              <div
                className="p-4 text-sm text-gray-700 overflow-auto h-full prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            )}
            {preview?.type === 'error' && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <svg className="w-8 h-8 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-500">Preview not available</p>
                <p className="text-xs text-gray-400 mt-1">Delete this document and re-upload it to restore preview.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Document selector */}
        {readyDocs.length > 0 && (
          <div className="px-4 py-2.5 bg-white border-b border-gray-200 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-400 font-medium shrink-0">
              {selectedDocs.size === 0 ? 'All docs' : `${selectedDocs.size} selected`}
            </span>
            {readyDocs.map(doc => {
              const isSelected = selectedDocs.has(doc.id)
              const isPreviewing = previewDoc?.id === doc.id
              return (
                <div key={doc.id} className="flex items-center gap-1.5 text-xs text-gray-600 select-none">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleDoc(doc.id)}
                    className="accent-indigo-600 cursor-pointer"
                  />
                  <button
                    onClick={() => {
                      if (!isSelected) {
                        setSelectedDocs(prev => { const n = new Set(prev); n.add(doc.id); return n })
                      }
                      setPinnedPreviewId(doc.id)
                    }}
                    title={isSelected ? 'Click to preview this document' : 'Select and preview'}
                    className={`truncate max-w-40 text-left transition-colors ${
                      isPreviewing
                        ? 'text-indigo-600 font-medium underline underline-offset-2'
                        : 'hover:text-indigo-500'
                    }`}
                  >
                    {doc.filename}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-10 h-10 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-sm text-gray-400">Ask a question about your documents.</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="space-y-1.5 mt-1 max-w-[85%]">
                    {msg.sources.slice(0, 3).map(s => (
                      <div key={s.chunk_id} className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                        <p className="font-medium text-gray-500 mb-0.5">
                          📄 {s.filename} — page {s.page_number}
                        </p>
                        <p className="italic text-gray-400 line-clamp-2">
                          "{s.content.trim().slice(0, 200)}{s.content.length > 200 ? '…' : ''}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {ask.isPending && (
            <div className="flex items-start">
              <div className="bg-white border border-gray-200 text-gray-500 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm shadow-sm flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 bg-white border-t border-gray-200 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents…"
            className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={ask.isPending || !input.trim()}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors min-w-[72px] flex items-center justify-center"
          >
            {ask.isPending ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
