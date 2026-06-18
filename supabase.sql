-- Stop Motion Studio Classroom By Kru Dew
-- รันไฟล์นี้ใน Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text unique not null,
  student_name text not null,
  room text not null,
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  project_name text not null,
  description text,
  cover_url text,
  frame_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.frames (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  frame_number integer not null,
  image_url text not null,
  created_at timestamptz default now()
);

create index if not exists idx_projects_student_id on public.projects(student_id);
create index if not exists idx_frames_project_id on public.frames(project_id);
create index if not exists idx_frames_order on public.frames(project_id, frame_number);

-- เปิด RLS
alter table public.students enable row level security;
alter table public.projects enable row level security;
alter table public.frames enable row level security;

-- Policy แบบห้องเรียน: ทุกคนอ่าน/เพิ่ม/แก้ไข/ลบได้ผ่าน anon key
-- เหมาะกับ GitHub Pages + งานในชั้นเรียน ไม่ใช่ระบบข้อมูลลับ
create policy "students_select_all" on public.students for select using (true);
create policy "students_insert_all" on public.students for insert with check (true);
create policy "students_update_all" on public.students for update using (true) with check (true);
create policy "students_delete_all" on public.students for delete using (true);

create policy "projects_select_all" on public.projects for select using (true);
create policy "projects_insert_all" on public.projects for insert with check (true);
create policy "projects_update_all" on public.projects for update using (true) with check (true);
create policy "projects_delete_all" on public.projects for delete using (true);

create policy "frames_select_all" on public.frames for select using (true);
create policy "frames_insert_all" on public.frames for insert with check (true);
create policy "frames_update_all" on public.frames for update using (true) with check (true);
create policy "frames_delete_all" on public.frames for delete using (true);

-- Storage Policy: หลังสร้าง bucket stop-motion-frames แล้วค่อยรันส่วนนี้ได้
-- ถ้ารันแล้ว error เพราะยังไม่มี bucket ให้ไปสร้าง bucket ก่อน แล้วรันใหม่
insert into storage.buckets (id, name, public)
values ('stop-motion-frames', 'stop-motion-frames', true)
on conflict (id) do update set public = true;

create policy "stop_motion_public_read" on storage.objects
for select using (bucket_id = 'stop-motion-frames');

create policy "stop_motion_public_insert" on storage.objects
for insert with check (bucket_id = 'stop-motion-frames');

create policy "stop_motion_public_update" on storage.objects
for update using (bucket_id = 'stop-motion-frames') with check (bucket_id = 'stop-motion-frames');

create policy "stop_motion_public_delete" on storage.objects
for delete using (bucket_id = 'stop-motion-frames');
