import test from 'node:test';
import assert from 'node:assert/strict';

const doc=n=>`https://docs.google.com/document/d/document_id_000${n}/edit`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function event(){const callbacks=[];return {addListener(fn){callbacks.push(fn);},async fire(...args){for(const fn of callbacks)await fn(...args);}};}
async function setup({respond,stored}={}){
  let saved=stored?structuredClone(stored):{items:[],paused:true,destination:{configured:true,subfolder:''}},nextId=1;
  const downloads=new Map(),started=[];
  const onMessage=event(),onChanged=event(),onAlarm=event(),onDeterminingFilename=event();
  globalThis.chrome={
    storage:{local:{async get(){return {batch:structuredClone(saved)};},async set({batch}){saved=structuredClone(batch);}}},
    runtime:{id:'test',getURL:path=>`chrome-extension://test/${path}`,onMessage},
    downloads:{onChanged,onDeterminingFilename,async search({id}){return downloads.has(id)?[structuredClone(downloads.get(id))]:[];},async download(options){const id=nextId++;started.push(options);downloads.set(id,{id,state:'in_progress',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',filename:'/Downloads/test.docx'});return id;},async cancel(id){downloads.get(id).state='interrupted';},async removeFile(id){downloads.get(id).removed=true;}},
    action:{onClicked:event()},alarms:{create(){},onAlarm},tabs:{async query(){return [];},async create(){}},scripting:{}
  };
  globalThis.fetch=async(url,options)=>{
    const config=respond?await respond(url,options):{};
    const response=new Response(config?.body||'file-content',{status:config?.status||200,headers:{'content-type':config?.mime||'application/octet-stream','content-disposition':config?.disposition??'attachment; filename="test.docx"'}});
    Object.defineProperty(response,'url',{value:config?.url||url});return response;
  };
  await import(`../background.js?test=${Math.random()}`);
  const send=message=>new Promise(resolve=>onMessage.fire(message,{id:'test',url:'chrome-extension://test/index.html'},resolve));
  async function until(predicate){for(let i=0;i<200;i++){const state=await send({type:'get'});if(predicate(state))return state;await sleep(5);}throw new Error('Timed out waiting for worker');}
  return {send,until,downloads,started,onChanged,onAlarm,onDeterminingFilename};
}
test('queue caps active downloads at two, advances on completion, and retains statuses',async()=>{
  const h=await setup();
  await h.send({type:'add',items:[1,2,3].map(n=>({url:doc(n)}))});
  await h.send({type:'queue',ids:[1,2,3].map(n=>`document_id_000${n}`),mode:'download'});
  await h.until(s=>s.items.filter(i=>i.status==='downloading').length===2);
  assert.equal(h.started.length,2);
  h.downloads.get(1).state='complete';await h.onChanged.fire({id:1,state:{current:'complete'}});
  const state=await h.until(s=>s.items[2].status==='downloading');
  assert.equal(state.items[0].status,'done');assert.equal(h.started.length,3);
});
test('check-only mode checks session fallback without initiating downloads',async()=>{
  const seen=[];
  const h=await setup({respond:async(url,options)=>{seen.push(options.credentials);return options.credentials==='omit'?{status:403,mime:'text/html',body:'Access denied',disposition:''}:{};}});
  await h.send({type:'add',items:[{url:doc(1)}]});
  await h.send({type:'queue',ids:['document_id_0001'],mode:'check'});
  const state=await h.until(s=>s.items[0].status==='ready');
  assert.equal(state.items[0].access,'session');assert.deepEqual(seen,['omit','include']);assert.equal(h.started.length,0);
});
test('HTML confirmation is never submitted to downloads',async()=>{
  const h=await setup({respond:async()=>({mime:'text/html',body:'<form id="download-form">virus</form>',disposition:''})});
  await h.send({type:'add',items:[{url:doc(1)}]});
  await h.send({type:'queue',ids:['document_id_0001'],mode:'download'});
  const state=await h.until(s=>s.items[0].status==='action');assert.match(state.items[0].message,/xác nhận/);assert.equal(h.started.length,0);
});
test('stop during probe prevents download and resets queued items',async()=>{
  let release;const gate=new Promise(r=>release=r);
  const h=await setup({respond:async()=>{await gate;return {};}});
  await h.send({type:'add',items:[{url:doc(1)},{url:doc(2)}]});
  await h.send({type:'queue',ids:['document_id_0001','document_id_0002'],mode:'download'});
  await h.until(s=>s.items[0].status==='preparing');
  await h.send({type:'stop'});release();
  const state=await h.until(s=>s.items[0].status==='ready');assert.equal(state.paused,true);assert.equal(state.items[1].status,'new');assert.equal(h.started.length,0);
});
test('worker restart flags uncertain starts instead of automatically downloading again',async()=>{
  const h=await setup({stored:{paused:false,items:[{id:'document_id_0001',url:doc(1),type:'document',status:'preparing'}]}});
  const state=await h.send({type:'get'});assert.equal(state.items[0].status,'action');assert.equal(h.started.length,0);
});
test('worker validates message URLs, deduplicates IDs and ignores folder downloads',async()=>{
  const h=await setup();
  assert.ok((await h.send({type:'add',items:[{url:'https://evil.test/file'}]})).error);
  await h.send({type:'add',items:[{url:doc(1)},{url:doc(1)},{url:'https://drive.google.com/drive/folders/folder_id_000001'}]});
  const state=await h.send({type:'get'});assert.equal(state.items.length,2);
  await h.send({type:'queue',ids:['folder_id_000001'],mode:'download'});assert.equal(h.started.length,0);
});

test('large-file confirmation reaches Chrome Downloads with the confirmed URL',async()=>{
  const id='large_file_id_001';
  const h=await setup({respond:async(url)=>{
    if(url.includes('/file/d/'))return {};
    if(new URL(url).searchParams.has('confirm'))return {disposition:'attachment; filename="Large.psd"'};
    return {url:`https://drive.usercontent.google.com/download?id=${id}&export=download`,mime:'text/html',disposition:'',body:`<p>This file is too large for Google to scan.</p><form id="download-form" method="get" action="https://drive.usercontent.google.com/download"><input type="hidden" name="id" value="${id}"><input type="hidden" name="export" value="download"><input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="fixture-uuid"></form>`};
  }});
  await h.send({type:'add',items:[{url:`https://drive.usercontent.google.com/open?id=${id}&authuser=0`}]});
  await h.send({type:'queue',ids:[id],mode:'download'});
  const state=await h.until(s=>s.items[0].status==='downloading');
  assert.equal(state.items[0].confirmed,true);assert.equal(h.started.length,1);
  assert.equal(new URL(h.started[0].url).searchParams.get('uuid'),'fixture-uuid');assert.equal(new URL(h.started[0].url).searchParams.get('authuser'),'0');
});

test('first download requires choosing a destination, check-only does not',async()=>{
  const h=await setup({stored:{items:[],paused:true}});
  await h.send({type:'add',items:[{url:doc(1)}]});
  assert.match((await h.send({type:'queue',ids:['document_id_0001'],mode:'download'})).error,/Chọn nơi lưu/);
  await h.send({type:'queue',ids:['document_id_0001'],mode:'check'});
  await h.until(s=>s.items[0].status==='ready');assert.equal(h.started.length,0);
  await h.send({type:'destination',subfolder:'Dự án/Tháng 9'});
  await h.send({type:'queue',ids:['document_id_0001'],mode:'download'});
  const state=await h.until(s=>s.items[0].status==='downloading');
  assert.equal(state.items[0].targetFolder,'Dự án/Tháng 9');
});

test('folder stays fixed for queued batch and filename hook preserves original name',async()=>{
  const h=await setup();
  await h.send({type:'destination',subfolder:'Dự án/Đợt 1'});
  await h.send({type:'add',items:[1,2,3,4].map(n=>({url:doc(n)}))});
  await h.send({type:'queue',ids:[1,2,3].map(n=>`document_id_000${n}`),mode:'download'});
  await h.until(s=>s.items.filter(i=>i.status==='downloading').length===2);
  await h.send({type:'destination',subfolder:'Dự án/Đợt 2'});
  await h.send({type:'queue',ids:['document_id_0004'],mode:'download'});
  const state=await h.send({type:'get'});
  assert.equal(state.items[2].targetFolder,'Dự án/Đợt 1');assert.equal(state.items[3].targetFolder,'Dự án/Đợt 2');
  const suggestion=await new Promise(resolve=>h.onDeterminingFilename.fire({id:1,byExtensionId:'test',filename:'/Users/demo/Downloads/Bản vẽ.psd'},resolve));
  assert.deepEqual(suggestion,{filename:'Dự án/Đợt 1/Bản vẽ.psd',conflictAction:'uniquify'});
  const other=await new Promise(resolve=>h.onDeterminingFilename.fire({id:88,byExtensionId:'other',filename:'file.pdf'},resolve));
  assert.equal(other,undefined);
});

test('destination persists across worker reload; invalid paths do not replace it',async()=>{
  const h=await setup({stored:{items:[],paused:true,destination:{configured:true,subfolder:'Saved/Folder'}}});
  assert.equal((await h.send({type:'get'})).destination.subfolder,'Saved/Folder');
  assert.ok((await h.send({type:'destination',subfolder:'../../Desktop'})).error);
  assert.equal((await h.send({type:'get'})).destination.subfolder,'Saved/Folder');
});
