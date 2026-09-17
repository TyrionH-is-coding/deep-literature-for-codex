import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const base=path.resolve(import.meta.dirname,'../../..');
const req=createRequire(path.join(base,'.local/runtime/package.json'));
const load=async n=>import(pathToFileURL(req.resolve('@deepseek-ai/'+n)).href);
const {Context}=await load('cordis');
const {Session,default:Sessions}=await load('dsh-session');
const {default:Persistence}=await load('dsh-session-persistence-jsonl');
const {createUserMessage,createAssistantMessage,createToolResultMessage}=await load('dsh-llm');
const {Inbox}=await load('dsh-agent');
const [mode,root,output,input]=process.argv.slice(2);
if(!path.resolve(root).startsWith(path.join(base,'.local')+path.sep)) throw Error('isolated root required');
process.env.DSH_HOME=path.join(root,'home');
await fs.mkdir(path.join(root,'workspace'),{recursive:true});
const cwd=await fs.realpath(path.join(root,'workspace'));
const ctx=new Context();
ctx.plugin(Sessions);
ctx.plugin(Persistence,{root:path.join(root,'home/sessions'),compression:'zstd'});
await new Promise(resolve=>setTimeout(resolve,100));
const p=ctx.sessionPersistence;
let result={mode,root,cwd};
try {
 if(mode==='seed') {
  const user=t=>createUserMessage({content:[{type:'text',text:t}],source:{kind:'user'}});
  const s=new Session('v02-006b-parent',[],{version:0,id:'v02-006b-parent',createdAt:1700000000000,cwd,delegationDepth:0});
  s.append('user/message',user('合成历史 '+cwd), {surfaceOp:'append'});
  s.append('turn/start',{turn:1}); s.append('step/start',{turn:1,step:1});
  const assistant=id=>createAssistantMessage({content:[{type:'tool-call',id,name:'v02_canary',arguments:'{}'}],source:{kind:'model',provider:'v02-local',model:'canary'}});
  s.append('assistant/message',{turn:1,step:1,message:assistant('completed-call')},{surfaceOp:'append'});
  s.append('tool/call',{turn:1,step:1,callId:'completed-call',name:'v02_canary',arguments:{}});
  s.append('tool/result',{turn:1,step:1,message:createToolResultMessage({callId:'completed-call',isError:false,content:[{type:'text',text:'SYNTHETIC_RESULT_OK'}]})},{surfaceOp:'append'});
  s.append('step/end',{turn:1,step:1});s.append('turn/end',{turn:1,reason:{kind:'stop'}});
  s.append('turn/start',{turn:2});s.append('step/start',{turn:2,step:1});
  s.append('assistant/message',{turn:2,step:1,message:assistant('unfinished-call')},{surfaceOp:'append'});
  s.append('tool/call',{turn:2,step:1,callId:'unfinished-call',name:'v02_canary',arguments:{}});
  const inbox=new Inbox(s,{inserted(){},discarded(){},claimed(){}});
  inbox.append('next-turn',user('PENDING_TURN_CANARY'));inbox.append('next-step',user('PENDING_STEP_CANARY'));
  const child=new Session('v02-006b-child',[],{version:0,id:'v02-006b-child',createdAt:1700000000001,cwd,parentSession:s.id,origin:'subagent',delegationDepth:1});
  child.append('user/message',user('CHILD_HISTORY'),{surfaceOp:'append'});
  for(const session of [s,child]) await p.materialize(session.header,session.events);
  await fs.writeFile(path.join(root,'home/.credentials.yaml'),'V02_KEY: SYNTHETIC_CREDENTIAL_CANARY\n');
  await fs.writeFile(path.join(root,'home/settings.yaml'),'synthetic: SYNTHETIC_SETTINGS_CANARY\n');
 }
 if(mode==='adapt') {
  const src=JSON.parse(await fs.readFile(input,'utf8'));
  const allowed=new Set(['version','id','createdAt','cwd','parentSession','seedLength','origin','delegationDepth','agentPreset']);
  const ids=new Set(src.sessions.map(x=>x.stored.meta.id));
  if(ids.size!==src.sessions.length)throw Error('duplicate session ID');
  for(const item of src.sessions){
   for(const key of Object.keys(item.stored.meta))if(!allowed.has(key))throw Error('unknown header field '+key);
   if(item.stored.meta.version!==0)throw Error('unsupported format');
   if(JSON.stringify(item.stored).includes('SYNTHETIC_CREDENTIAL_CANARY'))throw Error('known secret canary in history; refusing without deletion');
   const seen=new Set([item.stored.meta.id]);let parent=item.stored.meta.parentSession;while(parent){if(seen.has(parent)||!ids.has(parent))throw Error('invalid parent graph');seen.add(parent);parent=src.sessions.find(x=>x.stored.meta.id===parent).stored.meta.parentSession;}
  }
  for(const item of src.sessions) await p.materialize({...item.stored.meta,cwd},item.stored.events);
 }
 result.sessions=[];
 for(const meta of await p.list()) {
  const stored=await p.readFrom(meta.id,0);
  const inspected=await p.inspect(meta.id);
  const session=Session.fromRestore(meta.id,structuredClone(stored.events),structuredClone(stored.meta));
  const inbox=new Inbox(session,{inserted(){},discarded(){},claimed(){}});
  result.sessions.push({stored,inspected,queue:{nextTurn:inbox.nextTurn,nextStep:inbox.nextStep},location:p.locate(stored.meta)});
 }
 await fs.writeFile(output,JSON.stringify(result,null,2));
} finally {await ctx.fiber.dispose();}
