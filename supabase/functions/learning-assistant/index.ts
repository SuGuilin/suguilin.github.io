import {createAssistantHandler} from './handler.js';
import knowledge from '../_shared/knowledge.json' with {type:'json'};
const env={SUPABASE_URL:Deno.env.get('SUPABASE_URL')??'',SUPABASE_ANON_KEY:Deno.env.get('SUPABASE_ANON_KEY')??'',OPENAI_API_KEY:Deno.env.get('OPENAI_API_KEY')??'',OPENAI_MODEL:Deno.env.get('OPENAI_MODEL')??'',OPENAI_WEB_SEARCH:Deno.env.get('OPENAI_WEB_SEARCH')??'false',ALLOWED_ORIGINS:Deno.env.get('ALLOWED_ORIGINS')??'https://suguilin.github.io'};
Deno.serve(createAssistantHandler({env,knowledge}));
