import {MORTY_MODEL_URL,safeMediaURL} from './core.js';

export const MORTY_SPACE_URL='https://luminia-rvc-beatrice-voice-conversion.hf.space';
export const GPU_SPACE_URL='https://r3gm-rvc-zero.hf.space';
let modelFilesPromise=null;
const modelUploads=new Map();

// Read the ZIP directory, then inflate just the model and retrieval index.
// Nothing from the model archive is executed in the browser.
export async function unpackMortyModel(buffer,signal){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<22||bytes.length>150*1024*1024)throw new Error('The Morty voice archive has an unexpected size.');
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('The Morty voice archive is not a supported ZIP file.');
  const count=view.getUint16(end+10,true);let cursor=view.getUint32(end+16,true);
  const files=[];
  for(let i=0;i<count;i++){
    if(cursor+46>bytes.length||view.getUint32(cursor,true)!==0x02014b50)throw new Error('The Morty voice archive is damaged.');
    const method=view.getUint16(cursor+10,true),flags=view.getUint16(cursor+8,true),compressed=view.getUint32(cursor+20,true),size=view.getUint32(cursor+24,true),nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),local=view.getUint32(cursor+42,true);
    const name=new TextDecoder().decode(bytes.subarray(cursor+46,cursor+46+nameLength));
    cursor+=46+nameLength+extraLength+commentLength;
    if(!/\.(pth|index)$/i.test(name))continue;
    if(flags&1||size>150*1024*1024||local+30>bytes.length||view.getUint32(local,true)!==0x04034b50)throw new Error('Unsupported voice archive entry.');
    const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
    if(start+compressed>bytes.length)throw new Error('The Morty voice archive is truncated.');
    signal?.throwIfAborted();
    let data=bytes.subarray(start,start+compressed);
    if(method===8){
      if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot unpack the voice model. Try an up-to-date Chrome or Edge.');
      const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      data=new Uint8Array(await new Response(stream).arrayBuffer());
    }else if(method!==0)throw new Error('The voice archive uses an unsupported compression format.');
    signal?.throwIfAborted();
    if(data.length!==size)throw new Error('The extracted voice model has an unexpected size.');
    files.push({name:name.split(/[\\/]/).pop(),blob:new Blob([data],{type:'application/octet-stream'})});
  }
  const models=files.filter(f=>/\.pth$/i.test(f.name));
  if(models.length!==1)throw new Error('The archive must contain exactly one Morty voice checkpoint.');
  return{model:models[0],index:files.find(f=>/\.index$/i.test(f.name))||null};
}

async function checkedJSON(response){
  if(!response.ok){
    if(response.status===429)throw new Error('The Morty voice service is at its limit. Wait before trying again.');
    throw new Error(`The Morty voice service returned ${response.status}.`);
  }
  try{return await response.json();}catch{throw new Error('The Morty voice service returned unreadable data.');}
}

async function uploadFiles(files,signal,origin){
  const form=new FormData();for(const file of files)form.append('files',file.blob,file.name);
  const result=await checkedJSON(await fetch(origin+'/gradio_api/upload',{method:'POST',body:form,signal}));
  if(!Array.isArray(result)||result.length!==files.length||result.some(p=>typeof p!=='string'||!p))throw new Error('Morty voice upload failed.');
  return result;
}

async function loadMortyModel(signal,onProgress,origin){
  if(!modelFilesPromise){
    modelFilesPromise=(async()=>{
      onProgress('Loading Morty’s actual voice for the first time…');
      const response=await fetch(MORTY_MODEL_URL,{signal});if(!response.ok)throw new Error('Could not download the Morty voice model.');
      return unpackMortyModel(await response.arrayBuffer(),signal);
    })().catch(error=>{modelFilesPromise=null;throw error;});
  }
  if(!modelUploads.has(origin)){
    const pending=(async()=>{
      const files=await modelFilesPromise;
      onProgress('Preparing Morty’s voice. This first setup takes a little longer…');
      const ordered=[files.model,...(files.index?[files.index]:[])];
      const paths=await uploadFiles(ordered,signal,origin);
      return{model:paths[0],index:files.index?paths[1]:null};
    })().catch(error=>{modelUploads.delete(origin);throw error;});
    modelUploads.set(origin,pending);
  }
  return modelUploads.get(origin);
}

export function parseVoiceEvent(event,origin=MORTY_SPACE_URL){
  const kind=event.match(/^event:\s*(\S+)/m)?.[1];
  const lines=[...event.matchAll(/^data:\s?(.*)$/gm)].map(m=>m[1]).join('\n');
  if(!lines)return null;
  let data;try{data=JSON.parse(lines);}catch{return null;}
  if(kind==='error')throw new Error(typeof data==='string'?data:data?.message||'The voice server reported a conversion failure without further details.');
  if(kind!=='complete')return null;
  const file=Array.isArray(data?.[0])?data[0][0]:data?.[0];
  if(!file&&typeof data?.[1]==='string')throw new Error(data[1]);
  const url=safeMediaURL(file?.url);
  if(!url||new URL(url).origin!==origin)throw new Error('The converter returned no valid Morty audio.');
  return url;
}

async function convertAtProvider(sourceBlob,signal,onProgress,origin){
  const models=await loadMortyModel(signal,onProgress,origin);
  onProgress('Sending the awkward performance to Morty’s voice model…');
  const [audioPath]=await uploadFiles([{name:'awkward-rap.mp3',blob:sourceBlob}],signal,origin);
  const file=path=>({path,meta:{_type:'gradio.FileData'}});
  const cpu=origin===MORTY_SPACE_URL,endpoint=cpu?'convert':'run';
  const data=cpu?[file(audioPath),'RVC v2',file(models.model),models.index?file(models.index):null,null,0,0,0,'rmvpe',.9,.15]:[[file(audioPath)],file(models.model),'rmvpe+',0,models.index?file(models.index):null,.9,3,.25,.15,false,false,'mp3',1];
  const call=await checkedJSON(await fetch(origin+'/gradio_api/call/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data}),signal}));
  if(typeof call.event_id!=='string'||!call.event_id)throw new Error('Morty’s voice job could not start.');
  onProgress(cpu?'Converting Morty’s voice on the CPU service. This can take a few minutes…':'Converting the performance into Morty’s voice…');
  const stream=await fetch(origin+'/gradio_api/call/'+endpoint+'/'+encodeURIComponent(call.event_id),{signal});
  if(!stream.ok||!stream.body)throw new Error('Could not receive Morty’s converted voice.');
  const reader=stream.body.getReader(),decoder=new TextDecoder();let pending='';
  try{
    while(true){
      const {value,done}=await reader.read();pending+=decoder.decode(value||new Uint8Array(),{stream:!done});pending=pending.replace(/\r\n/g,'\n');
      let boundary;while((boundary=pending.indexOf('\n\n'))>=0){const event=pending.slice(0,boundary);pending=pending.slice(boundary+2);const url=parseVoiceEvent(event,origin);if(url){await reader.cancel();return url;}}
      if(done)break;
    }
    if(pending){const url=parseVoiceEvent(pending,origin);if(url)return url;}
  }finally{reader.releaseLock();}
  throw new Error('Morty’s conversion ended without audio. No generic replacement voice was used.');
}

export async function convertToMorty(audioInput,signal,onProgress=()=>{}){
  let sourceBlob=audioInput instanceof Blob?audioInput:null;
  if(!sourceBlob){const source=safeMediaURL(audioInput);if(!source)throw new Error('No valid source rap was supplied.');const response=await fetch(source,{signal});if(!response.ok)throw new Error('Could not download the generated performance.');sourceBlob=await response.blob();}
  const failures=[];
  for(const origin of [MORTY_SPACE_URL,GPU_SPACE_URL]){
    signal.throwIfAborted();
    const attempt=new AbortController(),abort=()=>attempt.abort(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>attempt.abort(new DOMException('Voice provider timed out','TimeoutError')),origin===MORTY_SPACE_URL?240000:90000);
    try{return await convertAtProvider(sourceBlob,attempt.signal,onProgress,origin);}
    catch(error){if(signal.aborted)throw error;failures.push((origin===MORTY_SPACE_URL?'CPU service: ':'GPU service: ')+(attempt.signal.aborted?'The provider timed out.':error.message));modelUploads.delete(origin);if(origin!==GPU_SPACE_URL)onProgress('That voice server failed. Trying the alternate with the same saved rap…');}
    finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
  }
  throw new Error(failures.join(' | '));
}
