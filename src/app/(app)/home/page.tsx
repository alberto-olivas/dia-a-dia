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
  const net = calories.consumed - calories.workout - calories.steps - calories.sleep

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', position: 'relative' }}>
      <style>{`
        .h-card-link {
          display: block;
          background: var(--card-bg);
          backdrop-filter: blur(20px) saturate(1.8);
          -webkit-backdrop-filter: blur(20px) saturate(1.8);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          box-shadow: var(--card-shadow);
          transition: transform 250ms ease, box-shadow 250ms ease;
          text-decoration: none;
          color: inherit;
        }
        .h-card-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 36px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(255,255,255,0.95);
        }
        .h-week-btn {
          border: 1.5px solid transparent;
          transition: background 150ms, border-color 150ms;
        }
        .h-week-btn:hover:not(:disabled) {
          background: rgba(0,189,125,0.06) !important;
          border-color: rgba(0,189,125,0.18) !important;
        }
        .h-cal-btn:hover {
          background: rgba(0,189,125,0.10) !important;
        }
        .h-nav-btn:hover {
          background: rgba(0,0,0,0.06) !important;
        }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto', padding: '32px 16px 96px' }}>

        {/* ── Greeting ── */}
        <header style={{ marginBottom: 28 }}>
          <h1 style={{
            fontFamily: "var(--font-oswald,'Oswald',sans-serif)",
            fontWeight: 600, fontSize: 30, lineHeight: 1.15,
            color: 'var(--app-color)', margin: 0,
            letterSpacing: '0.01em',
          }}>
            {greeting.text}, {userName} {greeting.emoji}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
            {DAY_NAMES_FULL[now.getDay()]}, {now.getDate()} de {MONTH_NAMES[now.getMonth()]}
          </p>
          <p style={{
            fontSize: 13, color: 'var(--text-muted)', marginTop: 2, marginBottom: 0,
            fontFamily: "var(--font-mono,'JetBrains Mono',monospace)",
            fontVariantNumeric: 'tabular-nums',
          }}>
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
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                    padding: '5px 12px', borderRadius: 20,
                    background: '#00BD7D', color: '#fff',
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,189,125,0.3)',
                  }}
                >
                  <ChevronLeft size={10} />
                  Hoy
                </button>
              )}
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--text-muted)',
              }}>
                {isViewingToday ? 'Esta semana' : formatShortDate(selectedDate)}
              </span>
            </div>
            <button
              onClick={openCalendar}
              className="h-nav-btn"
              style={{
                width: 36, height: 36, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--card-bg)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid var(--card-border)',
                boxShadow: 'var(--card-shadow)',
                cursor: 'pointer',
              }}
              title="Abrir calendario"
            >
              <CalendarDays size={14} style={{ color: '#00BD7D' }} />
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
                  className="h-week-btn"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    flexShrink: 0, width: 44, padding: '10px 0', borderRadius: 14,
                    background: isSelected
                      ? '#00BD7D'
                      : isToday
                      ? 'rgba(0,189,125,0.08)'
                      : 'rgba(255,255,255,0.6)',
                    borderColor: isSelected ? '#00BD7D' : isToday ? 'rgba(0,189,125,0.3)' : 'rgba(0,0,0,0.06)',
                    opacity: isFuture ? 0.35 : 1,
                    cursor: isFuture ? 'default' : 'pointer',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    boxShadow: isSelected
                      ? '0 4px 12px rgba(0,189,125,0.3)'
                      : '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: isSelected ? 'rgba(255,255,255,0.85)' : isToday ? '#00BD7D' : 'var(--text-muted)',
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontSize: 14, fontWeight: 800,
                    fontFamily: "var(--font-mono,'JetBrains Mono',monospace)",
                    color: isSelected ? '#fff' : isToday ? '#00BD7D' : 'var(--app-color)',
                  }}>
                    {num}
                  </span>
                  {isToday && !isSelected && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#00BD7D' }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Calendar popup ── */}
          {calendarOpen && (
            <div
              style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(24px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
                border: '1px solid rgba(255,255,255,0.9)',
                borderRadius: 16,
                boxShadow: '0 20px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(255,255,255,0.9)',
                position: 'absolute', right: 0, zIndex: 50,
                marginTop: 8, minWidth: 280, padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button
                  onClick={prevMonth}
                  className="h-nav-btn"
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={12} style={{ color: 'var(--app-color)' }} />
                </button>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  fontFamily: "var(--font-oswald,'Oswald',sans-serif)",
                  color: 'var(--app-color)',
                }}>
                  {MONTH_NAMES_CAP[calMonth]} {calYear}
                </span>
                <button
                  onClick={nextMonth}
                  className="h-nav-btn"
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    opacity: futureMonth ? 0.3 : 1,
                  }}
                  disabled={futureMonth}
                >
                  <ChevronRight size={12} style={{ color: 'var(--app-color)' }} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
                {CAL_HEADERS.map((h) => (
                  <div key={h} style={{
                    textAlign: 'center', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
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
                      className="h-cal-btn"
                      style={{
                        aspectRatio: '1', borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: isToday || isSelected ? 800 : 600,
                        background: isSelected ? '#00BD7D' : isToday ? 'rgba(0,189,125,0.12)' : 'transparent',
                        color: isSelected ? '#fff' : isFuture || !inMonth ? 'var(--text-muted-2)' : isToday ? '#00BD7D' : 'var(--app-color)',
                        opacity: !inMonth ? 0.4 : isFuture ? 0.25 : 1,
                        cursor: isFuture ? 'default' : 'pointer',
                        border: 'none',
                        boxShadow: isSelected ? '0 2px 8px rgba(0,189,125,0.35)' : undefined,
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
                  fontSize: 11, fontWeight: 600,
                  background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)',
                  border: '1px solid rgba(0,0,0,0.08)',
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
              borderRadius: 14, padding: '10px 16px', marginBottom: 16,
              background: 'rgba(0,189,125,0.08)',
              border: '1px solid rgba(0,189,125,0.2)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: '#00BD7D' }}>
              Revisando {formatShortDate(selectedDate)}
            </span>
            <Link
              href={`/alimentacion?date=${selectedDate}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 10,
                background: '#00BD7D', color: '#fff', textDecoration: 'none',
                boxShadow: '0 2px 6px rgba(0,189,125,0.3)',
              }}
            >
              <Pencil size={9} />
              Editar
            </Link>
          </div>
        )}

        {/* ── Metric cards grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

          {/* Calorías consumidas */}
          {(() => {
            const href = isViewingToday ? '/alimentacion' : `/alimentacion?date=${selectedDate}`
            return (
              <Link href={href} className="h-card-link" style={{ padding: 16, borderTop: '3px solid #00BD7D' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,189,125,0.12)',
                  }}>
                    <Flame size={14} style={{ color: '#00BD7D' }} />
                  </div>
                  <span className="label-caps">Calorías</span>
                </div>
                <div style={{
                  fontFamily: "var(--font-mono,'JetBrains Mono',monospace)",
                  fontWeight: 700, fontSize: 28, lineHeight: 1, color: 'var(--app-color)',
                }}>
                  {calories.consumed.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, marginTop: 3, color: 'var(--text-muted)' }}>kcal consumidas</div>
                <div style={{ marginTop: 10, height: 4, borderRadius: 9999, background: 'rgba(0,0,0,0.07)' }}>
                  <div style={{
                    height: 4, borderRadius: 9999,
                    width: `${Math.min(100, (calories.consumed / calorieGoal) * 100)}%`,
                    background: 'linear-gradient(90deg, #00BD7D, rgba(0,189,125,0.5))',
                    transition: 'width 400ms ease-out',
                  }} />
                </div>
                <div style={{ fontSize: 10, marginTop: 4, color: 'var(--text-muted-2)' }}>
                  meta: {calorieGoal.toLocaleString()} kcal
                </div>
              </Link>
            )
          })()}

          {/* Tareas */}
          <Link href="/gestor" className="h-card-link" style={{ padding: 16, borderTop: '3px solid #D97706' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(217,119,6,0.12)',
              }}>
                <CheckSquare size={14} style={{ color: '#D97706' }} />
              </div>
              <span className="label-caps">Tareas</span>
            </div>
            <div style={{
              fontFamily: "var(--font-mono,'JetBrains Mono',monospace)",
              fontWeight: 700, fontSize: 28, lineHeight: 1, color: 'var(--app-color)',
            }}>
              {completionPct}%
            </div>
            <div style={{ fontSize: 11, marginTop: 3, color: 'var(--text-muted)' }}>
              {doneTasks.length}/{totalTasks} completadas
            </div>
            <div style={{ marginTop: 10, height: 4, borderRadius: 9999, background: 'rgba(0,0,0,0.07)' }}>
              <div style={{
                height: 4, borderRadius: 9999,
                width: `${completionPct}%`,
                background: 'linear-gradient(90deg, #D97706, rgba(217,119,6,0.5))',
                transition: 'width 400ms ease-out',
              }} />
            </div>
          </Link>

          {/* Balance neto */}
          <Link
            href={isViewingToday ? '/alimentacion' : `/alimentacion?date=${selectedDate}`}
            className="h-card-link"
            style={{ padding: 16, borderTop: '3px solid #0166FF' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(1,102,255,0.10)',
              }}>
                <Flame size={14} style={{ color: '#0166FF' }} />
              </div>
              <span className="label-caps">Netas</span>
            </div>
            <div style={{
              fontFamily: "var(--font-mono,'JetBrains Mono',monospace)",
              fontWeight: 700, fontSize: 28, lineHeight: 1,
              color: net < 0 ? '#00BD7D' : 'var(--app-color)',
            }}>
              {net.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, marginTop: 3, color: 'var(--text-muted)' }}>kcal netas</div>
            {calories.workout > 0 && (
              <div style={{ fontSize: 10, marginTop: 6, color: '#0166FF' }}>-{calories.workout} entreno</div>
            )}
          </Link>

          {/* Entreno */}
          <Link
            href={isViewingToday ? '/entreno' : `/entreno?date=${selectedDate}`}
            className="h-card-link"
            style={{ padding: 16, borderTop: '3px solid #8B5CF6' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(139,92,246,0.12)',
              }}>
                <Dumbbell size={14} style={{ color: '#8B5CF6' }} />
              </div>
              <span className="label-caps">Entreno</span>
            </div>
            <div style={{
              fontFamily: "var(--font-oswald,'Oswald',sans-serif)",
              fontWeight: 600, fontSize: 18, lineHeight: 1.2, color: 'var(--app-color)',
            }}>
              {workout ? (WORKOUT_TYPES[workout.tipo as keyof typeof WORKOUT_TYPES]?.label ?? workout.tipo) : '—'}
            </div>
            {workout ? (
              <div style={{ marginTop: 4 }}>
                <span style={{
                  fontFamily: "var(--font-mono,'JetBrains Mono',monospace)",
                  fontSize: 13, fontWeight: 600, color: '#8B5CF6',
                }}>
                  {workout.calorias_quemadas}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>kcal</span>
              </div>
            ) : (
              <div style={{ fontSize: 11, marginTop: 3, color: 'var(--text-muted)' }}>sin registrar</div>
            )}
          </Link>
        </div>

        {/* ── Pending tasks preview ── */}
        {pendingTasks.length > 0 && (
          <div style={{
            background: 'var(--card-bg)',
            backdropFilter: 'blur(20px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
            border: '1px solid var(--card-border)',
            borderRadius: 16,
            boxShadow: 'var(--card-shadow)',
            padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{
                fontFamily: "var(--font-oswald,'Oswald',sans-serif)",
                fontSize: 14, fontWeight: 600, letterSpacing: '0.04em',
                textTransform: 'uppercase', color: 'var(--app-color)',
              }}>
                {isViewingToday ? 'Pendientes hoy' : 'Tareas pendientes'}
              </span>
              <Link
                href="/gestor"
                style={{
                  fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                  color: '#00BD7D', textDecoration: 'none',
                }}
              >
                Ver todas <ArrowRight size={9} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingTasks.slice(0, 4).map((task) => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: '2px solid rgba(0,189,125,0.4)',
                    background: 'rgba(0,189,125,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }} />
                  <span style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--app-color)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {task.nombre}
                  </span>
                </div>
              ))}
              {pendingTasks.length > 4 && (
                <p style={{ fontSize: 11, paddingLeft: 26, color: 'var(--text-muted)', margin: 0 }}>
                  +{pendingTasks.length - 4} más
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
