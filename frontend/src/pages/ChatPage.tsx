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
  const [preview, setPreview] = useState<PreviewState | null>(null)
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

  // Update previewDoc when selectedDocs changes
  useEffect(() => {
    const firstId = Array.from(selectedDocs)[0]
    const doc = readyDocs.find(d => d.id === firstId) ?? null
    setPreviewDoc(doc)
  }, [selectedDocs, documents])

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

    client
      .get(`${API}/documents/${previewDoc.id}/file`, { responseType: ext === 'pdf' ? 'blob' : 'text' })
      .then(res => {
        if (ext === 'pdf') {
          const url = URL.createObjectURL(res.data)
          pdfBlobRef.current = url
          setPreview({ type: 'pdf', url })
        } else if (ext === 'docx') {
          const clean = DOMPurify.sanitize(res.data as string)
          setPreview({ type: 'docx', html: clean })
        } else {
          setPreview({ type: 'txt', content: res.data as string })
        }
      })
      .catch(() => setPreview({ type: 'error' }))

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
        setConversations(prev => [res.data, ...prev])
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
              <button
                key={conv.id}
                onClick={() => switchConversation(conv.id)}
                className={`w-full text-left px-3 py-2 text-xs truncate transition-colors ${
                  conv.id === conversationId
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {conv.title ?? `Chat ${new Date(conv.created_at).toLocaleDateString()}`}
              </button>
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
                <p className="text-xs text-gray-400 mt-1">File serving endpoint not yet enabled</p>
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
            <span className="text-xs text-gray-400 font-medium flex-shrink-0">
              {selectedDocs.size === 0 ? 'All docs' : `${selectedDocs.size} selected`}
            </span>
            {readyDocs.map(doc => (
              <label key={doc.id} className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedDocs.has(doc.id)}
                  onChange={() => toggleDoc(doc.id)}
                  className="accent-indigo-600"
                />
                <span className="truncate max-w-[160px]">{doc.filename}</span>
              </label>
            ))}
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
