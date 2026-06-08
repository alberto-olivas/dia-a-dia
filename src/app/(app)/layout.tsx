'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ProfileProvider, useProfile } from '@/lib/profile-context'
import Navigation from '@/components/Navigation'
import PWABanner from '@/components/PWABanner'
import Onboarding from '@/components/Onboarding'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <ProfileProvider>
      <AppShell>{children}</AppShell>
    </ProfileProvider>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, loadingProfile } = useProfile()

  return (
    <div className="flex min-h-screen relative" style={{ minWidth: 0 }}>
      {/* Decorative gradient blobs */}
      <div
        aria-hidden
        style={{
          position: 'fixed', top: '-15%', right: '-15%',
          width: '55vw', height: '55vw',
          background: 'radial-gradient(circle, rgba(255,107,53,0.12) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed', bottom: '5%', left: '-15%',
          width: '45vw', height: '45vw',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed', top: '40%', right: '10%',
          width: '30vw', height: '30vw',
          background: 'radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      <Navigation />

      <main className="flex-1 flex flex-col min-h-screen relative md:ml-60" style={{ zIndex: 1, minWidth: 0 }}>
        <div className="flex-1 pb-28 md:pb-0">
          {children}
        </div>
      </main>

      <PWABanner />

      {/* Onboarding overlay — first-time users only */}
      {!loadingProfile && !profile && <Onboarding />}
    </div>
  )
}
