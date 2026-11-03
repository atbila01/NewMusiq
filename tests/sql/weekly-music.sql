-- Run after 20261102200000_weekly_music.sql. Every fixture is rolled back.
begin;
do $$
declare claim jsonb; waiting jsonb; ok boolean; wk text;
begin
  if has_function_privilege('anon','public.weekly_music_claim(text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.weekly_music_claim(text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.weekly_music_finish(text,text,uuid,jsonb)','EXECUTE') then
    raise exception 'Clients must not control AI cache generation';
  end if;
  if not has_function_privilege('service_role','public.weekly_music_claim(text,text)','EXECUTE') then
    raise exception 'Server must be allowed to generate';
  end if;
  if has_table_privilege('authenticated','private.weekly_music_cache','SELECT')
     or has_table_privilege('anon','private.weekly_music_worker','UPDATE') then
    raise exception 'Private cache access leaked';
  end if;
  wk := to_char(now() at time zone 'UTC','IYYY-"W"IW');
  update private.weekly_music_worker set lease=null,region_key=null,lease_until=null,budget_day=null,attempts=0;
  claim := public.weekly_music_claim('__transactional_weekly_test_a',wk);
  if claim->>'state'<>'claimed' then raise exception 'First generation not claimed'; end if;
  waiting := public.weekly_music_claim('__transactional_weekly_test_b',wk);
  if waiting->>'state'<>'waiting' then raise exception 'Global worker lease not enforced'; end if;
  ok := public.weekly_music_finish('__transactional_weekly_test_a',wk,gen_random_uuid(),null);
  if ok then raise exception 'Wrong lease accepted'; end if;
  ok := public.weekly_music_finish('__transactional_weekly_test_b',wk,(claim->>'lease')::uuid,null);
  if ok then raise exception 'Wrong region accepted'; end if;
  ok := public.weekly_music_finish('__transactional_weekly_test_a',wk,(claim->>'lease')::uuid,null);
  if not ok then raise exception 'Valid failure release rejected'; end if;
  waiting := public.weekly_music_claim('__transactional_weekly_test_a',wk);
  if waiting->>'state'<>'waiting' then raise exception 'Retry cooldown not enforced'; end if;
  update private.weekly_music_worker set budget_day=(now() at time zone 'UTC')::date,attempts=20;
  waiting := public.weekly_music_claim('__transactional_weekly_test_c',wk);
  if waiting->>'state'<>'waiting' then raise exception 'Daily request ceiling not enforced'; end if;
  raise notice 'Weekly cache grants, server access, worker lease, cooldown and budget checks passed';
end;
$$;
rollback;
