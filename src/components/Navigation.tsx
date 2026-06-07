'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ListTodo, Utensils, Dumbbell, LogOut } from 'lucide-react'
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
      <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-white border-r border-gray-100">
        <div className="px-6 py-8 border-b border-gray-100">
          <span className="label-caps block mb-1">Sistema</span>
          <div className="font-black text-2xl leading-none text-gray-900">DÍA A DÍA</div>
          <div className="w-6 h-1 mt-2 rounded-full" style={{ background: '#FF6B35' }} />
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                style={{
                  background: active ? '#FFF4EF' : 'transparent',
                  color: active ? '#1A1A1A' : '#9CA3AF',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: active ? '#FF6B35' : '#F5F5F7' }}
                >
                  <Icon size={15} style={{ color: active ? '#FFFFFF' : '#9CA3AF' }} />
                </div>
                <span className="text-xs font-bold tracking-wide uppercase">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50">
              <LogOut size={14} className="text-gray-400" />
            </div>
            <span className="text-xs font-bold tracking-wide uppercase">Salir</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile floating bottom nav ──────────────── */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-50">
        <div
          className="flex px-2 py-2 rounded-2xl"
          style={{ background: '#FFFFFF', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
        >
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center flex-1 gap-0.5 py-2 rounded-xl transition-all"
                style={{ background: active ? '#1A1A1A' : 'transparent' }}
              >
                <Icon size={18} style={{ color: active ? '#FF6B35' : '#9CA3AF' }} />
                <span
                  className="text-[9px] font-bold tracking-wider uppercase"
                  style={{ color: active ? '#FFFFFF' : '#9CA3AF' }}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
