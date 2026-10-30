-- Run against the project SQL editor. Every fixture and review is rolled back.
begin;
create temporary table review_test_actors as
 select u.id,lower(u.email) as email,s.id as session_id,
  lower(u.email) in ('aliyahbilal236@gmail.com','murphmaklane@gmail.com') as is_admin
 from auth.users u join lateral (select id from auth.sessions where user_id=u.id and (not_after is null or not_after>now()) order by created_at desc limit 1) s on true;
create temporary table review_test_claims(label text,claim_id uuid);
create temporary table review_test_results(label text,passed boolean);
do $$ declare member_id uuid; admin_id uuid; test_id uuid;
begin
 if (select count(*) from review_test_actors where is_admin)<>2 then raise exception 'Both administrator sessions are required for the positive verification tests'; end if;
 select id into strict member_id from review_test_actors where not is_admin limit 1;
 select id into strict admin_id from review_test_actors where email='aliyahbilal236@gmail.com';
 insert into public.artist_claims(user_id,requested_name,evidence_url,identity_status)
 values(member_id,'Review fixture verified '||gen_random_uuid(),'https://example.com/artist','verified') returning claim_id into test_id;
 insert into review_test_claims values('verified',test_id);
 insert into public.artist_claims(user_id,requested_name,evidence_url)
 values(member_id,'Review fixture unverified '||gen_random_uuid(),'https://example.com/artist') returning claim_id into test_id;
 insert into review_test_claims values('unverified',test_id);
 insert into public.artist_claims(user_id,requested_name,evidence_url,identity_status)
 values(admin_id,'Review fixture own '||gen_random_uuid(),'https://example.com/artist','verified') returning claim_id into test_id;
 insert into review_test_claims values('own',test_id);
end $$;
grant select on review_test_actors,review_test_claims to authenticated;
grant select,insert on review_test_results to authenticated;
set local role authenticated;
do $$ declare actor record; denied boolean; result jsonb; verified uuid; unverified uuid; own_id uuid;
begin
 select claim_id into verified from review_test_claims where label='verified';
 select claim_id into unverified from review_test_claims where label='unverified';
 select claim_id into own_id from review_test_claims where label='own';
 for actor in select * from review_test_actors loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','session_id',actor.session_id)::text,true);
  if actor.is_admin then
   result:=public.experience_artist_claims();
   if not exists(select 1 from jsonb_array_elements(result) r where r->>'claim_id'=verified::text) then raise exception 'Admin queue missing fixture'; end if;
   insert into review_test_results values(actor.email||' can review',true);
  else
   denied:=false;
   begin perform public.experience_artist_claims(); exception when others then
    if sqlerrm<>'Administrator access required' then raise; end if; denied:=true;
   end;
   if not denied then raise exception 'Ordinary account read admin queue'; end if;
   denied:=false;
   begin perform public.review_artist_claim(verified,true,'Unauthorized test'); exception when others then
    if sqlerrm<>'Administrator access required' then raise; end if; denied:=true;
   end;
   if not denied then raise exception 'Ordinary account approved artist'; end if;
   insert into review_test_results values('ordinary member denied',true);
  end if;
 end loop;
 select * into strict actor from review_test_actors where email='aliyahbilal236@gmail.com';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','session_id',actor.session_id)::text,true);
 denied:=false;
 begin perform public.review_artist_claim(unverified,true,'Unverified test'); exception when others then
  if sqlerrm<>'Identity verification required' then raise; end if; denied:=true;
 end;
 if not denied then raise exception 'Unverified identity approved'; end if;
 insert into review_test_results values('unverified identity blocked',true);
 denied:=false;
 begin perform public.review_artist_claim(own_id,true,'Self review test'); exception when others then
  if sqlerrm<>'Another administrator must review your own artist request' then raise; end if; denied:=true;
 end;
 if not denied then raise exception 'Self review allowed'; end if;
 insert into review_test_results values('self review blocked',true);
 perform public.review_artist_claim(verified,true,'Official ownership reviewed');
 if not exists(select 1 from public.artist_claims c join public.artists a on a.artist_id=c.artist_id
  where c.claim_id=verified and c.ownership_status='approved' and c.reviewed_by=actor.id and c.reviewed_at is not null)
 then raise exception 'Artist not published or audit missing'; end if;
 insert into review_test_results values('verified artist published and audited',true);
 denied:=false;
 begin perform public.review_artist_claim(verified,true,'Repeated review'); exception when others then
  if sqlerrm<>'Request already reviewed' then raise; end if; denied:=true;
 end;
 if not denied then raise exception 'Repeated approval allowed'; end if;
 insert into review_test_results values('repeat review blocked',true);
 perform public.review_artist_claim(unverified,false,'Ownership evidence insufficient');
 if not exists(select 1 from public.artist_claims where claim_id=unverified and ownership_status='rejected' and artist_id is null)
 then raise exception 'Rejection unexpectedly published artist'; end if;
 insert into review_test_results values('rejection does not publish',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role','authenticated','session_id',gen_random_uuid())::text,true);
 denied:=false;
 begin perform public.experience_artist_claims(); exception when others then
  if sqlerrm<>'Administrator access required' then raise; end if; denied:=true;
 end;
 if not denied then raise exception 'Revoked session allowed'; end if;
 insert into review_test_results values('invalid session blocked',true);
end $$;
reset role;
select jsonb_agg(to_jsonb(t)) as results from review_test_results t;
rollback;
