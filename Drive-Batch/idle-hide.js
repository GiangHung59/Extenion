export function installIdleHide(target,activityTarget,hide,onError,timers=globalThis) {
  let timer;
  const reset=()=>{
    timers.clearTimeout(timer);
    timer=timers.setTimeout(()=>Promise.resolve().then(hide).catch(onError),20000);
  };
  const events=['pointerdown','pointermove','keydown','input','wheel','touchstart'];
  for(const event of events)activityTarget.addEventListener(event,reset,{passive:true});
  target.addEventListener('focus',reset);
  target.addEventListener('pagehide',()=>timers.clearTimeout(timer),{once:true});
  reset();
}
