import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../backend/worker.js';
import {makeRequest} from '../core.js';
const origin='https://example.github.io';
test('backend rejects other origins and reports missing setup without leaking credentials',async()=>{
  const denied=await worker.fetch(new Request('https://api.example.com/api/predictions',{headers:{Origin:'https://wrong.example'}}),{ALLOWED_ORIGIN:origin,REPLICATE_API_TOKEN:'never-return-this'});
  assert.equal(denied.status,403);
  const missing=await worker.fetch(new Request('https://api.example.com/api/predictions',{headers:{Origin:origin}}),{ALLOWED_ORIGIN:origin});
  assert.equal(missing.status,503);
  const cors=await worker.fetch(new Request('https://api.example.com/api/predictions',{method:'OPTIONS',headers:{Origin:origin}}),{ALLOWED_ORIGIN:origin});
  assert.equal(cors.status,204);assert.equal(cors.headers.get('Access-Control-Allow-Origin'),origin);
});
test('backend returns an asynchronous prediction ID and only permitted response fields',async t=>{
  let upstream;
  t.mock.method(globalThis,'fetch',async(url,options)=>{upstream={url,options};return Response.json({id:'testprediction1234',status:'starting',output:null,logs:'',error:null,urls:{get:'private-upstream-url'},input:{secret:'not-for-the-browser'}});});
  const response=await worker.fetch(new Request('https://api.example.com/api/predictions',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(makeRequest(['portal','banana'],'trap',100,123))}),{ALLOWED_ORIGIN:origin,REPLICATE_API_TOKEN:'test-only-token'});
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.status,'starting');assert.equal(body.id,'testprediction1234');assert.equal(body.urls,undefined);assert.equal(body.input,undefined);assert.equal(upstream.options.headers.Authorization,'Bearer test-only-token');assert.equal(JSON.parse(upstream.options.body).version,'google/lyria-3');
});
