import { useState } from 'react'

type Message = {
  id: string
  text: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')

  function handleSend() {
    const text = input.trim()
    if (!text) return

    console.log('Sending message:', text)
    setMessages(prev => [...prev, { id: crypto.randomUUID(), text }])
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <div className="max-w-3xl mx-auto p-8 flex flex-col h-[calc(100vh-64px)]">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Chat</h1>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 p-4 mb-4">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-sm">Ask a question to get started.</p>
        ) : (
          <ul className="space-y-3">
            {messages.map(msg => (
              <li key={msg.id} className="text-sm text-gray-900 bg-gray-100 rounded-lg px-3 py-2 inline-block">
                {msg.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents..."
          className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleSend}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
