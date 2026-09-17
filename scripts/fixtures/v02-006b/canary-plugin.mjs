import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
export const name='v02-006b-canary';
export const inject=['llm','tools'];
export async function apply(ctx,config){
 const req=createRequire(config.entry);
 const {defineTool}=await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-tools')).href);
 const {LlmAdapter}=await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-llm')).href);
 const bump=kind=>fs.appendFileSync(config.counter,JSON.stringify({kind,time:new Date().toISOString()})+'\n');
 const model={provider:'v02-local',id:'canary',name:'local canary',inputModalities:['text']};
 ctx.tools.register(defineTool({name:'v02_canary',description:'Synthetic counter only',parameters:{},execute(){bump('tool-body');return {ok:true}},output:{schema:{type:'object',additionalProperties:false,properties:{ok:{type:'boolean',required:true}}},render(){return [{type:'text',text:'CANARY_TOOL_OK'}]}}}));
 ctx.llm.registerAdapter(['v02-local'],new class extends LlmAdapter{
  providerInfo(){return {id:'v02-local',name:'local canary'}}
  async listModels(){return [model]}
  async resolveModel(){return model}
  async *stream(options){bump('model');const lastUser=options.messages.findLastIndex(m=>m.source.kind==='user');if(!options.messages.slice(lastUser+1).some(m=>m.source.kind==='tool')){const id='positive-'+Date.now();yield {type:'block-start',index:0,blockType:'tool-call'};yield {type:'tool-call-delta',index:0,id,name:'v02_canary',argumentsDelta:'{}'};yield {type:'block-end',index:0,block:{type:'tool-call',id,name:'v02_canary',arguments:'{}'}};yield {type:'finish',reason:{kind:'tool-calls'}};return;}yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text:'CANARY_EXECUTED'};yield {type:'block-end',index:0,block:{type:'text',text:'CANARY_EXECUTED'}};yield {type:'finish',reason:{kind:'stop'}};}
 }());
 ctx.on('tools/execute',async(exec,next)=>{bump('tool');return next()});
 ctx.on('agent/created',()=>bump('agent-created'));
 fs.appendFileSync(config.counter,JSON.stringify({kind:'armed'})+'\n');
}
