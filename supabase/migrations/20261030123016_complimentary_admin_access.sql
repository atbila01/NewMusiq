-- Only the two explicitly approved, existing verified accounts receive these grants.
create table private.experience_privileged_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null unique check (email in ('aliyahbilal236@gmail.com','murphmaklane@gmail.com'))
);
alter table private.experience_privileged_accounts enable row level security;
revoke all on private.experience_privileged_accounts from public, anon, authenticated, service_role;
insert into private.experience_privileged_accounts(user_id,email)
 select id,lower(email) from auth.users
 where lower(email) in ('aliyahbilal236@gmail.com','murphmaklane@gmail.com') and email_confirmed_at is not null;
do $$ begin
 if (select count(*) from private.experience_privileged_accounts) <> 2 then
  raise exception 'Both approved accounts must exist and have confirmed emails';
 end if;
end $$;
create or replace function private.experience_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.experience_privileged_accounts a
 join auth.users u on u.id=a.user_id and lower(u.email)=a.email
 join auth.sessions s on s.user_id=u.id and s.id::text=auth.jwt()->>'session_id'
 where u.id=auth.uid() and u.email_confirmed_at is not null
 and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function private.experience_admin() from public,anon;
grant execute on function private.experience_admin() to authenticated;
create function public.experience_access() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('role',case when private.experience_admin() then 'admin' else 'member' end,
 'complimentary',private.experience_admin());
$$;
revoke all on function public.experience_access() from public,anon;
grant execute on function public.experience_access() to authenticated;
-- Metadata is informational only; RLS and the frontend role API use the live database grant above.
update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb) || jsonb_build_object('role',
 case when id in (select user_id from private.experience_privileged_accounts) then 'admin' else 'member' end)
 where raw_app_meta_data->>'role'='admin' or id in (select user_id from private.experience_privileged_accounts);

drop policy "Create own experience records" on public.experience_records;
create policy "Create own experience records" on public.experience_records for insert to authenticated with check (
  user_id=(select auth.uid())
  and (kind<>'track' or (
    ((select private.experience_admin()) or exists(select 1 from public.billing_accounts b where b.user_id=(select auth.uid()) and b.plan='artist' and b.status in ('active','trialing') and (b.period_end is null or b.period_end>now())))
    and exists(select 1 from public.artist_claims c where c.user_id=(select auth.uid()) and c.identity_status='verified' and c.ownership_status='approved')
    and payload->>'audio_path' like (select auth.uid())::text || '/audio/%'
  ))
  and (kind<>'comment' or (length(trim(payload->>'message')) between 1 and 600 and ((select private.experience_admin()) or exists(select 1 from public.billing_accounts b where b.user_id=(select auth.uid()) and b.status in ('active','trialing') and (b.period_end is null or b.period_end>now())))))
);

drop policy "Experience media owner uploads" on storage.objects;
create policy "Experience media owner uploads" on storage.objects for insert to authenticated with check (
 bucket_id='experience-media' and (storage.foldername(name))[1]=(select auth.uid())::text
 and ((storage.foldername(name))[2]<>'audio' or (((select private.experience_admin()) or exists(select 1 from public.billing_accounts b where b.user_id=(select auth.uid()) and b.plan='artist' and b.status in ('active','trialing'))) and exists(select 1 from public.artist_claims c where c.user_id=(select auth.uid()) and c.identity_status='verified' and c.ownership_status='approved')))
);

drop policy "Experience media permitted downloads" on storage.objects;
create policy "Experience media permitted downloads" on storage.objects for select to authenticated using (
 bucket_id='experience-media' and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or ((storage.foldername(name))[2]='cover' and exists(select 1 from public.experience_records r where r.kind='track' and r.status<>'hidden' and r.payload->>'cover_path'=name))
  or ((storage.foldername(name))[2]='audio' and ((select private.experience_admin()) or exists(select 1 from public.billing_accounts b where b.user_id=(select auth.uid()) and b.status in ('active','trialing') and (b.period_end is null or b.period_end>now()))) and exists(select 1 from public.experience_records r where r.kind='track' and r.status<>'hidden' and r.payload->>'audio_path'=name))
  )
);
