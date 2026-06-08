'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase, IS_SUPABASE_CONFIGURED } from '@/lib/supabase'
import type { Task, TaskWhen, TaskStatus } from '@/lib/types'
import { Plus, Trash2, Pencil, Check, X, ChevronDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const WHEN_LABELS: Record<TaskWhen, string> = {
  hoy: 'Hoy',
  manana: 'Mañana',
  semana: 'Esta semana',
  fecha: 'Fecha concreta',
  sin_fecha: 'Sin fecha',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  por_hacer: 'Por hacer',
  en_proceso: 'En proceso',
  terminada: 'Terminada',
}

const STATUS_BADGE: Record<TaskStatus, { bg: string; color: string }> = {
  por_hacer: { bg: '#22C55E', color: '#FFFFFF' },
  en_proceso: { bg: '#F59E0B', color: '#FFFFFF' },
  terminada:  { bg: '#EF4444', color: '#FFFFFF' },
}

const WHEN_OPTIONS: TaskWhen[] = ['hoy', 'manana', 'semana', 'fecha', 'sin_fecha']

function getLast7Days(): Array<{ date: string; label: string }> {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      date: d.toISOString().split('T')[0],
      label: i === 6 ? 'Hoy' : days[d.getDay()],
    }
  })
}

function sortTasks(tasks: Task[]): Task[] {
  const order: Record<TaskWhen, number> = { hoy: 0, manana: 1, semana: 2, fecha: 3, sin_fecha: 4 }
  return [...tasks].sort((a, b) => {
    if (a.estado === 'terminada' && b.estado !== 'terminada') return 1
    if (b.estado === 'terminada' && a.estado !== 'terminada') return -1
    return (order[a.cuando] ?? 4) - (order[b.cuando] ?? 4)
  })
}

export default function GestorPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED)
  const [showForm, setShowForm] = useState(false)
  const [weeklyData, setWeeklyData] = useState<Array<{ day: string; completadas: number; pendientes: number }>>([])
  const [mounted, setMounted] = useState(false)

  const [newNombre, setNewNombre] = useState('')
  const [newDescripcion, setNewDescripcion] = useState('')
  const [newCuando, setNewCuando] = useState<TaskWhen>('hoy')
  const [newFechaObj, setNewFechaObj] = useState('')
  const [newEstado, setNewEstado] = useState<TaskStatus>('por_hacer')
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editCuando, setEditCuando] = useState<TaskWhen>('hoy')
  const [editFechaObj, setEditFechaObj] = useState('')
  const [editEstado, setEditEstado] = useState<TaskStatus>('por_hacer')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!user) return
    if (!IS_SUPABASE_CONFIGURED) {
      try {
        const saved = JSON.parse(localStorage.getItem('demo_tasks') ?? '[]')
        setTasks(saved)
      } catch {}
      setLoading(false)
      return
    }
    fetchTasks()
    fetchWeeklyData()
  }, [user])

  // ── Descripción fallback en localStorage (hasta que exista columna en Supabase) ──
  function loadDescStore(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem('task_descriptions') ?? '{}') } catch { return {} }
  }
  function saveDescStore(id: string, desc: string | null) {
    const store = loadDescStore()
    if (desc) store[id] = desc; else delete store[id]
    localStorage.setItem('task_descriptions', JSON.stringify(store))
  }

  async function fetchTasks() {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user!.id)
      .order('fecha_creacion', { ascending: false })
    // Merge locally-stored descriptions for tasks that Supabase returns without descripcion
    const descStore = loadDescStore()
    setTasks((data ?? []).map((t: Task) => ({
      ...t,
      descripcion: t.descripcion ?? descStore[t.id] ?? null,
    })))
    setLoading(false)
  }

  async function fetchWeeklyData() {
    const last7 = getLast7Days()
    const { data } = await supabase
      .from('tasks')
      .select('estado, fecha_creacion')
      .eq('user_id', user!.id)
      .gte('fecha_creacion', `${last7[0].date}T00:00:00`)

    setWeeklyData(last7.map(({ date, label }) => {
      const day = (data ?? []).filter((t: { estado: string; fecha_creacion: string }) => t.fecha_creacion.startsWith(date))
      return {
        day: label,
        completadas: day.filter((t: { estado: string }) => t.estado === 'terminada').length,
        pendientes: day.filter((t: { estado: string }) => t.estado !== 'terminada').length,
      }
    }))
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newNombre.trim()) return
    setSaving(true)

    if (!IS_SUPABASE_CONFIGURED) {
      const newTask: Task = {
        id: crypto.randomUUID(),
        user_id: user!.id,
        nombre: newNombre.trim(),
        descripcion: newDescripcion.trim() || null,
        cuando: newCuando,
        fecha_objetivo: newCuando === 'fecha' ? newFechaObj || null : null,
        estado: newEstado,
        fecha_creacion: new Date().toISOString(),
      }
      const saved = [newTask, ...tasks]
      setTasks(saved)
      localStorage.setItem('demo_tasks', JSON.stringify(saved))
      setNewNombre('')
      setNewDescripcion('')
      setNewCuando('hoy')
      setNewFechaObj('')
      setNewEstado('por_hacer')
      setShowForm(false)
      setSaving(false)
      return
    }

    const tempTask: Task = {
      id: crypto.randomUUID(),
      user_id: user!.id,
      nombre: newNombre.trim(),
      descripcion: newDescripcion.trim() || null,
      cuando: newCuando,
      fecha_objetivo: newCuando === 'fecha' ? newFechaObj || null : null,
      estado: newEstado,
      fecha_creacion: new Date().toISOString(),
    }
    // descripcion se omite del insert — la columna puede no existir en Supabase todavía
    const { data } = await supabase.from('tasks').insert({
      user_id: user!.id,
      nombre: tempTask.nombre,
      cuando: tempTask.cuando,
      fecha_objetivo: tempTask.fecha_objetivo,
      estado: tempTask.estado,
      fecha_creacion: tempTask.fecha_creacion,
    }).select().single()
    // Persist description locally so it survives re-fetch from Supabase
    const finalId = data?.id ?? tempTask.id
    saveDescStore(finalId, tempTask.descripcion ?? null)
    // Merge: keep our descripcion even if Supabase doesn't return it
    setTasks((t) => [data ? { ...tempTask, ...data, descripcion: tempTask.descripcion } : tempTask, ...t])
    setNewNombre('')
    setNewDescripcion('')
    setNewCuando('hoy')
    setNewFechaObj('')
    setNewEstado('por_hacer')
    setShowForm(false)
    setSaving(false)
  }

  async function deleteTask(id: string) {
    if (!IS_SUPABASE_CONFIGURED) {
      const saved = tasks.filter((x) => x.id !== id)
      setTasks(saved)
      localStorage.setItem('demo_tasks', JSON.stringify(saved))
      return
    }
    await supabase.from('tasks').delete().eq('id', id)
    saveDescStore(id, null)
    setTasks((t) => t.filter((x) => x.id !== id))
  }

  function startEdit(task: Task) {
    setEditId(task.id)
    setEditNombre(task.nombre)
    setEditDescripcion(task.descripcion ?? '')
    setEditCuando(task.cuando)
    setEditFechaObj(task.fecha_objetivo ?? '')
    setEditEstado(task.estado)
  }

  async function saveEdit(id: string) {
    const descripcion = editDescripcion.trim() || null
    // Campos que van a Supabase (sin descripcion — columna puede no existir todavía)
    const supabaseFields = {
      nombre:         editNombre.trim(),
      cuando:         editCuando,
      fecha_objetivo: editCuando === 'fecha' ? editFechaObj || null : null,
      estado:         editEstado,
    }
    const updatedFields = { ...supabaseFields, descripcion }

    // Optimistic update — aplica de inmediato en local state
    const optimistic = tasks.map((x) => x.id === id ? { ...x, ...updatedFields } : x)
    setTasks(optimistic)
    setEditId(null)

    if (!IS_SUPABASE_CONFIGURED) {
      localStorage.setItem('demo_tasks', JSON.stringify(optimistic))
      return
    }
    saveDescStore(id, descripcion)
    const { data } = await supabase.from('tasks').update(supabaseFields).eq('id', id).select().single()
    if (data) setTasks((t) => t.map((x) => x.id === id ? { ...x, ...data, descripcion } : x))
  }

  async function quickStatusChange(task: Task, newStatus: TaskStatus) {
    if (!IS_SUPABASE_CONFIGURED) {
      const saved = tasks.map((x) => x.id === task.id ? { ...x, estado: newStatus } : x)
      setTasks(saved)
      localStorage.setItem('demo_tasks', JSON.stringify(saved))
      return
    }
    // Optimistic update local inmediato
    setTasks((t) => t.map((x) => x.id === task.id ? { ...x, estado: newStatus } : x))
    const { data } = await supabase.from('tasks').update({ estado: newStatus }).eq('id', task.id).select().single()
    // Preservar descripcion local — Supabase no tiene esa columna todavía
    if (data) setTasks((t) => t.map((x) => x.id === task.id ? { ...data, descripcion: task.descripcion } : x))
  }

  const sorted = sortTasks(tasks)
  const pending = sorted.filter((t) => t.estado !== 'terminada')
  const done = sorted.filter((t) => t.estado === 'terminada')
  const totalToday = tasks.length
  const completedCount = done.length
  const pct = totalToday > 0 ? Math.round((completedCount / totalToday) * 100) : 0

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10 max-w-2xl mx-auto">

      {/* ── Header ─────────────────────────────────── */}
      <header className="mb-6">
        <span className="label-caps block mb-1">Módulo 01</span>
        <div className="flex items-center justify-between">
          <h1 className="font-black text-3xl" style={{ color: 'var(--app-color)' }}>GESTOR</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all"
            style={{
              background: showForm ? '#F5F5F7' : '#1A1A1A',
              color: showForm ? '#9CA3AF' : '#FFFFFF',
            }}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancelar' : 'Nueva tarea'}
          </button>
        </div>
      </header>

      {/* ── Progress card ──────────────────────────── */}
      <div className="card p-5 mb-4" style={{ backgroundImage: 'radial-gradient(ellipse at 84% 6%, rgba(255,150,120,0.36) 0%, transparent 32%), radial-gradient(ellipse at 6% 22%, rgba(190,150,242,0.30) 0%, transparent 36%), radial-gradient(ellipse at 32% 82%, rgba(170,120,218,0.40) 0%, transparent 46%), radial-gradient(ellipse at 80% 92%, rgba(220,140,200,0.30) 0%, transparent 36%)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="label-caps block mb-1">Progreso total</span>
            <span className="font-black text-3xl" style={{ color: 'var(--app-color)' }}>{pct}%</span>
          </div>
          <div className="text-right">
            <div className="font-black text-2xl leading-none" style={{ color: '#22C55E' }}>{completedCount}</div>
            <div className="label-caps">completadas</div>
            <div className="font-bold text-lg leading-none mt-1" style={{ color: 'var(--text-muted)' }}>{pending.length}</div>
            <div className="label-caps">pendientes</div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct === 100 ? '#22C55E' : '#FF6B35' }}
          />
        </div>
      </div>

      {/* ── New task form ───────────────────────────── */}
      {showForm && (
        <form onSubmit={createTask} className="card p-5 mb-4">
          <span className="label-caps block mb-4">Nueva tarea</span>

          <input
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
            placeholder="¿Qué tienes que hacer?"
            required
            className="w-full px-4 py-3 text-sm rounded-xl mb-2"
          />
          <textarea
            value={newDescripcion}
            onChange={(e) => setNewDescripcion(e.target.value)}
            placeholder="Descripción (opcional)"
            rows={2}
            className="w-full px-4 py-3 text-sm rounded-xl mb-4 resize-none"
          />

          {/* Cuando — pill buttons */}
          <div className="mb-4">
            <span className="label-caps block mb-2">¿Cuándo?</span>
            <div className="flex flex-wrap gap-2">
              {WHEN_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setNewCuando(w)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: newCuando === w ? '#1A1A1A' : '#F5F5F7',
                    color: newCuando === w ? '#FF6B35' : '#9CA3AF',
                  }}
                >
                  {WHEN_LABELS[w]}
                </button>
              ))}
            </div>
          </div>

          {newCuando === 'fecha' && (
            <input
              type="date"
              value={newFechaObj}
              onChange={(e) => setNewFechaObj(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-xl mb-4"
            />
          )}

          {/* Estado — pill buttons */}
          <div className="mb-4">
            <span className="label-caps block mb-2">Estado inicial</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNewEstado(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: newEstado === s ? '#1A1A1A' : '#F5F5F7',
                    color: newEstado === s ? '#FF6B35' : '#9CA3AF',
                  }}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl text-xs font-bold tracking-widest uppercase disabled:opacity-50"
            style={{ background: '#FF6B35', color: '#ffffff' }}
          >
            {saving ? 'Guardando...' : 'Crear tarea'}
          </button>
        </form>
      )}

      {/* ── Task list ──────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="label-caps">Pendientes</span>
                <span
                  className="text-xs font-black px-2 py-0.5 rounded-full"
                  style={{ background: '#FF6B35', color: '#fff' }}
                >
                  {pending.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {pending.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isEditing={editId === task.id}
                    editNombre={editNombre}
                    editDescripcion={editDescripcion}
                    editCuando={editCuando}
                    editFechaObj={editFechaObj}
                    editEstado={editEstado}
                    onEdit={() => startEdit(task)}
                    onSaveEdit={() => saveEdit(task.id)}
                    onCancelEdit={() => setEditId(null)}
                    onDelete={() => deleteTask(task.id)}
                    onStatusChange={(s) => quickStatusChange(task, s)}
                    setEditNombre={setEditNombre}
                    setEditDescripcion={setEditDescripcion}
                    setEditCuando={setEditCuando}
                    setEditFechaObj={setEditFechaObj}
                    setEditEstado={setEditEstado}
                  />
                ))}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section className="mb-6">
              <div className="divider mb-4" />
              <span className="label-caps block mb-3">Terminadas ({done.length})</span>
              <div className="flex flex-col gap-2">
                {done.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isEditing={editId === task.id}
                    editNombre={editNombre}
                    editDescripcion={editDescripcion}
                    editCuando={editCuando}
                    editFechaObj={editFechaObj}
                    editEstado={editEstado}
                    onEdit={() => startEdit(task)}
                    onSaveEdit={() => saveEdit(task.id)}
                    onCancelEdit={() => setEditId(null)}
                    onDelete={() => deleteTask(task.id)}
                    onStatusChange={(s) => quickStatusChange(task, s)}
                    setEditNombre={setEditNombre}
                    setEditDescripcion={setEditDescripcion}
                    setEditCuando={setEditCuando}
                    setEditFechaObj={setEditFechaObj}
                    setEditEstado={setEditEstado}
                  />
                ))}
              </div>
            </section>
          )}

          {tasks.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-sm font-semibold text-gray-400 mb-1">Sin tareas todavía</p>
              <p className="text-xs text-gray-300">Crea tu primera tarea arriba</p>
            </div>
          )}
        </>
      )}

      {/* ── Weekly stats chart ─────────────────────── */}
      {mounted && (
        <div className="card p-5 mt-2">
          <span className="label-caps block mb-4">Tareas esta semana</span>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weeklyData} barGap={2} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 12 }}
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              />
              <Bar dataKey="completadas" name="Completadas" fill="#22C55E" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="pendientes" name="Pendientes" fill="#FEE2E2" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/* ── TaskCard component ─────────────────────────── */

interface TaskCardProps {
  task: Task
  isEditing: boolean
  editNombre: string
  editDescripcion: string
  editCuando: TaskWhen
  editFechaObj: string
  editEstado: TaskStatus
  onEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  onStatusChange: (s: TaskStatus) => void
  setEditNombre: (v: string) => void
  setEditDescripcion: (v: string) => void
  setEditCuando: (v: TaskWhen) => void
  setEditFechaObj: (v: string) => void
  setEditEstado: (v: TaskStatus) => void
}

function TaskCard({
  task, isEditing, editNombre, editDescripcion, editCuando, editFechaObj, editEstado,
  onEdit, onSaveEdit, onCancelEdit, onDelete, onStatusChange,
  setEditNombre, setEditDescripcion, setEditCuando, setEditFechaObj, setEditEstado,
}: TaskCardProps) {
  const done = task.estado === 'terminada'
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  if (isEditing) {
    return (
      <div className="card p-4 flex flex-col gap-3">
        <input
          value={editNombre}
          onChange={(e) => setEditNombre(e.target.value)}
          className="w-full px-3 py-2.5 text-sm rounded-xl"
        />
        <textarea
          value={editDescripcion}
          onChange={(e) => setEditDescripcion(e.target.value)}
          placeholder="Descripción (opcional)"
          rows={2}
          className="w-full px-3 py-2.5 text-sm rounded-xl resize-none"
        />
        <div>
          <span className="label-caps block mb-2">¿Cuándo?</span>
          <div className="flex flex-wrap gap-2">
            {WHEN_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setEditCuando(w)}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  background: editCuando === w ? '#1A1A1A' : '#F5F5F7',
                  color: editCuando === w ? '#FF6B35' : '#9CA3AF',
                }}
              >
                {WHEN_LABELS[w]}
              </button>
            ))}
          </div>
        </div>
        {editCuando === 'fecha' && (
          <input
            type="date"
            value={editFechaObj}
            onChange={(e) => setEditFechaObj(e.target.value)}
            className="px-3 py-2.5 text-sm rounded-xl"
          />
        )}
        <div>
          <span className="label-caps block mb-2">Estado</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setEditEstado(s)}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  background: editEstado === s ? '#1A1A1A' : '#F5F5F7',
                  color: editEstado === s ? '#FF6B35' : '#9CA3AF',
                }}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSaveEdit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase"
            style={{ background: '#FF6B35', color: '#fff' }}
          >
            <Check size={12} /> Guardar
          </button>
          <button
            onClick={onCancelEdit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase"
            style={{ background: 'var(--divider)', color: 'var(--text-muted)' }}
          >
            <X size={12} /> Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="card flex items-start gap-3 px-4 py-3.5"
      style={{ opacity: done ? 0.7 : 1, position: 'relative', zIndex: showStatusMenu ? 50 : undefined }}
    >
      {/* Checkbox — alineado arriba con el título */}
      <button
        onClick={() => onStatusChange(done ? 'por_hacer' : 'terminada')}
        className="w-5 h-5 rounded-md flex items-center justify-center border-2 flex-shrink-0 transition-all mt-0.5"
        style={{
          borderColor: done ? '#22C55E' : '#E5E7EB',
          background: done ? '#22C55E' : 'transparent',
        }}
      >
        {done && <Check size={10} color="white" />}
      </button>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold leading-snug"
          style={{
            color: done ? 'var(--text-muted)' : 'var(--app-color)',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {task.nombre}
        </p>
        {task.descripcion && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {task.descripcion}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span
            className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
            style={{
              background: STATUS_BADGE[task.estado].bg,
              color: STATUS_BADGE[task.estado].color,
            }}
          >
            {STATUS_LABELS[task.estado]}
          </span>
          <span className="label-caps">{WHEN_LABELS[task.cuando]}</span>
          {task.fecha_objetivo && (
            <span className="label-caps">{task.fecha_objetivo}</span>
          )}
        </div>
      </div>

      {/* Quick status cycle */}
      {!done && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400"
            style={{ background: 'var(--divider)' }}
          >
            <ChevronDown size={12} />
          </button>
          {showStatusMenu && (
            <div
              className="absolute right-0 top-8 z-50 rounded-xl overflow-hidden"
              style={{ background: 'var(--card-bg)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 140, border: '1px solid var(--card-border)' }}
            >
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(s as TaskStatus); setShowStatusMenu(false) }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center gap-2"
                  style={{ color: 'var(--app-color)' }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_BADGE[s as TaskStatus].bg }} />
                  {STATUS_LABELS[s as TaskStatus]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit & delete */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300" style={{ background: 'transparent' }}>
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300" style={{ background: 'transparent' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
