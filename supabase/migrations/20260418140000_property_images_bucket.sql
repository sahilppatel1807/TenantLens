-- Public bucket for property cover images (stable public URLs in properties.image_url)

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

create policy "storage_property_images_select_public"
  on storage.objects for select
  using (bucket_id = 'property-images');

create policy "storage_property_images_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "storage_property_images_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and split_part(name, '/', 1) = auth.uid()::text
  );
