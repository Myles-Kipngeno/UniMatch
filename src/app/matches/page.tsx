'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { DEFAULT_AVATAR } from '@/lib/constants'
import './matches.css'

interface MatchItem {
  id: string
  name: string
  age: number | null
  photoUrl: string
  campus: string | null
  course: string | null
  lastMessage: string
  lastMessageAt: string | null
  unreadCount: number
  online: boolean
}

export default function MatchesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [uid, setUid] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch matches from Supabase
  const fetchMatches = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, p1:profiles!matches_user1_id_fkey(*), p2:profiles!matches_user2_id_fkey(*)')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false }) as any

      if (error) throw error

      if (data) {
        const mapped: MatchItem[] = data.map((m: any) => {
          const isUser1 = m.user1_id === userId
          const other = isUser1 ? m.p2 : m.p1
          const unread = isUser1 ? (m.user1_unread || 0) : (m.user2_unread || 0)

          return {
            id: m.id,
            name: other?.name || 'Match',
            age: other?.age || null,
            photoUrl: other?.photo_url || DEFAULT_AVATAR,
            campus: other?.campus || null,
            course: other?.course || null,
            lastMessage: m.last_message || 'New match! Say hello 👋',
            lastMessageAt: m.last_message_at || m.created_at,
            unreadCount: unread,
            online: Boolean(other?.online)
          }
        })

        // Sort by lastMessageAt descending
        mapped.sort((a, b) => {
          const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
          const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
          return tB - tA
        })

        setMatches(mapped)
      }
    } catch (e) {
      console.warn("Error fetching matches:", e)
    } finally {
      setLoading(false)
    }
  }

  // Initialize Auth & Data
  useEffect(() => {
    async function initMatches() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUid(user.id)
      await fetchMatches(user.id)
    }

    initMatches()
  }, [supabase, router])

  // Real-time changes subscription
  useEffect(() => {
    if (!uid) return

    const channel = supabase
      .channel(`matches_page_realtime_${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `user1_id=eq.${uid}` },
        () => fetchMatches(uid)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `user2_id=eq.${uid}` },
        () => fetchMatches(uid)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [uid, supabase])

  // Format relative timestamp
  const relativeTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const diff = (Date.now() - date.getTime()) / 1000
    if (diff < 60) return "Just now"
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  // Filtered matches list
  const filteredMatches = matches.filter(m => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      (m.course && m.course.toLowerCase().includes(q)) ||
      (m.campus && m.campus.toLowerCase().includes(q))
    )
  })

  return (
    <div className="matches-page">
      {/* Top Navbar */}
      <nav className="app-topnav">
        <div className="topnav-logo">
          <div className="logo-mark">U</div>
          <span className="logo-text">UniMatch</span>
        </div>
        <div className="topnav-actions">
          <Link href="/notifications" className="icon-btn" title="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </Link>
        </div>
      </nav>

      {/* Main Scrollable Body */}
      <main className="matches-scroll">
        <div className="matches-header">
          <div className="matches-header-top">
            <div className="matches-title-wrap">
              <h1 className="matches-title">Your Matches</h1>
              {!loading && (
                <span className="matches-count-badge">{matches.length}</span>
              )}
            </div>
          </div>

          {matches.length > 0 && (
            <div className="matches-search-wrap">
              <svg className="matches-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                className="matches-search-input"
                placeholder="Search matches by name or course…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="matches-loading">
            <div className="matches-spinner"></div>
            <p>Loading your connections…</p>
          </div>
        ) : filteredMatches.length > 0 ? (
          <div className="matches-list">
            {filteredMatches.map(m => (
              <Link
                key={m.id}
                href={`/chat?matchId=${m.id}`}
                className={`match-card ${m.unreadCount > 0 ? 'has-unread' : ''}`}
              >
                <div className="match-avatar-wrap">
                  <img src={m.photoUrl} alt={m.name} className="match-avatar" />
                  {m.online && <div className="match-online-dot"></div>}
                </div>

                <div className="match-info">
                  <div className="match-name-row">
                    <span className="match-name">{m.name}</span>
                    {m.age && <span className="match-age">, {m.age}</span>}
                  </div>

                  {(m.course || m.campus) && (
                    <div className="match-meta">
                      {[m.course, m.campus].filter(Boolean).join(' • ')}
                    </div>
                  )}

                  <div className="match-last-msg">{m.lastMessage}</div>
                </div>

                <div className="match-right">
                  <span className="match-time">{relativeTime(m.lastMessageAt)}</span>
                  {m.unreadCount > 0 && (
                    <span className="match-unread-pill">{m.unreadCount}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : searchQuery.trim() ? (
          <div className="matches-empty-state">
            <span className="empty-icon">🔍</span>
            <div className="empty-title">No matching results</div>
            <div className="empty-sub">No matches found for "{searchQuery}"</div>
          </div>
        ) : (
          <div className="matches-empty-state">
            <span className="empty-icon">💕</span>
            <div className="empty-title">No matches yet</div>
            <div className="empty-sub">Start swiping on profiles in Discover to find your campus connection!</div>
            <Link href="/discover" className="btn-discover">
              Start Discovering
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        )}
      </main>

      {/* Shared Bottom Navigation */}
      <BottomNav activeTab="matches" />
    </div>
  )
}
