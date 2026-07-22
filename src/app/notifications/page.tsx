'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import './notifications.css'

interface NotificationItem {
  id: string
  cat: 'matches' | 'likes' | 'views' | 'messages'
  icon: string
  iconCls: string
  text: string
  time: Date
  unread: boolean
  link: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [uid, setUid] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activeCat, setActiveCat] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  // Fetch list
  const fetchNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender:profiles!notifications_sender_id_fkey(name, photo_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped = (data || []).map((n: any) => {
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
        return {
          id: n.id,
          cat: typeCat,
          icon: emojiMap[n.type] || '👀',
          iconCls: `notif-icon--${n.type}s`,
          text: n.body || n.title || 'New notification',
          time: n.created_at ? new Date(n.created_at) : new Date(),
          unread: !n.is_read,
          link: n.link || '/dashboard'
        }
      })

      setNotifications(mapped)
    } catch (e) {
      console.warn("Error fetching notifications:", e)
    } finally {
      setLoading(false)
    }
  }

  // Mark all read
  const handleMarkAllRead = async () => {
    if (!uid) return
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', uid)
    } catch (e) {
      console.warn("Error marking all read:", e)
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

  // Realtime
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
    if (diff < 3600) return Math.floor(diff / 60) + "m ago"
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago"
    return Math.floor(diff / 86400) + "d ago"
  }

  const filteredNotifs = activeCat === 'all' 
    ? notifications 
    : notifications.filter(n => n.cat === activeCat)

  return (
    <div className="notifications-page">
      {/* Top Navbar */}
      <nav className="notif-topnav">
        <div className="notif-logo" onClick={() => router.push('/dashboard')}>
          <div className="logo-mark">U</div>
          <span className="logo-text">UniMatch</span>
        </div>
        <h2 className="topnav-title">Notifications</h2>
        <div className="topnav-right">
          <button className="btn-clear-all" onClick={handleMarkAllRead}>Mark all read</button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="notif-container">
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

        <div className="notif-list">
          {loading ? (
            <div className="notif-loading">
              <div className="spinner"></div>
              <span>Loading notifications...</span>
            </div>
          ) : filteredNotifs.length > 0 ? (
            filteredNotifs.map(n => (
              <div
                key={n.id}
                className={`notif-card ${n.unread ? 'unread' : ''}`}
                onClick={() => router.push(n.link)}
              >
                <div className={`notif-icon-wrap ${n.iconCls}`}>{n.icon}</div>
                <div className="notif-content">
                  <div className="notif-text" dangerouslySetInnerHTML={{ __html: n.text }}></div>
                  <div className="notif-time">{relativeTime(n.time)}</div>
                </div>
                {n.unread && <div className="notif-unread-dot"></div>}
              </div>
            ))
          ) : (
            <div className="notif-empty">
              <span style={{ fontSize: '36px' }}>🔔</span>
              <span>No notifications in this category yet.</span>
            </div>
          )}
        </div>
      </main>

      {/* Slanted Nav / Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
