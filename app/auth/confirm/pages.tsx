'use client'
import { useEffect } from 'react'

// This page handles the magic link callback.
// Supabase sends the operator here with tokens in the URL hash fragment.
// We read them client-side and redirect to /dashboard.
export default function AuthConfirm() {
  useEffect(() => {
    // Small delay to ensure hash is available
    const handle = () => {
      const hash = window.location.hash
      // If Supabase sent an access_token, redirect to dashboard
      if (hash && (hash.includes('access_token') || hash.includes('type=magiclink') || hash.includes('type=recovery'))) {
        // Store any needed info then go to dashboard
        window.location.replace('/dashboard')
        return
      }
      // If there's an error in the hash
      if (hash && hash.includes('error')) {
        window.location.replace('/landing?auth=error')
        return
      }
      // No hash -- just go to dashboard (already authenticated)
      window.location.replace('/dashboard')
    }

    // Run immediately and after a short delay as fallback
    handle()
  }, [])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#06060E', flexDirection: 'column', gap: 16
    }}>
      <div style={{
        width: 36, height: 36,
        border: '2px solid rgba(168,85,247,0.2)',
        borderTopColor: '#A855F7',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }}/>
      <div style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#A78BFA' }}>
        Signing you in...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
