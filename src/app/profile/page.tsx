'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { DEFAULT_AVATAR } from '@/lib/constants'
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

function ProfileFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

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
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view')
  const [menuOpen, setMenuOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      setUserEmail(user.email || '')

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

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

          if (profile.profile_complete) {
            setProfileComplete(true)
            setActiveTab('view')
          }
        }
      } catch (err) {
        console.error('Fetch profile error:', err)
      } finally {
        setLoading(false)
      }
    }

    getProfile()
  }, [supabase, router])

  // Handle outside click to close three-dot menu
  useEffect(() => {
    const handleOutsideClick = () => setMenuOpen(false)
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

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
        const fileExt = photoFile.name.split('.').pop()
        const filePath = `${userId}/profile_${Date.now()}.${fileExt}`

        const { error: uploadErr } = await supabase.storage
          .from('profile-images')
          .upload(filePath, photoFile, { upsert: true })

        if (uploadErr) throw uploadErr

        const { data: publicUrlData } = supabase.storage
          .from('profile-images')
          .getPublicUrl(filePath)

        finalPhotoUrl = publicUrlData.publicUrl
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

      const { error: updateErr } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', userId!)

      if (updateErr) {
        console.warn('Update error, trying upsert fallback:', updateErr)
        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' })
        if (upsertErr) throw upsertErr
      }

      alert('Profile saved successfully!')
      setProfileComplete(true)
      router.push('/dashboard')
    } catch (err: any) {
      console.error('Save profile error:', err)
      setError(err.message || 'Failed to save profile. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', background: '#0f0e17' }}>
        <h3>Loading your profile...</h3>
      </div>
    )
  }

  const showTabs = isEditModeParam || profileComplete
  const isViewing = showTabs && activeTab === 'view'
  const isEditing = !showTabs || activeTab === 'edit'

  return (
    <div className="profile-page">
      <div className="bg-gradient"></div>

      <div className="container" style={{ paddingBottom: '96px' }}>
        <div className="card">

          {/* Three-dot menu (only shown in edit mode) */}
          {showTabs && (
            <div className="profile-card-menu" onClick={(e) => e.stopPropagation()}>
              <button className="profile-menu-btn" onClick={() => setMenuOpen(!menuOpen)} title="More options">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
              <div className={`profile-menu-dropdown ${menuOpen ? 'open' : ''}`}>
                <Link href="/upload-photos" className="profile-menu-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5" />
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                    <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  </svg>
                  <span>Upload Photos</span>
                </Link>
                <Link href="/settings" className="profile-menu-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  <span>Settings</span>
                </Link>
                <Link href="/dashboard" className="profile-menu-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    <path d="M9 22V12h6v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  </svg>
                  <span>Back to Home</span>
                </Link>
              </div>
            </div>
          )}

          <div className="header">
            <h2>💖 UniMatch</h2>
            <p className="subtitle" id="pageSubtitle">
              {showTabs ? 'Manage your dating profile & photos' : 'Create your profile'}
            </p>
          </div>

          {/* Tab System for Edit Mode */}
          {showTabs && (
            <div className="profile-tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`}
                onClick={() => setActiveTab('view')}
              >
                My Card
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
                onClick={() => setActiveTab('edit')}
              >
                Update Profile
              </button>
            </div>
          )}

          {/* Onboarding Progress Bar */}
          {!showTabs && (
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
                  <img
                    id="viewPhoto"
                    src={previewUrl || DEFAULT_AVATAR}
                    alt="Profile"
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
                    {selectedInterests.map(i => {
                      const item = CURATED_INTERESTS.find(ci => ci.name === i)
                      return (
                        <span key={i} className="preview-interest-tag">
                          <span>{item ? item.emoji : '✨'}</span>
                          <span>{i}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FORM STAGE (Wizard/Edit view) */}
          {isEditing && (
            <form onSubmit={handleSaveProfile}>
              
              {/* Wizard Step 1: Basics OR Edit Mode Basics */}
              {(showTabs || currentStep === 1) && (
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

              {/* Wizard Step 2: Campus & Course OR Edit Mode */}
              {(showTabs || currentStep === 2) && (
                <div className="wizard-step active" style={{ marginTop: showTabs ? '2rem' : 0 }}>
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

              {/* Wizard Step 3: Interests, Bio & Photo OR Edit Mode */}
              {(showTabs || currentStep === 3) && (
                <div className="wizard-step active" style={{ marginTop: showTabs ? '2rem' : 0 }}>
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
                      <label className="form-label">Profile Photo</label>
                      <div className="photo-section" style={{ marginTop: '0.5rem' }}>
                        <div className="photo-container">
                          <img
                            id="profilePreview"
                            src={previewUrl || DEFAULT_AVATAR}
                            alt="Profile"
                          />
                          <div className="photo-overlay">
                            <label className="upload-label">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" stroke-width="2"/>
                                <circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="2"/>
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
              {!showTabs ? (
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
                        <path d="M7.5 15l5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <button type="submit" className="save-btn" style={{ marginTop: '2rem' }} disabled={saving}>
                  <span>{saving ? 'Saving updates...' : 'Save Updates'}</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7.5 15l5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              )}

            </form>
          )}

        </div>
      </div>

      {/* Slanted Nav / Bottom Navigation */}
      <BottomNav activeTab="profile" />
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', background: '#0f0e17' }}>
        <h3>Loading profile content...</h3>
      </div>
    }>
      <ProfileFormContent />
    </Suspense>
  )
}
