'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, IS_SUPABASE_CONFIGURED } from './supabase'
import { useAuth } from './auth-context'
import type { UserProfile } from './types'

const DEMO_PROFILE_KEY = 'demo_profile'

interface ProfileContextType {
  profile: UserProfile | null
  loadingProfile: boolean
  createProfile: (data: Omit<UserProfile, 'id' | 'user_id'>) => Promise<void>
  updateProfile: (data: Partial<Omit<UserProfile, 'id' | 'user_id'>>) => Promise<void>
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loadingProfile: true,
  createProfile: async () => {},
  updateProfile: async () => {},
})

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    if (!user) { setLoadingProfile(false); return }
    if (!IS_SUPABASE_CONFIGURED) {
      try {
        const saved = JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY) ?? 'null')
        if (saved) setProfile(saved)
      } catch {}
      setLoadingProfile(false)
      return
    }
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data as UserProfile)
      setLoadingProfile(false)
    })
  }, [user])

  async function createProfile(data: Omit<UserProfile, 'id' | 'user_id'>) {
    if (!user) return
    if (!IS_SUPABASE_CONFIGURED) {
      const p: UserProfile = { id: crypto.randomUUID(), user_id: user.id, ...data }
      setProfile(p)
      localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(p))
      return
    }
    const { data: saved } = await supabase
      .from('profiles').insert({ ...data, user_id: user.id }).select().single()
    if (saved) setProfile(saved as UserProfile)
  }

  async function updateProfile(data: Partial<Omit<UserProfile, 'id' | 'user_id'>>) {
    if (!user || !profile) return
    const updated = { ...profile, ...data }
    setProfile(updated)
    if (!IS_SUPABASE_CONFIGURED) {
      localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(updated))
      return
    }
    await supabase.from('profiles').update(data).eq('user_id', user.id)
  }

  return (
    <ProfileContext.Provider value={{ profile, loadingProfile, createProfile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => useContext(ProfileContext)
