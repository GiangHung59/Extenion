import {parseBatch, parseLink} from './core.js';
import {normalizeFolder} from './destination.js';
const $=id=>document.getElementById(id);
let batch={items:[],paused:true},folder=null,folderItems=new Map(),folderBusy=false;
let pendingDestinationIds=[];
const local=globalThis.chrome?.storage?.local;
function saveDraft(){return local?.set({linkDraft:$('links').value}).catch(error);}
function saveFolder(){return local?.set({folderDraft:folder?{folder,items:[...folderItems.values()],message:$('folder-status').textContent}:null}).catch(error);}
if(document.documentElement.classList.contains('popup')) {
  document.querySelector('h1').textContent='Tải file từ Google Drive';
  document.querySelector('header p').textContent='Dán link ngay tại đây. Đóng popup vẫn tiếp tục tải.';
}
$('links').addEventListener('input',saveDraft);
const types={file:'File gốc',folder:'Thư mục',document:'Word .docx',spreadsheets:'Excel .xlsx',presentation:'PowerPoint .pptx'};
async function send(type,extra={}) {const result=await chrome.runtime.sendMessage({type,...extra});if(result?.error)throw new Error(result.error);return result;}
function error(e) {$('app-message').textContent=e.message;}
function element(tag,className,text) {const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function button(text,action) {const el=element('button','',text);el.addEventListener('click',()=>Promise.resolve().then(action).catch(error));return el;}
async function refresh(){batch=await send('get');render();}
function selected(){return batch.items.filter(i=>i.selected&&i.type!=='folder');}
function render() {
  const destination=batch.destination;
  $('destination-label').textContent=destination?.configured?`Thư mục tải xuống Chrome${destination.subfolder?' / '+destination.subfolder:''}`:'Chọn nơi lưu một lần trước khi tải';
  $('change-destination').textContent=destination?.configured?'Thay đổi':'Chọn nơi lưu';
  const files=batch.items.filter(i=>i.type!=='folder');
  const count=selected().length;
  $('count').textContent=batch.items.length;
  $('summary').textContent=files.length?`${count} file đã chọn · ${files.filter(i=>i.status==='done').length} đã tải · ${files.filter(i=>['error','action'].includes(i.status)).length} cần chú ý${batch.paused?' · Hàng đợi đang dừng':''}`:'Chưa có file nào.';
  $('empty').hidden=!!batch.items.length;$('table-wrap').hidden=!batch.items.length;
  $('select-all').checked=files.length>0&&count===files.length;$('select-all').indeterminate=count>0&&count<files.length;
  $('download').disabled=!selected().some(i=>!['done','downloading','queued','preparing'].includes(i.status));
  $('check').disabled=$('download').disabled;
  $('retry').disabled=!selected().some(i=>['error','action'].includes(i.status));
  $('stop').disabled=batch.paused||!files.some(i=>['queued','preparing','downloading'].includes(i.status));
  const fragment=document.createDocumentFragment();
  for(const item of batch.items) {
    const row=element('tr');
    const box=element('td');const input=element('input');input.type='checkbox';input.checked=item.selected;input.disabled=item.type==='folder';input.setAttribute('aria-label',`Chọn ${item.name}`);
    input.addEventListener('change',()=>send('select',{ids:[item.id],selected:input.checked}).then(s=>{batch=s;render();}).catch(error));box.append(input);
    const name=element('td');name.append(element('div','file-name',`${item.type==='folder'?'▱ ':''}${item.name}`));
    const link=element('a','file-url',item.url);link.href=item.url;link.target='_blank';link.rel='noreferrer';link.title=item.url;name.append(link);
    if(item.parent)name.append(element('small','file-url',`Từ thư mục: ${item.parent}`));
    const format=element('td','file-type',types[item.type]||'File');
    const status=element('td',`status ${item.status}`,item.type==='folder'?'Chọn cách tải thư mục':item.message);
    const actions=element('td');const group=element('div','row-actions');
    if(item.type==='folder')group.append(button('Chọn file',()=>openFolder(item)));
    group.append(button('Mở Google ↗',()=>send('open',{url:item.url})));
    if(item.status==='done'&&item.downloadId!==undefined)group.append(button('Hiện file',()=>chrome.downloads.show(item.downloadId)));
    actions.append(group);row.append(box,name,format,status,actions);fragment.append(row);
  }
  $('rows').replaceChildren(fragment);
}
function bind(id,action){$(id).addEventListener('click',async()=>{try{$('app-message').textContent='';await action();}catch(e){error(e);}});}
bind('add',async()=>{
  const parsed=parseBatch($('links').value);
  const known=new Set(batch.items.map(i=>i.id));
  const fresh=parsed.items.filter(i=>!known.has(i.id));
  const duplicates=parsed.duplicates+parsed.items.length-fresh.length;
  batch=await send('add',{items:parsed.items});render();
  $('input-message').textContent=`Đã thêm ${fresh.length} mục${duplicates?`; bỏ ${duplicates} link trùng`:''}.${parsed.errors.length?'\n'+parsed.errors.join('\n'):''}`;
  if(!parsed.errors.length){$('links').value='';await saveDraft();}
  const firstFolder=fresh.find(i=>i.type==='folder');if(firstFolder)openFolder(firstFolder);
});
bind('select-all',async()=>{batch=await send('select',{ids:batch.items.map(i=>i.id),selected:$('select-all').checked});render();});
bind('check',async()=>{batch=await send('queue',{ids:selected().map(i=>i.id),mode:'check'});render();});
async function startDownloads(ids){
  if(!batch.destination?.configured){openDestination(ids);return;}
  batch=await send('queue',{ids,mode:'download'});render();
}
bind('download',()=>startDownloads(selected().map(i=>i.id)));
bind('retry',()=>startDownloads(selected().filter(i=>['error','action'].includes(i.status)).map(i=>i.id)));
bind('stop',async()=>{batch=await send('stop');render();$('app-message').textContent='Đã dừng bắt đầu file mới. File đã chuyển cho Chrome vẫn tiếp tục tải; có thể hủy trong danh sách tải của Chrome.';});
bind('clear',async()=>{batch=await send('clear');render();});
function saveDestinationDraft(){return local?.set({destinationDraft:{ids:pendingDestinationIds,input:$('subfolder').value}}).catch(error);}
function destinationPreview(){
  try{const path=normalizeFolder($('subfolder').value);$('destination-preview').textContent=`Thư mục tải xuống Chrome${path?' / '+path:''}`;$('destination-error').textContent='';}
  catch(e){$('destination-error').textContent=e.message;}
}
function openDestination(ids=[],input=batch.destination?.subfolder||''){
  pendingDestinationIds=ids;$('subfolder').value=input;
  $('save-destination').textContent=ids.length?'Lưu & bắt đầu tải':'Lưu mặc định';
  destinationPreview();$('destination-dialog').showModal();saveDestinationDraft();$('subfolder').focus();
}
bind('change-destination',()=>openDestination());
$('subfolder').addEventListener('input',()=>{destinationPreview();saveDestinationDraft();});
bind('change-root',async()=>{await saveDestinationDraft();await send('downloadSettings');});
bind('use-root',()=>{$('subfolder').value='';destinationPreview();saveDestinationDraft();});
bind('save-destination',async()=>{
  try {
    const subfolder=normalizeFolder($('subfolder').value);
    batch=await send('destination',{subfolder});render();
    const ids=pendingDestinationIds;
    if(ids.length){batch=await send('queue',{ids,mode:'download'});render();}
    pendingDestinationIds=[];await local?.set({destinationDraft:null});$('destination-dialog').close();
  }catch(e){$('destination-error').textContent=e.message;}
});
bind('close-destination',async()=>{pendingDestinationIds=[];await local?.set({destinationDraft:null});$('destination-dialog').close();});
$('destination-dialog').addEventListener('cancel',()=>{pendingDestinationIds=[];local?.set({destinationDraft:null}).catch(error);});
function openFolder(item) {
  if(folderBusy)return;
  folder=item;folderItems=new Map();$('folder-name').textContent=item.name===item.id?'Bạn muốn tải những file nào?':item.name;
  $('folder-status').textContent='Chưa quét. Danh sách có thể không đầy đủ; thư mục con được xử lý riêng.';
  renderFolder();$('folder-dialog').showModal();
  saveFolder();
}
function renderFolder() {
  const fragment=document.createDocumentFragment();
  for(const item of folderItems.values()) {
    const label=element('label','folder-entry');const box=element('input');box.type='checkbox';box.checked=item.selected;
    box.addEventListener('change',()=>{item.selected=box.checked;renderFolder();saveFolder();});
    label.append(box,element('span','',item.name),element('small','',types[item.type]));fragment.append(label);
  }
  $('folder-items').replaceChildren(fragment);
  const selected=[...folderItems.values()].filter(i=>i.selected).length;
  $('folder-count').textContent=`${folderItems.size} mục tìm thấy · ${selected} đã chọn`;
  $('folder-all').checked=folderItems.size>0&&selected===folderItems.size;$('folder-all').indeterminate=selected>0&&selected<folderItems.size;
  $('import-folder').disabled=!selected||folderBusy;
}
function mergeFolder(items) {
  for(const raw of items){try{const item=parseLink(raw.url);if(item.id===folder.id)continue;if(!folderItems.has(item.id))folderItems.set(item.id,{...item,name:raw.name||item.name,selected:false,parent:folder.name});}catch{}}
  renderFolder();
}
async function scan(action) {
  if(folderBusy)return;folderBusy=true;
  $('scan-folder').disabled=true;$('scan-tab').disabled=true;$('import-folder').disabled=true;$('close-folder').disabled=true;
  $('folder-status').textContent='Đang đọc danh sách…';
  try {await action();$('folder-status').textContent=folderItems.size?`Tìm thấy ${folderItems.size} mục. Chưa xác nhận đủ toàn bộ thư mục; chọn các mục muốn thêm bên dưới.`:'Chưa đọc được mục nào. Thư mục có thể trống, cần đăng nhập, thiếu quyền hoặc Google không hiển thị danh sách. Mở thư mục trên Drive rồi thử “Quét tab Drive”.';}
  catch(e){$('folder-status').textContent=e.message;}
  finally{folderBusy=false;$('scan-folder').disabled=false;$('scan-tab').disabled=false;$('close-folder').disabled=false;renderFolder();await saveFolder();}
}
bind('scan-folder',()=>scan(async()=>{
  const {html}=await send('folderHTML',{url:folder.url});
  const doc=new DOMParser().parseFromString(html,'text/html');
  const entries=[];
  for(const anchor of doc.querySelectorAll('a[href]')) {
    const url=new URL(anchor.getAttribute('href'),'https://drive.google.com').href;
    const name=anchor.querySelector('.flip-entry-title')?.textContent || anchor.textContent.trim();
    entries.push({url,name:name.trim()});
  }
  mergeFolder(entries);
}));
bind('scan-tab',()=>scan(async()=>{const {items}=await send('scanTab',{url:folder.url});mergeFolder(items);}));
bind('open-folder',()=>send('open',{url:folder.url}));
bind('whole-folder',async()=>{await send('open',{url:folder.url});$('folder-status').textContent='Trong tab Drive vừa mở: chọn menu của thư mục → Tải xuống. Google chuẩn bị file ZIP; tiến trình ZIP không nằm trong hàng đợi tiện ích.';});
function closeFolder(){folder=null;$('folder-dialog').close();saveFolder();}
bind('close-folder',()=>{if(!folderBusy)closeFolder();});
$('folder-dialog').addEventListener('cancel',event=>{if(folderBusy)event.preventDefault();else {folder=null;saveFolder();}});
bind('folder-all',()=>{for(const item of folderItems.values())item.selected=$('folder-all').checked;renderFolder();saveFolder();});
bind('import-folder',async()=>{batch=await send('add',{items:[...folderItems.values()].filter(i=>i.selected)});render();closeFolder();});
if(globalThis.chrome?.runtime?.id) {
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.batch){batch=changes.batch.newValue;render();}});
  refresh().catch(error);
  if(local)local.get(['linkDraft','folderDraft','destinationDraft']).then(saved=>{
    if(!$('links').value&&typeof saved.linkDraft==='string')$('links').value=saved.linkDraft;
    if(saved.folderDraft&&!folder){
      folder=saved.folderDraft.folder;folderItems=new Map(saved.folderDraft.items.map(item=>[item.id,item]));
      $('folder-name').textContent=folder.name===folder.id?'Bạn muốn tải những file nào?':folder.name;
      $('folder-status').textContent=saved.folderDraft.message||'Có thể quét lại để bổ sung các mục.';
      renderFolder();$('folder-dialog').showModal();
    } else if(saved.destinationDraft)openDestination(saved.destinationDraft.ids,saved.destinationDraft.input);
    else if(!folder)$('links').focus();
  }).catch(error);
} else {
  render();
  for(const control of document.querySelectorAll('button,input,textarea'))control.disabled=true;
  $('app-message').textContent='Đây là giao diện tiện ích Chrome. Hãy cài thư mục này bằng Load unpacked tại chrome://extensions, sau đó mở từ biểu tượng Drive Batch. Trang web thông thường chỉ xem được giao diện.';
}
