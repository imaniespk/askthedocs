export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-8 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">About</h1>
      <p className="text-gray-500 mb-10">
        AskTheDocs is a Retrieval-Augmented Generation (RAG) document Q&amp;A application built
        for CEG 7370 Distributed Computing at Wright State University, Summer 2026.
      </p>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">Team</h2>
      <div className="grid gap-4 sm:grid-cols-2 mb-12">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-semibold text-gray-900">Manish Sapkota</p>
          <p className="text-sm text-indigo-600 mt-0.5">Backend Developer</p>
          <p className="text-sm text-gray-500 mt-2">
            FastAPI, PostgreSQL, pgvector, RAG pipeline, OpenAI embeddings &amp; GPT-4o-mini
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-semibold text-gray-900">Sushan Paudel</p>
          <p className="text-sm text-indigo-600 mt-0.5">Frontend Developer</p>
          <p className="text-sm text-gray-500 mt-2">
            React, TypeScript, Vite, Tailwind CSS, TanStack Query, chat UI &amp; document management
          </p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">How it works</h2>
      <ol className="space-y-3 text-sm text-gray-600">
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs">1</span>
          <span>Upload a PDF, Word document, or plain text file.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs">2</span>
          <span>The backend splits the document into chunks and generates embeddings using OpenAI's text-embedding-3-small model, stored in pgvector.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs">3</span>
          <span>Ask a question in plain English. Your question is embedded and compared against stored chunks via cosine similarity.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs">4</span>
          <span>The top matching chunks are sent to GPT-4o-mini, which generates a grounded answer with source citations.</span>
        </li>
      </ol>

      <div className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-400">
        Wright State University · CEG 7370 Distributed Computing · Summer 2026
      </div>
    </div>
  )
}
