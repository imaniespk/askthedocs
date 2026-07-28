import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import client, { API } from '../api/client'
const ACCEPTED = ['.pdf', '.docx', '.txt']

type Document = {
  id: string
  filename: string
  size_bytes: number
  status: 'pending' | 'processing' | 'ready' | 'error'
}

type Group = {
  id: string
  name: string
}

type GroupDocument = {
  id: string
  filename: string
  size_bytes: number
  status: string
  owner_email: string
  group_name: string
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
  const [search, setSearch] = useState('')

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: () => client.get(`${API}/documents/`).then(r => r.data),
    refetchInterval: 5000,
  })

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => client.get(`${API}/groups/`).then(r => r.data),
  })

  const { data: sharedDocs = [] } = useQuery<GroupDocument[]>({
    queryKey: ['group-docs', groups.map(g => g.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        groups.map(g =>
          client.get(`${API}/groups/${g.id}/documents`).then(r =>
            r.data.map((doc: Omit<GroupDocument, 'group_name'>) => ({ ...doc, group_name: g.name }))
          )
        )
      )
      return results.flat()
    },
    enabled: groups.length > 0,
  })

  // Map: docId → list of groups it's shared in
  const docGroupMap = new Map<string, { groupName: string; ownerEmail: string }[]>()
  for (const gd of sharedDocs) {
    if (!docGroupMap.has(gd.id)) docGroupMap.set(gd.id, [])
    docGroupMap.get(gd.id)!.push({ groupName: gd.group_name, ownerEmail: gd.owner_email })
  }

  // Docs from other members (not owned by current user)
  const myDocIds = new Set(documents.map(d => d.id))
  const filteredSharedDocs = sharedDocs
    .filter(d => !myDocIds.has(d.id))
    .filter(d => d.filename.toLowerCase().includes(search.toLowerCase()))

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

      {!isLoading && documents.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="text-gray-400 text-sm">No documents yet. Upload a PDF, DOCX, or TXT to get started.</p>
      ) : (
        <ul className="divide-y divide-gray-200 bg-white rounded-xl border border-gray-200">
          {documents.filter(doc => doc.filename.toLowerCase().includes(search.toLowerCase())).map(doc => (
            <li key={doc.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-xs text-gray-400">{formatSize(doc.size_bytes)}</span>
                  {docGroupMap.get(doc.id)?.map(({ groupName, ownerEmail }) => (
                    <span key={groupName} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                      {groupName} · {ownerEmail.split('@')[0]}
                    </span>
                  ))}
                </div>
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

      {filteredSharedDocs.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Shared via groups</p>
          <ul className="divide-y divide-gray-200 bg-white rounded-xl border border-gray-200">
            {filteredSharedDocs.map((doc, i) => (
              <li key={`${doc.id}-${i}`} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-medium">
                      {doc.group_name}
                    </span>
                    <span className="text-xs text-gray-400">{doc.owner_email.split('@')[0]}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{formatSize(doc.size_bytes)}</span>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ml-4 ${badgeStyle[doc.status as Document['status']] ?? 'bg-gray-100 text-gray-600'}`}>
                  {doc.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
