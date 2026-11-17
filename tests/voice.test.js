import test from 'node:test';
import assert from 'node:assert/strict';
import {unpackMortyModel,parseVoiceEvent,MORTY_SPACE_URL} from '../voice-conversion.js';

test('only a completed converter event with its own audio URL is accepted',()=>{
  const url=MORTY_SPACE_URL+'/gradio_api/file=/tmp/gradio/test/morty.mp3';
  assert.equal(parseVoiceEvent('event: complete\ndata: '+JSON.stringify([[{url}]])),url);
  assert.equal(parseVoiceEvent('event: complete\ndata: '+JSON.stringify([{url},'Conversion complete'])),url);
  assert.throws(()=>parseVoiceEvent('event: complete\ndata: '+JSON.stringify([null,'CUDA quota exhausted'])),/quota exhausted/);
  assert.throws(()=>parseVoiceEvent('event: error\ndata: null'),/without further details/);
  assert.equal(parseVoiceEvent('event: heartbeat\ndata: null'),null);
  assert.throws(()=>parseVoiceEvent('event: error\ndata: "GPU quota reached"'),/quota/);
  assert.throws(()=>parseVoiceEvent('event: complete\ndata: '+JSON.stringify([[{url:'https://wrong.example/audio.mp3'}]])),/valid Morty audio/);
});
test('malformed model archives fail before model upload',async()=>{
  await assert.rejects(()=>unpackMortyModel(new Uint8Array(3)),/unexpected size/);
  await assert.rejects(()=>unpackMortyModel(new Uint8Array(100)),/supported ZIP/);
});
