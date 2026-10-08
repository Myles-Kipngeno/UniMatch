'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { signOutAndClear, redirectToLogin } from '@/lib/auth/signOut'
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

const PHOTO_REQUIRED_MSG = 'Please upload a profile photo to complete your profile.'

export interface ExtraPhotoItem {
  id: string
  file?: File
  url: string
  prompt?: string
}

const SHOWCASE_PROMPTS = [
  { icon: '📸', label: 'Full Fit', hint: 'Campus style' },
  { icon: '🎒', label: 'Campus Life', hint: 'Library or quad' },
  { icon: '☕', label: 'Passions', hint: 'Hobbies & arts' },
  { icon: '🎉', label: 'Social Vibe', hint: 'With friends' },
  { icon: '✨', label: 'Candid Vibe', hint: 'Golden hour' },
] as const

import { useModal } from '@/components/ModalContext'

interface CustomSelectOption {
  value: string
  label: string
  badge?: string
  icon?: string
}

const GENDER_OPTIONS: CustomSelectOption[] = [
  { value: 'male', label: 'Male', icon: '👨' },
  { value: 'female', label: 'Female', icon: '👩' },
]

const YEAR_OPTIONS: CustomSelectOption[] = [
  { value: '1', label: '1st Year', badge: 'Freshman', icon: '🎓' },
  { value: '2', label: '2nd Year', badge: 'Sophomore', icon: '📚' },
  { value: '3', label: '3rd Year', badge: 'Junior', icon: '⚡' },
  { value: '4', label: '4th Year', badge: 'Senior', icon: '🏆' },
  { value: '5', label: 'Graduate / PG', badge: 'Postgrad', icon: '🎯' },
]

const PREFERENCE_OPTIONS: CustomSelectOption[] = [
  { value: 'all', label: 'Everyone', badge: 'All Students', icon: '👥' },
  { value: 'male', label: 'Men', badge: 'Male Only', icon: '👨' },
  { value: 'female', label: 'Women', badge: 'Female Only', icon: '👩' },
]

interface CustomSelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: CustomSelectOption[]
  placeholder?: string
  className?: string
}

function CustomSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = ''
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.value === value)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (optValue: string) => {
    onChange(optValue)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(prev => !prev)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'ArrowDown' && isOpen) {
      e.preventDefault()
      const currentIdx = options.findIndex(o => o.value === value)
      const nextIdx = (currentIdx + 1) % options.length
      onChange(options[nextIdx].value)
    } else if (e.key === 'ArrowUp' && isOpen) {
      e.preventDefault()
      const currentIdx = options.findIndex(o => o.value === value)
      const prevIdx = (currentIdx - 1 + options.length) % options.length
      onChange(options[prevIdx].value)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${isOpen ? 'is-open' : ''} ${className}`}
      id={id}
    >
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="custom-select-trigger-content">
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <span className="custom-select-trigger-icon">{selectedOption.icon}</span>
              )}
              <span className="custom-select-trigger-label">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="custom-select-trigger-badge">{selectedOption.badge}</span>
              )}
            </>
          ) : (
            <span className="custom-select-placeholder">{placeholder}</span>
          )}
        </div>
        <svg
          className={`custom-select-chevron ${isOpen ? 'rotated' : ''}`}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="custom-select-menu" role="listbox">
          {options.map(opt => {
            const isSelected = opt.value === value
            return (
              <div
                key={opt.value}
                className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
                role="option"
                aria-selected={isSelected}
              >
                <div className="custom-select-option-left">
                  {opt.icon && <span className="custom-select-opt-icon">{opt.icon}</span>}
                  <div className="custom-select-opt-labels">
                    <span className="custom-select-opt-name">{opt.label}</span>
                    {opt.badge && <span className="custom-select-opt-badge">{opt.badge}</span>}
                  </div>
                </div>
                {isSelected && (
                  <div className="custom-select-check-circle" title="Selected">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProfileFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // One client for the component's lifetime (stable reference for effects)
  const [supabase] = useState(() => createClient())
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

  // Showcase photos state (extra photos reflecting on views section)
  const [extraPhotos, setExtraPhotos] = useState<ExtraPhotoItem[]>([])
  const [viewPhotos, setViewPhotos] = useState<string[]>([])
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const mainAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const showcaseMultiInputRef = useRef<HTMLInputElement | null>(null)
  const singleSlotInputRef = useRef<HTMLInputElement | null>(null)
  const activeSlotIdxRef = useRef<number | null>(null)

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
  const profileKey = viewUserIdParam || 'self'

  // getCache/setCache change identity on every cache update. Keeping them in a ref lets
  // the load effects read the latest versions WITHOUT re-running (re-running refetched
  // the profile in a loop and wiped whatever the user was typing).
  const cacheApiRef = useRef({ getCache, setCache, clearNetworkError, reportNetworkError })
  cacheApiRef.current = { getCache, setCache, clearNetworkError, reportNetworkError }

  // Set once the user edits any field — loads must never overwrite their input after that
  const formTouchedRef = useRef(false)
  const markFormTouched = () => { formTouchedRef.current = true }
  // Which profile key the form was last filled for (cache hydrate / DB fetch run once each)
  const cacheHydratedForRef = useRef<string | null>(null)
  const profileFetchedForRef = useRef<string | null>(null)
  const [isOtherUser, setIsOtherUser] = useState(false)

  const [loading, setLoading] = useState(() => !getCache('profile', viewUserIdParam || 'self'))
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState('')

  // Sync active tab with URL query parameter (only on initial mount, not after user clicks a tab)
  useEffect(() => {
    if (userChangedTabRef.current) return
    if (isEditModeParam && !isOtherUser) {
      setActiveTab('edit')
    }
  }, [isEditModeParam, isOtherUser])

  // Switching to a different profile starts with a fresh, untouched form.
  // Compares against the last key so it never fires on mount (or StrictMode re-runs).
  const lastProfileKeyRef = useRef(profileKey)
  useEffect(() => {
    if (lastProfileKeyRef.current === profileKey) return
    lastProfileKeyRef.current = profileKey
    formTouchedRef.current = false
    cacheHydratedForRef.current = null
    profileFetchedForRef.current = null
  }, [profileKey])

  // Load from cache initially if present
  useEffect(() => {
    const targetKey = viewUserIdParam || 'self'
    if (cacheHydratedForRef.current === targetKey) return
    const cached = getCache('profile', targetKey)
    if (cached) {
      cacheHydratedForRef.current = targetKey
      // Onboarding (own profile not complete yet) starts with empty fields, so stale
      // values from an unfinished row never pre-fill the wizard
      const shouldFillForm = Boolean(cached.profile_complete) || Boolean(viewUserIdParam)
      if (formTouchedRef.current || !shouldFillForm) {
        setLoading(false)
        return
      }
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
    if (profileFetchedForRef.current === profileKey) return
    profileFetchedForRef.current = profileKey
    const { getCache, setCache, clearNetworkError, reportNetworkError } = cacheApiRef.current

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
        const [{ data: profile }, { data: galleryPhotos }] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', targetId)
            .single() as any,
          supabase
            .from('profile_photos' as any)
            .select('id, url, position, type')
            .eq('user_id', targetId)
            .order('position', { ascending: true }) as any
        ])

        const galleryUrls: string[] = (galleryPhotos || [])
          .filter((p: any) => p.type !== 'video' && p.url)
          .map((p: any) => p.url)

        const allPhotos: string[] = Array.from(
          new Set([profile?.photo_url, ...galleryUrls].filter(Boolean))
        ) as string[]

        if (allPhotos.length > 0) {
          setViewPhotos(allPhotos)
        }

        if (profile) {
          if (!formTouchedRef.current) {
            if (profile.name && !name) {
              setName(profile.name)
            }
            if (profile.profile_complete || viewingOther) {
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
            }

            if (allPhotos.length > 0) {
              const primaryUrl = profile?.photo_url || allPhotos[0]
              if (!previewUrl && primaryUrl) {
                setPreviewUrl(primaryUrl)
                setCurrentPhotoUrl(primaryUrl)
              }
              const remainingShowcase = allPhotos.filter(u => u !== primaryUrl).slice(0, 5)
              setExtraPhotos(
                remainingShowcase.map((url, i) => ({
                  id: `existing_${i}`,
                  url,
                  prompt: SHOWCASE_PROMPTS[i]?.label
                }))
              )
            }
          }
          cacheHydratedForRef.current = targetKey

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
    // Runs once per viewed profile. Cache/network helpers come from cacheApiRef on purpose:
    // listing them here re-ran this fetch on every cache update and reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, profileKey])

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
          await signOutAndClear(supabase)
          redirectToLogin()
        } catch (e) {
          console.warn("Sign out error:", e)
          modal.toast("Logout failed. Try again.", "error")
        }
      }
    })
  }

  // Main avatar photo change (used in Edit Mode Section 1 & Step 4 wizard)
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    markFormTouched()
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        modal.toast('Please select a valid image file.', 'warning')
        return
      }
      setPhotoFile(file)
      setError(prev => (prev === PHOTO_REQUIRED_MSG ? '' : prev))
      const blobUrl = URL.createObjectURL(file)
      setPreviewUrl(blobUrl)
      setCurrentPhotoUrl(blobUrl)

      // Ensure main photo is placed at index 0 in viewPhotos
      setViewPhotos(prev => {
        const withoutCurrent = prev.filter(u => u !== previewUrl && u !== currentPhotoUrl)
        return [blobUrl, ...withoutCurrent]
      })
    }
    e.target.value = ''
  }

  // Multi-photo add for showcase gallery in Step 4
  const handleAddShowcasePhotos = (incomingFiles: FileList | File[]) => {
    markFormTouched()
    const filesArray = Array.from(incomingFiles).filter(file => file.type.startsWith('image/'))
    if (filesArray.length === 0) {
      modal.toast('Please select valid image files.', 'warning')
      return
    }

    const availableSlots = 5 - extraPhotos.length
    if (availableSlots <= 0) {
      modal.toast('Maximum 5 showcase photos reached.', 'warning')
      return
    }

    const filesToAdd = filesArray.slice(0, availableSlots)
    if (filesArray.length > availableSlots) {
      modal.toast(`Added ${availableSlots} photo(s) (maximum 5 reached).`, 'info')
    }

    const newPhotoItems: ExtraPhotoItem[] = filesToAdd.map((file, idx) => {
      const slotIndex = extraPhotos.length + idx
      return {
        id: `showcase_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        file,
        url: URL.createObjectURL(file),
        prompt: SHOWCASE_PROMPTS[slotIndex]?.label
      }
    })

    setExtraPhotos(prev => [...prev, ...newPhotoItems])

    // Immediately reflect new showcase photos in viewPhotos for the views section
    setViewPhotos(prev => {
      const currentMain = previewUrl || currentPhotoUrl || DEFAULT_AVATAR
      const newUrls = newPhotoItems.map(item => item.url)
      return Array.from(new Set([currentMain, ...prev, ...newUrls].filter(Boolean)))
    })
  }

  // Single slot photo upload in Step 4
  const handleSingleSlotPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    markFormTouched()
    const file = e.target.files?.[0]
    const targetIdx = activeSlotIdxRef.current
    if (file && targetIdx !== null && targetIdx !== undefined) {
      if (!file.type.startsWith('image/')) {
        modal.toast('Please select a valid image file.', 'warning')
        return
      }
      const blobUrl = URL.createObjectURL(file)
      const promptLabel = SHOWCASE_PROMPTS[targetIdx]?.label

      setExtraPhotos(prev => {
        const next = [...prev]
        if (targetIdx < next.length) {
          next[targetIdx] = {
            id: `showcase_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            file,
            url: blobUrl,
            prompt: promptLabel
          }
        } else {
          next.push({
            id: `showcase_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            file,
            url: blobUrl,
            prompt: promptLabel
          })
        }
        return next
      })

      // Reflect in viewPhotos
      setViewPhotos(prev => {
        const currentMain = previewUrl || currentPhotoUrl || DEFAULT_AVATAR
        return Array.from(new Set([currentMain, ...prev, blobUrl].filter(Boolean)))
      })
    }
    activeSlotIdxRef.current = null
    e.target.value = ''
  }

  // Remove a showcase photo
  const handleRemoveExtraPhoto = (id: string) => {
    markFormTouched()
    setExtraPhotos(prev => {
      const itemToRemove = prev.find(p => p.id === id)
      if (itemToRemove?.url?.startsWith('blob:')) {
        try { URL.revokeObjectURL(itemToRemove.url) } catch (_) {}
      }
      const updated = prev.filter(p => p.id !== id)

      // Also remove from viewPhotos
      setViewPhotos(prevView => {
        const filtered = prevView.filter(u => u !== itemToRemove?.url)
        const currentMain = previewUrl || currentPhotoUrl || DEFAULT_AVATAR
        return filtered.length > 0 ? filtered : (currentMain ? [currentMain] : [])
      })

      return updated
    })
  }

  // Promote a showcase photo to become the main avatar
  const handlePromoteToAvatar = (item: ExtraPhotoItem) => {
    markFormTouched()
    const prevMainUrl = previewUrl || currentPhotoUrl
    const prevMainFile = photoFile

    setPreviewUrl(item.url)
    if (item.file) {
      setPhotoFile(item.file)
    }

    setExtraPhotos(prev => {
      const withoutItem = prev.filter(p => p.id !== item.id)
      if (prevMainUrl && prevMainUrl !== DEFAULT_AVATAR) {
        return [
          {
            id: `showcase_${Date.now()}`,
            file: prevMainFile || undefined,
            url: prevMainUrl,
            prompt: item.prompt
          },
          ...withoutItem
        ].slice(0, 5)
      }
      return withoutItem
    })

    setViewPhotos(prev => {
      const withoutTarget = prev.filter(u => u !== item.url)
      return [item.url, ...withoutTarget]
    })

    modal.toast('Promoted to main profile avatar! ⭐', 'info')
  }

  // Window paste listener for pasting profile picture directly on Step 4
  useEffect(() => {
    if (currentStep !== 4) return
    const onWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) {
            markFormTouched()
            setPhotoFile(file)
            setError(prev => (prev === PHOTO_REQUIRED_MSG ? '' : prev))
            const blobUrl = URL.createObjectURL(file)
            setPreviewUrl(blobUrl)
            setCurrentPhotoUrl(blobUrl)
            setViewPhotos(prev => {
              const rest = prev.filter(u => u !== previewUrl && u !== currentPhotoUrl)
              return [blobUrl, ...rest]
            })
            modal.toast('Profile photo pasted from clipboard! 📋', 'success')
            break
          }
        }
      }
    }
    window.addEventListener('paste', onWindowPaste)
    return () => window.removeEventListener('paste', onWindowPaste)
  }, [currentStep, previewUrl, currentPhotoUrl, modal])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const touchEndX = e.changedTouches[0].clientX
    const diffX = touchEndX - touchStartX
    if (diffX > 45 && activePhotoIdx > 0) {
      setActivePhotoIdx(i => i - 1)
    } else if (diffX < -45 && activePhotoIdx < viewPhotos.length - 1) {
      setActivePhotoIdx(i => i + 1)
    }
    setTouchStartX(null)
  }

  // Toggle interests
  const toggleInterest = (interestName: string) => {
    markFormTouched()
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
    if (currentStep === 3) {
      if (selectedInterests.length < 3) {
        setError('Please select at least 3 interests to continue.')
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
    // A photo is required: either from previewUrl, currentPhotoUrl, photoFile, or extraPhotos
    const hasPhoto = Boolean(previewUrl || currentPhotoUrl || photoFile || extraPhotos.length > 0)
    if (!hasPhoto) {
      setError(PHOTO_REQUIRED_MSG)
      return
    }
    if (!userId) {
      setError('Still loading your account. Please try again in a moment.')
      return
    }

    // Ref guard blocks a fast double-click before the disabled button re-renders
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)

    try {
      let finalPhotoUrl = currentPhotoUrl || previewUrl
      const updatedGalleryUrls: string[] = []

      // 1. Upload Main Avatar (Position 0)
      if (photoFile && userId) {
        const compressedFile = await compressImage(photoFile, 1600, 1600, 0.82)
        const fileExt = compressedFile.name.split('.').pop() || 'jpg'
        const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`

        const { error: uploadErr } = await supabase.storage
          .from('profile-images')
          .upload(filePath, compressedFile, { upsert: true, cacheControl: '3600' })

        if (uploadErr) {
          console.warn('Storage upload error for avatar:', uploadErr.message)
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('profile-images')
            .getPublicUrl(filePath)
          finalPhotoUrl = publicUrlData.publicUrl
        }
      }

      if (finalPhotoUrl && !finalPhotoUrl.startsWith('blob:')) {
        updatedGalleryUrls.push(finalPhotoUrl)
        const { error: galleryError } = await (supabase.from('profile_photos') as any).insert({
          user_id: userId,
          url: finalPhotoUrl,
          type: 'image',
          position: 0
        })
        if (galleryError) console.warn('Position 0 profile_photos note:', galleryError.message)
      }

      // 2. Upload Showcase Photos (Positions 1 to 5)
      for (let idx = 0; idx < extraPhotos.length; idx++) {
        const item = extraPhotos[idx]
        const position = idx + 1
        let itemUrl = item.url

        if (item.file) {
          const compressedFile = await compressImage(item.file, 1600, 1600, 0.82)
          const fileExt = compressedFile.name.split('.').pop() || 'jpg'
          const filePath = `${userId}/showcase_${Date.now()}_${idx}.${fileExt}`

          const { error: uploadErr } = await supabase.storage
            .from('profile-images')
            .upload(filePath, compressedFile, { upsert: true, cacheControl: '3600' })

          if (uploadErr) {
            console.warn('Storage upload error for showcase photo:', uploadErr.message)
            continue
          }

          const { data: publicUrlData } = supabase.storage
            .from('profile-images')
            .getPublicUrl(filePath)
          itemUrl = publicUrlData.publicUrl
        }

        if (itemUrl && !itemUrl.startsWith('blob:')) {
          updatedGalleryUrls.push(itemUrl)
          const { error: galleryError } = await (supabase.from('profile_photos') as any).insert({
            user_id: userId,
            url: itemUrl,
            type: 'image',
            position
          })
          if (galleryError) console.warn('Insert to profile_photos note:', galleryError.message)
        }
      }

      // Fallback: If no avatar URL yet, use the first showcase photo
      if (!finalPhotoUrl && updatedGalleryUrls.length > 0) {
        finalPhotoUrl = updatedGalleryUrls[0]
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

      const { data: updatedRows, error: updateErr } = await (supabase.from('profiles') as any)
        .update(profilePayload)
        .eq('id', userId!)
        .select('id')

      // An update that matches no row returns no error — fall back to upsert then too,
      // otherwise a missing profile row would be reported as saved
      if (updateErr || !updatedRows || updatedRows.length === 0) {
        console.warn('Update error, trying upsert fallback:', updateErr || 'no profile row updated')
        const { error: upsertErr } = await (supabase.from('profiles') as any)
          .upsert(profilePayload, { onConflict: 'id' })
        if (upsertErr) throw upsertErr
      }

      // Update local state and app cache
      setCurrentPhotoUrl(finalPhotoUrl)
      setPreviewUrl(finalPhotoUrl)
      setViewPhotos(updatedGalleryUrls.length > 0 ? updatedGalleryUrls : (finalPhotoUrl ? [finalPhotoUrl] : []))
      setActivePhotoIdx(0)
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
      savingRef.current = false
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

  const showTabs = Boolean(profileComplete) && !isOtherUser
  const isViewing = (showTabs && activeTab === 'view') || isOtherUser
  const isEditing = !isOtherUser && (!showTabs || activeTab === 'edit')

  return (
    <div className="profile-page" onChangeCapture={markFormTouched}>
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
          {!isOtherUser && (
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
                  {showTabs && (
                    <>
                      <Link href="/settings" className="profile-menu-item" onClick={() => setMenuOpen(false)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        <span>Settings</span>
                      </Link>
                      <div className="profile-menu-divider"></div>
                    </>
                  )}
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
                <span className={`step-dot ${currentStep >= 4 ? 'active' : ''}`}>4</span>
              </div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${(currentStep / 4) * 100}%` }}></div>
              </div>
            </div>
          )}

          {/* VIEW PROFILE TAB */}
          {isViewing && (
            <div className="view-profile-tab">
              <div className="preview-card">
                <div 
                  className="preview-img-wrap"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <Image
                    id="viewPhoto"
                    src={viewPhotos[activePhotoIdx] || previewUrl || DEFAULT_AVATAR}
                    alt="Profile"
                    width={400}
                    height={400}
                    unoptimized={Boolean(
                      (viewPhotos[activePhotoIdx] || previewUrl || '').startsWith('blob:') ||
                      (viewPhotos[activePhotoIdx] || previewUrl || '').startsWith('data:')
                    )}
                  />

                  {/* Stories/Tinder segment indicator bars */}
                  {viewPhotos.length > 1 && (
                    <div className="carousel-segment-bars">
                      {viewPhotos.map((_, i) => (
                        <div
                          key={i}
                          className={`carousel-segment-pill ${i === activePhotoIdx ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setActivePhotoIdx(i)
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Left & Right Tap Zones for one-tap photo navigation */}
                  {viewPhotos.length > 1 && (
                    <>
                      <div
                        className="carousel-tap-zone left"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (activePhotoIdx > 0) setActivePhotoIdx(i => i - 1)
                        }}
                        aria-label="Previous photo"
                      />
                      <div
                        className="carousel-tap-zone right"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (activePhotoIdx < viewPhotos.length - 1) setActivePhotoIdx(i => i + 1)
                        }}
                        aria-label="Next photo"
                      />
                    </>
                  )}

                  {/* Desktop navigation buttons */}
                  {viewPhotos.length > 1 && activePhotoIdx > 0 && (
                    <button
                      type="button"
                      className="carousel-nav-btn left"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActivePhotoIdx(i => i - 1)
                      }}
                      aria-label="Previous photo"
                    >
                      ‹
                    </button>
                  )}
                  {viewPhotos.length > 1 && activePhotoIdx < viewPhotos.length - 1 && (
                    <button
                      type="button"
                      className="carousel-nav-btn right"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActivePhotoIdx(i => i + 1)
                      }}
                      aria-label="Next photo"
                    >
                      ›
                    </button>
                  )}

                  {/* Photo counter badge */}
                  {viewPhotos.length > 1 && (
                    <div className="carousel-photo-badge">
                      <span>📷 {activePhotoIdx + 1}/{viewPhotos.length}</span>
                    </div>
                  )}

                  <div className="preview-overlay">
                    <h3>{name || 'Student'}{age ? `, ${age}` : ''}</h3>
                    <p>📍 {campus || 'Campus'}</p>
                    <p>📚 {course || 'Major'}{yearOfStudy ? ` (${yearOfStudy} Year)` : ''}</p>
                  </div>
                </div>

                {/* Thumbnails strip */}
                {viewPhotos.length > 1 && (
                  <div className="preview-thumbnails-strip">
                    {viewPhotos.map((imgUrl, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`preview-thumb-btn ${i === activePhotoIdx ? 'active' : ''}`}
                        onClick={() => setActivePhotoIdx(i)}
                        title={`View photo ${i + 1}`}
                      >
                        <Image
                          src={imgUrl}
                          alt={`Thumbnail ${i + 1}`}
                          width={46}
                          height={46}
                          unoptimized={imgUrl.startsWith('blob:') || imgUrl.startsWith('data:')}
                        />
                      </button>
                    ))}
                  </div>
                )}
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
                          <CustomSelect
                            id="editGender"
                            value={gender}
                            onChange={(val) => { setGender(val); markFormTouched(); }}
                            options={GENDER_OPTIONS}
                            placeholder="Select Gender"
                          />
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
                        <CustomSelect
                          id="editPreference"
                          value={preference}
                          onChange={(val) => { setPreference(val); markFormTouched(); }}
                          options={PREFERENCE_OPTIONS}
                          placeholder="Select Preference"
                        />
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
                        <CustomSelect
                          id="editYear"
                          value={yearOfStudy}
                          onChange={(val) => { setYearOfStudy(val); markFormTouched(); }}
                          options={YEAR_OPTIONS}
                          placeholder="Select Year"
                        />
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
                            <CustomSelect 
                              id="wizardGender"
                              value={gender} 
                              onChange={(val) => { setGender(val); markFormTouched(); setError(''); }} 
                              options={GENDER_OPTIONS}
                              placeholder="Select Gender"
                            />
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
                          <CustomSelect
                            id="wizardYear"
                            value={yearOfStudy}
                            onChange={(val) => { setYearOfStudy(val); markFormTouched(); setError(''); }}
                            options={YEAR_OPTIONS}
                            placeholder="Select Year"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="wizard-step active">
                      <h3 className="step-title">Hobbies, Interests & Bio</h3>
                      <p className="step-subtitle">Select at least 3 things you love and introduce yourself</p>
                      
                      <div className="interests-grid" style={{ marginBottom: '1.5rem' }}>
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label className="form-label" style={{ margin: 0 }}>Bio</label>
                            <span style={{ fontSize: '11px', color: '#9e9bb8' }}>{bio.length}/300</span>
                          </div>
                          <textarea
                            placeholder="Write a short bio about yourself..."
                            rows={4}
                            maxLength={300}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Show Me</label>
                          <CustomSelect
                            id="wizardPreference"
                            value={preference}
                            onChange={(val) => { setPreference(val); markFormTouched(); setError(''); }}
                            options={PREFERENCE_OPTIONS}
                            placeholder="Select Preference"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="wizard-step active">
                      <h3 className="step-title">Profile Photos & Gallery</h3>
                      <p className="step-subtitle">Your main photo is shown first, followed by your showcase gallery</p>

                      {/* Top Section: Circular Avatar Picture (Matches User Screenshot) */}
                      <div className="step4-avatar-section">
                        <div
                          className={`photo-container ${!previewUrl && !currentPhotoUrl ? 'is-empty' : ''}`}
                          onClick={() => mainAvatarInputRef.current?.click()}
                          title="Upload or change main profile picture"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              mainAvatarInputRef.current?.click()
                            }
                          }}
                        >
                          <Image
                            id="step4ProfilePreview"
                            src={previewUrl || currentPhotoUrl || DEFAULT_AVATAR}
                            alt="Profile Avatar"
                            width={130}
                            height={130}
                            unoptimized={Boolean(previewUrl?.startsWith('blob:') || previewUrl?.startsWith('data:'))}
                          />
                          <div className="photo-overlay">
                            <label className="upload-label" style={{ pointerEvents: 'none' }}>
                              <div className="camera-icon-wrap">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                                  <circle cx="12" cy="13" r="4"/>
                                </svg>
                                <span>{previewUrl || currentPhotoUrl ? 'CHANGE PHOTO' : 'ADD PHOTO'}</span>
                              </div>
                            </label>
                          </div>
                        </div>

                        <input
                          ref={mainAvatarInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          hidden
                        />

                        <div className="avatar-identity-labels">
                          <span className="avatar-main-title">{name.trim() || 'FULL NAME'}</span>
                          <span className="avatar-main-subtitle">Primary Avatar • Appears First on Campus Cards</span>
                        </div>
                      </div>

                      {/* Bottom Section: Interesting Showcase Gallery Deck */}
                      <div className="showcase-gallery-card">
                        <div className="showcase-header">
                          <div className="showcase-header-left">
                            <div className="showcase-title-row">
                              <h4 className="showcase-title">Showcase Photos</h4>
                              <span className="views-reflect-badge">👁️ Reflects in Profile Views</span>
                            </div>
                            <p className="showcase-subtitle">
                              Add up to 5 photos showing your campus life & hobbies. Potential matches see these in your profile views carousel!
                            </p>
                          </div>
                          {extraPhotos.length < 5 && (
                            <button
                              type="button"
                              className="showcase-add-btn"
                              onClick={() => showcaseMultiInputRef.current?.click()}
                              title="Add photos to showcase"
                            >
                              <span>+ Add Photos</span>
                            </button>
                          )}
                        </div>

                        {/* Hidden file inputs for showcase gallery */}
                        <input
                          ref={showcaseMultiInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleAddShowcasePhotos(e.target.files)
                              e.target.value = ''
                            }
                          }}
                          hidden
                        />
                        <input
                          ref={singleSlotInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleSingleSlotPhotoChange}
                          hidden
                        />

                        {/* Interactive 5-Slot Showcase Deck */}
                        <div className="showcase-slots-grid">
                          {SHOWCASE_PROMPTS.map((promptItem, slotIdx) => {
                            const photoItem = extraPhotos[slotIdx]
                            if (photoItem) {
                              return (
                                <div key={photoItem.id} className="showcase-slot filled">
                                  <Image
                                    src={photoItem.url}
                                    alt={photoItem.prompt || `Showcase photo ${slotIdx + 1}`}
                                    fill
                                    sizes="(max-width: 600px) 33vw, 120px"
                                    className="showcase-slot-img"
                                    unoptimized={Boolean(photoItem.url.startsWith('blob:') || photoItem.url.startsWith('data:'))}
                                  />
                                  <button
                                    type="button"
                                    className="showcase-make-avatar-btn"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handlePromoteToAvatar(photoItem)
                                    }}
                                    title="Make this your main avatar photo"
                                  >
                                    ⭐ Avatar
                                  </button>
                                  <button
                                    type="button"
                                    className="showcase-remove-btn"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveExtraPhoto(photoItem.id)
                                    }}
                                    title="Remove photo"
                                    aria-label="Remove photo"
                                  >
                                    ✕
                                  </button>
                                  <div className="showcase-tag">
                                    {promptItem.icon} {photoItem.prompt || promptItem.label}
                                  </div>
                                </div>
                              )
                            } else {
                              return (
                                <button
                                  key={`empty_slot_${slotIdx}`}
                                  type="button"
                                  className="showcase-slot empty"
                                  onClick={() => {
                                    activeSlotIdxRef.current = slotIdx
                                    singleSlotInputRef.current?.click()
                                  }}
                                  title={`Upload ${promptItem.label} photo`}
                                >
                                  <span className="showcase-empty-icon">{promptItem.icon}</span>
                                  <span className="showcase-empty-label">{promptItem.label}</span>
                                  <span className="showcase-empty-hint">{promptItem.hint}</span>
                                </button>
                              )
                            }
                          })}
                        </div>

                        {/* Campus Tip Banner */}
                        <div className="photo-tip-banner">
                          <span className="tip-emoji">💡</span>
                          <span className="tip-text">
                            <strong>Campus Tip:</strong> Students with 3 or more photos get 4x more match views and chat conversations!
                          </span>
                        </div>

                        {error === PHOTO_REQUIRED_MSG ? (
                          <p className="error" role="alert" style={{ display: 'block', textAlign: 'center', marginTop: '0.75rem' }}>
                            Please upload your main profile picture to finish.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {error && <p className="error" style={{ display: 'block', marginTop: '1rem' }}>{error}</p>}

                  {/* Navigation buttons */}
                  <div className="wizard-buttons" style={{ marginTop: '2rem' }}>
                    {currentStep > 1 && (
                      <button type="button" className="wizard-btn btn-prev" onClick={handlePrev}>Back</button>
                    )}
                    {currentStep < 4 ? (
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
      {Boolean(profileComplete || isOtherUser) && (
        <BottomNav activeTab={isOtherUser ? "" : "profile"} />
      )}
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
