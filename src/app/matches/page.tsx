'use client'

export const dynamic = 'force-dynamic'

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
  interests: string[] | null
  lastMessage: string
  lastMessageAt: string | null
  unreadCount: number
  online: boolean
  otherUserId: string
  matchPct: number
}

export default function MatchesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [uid, setUid] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'online' | 'unread' | 'recent'>('all')

  // Calculate realistic compatibility match percentage score
  const calcMatchPct = (m: any, other: any, meProfile: any) => {
    if (m.match_pct) return m.match_pct
    if (m.compatibility) return m.compatibility
    if (meProfile && other) {
      let score = 35
      if (meProfile.campus && other.campus && meProfile.campus.toLowerCase().trim() === other.campus.toLowerCase().trim()) {
        score += 30
      }
      if (meProfile.course && other.course && meProfile.course.toLowerCase().trim() === other.course.toLowerCase().trim()) {
        score += 15
      }
      const myInterests = Array.isArray(meProfile.interests) ? meProfile.interests : []
      const targetInterests = Array.isArray(other?.interests) ? other.interests : []
      const commonInterests = targetInterests.filter((i: string) => myInterests.includes(i))
      score += Math.min(commonInterests.length * 10, 40)

      if (score > 35) return Math.min(score, 99)
    }

    let hash = 0
    const str = String(m.id || other?.id || '')
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    return 82 + (Math.abs(hash) % 17)
  }

  // Format timestamp (e.g. 05:43 PM, Yesterday, Mon)
  const formatMessageTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    }

    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24))
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' })
    return date.toLocaleDateString([], { month: '2-digit', day: '2-digit' })
  }

  // Fetch matches from Supabase
  const fetchMatches = async (userId: string, meProfile?: any) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, p1:profiles!matches_user1_id_fkey(*), p2:profiles!matches_user2_id_fkey(*)')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false }) as any

      if (error) throw error

      const me = meProfile || currentUser

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
            interests: other?.interests || null,
            lastMessage: m.last_message || 'New match! Say hello 👋',
            lastMessageAt: m.last_message_at || m.created_at,
            unreadCount: unread,
            online: Boolean(other?.online),
            otherUserId: other?.id || '',
            matchPct: calcMatchPct(m, other, me)
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single() as any

      const fullUser = { ...user, ...(profile || {}) }
      setCurrentUser(fullUser)
      await fetchMatches(user.id, fullUser)
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

  // Filtered matches list
  const filteredMatches = matches.filter(m => {
    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesSearch = (
        m.name.toLowerCase().includes(q) ||
        (m.course && m.course.toLowerCase().includes(q)) ||
        (m.campus && m.campus.toLowerCase().includes(q)) ||
        (m.lastMessage && m.lastMessage.toLowerCase().includes(q))
      )
      if (!matchesSearch) return false
    }

    // 2. Active Tab Filter
    if (activeFilter === 'online') return m.online
    if (activeFilter === 'unread') return m.unreadCount > 0
    if (activeFilter === 'recent') {
      if (!m.lastMessageAt) return false
      const diffHours = (Date.now() - new Date(m.lastMessageAt).getTime()) / (1000 * 3600)
      return diffHours <= 48
    }

    return true
  })

  // List of New Matches for top horizontal carousel
  const newMatchesList = matches.slice(0, 10)

  return (
    <div className="matches-page">
      {/* Top Navbar */}
      <nav className="app-topnav">
        <div className="topnav-logo">
          <div className="logo-mark">U</div>
          <span className="logo-text">UniMatch</span>
        </div>
        <div className="topnav-actions">
          <Link href="/profile" className="topnav-avatar-link" title="My Profile">
            <img
              src={currentUser?.photo_url || DEFAULT_AVATAR}
              alt="Profile"
              className="topnav-avatar-img"
            />
          </Link>
        </div>
      </nav>

      {/* Main Scrollable Body */}
      <main className="matches-scroll">
        {/* Title */}
        <div className="matches-header">
          <h1 className="matches-title">Matches & Chat 🔥</h1>

          {/* Search bar */}
          <div className="matches-search-wrap">
            <svg className="matches-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="matches-search-input"
              placeholder="Search by name, course, campus..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* NEW MATCHES Carousel Section */}
        {newMatchesList.length > 0 && (
          <section className="new-matches-section">
            <div className="new-matches-title">NEW MATCHES 💕</div>
            <div className="new-matches-row">
              {newMatchesList.map(nm => (
                <div key={nm.id} className="new-match-card">
                  <div
                    className="new-match-avatar-ring"
                    onClick={() => router.push(`/chat?matchId=${nm.id}`)}
                  >
                    <img src={nm.photoUrl} alt={nm.name} className="new-match-avatar-img" />
                    {nm.online && <div className="new-match-online-dot"></div>}
                  </div>
                  <div className="new-match-name">{nm.name}</div>
                  <button
                    className="btn-wave-pill"
                    onClick={() => router.push(`/chat?matchId=${nm.id}&prefill=Wave%20%F0%9F%90%8B`)}
                  >
                    Wave 👋
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filter Pills Bar */}
        <div className="matches-filter-bar">
          <button
            className={`matches-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button
            className={`matches-filter-pill ${activeFilter === 'online' ? 'active' : ''}`}
            onClick={() => setActiveFilter('online')}
          >
            <span className="pill-dot-online"></span> Online
          </button>
          <button
            className={`matches-filter-pill ${activeFilter === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveFilter('unread')}
          >
            📩 Unread
          </button>
          <button
            className={`matches-filter-pill ${activeFilter === 'recent' ? 'active' : ''}`}
            onClick={() => setActiveFilter('recent')}
          >
            ⚡ Recent
          </button>
        </div>

        {/* Conversations / Matches List */}
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
                className={`match-row ${m.unreadCount > 0 ? 'unread' : ''}`}
              >
                <div className="match-avatar-wrap">
                  <img src={m.photoUrl} alt={m.name} className="match-avatar" />
                  {m.online && <div className="match-online-dot"></div>}
                </div>

                <div className="match-info">
                  <div className="match-name">{m.name}</div>
                  <div className="match-preview">{m.lastMessage}</div>
                </div>

                <div className="match-meta-badge">
                  <span className="match-pct-badge">{m.matchPct}% Match</span>
                </div>

                <div className="match-right">
                  <span className="match-time">{formatMessageTime(m.lastMessageAt)}</span>
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

