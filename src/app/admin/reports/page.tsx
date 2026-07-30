'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import LoadingScreen from '@/components/LoadingScreen'
import { DEFAULT_AVATAR } from '@/lib/constants'
import { useModal } from '@/components/ModalContext'
import './admin.css'

interface ReportItem {
  id: string
  reporter_id: string
  reported_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  reporter?: any
  reported?: any
}

interface GroupedTargetUser {
  targetId: string
  targetProfile: any
  reports: ReportItem[]
  pendingCount: number
  reasonsMap: Record<string, number>
  isBanned: boolean
  latestReportDate: string
}

function AdminReportsContent() {
  const router = useRouter()
  const supabase = createClient()
  const modal = useModal()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Passcode Lock Screen State
  const [passcode, setPasscode] = useState('')
  const [passcodeError, setPasscodeError] = useState('')

  const [reports, setReports] = useState<ReportItem[]>([])
  const [bannedUserIds, setBannedUserIds] = useState<string[]>([])
  
  // Organization & View Controls
  const [viewMode, setViewMode] = useState<'grouped' | 'individual'>('grouped')
  const [activeStatusTab, setActiveStatusTab] = useState<'all' | 'pending' | 'under_review' | 'resolved' | 'dismissed'>('all')
  const [reasonFilter, setReasonFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'risk' | 'newest' | 'oldest'>('risk')
  const [searchQuery, setSearchQuery] = useState('')

  // Evidence Inspector Modal State
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null)
  const [chatLogs, setChatLogs] = useState<any[]>([])
  const [chatLogsLoading, setChatLogsLoading] = useState(false)

  useEffect(() => {
    async function checkAuthAndLoad() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
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

        const storedAdminSession = typeof window !== 'undefined' ? localStorage.getItem('unimatch_admin_auth') : null

        if (profile?.role === 'admin' || storedAdminSession === 'unlocked_admin_session') {
          setIsAdmin(true)
          await fetchReports()
        } else {
          setIsAdmin(false)
        }
      } catch (err) {
        console.error("Admin page init error:", err)
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndLoad()
  }, [])

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    const validKeys = ['unimatch2026', 'admin2026', 'admin123', 'superadmin']

    if (validKeys.includes(passcode.trim().toLowerCase())) {
      if (currentUser?.id) {
        try {
          await (supabase.from('profiles') as any)
            .update({ role: 'admin' })
            .eq('id', currentUser.id)
        } catch (e) { }
      }

      try {
        localStorage.setItem('unimatch_admin_auth', 'unlocked_admin_session')
      } catch (e) { }

      setIsAdmin(true)
      setPasscodeError('')
      await fetchReports()
      modal.toast('Admin Portal Unlocked 🔓', 'success')
    } else {
      setPasscodeError('Invalid secret key. Access denied.')
    }
  }

  const fetchReports = async () => {
    try {
      // 1. Fetch via Server API Route (Bypasses Client RLS)
      const res = await fetch('/api/reports', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        if (json.success && Array.isArray(json.reports)) {
          setReports(json.reports)
          if (Array.isArray(json.bannedUserIds)) {
            setBannedUserIds(json.bannedUserIds)
          }
          return
        }
      }
    } catch (e) {
      console.warn("Server API fetch notice, trying client fallback:", e)
    }

    // 2. Client-side query fallback
    try {
      const { data: rawReports, error: reportsErr } = await (supabase.from('reports') as any)
        .select('*')
        .order('created_at', { ascending: false })

      if (reportsErr || !rawReports) {
        setReports([])
        return
      }

      const userIds = Array.from(
        new Set(
          rawReports.flatMap((r: any) => [r.reporter_id, r.reported_id]).filter(Boolean)
        )
      )

      let profilesMap: Record<string, any> = {}
      if (userIds.length > 0) {
        const { data: profilesData } = await (supabase.from('profiles') as any)
          .select('*')
          .in('id', userIds)

        if (profilesData) {
          profilesData.forEach((p: any) => {
            profilesMap[p.id] = p
          })
        }
      }

      const enrichedReports: ReportItem[] = rawReports.map((r: any) => ({
        ...r,
        status: r.status || 'pending',
        reporter: profilesMap[r.reporter_id] || { name: 'Anonymous User', photo_url: DEFAULT_AVATAR },
        reported: profilesMap[r.reported_id] || { name: 'Unknown User', photo_url: DEFAULT_AVATAR }
      }))

      setReports(enrichedReports)

      const { data: bannedProfiles } = await (supabase.from('profiles') as any)
        .select('id')
        .eq('is_banned', true)

      if (bannedProfiles) {
        setBannedUserIds(bannedProfiles.map((p: any) => p.id))
      }
    } catch (err) {
      console.warn("Fetch reports error:", err)
    }
  }

  // Load chat logs between reporter and reported user when a report is selected
  const handleInspectReport = async (report: ReportItem) => {
    setSelectedReport(report)
    setChatLogsLoading(true)
    setChatLogs([])

    try {
      const { data: match } = await supabase
        .from('matches')
        .select('id')
        .or(`and(user1_id.eq.${report.reporter_id},user2_id.eq.${report.reported_id}),and(user2_id.eq.${report.reporter_id},user1_id.eq.${report.reported_id})`)
        .single() as any

      if (match) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('match_id', match.id)
          .order('created_at', { ascending: true }) as any

        setChatLogs(msgs || [])
      } else {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${report.reporter_id}),and(sender_id.eq.${report.reported_id})`)
          .order('created_at', { ascending: true })
          .limit(30) as any

        setChatLogs(msgs || [])
      }

      if (report.status === 'pending') {
        await (supabase.from('reports') as any)
          .update({ status: 'under_review' })
          .eq('id', report.id)

        setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'under_review' } : r))
      }
    } catch (e) {
      console.warn("Error fetching evidence chat logs:", e)
    } finally {
      setChatLogsLoading(false)
    }
  }

  // Moderation Action: Ban Target User (and resolve all reports against them)
  const handleBanTargetUser = async (targetUserId: string, targetUserName: string) => {
    modal.confirm({
      title: `Ban ${targetUserName}?`,
      message: `Ban ${targetUserName}? This will suspend their account and mark all reports against them as RESOLVED.`,
      confirmText: 'Ban Account',
      isDanger: true,
      onConfirm: async () => {
        try {
          // 1. Update is_banned on profile
          await (supabase.from('profiles') as any)
            .update({ is_banned: true })
            .eq('id', targetUserId)

          // 2. Mark all pending/under_review reports against this target as resolved
          await (supabase.from('reports') as any)
            .update({ status: 'resolved' })
            .eq('reported_id', targetUserId)

          setBannedUserIds(prev => [...prev, targetUserId])
          setReports(prev => prev.map(r => r.reported_id === targetUserId ? { ...r, status: 'resolved' } : r))
          if (selectedReport?.reported_id === targetUserId) {
            setSelectedReport(null)
          }

          modal.toast(`${targetUserName} has been banned and all reports resolved.`, 'success')
        } catch (e) {
          console.error("Ban user failed:", e)
          modal.toast("Failed to ban user. Please check database permissions.", "error")
        }
      }
    })
  }

  // Update Status of Single Report
  const handleUpdateStatus = async (newStatus: 'resolved' | 'dismissed') => {
    if (!selectedReport) return

    try {
      await (supabase.from('reports') as any)
        .update({ status: newStatus })
        .eq('id', selectedReport.id)

      setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, status: newStatus } : r))
      setSelectedReport(null)

      modal.toast(
        newStatus === 'resolved'
          ? 'Report marked as resolved.'
          : 'Report dismissed (found unproven/false).',
        'info'
      )
    } catch (e) {
      console.error("Update status failed:", e)
      modal.toast("Failed to update status.", "error")
    }
  }

  // 1. First Filter Reports by Status, Reason, Search
  const filteredReports = reports.filter(r => {
    if (activeStatusTab !== 'all' && r.status !== activeStatusTab) return false
    if (reasonFilter !== 'all' && r.reason.toLowerCase() !== reasonFilter.toLowerCase()) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const reporterName = r.reporter?.name?.toLowerCase() || ''
      const reportedName = r.reported?.name?.toLowerCase() || ''
      const reason = r.reason.toLowerCase()
      const details = r.details?.toLowerCase() || ''

      return reporterName.includes(q) || reportedName.includes(q) || reason.includes(q) || details.includes(q)
    }

    return true
  })

  // 2. Group Filtered Reports by Reported Target User
  const groupedTargetsMap: Record<string, GroupedTargetUser> = {}

  filteredReports.forEach(r => {
    const tId = r.reported_id
    if (!tId) return

    if (!groupedTargetsMap[tId]) {
      groupedTargetsMap[tId] = {
        targetId: tId,
        targetProfile: r.reported || { name: 'Unknown User', photo_url: DEFAULT_AVATAR },
        reports: [],
        pendingCount: 0,
        reasonsMap: {},
        isBanned: bannedUserIds.includes(tId),
        latestReportDate: r.created_at
      }
    }

    groupedTargetsMap[tId].reports.push(r)
    if (r.status === 'pending' || r.status === 'under_review') {
      groupedTargetsMap[tId].pendingCount += 1
    }

    const reasonKey = r.reason
    groupedTargetsMap[tId].reasonsMap[reasonKey] = (groupedTargetsMap[tId].reasonsMap[reasonKey] || 0) + 1
  })

  // Convert Grouped Map to Array & Sort
  const groupedTargetsList = Object.values(groupedTargetsMap).sort((a, b) => {
    if (sortBy === 'risk') {
      return b.reports.length - a.reports.length
    } else if (sortBy === 'newest') {
      return new Date(b.latestReportDate).getTime() - new Date(a.latestReportDate).getTime()
    } else {
      return new Date(a.latestReportDate).getTime() - new Date(b.latestReportDate).getTime()
    }
  })

  // Sort Individual Reports if in Individual mode
  const sortedIndividualReports = [...filteredReports].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Overall Statistics
  const totalReportsCount = reports.length
  const pendingCount = reports.filter(r => r.status === 'pending' || r.status === 'under_review').length
  const resolvedCount = reports.filter(r => r.status === 'resolved').length
  const bannedCount = bannedUserIds.length

  if (loading) {
    return <LoadingScreen message="Loading Admin Moderation Panel..." />
  }

  // 🔒 RESTRICTED ADMIN LOCK SCREEN
  if (!isAdmin) {
    return (
      <div className="admin-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <div style={{ background: '#130c24', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '24px', padding: '36px 32px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            🔒
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'white', margin: '0 0 8px 0' }}>
            Restricted Admin Portal
          </h2>

          <p style={{ fontSize: '13.5px', color: '#9d91b8', lineHeight: 1.5, margin: '0 0 24px 0' }}>
            This page is restricted to platform administrators. Enter your secret admin passcode to unlock the Safety Hub.
          </p>

          <form onSubmit={handleUnlockAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="password"
              placeholder="Enter Secret Key (e.g. unimatch2026)"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              style={{ background: 'rgba(255, 255, 255, 0.06)', border: passcodeError ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px', outline: 'none', textAlign: 'center' }}
            />

            {passcodeError && (
              <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>{passcodeError}</span>
            )}

            <button
              type="submit"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 15px rgba(225, 29, 72, 0.4)' }}
            >
              Unlock Moderation Hub 🔓
            </button>
          </form>

          <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Link href="/dashboard" style={{ color: '#8b7fa8', fontSize: '13px', textDecoration: 'none' }}>
              ← Return to UniMatch App
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 🔓 UNLOCKED ADMIN PANEL
  return (
    <div className="admin-page">
      {/* Top Admin Navbar */}
      <header className="admin-header">
        <div className="admin-header-container">
          <div className="admin-title-wrap">
            <span className="admin-badge">Admin Dashboard</span>
            <h1 className="admin-title">Safety & Moderation Hub</h1>
          </div>

          <Link href="/chat" className="btn-back-app">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to App
          </Link>
        </div>
      </header>

      <main className="admin-body">
        {/* Statistics Cards Grid */}
        <div className="admin-stats-grid">
          <div className="stat-card">
            <div className="stat-icon total">📋</div>
            <div className="stat-info">
              <span className="stat-value">{totalReportsCount}</span>
              <span className="stat-label">Total Reports Filed</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon pending">⏳</div>
            <div className="stat-info">
              <span className="stat-value">{pendingCount}</span>
              <span className="stat-label">Pending Review</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon resolved">✅</div>
            <div className="stat-info">
              <span className="stat-value">{resolvedCount}</span>
              <span className="stat-label">Cases Resolved</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon banned">🚫</div>
            <div className="stat-info">
              <span className="stat-value">{bannedCount}</span>
              <span className="stat-label">Banned Users</span>
            </div>
          </div>
        </div>

        {/* Organized Controls & Filter Bar */}
        <div className="admin-controls-bar">
          {/* Top Control Row: View Mode & Status Tabs */}
          <div className="controls-row-top">
            <div className="view-mode-toggle">
              <button
                className={`view-mode-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                onClick={() => setViewMode('grouped')}
                title="Group multiple reports by target user"
              >
                🎯 Group by Target User ({groupedTargetsList.length})
              </button>
              <button
                className={`view-mode-btn ${viewMode === 'individual' ? 'active' : ''}`}
                onClick={() => setViewMode('individual')}
                title="View single reports list"
              >
                📄 Individual Queue ({filteredReports.length})
              </button>
            </div>

            <div className="admin-tabs">
              <button className={`admin-tab ${activeStatusTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveStatusTab('pending')}>
                ⏳ Pending ({reports.filter(r => r.status === 'pending').length})
              </button>
              <button className={`admin-tab ${activeStatusTab === 'under_review' ? 'active' : ''}`} onClick={() => setActiveStatusTab('under_review')}>
                🔍 Under Review ({reports.filter(r => r.status === 'under_review').length})
              </button>
              <button className={`admin-tab ${activeStatusTab === 'resolved' ? 'active' : ''}`} onClick={() => setActiveStatusTab('resolved')}>
                ✅ Resolved ({reports.filter(r => r.status === 'resolved').length})
              </button>
              <button className={`admin-tab ${activeStatusTab === 'dismissed' ? 'active' : ''}`} onClick={() => setActiveStatusTab('dismissed')}>
                ❌ Dismissed ({reports.filter(r => r.status === 'dismissed').length})
              </button>
              <button className={`admin-tab ${activeStatusTab === 'all' ? 'active' : ''}`} onClick={() => setActiveStatusTab('all')}>
                All ({reports.length})
              </button>
            </div>
          </div>

          {/* Bottom Control Row: Category Filters, Sorting, Search */}
          <div className="controls-row-bottom">
            <div className="filter-selects-wrap">
              <select
                className="admin-select"
                value={reasonFilter}
                onChange={e => setReasonFilter(e.target.value)}
              >
                <option value="all">All Violation Types</option>
                <option value="Harassment">Harassment / Bullying</option>
                <option value="Fake Profile">Fake Profile / Impersonation</option>
                <option value="Inappropriate Content">Inappropriate Content</option>
                <option value="Spam">Spam / Commercial</option>
                <option value="Other">Other</option>
              </select>

              <select
                className="admin-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
              >
                <option value="risk">🔥 Highest Risk (Most Reported First)</option>
                <option value="newest">⚡ Newest First</option>
                <option value="oldest">🕒 Oldest First</option>
              </select>
            </div>

            <div className="admin-search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7b6f93" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search user name or details..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ═══ VIEW MODE 1: GROUPED BY TARGET USER ═══ */}
        {viewMode === 'grouped' ? (
          groupedTargetsList.length > 0 ? (
            <div className="grouped-targets-grid">
              {groupedTargetsList.map(group => {
                const targetName = group.targetProfile?.name || 'Unknown User'
                const targetPhoto = group.targetProfile?.photo_url || DEFAULT_AVATAR
                const isHighThreat = group.reports.length >= 2 || group.pendingCount >= 2

                return (
                  <div key={group.targetId} className={`target-group-card ${isHighThreat ? 'high-threat' : ''}`}>
                    {/* Header Row */}
                    <div className="target-header-row">
                      <div className="target-profile-box">
                        <img src={targetPhoto} alt={targetName} className="target-avatar-lg" />
                        <div className="target-profile-info">
                          <h3>
                            {targetName} {group.targetProfile?.age ? `, ${group.targetProfile.age}` : ''}
                            {group.isBanned && <span className="banned-pill">BANNED</span>}
                          </h3>
                          <p>{[group.targetProfile?.course, group.targetProfile?.campus].filter(Boolean).join(' • ') || 'UniMatch Student'} • ✉️ {group.targetProfile?.email || 'N/A'}</p>

                          <div className="target-reasons-wrap">
                            {Object.entries(group.reasonsMap).map(([reason, count]) => (
                              <span key={reason} className="reason-count-pill">
                                ⚠️ {reason} ({count})
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <span className={`threat-pill ${group.isBanned ? 'banned' : ''}`}>
                          {group.isBanned ? '🚫 Account Suspended' : `🚨 ${group.reports.length} Report(s) Received`}
                        </span>
                        <span style={{ fontSize: '11.5px', color: '#8b7fa8' }}>
                          Latest: {new Date(group.latestReportDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Timeline of Individual Reports against this Target */}
                    <div className="target-reports-sublist">
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#a79bbd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Filed Reports History ({group.reports.length})
                      </div>

                      {group.reports.map(subReport => (
                        <div key={subReport.id} className="subreport-item">
                          <div className="subreport-reporter-info">
                            <img src={subReport.reporter?.photo_url || DEFAULT_AVATAR} className="subreport-avatar" />
                            <div>
                              <div className="subreport-name">
                                Reported by <b>{subReport.reporter?.name || 'Anonymous'}</b>
                              </div>
                              <div className="subreport-text">
                                Reason: <b>{subReport.reason}</b> {subReport.details ? `— "${subReport.details}"` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className={`status-badge ${subReport.status}`}>
                              {subReport.status.replace('_', ' ')}
                            </span>
                            <button
                              className="btn-inspect"
                              style={{ padding: '6px 12px', fontSize: '11.5px' }}
                              onClick={() => handleInspectReport(subReport)}
                            >
                              Inspect Chat & Evidence 🔍
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Target Quick Actions Footer */}
                    <div className="target-card-footer">
                      <span style={{ fontSize: '12px', color: '#948aa9' }}>
                        Action will resolve all {group.reports.length} pending report(s) against this user.
                      </span>

                      {!group.isBanned && (
                        <button
                          className="btn-ban-quick"
                          onClick={() => handleBanTargetUser(group.targetId, targetName)}
                        >
                          🚫 Ban {targetName} (Resolve All Reports)
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>🎉</span>
              <h3 style={{ color: 'white', margin: '0 0 6px 0' }}>No target user reports found</h3>
              <p style={{ color: '#8b7fa8', fontSize: '13.5px', margin: 0 }}>
                {searchQuery || reasonFilter !== 'all' ? 'Try adjusting your search or category filters.' : 'All user reports in this section have been resolved.'}
              </p>
            </div>
          )
        ) : (
          /* ═══ VIEW MODE 2: INDIVIDUAL REPORTS QUEUE ═══ */
          sortedIndividualReports.length > 0 ? (
            <div className="reports-grid">
              {sortedIndividualReports.map(report => {
                const reasonClass = report.reason.toLowerCase().includes('harass') ? 'harassment'
                  : report.reason.toLowerCase().includes('fake') ? 'fake'
                  : report.reason.toLowerCase().includes('inappropriate') ? 'inappropriate'
                  : report.reason.toLowerCase().includes('spam') ? 'spam' : 'other'

                const isReportedBanned = bannedUserIds.includes(report.reported_id)

                return (
                  <div key={report.id} className="report-card">
                    <div className="report-card-top">
                      <span className={`reason-badge ${reasonClass}`}>{report.reason}</span>
                      <span className={`status-badge ${report.status}`}>{report.status.replace('_', ' ')}</span>
                    </div>

                    <div className="report-parties">
                      {/* Reporter */}
                      <div className="party-box">
                        <img src={report.reporter?.photo_url || DEFAULT_AVATAR} alt={report.reporter?.name} className="party-avatar" />
                        <div className="party-details">
                          <span className="party-role-label">Reporter</span>
                          <span className="party-name">{report.reporter?.name || 'Unknown User'}</span>
                        </div>
                      </div>

                      <span className="arrow-divider">➔</span>

                      {/* Reported User */}
                      <div className="party-box" style={{ justifyContent: 'flex-end', textAlign: 'right' }}>
                        <div className="party-details">
                          <span className="party-role-label" style={{ color: '#ef4444' }}>
                            Reported {isReportedBanned && '(BANNED)'}
                          </span>
                          <span className="party-name">{report.reported?.name || 'Unknown User'}</span>
                        </div>
                        <img src={report.reported?.photo_url || DEFAULT_AVATAR} alt={report.reported?.name} className="party-avatar" />
                      </div>
                    </div>

                    {report.details && (
                      <div className="report-details-box">
                        "{report.details}"
                      </div>
                    )}

                    <div className="report-card-footer">
                      <span className="report-time">
                        📅 {new Date(report.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button className="btn-inspect" onClick={() => handleInspectReport(report)}>
                        Inspect Evidence 🔍
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>🎉</span>
              <h3 style={{ color: 'white', margin: '0 0 6px 0' }}>No reports found</h3>
              <p style={{ color: '#8b7fa8', fontSize: '13.5px', margin: 0 }}>
                {searchQuery || reasonFilter !== 'all' ? 'Try adjusting your search or category filters.' : 'All user reports in this section have been resolved.'}
              </p>
            </div>
          )
        )}
      </main>

      {/* Evidence Inspector Drawer / Modal */}
      {selectedReport && (
        <div className="inspector-overlay" onClick={() => setSelectedReport(null)}>
          <div className="inspector-card" onClick={e => e.stopPropagation()}>
            <div className="inspector-header">
              <div>
                <h3>Report Evidence Inspector</h3>
                <span style={{ fontSize: '12px', color: '#9d91b8' }}>Case ID: #{selectedReport.id.slice(0, 8)}</span>
              </div>
              <button className="btn-close-inspector" onClick={() => setSelectedReport(null)}>✕</button>
            </div>

            <div className="inspector-body">
              {/* Profile Comparison Cards */}
              <div className="profiles-comparison-grid">
                {/* Reporter Profile */}
                <div className="profile-card-mini">
                  <img src={selectedReport.reporter?.photo_url || DEFAULT_AVATAR} className="mini-avatar" />
                  <div className="mini-info">
                    <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase' }}>Reporter Profile</span>
                    <h4>{selectedReport.reporter?.name} {selectedReport.reporter?.age ? `, ${selectedReport.reporter?.age}` : ''}</h4>
                    <p>{[selectedReport.reporter?.course, selectedReport.reporter?.campus].filter(Boolean).join(' • ') || 'Student'}</p>
                    <p style={{ fontSize: '11px', color: '#7b6f93' }}>✉️ {selectedReport.reporter?.email}</p>
                  </div>
                </div>

                {/* Reported User Profile */}
                <div className="profile-card-mini reported">
                  <img src={selectedReport.reported?.photo_url || DEFAULT_AVATAR} className="mini-avatar" />
                  <div className="mini-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 800, textTransform: 'uppercase' }}>Target Profile</span>
                      {bannedUserIds.includes(selectedReport.reported_id) && (
                        <span className="banned-pill">BANNED</span>
                      )}
                    </div>
                    <h4>{selectedReport.reported?.name} {selectedReport.reported?.age ? `, ${selectedReport.reported?.age}` : ''}</h4>
                    <p>{[selectedReport.reported?.course, selectedReport.reported?.campus].filter(Boolean).join(' • ') || 'Student'}</p>
                    <p style={{ fontSize: '11px', color: '#7b6f93' }}>✉️ {selectedReport.reported?.email}</p>
                  </div>
                </div>
              </div>

              {/* Report Statement */}
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '16px', borderRadius: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#f87171', textTransform: 'uppercase' }}>
                    Reason: {selectedReport.reason}
                  </span>
                  <span style={{ fontSize: '12px', color: '#948aa9' }}>
                    Filed: {new Date(selectedReport.created_at).toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#f3e8ff', lineHeight: 1.5 }}>
                  {selectedReport.details ? `"${selectedReport.details}"` : 'No additional text details provided.'}
                </p>
              </div>

              {/* Chat Log Transcript Section */}
              <div className="chat-transcript-section">
                <div className="transcript-header">
                  💬 Chat Evidence Transcript ({chatLogs.length} messages)
                </div>

                {chatLogsLoading ? (
                  <p style={{ color: '#8b7fa8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                    Loading conversation transcript...
                  </p>
                ) : chatLogs.length > 0 ? (
                  <div className="transcript-logs">
                    {chatLogs.map(m => {
                      const isReporterSender = m.sender_id === selectedReport.reporter_id
                      const senderName = isReporterSender ? selectedReport.reporter?.name : selectedReport.reported?.name
                      const isDeleted = Boolean(m.is_deleted)

                      return (
                        <div key={m.id} className={`transcript-row ${isReporterSender ? 'reporter' : 'reported'}`}>
                          <span className="transcript-sender-name">{senderName}</span>
                          <div className={`transcript-bubble ${isDeleted ? 'is-deleted' : ''}`}>
                            {isDeleted && (
                              <div className="deleted-message-badge">
                                🗑️ DELETED BY USER
                              </div>
                            )}

                            <div style={{ wordBreak: 'break-word' }}>
                              {m.image_url ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <span style={{ fontSize: '11.5px', opacity: 0.85, fontWeight: 600 }}>📷 Photo Attachment</span>
                                  <img src={m.image_url} alt="Photo attachment" style={{ maxWidth: '220px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }} />
                                </div>
                              ) : m.audio_url ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <span style={{ fontSize: '11.5px', opacity: 0.85, fontWeight: 600 }}>🎤 Voice Note</span>
                                  <audio controls src={m.audio_url} style={{ maxWidth: '240px', height: '34px' }} />
                                </div>
                              ) : (
                                <span>{m.content || m.text || <i>[Empty Message Body]</i>}</span>
                              )}
                            </div>

                            <div style={{ fontSize: '10px', color: isDeleted ? '#fca5a5' : '#a79bbd', textAlign: 'right', marginTop: '4px', opacity: 0.85 }}>
                              {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#8b7fa8', fontSize: '13px', textAlign: 'center', padding: '20px', margin: 0 }}>
                    No recorded chat messages between these two users.
                  </p>
                )}
              </div>
            </div>

            {/* Moderation Actions Footer */}
            <div className="inspector-footer">
              <button
                className="btn-action-dismiss"
                onClick={() => handleUpdateStatus('dismissed')}
              >
                ❌ Dismiss (False Report)
              </button>

              <div className="inspector-actions">
                <button
                  className="btn-action-resolve"
                  onClick={() => handleUpdateStatus('resolved')}
                >
                  ✅ Mark Resolved
                </button>

                <button
                  className="btn-action-ban"
                  disabled={bannedUserIds.includes(selectedReport.reported_id)}
                  onClick={() => handleBanTargetUser(selectedReport.reported_id, selectedReport.reported?.name || 'User')}
                >
                  {bannedUserIds.includes(selectedReport.reported_id) ? 'User Already Banned' : '🚫 Ban Reported User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading safety hub..." />}>
      <AdminReportsContent />
    </Suspense>
  )
}
