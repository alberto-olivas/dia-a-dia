-- ============================================================
-- Día a Día — Schema Supabase
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extensión UUID
create extension if not exists "uuid-ossp";

-- ── Tabla: tasks ────────────────────────────────────────────
create table if not exists public.tasks (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  nombre        text not null,
  cuando        text not null default 'hoy',
  fecha_objetivo date,
  estado        text not null default 'por_hacer',
  fecha_creacion timestamptz not null default now()
);

-- ── Tabla: food_entries ─────────────────────────────────────
create table if not exists public.food_entries (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  fecha            date not null default current_date,
  apartado         text not null,
  nombre_alimento  text not null,
  cantidad_gramos  numeric not null default 100,
  calorias         integer not null default 0,
  timestamp        timestamptz not null default now()
);

-- ── Tabla: workouts ─────────────────────────────────────────
create table if not exists public.workouts (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  fecha               date not null default current_date,
  tipo                text not null,
  duracion_minutos    integer not null default 0,
  calorias_quemadas   integer not null default 0
);

-- ── Activar Row Level Security ───────────────────────────────
alter table public.tasks enable row level security;
alter table public.food_entries enable row level security;
alter table public.workouts enable row level security;

-- ── Políticas RLS: tasks ─────────────────────────────────────
create policy "tasks_select" on public.tasks
  for select using (auth.uid() = user_id);
create policy "tasks_insert" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update" on public.tasks
  for update using (auth.uid() = user_id);
create policy "tasks_delete" on public.tasks
  for delete using (auth.uid() = user_id);

-- ── Políticas RLS: food_entries ──────────────────────────────
create policy "food_select" on public.food_entries
  for select using (auth.uid() = user_id);
create policy "food_insert" on public.food_entries
  for insert with check (auth.uid() = user_id);
create policy "food_update" on public.food_entries
  for update using (auth.uid() = user_id);
create policy "food_delete" on public.food_entries
  for delete using (auth.uid() = user_id);

-- ── Políticas RLS: workouts ──────────────────────────────────
create policy "workouts_select" on public.workouts
  for select using (auth.uid() = user_id);
create policy "workouts_insert" on public.workouts
  for insert with check (auth.uid() = user_id);
create policy "workouts_update" on public.workouts
  for update using (auth.uid() = user_id);
create policy "workouts_delete" on public.workouts
  for delete using (auth.uid() = user_id);

-- ── Índices para rendimiento ─────────────────────────────────
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_cuando_idx on public.tasks(cuando);
create index if not exists food_user_fecha_idx on public.food_entries(user_id, fecha);
create index if not exists workouts_user_fecha_idx on public.workouts(user_id, fecha);
