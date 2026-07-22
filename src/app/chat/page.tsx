'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { DEFAULT_AVATAR } from '@/lib/constants'
import './chat.css'

interface ConversationItem {
  id: string
  name: string
  photoUrl: string
  campus: string | null
  course: string | null
  age: number | null
  lastMessage: string
  lastMessageAt: string | null
  unreadCount: number
  online: boolean
  otherUserId: string
}

function ChatHubContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const matchId = searchParams.get('matchId')
  const supabase = createClient()

  // State
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Active Chat State
  const [activeMatch, setActiveMatch] = useState<ConversationItem | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)

  // Menu & Report Modal State
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportReason, setReportReason] = useState('Harassment')
  const [reportDetails, setReportDetails] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Prefill message input if prefill search param exists
  useEffect(() => {
    const prefill = searchParams.get('prefill')
    if (prefill) {
      setInputText(prefill)
    }
  }, [searchParams])

  // 1. Authenticate user
  useEffect(() => {
    async function checkAuth() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single() as any

      setCurrentUser({ ...user, ...(profile || {}) })
      fetchConversations(user.id)
    }

    checkAuth()
  }, [router, supabase])

  // 2. Fetch Conversations List
  const fetchConversations = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, p1:profiles!matches_user1_id_fkey(*), p2:profiles!matches_user2_id_fkey(*)')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false }) as any

      if (error) throw error

      if (data) {
        const mapped: ConversationItem[] = data.map((m: any) => {
          const isUser1 = m.user1_id === userId
          const other = isUser1 ? m.p2 : m.p1
          const unread = isUser1 ? (m.user1_unread || 0) : (m.user2_unread || 0)

          return {
            id: m.id,
            name: other?.name || 'Match',
            photoUrl: other?.photo_url || DEFAULT_AVATAR,
            campus: other?.campus || null,
            course: other?.course || null,
            age: other?.age || null,
            lastMessage: m.last_message || 'Say hello 👋',
            lastMessageAt: m.last_message_at || m.created_at,
            unreadCount: unread,
            online: Boolean(other?.online),
            otherUserId: other?.id || ''
          }
        })

        mapped.sort((a, b) => {
          const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
          const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
          return tB - tA
        })

        setConversations(mapped)
      }
    } catch (e) {
      console.warn("Error fetching conversations:", e)
    } finally {
      setConversationsLoading(false)
    }
  }

  // 3. Realtime subscription for Matches List updates
  useEffect(() => {
    if (!currentUser) return

    const channel = supabase
      .channel(`matches_list_realtime_${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `user1_id=eq.${currentUser.id}` },
        () => fetchConversations(currentUser.id)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `user2_id=eq.${currentUser.id}` },
        () => fetchConversations(currentUser.id)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, supabase])

  // 4. Load Active Conversation thread when matchId changes
  useEffect(() => {
    if (!currentUser) return

    if (!matchId) {
      setActiveMatch(null)
      setMessages([])
      return
    }

    const found = conversations.find(c => c.id === matchId)
    if (found) {
      setActiveMatch(found)
    }

    async function loadThread() {
      setMessagesLoading(true)

      // Mark unread as zero
      try {
        const { data: mData } = await supabase
          .from('matches')
          .select('user1_id, user2_id')
          .eq('id', matchId)
          .single() as any

        if (mData) {
          const isUser1 = mData.user1_id === currentUser.id
          await supabase
            .from('matches')
            .update(isUser1 ? { user1_unread: 0 } : { user2_unread: 0 })
            .eq('id', matchId)
        }
      } catch (e) {
        console.warn("Mark read error:", e)
      }

      // Fetch messages
      try {
        const { data: msgData } = await supabase
          .from('messages')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: true }) as any

        setMessages(msgData || [])
      } catch (e) {
        console.warn("Error loading messages:", e)
      } finally {
        setMessagesLoading(false)
        scrollToBottom()
      }
    }

    loadThread()
  }, [matchId, currentUser, supabase, conversations])

  // 5. Realtime subscription for Active Thread Messages
  useEffect(() => {
    if (!matchId || !currentUser) return

    const msgChannel = supabase
      .channel(`messages_thread_${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        payload => {
          const newMsg = payload.new
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          scrollToBottom()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(msgChannel)
    }
  }, [matchId, currentUser, supabase])

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // Handle Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputText.trim() || !matchId || !currentUser || sending) return

    const content = inputText.trim()
    setInputText('')
    setSending(true)

    try {
      // Insert message
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          match_id: matchId,
          sender_id: currentUser.id,
          content,
          type: 'text',
          created_at: new Date().toISOString()
        })
        .select()
        .single() as any

      if (error) throw error

      if (newMsg) {
        setMessages(prev => [...prev, newMsg])
        scrollToBottom()
      }

      // Update match row last message & unread
      const { data: matchRow } = await supabase
        .from('matches')
        .select('user1_id, user2_id, user1_unread, user2_unread')
        .eq('id', matchId)
        .single() as any

      if (matchRow) {
        const isUser1 = matchRow.user1_id === currentUser.id
        const updateData = isUser1
          ? { last_message: content, last_message_at: new Date().toISOString(), user2_unread: (matchRow.user2_unread || 0) + 1 }
          : { last_message: content, last_message_at: new Date().toISOString(), user1_unread: (matchRow.user1_unread || 0) + 1 }

        await supabase.from('matches').update(updateData).eq('id', matchId)
      }
    } catch (err) {
      console.error("Send message failed:", err)
    } finally {
      setSending(false)
    }
  }

  // Block User Action
  const handleBlockUser = async () => {
    if (!currentUser || !activeMatch) return
    setIsMenuOpen(false)

    const confirmed = window.confirm(`Are you sure you want to block ${activeMatch.name}? You will no longer see each other or be able to message.`)
    if (!confirmed) return

    try {
      const { error } = await (supabase.from('blocked_users') as any).insert({
        blocker_id: currentUser.id,
        blocked_id: activeMatch.otherUserId
      })

      if (error) {
        console.error("Block user error:", error)
        alert("Failed to block user. Please try again.")
        return
      }

      alert(`${activeMatch.name} has been blocked.`)
      router.push('/matches')
    } catch (e) {
      console.error("Block user failed:", e)
      alert("Failed to block user. Please try again.")
    }
  }

  // Report User Submission
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !activeMatch) return

    setSubmittingReport(true)

    try {
      const { error } = await (supabase.from('reports') as any).insert({
        reporter_id: currentUser.id,
        reported_id: activeMatch.otherUserId,
        reason: reportReason,
        details: reportDetails.trim(),
        status: 'pending'
      })

      if (error) {
        console.error("Report submit error:", error)
        alert("Failed to submit report. Please try again.")
        return
      }

      alert("Thank you. Your report has been submitted for review.")
      setReportModalOpen(false)
      setReportDetails('')
    } catch (e) {
      console.error("Report submit error:", e)
      alert("Failed to submit report. Please try again.")
    } finally {
      setSubmittingReport(false)
    }
  }

  const relativeTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const diff = (Date.now() - date.getTime()) / 1000
    if (diff < 60) return "Just now"
    if (diff < 3600) return `${Math.floor(diff / 60)}h`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return `${Math.floor(diff / 86400)}d`
  }

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.course && c.course.toLowerCase().includes(q)) ||
      (c.campus && c.campus.toLowerCase().includes(q))
    )
  })

  // Case 1: Active Chat Thread View
  if (matchId && activeMatch) {
    return (
      <div className="chat-page">
        {/* Thread Header */}
        <nav className="chat-header">
          <div className="chat-header-left">
            <button
              className="back-btn"
              onClick={() => router.push('/chat')}
              title="Back to conversations"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>

            <div className="user-profile">
              <img src={activeMatch.photoUrl} alt={activeMatch.name} className="chat-avatar" />
              <div className="chat-header-info">
                <h3>{activeMatch.name}</h3>
                <p className="status">
                  {activeMatch.online ? '🟢 Online' : [activeMatch.course, activeMatch.campus].filter(Boolean).join(' • ') || 'UniMatch student'}
                </p>
              </div>
            </div>
          </div>

          <div className="chat-header-right" style={{ position: 'relative' }}>
            <button
              className="more-btn"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="More options"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2.2"/>
                <circle cx="12" cy="12" r="2.2"/>
                <circle cx="12" cy="19" r="2.2"/>
              </svg>
            </button>

            {isMenuOpen && (
              <div className="chat-menu">
                <button
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false)
                    setReportModalOpen(true)
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
                  </svg>
                  <span>Report User</span>
                </button>

                <button
                  className="menu-item danger"
                  onClick={handleBlockUser}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                  <span>Block User</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Thread Messages */}
        <div className="messages-container">
          {messagesLoading ? (
            <div className="chat-empty-thread">
              <p>Loading messages thread…</p>
            </div>
          ) : messages.length > 0 ? (
            messages.map(m => {
              const isSent = m.sender_id === currentUser?.id
              return (
                <div
                  key={m.id}
                  className={`message-bubble ${isSent ? 'sent' : 'received'}`}
                >
                  <div>{m.content}</div>
                  <div className="message-time">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="chat-empty-thread">
              <span style={{ fontSize: '42px' }}>👋</span>
              <h4 style={{ color: 'white', margin: '8px 0 4px' }}>Say hello to {activeMatch.name}!</h4>
              <p style={{ color: '#8b7fa8', fontSize: '13px' }}>Break the ice and start your conversation</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form className="chat-input-area" onSubmit={handleSendMessage}>
          <input
            type="text"
            className="chat-input-field"
            placeholder={`Message ${activeMatch.name}…`}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
          <button type="submit" className="btn-send" disabled={!inputText.trim() || sending}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>

        <BottomNav activeTab="chat" />
      </div>
    )
  }

  // Case 2: Conversations List View (Landing Page)
  return (
    <div className="chat-page">
      {/* Top Navbar */}
      <nav className="app-topnav">
        <div className="topnav-logo">
          <div className="logo-mark">U</div>
          <span className="logo-text">UniMatch</span>
        </div>
      </nav>

      {/* Messaging Header (Messages / Requests) */}
      <div className="chat-hub-header">
        <span className="chat-hub-title">Messages</span>
        <span className="chat-hub-requests">Requests</span>
      </div>

      {/* Search Field */}
      {conversations.length > 0 && (
        <div className="chat-search-wrap">
          <div className="chat-search-box">
            <svg className="chat-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="chat-search-input"
              placeholder="Search chats…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="chat-list-container">
        {conversationsLoading ? (
          <div className="chat-empty-hub">
            <p>Loading messages…</p>
          </div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map(c => (
            <Link
              key={c.id}
              href={`/chat?matchId=${c.id}`}
              className={`chat-list-row ${c.unreadCount > 0 ? 'unread' : ''}`}
            >
              <div className="chat-row-avatar-wrap">
                <img src={c.photoUrl} alt={c.name} className="chat-row-avatar" />
                {c.online && <div className="chat-row-online"></div>}
              </div>

              <div className="chat-row-info">
                <div className="chat-row-name">{c.name}</div>
                <div className="chat-row-preview">
                  {c.lastMessage} · {relativeTime(c.lastMessageAt)}
                </div>
              </div>

              {c.unreadCount > 0 && (
                <span className="chat-row-unread-badge">{c.unreadCount}</span>
              )}
            </Link>
          ))
        ) : (
          <div className="chat-empty-hub">
            <span className="chat-empty-icon">💬</span>
            <div className="chat-empty-title">No messages yet</div>
            <p style={{ fontSize: '13px', margin: '4px 0 12px' }}>Start swiping to find new matches and strike up a conversation!</p>
            <Link href="/discover" className="btn-conv-discover">Start Discovering</Link>
          </div>
        )}
      </div>

      <BottomNav activeTab="chat" />

      {/* Report User Modal */}
      {reportModalOpen && (
        <div className="report-modal-overlay" onClick={() => setReportModalOpen(false)}>
          <div className="report-modal-card" onClick={e => e.stopPropagation()}>
            <div className="report-modal-header">
              <h3>Report {activeMatch?.name || 'User'}</h3>
              <button className="report-modal-close" onClick={() => setReportModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmitReport} className="report-modal-form">
              <label className="report-label">Reason for reporting</label>
              <select
                className="report-select"
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
              >
                <option value="Harassment">Harassment / Bullying</option>
                <option value="Fake Profile">Fake Profile / Impersonation</option>
                <option value="Inappropriate Content">Inappropriate Content</option>
                <option value="Spam">Spam / Commercial</option>
                <option value="Other">Other</option>
              </select>

              <label className="report-label">Additional details (optional)</label>
              <textarea
                className="report-textarea"
                rows={4}
                placeholder="Describe what happened..."
                value={reportDetails}
                onChange={e => setReportDetails(e.target.value)}
              />

              <div className="report-modal-actions">
                <button
                  type="button"
                  className="btn-report-cancel"
                  onClick={() => setReportModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-report-submit"
                  disabled={submittingReport}
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="chat-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#8b7fa8' }}>
        <p>Loading chat center…</p>
      </div>
    }>
      <ChatHubContent />
    </Suspense>
  )
}
