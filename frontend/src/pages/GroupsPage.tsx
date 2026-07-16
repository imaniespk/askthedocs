import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import axios from 'axios'
import client, { API } from '../api/client'

type Group = {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

type Member = {
  user_id: string
  email: string
  role: string
  joined_at: string
}

type GroupDocument = {
  id: string
  filename: string
  size_bytes: number
  status: string
  owner_email: string
}

type MyDocument = {
  id: string
  filename: string
  status: string
}

function getUserId(): string | null {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    return JSON.parse(atob(token.split('.')[1])).sub
  } catch {
    return null
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type GroupDetailProps = {
  group: Group
  myDocs: MyDocument[]
  currentUserId: string | null
  onDelete: (id: string) => void
}

function GroupDetail({ group, myDocs, currentUserId, onDelete }: GroupDetailProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [groupDocs, setGroupDocs] = useState<GroupDocument[]>([])
  const [shareDocId, setShareDocId] = useState('')
  const [loadingDetails, setLoadingDetails] = useState(true)
  const isOwner = currentUserId === group.created_by

  useEffect(() => {
    const load = async () => {
      setLoadingDetails(true)
      try {
        const [memRes, docRes] = await Promise.all([
          client.get(`${API}/groups/${group.id}/members`),
          client.get(`${API}/groups/${group.id}/documents`),
        ])
        setMembers(memRes.data)
        setGroupDocs(docRes.data)
      } catch {
        toast.error('Failed to load group details.')
      } finally {
        setLoadingDetails(false)
      }
    }
    load()
  }, [group.id])

  async function handleShare() {
    if (!shareDocId) return
    try {
      await client.post(`${API}/groups/${group.id}/documents/${shareDocId}`)
      const doc = myDocs.find(d => d.id === shareDocId)
      toast.success(`Shared "${doc?.filename}" with the group.`)
      const res = await client.get(`${API}/groups/${group.id}/documents`)
      setGroupDocs(res.data)
      setShareDocId('')
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        toast.error(err.response.data.detail)
      } else {
        toast.error('Failed to share document.')
      }
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-4">
      {loadingDetails ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <>
          {/* Members */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Members ({members.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <span
                  key={m.user_id}
                  className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${m.role === 'owner' ? 'bg-indigo-500' : 'bg-gray-400'}`} />
                  <span className="text-gray-700">{m.email}</span>
                  {m.role === 'owner' && <span className="text-indigo-500 font-medium">owner</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Shared documents */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Shared Documents ({groupDocs.length})
            </p>
            {groupDocs.length === 0 ? (
              <p className="text-xs text-gray-400">No documents shared yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {groupDocs.map(doc => (
                  <li key={doc.id} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-gray-800 font-medium">{doc.filename}</span>
                      <span className="text-gray-400 ml-2">{formatSize(doc.size_bytes)}</span>
                    </div>
                    <span className="text-gray-400">{doc.owner_email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Share a document */}
          {myDocs.filter(d => d.status === 'ready').length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={shareDocId}
                onChange={e => setShareDocId(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Share one of your documents…</option>
                {myDocs.filter(d => d.status === 'ready').map(d => (
                  <option key={d.id} value={d.id}>{d.filename}</option>
                ))}
              </select>
              <button
                onClick={handleShare}
                disabled={!shareDocId}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                Share
              </button>
            </div>
          )}

          {/* Delete group (owner only) */}
          {isOwner && (
            <div className="pt-1">
              <button
                onClick={() => {
                  if (confirm(`Delete group "${group.name}"? This cannot be undone.`)) {
                    onDelete(group.id)
                  }
                }}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                Delete group
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function GroupsPage() {
  const qc = useQueryClient()
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const currentUserId = getUserId()

  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => client.get(`${API}/groups/`).then(r => r.data),
  })

  const { data: myDocs = [] } = useQuery<MyDocument[]>({
    queryKey: ['documents'],
    queryFn: () => client.get(`${API}/documents/`).then(r => r.data),
  })

  const createGroup = useMutation({
    mutationFn: (name: string) => client.post(`${API}/groups/`, { name }),
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      setNewInviteCode(res.data.invite_code)
      setCreateName('')
      toast.success(`Group created!`)
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        toast.error(err.response.data.detail)
      } else {
        toast.error('Failed to create group.')
      }
    },
  })

  const joinGroup = useMutation({
    mutationFn: (code: string) =>
      client.post(`${API}/groups/join?invite_code=${encodeURIComponent(code.trim().toUpperCase())}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      setJoinCode('')
      toast.success('Joined group!')
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        toast.error(err.response.data.detail)
      } else {
        toast.error('Invalid invite code.')
      }
    },
  })

  const deleteGroup = useMutation({
    mutationFn: (id: string) => client.delete(`${API}/groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      setExpandedId(null)
      toast.success('Group deleted.')
    },
  })

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Groups</h1>

      {/* Create + Join forms */}
      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        {/* Create */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Create a group</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createName.trim() && createGroup.mutate(createName.trim())}
              placeholder="Group name"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => createName.trim() && createGroup.mutate(createName.trim())}
              disabled={createGroup.isPending || !createName.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {createGroup.isPending ? '…' : 'Create'}
            </button>
          </div>
          {newInviteCode && (
            <div className="mt-3 flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              <p className="text-xs text-indigo-700 flex-1">
                Invite code: <span className="font-bold font-mono tracking-widest">{newInviteCode}</span>
              </p>
              <button
                onClick={() => { navigator.clipboard.writeText(newInviteCode); toast.success('Copied!') }}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Join */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Join a group</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinCode.trim() && joinGroup.mutate(joinCode)}
              placeholder="Invite code"
              maxLength={6}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest uppercase"
            />
            <button
              onClick={() => joinCode.trim() && joinGroup.mutate(joinCode)}
              disabled={joinGroup.isPending || !joinCode.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {joinGroup.isPending ? '…' : 'Join'}
            </button>
          </div>
        </div>
      </div>

      {/* Groups list */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Your Groups
      </h2>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-400">
          You're not in any groups yet. Create one or join with an invite code.
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map(group => (
            <li key={group.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{group.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Invite code:{' '}
                    <span className="font-mono font-medium text-gray-600 tracking-widest">
                      {group.invite_code}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(group.invite_code); toast.success('Copied!') }}
                      className="ml-2 text-indigo-500 hover:text-indigo-700"
                    >
                      Copy
                    </button>
                  </p>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
                  className="ml-4 text-xs text-indigo-600 hover:text-indigo-700 font-medium flex-shrink-0"
                >
                  {expandedId === group.id ? 'Collapse' : 'View details'}
                </button>
              </div>

              {expandedId === group.id && (
                <GroupDetail
                  group={group}
                  myDocs={myDocs}
                  currentUserId={currentUserId}
                  onDelete={id => deleteGroup.mutate(id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
