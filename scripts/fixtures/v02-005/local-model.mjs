// Reduced from V02-004K host-probe.mjs: one synthetic response, observation only.
// No network provider, tool calls, gate injection or session-state mutation.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
export const name='v005-synthetic-model';
export const inject=['llm','agents','webServer'];
export async function apply(ctx,config) {
 const require=createRequire(config.entry);
 const {LlmAdapter}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-llm')));
 let calls=0;
 const model={provider:'v005-local',id:'synthetic',name:'V02-005 synthetic only',inputModalities:['text']};
 ctx.llm.registerAdapter(['v005-local'],new class extends LlmAdapter {
  providerInfo(){return {id:'v005-local',name:'V02-005 local synthetic'};}
  async listModels(){return [model];}
  async resolveModel(){return model;}
  async *stream(){
   calls++;
   const text='V02-005 SYNTHETIC CONFIRMATION. 本地合成确认：未调用工具，未调用真实模型。';
   yield {type:'block-start',index:0,blockType:'text'};
   yield {type:'text-delta',index:0,text};
   yield {type:'block-end',index:0,block:{type:'text',text}};
   yield {type:'finish',reason:{kind:'stop'}};
  }
 }());
 ctx.webServer.register({kind:'exact',path:'/v005-probe',async handler(req,res){
  let body='';for await(const bytes of req)body+=bytes;
  const {sessionId}=JSON.parse(body),agent=ctx.agents.get(sessionId);
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({calls,status:agent?.status,events:agent?.session.events}));
 }});
}
