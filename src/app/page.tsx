'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark)
    
    setIsDark(shouldBeDark)
    if (shouldBeDark) {
      document.documentElement.classList.add('dark-theme')
    } else {
      document.documentElement.classList.remove('dark-theme')
    }
  }, [])

  const toggleTheme = () => {
    const nextDarkState = !isDark
    setIsDark(nextDarkState)
    localStorage.setItem('theme', nextDarkState ? 'dark' : 'light')
    
    if (nextDarkState) {
      document.documentElement.classList.add('dark-theme')
    } else {
      document.documentElement.classList.remove('dark-theme')
    }
  }

  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        mobileMenuRef.current && !mobileMenuRef.current.contains(target) &&
        mobileTriggerRef.current && !mobileTriggerRef.current.contains(target)
      ) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [mobileMenuOpen])

  // Sun icon (show when dark, clicking switches to light)
  const SunIcon = () => (
    <svg className="moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )

  // Moon icon (show when light, clicking switches to dark)
  const MoonIcon = () => (
    <svg className="sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )

  const ThemeIcon = () => isDark ? <SunIcon /> : <MoonIcon />

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="navbar" id="navbar" ref={navRef}>
        <div className="nav-container">
          <Link href="#" className="logo">
            <img src="/favicon.svg" alt="UniMatch" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} />
            <span className="logo-text">UniMatch</span>
          </Link>

          <ul className="nav-links" id="navLinks">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#testimonials">Stories</a></li>
          </ul>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={toggleTheme} className="theme-toggle-btn" aria-label="Toggle theme">
              <ThemeIcon />
            </button>

            <div className="nav-buttons">
              <Link href="/login" className="btn-login">Log In</Link>
              <Link href="/signup" className="btn-signup">Join Free</Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            ref={mobileTriggerRef}
            className="mobile-menu-btn"
            id="mobileMenuBtn"
            aria-label="Toggle menu"
            onClick={() => setMobileMenuOpen(prev => !prev)}
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Nav Dropdown */}
        <div ref={mobileMenuRef} className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`} id="mobileNav">
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
          <a href="#testimonials" onClick={() => setMobileMenuOpen(false)}>Stories</a>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>Theme</span>
            <button onClick={toggleTheme} className="theme-toggle-btn" aria-label="Toggle theme">
              <ThemeIcon />
            </button>
          </div>

          <div className="mobile-nav-buttons">
            <Link href="/login" className="btn-login" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
            <Link href="/signup" className="btn-signup" onClick={() => setMobileMenuOpen(false)}>Join Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>

        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              <span>Kabarak University Exclusive</span>
            </div>
            <h1 className="hero-title">
              Your Vibe.<br />
              <span className="gradient-text">Your Campus.</span><br />
              <span className="hero-title-accent">Your Match.</span>
            </h1>
            <p className="hero-subtitle">
              Swipe, match, and connect with real students on your campus.
              Whether it&apos;s love, friendship, or study buddies — it starts here.
            </p>
            <div className="hero-buttons">
              <Link href="/signup" className="btn-primary" id="ctaHero">
                <span>Start Matching</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3.333l6.667 6.667-6.667 6.667M16.667 10H3.333" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#how-it-works" className="btn-secondary" id="ctaLearn">
                <span>See How It Works</span>
              </a>
            </div>

            {/* Trust Row */}
            <div className="trust-row">
              <div className="trust-avatars">
                <div className="trust-avatar ta-1"></div>
                <div className="trust-avatar ta-2"></div>
                <div className="trust-avatar ta-3"></div>
                <div className="trust-avatar ta-4"></div>
              </div>
              <div className="trust-info">
                <div className="trust-stars">★★★★★</div>
                <p>Loved by <strong>2,000+</strong> students</p>
              </div>
            </div>
          </div>

          {/* Hero Cards */}
          <div className="hero-cards">
            {/* Boy card — back */}
            <div className="profile-card card-back">
              <img src="/imajes/hero-boy.png" alt="Brian, 21" className="card-photo" />
              <div className="card-overlay">
                <div className="card-name">Brian, 21</div>
                <div className="card-detail">📍 Main Campus</div>
                <div className="card-tags">
                  <span className="card-tag">Music 🎵</span>
                  <span className="card-tag">Sports ⚽</span>
                </div>
              </div>
              <div className="card-action card-action-like">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" fill="currentColor" />
                </svg>
              </div>
            </div>

            {/* Girl card — front */}
            <div className="profile-card card-front">
              <img src="/imajes/hero-girl.png" alt="Amara, 20" className="card-photo" />
              <div className="card-overlay">
                <div className="card-name">Amara, 20</div>
                <div className="card-detail">📍 Main Campus</div>
                <div className="card-tags">
                  <span className="card-tag">Dancing 💃</span>
                  <span className="card-tag">Coffee ☕</span>
                </div>
              </div>
              <div className="card-action card-action-like">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" fill="currentColor" />
                </svg>
              </div>
              {/* Match Notification Bubble */}
              <div className="match-bubble">
                <span>It&apos;s a Match! 🎉</span>
              </div>
            </div>

            {/* Floating Emojis */}
            <div className="floating-emoji fe-1">💘</div>
            <div className="floating-emoji fe-2">✨</div>
            <div className="floating-emoji fe-3">🔥</div>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="stats-strip">
          <div className="stat-item" id="statStudents">
            <h3>2,000+</h3>
            <p>Active Students</p>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item" id="statMatches">
            <h3>5,000+</h3>
            <p>Matches Made</p>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item" id="statMessages">
            <h3>50K+</h3>
            <p>Messages Sent</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Why UniMatch?</span>
            <h2 className="section-title">Built for <span className="gradient-text-inline">Real Campus Life</span></h2>
            <p className="section-subtitle">Not just another dating app. UniMatch is designed exclusively for university students.</p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card" id="featureVerified">
              <div className="feature-icon fi-violet">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <h3>Campus Verified</h3>
              <p>Only real students with verified <strong>@kabarak.ac.ke</strong> emails. No catfish, no fakes — just real people on your campus.</p>
            </div>

            <div className="feature-card" id="featureMatching">
              <div className="feature-icon fi-rose">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Vibe Matching</h3>
              <p>Our algorithm matches you based on shared interests, course, and campus vibes — not just looks.</p>
            </div>

            <div className="feature-card" id="featurePrivacy">
              <div className="feature-icon fi-teal">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3>Safe &amp; Private</h3>
              <p>Your profile is only visible to fellow verified students. You control who sees you and who can message you.</p>
            </div>

            <div className="feature-card" id="featureChat">
              <div className="feature-icon fi-amber">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M8 10h.01M12 10h.01M16 10h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3>Instant Chat</h3>
              <p>Match and start chatting in seconds. Share photos, send emojis, and plan that first campus date 💬</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Getting Started</span>
            <h2 className="section-title">Three Steps to Your <span className="gradient-text-inline">First Match</span></h2>
            <p className="section-subtitle">It takes less than 2 minutes to set up. Seriously.</p>
          </div>
          
          <div className="steps">
            <div className="step" id="step1">
              <div className="step-visual">
                <div className="step-number">1</div>
                <div className="step-line"></div>
              </div>
              <div className="step-content">
                <span className="step-emoji">📝</span>
                <h3>Create Your Profile</h3>
                <p>Sign up with your university email, upload your best pics, and show off your vibe with interests &amp; a catchy bio.</p>
              </div>
            </div>

            <div className="step" id="step2">
              <div className="step-visual">
                <div className="step-number">2</div>
                <div className="step-line"></div>
              </div>
              <div className="step-content">
                <span className="step-emoji">💘</span>
                <h3>Swipe &amp; Discover</h3>
                <p>Browse profiles of students on your campus. Like the ones who catch your eye — if they like you back, it&apos;s a match!</p>
              </div>
            </div>

            <div className="step" id="step3">
              <div className="step-visual">
                <div className="step-number">3</div>
              </div>
              <div className="step-content">
                <span className="step-emoji">💬</span>
                <h3>Chat &amp; Connect</h3>
                <p>Break the ice, plan a coffee date at the cafeteria, or just vibe. Your next connection is one swipe away.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="testimonials">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Love Stories</span>
            <h2 className="section-title">Students Are <span className="gradient-text-inline">Connecting</span></h2>
            <p className="section-subtitle">Real stories from real students on campus</p>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card" id="testimonial1">
              <div className="testimonial-stars">★★★★★</div>
              <p className="testimonial-text">&ldquo;I matched with someone from my faculty and we&apos;ve been inseparable since. UniMatch actually works because everyone is real and verified!&rdquo;</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar ta-pink">K</div>
                <div>
                  <div className="testimonial-name">Karen M.</div>
                  <div className="testimonial-role">3rd Year, Business</div>
                </div>
              </div>
            </div>

            <div className="testimonial-card testimonial-featured" id="testimonial2">
              <div className="testimonial-stars">★★★★★</div>
              <p className="testimonial-text">&ldquo;Found my study partner turned best friend here. The vibe matching is spot on — it matched me with someone who loves coding and coffee just like me 😂&rdquo;</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar ta-violet">D</div>
                <div>
                  <div className="testimonial-name">Dennis O.</div>
                  <div className="testimonial-role">2nd Year, Computer Science</div>
                </div>
              </div>
            </div>

            <div className="testimonial-card" id="testimonial3">
              <div className="testimonial-stars">★★★★★</div>
              <p className="testimonial-text">&ldquo;The fact that it&apos;s only for Kabarak students makes it feel safe. I actually met my boyfriend here — we&apos;d been in the same campus for 2 years and never talked! 🤭&rdquo;</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar ta-teal">F</div>
                <div>
                  <div className="testimonial-name">Faith W.</div>
                  <div className="testimonial-role">4th Year, Education</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="cta-bg-shapes">
          <div className="cta-shape cs-1"></div>
          <div className="cta-shape cs-2"></div>
        </div>
        <div className="cta-content">
          <h2>Your Campus Crush Could Be<br />One Swipe Away 💘</h2>
          <p>Join 2,000+ Kabarak students already matching. It&apos;s free, it&apos;s safe, it&apos;s exclusively yours.</p>
          <Link href="/signup" className="btn-cta" id="ctaBottom">
            <span>Join UniMatch — It&apos;s Free</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 3.333l6.667 6.667-6.667 6.667M16.667 10H3.333" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="logo">
                <img src="/favicon.svg" alt="UniMatch" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} />
                <span className="logo-text">UniMatch</span>
              </div>
              <p className="footer-tagline">Your vibe. Your campus. Your match.</p>
            </div>
            <div className="footer-links">
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#testimonials">Stories</a>
              <Link href="/login">Login</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 UniMatch. Built with 💖 for Kabarak University students.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
