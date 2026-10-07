import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const core=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../core.js',import.meta.url))).toString('base64'));
const source=fs.readFileSync(new URL('../background.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const file=n=>({url:`https://docs.google.com/document/d/document${String(n).padStart(3,'0')}/edit`});
async function worker({saved,fail=[],cancel=false,missingName=false,htmlCount=0}={}) {
  let stored=saved?structuredClone(saved):undefined;
  const downloads=[],records=new Map(),listeners={};
  const chrome={
    storage:{local:{get:async()=>({batch:stored}),set:async({batch})=>{stored=structuredClone(batch);}}},
    runtime:{id:'drive-batch',getURL:()=> 'chrome-extension://drive-batch/',onMessage:{addListener:()=>{}}},
    alarms:{create:()=>{},onAlarm:{addListener:fn=>listeners.alarm=fn}},
    downloads:{onChanged:{addListener:fn=>listeners.changed=fn},onDeterminingFilename:{addListener:fn=>listeners.filename=fn},
      search:async({id})=>records.has(id)?[records.get(id)]:[],
      download:async options=>{
        downloads.push(options);
        if(cancel&&options.saveAs)throw new Error('USER_CANCELED');
        const id=downloads.length;
        const suggestion=await new Promise(resolve=>listeners.filename({id,url:options.url,filename:'Báo cáo.docx',byExtensionId:'drive-batch'},resolve));
        records.set(id,{id,state:'complete',mime:id<=htmlCount?'text/html':'application/octet-stream',filename:suggestion?.filename||'Báo cáo.docx'});
        return id;
      },cancel:async()=>{},removeFile:async()=>{}}
  };
  const context=vm.createContext({chrome,console,URL,structuredClone,crypto:webcrypto,...core,installToolPanel:()=>{},hideToolPanel:async()=>{},
    request:async url=>({finalUrl:url}),readLimited:async()=>'',
    resolveDownload:async(url,credentials,item)=>fail.includes(item.id)?{status:'error',message:'Không tải được'}:{status:'ready',downloadUrl:url,...(missingName?{}:{name:'Báo cáo.docx'})}
  });
  vm.runInContext(source+'\nglobalThis.testing={handle,pump,snapshot};',context);
  const api=context.testing;
  await api.snapshot();
  const drain=async()=>{
    for(let n=0;n<100;n++){
      await new Promise(resolve=>setImmediate(resolve));
      const current=await api.snapshot();
      if(!current.items.some(i=>['queued','preparing'].includes(i.status)))return current;
    }
    throw new Error('Queue did not drain');
  };
  const add=async files=>{await api.handle({type:'add',items:files});return (await api.snapshot()).items.map(i=>i.id);};
  const queue=async(ids,prefix='',mode='download')=>{await api.handle({type:'queue',ids,prefixes:typeof prefix==='string'?Object.fromEntries(ids.map(id=>[id,prefix])):prefix,mode});return drain();};
  return {api,downloads,listeners,add,queue,drain};
}

test('prefix concatenates Unicode text and preserves extensions for long names',()=>{
  assert.equal(core.prefixedName('Dự án_','Báo cáo.pdf'),'Dự án_ Báo cáo.pdf');
  assert.equal(core.prefixedName('','Báo cáo.pdf'),'Báo cáo.pdf');
  assert.equal(core.prefixedName('Dự án   ','Báo cáo.pdf'),'Dự án Báo cáo.pdf');
  assert.equal(core.prefixedName('   ','Báo cáo.pdf'),'Báo cáo.pdf');
  assert.equal(core.prefixedName('../A/','B.pdf'),'_A_ B.pdf');
  const long=core.prefixedName('A'.repeat(100),'B'.repeat(100)+'.docx');
  assert.equal(long.length,160);assert.ok(long.endsWith('.docx'));
});
test('one save dialog per click and Chrome filename receives prefix',async()=>{
  const w=await worker();const ids=await w.add([file(1),file(2),file(3)]);
  const result=await w.queue(ids,'DuAn_');
  assert.deepEqual(w.downloads.map(d=>d.saveAs),[true,false,false]);
  assert.ok(result.items.every(i=>i.filename==='DuAn_ Báo cáo.docx'));
  const next=(await w.add([file(4)])).at(-1);
  await w.queue([next],'Khác_');
  assert.equal(w.downloads.at(-1).saveAs,true);
});
test('blank prefix uses original filename, even without probe filename',async()=>{
  const w=await worker({missingName:true});const ids=await w.add([file(1),file(2)]);
  const result=await w.queue(ids);
  assert.ok(result.items.every(i=>i.filename==='Báo cáo.docx'));
});
test('prefix works when Google probe omits filename',async()=>{
  const w=await worker({missingName:true});const ids=await w.add([file(1)]);
  const result=await w.queue(ids,'Tên_');
  assert.equal(result.items[0].filename,'Tên_ Báo cáo.docx');
});
test('failed probe does not consume first dialog; retry starts a new run',async()=>{
  const w=await worker({fail:['document001']});const ids=await w.add([file(1),file(2),file(3)]);
  const result=await w.queue(ids,'A_');
  assert.deepEqual(w.downloads.map(d=>d.saveAs),[true,false]);
  assert.equal(result.items[0].status,'error');
  await w.api.handle({type:'add',items:[file(4)]});
  await w.queue(['document004'],'B_');
  assert.equal(w.downloads.at(-1).saveAs,true);
});
test('canceling first save stops remaining files; next click asks again',async()=>{
  const w=await worker({cancel:true});const ids=await w.add([file(1),file(2),file(3)]);
  let result=await w.queue(ids);
  assert.equal(w.downloads.length,1);assert.ok(result.items.every(i=>i.status==='new'));
  result=await w.queue(ids,'Again_');
  assert.equal(w.downloads.length,2);assert.equal(w.downloads.at(-1).saveAs,true);
});
test('check only never starts downloads',async()=>{
  const w=await worker();const ids=await w.add([file(1),file(2)]);
  const result=await w.queue(ids,'A_','check');
  assert.equal(w.downloads.length,0);assert.ok(result.items.every(i=>i.status==='ready'));
});
test('worker recovery retains consumed prompt and prefix for queued siblings',async()=>{
  const saved={paused:false,items:[{...core.parseLink(file(1).url),status:'queued',mode:'download',downloadRun:'previous-click',promptUsed:true,prefix:'Saved_'}]};
  const w=await worker({saved});await w.api.pump();const result=await w.drain();
  assert.equal(w.downloads[0].saveAs,false);assert.equal(result.items[0].filename,'Saved_ Báo cáo.docx');
});
test('filename listener leaves other extensions downloads alone',async()=>{
  const w=await worker();const suggestion=await new Promise(resolve=>w.listeners.filename({id:42,byExtensionId:'other',filename:'original.pdf'},resolve));
  assert.equal(suggestion,undefined);
});

 test('each link has its own prefix including a blank prefix in the same run',async()=>{
   const w=await worker();const ids=await w.add([file(1),file(2),file(3)]);
   const result=await w.queue(ids,{[ids[0]]:'Một_',[ids[1]]:'Hai_',[ids[2]]:''});
   assert.deepEqual(Array.from(result.items,i=>i.filename),['Một_ Báo cáo.docx','Hai_ Báo cáo.docx','Báo cáo.docx']);
   assert.deepEqual(w.downloads.map(d=>d.saveAs),[true,false,false]);
 });
 test('editing and checking preserve individual prefixes across popup and worker recovery',async()=>{
   const w=await worker();const ids=await w.add([file(1),file(2)]);
   await w.api.handle({type:'prefix',id:ids[0],prefix:'Lưu_'});
   await w.queue(ids,'','check');
   const saved=await w.api.snapshot();assert.equal(saved.items[0].prefix,'Lưu_');
   const restored=await worker({saved});
   await restored.api.handle({type:'queue',ids,mode:'download'});const result=await restored.drain();
   assert.equal(result.items[0].filename,'Lưu_ Báo cáo.docx');
   assert.equal(result.items[1].filename,'Báo cáo.docx');
 });

 test('HTML download is resolved again once without repeating save dialog or prefix',async()=>{
   const w=await worker({htmlCount:1});const ids=await w.add([file(1)]);
   const result=await w.queue(ids,'Dự án');
   assert.equal(w.downloads.length,2);assert.deepEqual(w.downloads.map(d=>d.saveAs),[true,false]);
   assert.equal(result.items[0].status,'done');assert.equal(result.items[0].filename,'Dự án Báo cáo.docx');
 });
 test('repeated HTML stops after one retry rather than looping',async()=>{
   const w=await worker({htmlCount:5});const ids=await w.add([file(1)]);
   const result=await w.queue(ids);
   assert.equal(w.downloads.length,2);assert.equal(result.items[0].status,'action');
   assert.match(result.items[0].message,/HTML/);
 });
