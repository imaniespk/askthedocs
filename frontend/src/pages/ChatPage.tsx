import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'

const API = 'http://localhost:8000'

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

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => axios.get(`${API}/documents/`).then(r => r.data),
  })

  const readyDocs = documents.filter(d => d.status === 'ready')

  const ask = useMutation({
    mutationFn: async (question: string) => {
      let convId = conversationId
      if (!convId) {
        const res = await axios.post(`${API}/conversations/`)
        convId = res.data.id
        setConversationId(convId)
      }
      const body: { question: string; document_ids?: string[] } = { question }
      if (selectedDocs.size > 0) body.document_ids = Array.from(selectedDocs)
      const res = await axios.post(`${API}/conversations/${convId}/messages`, body)
      return res.data
    },
    onSuccess: data => {
      setMessages(prev => [
        ...prev,
        { id: data.id, role: 'assistant', text: data.content, sources: data.sources },
      ])
    },
  })

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
    <div className="max-w-3xl mx-auto p-8 flex flex-col h-[calc(100vh-64px)]">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Chat</h1>

      {readyDocs.length > 0 && (
        <div className="mb-4 p-3 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 font-medium mb-2">
            {selectedDocs.size === 0
              ? 'Searching all documents'
              : `Searching ${selectedDocs.size} selected document${selectedDocs.size > 1 ? 's' : ''}`}
          </p>
          <div className="flex flex-wrap gap-3">
            {readyDocs.map(doc => (
              <label key={doc.id} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedDocs.has(doc.id)}
                  onChange={() => toggleDoc(doc.id)}
                  className="accent-indigo-600"
                />
                <span className="truncate max-w-xs">{doc.filename}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-4">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-sm">Ask a question to get started.</p>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[80%] ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}
              >
                {msg.text}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="space-y-2 mt-1 max-w-[80%]">
                  {msg.sources.slice(0, 3).map(s => (
                    <div key={s.chunk_id} className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      <p className="font-medium text-gray-500 mb-1">
                        📄 {s.filename} — page {s.page_number}
                      </p>
                      <p className="italic text-gray-400 line-clamp-3">
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
            <div className="bg-gray-100 text-gray-500 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents..."
          className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleSend}
          disabled={ask.isPending || !input.trim()}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors min-w-[80px] flex items-center justify-center"
        >
          {ask.isPending ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  )
}
