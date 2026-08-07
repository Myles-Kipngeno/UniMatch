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
  const [showTipsModal, setShowTipsModal] = useState(false)
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
      const { data, error } = await supabase
        .from('profile_photos' as any)
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

      const imgItems = items.filter(i => i.type === 'image')

      // 3. Ensure Main Photo ALWAYS remains constant at Index 0
      if (activeMainUrl && imgItems.length > 0) {
        const mainIdx = imgItems.findIndex(i => i.url === activeMainUrl)
        if (mainIdx > 0) {
          const [mainItem] = imgItems.splice(mainIdx, 1)
          imgItems.unshift(mainItem)
        }
      }

      setPhotos(imgItems)
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

  const processFiles = async (filesList: File[]) => {
    if (!filesList.length || !uid) return

    const photosList = filesList.filter(f => f.type.startsWith('image/'))
    const videosList = filesList.filter(f => f.type.startsWith('video/'))

    setUploading(true)
    setProgressFillPct(0)
    setProgressLabelText(`Uploading...`)

    let total = filesList.length
    let count = 0

    const uploadGroup = async (group: File[], type: 'image' | 'video') => {
      for (let file of group) {
        count++
        const pct = Math.round((count / total) * 100)
        setProgressFillPct(pct)
        setProgressLabelText(`Uploading ${count} of ${total} (${pct}%)`)

        try {
          const fileToUpload = type === 'image' ? await compressImage(file) : file
          const ext = fileToUpload.name.split('.').pop()
          const filePath = `${uid}/${type}_${Date.now()}_${count}.${ext}`

          const { error: uploadErr } = await supabase.storage
            .from('profile-images')
            .upload(filePath, fileToUpload, { upsert: true })

          if (uploadErr) throw uploadErr

          const { data: publicUrlData } = supabase.storage
            .from('profile-images')
            .getPublicUrl(filePath)

          const publicUrl = publicUrlData.publicUrl

          await (supabase.from('profile_photos') as any).insert({
            user_id: uid,
            url: publicUrl,
            type: type
          })

          // Set main photo if user has no avatar set
          const { data: p } = await supabase
            .from('profiles')
            .select('photo_url')
            .eq('id', uid)
            .single() as any

          if (!p || !p.photo_url) {
            await (supabase.from('profiles') as any)
              .update({ photo_url: publicUrl })
              .eq('id', uid)
            setProfilePhoto(publicUrl)
          }
        } catch (err: any) {
          console.error("Upload error:", err)
          modal.toast(`Upload failed for ${file.name}: ${err.message}`, "error")
        }
      }
    }

    if (photosList.length) await uploadGroup(photosList, 'image')
    if (videosList.length) await uploadGroup(videosList, 'video')

    setUploading(false)
    await loadMedia(uid)
    modal.toast('Media uploaded successfully! ✨', 'success')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    processFiles(files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files || [])
    processFiles(files)
  }

  const handleSetMainPhoto = async (item: MediaItem) => {
    if (!uid) return
    try {
      const nowIso = new Date().toISOString()
      
      // Update created_at so DB order keeps it first
      await (supabase.from('profile_photos') as any)
        .update({ created_at: nowIso })
        .eq('id', item.id)

      // Update primary avatar photo_url
      await (supabase.from('profiles') as any)
        .update({ photo_url: item.url })
        .eq('id', uid)

      setProfilePhoto(item.url)

      // Move photo to first position in state array
      setPhotos(prev => {
        const target = prev.find(p => p.id === item.id) || item
        const rest = prev.filter(p => p.id !== item.id)
        return [{ ...target, created_at: nowIso }, ...rest]
      })

      modal.toast('Main profile photo updated! 🌟', 'success')
    } catch (e: any) {
      console.error("Set main photo error:", e)
      modal.toast('Failed to set main photo', 'error')
    } finally {
      setActiveMenuMediaId(null)
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
          await (supabase.from('profile_photos') as any)
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
        .single() as any

      if (profile) {
        setUserName(profile.name || 'Student')
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

  return (
    <div className="upload-photos-page">
      <div className="bg-gradient"></div>

      {/* Top Main Navigation Header */}
      <header className="media-page-header">
        <div className="mph-left">
          <button className="media-back-btn" onClick={() => router.back()} title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h1 className="mph-title">My Media</h1>
            <p className="mph-sub">Show your world. Share your vibe. ✨</p>
          </div>
        </div>
        <div className="mph-right">
          <button className="mph-tips-btn" onClick={() => setShowTipsModal(true)}>
            <span className="bulb-icon">💡</span> Tips for good photos
          </button>
          <Link href="/notifications" className="mph-bell-btn" title="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="bell-badge-dot"></span>
          </Link>
        </div>
      </header>

      <main className="media-page-container">
        {/* Upper Split Hero Banner */}
        <section className="media-hero-banner">
          {/* Left: User Overview */}
          <div className="mhb-user-card">
            <div className="mhb-avatar-wrap">
              <div className="mhb-avatar-ring">
                <img src={profilePhoto} alt={userName} className="mhb-avatar-img" />
              </div>
              <button className="mhb-avatar-edit-btn" onClick={handleUploadClick} title="Change Profile Photo">
                ✏️
              </button>
            </div>
            <div className="mhb-user-details">
              <div className="mhb-name-row">
                <h2 className="mhb-user-name">{userName}</h2>
                {isVerified && (
                  <span className="mhb-verified-badge" title="Verified Student">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </span>
                )}
              </div>
              <p className="mhb-user-quote">Showcasing real moments helps you attract real connections.</p>
              <div className="mhb-counters-row">
                <div className="mhb-counter-item">
                  <span className="mhb-counter-num">{photos.length}</span>
                  <span className="mhb-counter-lbl">Photos</span>
                </div>
                <div className="mhb-counter-divider"></div>
                <div className="mhb-counter-item">
                  <span className="mhb-counter-num">{videos.length}</span>
                  <span className="mhb-counter-lbl">Videos</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Drag & Drop Upload Zone */}
          <div
            className={`mhb-upload-dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleUploadClick}
          >
            <div className="mhb-upload-icon-circle">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
                <path d="M12 13v-6"/>
                <path d="m9 10 3-3 3 3"/>
              </svg>
            </div>
            <div className="mhb-upload-text-wrap">
              <div className="mhb-upload-title">Add new photos or videos</div>
              <div className="mhb-upload-sub">
                Drag &amp; drop or <span className="mhb-browse-link">browse</span>
              </div>
            </div>
            <button className="mhb-upload-gradient-btn" onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}>
              ↑ Upload
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*"
              multiple
              hidden
              onChange={handleFileChange}
            />
          </div>
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

        {/* Sub-Nav Tabs & Recommendation Pill Row */}
        <div className="media-tabs-row">
          <div className="media-tabs">
            <button
              className={`media-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              ✨ All ({photos.length + videos.length})
            </button>
            <button
              className={`media-tab-btn ${activeTab === 'photos' ? 'active' : ''}`}
              onClick={() => setActiveTab('photos')}
            >
              🖼️ Photos ({photos.length})
            </button>
            <button
              className={`media-tab-btn ${activeTab === 'videos' ? 'active' : ''}`}
              onClick={() => setActiveTab('videos')}
            >
              🎥 Videos ({videos.length})
            </button>
          </div>
          <div className="media-rec-pill" onClick={() => setShowTipsModal(true)}>
            <span className="rec-shield-icon">🛡️</span>
            <span>Add at least 3 photos for better matches</span>
            <span className="rec-arrow">›</span>
          </div>
        </div>

        {/* Main Content Grid & Tips Sidebar */}
        {(() => {
          const hasMediaOrUploading = photos.length > 0 || videos.length > 0 || uploading
          return (
            <div className={`media-main-grid-layout ${hasMediaOrUploading ? 'full-width' : ''}`}>
              {/* Left Column: Photos / Videos Grid */}
              <div className="media-grid-section">
                <div className="media-cards-grid">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <SkeletonBlock key={i} width="100%" height="180px" borderRadius="16px" />
                    ))
                  ) : (
                    <>
                      {displayedItems.map((item, idx) => {
                        const isMain = item.type === 'image' && (hasProfilePhotoMatch ? item.url === profilePhoto : photos[0]?.id === item.id)
                        const isMenuOpen = activeMenuMediaId === item.id
                        return (
                          <div key={item.id} className="media-grid-card">
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
                            
                            {/* Main Photo Tag */}
                            {isMain && item.type === 'image' && (
                              <div className="mgc-main-badge">
                                <span className="star-icon">★</span> Main Photo
                              </div>
                            )}

                            {/* Top-Right Menu Ellipsis (Vertical) */}
                            <div className="mgc-menu-wrap">
                              <button
                                ref={isMenuOpen ? triggerRef : null}
                                className="mgc-menu-trigger"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveMenuMediaId(isMenuOpen ? null : item.id)
                                }}
                              >
                                ⋮
                              </button>
                              {isMenuOpen && (
                                <div ref={menuRef} className="mgc-dropdown-popover" onClick={(e) => e.stopPropagation()}>
                                  {item.type === 'image' && (
                                    isMain ? (
                                      <div className="mgc-dropdown-item active-main">
                                        ✓ Main Profile Photo
                                      </div>
                                    ) : (
                                      <button className="mgc-dropdown-item" onClick={() => handleSetMainPhoto(item)}>
                                        🌟 Set as Main Photo
                                      </button>
                                    )
                                  )}
                                  <button className="mgc-dropdown-item" onClick={() => { setActiveMenuMediaId(null); handleMediaClick(idx); }}>
                                    🔍 View Fullscreen
                                  </button>
                                  <button className="mgc-dropdown-item danger" onClick={() => handleDelete(item)}>
                                    🗑️ Delete Media
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Bottom Drag / Video Handle */}
                            <div className="mgc-bottom-handle">
                              {item.type === 'video' ? '▶' : '≡'}
                            </div>
                          </div>
                        )
                      })}

                      {/* Always Show "Add More Photos" Slot */}
                      <div className="media-add-card" onClick={handleUploadClick}>
                        <div className="mac-plus-circle">+</div>
                        <div className="mac-title">Add More {activeTab === 'photos' ? 'Photos' : 'Videos'}</div>
                        <div className="mac-sub">You can add up to 9 {activeTab === 'photos' ? 'photos' : 'videos'}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: Tips Sidebar (disappears when uploading or when media exists) */}
              {!hasMediaOrUploading && (
                <aside className="media-tips-sidebar">
                  <div className="tips-card">
                    <div className="tips-header">
                      <span className="tips-rocket-icon">🚀</span>
                      <h3 className="tips-title">Make a great impression</h3>
                    </div>

                    <div className="tips-list">
                      <div className="tip-item">
                        <div className="tip-icon-box pink">📷</div>
                        <div className="tip-text-wrap">
                          <div className="tip-heading">Use clear, recent photos</div>
                          <div className="tip-body">Help others see the real you.</div>
                        </div>
                      </div>

                      <div className="tip-item">
                        <div className="tip-icon-box yellow">😊</div>
                        <div className="tip-text-wrap">
                          <div className="tip-heading">Show your lifestyle</div>
                          <div className="tip-body">Photos that show your vibe get more interactions.</div>
                        </div>
                      </div>

                      <div className="tip-item">
                        <div className="tip-icon-box purple">🖼️</div>
                        <div className="tip-text-wrap">
                          <div className="tip-heading">Variety is key</div>
                          <div className="tip-body">Mix solo shots, activities and social photos.</div>
                        </div>
                      </div>

                      <div className="tip-item">
                        <div className="tip-icon-box cyan">🩵</div>
                        <div className="tip-text-wrap">
                          <div className="tip-heading">Be yourself</div>
                          <div className="tip-body">Authenticity attracts authentic connections.</div>
                        </div>
                      </div>
                    </div>

                    <button className="tips-guidelines-btn" onClick={() => setShowTipsModal(true)}>
                      View Photo Guidelines ›
                    </button>
                  </div>
                </aside>
              )}
            </div>
          )
        })()}
      </main>

      {/* Full-screen Lightbox Gallery Viewer with Swipe & Prev/Next Buttons */}
      {viewerOpen && currentViewerMedia && (
        <div className="up-viewer open" onClick={() => setViewerOpen(false)}>
          <div className="up-viewer-bg"></div>
          <button className="up-viewer-close" onClick={() => setViewerOpen(false)} title="Close">✕</button>

          {/* Desktop / Laptop Prev & Next Buttons */}
          {displayedItems.length > 1 && (
            <>
              <button
                className="up-viewer-nav-btn prev"
                onClick={(e) => { e.stopPropagation(); handlePrevMedia(); }}
                title="Previous photo (Left Arrow)"
              >
                ‹
              </button>
              <button
                className="up-viewer-nav-btn next"
                onClick={(e) => { e.stopPropagation(); handleNextMedia(); }}
                title="Next photo (Right Arrow)"
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

      {/* Photo Guidelines Modal */}
      {showTipsModal && (
        <div className="modal-backdrop" onClick={() => setShowTipsModal(false)}>
          <div className="modal-card photo-tips-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💡 Photo &amp; Media Guidelines</h3>
              <button className="modal-close" onClick={() => setShowTipsModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <ul className="guidelines-list">
                <li><strong>Clear Face Photo:</strong> Ensure your main profile photo clearly shows your face without heavy filters.</li>
                <li><strong>Good Lighting:</strong> Natural outdoor daylight works best for vibrant, attractive photos.</li>
                <li><strong>No Group Photos as Main:</strong> Keep your main photo solo so people instantly know who you are!</li>
                <li><strong>Show Hobbies &amp; Campus Vibe:</strong> Include photos of sports, music, law/campus events, or social hangouts.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav activeTab="profile" />
    </div>
  )
}
