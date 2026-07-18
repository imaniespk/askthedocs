import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import client, { API } from '../api/client'

type Stats = {
  documents_uploaded: number
  questions_asked: number
  total_chunks: number
  conversations: number
}

type StatCardProps = {
  label: string
  value: number
  icon: React.ReactNode
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const isLoggedIn = Boolean(localStorage.getItem('token'))

  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => client.get(`${API}/auth/me/stats`).then(r => r.data),
    enabled: isLoggedIn,
  })

  return (
    <div className="max-w-2xl mx-auto px-8 py-16 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">AskTheDocs</h1>
      <p className="text-lg text-gray-500 mb-3 leading-relaxed">
        Upload your documents — PDFs, Word files, or plain text — and ask questions in plain English.
      </p>
      <p className="text-base text-gray-400 mb-10">
        Answers are grounded in your documents with citations pointing back to the exact page and paragraph.
      </p>
      <div className="flex justify-center gap-4 mb-12">
        <button
          onClick={() => navigate('/documents')}
          className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Get Started
        </button>
        <button
          onClick={() => navigate('/chat')}
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
        >
          Go to Chat
        </button>
      </div>

      {isLoggedIn && stats && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Your stats</p>
          <div className="grid grid-cols-2 gap-3 text-left">
            <StatCard
              label="Documents uploaded"
              value={stats.documents_uploaded}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
            <StatCard
              label="Questions asked"
              value={stats.questions_asked}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              }
            />
            <StatCard
              label="Text chunks indexed"
              value={stats.total_chunks}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8" />
                </svg>
              }
            />
            <StatCard
              label="Conversations"
              value={stats.conversations}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
