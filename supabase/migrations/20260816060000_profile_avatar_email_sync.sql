-- Profile editing support: avatar storage bucket + profiles.email sync.

-- ============================================================
-- AVATAR STORAGE
-- Public read (avatars are shown to other players), writes scoped to a
-- folder named after the uploader's own user id.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- EMAIL SYNC
-- Supabase Auth email changes go through its own confirmation flow
-- (auth.updateUser). Once confirmed, auth.users.email changes — mirror
-- that into profiles.email so admin/player views stay accurate.
-- ============================================================

create function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update on auth.users
  for each row execute function public.handle_user_email_updated();
