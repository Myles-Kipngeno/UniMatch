'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { DEFAULT_AVATAR } from '@/lib/constants'
import './upload-photos.css'

interface MediaItem {
  id: string
  url: string
  type: 'image' | 'video'
}

export default function UploadPhotosPage() {
  const router = useRouter()
  const supabase = createClient()

  const [uid, setUid] = useState<string | null>(null)
  const [userName, setUserName] = useState('User')
  const [profilePhoto, setProfilePhoto] = useState(DEFAULT_AVATAR)
  
  const [photos, setPhotos] = useState<MediaItem[]>([])
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)

  // Upload Progress
  const [uploading, setUploading] = useState(false)
  const [progressFillPct, setProgressFillPct] = useState(0)
  const [progressLabelText, setProgressLabelText] = useState('Uploading...')

  // Lightbox
  const [viewerOpen, setViewerOpen] = useState(false)
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadMedia = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profile_photos' as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const items = (data || []).map((m: any) => ({
        id: m.id,
        url: m.url,
        type: m.type
      }))

      setPhotos(items.filter(i => i.type === 'image'))
      setVideos(items.filter(i => i.type === 'video'))
    } catch (e) {
      console.warn("Load media error:", e)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !uid) return

    const photosList = files.filter(f => f.type.startsWith('image/'))
    const videosList = files.filter(f => f.type.startsWith('video/'))

    setUploading(true)
    setProgressFillPct(0)
    setProgressLabelText(`Uploading...`)

    let total = files.length
    let count = 0

    const uploadGroup = async (group: File[], type: 'image' | 'video') => {
      for (let file of group) {
        count++
        const pct = Math.round((count / total) * 100)
        setProgressFillPct(pct)
        setProgressLabelText(`Uploading ${count} of ${total} (${pct}%)`)

        try {
          const ext = file.name.split('.').pop()
          const filePath = `${uid}/${type}_${Date.now()}_${count}.${ext}`

          const { error: uploadErr } = await supabase.storage
            .from('profile-images')
            .upload(filePath, file, { upsert: true })

          if (uploadErr) throw uploadErr

          const { data: publicUrlData } = supabase.storage
            .from('profile-images')
            .getPublicUrl(filePath)

          const publicUrl = publicUrlData.publicUrl

          await supabase.from('profile_photos' as any).insert({
            user_id: uid,
            url: publicUrl,
            type: type
          })

          // Primary photo fallback
          const { data: p } = await supabase
            .from('profiles')
            .select('photo_url')
            .eq('id', uid)
            .single()

          if (!p || !p.photo_url) {
            await supabase
              .from('profiles')
              .update({ photo_url: publicUrl })
              .eq('id', uid)
            setProfilePhoto(publicUrl)
          }
        } catch (err: any) {
          console.error("Upload error:", err)
          alert(`Upload failed for ${file.name}: ${err.message}`)
        }
      }
    }

    if (photosList.length) await uploadGroup(photosList, 'image')
    if (videosList.length) await uploadGroup(videosList, 'video')

    setUploading(false)
    await loadMedia(uid)
  }

  const handleDelete = async (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation()
    if (!confirm('Delete this item?')) return

    try {
      // 1. Extract storage path from url
      const parts = item.url.split('/profile-images/')
      if (parts.length > 1) {
        const filePath = decodeURIComponent(parts[1])
        const { error: storageErr } = await supabase.storage
          .from('profile-images')
          .remove([filePath])
        if (storageErr) {
          console.warn("Storage file deletion warning:", storageErr)
        }
      }

      // 2. Clear user profile picture if this was the primary photo
      const { data: p } = await supabase
        .from('profiles')
        .select('photo_url')
        .eq('id', uid!)
        .single()

      if (p && p.photo_url === item.url) {
        await supabase
          .from('profiles')
          .update({ photo_url: null })
          .eq('id', uid!)
        setProfilePhoto(DEFAULT_AVATAR)
      }

      // 3. Delete from database
      await supabase.from('profile_photos' as any).delete().eq('id', item.id)
      await loadMedia(uid!)
    } catch (e) {
      console.error("Delete media error:", e)
    }
  }

  const handleMediaClick = (item: MediaItem) => {
    setActiveMedia(item)
    setViewerOpen(true)
  }

  const closeViewer = () => {
    setViewerOpen(false)
    setActiveMedia(null)
  }

  useEffect(() => {
    async function initPage() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUid(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, photo_url')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserName(profile.name || 'User')
        if (profile.photo_url) setProfilePhoto(profile.photo_url)
      }
      await loadMedia(user.id)
    }

    initPage()
  }, [supabase, router])

  return (
    <div className="upload-photos-page">
      <div className="bg-gradient"></div>

      {/* Shared Top Nav */}
      <nav className="top-navbar">
        <div className="top-nav-content">
          <div className="top-nav-logo" onClick={() => router.push('/dashboard')}>
            <div className="top-nav-logo-mark">U</div>
            <div className="top-nav-logo-words">
              <span className="top-nav-logo-main">UniMatch</span>
              <span className="top-nav-logo-sub">Your campus, connected</span>
            </div>
          </div>
          <div className="top-nav-links">
            <Link href="/dashboard" className="top-nav-link">Home</Link>
            <Link href="/discover" className="top-nav-link">Discover</Link>
            <Link href="/chat" className="top-nav-link">Messages</Link>
          </div>
        </div>
      </nav>

      {/* Page Navbar */}
      <nav className="navbar">
        <div className="nav-content">
          <button onClick={() => router.back()} className="back-btn">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="page-title">My Media</h1>
          <div className="spacer"></div>
        </div>
      </nav>

      <main className="upload-page">
        {/* User Profile Section */}
        <div className="profile-header">
          <div className="profile-photo-large">
            <img src={profilePhoto} alt="Profile" />
          </div>
          <div className="profile-info">
            <h2>{userName}</h2>
            <div className="profile-stats">
              <div className="stat">
                <span className="stat-value">{photos.length}</span>
                <span className="stat-label">photos</span>
              </div>
              <div className="stat">
                <span className="stat-value">{videos.length}</span>
                <span className="stat-label">videos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Action */}
        <div className="upload-actions">
          <button className="upload-btn upload-photo-btn" onClick={handleUploadClick}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Upload</span>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*"
              multiple
              hidden
              onChange={handleFileChange}
            />
          </button>
        </div>

        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressFillPct}%` }}></div>
            </div>
            <p>{progressLabelText}</p>
          </div>
        )}

        {/* Photos Grid */}
        <div className="media-section" id="photosSection">
          <h3 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Photos
          </h3>
          <div className="media-grid">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading...</p>
              </div>
            ) : photos.length > 0 ? (
              photos.map(item => (
                <div key={item.id} className="media-card" onClick={() => handleMediaClick(item)}>
                  <img src={item.url} alt="User Media" />
                  <button className="delete-btn" title="Delete Media" onClick={(e) => handleDelete(e, item)}>✕</button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 80 80" fill="none">
                  <rect x="10" y="15" width="60" height="50" rx="4" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="40" cy="35" r="8" stroke="currentColor" stroke-width="2"/>
                  <path d="M10 55l15-15 10 10 20-20 15 15" stroke="currentColor" stroke-width="2" strokeLinecap="round"/>
                </svg>
                <h3>No photos yet</h3>
                <p>Upload photos to share with others</p>
              </div>
            )}
          </div>
        </div>

        {/* Videos Grid */}
        <div className="media-section" id="videosSection">
          <h3 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
              <rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M16 9l6-4v14l-6-4V9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            Videos
          </h3>
          <div className="media-grid">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading...</p>
              </div>
            ) : videos.length > 0 ? (
              videos.map(item => (
                <div key={item.id} className="media-card" onClick={() => handleMediaClick(item)}>
                  <video src={item.url}></video>
                  <div className="video-badge">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    <span>VIDEO</span>
                  </div>
                  <div className="video-play-icon">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
                      <polygon points="8 5 19 12 8 19 8 5"/>
                    </svg>
                  </div>
                  <button className="delete-btn" title="Delete Media" onClick={(e) => handleDelete(e, item)}>✕</button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 80 80" fill="none">
                  <rect x="10" y="15" width="60" height="50" rx="4" stroke="currentColor" stroke-width="2"/>
                  <polygon points="35 30 52 40 35 50" fill="currentColor"/>
                </svg>
                <h3>No videos yet</h3>
                <p>Upload short clips to show your campus lifestyle</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Full-screen Lightbox Media Viewer */}
      <div className={`up-viewer ${viewerOpen ? 'open' : ''}`}>
        <div className="up-viewer-bg" onClick={closeViewer}></div>
        <button className="up-viewer-close" onClick={closeViewer}>✕</button>
        <div className="up-viewer-content">
          {activeMedia && (
            activeMedia.type === 'video' ? (
              <video src={activeMedia.url} className="up-viewer-video" controls autoPlay></video>
            ) : (
              <img src={activeMedia.url} alt="Enlarged view" className="up-viewer-img" />
            )
          )}
        </div>
      </div>

      {/* 5-TAB BOTTOM NAVIGATION */}
      <BottomNav activeTab="profile" />
    </div>
  )
}
