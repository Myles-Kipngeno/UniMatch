'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { SkeletonBlock } from '@/components/skeletons/Skeletons'
import { DEFAULT_AVATAR } from '@/lib/constants'
import { compressImage } from '@/lib/imageCompression'
import { useModal } from '@/components/ModalContext'
import './upload-photos.css'

interface MediaItem {
  id: string
  url: string
  type: 'image' | 'video'
  created_at?: string
}

export default function UploadPhotosPage() {
  const router = useRouter()
  const supabase = createClient()
  const modal = useModal()

  const [mounted, setMounted] = useState(false)
  const [uid, setUid] = useState<string | null>(null)
  const [userName, setUserName] = useState('Student')
  const [profilePhoto, setProfilePhoto] = useState(DEFAULT_AVATAR)
  const [isVerified, setIsVerified] = useState(true)

  const [photos, setPhotos] = useState<MediaItem[]>([])
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'photos' | 'videos'>('all')

  // Drag & Drop / Upload
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progressFillPct, setProgressFillPct] = useState(0)
  const [progressLabelText, setProgressLabelText] = useState('Uploading...')

  // Lightbox & Touch Navigation
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [activeMenuMediaId, setActiveMenuMediaId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // Single outside-click / touch-tap dismiss listener
  useEffect(() => {
    if (!activeMenuMediaId) return

    const handleOutsideAction = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setActiveMenuMediaId(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideAction)
    document.addEventListener('touchstart', handleOutsideAction, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutsideAction)
      document.removeEventListener('touchstart', handleOutsideAction)
    }
  }, [activeMenuMediaId])

  const loadMedia = async (userId: string) => {
    try {
      // 1. Fetch user's active main photo from profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('photo_url')
        .eq('id', userId)
        .single() as any

      const activeMainUrl = prof?.photo_url || profilePhoto

      // 2. Fetch all user photos & videos
      const { data, error } = await (supabase
        .from('profile_photos' as any) as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const items: MediaItem[] = (data || []).map((m: any) => ({
        id: m.id,
        url: m.url,
        type: m.type,
        created_at: m.created_at
      }))

      const photosList = items.filter(i => i.type === 'image')
      const videosList = items.filter(i => i.type === 'video')

      // Ensure active main photo is at the very front of the photos list
      if (activeMainUrl && activeMainUrl !== DEFAULT_AVATAR) {
        const mainIdx = photosList.findIndex(p => p.url === activeMainUrl)
        if (mainIdx > 0) {
          const [mainItem] = photosList.splice(mainIdx, 1)
          photosList.unshift(mainItem)
        }
      }

      setPhotos(photosList)
      setVideos(videosList)
    } catch (err) {
      console.error('Error loading media:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files))
    }
    e.target.value = ''
  }

  const handleFiles = async (files: File[]) => {
    if (!uid) {
      modal.toast('Please log in to upload media', 'error')
      return
    }

    setUploading(true)
    setProgressFillPct(5)
    setProgressLabelText('Preparing upload...')

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const isVideo = file.type.startsWith('video/')
        const isImage = file.type.startsWith('image/')

        if (!isImage && !isVideo) {
          modal.toast(`Unsupported file type: ${file.name}`, 'warning')
          continue
        }

        if (file.size > 50 * 1024 * 1024) {
          modal.toast(`${file.name} is too large (max 50MB)`, 'warning')
          continue
        }

        setProgressLabelText(`Uploading ${file.name}... (${i + 1}/${files.length})`)
        setProgressFillPct(Math.round(((i + 0.3) / files.length) * 100))

        let uploadBlob: Blob = file
        let fileExt = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')

        if (isImage) {
          try {
            uploadBlob = await compressImage(file, 1600, 1600, 0.82)
            fileExt = 'jpg'
          } catch (compErr) {
            console.warn('Compression skipped:', compErr)
          }
        }

        const fileName = `${uid}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`

        const { error: uploadErr } = await supabase.storage
          .from('profile-images')
          .upload(fileName, uploadBlob, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadErr) {
          console.error('Storage upload error:', uploadErr)
          modal.toast(`Failed to upload ${file.name}`, 'error')
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(fileName)

        const { error: dbErr } = await (supabase
          .from('profile_photos' as any) as any)
          .insert({
            user_id: uid,
            url: publicUrl,
            type: isVideo ? 'video' : 'image',
            position: photos.length + videos.length + i
          })

        if (dbErr) {
          console.error('DB insert error:', dbErr)
        }

        // Set as main profile photo if user currently has default avatar
        if (isImage && (!profilePhoto || profilePhoto === DEFAULT_AVATAR)) {
          await (supabase.from('profiles') as any)
            .update({ photo_url: publicUrl })
            .eq('id', uid)
          setProfilePhoto(publicUrl)
        }

        setProgressFillPct(Math.round(((i + 1) / files.length) * 100))
      }

      modal.toast('Upload complete! 🎉', 'success')
      await loadMedia(uid)
    } catch (err: any) {
      console.error('Upload flow error:', err)
      modal.toast('Something went wrong during upload', 'error')
    } finally {
      setUploading(false)
      setProgressFillPct(0)
    }
  }

  const handleSetMainPhoto = async (item: MediaItem) => {
    if (!uid || item.type !== 'image') return
    try {
      setActiveMenuMediaId(null)
      const { error } = await (supabase.from('profiles') as any)
        .update({ photo_url: item.url })
        .eq('id', uid)

      if (error) throw error

      setProfilePhoto(item.url)
      modal.toast('Main profile photo updated! 🌟', 'success')
      await loadMedia(uid)
    } catch (err: any) {
      console.error('Set main photo error:', err)
      modal.toast('Failed to update main photo', 'error')
    }
  }

  const handleDelete = async (item: MediaItem) => {
    setActiveMenuMediaId(null)
    modal.confirm({
      title: 'Delete Media',
      message: 'Are you sure you want to delete this media? This action cannot be undone.',
      confirmText: 'Delete',
      isDanger: true,
      onConfirm: async () => {
        try {
          const parts = item.url.split('/profile-images/')
          if (parts.length > 1) {
            const filePath = decodeURIComponent(parts[1])
            await supabase.storage.from('profile-images').remove([filePath])
          }
          await (supabase.from('profile_photos' as any) as any)
            .delete()
            .eq('id', item.id)

          if (profilePhoto === item.url) {
            await (supabase.from('profiles') as any).update({ photo_url: null }).eq('id', uid!)
            setProfilePhoto(DEFAULT_AVATAR)
          }
          await loadMedia(uid!)
          modal.toast('Media deleted', 'info')
        } catch (err: any) {
          console.error('Delete error:', err)
          modal.toast('Failed to delete item', 'error')
        }
      }
    })
  }

  const handleMediaClick = (index: number) => {
    setViewerIndex(index)
    setViewerOpen(true)
  }

  useEffect(() => {
    setMounted(true)
    async function initPage() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUid(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, photo_url, verified')
        .eq('id', user.id)
        .single() as any

      if (profile) {
        setUserName(profile.name || 'Student')
        setIsVerified(Boolean(profile.verified))
        if (profile.photo_url) setProfilePhoto(profile.photo_url)
      }
      await loadMedia(user.id)
    }

    initPage()
  }, [supabase, router])

  const displayedItems = activeTab === 'all'
    ? [...photos, ...videos]
    : activeTab === 'photos'
      ? photos
      : videos

  const hasProfilePhotoMatch = displayedItems.some(i => i.url === profilePhoto)
  const currentViewerMedia = displayedItems[viewerIndex] || null

  const handleNextMedia = () => {
    if (displayedItems.length === 0) return
    setViewerIndex(prev => (prev + 1) % displayedItems.length)
  }

  const handlePrevMedia = () => {
    if (displayedItems.length === 0) return
    setViewerIndex(prev => (prev - 1 + displayedItems.length) % displayedItems.length)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchStartX - touchEndX
    if (diff > 40) {
      handleNextMedia()
    } else if (diff < -40) {
      handlePrevMedia()
    }
    setTouchStartX(null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewerOpen) return
      if (e.key === 'ArrowRight') handleNextMedia()
      if (e.key === 'ArrowLeft') handlePrevMedia()
      if (e.key === 'Escape') setViewerOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewerOpen, displayedItems])

  if (!mounted || loading) {
    return (
      <div className="upload-photos-page">
        <div className="bg-gradient"></div>
        <header className="media-page-header">
          <button className="media-back-btn" onClick={() => router.back()} title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="mph-center-title">
            <h1 className="mph-title">My Media</h1>
          </div>
          <Link href="/notifications" className="mph-bell-btn" title="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </Link>
        </header>
        <main className="media-page-container">
          <section className="media-profile-center-section">
            <SkeletonBlock width="96px" height="96px" borderRadius="50%" />
            <div style={{ height: 12 }}></div>
            <SkeletonBlock width="140px" height="20px" borderRadius="8px" />
          </section>
          <div className="media-cards-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} width="100%" height="100%" borderRadius="14px" />
            ))}
          </div>
        </main>
        <BottomNav activeTab="profile" />
      </div>
    )
  }

  return (
    <div className="upload-photos-page">
      <div className="bg-gradient"></div>

      {/* ═══ 1. TOP HEADER ROW ═══ */}
      <header className="media-page-header">
        <button className="media-back-btn" onClick={() => router.back()} title="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="mph-center-title">
          <h1 className="mph-title">My Media</h1>
        </div>

        <Link href="/notifications" className="mph-bell-btn" title="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="bell-badge-dot"></span>
        </Link>
      </header>

      <main className="media-page-container">

        {/* ═══ 2. CENTERED PROFILE SECTION ═══ */}
        <section className="media-profile-center-section">
          <div className="mpcs-avatar-wrap">
            <div className="mpcs-avatar-ring">
              <img src={profilePhoto} alt={userName} className="mpcs-avatar-img" />
            </div>
            <button className="mpcs-avatar-edit-btn" onClick={handleUploadClick} title="Change Profile Photo">
              ✏️
            </button>
          </div>

          <div className="mpcs-text-wrap">
            <div className="mpcs-name-row">
              <h2 className="mpcs-name">{userName}</h2>
              {isVerified && (
                <span className="mpcs-verified-badge" title="Verified Student">✓</span>
              )}
            </div>
            <p className="mpcs-sub">
              {photos.length} Photo{photos.length === 1 ? '' : 's'} • {videos.length} Video{videos.length === 1 ? '' : 's'}
            </p>
          </div>
        </section>

        {/* ═══ 3. ACTION / UPLOAD DROPZONE CARD ═══ */}
        <section
          className={`media-action-dropzone-card ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleUploadClick}
        >
          <div className="madc-icon-circle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              <path d="M12 13v-6" />
              <path d="m9 10 3-3 3 3" />
            </svg>
          </div>

          <div className="madc-text-wrap">
            <div className="madc-title">Add photos or videos</div>
            <div className="madc-sub">Tap to browse or drop media here</div>
          </div>

          <button className="madc-upload-btn" onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}>
            + Upload
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </section>

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="upload-progress-card">
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progressFillPct}%` }}></div>
            </div>
            <p className="progress-status-text">{progressLabelText}</p>
          </div>
        )}

        {/* ═══ 4. FILTER TABS ═══ */}
        <div className="media-tabs-row">
          <div className="media-tabs">
            <button
              className={`media-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({photos.length + videos.length})
            </button>
            <button
              className={`media-tab-btn ${activeTab === 'photos' ? 'active' : ''}`}
              onClick={() => setActiveTab('photos')}
            >
              Photos ({photos.length})
            </button>
            <button
              className={`media-tab-btn ${activeTab === 'videos' ? 'active' : ''}`}
              onClick={() => setActiveTab('videos')}
            >
              Videos ({videos.length})
            </button>
          </div>
        </div>

        {/* ═══ 5. STRICT 3-COLUMN UNIFORM SQUARE MEDIA GRID ═══ */}
        <div className="media-grid-section">
          <div className="media-cards-grid">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBlock key={i} width="100%" height="100%" borderRadius="16px" />
              ))
            ) : (
              <>
                {displayedItems.map((item, idx) => {
                  const isMain = item.type === 'image' && (hasProfilePhotoMatch ? item.url === profilePhoto : photos[0]?.id === item.id)
                  const isMenuOpen = activeMenuMediaId === item.id
                  const colPos = idx % 3 === 0 ? 'pos-left' : idx % 3 === 2 ? 'pos-right' : 'pos-center'
                  return (
                    <div key={item.id} className={`media-grid-card ${isMenuOpen ? 'menu-open' : ''}`}>
                      <div className="mgc-media-inner">
                        {item.type === 'video' ? (
                          <div className="mgc-video-preview" onClick={() => handleMediaClick(idx)}>
                            <video src={`${item.url}#t=0.1`} preload="metadata" className="mgc-video" muted playsInline />
                            <div className="mgc-video-play-overlay">
                              <span className="mgc-play-icon">▶</span>
                            </div>
                            <div className="mgc-video-badge">VIDEO</div>
                          </div>
                        ) : (
                          <img src={item.url} alt="Uploaded Media" className="mgc-img" onClick={() => handleMediaClick(idx)} />
                        )}

                        {/* Main Photo Badge */}
                        {isMain && item.type === 'image' && (
                          <div className="mgc-main-badge">
                            ★ Main
                          </div>
                        )}
                      </div>

                      {/* Top-Right Menu Ellipsis */}
                      <div className="mgc-menu-wrap">
                        <button
                          ref={isMenuOpen ? triggerRef : null}
                          className={`mgc-menu-trigger ${isMenuOpen ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuMediaId(isMenuOpen ? null : item.id)
                          }}
                          title="Media options"
                        >
                          ⋮
                        </button>
                        {isMenuOpen && (
                          <div ref={menuRef} className={`mgc-dropdown-popover ${colPos}`} onClick={(e) => e.stopPropagation()}>
                            {item.type === 'image' && (
                              isMain ? (
                                <div className="mgc-dropdown-item active-main">
                                  <span>✓</span>
                                  <span>Main Profile Photo</span>
                                </div>
                              ) : (
                                <button className="mgc-dropdown-item" onClick={() => handleSetMainPhoto(item)}>
                                  <span>🌟</span>
                                  <span>Set as Main Photo</span>
                                </button>
                              )
                            )}
                            <button className="mgc-dropdown-item" onClick={() => { setActiveMenuMediaId(null); handleMediaClick(idx); }}>
                              <span>🔍</span>
                              <span>View Fullscreen</span>
                            </button>
                            <div className="mgc-dropdown-divider"></div>
                            <button className="mgc-dropdown-item danger" onClick={() => handleDelete(item)}>
                              <span>🗑️</span>
                              <span>Delete Media</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Uniform Square "Add More" Card */}
                <div className="media-add-card" onClick={handleUploadClick}>
                  <div className="mac-plus-circle">+</div>
                  <div className="mac-title">Add More</div>
                </div>
              </>
            )}
          </div>
        </div>

      </main>

      {/* ═══ LIGHTBOX GALLERY VIEWER ═══ */}
      {viewerOpen && currentViewerMedia && (
        <div className="up-viewer open" onClick={() => setViewerOpen(false)}>
          <div className="up-viewer-bg"></div>
          <button className="up-viewer-close" onClick={() => setViewerOpen(false)} title="Close">✕</button>

          {displayedItems.length > 1 && (
            <>
              <button
                className="up-viewer-nav-btn prev"
                onClick={(e) => { e.stopPropagation(); handlePrevMedia(); }}
                title="Previous (Left Arrow)"
              >
                ‹
              </button>
              <button
                className="up-viewer-nav-btn next"
                onClick={(e) => { e.stopPropagation(); handleNextMedia(); }}
                title="Next (Right Arrow)"
              >
                ›
              </button>
            </>
          )}

          <div
            className="up-viewer-content"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {currentViewerMedia.type === 'video' ? (
              <video src={currentViewerMedia.url} className="up-viewer-video" controls autoPlay></video>
            ) : (
              <img src={currentViewerMedia.url} alt="Full view" className="up-viewer-img" />
            )}
            {displayedItems.length > 1 && (
              <div className="up-viewer-counter">
                {viewerIndex + 1} / {displayedItems.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav activeTab="profile" />
    </div>
  )
}
