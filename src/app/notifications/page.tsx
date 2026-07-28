'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import LoadingScreen from '@/components/LoadingScreen'
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

  const [uid, setUid] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activeCat, setActiveCat] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

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

      if (mapped.length === 0) {
        setNotifications(DEMO_NOTIFICATIONS)
      } else {
        setNotifications(mapped)
      }
    } catch (e) {
      console.warn("Error fetching notifications:", e)
      setNotifications(DEMO_NOTIFICATIONS)
    } finally {
      setLoading(false)
    }
  }

  // Redirect and mark as read when clicking a notification
  const handleNotificationClick = async (item: NotificationItem) => {
    // 1. Mark as read
    if (item.unread) {
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, unread: false } : n))
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

    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
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

    const confirmed = window.confirm("Are you sure you want to clear all notifications?")
    if (!confirmed) return

    setNotifications([])
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

  // Delete individual notification
  const handleDeleteItem = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation()
    setNotifications(prev => prev.filter(n => n.id !== itemId))
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
  const handleDeleteGroup = async (e: React.MouseEvent, group: NotificationGroup) => {
    e.stopPropagation()
    const itemIds = group.items.map(i => i.id)
    setNotifications(prev => prev.filter(n => !itemIds.includes(n.id)))
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

  // Realtime subscription
  useEffect(() => {
    if (!uid) return

    const channel = supabase.channel('notifications_realtime_page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => {
          fetchNotifications(uid)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [uid])

  const relativeTime = (date: Date) => {
    const diff = (Date.now() - date.getTime()) / 1000
    if (diff < 60) return "Just now"
    if (diff < 3600) return Math.floor(diff / 60) + " min ago"
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago"
    return Math.floor(diff / 86400) + "d ago"
  }

  // Grouping Algorithm
  const groupNotifications = (items: NotificationItem[]): NotificationGroup[] => {
    const map: Record<string, NotificationItem[]> = {}

    items.forEach(item => {
      let key = ''
      if (item.senderId || item.senderName) {
        key = `sender_${item.senderId || item.senderName}`
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

  return (
    <div className="notifications-page">
      {/* Top Navbar */}
      <nav className="notif-topnav">
        <div className="notif-logo" onClick={() => router.push('/dashboard')}>
          <img src="/favicon.svg" alt="UniMatch" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} />
          <span className="logo-text">UniMatch</span>
        </div>
        <h2 className="topnav-title">Notifications</h2>
        <div className="topnav-right">
          <button className="btn-mark-read" onClick={handleMarkAllRead} title="Mark all as read">
            ✓ Read all
          </button>
          <button className="btn-clear-feed" onClick={handleClearAll} title="Clear all notifications">
            🗑️ Clear
          </button>
        </div>
      </nav>

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
            <LoadingScreen message="Loading notifications..." fullScreen={false} />
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
                  <div
                    className={`notif-card-stacked ${topItem.unread ? 'unread' : ''}`}
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
                          <img className="notif-avatar-img" src={group.senderPhoto} alt={group.senderName || 'User'} />
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
                  </div>

                  {/* Expanded Accordion Sub-cards */}
                  {isStacked && isExpanded && (
                    <div className="notif-expanded-container">
                      {group.items.slice(1).map(item => (
                        <div
                          key={item.id}
                          className={`notif-subcard ${item.unread ? 'unread' : ''}`}
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
                        </div>
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
