'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Navigation from '@/components/Navigation'
import PWABanner from '@/components/PWABanner'

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F5F7' }}>
        <div className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen" style={{ background: '#F5F5F7' }}>
      <Navigation />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Content area with bottom padding for floating mobile nav */}
        <div className="flex-1 pb-28 md:pb-0">
          {children}
        </div>
      </main>

      <PWABanner />
    </div>
  )
}
