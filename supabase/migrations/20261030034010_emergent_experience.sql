-- Additive integration: existing accounts, playlists, billing, and songs stay intact.
create function private.experience_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid() and u.raw_app_meta_data->>'role'='admin')
 and exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id');
$$;
revoke all on function private.experience_admin() from public,anon;
grant execute on function private.experience_admin() to authenticated;

create table public.experience_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('like','playlist','visit','feedback','comment','track','play')),
  payload jsonb not null default '{}' check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=100000),
  status text not null default 'pending' check (status in ('pending','approved','hidden','open','resolved')),
  created_at timestamptz not null default now()
);
create index experience_owner_kind on public.experience_records(user_id,kind,created_at desc);
alter table public.experience_records enable row level security;
revoke all on public.experience_records from public,anon,authenticated;
grant select,delete on public.experience_records to authenticated;
grant insert(id,user_id,kind,payload) on public.experience_records to authenticated;
grant update(payload) on public.experience_records to authenticated;
grant all on public.experience_records to service_role;
create policy "Read own or published experience records" on public.experience_records for select to authenticated using (
  user_id=(select auth.uid()) or (select private.experience_admin())
  or (kind='comment' and status='approved')
  or (kind='track' and status<>'hidden')
);
create policy "Create own experience records" on public.experience_records for insert to authenticated with check (
  user_id=(select auth.uid())
  and (kind<>'track' or (
    exists(select 1 from public.billing_accounts b where b.user_id=(select auth.uid()) and b.plan='artist' and b.status in ('active','trialing') and (b.period_end is null or b.period_end>now()))
    and exists(select 1 from public.artist_claims c where c.user_id=(select auth.uid()) and c.identity_status='verified' and c.ownership_status='approved')
    and payload->>'audio_path' like (select auth.uid())::text || '/audio/%'
  ))
  and (kind<>'comment' or (length(trim(payload->>'message')) between 1 and 600 and exists(select 1 from public.billing_accounts b where b.user_id=(select auth.uid()) and b.status in ('active','trialing') and (b.period_end is null or b.period_end>now()))))
);
create policy "Edit own private records" on public.experience_records for update to authenticated using (
  user_id=(select auth.uid()) and kind in ('playlist','visit')
) with check (user_id=(select auth.uid()) and kind in ('playlist','visit'));
create policy "Delete own records" on public.experience_records for delete to authenticated using (user_id=(select auth.uid()));
-- Moderation is deliberately a narrow RPC: record owners cannot approve themselves.
create function public.moderate_experience_record(record_id uuid, new_status text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if not private.experience_admin() then raise exception 'Administrator access required'; end if;
  update public.experience_records set status=new_status where id=record_id and kind in ('comment','feedback','track');
end; $$;
grant update(status) on public.experience_records to authenticated;
create policy "Admins moderate records" on public.experience_records for update to authenticated using ((select private.experience_admin())) with check ((select private.experience_admin()));
-- A trigger prevents owners from using the status column granted for moderation.
create function private.protect_experience_status() returns trigger language plpgsql set search_path='' as $$
begin
  if new.status is distinct from old.status and not private.experience_admin() then raise exception 'Administrator access required'; end if;
  return new;
end; $$;
create trigger protect_experience_status before update on public.experience_records for each row execute function private.protect_experience_status();
revoke all on function public.moderate_experience_record(uuid,text) from public,anon;
grant execute on function public.moderate_experience_record(uuid,text) to authenticated;
revoke all on function private.protect_experience_status() from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit) values('experience-media','experience-media',false,26214400) on conflict(id) do nothing;
create policy "Experience media owner uploads" on storage.objects for insert to authenticated with check (
 bucket_id='experience-media' and (storage.foldername(name))[1]=(select auth.uid())::text
 and ((storage.foldername(name))[2]<>'audio' or (exists(select 1 from public.billing_accounts b where b.user_id=(select auth.uid()) and b.plan='artist' and b.status in ('active','trialing')) and exists(select 1 from public.artist_claims c where c.user_id=(select auth.uid()) and c.identity_status='verified' and c.ownership_status='approved')))
);
create policy "Experience media permitted downloads" on storage.objects for select to authenticated using (
 bucket_id='experience-media' and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or ((storage.foldername(name))[2]='cover' and exists(select 1 from public.experience_records r where r.kind='track' and r.status<>'hidden' and r.payload->>'cover_path'=name))
  or ((storage.foldername(name))[2]='audio' and exists(select 1 from public.billing_accounts b where b.user_id=(select auth.uid()) and b.status in ('active','trialing') and (b.period_end is null or b.period_end>now())) and exists(select 1 from public.experience_records r where r.kind='track' and r.status<>'hidden' and r.payload->>'audio_path'=name))
  )
);
create policy "Experience media owner removes" on storage.objects for delete to authenticated using(bucket_id='experience-media' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Aggregated artist analytics exposes counts, not another listener's history.
create function private.experience_studio_stats() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 select jsonb_build_object('total_plays',count(*),'unique_listeners',count(distinct p.user_id),
 'series','[]'::jsonb,'most_played','[]'::jsonb,'most_liked','[]'::jsonb) into result
 from public.experience_records p join public.experience_records t on t.id::text=p.payload->>'track_id'
 where p.kind='play' and t.kind='track' and t.user_id=uid;
 return result;
end; $$;
revoke all on function private.experience_studio_stats() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.experience_studio_stats() to authenticated;
create function public.experience_studio_stats() returns jsonb language sql security invoker set search_path='' as $$ select private.experience_studio_stats(); $$;
revoke all on function public.experience_studio_stats() from public,anon;
grant execute on function public.experience_studio_stats() to authenticated;
create function private.experience_subscription_summary() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.experience_admin() then raise exception 'Administrator access required'; end if;
 select jsonb_build_object('monthly_revenue',coalesce(sum(case when status='active' then case plan when 'artist' then 10 when 'listener' then 5 else 0 end else 0 end),0),
 'users',coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'plan',plan,'plan_name',plan,'subscription_status',status)),'[]'::jsonb)) into result from public.billing_accounts;
 return result;
end; $$;
revoke all on function private.experience_subscription_summary() from public,anon;
grant execute on function private.experience_subscription_summary() to authenticated;
create function public.experience_subscription_summary() returns jsonb language sql security invoker set search_path='' as $$ select private.experience_subscription_summary(); $$;
revoke all on function public.experience_subscription_summary() from public,anon;
grant execute on function public.experience_subscription_summary() to authenticated;
