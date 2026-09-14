// Browser UI fixture only. Not included in the distributable extension ZIP.
import {parseLink} from '../core.js';
let state=JSON.parse(sessionStorage.getItem('preview-batch')||'null')||{items:[],paused:true,destination:{configured:false,subfolder:''}};
const listeners=[];
globalThis.chrome={
  runtime:{id:'ui-fixture',async sendMessage(message){
    if(message.type==='add')for(const raw of message.items){const item=parseLink(raw.url);if(!state.items.some(i=>i.id===item.id))state.items.push({...item,name:raw.name||item.name});}
    if(message.type==='select')for(const item of state.items)if(message.ids.includes(item.id))item.selected=message.selected;
    if(message.type==='clear')state.items=[];
    if(message.type==='stop')state.paused=true;
    if(message.type==='queue'){state.paused=false;for(const i of state.items)if(message.ids.includes(i.id)){i.status='ready';i.message='Mô phỏng: sẵn sàng tải';}}
    if(message.type==='open'||message.type==='downloadSettings')return {ok:true};
    if(message.type==='destination')state.destination={configured:true,subfolder:message.subfolder};
    if(message.type==='folderHTML')return {html:'<a href="https://docs.google.com/document/d/document_fixture001/edit"><div class="flip-entry-title">Kế hoạch tháng 9</div></a><a href="https://docs.google.com/spreadsheets/d/spreadsheet_fixture001/edit">Bảng theo dõi dự án</a><a href="https://drive.google.com/drive/folders/folder_fixture002">Thư mục con</a>'};
    if(message.type==='scanTab')return {items:[{url:'https://docs.google.com/presentation/d/presentation_fixture001/edit',name:'Giới thiệu dự án'}]};
    sessionStorage.setItem('preview-batch',JSON.stringify(state));
    for(const listener of listeners)listener({batch:{newValue:structuredClone(state)}},'local');return structuredClone(state);
  }},
  storage:{local:{async get(){return JSON.parse(sessionStorage.getItem('ui-drafts')||'{}');},async set(values){const old=JSON.parse(sessionStorage.getItem('ui-drafts')||'{}');sessionStorage.setItem('ui-drafts',JSON.stringify({...old,...values}));}},onChanged:{addListener(fn){listeners.push(fn);}}},downloads:{show(){}}
};
await import('../app.js');
