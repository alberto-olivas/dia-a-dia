'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { supabase, IS_SUPABASE_CONFIGURED } from '@/lib/supabase'
import type { Task, Workout } from '@/lib/types'
import { WORKOUT_TYPES } from '@/lib/types'
import { ArrowRight, Flame, CheckSquare, Dumbbell } from 'lucide-react'
import { useProfile } from '@/lib/profile-context'

const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function getGreeting(date: Date): string {
  const h = date.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function getWeekDays(today: Date) {
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return {
      key: d.toISOString(),
      label: DAY_NAMES_SHORT[d.getDay()],
      num: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
    }
  })
}

function getUserName(email: string): string {
  const part = email.split('@')[0]
  return part.charAt(0).toUpperCase() + part.slice(1).replace(/[._-]/g, ' ')
}

export default function HomePage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [now, setNow] = useState(new Date())
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [doneTasks, setDoneTasks] = useState<Task[]>([])
  const [calories, setCalories] = useState({ consumed: 0, workout: 0, steps: 0, sleep: 0 })
  const [workout, setWorkout] = useState<Workout | null>(null)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!user) return
    if (!IS_SUPABASE_CONFIGURED) { loadDemoData(); return }
    fetchTodayData()
  }, [user])

  function loadDemoData() {
    try {
      const allTasks = JSON.parse(localStorage.getItem('demo_tasks') ?? '[]') as Task[]
      setPendingTasks(allTasks.filter((t) => {
        if (t.estado === 'terminada') return false
        if (t.cuando === 'hoy') return true
        if (t.cuando === 'fecha' && t.fecha_objetivo === today) return true
        return false
      }))
      setDoneTasks(allTasks.filter((t) => {
        if (t.estado !== 'terminada') return false
        if (t.cuando === 'hoy') return true
        if (t.cuando === 'fecha' && t.fecha_objetivo === today) return true
        return false
      }))
    } catch {}
    try {
      const food = JSON.parse(localStorage.getItem(`demo_food_${today}`) ?? '[]') as Array<{ calorias: number }>
      const w = JSON.parse(localStorage.getItem(`demo_workout_${today}`) ?? 'null')
      const stepsVal = parseInt(localStorage.getItem(`steps_${today}`) ?? '0') || 0
      const sleepVal = parseFloat(localStorage.getItem(`sleep_${today}`) ?? '0') || 0
      setCalories({
        consumed: food.reduce((s, f) => s + f.calorias, 0),
        workout: w?.calorias_quemadas ?? 0,
        steps: Math.round(stepsVal * 0.04),
        sleep: Math.round(sleepVal * 55),
      })
      setWorkout(w)
    } catch {}
  }

  async function fetchTodayData() {
    const [{ data: tasks }, { data: food }, { data: workouts }] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user!.id).in('cuando', ['hoy', 'fecha']),
      supabase.from('food_entries').select('calorias').eq('user_id', user!.id).eq('fecha', today),
      supabase.from('workouts').select('*').eq('user_id', user!.id).eq('fecha', today),
    ])

    const all = tasks ?? []
    setPendingTasks(all.filter((t: Task) => {
      if (t.estado === 'terminada') return false
      if (t.cuando === 'hoy') return true
      if (t.cuando === 'fecha' && t.fecha_objetivo === today) return true
      return false
    }))
    setDoneTasks(all.filter((t: Task) => {
      if (t.estado !== 'terminada') return false
      if (t.cuando === 'hoy') return true
      if (t.cuando === 'fecha' && t.fecha_objetivo === today) return true
      return false
    }))

    const consumed = (food ?? []).reduce((s: number, f: { calorias: number }) => s + f.calorias, 0)
    const stepsVal = parseInt(localStorage.getItem(`steps_${today}`) ?? '0') || 0
    const sleepVal = parseFloat(localStorage.getItem(`sleep_${today}`) ?? '0') || 0
    setCalories({
      consumed,
      workout: workouts?.[0]?.calorias_quemadas ?? 0,
      steps: Math.round(stepsVal * 0.04),
      sleep: Math.round(sleepVal * 55),
    })
    setWorkout(workouts?.[0] ?? null)
  }

  const weekDays = getWeekDays(now)
  const greeting = getGreeting(now)
  const userName = profile?.nombre ?? (user ? getUserName(user.email ?? 'usuario') : 'Usuario')
  const totalTasks = pendingTasks.length + doneTasks.length
  const completionPct = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10 max-w-2xl mx-auto">

      {/* ── Greeting ──────────────────────────────── */}
      <header className="mb-6">
        <p className="text-sm font-semibold text-gray-400 mb-1">{greeting}</p>
        <h1 className="font-black text-3xl text-gray-900 leading-tight">{userName}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {DAY_NAMES_FULL[now.getDay()]}, {now.getDate()} de {MONTH_NAMES[now.getMonth()]}
        </p>
      </header>

      {/* ── Week day selector ────────────────────── */}
      <div className="flex gap-1.5 mb-8 overflow-x-auto pb-1">
        {weekDays.map(({ key, label, num, isToday }) => (
          <div
            key={key}
            className="flex flex-col items-center gap-1 flex-shrink-0 w-11 py-2.5 rounded-2xl"
            style={{
              background: isToday ? '#1A1A1A' : '#FFFFFF',
              boxShadow: isToday ? '0 4px 14px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <span className="text-[9px] font-bold uppercase" style={{ color: isToday ? '#9CA3AF' : '#D1D5DB' }}>
              {label}
            </span>
            <span className="text-sm font-black" style={{ color: isToday ? '#FF6B35' : '#1A1A1A' }}>
              {num}
            </span>
          </div>
        ))}
      </div>

      {/* ── Cards grid ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-4">

        {/* Calorías */}
        {(() => {
          const net = calories.consumed - calories.workout - calories.steps - calories.sleep
          return (
            <Link href="/alimentacion" className="card p-4 block">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#FFF4EF' }}>
                  <Flame size={15} style={{ color: '#FF6B35' }} />
                </div>
                <span className="label-caps">Calorías</span>
              </div>
              <div className="font-black text-2xl text-gray-900 leading-none">
                {net.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400 mt-1">kcal netas</div>
              <div className="mt-2 flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold" style={{ color: '#22C55E' }}>+{calories.consumed.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-400">consumidas</span>
                </div>
                {calories.workout > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold" style={{ color: '#FF6B35' }}>-{calories.workout}</span>
                    <span className="text-[10px] text-gray-400">entreno</span>
                  </div>
                )}
                {calories.steps > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold" style={{ color: '#3B82F6' }}>-{calories.steps}</span>
                    <span className="text-[10px] text-gray-400">pasos</span>
                  </div>
                )}
                {calories.sleep > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold" style={{ color: '#8B5CF6' }}>-{calories.sleep}</span>
                    <span className="text-[10px] text-gray-400">dormir</span>
                  </div>
                )}
              </div>
              <div className="mt-3 h-1 rounded-full bg-gray-100">
                <div
                  className="h-1 rounded-full"
                  style={{ width: `${Math.min(100, (calories.consumed / 2500) * 100)}%`, background: '#FF6B35' }}
                />
              </div>
            </Link>
          )
        })()}

        {/* Tareas */}
        <Link href="/gestor" className="card p-4 block">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#F0FDF4' }}>
              <CheckSquare size={15} style={{ color: '#22C55E' }} />
            </div>
            <span className="label-caps">Tareas</span>
          </div>
          <div className="font-black text-2xl text-gray-900 leading-none">
            {completionPct}%
          </div>
          <div className="text-xs text-gray-400 mt-1">{doneTasks.length}/{totalTasks} completadas</div>
          <div className="mt-3 h-1.5 rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${completionPct}%`, background: '#22C55E' }}
            />
          </div>
        </Link>
      </div>

      {/* ── Workout card ─────────────────────────── */}
      <Link href="/entreno" className="card p-4 flex items-center justify-between mb-4 block">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FFF4EF' }}>
            <Dumbbell size={18} style={{ color: '#FF6B35' }} />
          </div>
          <div>
            <span className="label-caps block">Entreno hoy</span>
            <span className="font-bold text-gray-900 text-sm">
              {workout
                ? (WORKOUT_TYPES[workout.tipo as keyof typeof WORKOUT_TYPES]?.label ?? workout.tipo)
                : 'Sin registrar'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {workout && (
            <div className="text-right">
              <div className="font-black text-xl leading-none" style={{ color: '#FF6B35' }}>
                {workout.calorias_quemadas}
              </div>
              <div className="label-caps">kcal</div>
            </div>
          )}
          <ArrowRight size={16} className="text-gray-200" />
        </div>
      </Link>

      {/* ── Pending tasks preview ────────────────── */}
      {pendingTasks.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="label-caps">Pendientes hoy</span>
            <Link href="/gestor" className="text-xs font-bold flex items-center gap-1" style={{ color: '#FF6B35' }}>
              Ver todas <ArrowRight size={10} />
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {pendingTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#FF6B35' }} />
                <span className="text-sm text-gray-700 font-medium truncate">{task.nombre}</span>
              </div>
            ))}
            {pendingTasks.length > 3 && (
              <p className="text-xs text-gray-400 pl-5">+{pendingTasks.length - 3} más</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
