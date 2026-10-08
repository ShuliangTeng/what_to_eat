-- One-time device pairing. Does not delete household rows or disable RLS.
-- Standing invitation codes can no longer be used to join.

create table private.pairing_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index pairing_codes_hash_idx on private.pairing_codes (code_hash);
revoke all on table private.pairing_codes from public, anon, authenticated;

create table private.pairing_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);

create index pairing_attempts_user_time_idx on private.pairing_attempts (user_id, attempted_at desc);
revoke all on table private.pairing_attempts from public, anon, authenticated;

create or replace function private.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  hid uuid;
  code text := '';
  attempt integer := 0;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea;
  i integer;
begin
  if actor is null then
    raise exception '需要登录';
  end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception '你已经加入了一个家庭';
  end if;
  loop
    attempt := attempt + 1;
    raw := extensions.gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, (get_byte(raw, i) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
    if attempt > 5 then
      raise exception '邀请码没有生成成功，请再试一次';
    end if;
  end loop;
  insert into public.households (name, invite_code, created_by)
  values (coalesce(nullif(btrim(household_name), ''), '我们的小厨房'), code, actor)
  returning id into hid;
  insert into public.household_members (household_id, user_id, role, display_name)
  values (hid, actor, 'owner', '这台设备');
  insert into public.household_settings (household_id) values (hid);
  return hid;
end;
$$;

create or replace function private.household_has_user_activity(hid uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.inventory_items where household_id = hid)
    or exists (select 1 from public.grocery_items where household_id = hid)
    or exists (select 1 from public.preference_events where household_id = hid)
    or exists (
      select 1 from public.planned_meals
      where household_id = hid and status <> 'suggested'
    );
$$;

revoke all on function private.household_has_user_activity(uuid) from public, anon, authenticated;

create or replace function private.create_pairing_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  hid uuid;
  member_count integer;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea;
  code text := '';
  i integer;
begin
  if actor is null then
    raise exception '这台设备还没有连上';
  end if;
  select household_id into hid from public.household_members where user_id = actor;
  if hid is null then
    raise exception '还没有可以共用的菜单';
  end if;
  select count(*) into member_count from public.household_members where household_id = hid;
  if member_count >= 2 then
    raise exception '已经有两台设备在共用这份菜单';
  end if;
  if (
    select count(*)
    from private.pairing_attempts
    where user_id = actor
      and attempted_at > now() - interval '15 minutes'
  ) >= 8 then
    raise exception '尝试次数太多，请过一会儿再试';
  end if;
  insert into private.pairing_attempts (user_id) values (actor);
  update private.pairing_codes
  set used_at = now()
  where household_id = hid and used_at is null;
  raw := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(raw, i) % length(alphabet)) + 1, 1);
  end loop;
  insert into private.pairing_codes (household_id, code_hash, expires_at, created_by)
  values (
    hid,
    encode(extensions.digest(code, 'sha256'), 'hex'),
    now() + interval '10 minutes',
    actor
  );
  return code;
end;
$$;

create or replace function private.redeem_pairing_code(raw_code text, confirm_switch boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  normalized text;
  hid uuid;
  current_hid uuid;
  member_count integer;
begin
  if actor is null then
    raise exception '这台设备还没有连上';
  end if;
  if (
    select count(*)
    from private.pairing_attempts
    where user_id = actor
      and attempted_at > now() - interval '15 minutes'
  ) >= 8 then
    raise exception '尝试次数太多，请过一会儿再试';
  end if;
  insert into private.pairing_attempts (user_id) values (actor);
  normalized := upper(regexp_replace(coalesce(raw_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(normalized) <> 8 then
    raise exception '配对码不对';
  end if;
  select household_id into hid
  from private.pairing_codes
  where code_hash = encode(extensions.digest(normalized, 'sha256'), 'hex')
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;
  if hid is null then
    raise exception '配对码不对，或已经过期';
  end if;
  select household_id into current_hid from public.household_members where user_id = actor;
  if current_hid = hid then
    update private.pairing_codes
    set used_at = now()
    where code_hash = encode(extensions.digest(normalized, 'sha256'), 'hex')
      and used_at is null;
    return hid;
  end if;
  select count(*) into member_count from public.household_members where household_id = hid;
  if member_count >= 2 then
    raise exception '已经有两台设备在共用这份菜单';
  end if;
  if current_hid is not null then
    if (select count(*) from public.household_members where household_id = current_hid) > 1 then
      raise exception '这台设备已经和另一台共用菜单';
    end if;
    if private.household_has_user_activity(current_hid) and not coalesce(confirm_switch, false) then
      raise exception '这台设备上已经有改过的菜单。确认后会改看对方的菜单，原来的记录仍留在数据库里，但这台设备不再打开。';
    end if;
    delete from public.household_members where user_id = actor;
  end if;
  insert into public.household_members (household_id, user_id, role, display_name)
  values (hid, actor, 'member', '另一台设备');
  update private.pairing_codes
  set used_at = now()
  where code_hash = encode(extensions.digest(normalized, 'sha256'), 'hex')
    and used_at is null;
  return hid;
end;
$$;

revoke all on function private.create_pairing_code() from public, anon, authenticated;
revoke all on function private.redeem_pairing_code(text, boolean) from public, anon, authenticated;
grant execute on function private.create_pairing_code() to authenticated;
grant execute on function private.redeem_pairing_code(text, boolean) to authenticated;

create or replace function public.create_pairing_code()
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.create_pairing_code();
$$;

create or replace function public.redeem_pairing_code(raw_code text, confirm_switch boolean)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.redeem_pairing_code(raw_code, confirm_switch);
$$;

revoke all on function public.create_pairing_code() from public, anon;
revoke all on function public.redeem_pairing_code(text, boolean) from public, anon;
grant execute on function public.create_pairing_code() to authenticated;
grant execute on function public.redeem_pairing_code(text, boolean) to authenticated;

create or replace function public.join_household(invite_code text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '请在「另一台设备」里使用一次性配对码';
end;
$$;
