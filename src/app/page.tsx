'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function RootPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/home')
      } else {
        router.replace('/auth')
      }
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="w-8 h-8 border-2 border-[#FF2D00] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
