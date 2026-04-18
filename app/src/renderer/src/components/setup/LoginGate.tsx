// LoginGate: shown when no Auth0 session exists.
// Renders a single Sign In button; listens for the session-changed event
// and calls onAuthenticated once a valid session arrives.

import { useState, useEffect, useCallback } from 'react'

interface LoginGateProps {
  readonly onAuthenticated: () => void
}

export default function LoginGate({ onAuthenticated }: LoginGateProps): React.JSX.Element {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Listen for the async session-changed broadcast from the main process
  useEffect(() => {
    const removeListener = window.psygil.auth.onSessionChanged((data) => {
      if (data.authenticated) {
        onAuthenticated()
      }
    })
    return removeListener
  }, [onAuthenticated])

  const handleSignIn = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await window.psygil.auth.login()
      // Browser opened; session arrives via onSessionChanged
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed. Please try again.'
      setError(msg)
      setLoading(false)
    }
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '16px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Psygil</h1>
      <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
        Sign in to continue
      </p>

      {error !== null && (
        <p role="alert" style={{ color: 'var(--danger)', fontSize: '0.875rem', margin: 0 }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSignIn}
        disabled={loading}
        style={{
          padding: '10px 28px',
          fontSize: '1rem',
          fontWeight: 500,
          borderRadius: '6px',
          border: 'none',
          background: loading ? 'var(--gray-400)' : 'var(--accent)',
          color: '#fff',
          cursor: loading ? 'not-allowed' : 'pointer',
          minWidth: '140px',
        }}
      >
        {loading ? 'Opening browser...' : 'Sign in'}
      </button>
    </div>
  )
}
