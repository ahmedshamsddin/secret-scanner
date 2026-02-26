-- ============================================================
-- Secret Scanner - Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- SCANS TABLE
-- ============================================================
create table public.scans (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  title           text not null default 'Untitled Scan',
  source_type     text not null default 'zip' check (source_type in ('zip', 'github')),
  repo_url        text,                    -- GitHub URL (github scans)
  repo_name       text,                    -- e.g. "owner/repo"
  branch          text,                    -- default branch scanned
  status          text not null default 'pending' check (status in ('pending', 'scanning', 'completed', 'failed')),
  total_findings  int not null default 0,
  critical_count  int not null default 0,
  high_count      int not null default 0,
  medium_count    int not null default 0,
  low_count       int not null default 0,
  scanned_files   int not null default 0,
  scanned_lines   int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- FINDINGS TABLE
-- NOTE: raw_match is always redacted before storage.
--       The plain secret never reaches this table.
-- ============================================================
create table public.findings (
  id                uuid primary key default uuid_generate_v4(),
  scan_id           uuid references public.scans(id) on delete cascade not null,
  secret_type       text not null,
  severity          text not null check (severity in ('critical', 'high', 'medium', 'low')),
  file_path         text not null,         -- relative path within repo
  line_number       int,
  column_start      int,
  raw_match         text not null,         -- REDACTED (e.g. AKIA****MPLE)
  pattern_name      text not null,
  description       text,
  remediation       text,
  is_false_positive boolean default false,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.scans enable row level security;
alter table public.findings enable row level security;

create policy "Users can view own scans"    on public.scans for select using (auth.uid() = user_id);
create policy "Users can insert own scans"  on public.scans for insert with check (auth.uid() = user_id);
create policy "Users can update own scans"  on public.scans for update using (auth.uid() = user_id);
create policy "Users can delete own scans"  on public.scans for delete using (auth.uid() = user_id);

create policy "Users can view own findings"
  on public.findings for select
  using (exists (select 1 from public.scans where scans.id = findings.scan_id and scans.user_id = auth.uid()));

create policy "Users can insert findings for own scans"
  on public.findings for insert
  with check (exists (select 1 from public.scans where scans.id = findings.scan_id and scans.user_id = auth.uid()));

create policy "Users can update findings for own scans"
  on public.findings for update
  using (exists (select 1 from public.scans where scans.id = findings.scan_id and scans.user_id = auth.uid()));

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_scans_user_id    on public.scans(user_id);
create index idx_scans_created_at on public.scans(created_at desc);
create index idx_findings_scan_id on public.findings(scan_id);
create index idx_findings_severity on public.findings(severity);
create index idx_findings_file_path on public.findings(file_path);

-- ============================================================
-- UPDATED_AT trigger
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger scans_updated_at
  before update on public.scans
  for each row execute procedure public.handle_updated_at();
