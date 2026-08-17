import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '24px',
      background: '#09080f',
      color: '#ffffff'
    }}>
      <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>404 - Page Not Found</h2>
      <p style={{ color: '#9aa0a6', marginBottom: '24px' }}>The page you are looking for does not exist.</p>
      <Link href="/dashboard" style={{
        padding: '10px 20px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #6c47ff 0%, #ff4b8b 100%)',
        color: '#ffffff',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '14px'
      }}>
        Return to Dashboard
      </Link>
    </div>
  )
}
