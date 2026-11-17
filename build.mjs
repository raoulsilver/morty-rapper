// Produces a self-contained HTML file that also runs directly from file://.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');
const literal=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const stripModules=source=>source.replace(/^import\s+[^;]+;\s*$/gm,'').replace(/^export\s+/gm,'');
const svg=await read('assets/morty-head.svg');
const audio=await readFile(new URL('assets/example.mp3',root));
const data=JSON.parse(await read('assets/example.json'));
const assets=`const HEAD_DATA_URI=${literal('data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'))};\nconst SAMPLE_DATA=${literal(data)};\nconst SAMPLE_AUDIO_URI=${literal('data:audio/mpeg;base64,'+audio.toString('base64'))};\n`;
const sources=await Promise.all(['core.js','config.js','elastic.js','voice-conversion.js','draft-store.js','app.js'].map(read));
const css=await read('styles.css');
const bundle=`(()=>{\n'use strict';\n${assets}${sources.map(stripModules).join('\n')}\n})();`;
const html=(await read('template.html'))
  .replace('<!-- INLINE_STYLES -->',()=>`<style>\n${css}\n</style>`)
  .replace('<!-- INLINE_APP -->',()=>`<script>\n${bundle.replace(/<\/script/gi,'<\\/script')}\n</script>`);
await writeFile(new URL('index.html',root),html);
console.log('Built self-contained index.html ('+Buffer.byteLength(html)+' bytes)');
