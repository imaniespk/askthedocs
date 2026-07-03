import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import HomePage from './pages/HomePage'
import DocumentsPage from './pages/DocumentsPage'
import ChatPage from './pages/ChatPage'

function Nav() {
  const location = useLocation()
  const base = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors'
  const active = 'bg-indigo-600 text-white'
  const inactive = 'text-gray-600 hover:bg-gray-100'

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
      <Link to="/" className="font-bold text-gray-900 mr-4 hover:text-indigo-600 transition-colors">
        AskTheDocs
      </Link>
      <Link to="/documents" className={`${base} ${location.pathname === '/documents' ? active : inactive}`}>
        Documents
      </Link>
      <Link to="/chat" className={`${base} ${location.pathname === '/chat' ? active : inactive}`}>
        Chat
      </Link>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/chat" element={<ChatPage />} />
          </Routes>
        </main>
        <Toaster position="bottom-right" toastOptions={{ duration: 3000 }} />
      </div>
    </BrowserRouter>
  )
}
