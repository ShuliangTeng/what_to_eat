-- Keep failed pairing guesses, and remove table privileges that bypass row level security.
-- This does not delete household rows.

drop function if exists public.redeem_pairing_code(text, boolean);
drop function if exists private.redeem_pairing_code(text, boolean);

create function private.redeem_pairing_code(raw_code text, confirm_switch boolean)
returns text
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
    return '这台设备还没有连上';
  end if;
  if (
    select count(*)
    from private.pairing_attempts
    where user_id = actor
      and attempted_at > now() - interval '15 minutes'
  ) >= 8 then
    return '尝试次数太多，请过一会儿再试';
  end if;
  insert into private.pairing_attempts (user_id) values (actor);
  normalized := upper(regexp_replace(coalesce(raw_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(normalized) <> 8 then
    return '配对码不对';
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
    return '配对码不对，或已经过期';
  end if;
  select household_id into current_hid from public.household_members where user_id = actor;
  if current_hid = hid then
    update private.pairing_codes
    set used_at = now()
    where code_hash = encode(extensions.digest(normalized, 'sha256'), 'hex')
      and used_at is null;
    return 'ok';
  end if;
  select count(*) into member_count from public.household_members where household_id = hid;
  if member_count >= 2 then
    return '已经有两台设备在共用这份菜单';
  end if;
  if current_hid is not null then
    if (select count(*) from public.household_members where household_id = current_hid) > 1 then
      return '这台设备已经和另一台共用菜单';
    end if;
    if private.household_has_user_activity(current_hid) and not coalesce(confirm_switch, false) then
      return '这台设备上已经有改过的菜单。确认后会改看对方的菜单，原来的记录仍留在数据库里，但这台设备不再打开。';
    end if;
    delete from public.household_members where user_id = actor;
  end if;
  insert into public.household_members (household_id, user_id, role, display_name)
  values (hid, actor, 'member', '另一台设备');
  update private.pairing_codes
  set used_at = now()
  where code_hash = encode(extensions.digest(normalized, 'sha256'), 'hex')
    and used_at is null;
  return 'ok';
end;
$$;

revoke all on function private.redeem_pairing_code(text, boolean) from public, anon, authenticated;
grant execute on function private.redeem_pairing_code(text, boolean) to authenticated;

create function public.redeem_pairing_code(raw_code text, confirm_switch boolean)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.redeem_pairing_code(raw_code, confirm_switch);
$$;

revoke all on function public.redeem_pairing_code(text, boolean) from public, anon;
grant execute on function public.redeem_pairing_code(text, boolean) to authenticated;

revoke all on table
  public.households,
  public.household_members,
  public.household_settings,
  public.dishes,
  public.dish_ingredients,
  public.inventory_items,
  public.meal_plans,
  public.planned_meals,
  public.planned_meal_dishes,
  public.grocery_items,
  public.preference_events
from public, anon, authenticated;

grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update, delete on public.household_settings to authenticated;
grant select, insert, update, delete on public.dishes to authenticated;
grant select, insert, update, delete on public.dish_ingredients to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.planned_meals to authenticated;
grant select, insert, update, delete on public.planned_meal_dishes to authenticated;
grant select, insert, update, delete on public.grocery_items to authenticated;
grant select, insert on public.preference_events to authenticated;
