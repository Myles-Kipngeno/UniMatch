'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { ICEBREAKERS } from '@/lib/icebreakers'
import { DEFAULT_AVATAR } from '@/lib/constants'
import './dashboard.css'

const CAMPUS_SPOTS = [
  { id: "library", name: "Library", emoji: "📚" },
  { id: "cafe", name: "Café", emoji: "☕" },
  { id: "halls", name: "Lecture Halls", emoji: "🏛️" },
  { id: "gym", name: "Campus Gym", emoji: "🏋️" },
  { id: "hostels", name: "Student Hostels", emoji: "🏢" }
]

interface DashboardStats {
  views: number
  likes: number
  matches: number
  unreadMessages: number
}

interface ActivityEvent {
  type: 'view' | 'like' | 'join'
  name: string
  time: Date | null
  emoji: string
  cls: string
  text?: string
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
  time: string
  badge: string | null
  chatHref: string
}

interface DiscoverPreview {
  name: string
  photo_url: string
  meta: string
  interests: string[]
}

interface CheckedInUser {
  id: string
  name: string
  photo_url: string
  course: string
  campus: string
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const currentIcebreaker = ICEBREAKERS[Math.floor(Date.now() / 86400000) % ICEBREAKERS.length]

  // User Profile States
  const [uid, setUid] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('Student')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(DEFAULT_AVATAR)
  const [profileSummary, setProfileSummary] = useState('Loading your profile...')
  const [completionPct, setCompletionPct] = useState(0)
  const [greeting, setGreeting] = useState('Good morning')

  // UI / App States
  const [stats, setStats] = useState<DashboardStats>({ views: 0, likes: 0, matches: 0, unreadMessages: 0 })
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [recentChatsList, setRecentChatsList] = useState<MatchChat[]>([])
  const [discoverPreview, setDiscoverPreview] = useState<DiscoverPreview | null>(null)
  const [todaysPick, setTodaysPick] = useState<DiscoverPreview & { compat: number } | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Dropdown DOM Refs
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null)

  // Single outside-click dismiss listener pattern
  useEffect(() => {
    if (!isDropdownOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        dropdownTriggerRef.current && !dropdownTriggerRef.current.contains(target)
      ) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isDropdownOpen])

  // Spots / Check-in States
  const [activeTab, setActiveTab] = useState<'spots' | 'radar'>('spots')
  const [myCurrentSpot, setMyCurrentSpot] = useState<string | null>(null)
  const [spotCounts, setSpotCounts] = useState<Record<string, number>>({})
  const [checkedUsers, setCheckedUsers] = useState<CheckedInUser[]>([])
  const [spotLoading, setSpotLoading] = useState(false)

  // Radar / Geolocation States
  const [radarRange, setRadarRange] = useState<number>(2000)
  const [radarCount, setRadarCount] = useState<number | string>('—')
  const [radarHint, setRadarHint] = useState('Initialising radar…')
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sweepAngleRef = useRef(0)
  const dotsRef = useRef<any[]>([])

  // Modal stats sheet
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'views' | 'likes' | 'matches'>('views')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalRows, setModalRows] = useState<ModalRow[]>([])

  // Touch Swipe-to-close state
  const [touchStartY, setTouchStartY] = useState(0)

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

        // Completion percentage
        const fields = ["name", "bio", "course", "campus", "photo_url", "age", "gender", "interests"]
        const filled = fields.filter(f => {
          const val = (profile as any)[f]
          return val && (Array.isArray(val) ? val.length > 0 : String(val).trim() !== "")
        }).length
        setCompletionPct(Math.round((filled / fields.length) * 100))

        // Initial Data Fetchers
        await Promise.all([
          fetchStats(user.id),
          fetchChats(user.id),
          fetchActivity(user.id),
          fetchDiscoverPreview(user.id),
          fetchTodaysPick(user.id, profile.interests || []),
          fetchSpots(user.id),
          initLocation(user.id)
        ])
      }
      setLoading(false)
    }

    initDashboard()
  }, [supabase, router])

  // Realtime Subscriptions (cleanup on unmount)
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

    return () => {
      supabase.removeChannel(statsChannel)
      supabase.removeChannel(presenceChannel)
    }
  }, [uid, gpsLat, gpsLng, radarRange])

  // Canvas Animation loop (cleanup on unmount / state change)
  useEffect(() => {
    if (activeTab !== 'radar' || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    const SWEEP_SPEED = 0.022
    const TRAIL_ANGLE = Math.PI * 0.42
    const DOT_LERP = 0.06

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

      // Distance rings
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

      // Rotating line
      sweepAngleRef.current = (sweepAngleRef.current + SWEEP_SPEED) % (Math.PI * 2)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(sweepAngleRef.current)

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
      dotsRef.current.forEach(dot => {
        dot.x += (dot.tx - dot.x) * DOT_LERP
        dot.y += (dot.ty - dot.y) * DOT_LERP

        const dotAngle = ((Math.atan2(dot.y - cy, dot.x - cx) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const sweepNorm = ((sweepAngleRef.current - TRAIL_ANGLE * 0.05) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
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

      // Center self dot
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

  // Geolocation coordination sync interval
  useEffect(() => {
    if (!uid || gpsLat === null) return

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        async p => {
          const lat = Math.round(p.coords.latitude * 100) / 100
          const lng = Math.round(p.coords.longitude * 100) / 100
          setGpsLat(lat)
          setGpsLng(lng)
          await upsertPresence(uid, lat, lng, myCurrentSpot)
          fetchRadarDots(uid, lat, lng, radarRange)
        },
        () => {},
        { maximumAge: 30000 }
      )
    }, 60000)

    return () => clearInterval(interval)
  }, [uid, gpsLat, gpsLng, radarRange, myCurrentSpot])

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

        await upsertPresence(userId, lat, lng, myCurrentSpot)
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
  const upsertPresence = async (userId: string, lat: number | null, lng: number | null, spotName: string | null) => {
    try {
      await (supabase.from('presence' as any) as any).upsert(
        { user_id: userId, online: true, location_name: spotName, lat, lng, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    } catch (e) {
      console.warn("Presence upsert:", e)
    }
  }

  // Spots count query
  const fetchSpots = async (userId: string) => {
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('presence' as any)
        .select('location_name, user_id')
        .eq('online', true)
        .gte('updated_at', cutoff) as any

      const myPres = data?.find((p: any) => p.user_id === userId)
      setMyCurrentSpot(myPres ? myPres.location_name : null)

      const counts: Record<string, number> = {}
      data?.forEach((p: any) => {
        if (p.location_name) {
          counts[p.location_name] = (counts[p.location_name] || 0) + 1
        }
      })
      setSpotCounts(counts)

      if (myPres && myPres.location_name) {
        fetchCheckedInUsers(userId, myPres.location_name)
      } else {
        setCheckedUsers([])
      }
    } catch (e) {
      console.warn("Spots loading error:", e)
    }
  }

  // Spots check-in toggle check-in
  const toggleSpotCheckin = async (spotName: string) => {
    if (!uid) return
    const isCheckingOut = myCurrentSpot === spotName
    const nextSpot = isCheckingOut ? null : spotName
    setMyCurrentSpot(nextSpot)

    try {
      await upsertPresence(uid, gpsLat, gpsLng, nextSpot)
      await fetchSpots(uid)
    } catch (e) {
      console.warn("Toggle check-in error:", e)
    }
  }

  // Checked-in users list
  const fetchCheckedInUsers = async (userId: string, spotName: string) => {
    setSpotLoading(true)
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('presence' as any)
        .select('user_id, profiles!presence_user_id_fkey(name, photo_url, course, campus)')
        .eq('location_name', spotName)
        .eq('online', true)
        .neq('user_id', userId)
        .gte('updated_at', cutoff) as any

      if (data) {
        const users = data.map((p: any) => {
          const prof = p.profiles || {}
          return {
            id: p.user_id,
            name: prof.name || 'Unknown',
            photo_url: prof.photo_url || DEFAULT_AVATAR,
            course: prof.course || '',
            campus: prof.campus || ''
          }
        })
        setCheckedUsers(users)
      }
    } catch (e) {
      console.warn("Checked users query error:", e)
    } finally {
      setSpotLoading(false)
    }
  }

  // GPS Radar dots fetcher
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

        const old = dotsRef.current.find(o => o.id === d.user_id)
        return { id: d.user_id, x: old?.x ?? finalX, y: old?.y ?? finalY, tx: finalX, ty: finalY, pingTime: old?.pingTime ?? 0 }
      })

      dotsRef.current = mapped
      setRadarHint(`Showing students within ~${range >= 1000 ? (range / 1000) + 'km' : range + 'm'}`)
    } catch (e) {
      console.warn("Dots loading error:", e)
    }
  }

  // Fallback Radar dots
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
        const hash = [...d.user_id].reduce((a, c) => a + c.charCodeAt(0), 0)
        const angle = (hash * 137.508) % 360 * (Math.PI / 180)
        const dist = (((hash * 7919) % 72) + 16) / 100 * r * 0.85
        const tx = cx + Math.cos(angle) * dist
        const ty = cy + Math.sin(angle) * dist
        const old = dotsRef.current.find(o => o.id === d.user_id)
        return { id: d.user_id, x: old?.x ?? tx, y: old?.y ?? ty, tx, ty, pingTime: old?.pingTime ?? 0 }
      })

      dotsRef.current = mapped
    } catch (e) {
      console.warn("Dots fallback loading error:", e)
    }
  }

  // Stats Database Query
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

      if (data) {
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
      }
    } catch (e) {
      console.warn("Chats load error:", e)
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
      list.push(
        { type: 'join', name: 'UniMatch', time: null, emoji: '🎉', cls: 'activity-dot--join', text: 'Welcome to UniMatch! Start swiping to find matches' },
        { type: 'view', name: 'Get started', time: null, emoji: '👀', cls: 'activity-dot--view', text: 'Complete your profile to get more views' }
      )
    }

    list.sort((a, b) => {
      if (!a.time) return 1
      if (!b.time) return -1
      return b.time.getTime() - a.time.getTime()
    })

    setActivityEvents(list.slice(0, 5))
  }

  // Discover preview candidate loading
  const fetchDiscoverPreview = async (userId: string) => {
    try {
      const { data: liked } = await supabase.from('likes').select('to_user_id').eq('from_user_id', userId) as any
      const { data: passed } = await supabase.from('passes').select('to_user_id').eq('from_user_id', userId) as any

      const excluded = [userId, ...(liked || []).map((l: any) => l.to_user_id), ...(passed || []).map((p: any) => p.to_user_id)]

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('profile_complete', true)
        .not('id', 'in', `(${excluded.join(',')})`)
        .limit(10) as any

      if (profiles && profiles.length > 0) {
        const next = profiles[0]
        setDiscoverPreview({
          name: next.name || 'Student',
          photo_url: next.photo_url || DEFAULT_AVATAR,
          meta: [next.course, next.campus].filter(Boolean).join(' · ') || 'UniMatch student',
          interests: (next.interests || []).slice(0, 3)
        })
      } else {
        setDiscoverPreview(null)
      }
    } catch (e) {
      console.warn("Discover preview error:", e)
    }
  }

  // Today's best match pick
  const fetchTodaysPick = async (userId: string, myInterests: string[]) => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', userId)
        .eq('profile_complete', true)
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
          name: pick.name || 'Student',
          photo_url: pick.photo_url || DEFAULT_AVATAR,
          meta: [pick.course, pick.campus].filter(Boolean).join(' · ') || 'UniMatch student',
          interests: (pick.interests || []).slice(0, 3),
          compat: compatPct
        })
      }
    } catch (e) {
      console.warn("Todays pick error:", e)
    }
  }

  // Stats Modal Loader
  const openModal = async (type: 'views' | 'likes' | 'matches') => {
    if (!uid) return
    setModalType(type)
    setModalOpen(true)
    setModalLoading(true)

    try {
      let rows: ModalRow[] = []

      if (type === 'views') {
        const { data } = await supabase
          .from('views')
          .select('id, created_at, profiles!views_viewer_id_fkey(id, name, photo_url, course, campus)')
          .eq('target_id', uid)
          .order('created_at', { ascending: false })
          .limit(50) as any

        rows = (data || []).map((r: any) => ({
          id: r.profiles?.id || '',
          name: r.profiles?.name || 'Unknown',
          photo: r.profiles?.photo_url || DEFAULT_AVATAR,
          sub: [r.profiles?.course, r.profiles?.campus].filter(Boolean).join(' · ') || 'UniMatch student',
          time: r.created_at,
          badge: null,
          chatHref: '/discover'
        }))
      }

      if (type === 'likes') {
        const { data } = await supabase
          .from('likes')
          .select('id, created_at, profiles!likes_from_user_id_fkey(id, name, photo_url, course, campus)')
          .eq('to_user_id', uid)
          .order('created_at', { ascending: false })
          .limit(50) as any

        rows = (data || []).map((r: any) => ({
          id: r.profiles?.id || '',
          name: r.profiles?.name || 'Unknown',
          photo: r.profiles?.photo_url || DEFAULT_AVATAR,
          sub: [r.profiles?.course, r.profiles?.campus].filter(Boolean).join(' · ') || 'UniMatch student',
          time: r.created_at,
          badge: '❤️ Liked you',
          chatHref: '/discover'
        }))
      }

      if (type === 'matches') {
        const { data } = await supabase
          .from('matches')
          .select('id, created_at, p1:profiles!matches_user1_id_fkey(id, name, photo_url, course, campus), p2:profiles!matches_user2_id_fkey(id, name, photo_url, course, campus)')
          .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
          .order('created_at', { ascending: false })
          .limit(50) as any

        rows = (data || []).map((m: any) => {
          const other = m.p1?.id === uid ? m.p2 : m.p1
          return {
            id: m.id,
            name: other?.name || 'Unknown',
            photo: other?.photo_url || DEFAULT_AVATAR,
            sub: [other?.course, other?.campus].filter(Boolean).join(' · ') || 'UniMatch student',
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

  // Theme Sync on dropdown change
  const toggleTheme = () => {
    const isLight = document.documentElement.classList.toggle('light-theme')
    localStorage.setItem('theme', isLight ? 'light' : 'dark')
  }

  // User Sign out
  const handleSignOut = async () => {
    try {
      sessionStorage.clear()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      alert("You have been logged out.")
      router.push('/login')
    } catch (e) {
      console.error("Logout failed:", e)
      alert("Logout failed. Try again.")
    }
  }

  const relativeTime = (date: Date) => {
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', background: '#0f0e17' }}>
        <h3>Loading your dashboard...</h3>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <nav className="app-topnav" id="appTopnav">
        <div className="topnav-logo">
          <div className="logo-mark">U</div>
          <span className="logo-text">UniMatch</span>
        </div>

        <div className="topnav-greeting">
          <span className="greeting-prefix">{greeting},&nbsp;</span>
          <span className="greeting-name">{profileName}</span>&nbsp;👋
        </div>

        <div className="topnav-actions">
          <Link href="/notifications" className="notif-btn" title="Notifications">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
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
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
          
          {isDropdownOpen && (
            <div ref={dropdownRef} className="avatar-dropdown" style={{ display: 'flex' }}>
              <Link href="/profile?edit=true" className="avatar-dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <span>View Profile</span>
              </Link>
              <Link href="/settings" className="avatar-dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                <span>Settings</span>
              </Link>
              <button className="avatar-dropdown-item" onClick={() => { toggleTheme(); setIsDropdownOpen(false); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                <span>Toggle Theme</span>
              </button>
              <div className="dropdown-divider"></div>
              <button className="avatar-dropdown-item danger" onClick={() => { handleSignOut(); setIsDropdownOpen(false); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main content scroll */}
      <main className="home-scroll" id="homeScroll">

        {/* 1. Hero Card */}
        <section className="hero-card glass-card anim-slide-up" style={{ '--delay': '0.05s' } as any}>
          <div className="hero-card-inner">
            <div className="hero-avatar-ring">
              <div className="hero-avatar-outer">
                <img src={profilePhotoUrl} alt="Profile" className="hero-avatar-img" />
              </div>
              <div className="hero-online-dot"></div>
            </div>

            <div className="hero-info">
              <h2 className="hero-name">{profileName}</h2>
              <p className="hero-meta">{profileSummary}</p>
              <div className="hero-completion">
                <div className="completion-bar-wrap">
                  <div className="completion-bar" style={{ width: `${completionPct}%` }}></div>
                </div>
                <span className="completion-pct">{completionPct}% Complete</span>
              </div>
            </div>

            <Link href="/profile?edit=true" className="btn-hero-cta">
              Complete Profile
            </Link>
          </div>
        </section>

        {/* 2. Stats Section */}
        <section className="stats-section anim-slide-up" style={{ '--delay': '0.12s' } as any}>
          <button className="stat-card" onClick={() => openModal('views')}>
            <div className="stat-icon stat-icon--views">👀</div>
            <div className="stat-num">{stats.views}</div>
            <div className="stat-lbl">Views</div>
          </button>
          <div className="stat-sep"></div>
          <button className="stat-card" onClick={() => openModal('likes')}>
            <div className="stat-icon stat-icon--likes">❤️</div>
            <div className="stat-num">{stats.likes}</div>
            <div className="stat-lbl">Likes</div>
          </button>
          <div className="stat-sep"></div>
          <button className="stat-card stat-card--accent" onClick={() => openModal('matches')}>
            <div className="stat-icon stat-icon--matches">🔥</div>
            <div className="stat-num">{stats.matches}</div>
            <div className="stat-lbl">Matches</div>
          </button>
        </section>

        {/* 3. Continue Discovering */}
        <section className="section-block anim-slide-up" style={{ '--delay': '0.18s' } as any}>
          <div className="section-header">
            <span className="section-title">Continue Discovering</span>
            <Link href="/discover" className="section-link">See all →</Link>
          </div>
          <Link href="/discover" className="discover-preview-card" style={{ textDecoration: 'none' }}>
            <div className="dp-badge">Next up</div>
            <div className="dp-content">
              <div className="dp-avatar-wrap">
                <div className="dp-avatar">
                  <img src={discoverPreview?.photo_url || DEFAULT_AVATAR} alt="Next profile" />
                </div>
                <div className="dp-online-ring"></div>
              </div>
              <div className="dp-info">
                <h3 className="dp-name">{discoverPreview ? discoverPreview.name : 'No new profiles yet'}</h3>
                <p className="dp-meta">{discoverPreview ? discoverPreview.meta : 'Check back soon!'}</p>
                {discoverPreview?.interests && discoverPreview.interests.length > 0 && (
                  <div className="dp-tags">
                    {discoverPreview.interests.map(t => (
                      <span key={t} className="dp-tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="dp-cta">
              Continue Swiping →
            </div>
          </Link>
        </section>

        {/* 4. New Activity */}
        <section className="section-block anim-slide-up" style={{ '--delay': '0.24s' } as any}>
          <div className="section-header">
            <span className="section-title">New Activity</span>
            <Link href="/notifications" className="section-link">View all →</Link>
          </div>
          <div className="activity-feed glass-card">
            {activityEvents.map((ev, i) => (
              <div key={i} className="activity-item">
                <div className={`activity-dot ${ev.cls}`}>{ev.emoji}</div>
                <div className="activity-text" dangerouslySetInnerHTML={{ __html: ev.text || `<strong>${ev.name}</strong> ${ev.type === 'view' ? 'viewed your profile' : 'liked your profile'}` }}></div>
                <div className="activity-time">{ev.time ? relativeTime(ev.time) : 'Just now'}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Campus Pulse */}
        <section className="section-block anim-slide-up" style={{ '--delay': '0.30s' } as any}>
          <div className="section-header">
            <span className="section-title">Campus Pulse 🌐</span>
            <span className="pulse-live-badge"><span className="pulse-live-dot"></span>LIVE</span>
          </div>

          <div className="pulse-tabs-container">
            <button className={`pulse-tab-btn ${activeTab === 'spots' ? 'active' : ''}`} onClick={() => setActiveTab('spots')}>
              📍 Campus Spots
            </button>
            <button className={`pulse-tab-btn ${activeTab === 'radar' ? 'active' : ''}`} onClick={() => setActiveTab('radar')}>
              📡 Radar Scan
            </button>
          </div>

          {activeTab === 'spots' ? (
            <div className="campus-pulse-card glass-card">
              <p className="spots-intro">Check-in to your current campus spot to see who else is hanging out there right now!</p>
              <div className="spots-list">
                {CAMPUS_SPOTS.map(spot => {
                  const isHere = myCurrentSpot === spot.name
                  const activeClass = isHere ? "active" : ""
                  const count = spotCounts[spot.name] || 0
                  return (
                    <div key={spot.id} className={`spot-card ${activeClass}`} onClick={() => toggleSpotCheckin(spot.name)}>
                      <span className="spot-emoji">{spot.emoji}</span>
                      <div className="spot-info">
                        <div className="spot-name">{spot.name}</div>
                        <div className="spot-count">{count === 1 ? "1 student here" : `${count} students here`}</div>
                      </div>
                      <button className="spot-btn">
                        {isHere ? "Check-out ✕" : "Check-in 📍"}
                      </button>
                    </div>
                  )
                })}
              </div>

              {myCurrentSpot && (
                <div className="spot-checked-users" style={{ display: 'block' }}>
                  <h4 className="sc-title">Students at the {myCurrentSpot} right now</h4>
                  {spotLoading ? (
                    <div className="spot-loading">Checking who's here...</div>
                  ) : checkedUsers.length > 0 ? (
                    <div className="sc-grid">
                      {checkedUsers.map(user => (
                        <Link href="/discover" key={user.id} className="sc-user-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                          <img className="sc-user-avatar" src={user.photo_url} alt={user.name} />
                          <div className="sc-user-info">
                            <div className="sc-user-name">{user.name}</div>
                            <div className="sc-user-sub">{[user.course, user.campus].filter(Boolean).join(' · ')}</div>
                          </div>
                          <div className="sc-user-chat-btn">Say Hi 👋</div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="sc-empty-msg">You're the only one checked-in here. Spread the word! 📣</p>
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

        {/* 6. Today's Pick */}
        <section className="section-block anim-slide-up" style={{ '--delay': '0.36s' } as any}>
          <div className="section-header">
            <span className="section-title">Today's Pick 💫</span>
          </div>
          <div className="todays-pick-card">
            <div className="pick-badge">Today's Best Match</div>
            <div className="pick-body">
              <div className="pick-photo-wrap">
                <img src={todaysPick?.photo_url || DEFAULT_AVATAR} alt="Best match" className="pick-photo" />
                <div className="pick-compat-ring">
                  <span className="pick-compat-pct">{todaysPick?.compat || 65}%</span>
                </div>
              </div>
              <div className="pick-info">
                <h3 className="pick-name">{todaysPick ? todaysPick.name : 'Paul'}</h3>
                <p className="pick-meta">{todaysPick ? todaysPick.meta : 'Law · Kabarak'}</p>
                <div className="pick-tags">
                  {(todaysPick?.interests && todaysPick.interests.length > 0 ? todaysPick.interests : ['Music', 'Movies', 'Podcasts']).map(t => (
                    <span key={t} className="pick-tag">{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <Link href="/discover" className="btn-pick-view">
              View Profile →
            </Link>
          </div>
        </section>

        {/* 7. Daily Icebreaker */}
        <section className="section-block anim-slide-up" style={{ '--delay': '0.42s' } as any}>
          <div className="section-header">
            <span className="section-title">Daily Icebreaker ❄️</span>
          </div>
          <div className="icebreaker-card glass-card">
            <div className="icebreaker-label">Today's Question</div>
            <div className="icebreaker-question">"{currentIcebreaker}"</div>
            <Link href="/discover" className="btn-icebreaker">
              Answer →
            </Link>
          </div>
        </section>

        {/* 8. Recent Chats */}
        <section className="section-block anim-slide-up" style={{ '--delay': '0.48s' } as any}>
          <div className="section-header">
            <span className="section-title">Recent Chats 💬</span>
            <Link href="/matches" className="section-link">All chats →</Link>
          </div>
          <div className="recent-chats glass-card">
            {recentChatsList.length > 0 ? (
              recentChatsList.map(m => (
                <Link href={`/chat?matchId=${m.id}`} key={m.id} className="chat-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="chat-avatar-wrap">
                    <img className="chat-avatar" src={m.photo_url} alt={m.name} />
                    {m.online && <div className="chat-online"></div>}
                  </div>
                  <div className="chat-meta">
                    <div className="chat-name">{m.name}</div>
                    <div className="chat-preview">{m.last_message}</div>
                  </div>
                  <div className="chat-right">
                    <div className="chat-time">{m.last_message_at ? relativeTime(new Date(m.last_message_at)) : ""}</div>
                    {m.unread > 0 && <span className="chat-unread">{m.unread}</span>}
                  </div>
                </Link>
              ))
            ) : (
              <div className="chat-empty-state" style={{ display: 'flex' }}>
                <span className="chat-empty-icon">💬</span>
                <p>No conversations yet — start matching!</p>
                <Link href="/discover" className="btn-start-disc">Start Discovering</Link>
              </div>
            )}
          </div>
        </section>

        <div className="home-bottom-space"></div>
      </main>

      {/* Stats modal bottom sheet */}
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

      {/* Slanted Nav / Bottom Navigation */}
      <BottomNav activeTab="home" matchesBadge={stats.matches} unreadBadge={stats.unreadMessages} />
    </div>
  )
}
