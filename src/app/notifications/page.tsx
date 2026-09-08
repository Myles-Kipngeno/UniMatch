'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import LoadingScreen from '@/components/LoadingScreen'
import { useAppCache } from '@/context/AppCacheContext'
import { useNetwork } from '@/context/NetworkContext'
import { NotificationsSkeleton } from '@/components/skeletons/Skeletons'
import OfflineNotice, { OfflineBanner } from '@/components/OfflineNotice'
import { useModal } from '@/components/ModalContext'
import './notifications.css'

interface NotificationItem {
  id: string
  cat: 'matches' | 'likes' | 'views' | 'messages'
  type: string
  icon: string
  iconCls: string
  senderId?: string
  senderName?: string
  senderPhoto?: string
  title: string
  text: string
  time: Date
  unread: boolean
  link: string
}

interface NotificationGroup {
  groupId: string
  title: string
  latestTime: Date
  unreadCount: number
  cat: 'matches' | 'likes' | 'views' | 'messages'
  icon: string
  iconCls: string
  senderPhoto?: string
  senderName?: string
  items: NotificationItem[]
}

interface SwipeableNotifCardProps {
  onDismiss: () => void
  onClick: () => void
  children: React.ReactNode
  className?: string
}

function SwipeableNotifCard({ onDismiss, onClick, children, className = '' }: SwipeableNotifCardProps) {
  const [startX, setStartX] = useState<number | null>(null)
  const [startY, setStartY] = useState<number | null>(null)
  const [translateX, setTranslateX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const isDraggingRef = useRef(false)
  const hasMovedRef = useRef(false)

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('.btn-dismiss-item') ||
      target.closest('.btn-dismiss-subitem') ||
      target.closest('.notif-stack-footer')
    ) {
      return
    }

    setStartX(e.clientX)
    setStartY(e.clientY)
    isDraggingRef.current = true
    hasMovedRef.current = false
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch (_) {}
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || startX === null || startY === null || isDeleting) return

    const diffX = e.clientX - startX
    const diffY = e.clientY - startY

    if (!hasMovedRef.current) {
      if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 6) {
        isDraggingRef.current = false
        setStartX(null)
        setStartY(null)
        return
      }
    }

    if (diffX > 0) {
      hasMovedRef.current = true
      setIsSwiping(true)
      setTranslateX(diffX)
    }
  }

  const handlePointerUpOrCancel = (e: React.PointerEvent) => {
    if (!isDraggingRef.current && !hasMovedRef.current) return
    isDraggingRef.current = false
    setStartX(null)
    setStartY(null)
    setIsSwiping(false)

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (_) {}

    const SWIPE_THRESHOLD = 110
    if (translateX >= SWIPE_THRESHOLD) {
      setIsDeleting(true)
      setTranslateX(400)
      setTimeout(() => {
        onDismiss()
      }, 200)
    } else {
      setTranslateX(0)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (hasMovedRef.current || translateX > 10) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onClick()
  }

  return (
    <div className={`notif-swipe-container ${isSwiping || translateX > 0 ? 'swiping' : ''}`}>
      <div className="notif-swipe-action-bg">
        <span>🗑️</span>
        <span>Delete</span>
      </div>
      <div
        className={`notif-swipe-card-surface ${className}`}
        style={{
          transform: `translateX(${translateX}px)`,
          opacity: isDeleting ? 0 : 1,
          transition: isSwiping ? 'none' : 'transform 0.22s var(--spring), opacity 0.2s ease'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onClick={handleCardClick}
      >
        {children}
      </div>
    </div>
  )
}

const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'demo-1',
    cat: 'messages',
    type: 'message',
    icon: '💬',
    iconCls: 'notif-icon--messages',
    senderId: 'user-sandra',
    senderName: 'Asentra / Sandra',
    senderPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    title: 'Have you moved your body today?',
    text: "Your daily challenge is waiting Sandra, let's crush today's workout.",
    time: new Date(Date.now() - 4 * 60 * 1000),
    unread: true,
    link: '/chat'
  },
  {
    id: 'demo-2',
    cat: 'messages',
    type: 'message',
    icon: '💬',
    iconCls: 'notif-icon--messages',
    senderId: 'user-sandra',
    senderName: 'Asentra / Sandra',
    senderPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    title: 'Campus Gym Meetup',
    text: 'Free for a leg day session at the Campus Gym around 4 PM?',
    time: new Date(Date.now() - 18 * 60 * 1000),
    unread: true,
    link: '/chat'
  },
  {
    id: 'demo-3',
    cat: 'likes',
    type: 'like',
    icon: '❤️',
    iconCls: 'notif-icon--likes',
    senderId: 'user-sandra',
    senderName: 'Asentra / Sandra',
    senderPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    title: 'Liked your fitness prompt',
    text: 'Sandra liked your hiking and gym activity prompts!',
    time: new Date(Date.now() - 45 * 60 * 1000),
    unread: false,
    link: '/discover'
  },
  {
    id: 'demo-4',
    cat: 'views',
    type: 'view',
    icon: '👀',
    iconCls: 'notif-icon--views',
    senderId: 'user-alex',
    senderName: 'Alex Mercer (CS)',
    senderPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    title: 'Campus Spot Profile View',
    text: 'Alex checked your profile from the Library spot check-in.',
    time: new Date(Date.now() - 12 * 60 * 1000),
    unread: true,
    link: '/discover'
  },
  {
    id: 'demo-5',
    cat: 'views',
    type: 'view',
    icon: '👀',
    iconCls: 'notif-icon--views',
    senderId: 'user-alex',
    senderName: 'Alex Mercer (CS)',
    senderPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    title: 'Re-visited your profile',
    text: 'Alex viewed your profile interests again.',
    time: new Date(Date.now() - 35 * 60 * 1000),
    unread: false,
    link: '/discover'
  },
  {
    id: 'demo-6',
    cat: 'matches',
    type: 'match',
    icon: '💕',
    iconCls: 'notif-icon--matches',
    senderId: 'user-chloe',
    senderName: 'Chloe Bennett',
    senderPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400',
    title: "It's a Match! 🎉",
    text: 'You and Chloe liked each other! Send a message to break the ice.',
    time: new Date(Date.now() - 2 * 3600 * 1000),
    unread: true,
    link: '/matches'
  }
]

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const modal = useModal()
  const { getCache, setCache } = useAppCache()
  const { isOnline, isNetworkError, reportNetworkError, clearNetworkError } = useNetwork()

  const cachedNotifs = getCache('notifications')
  const [uid, setUid] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => cachedNotifs || [])
  const [activeCat, setActiveCat] = useState<string>('all')
  const [loading, setLoading] = useState(() => !cachedNotifs)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // Sync cache on mount if updated
  useEffect(() => {
    const cached = getCache('notifications')
    if (cached) {
      setNotifications(cached)
      setLoading(false)
    }
  }, [getCache])

  // Fetch notifications
  const fetchNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender:profiles!notifications_sender_id_fkey(name, photo_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped: NotificationItem[] = (data || []).map((n: any) => {
        const catMap: Record<string, 'matches' | 'likes' | 'views' | 'messages'> = {
          message: 'messages',
          like: 'likes',
          match: 'matches'
        }
        const typeCat = catMap[n.type] || 'views'
        const emojiMap: Record<string, string> = {
          match: '💕',
          like: '❤️',
          message: '💬'
        }

        const senderProf = n.sender || {}
        const senderName = senderProf.name || undefined
        const senderPhoto = senderProf.photo_url || undefined

        // Determine safe default route to prevent 404s
        let safeRoute = '/dashboard'
        if (typeCat === 'messages') safeRoute = '/chat'
        else if (typeCat === 'matches') safeRoute = '/matches'
        else if (typeCat === 'likes' || typeCat === 'views') safeRoute = '/discover'

        return {
          id: n.id,
          cat: typeCat,
          type: n.type || 'view',
          icon: emojiMap[n.type] || '👀',
          iconCls: `notif-icon--${n.type}s`,
          senderId: n.sender_id || (senderName ? `sender_${senderName}` : undefined),
          senderName,
          senderPhoto,
          title: n.title || (n.type === 'match' ? "It's a Match! 🎉" : n.type === 'like' ? 'New Profile Like ❤️' : n.type === 'message' ? 'New Message 💬' : 'Profile View 👀'),
          text: n.body || n.title || 'New activity on your profile',
          time: n.created_at ? new Date(n.created_at) : new Date(),
          unread: !n.is_read,
          link: safeRoute
        }
      })

      const finalNotifs = mapped
      setNotifications(finalNotifs)
      setCache('notifications', finalNotifs)
      clearNetworkError()
    } catch (e: any) {
      console.warn("Error fetching notifications:", e)
      if (!getCache('notifications')) {
        setNotifications([])
      }
      if (!navigator.onLine || e?.message?.includes('fetch')) {
        reportNetworkError()
      }
    } finally {
      setLoading(false)
    }
  }

  // Redirect and mark as read when clicking a notification
  const handleNotificationClick = async (item: NotificationItem) => {
    // 1. Mark as read
    if (item.unread) {
      setNotifications(prev => {
        const updated = prev.map(n => n.id === item.id ? { ...n, unread: false } : n)
        setCache('notifications', updated)
        return updated
      })
      if (uid && !item.id.startsWith('demo-')) {
        try {
          await (supabase.from('notifications') as any)
            .update({ is_read: true })
            .eq('id', item.id)
        } catch (e) {
          console.warn("Error marking single read:", e)
        }
      }
    }

    // 2. Safe route resolution with specific conversation targeting
    let target = '/dashboard'
    if (item.cat === 'messages') {
      if (item.senderId && !item.senderId.startsWith('sender_')) {
        target = `/chat?userId=${encodeURIComponent(item.senderId)}`
        if (item.senderName) target += `&user=${encodeURIComponent(item.senderName)}`
      } else if (item.senderName) {
        target = `/chat?user=${encodeURIComponent(item.senderName)}`
      } else {
        target = '/chat'
      }
    } else if (item.cat === 'matches') {
      if (item.senderId && !item.senderId.startsWith('sender_')) {
        target = `/chat?userId=${encodeURIComponent(item.senderId)}`
        if (item.senderName) target += `&user=${encodeURIComponent(item.senderName)}`
      } else if (item.senderName) {
        target = `/chat?user=${encodeURIComponent(item.senderName)}`
      } else {
        target = '/matches'
      }
    } else if (item.cat === 'likes' || item.cat === 'views') {
      target = '/discover'
    }

    const VALID_ROUTES = ['/chat', '/matches', '/discover', '/profile', '/dashboard', '/settings']
    if (item.link && VALID_ROUTES.some(r => item.link === r || item.link.startsWith(r + '?'))) {
      target = item.link
    }

    router.push(target)
  }

  // Mark all read
  const handleMarkAllRead = async () => {
    const unreadCount = notifications.filter(n => n.unread).length
    if (unreadCount === 0) {
      modal.toast('All notifications are already marked read', 'info')
      return
    }

    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, unread: false }))
      setCache('notifications', updated)
      return updated
    })
    modal.toast('All notifications marked as read ✓', 'success')

    if (uid) {
      try {
        await (supabase.from('notifications') as any)
          .update({ is_read: true })
          .eq('user_id', uid)
      } catch (e) {
        console.warn("Error marking all read:", e)
      }
    }
  }

  // Clear all notifications
  const handleClearAll = async () => {
    if (notifications.length === 0) {
      modal.toast('Notification feed is already empty', 'info')
      return
    }

    modal.confirm({
      title: 'Clear All Notifications',
      message: 'Are you sure you want to delete all notifications? This action cannot be undone.',
      confirmText: 'Clear All',
      isDanger: true,
      onConfirm: async () => {
        setNotifications([])
        setCache('notifications', [])
        modal.toast('Cleared all notifications', 'success')

        if (uid) {
          try {
            await (supabase.from('notifications') as any)
              .delete()
              .eq('user_id', uid)
          } catch (e) {
            console.warn("Error clearing notifications:", e)
          }
        }
      }
    })
  }

  // Delete individual notification
  const handleDeleteItem = async (eOrId?: React.MouseEvent | string, possibleId?: string) => {
    let itemId = possibleId
    if (typeof eOrId === 'string') {
      itemId = eOrId
    } else if (eOrId && typeof eOrId === 'object' && 'stopPropagation' in eOrId) {
      (eOrId as React.MouseEvent).stopPropagation()
    }
    if (!itemId) return

    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== itemId)
      setCache('notifications', updated)
      return updated
    })
    modal.toast('Notification removed', 'info')

    if (uid && !itemId.startsWith('demo-')) {
      try {
        await (supabase.from('notifications') as any)
          .delete()
          .eq('id', itemId)
      } catch (e) {
        console.warn("Error deleting notification:", e)
      }
    }
  }

  // Delete notification stack
  const handleDeleteGroup = async (eOrGroup?: React.MouseEvent | NotificationGroup, possibleGroup?: NotificationGroup) => {
    let group = possibleGroup
    if (eOrGroup && typeof eOrGroup === 'object' && 'items' in eOrGroup) {
      group = eOrGroup as NotificationGroup
    } else if (eOrGroup && typeof eOrGroup === 'object' && 'stopPropagation' in eOrGroup) {
      (eOrGroup as React.MouseEvent).stopPropagation()
    }
    if (!group) return

    const itemIds = group.items.map(i => i.id)
    setNotifications(prev => {
      const updated = prev.filter(n => !itemIds.includes(n.id))
      setCache('notifications', updated)
      return updated
    })
    modal.toast('Cleared stacked notifications', 'info')

    if (uid) {
      const dbIds = itemIds.filter(id => !id.startsWith('demo-'))
      if (dbIds.length > 0) {
        try {
          await (supabase.from('notifications') as any)
            .delete()
            .in('id', dbIds)
        } catch (e) {
          console.warn("Error deleting group notifications:", e)
        }
      }
    }
  }

  // Bootstrapper
  useEffect(() => {
    async function initNotifications() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUid(user.id)
      await fetchNotifications(user.id)
    }
    initNotifications()
  }, [supabase, router])

  // Debounce full notifications refetch so realtime bursts collapse into one request
  const fetchNotificationsRef = useRef(fetchNotifications)
  fetchNotificationsRef.current = fetchNotifications
  const notifDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleNotifications = useCallback((userId: string) => {
    if (notifDebounceRef.current) clearTimeout(notifDebounceRef.current)
    notifDebounceRef.current = setTimeout(() => fetchNotificationsRef.current(userId), 1000)
  }, [])

  // Realtime subscription
  useEffect(() => {
    if (!uid) return

    const channel = supabase.channel('notifications_realtime_page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => {
          scheduleNotifications(uid)
        }
      )
      .subscribe()

    // Reconnect handler: refetch notifications missed while offline
    const handleReconnect = () => {
      scheduleNotifications(uid)
    }
    window.addEventListener('unimatch:reconnect', handleReconnect)

    return () => {
      supabase.removeChannel(channel)
      if (notifDebounceRef.current) clearTimeout(notifDebounceRef.current)
      window.removeEventListener('unimatch:reconnect', handleReconnect)
    }
  }, [uid, scheduleNotifications])

  const relativeTime = (date: Date) => {
    const diff = (Date.now() - date.getTime()) / 1000
    if (diff < 60) return "Just now"
    if (diff < 3600) return Math.floor(diff / 60) + " min ago"
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago"
    return Math.floor(diff / 86400) + "d ago"
  }

  // Grouping Algorithm (Groups by Sender + Category)
  const groupNotifications = (items: NotificationItem[]): NotificationGroup[] => {
    const map: Record<string, NotificationItem[]> = {}

    items.forEach(item => {
      let key = ''
      if (item.senderId || item.senderName) {
        key = `sender_${item.senderId || item.senderName}_${item.cat}`
      } else {
        key = `single_${item.id}`
      }

      if (!map[key]) {
        map[key] = []
      }
      map[key].push(item)
    })

    const groups: NotificationGroup[] = []

    Object.entries(map).forEach(([key, groupItems]) => {
      groupItems.sort((a, b) => b.time.getTime() - a.time.getTime())
      const top = groupItems[0]
      const unreadCount = groupItems.filter(i => i.unread).length

      let title = top.senderName || top.title
      if (groupItems.length > 1 && !top.senderName) {
        title = `${groupItems.length} ${top.cat.toUpperCase()}`
      }

      groups.push({
        groupId: key,
        title,
        latestTime: top.time,
        unreadCount,
        cat: top.cat,
        icon: top.icon,
        iconCls: top.iconCls,
        senderPhoto: top.senderPhoto,
        senderName: top.senderName,
        items: groupItems
      })
    })

    groups.sort((a, b) => b.latestTime.getTime() - a.latestTime.getTime())
    return groups
  }

  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  const filteredNotifs = activeCat === 'all' 
    ? notifications 
    : notifications.filter(n => n.cat === activeCat)

  const groupedNotifs = groupNotifications(filteredNotifs)

  if (isNetworkError && !getCache('notifications')) {
    return (
      <div className="notifications-page">
        <OfflineNotice onRetry={() => { clearNetworkError(); window.location.reload(); }} />
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="notifications-page">
      {!isOnline && <OfflineBanner />}

      {/* Top Main Navigation Header */}
      <header className="notif-page-header">
        <div className="nph-left">
          <button className="notif-back-btn" onClick={() => router.back()} title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h1 className="nph-title">Notifications</h1>
            <p className="nph-sub">Stay updated with your campus vibe ✨</p>
          </div>
        </div>
        <div className="nph-right">
          <button className="btn-mark-read" onClick={handleMarkAllRead} title="Mark all as read">
            ✓ Read all
          </button>
          <button className="btn-clear-feed" onClick={handleClearAll} title="Clear all notifications">
            🗑️ Clear
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="notif-container">
        {/* Category Tabs */}
        <div className="notif-tabs">
          {[
            { id: 'all', label: 'All' },
            { id: 'matches', label: '💕 Matches' },
            { id: 'likes', label: '❤️ Likes' },
            { id: 'views', label: '👀 Views' },
            { id: 'messages', label: '💬 Messages' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`notif-tab ${activeCat === tab.id ? 'active' : ''}`}
              onClick={() => setActiveCat(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification Cards Feed */}
        <div className="notif-list">
          {loading ? (
            <NotificationsSkeleton />
          ) : groupedNotifs.length > 0 ? (
            groupedNotifs.map(group => {
              const isStacked = group.items.length > 1
              const isExpanded = !!expandedGroups[group.groupId]
              const topItem = group.items[0]

              return (
                <div
                  key={group.groupId}
                  className={`notif-stack-wrapper ${isStacked ? 'is-stacked' : ''} ${isExpanded ? 'expanded' : ''}`}
                >
                  {/* 3D Stacked Layers (Visible when stacked & collapsed) */}
                  {isStacked && !isExpanded && (
                    <>
                      <div className="notif-stack-layer-1" />
                      <div className="notif-stack-layer-2" />
                    </>
                  )}

                  {/* Top Primary Notification Card */}
                  <SwipeableNotifCard
                    className={`notif-card-stacked ${topItem.unread ? 'unread' : ''}`}
                    onDismiss={() => (isStacked ? handleDeleteGroup(group) : handleDeleteItem(topItem.id))}
                    onClick={() => {
                      if (isStacked && !isExpanded) {
                        toggleExpandGroup(group.groupId)
                      } else {
                        handleNotificationClick(topItem)
                      }
                    }}
                  >
                    <div className="notif-card-left">
                      {group.senderPhoto ? (
                        <div className="notif-avatar-wrap">
                          <Image className="notif-avatar-img" src={group.senderPhoto} alt={group.senderName || 'User'} width={42} height={42} />
                          <span className={`notif-avatar-badge ${group.iconCls}`}>{group.icon}</span>
                        </div>
                      ) : (
                        <div className={`notif-icon-box ${group.iconCls}`}>{group.icon}</div>
                      )}
                    </div>

                    <div className="notif-card-main">
                      <div className="notif-card-header">
                        <span className="notif-sender-title">{group.title}</span>
                        <div className="header-right-meta">
                          <span className="notif-time-badge">{relativeTime(group.latestTime)}</span>
                          <button
                            className="btn-dismiss-item"
                            title={isStacked ? "Delete stack" : "Delete notification"}
                            onClick={(e) => isStacked ? handleDeleteGroup(e, group) : handleDeleteItem(e, topItem.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="notif-headline">{topItem.title}</div>
                      <div className="notif-body-text">{topItem.text}</div>

                      {/* Stacked indicator footer */}
                      {isStacked && (
                        <div
                          className="notif-stack-footer"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpandGroup(group.groupId)
                          }}
                        >
                          <span className="stack-badge-count">
                            <span className="stack-icon-layers">🥞</span> {group.items.length} stacked notifications
                          </span>
                          <span className="stack-toggle-action">
                            {isExpanded ? 'Collapse ∧' : 'Tap to view all ∨'}
                          </span>
                        </div>
                      )}
                    </div>

                    {group.unreadCount > 0 && <div className="notif-unread-dot" />}
                  </SwipeableNotifCard>

                  {/* Expanded Accordion Sub-cards */}
                  {isStacked && isExpanded && (
                    <div className="notif-expanded-container">
                      {group.items.slice(1).map(item => (
                        <SwipeableNotifCard
                          key={item.id}
                          className={`notif-subcard ${item.unread ? 'unread' : ''}`}
                          onDismiss={() => handleDeleteItem(item.id)}
                          onClick={() => handleNotificationClick(item)}
                        >
                          <div className="subcard-icon">{item.icon}</div>
                          <div className="subcard-content">
                            <div className="subcard-header">
                              <span className="subcard-title">{item.title}</span>
                              <div className="sub-right-meta">
                                <span className="subcard-time">{relativeTime(item.time)}</span>
                                <button
                                  className="btn-dismiss-subitem"
                                  title="Delete notification"
                                  onClick={(e) => handleDeleteItem(e, item.id)}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                            <div className="subcard-text">{item.text}</div>
                          </div>
                        </SwipeableNotifCard>
                      ))}
                      <button className="btn-collapse-stack" onClick={() => toggleExpandGroup(group.groupId)}>
                        Collapse stack ∧
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="notif-empty">
              <span style={{ fontSize: '36px' }}>🔔</span>
              <span>No notifications in this category yet.</span>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
