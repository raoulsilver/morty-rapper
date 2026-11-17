// Cloudflare Worker: secrets stay server-side and each request returns promptly.
// The browser polls a prediction ID instead of holding a multi-minute proxy call.
import {MODEL} from '../core.js';
const memoryLimits=new Map();
export function allowedRequest(body){
  if(!body||typeof body!=='object'||!body.input||typeof body.input!=='object')return false;
  if(body.model===MODEL&&!body.version)return typeof body.input.prompt==='string'&&body.input.prompt.length<=5000&&Number.isInteger(body.input.seed)&&body.input.seed>=0&&body.input.seed<2147483647;
  return false;
}
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin');
    if(!env.ALLOWED_ORIGIN||origin!==env.ALLOWED_ORIGIN)return new Response('Origin not allowed',{status:403});
    const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(!env.REPLICATE_API_TOKEN)return reply({error:'Backend is missing its Replicate secret.'},503);
    const url=new URL(request.url),match=url.pathname.match(/^\/api\/predictions\/([a-z0-9]{8,64})$/i);
    const headers={'Authorization':`Bearer ${env.REPLICATE_API_TOKEN}`,'Content-Type':'application/json'};
    let target,options;
    if(request.method==='POST'&&url.pathname==='/api/predictions'){
      const ip=request.headers.get('CF-Connecting-IP')||'unknown',now=Date.now(),bucket=memoryLimits.get(ip)||{start:now,count:0};
      if(now-bucket.start>3600000){bucket.start=now;bucket.count=0;}
      if(bucket.count>=20)return reply({error:'Hourly generation limit reached.'},429);
      const text=await request.text();if(text.length>12000)return reply({error:'Request too large'},413);
      let body;try{body=JSON.parse(text);}catch{return reply({error:'Invalid JSON'},400);}
      if(!allowedRequest(body))return reply({error:'Unsupported model or inputs'},400);
      bucket.count++;memoryLimits.set(ip,bucket);if(memoryLimits.size>1000)for(const [key,value]of memoryLimits)if(now-value.start>3600000)memoryLimits.delete(key);
      // Fixed allowlisted inputs prevent this from becoming a general API relay.
      const payload={version:MODEL,input:{prompt:body.input.prompt,seed:body.input.seed}};
      target='https://api.replicate.com/v1/predictions';options={method:'POST',headers,body:JSON.stringify(payload)};
    }else if(request.method==='GET'&&match){target='https://api.replicate.com/v1/predictions/'+match[1];options={headers};}
    else return reply({error:'Not found'},404);
    try{
      const response=await fetch(target,{...options,signal:AbortSignal.timeout(25000)});
      if(!response.ok)return reply({error:`Replicate returned ${response.status}`},response.status===429?429:502);
      const data=await response.json();
      // Return only the fields the player needs; no upstream tokens or headers.
      return reply({id:data.id,status:data.status,output:data.output,logs:data.logs,error:data.error});
    }catch{return reply({error:'Upstream request could not complete.'},502);}
  }
};
