import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const core=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../core.js',import.meta.url))).toString('base64'));
const source=fs.readFileSync(new URL('../network.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const url='https://drive.google.com/uc?export=download&id=1vk33oUmSovXMik28CZahHeokxRWYR46c';
function network(fetch){
  const context=vm.createContext({fetch,...core,URL,AbortController,TextDecoder,setTimeout,clearTimeout});
  vm.runInContext(source+'\nglobalThis.api={request,resolveDownload};',context);
  return context.api;
}
test('login redirect becomes actionable without reading account page',async()=>{
  let canceled=false;
  const api=network(async()=>({status:200,url:'https://accounts.google.com/ServiceLogin?service=wise',body:{cancel:async()=>{canceled=true;},getReader:()=>{throw new Error('Must not read account page');}},headers:{get:()=>{throw new Error('Must not inspect account headers');}}}));
  const result=await api.resolveDownload(url,'omit',core.parseLink(url));
  assert.equal(result.status,'action');assert.match(result.message,/đăng nhập Google/);
  assert.equal(result.body,'');assert.equal(canceled,true);assert.equal(result.downloadUrl,undefined);
});
test('a logged-in retry can resolve file after anonymous login redirect',async()=>{
  const calls=[];
  const api=network(async(url,options)=>{
    calls.push(options.credentials);
    return options.credentials==='omit'?{status:200,url:'https://accounts.google.com/ServiceLogin',body:{cancel:async()=>{}}}:
      {status:200,url:'https://drive.usercontent.google.com/download',headers:{get:key=>({'content-type':'application/pdf','content-disposition':'attachment; filename="Report.pdf"'}[key]||'')},body:{cancel:async()=>{}}};
  });
  const anonymous=await api.resolveDownload(url,'omit',core.parseLink(url));
  assert.equal(anonymous.status,'action');
  const authenticated=await api.resolveDownload(url,'include',core.parseLink(url));
  assert.equal(authenticated.status,'ready');assert.equal(authenticated.name,'Report.pdf');
  assert.equal(authenticated.downloadUrl,'https://drive.usercontent.google.com/download');
  assert.deepEqual(calls,['omit','include']);
});
test('manifest grants exact Google Accounts host required by redirect',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url),'utf8'));
  assert.ok(manifest.host_permissions.includes('https://accounts.google.com/*'));
  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
});

 test('large file confirmation returns the final file URL after redirect',async()=>{
   const item=core.parseLink(url);let count=0;
   const form='<p>This file is too large to scan</p><form id="download-form" action="https://drive.usercontent.google.com/download"><input type="hidden" name="id" value="'+item.id+'"><input type="hidden" name="export" value="download"><input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="sample-ticket"></form>';
   const api=network(async()=>++count===1?{status:200,url:'https://drive.usercontent.google.com/download?id='+item.id,headers:{get:key=>key==='content-type'?'text/html':''},body:new Response(form).body}:
     {status:200,url:'https://sample.googleusercontent.com/file-final',headers:{get:key=>key==='content-type'?'application/octet-stream':''},body:{cancel:async()=>{}}});
   const result=await api.resolveDownload(url,'include',item);
   assert.equal(count,2);assert.equal(result.status,'ready');assert.equal(result.confirmed,true);
   assert.equal(result.downloadUrl,'https://sample.googleusercontent.com/file-final');
 });
 test('download redirect outside supported Google hosts is rejected',async()=>{
   const api=network(async()=>({status:200,url:'https://example.org/file',headers:{get:key=>key==='content-type'?'application/octet-stream':''},body:{cancel:async()=>{}}}));
   const result=await api.resolveDownload(url,'include',core.parseLink(url));
   assert.equal(result.status,'action');assert.equal(result.downloadUrl,undefined);
 });
