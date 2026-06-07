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

const STATUS_COLORS: Record<TaskStatus, string> = {
  por_hacer: '#E5E7EB',
  en_proceso: '#FF6B35',
  terminada: '#22C55E',
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
  const [newCuando, setNewCuando] = useState<TaskWhen>('hoy')
  const [newFechaObj, setNewFechaObj] = useState('')
  const [newEstado, setNewEstado] = useState<TaskStatus>('por_hacer')
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editCuando, setEditCuando] = useState<TaskWhen>('hoy')
  const [editFechaObj, setEditFechaObj] = useState('')
  const [editEstado, setEditEstado] = useState<TaskStatus>('por_hacer')

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!user || !IS_SUPABASE_CONFIGURED) { setLoading(false); return }
    fetchTasks()
    fetchWeeklyData()
  }, [user])

  async function fetchTasks() {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user!.id)
      .order('fecha_creacion', { ascending: false })
    setTasks(data ?? [])
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
    const { data } = await supabase.from('tasks').insert({
      user_id: user!.id,
      nombre: newNombre.trim(),
      cuando: newCuando,
      fecha_objetivo: newCuando === 'fecha' ? newFechaObj : null,
      estado: newEstado,
      fecha_creacion: new Date().toISOString(),
    }).select().single()
    if (data) setTasks((t) => [data, ...t])
    setNewNombre('')
    setNewCuando('hoy')
    setNewFechaObj('')
    setNewEstado('por_hacer')
    setShowForm(false)
    setSaving(false)
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks((t) => t.filter((x) => x.id !== id))
  }

  function startEdit(task: Task) {
    setEditId(task.id)
    setEditNombre(task.nombre)
    setEditCuando(task.cuando)
    setEditFechaObj(task.fecha_objetivo ?? '')
    setEditEstado(task.estado)
  }

  async function saveEdit(id: string) {
    const { data } = await supabase.from('tasks').update({
      nombre: editNombre,
      cuando: editCuando,
      fecha_objetivo: editCuando === 'fecha' ? editFechaObj : null,
      estado: editEstado,
    }).eq('id', id).select().single()
    if (data) setTasks((t) => t.map((x) => x.id === id ? data : x))
    setEditId(null)
  }

  async function quickStatusChange(task: Task, newStatus: TaskStatus) {
    const { data } = await supabase.from('tasks').update({ estado: newStatus }).eq('id', task.id).select().single()
    if (data) setTasks((t) => t.map((x) => x.id === task.id ? data : x))
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
          <h1 className="font-black text-3xl text-gray-900">GESTOR</h1>
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
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="label-caps block mb-1">Progreso total</span>
            <span className="font-black text-3xl text-gray-900">{pct}%</span>
          </div>
          <div className="text-right">
            <div className="font-black text-2xl leading-none" style={{ color: '#22C55E' }}>{completedCount}</div>
            <div className="label-caps">completadas</div>
            <div className="font-bold text-lg leading-none text-gray-400 mt-1">{pending.length}</div>
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
            className="w-full px-4 py-3 text-sm rounded-xl mb-4"
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
                    editCuando={editCuando}
                    editFechaObj={editFechaObj}
                    editEstado={editEstado}
                    onEdit={() => startEdit(task)}
                    onSaveEdit={() => saveEdit(task.id)}
                    onCancelEdit={() => setEditId(null)}
                    onDelete={() => deleteTask(task.id)}
                    onStatusChange={(s) => quickStatusChange(task, s)}
                    setEditNombre={setEditNombre}
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
                    editCuando={editCuando}
                    editFechaObj={editFechaObj}
                    editEstado={editEstado}
                    onEdit={() => startEdit(task)}
                    onSaveEdit={() => saveEdit(task.id)}
                    onCancelEdit={() => setEditId(null)}
                    onDelete={() => deleteTask(task.id)}
                    onStatusChange={(s) => quickStatusChange(task, s)}
                    setEditNombre={setEditNombre}
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
  editCuando: TaskWhen
  editFechaObj: string
  editEstado: TaskStatus
  onEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  onStatusChange: (s: TaskStatus) => void
  setEditNombre: (v: string) => void
  setEditCuando: (v: TaskWhen) => void
  setEditFechaObj: (v: string) => void
  setEditEstado: (v: TaskStatus) => void
}

function TaskCard({
  task, isEditing, editNombre, editCuando, editFechaObj, editEstado,
  onEdit, onSaveEdit, onCancelEdit, onDelete, onStatusChange,
  setEditNombre, setEditCuando, setEditFechaObj, setEditEstado,
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
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase bg-gray-100 text-gray-500"
          >
            <X size={12} /> Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="card flex items-center gap-3 px-4 py-3.5"
      style={{ opacity: done ? 0.7 : 1 }}
    >
      {/* Checkbox */}
      <button
        onClick={() => onStatusChange(done ? 'por_hacer' : 'terminada')}
        className="w-5 h-5 rounded-md flex items-center justify-center border-2 flex-shrink-0 transition-all"
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
          className="text-sm font-semibold"
          style={{
            color: done ? '#9CA3AF' : '#1A1A1A',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {task.nombre}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
            style={{
              background: task.estado === 'en_proceso' ? '#FFF4EF' : '#F5F5F7',
              color: STATUS_COLORS[task.estado],
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
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-gray-400"
          >
            <ChevronDown size={12} />
          </button>
          {showStatusMenu && (
            <div
              className="absolute right-0 top-8 z-10 rounded-xl overflow-hidden"
              style={{ background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 140 }}
            >
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(s); setShowStatusMenu(false) }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 transition-colors"
                  style={{ color: STATUS_COLORS[s] || '#1A1A1A' }}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit & delete */}
      <div className="flex items-center gap-0.5">
        <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-300">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-300">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
