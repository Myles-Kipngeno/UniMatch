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
  yearOfStudy: string | null
  interests: string[] | null
  bio: string | null
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
  const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null)
  const [showDetail, setShowDetail] = useState(false)   // mobile detail panel
  const [visibleCount, setVisibleCount] = useState(10)

  const calcMatchPct = (m: any, other: any, meProfile: any) => {
    if (m.match_pct) return m.match_pct
    if (m.compatibility) return m.compatibility
    if (meProfile && other) {
      let score = 35
      if (meProfile.campus && other.campus && meProfile.campus.toLowerCase().trim() === other.campus.toLowerCase().trim()) score += 30
      if (meProfile.course && other.course && meProfile.course.toLowerCase().trim() === other.course.toLowerCase().trim()) score += 15
      const myInterests = Array.isArray(meProfile.interests) ? meProfile.interests : []
      const targetInterests = Array.isArray(other?.interests) ? other.interests : []
      score += Math.min(targetInterests.filter((i: string) => myInterests.includes(i)).length * 10, 40)
      if (score > 35) return Math.min(score, 99)
    }
    let hash = 0
    const str = String(m.id || other?.id || '')
    for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0 }
    return 82 + (Math.abs(hash) % 17)
  }

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return ''
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

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
            yearOfStudy: other?.year_of_study || null,
            interests: other?.interests || null,
            bio: other?.bio || null,
            lastMessage: m.last_message || 'New match! Say hello 👋',
            lastMessageAt: m.last_message_at || m.created_at,
            unreadCount: unread,
            online: Boolean(other?.online),
            otherUserId: other?.id || '',
            matchPct: calcMatchPct(m, other, me)
          }
        })
        mapped.sort((a, b) => {
          const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
          const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
          return tB - tA
        })
        setMatches(mapped)
        if (mapped.length > 0) setSelectedMatch(prev => prev ? (mapped.find(x => x.id === prev.id) || mapped[0]) : mapped[0])
      }
    } catch (e) {
      console.warn('Error fetching matches:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUid(user.id)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single() as any
      const fullUser = { ...user, ...(profile || {}) }
      setCurrentUser(fullUser)
      await fetchMatches(user.id, fullUser)
    }
    init()
  }, [supabase, router])

  useEffect(() => {
    if (!uid) return
    const channel = supabase
      .channel(`matches_rt_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `user1_id=eq.${uid}` }, () => fetchMatches(uid))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `user2_id=eq.${uid}` }, () => fetchMatches(uid))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [uid, supabase])

  const filteredMatches = matches.filter(m => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (!m.name.toLowerCase().includes(q) && !(m.course?.toLowerCase().includes(q)) && !(m.campus?.toLowerCase().includes(q)) && !(m.lastMessage?.toLowerCase().includes(q))) return false
    }
    if (activeFilter === 'online') return m.online
    if (activeFilter === 'unread') return m.unreadCount > 0
    if (activeFilter === 'recent') {
      if (!m.lastMessageAt) return false
      return (Date.now() - new Date(m.lastMessageAt).getTime()) / (1000 * 3600) <= 48
    }
    return true
  })

  const filterCounts = {
    all: matches.length,
    online: matches.filter(m => m.online).length,
    unread: matches.filter(m => m.unreadCount > 0).length,
    recent: matches.filter(m => m.lastMessageAt && (Date.now() - new Date(m.lastMessageAt).getTime()) / (1000 * 3600) <= 48).length,
  }

  const shownMatches = filteredMatches.slice(0, visibleCount)
  const interests = selectedMatch?.interests?.slice(0, 4) || []
  const extraInterests = Math.max(0, (selectedMatch?.interests?.length || 0) - 4)
  const moreMatches = matches.filter(m => m.id !== selectedMatch?.id).slice(0, 6)

  // Open detail on mobile
  const openDetail = (m: MatchItem) => {
    setSelectedMatch(m)
    setShowDetail(true)
  }

  // Profile detail panel (used on both desktop sidebar and mobile full-screen)
  const ProfileDetail = ({ m }: { m: MatchItem }) => {
    const tags = m.interests?.slice(0, 4) || []
    const extra = Math.max(0, (m.interests?.length || 0) - 4)
    const more = matches.filter(x => x.id !== m.id).slice(0, 6)
    return (
      <div className="mp-detail">
        {/* Photo */}
        <div className="mp-photo-wrap">
          <img src={m.photoUrl} alt={m.name} className="mp-photo" />
          <span className="mp-match-pct">{m.matchPct}% Match</span>
          <button className="mp-more-btn">···</button>
          <span className="mp-photo-num">1/1</span>
        </div>

        {/* Info */}
        <div className="mp-detail-body">
          <div className="mp-profile-name-row">
            <span className="mp-profile-name">{m.name}</span>
            {m.online && <span className="mp-profile-online">●</span>}
          </div>

          <p className="mp-profile-meta">
            {[m.yearOfStudy ? `${m.yearOfStudy} Year` : '', m.course || ''].filter(Boolean).join(' • ')}
            {m.campus && <><br />{m.campus}</>}
          </p>

          {tags.length > 0 && (
            <div className="mp-tags">
              {tags.map((tag, i) => <span key={i} className="mp-tag">🏷 {tag}</span>)}
              {extra > 0 && <span className="mp-tag">+{extra}</span>}
            </div>
          )}

          {m.bio && <p className="mp-bio">{m.bio}</p>}

          <div className="mp-actions">
            <button className="mp-btn-primary" onClick={() => router.push(`/chat?matchId=${m.id}`)}>
              💬 Send Message
            </button>
            <button className="mp-btn-outline" onClick={() => router.push(`/chat?matchId=${m.id}&prefill=Wave%20👋`)}>
              Send Wave 👋
            </button>
            <Link href={`/profile?id=${m.otherUserId}`} className="mp-btn-ghost">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              View Profile
            </Link>
          </div>

          {/* More Matches */}
          {more.length > 0 && (
            <div className="mp-more-matches">
              <div className="mp-more-header">
                <span className="mp-more-title">More Matches for You</span>
                <button className="mp-see-all" onClick={() => { setShowDetail(false) }}>See all</button>
              </div>
              <div className="mp-more-grid">
                {more.map(x => (
                  <div key={x.id} className="mp-more-card" onClick={() => { setSelectedMatch(x); }}>
                    <img src={x.photoUrl} alt={x.name} className="mp-more-avatar" />
                    <div className="mp-more-name">{x.name.split(' ')[0]}</div>
                    <div className="mp-more-info">{x.yearOfStudy ? `${x.yearOfStudy} Year` : ''}</div>
                    <div className="mp-more-info">{x.course || ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mp-root">

      {/* ── Mobile Full-Screen Detail Overlay ── */}
      {showDetail && selectedMatch && (
        <div className="mp-mobile-detail">
          {/* Mobile top bar */}
          <div className="mp-detail-topbar">
            <button className="mp-back-btn" onClick={() => setShowDetail(false)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
            <span className="mp-detail-topbar-title">Match 💕</span>
            <button className="mp-detail-topbar-more">···</button>
          </div>
          <div className="mp-mobile-detail-scroll">
            <ProfileDetail m={selectedMatch} />
          </div>
          <BottomNav activeTab="matches" />
        </div>
      )}

      {/* ── Left: Matches List ── */}
      <div className={`mp-list-col ${showDetail ? 'mp-list-hidden' : ''}`}>
        {/* Header */}
        <div className="mp-header">
          <h1 className="mp-title">Matches 💕</h1>
          <p className="mp-subtitle">People who liked you back</p>
        </div>

        {/* Search */}
        <div className="mp-search-row">
          <div className="mp-search-wrap">
            <svg className="mp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="mp-search-input"
              placeholder="Search matches..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="mp-filter-btn" title="Filter">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="mp-tabs">
          {(['all', 'online', 'unread', 'recent'] as const).map(tab => (
            <button
              key={tab}
              className={`mp-tab ${activeFilter === tab ? 'active' : ''}`}
              onClick={() => setActiveFilter(tab)}
            >
              {tab === 'online' && <span className="mp-dot mp-dot-online" />}
              {tab === 'unread' && <span className="mp-dot mp-dot-unread" />}
              {tab === 'recent' && <span className="mp-dot mp-dot-recent" />}
              <span className="mp-tab-label">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              <span className="mp-tab-count">{filterCounts[tab]}</span>
            </button>
          ))}
        </div>

        {/* Match Rows */}
        <div className="mp-list">
          {loading ? (
            <div className="mp-loading"><div className="mp-spinner" /><span>Loading…</span></div>
          ) : shownMatches.length > 0 ? (
            <>
              {shownMatches.map(m => (
                <div
                  key={m.id}
                  className={`mp-row ${selectedMatch?.id === m.id ? 'selected' : ''} ${m.unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => openDetail(m)}
                >
                  <div className="mp-avatar-wrap">
                    <img src={m.photoUrl} alt={m.name} className="mp-avatar" />
                    {m.online && <span className="mp-online-dot" />}
                  </div>
                  <div className="mp-row-info">
                    <div className="mp-row-top">
                      <span className="mp-row-name">{m.name}{m.online ? ' ●' : ''}</span>
                      <span className="mp-row-time">{formatTimeAgo(m.lastMessageAt)}</span>
                    </div>
                    <div className="mp-row-course">
                      {m.yearOfStudy ? `${m.yearOfStudy} Year` : ''}{m.course ? ` • ${m.course}` : ''}
                    </div>
                    <div className="mp-row-preview">{m.lastMessage}</div>
                  </div>
                  {m.unreadCount > 0 && <span className="mp-unread-badge">{m.unreadCount}</span>}
                </div>
              ))}

              {filteredMatches.length > visibleCount && (
                <button className="mp-load-more" onClick={() => setVisibleCount(v => v + 10)}>
                  Load more ∨
                </button>
              )}
            </>
          ) : (
            <div className="mp-empty">
              <span className="mp-empty-icon">💕</span>
              <p className="mp-empty-title">No matches yet</p>
              <p className="mp-empty-sub">Start swiping in Discover to find your campus connection!</p>
              <Link href="/discover" className="mp-discover-btn">Start Discovering</Link>
            </div>
          )}

          {/* Secret Crush Card */}
          <div className="mp-crush-card">
            <div className="mp-crush-heart">💕</div>
            <div className="mp-crush-info">
              <div className="mp-crush-title">Secret Crush</div>
              <div className="mp-crush-sub">Find out who likes you</div>
            </div>
            <button className="mp-crush-btn" onClick={() => router.push('/discover')}>Try Now</button>
          </div>
        </div>

        <BottomNav activeTab="matches" />
      </div>

      {/* ── Right: Desktop Profile Panel ── */}
      <div className="mp-profile-panel">
        {selectedMatch ? (
          <ProfileDetail m={selectedMatch} />
        ) : (
          <div className="mp-panel-empty">
            <span>💕</span>
            <p>Select a match to see their profile</p>
          </div>
        )}
      </div>

    </div>
  )
}
