-- Temporary AI discovery selections; never writes canonical artists, songs or billing.
create table private.weekly_music_cache (
  region_key text primary key,
  payload jsonb,
  attempt_week text,
  attempts integer not null default 0,
  retry_after timestamptz
);
create table private.weekly_music_worker (
  id integer primary key check (id=1),
  lease uuid,
  region_key text,
  lease_until timestamptz,
  budget_day date,
  attempts integer not null default 0
);
insert into private.weekly_music_worker(id) values (1);
alter table private.weekly_music_cache enable row level security;
alter table private.weekly_music_worker enable row level security;
revoke all on private.weekly_music_cache, private.weekly_music_worker from public, anon, authenticated;

create function public.weekly_music_claim(p_region_key text, p_week text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  worker private.weekly_music_worker%rowtype;
  entry private.weekly_music_cache%rowtype;
  token uuid;
  used jsonb;
begin
  if length(p_region_key) not between 1 and 120
     or p_week <> to_char(now() at time zone 'UTC','IYYY-"W"IW') then
    raise exception 'Invalid region or week';
  end if;
  -- One shared lease serializes generation across regions and function instances.
  select * into worker from private.weekly_music_worker where id=1 for update;
  select * into entry from private.weekly_music_cache where region_key=p_region_key;
  if entry.payload->>'week'=p_week then
    return jsonb_build_object('state','cached','payload',entry.payload);
  end if;
  if worker.lease_until>now() or entry.retry_after>now()
     or (entry.attempt_week=p_week and entry.attempts>=3)
     or (worker.budget_day=(now() at time zone 'UTC')::date and worker.attempts>=20) then
    return jsonb_build_object('state','waiting','previous',entry.payload);
  end if;
  token := gen_random_uuid();
  update private.weekly_music_worker set lease=token, region_key=p_region_key,
    lease_until=now()+interval '2 minutes', budget_day=(now() at time zone 'UTC')::date,
    attempts=case when budget_day=(now() at time zone 'UTC')::date then attempts+1 else 1 end
    where id=1;
  insert into private.weekly_music_cache(region_key,attempt_week,attempts,retry_after)
    values(p_region_key,p_week,1,now()+interval '2 minutes')
    on conflict(region_key) do update set attempt_week=p_week,
      attempts=case when weekly_music_cache.attempt_week=p_week then weekly_music_cache.attempts+1 else 1 end,
      retry_after=now()+interval '2 minutes';
  select coalesce(jsonb_agg(items.song),'[]'::jsonb) into used
    from private.weekly_music_cache c
    cross join lateral jsonb_array_elements(c.payload->'top_songs') as items(song)
    where c.region_key<>p_region_key and c.payload->>'week'=p_week;
  return jsonb_build_object('state','claimed','lease',token,'used_songs',used,'previous',entry.payload);
end;
$$;
revoke all on function public.weekly_music_claim(text,text) from public,anon,authenticated;
grant execute on function public.weekly_music_claim(text,text) to service_role;

create function public.weekly_music_finish(p_region_key text,p_week text,p_lease uuid,p_payload jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare worker private.weekly_music_worker%rowtype;
begin
  select * into worker from private.weekly_music_worker where id=1 for update;
  if worker.lease is distinct from p_lease or worker.region_key is distinct from p_region_key
     or worker.lease_until<now() then return false; end if;
  if p_payload is not null then
    if p_payload->>'week' is distinct from p_week
       or p_payload->>'review_status' is distinct from 'unreviewed'
       or jsonb_typeof(p_payload->'top_songs') is distinct from 'array'
       or jsonb_array_length(p_payload->'top_songs') not between 5 and 15
       or octet_length(p_payload::text)>100000 then
      raise exception 'Invalid weekly selection';
    end if;
    update private.weekly_music_cache set payload=p_payload, retry_after=null where region_key=p_region_key;
  end if;
  update private.weekly_music_worker set lease=null,region_key=null,lease_until=null where id=1;
  return true;
end;
$$;
revoke all on function public.weekly_music_finish(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.weekly_music_finish(text,text,uuid,jsonb) to service_role;
