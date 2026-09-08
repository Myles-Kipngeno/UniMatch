'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import LoadingScreen from '@/components/LoadingScreen'
import { useAppCache } from '@/context/AppCacheContext'
import { useNetwork } from '@/context/NetworkContext'
import { ProfileSkeleton } from '@/components/skeletons/Skeletons'
import OfflineNotice, { OfflineBanner } from '@/components/OfflineNotice'
import { DEFAULT_AVATAR } from '@/lib/constants'
import { compressImage } from '@/lib/imageCompression'
import './profile.css'

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

import { useModal } from '@/components/ModalContext'

function ProfileFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const modal = useModal()

  const isEditModeParam = searchParams.get('edit') === 'true'

  // User Auth state
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')

  // Form Fields state
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [age, setAge] = useState('')
  const [campus, setCampus] = useState('')
  const [course, setCourse] = useState('')
  const [yearOfStudy, setYearOfStudy] = useState('')
  const [bio, setBio] = useState('')
  const [preference, setPreference] = useState('all')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  
  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')

  // Wizard / Onboarding state
  const [currentStep, setCurrentStep] = useState(1)
  const [profileComplete, setProfileComplete] = useState(false)
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>(isEditModeParam ? 'edit' : 'view')
  const [menuOpen, setMenuOpen] = useState(false)
  // Tracks whether the user has manually clicked a tab (prevents cache effect from overriding it)
  const userChangedTabRef = useRef(false)

  const { getCache, setCache } = useAppCache()
  const { isOnline, isNetworkError, reportNetworkError, clearNetworkError } = useNetwork()

  const viewUserIdParam = searchParams.get('id') || searchParams.get('userId')
  const [isOtherUser, setIsOtherUser] = useState(false)

  const [loading, setLoading] = useState(() => !getCache('profile', viewUserIdParam || 'self'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Sync active tab with URL query parameter (only on initial mount, not after user clicks a tab)
  useEffect(() => {
    if (userChangedTabRef.current) return
    if (isEditModeParam && !isOtherUser) {
      setActiveTab('edit')
    }
  }, [isEditModeParam, isOtherUser])

  // Load from cache initially if present
  useEffect(() => {
    const targetKey = viewUserIdParam || 'self'
    const cached = getCache('profile', targetKey)
    if (cached) {
      if (cached.name) setName(cached.name)
      if (cached.gender) setGender(cached.gender)
      if (cached.age) setAge(String(cached.age))
      if (cached.campus) setCampus(cached.campus)
      if (cached.course) setCourse(cached.course)
      if (cached.year_of_study) setYearOfStudy(cached.year_of_study)
      if (cached.bio) setBio(cached.bio)
      if (cached.preference) setPreference(cached.preference)
      if (cached.interests) setSelectedInterests(cached.interests)
      if (cached.photo_url) {
        setCurrentPhotoUrl(cached.photo_url)
        setPreviewUrl(cached.photo_url)
      }
      if (cached.profile_complete || Boolean(viewUserIdParam)) {
        setProfileComplete(true)
        if (!isEditModeParam && !Boolean(viewUserIdParam) && !userChangedTabRef.current) {
          setActiveTab('view')
        }
      }
      setLoading(false)
    }
  }, [getCache, viewUserIdParam, isEditModeParam])

  // Menu DOM Refs
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Single outside-click dismiss listener pattern
  useEffect(() => {
    if (!menuOpen) return

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [menuOpen])

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      setUserEmail(user.email || '')

      const targetId = viewUserIdParam || user.id
      const viewingOther = Boolean(viewUserIdParam && viewUserIdParam !== user.id)
      setIsOtherUser(viewingOther)

      const targetKey = viewUserIdParam || 'self'
      const cached = getCache('profile', targetKey)
      if (cached) {
        setLoading(false)
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetId)
          .single() as any

        if (profile) {
          setName(profile.name || '')
          setGender(profile.gender || '')
          setAge(profile.age ? String(profile.age) : '')
          setCampus(profile.campus || '')
          setCourse(profile.course || '')
          setYearOfStudy(profile.year_of_study || '')
          setBio(profile.bio || '')
          setPreference(profile.preference || 'all')
          setSelectedInterests(profile.interests || [])
          
          if (profile.photo_url) {
            setCurrentPhotoUrl(profile.photo_url)
            setPreviewUrl(profile.photo_url)
          }

          if (profile.profile_complete || viewingOther) {
            setProfileComplete(true)
            // Fetches can run again when the cache updates. Do not let a
            // background refresh switch a tab the user deliberately selected.
            if (!isEditModeParam && !viewingOther && !userChangedTabRef.current) {
              setActiveTab('view')
            }
          }

          setCache('profile', profile, viewUserIdParam || 'self')
          clearNetworkError()
        }
      } catch (err: any) {
        console.error('Fetch profile error:', err)
        if (!navigator.onLine || err?.message?.includes('fetch')) {
          reportNetworkError()
        }
      } finally {
        setLoading(false)
      }
    }

    getProfile()
  }, [supabase, router, viewUserIdParam, setCache, clearNetworkError, reportNetworkError, getCache, isEditModeParam])

  // Sign out action
  const handleSignOut = () => {
    setMenuOpen(false)
    modal.confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of your UniMatch account?',
      confirmText: 'Sign Out',
      isDanger: true,
      onConfirm: async () => {
        try {
          sessionStorage.clear()
          await supabase.auth.signOut()
          modal.toast("You have been logged out.", "info")
          router.push('/login')
        } catch (e) {
          console.warn("Sign out error:", e)
        }
      }
    })
  }

  // File preview change
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setPreviewUrl(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Toggle interests
  const toggleInterest = (interestName: string) => {
    setError('')
    if (selectedInterests.includes(interestName)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interestName))
    } else {
      setSelectedInterests([...selectedInterests, interestName])
    }
  }

  const handleNext = () => {
    setError('')
    if (currentStep === 1) {
      if (!name.trim() || !gender || !age) {
        setError('Please fill in all basic info fields.')
        return
      }
      const parsedAge = parseInt(age)
      if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 99) {
        setError('Age must be between 18 and 99.')
        return
      }
    }
    if (currentStep === 2) {
      if (!campus.trim() || !course.trim() || !yearOfStudy) {
        setError('Please fill in all campus, course, and year fields.')
        return
      }
    }
    setCurrentStep(prev => prev + 1)
  }

  const handlePrev = () => {
    setError('')
    setCurrentStep(prev => prev - 1)
  }

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError('')

    const parsedAge = parseInt(age)
    if (!name.trim() || !gender || !age || !campus.trim() || !course.trim() || !yearOfStudy) {
      setError('Please complete all required fields.')
      return
    }
    if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 99) {
      setError('Age must be between 18 and 99.')
      return
    }
    if (selectedInterests.length < 3) {
      setError('Please select at least 3 interests.')
      return
    }

    setSaving(true)

    try {
      let finalPhotoUrl = currentPhotoUrl

      if (photoFile && userId) {
        const compressedFile = await compressImage(photoFile)
        const fileExt = compressedFile.name.split('.').pop()
        const filePath = `${userId}/profile_${Date.now()}.${fileExt}`

        const { error: uploadErr } = await supabase.storage
          .from('profile-images')
          .upload(filePath, compressedFile, { upsert: true })

        if (uploadErr) throw uploadErr

        const { data: publicUrlData } = supabase.storage
          .from('profile-images')
          .getPublicUrl(filePath)

        finalPhotoUrl = publicUrlData.publicUrl

        // Also add to profile_photos table
        try {
          await (supabase.from('profile_photos') as any).insert({
            user_id: userId,
            url: finalPhotoUrl,
            type: 'image'
          })
        } catch (_) {}
      }

      const profilePayload = {
        id: userId!,
        email: userEmail,
        name: name.trim(),
        gender,
        age: parsedAge,
        campus: campus.trim(),
        course: course.trim(),
        year_of_study: yearOfStudy,
        bio: bio.trim(),
        preference,
        interests: selectedInterests,
        photo_url: finalPhotoUrl,
        profile_complete: true,
        updated_at: new Date().toISOString()
      }

      const { error: updateErr } = await (supabase.from('profiles') as any)
        .update(profilePayload)
        .eq('id', userId!)

      if (updateErr) {
        console.warn('Update error, trying upsert fallback:', updateErr)
        const { error: upsertErr } = await (supabase.from('profiles') as any)
          .upsert(profilePayload, { onConflict: 'id' })
        if (upsertErr) throw upsertErr
      }

      // Update local state and app cache
      setCurrentPhotoUrl(finalPhotoUrl)
      setPreviewUrl(finalPhotoUrl)
      setPhotoFile(null)
      setProfileComplete(true)
      setCache('profile', profilePayload, 'self')

      if (showTabs) {
        modal.toast('Profile updated successfully! 🎉', 'success')
        setActiveTab('view')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        modal.toast('Profile created! Welcome to UniMatch 🎉', 'success')
        router.push('/dashboard')
      }
    } catch (err: any) {
      console.error('Save profile error:', err)
      setError(err.message || 'Failed to save profile. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (isNetworkError && !getCache('profile', viewUserIdParam || 'self')) {
    return (
      <div className="profile-page">
        <OfflineNotice onRetry={() => { clearNetworkError(); window.location.reload(); }} />
        <BottomNav activeTab={isOtherUser ? "" : "profile"} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="profile-page">
        {!isOnline && <OfflineBanner />}
        <ProfileSkeleton />
        <BottomNav activeTab={isOtherUser ? "" : "profile"} />
      </div>
    )
  }

  const showTabs = (isEditModeParam || profileComplete) && !isOtherUser
  const isViewing = (showTabs && activeTab === 'view') || isOtherUser
  const isEditing = !isOtherUser && (!showTabs || activeTab === 'edit')

  return (
    <div className="profile-page">
      {!isOnline && <OfflineBanner />}
      <div className="bg-gradient"></div>

      <div className="container" style={{ paddingBottom: '96px' }}>
        <div className="card">

          {isOtherUser && (
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => router.back()}
                className="compact-back-btn"
                title="Go back"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                <span>Back</span>
              </button>
            </div>
          )}

          {/* Three-dot menu */}
          {showTabs && (
            <div className="profile-card-menu">
              <button
                ref={triggerRef}
                className="profile-menu-btn"
                onClick={() => setMenuOpen(prev => !prev)}
                title="More options"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2.2" />
                  <circle cx="12" cy="12" r="2.2" />
                  <circle cx="12" cy="19" r="2.2" />
                </svg>
              </button>
              {menuOpen && (
                <div ref={menuRef} className="profile-menu-dropdown open">
                  <Link href="/settings" className="profile-menu-item" onClick={() => setMenuOpen(false)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    <span>Settings</span>
                  </Link>
                  <div className="profile-menu-divider"></div>
                  <button className="profile-menu-item danger" onClick={handleSignOut}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="header">
            <h2>💖 {isOtherUser ? name || 'Student' : 'UniMatch'}</h2>
            <p className="subtitle" id="pageSubtitle">
              {isOtherUser ? 'UniMatch Student Profile' : (showTabs ? 'Manage your dating profile & photos' : 'Create your profile')}
            </p>
          </div>

          {/* Tab System for Edit Mode */}
          {showTabs && (
            <div className="profile-tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`}
                onClick={() => { userChangedTabRef.current = true; setActiveTab('view') }}
              >
                My Card
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
                onClick={() => { userChangedTabRef.current = true; setActiveTab('edit') }}
              >
                Update Profile
              </button>
            </div>
          )}

          {/* Onboarding Progress Bar (Only shown during initial onboarding wizard) */}
          {!showTabs && !isOtherUser && (
            <div className="onboarding-progress">
              <div className="progress-steps">
                <span className={`step-dot ${currentStep >= 1 ? 'active' : ''}`}>1</span>
                <span className={`step-dot ${currentStep >= 2 ? 'active' : ''}`}>2</span>
                <span className={`step-dot ${currentStep >= 3 ? 'active' : ''}`}>3</span>
              </div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${(currentStep / 3) * 100}%` }}></div>
              </div>
            </div>
          )}

          {/* VIEW PROFILE TAB */}
          {isViewing && (
            <div className="view-profile-tab">
              <div className="preview-card">
                <div className="preview-img-wrap">
                  <Image
                    id="viewPhoto"
                    src={previewUrl || DEFAULT_AVATAR}
                    alt="Profile"
                    width={400}
                    height={400}
                  />
                  <div className="preview-overlay">
                    <h3>{name || 'Student'}{age ? `, ${age}` : ''}</h3>
                    <p>📍 {campus || 'Campus'}</p>
                    <p>📚 {course || 'Major'}{yearOfStudy ? ` (${yearOfStudy} Year)` : ''}</p>
                  </div>
                </div>
                <div className="preview-bio-section">
                  <h4>About Me</h4>
                  <p>{bio || 'No bio updated yet.'}</p>
                </div>
                <div className="preview-interests-section">
                  <h4>My Hobbies & Interests</h4>
                  <div className="preview-interests-grid">
                    {selectedInterests.length > 0 ? (
                      selectedInterests.map(i => {
                        const item = CURATED_INTERESTS.find(ci => ci.name === i)
                        return (
                          <span key={i} className="preview-interest-tag">
                            <span>{item ? item.emoji : '✨'}</span>
                            <span>{i}</span>
                          </span>
                        )
                      })
                    ) : (
                      <p style={{ fontSize: '13px', color: '#9e9bb8' }}>No interests selected yet.</p>
                    )}
                  </div>
                </div>

                {/* Own Profile Photo Upload CTA */}
                {!isOtherUser && (
                  <div className="preview-media-cta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="media-cta-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 600 }}>My Media & Photo Gallery</h4>
                        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>Upload multiple photos & videos to your profile</p>
                      </div>
                    </div>
                    <Link href="/upload-photos" className="manage-gallery-link">
                      <span>Manage Gallery →</span>
                    </Link>
                  </div>
                )}

                {/* Other User Action Buttons */}
                {isOtherUser && (
                  <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      className="save-btn"
                      style={{ margin: 0 }}
                      onClick={() => router.push(`/chat?userId=${viewUserIdParam}&user=${encodeURIComponent(name)}`)}
                    >
                      <span>💬 Message {name.split(' ')[0]}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-prev"
                      style={{ width: '100%', padding: '12px', borderRadius: '50px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                      onClick={() => router.push(`/chat?userId=${viewUserIdParam}&prefill=Wave%20👋`)}
                    >
                      👋 Send Wave
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FORM STAGE (Wizard / Update Profile View) */}
          {isEditing && (
            <form onSubmit={handleSaveProfile} className="profile-edit-form">
              
              {/* If in Edit Mode (Tabs active), show structured sections */}
              {showTabs ? (
                <div className="profile-edit-sections-wrap">
                  
                  {/* Section 1: Photo & Core Identity */}
                  <div className="profile-edit-section">
                    <div className="section-header">
                      <span className="section-num">1</span>
                      <div>
                        <h3 className="section-title">Photo & Core Info</h3>
                        <p className="section-desc">Avatar picture and basic student identity</p>
                      </div>
                    </div>

                    <div className="photo-edit-center">
                      <div className="photo-container">
                        <Image
                          id="profilePreview"
                          src={previewUrl || DEFAULT_AVATAR}
                          alt="Profile"
                          width={130}
                          height={130}
                        />
                        <div className="photo-overlay">
                          <label className="upload-label" title="Upload new photo">
                            <div className="camera-icon-wrap">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                                <circle cx="12" cy="13" r="4"/>
                              </svg>
                              <span>Change Photo</span>
                            </div>
                            <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input
                          type="text"
                          placeholder="Your full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Gender</label>
                          <select value={gender} onChange={(e) => setGender(e.target.value)} required>
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="nonbinary">Non-Binary</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Age</label>
                          <input
                            type="number"
                            placeholder="Age"
                            min="18"
                            max="99"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Interested In (Show Me)</label>
                        <select value={preference} onChange={(e) => setPreference(e.target.value)} required>
                          <option value="all">Everyone</option>
                          <option value="male">Men</option>
                          <option value="female">Women</option>
                          <option value="nonbinary">Non-Binary</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Education & Campus */}
                  <div className="profile-edit-section">
                    <div className="section-header">
                      <span className="section-num">2</span>
                      <div>
                        <h3 className="section-title">Campus & Academics</h3>
                        <p className="section-desc">Your university campus and current program</p>
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">University / Campus</label>
                        <input
                          type="text"
                          placeholder="e.g. Main Campus / Town Campus"
                          value={campus}
                          onChange={(e) => setCampus(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Course / Major</label>
                        <input
                          type="text"
                          placeholder="e.g. BSc Computer Science, Law, Medicine"
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Year of Study</label>
                        <select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} required>
                          <option value="">Select Year</option>
                          <option value="1">1st Year (Freshman)</option>
                          <option value="2">2nd Year (Sophomore)</option>
                          <option value="3">3rd Year (Junior)</option>
                          <option value="4">4th Year (Senior)</option>
                          <option value="5">Graduate / PG</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: About Me / Bio */}
                  <div className="profile-edit-section">
                    <div className="section-header">
                      <span className="section-num">3</span>
                      <div>
                        <h3 className="section-title">About Me</h3>
                        <p className="section-desc">Introduce yourself to students and matches</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label className="form-label" style={{ margin: 0 }}>Bio</label>
                        <span style={{ fontSize: '11px', color: '#9e9bb8' }}>{bio.length}/300</span>
                      </div>
                      <textarea
                        placeholder="Write a brief, interesting bio about your passions, campus life, or what you're looking for..."
                        rows={4}
                        maxLength={300}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Section 4: Hobbies & Interests */}
                  <div className="profile-edit-section">
                    <div className="section-header">
                      <span className="section-num">4</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <h3 className="section-title">Hobbies & Interests</h3>
                          <span className={`interest-badge ${selectedInterests.length >= 3 ? 'valid' : ''}`}>
                            {selectedInterests.length >= 3 ? `✓ ${selectedInterests.length} selected` : `${selectedInterests.length}/3 minimum`}
                          </span>
                        </div>
                        <p className="section-desc">Select at least 3 things you love</p>
                      </div>
                    </div>

                    <div className="interests-grid">
                      {CURATED_INTERESTS.map(interest => (
                        <div
                          key={interest.name}
                          className={`interest-pill ${selectedInterests.includes(interest.name) ? 'active' : ''}`}
                          onClick={() => toggleInterest(interest.name)}
                        >
                          <span className="emoji">{interest.emoji}</span>
                          <span>{interest.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 5: Gallery CTA */}
                  <div className="gallery-shortcut-card">
                    <div className="gallery-shortcut-icon">📸</div>
                    <div className="gallery-shortcut-text">
                      <h4>Photo & Media Gallery</h4>
                      <p>Add and reorder extra photos & videos on your profile</p>
                    </div>
                    <Link href="/upload-photos" className="gallery-shortcut-btn">
                      Manage Gallery →
                    </Link>
                  </div>

                  {error && <p className="error" style={{ display: 'block', marginTop: '1rem' }}>{error}</p>}

                  {/* Edit Action Bar */}
                  <div className="edit-action-bar">
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => setActiveTab('view')}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="save-btn" disabled={saving}>
                      {saving ? (
                        <>
                          <div className="spinner-mini"></div>
                          <span>Saving updates...</span>
                        </>
                      ) : (
                        <>
                          <span>Save Changes</span>
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                            <path d="M7.5 15l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Initial Onboarding Wizard (Steps 1, 2, 3) */
                <div className="onboarding-wizard-wrap">
                  {currentStep === 1 && (
                    <div className="wizard-step active">
                      <h3 className="step-title">Tell us about yourself</h3>
                      <div className="form-grid">
                        <div className="form-group">
                          <label className="form-label">Full Name</label>
                          <input
                            type="text"
                            placeholder="Full name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Gender</label>
                            <select value={gender} onChange={(e) => setGender(e.target.value)} required>
                              <option value="">Select Gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="nonbinary">Non-Binary</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Age</label>
                            <input
                              type="number"
                              placeholder="Age"
                              min="18"
                              max="99"
                              value={age}
                              onChange={(e) => setAge(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="wizard-step active">
                      <h3 className="step-title">Education details</h3>
                      <div className="form-grid">
                        <div className="form-group">
                          <label className="form-label">University / Campus</label>
                          <input
                            type="text"
                            placeholder="University / Campus"
                            value={campus}
                            onChange={(e) => setCampus(e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Course / Major</label>
                          <input
                            type="text"
                            placeholder="Course / Major"
                            value={course}
                            onChange={(e) => setCourse(e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Year of Study</label>
                          <select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} required>
                            <option value="">Select Year</option>
                            <option value="1">1st Year (Freshman)</option>
                            <option value="2">2nd Year (Sophomore)</option>
                            <option value="3">3rd Year (Junior)</option>
                            <option value="4">4th Year (Senior)</option>
                            <option value="5">Graduate / PG</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="wizard-step active">
                      <h3 className="step-title">Hobbies, Bio & Photo</h3>
                      <p className="step-subtitle">Select at least 3 things you love</p>
                      
                      <div className="interests-grid" style={{ marginBottom: '2rem' }}>
                        {CURATED_INTERESTS.map(interest => (
                          <div
                            key={interest.name}
                            className={`interest-pill ${selectedInterests.includes(interest.name) ? 'active' : ''}`}
                            onClick={() => toggleInterest(interest.name)}
                          >
                            <span className="emoji">{interest.emoji}</span>
                            <span>{interest.name}</span>
                          </div>
                        ))}
                      </div>

                      <div className="form-grid">
                        <div className="form-group">
                          <label className="form-label">Bio</label>
                          <textarea
                            placeholder="Write a short bio about yourself..."
                            rows={4}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Show Me</label>
                          <select value={preference} onChange={(e) => setPreference(e.target.value)} required>
                            <option value="all">Everyone</option>
                            <option value="male">Men</option>
                            <option value="female">Women</option>
                            <option value="nonbinary">Non-Binary</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ textAlign: 'center' }}>Profile Photo</label>
                          <div className="photo-section" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                            <div className="photo-container">
                              <Image
                                id="profilePreview"
                                src={previewUrl || DEFAULT_AVATAR}
                                alt="Profile"
                                width={140}
                                height={140}
                              />
                              <div className="photo-overlay">
                                <label className="upload-label">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="2"/>
                                    <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2"/>
                                  </svg>
                                  <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && <p className="error" style={{ display: 'block', marginTop: '1rem' }}>{error}</p>}

                  {/* Navigation buttons */}
                  <div className="wizard-buttons" style={{ marginTop: '2rem' }}>
                    {currentStep > 1 && (
                      <button type="button" className="wizard-btn btn-prev" onClick={handlePrev}>Back</button>
                    )}
                    {currentStep < 3 ? (
                      <button type="button" className="wizard-btn btn-next" onClick={handleNext}>Continue</button>
                    ) : (
                      <button type="submit" className="save-btn" disabled={saving}>
                        <span>{saving ? 'Saving...' : 'Finish & Save'}</span>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M7.5 15l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}

            </form>
          )}

        </div>
      </div>

      {/* Slanted Nav / Bottom Navigation */}
      <BottomNav activeTab={isOtherUser ? "" : "profile"} />
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="profile-page">
          <ProfileSkeleton />
          <BottomNav activeTab="profile" />
        </div>
      }
    >
      <ProfileFormContent />
    </Suspense>
  )
}
