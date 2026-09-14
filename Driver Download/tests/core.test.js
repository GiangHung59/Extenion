import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLink,parseBatch,downloadURL,classifyResponse,safeName} from '../core.js';
const id='abcdefghi_123456-xyz';
test('accept supported links and preserve resource keys',()=>{
  for(const base of [`https://drive.google.com/file/d/${id}/view`,`https://drive.google.com/open?id=${id}`,`https://drive.google.com/uc?id=${id}`])assert.equal(parseLink(base).id,id);
  const folder=parseLink(`https://drive.google.com/drive/u/1/folders/${id}?resourcekey=a-b`);
  assert.equal(folder.type,'folder');assert.equal(folder.resourceKey,'a-b');assert.match(folder.url,/resourcekey=a-b/);
});
test('reject untrusted hosts, protocols, credentials and invalid IDs',()=>{
  for(const u of [`https://drive.google.com.evil.test/file/d/${id}`,`http://drive.google.com/file/d/${id}`,`https://evil@drive.google.com/file/d/${id}`,'javascript:alert(1)','https://drive.google.com/open?id=..%2F','https://drive.google.com/'])assert.throws(()=>parseLink(u));
  assert.throws(()=>parseLink(`https://drive.google.com/file/d/${id}.invalid/view`));
});
test('deduplicate different URL forms by file ID, report invalid entries',()=>{
  const result=parseBatch(`https://drive.google.com/file/d/${id}/view\nhttps://drive.google.com/open?id=${id}\ninvalid`);
  assert.equal(result.items.length,1);assert.equal(result.duplicates,1);assert.equal(result.errors.length,1);
});
test('export Google Workspace documents to Office formats',()=>{
  for(const [type,ext] of [['document','docx'],['spreadsheets','xlsx'],['presentation','pptx']]){
    const item=parseLink(`https://docs.google.com/${type}/d/${id}/edit?resourcekey=a-b`);
    const url=new URL(downloadURL(item));assert.equal(item.type,type);assert.ok(url.href.includes(ext));assert.equal(url.searchParams.get('resourcekey'),'a-b');
  }
  assert.throws(()=>downloadURL({type:'folder',id}));
});
test('never classify auth, quota, missing file or HTML interstitial as ready',()=>{
  const u='https://drive.google.com/uc';
  for(const status of [401,403,404,429,500])assert.notEqual(classifyResponse(status,u,'text/html','','').status,'ready');
  assert.equal(classifyResponse(200,'https://accounts.google.com/ServiceLogin','text/html','','').status,'action');
  assert.equal(classifyResponse(200,u,'text/html','','<form id="download-form">virus</form>').status,'action');
  assert.equal(classifyResponse(200,u,'text/html','','request access').status,'action');
  assert.equal(classifyResponse(200,u,'text/html','','download quota').status,'error');
  assert.equal(classifyResponse(200,u,'text/html','','').status,'action');
});
test('accept binary downloads and intentional HTML attachments',()=>{
  const u='https://drive.usercontent.google.com/download';
  assert.equal(classifyResponse(200,u,'application/pdf','attachment; filename="report.pdf"').status,'ready');
  assert.equal(classifyResponse(200,u,'text/html','attachment; filename="index.html"').status,'ready');
});
test('sanitize paths',()=>{assert.equal(safeName('../hello/world.pdf'),'_hello_world.pdf');});
