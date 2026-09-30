-- Feedback digests: an aggregated, scored summary is produced for a campaign
-- each time it gains another DIGEST_BATCH (5) responses since the last
-- digest. Sending only in steps of 5 means no two digests can be compared to
-- isolate fewer than 5 people's answers.

create table public.digests (
  id             uuid primary key default gen_random_uuid(),
  company_id     text not null,
  campaign_id    text not null,
  response_count integer not null,
  payload        jsonb not null,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);

create index digests_campaign_idx on public.digests (campaign_id);

alter table public.digests enable row level security;
revoke all on public.digests from anon, authenticated;

-- Builds the aggregate for a campaign: per-question average (1-5) and
-- percent favorable (Agree or Strongly agree), plus comments in random order
-- so their sequence can't be matched to submission order.
create function public.campaign_aggregate(p_campaign_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'questions', (
      select jsonb_object_agg(q, jsonb_build_object(
               'avg', avg_score, 'favorable_pct', favorable_pct))
        from (
          select v.q,
                 round(avg(v.score)::numeric, 2) as avg_score,
                 round(100.0 * avg((v.score >= 4)::int)) as favorable_pct
            from responses r,
                 lateral (values
                   ('manager_fairness', r.manager_fairness),
                   ('workload', r.workload),
                   ('speak_up', r.speak_up),
                   ('communication', r.communication),
                   ('recognition', r.recognition),
                   ('resources', r.resources),
                   ('intent_to_stay', r.intent_to_stay),
                   ('work_arrangement', r.work_arrangement)) v(q, score)
           where r.campaign_id = p_campaign_id
           group by v.q
        ) per_question),
    'comments', coalesce((
      select jsonb_agg(one_change order by random())
        from responses
       where campaign_id = p_campaign_id and one_change is not null), '[]'::jsonb)
  );
$$;

revoke all on function public.campaign_aggregate from public, anon, authenticated;
grant execute on function public.campaign_aggregate to service_role;

-- Replaces the Phase 0 version: same token handling, plus it serializes
-- submissions per campaign and creates a digest row when the threshold is hit.
drop function public.submit_feedback(text, text, smallint, smallint, smallint,
  smallint, smallint, smallint, smallint, smallint, text);

create function public.submit_feedback(
  p_token            text,
  p_campaign_id      text,
  p_manager_fairness smallint,
  p_workload         smallint,
  p_speak_up         smallint,
  p_communication    smallint,
  p_recognition      smallint,
  p_resources        smallint,
  p_intent_to_stay   smallint,
  p_work_arrangement smallint,
  p_one_change       text
) returns table (digest_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  digest_batch constant integer := 5;
  v_company  text;
  v_campaign text;
  v_count    integer;
  v_last     integer;
  v_digest   uuid;
begin
  update invitations i
     set used = true
   where i.token = p_token
     and i.campaign_id = p_campaign_id
     and i.used = false
  returning i.company_id, i.campaign_id into v_company, v_campaign;

  if not found then
    raise exception 'invalid_or_used_token' using errcode = 'P0001';
  end if;

  -- One submission per campaign at a time, so the count and digest are exact.
  perform pg_advisory_xact_lock(hashtext('feedback:' || v_campaign));

  insert into responses (
    company_id, campaign_id, manager_fairness, workload, speak_up,
    communication, recognition, resources, intent_to_stay,
    work_arrangement, one_change
  ) values (
    v_company, v_campaign, p_manager_fairness, p_workload, p_speak_up,
    p_communication, p_recognition, p_resources, p_intent_to_stay,
    p_work_arrangement, nullif(btrim(p_one_change), '')
  );

  select count(*) into v_count from responses where campaign_id = v_campaign;
  select coalesce(max(response_count), 0) into v_last
    from digests where campaign_id = v_campaign;

  if v_count - v_last >= digest_batch then
    insert into digests (company_id, campaign_id, response_count, payload)
    values (v_company, v_campaign, v_count, campaign_aggregate(v_campaign))
    returning id into v_digest;
  end if;

  return query select v_digest;
end;
$$;

revoke all on function public.submit_feedback from public, anon, authenticated;
grant execute on function public.submit_feedback to service_role;

-- Counts only (never which token answered what) for the admin page.
create function public.campaign_status()
returns table (
  company_id text, campaign_id text, links_issued bigint, links_used bigint,
  responses bigint, digests_sent bigint, digests_pending bigint,
  created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.company_id, i.campaign_id,
         count(*), count(*) filter (where i.used),
         (select count(*) from responses r where r.campaign_id = i.campaign_id),
         (select count(*) from digests d where d.campaign_id = i.campaign_id and d.sent_at is not null),
         (select count(*) from digests d where d.campaign_id = i.campaign_id and d.sent_at is null),
         min(i.created_at)
    from invitations i
   group by i.company_id, i.campaign_id
   order by min(i.created_at) desc;
$$;

revoke all on function public.campaign_status from public, anon, authenticated;
grant execute on function public.campaign_status to service_role;
