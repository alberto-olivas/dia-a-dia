'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ListTodo, Utensils, Dumbbell, Settings, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

function useDarkMode() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const check = () => setDark(document.documentElement.dataset.theme === 'dark')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

const NAV_ITEMS = [
  { href: '/home',         label: 'Home',      Icon: Home },
  { href: '/gestor',       label: 'Gestor',    Icon: ListTodo },
  { href: '/alimentacion', label: 'Alimentos', Icon: Utensils },
  { href: '/entreno',      label: 'Entreno',   Icon: Dumbbell },
]

const SIDEBAR_GRADIENT =
  'radial-gradient(ellipse at 32% 5%, rgba(120,72,235,0.92) 0%, transparent 40%),' +
  'radial-gradient(ellipse at 90% 10%, rgba(72,122,228,0.78) 0%, transparent 30%),' +
  'radial-gradient(ellipse at 8% 46%, rgba(255,72,20,0.88) 0%, rgba(255,130,40,0.62) 30%, transparent 52%),' +
  'radial-gradient(ellipse at 72% 42%, rgba(42,98,218,0.68) 0%, transparent 36%),' +
  'radial-gradient(ellipse at 42% 62%, rgba(255,165,148,0.45) 0%, transparent 35%),' +
  'radial-gradient(ellipse at 18% 82%, rgba(255,185,25,0.58) 0%, transparent 28%),' +
  'radial-gradient(ellipse at 88% 82%, rgba(0,195,195,0.72) 0%, transparent 30%),' +
  '#7A97BE'

export default function Navigation() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const dark = useDarkMode()

  const sidebarBg = dark
    ? 'linear-gradient(rgba(0,0,0,0.42), rgba(0,0,0,0.42)),' + SIDEBAR_GRADIENT
    : SIDEBAR_GRADIENT

  if (!user) return null

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0"
        style={{ background: sidebarBg }}
      >
        {/* Logo */}
        <div className="px-6 py-8 border-b" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          <span className="label-caps block mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Sistema</span>
          <div className="font-black text-2xl leading-none text-white">DÍA A DÍA</div>
          <div className="w-6 h-1 mt-2 rounded-full" style={{ background: '#FF6B35' }} />
        </div>

        {/* Main nav */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                style={{
                  background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                  color: active ? '#FFFFFF' : 'rgba(255,255,255,0.68)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: active ? '#FF6B35' : 'rgba(255,255,255,0.14)' }}
                >
                  <Icon size={15} style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.75)' }} />
                </div>
                <span className="text-xs font-bold tracking-wide uppercase">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom: Ajustes + Salir */}
        <div className="px-3 py-4 flex flex-col gap-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          {/* Ajustes */}
          {(() => {
            const active = pathname === '/ajustes'
            return (
              <Link
                href="/ajustes"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                style={{
                  background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                  color: active ? '#FFFFFF' : 'rgba(255,255,255,0.68)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: active ? '#FF6B35' : 'rgba(255,255,255,0.14)' }}
                >
                  <Settings size={15} style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.75)' }} />
                </div>
                <span className="text-xs font-bold tracking-wide uppercase">Ajustes</span>
              </Link>
            )
          })()}

          {/* Salir */}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.10)' }}
            >
              <LogOut size={14} style={{ color: 'rgba(255,255,255,0.65)' }} />
            </div>
            <span className="text-xs font-bold tracking-wide uppercase">Salir</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile floating bottom nav ──────────────── */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-50">
        <div
          className="flex px-1 py-2 rounded-2xl overflow-hidden"
          style={{ background: sidebarBg, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
        >
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center flex-1 gap-0.5 py-2 rounded-xl transition-all"
                style={{ background: active ? 'rgba(255,255,255,0.2)' : 'transparent' }}
              >
                <Icon size={16} style={{ color: active ? '#FF6B35' : 'rgba(255,255,255,0.72)' }} />
                <span
                  className="text-[8px] font-bold tracking-wider uppercase"
                  style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.65)' }}
                >
                  {label}
                </span>
              </Link>
            )
          })}
          {/* Ajustes on mobile */}
          {(() => {
            const active = pathname === '/ajustes'
            return (
              <Link
                href="/ajustes"
                className="flex flex-col items-center justify-center flex-1 gap-0.5 py-2 rounded-xl transition-all"
                style={{ background: active ? 'rgba(255,255,255,0.2)' : 'transparent' }}
              >
                <Settings size={16} style={{ color: active ? '#FF6B35' : 'rgba(255,255,255,0.72)' }} />
                <span
                  className="text-[8px] font-bold tracking-wider uppercase"
                  style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.65)' }}
                >
                  Ajustes
                </span>
              </Link>
            )
          })()}
        </div>
      </nav>
    </>
  )
}
