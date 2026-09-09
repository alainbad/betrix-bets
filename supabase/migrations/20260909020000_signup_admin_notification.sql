-- Emails the current ultra_admin whenever a new player signs up.
--
-- All the DB work happens here: resolve the current ultra_admin's email
-- (not hardcoded, so it keeps working if that role ever moves to a
-- different account), pull the new signup's own details plus who referred
-- them, and hand the finished payload to the notify-new-signup Edge
-- Function over pg_net (already enabled) - that function has no database
-- access at all and exists purely to hold the Resend API key.
--
-- The webhook secret is generated once here and stored in Supabase Vault so
-- it never appears in migration history / git. The exact same value must
-- also be set as the notify-new-signup function's SIGNUP_HOOK_SECRET Edge
-- Function secret (via the Supabase dashboard - there is no SQL path to an
-- Edge Function's own secret store) for the header check on that end to
-- match; until that's done the trigger will fire and log a failed call
-- (fire-and-forget, so it never blocks or fails a signup) but no email
-- will actually send.
do $$
declare
  _secret text;
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'signup_hook_secret') then
    _secret := encode(gen_random_bytes(24), 'hex');
    perform vault.create_secret(
      _secret,
      'signup_hook_secret',
      'Shared secret between the signup-notification trigger and the notify-new-signup Edge Function'
    );
  end if;
end $$;

create or replace function public.notify_admin_of_new_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin_email text;
  _referrer_username text;
  _hook_secret text;
begin
  select p.email into _admin_email
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'ultra_admin'
  limit 1;

  -- No ultra_admin configured yet (shouldn't happen post-bootstrap, but
  -- this trigger must never fail a signup over it either way).
  if _admin_email is null then
    return new;
  end if;

  if new.parent_id is not null then
    select username into _referrer_username from public.profiles where id = new.parent_id;
  end if;

  select decrypted_secret into _hook_secret
  from vault.decrypted_secrets where name = 'signup_hook_secret';

  perform net.http_post(
    url := 'https://wntvnlmzczywehaurxrm.supabase.co/functions/v1/notify-new-signup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', _hook_secret),
    body := jsonb_build_object(
      'admin_email', _admin_email,
      'username', new.username,
      'email', new.email,
      'account_id', new.account_id,
      'referred_by', _referrer_username,
      'created_at', new.created_at
    )
  );

  return new;
end;
$$;

drop trigger if exists profiles_notify_admin_of_new_signup on public.profiles;
create trigger profiles_notify_admin_of_new_signup
  after insert on public.profiles
  for each row execute function public.notify_admin_of_new_signup();
