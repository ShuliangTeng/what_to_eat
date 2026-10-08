-- 今天吃什么
-- Household data is private. The browser uses the publishable/anon key only.
-- Do not put the service role key in Next.js public env vars.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.households (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  invite_code text not null unique check (char_length(invite_code) = 6),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  unique (household_id, user_id),
  unique (user_id)
);

create index household_members_household_id_idx on public.household_members (household_id);

create table public.household_settings (
  household_id uuid primary key references public.households (id) on delete cascade,
  prefer_fuzhou boolean not null default true,
  explore_new boolean not null default true,
  servings integer not null default 2 check (servings between 1 and 8),
  updated_at timestamptz not null default now()
);

create table public.dishes (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  tags text[] not null default '{}',
  category text not null,
  method text not null,
  effort text not null check (effort in ('easy', 'medium', 'labor')),
  familiarity text not null check (familiarity in ('familiar', 'supplementary', 'custom')),
  priority integer not null default 40,
  status text not null default 'active' check (status in ('active', 'paused')),
  usage text not null default 'permanent' check (usage in ('permanent', 'once')),
  is_fuzhou boolean not null default false,
  meal_role text not null check (meal_role in ('complete', 'main', 'side', 'soup', 'staple')),
  preference_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dishes_household_status_idx on public.dishes (household_id, status);
create index dishes_household_name_idx on public.dishes (household_id, name);

create table public.dish_ingredients (
  id uuid primary key default extensions.gen_random_uuid(),
  dish_id uuid not null references public.dishes (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  quantity numeric not null check (quantity >= 0),
  unit text not null check (char_length(btrim(unit)) > 0),
  role text not null check (role in ('main', 'seasoning', 'optional')),
  unusual boolean not null default false,
  position integer not null default 0
);

create index dish_ingredients_dish_id_idx on public.dish_ingredients (dish_id);
create index dish_ingredients_household_id_idx on public.dish_ingredients (household_id);

create table public.inventory_items (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  quantity numeric not null check (quantity >= 0),
  unit text not null check (char_length(btrim(unit)) > 0),
  location text not null check (location in ('refrigerator', 'freezer', 'pantry')),
  use_soon boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_household_id_idx on public.inventory_items (household_id);

create table public.meal_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (household_id, week_start)
);

create index meal_plans_household_id_idx on public.meal_plans (household_id);

create table public.planned_meals (
  id uuid primary key default extensions.gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  meal_date date not null,
  status text not null check (status in ('suggested', 'accepted', 'cooked', 'skipped', 'postponed', 'eating_out')),
  reasons text[] not null default '{}',
  effort text not null default 'easy' check (effort in ('easy', 'medium', 'labor')),
  is_new boolean not null default false,
  alternatives jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, meal_date)
);

create index planned_meals_plan_id_idx on public.planned_meals (meal_plan_id);
create index planned_meals_household_date_idx on public.planned_meals (household_id, meal_date);

create table public.planned_meal_dishes (
  id uuid primary key default extensions.gen_random_uuid(),
  planned_meal_id uuid not null references public.planned_meals (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  dish_id uuid references public.dishes (id) on delete set null,
  dish_name text not null,
  position integer not null default 0
);

create index planned_meal_dishes_meal_id_idx on public.planned_meal_dishes (planned_meal_id);
create index planned_meal_dishes_household_id_idx on public.planned_meal_dishes (household_id);

create table public.grocery_items (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  meal_plan_id uuid references public.meal_plans (id) on delete set null,
  name text not null check (char_length(btrim(name)) > 0),
  quantity numeric not null check (quantity >= 0),
  unit text not null check (char_length(btrim(unit)) > 0),
  status text not null check (status in ('needed', 'purchased')),
  source text not null default 'calculated' check (source in ('calculated', 'manual')),
  note text not null default '',
  added_to_inventory boolean not null default false,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grocery_items_household_status_idx on public.grocery_items (household_id, status);

create table public.preference_events (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  dish_id uuid references public.dishes (id) on delete set null,
  event_type text not null check (event_type in ('selected', 'favorite', 'replaced', 'cooked')),
  delta integer not null,
  created_at timestamptz not null default now()
);

create index preference_events_household_id_idx on public.preference_events (household_id);
create index preference_events_dish_id_idx on public.preference_events (dish_id);

create or replace function private.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_household_owner(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

revoke all on function private.is_household_member(uuid) from public, anon;
revoke all on function private.is_household_owner(uuid) from public, anon;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon;
grant execute on function private.touch_updated_at() to authenticated;

create trigger dishes_touch_updated_at before update on public.dishes
for each row execute function private.touch_updated_at();
create trigger inventory_touch_updated_at before update on public.inventory_items
for each row execute function private.touch_updated_at();
create trigger meals_touch_updated_at before update on public.planned_meals
for each row execute function private.touch_updated_at();
create trigger groceries_touch_updated_at before update on public.grocery_items
for each row execute function private.touch_updated_at();
create trigger settings_touch_updated_at before update on public.household_settings
for each row execute function private.touch_updated_at();

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
  values (hid, actor, 'owner', coalesce(nullif((select auth.jwt() ->> 'email'), ''), '家人'));
  insert into public.household_settings (household_id) values (hid);
  return hid;
end;
$$;

create table private.join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);

create index join_attempts_user_time_idx on private.join_attempts (user_id, attempted_at desc);
revoke all on table private.join_attempts from public, anon, authenticated;

create or replace function private.join_household(raw_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  hid uuid;
  member_count integer;
begin
  if actor is null then
    raise exception '需要登录';
  end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception '你已经加入了一个家庭';
  end if;
  if (
    select count(*)
    from private.join_attempts
    where user_id = actor
      and attempted_at > now() - interval '15 minutes'
  ) >= 8 then
    raise exception '尝试次数太多，请过一会儿再试';
  end if;
  insert into private.join_attempts (user_id) values (actor);
  select id into hid
  from public.households
  where households.invite_code = upper(btrim(raw_code))
  for update;
  if hid is null then
    raise exception '邀请码不对';
  end if;
  select count(*) into member_count from public.household_members where household_id = hid;
  if member_count >= 2 then
    raise exception '这个家庭已经有两位成员';
  end if;
  insert into public.household_members (household_id, user_id, role, display_name)
  values (hid, actor, 'member', coalesce(nullif((select auth.jwt() ->> 'email'), ''), '家人'));
  return hid;
end;
$$;

revoke all on function private.create_household(text) from public, anon;
revoke all on function private.join_household(text) from public, anon;
grant execute on function private.create_household(text) to authenticated;
grant execute on function private.join_household(text) to authenticated;

create or replace function public.create_household(household_name text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_household(household_name);
$$;

create or replace function public.join_household(invite_code text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.join_household(invite_code);
$$;

create or replace function private.enforce_household_match()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_household uuid;
begin
  if tg_table_name = 'dish_ingredients' then
    select household_id into parent_household from public.dishes where id = new.dish_id;
    if parent_household is distinct from new.household_id then
      raise exception '食材必须属于这个家庭的菜';
    end if;
  elsif tg_table_name = 'planned_meals' then
    select household_id into parent_household from public.meal_plans where id = new.meal_plan_id;
    if parent_household is distinct from new.household_id then
      raise exception '晚饭必须属于这个家庭的周计划';
    end if;
  elsif tg_table_name = 'planned_meal_dishes' then
    select household_id into parent_household from public.planned_meals where id = new.planned_meal_id;
    if parent_household is distinct from new.household_id then
      raise exception '菜必须属于这个家庭的晚饭';
    end if;
    if new.dish_id is not null then
      select household_id into parent_household from public.dishes where id = new.dish_id;
      if parent_household is distinct from new.household_id then
        raise exception '这道菜必须属于这个家庭';
      end if;
    end if;
  elsif tg_table_name = 'grocery_items' then
    if new.meal_plan_id is not null then
      select household_id into parent_household from public.meal_plans where id = new.meal_plan_id;
      if parent_household is distinct from new.household_id then
        raise exception '购物项必须属于这个家庭的周计划';
      end if;
    end if;
  elsif tg_table_name = 'preference_events' then
    if new.dish_id is not null then
      select household_id into parent_household from public.dishes where id = new.dish_id;
      if parent_household is distinct from new.household_id then
        raise exception '偏好记录必须属于这个家庭的菜';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_household_match() from public, anon;
grant execute on function private.enforce_household_match() to authenticated;

create trigger dish_ingredients_match_household
before insert or update on public.dish_ingredients
for each row execute function private.enforce_household_match();
create trigger planned_meals_match_household
before insert or update on public.planned_meals
for each row execute function private.enforce_household_match();
create trigger planned_meal_dishes_match_household
before insert or update on public.planned_meal_dishes
for each row execute function private.enforce_household_match();
create trigger grocery_items_match_household
before insert or update on public.grocery_items
for each row execute function private.enforce_household_match();
create trigger preference_events_match_household
before insert or update on public.preference_events
for each row execute function private.enforce_household_match();

create or replace function private.protect_household_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_by is distinct from old.created_by then
    raise exception '不能修改家庭身份';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_household_identity() from public, anon;
grant execute on function private.protect_household_identity() to authenticated;

create trigger households_protect_identity
before update on public.households
for each row execute function private.protect_household_identity();

revoke all on function public.create_household(text) from public, anon;
revoke all on function public.join_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_settings enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_ingredients enable row level security;
alter table public.inventory_items enable row level security;
alter table public.meal_plans enable row level security;
alter table public.planned_meals enable row level security;
alter table public.planned_meal_dishes enable row level security;
alter table public.grocery_items enable row level security;
alter table public.preference_events enable row level security;

alter table public.households force row level security;
alter table public.household_members force row level security;
alter table public.household_settings force row level security;
alter table public.dishes force row level security;
alter table public.dish_ingredients force row level security;
alter table public.inventory_items force row level security;
alter table public.meal_plans force row level security;
alter table public.planned_meals force row level security;
alter table public.planned_meal_dishes force row level security;
alter table public.grocery_items force row level security;
alter table public.preference_events force row level security;

create policy households_select on public.households
for select to authenticated
using (private.is_household_member(id));

create policy households_update on public.households
for update to authenticated
using (private.is_household_owner(id))
with check (private.is_household_owner(id));

create policy members_select on public.household_members
for select to authenticated
using (user_id = (select auth.uid()) or private.is_household_member(household_id));

create policy settings_all on public.household_settings
for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy dishes_all on public.dishes
for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy ingredients_all on public.dish_ingredients
for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy inventory_all on public.inventory_items
for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy plans_all on public.meal_plans
for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy meals_all on public.planned_meals
for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy meal_dishes_all on public.planned_meal_dishes
for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy groceries_all on public.grocery_items
for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy preference_select on public.preference_events
for select to authenticated
using (private.is_household_member(household_id));

create policy preference_insert on public.preference_events
for insert to authenticated
with check (user_id = (select auth.uid()) and private.is_household_member(household_id));

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
from public, anon;

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
