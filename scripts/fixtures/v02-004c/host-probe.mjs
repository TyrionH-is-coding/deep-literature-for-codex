// Synthetic probe endpoint only; invokes the existing B helper, no proposed A API.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {cancelOwnedDispatch,inspectDispatchEvidence} from '../../../src/modules/bridge/index.mjs';
export const name='v02-004c-probe';
export const inject=['llm','agents','webServer'];
export async function apply(ctx,config){
 const req=createRequire(config.entry);
 const {LlmAdapter}=await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-llm')).href);
 const claims=new WeakMap(), releases=new Set();let calls=0,aborted=0;
 ctx.on('agent/inbox/claimed',({agent,message,turn})=>{let c=claims.get(agent);if(c?.turn!==turn)claims.set(agent,c={turn,rpcIds:new Set()});if(message.source?.kind==='user')c.rpcIds.add(message.source.rpcId);});
 const model={provider:'v4c-local',id:'synthetic',name:'synthetic',inputModalities:['text']};
 ctx.llm.registerAdapter(['v4c-local'],new class extends LlmAdapter{
  providerInfo(){return {id:'v4c-local',name:'synthetic'}} async listModels(){return [model]} async resolveModel(){return model}
  async *stream(options){calls++;await new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);releases.delete(done);options.signal?.removeEventListener('abort',onAbort);resolve()};const onAbort=()=>{aborted++;done()};releases.add(done);timer=setTimeout(done,15000);options.signal?.addEventListener('abort',onAbort,{once:true});if(options.signal?.aborted)onAbort();});if(options.signal?.aborted)return;yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text:'SYNTHETIC'};yield {type:'block-end',index:0,block:{type:'text',text:'SYNTHETIC'}};yield {type:'finish',reason:{kind:'stop'}};}
 }());
 ctx.webServer.register({kind:'exact',path:'/v4c-probe',async handler(req,res){try{let body='';for await(const x of req)body+=x;const p=JSON.parse(body),agent=ctx.agents.get(p.sessionId);let result;
 if(p.action==='stage-shared')for(const id of ['mixed-ours','mixed-other'])agent.inbox.append('next-step',{id,role:'user',source:{kind:'user',rpcId:id},content:[{type:'text',text:'SYNTHETIC '+id}]});
 if(p.action==='release')for(const release of [...releases])release();
 if(p.action==='cancel')result=cancelOwnedDispatch(agent,{dispatches:{one:{rpcId:p.rpcId}}},claims.get(agent));
 res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({result,calls,aborted,status:agent?.status,evidence:agent&&p.rpcId?inspectDispatchEvidence(agent,p.rpcId):null,queue:agent?[...agent.inbox.nextTurn,...agent.inbox.nextStep].map(m=>m.source?.rpcId):[],events:agent?.session.events.filter(e=>['turn/start','turn/end','user/message','agent/inbox/spliced'].includes(e.type))}));}catch(e){res.writeHead(500);res.end(String(e.stack))}}});
}
