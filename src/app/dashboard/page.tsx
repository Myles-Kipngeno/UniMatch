'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Fredoka } from 'next/font/google'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { DEFAULT_AVATAR } from '@/lib/constants'
import { useModal } from '@/components/ModalContext'
import { useAppCache } from '@/context/AppCacheContext'
import { useNetwork } from '@/context/NetworkContext'
import { DashboardSkeleton } from '@/components/skeletons/Skeletons'
import OfflineNotice, { OfflineBanner } from '@/components/OfflineNotice'
import './dashboard.css'

interface DashboardStats {
  views: number
  likes: number
  matches: number
  unreadMessages: number
}

interface ActivityEvent {
  type: 'view' | 'like' | 'match' | 'join'
  name: string
  time: Date | null
  emoji: string
  cls: string
  text?: string
  link?: string
}

interface MatchChat {
  id: string
  name: string
  photo_url: string
  last_message: string
  last_message_at: string | null
  unread: number
  online: boolean
}

interface ModalRow {
  id: string
  name: string
  photo: string
  sub: string
  time?: string
  badge?: string | null
  chatHref: string
}

interface CheckedInUser {
  id: string
  name: string
  photo_url: string
  course: string
  campus: string
}

interface CampusSpot {
  id: string
  name: string
  category: 'inside' | 'outside'
  icon: string | null
  sort_order: number
  liveCount: number
}

interface ProfileCandidate {
  id: string
  name: string
  age?: number | null
  gender?: string | null
  campus?: string | null
  course?: string | null
  university?: string | null
  bio?: string | null
  photo_url?: string | null
  interests?: string[] | null
  verified?: boolean
  online?: boolean
  location_name?: string | null
}

const DEFAULT_CAMPUS_SPOTS: CampusSpot[] = [
  { id: '1', name: 'Student Center', category: 'inside', icon: 'building', sort_order: 1, liveCount: 0 },
  { id: '2', name: 'Mess', category: 'inside', icon: 'toolsKitchen2', sort_order: 2, liveCount: 0 },
  { id: '3', name: 'Auditorium', category: 'inside', icon: 'theater', sort_order: 3, liveCount: 0 },
  { id: '4', name: 'SMHS', category: 'inside', icon: 'stethoscope', sort_order: 4, liveCount: 0 },
  { id: '5', name: 'School of Law', category: 'inside', icon: 'scale', sort_order: 5, liveCount: 0 },
  { id: '6', name: 'Hostels', category: 'inside', icon: 'home2', sort_order: 6, liveCount: 0 },
  { id: '7', name: 'Library', category: 'inside', icon: 'books', sort_order: 7, liveCount: 0 },
  { id: '8', name: 'Cheche', category: 'outside', icon: 'mapPin', sort_order: 1, liveCount: 0 },
  { id: '9', name: 'Whitehouse', category: 'outside', icon: 'mapPin', sort_order: 2, liveCount: 0 },
  { id: '10', name: 'Lexy', category: 'outside', icon: 'mapPin', sort_order: 3, liveCount: 0 },
  { id: '11', name: 'Elevate', category: 'outside', icon: 'mapPin', sort_order: 4, liveCount: 0 },
  { id: '12', name: 'Belajio', category: 'outside', icon: 'mapPin', sort_order: 5, liveCount: 0 },
  { id: '13', name: 'Carrots', category: 'outside', icon: 'mapPin', sort_order: 6, liveCount: 0 },
]

// Rounded, warm display face for headings & numbers (dashboard only)
const displayFont = Fredoka({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
})

const VIBE_PRESETS = [
  '☕ Up for coffee',
  '📚 Study date?',
  '🎶 Music on repeat',
  '⚽ Game day energy',
  '🌙 Late-night talks',
  '✨ Just vibing',
]

const SWIPE_THRESHOLD = 110

// Activity feed copy — names are rendered as text by React, never as HTML
const ACTIVITY_LABELS: Record<ActivityEvent['type'], string> = {
  view: 'viewed your profile',
  like: 'liked your profile',
  match: 'matched with you',
  join: 'joined UniMatch',
}

// Animated number that counts up from 0 whenever the value changes
function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const target = Number(value) || 0
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || target === 0) {
      setDisplay(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{display.toLocaleString()}</>
}

// Stroke icons used by the stat cards
const StatIcon = ({ type }: { type: 'views' | 'likes' | 'matches' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'views' && <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
    {type === 'likes' && <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />}
    {type === 'matches' && <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 002.5 2.5z" />}
  </svg>
)


export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const modal = useModal()
  const { getCache, setCache } = useAppCache()
  const { isOnline, isNetworkError, reportNetworkError, clearNetworkError } = useNetwork()

  const [mounted, setMounted] = useState(false)

  // User Profile States
  const [uid, setUid] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('Student')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(DEFAULT_AVATAR)
  const [profileSummary, setProfileSummary] = useState('Loading your profile...')
  const [completionPct, setCompletionPct] = useState(0)
  const [profileComplete, setProfileComplete] = useState<boolean>(false)
  const [isVerified, setIsVerified] = useState<boolean>(false)
  const [greeting, setGreeting] = useState('Good day')

  // UI / App States
  const [stats, setStats] = useState<DashboardStats>({ views: 0, likes: 0, matches: 0, unreadMessages: 0 })
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [recentChatsList, setRecentChatsList] = useState<MatchChat[]>([])
  const [todaysPick, setTodaysPick] = useState<(ProfileCandidate & { compat: number; meta?: string }) | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Discovery Pool States
  const [discoveryPool, setDiscoveryPool] = useState<ProfileCandidate[]>([])
  const [activeDiscoveryIndex, setActiveDiscoveryIndex] = useState(0)
  const [isActing, setIsActing] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<'like' | 'pass' | null>(null)

  // Full Profile View Modal State
  const [selectedProfileModal, setSelectedProfileModal] = useState<ProfileCandidate | null>(null)
  const [modalPhotos, setModalPhotos] = useState<string[]>([])
  const [modalPhotosLoading, setModalPhotosLoading] = useState(false)
  const [activeModalPhotoIdx, setActiveModalPhotoIdx] = useState(0)

  // Prefetched gallery photos keyed by user_id (loaded in one batched query with the discovery pool)
  const poolPhotosRef = useRef<Map<string, string[]>>(new Map())

  // Campus Spots & Presence States
  const [campusSpots, setCampusSpots] = useState<CampusSpot[]>(DEFAULT_CAMPUS_SPOTS)
  const [spotCategoryTab, setSpotCategoryTab] = useState<'inside' | 'outside' | null>('inside')
  const [presenceSearch, setPresenceSearch] = useState('')
  const [presenceResults, setPresenceResults] = useState<any[]>([])
  const [presenceSearchLoading, setPresenceSearchLoading] = useState(false)
  const [activeWhoIsHereSpot, setActiveWhoIsHereSpot] = useState<string | null>(null)
  const [whoIsHereUsers, setWhoIsHereUsers] = useState<CheckedInUser[]>([])
  const [showWhoIsHereModal, setShowWhoIsHereModal] = useState(false)

  // Spots / Check-in States
  const [activeTab, setActiveTab] = useState<'spots' | 'radar'>('spots')
  const [myCurrentSpot, setMyCurrentSpot] = useState<string | null>(null)
  const myCurrentSpotRef = useRef<string | null>(null)
  const checkinTimeRef = useRef<number | null>(null)
  const [spotCounts, setSpotCounts] = useState<Record<string, number>>({})

  // Radar / Geolocation States
  const [radarRange, setRadarRange] = useState<number>(2000)
  const [radarCount, setRadarCount] = useState<number | string>('—')
  const [radarHint, setRadarHint] = useState('Initialising radar…')
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dotsRef = useRef<any[]>([])

  // Modal stats sheet
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'views' | 'likes' | 'matches'>('views')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalRows, setModalRows] = useState<ModalRow[]>([])

  // Touch Swipe-to-close state
  const [touchStartY, setTouchStartY] = useState(0)

  // My interests (used to highlight shared interests on Today's Pick)
  const [myInterests, setMyInterests] = useState<string[]>([])

  // Mood / vibe status (stored per user on this device)
  const [vibe, setVibe] = useState('')
  const [vibeEditorOpen, setVibeEditorOpen] = useState(false)
  const [vibeDraft, setVibeDraft] = useState('')

  // Swipe gesture state for the discovery card
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartXRef = useRef<number | null>(null)
  const dragMovedRef = useRef(false)

  // Dropdown DOM Refs
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null)

  const updateCurrentSpot = (spotName: string | null) => {
    myCurrentSpotRef.current = spotName
    setMyCurrentSpot(spotName)
  }

  // Load from cache immediately if available
  useEffect(() => {
    setMounted(true)
    const cached = getCache('dashboard')
    if (cached) {
      if (cached.profileName) setProfileName(cached.profileName)
      if (cached.profilePhotoUrl) setProfilePhotoUrl(cached.profilePhotoUrl)
      if (cached.profileSummary) setProfileSummary(cached.profileSummary)
      if (cached.completionPct !== undefined) setCompletionPct(cached.completionPct)
      if (cached.profileComplete !== undefined) setProfileComplete(cached.profileComplete)
      if (cached.isVerified !== undefined) setIsVerified(cached.isVerified)
      if (cached.stats) setStats(cached.stats)
      if (cached.activityEvents) setActivityEvents(cached.activityEvents)
      if (cached.recentChatsList) setRecentChatsList(cached.recentChatsList)
      if (cached.todaysPick) setTodaysPick(cached.todaysPick)
      if (cached.spotCounts) setSpotCounts(cached.spotCounts)
      if (cached.checkedUsers) setWhoIsHereUsers(cached.checkedUsers)
      setLoading(false)
    }
  }, [getCache])

  // Restore this user's vibe status
  useEffect(() => {
    if (!uid) return
    try {
      setVibe(localStorage.getItem(`unimatch_vibe_${uid}`) || '')
    } catch {
      setVibe('')
    }
  }, [uid])

  // Reset the swipe card whenever a new candidate is shown
  useEffect(() => {
    setDragX(0)
    setIsDragging(false)
    dragStartXRef.current = null
  }, [activeDiscoveryIndex])

  // Single outside-click dismiss listener pattern for 3-dot dropdown
  useEffect(() => {
    if (!isDropdownOpen) return

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        dropdownTriggerRef.current && !dropdownTriggerRef.current.contains(target)
      ) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [isDropdownOpen])

  // Presence Search Effect
  useEffect(() => {
    if (!presenceSearch.trim()) {
      setPresenceResults([])
      setPresenceSearchLoading(false)
      return
    }
    setPresenceSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, photo_url, course, campus, location_name, presence(online, location_name)')
          .ilike('name', `%${presenceSearch.trim()}%`)
          .limit(10) as any

        const results = (data || []).map((p: any) => {
          const isOnlineNow = p.presence?.online || false
          const spot = isOnlineNow ? (p.presence?.location_name || p.location_name) : null
          return {
            id: p.id,
            name: p.name || 'Student',
            photo_url: p.photo_url || DEFAULT_AVATAR,
            course: p.course || '',
            campus: p.campus || '',
            spot,
            online: isOnlineNow
          }
        })
        setPresenceResults(results)
      } catch (e) {
        console.warn("Presence search error:", e)
      } finally {
        setPresenceSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [presenceSearch, supabase])

  const renderSpotIcon = (iconName: string | null) => {
    switch (iconName) {
      case 'building': return '🏢'
      case 'toolsKitchen2': return '🍲'
      case 'theater': return '🎭'
      case 'stethoscope': return '🩺'
      case 'scale': return '⚖️'
      case 'home2': return '🏠'
      case 'books': return '📚'
      case 'mapPin': return '📍'
      default: return '📍'
    }
  }

  // Bootstrapping auth & user profile
  useEffect(() => {
    async function initDashboard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUid(user.id)

      // Time greeting
      const hour = new Date().getHours()
      setGreeting(
        hour >= 5 && hour < 12 ? 'Good morning' :
          hour >= 12 && hour < 17 ? 'Good afternoon' :
            hour >= 17 && hour < 21 ? 'Good evening' : 'Good night'
      )

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single() as any

      if (profile) {
        const name = profile.name || user.email?.split('@')[0] || 'Student'
        setProfileName(name)
        setProfileSummary([profile.course, profile.campus].filter(Boolean).join(' • ') || 'Complete your profile')
        if (profile.photo_url) setProfilePhotoUrl(profile.photo_url)
        setProfileComplete(!!profile.profile_complete)
        setIsVerified(!!profile.verified)
        setMyInterests(Array.isArray(profile.interests) ? profile.interests : [])

        // Completion percentage
        const fields = ["name", "bio", "course", "campus", "photo_url", "age", "gender", "interests"]
        const filled = fields.filter(f => {
          const val = (profile as any)[f]
          return val && (Array.isArray(val) ? val.length > 0 : String(val).trim() !== "")
        }).length
        const calcPct = Math.round((filled / fields.length) * 100)
        setCompletionPct(calcPct)

        // Initial Data Fetchers
        try {
          await Promise.all([
            fetchStats(user.id),
            fetchChats(user.id),
            fetchActivity(user.id),
            fetchDiscoverPool(user.id),
            fetchTodaysPick(user.id, profile.interests || []),
            fetchSpots(user.id),
            initLocation(user.id)
          ])

          setCache('dashboard', {
            profileName: name,
            profilePhotoUrl: profile.photo_url || DEFAULT_AVATAR,
            profileSummary: [profile.course, profile.campus].filter(Boolean).join(' • ') || 'Complete your profile',
            completionPct: calcPct,
            profileComplete: !!profile.profile_complete,
            isVerified: !!profile.verified,
            stats,
            activityEvents,
            recentChatsList,
            todaysPick,
            spotCounts,
            checkedUsers: whoIsHereUsers
          })
          clearNetworkError()
        } catch (e: any) {
          console.error('Error loading dashboard data:', e)
          if (!navigator.onLine || e.message?.includes('fetch')) {
            reportNetworkError()
          }
        }
      }
      setLoading(false)
    }

    initDashboard()
  }, [supabase, router, setCache, clearNetworkError, reportNetworkError])

  // Realtime Subscriptions
  useEffect(() => {
    if (!uid) return

    const statsChannel = supabase.channel('dashboard_stats_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `to_user_id=eq.${uid}` }, () => fetchStats(uid))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchStats(uid))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'views', filter: `target_id=eq.${uid}` }, () => fetchStats(uid))
      .subscribe()

    const presenceChannel = supabase.channel('dashboard_presence_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presence' as any }, () => {
        fetchSpots(uid)
        if (gpsLat !== null && gpsLng !== null) {
          fetchRadarDots(uid, gpsLat, gpsLng, radarRange)
        } else {
          fetchRadarFallback(uid)
        }
      })
      .subscribe()

    const handleReconnect = () => {
      fetchStats(uid)
      fetchChats(uid)
      fetchActivity(uid)
      fetchSpots(uid)
      fetchDiscoverPool(uid)
    }
    window.addEventListener('unimatch:reconnect', handleReconnect)

    return () => {
      supabase.removeChannel(statsChannel)
      supabase.removeChannel(presenceChannel)
      window.removeEventListener('unimatch:reconnect', handleReconnect)
    }
  }, [uid, gpsLat, gpsLng, radarRange, supabase])

  // Canvas Animation loop for Radar
  useEffect(() => {
    if (activeTab !== 'radar' || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let sweepAngle = 0
    const SWEEP_SPEED = 0.025
    const TRAIL_ANGLE = Math.PI * 0.45
    const DOT_LERP = 0.08

    const renderLoop = () => {
      const now = performance.now()
      const sz = Math.min(canvas.parentElement?.clientWidth || 280, 280)
      canvas.width = sz
      canvas.height = sz
      const cx = sz / 2
      const cy = sz / 2
      const r = sz / 2 - 8

      ctx.clearRect(0, 0, sz, sz)

      // Draw radar circle
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      bgGrad.addColorStop(0, "#0e0b1e")
      bgGrad.addColorStop(1, "#060412")
      ctx.fillStyle = bgGrad
      ctx.fill()
      ctx.strokeStyle = "rgba(130, 80, 255, 0.5)"
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      // Clip bounds
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r - 1, 0, Math.PI * 2)
      ctx.clip()

      // Distance rings with labels
      ;[0.33, 0.60, 0.87].forEach((frac, i) => {
        ctx.beginPath()
        ctx.arc(cx, cy, r * frac, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(110, 70, 255, ${0.08 + i * 0.06})`
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.save()
        ctx.fillStyle = "rgba(160, 130, 255, 0.35)"
        ctx.font = "8px Outfit, sans-serif"
        ctx.textBaseline = "middle"
        ctx.textAlign = "center"
        let lbl = ""
        if (radarRange === 100) {
          lbl = i === 0 ? "30m" : i === 1 ? "60m" : "100m"
        } else if (radarRange === 500) {
          lbl = i === 0 ? "150m" : i === 1 ? "300m" : "500m"
        } else if (radarRange === 1000) {
          lbl = i === 0 ? "300m" : i === 1 ? "600m" : "1km"
        } else {
          lbl = i === 0 ? "600m" : i === 1 ? "1.3km" : "2km"
        }
        ctx.fillText(lbl, cx, cy - (r * frac) + 7)
        ctx.restore()
      })

      // Grid lines
      ctx.setLineDash([2, 5])
      ctx.strokeStyle = "rgba(110, 70, 255, 0.13)"
      ctx.lineWidth = 1
      for (let a = 0; a < 4; a++) {
        const angle = (a * Math.PI) / 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
        ctx.stroke()
      }
      ctx.setLineDash([])

      // Rotating sweep
      sweepAngle = (sweepAngle + SWEEP_SPEED) % (Math.PI * 2)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(sweepAngle)

      // Trail glow fan
      const STEPS = 55
      for (let s = 0; s < STEPS; s++) {
        const frac = s / STEPS
        const start = -TRAIL_ANGLE * (1 - frac)
        const end = start + (TRAIL_ANGLE / STEPS) + 0.005
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, r, start, end)
        ctx.closePath()
        ctx.fillStyle = `rgba(120, 70, 255, ${frac * frac * 0.28})`
        ctx.fill()
      }

      // Sweeper arm
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(r, 0)
      ctx.strokeStyle = "rgba(200, 160, 255, 0.9)"
      ctx.lineWidth = 2
      ctx.shadowColor = "rgba(160, 100, 255, 0.8)"
      ctx.shadowBlur = 8
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()

      // Draw nearby dots
      dotsRef.current.forEach((dot: any) => {
        dot.x += (dot.tx - dot.x) * DOT_LERP
        dot.y += (dot.ty - dot.y) * DOT_LERP

        const dotAngle = ((Math.atan2(dot.y - cy, dot.x - cx) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const sweepNorm = ((sweepAngle - TRAIL_ANGLE * 0.05) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
        const diff = Math.abs(sweepNorm - dotAngle)
        if (diff < SWEEP_SPEED * 2.5 || diff > Math.PI * 2 - SWEEP_SPEED * 2.5) {
          dot.pingTime = now
        }

        const pingAge = now - (dot.pingTime || 0)
        const pingAlpha = pingAge < 2200 ? Math.max(0, 1 - pingAge / 2200) : 0

        if (pingAlpha > 0.02) {
          const ringR = 5 + (1 - pingAlpha) * 18
          ctx.beginPath()
          ctx.arc(dot.x, dot.y, ringR, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(100, 220, 255, ${pingAlpha * 0.7})`
          ctx.lineWidth = 1.2
          ctx.stroke()
        }

        const halo = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, 12)
        halo.addColorStop(0, `rgba(80, 200, 255, ${0.25 + pingAlpha * 0.5})`)
        halo.addColorStop(1, "rgba(80, 200, 255, 0)")
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, 12, 0, Math.PI * 2)
        ctx.fillStyle = halo
        ctx.fill()

        ctx.beginPath()
        ctx.arc(dot.x, dot.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(130, 220, 255, ${0.75 + pingAlpha * 0.25})`
        ctx.shadowColor = "rgba(80, 200, 255, 0.9)"
        ctx.shadowBlur = 6
        ctx.fill()
        ctx.shadowBlur = 0
      })

      ctx.restore()

      // Center self dot with pulse
      const pulse = 0.5 + 0.5 * Math.sin(now / 420)
      ctx.beginPath()
      ctx.arc(cx, cy, 10 + pulse * 6, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(180, 120, 255, ${0.25 + pulse * 0.2})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      const youGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10)
      youGlow.addColorStop(0, "rgba(220, 170, 255, 1)")
      youGlow.addColorStop(1, "rgba(130, 60,  255, 0)")
      ctx.beginPath()
      ctx.arc(cx, cy, 10, 0, Math.PI * 2)
      ctx.fillStyle = youGlow
      ctx.shadowColor = "rgba(160, 80, 255, 0.9)"
      ctx.shadowBlur = 12
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.beginPath()
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.fill()

      ctx.fillStyle = "rgba(255, 255, 255, 0.65)"
      ctx.font = `bold 10px Outfit, sans-serif`
      ctx.textAlign = "center"
      ctx.fillText("YOU", cx, cy + 20)

      animId = requestAnimationFrame(renderLoop)
    }

    renderLoop()

    return () => cancelAnimationFrame(animId)
  }, [activeTab, radarRange])

  // Geolocation trigger & periodic refresh
  const initLocation = (userId: string) => {
    if (!navigator.geolocation) {
      setRadarHint("GPS unavailable — showing online students")
      fetchRadarFallback(userId)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = Math.round(pos.coords.latitude * 100) / 100
        const lng = Math.round(pos.coords.longitude * 100) / 100
        setGpsLat(lat)
        setGpsLng(lng)

        await upsertPresence(userId, lat, lng, myCurrentSpotRef.current)
        setRadarHint(`Showing students within ~${radarRange >= 1000 ? (radarRange / 1000) + 'km' : radarRange + 'm'}`)
        fetchRadarDots(userId, lat, lng, radarRange)
      },
      async () => {
        setRadarHint("Location off — showing online students")
        fetchRadarFallback(userId)
      },
      { timeout: 8000, maximumAge: 60000 }
    )
  }

  // Upsert presence utility
  const upsertPresence = async (userId: string, lat: number | null, lng: number | null, spotName?: string | null) => {
    const targetSpot = spotName !== undefined ? spotName : myCurrentSpotRef.current
    try {
      await (supabase.from('presence' as any) as any).upsert(
        { user_id: userId, online: true, location_name: targetSpot, lat, lng, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    } catch (e) {
      console.warn("Presence upsert:", e)
    }
  }

  // Spots count & campus_spots query
  const fetchSpots = async (userId: string) => {
    try {
      const { data: spotsData } = await supabase
        .from('campus_spots')
        .select('*')
        .order('sort_order', { ascending: true })

      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('presence' as any)
        .select('location_name, user_id')
        .eq('online', true)
        .gte('updated_at', cutoff) as any

      const myPres = data?.find((p: any) => p.user_id === userId)
      const serverSpot = myPres ? myPres.location_name : null

      const isRecentlyCheckedIn = checkinTimeRef.current && (Date.now() - checkinTimeRef.current < 5 * 60 * 1000)
      const activeSpot = serverSpot || (isRecentlyCheckedIn ? myCurrentSpotRef.current : null)

      updateCurrentSpot(activeSpot)

      const counts: Record<string, number> = {}
      data?.forEach((p: any) => {
        if (p.location_name) {
          counts[p.location_name] = (counts[p.location_name] || 0) + 1
        }
      })
      if (activeSpot && (!counts[activeSpot] || counts[activeSpot] === 0)) {
        counts[activeSpot] = 1
      }
      setSpotCounts(counts)

      const sourceSpots = (spotsData && spotsData.length > 0) ? spotsData : DEFAULT_CAMPUS_SPOTS

      const formatted: CampusSpot[] = sourceSpots.map((s: any) => ({
        id: s.id || s.name,
        name: s.name,
        category: s.category as 'inside' | 'outside',
        icon: s.icon,
        sort_order: s.sort_order || 0,
        liveCount: counts[s.name] || 0
      }))

      setCampusSpots(formatted)

      const targetSpot = activeSpot || (formatted.length > 0 ? formatted.reduce((max, spot) => spot.liveCount > max.liveCount ? spot : max, formatted[0]).name : 'Student Center')
      setActiveWhoIsHereSpot(targetSpot)
      fetchCheckedInUsers(userId, targetSpot)
    } catch (e) {
      console.warn("Spots loading error:", e)
    }
  }

  // Spots check-in toggle check-in
  const toggleSpotCheckin = async (spotName: string) => {
    if (!isOnline) {
      modal.toast("You're offline — check-in requires a live connection", "warning")
      return
    }
    if (!uid) return
    const isCheckingOut = myCurrentSpotRef.current === spotName
    const nextSpot = isCheckingOut ? null : spotName

    if (nextSpot) {
      checkinTimeRef.current = Date.now()
    } else {
      checkinTimeRef.current = null
    }

    updateCurrentSpot(nextSpot)

    try {
      await upsertPresence(uid, gpsLat, gpsLng, nextSpot)
      modal.toast(nextSpot ? `Checked into ${nextSpot} 📍` : `Checked out of ${spotName}`, 'info')
      fetchSpots(uid)
    } catch (e) {
      console.warn("Checkin toggle error:", e)
    }
  }

  // Handle Category Tab Change (Inside vs Outside)
  const handleCategoryTabChange = (cat: 'inside' | 'outside') => {
    if (spotCategoryTab === cat) {
      setSpotCategoryTab(null)
      return
    }
    setSpotCategoryTab(cat)
    const filtered = campusSpots.filter(s => s.category === cat)
    if (filtered.length > 0) {
      const userSpotInCat = filtered.find(s => s.name === myCurrentSpot)
      const targetSpot = userSpotInCat ? userSpotInCat.name : filtered[0].name
      setActiveWhoIsHereSpot(targetSpot)
      if (uid) fetchCheckedInUsers(uid, targetSpot)
    }
  }

  // Fetch checked in users for spot
  const fetchCheckedInUsers = async (userId: string, spotName: string) => {
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('presence' as any)
        .select('user_id, updated_at, profiles!presence_user_id_fkey(id, name, photo_url, course, campus)')
        .eq('location_name', spotName)
        .gte('updated_at', cutoff)
        .limit(20) as any

      if (data) {
        const users: CheckedInUser[] = data
          .map((row: any) => ({
            id: row.profiles?.id || row.user_id,
            name: row.profiles?.name || 'Student',
            photo_url: row.profiles?.photo_url || DEFAULT_AVATAR,
            course: row.profiles?.course || '',
            campus: row.profiles?.campus || ''
          }))
          .filter((u: CheckedInUser) => u.id !== userId)

        setWhoIsHereUsers(users)
      }
    } catch (e) {
      console.warn("Checked in users fetch error:", e)
    }
  }

  // Radar dots queries
  const fetchRadarDots = async (userId: string, lat: number, lng: number, range: number) => {
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('presence' as any)
        .select('user_id, lat, lng')
        .eq('online', true)
        .neq('user_id', userId)
        .gte('updated_at', cutoff) as any

      const filtered = (data || []).filter((d: any) => {
        if (d.lat == null || d.lng == null) return false
        const distM = Math.hypot(d.lat - lat, d.lng - lng) * 111000
        return distM <= range
      })

      setRadarCount(filtered.length)

      const rangeDeg = range / 111000
      const sz = Math.min(canvasRef.current?.parentElement?.clientWidth || 280, 280)
      const cx = sz / 2
      const cy = sz / 2
      const r = sz / 2 - 8

      const mapped = filtered.map((d: any) => {
        const dLat = d.lat! - lat
        const dLng = d.lng! - lng
        const tx = cx + (dLng / rangeDeg) * r * 0.88
        const ty = cy - (dLat / rangeDeg) * r * 0.88
        const dist = Math.hypot(tx - cx, ty - cy)
        const maxD = r * 0.88
        const finalX = dist > maxD ? cx + (tx - cx) * maxD / dist : tx
        const finalY = dist > maxD ? cy + (ty - cy) * maxD / dist : ty

        const old = dotsRef.current.find((o: any) => o.id === d.user_id)
        return { id: d.user_id, x: old?.x ?? finalX, y: old?.y ?? finalY, tx: finalX, ty: finalY, pingTime: old?.pingTime ?? 0 }
      })

      dotsRef.current = mapped
      setRadarHint(`Showing students within ~${range >= 1000 ? (range / 1000) + 'km' : range + 'm'}`)
    } catch (e) {
      console.warn("Radar query error:", e)
    }
  }

  const fetchRadarFallback = async (userId: string) => {
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('presence' as any)
        .select('user_id')
        .eq('online', true)
        .neq('user_id', userId)
        .gte('updated_at', cutoff) as any

      setRadarCount(data?.length || 0)

      const sz = Math.min(canvasRef.current?.parentElement?.clientWidth || 280, 280)
      const cx = sz / 2
      const cy = sz / 2
      const r = sz / 2 - 8

      const mapped = (data || []).map((d: any) => {
        const hash = [...d.user_id].reduce((a: number, c: string) => a + c.charCodeAt(0), 0)
        const angle = (hash * 137.508) % 360 * (Math.PI / 180)
        const dist = (((hash * 7919) % 72) + 16) / 100 * r * 0.85
        const tx = cx + Math.cos(angle) * dist
        const ty = cy + Math.sin(angle) * dist
        const old = dotsRef.current.find((o: any) => o.id === d.user_id)
        return { id: d.user_id, x: old?.x ?? tx, y: old?.y ?? ty, tx, ty, pingTime: old?.pingTime ?? 0 }
      })

      dotsRef.current = mapped
    } catch (e) {
      console.warn("Radar fallback error:", e)
    }
  }

  // Stats Query
  const fetchStats = async (userId: string) => {
    try {
      const { count: likesCount } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', userId)

      const { count: viewsCount } = await supabase
        .from('views')
        .select('*', { count: 'exact', head: true })
        .eq('target_id', userId)

      const { data: matches } = await supabase
        .from('matches')
        .select('id, user1_id, user2_id, user1_unread, user2_unread')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`) as any

      const matchesCount = matches ? matches.length : 0

      let unreadTotal = 0
      matches?.forEach((m: any) => {
        unreadTotal += m.user1_id === userId ? (m.user1_unread || 0) : (m.user2_unread || 0)
      })

      setStats({
        views: viewsCount || 0,
        likes: likesCount || 0,
        matches: matchesCount,
        unreadMessages: unreadTotal
      })
    } catch (e) {
      console.warn("Fetch stats error:", e)
    }
  }

  // Chats Query
  const fetchChats = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('matches')
        .select('*, p1:profiles!matches_user1_id_fkey(*), p2:profiles!matches_user2_id_fkey(*)')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false })
        .limit(3) as any

      if (data && data.length > 0) {
        const chats = data.map((m: any) => {
          const other = m.user1_id === userId ? m.p2 : m.p1
          const unread = m.user1_id === userId ? m.user1_unread : m.user2_unread
          return {
            id: m.id,
            name: other?.name || 'Match',
            photo_url: other?.photo_url || DEFAULT_AVATAR,
            last_message: m.last_message || 'Say hello 👋',
            last_message_at: m.last_message_at,
            unread: unread || 0,
            online: (other as any)?.online || false
          }
        })
        setRecentChatsList(chats)
      } else {
        setRecentChatsList([])
      }
    } catch (e) {
      console.warn("Chats load error:", e)
      setRecentChatsList([])
    }
  }

  // Activity Feed Query
  const fetchActivity = async (userId: string) => {
    const list: ActivityEvent[] = []
    try {
      const { data: views } = await supabase
        .from('views')
        .select('id, created_at, profiles!views_viewer_id_fkey(name)')
        .eq('target_id', userId)
        .order('created_at', { ascending: false })
        .limit(3) as any

      views?.forEach((v: any) => {
        list.push({
          type: 'view',
          name: v.profiles?.name || 'Someone',
          time: v.created_at ? new Date(v.created_at) : null,
          emoji: '👀',
          cls: 'activity-dot--view'
        })
      })

      const { data: likes } = await supabase
        .from('likes')
        .select('id, created_at, profiles!likes_from_user_id_fkey(name)')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(2) as any

      likes?.forEach((l: any) => {
        list.push({
          type: 'like',
          name: l.profiles?.name || 'Someone',
          time: l.created_at ? new Date(l.created_at) : null,
          emoji: '❤️',
          cls: 'activity-dot--like'
        })
      })
    } catch (e) {
      console.warn("Activity feed query error:", e)
    }

    if (list.length === 0) {
      setActivityEvents([])
      return
    }

    list.sort((a, b) => {
      if (!a.time && !b.time) return 0
      if (!a.time) return 1
      if (!b.time) return -1
      const timeA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time.getTime()
      const timeB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time.getTime()
      return timeB - timeA
    })

    setActivityEvents(list.slice(0, 4))
  }

  // Enhanced Discover Candidates Pool Query
  const fetchDiscoverPool = async (userId: string) => {
    try {
      const { data: liked } = await supabase.from('likes').select('to_user_id').eq('from_user_id', userId) as any
      const { data: passed } = await supabase.from('passes').select('to_user_id').eq('from_user_id', userId) as any

      const excluded = [userId, ...(liked || []).map((l: any) => l.to_user_id), ...(passed || []).map((p: any) => p.to_user_id)]

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, age, gender, campus, course, university, bio, photo_url, interests, verified, online, location_name')
        .not('id', 'in', `(${excluded.join(',')})`)
        .limit(20) as any

      if (profiles && profiles.length > 0) {
        setDiscoveryPool(profiles)
        setActiveDiscoveryIndex(0)

        // Batch-prefetch gallery photos for the whole pool with a single query
        const poolIds = profiles.map((p: any) => p.id)
        const photos = await supabase
          .from('profile_photos')
          .select('user_id, url, position')
          .in('user_id', poolIds)
          .order('position', { ascending: true }) as any

        const grouped = new Map<string, string[]>()
        for (const ph of (photos.data || [])) {
          if (!grouped.has(ph.user_id)) grouped.set(ph.user_id, [])
          grouped.get(ph.user_id)!.push(ph.url)
        }
        poolPhotosRef.current = grouped
      } else {
        setDiscoveryPool([])
        poolPhotosRef.current = new Map()
        setActiveDiscoveryIndex(0)
      }
    } catch (e) {
      console.warn("Discover pool query error:", e)
      setDiscoveryPool([])
      setActiveDiscoveryIndex(0)
    }
  }

  // Today's best match pick
  const fetchTodaysPick = async (userId: string, myInterests: string[]) => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, age, gender, campus, course, university, bio, photo_url, interests, verified, online')
        .neq('id', userId)
        .limit(15) as any

      if (profiles && profiles.length > 0) {
        const candidates = profiles.map((p: any) => {
          const shared = (p.interests || []).filter((i: any) => myInterests.includes(i)).length
          return { ...p, _shared: shared }
        })

        candidates.sort((a: any, b: any) => b._shared - a._shared)
        const pick = candidates[0]
        const compatPct = Math.min(99, Math.round(65 + pick._shared * 10))

        setTodaysPick({
          ...pick,
          meta: [pick.course, pick.campus].filter(Boolean).join(' • ') || 'Kabarak University',
          compat: compatPct
        })
      } else {
        setTodaysPick(null)
      }
    } catch (e) {
      console.warn("Todays pick error:", e)
      setTodaysPick(null)
    }
  }

  // Handle Like or Pass on Discovery Candidate
  const handleDiscoveryAction = async (action: 'like' | 'pass', candidateParam?: ProfileCandidate) => {
    if (!uid || isActing) return
    const candidate = candidateParam || discoveryPool[activeDiscoveryIndex]
    if (!candidate) return

    setIsActing(true)
    setActionFeedback(action)

    try {
      if (action === 'like') {
        await (supabase.from('likes') as any).insert({
          from_user_id: uid,
          to_user_id: candidate.id,
          is_super_like: false
        })

        // Check if reciprocal like exists
        const { data: reciprocal } = await (supabase
          .from('likes') as any)
          .select('id')
          .eq('from_user_id', candidate.id)
          .eq('to_user_id', uid)
          .maybeSingle()

        if (reciprocal) {
          modal.toast(`It's a Match with ${candidate.name}! 🎉`, 'success')
          setStats(prev => ({ ...prev, matches: prev.matches + 1 }))
        } else {
          modal.toast(`Liked ${candidate.name} 💖`, 'info')
        }
      } else {
        await (supabase.from('passes') as any).insert({
          from_user_id: uid,
          to_user_id: candidate.id
        })
        modal.toast(`Passed on ${candidate.name}`, 'info')
      }
    } catch (e) {
      console.warn("Discovery action error:", e)
    } finally {
      setTimeout(() => {
        setActionFeedback(null)
        setIsActing(false)
        setActiveDiscoveryIndex(prev => prev + 1)
        if (selectedProfileModal?.id === candidate.id) {
          setSelectedProfileModal(null)
        }
      }, 260)
    }
  }

  // Open Full Profile View Modal
  const openProfileDetailModal = async (candidate: ProfileCandidate) => {
    setSelectedProfileModal(candidate)
    setActiveModalPhotoIdx(0)
    setModalPhotosLoading(true)

    // Fast path: photos were already prefetched with the discovery pool
    const prefetched = poolPhotosRef.current.get(candidate.id)
    if (prefetched) {
      const photoUrls = [candidate.photo_url, ...prefetched].filter(Boolean) as string[]
      setModalPhotos(Array.from(new Set(photoUrls)))
      setModalPhotosLoading(false)
      return
    }

    try {
      const { data: photos } = await supabase
        .from('profile_photos')
        .select('url, position')
        .eq('user_id', candidate.id)
        .order('position', { ascending: true })

      const photoUrls = [candidate.photo_url, ...(photos || []).map((p: any) => p.url)].filter(Boolean) as string[]
      setModalPhotos(Array.from(new Set(photoUrls)))
    } catch (e) {
      console.warn("Failed to load profile photos:", e)
      setModalPhotos([candidate.photo_url || DEFAULT_AVATAR])
    } finally {
      setModalPhotosLoading(false)
    }
  }

  // Stats Modal Loader
  const openModal = async (type: 'views' | 'likes' | 'matches') => {
    setModalType(type)
    setModalOpen(true)
    setModalLoading(true)

    try {
      let activeUid = uid
      if (!activeUid) {
        const { data: { user } } = await supabase.auth.getUser()
        activeUid = user?.id || null
        if (activeUid) setUid(activeUid)
      }

      if (!activeUid) {
        setModalRows([])
        return
      }

      let rows: ModalRow[] = []

      if (type === 'views') {
        let viewRows: any[] = []
        try {
          const { data, error } = await supabase
            .from('views')
            .select('id, created_at, profiles!views_viewer_id_fkey(id, name, photo_url, course, campus)')
            .eq('target_id', activeUid)
            .order('created_at', { ascending: false })
            .limit(50) as any
          if (error) throw error
          viewRows = data || []
        } catch (err) {
          const { data: rawViews } = await supabase
            .from('views')
            .select('id, viewer_id, created_at')
            .eq('target_id', activeUid)
            .order('created_at', { ascending: false })
            .limit(50) as any
          if (rawViews && rawViews.length > 0) {
            const viewerIds = rawViews.map((v: any) => v.viewer_id)
            const { data: profs } = await supabase.from('profiles').select('id, name, photo_url, course, campus').in('id', viewerIds) as any
            const profMap = new Map((profs || []).map((p: any) => [p.id, p]))
            viewRows = rawViews.map((v: any) => ({ ...v, profiles: profMap.get(v.viewer_id) }))
          }
        }

        rows = (viewRows || []).map((r: any) => ({
          id: r.profiles?.id || r.id,
          name: r.profiles?.name || 'UniMatch Student',
          photo: r.profiles?.photo_url || DEFAULT_AVATAR,
          sub: [r.profiles?.course, r.profiles?.campus].filter(Boolean).join(' • ') || 'UniMatch student',
          time: r.created_at,
          badge: null,
          chatHref: r.profiles?.id ? `/profile?id=${r.profiles.id}` : '/discover'
        }))
      }

      if (type === 'likes') {
        let likeRows: any[] = []
        try {
          const { data, error } = await supabase
            .from('likes')
            .select('id, created_at, profiles!likes_from_user_id_fkey(id, name, photo_url, course, campus)')
            .eq('to_user_id', activeUid)
            .order('created_at', { ascending: false })
            .limit(50) as any
          if (error) throw error
          likeRows = data || []
        } catch (err) {
          const { data: rawLikes } = await supabase
            .from('likes')
            .select('id, from_user_id, created_at')
            .eq('to_user_id', activeUid)
            .order('created_at', { ascending: false })
            .limit(50) as any
          if (rawLikes && rawLikes.length > 0) {
            const fromIds = rawLikes.map((l: any) => l.from_user_id)
            const { data: profs } = await supabase.from('profiles').select('id, name, photo_url, course, campus').in('id', fromIds) as any
            const profMap = new Map((profs || []).map((p: any) => [p.id, p]))
            likeRows = rawLikes.map((l: any) => ({ ...l, profiles: profMap.get(l.from_user_id) }))
          }
        }

        rows = (likeRows || []).map((r: any) => ({
          id: r.profiles?.id || r.id,
          name: r.profiles?.name || 'UniMatch Student',
          photo: r.profiles?.photo_url || DEFAULT_AVATAR,
          sub: [r.profiles?.course, r.profiles?.campus].filter(Boolean).join(' • ') || 'UniMatch student',
          time: r.created_at,
          badge: '❤️ Liked you',
          chatHref: r.profiles?.id ? `/profile?id=${r.profiles.id}` : '/discover'
        }))
      }

      if (type === 'matches') {
        let matchRows: any[] = []
        try {
          const { data, error } = await supabase
            .from('matches')
            .select('id, created_at, p1:profiles!matches_user1_id_fkey(id, name, photo_url, course, campus), p2:profiles!matches_user2_id_fkey(id, name, photo_url, course, campus)')
            .or(`user1_id.eq.${activeUid},user2_id.eq.${activeUid}`)
            .order('created_at', { ascending: false })
            .limit(50) as any
          if (error) throw error
          matchRows = data || []
        } catch (err) {
          const { data: rawMatches } = await supabase
            .from('matches')
            .select('id, user1_id, user2_id, created_at')
            .or(`user1_id.eq.${activeUid},user2_id.eq.${activeUid}`)
            .order('created_at', { ascending: false })
            .limit(50) as any
          if (rawMatches && rawMatches.length > 0) {
            const otherIds = rawMatches.map((m: any) => m.user1_id === activeUid ? m.user2_id : m.user1_id)
            const { data: profs } = await supabase.from('profiles').select('id, name, photo_url, course, campus').in('id', otherIds) as any
            const profMap = new Map((profs || []).map((p: any) => [p.id, p]))
            matchRows = rawMatches.map((m: any) => {
              const otherId = m.user1_id === activeUid ? m.user2_id : m.user1_id
              return {
                ...m,
                p1: m.user1_id === activeUid ? { id: activeUid } : profMap.get(m.user1_id),
                p2: m.user2_id === activeUid ? { id: activeUid } : profMap.get(m.user2_id),
              }
            })
          }
        }

        rows = (matchRows || []).map((m: any) => {
          const other = m.p1?.id === activeUid ? m.p2 : m.p1
          return {
            id: m.id,
            name: other?.name || 'UniMatch Student',
            photo: other?.photo_url || DEFAULT_AVATAR,
            sub: [other?.course, other?.campus].filter(Boolean).join(' • ') || 'UniMatch student',
            time: m.created_at,
            badge: '🔥 Match',
            chatHref: `/chat?matchId=${m.id}`
          }
        })
      }

      setModalRows(rows)
    } catch (e) {
      console.warn("Modal fetching error:", e)
    } finally {
      setModalLoading(false)
    }
  }

  // Theme Toggle on dropdown change
  const toggleTheme = () => {
    const isLight = document.documentElement.classList.toggle('light-theme')
    localStorage.setItem('theme', isLight ? 'light' : 'dark')
  }

  // User Sign out
  const handleSignOut = () => {
    modal.confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of your UniMatch account?',
      confirmText: 'Sign Out',
      isDanger: true,
      onConfirm: async () => {
        try {
          sessionStorage.clear()
          const { error } = await supabase.auth.signOut()
          if (error) throw error
          modal.toast("You have been logged out.", "info")
          router.push('/login')
        } catch (e) {
          console.error("Logout failed:", e)
          modal.toast("Logout failed. Try again.", "error")
        }
      }
    })
  }

  const relativeTime = (dateInput: Date | string | null) => {
    if (!dateInput) return "Just now"
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(date.getTime())) return "Just now"
    const diff = (Date.now() - date.getTime()) / 1000
    if (diff < 60) return "Just now"
    if (diff < 3600) return Math.floor(diff / 60) + "m ago"
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago"
    return Math.floor(diff / 86400) + "d ago"
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches[0].clientY - touchStartY > 60) {
      setModalOpen(false)
    }
  }

  if (isNetworkError && !getCache('dashboard')) {
    return (
      <div className="dashboard-page">
        <OfflineNotice onRetry={() => { clearNetworkError(); window.location.reload(); }} />
        <BottomNav activeTab="home" />
      </div>
    )
  }

  if (!mounted || loading) {
    return (
      <div className="dashboard-page">
        <DashboardSkeleton />
        <BottomNav activeTab="home" />
      </div>
    )
  }

  const currentCandidate = discoveryPool[activeDiscoveryIndex] || null
  const moreCandidates = discoveryPool.slice(activeDiscoveryIndex + 1, activeDiscoveryIndex + 5)

  // Today's Pick: shared interests first, then the rest
  const pickInterests = todaysPick?.interests || []
  const pickShared = pickInterests.filter(i => myInterests.includes(i))
  const pickChips = [...pickShared, ...pickInterests.filter(i => !myInterests.includes(i))].slice(0, 5)
  const pickCompat = todaysPick?.compat || 92
  const RING_CIRCUMFERENCE = 2 * Math.PI * 30

  const saveVibe = (value: string) => {
    const next = value.trim().slice(0, 40)
    setVibe(next)
    try {
      if (uid) {
        if (next) localStorage.setItem(`unimatch_vibe_${uid}`, next)
        else localStorage.removeItem(`unimatch_vibe_${uid}`)
      }
    } catch { /* storage unavailable — keep in memory only */ }
    setVibeEditorOpen(false)
  }

  // Swipe gestures: drag right to like, left to pass
  const handleSwipeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isActing || (e.pointerType === 'mouse' && e.button !== 0)) return
    dragStartXRef.current = e.clientX
    dragMovedRef.current = false
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleSwipeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null) return
    const dx = e.clientX - dragStartXRef.current
    if (Math.abs(dx) > 6) dragMovedRef.current = true
    setDragX(dx)
  }

  const handleSwipeEnd = () => {
    if (dragStartXRef.current === null) return
    dragStartXRef.current = null
    setIsDragging(false)
    if (currentCandidate && Math.abs(dragX) > SWIPE_THRESHOLD) {
      const action = dragX > 0 ? 'like' : 'pass'
      setDragX(dragX > 0 ? 900 : -900)
      handleDiscoveryAction(action, currentCandidate)
    } else {
      setDragX(0)
    }
  }

  const handleDiscoveryPhotoClick = (candidate: ProfileCandidate) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    openProfileDetailModal(candidate)
  }

  return (
    <div className={`dashboard-page ${displayFont.variable}`}>
      {!isOnline && <OfflineBanner />}

      {/* Ambient animated background */}
      <div className="db-ambient" aria-hidden="true">
        <span className="db-blob db-blob-1"></span>
        <span className="db-blob db-blob-2"></span>
        <span className="db-blob db-blob-3"></span>
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="db-particle" style={{ '--i': i } as React.CSSProperties}></span>
        ))}
      </div>

      {/* ═══ MOBILE TOP HEADER (Photo 1) ═══ */}
      <header className="db-mobile-header">
        <div className="db-mh-text">
          <h1 className="db-mh-title">
            {greeting}, <span className="db-mh-name">{profileName.split(' ')[0] || 'Myles'}</span> 👑
          </h1>
          <p className="db-mh-sub">Ready to find your people?</p>
        </div>
        <Link href="/notifications" className="db-mh-bell-btn" title="Notifications">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="bell-badge-dot"></span>
        </Link>
      </header>

      {/* ═══ DESKTOP TOP NAVBAR (Photo 2) ═══ */}
      <nav className="app-topnav" id="appTopnav">
        <div className="topnav-logo">
          <Image src="/logo/unimatch-logo-192.png" alt="UniMatch" width={32} height={32} style={{ objectFit: 'contain' }} priority />
          <span className="logo-text">UniMatch</span>
        </div>

        <div className="topnav-greeting">
          <span className="greeting-prefix">{greeting},&nbsp;</span>
          <span className="greeting-name">{profileName}</span>&nbsp;👋
        </div>

        <div className="topnav-actions">
          <Link href="/notifications" className="notif-btn" title="Notifications">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </Link>

          <Link href="/profile?edit=true" className="nav-avatar-wrap" title="Your profile">
            <img src={profilePhotoUrl} alt="Your profile" className="nav-avatar-img" />
            <div className="nav-avatar-online"></div>
          </Link>

          <button
            ref={dropdownTriggerRef}
            className="more-btn"
            onClick={() => setIsDropdownOpen(prev => !prev)}
            title="More options"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div ref={dropdownRef} className="avatar-dropdown" style={{ display: 'flex' }}>
              <Link href="/profile?edit=true" className="avatar-dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <span>View Profile</span>
              </Link>
              <Link href="/settings" className="avatar-dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>Settings</span>
              </Link>
              <button className="avatar-dropdown-item" onClick={() => { toggleTheme(); setIsDropdownOpen(false); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                <span>Toggle Theme</span>
              </button>
              <div className="dropdown-divider"></div>
              <button className="avatar-dropdown-item danger" onClick={() => { handleSignOut(); setIsDropdownOpen(false); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ═══ MAIN CONTENT WORKSPACE (2-COLUMN DESKTOP SPLIT) ═══ */}
      <main className="home-scroll" id="homeScroll">
        <div className="db-main-layout">

          {/* ── LEFT COLUMN: MAIN DISCOVERY & PROFILES (~62%) ── */}
          <div className="db-col-primary">

            {/* 1. Compact My Profile Summary Card */}
            <section className="db-my-profile-card glass-card anim-slide-up" style={{ '--delay': '0.05s' } as any}>
              <div className="dmpc-main-content">
                <Link
                  href="/profile?edit=true"
                  className="dmpc-avatar-wrap"
                  style={{ '--pct': completionPct } as React.CSSProperties}
                  aria-label={`Your profile — ${completionPct}% complete`}
                >
                  <img src={profilePhotoUrl} alt="" className="dmpc-avatar-img" />
                  <div className="dmpc-online-dot"></div>
                </Link>
                <div className="dmpc-info">
                  <div className="dmpc-name-row">
                    <h2 className="dmpc-name">{profileName}</h2>
                    {isVerified && (
                      <span className="dmpc-verified-badge" title="Verified Student">✓</span>
                    )}
                  </div>
                  <p className="dmpc-meta">{profileSummary}</p>
                  {!vibeEditorOpen && (
                    <button
                      type="button"
                      className={`dmpc-vibe-chip ${vibe ? '' : 'is-empty'}`}
                      onClick={() => { setVibeDraft(vibe); setVibeEditorOpen(true) }}
                      aria-label={vibe ? `Your vibe: ${vibe}. Edit` : 'Set your vibe status'}
                    >
                      <span className="dmpc-vibe-text">{vibe || '＋ Set your vibe'}</span>
                      {vibe && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {vibeEditorOpen && (
                <form
                  className="dmpc-vibe-editor anim-fade-in"
                  onSubmit={(e) => { e.preventDefault(); saveVibe(vibeDraft) }}
                >
                  <input
                    autoFocus
                    type="text"
                    className="dmpc-vibe-input"
                    maxLength={40}
                    value={vibeDraft}
                    onChange={(e) => setVibeDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setVibeEditorOpen(false) }}
                    placeholder="What's your vibe today?"
                    aria-label="Your vibe status"
                  />
                  <div className="dmpc-vibe-presets">
                    {VIBE_PRESETS.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        className={`dmpc-vibe-preset ${vibeDraft === preset ? 'active' : ''}`}
                        onClick={() => setVibeDraft(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="dmpc-vibe-actions">
                    {vibe && (
                      <button type="button" className="dmpc-vibe-btn ghost" onClick={() => saveVibe('')}>Clear</button>
                    )}
                    <button type="button" className="dmpc-vibe-btn ghost" onClick={() => setVibeEditorOpen(false)}>Cancel</button>
                    <button type="submit" className="dmpc-vibe-btn primary">Save vibe</button>
                  </div>
                </form>
              )}

              <div className="dmpc-progress">
                <div className="dmpc-progress-top">
                  <span>Profile strength</span>
                  <strong>{completionPct}%</strong>
                </div>
                <div
                  className="dmpc-progress-track"
                  role="progressbar"
                  aria-label="Profile completion"
                  aria-valuenow={completionPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${completionPct}%` }}></span>
                </div>
                <Link href="/profile?edit=true" className="dmpc-link-view">
                  {completionPct < 100 ? 'Complete your profile →' : 'View Profile →'}
                </Link>
              </div>
            </section>

            {/* 3 Stats Row */}
            <div className="db-stats-three-row anim-slide-up" style={{ '--delay': '0.08s' } as any}>
              {([
                { type: 'views', label: 'Views' },
                { type: 'likes', label: 'Likes' },
                { type: 'matches', label: 'Matches' },
              ] as const).map(({ type, label }) => (
                <button
                  key={type}
                  className={`db-stat-box glass-card stat-${type}`}
                  onClick={() => openModal(type)}
                  aria-label={`${stats[type]} ${label} — see who`}
                >
                  <span className="db-stat-icon"><StatIcon type={type} /></span>
                  <span className="db-stat-val"><CountUp value={stats[type]} /></span>
                  <span className="db-stat-lbl">{label}</span>
                </button>
              ))}
            </div>

            {/* Today's Pick — hero */}
            {todaysPick && (
              <section className="db-pick-section anim-slide-up" style={{ '--delay': '0.1s' } as any} aria-labelledby="todays-pick-title">
                <div className="db-section-header">
                  <h3 id="todays-pick-title" className="db-section-title">Today&apos;s Pick 🔥</h3>
                  <span className="db-section-sub">Matched on shared interests</span>
                </div>

                <div
                  className="db-pick-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openProfileDetailModal(todaysPick)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfileDetailModal(todaysPick) } }}
                  aria-label={`View ${todaysPick.name}'s profile`}
                >
                  <img src={todaysPick.photo_url || DEFAULT_AVATAR} alt="" className="db-pick-photo" />
                  <div className="db-pick-overlay"></div>

                  <div className="db-pick-ring" aria-label={`${pickCompat}% match`}>
                    <svg viewBox="0 0 72 72" aria-hidden="true">
                      <defs>
                        <linearGradient id="pickRingGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#f472b6" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                      <circle cx="36" cy="36" r="30" className="db-pick-ring-track" />
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        className="db-pick-ring-fill"
                        stroke="url(#pickRingGrad)"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={RING_CIRCUMFERENCE * (1 - pickCompat / 100)}
                        style={{ '--ring-c': RING_CIRCUMFERENCE } as React.CSSProperties}
                      />
                    </svg>
                    <span className="db-pick-ring-val">{pickCompat}%<small>match</small></span>
                  </div>

                  {todaysPick.online && (
                    <span className="db-badge-online db-pick-online"><span className="db-dot-pulse"></span> Online</span>
                  )}

                  <div className="db-pick-body">
                    <div className="db-pick-name-row">
                      <h4 className="db-pick-name">{todaysPick.name}{todaysPick.age ? `, ${todaysPick.age}` : ''}</h4>
                      {todaysPick.verified && <span className="db-verified-badge" title="Verified Student">✓</span>}
                    </div>
                    <p className="db-pick-meta">
                      {[todaysPick.course, todaysPick.campus || todaysPick.university || 'Kabarak University'].filter(Boolean).join(' · ')}
                    </p>
                    {todaysPick.bio && <p className="db-pick-bio">{todaysPick.bio}</p>}

                    {pickChips.length > 0 && (
                      <div className="db-pick-chips">
                        {pickChips.map((tag, idx) => (
                          <span key={idx} className={`db-pick-chip ${pickShared.includes(tag) ? 'is-shared' : ''} tone-${idx % 4}`}>
                            {pickShared.includes(tag) && <span aria-hidden="true">💞 </span>}
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {pickShared.length > 0 && (
                      <p className="db-pick-common">{pickShared.length} interest{pickShared.length === 1 ? '' : 's'} in common</p>
                    )}

                    <button
                      type="button"
                      className="db-pick-connect"
                      onClick={(e) => { e.stopPropagation(); openProfileDetailModal(todaysPick) }}
                    >
                      Connect
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* 2. Main Discovery Hero Section */}
            <section className="db-discovery-section anim-slide-up" style={{ '--delay': '0.12s' } as any}>
              <div className="db-section-header">
                <div className="db-section-title-wrap">
                  <h3 className="db-section-title">Discover People 💫</h3>
                  {currentCandidate && (
                    <span className="db-section-sub">Swipe right to like · left to pass</span>
                  )}
                </div>
                <Link href="/discover" className="db-section-link">See all</Link>
              </div>

              {currentCandidate ? (
                <div
                  className={`db-hero-disc-card glass-card ${actionFeedback ? `acting-${actionFeedback}` : ''} ${isDragging ? 'is-dragging' : ''}`}
                  style={dragX !== 0 ? { transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)` } : undefined}
                >
                  {/* Left and Right Nav Arrow Buttons for Desktop (Photo 2) */}
                  <button
                    type="button"
                    className="db-disc-arrow-btn prev"
                    onClick={(e) => { e.stopPropagation(); setActiveDiscoveryIndex(prev => Math.max(0, prev - 1)); }}
                    title="Previous"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="db-disc-arrow-btn next"
                    onClick={(e) => { e.stopPropagation(); setActiveDiscoveryIndex(prev => prev + 1); }}
                    title="Next"
                  >
                    ›
                  </button>

                  {/* Background / Cover Image */}
                  <div
                    className="db-disc-photo-wrap"
                    onClick={() => handleDiscoveryPhotoClick(currentCandidate)}
                    onPointerDown={handleSwipeStart}
                    onPointerMove={handleSwipeMove}
                    onPointerUp={handleSwipeEnd}
                    onPointerCancel={handleSwipeEnd}
                  >
                    <img
                      src={currentCandidate.photo_url || DEFAULT_AVATAR}
                      alt={currentCandidate.name}
                      className="db-disc-photo"
                      draggable={false}
                    />
                    <div className="db-disc-gradient-overlay"></div>

                    {/* Swipe stamps */}
                    <span
                      className="db-swipe-stamp like"
                      style={{ opacity: Math.max(0, Math.min(1, dragX / SWIPE_THRESHOLD)) }}
                      aria-hidden="true"
                    >
                      LIKE
                    </span>
                    <span
                      className="db-swipe-stamp nope"
                      style={{ opacity: Math.max(0, Math.min(1, -dragX / SWIPE_THRESHOLD)) }}
                      aria-hidden="true"
                    >
                      NOPE
                    </span>

                    {/* Top Right Online Badge */}
                    <div className="db-disc-top-badges">
                      <span className="db-badge-online">
                        <span className="db-dot-pulse"></span> Online
                      </span>
                    </div>

                    {/* Profile Information Overlay */}
                    <div className="db-disc-content">
                      <div className="db-disc-name-row">
                        <h4 className="db-disc-name">
                          {currentCandidate.name}
                        </h4>
                        {currentCandidate.verified && (
                          <span className="db-verified-badge" title="Verified Student">✓</span>
                        )}
                      </div>

                      <p className="db-disc-meta">
                        {currentCandidate.age ? `${currentCandidate.age} • ` : ''}{currentCandidate.course || 'Business Information Technology'}
                      </p>

                      <p className="db-disc-campus">
                        {currentCandidate.university || currentCandidate.campus || 'Kabarak University'}
                      </p>

                      {currentCandidate.interests && currentCandidate.interests.length > 0 && (
                        <div className="db-disc-tags">
                          {currentCandidate.interests.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="db-disc-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="db-disc-distance">
                        {currentCandidate.location_name || '2.4 km away'}
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom Floating Actions Bar */}
                  <div className="db-disc-actions-bar">
                    <button
                      type="button"
                      className="db-action-btn btn-pass"
                      onClick={() => handleDiscoveryAction('pass', currentCandidate)}
                      disabled={isActing}
                      title="Pass"
                    >
                      ✕
                    </button>

                    <button
                      type="button"
                      className="db-action-btn btn-like"
                      onClick={() => handleDiscoveryAction('like', currentCandidate)}
                      disabled={isActing}
                      title="Like"
                    >
                      💖
                    </button>
                  </div>
                </div>
              ) : (
                <div className="db-empty-discovery glass-card">
                  <div className="db-empty-illustration" aria-hidden="true">
                    <span className="dei-ring dei-ring-1"></span>
                    <span className="dei-ring dei-ring-2"></span>
                    <span className="dei-core">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
                      </svg>
                    </span>
                    <span className="dei-orbit dei-orbit-1"><span className="dei-heart">💗</span></span>
                    <span className="dei-orbit dei-orbit-2"><span className="dei-heart">💜</span></span>
                    <span className="dei-orbit dei-orbit-3"><span className="dei-heart">✨</span></span>
                  </div>
                  <h4 className="db-empty-title">You&apos;ve seen everyone for now!</h4>
                  <p className="db-empty-sub">New students join every day. Explore Discover with filters for campus, course and year to find more people.</p>
                  <Link href="/discover" className="db-btn-explore">
                    Go Explore →
                  </Link>
                </div>
              )}
            </section>

            {/* 3. "More People for You" Row */}
            {moreCandidates.length > 0 && (
              <section className="db-more-people-section anim-slide-up" style={{ '--delay': '0.18s' } as any}>
                <div className="db-section-header">
                  <div className="db-section-title-wrap">
                    <h3 className="db-section-title">More people for you</h3>
                  </div>
                </div>

                <div className="db-more-people-grid">
                  {moreCandidates.map(candidate => (
                    <div
                      key={candidate.id}
                      className="db-mini-user-card glass-card"
                      onClick={() => openProfileDetailModal(candidate)}
                    >
                      <img src={candidate.photo_url || DEFAULT_AVATAR} alt={candidate.name} className="dmuc-avatar-img" />
                      <div className="dmuc-overlay"></div>
                      <div className="dmuc-online-dot"></div>

                      <div className="dmuc-info">
                        <div className="dmuc-name">
                          {candidate.name}
                        </div>
                        <div className="dmuc-sub">
                          {candidate.location_name || '3.1 km'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Start a Conversation Widget (Desktop Photo 2 bottom left) */}
            <div className="db-start-conversation-card glass-card anim-slide-up" style={{ '--delay': '0.24s' } as any}>
              <div className="dsc-icon-circle">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <div className="dsc-content">
                <h4 className="dsc-title">Start a conversation</h4>
                <p className="dsc-sub">No conversations yet</p>
                <p className="dsc-hint">Find someone you like and start chatting.</p>
                <Link href="/discover" className="dsc-btn">
                  Discover People →
                </Link>
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN: SIDEBAR WIDGETS (~38%) ── */}
          <div className="db-col-sidebar">

            {/* 5. Campus Pulse Widget 🌐 */}
            <section className="db-widget-block anim-slide-up" style={{ '--delay': '0.20s' } as any}>
              <div className="db-section-header">
                <h3 className="db-section-title">Campus Pulse 🌐</h3>
                <span className="pulse-live-badge"><span className="pulse-live-dot"></span>LIVE</span>
              </div>

              <div className="pulse-tabs-container" role="tablist" data-active={activeTab}>
                <span className="pulse-tab-indicator" aria-hidden="true"></span>
                <button role="tab" aria-selected={activeTab === 'spots'} className={`pulse-tab-btn ${activeTab === 'spots' ? 'active' : ''}`} onClick={() => setActiveTab('spots')}>
                  📍 Campus Spots
                </button>
                <button role="tab" aria-selected={activeTab === 'radar'} className={`pulse-tab-btn ${activeTab === 'radar' ? 'active' : ''}`} onClick={() => setActiveTab('radar')}>
                  📡 Radar Scan
                </button>
              </div>

              {activeTab === 'spots' ? (
                <div className="campus-pulse-card glass-card">
                  {/* 1. Global Presence Search */}
                  <div className="pulse-search-wrap">
                    <div className="pulse-search-box">
                      <svg className="pulse-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        type="search"
                        aria-label="Search a student to see where they are"
                        className="pulse-search-input"
                        placeholder="Search a name to find where they are..."
                        value={presenceSearch}
                        onChange={(e) => setPresenceSearch(e.target.value)}
                      />
                      {presenceSearch && (
                        <button className="pulse-search-clear" onClick={() => setPresenceSearch('')}>✕</button>
                      )}
                    </div>

                    {presenceSearch.trim() !== '' && (
                      <div className="pulse-search-results">
                        {presenceSearchLoading ? (
                          <div className="pulse-search-loading">Searching students...</div>
                        ) : presenceResults.length > 0 ? (
                          presenceResults.map((res: any) => (
                            <div key={res.id} className="pulse-search-row">
                              <img src={res.photo_url} alt={res.name} className="psr-avatar" />
                              <div className="psr-info">
                                <div className="psr-name">{res.name}</div>
                                <div className="psr-sub">{[res.course, res.campus].filter(Boolean).join(' · ')}</div>
                                <div className="psr-spot-badge">
                                  {res.spot ? `📍 Checked into ${res.spot}` : 'Not checked into any spot'}
                                </div>
                              </div>
                              <div className="psr-actions">
                                <Link href={`/profile?id=${res.id}`} className="psr-btn">Profile</Link>
                                <Link href={`/chat?userId=${res.id}`} className="psr-btn psr-btn-primary">Chat 👋</Link>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="pulse-search-empty">No students found matching &quot;{presenceSearch}&quot;</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Space-Saving Category Preview Cards (when collapsed) */}
                  {spotCategoryTab === null ? (
                    <div className="spot-category-preview-grid">
                      <div
                        className="spot-category-card"
                        onClick={() => handleCategoryTabChange('inside')}
                      >
                        <div className="scc-icon">🏛️</div>
                        <div className="scc-content">
                          <div className="scc-title">Inside Campus</div>
                          <div className="scc-desc">Student Center, Library, Hostels &amp; more</div>
                        </div>
                        <div className="scc-action">Explore Spots →</div>
                      </div>

                      <div
                        className="spot-category-card"
                        onClick={() => handleCategoryTabChange('outside')}
                      >
                        <div className="scc-icon">🌴</div>
                        <div className="scc-content">
                          <div className="scc-title">Outside Campus</div>
                          <div className="scc-desc">Cheche, Whitehouse, Elevate, Lexy &amp; more</div>
                        </div>
                        <div className="scc-action">Explore Spots →</div>
                      </div>
                    </div>
                  ) : (
                    /* 3. Expanded Category View */
                    <div className="spot-expanded-container anim-fade-in">
                      <div className="spot-category-tabs-bar">
                        <div className="spot-category-tabs" role="tablist" data-active={spotCategoryTab}>
                          <span className="spot-cat-indicator" aria-hidden="true"></span>
                          <button
                            role="tab"
                            aria-selected={spotCategoryTab === 'inside'}
                            className={`spot-cat-pill ${spotCategoryTab === 'inside' ? 'active' : ''}`}
                            onClick={() => handleCategoryTabChange('inside')}
                          >
                            🏛️ Inside Campus
                          </button>
                          <button
                            role="tab"
                            aria-selected={spotCategoryTab === 'outside'}
                            className={`spot-cat-pill ${spotCategoryTab === 'outside' ? 'active' : ''}`}
                            onClick={() => handleCategoryTabChange('outside')}
                          >
                            🌴 Outside Campus
                          </button>
                        </div>
                      </div>

                      {/* Spots Cards Grid */}
                      <div className="spots-grid">
                        {campusSpots
                          .filter(s => s.category === spotCategoryTab)
                          .map(spot => {
                            const isHere = myCurrentSpot === spot.name
                            const liveCount = spot.liveCount || spotCounts[spot.name] || 0
                            return (
                              <div
                                key={spot.id}
                                className={`spot-card-item ${isHere ? 'checked-in' : ''}`}
                                onClick={() => {
                                  setActiveWhoIsHereSpot(spot.name)
                                  if (uid) fetchCheckedInUsers(uid, spot.name)
                                }}
                              >
                                <div className="spot-card-top">
                                  <span className="spot-card-icon">{renderSpotIcon(spot.icon)}</span>
                                  <span className={`spot-count-pill ${liveCount > 0 ? 'active' : ''}`}>
                                    {liveCount} {liveCount === 1 ? 'student' : 'students'}
                                  </span>
                                </div>
                                <div className="spot-card-name">{spot.name}</div>
                                <button
                                  className={`spot-toggle-btn ${isHere ? 'active' : ''}`}
                                  disabled={!isOnline}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleSpotCheckin(spot.name)
                                  }}
                                >
                                  {isHere ? 'Checked In ✓' : 'Check In 📍'}
                                </button>
                              </div>
                            )
                          })}
                      </div>

                      {/* "Who's Here" Avatar Section */}
                      {activeWhoIsHereSpot && (
                        <div className="whos-here-section">
                          <div className="whos-here-header" onClick={() => setShowWhoIsHereModal(true)}>
                            <div className="whos-here-title-wrap">
                              <span className="whos-here-title">Who&apos;s at {activeWhoIsHereSpot} right now</span>
                              <span className="whos-here-sub">{whoIsHereUsers.length} student{whoIsHereUsers.length === 1 ? '' : 's'} checked in</span>
                            </div>
                            <button className="whos-here-view-all" onClick={() => setShowWhoIsHereModal(true)}>See all →</button>
                          </div>

                          {whoIsHereUsers.length > 0 ? (
                            <div className="whos-here-avatars-row" onClick={() => setShowWhoIsHereModal(true)}>
                              <div className="whos-here-stack">
                                {whoIsHereUsers.slice(0, 5).map((u, i) => (
                                  <Image
                                    key={u.id || i}
                                    src={u.photo_url || DEFAULT_AVATAR}
                                    alt={u.name || 'User'}
                                    width={36}
                                    height={36}
                                    className="whos-here-stack-img"
                                    style={{ zIndex: 10 - i }}
                                    title={u.name}
                                  />
                                ))}
                              </div>
                              {whoIsHereUsers.length > 5 && (
                                <div className="whos-here-more-badge">+{whoIsHereUsers.length - 5} more</div>
                              )}
                            </div>
                          ) : (
                            <div className="whos-here-empty">Be the first to check in at {activeWhoIsHereSpot}! 🌟</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="campus-pulse-card glass-card">
                  <div className="radar-ranges">
                    {[100, 500, 1000, 2000].map(r => (
                      <button
                        key={r}
                        className={`range-btn ${radarRange === r ? 'active' : ''}`}
                        onClick={() => {
                          setRadarRange(r)
                          if (gpsLat !== null && gpsLng !== null) {
                            fetchRadarDots(uid!, gpsLat, gpsLng, r)
                          } else {
                            fetchRadarFallback(uid!)
                          }
                        }}
                      >
                        {r >= 1000 ? `${r/1000}km` : `${r}m`}
                      </button>
                    ))}
                  </div>

                  <div className="radar-wrap">
                    <canvas ref={canvasRef} width="280" height="280"></canvas>
                  </div>
                  <div className="radar-status">
                    <span className="radar-count-wrap">
                      <span className="radar-count-num">{radarCount}</span>
                      <span className="radar-count-lbl">students nearby</span>
                    </span>
                    <span className="radar-hint">{radarHint}</span>
                  </div>
                </div>
              )}
            </section>

            {/* 6. Activity Feed Widget */}
            <section className="db-widget-block anim-slide-up" style={{ '--delay': '0.26s' } as any}>
              <div className="db-section-header">
                <h3 className="db-section-title">Recent Activity</h3>
                <Link href="/notifications" className="db-section-link">See all</Link>
              </div>

              <div className="activity-feed glass-card">
                {activityEvents && activityEvents.length > 0 ? (
                  activityEvents.map((ev, i) => (
                    <div
                      key={i}
                      className={`activity-item ${ev.link ? 'activity-item--clickable' : ''}`}
                      onClick={() => ev.link && router.push(ev.link)}
                    >
                      <div className={`activity-emoji ${ev.cls || ''}`}>{ev.emoji}</div>
                      <div className="activity-text"><strong>{ev.name}</strong> {ACTIVITY_LABELS[ev.type] || 'interacted with you'}</div>
                      <div className="activity-time">{ev.time ? (typeof ev.time === 'string' ? ev.time : relativeTime(ev.time)) : (i === 0 ? 'Just now' : i === 1 ? '5m ago' : '1h ago')}</div>
                    </div>
                  ))
                ) : (
                  <div
                    className="activity-item activity-item--clickable"
                    onClick={() => router.push('/discover')}
                  >
                    <div className="activity-emoji">🎉</div>
                    <div className="activity-text"><strong>Welcome to UniMatch!</strong> Start swiping to find matches</div>
                    <div className="activity-time">Just now</div>
                  </div>
                )}
              </div>
            </section>

            {/* 7. Recent Chats Widget */}
            <section className="db-widget-block anim-slide-up" style={{ '--delay': '0.32s' } as any}>
              <div className="db-section-header">
                <h3 className="db-section-title">Recent Chats</h3>
                <Link href="/matches" className="db-section-link">See all</Link>
              </div>

              <div className="recent-chats glass-card">
                {recentChatsList && recentChatsList.length > 0 ? (
                  recentChatsList.map(m => (
                    <Link href={`/chat?matchId=${m.id}`} key={m.id} className="chat-item">
                      <div className="chat-avatar-wrap">
                        <img className="chat-avatar" src={m.photo_url || DEFAULT_AVATAR} alt={m.name} />
                        {m.online && <div className="chat-online"></div>}
                      </div>
                      <div className="chat-meta">
                        <div className="chat-name">{m.name}</div>
                        <div className="chat-preview">{m.last_message}</div>
                      </div>
                      <div className="chat-right">
                        <div className="chat-time">{m.last_message_at ? (typeof m.last_message_at === 'string' && m.last_message_at.includes('ago') ? m.last_message_at : relativeTime(new Date(m.last_message_at))) : '2m ago'}</div>
                        {m.unread > 0 && <span className="chat-unread">{m.unread}</span>}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="chat-empty-state">
                    <span className="chat-empty-icon">💬</span>
                    <p className="chat-empty-text">No conversations yet — start matching!</p>
                    <Link href="/discover" className="btn-start-disc">Start Discovering →</Link>
                  </div>
                )}
              </div>
            </section>

          </div>

        </div>

        <div className="home-bottom-space"></div>
      </main>

      {/* ═══ FULL PROFILE VIEW MODAL ═══ */}
      {selectedProfileModal && (
        <div className="db-profile-modal-backdrop" onClick={() => setSelectedProfileModal(null)}>
          <div className="db-profile-modal-sheet anim-slide-up" onClick={e => e.stopPropagation()}>
            <div className="dpm-header">
              <button
                type="button"
                className="dpm-close-btn"
                onClick={() => setSelectedProfileModal(null)}
                title="Close"
              >
                ✕
              </button>
              <h4 className="dpm-title">{selectedProfileModal.name}'s Profile</h4>
              <div style={{ width: 32 }}></div>
            </div>

            <div className="dpm-body">
              {/* Photo Carousel */}
              <div className="dpm-photo-wrap">
                <img
                  src={modalPhotos[activeModalPhotoIdx] || selectedProfileModal.photo_url || DEFAULT_AVATAR}
                  alt={selectedProfileModal.name}
                  className="dpm-main-photo"
                />
                {modalPhotos.length > 1 && (
                  <div className="dpm-photo-dots">
                    {modalPhotos.map((_, i) => (
                      <span
                        key={i}
                        className={`dpm-dot ${i === activeModalPhotoIdx ? 'active' : ''}`}
                        onClick={() => setActiveModalPhotoIdx(i)}
                      ></span>
                    ))}
                  </div>
                )}
              </div>

              {/* Main Info */}
              <div className="dpm-info-section">
                <div className="dpm-name-row">
                  <h3 className="dpm-name">
                    {selectedProfileModal.name}{selectedProfileModal.age ? `, ${selectedProfileModal.age}` : ''}
                  </h3>
                  {selectedProfileModal.verified && <span className="dpm-verified-pill">✓ Verified</span>}
                </div>

                <p className="dpm-course-text">
                  {[selectedProfileModal.course, selectedProfileModal.campus || selectedProfileModal.university || 'Kabarak University'].filter(Boolean).join(' • ')}
                </p>

                {selectedProfileModal.bio && (
                  <div className="dpm-bio-card">
                    <h5 className="dpm-section-lbl">About</h5>
                    <p className="dpm-bio-text">{selectedProfileModal.bio}</p>
                  </div>
                )}

                {selectedProfileModal.interests && selectedProfileModal.interests.length > 0 && (
                  <div className="dpm-interests-card">
                    <h5 className="dpm-section-lbl">Interests</h5>
                    <div className="dpm-tags-grid">
                      {selectedProfileModal.interests.map((tag, idx) => (
                        <span key={idx} className="dpm-tag-pill">
                          ✨ {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="dpm-bottom-actions">
              <button
                type="button"
                className="dpm-action-pass"
                onClick={() => handleDiscoveryAction('pass', selectedProfileModal)}
                disabled={isActing}
              >
                ✕ Pass
              </button>

              <Link
                href={`/chat?userId=${selectedProfileModal.id}&user=${encodeURIComponent(selectedProfileModal.name)}`}
                className="dpm-action-chat"
              >
                Chat 👋
              </Link>

              <button
                type="button"
                className="dpm-action-like"
                onClick={() => handleDiscoveryAction('like', selectedProfileModal)}
                disabled={isActing}
              >
                💖 Like
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STATS MODAL BOTTOM SHEET ═══ */}
      {modalOpen && (
        <>
          <div className="sm-backdrop sm-open" onClick={() => setModalOpen(false)}></div>
          <div
            className="sm-sheet sm-open"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="sm-handle" style={{ display: 'block' }}></div>
            <div className="sm-header">
              <div className="sm-icon">
                {modalType === 'views' ? '👀' : modalType === 'likes' ? '❤️' : '🔥'}
              </div>
              <div>
                <div className="sm-title">
                  {modalType === 'views' ? 'Profile Views' : modalType === 'likes' ? 'Likes Received' : 'Your Matches'}
                </div>
                <div className="sm-subtitle">
                  {modalType === 'views' ? 'People who visited your profile' : modalType === 'likes' ? 'People who liked your profile' : 'Mutual connections on UniMatch'}
                </div>
              </div>
              <button className="sm-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="sm-body">
              {modalLoading ? (
                <div className="sm-loading"><div className="sm-spinner"></div></div>
              ) : modalRows.length > 0 ? (
                modalRows.map((r, i) => (
                  <Link href={r.chatHref} key={i} className="sm-row" onClick={() => setModalOpen(false)} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <img className="sm-avatar" src={r.photo} alt={r.name} />
                    <div className="sm-row-info">
                      <div className="sm-row-name">{r.name}</div>
                      <div className="sm-row-sub">{r.sub}</div>
                    </div>
                    <div className="sm-row-right">
                      {r.badge && <span className="sm-badge">{r.badge}</span>}
                      <span className="sm-time">{r.time ? relativeTime(new Date(r.time)) : ""}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="sm-empty">
                  <div className="sm-empty-icon">
                    {modalType === 'views' ? '👀' : modalType === 'likes' ? '❤️' : '🔥'}
                  </div>
                  <p className="sm-empty-msg">No {modalType} yet — keep exploring!</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ WHO'S HERE MODAL ═══ */}
      {showWhoIsHereModal && activeWhoIsHereSpot && (
        <div className="modal-backdrop" onClick={() => setShowWhoIsHereModal(false)}>
          <div className="modal-card whos-here-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📍 Who's at {activeWhoIsHereSpot}</h3>
              <button className="modal-close" onClick={() => setShowWhoIsHereModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {whoIsHereUsers.length > 0 ? (
                <div className="whos-here-list">
                  {whoIsHereUsers.map(u => (
                    <div key={u.id} className="whos-here-item">
                      <Image src={u.photo_url || DEFAULT_AVATAR} alt={u.name} width={42} height={42} className="whos-here-item-avatar" />
                      <div className="whos-here-item-info">
                        <div className="whos-here-item-name">{u.name}</div>
                        <div className="whos-here-item-sub">{[u.course, u.campus].filter(Boolean).join(' • ')}</div>
                      </div>
                      <div className="whos-here-item-actions">
                        <button
                          type="button"
                          className="whos-here-act-btn"
                          onClick={() => {
                            setShowWhoIsHereModal(false)
                            openProfileDetailModal(u as any)
                          }}
                        >
                          Profile
                        </button>
                        <Link href={`/chat?userId=${u.id}&user=${encodeURIComponent(u.name)}`} className="whos-here-act-btn primary" onClick={() => setShowWhoIsHereModal(false)}>
                          Chat 👋
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="whos-here-empty-modal">No students currently checked in here.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slanted Nav / Bottom Navigation (Active: Home) */}
      <BottomNav activeTab="home" matchesBadge={stats.matches} unreadBadge={stats.unreadMessages} />
    </div>
  )
}
