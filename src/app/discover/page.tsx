'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { getRandomIcebreakers } from '@/lib/icebreakers'
import { DEFAULT_AVATAR } from '@/lib/constants'
import './discover.css'

const CURATED_INTERESTS = [
  { name: "Music", emoji: "🎵" },
  { name: "Sports", emoji: "⚽" },
  { name: "Gaming", emoji: "🎮" },
  { name: "Coding", emoji: "💻" },
  { name: "Traveling", emoji: "✈️" },
  { name: "Movies", emoji: "🍿" },
  { name: "Books", emoji: "📚" },
  { name: "Cooking", emoji: "🍳" },
  { name: "Hiking", emoji: "🥾" },
  { name: "Art", emoji: "🎨" },
  { name: "Photography", emoji: "📷" },
  { name: "Dancing", emoji: "💃" },
  { name: "Gym", emoji: "🏋️" },
  { name: "Coffee", emoji: "☕" },
  { name: "Writing", emoji: "✍️" },
  { name: "Music Instruments", emoji: "🎹" },
  { name: "Netflix & Chill", emoji: "🎬" },
  { name: "Partying/Clubbing", emoji: "🍻" },
  { name: "TikTok & Reels", emoji: "📱" },
  { name: "Anime & Manga", emoji: "🌸" },
  { name: "Memes & Humor", emoji: "😂" },
  { name: "Sleeping/Naps", emoji: "😴" },
  { name: "Fast Food/Foodie", emoji: "🍔" },
  { name: "Studying/Library", emoji: "📖" },
  { name: "Board Games", emoji: "🎲" },
  { name: "e-sports", emoji: "🏆" },
  { name: "Podcasts", emoji: "🎙️" },
  { name: "Volunteering", emoji: "🤝" }
]


interface Profile {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  campus?: string;
  course?: string;
  year_of_study?: string;
  bio?: string;
  photo_url?: string;
  interests?: string[];
  preference?: string;
  profile_complete?: boolean;
}

export default function DiscoverPage() {
  const router = useRouter()
  const supabase = createClient()

  // State
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [candidates, setCandidates] = useState<(Profile & { _compatibility: number })[]>([])
  
  const [loading, setLoading] = useState(true)
  const [profileIncomplete, setProfileIncomplete] = useState(false)

  // Filters State
  const [filterCampus, setFilterCampus] = useState("")
  const [filterCourse, setFilterCourse] = useState("")
  const [filterYear, setFilterYear] = useState("")
  const [filterPreference, setFilterPreference] = useState("all")
  const [showFilters, setShowFilters] = useState(false)

  // Filters DOM Refs
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const filterTriggerRef = useRef<HTMLButtonElement>(null)

  // Single outside-click dismiss listener pattern
  useEffect(() => {
    if (!showFilters) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        filterPanelRef.current && !filterPanelRef.current.contains(target) &&
        filterTriggerRef.current && !filterTriggerRef.current.contains(target)
      ) {
        setShowFilters(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [showFilters])

  // Celebrations / Match Overlay State
  const [matchCelebration, setMatchCelebration] = useState<{
    matchId: string;
    targetName: string;
    targetPhoto: string;
    icebreakers: string[];
  } | null>(null)

  // Active Card Element Ref for gestures
  const activeCardRef = useRef<HTMLDivElement>(null)

  // Fetch initial profile & candidate lists
  useEffect(() => {
    async function initDiscover() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        setCurrentUser(user)

        // 1. Fetch current user's profile details
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single() as any

        if (!profile || !profile.profile_complete) {
          setProfileIncomplete(true)
          setLoading(false)
          return
        }

        setCurrentUserProfile(profile)
        if (profile.preference) {
          setFilterPreference(profile.preference)
        }

        // 2. Fetch existing likes, passes, blocked users (bi-directional), and hidden settings, plus all complete profiles
        const [likesRes, passesRes, blockedByMeRes, blockedMeRes, hiddenSettingsRes, usersRes] = await Promise.all([
          supabase.from("likes").select("to_user_id").eq("from_user_id", user.id) as any,
          supabase.from("passes").select("to_user_id").eq("from_user_id", user.id) as any,
          supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id) as any,
          supabase.from("blocked_users").select("blocker_id").eq("blocked_id", user.id) as any,
          supabase.from("user_settings").select("user_id").eq("discovery_visible", false) as any,
          supabase.from("profiles").select("*").eq("profile_complete", true) as any
        ])

        const likedUids = new Set((likesRes.data || []).map((l: any) => l.to_user_id))
        const passedUids = new Set((passesRes.data || []).map((p: any) => p.to_user_id))
        const blockedUids = new Set([
          ...(blockedByMeRes.data || []).map((b: any) => b.blocked_id),
          ...(blockedMeRes.data || []).map((b: any) => b.blocker_id)
        ])
        const hiddenUids = new Set((hiddenSettingsRes.data || []).map((s: any) => s.user_id))

        const candidatesProfiles = (usersRes.data || []).filter((u: Profile) => {
          if (u.id === user.id) return false
          if (likedUids.has(u.id) || passedUids.has(u.id) || blockedUids.has(u.id) || hiddenUids.has(u.id)) return false
          return true
        })

        setAllProfiles(candidatesProfiles)

        // 3. Compile and sort initial candidates list
        const initialPreference = profile.preference || "all"
        const filtered = candidatesProfiles
          .filter((u: Profile) => {
            if (initialPreference !== "all" && u.gender !== initialPreference) return false
            return true
          })
          .map((u: Profile) => ({
            ...u,
            _compatibility: calculateCompatibility(profile, u)
          }))
          .sort((a: any, b: any) => b._compatibility - a._compatibility)

        setCandidates(filtered)
        setLoading(false)

      } catch (err) {
        console.error("Discover boot error:", err)
        setLoading(false)
      }
    }

    initDiscover()
  }, [])

  // Compatibility Calculation
  const calculateCompatibility = (me: Profile, target: Profile) => {
    let score = 35
    if (me.campus && target.campus && me.campus.toLowerCase().trim() === target.campus.toLowerCase().trim()) {
      score += 30
    }
    if (me.course && target.course && me.course.toLowerCase().trim() === target.course.toLowerCase().trim()) {
      score += 15
    }
    const myInterests = me.interests || []
    const targetInterests = target.interests || []
    const commonInterests = targetInterests.filter((i: string) => myInterests.includes(i))
    score += Math.min(commonInterests.length * 10, 40)

    return Math.min(score, 99)
  }

  // Client-Side Filters compiler
  const applyClientFiltering = (
    campusVal = filterCampus,
    courseVal = filterCourse,
    yearVal = filterYear,
    prefVal = filterPreference
  ) => {
    const campusClean = campusVal.toLowerCase().trim()
    const courseClean = courseVal.toLowerCase().trim()

    const filtered = allProfiles
      .filter((u: Profile) => {
        if (prefVal !== "all" && u.gender !== prefVal) return false
        if (campusClean && (!u.campus || !u.campus.toLowerCase().includes(campusClean))) return false
        if (courseClean && (!u.course || !u.course.toLowerCase().includes(courseClean))) return false
        if (yearVal && u.year_of_study !== yearVal) return false
        return true
      })
      .map((u: Profile) => ({
        ...u,
        _compatibility: calculateCompatibility(currentUserProfile!, u)
      }))
      .sort((a: any, b: any) => b._compatibility - a._compatibility)

    setCandidates(filtered)
    setShowFilters(false)
  }

  const resetAllFilters = () => {
    setFilterCampus("")
    setFilterCourse("")
    setFilterYear("")
    setFilterPreference("all")
    applyClientFiltering("", "", "", "all")
  }

  // SWIPE ENGINE ACTION COMMITTAL
  const handleSwipeCommit = async (direction: 'left' | 'right' | 'up', target: Profile) => {
    // 1. Instantly advance candidate stack
    setCandidates(prev => prev.filter(c => c.id !== target.id))

    if (!currentUser) return

    // 2. Perform DB operations in the background
    if (direction === "right" || direction === "up") {
      const isSuperLike = direction === "up"
      try {
        const { error } = await (supabase.from("likes") as any).insert({
          from_user_id: currentUser.id,
          to_user_id: target.id,
          is_super_like: isSuperLike
        })
        if (error) console.error("Register like error:", error)

        // Check if matching trigger created the match row
        const { data: match } = await (supabase.from("matches") as any)
          .select("id")
          .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${target.id}),and(user1_id.eq.${target.id},user2_id.eq.${currentUser.id})`)
          .maybeSingle()

        if (match) {
          setMatchCelebration({
            matchId: match.id,
            targetName: target.name,
            targetPhoto: target.photo_url || DEFAULT_AVATAR,
            icebreakers: getRandomIcebreakers(3)
          })
        }
      } catch (err) {
        console.error("Like action error:", err)
      }
    } else if (direction === "left") {
      try {
        const { error } = await (supabase.from("passes") as any).insert({
          from_user_id: currentUser.id,
          to_user_id: target.id
        })
        if (error) console.error("Register pass error:", error)
      } catch (err) {
        console.error("Pass action error:", err)
      }
    }
  }

  // Programmatic Button Swiping
  const triggerSwipe = (direction: 'left' | 'right' | 'up') => {
    const card = activeCardRef.current
    const activeCandidate = candidates[0]
    if (!card || !activeCandidate) return

    card.style.transition = "transform 0.35s ease, opacity 0.35s ease"

    const stampLike = card.querySelector(".stamp-like") as HTMLDivElement
    const stampNope = card.querySelector(".stamp-nope") as HTMLDivElement
    const stampSuper = card.querySelector(".stamp-super") as HTMLDivElement

    let targetTransform = ""
    if (direction === "right") {
      targetTransform = `translate3d(${window.innerWidth + 200}px, 0, 0) rotate(45deg)`
      if (stampLike) stampLike.style.opacity = "1"
    } else if (direction === "left") {
      targetTransform = `translate3d(${-window.innerWidth - 200}px, 0, 0) rotate(-45deg)`
      if (stampNope) stampNope.style.opacity = "1"
    } else if (direction === "up") {
      targetTransform = `translate3d(0, ${-window.innerHeight - 200}px, 0) rotate(0deg)`
      if (stampSuper) stampSuper.style.opacity = "1"
    }

    card.style.transform = targetTransform
    card.style.opacity = "0"

    setTimeout(() => {
      handleSwipeCommit(direction, activeCandidate)
    }, 250)
  }

  // EFFECT 1: Touch & Mouse Gestures Handling (Leak-Free single attachment per active card)
  const activeCandidateId = candidates[0]?.id
  useEffect(() => {
    const card = activeCardRef.current
    if (!card || !activeCandidateId) return

    let isDragging = false
    let startX = 0
    let startY = 0
    let currentX = 0
    let currentY = 0

    const stampLike = card.querySelector(".stamp-like") as HTMLDivElement
    const stampNope = card.querySelector(".stamp-nope") as HTMLDivElement
    const stampSuper = card.querySelector(".stamp-super") as HTMLDivElement

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const targetEl = e.target as HTMLElement
      if (targetEl.closest('button') || targetEl.closest('a')) return

      isDragging = true
      const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX
      const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY
      startX = clientX
      startY = clientY
      card.style.transition = "none"
    }

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return
      const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX
      const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY
      currentX = clientX - startX
      currentY = clientY - startY

      const rotate = currentX * 0.08
      card.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) rotate(${rotate}deg)`

      if (currentX > 50) {
        if (stampLike) stampLike.style.opacity = String(Math.min((currentX - 50) / 100, 1))
        if (stampNope) stampNope.style.opacity = "0"
        if (stampSuper) stampSuper.style.opacity = "0"
      } else if (currentX < -50) {
        if (stampNope) stampNope.style.opacity = String(Math.min((Math.abs(currentX) - 50) / 100, 1))
        if (stampLike) stampLike.style.opacity = "0"
        if (stampSuper) stampSuper.style.opacity = "0"
      } else if (currentY < -50 && Math.abs(currentY) > Math.abs(currentX)) {
        if (stampSuper) stampSuper.style.opacity = String(Math.min((Math.abs(currentY) - 50) / 100, 1))
        if (stampLike) stampLike.style.opacity = "0"
        if (stampNope) stampNope.style.opacity = "0"
      } else {
        if (stampLike) stampLike.style.opacity = "0"
        if (stampNope) stampNope.style.opacity = "0"
        if (stampSuper) stampSuper.style.opacity = "0"
      }
    }

    const onPointerUp = () => {
      if (!isDragging) return
      isDragging = false

      const thresholdX = window.innerWidth * 0.25
      const thresholdY = window.innerHeight * 0.25

      if (currentX > thresholdX) {
        swipeAction("right")
      } else if (currentX < -thresholdX) {
        swipeAction("left")
      } else if (currentY < -thresholdY) {
        swipeAction("up")
      } else {
        card.style.transition = "transform 0.3s ease, opacity 0.3s ease"
        card.style.transform = "translate3d(0, 0, 0) rotate(0deg)"
        if (stampLike) stampLike.style.opacity = "0"
        if (stampNope) stampNope.style.opacity = "0"
        if (stampSuper) stampSuper.style.opacity = "0"
      }
    }

    const swipeAction = (direction: 'left' | 'right' | 'up') => {
      card.style.transition = "transform 0.35s ease, opacity 0.35s ease"
      let targetTransform = ""
      if (direction === "right") {
        targetTransform = `translate3d(${window.innerWidth + 200}px, ${currentY}px, 0) rotate(45deg)`
      } else if (direction === "left") {
        targetTransform = `translate3d(${-window.innerWidth - 200}px, ${currentY}px, 0) rotate(-45deg)`
      } else if (direction === "up") {
        targetTransform = `translate3d(${currentX}px, ${-window.innerHeight - 200}px, 0) rotate(0deg)`
      }

      card.style.transform = targetTransform
      card.style.opacity = "0"

      setTimeout(() => {
        const active = candidates.find(c => c.id === activeCandidateId)
        if (active) {
          handleSwipeCommit(direction, active)
        }
      }, 250)
    }

    card.addEventListener("mousedown", onPointerDown)
    document.addEventListener("mousemove", onPointerMove)
    document.addEventListener("mouseup", onPointerUp)

    card.addEventListener("touchstart", onPointerDown, { passive: true })
    document.addEventListener("touchmove", onPointerMove, { passive: true })
    document.addEventListener("touchend", onPointerUp, { passive: true })

    return () => {
      card.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("mousemove", onPointerMove)
      document.removeEventListener("mouseup", onPointerUp)

      card.removeEventListener("touchstart", onPointerDown)
      document.removeEventListener("touchmove", onPointerMove)
      document.removeEventListener("touchend", onPointerUp)
    }
  }, [activeCandidateId, candidates])

  // EFFECT 2: Keyboard Shortcuts Binding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT" || document.activeElement?.tagName === "TEXTAREA") return
      if (e.key === "ArrowRight") {
        triggerSwipe("right")
      } else if (e.key === "ArrowLeft") {
        triggerSwipe("left")
      } else if (e.key === "ArrowUp") {
        triggerSwipe("up")
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeCandidateId, candidates])

  // RENDER EMPTY PROFILE STATE
  if (profileIncomplete) {
    return (
      <div className="discover-page">
        <main className="swipe-arena" style={{ justifyContent: 'center' }}>
          <div className="empty-state">
            <h3>Complete Your Profile</h3>
            <p>Finish setting up your profile to start discovering connections.</p>
            <button className="btn-empty-action" onClick={() => router.push('/profile')}>Complete Profile</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="discover-page">
      {/* ═══ TOP NAV ═══ */}
      <nav className="disc-topnav">
        <div className="disc-topnav-logo" onClick={() => router.push('/dashboard')}>
          <div className="disc-logo-mark">U</div>
          <span className="disc-logo-text">UniMatch</span>
        </div>
        <h2 className="disc-topnav-title">Discover</h2>
        <div className="disc-topnav-actions">
          <button 
            ref={filterTriggerRef}
            className="disc-icon-btn" 
            id="filterBtn" 
            title="Filters" 
            aria-label="Open filters"
            onClick={() => setShowFilters(prev => !prev)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="10" y1="18" x2="14" y2="18"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* ═══ SWIPE ARENA ═══ */}
      <main className="swipe-arena">
        {loading ? (
          <div className="card-stack">
            <div className="stack-loading">
              <div className="stack-spinner"></div>
              <p>Connecting to campus network...</p>
            </div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="card-stack">
            <div className="empty-state">
              <h3>No Profiles Found</h3>
              <p>Adjust your discovery parameters in the filter sidebar to find more students on campus.</p>
              <button id="resetFiltersDeckBtn" onClick={resetAllFilters}>Clear Filters</button>
            </div>
          </div>
        ) : (
          <div className="card-stack" id="cardStack">
            {candidates.slice(0, 3).map((user, index) => {
              const isActive = index === 0
              const isNext = index === 1
              const isThird = index === 2

              let cardClass = "user-card"
              if (isActive) cardClass += " active-card"
              else if (isNext) cardClass += " next-card"
              else if (isThird) cardClass += " third-card"
              else cardClass += " hidden-card"

              return (
                <div 
                  key={user.id} 
                  className={cardClass}
                  ref={isActive ? activeCardRef : null}
                >
                  <div className="stamp stamp-like">Like</div>
                  <div className="stamp stamp-nope">Nope</div>
                  <div className="stamp stamp-super">Super</div>

                  <img 
                    src={user.photo_url || DEFAULT_AVATAR} 
                    alt={user.name} 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_AVATAR
                    }}
                  />

                  <div className="card-info">
                    <div className="card-title-row">
                      <span className="card-name">{user.name}</span>
                      <span className="card-age">{user.age || ''}</span>
                      <span className="card-compat-badge">{user._compatibility}% Match</span>
                    </div>

                    <div className="card-meta-row">
                      <div className="card-meta-item">
                        <span>🎓 {user.course || 'Student'} ({user.year_of_study ? user.year_of_study + ' Year' : 'Undergrad'})</span>
                      </div>
                      <div className="card-meta-item">
                        <span>📍 {user.campus || 'Main Campus'}</span>
                      </div>
                    </div>

                    <p className="card-bio">{user.bio || "No campus bio updated yet."}</p>

                    <div className="card-interests">
                      {(user.interests || []).slice(0, 3).map(interest => {
                        const isShared = (currentUserProfile?.interests || []).includes(interest)
                        const matchItem = CURATED_INTERESTS.find(i => i.name === interest)
                        const emoji = matchItem ? matchItem.emoji : "✨"
                        return (
                          <span 
                            key={interest} 
                            className={`card-interest-pill ${isShared ? 'shared-interest' : ''}`}
                          >
                            <span>{emoji}</span>
                            <span>{interest}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Action Buttons Row */}
        {!loading && candidates.length > 0 && (
          <div className="action-row" id="actionRow">
            <button className="action-btn action-pass" id="btnPass" title="Pass" onClick={() => triggerSwipe("left")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <button className="action-btn action-super" id="btnSuper" title="Super Like" onClick={() => triggerSwipe("up")}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
            <button className="action-btn action-like" id="btnLike" title="Like" onClick={() => triggerSwipe("right")}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          </div>
        )}
      </main>

      {/* ═══ FILTER SHEET ═══ */}
      <div 
        className={`filter-backdrop ${showFilters ? 'open' : ''}`} 
        onClick={() => setShowFilters(false)}
      ></div>
      <div ref={filterPanelRef} className={`filter-sheet ${showFilters ? 'open' : ''}`}>
        <div className="filter-handle"></div>
        <div className="filter-header">
          <h3>Discovery Filters</h3>
          <button className="filter-close" onClick={() => setShowFilters(false)}>✕</button>
        </div>
        <div className="filter-body">
          <div className="filter-group">
            <label className="filter-label">Campus</label>
            <input 
              type="text" 
              className="filter-input" 
              placeholder="e.g. Main Campus"
              value={filterCampus}
              onChange={(e) => setFilterCampus(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Course / Major</label>
            <input 
              type="text" 
              className="filter-input" 
              placeholder="e.g. Computer Science"
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Year of Study</label>
            <select 
              className="filter-input"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="">All Years</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
              <option value="5">Graduate / PG</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Show Me</label>
            <select 
              className="filter-input"
              value={filterPreference}
              onChange={(e) => setFilterPreference(e.target.value)}
            >
              <option value="all">Everyone</option>
              <option value="male">Men</option>
              <option value="female">Women</option>
              <option value="nonbinary">Non-Binary</option>
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn-filter-apply" onClick={() => applyClientFiltering()}>Apply Filters</button>
            <button className="btn-filter-reset" onClick={resetAllFilters}>Reset</button>
          </div>
        </div>
      </div>

      {/* ═══ MATCH CELEBRATION ═══ */}
      {matchCelebration && (
        <div className="match-celebration-overlay active">
          <div className="match-celebration-card">
            <h2 className="match-title">{"It's a Match! 🎉"}</h2>
            <p className="match-subtitle">You and <span>{matchCelebration.targetName}</span> liked each other!</p>
            
            <div className="celebration-avatars">
              <div className="avatar-ring viewer-ring">
                <img src={currentUserProfile?.photo_url || DEFAULT_AVATAR} alt="You" />
              </div>
              <div className="avatar-heart-badge">💖</div>
              <div className="avatar-ring target-ring">
                <img src={matchCelebration.targetPhoto} alt="Match" />
              </div>
            </div>

            <div className="match-icebreakers">
              <h4>Break the Ice! 💬</h4>
              <div className="icebreakers-pills">
                {(matchCelebration.icebreakers && matchCelebration.icebreakers.length > 0
                  ? matchCelebration.icebreakers
                  : getRandomIcebreakers(3)
                ).map((q, idx) => (
                  <button
                    key={idx}
                    className="icebreaker-pill"
                    onClick={() => router.push(`/chat?matchId=${matchCelebration.matchId}&prefill=${encodeURIComponent(q)}`)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="celebration-buttons">
              <button 
                className="chat-btn"
                onClick={() => router.push(`/chat?matchId=${matchCelebration.matchId}`)}
              >
                Start Chatting
              </button>
              <button 
                className="keep-btn"
                onClick={() => setMatchCelebration(null)}
              >
                Keep Swiping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 5-TAB BOTTOM NAV ═══ */}
      <BottomNav activeTab="discover" />
    </div>
  )
}
