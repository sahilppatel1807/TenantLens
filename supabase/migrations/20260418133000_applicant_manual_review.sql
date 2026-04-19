alter table public.applicants
add column if not exists manual_review jsonb not null default '{"incomeExtractionFailed":false,"referenceExtractionFailed":false}'::jsonb;
