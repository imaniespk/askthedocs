import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl mx-auto px-8 py-24 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">AskTheDocs</h1>
      <p className="text-lg text-gray-500 mb-3 leading-relaxed">
        Upload your documents — PDFs, Word files, or plain text — and ask questions in plain English.
      </p>
      <p className="text-base text-gray-400 mb-10">
        Answers are grounded in your documents with citations pointing back to the exact page and paragraph.
      </p>
      <div className="flex justify-center gap-4">
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
    </div>
  )
}
