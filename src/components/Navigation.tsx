'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ListTodo, Utensils, Dumbbell } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

const NAV_ITEMS = [
  { href: '/home', label: 'Home', Icon: Home },
  { href: '/gestor', label: 'Gestor', Icon: ListTodo },
  { href: '/alimentacion', label: 'Alimentos', Icon: Utensils },
  { href: '/entreno', label: 'Entreno', Icon: Dumbbell },
]

export default function Navigation() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  if (!user) return null

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0"
        style={{ background: '#0a0a0a', borderRight: '1px solid #2a2a2a' }}
      >
        {/* Logo */}
        <div className="px-6 py-8 border-b" style={{ borderColor: '#2a2a2a' }}>
          <span className="label-caps block mb-1">Sistema</span>
          <div className="font-black text-2xl leading-none" style={{ color: '#ffffff' }}>
            DÍA A DÍA
          </div>
          <div className="w-6 h-0.5 mt-2" style={{ background: '#FF2D00' }} />
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-3 font-semibold text-sm transition-colors"
                style={{
                  color: active ? '#ffffff' : '#555555',
                  background: active ? '#1a1a1a' : 'transparent',
                  borderLeft: active ? '2px solid #FF2D00' : '2px solid transparent',
                }}
              >
                <Icon size={16} style={{ color: active ? '#FF2D00' : '#555555' }} />
                <span className="tracking-wide uppercase text-xs">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t" style={{ borderColor: '#2a2a2a' }}>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-3 w-full text-xs font-semibold tracking-widest uppercase transition-colors"
            style={{ color: '#555555' }}
          >
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ───────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex pb-safe"
        style={{ background: '#0a0a0a', borderTop: '1px solid #2a2a2a' }}
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 py-3 gap-1 transition-colors"
              style={{ color: active ? '#FF2D00' : '#555555' }}
            >
              <Icon size={20} />
              <span className="text-[9px] font-bold tracking-widest uppercase">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
