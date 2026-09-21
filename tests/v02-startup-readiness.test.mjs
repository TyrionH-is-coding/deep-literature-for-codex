import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import { apply } from '../src/identity.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function fixture(t){
 const routes=new Map(),sent=[],errors=[],dispose=[];let resolve,reject;
 const loaded=new Promise((a,b)=>{resolve=a;reject=b;});const oldIdentity=process.env.CSR_IDENTITY,oldSend=process.send,oldError=console.error;
 process.env.CSR_IDENTITY=JSON.stringify({instanceId:'fixture-instance',launchId:'fixture-launch',version:'test'});process.send=m=>sent.push(m);console.error=m=>errors.push(m);
 const server=http.createServer((req,res)=>{const handler=routes.get(req.url);if(handler)handler(req,res);else res.writeHead(404).end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const ctx={webServer:{port:server.address().port,register:({path,handler})=>{routes.set(path,handler);return()=>routes.delete(path);}},get:()=>({await:()=>loaded}),on:(event,fn)=>{if(event==='dispose')dispose.push(fn);}};
 t.after(async()=>{for(const fn of dispose)fn();await new Promise(r=>server.close(r));process.send=oldSend;console.error=oldError;if(oldIdentity===undefined)delete process.env.CSR_IDENTITY;else process.env.CSR_IDENTITY=oldIdentity;});
 assert.equal(apply(ctx),undefined,'apply must return synchronously to avoid loader self-wait');
 return {routes,sent,errors,resolve,reject,dispose,url:`http://127.0.0.1:${ctx.webServer.port}`};
}
test('port/identity do not announce while bridge recovery is delayed; success announces once',async t=>{
 const f=await fixture(t);await pause(150);assert.equal(f.sent.length,0);let page=await fetch(f.url+'/__workbench');assert.equal(page.status,503);assert.match(await page.text(),/启动中/);
 f.routes.set('/__workbench/ready',(_q,r)=>{r.writeHead(200,{'content-type':'application/json'});r.end(JSON.stringify({ready:true,instanceId:'fixture-instance'}));});f.resolve();
 for(let n=0;n<100&&!f.sent.length;n++)await pause(10);assert.equal(f.sent.length,1);assert.equal(f.sent[0].type,'workbench-ready');await pause(150);assert.equal(f.sent.length,1);page=await fetch(f.url+'/__workbench');assert.equal(page.status,200);assert.match(await page.text(),/已启动/);
});
for(const mode of ['missing bridge','wrong instance','loader failure','disposed'])test(mode+' never announces ready',async t=>{
 const f=await fixture(t);
 if(mode==='wrong instance')f.routes.set('/__workbench/ready',(_q,r)=>r.end(JSON.stringify({ready:true,instanceId:'foreign'})));
 if(mode==='disposed')for(const fn of f.dispose)fn();
 if(mode==='loader failure')f.reject(new Error('fixture failure'));else f.resolve();
 await pause(150);assert.equal(f.sent.length,0);
 if(mode!=='disposed'){assert.deepEqual(f.errors,['workbench_startup_not_ready']);const page=await fetch(f.url+'/__workbench');assert.equal(page.status,503);assert.match(await page.text(),/启动未完成/);}
});
