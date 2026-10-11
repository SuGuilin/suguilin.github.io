import {createSynthesisHandler} from './handler.js';
const env=Object.fromEntries(['SUPABASE_URL','SUPABASE_ANON_KEY','OPENAI_API_KEY','OPENAI_MODEL','ALLOWED_ORIGINS'].map(k=>[k,Deno.env.get(k)||'']));
Deno.serve(createSynthesisHandler({env}));
