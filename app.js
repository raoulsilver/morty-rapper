import {PROXY_URL,STYLES,parseWords,validateWords,makeRequest,parseResult,wordPattern,wordCoverage} from './core.js';
import {ElasticFace} from './elastic.js';
import {BACKEND_URL} from './config.js';
import {convertToMorty} from './voice-conversion.js';
import {saveDraft,loadDraft,clearDraft} from './draft-store.js';
const $=id=>document.getElementById(id), form=$('rap-form'), input=$('words'), audio=$('audio');
let calm=matchMedia('(prefers-reduced-motion: reduce)').matches, fx=false, controller=null,currentTrack=null,take=0,stage='',lastPop=0,context=null,pendingDraft=null;
document.body.classList.toggle('calm',calm);$('motion').setAttribute('aria-pressed',String(calm));
const examples=['spaghetti, taxes, portal, banana','existential dread, microwave, hamster, rent','grandma, black hole, chicken nuggets, capitalism','pickle, student loans, moon cheese, dentist','toaster, divorce, interdimensional, crocs'];
const face=new ElasticFace($('face'),{isCalm:()=>calm,onReady:error=>{$('face-loading').hidden=!error;if(error)$('face-loading').textContent='HEAD LOST IN ANOTHER DIMENSION. RELOAD?';},onPull:(force,p)=>{if(force>0){pop(['AAAAAH!','OH GEEZ!','WHY AM I LIKE THIS','MY FACE!!'][Math.floor(Math.random()*4)],p);squeak();$('pull-caption').textContent='THAT’S HIS FACE, DUDE.';}}});
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function renderDraftActions(){$('draft-actions').hidden=!pendingDraft;$('retry-voice').disabled=Boolean(controller);}
function voiceFailure(error){status('Morty’s voice services could not finish. Your rap is kept—use RETRY MORTY VOICE.',true);$('voice-error').textContent=error.message||String(error);$('voice-error-details').hidden=false;renderDraftActions();}
async function finishSavedVoice(draft,signal){
  const convertedURL=await convertToMorty(draft.audioBlob||draft.baseURL,signal,text=>status(text));
  take++;showTrack({...draft,url:convertedURL,voice:'morty',take});
  if(pendingDraft===draft){pendingDraft=null;void clearDraft();}renderDraftActions();
  status('Um, uh… he actually did it. Press play for the terrible Morty rap.');freakout();
}
function pop(text,p){if(calm||performance.now()-lastPop<250)return;lastPop=performance.now();const rect=$('face-zone').getBoundingClientRect(),outer=$('playground').getBoundingClientRect();const node=document.createElement('span');node.className='scream-pop';node.textContent=text;node.style.left=`${rect.left-outer.left+(p?.x??.5)*rect.width}px`;node.style.top=`${rect.top-outer.top+(p?.y??.5)*rect.height}px`;node.style.setProperty('--rotate',`${Math.random()*40-20}deg`);$('playground').append(node);setTimeout(()=>node.remove(),1000);}
function squeak(){if(!fx)return;try{context??=new AudioContext();context.resume();const o=context.createOscillator(),g=context.createGain();o.type='sawtooth';o.frequency.setValueAtTime(230+Math.random()*350,context.currentTime);o.frequency.exponentialRampToValueAtTime(80,context.currentTime+.17);g.gain.setValueAtTime(.035,context.currentTime);g.gain.exponentialRampToValueAtTime(.001,context.currentTime+.2);o.connect(g).connect(context.destination);o.start();o.stop(context.currentTime+.22);}catch{}}
function freakout(){face.squish();pop('AAAAAAAAH!',{x:.5,y:.3});squeak();if(!calm){$('playground').classList.remove('freakout');void $('playground').offsetWidth;$('playground').classList.add('freakout');setTimeout(()=>$('playground').classList.remove('freakout'),500);}}
function renderWords(){const words=parseWords(input.value);$('word-count').textContent=`${words.length}/12`;$('word-count').style.color=words.length>12?'#9c223c':'';$('word-chips').replaceChildren(...words.slice(0,12).map((word,i)=>{const chip=document.createElement('span');chip.className='chip';chip.textContent=word;chip.style.setProperty('--tilt',`${i%2?3:-3}deg`);return chip;}));}
function busy(value){$('generate').disabled=value;$('sample').disabled=value;$('cancel').hidden=!value;form.setAttribute('aria-busy',String(value));$('generate-label').textContent=value?'HE’S LOSING IT…':'MAKE HIM RAP';face.busy=value;document.body.classList.toggle('is-generating',value);$('on-air').textContent=value?'● HE IS NOT OKAY':currentTrack?'● DAMAGE RECEIVED':'● NO DAMAGE YET';$('on-air').className=value?'busy':currentTrack?'ready':'';$('speech').textContent=value?'OH GEEZ OH GEEZ OH GEEZ':'I DIDN’T AGREE TO THIS';}
function highlight(text,words){const frag=document.createDocumentFragment(),pattern=wordPattern(words);let previous=0;if(!pattern){frag.append(text);return frag;}for(const m of text.matchAll(pattern)){frag.append(text.slice(previous,m.index));const mark=document.createElement('mark');mark.textContent=m[0];frag.append(mark);previous=m.index+m[0].length;}frag.append(text.slice(previous));return frag;}
function showTrack(track){currentTrack=track;audio.pause();audio.src=track.url;audio.volume=.75;audio.load();$('track-title').textContent=track.words.slice(0,2).join(' × ').toUpperCase();$('track-number').textContent=`TAKE ${String(track.take).padStart(3,'0')}`;$('voice-status').textContent=track.voice==='morty'?'MORTY RVC VOICE · '+STYLES[track.style].name.toUpperCase():track.voice==='pending'?'RAP READY / MORTY VOICE CONVERSION IN PROGRESS':'BASE AI VOICE · MORTY CONVERSION UNAVAILABLE';$('audio-area').hidden=false;$('empty-player').hidden=true;$('lyrics').replaceChildren(...track.lines.map(line=>{const p=document.createElement('p');p.append(highlight(line.text,track.words));return p;}));$('lyrics-details').hidden=!track.lines.length;if(track.lines.length){const coverage=wordCoverage(track.words,track.lines),missing=coverage.filter(w=>!w.found).map(w=>w.word);$('coverage').textContent=`${coverage.length-missing.length}/${coverage.length} words in returned lyrics${missing.length?' · Missing: '+missing.join(', '):''}. Pronunciation can vary.`;}}
async function predict(request,signal){
  const endpoint=BACKEND_URL?BACKEND_URL.replace(/\/$/,'')+'/api/predictions':PROXY_URL;
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
  if(!response.ok){if(response.status===429)throw new Error('The generation service hit its limit. Let this dimension cool down before trying again.');if([401,403].includes(response.status))throw new Error('The generation service denied this model. Check model access and backend configuration.');throw new Error(`The ${stage==='voice'?'Morty voice':'rap'} service returned ${response.status}. No automatic retry was sent.`);}
  let data;try{data=await response.json();}catch{throw new Error('The service timed out or returned unreadable data. No automatic retry was sent.');}
  if(BACKEND_URL){
    // Poll an existing prediction; never create a second billable generation.
    const id=data.id;if(typeof id!=='string'||!/^[a-z0-9]+$/i.test(id))throw new Error('The backend returned an invalid prediction ID.');
    while(['starting','processing','queued'].includes(data.status)){
      await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Stopped','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},3000);if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});
      const update=await fetch(BACKEND_URL.replace(/\/$/,'')+'/api/predictions/'+encodeURIComponent(id),{signal});if(!update.ok)throw new Error('Could not check this prediction. No new generation was sent.');data=await update.json();
    }
  }
  return parseResult(data);
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(controller)return;
  const words=parseWords(input.value);try{validateWords(words);}catch(error){status(error.message,true);input.focus();return;}
  const style=new FormData(form).get('style'),chaos=Number($('chaos').value),seed=crypto.getRandomValues(new Uint32Array(1))[0]%2147483647;
  const active=new AbortController();controller=active;let timedOut=false,base=null;const timeout=setTimeout(()=>{timedOut=true;active.abort();},420000);
  let elapsed=0;const timer=setInterval(()=>{elapsed+=10;status(stage==='voice'?`The rap exists. Installing Morty’s vocal cords… ${elapsed}s elapsed.`:`Turning your words into a full musical breakdown… ${elapsed}s elapsed.`);},10000);
  busy(true);renderDraftActions();$('voice-error-details').hidden=true;freakout();stage='rap';status('Opening a portal. Writing bars. Losing composure. This can take a few minutes.');
  try{
    const result=await predict(makeRequest(words,style,chaos,seed),active.signal);
    base={...result,baseURL:result.url,words,style,voice:'pending',take:take+1};
    pendingDraft=base;renderDraftActions();
    try{const saved=await fetch(result.url,{signal:active.signal});if(saved.ok)base.audioBlob=await saved.blob();}catch(error){if(active.signal.aborted)throw error;}
    void saveDraft(base);
    stage='voice';status('The terrible rap is written. Now turning it into Morty’s voice.');
    await finishSavedVoice(base,active.signal);
  }catch(error){
    if(active.signal.aborted)status((timedOut?'The wait timed out.':'Stopped waiting.')+(base?' Your rap is kept. Use RETRY MORTY VOICE without generating it again.':' The server may still finish; no new request was sent.'),true);
    else if(base)voiceFailure(error);
    else status(error instanceof TypeError?'Could not reach the generation service. Check your connection.':error.message,true);
  }finally{clearTimeout(timeout);clearInterval(timer);controller=null;stage='';busy(false);renderDraftActions();}
});
$('retry-voice').addEventListener('click',async()=>{
  if(controller||!pendingDraft)return;const draft=pendingDraft,active=new AbortController();controller=active;stage='voice';const timeout=setTimeout(()=>active.abort(),420000);
  busy(true);renderDraftActions();$('voice-error-details').hidden=true;status('Retrying Morty’s voice using your saved rap. No new rap generation is being made.');
  try{await finishSavedVoice(draft,active.signal);}catch(error){if(active.signal.aborted)status('Stopped waiting. Your rap is still kept for another voice attempt.',true);else voiceFailure(error);}finally{clearTimeout(timeout);controller=null;stage='';busy(false);renderDraftActions();}
});
$('save-draft').addEventListener('click',async()=>{
  if(!pendingDraft)return;const draft=pendingDraft;
  try{let blob=draft.audioBlob;if(!blob){const r=await fetch(draft.baseURL);if(!r.ok)throw new Error('The draft link expired.');blob=await r.blob();}const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='morty-rapper-unconverted-draft.mp3';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(error){status('Could not save the unconverted draft: '+error.message,true);}
});
$('cancel').addEventListener('click',()=>controller?.abort());input.addEventListener('input',renderWords);
$('surprise').addEventListener('click',()=>{input.value=examples[Math.floor(Math.random()*examples.length)];renderWords();face.squish();input.focus();});
$('chaos').addEventListener('input',()=>{$('chaos-value').textContent=Number($('chaos').value)>=95?'NONE':Number($('chaos').value)>=85?'GONE':'BARELY';if(!calm)face.squish();});
$('panic').addEventListener('click',freakout);$('panic-sticker').addEventListener('click',freakout);
$('fx').addEventListener('click',()=>{fx=!fx;$('fx').textContent=fx?'FX: ON':'FX: OFF';$('fx').setAttribute('aria-pressed',String(fx));if(fx)squeak();});
$('motion').addEventListener('click',()=>{calm=!calm;document.body.classList.toggle('calm',calm);$('motion').setAttribute('aria-pressed',String(calm));$('motion').textContent=calm?'UNLEASH VISUALS':'CALM VISUALS';});
$('sample').addEventListener('click',()=>{if(controller)return;const data=SAMPLE_DATA;showTrack({...data,url:SAMPLE_AUDIO_URI,take:++take});busy(false);status(data.voice==='morty'?'A real generated rap with Morty voice conversion. Press play.':'A real screaming-rap example. Morty conversion is not available in this sample.');});
$('download').addEventListener('click',async()=>{if(!currentTrack)return;const track=currentTrack;$('download').disabled=true;try{const response=await fetch(track.url);if(!response.ok)throw new Error();const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=/\.wav(?:$|[?#])/i.test(track.url)||blob.type.includes('wav')?'morty-rapper.wav':'morty-rapper.mp3';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch{status('Direct download was blocked. Open the audio to save it: ');const a=document.createElement('a');a.href=track.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Save the evidence';$('status').append(a);}finally{$('download').disabled=false;}});
audio.addEventListener('play',()=>{face.playing=true;document.body.classList.add('is-playing');$('speech').textContent='AAAAH! I’M RAPPING!';});
for(const event of ['pause','ended','error'])audio.addEventListener(event,()=>{face.playing=false;document.body.classList.remove('is-playing');});
audio.addEventListener('error',()=>{if(currentTrack)status('The audio could not play. Generated links can expire; save tracks while available.',true);});
for(const line of document.querySelectorAll('.title-line')){line.addEventListener('pointermove',event=>{if(calm)return;const rect=line.getBoundingClientRect();for(const letter of line.querySelectorAll('i')){const box=letter.getBoundingClientRect(),dist=(event.clientX-(box.left+box.width/2))/rect.width;letter.style.transform=`translateY(${Math.max(-14,-25+Math.abs(dist)*65)}px) scale(${1.1-Math.abs(dist)*.2},${1.1+Math.abs(dist)*.4}) rotate(${dist*14}deg)`;}});line.addEventListener('pointerleave',()=>{for(const letter of line.querySelectorAll('i'))letter.style.transform='';});}
window.addEventListener('pointermove',event=>{if(calm)return;for(const eye of document.querySelectorAll('.rubber-eye')){const r=eye.getBoundingClientRect(),dx=event.clientX-r.left-r.width/2,dy=event.clientY-r.top-r.height/2,d=Math.hypot(dx,dy)||1;eye.firstElementChild.style.transform=`translate(${dx/d*7}px,${dy/d*9}px)`;}},{passive:true});
// Slow, sparse drifting organisms in the void; no flashing or strobing.
const space=$('space'),ctx=space.getContext('2d');let width=0,height=0;const motes=Array.from({length:26},(_,i)=>({x:Math.random(),y:Math.random(),r:Math.random()*1.4+.3,s:Math.random()*.15+.04,phase:i}));
function resizeSpace(){width=space.width=innerWidth;height=space.height=innerHeight;}addEventListener('resize',resizeSpace);resizeSpace();let lastPaint=0;function drawSpace(t){if(t-lastPaint>45){lastPaint=t;ctx.clearRect(0,0,width,height);for(const m of motes){const x=(m.x*width+(calm?0:Math.sin(t*.00015+m.phase)*18)),y=(m.y*height+(calm?0:t*m.s*.007))%height;ctx.fillStyle=m.phase%4?'#a7ef5838':'#f36dab55';ctx.beginPath();ctx.arc(x,y,m.r,0,Math.PI*2);ctx.fill();}}requestAnimationFrame(drawSpace);}requestAnimationFrame(drawSpace);renderWords();
loadDraft().then(draft=>{if(!draft||pendingDraft||currentTrack||input.value||!Array.isArray(draft.words))return;pendingDraft=draft;input.value=draft.words.join(', ');renderWords();renderDraftActions();status('Recovered your previous rap. Use RETRY MORTY VOICE to continue without generating it again.');});
