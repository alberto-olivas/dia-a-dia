'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { Task, TaskWhen, TaskStatus } from '@/lib/types'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'

const WHEN_LABELS: Record<TaskWhen, string> = {
  hoy: 'Hoy',
  manana: 'Mañana',
  semana: 'Esta semana',
  fecha: 'Antes de fecha',
  sin_fecha: 'Sin fecha',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  por_hacer: 'Por hacer',
  en_proceso: 'En proceso',
  terminada: 'Terminada',
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  por_hacer: '#555555',
  en_proceso: '#FF2D00',
  terminada: '#333333',
}

function sortTasks(tasks: Task[]): Task[] {
  const order: Record<TaskWhen, number> = { hoy: 0, manana: 1, semana: 2, fecha: 3, sin_fecha: 4 }
  return [...tasks].sort((a, b) => {
    // Terminadas al final
    if (a.estado === 'terminada' && b.estado !== 'terminada') return 1
    if (b.estado === 'terminada' && a.estado !== 'terminada') return -1
    return (order[a.cuando] ?? 4) - (order[b.cuando] ?? 4)
  })
}

export default function GestorPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // New task state
  const [newNombre, setNewNombre] = useState('')
  const [newCuando, setNewCuando] = useState<TaskWhen>('hoy')
  const [newFechaObj, setNewFechaObj] = useState('')
  const [newEstado, setNewEstado] = useState<TaskStatus>('por_hacer')
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editCuando, setEditCuando] = useState<TaskWhen>('hoy')
  const [editFechaObj, setEditFechaObj] = useState('')
  const [editEstado, setEditEstado] = useState<TaskStatus>('por_hacer')

  useEffect(() => {
    if (!user) return
    fetchTasks()
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

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10">

      {/* ── Header ─────────────────────────────────── */}
      <header className="mb-8">
        <span className="label-caps block mb-1">Módulo 01</span>
        <div className="flex items-end justify-between">
          <h1 className="font-black" style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', color: '#ffffff', lineHeight: 1 }}>
            GESTOR
          </h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-3 text-xs font-bold tracking-widest uppercase"
            style={{ background: showForm ? '#1a1a1a' : '#FF2D00', color: '#ffffff', border: showForm ? '1px solid #2a2a2a' : 'none' }}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancelar' : 'Nueva tarea'}
          </button>
        </div>
        <div className="w-8 h-0.5 mt-3" style={{ background: '#FF2D00' }} />
      </header>

      {/* ── New task form ───────────────────────────── */}
      {showForm && (
        <form onSubmit={createTask} className="mb-8 p-5 card">
          <span className="label-caps block mb-4">Nueva tarea</span>

          <div className="flex flex-col gap-4">
            <input
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              placeholder="Nombre de la tarea..."
              required
              className="px-4 py-3 text-sm rounded-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="label-caps">Cuándo</label>
                <select
                  value={newCuando}
                  onChange={(e) => setNewCuando(e.target.value as TaskWhen)}
                  className="px-3 py-3 text-sm rounded-none"
                >
                  {(Object.keys(WHEN_LABELS) as TaskWhen[]).map((k) => (
                    <option key={k} value={k}>{WHEN_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="label-caps">Estado</label>
                <select
                  value={newEstado}
                  onChange={(e) => setNewEstado(e.target.value as TaskStatus)}
                  className="px-3 py-3 text-sm rounded-none"
                >
                  {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((k) => (
                    <option key={k} value={k}>{STATUS_LABELS[k]}</option>
                  ))}
                </select>
              </div>
            </div>

            {newCuando === 'fecha' && (
              <input
                type="date"
                value={newFechaObj}
                onChange={(e) => setNewFechaObj(e.target.value)}
                className="px-3 py-3 text-sm rounded-none"
              />
            )}

            <button
              type="submit"
              disabled={saving}
              className="py-3 text-xs font-bold tracking-widest uppercase disabled:opacity-50"
              style={{ background: '#FF2D00', color: '#ffffff' }}
            >
              Crear tarea
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#FF2D00] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Pending tasks ──────────────────────── */}
          {pending.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="label-caps">Pendientes</span>
                <span
                  className="text-xs font-bold px-2 py-0.5"
                  style={{ background: '#FF2D00', color: '#fff' }}
                >
                  {pending.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {pending.map((task) => (
                  <TaskRow
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

          {/* ── Completed tasks ────────────────────── */}
          {done.length > 0 && (
            <section>
              <div className="divider mb-4" />
              <span className="label-caps block mb-3">Terminadas ({done.length})</span>
              <div className="flex flex-col gap-2">
                {done.map((task) => (
                  <TaskRow
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
              <p className="text-sm mb-1" style={{ color: '#555555' }}>Sin tareas todavía</p>
              <p className="text-xs" style={{ color: '#333333' }}>Crea tu primera tarea arriba</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface TaskRowProps {
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

function TaskRow({
  task, isEditing, editNombre, editCuando, editFechaObj, editEstado,
  onEdit, onSaveEdit, onCancelEdit, onDelete, onStatusChange,
  setEditNombre, setEditCuando, setEditFechaObj, setEditEstado
}: TaskRowProps) {
  const done = task.estado === 'terminada'

  if (isEditing) {
    return (
      <div className="card p-4 flex flex-col gap-3">
        <input
          value={editNombre}
          onChange={(e) => setEditNombre(e.target.value)}
          className="px-3 py-2 text-sm rounded-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={editCuando}
            onChange={(e) => setEditCuando(e.target.value as TaskWhen)}
            className="px-3 py-2 text-sm rounded-none"
          >
            {(Object.keys(WHEN_LABELS) as TaskWhen[]).map((k) => (
              <option key={k} value={k}>{WHEN_LABELS[k]}</option>
            ))}
          </select>
          <select
            value={editEstado}
            onChange={(e) => setEditEstado(e.target.value as TaskStatus)}
            className="px-3 py-2 text-sm rounded-none"
          >
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((k) => (
              <option key={k} value={k}>{STATUS_LABELS[k]}</option>
            ))}
          </select>
        </div>
        {editCuando === 'fecha' && (
          <input
            type="date"
            value={editFechaObj}
            onChange={(e) => setEditFechaObj(e.target.value)}
            className="px-3 py-2 text-sm rounded-none"
          />
        )}
        <div className="flex gap-2">
          <button
            onClick={onSaveEdit}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-widest uppercase"
            style={{ background: '#FF2D00', color: '#fff' }}
          >
            <Check size={12} /> Guardar
          </button>
          <button
            onClick={onCancelEdit}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-widest uppercase"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888' }}
          >
            <X size={12} /> Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{
        background: '#111111',
        borderLeft: `2px solid ${done ? '#2a2a2a' : STATUS_COLORS[task.estado]}`,
        opacity: done ? 0.6 : 1,
      }}
    >
      {/* Status toggle */}
      <button
        onClick={() => onStatusChange(done ? 'por_hacer' : 'terminada')}
        className="shrink-0 w-5 h-5 flex items-center justify-center border"
        style={{ borderColor: done ? '#3a3a3a' : '#FF2D00', background: done ? '#2a2a2a' : 'transparent' }}
      >
        {done && <Check size={10} style={{ color: '#555' }} />}
      </button>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold truncate"
          style={{
            color: done ? '#444' : '#ffffff',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {task.nombre}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="label-caps">{WHEN_LABELS[task.cuando]}</span>
          {task.fecha_objetivo && (
            <span className="label-caps">{task.fecha_objetivo}</span>
          )}
          <span
            className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5"
            style={{ background: 'rgba(255,45,0,0.1)', color: STATUS_COLORS[task.estado] }}
          >
            {STATUS_LABELS[task.estado]}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="w-7 h-7 flex items-center justify-center"
          style={{ color: '#444' }}
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center"
          style={{ color: '#444' }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
