-- TenantLens core schema + RLS + Storage
-- Run in Supabase SQL Editor or: supabase db push (if using Supabase CLI linked project)

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  agency_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, agency_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'agency_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Properties (owned by auth user)
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  address text not null,
  suburb text not null,
  city text not null,
  weekly_rent integer not null,
  bedrooms integer not null default 0,
  bathrooms integer not null default 0,
  parking integer not null default 0,
  image_url text not null default '',
  status text not null check (status in ('active', 'leased', 'draft')),
  required_documents text[] not null default '{}',
  created_at date not null default (timezone('utc', now()))::date
);

create index if not exists properties_user_id_idx on public.properties (user_id);

alter table public.properties enable row level security;

create policy "properties_select_own"
  on public.properties for select
  using (auth.uid() = user_id);

create policy "properties_insert_own"
  on public.properties for insert
  with check (auth.uid() = user_id);

create policy "properties_update_own"
  on public.properties for update
  using (auth.uid() = user_id);

create policy "properties_delete_own"
  on public.properties for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Applicants
-- ---------------------------------------------------------------------------
create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null default '',
  occupation text not null default '',
  weekly_income integer not null,
  submitted_documents text[] not null default '{}',
  rental_history jsonb not null default '{}'::jsonb,
  applied_at date not null default (timezone('utc', now()))::date,
  notes text,
  status text not null default 'new' check (status in ('new', 'shortlisted', 'rejected'))
);

create index if not exists applicants_property_id_idx on public.applicants (property_id);

alter table public.applicants enable row level security;

create policy "applicants_select_via_property"
  on public.applicants for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = applicants.property_id and p.user_id = auth.uid()
    )
  );

create policy "applicants_insert_via_property"
  on public.applicants for insert
  with check (
    exists (
      select 1 from public.properties p
      where p.id = applicants.property_id and p.user_id = auth.uid()
    )
  );

create policy "applicants_update_via_property"
  on public.applicants for update
  using (
    exists (
      select 1 from public.properties p
      where p.id = applicants.property_id and p.user_id = auth.uid()
    )
  );

create policy "applicants_delete_via_property"
  on public.applicants for delete
  using (
    exists (
      select 1 from public.properties p
      where p.id = applicants.property_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Applicant documents (metadata + Storage path)
-- ---------------------------------------------------------------------------
create table if not exists public.applicant_documents (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  document_key text not null,
  storage_path text not null,
  original_filename text,
  created_at timestamptz not null default now()
);

create index if not exists applicant_documents_applicant_id_idx on public.applicant_documents (applicant_id);

alter table public.applicant_documents enable row level security;

create policy "applicant_documents_all_via_property"
  on public.applicant_documents for all
  using (
    exists (
      select 1 from public.applicants a
      join public.properties p on p.id = a.property_id
      where a.id = applicant_documents.applicant_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.applicants a
      join public.properties p on p.id = a.property_id
      where a.id = applicant_documents.applicant_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Application requirements (optional normalisation; kept for brief alignment)
-- ---------------------------------------------------------------------------
create table if not exists public.application_requirements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  document_key text not null,
  unique (property_id, document_key)
);

alter table public.application_requirements enable row level security;

create policy "application_requirements_via_property"
  on public.application_requirements for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = application_requirements.property_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = application_requirements.property_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Analysis results (optional snapshots for future use)
-- ---------------------------------------------------------------------------
create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analysis_results_applicant_id_idx on public.analysis_results (applicant_id);

alter table public.analysis_results enable row level security;

create policy "analysis_results_via_property"
  on public.analysis_results for all
  using (
    exists (
      select 1 from public.applicants a
      join public.properties p on p.id = a.property_id
      where a.id = analysis_results.applicant_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.applicants a
      join public.properties p on p.id = a.property_id
      where a.id = analysis_results.applicant_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('applicant-documents', 'applicant-documents', false)
on conflict (id) do nothing;

create policy "storage_applicant_docs_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'applicant-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "storage_applicant_docs_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'applicant-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "storage_applicant_docs_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'applicant-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );
