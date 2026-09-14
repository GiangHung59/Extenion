export function parseLink(input) {
  let u;
  try { u = new URL(input.trim()); } catch { throw new Error('Link không hợp lệ.'); }
  if (u.protocol !== 'https:' || !['drive.google.com','docs.google.com','drive.usercontent.google.com'].includes(u.hostname) || u.username || u.password || u.port)
    throw new Error('Chỉ nhận link HTTPS từ Google Drive, Docs hoặc drive.usercontent.google.com.');
  const path = u.pathname;
  const folder = path.match(/\/folders\/([\w-]+)(?=\/|$)/);
  const doc = path.match(/\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([\w-]+)(?=\/|$)/);
  const generic = path.match(/\/file\/(?:u\/\d+\/)?d\/([\w-]+)(?=\/|$)/);
  const id = folder?.[1] || doc?.[2] || generic?.[1] || u.searchParams.get('id');
  if (!id || !/^[\w-]{10,}$/.test(id)) throw new Error('Không tìm thấy mã file hoặc thư mục trong link.');
  const type = folder ? 'folder' : doc ? doc[1] : 'file';
  const resourceKey = u.searchParams.get('resourcekey') || '';
  const authuser = u.searchParams.get('authuser') || '';
  const item = {id, type, resourceKey, authuser};
  return {...item, url: viewURL(item), name: id, selected: type !== 'folder', status: 'new', message: 'Chưa kiểm tra'};
}
export function viewURL(item) {
  const base = item.type === 'folder' ? `https://drive.google.com/drive/folders/${item.id}`
    : ['document','spreadsheets','presentation'].includes(item.type) ? `https://docs.google.com/${item.type}/d/${item.id}/edit`
    : `https://drive.google.com/file/d/${item.id}/view`;
  const u = new URL(base);
  if (item.resourceKey) u.searchParams.set('resourcekey',item.resourceKey);
  if (item.authuser) u.searchParams.set('authuser',item.authuser);
  return u.href;
}
export function downloadURL(item) {
  if (item.type === 'folder') throw new Error('Cần chọn file bên trong thư mục.');
  const formats = {document:'docx',spreadsheets:'xlsx',presentation:'pptx'};
  const u = new URL(formats[item.type]
    ? `https://docs.google.com/${item.type}/d/${item.id}/export${item.type === 'presentation' ? '/pptx' : ''}`
    : 'https://drive.google.com/uc');
  if (formats[item.type] && item.type !== 'presentation') u.searchParams.set('format',formats[item.type]);
  if (!formats[item.type]) {u.searchParams.set('export','download');u.searchParams.set('id',item.id);}
  if(item.resourceKey) u.searchParams.set('resourcekey',item.resourceKey);
  if(item.authuser) u.searchParams.set('authuser',item.authuser);
  return u.href;
}

// Parse only Google's small, known download confirmation form. Never execute HTML.
function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (match, entity) => {
    const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
    if(entity[0]!=='#')return named[entity.toLowerCase()];
    const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
    return n>0&&n<=0x10ffff?String.fromCodePoint(n):match;
  });
}
function attributes(tag) {
  const result={};
  for(const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))result[match[1].toLowerCase()]=decodeEntities(match[2]??match[3]??match[4]);
  return result;
}
export function confirmationURL(html, pageURL, item) {
  const isEndpoint = u => u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&
    ((u.hostname==='drive.usercontent.google.com'&&u.pathname==='/download')||(u.hostname==='drive.google.com'&&u.pathname==='/uc'));
  let page;try{page=new URL(pageURL);}catch{return null;}
  if(!isEndpoint(page))return null;
  const cleaned=html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'');
  const visible=decodeEntities(cleaned.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ');
  if(!/too large|quá lớn|can't scan this file|cannot scan this file|không thể quét/i.test(visible))return null;
  const allowed=new Set(['id','export','confirm','uuid','authuser','resourcekey','at']);
  function validate(url) {
    if(!isEndpoint(url)||url.searchParams.get('id')!==item.id||url.searchParams.getAll('id').length!==1||url.searchParams.get('export')!=='download'||!url.searchParams.get('confirm'))return null;
    for(const key of url.searchParams.keys())if(!allowed.has(key))return null;
    if(item.resourceKey&&!url.searchParams.has('resourcekey'))url.searchParams.set('resourcekey',item.resourceKey);
    if(item.authuser&&!url.searchParams.has('authuser'))url.searchParams.set('authuser',item.authuser);
    return url.href;
  }
  for(const form of cleaned.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form\s*>/gi)) {
    const attr=attributes(form[1]);
    if(attr.id!=='download-form'||(attr.method||'get').toLowerCase()!=='get'||!attr.action)continue;
    let url;try{url=new URL(attr.action,page);}catch{continue;}
    for(const input of form[2].matchAll(/<input\b([^>]*)>/gi)) {
      const field=attributes(input[1]);
      if(field.type?.toLowerCase()==='hidden'&&allowed.has(field.name)&&field.value!==undefined)url.searchParams.append(field.name,field.value);
    }
    const valid=validate(url);if(valid)return valid;
  }
  for(const anchor of cleaned.matchAll(/<a\b([^>]*)>/gi)) {
    const attr=attributes(anchor[1]);if(attr.id!=='uc-download-link'||!attr.href)continue;
    try{const valid=validate(new URL(attr.href,page));if(valid)return valid;}catch{}
  }
  return null;
}
export function parseBatch(text) {
  const items = [], errors = [], seen = new Set(); let duplicates = 0;
  for (const token of text.split(/\s+/).filter(Boolean)) {
    try {const item = parseLink(token); if (seen.has(item.id)) {duplicates++;continue;} seen.add(item.id);items.push(item);}
    catch(e) {errors.push(`${token}: ${e.message}`);}
  }
  return {items,errors,duplicates};
}
export function safeName(name) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/^\.+/,'').replace(/[. ]+$/,'').slice(0,160) || 'download';
}
export function classifyResponse(status, url, mime, disposition, body = '') {
  if (new URL(url).hostname === 'accounts.google.com') return {status:'action',message:'Cần đăng nhập Google. Mở trên Google rồi kiểm tra lại.'};
  if (status === 429 || /download quota|too many users have viewed|quota exceeded/i.test(body)) return {status:'error',message:'Google giới hạn lượt tải. Hãy thử lại sau.'};
  if (status === 401) return {status:'action',message:'Cần đăng nhập Google rồi kiểm tra lại.'};
  if (status === 403) return {status:'action',message:'Google từ chối tải: có thể thiếu quyền hoặc chủ sở hữu chặn tải. Mở trên Google để kiểm tra.'};
  if (status === 404) return {status:'action',message:'File không tồn tại hoặc bạn không có quyền truy cập.'};
  if (status < 200 || status >= 300) return {status:'error',message:`Google trả lỗi HTTP ${status}.`};
  if (/text\/html|application\/xhtml/i.test(mime) && !/attachment/i.test(disposition)) {
    if (/request access|you need access|access denied|bạn cần có quyền|yêu cầu quyền truy cập/i.test(body)) return {status:'action',message:'Chưa có quyền truy cập với phiên hiện tại. Mở Google để đăng nhập hoặc yêu cầu quyền.'};
    if (/virus|download anyway|confirm=|download-form/i.test(body)) return {status:'action',message:'Google yêu cầu xác nhận tải. Mở trên Google để xác nhận.'};
    return {status:'action',message:'Google trả trang web thay vì file. Mở trên Google để kiểm tra đăng nhập, quyền hoặc xác nhận tải.'};
  }
  if (!mime && !disposition) return {status:'action',message:'Chưa xác định được nội dung tải. Mở trên Google để kiểm tra.'};
  return {status:'ready',message:'Có thể tải'};
}
