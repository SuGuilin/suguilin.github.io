import {readFile,writeFile,mkdir} from 'node:fs/promises';
const resources=JSON.parse(await readFile('content/workspace.json','utf8'));
const lessons=JSON.parse(await readFile('content/lessons.json','utf8'));
await mkdir('supabase/functions/_shared',{recursive:true});
await writeFile('supabase/functions/_shared/knowledge.json',JSON.stringify({verifiedAt:resources.verifiedAt,resources:resources.resources,lessons:lessons.lessons},null,2)+'\n');
