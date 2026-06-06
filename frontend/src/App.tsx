import { useState } from 'react'
import DocumentsPage from './pages/DocumentsPage'
import ChatPage from './pages/ChatPage'

type Tab = 'documents' | 'chat'

export default function App() {
  const [tab, setTab] = useState<Tab>('documents')

  const base = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors'
  const active = 'bg-indigo-600 text-white'
  const inactive = 'text-gray-600 hover:bg-gray-100'

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <span className="font-bold text-gray-900 mr-4">AskTheDocs</span>
        <button
          className={`${base} ${tab === 'documents' ? active : inactive}`}
          onClick={() => setTab('documents')}
        >
          Documents
        </button>
        <button
          className={`${base} ${tab === 'chat' ? active : inactive}`}
          onClick={() => setTab('chat')}
        >
          Chat
        </button>
      </nav>

      <main>{tab === 'documents' ? <DocumentsPage /> : <ChatPage />}</main>
    </div>
  )
}
