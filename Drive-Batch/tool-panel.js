// The UI belongs to the current tab, so clicking the surrounding page won't close it.
export function mountToolPanel(url,elementId) {
  const existing=document.getElementById(elementId);
  if(existing){existing.shadowRoot.querySelector('iframe').contentWindow.focus();return;}
  const host=document.createElement('div');host.id=elementId;
  host.style.cssText='all:initial!important;position:fixed!important;top:12px!important;right:12px!important;width:min(800px,calc(100vw - 24px))!important;height:min(600px,calc(100vh - 24px))!important;z-index:2147483647!important;display:block!important;';
  const shadow=host.attachShadow({mode:'open'});
  const frame=document.createElement('iframe');frame.src=url;frame.title='Drive Batch — Tải hàng loạt';
  frame.style.cssText='width:100%;height:100%;display:block;border:1px solid #dce3dd;border-radius:12px;background:#f7f9f7;box-shadow:0 12px 50px #17332540;box-sizing:border-box;';
  shadow.append(frame);document.documentElement.append(host);
}
export function installToolPanel(chrome) {
  const opening=new Map();
  chrome.action.onClicked.addListener(tab=>{
    if(!Number.isInteger(tab?.id))return;
    if(opening.has(tab.id))return opening.get(tab.id);
    const task=chrome.scripting.executeScript({
      target:{tabId:tab.id},func:mountToolPanel,
      args:[chrome.runtime.getURL('index.html?popup=1&overlay=1'),'drive-batch-floating-panel']
    }).catch(async error=>{
      console.error(error);
      await chrome.action.setBadgeText({tabId:tab.id,text:'!'});
      await chrome.action.setTitle({tabId:tab.id,title:'Không thể mở trên trang này. Hãy mở một trang web thông thường rồi bấm Drive Batch.'});
    }).finally(()=>opening.delete(tab.id));
    opening.set(tab.id,task);return task;
  });
}
export async function hideToolPanel(chrome,tabId) {
  await chrome.scripting.executeScript({target:{tabId},func:elementId=>document.getElementById(elementId)?.remove(),args:['drive-batch-floating-panel']});
}
