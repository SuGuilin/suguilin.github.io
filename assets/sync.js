import {defaultState,validateState} from './state.js';

const lists=['saved','completed','milestones','mastered','reading'];
export function toDocuments(state) {
  const s=validateState(state),docs=new Map();
  for(const kind of lists) for(const id of s[kind]) docs.set(kind+':'+id,{kind,id,value:true,deleted:false});
  for(const kind of ['notes','conversations','studyUnits','studyProgress']) for(const value of s[kind]) docs.set(kind+':'+value.id,{kind,id:value.id,value,deleted:false});
  docs.set('settings:pace',{kind:'settings',id:'pace',value:s.pace,deleted:false});
  docs.set('settings:dailyMinutes',{kind:'settings',id:'dailyMinutes',value:s.dailyMinutes,deleted:false});
  return docs;
}
export function fromDocuments(documents) {
  const state=defaultState();
  for(const d of documents) {
    if(d.deleted)continue;
    if(lists.includes(d.kind)&&d.value===true)state[d.kind].push(d.id);
    if(['notes','conversations','studyUnits','studyProgress'].includes(d.kind))state[d.kind].push(d.value);
    if(d.kind==='settings'&&d.id==='pace')state.pace=d.value;
    if(d.kind==='settings'&&d.id==='dailyMinutes')state.dailyMinutes=d.value;
  }
  return validateState(state);
}

// Per-document compare-and-swap, durable outbox and tombstones. A concurrent
// edit becomes a visible conflict; it is never silently replaced by a union.
export class SyncEngine {
  constructor({client,storage,key,onChange=()=>{},onStatus=()=>{}}) {
    Object.assign(this,{client,storage,key,onChange,onStatus});
    this.documents=new Map();this.pending=new Map();this.conflicts=new Map();this.running=null;this.generation=0;
    this.restore();
  }
  restore(){try{const raw=JSON.parse(this.storage.getItem(this.key)||'null');if(raw){this.documents=new Map(raw.documents);this.pending=new Map(raw.pending);this.conflicts=new Map(raw.conflicts);fromDocuments([...this.documents.values()]);}}catch{this.documents=new Map();this.pending=new Map();this.conflicts=new Map();}}
  save(){this.storage.setItem(this.key,JSON.stringify({documents:[...this.documents],pending:[...this.pending],conflicts:[...this.conflicts]}));}
  state(){return fromDocuments([...this.documents.values()]);}
  capture(next){const incoming=toDocuments(next),keys=new Set([...this.documents.keys(),...incoming.keys()]);
    for(const key of keys){const previous=this.documents.get(key),value=incoming.get(key)??{...previous,deleted:true,value:null};if(!value)continue;
      if(previous&&previous.deleted===value.deleted&&JSON.stringify(previous.value)===JSON.stringify(value.value))continue;
      const oldPending=this.pending.get(key);
      const change={...value,baseRevision:oldPending?.baseRevision??previous?.revision??0,operationId:crypto.randomUUID()};
      this.documents.set(key,{...value,revision:previous?.revision??0});this.pending.set(key,change);
      if(this.conflicts.has(key))this.conflicts.set(key,{...this.conflicts.get(key),local:change});
    }
    this.save();this.onStatus({status:'pending',count:this.pending.size});
  }
  resolve(key,choice){const conflict=this.conflicts.get(key);if(!conflict)return;
    if(choice==='remote'){if(conflict.remote)this.documents.set(key,conflict.remote);else this.documents.delete(key);this.pending.delete(key);}
    else {const local={...conflict.local,baseRevision:conflict.remote?.revision??0,operationId:crypto.randomUUID()};this.pending.set(key,local);this.documents.set(key,{...local,revision:local.baseRevision});}
    this.conflicts.delete(key);this.save();this.onChange(this.state());return this.sync();
  }
  stop(){this.generation++;}
  sync(){if(this.running)return this.running;const generation=this.generation;this.running=this.perform(generation).finally(()=>{this.running=null;});return this.running;}
  async perform(generation){
    this.onStatus({status:'syncing',count:this.pending.size});
    try{
      // Pull all pages: the server's default row limit must not drop old notes.
      const remote=[];for(let offset=0;;offset+=500){const {data,error}=await this.client.from('workspace_documents').select('kind,id,value,deleted,revision,updated_at,operation_id').order('kind').order('id').range(offset,offset+499);if(error)throw error;remote.push(...data);if(data.length<500)break;}
      if(generation!==this.generation)return;
      for(const doc of remote){const key=doc.kind+':'+doc.id;if(!this.pending.has(key))this.documents.set(key,doc);}
      this.save();this.onChange(this.state());
      for(const [key,change] of [...this.pending]){
        if(this.conflicts.has(key))continue;
        const {data,error}=await this.client.rpc('save_workspace_document',{p_kind:change.kind,p_id:change.id,p_value:change.value,p_deleted:change.deleted,p_base_revision:change.baseRevision,p_operation_id:change.operationId});if(error)throw error;
        if(generation!==this.generation)return;
        const current=this.pending.get(key);
        if(data.conflict){this.conflicts.set(key,{local:current??change,remote:data.document});}
        else if(current?.operationId===change.operationId){this.pending.delete(key);this.documents.set(key,data.document);}
        else if(current){this.pending.set(key,{...current,baseRevision:data.document.revision});this.documents.set(key,{...this.documents.get(key),revision:data.document.revision});}
        this.save();
      }
      this.onChange(this.state());
      this.onStatus({status:this.conflicts.size?'conflict':this.pending.size?'pending':'synced',count:this.pending.size,conflicts:this.conflicts.size,lastSync:new Date().toISOString()});
    }catch(error){if(generation===this.generation)this.onStatus({status:'error',count:this.pending.size,message:error.message||'同步失败'});}
  }
}
