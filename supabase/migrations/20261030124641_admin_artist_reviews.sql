-- Narrow artist review and publication API. No account deletion, billing or role management.
alter table public.artist_claims add column reviewed_by uuid references auth.users(id) on delete set null,
 add column reviewed_at timestamptz;
-- Older reviewer JWT flags no longer grant access to applicants' private evidence.
alter policy "Read own artist claims" on public.artist_claims using (
 user_id=(select auth.uid()) or (select private.experience_admin())
);
create function private.experience_artist_claims() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.experience_admin() then raise exception 'Administrator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'claim_id',c.claim_id,'user_id',c.user_id,'artist_id',c.artist_id,
 'artist_name',coalesce(a.name,c.requested_name),'evidence_url',c.evidence_url,
 'identity_status',c.identity_status,'ownership_status',c.ownership_status,
 'review_note',c.review_note,'created_at',c.created_at,'reviewed_at',c.reviewed_at,
 'reviewed_by',c.reviewed_by) order by c.created_at)
 from public.artist_claims c left join public.artists a on a.artist_id=c.artist_id),'[]'::jsonb);
end $$;
revoke all on function private.experience_artist_claims() from public,anon,service_role;
grant execute on function private.experience_artist_claims() to authenticated;
create function public.experience_artist_claims() returns jsonb language sql stable security invoker set search_path='' as $$
 select private.experience_artist_claims();
$$;
revoke all on function public.experience_artist_claims() from public,anon,service_role;
grant execute on function public.experience_artist_claims() to authenticated;
create function private.experience_review_artist_claim(claim uuid,approved boolean,note text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.artist_claims; target_id bigint;
begin
 if not private.experience_admin() then raise exception 'Administrator access required'; end if;
 if approved is null or note is null or length(note)>2000 then raise exception 'Invalid review'; end if;
 select * into strict c from public.artist_claims where claim_id=claim for update;
 if c.user_id=auth.uid() then raise exception 'Another administrator must review your own artist request'; end if;
 if c.ownership_status<>'pending' then raise exception 'Request already reviewed'; end if;
 if approved and c.identity_status<>'verified' then raise exception 'Identity verification required'; end if;
 target_id:=c.artist_id;
 if approved and target_id is null then
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(c.requested_name)),0));
  if exists(select 1 from public.artists where lower(trim(name))=lower(trim(c.requested_name))) then
   raise exception 'This artist already exists. Ask the applicant to request access to the existing artist page';
  end if;
  insert into public.artists(name) values(trim(c.requested_name)) returning artist_id into target_id;
 end if;
 update public.artist_claims set artist_id=target_id,
  ownership_status=case when approved then 'approved' else 'rejected' end,
  review_note=trim(note),reviewed_by=auth.uid(),reviewed_at=now() where claim_id=claim;
end $$;
revoke all on function private.experience_review_artist_claim(uuid,boolean,text) from public,anon,service_role;
grant execute on function private.experience_review_artist_claim(uuid,boolean,text) to authenticated;
create or replace function public.review_artist_claim(claim uuid,approved boolean,note text) returns void
language sql security invoker set search_path='' as $$
 select private.experience_review_artist_claim(claim,approved,note);
$$;
revoke all on function public.review_artist_claim(uuid,boolean,text) from public,anon,service_role;
grant execute on function public.review_artist_claim(uuid,boolean,text) to authenticated;
