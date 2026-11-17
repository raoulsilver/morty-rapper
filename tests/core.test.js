import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWords, validateWords, makeRequest, makeBadLyrics, parseResult, parseLyrics, wordCoverage} from '../core.js';
import {allowedRequest} from '../backend/worker.js';

test('word input handles deduplication, spaces, and comma-delimited phrases', () => {
  assert.deepEqual(parseWords('Moon moon subway'), ['Moon','subway']);
  assert.deepEqual(parseWords('New York,  sneakers; moonlight\nbanana'), ['New York','sneakers','moonlight','banana']);
  assert.throws(() => validateWords(['one']), /at least two/);
  assert.throws(() => validateWords(Array.from({length:13},(_,i)=>`word${i}`)), /12 words/);
  assert.throws(() => validateWords(['one', '!!!']), /letters or numbers/);
});
test('requests preserve supplied words and use the selected musical direction', () => {
  const request = makeRequest(['New York', 'banana'], 'trap', 100, 123);
  assert.equal(request.model, 'google/lyria-3');
  assert.ok(request.input.prompt.includes('["New York","banana"]'));
  assert.match(request.input.prompt, /808 bass/);
  assert.match(request.input.prompt,/scream/);
  assert.equal(request.input.seed,123);
  assert.throws(()=>makeRequest(['one','two'],'invalid',100), /Choose/);
  assert.throws(()=>makeRequest(['one','two'],'trap',0), /Chaos/);
  assert.notEqual(makeRequest(['one','two'],'trap',100,124).input.prompt,request.input.prompt);
});

test('bad lyrics include literal fillers, all supplied words, and no polished-rap direction',()=>{
  const words=['banana','taxes','portal','spaghetti'];
  const lyrics=makeBadLyrics(words,123);
  for(const word of words)assert.ok(lyrics.includes(word));
  assert.ok((lyrics.match(/\b(?:um|uh)\b/gi)||[]).length>=8);
  const prompt=makeRequest(words,'trap',100,123).input.prompt;
  assert.match(prompt,/INTENTIONALLY TERRIBLE/);
  assert.match(prompt,/off-beat/);
  assert.ok(prompt.endsWith(lyrics));
  assert.ok(allowedRequest(makeRequest(['portal','banana'],'trap',100,123)));
  assert.equal(allowedRequest({model:'another/model',input:{prompt:'hello'}}),false);
});
test('real Lyria timestamp format produces lyric lines and whole-word coverage', () => {
  const lines = parseLyrics("Generating music...\nLyrics/structure:\n[0.0:2.6] Banana by the subway.\n[2.7:5.3] We shine in moonlight, sneakers on tight.\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], {start:0,end:2.6,text:'Banana by the subway.'});
  assert.deepEqual(wordCoverage(['banana','sub','sneakers','New York'],lines).map(x=>x.found),[true,false,true,false]);
  assert.equal(wordCoverage(['c++'],[{text:'I write c++ code.'}])[0].found,true);
  assert.equal(wordCoverage(['café'],[{text:'A café at night'}])[0].found,true);
  const wrapped = parseLyrics('Using seed: 123\nLyrics/structure:\n[0.0:2.6] Late at night\nA pigeon at the rooftop\n[2.7 - 5.3] Espresso before midnight\n');
  assert.equal(wrapped.length, 3);
  assert.equal(wordCoverage(['pigeon'],wrapped)[0].found,true);
});
test('audio responses accept supported shapes and reject unsafe or incomplete results', () => {
  assert.equal(parseResult({status:'succeeded',output:'https://example.com/rap.mp3'}).url,'https://example.com/rap.mp3');
  assert.equal(parseResult({output:['https://example.com/a.mp3']}).url,'https://example.com/a.mp3');
  assert.throws(()=>parseResult({status:'processing',output:null}), /before the track finished/);
  assert.throws(()=>parseResult({status:'failed',error:'Not available'}), /Not available/);
  assert.throws(()=>parseResult({output:'javascript:alert(1)'}), /No playable audio/);
  assert.throws(()=>parseResult({output:'https://secret@example.com/file'}), /No playable audio/);
  assert.deepEqual(parseLyrics(undefined),[]);
});
