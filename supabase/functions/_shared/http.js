export function corsHeaders(origin,allowedOrigins) {
  if(!origin||!allowedOrigins.includes(origin))return null;
  return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
}
export function jsonResponse(body,status=200,headers={}) {return new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});}
export async function authenticate(request,env,fetcher=fetch){
  const auth=request.headers.get('authorization');
  if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth||''))return null;
  const headers={Authorization:auth,apikey:env.SUPABASE_ANON_KEY};
  const response=await fetcher(env.SUPABASE_URL+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;
  const user=await response.json();if(!user.id)return null;
  const member=await fetcher(env.SUPABASE_URL+'/rest/v1/rpc/is_workspace_member',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
  if(!member.ok||await member.json()!==true)return null;
  return {id:user.id,headers};
}
export async function* readSSE(body){
  const reader=body.getReader(),decoder=new TextDecoder();let buffer='';
  try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let end;
    if(buffer.length>2000000)throw new Error('Stream frame too large');
    while((end=buffer.search(/\r?\n\r?\n/))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+(buffer[end]==='\r'?4:2));const data=frame.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data&&data!=='[DONE]')yield JSON.parse(data);}
    if(done)break;
  }}finally{reader.releaseLock();}
}
