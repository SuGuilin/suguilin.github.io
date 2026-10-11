-- Add learning units and daily practice without resetting existing records.
alter table public.workspace_documents drop constraint workspace_documents_kind_check;
alter table public.workspace_documents add constraint workspace_documents_kind_check check (kind in ('saved','completed','milestones','mastered','reading','notes','conversations','studyUnits','studyProgress','settings'));

create or replace function public.save_workspace_document(
 p_kind text, p_id text, p_value jsonb, p_deleted boolean,
 p_base_revision bigint, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_doc public.workspace_documents; caller uuid := auth.uid(); part jsonb; entry jsonb;
begin
 if caller is null or not public.is_workspace_member() then raise exception 'Workspace access required' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('saved','completed','milestones','mastered','reading','notes','conversations','studyUnits','studyProgress','settings')
   or p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,100}$' or p_base_revision is null or p_base_revision < 0
   or p_deleted is null or p_operation_id is null or octet_length(p_value::text)>1000000 then
   raise exception 'Invalid document';
 end if;
 if not p_deleted then
   if p_value is null then raise exception 'Missing value'; end if;
   if p_kind in ('saved','completed','milestones','mastered','reading') and p_value <> 'true'::jsonb then raise exception 'Invalid flag'; end if;
   if p_kind='settings' and not ((p_id='pace' and p_value in ('6'::jsonb,'10'::jsonb,'15'::jsonb)) or (p_id='dailyMinutes' and p_value in ('15'::jsonb,'30'::jsonb,'45'::jsonb,'60'::jsonb,'90'::jsonb))) then raise exception 'Invalid setting'; end if;
   if p_kind in ('notes','conversations','studyUnits','studyProgress') and (jsonb_typeof(p_value)<>'object' or p_value->>'id' is distinct from p_id
     or jsonb_typeof(p_value->'title') is distinct from 'string' or length(p_value->>'title')>200
     or jsonb_typeof(p_value->'updatedAt') is distinct from 'string') then raise exception 'Invalid record'; end if;
   if p_kind='notes' and (jsonb_typeof(p_value->'body') is distinct from 'string' or length(p_value->>'body')>80000
     or jsonb_typeof(p_value->'tags') is distinct from 'string' or length(p_value->>'tags')>300
     or jsonb_typeof(p_value->'kind') is distinct from 'string' or length(p_value->>'kind')>30
     or jsonb_typeof(p_value->'createdAt') is distinct from 'string') then raise exception 'Invalid note'; end if;
   if p_kind='conversations' and (jsonb_typeof(p_value->'messages') is distinct from 'array' or jsonb_array_length(p_value->'messages')>120) then raise exception 'Invalid conversation'; end if;
   if p_kind='studyUnits' and (jsonb_typeof(p_value->'mode') is distinct from 'string' or p_value->>'mode' not in ('editorial','extractive','ai')
     or jsonb_typeof(p_value->'source') is distinct from 'object'
     or jsonb_typeof(p_value->'source'->'url') is distinct from 'string'
     or p_value->'source'->>'url' !~ '^https?://'
     or jsonb_typeof(p_value->'summary') is distinct from 'string' or length(p_value->>'summary')>1600
     or jsonb_typeof(p_value->'takeaways') is distinct from 'array' or jsonb_array_length(p_value->'takeaways') not between 2 and 6
     or jsonb_typeof(p_value->'exercises') is distinct from 'array' or jsonb_array_length(p_value->'exercises') not between 2 and 5
     or jsonb_typeof(p_value->'prerequisites') is distinct from 'array'
     or jsonb_typeof(p_value->'pitfalls') is distinct from 'array'
     or jsonb_typeof(p_value->'minutes') is distinct from 'number' or p_value->>'minutes' not in ('15','30','45','60')) then raise exception 'Invalid study unit'; end if;
   if p_kind='studyProgress' and (jsonb_typeof(p_value->'scheduledFor') is distinct from 'string'
     or p_value->>'scheduledFor' !~ '^\d{4}-\d{2}-\d{2}$'
     or jsonb_typeof(p_value->'answers') is distinct from 'array' or jsonb_array_length(p_value->'answers')>5
     or jsonb_typeof(p_value->'history') is distinct from 'array' or jsonb_array_length(p_value->'history')>100
     or jsonb_typeof(p_value->'reflection') is distinct from 'string' or length(p_value->>'reflection')>6000
     or jsonb_typeof(p_value->'stage') is distinct from 'number' or p_value->>'stage' not in ('0','1','2','3','4')) then raise exception 'Invalid study progress'; end if;
   if p_kind='studyUnits' then
     if length(p_value->>'title')=0 or jsonb_typeof(p_value->'topic') is distinct from 'string'
       or length(p_value->>'topic') not between 1 and 100 or length(p_value->>'summary')=0
       or jsonb_typeof(p_value->'source'->'title') is distinct from 'string'
       or length(p_value->'source'->>'title') not between 1 and 200
       or length(p_value->'source'->>'url')>1500 or p_value->'source'->>'url' ~ '^https?://[^/]*@'
       or jsonb_typeof(p_value->'source'->'scope') is distinct from 'string'
       or length(p_value->'source'->>'scope') not between 1 and 400
       or jsonb_typeof(p_value->'source'->'excerpt') is distinct from 'string'
       or length(p_value->'source'->>'excerpt')>24000
       or jsonb_typeof(p_value->'source'->'accessedAt') is distinct from 'string'
       or p_value->'source'->>'accessedAt' !~ '^\d{4}-\d{2}-\d{2}T'
       then raise exception 'Invalid study source'; end if;
     perform (p_value->'source'->>'accessedAt')::timestamptz;
     for part in select p_value->'prerequisites' union all select p_value->'pitfalls' loop
       if jsonb_array_length(part) not between 1 and 8 then raise exception 'Invalid study list'; end if;
       for entry in select * from jsonb_array_elements(part) loop
         if jsonb_typeof(entry) is distinct from 'string' or length(entry#>>'{}') not between 1 and 1600 then raise exception 'Invalid study text'; end if;
       end loop;
     end loop;
     for part in select * from jsonb_array_elements(p_value->'takeaways') loop
       if jsonb_typeof(part) is distinct from 'object' or jsonb_typeof(part->'point') is distinct from 'string'
         or length(part->>'point') not between 1 and 1200 or jsonb_typeof(part->'evidence') is distinct from 'string'
         or length(part->>'evidence') not between 1 and 350 then raise exception 'Invalid takeaway'; end if;
       if p_value->>'mode'<>'editorial' and position(part->>'evidence' in p_value->'source'->>'excerpt')=0 then raise exception 'Missing source evidence'; end if;
     end loop;
     for part in select * from jsonb_array_elements(p_value->'exercises') loop
       if jsonb_typeof(part) is distinct from 'object' or part->>'id' !~ '^e[1-5]$'
         or jsonb_typeof(part->'prompt') is distinct from 'string' or length(part->>'prompt') not between 1 and 1800
         or jsonb_typeof(part->'hint') is distinct from 'string' or length(part->>'hint') not between 1 and 1000
         or jsonb_typeof(part->'answer') is distinct from 'string' or length(part->>'answer') not between 1 and 2600
         or jsonb_typeof(part->'rubric') is distinct from 'array' or jsonb_array_length(part->'rubric') not between 1 and 5 then raise exception 'Invalid exercise'; end if;
       for entry in select * from jsonb_array_elements(part->'rubric') loop
         if jsonb_typeof(entry) is distinct from 'string' or length(entry#>>'{}') not between 1 and 1600 then raise exception 'Invalid rubric'; end if;
       end loop;
     end loop;
   end if;
   if p_kind='studyProgress' then
     perform (p_value->>'scheduledFor')::date;
     if to_char((p_value->>'scheduledFor')::date,'YYYY-MM-DD')<>p_value->>'scheduledFor'
       or jsonb_typeof(p_value->'nextReview') is distinct from 'string' then raise exception 'Invalid review date'; end if;
     if p_value->>'nextReview'<>'' then
       if p_value->>'nextReview' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid review date'; end if;
       perform (p_value->>'nextReview')::date;
     end if;
     if (select count(distinct a->>'id') from jsonb_array_elements(p_value->'answers') a)<>jsonb_array_length(p_value->'answers') then raise exception 'Duplicate answer'; end if;
     for part in select * from jsonb_array_elements(p_value->'answers') loop
       if jsonb_typeof(part) is distinct from 'object' or jsonb_typeof(part->'id') is distinct from 'string' or part->>'id' !~ '^e[1-5]$'
         or jsonb_typeof(part->'text') is distinct from 'string' or length(part->>'text')>6000 then raise exception 'Invalid answer'; end if;
     end loop;
     for part in select * from jsonb_array_elements(p_value->'history') loop
       if jsonb_typeof(part) is distinct from 'object' or jsonb_typeof(part->'at') is distinct from 'string'
         or part->>'at' !~ '^\d{4}-\d{2}-\d{2}T' or jsonb_typeof(part->'rating') is distinct from 'string'
         or part->>'rating' not in ('again','hard','good') or jsonb_typeof(part->'minutes') is distinct from 'number'
         or part->>'minutes' !~ '^\d+$' then raise exception 'Invalid review'; end if;
       perform (part->>'at')::timestamptz;
       if (part->>'minutes')::integer not between 1 and 240 then raise exception 'Invalid review duration'; end if;
     end loop;
   end if;
   -- Reject malformed dates before they can break another device's cache.
   if p_kind in ('notes','conversations','studyUnits','studyProgress') then
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

