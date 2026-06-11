'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { supabase, IS_SUPABASE_CONFIGURED } from '@/lib/supabase'
import type { Task, Workout } from '@/lib/types'
import { WORKOUT_TYPES } from '@/lib/types'
import {
  ArrowRight, Flame, CheckSquare, Dumbbell,
  CalendarDays, ChevronLeft, ChevronRight, Pencil,
} from 'lucide-react'
import { useProfile } from '@/lib/profile-context'

const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_FULL  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES     = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MONTH_NAMES_CAP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const CAL_HEADERS     = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

function getGreeting(date: Date): { text: string; emoji: string } {
  const h = date.getHours()
  if (h < 12) return { text: 'Buenos días',   emoji: '☀️' }
  if (h < 20) return { text: 'Buenas tardes', emoji: '🌤️' }
  return          { text: 'Buenas noches',  emoji: '🌙' }
}

function getTodayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
}

function toMadridDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
}

function getMadridTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function getWeekDays(refDateStr: string) {
  const todayStr = getTodayStr()
  const ref = new Date(refDateStr + 'T12:00:00')
  const dow = ref.getDay()
  const monday = new Date(ref)
  monday.setDate(ref.getDate() - ((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = toMadridDate(d)
    return { dateStr, label: DAY_NAMES_SHORT[d.getDay()], num: d.getDate(), isToday: dateStr === todayStr, isFuture: dateStr > todayStr }
  })
}

function getCalendarDays(year: number, month: number) {
  const todayStr = getTodayStr()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7 // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ dateStr: string; inMonth: boolean; isToday: boolean; isFuture: boolean; day: number }> = []
  // leading padding
  for (let i = 0; i < firstDow; i++) {
    const d = new Date(year, month, i - firstDow + 1, 12)
    const dateStr = toMadridDate(d)
    cells.push({ dateStr, inMonth: false, isToday: dateStr === todayStr, isFuture: dateStr > todayStr, day: d.getDate() })
  }
  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toMadridDate(new Date(year, month, d, 12))
    cells.push({ dateStr, inMonth: true, isToday: dateStr === todayStr, isFuture: dateStr > todayStr, day: d })
  }
  // trailing padding to complete last row
  const tail = cells.length % 7
  if (tail > 0) {
    for (let i = 1; i <= 7 - tail; i++) {
      const d = new Date(year, month + 1, i, 12)
      const dateStr = toMadridDate(d)
      cells.push({ dateStr, inMonth: false, isToday: dateStr === todayStr, isFuture: dateStr > todayStr, day: i })
    }
  }
  return cells
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${DAY_NAMES_FULL[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`
}

function getUserName(email: string): string {
  const part = email.split('@')[0]
  return part.charAt(0).toUpperCase() + part.slice(1).replace(/[._-]/g, ' ')
}

export default function HomePage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [now, setNow] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('dia_seleccionado')
      const today = getTodayStr()
      if (stored && stored <= today) return stored
    }
    return getTodayStr()
  })
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [doneTasks, setDoneTasks] = useState<Task[]>([])
  const [calories, setCalories] = useState({ consumed: 0, workout: 0, steps: 0, sleep: 0 })
  const [calorieGoal, setCalorieGoal] = useState(2500)
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calRef = useRef<HTMLDivElement>(null)
  const todayStr = getTodayStr()

  // Calendar month state
  const selD = new Date(selectedDate + 'T12:00:00')
  const [calYear, setCalYear]   = useState(selD.getFullYear())
  const [calMonth, setCalMonth] = useState(selD.getMonth())

  useEffect(() => {
    const load = () => {
      const saved = parseInt(localStorage.getItem('calorie_goal') ?? '') || 2500
      setCalorieGoal(saved)
    }
    load()
    window.addEventListener('storage', load)
    return () => window.removeEventListener('storage', load)
  }, [])

  // Persist selected past date in sessionStorage so alimentos/entreno pages can read it
  // when the user navigates via the bottom nav instead of the cards
  useEffect(() => {
    if (selectedDate !== todayStr) {
      sessionStorage.setItem('dia_seleccionado', selectedDate)
    } else {
      sessionStorage.removeItem('dia_seleccionado')
    }
  }, [selectedDate, todayStr])

  // Clock tick + midnight day-reset
  useEffect(() => {
    const id = setInterval(() => {
      const prevToday = getTodayStr()
      const newNow = new Date()
      const newToday = newNow.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
      setNow(newNow)
      if (newToday !== prevToday) {
        // Midnight crossed in Madrid — auto-advance to new day if user was on today
        setSelectedDate(prev => prev === prevToday ? newToday : prev)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Close calendar on outside click
  useEffect(() => {
    if (!calendarOpen) return
    function onDown(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) {
        setCalendarOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [calendarOpen])

  // Data fetch
  useEffect(() => {
    if (!user) return
    if (!IS_SUPABASE_CONFIGURED) { loadDemoData(selectedDate); return }
    fetchTodayData(selectedDate)
  }, [user, selectedDate])

  function loadDemoData(date: string) {
    const isToday = date === todayStr
    try {
      const allTasks = JSON.parse(localStorage.getItem('demo_tasks') ?? '[]') as Task[]
      if (isToday) {
        setPendingTasks(allTasks.filter((t) => t.estado !== 'terminada'))
        setDoneTasks(allTasks.filter((t) => t.estado === 'terminada'))
      } else {
        setPendingTasks(allTasks.filter((t) => t.cuando === 'fecha' && t.fecha_objetivo === date && t.estado !== 'terminada'))
        setDoneTasks(allTasks.filter((t) => t.cuando === 'fecha' && t.fecha_objetivo === date && t.estado === 'terminada'))
      }
    } catch {}
    try {
      const food = JSON.parse(localStorage.getItem(`demo_food_${date}`) ?? '[]') as Array<{ calorias: number }>
      const w = JSON.parse(localStorage.getItem(`demo_workout_${date}`) ?? 'null')
      const stepsVal = parseInt(localStorage.getItem(`steps_${date}`) ?? '0') || 0
      const sleepVal = parseFloat(localStorage.getItem(`sleep_${date}`) ?? '0') || 0
      setCalories({
        consumed: food.reduce((s, f) => s + f.calorias, 0),
        workout:  w?.calorias_quemadas ?? 0,
        steps:    Math.round(stepsVal * 0.04),
        sleep:    Math.round(sleepVal * 55),
      })
      setWorkout(w)
    } catch {}
  }

  async function fetchTodayData(date: string) {
    const isToday = date === todayStr
    const [{ data: tasks }, { data: food }, { data: workouts }] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user!.id),
      supabase.from('food_entries').select('calorias').eq('user_id', user!.id).eq('fecha', date),
      supabase.from('workouts').select('*').eq('user_id', user!.id).eq('fecha', date),
    ])
    const all = tasks ?? []
    if (isToday) {
      setPendingTasks(all.filter((t: Task) => t.estado !== 'terminada'))
      setDoneTasks(all.filter((t: Task) => t.estado === 'terminada'))
    } else {
      setPendingTasks(all.filter((t: Task) => t.cuando === 'fecha' && t.fecha_objetivo === date && t.estado !== 'terminada'))
      setDoneTasks(all.filter((t: Task) => t.cuando === 'fecha' && t.fecha_objetivo === date && t.estado === 'terminada'))
    }
    const consumed = (food ?? []).reduce((s: number, f: { calorias: number }) => s + f.calorias, 0)
    const stepsVal = parseInt(localStorage.getItem(`steps_${date}`) ?? '0') || 0
    const sleepVal = parseFloat(localStorage.getItem(`sleep_${date}`) ?? '0') || 0
    setCalories({
      consumed,
      workout: workouts?.[0]?.calorias_quemadas ?? 0,
      steps:   Math.round(stepsVal * 0.04),
      sleep:   Math.round(sleepVal * 55),
    })
    setWorkout(workouts?.[0] ?? null)
  }

  function handleDateSelect(date: string) {
    if (!date || date > todayStr) return
    setSelectedDate(date)
    setCalendarOpen(false)
  }

  function openCalendar() {
    const d = new Date(selectedDate + 'T12:00:00')
    setCalYear(d.getFullYear())
    setCalMonth(d.getMonth())
    setCalendarOpen(true)
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    const now2 = new Date()
    if (calYear > now2.getFullYear() || (calYear === now2.getFullYear() && calMonth >= now2.getMonth())) return
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  const weekDays      = getWeekDays(selectedDate)
  const calDays       = getCalendarDays(calYear, calMonth)
  const greeting      = getGreeting(now)
  const userName      = profile?.nombre ?? (user ? getUserName(user.email ?? 'usuario') : 'Usuario')
  const totalTasks    = pendingTasks.length + doneTasks.length
  const completionPct = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0
  const isViewingToday = selectedDate === todayStr
  const nowD = new Date()
  const futureMonth   = calYear > nowD.getFullYear() || (calYear === nowD.getFullYear() && calMonth >= nowD.getMonth())

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10 max-w-2xl mx-auto">

      {/* ── Greeting ──────────────────────────────── */}
      <header className="mb-5">
        <h1 className="font-black text-3xl leading-tight" style={{ color: 'var(--app-color)' }}>
          {greeting.text}, {userName} {greeting.emoji}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {DAY_NAMES_FULL[now.getDay()]}, {now.getDate()} de {MONTH_NAMES[now.getMonth()]}
        </p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {getMadridTime(now)}
        </p>
      </header>

      {/* ── Date navigation ───────────────────────── */}
      <div className="mb-6 relative" ref={calRef}>

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {!isViewingToday && (
              <button
                onClick={() => handleDateSelect(todayStr)}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg"
                style={{ background: '#FF6B35', color: '#FFFFFF' }}
              >
                <ChevronLeft size={11} />
                Hoy
              </button>
            )}
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {isViewingToday ? 'Esta semana' : formatShortDate(selectedDate)}
            </span>
          </div>
          <button
            onClick={openCalendar}
            className="w-9 h-9 rounded-xl flex items-center justify-center card"
            title="Abrir calendario"
          >
            <CalendarDays size={15} style={{ color: '#FF6B35' }} />
          </button>
        </div>

        {/* Week strip */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {weekDays.map(({ dateStr, label, num, isToday, isFuture }) => {
            const isSelected = dateStr === selectedDate
            return (
              <button
                key={dateStr}
                onClick={() => !isFuture && handleDateSelect(dateStr)}
                disabled={isFuture}
                className="flex flex-col items-center gap-1 flex-shrink-0 w-11 py-2.5 rounded-2xl transition-all"
                style={{
                  background: isSelected ? '#1A1A1A' : isToday ? '#F5F5F7' : 'var(--card-bg)',
                  boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.05)',
                  opacity: isFuture ? 0.35 : 1,
                  cursor: isFuture ? 'default' : 'pointer',
                }}
              >
                <span className="text-[9px] font-bold uppercase" style={{ color: isSelected ? '#9CA3AF' : isToday ? '#FF6B35' : 'var(--text-muted)' }}>
                  {label}
                </span>
                <span className="text-sm font-black" style={{ color: isSelected ? '#FF6B35' : 'var(--app-color)' }}>
                  {num}
                </span>
                {isToday && !isSelected && (
                  <div className="w-1 h-1 rounded-full" style={{ background: '#FF6B35' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Calendar popup ─────────────────────── */}
        {calendarOpen && (
          <div
            className="card absolute right-0 z-50 p-4 mt-2"
            style={{ minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
          >
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={prevMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: 'var(--card-border)' }}
              >
                <ChevronLeft size={13} style={{ color: 'var(--app-color)' }} />
              </button>
              <span className="text-sm font-black" style={{ color: 'var(--app-color)' }}>
                {MONTH_NAMES_CAP[calMonth]} {calYear}
              </span>
              <button
                onClick={nextMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  background: 'var(--card-border)',
                  opacity: futureMonth ? 0.3 : 1,
                  cursor: futureMonth ? 'default' : 'pointer',
                }}
                disabled={futureMonth}
              >
                <ChevronRight size={13} style={{ color: 'var(--app-color)' }} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {CAL_HEADERS.map((h) => (
                <div key={h} className="text-center text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calDays.map(({ dateStr, inMonth, isToday, isFuture, day }) => {
                const isSelected = dateStr === selectedDate
                return (
                  <button
                    key={dateStr}
                    onClick={() => !isFuture && handleDateSelect(dateStr)}
                    disabled={isFuture}
                    className="aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: isSelected ? '#FF6B35' : isToday ? 'rgba(255,107,53,0.15)' : 'transparent',
                      color: isSelected ? '#FFFFFF'
                        : isFuture || !inMonth ? 'var(--text-muted)'
                        : isToday ? '#FF6B35'
                        : 'var(--app-color)',
                      opacity: !inMonth ? 0.4 : isFuture ? 0.3 : 1,
                      cursor: isFuture ? 'default' : 'pointer',
                      fontWeight: isToday || isSelected ? 900 : 600,
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Close */}
            <button
              onClick={() => setCalendarOpen(false)}
              className="w-full mt-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'var(--divider)', color: 'var(--text-muted)' }}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* ── "Viendo día pasado" banner ─────────────── */}
      {!isViewingToday && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-2.5 mb-4"
          style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.25)' }}
        >
          <span className="text-xs font-bold" style={{ color: '#FF6B35' }}>
            Revisando {formatShortDate(selectedDate)}
          </span>
          <Link
            href={`/alimentacion?date=${selectedDate}`}
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: '#FF6B35', color: '#FFFFFF' }}
          >
            <Pencil size={10} />
            Editar
          </Link>
        </div>
      )}

      {/* ── Cards grid ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-4">

        {/* Calorías */}
        {(() => {
          const net = calories.consumed - calories.workout - calories.steps - calories.sleep
          const href = isViewingToday ? '/alimentacion' : `/alimentacion?date=${selectedDate}`
          return (
            <Link href={href} className="card p-4 block" style={{ backgroundImage: 'radial-gradient(ellipse at 22% 28%, rgba(255,107,53,0.42) 0%, rgba(255,155,100,0.26) 42%, transparent 65%), radial-gradient(ellipse at 70% 75%, rgba(255,130,65,0.26) 0%, transparent 42%)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#FFF4EF' }}>
                  <Flame size={15} style={{ color: '#FF6B35' }} />
                </div>
                <span className="label-caps">Calorías</span>
              </div>
              <div className="font-black text-2xl leading-none" style={{ color: 'var(--app-color)' }}>
                {net.toLocaleString()}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>kcal netas</div>
              <div className="mt-2 flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold" style={{ color: '#22C55E' }}>+{calories.consumed.toLocaleString()}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>consumidas</span>
                </div>
                {calories.workout > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold" style={{ color: '#FF6B35' }}>-{calories.workout}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>entreno</span>
                  </div>
                )}
                {calories.steps > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold" style={{ color: '#3B82F6' }}>-{calories.steps}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>pasos</span>
                  </div>
                )}
                {calories.sleep > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold" style={{ color: '#8B5CF6' }}>-{calories.sleep}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>dormir</span>
                  </div>
                )}
              </div>
              <div className="mt-3 h-1 rounded-full bg-gray-100">
                <div className="h-1 rounded-full" style={{ width: `${Math.min(100, (calories.consumed / calorieGoal) * 100)}%`, background: '#FF6B35' }} />
              </div>
            </Link>
          )
        })()}

        {/* Tareas */}
        <Link href="/gestor" className="card p-4 block" style={{ backgroundImage: 'radial-gradient(ellipse at 72% 14%, rgba(95,215,188,0.48) 0%, rgba(48,198,165,0.32) 32%, transparent 58%), radial-gradient(ellipse at 38% 55%, rgba(55,190,165,0.28) 0%, transparent 48%), radial-gradient(ellipse at 12% 88%, rgba(118,162,222,0.26) 0%, transparent 36%)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#F0FDF4' }}>
              <CheckSquare size={15} style={{ color: '#22C55E' }} />
            </div>
            <span className="label-caps">Tareas</span>
          </div>
          <div className="font-black text-2xl leading-none" style={{ color: 'var(--app-color)' }}>
            {completionPct}%
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{doneTasks.length}/{totalTasks} completadas</div>
          <div className="mt-3 h-1.5 rounded-full bg-gray-100">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${completionPct}%`, background: '#22C55E' }} />
          </div>
        </Link>
      </div>

      {/* ── Workout card ─────────────────────────── */}
      <Link href={isViewingToday ? '/entreno' : `/entreno?date=${selectedDate}`} className="card p-4 flex items-center justify-between mb-4 block" style={{ backgroundImage: 'radial-gradient(ellipse at 18% 62%, rgba(255,100,28,0.36) 0%, rgba(255,148,58,0.22) 38%, transparent 65%), radial-gradient(ellipse at 82% 18%, rgba(98,82,212,0.30) 0%, rgba(48,120,212,0.20) 52%, transparent 72%), radial-gradient(ellipse at 88% 85%, rgba(0,196,175,0.22) 0%, transparent 42%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FFF4EF' }}>
            <Dumbbell size={18} style={{ color: '#FF6B35' }} />
          </div>
          <div>
            <span className="label-caps block">{isViewingToday ? 'Entreno hoy' : 'Entreno'}</span>
            <span className="font-bold text-sm" style={{ color: 'var(--app-color)' }}>
              {workout ? (WORKOUT_TYPES[workout.tipo as keyof typeof WORKOUT_TYPES]?.label ?? workout.tipo) : 'Sin registrar'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {workout && (
            <div className="text-right">
              <div className="font-black text-xl leading-none" style={{ color: '#FF6B35' }}>{workout.calorias_quemadas}</div>
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
            <span className="label-caps">{isViewingToday ? 'Pendientes hoy' : 'Tareas pendientes'}</span>
            <Link href="/gestor" className="text-xs font-bold flex items-center gap-1" style={{ color: '#FF6B35' }}>
              Ver todas <ArrowRight size={10} />
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {pendingTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#FF6B35' }} />
                <span className="text-sm font-medium truncate" style={{ color: 'var(--app-color)' }}>{task.nombre}</span>
              </div>
            ))}
            {pendingTasks.length > 3 && (
              <p className="text-xs pl-5" style={{ color: 'var(--text-muted)' }}>+{pendingTasks.length - 3} más</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
