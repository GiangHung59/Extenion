import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
async function sourceModule(name){return import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../'+name,import.meta.url))).toString('base64'));}
const {installIdleHide}=await sourceModule('idle-hide.js');
const {installToolPanel,mountToolPanel,hideToolPanel}=await sourceModule('tool-panel.js');
function idleHarness(){
  let now=0,id=0,hidden=0;const tasks=new Map();
  const windowListeners={},documentListeners={};
  const target={addEventListener:(name,fn)=>windowListeners[name]=fn};
  const activity={addEventListener:(name,fn)=>documentListeners[name]=fn};
  const timers={clearTimeout:id=>tasks.delete(id),setTimeout:(fn,delay)=>{tasks.set(++id,{fn,at:now+delay});return id;}};
  installIdleHide(target,activity,()=>{hidden++;},e=>{throw e;},timers);
  const advance=async ms=>{now+=ms;for(const [id,task] of tasks)if(task.at<=now){tasks.delete(id);task.fn();}await Promise.resolve();await Promise.resolve();};
  return {windowListeners,documentListeners,advance,get hidden(){return hidden;}};
}
test('tool remains open on blur and closes only after 20 seconds idle',async()=>{
  const h=idleHarness();assert.equal(h.windowListeners.blur,undefined);
  await h.advance(19999);assert.equal(h.hidden,0);
  await h.advance(1);assert.equal(h.hidden,1);
});
test('typing, mouse movement and returning to tool each restart idle countdown',async()=>{
  const h=idleHarness();
  for(const name of ['input','pointermove','keydown','wheel']){
    await h.advance(19000);h.documentListeners[name]();assert.equal(h.hidden,0);
  }
  await h.advance(19000);h.windowListeners.focus();
  await h.advance(19999);assert.equal(h.hidden,0);await h.advance(1);assert.equal(h.hidden,1);
});
test('closing page cancels pending idle timer',async()=>{
  const h=idleHarness();h.windowListeners.pagehide();await h.advance(30000);assert.equal(h.hidden,0);
});

 test('toolbar mounts overlay in the clicked tab without creating a window',async()=>{
   let clicked;const calls=[];
   const chrome={runtime:{getURL:p=>'chrome-extension://drive-batch/'+p},action:{onClicked:{addListener:fn=>clicked=fn}},scripting:{executeScript:async options=>calls.push(options)}};
   installToolPanel(chrome);await Promise.all([clicked({id:17}),clicked({id:17})]);
   assert.equal(calls.length,1);assert.equal(calls[0].target.tabId,17);
   assert.equal(calls[0].func,mountToolPanel);assert.match(calls[0].args[0],/overlay=1/);
   await clicked({id:18});assert.equal(calls[1].target.tabId,18);
 });
 test('idle hiding removes panel from its own tab',async()=>{
   let call;await hideToolPanel({scripting:{executeScript:async options=>{call=options;}}},17);
   assert.equal(call.target.tabId,17);assert.deepEqual(call.args,['drive-batch-floating-panel']);
 });
 test('mounting twice reuses a single panel and does not install outside-click dismissal',async()=>{
   const {default:vm}=await import('node:vm');const nodes=new Map();let focusCount=0;
   const make=tag=>({tag,style:{},append(child){this.child=child;},attachShadow(){this.shadowRoot={append(child){this.child=child;},querySelector(){return this.child;}};return this.shadowRoot;},contentWindow:{focus(){focusCount++;}}});
   const document={getElementById:id=>nodes.get(id),createElement:make,documentElement:{append:host=>nodes.set(host.id,host)}};
   const run=vm.runInNewContext('('+mountToolPanel.toString()+')',{document});
   run('chrome-extension://test/index.html?popup=1&overlay=1','panel');
   run('chrome-extension://test/index.html?popup=1&overlay=1','panel');
   assert.equal(nodes.size,1);assert.equal(focusCount,1);
   assert.equal(nodes.get('panel').shadowRoot.child.tag,'iframe');
   assert.match(nodes.get('panel').style.cssText,/position:fixed/);
 });
