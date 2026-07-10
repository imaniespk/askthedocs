import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import HomePage from './pages/HomePage'
import DocumentsPage from './pages/DocumentsPage'
import ChatPage from './pages/ChatPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AboutPage from './pages/AboutPage'
import PricingPage from './pages/PricingPage'

function Nav() {
  const location = useLocation()
  const navigate = useNavigate()
  const base = 'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors'
  const active = 'bg-indigo-600 text-white'
  const inactive = 'text-gray-600 hover:bg-gray-100'
  const isLoggedIn = Boolean(localStorage.getItem('token'))

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2">
      <Link to="/" className="flex items-center gap-2 font-bold text-gray-900 mr-3 hover:text-indigo-600 transition-colors">
        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        AskTheDocs
      </Link>
      <Link to="/documents" className={`${base} ${location.pathname === '/documents' ? active : inactive}`}>
        Documents
      </Link>
      <Link to="/chat" className={`${base} ${location.pathname === '/chat' ? active : inactive}`}>
        Chat
      </Link>
      <Link to="/pricing" className={`${base} ${location.pathname === '/pricing' ? active : inactive}`}>
        Pricing
      </Link>
      <Link to="/about" className={`${base} ${location.pathname === '/about' ? active : inactive}`}>
        About
      </Link>
      <div className="ml-auto flex items-center gap-2">
        {isLoggedIn ? (
          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Log out
          </button>
        ) : (
          <>
            <Link to="/login" className={`${base} ${location.pathname === '/login' ? active : inactive}`}>
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" state={{ reason: 'auth' }} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        <Nav />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/documents" element={<PrivateRoute><DocumentsPage /></PrivateRoute>} />
            <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/pricing" element={<PricingPage />} />
          </Routes>
        </main>
        <Toaster position="bottom-right" toastOptions={{ duration: 3000 }} />
      </div>
    </BrowserRouter>
  )
}
