'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { DEFAULT_AVATAR } from '@/lib/constants'
import './settings.css'

interface BlockedUser {
  id: string
  name: string
  photo_url: string
  course: string
  campus: string
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  
  // Settings States
  const [discoveryVisible, setDiscoveryVisible] = useState(true)
  const [incognito, setIncognito] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)

  // Blocked Users State
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [unblockingId, setUnblockingId] = useState<string | null>(null)

  // UI Status States
  const [loading, setLoading] = useState(true)
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    async function loadSettingsData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        setUserId(user.id)

        // 1. Fetch user settings
        const { data: settings } = await (supabase.from('user_settings') as any)
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (settings) {
          if (typeof settings.discovery_visible === 'boolean') setDiscoveryVisible(settings.discovery_visible)
          if (typeof settings.incognito === 'boolean') setIncognito(settings.incognito)
          if (typeof settings.email_notifications === 'boolean') setEmailNotifications(settings.email_notifications)
          if (typeof settings.push_notifications === 'boolean') setPushNotifications(settings.push_notifications)
        }

        // 2. Fetch blocked users
        const { data: blockedRows } = await (supabase.from('blocked_users') as any)
          .select('blocked_id, profiles!blocked_users_blocked_id_fkey(id, name, photo_url, course, campus)')
          .eq('blocker_id', user.id)

        if (blockedRows) {
          const mapped: BlockedUser[] = blockedRows.map((b: any) => {
            const p = b.profiles || {}
            return {
              id: b.blocked_id,
              name: p.name || 'User',
              photo_url: p.photo_url || DEFAULT_AVATAR,
              course: p.course || '',
              campus: p.campus || ''
            }
          })
          setBlockedUsers(mapped)
        }
      } catch (err) {
        console.warn("Settings loading error:", err)
      } finally {
        setLoading(false)
      }
    }

    loadSettingsData()
  }, [supabase, router])

  // Save Settings Helper (Upsert)
  const saveSetting = async (updated: {
    discovery_visible?: boolean
    incognito?: boolean
    email_notifications?: boolean
    push_notifications?: boolean
  }) => {
    if (!userId) return

    const payload = {
      user_id: userId,
      discovery_visible: updated.discovery_visible ?? discoveryVisible,
      incognito: updated.incognito ?? incognito,
      email_notifications: updated.email_notifications ?? emailNotifications,
      push_notifications: updated.push_notifications ?? pushNotifications,
      updated_at: new Date().toISOString()
    }

    try {
      const { error } = await (supabase.from('user_settings') as any)
        .upsert(payload, { onConflict: 'user_id' })

      if (error) {
        console.error("Save settings error:", error)
      } else {
        showSavedBanner("Settings updated successfully")
      }
    } catch (e) {
      console.error("Save settings failed:", e)
    }
  }

  const showSavedBanner = (msg: string) => {
    setSavedMessage(msg)
    setTimeout(() => setSavedMessage(''), 2500)
  }

  // Handle Unblock User
  const handleUnblock = async (blockedId: string, name: string) => {
    if (!userId) return
    setUnblockingId(blockedId)

    try {
      const { error } = await (supabase.from('blocked_users') as any)
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', blockedId)

      if (error) {
        console.error("Unblock user error:", error)
        alert("Failed to unblock user. Try again.")
      } else {
        setBlockedUsers(prev => prev.filter(u => u.id !== blockedId))
        showSavedBanner(`Unblocked ${name}`)
      }
    } catch (e) {
      console.error("Unblock failed:", e)
    } finally {
      setUnblockingId(null)
    }
  }

  if (loading) {
    return (
      <div className="settings-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#8b7fa8' }}>
        <h3>Loading settings…</h3>
      </div>
    )
  }

  return (
    <div className="settings-page">
      {/* Top Navbar */}
      <nav className="settings-nav">
        <div className="nav-left">
          <Link href="/profile?edit=true" className="back-btn" title="Back to profile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <span className="nav-title">Settings</span>
        </div>
      </nav>

      {/* Main Settings Container */}
      <main className="settings-container">

        {savedMessage && (
          <div className="save-bar">
            <span>✓ {savedMessage}</span>
          </div>
        )}

        {/* 1. Privacy & Discovery */}
        <section className="settings-section">
          <div className="section-header">
            <span className="section-icon">🔒</span>
            <h3 className="section-title">Privacy & Discovery</h3>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-name">Show Me on Discover</span>
              <span className="setting-desc">Allow other students to see your profile in the Discover card stack.</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={discoveryVisible}
                onChange={e => {
                  const val = e.target.checked
                  setDiscoveryVisible(val)
                  saveSetting({ discovery_visible: val })
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-name">Incognito Browsing</span>
              <span className="setting-desc">Browse profiles without sending profile view notifications or appearing in view counters.</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={incognito}
                onChange={e => {
                  const val = e.target.checked
                  setIncognito(val)
                  saveSetting({ incognito: val })
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        {/* 2. Notifications */}
        <section className="settings-section">
          <div className="section-header">
            <span className="section-icon">🔔</span>
            <h3 className="section-title">Notifications</h3>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-name">Email Notifications</span>
              <span className="setting-desc">Receive email alerts for new matches, messages, and campus activity.</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={e => {
                  const val = e.target.checked
                  setEmailNotifications(val)
                  saveSetting({ email_notifications: val })
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-name">Push Notifications</span>
              <span className="setting-desc">Receive real-time push alerts when you get a match or message.</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={pushNotifications}
                onChange={e => {
                  const val = e.target.checked
                  setPushNotifications(val)
                  saveSetting({ push_notifications: val })
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        {/* 3. Blocked Users */}
        <section className="settings-section">
          <div className="section-header">
            <span className="section-icon">🚫</span>
            <h3 className="section-title">Blocked Users</h3>
          </div>

          <div className="blocked-list">
            {blockedUsers.length > 0 ? (
              blockedUsers.map(user => (
                <div key={user.id} className="blocked-item">
                  <div className="blocked-user-info">
                    <img src={user.photo_url} alt={user.name} className="blocked-avatar" />
                    <div>
                      <div className="blocked-name">{user.name}</div>
                      <div className="blocked-sub">{[user.course, user.campus].filter(Boolean).join(' • ') || 'Student'}</div>
                    </div>
                  </div>
                  <button
                    className="btn-unblock"
                    disabled={unblockingId === user.id}
                    onClick={() => handleUnblock(user.id, user.name)}
                  >
                    {unblockingId === user.id ? 'Unblocking…' : 'Unblock'}
                  </button>
                </div>
              ))
            ) : (
              <div className="blocked-empty">
                <p>You haven't blocked any users yet.</p>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab="profile" />
    </div>
  )
}
