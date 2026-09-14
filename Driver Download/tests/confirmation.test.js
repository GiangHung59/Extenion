import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmationURL,parseLink,downloadURL} from '../core.js';
import {resolveDownload} from '../network.js';
const item={id:'large_file_id_001',resourceKey:'resource-key',authuser:'0'};
const page=`https://drive.usercontent.google.com/download?id=${item.id}&export=download`;
function form({id=item.id,action='https://drive.usercontent.google.com/download',warning="Google Drive can't scan this file for viruses. This file is too large for Google to scan."}={}) {
  return `<p class="uc-warning-caption">${warning}</p><form id="download-form" action="${action}" method="get"><input type="submit" id="uc-download-link" value="Download anyway"><input type="hidden" name="id" value="${id}"><input type="hidden" name="export" value="download"><input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="example-uuid"><input type="hidden" name="authuser" value="0"></form>`;
}
test('parse usercontent links and preserve account and resource key',()=>{
  const parsed=parseLink(`https://drive.usercontent.google.com/open?id=${item.id}&authuser=0&resourcekey=resource-key`);
  assert.equal(parsed.id,item.id);assert.equal(parsed.authuser,'0');assert.match(parsed.url,/authuser=0/);assert.match(downloadURL(parsed),/resourcekey=resource-key/);
});
test('extract Google large-file form with UUID, account and resource key',()=>{
  const u=new URL(confirmationURL(form(),page,item));
  assert.equal(u.hostname,'drive.usercontent.google.com');assert.equal(u.searchParams.get('id'),item.id);
  for(const [key,value] of Object.entries({uuid:'example-uuid',confirm:'t',authuser:'0',resourcekey:'resource-key'}))assert.equal(u.searchParams.get(key),value);
  assert.ok(confirmationURL(form({warning:'Tệp quá lớn nên Google không thể quét tìm vi-rút.'}),page,item));
});
test('reject external endpoints, wrong file ID, non-size warnings and non-Google pages',()=>{
  assert.equal(confirmationURL(form({action:'https://evil.test/download'}),page,item),null);
  assert.equal(confirmationURL(form({action:'https://drive.usercontent.google.com.evil.test/download'}),page,item),null);
  assert.equal(confirmationURL(form({id:'different_file_id'}),page,item),null);
  assert.equal(confirmationURL(form({warning:'This file is infected. Download anyway?'}),page,item),null);
  assert.equal(confirmationURL(form(),'https://evil.test/download',item),null);
  assert.equal(confirmationURL(form().replace('method="get"','method="post"'),page,item),null);
});
test('decode HTML entities in legacy confirmation links, reject unexpected parameters',()=>{
  const html=`<p>This file is too large.</p><a id='uc-download-link' href='/download?id=${item.id}&amp;export=download&amp;confirm=t&amp;uuid=a&#x2d;b'>Download anyway</a>`;
  assert.equal(new URL(confirmationURL(html,page,item)).searchParams.get('uuid'),'a-b');
  assert.equal(confirmationURL(html.replace('confirm=t','redirect=https://evil.test&amp;confirm=t'),page,item),null);
});
test('follow confirmation once, return confirmed URL rather than original warning page',async()=>{
  const oldFetch=globalThis.fetch,calls=[];
  try {
    globalThis.fetch=async(url,options)=>{
      calls.push({url,credentials:options.credentials});
      const confirmed=new URL(url).searchParams.has('confirm');
      const r=new Response(confirmed?'PSD-data':form(),{headers:confirmed?{'content-type':'application/octet-stream','content-disposition':'attachment; filename="Big File.psd"'}:{'content-type':'text/html'}});
      Object.defineProperty(r,'url',{value:url});return r;
    };
    const result=await resolveDownload(page,'include',item);
    assert.equal(result.status,'ready');assert.equal(result.confirmed,true);assert.equal(result.name,'Big File.psd');
    assert.equal(new URL(result.downloadUrl).searchParams.get('uuid'),'example-uuid');assert.equal(calls.length,2);assert.ok(calls.every(c=>c.credentials==='include'));
  }finally {globalThis.fetch=oldFetch;}
});
test('bound repeated confirmations and do not follow a form on denied responses',async()=>{
  const oldFetch=globalThis.fetch;let count=0,denied=false;
  try {
    globalThis.fetch=async(url)=>{count++;const r=new Response(form(),{status:denied?403:200,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r;};
    const loop=await resolveDownload(page,'omit',item);assert.equal(loop.status,'action');assert.equal(count,2);assert.match(loop.message,/lặp lại/);
    denied=true;count=0;assert.equal((await resolveDownload(page,'omit',item)).status,'action');assert.equal(count,1);
  }finally{globalThis.fetch=oldFetch;}
});
