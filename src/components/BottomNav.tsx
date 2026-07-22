'use client'

import Link from 'next/link'

interface BottomNavProps {
  activeTab?: 'home' | 'discover' | 'matches' | 'chat' | 'profile' | string
  matchesBadge?: number
  unreadBadge?: number
}

export default function BottomNav({ activeTab, matchesBadge, unreadBadge }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      <Link href="/dashboard" className={`bn-item ${activeTab === 'home' ? 'active' : ''}`} id="bn-home">
        <div className="bn-indicator"></div>
        <svg className="bn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span className="bn-label">Home</span>
      </Link>

      <Link href="/discover" className={`bn-item ${activeTab === 'discover' ? 'active' : ''}`} id="bn-discover">
        <div className="bn-indicator"></div>
        <svg className="bn-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.66 11.2c-.23-.3-.51-.56-.77-.82-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32-2.86 2.32-3.94 6.1-2.83 9.62.13.45.11.93-.15 1.3-.25.36-.62.5-.98.56-.37.06-.75-.04-1.03-.27-.48-.39-.59-1.02-.36-1.52.23-.52.22-1.1-.01-1.6-.33-.75-1.07-1.26-1.87-1.19-.52.04-1 .33-1.27.78-.28.46-.3 1.01-.06 1.49.38.74 1.12 1.23 1.86 1.44.37.1.76.14 1.14.11.9-.06 1.74-.46 2.31-1.13.48-.57.72-1.32.67-2.07C8.83 11.26 10.67 13 11.5 15c.64 1.56.83 3.3.49 5 1.07-.96 1.75-2.18 2-3.5.22-1.15.05-2.34-.32-3.45-.37-1.11-.93-2.16-1.01-3.35 1.28 1.13 2.23 2.64 2.5 4.34.37 2.32-.12 4.55-1.5 6.46.62-.03 1.24-.22 1.8-.54 1.68-.97 2.64-2.84 2.64-4.73 0-2.09-1.28-4.33-2.95-5.83-.3-.27-.64-.49-.99-.7z"/>
        </svg>
        <span className="bn-label">Discover</span>
      </Link>

      <Link href="/matches" className={`bn-item ${activeTab === 'matches' ? 'active' : ''}`} id="bn-matches">
        <div className="bn-indicator"></div>
        <svg className="bn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span className="bn-label">Matches</span>
        {matchesBadge && matchesBadge > 0 ? <span className="bn-badge">{matchesBadge}</span> : null}
      </Link>

      <Link href="/chat" className={`bn-item ${activeTab === 'chat' ? 'active' : ''}`} id="bn-chat">
        <div className="bn-indicator"></div>
        <svg className="bn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="bn-label">Chat</span>
        {unreadBadge && unreadBadge > 0 ? <span className="bn-badge">{unreadBadge}</span> : null}
      </Link>

      <Link href="/profile?edit=true" className={`bn-item ${activeTab === 'profile' ? 'active' : ''}`} id="bn-profile">
        <div className="bn-indicator"></div>
        <svg className="bn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span className="bn-label">Profile</span>
      </Link>
    </nav>
  )
}
