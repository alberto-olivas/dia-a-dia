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
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ dateStr: string; inMonth: boolean; isToday: boolean; isFuture: boolean; day: number }> = []
  for (let i = 0; i < firstDow; i++) {
    const d = new Date(year, month, i - firstDow + 1, 12)
    const dateStr = toMadridDate(d)
    cells.push({ dateStr, inMonth: false, isToday: dateStr === todayStr, isFuture: dateStr > todayStr, day: d.getDate() })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toMadridDate(new Date(year, month, d, 12))
    cells.push({ dateStr, inMonth: true, isToday: dateStr === todayStr, isFuture: dateStr > todayStr, day: d })
  }
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

// ── Perspective Design System tokens ──────────────────────────────────────────
const DS = {
  bg:          '#060B18',
  bgSoft:      '#0C1222',
  bgMedium:    '#131B2E',
  bgStrong:    '#1E293B',
  heading:     '#F1F5F9',
  body:        '#94A3B8',
  brand:       '#0166FF',
  brandSofter: '#0A1A3D',
  brandSoft:   '#0D2B66',
  success:     '#009966',
  purple:      '#8B5CF6',
  cyan:        '#22D3EE',
  shadowMd:    '0 6px 16px -4px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.05)',
  shadowLg:    '0 12px 28px -6px rgb(0 0 0 / 0.1), 0 4px 12px -4px rgb(0 0 0 / 0.06)',
  shadowXl:    '0 24px 48px -10px rgb(0 0 0 / 0.14), 0 8px 20px -8px rgb(0 0 0 / 0.08)',
}

const GLASS_BASE = {
  background:            'rgba(255,255,255,0.06)',
  backdropFilter:        'blur(16px) saturate(1.4)',
  WebkitBackdropFilter:  'blur(16px) saturate(1.4)',
  border:                '1px solid rgba(255,255,255,0.10)',
  borderRadius:          16,
} as const

// ── Component ──────────────────────────────────────────────────────────────────
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
  const [doneTasks, setDoneTasks]       = useState<Task[]>([])
  const [calories, setCalories]         = useState({ consumed: 0, workout: 0, steps: 0, sleep: 0 })
  const [calorieGoal, setCalorieGoal]   = useState(2500)
  const [workout, setWorkout]           = useState<Workout | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calRef   = useRef<HTMLDivElement>(null)
  const todayStr = getTodayStr()

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

  useEffect(() => {
    if (selectedDate !== todayStr) {
      sessionStorage.setItem('dia_seleccionado', selectedDate)
    } else {
      sessionStorage.removeItem('dia_seleccionado')
    }
  }, [selectedDate, todayStr])

  useEffect(() => {
    const id = setInterval(() => {
      const prevToday = getTodayStr()
      const newNow = new Date()
      const newToday = newNow.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
      setNow(newNow)
      if (newToday !== prevToday) {
        setSelectedDate(prev => prev === prevToday ? newToday : prev)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

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
      const w    = JSON.parse(localStorage.getItem(`demo_workout_${date}`) ?? 'null')
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
  const futureMonth = calYear > nowD.getFullYear() || (calYear === nowD.getFullYear() && calMonth >= nowD.getMonth())

  return (
    <div style={{ minHeight: '100vh', background: DS.bg, position: 'relative', overflow: 'hidden' }}>

      {/* ── Hover / transition styles ── */}
      <style>{`
        .p-card-link {
          display: block;
          background: rgba(255,255,255,0.06);
          backdrop-filter: blur(16px) saturate(1.4);
          -webkit-backdrop-filter: blur(16px) saturate(1.4);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          transition: background 300ms ease-out, box-shadow 300ms ease-out, transform 300ms ease-out;
          text-decoration: none;
        }
        .p-card-link:hover {
          background: rgba(255,255,255,0.10);
          box-shadow: 0 12px 28px -6px rgb(0 0 0 / 0.12), 0 4px 12px -4px rgb(0 0 0 / 0.08);
          transform: translateY(-2px);
        }
        .p-week-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          transition: background 150ms, border-color 150ms;
        }
        .p-week-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.14);
        }
        .p-cal-btn:hover {
          background: rgba(255,255,255,0.10) !important;
        }
        .p-nav-btn:hover {
          background: rgba(255,255,255,0.12) !important;
        }
      `}</style>

      {/* ── Atmospheric orbs ── */}
      <div style={{
        position: 'fixed', top: '-20%', right: '-15%',
        width: '65vw', height: '65vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(1,102,255,0.14) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: '-15%', left: '-20%',
        width: '55vw', height: '55vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto', padding: '32px 16px 96px' }}>

        {/* ── Greeting ── */}
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ fontWeight: 700, fontSize: 28, lineHeight: 1.2, color: DS.heading, margin: 0 }}>
            {greeting.text}, {userName} {greeting.emoji}
          </h1>
          <p style={{ fontSize: 13, color: DS.body, marginTop: 6, marginBottom: 0 }}>
            {DAY_NAMES_FULL[now.getDay()]}, {now.getDate()} de {MONTH_NAMES[now.getMonth()]}
          </p>
          <p style={{ fontSize: 13, color: DS.body, marginTop: 2, marginBottom: 0, fontVariantNumeric: 'tabular-nums' }}>
            {getMadridTime(now)}
          </p>
        </header>

        {/* ── Date navigation ── */}
        <div style={{ marginBottom: 24, position: 'relative' }} ref={calRef}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isViewingToday && (
                <button
                  onClick={() => handleDateSelect(todayStr)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    padding: '5px 10px', borderRadius: 16,
                    background: DS.brand, color: '#fff',
                    border: 'none', cursor: 'pointer',
                    boxShadow: `${DS.shadowMd}, inset rgba(255,255,255,0.08) 0 6px 0px -5px, rgba(1,102,255,0.35) 0 4px 10px -5px`,
                  }}
                >
                  <ChevronLeft size={10} />
                  Hoy
                </button>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: DS.body }}>
                {isViewingToday ? 'Esta semana' : formatShortDate(selectedDate)}
              </span>
            </div>
            <button
              onClick={openCalendar}
              className="p-nav-btn"
              style={{
                ...GLASS_BASE,
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: DS.shadowMd,
                cursor: 'pointer',
              }}
              title="Abrir calendario"
            >
              <CalendarDays size={14} style={{ color: DS.brand }} />
            </button>
          </div>

          {/* Week strip */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {weekDays.map(({ dateStr, label, num, isToday, isFuture }) => {
              const isSelected = dateStr === selectedDate
              return (
                <button
                  key={dateStr}
                  onClick={() => !isFuture && handleDateSelect(dateStr)}
                  disabled={isFuture}
                  className="p-week-btn"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    flexShrink: 0, width: 44, padding: '10px 0', borderRadius: 16,
                    background: isSelected
                      ? 'rgba(1,102,255,0.22)'
                      : isToday
                      ? 'rgba(255,255,255,0.06)'
                      : undefined,
                    borderColor: isSelected
                      ? 'rgba(1,102,255,0.45)'
                      : isToday
                      ? 'rgba(255,255,255,0.14)'
                      : undefined,
                    opacity: isFuture ? 0.3 : 1,
                    cursor: isFuture ? 'default' : 'pointer',
                    boxShadow: isSelected ? '0 0 14px rgba(1,102,255,0.22)' : undefined,
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: isSelected ? 'rgba(77,154,255,0.9)' : isToday ? DS.brand : DS.body,
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontSize: 14, fontWeight: 800,
                    color: isSelected ? '#fff' : isToday ? DS.heading : DS.body,
                  }}>
                    {num}
                  </span>
                  {isToday && !isSelected && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: DS.brand, boxShadow: `0 0 6px ${DS.brand}` }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Calendar popup ── */}
          {calendarOpen && (
            <div
              style={{
                ...GLASS_BASE,
                background: 'rgba(6,11,24,0.92)',
                position: 'absolute', right: 0, zIndex: 50,
                marginTop: 8, minWidth: 280, padding: 16,
                boxShadow: DS.shadowXl,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button
                  onClick={prevMonth}
                  className="p-nav-btn"
                  style={{
                    width: 28, height: 28, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={12} style={{ color: DS.heading }} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: DS.heading }}>
                  {MONTH_NAMES_CAP[calMonth]} {calYear}
                </span>
                <button
                  onClick={nextMonth}
                  className="p-nav-btn"
                  style={{
                    width: 28, height: 28, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)',
                    cursor: 'pointer',
                    opacity: futureMonth ? 0.3 : 1,
                  }}
                  disabled={futureMonth}
                >
                  <ChevronRight size={12} style={{ color: DS.heading }} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
                {CAL_HEADERS.map((h) => (
                  <div key={h} style={{
                    textAlign: 'center', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase', color: DS.body,
                  }}>
                    {h}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {calDays.map(({ dateStr, inMonth, isToday, isFuture, day }) => {
                  const isSelected = dateStr === selectedDate
                  return (
                    <button
                      key={dateStr}
                      onClick={() => !isFuture && handleDateSelect(dateStr)}
                      disabled={isFuture}
                      className="p-cal-btn"
                      style={{
                        aspectRatio: '1', borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: isToday || isSelected ? 800 : 600,
                        background: isSelected ? DS.brand : isToday ? 'rgba(1,102,255,0.18)' : 'transparent',
                        color: isSelected ? '#fff' : isFuture || !inMonth ? DS.body : isToday ? DS.brand : DS.heading,
                        opacity: !inMonth ? 0.35 : isFuture ? 0.25 : 1,
                        cursor: isFuture ? 'default' : 'pointer',
                        border: 'none',
                        boxShadow: isSelected ? '0 0 10px rgba(1,102,255,0.45)' : undefined,
                        transition: 'background 150ms',
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => setCalendarOpen(false)}
                style={{
                  width: '100%', marginTop: 12, padding: '7px 0', borderRadius: 10,
                  fontSize: 11, fontWeight: 700,
                  background: 'rgba(255,255,255,0.07)', color: DS.body,
                  border: '1px solid rgba(255,255,255,0.10)',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          )}
        </div>

        {/* ── "Viendo día pasado" banner ── */}
        {!isViewingToday && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderRadius: 16, padding: '10px 16px', marginBottom: 16,
              background: 'rgba(1,102,255,0.10)',
              border: '1px solid rgba(1,102,255,0.22)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: DS.brand }}>
              Revisando {formatShortDate(selectedDate)}
            </span>
            <Link
              href={`/alimentacion?date=${selectedDate}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 10,
                background: DS.brand, color: '#fff', textDecoration: 'none',
                boxShadow: `${DS.shadowMd}, inset rgba(255,255,255,0.08) 0 6px 0px -5px`,
              }}
            >
              <Pencil size={9} />
              Editar
            </Link>
          </div>
        )}

        {/* ── Cards grid — wrapped in perspective for 3D depth ── */}
        <div style={{ perspective: '1200px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Calorías */}
            {(() => {
              const net  = calories.consumed - calories.workout - calories.steps - calories.sleep
              const href = isViewingToday ? '/alimentacion' : `/alimentacion?date=${selectedDate}`
              return (
                <Link
                  href={href}
                  className="p-card-link"
                  style={{
                    padding: 16,
                    backgroundImage: 'radial-gradient(ellipse at 20% 20%, rgba(1,102,255,0.22) 0%, transparent 65%)',
                    boxShadow: DS.shadowMd,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(1,102,255,0.14)', border: '1px solid rgba(1,102,255,0.28)',
                    }}>
                      <Flame size={14} style={{ color: DS.brand }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DS.body }}>
                      Calorías
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 26, lineHeight: 1, color: DS.heading }}>
                    {net.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, color: DS.body }}>kcal netas</div>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: DS.success }}>+{calories.consumed.toLocaleString()}</span>
                      <span style={{ fontSize: 10, color: DS.body }}>consumidas</span>
                    </div>
                    {calories.workout > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: DS.brand }}>-{calories.workout}</span>
                        <span style={{ fontSize: 10, color: DS.body }}>entreno</span>
                      </div>
                    )}
                    {calories.steps > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: DS.cyan }}>-{calories.steps}</span>
                        <span style={{ fontSize: 10, color: DS.body }}>pasos</span>
                      </div>
                    )}
                    {calories.sleep > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: DS.purple }}>-{calories.sleep}</span>
                        <span style={{ fontSize: 10, color: DS.body }}>dormir</span>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 12, height: 3, borderRadius: 9999, background: 'rgba(255,255,255,0.08)' }}>
                    <div style={{
                      height: 3, borderRadius: 9999,
                      width: `${Math.min(100, (calories.consumed / calorieGoal) * 100)}%`,
                      background: `linear-gradient(90deg, ${DS.brand}, rgba(1,102,255,0.5))`,
                      boxShadow: `0 0 8px rgba(1,102,255,0.5)`,
                    }} />
                  </div>
                </Link>
              )
            })()}

            {/* Tareas */}
            <Link
              href="/gestor"
              className="p-card-link"
              style={{
                padding: 16,
                backgroundImage: 'radial-gradient(ellipse at 78% 18%, rgba(0,153,102,0.20) 0%, transparent 60%)',
                boxShadow: DS.shadowMd,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,153,102,0.14)', border: '1px solid rgba(0,153,102,0.28)',
                }}>
                  <CheckSquare size={14} style={{ color: DS.success }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DS.body }}>
                  Tareas
                </span>
              </div>
              <div style={{ fontWeight: 800, fontSize: 26, lineHeight: 1, color: DS.heading }}>
                {completionPct}%
              </div>
              <div style={{ fontSize: 11, marginTop: 4, color: DS.body }}>{doneTasks.length}/{totalTasks} completadas</div>
              <div style={{ marginTop: 12, height: 3, borderRadius: 9999, background: 'rgba(255,255,255,0.08)' }}>
                <div style={{
                  height: 3, borderRadius: 9999,
                  width: `${completionPct}%`,
                  background: `linear-gradient(90deg, ${DS.success}, rgba(0,153,102,0.5))`,
                  boxShadow: '0 0 8px rgba(0,153,102,0.5)',
                  transition: 'width 400ms ease-out',
                }} />
              </div>
            </Link>
          </div>
        </div>

        {/* ── Workout card ── */}
        <Link
          href={isViewingToday ? '/entreno' : `/entreno?date=${selectedDate}`}
          className="p-card-link"
          style={{
            padding: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16,
            backgroundImage: 'radial-gradient(ellipse at 12% 55%, rgba(1,102,255,0.18) 0%, transparent 55%), radial-gradient(ellipse at 85% 25%, rgba(139,92,246,0.16) 0%, transparent 50%)',
            boxShadow: DS.shadowMd,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(1,102,255,0.14)', border: '1px solid rgba(1,102,255,0.28)',
            }}>
              <Dumbbell size={18} style={{ color: DS.brand }} />
            </div>
            <div>
              <span style={{
                display: 'block', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: DS.body, marginBottom: 3,
              }}>
                {isViewingToday ? 'Entreno hoy' : 'Entreno'}
              </span>
              <span style={{ fontWeight: 600, fontSize: 13, color: DS.heading }}>
                {workout ? (WORKOUT_TYPES[workout.tipo as keyof typeof WORKOUT_TYPES]?.label ?? workout.tipo) : 'Sin registrar'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {workout && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1, color: DS.brand }}>{workout.calorias_quemadas}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DS.body }}>kcal</div>
              </div>
            )}
            <ArrowRight size={15} style={{ color: 'rgba(255,255,255,0.22)' }} />
          </div>
        </Link>

        {/* ── Pending tasks preview ── */}
        {pendingTasks.length > 0 && (
          <div
            style={{
              ...GLASS_BASE,
              padding: 16,
              boxShadow: DS.shadowMd,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DS.body }}>
                {isViewingToday ? 'Pendientes hoy' : 'Tareas pendientes'}
              </span>
              <Link
                href="/gestor"
                style={{
                  fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                  color: DS.brand, textDecoration: 'none',
                }}
              >
                Ver todas <ArrowRight size={9} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingTasks.slice(0, 3).map((task) => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: DS.brand, boxShadow: `0 0 6px rgba(1,102,255,0.55)`,
                  }} />
                  <span style={{
                    fontSize: 13, fontWeight: 500, color: DS.heading,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {task.nombre}
                  </span>
                </div>
              ))}
              {pendingTasks.length > 3 && (
                <p style={{ fontSize: 11, paddingLeft: 16, color: DS.body, margin: 0 }}>
                  +{pendingTasks.length - 3} más
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
