// Best-effort local recovery. Storage restrictions must never stop generation.
function openDraftDB(){return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('Storage unavailable'));return;}const request=indexedDB.open('morty-rapper-drafts',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function transact(mode,action){const db=await openDraftDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode);const request=action(tx.objectStore('drafts'));let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export function saveDraft(draft){return transact('readwrite',store=>store.put(draft,'latest')).catch(()=>{});}
export function loadDraft(){return transact('readonly',store=>store.get('latest')).catch(()=>null);}
export function clearDraft(){return transact('readwrite',store=>store.delete('latest')).catch(()=>{});}
