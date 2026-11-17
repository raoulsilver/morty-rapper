import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
test('distributed HTML includes executable classic JS and embedded artwork/audio without local fetches',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/type="module"/);
  assert.doesNotMatch(html,/<script[^>]+src=/);
  assert.doesNotMatch(html,/fetch\(['"]\.\//);
  assert.match(html,/data:image\/svg\+xml;base64,/);
  assert.match(html,/data:audio\/mpeg;base64,/);
  assert.match(html,/onsubmit="event.preventDefault\(\)"/);
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(()=>new Script(script));
});
