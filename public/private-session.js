// A full document transition isolates editor workers, lab frames and pending work.
// A cross-tab account change invalidates requests before the new page is loaded.
let actor=null,generation=0;
const pending=new Set(),nativeFetch=window.fetch.bind(window);
const marker='eden-session-change';
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('tween-teach-session'):null;
channel?.addEventListener('message',()=>{invalidatePrivateSession();location.reload();});
export function purgePrivateStorage(){for(const storage of [localStorage,sessionStorage])for(const key of Object.keys(storage))if(/^(eden:|eden-remise:|eden-lab-draft:|tween-main-|tween-student-|eden-private)/.test(key))storage.removeItem(key);}
export function invalidatePrivateSession(){generation++;for(const c of pending)c.abort();pending.clear();purgePrivateStorage();document.querySelector('#dialog')?.replaceChildren();document.querySelector('#app')?.replaceChildren();document.querySelector('#receipt-files')?.replaceChildren();window.dispatchEvent(new Event('eden-session-invalidated'));}
export function bindPrivateAccount(user){const previous=sessionStorage.getItem('eden-private-actor');if(previous&&previous!==user?.id)purgePrivateStorage();actor=user?.id||null;if(actor)sessionStorage.setItem('eden-private-actor',actor);}
export function announceAccountChange(){channel?.postMessage('changed');localStorage.setItem(marker,String(Date.now())+Math.random());}
window.addEventListener('storage',e=>{if(e.key===marker){invalidatePrivateSession();location.reload();}});
window.addEventListener('pageshow',e=>{if(e.persisted){invalidatePrivateSession();location.reload();}});
window.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return nativeFetch(input,options);
 const epoch=generation,controller=new AbortController(),headers=new Headers(options.headers||{});
 if(actor&&!['/api/login','/api/setup'].includes(url.pathname))headers.set('X-Eden-Actor',actor);
 pending.add(controller);
 try{const response=await nativeFetch(input,{...options,headers,signal:options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal});
  if(epoch!==generation)throw new DOMException('Session modifiée','AbortError');
  for(const method of ['json','text','blob','arrayBuffer']){const read=response[method].bind(response);response[method]=async()=>{const data=await read();if(epoch!==generation)throw new DOMException('Session modifiée','AbortError');return data;};}
  return response;
 }finally{pending.delete(controller);}
};
