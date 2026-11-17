export const PROXY_URL = 'https://itp-ima-replicate-proxy.web.app/api/create_n_get';
export const MODEL = 'google/lyria-3';
export const MORTY_MODEL_URL = 'https://huggingface.co/MrSpringtroll/morty/resolve/main/morty.zip';
export const STYLES = {
  'boom-bap': { name: 'Panic bap', sound: 'aggressive boom bap hip-hop, 105 BPM, filthy breakbeats, cartoon brass stabs, sudden record scratches, explosive bass' },
  trap: { name: 'Portal trap', sound: 'hypertrap hip-hop, 155 BPM half-time feel, explosive distorted 808 bass, manic rolling hi-hats, glitch breaks, sci-fi synths' },
  glitch: { name: 'Glitch rage', sound: 'chaotic experimental rage rap, 170 BPM, industrial drums, blown-out synths, glitch cuts, wild beat switches, cartoon sound effects' },
};

export function parseWords(value) {
  const normalized = value.normalize('NFKC').trim();
  const parts = /[,;\n]/.test(normalized) ? normalized.split(/[,;\n]+/) : normalized.split(/\s+/);
  const seen = new Set();
  return parts.map(w => w.trim()).filter(Boolean).filter(w => {
    const key = w.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function validateWords(words) {
  if (words.length < 2) throw new Error('Add at least two words to start your track.');
  if (words.length > 12) throw new Error('Keep it to 12 words or fewer so they can fit in 30 seconds.');
  if (words.some(w => w.length > 32)) throw new Error('Keep each word or short phrase under 33 characters.');
  if (words.some(w => !/[\p{L}\p{N}]/u.test(w))) throw new Error('Use words or short phrases with letters or numbers.');
}
export function makeRequest(words, style, chaos = 100, seed) {
  validateWords(words);
  if (!STYLES[style]) throw new Error('Choose your damage first.');
  if (!Number.isFinite(chaos) || chaos < 70 || chaos > 100) throw new Error('Chaos must be between 70 and 100.');
  const stunts = ['a shouted argument with a sentient refrigerator', 'a cosmic tax audit going horribly wrong', 'a supermarket turning into an alien arena', 'an emergency broadcast from a spaghetti planet', 'a portal opening in the recording booth'];
  const variation = Number.isInteger(seed) ? Math.abs(seed) : Math.floor(Math.random()*2147483647);
  const lyrics = makeBadLyrics(words, variation);
  return {
    model: MODEL,
    input: {
      seed: variation % 2147483647,
      prompt: `Create a 30-second INTENTIONALLY TERRIBLE amateur comedy rap. Sound: ${STYLES[style].sound}. The voice is a very high-pitched, squeaky, nasal, nervous cartoon boy. He has NO rapping skill: awkward spoken half-rap, off-beat entrances, stumbling over his words, terrible non-rhymes, missed beats, uncomfortable pauses, repeated false starts and embarrassed breathless stutters. He literally says UM and UH constantly. Do NOT turn this into a skilled, confident, polished rap or smooth singing. Preserve every um and uh in the supplied lyrics, pronounced audibly as hesitation sounds. Keep the backing track quieter than the voice. Scenario: ${stunts[variation % stunts.length]}. ${chaos>=90?'He interrupts himself with panicked yelling, voice cracks, and loud AAAAAH screams.':'He nervously yells and screams between awkward failed bars.'} Use exactly these lyrics, preserving the supplied words ${JSON.stringify(words)}. Start immediately; fit the whole incompetent performance into 30 seconds.\nLyrics:\n${lyrics}`,
    },
  };
}
export function makeBadLyrics(words, seed=0) {
  validateWords(words);
  const patterns=[
    (a,b)=>`Um, uh, ${a}... and, um... ${b}.`,
    (a,b)=>`Uh, ${a}. That rhymes with... uh... ${b}?`,
    (a,b)=>`I got, um, ${a}... no wait... uh, ${b}.`,
    (a,b)=>`Um um, ${a}! Uh... ${b}! I forgot the rhyme.`,
    (a,b)=>`Uh, um, ${a}... something something... ${b}.`,
  ];
  const lines=['[Verse]','Um... uh... is this thing on? Oh geez.'];
  for(let i=0;i<words.length;i+=2)lines.push(patterns[(Math.abs(seed)+i/2)%patterns.length](words[i],words[i+1]||words[i]));
  lines.push('Um, uh... that was... AAAAAH! I cannot rap!');
  return lines.join('\n');
}
export function safeMediaURL(value) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function parseResult(result) {
  const data = result?.prediction ?? result;
  if (!data || typeof data !== 'object') throw new Error('The service returned an unexpected response. Try again later.');
  if (data.error || data.status === 'failed' || data.status === 'canceled') {
    const message = typeof data.error === 'string' ? data.error : data.error?.message;
    throw new Error(message || 'The model could not complete this track. Try different words or try again later.');
  }
  if (['starting', 'processing', 'queued'].includes(data.status)) throw new Error('The service returned before the track finished. No second request was sent. Check the class proxy before generating again.');
  const output = data.output;
  const candidate = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : output?.audio ?? output?.url;
  const url = safeMediaURL(candidate);
  if (!url) throw new Error('No playable audio came back from the model. Try again later.');
  return { url, lines: parseLyrics(data.logs), id: typeof data.id === 'string' ? data.id : '' };
}
export function parseLyrics(logs) {
  if (typeof logs !== 'string') return [];
  // The model can return both timed lines and untimed continuation lines.
  // Preserve the whole reported lyric block rather than silently dropping words.
  const marker = logs.match(/Lyrics\s*\/\s*structure\s*:/i);
  const block = marker ? logs.slice(marker.index + marker[0].length) : logs;
  return block.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*\[(\d+(?:\.\d+)?)[\s:\-–]+(\d+(?:\.\d+)?)\]\s*(.+)$/);
    if (match) return [{ start: Number(match[1]), end: Number(match[2]), text: match[3].trim() }];
    if (!marker || !line.trim()) return [];
    return [{ start: null, end: null, text: line.trim() }];
  });
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function wordPattern(words, flags = 'giu') {
  if (!words.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...words].sort((a,b) => b.length-a.length).map(escapeRegex).join('|')})(?![\\p{L}\\p{N}])`, flags);
}
export function wordCoverage(words, lines) {
  const text = lines.map(line => line.text).join('\n');
  return words.map(word => ({ word, found: wordPattern([word], 'iu').test(text) }));
}
