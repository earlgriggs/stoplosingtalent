-- Employee feedback: invitations and responses.
-- The two tables are deliberately NOT linked. A response row carries only
-- company_id / campaign_id, never the token, so answers cannot be traced
-- back to the invitation (and therefore the employee) that produced them.

create table public.invitations (
  token       text primary key,
  company_id  text not null,
  campaign_id text not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
  -- No used_at column on purpose: a "used" timestamp could be matched
  -- against responses.submitted_at to re-identify a respondent.
);

create index invitations_campaign_idx on public.invitations (campaign_id);

create table public.responses (
  id               uuid primary key default gen_random_uuid(),
  company_id       text not null,
  campaign_id      text not null,
  manager_fairness smallint not null check (manager_fairness between 1 and 5),
  workload         smallint not null check (workload between 1 and 5),
  speak_up         smallint not null check (speak_up between 1 and 5),
  communication    smallint not null check (communication between 1 and 5),
  recognition      smallint not null check (recognition between 1 and 5),
  resources        smallint not null check (resources between 1 and 5),
  intent_to_stay   smallint not null check (intent_to_stay between 1 and 5),
  work_arrangement smallint not null check (work_arrangement between 1 and 5),
  one_change       text check (char_length(one_change) <= 1000),
  -- Truncated to the hour so exact submission times can't be correlated
  -- with when a particular employee was seen opening their invitation.
  submitted_at     timestamptz not null default date_trunc('hour', now())
);

create index responses_campaign_idx on public.responses (campaign_id);

-- Lock both tables down: no access through the public (anon) or
-- signed-in-user API keys. Only the backend's service-role key can reach them.
alter table public.invitations enable row level security;
alter table public.responses   enable row level security;
revoke all on public.invitations from anon, authenticated;
revoke all on public.responses   from anon, authenticated;

-- Claim a token and store the answers in one transaction, so a token is
-- only burned if the response is actually saved, and two simultaneous
-- submissions with the same token can't both succeed.
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
) returns table (company_id text, campaign_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company  text;
  v_campaign text;
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

  insert into responses (
    company_id, campaign_id, manager_fairness, workload, speak_up,
    communication, recognition, resources, intent_to_stay,
    work_arrangement, one_change
  ) values (
    v_company, v_campaign, p_manager_fairness, p_workload, p_speak_up,
    p_communication, p_recognition, p_resources, p_intent_to_stay,
    p_work_arrangement, nullif(btrim(p_one_change), '')
  );

  return query select v_company, v_campaign;
end;
$$;

revoke all on function public.submit_feedback from public, anon, authenticated;
grant execute on function public.submit_feedback to service_role;
