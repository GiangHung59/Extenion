import {classifyResponse,confirmationURL} from './core.js';

export async function readLimited(response, limit=160000) {
  const reader=response.body?.getReader();if(!reader)return '';
  const decoder=new TextDecoder();let result='',size=0;
  try {while(size<limit){const {done,value}=await reader.read();if(done)break;const slice=value.subarray(0,limit-size);size+=slice.length;result+=decoder.decode(slice,{stream:true});}}
  finally {await reader.cancel().catch(()=>{});}
  return result;
}
export async function request(url, credentials) {
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
  try {
    const response=await fetch(url,{credentials,signal:controller.signal,cache:'no-store'});
    const mime=response.headers.get('content-type')||'';
    const disposition=response.headers.get('content-disposition')||'';
    const body=/text\/html|application\/xhtml/i.test(mime)&&!/attachment/i.test(disposition)?await readLimited(response):'';
    if(!body)await response.body?.cancel().catch(()=>{});
    const result=classifyResponse(response.status,response.url,mime,disposition,body);
    let name;
    const encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const normal=disposition.match(/filename="([^"]+)"|filename=([^;]+)/i);
    try {name=encoded?decodeURIComponent(encoded[1]):normal?.[1]||normal?.[2];}catch{}
    return {...result,name,mime,body,httpStatus:response.status,finalUrl:response.url};
  }finally {clearTimeout(timer);}
}
export async function resolveDownload(url, credentials, item) {
  const visited=new Set();let confirmed=false;
  for(let attempt=0;attempt<3;attempt++) {
    visited.add(url);
    const result=await request(url,credentials);
    if(result.status==='ready')return {...result,downloadUrl:url,confirmed};
    const next=result.httpStatus===200?confirmationURL(result.body,result.finalUrl,item):null;
    if(!next)return result;
    if(visited.has(next)||attempt===2)return {...result,status:'action',message:'Google lặp lại trang xác nhận tải. Hãy thử lại sau hoặc mở Google để kiểm tra.'};
    confirmed=true;url=next;
  }
}
