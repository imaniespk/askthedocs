import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const API = 'http://localhost:8000'

type Document = {
  id: string
  filename: string
  size: number
  status: 'pending' | 'processing' | 'ready' | 'error'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const badgeStyle: Record<Document['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
}

export default function DocumentsPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => axios.get(`${API}/documents/`).then(r => r.data),
    refetchInterval: 5000,
  })

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return axios.post(`${API}/documents/`, form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => axios.delete(`${API}/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload.mutate(file)
    e.target.value = ''
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {upload.isPending ? 'Uploading…' : 'Upload PDF'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {upload.isError && (
        <p className="text-red-600 text-sm mb-4">Upload failed. Please try again.</p>
      )}

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="text-gray-400 text-sm">No documents yet. Upload a PDF to get started.</p>
      ) : (
        <ul className="divide-y divide-gray-200 bg-white rounded-xl border border-gray-200">
          {documents.map(doc => (
            <li key={doc.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                <p className="text-xs text-gray-400">{formatSize(doc.size)}</p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${badgeStyle[doc.status]}`}>
                  {doc.status}
                </span>
                <button
                  onClick={() => remove.mutate(doc.id)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
