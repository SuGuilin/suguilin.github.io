-- Private personal learning workspace. Apply using a project administrator.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.workspace_members (user_id uuid primary key references auth.users(id) on delete cascade);

create or replace function public.is_workspace_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from private.workspace_members m where m.user_id = auth.uid());
$$;
revoke all on function public.is_workspace_member() from public, anon;
grant execute on function public.is_workspace_member() to authenticated;

create table public.workspace_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('saved','completed','milestones','mastered','reading','notes','conversations','settings')),
  id text not null check (length(id) between 1 and 100 and id ~ '^[a-zA-Z0-9_-]+$'),
  value jsonb,
  deleted boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  operation_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (user_id,kind,id),
  check (octet_length(value::text) <= 1000000)
);
alter table public.workspace_documents enable row level security;
create policy read_own_documents on public.workspace_documents for select to authenticated
using (user_id = (select auth.uid()) and (select public.is_workspace_member()));
revoke all on public.workspace_documents from anon, authenticated;
grant select on public.workspace_documents to authenticated;

create or replace function public.save_workspace_document(
 p_kind text, p_id text, p_value jsonb, p_deleted boolean,
 p_base_revision bigint, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_doc public.workspace_documents; caller uuid := auth.uid();
begin
 if caller is null or not public.is_workspace_member() then raise exception 'Workspace access required' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('saved','completed','milestones','mastered','reading','notes','conversations','settings')
   or p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,100}$' or p_base_revision is null or p_base_revision < 0
   or p_deleted is null or p_operation_id is null or octet_length(p_value::text)>1000000 then
   raise exception 'Invalid document';
 end if;
 if not p_deleted then
   if p_value is null then raise exception 'Missing value'; end if;
   if p_kind in ('saved','completed','milestones','mastered','reading') and p_value <> 'true'::jsonb then raise exception 'Invalid flag'; end if;
   if p_kind='settings' and (p_id<>'pace' or p_value not in ('6'::jsonb,'10'::jsonb,'15'::jsonb)) then raise exception 'Invalid setting'; end if;
   if p_kind in ('notes','conversations') and (jsonb_typeof(p_value)<>'object' or p_value->>'id' is distinct from p_id
     or jsonb_typeof(p_value->'title') is distinct from 'string' or length(p_value->>'title')>200
     or jsonb_typeof(p_value->'updatedAt') is distinct from 'string') then raise exception 'Invalid record'; end if;
   if p_kind='notes' and (jsonb_typeof(p_value->'body') is distinct from 'string' or length(p_value->>'body')>80000
     or jsonb_typeof(p_value->'tags') is distinct from 'string' or length(p_value->>'tags')>300
     or jsonb_typeof(p_value->'kind') is distinct from 'string' or length(p_value->>'kind')>30
     or jsonb_typeof(p_value->'createdAt') is distinct from 'string') then raise exception 'Invalid note'; end if;
   if p_kind='conversations' and (jsonb_typeof(p_value->'messages') is distinct from 'array' or jsonb_array_length(p_value->'messages')>120) then raise exception 'Invalid conversation'; end if;
   -- Reject malformed dates before they can break another device's cache.
   if p_kind in ('notes','conversations') then
     if length(p_value->>'updatedAt')>40 or p_value->>'updatedAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then raise exception 'Invalid timestamp'; end if;
     perform (p_value->>'updatedAt')::timestamptz;
   end if;
   if p_kind='notes' then
     if length(p_value->>'createdAt')>40 or p_value->>'createdAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then raise exception 'Invalid timestamp'; end if;
     perform (p_value->>'createdAt')::timestamptz;
   end if;
   if p_kind='conversations' and exists(select 1 from jsonb_array_elements(p_value->'messages') m
     where jsonb_typeof(m) is distinct from 'object' or jsonb_typeof(m->'role') is distinct from 'string'
     or m->>'role' not in ('user','assistant') or jsonb_typeof(m->'content') is distinct from 'string'
     or length(m->>'content')>40000 or jsonb_typeof(m->'status') is distinct from 'string'
     or m->>'status' not in ('complete','interrupted','error')) then raise exception 'Invalid message'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_kind||':'||p_id,0));
 select * into current_doc from public.workspace_documents where user_id=caller and kind=p_kind and id=p_id;
 if current_doc.operation_id=p_operation_id then return jsonb_build_object('conflict',false,'document',to_jsonb(current_doc)-'user_id'); end if;
 if coalesce(current_doc.revision,0)<>p_base_revision then return jsonb_build_object('conflict',true,'document',case when current_doc.user_id is null then null else to_jsonb(current_doc)-'user_id' end); end if;
 insert into public.workspace_documents(user_id,kind,id,value,deleted,revision,operation_id)
 values(caller,p_kind,p_id,case when p_deleted then null else p_value end,p_deleted,1,p_operation_id)
 on conflict (user_id,kind,id) do update set value=excluded.value,deleted=excluded.deleted,
 revision=public.workspace_documents.revision+1,operation_id=excluded.operation_id,updated_at=clock_timestamp()
 returning * into current_doc;
 return jsonb_build_object('conflict',false,'document',to_jsonb(current_doc)-'user_id');
end;
$$;
revoke all on function public.save_workspace_document(text,text,jsonb,boolean,bigint,uuid) from public, anon;
grant execute on function public.save_workspace_document(text,text,jsonb,boolean,bigint,uuid) to authenticated;

create table private.ai_usage (user_id uuid not null references auth.users(id) on delete cascade,day date not null,requests integer not null default 0,last_request timestamptz,primary key(user_id,day));
create or replace function public.consume_ai_quota() returns boolean
language plpgsql security definer set search_path='' as $$
declare current_usage private.ai_usage; caller uuid:=auth.uid(); today date:=(now() at time zone 'utc')::date;
begin
 if not public.is_workspace_member() then raise exception 'Workspace access required' using errcode='42501'; end if;
 insert into private.ai_usage(user_id,day) values(caller,today) on conflict do nothing;
 select * into current_usage from private.ai_usage where user_id=caller and day=today for update;
 if current_usage.requests>=40 or current_usage.last_request>now()-interval '3 seconds' then return false; end if;
 update private.ai_usage set requests=requests+1,last_request=now() where user_id=caller and day=today;
 return true;
end;
$$;
revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;

-- Create the owner in Authentication > Users first, then authorize that account:
-- insert into private.workspace_members(user_id)
-- select id from auth.users where email = 'YOUR_VERIFIED_EMAIL'
-- on conflict do nothing;
