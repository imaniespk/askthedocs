import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import client from '../api/client'

const API = 'http://localhost:8000'
const ACCEPTED = ['.pdf', '.docx', '.txt']

type Document = {
  id: string
  filename: string
  size_bytes: number
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
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => client.get(`${API}/documents/`).then(r => r.data),
    refetchInterval: 5000,
  })

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return client.post(`${API}/documents/`, form)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document uploaded successfully!')
    },
    onError: (err: unknown) => {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? err.response.data.detail
          : 'Upload failed. Please try again.'
      toast.error(msg)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => client.delete(`${API}/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document deleted.')
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      toast.error('Only PDF, DOCX, and TXT files are supported.')
      e.target.value = ''
      return
    }
    upload.mutate(file)
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
          {upload.isPending ? 'Uploading…' : 'Upload File'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {documents.some(d => d.status === 'ready') && (
        <div className="mb-5 flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
          <p className="text-sm text-indigo-700">
            {documents.filter(d => d.status === 'ready').length} document{documents.filter(d => d.status === 'ready').length > 1 ? 's' : ''} ready — start asking questions.
          </p>
          <button
            onClick={() => navigate('/chat')}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            Go to Chat →
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="text-gray-400 text-sm">No documents yet. Upload a PDF, DOCX, or TXT to get started.</p>
      ) : (
        <ul className="divide-y divide-gray-200 bg-white rounded-xl border border-gray-200">
          {documents.map(doc => (
            <li key={doc.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                <p className="text-xs text-gray-400">{formatSize(doc.size_bytes)}</p>
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
