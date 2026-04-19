-- Best-effort rollback of four-category normalization.
-- Note: this is lossy because prior values collapsed into canonical keys.

update public.properties
set required_documents = (
  select coalesce(array_agg(distinct mapped_key), '{}'::text[])
  from unnest(coalesce(required_documents, '{}'::text[])) as raw_key
  cross join lateral (
    select case raw_key
      when 'id' then 'passport'
      when 'proof_of_income' then 'employment_letter'
      when 'rental_history' then 'references'
      else raw_key
    end as mapped_key
  ) mapped
);

update public.applicants
set submitted_documents = (
  select coalesce(array_agg(distinct mapped_key), '{}'::text[])
  from unnest(coalesce(submitted_documents, '{}'::text[])) as raw_key
  cross join lateral (
    select case raw_key
      when 'id' then 'passport'
      when 'proof_of_income' then 'employment_letter'
      when 'rental_history' then 'references'
      else raw_key
    end as mapped_key
  ) mapped
);

update public.applicant_documents
set document_key = case document_key
  when 'id' then 'passport'
  when 'proof_of_income' then 'employment_letter'
  when 'rental_history' then 'references'
  else document_key
end
where document_key in ('id', 'proof_of_income', 'rental_history');
