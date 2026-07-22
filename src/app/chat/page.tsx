'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { DEFAULT_AVATAR } from '@/lib/constants'
import './chat.css'

interface ConversationItem {
  id: string
  name: string
  photoUrl: string
  campus: string | null
  course: string | null
  age: number | null
  lastMessage: string
  lastMessageAt: string | null
  unreadCount: number
  online: boolean
  otherUserId: string
  matchPct: number
}

const EMOJI_CATEGORIES = [
  { id: 'recent', name: 'Recent', icon: '🕒' },
  { id: 'smileys', name: 'Smileys', icon: '😀' },
  { id: 'love', name: 'Love', icon: '❤️' },
  { id: 'gestures', name: 'Gestures', icon: '👍' },
  { id: 'animals', name: 'Animals', icon: '🐶' },
  { id: 'food', name: 'Food', icon: '🍕' },
  { id: 'activities', name: 'Activities', icon: '⚽' },
  { id: 'travel', name: 'Travel', icon: '🚗' },
  { id: 'symbols', name: 'Symbols', icon: '💡' },
]

const EMOJI_DATA: Record<string, string[]> = {
  smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🫣', '🤗', '🫡', '🤔', '🤭', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '🤡', '💩', '👻', '💀', '👽', '👾', '🤖'],
  love: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌', '😍', '🥰', '😘', '👨‍❤️‍💋‍👨', '👩‍❤️‍💋‍👩', '💑', '👩‍❤️‍👨', '💋', '❤️‍🔥', '❤️‍🩹'],
  gestures: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'],
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🦭', '🐊', '🐅', '🐆', 'zebra', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐓', '🦃', '🦚', '🦜', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🦔'],
  food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🍾'],
  activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎟️', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
  travel: ['🚗', '🚕', '🚙', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🛺', '🚲', '🛴', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⚓', '🛟', '⛽', '🚧', '🚦', '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🏕️', '⛺', '🏠', '🏡', '🏢', '🏣', '🏥', '🏦', '🏨', '🏪', '🏫', '🏬', '🏭', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '☣️', '📴', '📳', '🈶', '🈚', '✴️', '💯', '💢', '♨️', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '💡', '💬', '💭', '🔔', '🔕', '📢', '📣', '🔍', '🔎', '🕯️', '🔦', '🏮', '🔥', '✨', '⚡', '🌟', '💫', '💥']
}

// Custom Inline Audio Player Component
function InlineAudioPlayer({ audioUrl }: { audioUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="custom-audio-player" onClick={e => e.stopPropagation()}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration)
        }}
        onEnded={() => setIsPlaying(false)}
      />
      <button type="button" className="btn-audio-play" onClick={togglePlay}>
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        )}
      </button>
      <div className="audio-progress-wrap">
        <input
          type="range"
          className="audio-scrubber"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
        />
      </div>
      <span className="audio-duration">
        {isPlaying ? formatTime(currentTime) : formatTime(duration)}
      </span>
    </div>
  )
}

function ChatHubContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const matchId = searchParams.get('matchId')
  const supabase = createClient()

  // State
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'online' | 'unread' | 'recent'>('all')

  // Multi-Select Mode State
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([])

  // Reactions State
  const [reactions, setReactions] = useState<Record<string, any[]>>({})
  const [showFullPickerForMsgId, setShowFullPickerForMsgId] = useState<string | null>(null)
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('smileys')
  const [emojiSearch, setEmojiSearch] = useState('')
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('recent_emojis')
        if (stored) return JSON.parse(stored)
      } catch (e) {}
    }
    return ['👍', '❤️', '😂', '🔥', '✨', '😊', '🎉', '🙌']
  })

  // Active Chat State
  const [activeMatch, setActiveMatch] = useState<ConversationItem | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Menu & Report & Media Gallery State
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportReason, setReportReason] = useState('Harassment')
  const [reportDetails, setReportDetails] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

  // Reply & Message Context Menu State
  const [replyingToMessage, setReplyingToMessage] = useState<{ id: string; content: string; senderName: string } | null>(null)
  const [msgContextMenu, setMsgContextMenu] = useState<{ x: number; y: number; message: any } | null>(null)

  // DOM Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatMenuRef = useRef<HTMLDivElement>(null)
  const chatMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const msgContextMenuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputEmojiPickerRef = useRef<HTMLDivElement | null>(null)
  const attachMenuRef = useRef<HTMLDivElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Text Input Emoji & Attachment Menu State
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)

  // Attachment Menu outside-click listener
  useEffect(() => {
    if (!showAttachMenu) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showAttachMenu])

  // Text Input Emoji Picker outside-click listener
  useEffect(() => {
    if (!showInputEmojiPicker) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (inputEmojiPickerRef.current && !inputEmojiPickerRef.current.contains(e.target as Node)) {
        setShowInputEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showInputEmojiPicker])

  // Context Menu outside-click listener
  useEffect(() => {
    if (!msgContextMenu) return
    const handleOutside = (e: MouseEvent) => {
      if (msgContextMenuRef.current && !msgContextMenuRef.current.contains(e.target as Node)) {
        setMsgContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [msgContextMenu])

  // Single outside-click dismiss listener pattern
  useEffect(() => {
    if (!isMenuOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        chatMenuRef.current && !chatMenuRef.current.contains(target) &&
        chatMenuTriggerRef.current && !chatMenuTriggerRef.current.contains(target)
      ) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isMenuOpen])

  // Prefill message input if prefill search param exists
  useEffect(() => {
    const prefill = searchParams.get('prefill')
    if (prefill) {
      setInputText(prefill)
    }
  }, [searchParams])

  // 1. Authenticate user
  useEffect(() => {
    async function checkAuth() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single() as any

      const fullUser = { ...user, ...(profile || {}) }
      setCurrentUser(fullUser)
      fetchConversations(user.id, fullUser)
    }

    checkAuth()
  }, [router, supabase])

  // Helper for generating real match score from profile compatibility or fallback
  const calcMatchPct = (m: any, other: any, meProfile: any) => {
    if (m.match_pct) return m.match_pct
    if (m.compatibility) return m.compatibility
    if (meProfile && other) {
      let score = 35
      if (meProfile.campus && other.campus && meProfile.campus.toLowerCase().trim() === other.campus.toLowerCase().trim()) {
        score += 30
      }
      if (meProfile.course && other.course && meProfile.course.toLowerCase().trim() === other.course.toLowerCase().trim()) {
        score += 15
      }
      const myInterests = Array.isArray(meProfile.interests) ? meProfile.interests : []
      const targetInterests = Array.isArray(other?.interests) ? other.interests : []
      const commonInterests = targetInterests.filter((i: string) => myInterests.includes(i))
      score += Math.min(commonInterests.length * 10, 40)

      if (score > 35) return Math.min(score, 99)
    }

    let hash = 0
    const str = String(m.id || other?.id || '')
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    return 82 + (Math.abs(hash) % 17)
  }

  // 2. Fetch Conversations List
  const fetchConversations = async (userId: string, userProfile?: any) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, p1:profiles!matches_user1_id_fkey(*), p2:profiles!matches_user2_id_fkey(*)')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false }) as any

      if (error) throw error

      const me = userProfile || currentUser

      if (data) {
        const mapped: ConversationItem[] = data.map((m: any) => {
          const isUser1 = m.user1_id === userId
          const other = isUser1 ? m.p2 : m.p1
          const unread = isUser1 ? (m.user1_unread || 0) : (m.user2_unread || 0)

          return {
            id: m.id,
            name: other?.name || 'Match',
            photoUrl: other?.photo_url || DEFAULT_AVATAR,
            campus: other?.campus || null,
            course: other?.course || null,
            age: other?.age || null,
            lastMessage: m.last_message || 'Say hello 👋',
            lastMessageAt: m.last_message_at || m.created_at,
            unreadCount: unread,
            online: Boolean(other?.online),
            otherUserId: other?.id || '',
            matchPct: calcMatchPct(m, other, me)
          }
        })

        mapped.sort((a, b) => {
          const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
          const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
          return tB - tA
        })

        setConversations(mapped)
      }
    } catch (e) {
      console.warn("Error fetching conversations:", e)
    } finally {
      setConversationsLoading(false)
    }
  }

  // 3. Realtime subscription for Matches List updates
  useEffect(() => {
    if (!currentUser) return

    const channel = supabase
      .channel(`matches_list_realtime_${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `user1_id=eq.${currentUser.id}` },
        () => fetchConversations(currentUser.id)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `user2_id=eq.${currentUser.id}` },
        () => fetchConversations(currentUser.id)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, supabase])

  // 4. Load Active Conversation thread when matchId changes
  useEffect(() => {
    if (!currentUser) return

    if (!matchId) {
      setActiveMatch(null)
      setMessages([])
      return
    }

    const found = conversations.find(c => c.id === matchId)
    if (found) {
      setActiveMatch(found)
    }

    async function loadThread() {
      setMessagesLoading(true)

      // Mark unread as zero
      try {
        const { data: mData } = await supabase
          .from('matches')
          .select('user1_id, user2_id')
          .eq('id', matchId)
          .single() as any

        if (mData) {
          const isUser1 = mData.user1_id === currentUser.id
          await supabase
            .from('matches')
            .update(isUser1 ? { user1_unread: 0 } : { user2_unread: 0 })
            .eq('id', matchId)
        }
      } catch (e) {
        console.warn("Mark read error:", e)
      }

      // Fetch messages
      try {
        const { data: msgData } = await supabase
          .from('messages')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: true }) as any

        setMessages(msgData || [])
      } catch (e) {
        console.warn("Error loading messages:", e)
      } finally {
        setMessagesLoading(false)
        scrollToBottom()
      }
    }

    loadThread()
  }, [matchId, currentUser, supabase, conversations])

  // 5. Realtime subscription for Active Thread Messages
  useEffect(() => {
    if (!matchId || !currentUser) return

    const msgChannel = supabase
      .channel(`messages_thread_${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        payload => {
          const newMsg = payload.new
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          scrollToBottom()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(msgChannel)
    }
  }, [matchId, currentUser, supabase])

  // 6. Realtime subscription & initial load for Message Reactions
  useEffect(() => {
    if (!matchId || messages.length === 0) return

    const msgIds = messages.map(m => m.id)

    // Initial fetch of reactions for this thread
    const fetchReactions = async () => {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', msgIds)

      if (!error && data) {
        const grouped: Record<string, any[]> = {}
        data.forEach(r => {
          if (!grouped[r.message_id]) grouped[r.message_id] = []
          grouped[r.message_id].push(r)
        })
        setReactions(grouped)
      }
    }

    fetchReactions()

    // Realtime postgres_changes subscription for message_reactions
    const reactionChannel = supabase
      .channel(`reactions_thread_${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newR = payload.new
            setReactions(prev => {
              const list = prev[newR.message_id] || []
              if (list.some(r => r.id === newR.id || (r.user_id === newR.user_id && r.emoji === newR.emoji))) return prev
              return { ...prev, [newR.message_id]: [...list.filter(r => r.user_id !== newR.user_id), newR] }
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedR = payload.new
            setReactions(prev => {
              const list = prev[updatedR.message_id] || []
              return {
                ...prev,
                [updatedR.message_id]: list.map(r => r.user_id === updatedR.user_id ? updatedR : r)
              }
            })
          } else if (payload.eventType === 'DELETE') {
            const oldR = payload.old
            setReactions(prev => {
              const newObj: Record<string, any[]> = {}
              Object.keys(prev).forEach(mId => {
                newObj[mId] = (prev[mId] || []).filter(r => r.id !== oldR.id)
              })
              return newObj
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(reactionChannel)
    }
  }, [matchId, messages.length, supabase])

  // Handle Toggle Reaction
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    if (!currentUser) return

    // Update recent emojis
    setRecentEmojis(prev => {
      const updated = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 30)
      try { localStorage.setItem('recent_emojis', JSON.stringify(updated)) } catch (e) {}
      return updated
    })

    const msgReactions = reactions[msgId] || []
    const existing = msgReactions.find(r => r.user_id === currentUser.id)

    // Optimistic UI Update
    if (existing) {
      if (existing.emoji === emoji) {
        // Same emoji -> Delete reaction
        setReactions(prev => ({
          ...prev,
          [msgId]: (prev[msgId] || []).filter(r => r.user_id !== currentUser.id)
        }))
        await supabase.from('message_reactions').delete().eq('id', existing.id)
      } else {
        // Different emoji -> Update reaction
        setReactions(prev => ({
          ...prev,
          [msgId]: (prev[msgId] || []).map(r => r.user_id === currentUser.id ? { ...r, emoji } : r)
        }))
        await supabase.from('message_reactions').update({ emoji }).eq('id', existing.id)
      }
    } else {
      // New emoji -> Insert reaction
      const tempId = 'temp-' + Date.now()
      const newReact = { id: tempId, message_id: msgId, user_id: currentUser.id, emoji, created_at: new Date().toISOString() }
      setReactions(prev => ({
        ...prev,
        [msgId]: [...(prev[msgId] || []), newReact]
      }))
      const { data } = await supabase
        .from('message_reactions')
        .insert({ message_id: msgId, user_id: currentUser.id, emoji })
        .select()
        .single() as any
      if (data) {
        setReactions(prev => ({
          ...prev,
          [msgId]: (prev[msgId] || []).map(r => r.id === tempId ? data : r)
        }))
      }
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // Start Voice Recording
  const handleStartRecording = async () => {
    try {
      let stream: MediaStream | null = null

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } else {
        const legacyGetUserMedia =
          (navigator as any).getUserMedia ||
          (navigator as any).webkitGetUserMedia ||
          (navigator as any).mozGetUserMedia ||
          (navigator as any).msGetUserMedia

        if (legacyGetUserMedia) {
          stream = await new Promise<MediaStream>((resolve, reject) => {
            legacyGetUserMedia.call(navigator, { audio: true }, resolve, reject)
          })
        }
      }

      if (!stream) {
        throw new Error('NO_STREAM')
      }

      const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported
        ? (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''))
        : ''

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } catch (err: any) {
      console.error("Microphone access error:", err)

      // If browser blocked getUserMedia because of HTTP IP origin, offer 1-click redirect to localhost
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.isSecureContext) {
        const currentPort = window.location.port || '3000'
        const localhostUrl = `http://localhost:${currentPort}${window.location.pathname}${window.location.search}`
        
        const shouldRedirect = window.confirm(
          `Browsers block microphone access on HTTP IP addresses (${window.location.hostname}).\n\nClick OK to switch to http://localhost:${currentPort} now so voice recording works immediately!`
        )
        if (shouldRedirect) {
          window.location.href = localhostUrl
          return
        }
      }

      alert("Unable to access microphone. Please check your browser microphone permissions.")
    }
  }

  // Cancel Voice Recording
  const handleCancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    audioChunksRef.current = []
    setIsRecording(false)
    setRecordingDuration(0)
  }

  // Stop & Send Voice Recording
  const handleStopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !matchId || !currentUser) return

    const mediaRecorder = mediaRecorderRef.current

    mediaRecorder.onstop = async () => {
      mediaRecorder.stream.getTracks().forEach(track => track.stop())

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      audioChunksRef.current = []

      if (audioBlob.size === 0) {
        setIsRecording(false)
        return
      }

      setSending(true)
      try {
        const filePath = `chat_${matchId}/audio_${Date.now()}.webm`
        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(filePath, audioBlob, { contentType: 'audio/webm' })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('chat-images')
          .getPublicUrl(filePath)

        const publicUrl = publicUrlData.publicUrl

        const { data: newMsg, error: insertError } = await supabase
          .from('messages')
          .insert({
            match_id: matchId,
            sender_id: currentUser.id,
            audio_url: publicUrl,
            is_deleted: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single() as any

        if (insertError) throw insertError

        if (newMsg) {
          setMessages(prev => [...prev, newMsg])
          scrollToBottom()
        }

        const { data: matchRow } = await supabase
          .from('matches')
          .select('user1_id, user2_id, user1_unread, user2_unread')
          .eq('id', matchId)
          .single() as any

        if (matchRow) {
          const isUser1 = matchRow.user1_id === currentUser.id
          const updateData = isUser1
            ? { last_message: '🎵 Voice message', last_message_at: new Date().toISOString(), user2_unread: (matchRow.user2_unread || 0) + 1 }
            : { last_message: '🎵 Voice message', last_message_at: new Date().toISOString(), user1_unread: (matchRow.user1_unread || 0) + 1 }

          await supabase.from('matches').update(updateData).eq('id', matchId)
        }
      } catch (err) {
        console.error("Audio message upload error:", err)
        alert("Failed to send voice message. Please try again.")
      } finally {
        setSending(false)
        setIsRecording(false)
        setRecordingDuration(0)
      }
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    mediaRecorder.stop()
  }

  const formatRecordingDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  // Insert Emoji at Cursor Position in Text Input
  const handleInsertEmoji = (emoji: string) => {
    const inputEl = inputRef.current
    if (!inputEl) {
      setInputText(prev => prev + emoji)
      return
    }
    const start = inputEl.selectionStart || inputText.length
    const end = inputEl.selectionEnd || inputText.length
    const updated = inputText.substring(0, start) + emoji + inputText.substring(end)
    setInputText(updated)

    setTimeout(() => {
      inputEl.focus()
      inputEl.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }

  // Handle Send Message
  const handleSendMessage = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault()
    if (!inputText.trim() || !matchId || !currentUser) return

    const content = inputText.trim()
    const activeReplyId = replyingToMessage ? replyingToMessage.id : null

    // 1. Instant Optimistic Render
    const optimisticId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const optimisticMsg = {
      id: optimisticId,
      match_id: matchId,
      sender_id: currentUser.id,
      content: content,
      reply_to_id: activeReplyId,
      is_deleted: false,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, optimisticMsg])
    setInputText('')
    setReplyingToMessage(null)
    setShowInputEmojiPicker(false)
    scrollToBottom()

    try {
      // 2. Insert into Supabase
      const insertPayload: any = {
        match_id: matchId,
        sender_id: currentUser.id,
        content: content,
        is_deleted: false
      }
      if (activeReplyId) {
        insertPayload.reply_to_id = activeReplyId
      }

      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select()
        .single() as any

      if (error) {
        console.warn("Supabase insert notice:", error.message || error.details || error)
      } else if (newMsg) {
        // Swap optimistic ID with database ID
        setMessages(prev => prev.map(m => m.id === optimisticId ? newMsg : m))
      }

      // 3. Update match last message & unread
      const { data: matchRow } = await supabase
        .from('matches')
        .select('user1_id, user2_id, user1_unread, user2_unread')
        .eq('id', matchId)
        .single() as any

      if (matchRow) {
        const isUser1 = matchRow.user1_id === currentUser.id
        const updateData = isUser1
          ? { last_message: content, last_message_at: new Date().toISOString(), user2_unread: (matchRow.user2_unread || 0) + 1 }
          : { last_message: content, last_message_at: new Date().toISOString(), user1_unread: (matchRow.user1_unread || 0) + 1 }

        await supabase.from('matches').update(updateData).eq('id', matchId)
      }
    } catch (err: any) {
      console.warn("Send message background notice:", err?.message || err)
    }
  }

  // Handle Photo Selection & Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !matchId || !currentUser) return

    setShowAttachMenu(false)
    setSending(true)
    try {
      const filePath = `chat_${matchId}/img_${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath)

      const publicUrl = publicUrlData.publicUrl

      const { data: newMsg, error: insertError } = await supabase
        .from('messages')
        .insert({
          match_id: matchId,
          sender_id: currentUser.id,
          image_url: publicUrl,
          content: '📷 Photo',
          is_deleted: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single() as any

      if (insertError) throw insertError

      if (newMsg) {
        setMessages(prev => [...prev, newMsg])
        scrollToBottom()
      }

      await supabase.from('matches').update({
        last_message: '📷 Photo',
        last_message_at: new Date().toISOString()
      }).eq('id', matchId)
    } catch (err) {
      console.error("Photo upload error:", err)
      alert("Failed to upload photo. Please try again.")
    } finally {
      setSending(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  // Handle File Selection & Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !matchId || !currentUser) return

    setShowAttachMenu(false)
    setSending(true)
    try {
      const filePath = `chat_${matchId}/doc_${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath)

      const publicUrl = publicUrlData.publicUrl

      const { data: newMsg, error: insertError } = await supabase
        .from('messages')
        .insert({
          match_id: matchId,
          sender_id: currentUser.id,
          file_url: publicUrl,
          file_name: file.name,
          content: `📁 ${file.name}`,
          is_deleted: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single() as any

      if (insertError) throw insertError

      if (newMsg) {
        setMessages(prev => [...prev, newMsg])
        scrollToBottom()
      }

      await supabase.from('matches').update({
        last_message: `📁 ${file.name}`,
        last_message_at: new Date().toISOString()
      }).eq('id', matchId)
    } catch (err) {
      console.error("File upload error:", err)
      alert("Failed to upload file. Please try again.")
    } finally {
      setSending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Soft Delete Message Action
  const handleSoftDeleteMessage = async (msgToDel: any) => {
    setMsgContextMenu(null)
    if (!msgToDel || !currentUser) return

    const confirmed = window.confirm("Delete message? This message will be marked as deleted for everyone.")
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', msgToDel.id)
        .eq('sender_id', currentUser.id)

      if (error) throw error

      setMessages(prev => prev.map(m => m.id === msgToDel.id ? { ...m, is_deleted: true } : m))
    } catch (err) {
      console.error("Soft delete message failed:", err)
      alert("Failed to delete message. Please try again.")
    }
  }

  // Batch Delete Action for Multi-Select Mode
  const handleBatchDeleteMessages = async () => {
    if (!currentUser || selectedMessageIds.length === 0) return

    const confirmed = window.confirm(`Delete ${selectedMessageIds.length} selected message(s)?`)
    if (!confirmed) return

    const mySelectedIds = selectedMessageIds.filter(id => {
      const msg = messages.find(m => m.id === id)
      return msg && msg.sender_id === currentUser.id && !msg.is_deleted
    })

    const otherSelectedCount = selectedMessageIds.length - mySelectedIds.length

    if (mySelectedIds.length > 0) {
      try {
        const { error } = await supabase
          .from('messages')
          .update({ is_deleted: true })
          .in('id', mySelectedIds)
          .eq('sender_id', currentUser.id)

        if (error) throw error

        setMessages(prev => prev.map(m => mySelectedIds.includes(m.id) ? { ...m, is_deleted: true } : m))
      } catch (err) {
        console.error("Batch delete error:", err)
        alert("Failed to delete messages. Please try again.")
      }
    }

    if (otherSelectedCount > 0 && activeMatch) {
      alert(`${otherSelectedCount} message(s) sent by ${activeMatch.name} could not be deleted because you can only delete your own messages.`)
    }

    setIsSelectMode(false)
    setSelectedMessageIds([])
  }

  // View Profile Action
  const handleViewProfile = () => {
    setIsMenuOpen(false)
    setShowProfileModal(true)
  }

  // Clear Chat History Action
  const handleClearChat = async () => {
    if (!currentUser || !activeMatch || !matchId) return
    setIsMenuOpen(false)

    const confirmed = window.confirm(`Clear all chat history with ${activeMatch.name}? This action cannot be undone.`)
    if (!confirmed) return

    try {
      await supabase.from('messages').delete().eq('match_id', matchId)
      await supabase
        .from('matches')
        .update({ last_message: null, last_message_at: null, user1_unread: 0, user2_unread: 0 })
        .eq('id', matchId)

      setMessages([])
    } catch (err) {
      console.error("Clear chat error:", err)
      alert("Failed to clear chat history. Please try again.")
    }
  }

  // Unmatch Action
  const handleUnmatch = async () => {
    if (!currentUser || !activeMatch || !matchId) return
    setIsMenuOpen(false)

    const confirmed = window.confirm(`Unmatch with ${activeMatch.name}? You will no longer be able to message each other.`)
    if (!confirmed) return

    try {
      await supabase.from('matches').delete().eq('id', matchId)
      alert(`You have unmatched with ${activeMatch.name}.`)
      router.push('/matches')
    } catch (err) {
      console.error("Unmatch error:", err)
      alert("Failed to unmatch. Please try again.")
    }
  }

  // Block User Action
  const handleBlockUser = async () => {
    if (!currentUser || !activeMatch || !matchId) return
    setIsMenuOpen(false)

    const confirmed = window.confirm(`Are you sure you want to block ${activeMatch.name}? They will be removed from your matches and blocked from contacting you.`)
    if (!confirmed) return

    try {
      await (supabase.from('blocked_users') as any).insert({
        blocker_id: currentUser.id,
        blocked_id: activeMatch.otherUserId
      })
      await supabase.from('matches').delete().eq('id', matchId)

      alert(`${activeMatch.name} has been blocked.`)
      router.push('/matches')
    } catch (e) {
      console.error("Block user failed:", e)
      alert("Failed to block user. Please try again.")
    }
  }



  // Toggle Mute Notifications Action
  const handleToggleMute = async () => {
    if (!currentUser || !activeMatch || !matchId) return
    setIsMenuOpen(false)

    const nextMuteState = !isMuted
    setIsMuted(nextMuteState)

    try {
      const { data: matchRow } = await supabase
        .from('matches')
        .select('user1_id, user2_id')
        .eq('id', matchId)
        .single() as any

      if (matchRow) {
        const isUser1 = matchRow.user1_id === currentUser.id
        const updateData = isUser1 ? { muted_by_user1: nextMuteState } : { muted_by_user2: nextMuteState }
        await supabase.from('matches').update(updateData).eq('id', matchId)
      }
    } catch (e) {
      console.warn("Mute update warning:", e)
    }
  }

  // Report User Submission
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !activeMatch) return

    setSubmittingReport(true)

    try {
      const { error } = await (supabase.from('reports') as any).insert({
        reporter_id: currentUser.id,
        reported_id: activeMatch.otherUserId,
        reason: reportReason,
        details: reportDetails.trim(),
        status: 'pending'
      })

      if (error) {
        console.error("Report submit error:", error)
        alert("Failed to submit report. Please try again.")
        return
      }

      alert("Thank you. Your report has been submitted for review.")
      setReportModalOpen(false)
      setReportDetails('')
    } catch (e) {
      console.error("Report submit error:", e)
      alert("Failed to submit report. Please try again.")
    } finally {
      setSubmittingReport(false)
    }
  }

  const formatMessageTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    }

    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24))
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' })
    return date.toLocaleDateString([], { month: '2-digit', day: '2-digit' })
  }

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesQuery = (
        c.name.toLowerCase().includes(q) ||
        (c.course && c.course.toLowerCase().includes(q)) ||
        (c.campus && c.campus.toLowerCase().includes(q)) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
      )
      if (!matchesQuery) return false
    }

    // 2. Active Tab Filter
    if (activeFilter === 'online') return c.online
    if (activeFilter === 'unread') return c.unreadCount > 0
    if (activeFilter === 'recent') {
      if (!c.lastMessageAt) return false
      const diffHours = (Date.now() - new Date(c.lastMessageAt).getTime()) / (1000 * 3600)
      return diffHours <= 48
    }

    return true
  })

  // Case 1: Active Chat Thread View
  if (matchId && activeMatch) {
    const hasOwnSelectedMessages = selectedMessageIds.some(id => {
      const msg = messages.find(m => m.id === id)
      return msg && msg.sender_id === currentUser?.id && !msg.is_deleted
    })

    return (
      <div className="chat-page">
        {/* Thread Header / Select Mode Header */}
        {isSelectMode ? (
          <nav className="chat-header select-mode-header">
            <div className="select-mode-left">
              <span className="select-count">{selectedMessageIds.length} selected</span>
            </div>

            <div className="select-mode-right">
              <button
                className="btn-select-cancel"
                onClick={() => {
                  setIsSelectMode(false)
                  setSelectedMessageIds([])
                }}
              >
                Cancel
              </button>

              <button
                className="btn-select-delete"
                disabled={!hasOwnSelectedMessages}
                onClick={handleBatchDeleteMessages}
                title="Delete selected messages"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </nav>
        ) : (
          <nav className="chat-header">
            <div className="chat-header-left">
              <button
                className="back-btn"
                onClick={() => router.push('/chat')}
                title="Back to conversations"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>

              <div className="user-profile">
                <img src={activeMatch.photoUrl} alt={activeMatch.name} className="chat-avatar" />
                <div className="chat-header-info">
                  <h3>{activeMatch.name}</h3>
                  <p className="status">
                    {activeMatch.online ? '🟢 Online' : [activeMatch.course, activeMatch.campus].filter(Boolean).join(' • ') || 'UniMatch student'}
                  </p>
                </div>
              </div>
            </div>

            <div className="chat-header-right" style={{ position: 'relative' }}>
              <button
                ref={chatMenuTriggerRef}
                className="more-btn"
                onClick={() => setIsMenuOpen(prev => !prev)}
                title="More options"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2.2"/>
                  <circle cx="12" cy="12" r="2.2"/>
                  <circle cx="12" cy="19" r="2.2"/>
                </svg>
              </button>

              {isMenuOpen && (
                <div ref={chatMenuRef} className="chat-menu">
                  <button className="menu-item" onClick={handleViewProfile}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>View Profile</span>
                  </button>

                  <button className="menu-item" onClick={handleToggleMute}>
                    {isMuted ? (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                        <span>Unmute Notifications</span>
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                        <span>Mute Notifications</span>
                      </>
                    )}
                  </button>

                  <button className="menu-item" onClick={handleClearChat}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    <span>Clear Chat</span>
                  </button>

                  <button
                    className="menu-item"
                    onClick={() => {
                      setIsMenuOpen(false)
                      setReportModalOpen(true)
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
                    </svg>
                    <span>Report User</span>
                  </button>

                  <div className="menu-divider"></div>

                  <button className="menu-item danger" onClick={handleUnmatch}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>
                    </svg>
                    <span>Unmatch</span>
                  </button>

                  <button className="menu-item danger" onClick={handleBlockUser}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                    <span>Block User</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        )}

        {/* Thread Messages */}
        <div className="messages-container">
          {messagesLoading ? (
            <div className="chat-empty-thread">
              <p>Loading messages thread…</p>
            </div>
          ) : messages.length > 0 ? (
            messages.map(m => {
              const isSent = m.sender_id === currentUser?.id
              const parentMsg = m.reply_to_id ? messages.find(p => p.id === m.reply_to_id) : null
              const isSelected = selectedMessageIds.includes(m.id)

              const handleBubbleClick = (e: React.MouseEvent) => {
                if (isSelectMode) {
                  e.stopPropagation()
                  setSelectedMessageIds(prev =>
                    prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                  )
                }
              }

              const msgReactionsList = reactions[m.id] || []
              const groupedReactionsMap = msgReactionsList.reduce((acc: Record<string, any[]>, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = []
                acc[r.emoji].push(r)
                return acc
              }, {})

              return (
                <div
                  key={m.id}
                  className={`message-row-wrap ${isSent ? 'row-sent' : 'row-received'} ${isSelectMode ? 'select-mode' : ''}`}
                  onClick={handleBubbleClick}
                >
                  {isSelectMode && (
                    <div className={`select-checkbox ${isSelected ? 'checked' : ''}`}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                  )}

                  <div className="bubble-and-reactions">
                    <div
                      className={`message-bubble ${isSent ? 'sent' : 'received'} ${m.is_deleted ? 'deleted-bubble' : ''} ${isSelected ? 'selected-bubble' : ''}`}
                      onContextMenu={(e) => {
                        if (isSelectMode) {
                          e.preventDefault()
                          return
                        }
                        e.preventDefault()
                        setMsgContextMenu({ x: e.clientX, y: e.clientY, message: m })
                      }}
                    >
                      {/* Quoted Reply Box */}
                      {m.reply_to_id && (
                        <div className="reply-quote-box">
                          <div className="reply-quote-sender">
                            {parentMsg ? (parentMsg.sender_id === currentUser?.id ? 'You' : activeMatch.name) : 'Quoted Message'}
                          </div>
                          <div className="reply-quote-text">
                            {parentMsg
                              ? (parentMsg.is_deleted ? <i>Original message deleted</i> : (parentMsg.content || parentMsg.text || parentMsg.message))
                              : <i>Original message deleted</i>
                            }
                          </div>
                        </div>
                      )}

                      {/* Message Content (Text, Photo, File, or Audio) */}
                      {m.is_deleted ? (
                        <div className="message-text deleted-text">
                          <i>This message was deleted</i>
                        </div>
                      ) : m.image_url ? (
                        <div className="message-photo-wrap" onClick={(e) => {
                          e.stopPropagation()
                          setMediaItems({ photos: [m], files: [], voice: [] })
                          setActiveLightboxIndex(0)
                        }}>
                          <img src={m.image_url} alt="Shared photo" className="message-photo-img" />
                        </div>
                      ) : m.file_url ? (
                        <div className="message-file-wrap">
                          <div className="file-icon">📄</div>
                          <div className="file-info">
                            <span className="file-title">{m.file_name || m.content || 'Attachment'}</span>
                          </div>
                          <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="btn-file-dl" download title="Download file">
                            ⬇️
                          </a>
                        </div>
                      ) : m.audio_url ? (
                        <InlineAudioPlayer audioUrl={m.audio_url} />
                      ) : (
                        <div className="message-text">{m.content || m.text || m.message}</div>
                      )}

                      <div className="message-time">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Reaction Pills Row below Bubble */}
                    {Object.keys(groupedReactionsMap).length > 0 && !m.is_deleted && (
                      <div className={`message-reactions-row ${isSent ? 'sent-reactions' : 'received-reactions'}`}>
                        {Object.entries(groupedReactionsMap).map(([emoji, list]) => {
                          const hasUserReacted = list.some(r => r.user_id === currentUser?.id)
                          const reactorNames = list.map(r => r.user_id === currentUser?.id ? 'You' : activeMatch.name).join(', ')
                          return (
                            <button
                              key={emoji}
                              type="button"
                              className={`reaction-pill ${hasUserReacted ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleReaction(m.id, emoji)
                              }}
                              title={`Reacted by: ${reactorNames}`}
                            >
                              <span className="reaction-emoji">{emoji}</span>
                              {list.length > 1 && <span className="reaction-count">{list.length}</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="chat-empty-thread">
              <span style={{ fontSize: '42px' }}>👋</span>
              <h4 style={{ color: 'white', margin: '8px 0 4px' }}>Say hello to {activeMatch.name}!</h4>
              <p style={{ color: '#8b7fa8', fontSize: '13px' }}>Break the ice and start your conversation</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Context Menu Popup with Quick Reactions Row */}
        {msgContextMenu && !isSelectMode && (
          <div
            ref={msgContextMenuRef}
            className="msg-context-menu"
            style={{ top: `${Math.min(msgContextMenu.y, window.innerHeight - 180)}px`, left: `${Math.min(msgContextMenu.x, window.innerWidth - 180)}px` }}
          >
            {/* Quick Reactions Bar */}
            {!msgContextMenu.message.is_deleted && (
              <div className="quick-reactions-bar">
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    className="quick-react-btn"
                    onClick={() => {
                      handleToggleReaction(msgContextMenu.message.id, emoji)
                      setMsgContextMenu(null)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  className="quick-react-btn more-btn"
                  onClick={() => {
                    setShowFullPickerForMsgId(msgContextMenu.message.id)
                    setMsgContextMenu(null)
                  }}
                  title="More reactions"
                >
                  +
                </button>
              </div>
            )}

            {!msgContextMenu.message.is_deleted && (
              <button
                className="msg-context-item"
                data-action="reply"
                onClick={() => {
                  const m = msgContextMenu.message
                  setReplyingToMessage({
                    id: m.id,
                    content: m.content || m.text || m.message || '',
                    senderName: m.sender_id === currentUser?.id ? 'You' : activeMatch.name
                  })
                  setMsgContextMenu(null)
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                </svg>
                <span>Reply</span>
              </button>
            )}

            <button
              className="msg-context-item"
              data-action="select"
              onClick={() => {
                const m = msgContextMenu.message
                setIsSelectMode(true)
                setSelectedMessageIds([m.id])
                setMsgContextMenu(null)
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <span>Select</span>
            </button>

            {msgContextMenu.message.sender_id === currentUser?.id && !msgContextMenu.message.is_deleted && (
              <button
                className="msg-context-item danger"
                data-action="delete"
                onClick={() => handleSoftDeleteMessage(msgContextMenu.message)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span>Delete</span>
              </button>
            )}
          </div>
        )}

        {/* Unified Chat Input Area & Reply Preview Bar Wrapper */}
        <div className="chat-input-wrapper">
          {/* Attachment Menu Popover (+) */}
          {showAttachMenu && !isSelectMode && (
            <div ref={attachMenuRef} className="attach-menu-popover">
              <button
                type="button"
                className="attach-menu-item"
                onClick={() => {
                  setShowAttachMenu(false)
                  photoInputRef.current?.click()
                }}
              >
                <span className="attach-icon">📷</span>
                <span>Photo</span>
              </button>
              <button
                type="button"
                className="attach-menu-item"
                onClick={() => {
                  setShowAttachMenu(false)
                  fileInputRef.current?.click()
                }}
              >
                <span className="attach-icon">📄</span>
                <span>File</span>
              </button>
            </div>
          )}

          {/* Full Category Text Input Emoji Popover */}
          {showInputEmojiPicker && !isSelectMode && (
            <div ref={inputEmojiPickerRef} className="reaction-picker-card input-emoji-full-popover" onClick={e => e.stopPropagation()}>
              <div className="picker-header">
                <span className="picker-title">Insert Emoji</span>
                <button type="button" className="picker-close-btn" onClick={() => setShowInputEmojiPicker(false)}>✕</button>
              </div>

              <div className="picker-search-bar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search emoji..."
                  value={emojiSearch}
                  onChange={e => setEmojiSearch(e.target.value)}
                />
                {emojiSearch && (
                  <button type="button" className="search-clear-btn" onClick={() => setEmojiSearch('')}>✕</button>
                )}
              </div>

              {/* Categories Tab Bar */}
              <div className="picker-categories-bar">
                {EMOJI_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-tab ${activeEmojiCategory === cat.id && !emojiSearch ? 'active' : ''}`}
                    onClick={() => {
                      setActiveEmojiCategory(cat.id)
                      setEmojiSearch('')
                    }}
                    title={cat.name}
                  >
                    {cat.icon}
                  </button>
                ))}
              </div>

              {/* Emoji Grid */}
              <div className="picker-emoji-grid">
                {(emojiSearch.trim()
                  ? Object.values(EMOJI_DATA).flat().filter(e => e.includes(emojiSearch))
                  : (activeEmojiCategory === 'recent' ? recentEmojis : (EMOJI_DATA[activeEmojiCategory] || []))
                ).map((emoji, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="emoji-grid-btn"
                    onClick={() => {
                      handleInsertEmoji(emoji)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {replyingToMessage && !isSelectMode && (
            <div className="reply-preview-bar">
              <div className="reply-preview-accent"></div>
              <div className="reply-preview-body">
                <span className="reply-preview-title">Replying to {replyingToMessage.senderName}</span>
                <span className="reply-preview-snippet">{replyingToMessage.content}</span>
              </div>
              <button
                type="button"
                className="reply-preview-close"
                onClick={() => setReplyingToMessage(null)}
                title="Cancel reply"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )}

          {!isSelectMode && (
            isRecording ? (
              <div className="voice-recording-bar">
                <div className="recording-indicator">
                  <span className="recording-dot"></span>
                  <span className="recording-timer">{formatRecordingDuration(recordingDuration)}</span>
                </div>
                <div className="recording-waveform">
                  <span className="bar"></span>
                  <span className="bar"></span>
                  <span className="bar"></span>
                  <span className="bar"></span>
                  <span className="bar"></span>
                </div>
                <div className="recording-actions">
                  <button
                    type="button"
                    className="btn-recording-cancel"
                    onClick={handleCancelRecording}
                    title="Cancel recording"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    className="btn-recording-send"
                    onClick={handleStopAndSendRecording}
                    disabled={sending}
                    title="Send voice message"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <form className="chat-input-area" onSubmit={handleSendMessage}>
                {/* Hidden File Inputs */}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoSelect}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="*/*"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />

                {/* 1. Emoji Button */}
                <button
                  type="button"
                  className="btn-input-emoji"
                  onClick={() => setShowInputEmojiPicker(prev => !prev)}
                  title="Insert emoji"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9"/>
                    <line x1="15" y1="9" x2="15.01" y2="9"/>
                  </svg>
                </button>

                {/* 2. Text Input Field */}
                <input
                  ref={inputRef}
                  type="text"
                  className="chat-input-field"
                  placeholder={`Message ${activeMatch.name}…`}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage(e)
                    }
                  }}
                />

                {/* 3. Mic (Voice Recording) Button */}
                <button
                  type="button"
                  className="btn-mic"
                  onClick={handleStartRecording}
                  title="Record voice message"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>

                {/* 4. Attachment (Image/File) Button */}
                <button
                  type="button"
                  className="btn-gallery"
                  onClick={() => setShowAttachMenu(prev => !prev)}
                  title="Attach Photo or File"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>

                {/* 6. Send Button */}
                <button
                  type="submit"
                  className="btn-send"
                  disabled={!inputText.trim()}
                  onClick={(e) => {
                    e.preventDefault()
                    handleSendMessage(e)
                  }}
                  title="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </form>
            )
          )}
        </div>
        {/* Full Emoji Reaction Picker Modal */}
        {showFullPickerForMsgId && (
          <div className="reaction-picker-overlay" onClick={() => setShowFullPickerForMsgId(null)}>
            <div id="reactionPicker" className="reaction-picker-card" onClick={e => e.stopPropagation()}>
              <div className="picker-header">
                <span className="picker-title">Choose Reaction</span>
                <button className="picker-close-btn" onClick={() => setShowFullPickerForMsgId(null)}>✕</button>
              </div>

              <div className="picker-search-bar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search emoji..."
                  value={emojiSearch}
                  onChange={e => setEmojiSearch(e.target.value)}
                />
                {emojiSearch && (
                  <button className="search-clear-btn" onClick={() => setEmojiSearch('')}>✕</button>
                )}
              </div>

              {/* Categories Tab Bar */}
              <div className="picker-categories-bar">
                {EMOJI_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-tab ${activeEmojiCategory === cat.id && !emojiSearch ? 'active' : ''}`}
                    onClick={() => {
                      setActiveEmojiCategory(cat.id)
                      setEmojiSearch('')
                    }}
                    title={cat.name}
                  >
                    {cat.icon}
                  </button>
                ))}
              </div>

              {/* Emoji Grid */}
              <div className="picker-emoji-grid">
                {(emojiSearch.trim()
                  ? Object.values(EMOJI_DATA).flat().filter(e => e.includes(emojiSearch))
                  : (activeEmojiCategory === 'recent' ? recentEmojis : (EMOJI_DATA[activeEmojiCategory] || []))
                ).map((emoji, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="emoji-grid-btn"
                    onClick={() => {
                      handleToggleReaction(showFullPickerForMsgId, emoji)
                      setShowFullPickerForMsgId(null)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <BottomNav activeTab="chat" />
      </div>
    )
  }

  // Case 2: Conversations List View (Landing Page)
  return (
    <div className="chat-page">
      {/* Top Navbar */}
      <nav className="app-topnav">
        <div className="topnav-logo">
          <div className="logo-mark">U</div>
          <span className="logo-text">UniMatch</span>
        </div>
      </nav>

      {/* Messaging Header */}
      <div className="chat-hub-header">
        <span className="chat-hub-title">Messages</span>
      </div>

      {/* Search Field */}
      {conversations.length > 0 && (
        <div className="chat-search-wrap">
          <div className="chat-search-box">
            <svg className="chat-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="chat-search-input"
              placeholder="Search chats…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Filter Pills Bar */}
      <div className="chat-filter-bar">
        <button
          className={`chat-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All
        </button>
        <button
          className={`chat-filter-pill ${activeFilter === 'online' ? 'active' : ''}`}
          onClick={() => setActiveFilter('online')}
        >
          <span className="pill-dot-online"></span> Online
        </button>
        <button
          className={`chat-filter-pill ${activeFilter === 'unread' ? 'active' : ''}`}
          onClick={() => setActiveFilter('unread')}
        >
          📩 Unread
        </button>
        <button
          className={`chat-filter-pill ${activeFilter === 'recent' ? 'active' : ''}`}
          onClick={() => setActiveFilter('recent')}
        >
          ⚡ Recent
        </button>
      </div>

      {/* Conversations List */}
      <div className="chat-list-container">
        {conversationsLoading ? (
          <div className="chat-empty-hub">
            <p>Loading messages…</p>
          </div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map(c => (
            <Link
              key={c.id}
              href={`/chat?matchId=${c.id}`}
              className={`chat-list-row ${c.unreadCount > 0 ? 'unread' : ''}`}
            >
              <div className="chat-row-avatar-wrap">
                <img src={c.photoUrl} alt={c.name} className="chat-row-avatar" />
                {c.online && <div className="chat-row-online"></div>}
              </div>

              <div className="chat-row-info">
                <div className="chat-row-name">{c.name}</div>
                <div className="chat-row-preview">{c.lastMessage}</div>
              </div>

              <div className="chat-row-meta-badge">
                <span className="match-pct-badge">{c.matchPct}% Match</span>
              </div>

              <div className="chat-row-right">
                <span className="chat-row-time">{formatMessageTime(c.lastMessageAt)}</span>
                {c.unreadCount > 0 && (
                  <span className="chat-row-unread-badge">{c.unreadCount}</span>
                )}
              </div>
            </Link>
          ))
        ) : (
          <div className="chat-empty-hub">
            <span className="chat-empty-icon">💬</span>
            <div className="chat-empty-title">No messages found</div>
            <p style={{ fontSize: '13px', margin: '4px 0 12px' }}>
              {searchQuery || activeFilter !== 'all' ? 'Try changing your search or active filter tab.' : 'Start swiping to find new matches!'}
            </p>
            {activeFilter === 'all' && !searchQuery && (
              <Link href="/discover" className="btn-conv-discover">Start Discovering</Link>
            )}
          </div>
        )}
      </div>

      <BottomNav activeTab="chat" />

      {/* Report User Modal */}
      {reportModalOpen && (
        <div className="report-modal-overlay" onClick={() => setReportModalOpen(false)}>
          <div className="report-modal-card" onClick={e => e.stopPropagation()}>
            <div className="report-modal-header">
              <h3>Report {activeMatch?.name || 'User'}</h3>
              <button className="report-modal-close" onClick={() => setReportModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmitReport} className="report-modal-form">
              <label className="report-label">Reason for reporting</label>
              <select
                className="report-select"
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
              >
                <option value="Harassment">Harassment / Bullying</option>
                <option value="Fake Profile">Fake Profile / Impersonation</option>
                <option value="Inappropriate Content">Inappropriate Content</option>
                <option value="Spam">Spam / Commercial</option>
                <option value="Other">Other</option>
              </select>

              <label className="report-label">Additional details (optional)</label>
              <textarea
                className="report-textarea"
                rows={4}
                placeholder="Describe what happened..."
                value={reportDetails}
                onChange={e => setReportDetails(e.target.value)}
              />

              <div className="report-modal-actions">
                <button
                  type="button"
                  className="btn-report-cancel"
                  onClick={() => setReportModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-report-submit"
                  disabled={submittingReport}
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read-Only Profile Viewer Modal */}
      {showProfileModal && activeMatch && (
        <div className="report-modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="report-modal-card profile-view-card" onClick={e => e.stopPropagation()}>
            <div className="report-modal-header">
              <h3>{activeMatch.name}'s Profile</h3>
              <button className="report-modal-close" onClick={() => setShowProfileModal(false)}>✕</button>
            </div>

            <div className="profile-view-body">
              <div className="profile-view-avatar-wrap">
                <img src={activeMatch.photoUrl} alt={activeMatch.name} className="profile-view-avatar" />
              </div>

              <div className="profile-view-info">
                <h4 style={{ fontSize: '20px', fontWeight: 800, color: 'white', margin: '12px 0 4px' }}>
                  {activeMatch.name} {activeMatch.age ? `, ${activeMatch.age}` : ''}
                </h4>
                <p style={{ fontSize: '13.5px', color: '#a855f7', fontWeight: 600, marginBottom: '12px' }}>
                  {[activeMatch.course, activeMatch.campus].filter(Boolean).join(' • ') || 'UniMatch Student'}
                </p>

                {activeMatch.bio && (
                  <div style={{ marginTop: '12px', textAlign: 'left', background: 'rgba(255, 255, 255, 0.04)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <h5 style={{ fontSize: '12px', color: '#8b7fa8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>About</h5>
                    <p style={{ fontSize: '14px', color: '#e2d8f3', lineHeight: 1.5 }}>{activeMatch.bio}</p>
                  </div>
                )}

                {activeMatch.interests && activeMatch.interests.length > 0 && (
                  <div style={{ marginTop: '12px', textAlign: 'left' }}>
                    <h5 style={{ fontSize: '12px', color: '#8b7fa8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Interests</h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {activeMatch.interests.map((tag: string, idx: number) => (
                        <span key={idx} style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(168, 85, 247, 0.18)', border: '1px solid rgba(168, 85, 247, 0.35)', color: '#f3e8ff', fontSize: '12px', fontWeight: 600 }}>
                          ✨ {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shared Media Gallery Modal */}
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="chat-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#8b7fa8' }}>
        <p>Loading chat center…</p>
      </div>
    }>
      <ChatHubContent />
    </Suspense>
  )
}
