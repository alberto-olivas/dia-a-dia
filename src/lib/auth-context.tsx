'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Si Supabase no está configurado (credenciales placeholder), usamos un
// usuario demo para poder navegar la app sin necesidad de login.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const IS_CONFIGURED = SUPABASE_URL.length > 0 &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_URL.includes('placeholder')

const DEMO_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@dia-a-dia.app',
  role: 'authenticated',
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(IS_CONFIGURED ? null : DEMO_USER)
  const [loading, setLoading] = useState(IS_CONFIGURED)

  useEffect(() => {
    if (!IS_CONFIGURED) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    if (!IS_CONFIGURED) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
