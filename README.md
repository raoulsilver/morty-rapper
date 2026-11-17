# Morty Rapper

An unofficial fan-made AI rap experiment: feed Morty a few words, stretch his face, and generate a deliberately terrible rap with ums, uhhs, failed rhymes, and panicked yelling.

**Website:** https://raoulsilver.github.io/morty-rapper/

## Use it

Enter 2–12 words, choose a beat, and click **Make Him Rap**. The app generates a 30-second performance and converts it using a Morty RVC voice model. The first voice setup downloads about 60 MB of public model weights; later attempts in the same session reuse them.

If conversion fails, use **Retry Morty Voice** to reuse the original performance without generating another rap. **Save Unconverted Draft** downloads the original audio. Drafts are also retained locally when browser storage permits.

**Hear the Experiment** plays a bundled, previously generated Morty-converted example. It does not generate a new track from the current words.

The interface can also be opened by double-clicking index.html. Its code, stylesheet, face artwork, and example audio are embedded in that file. New generation needs an internet connection.

## Edit and build

The app has no frontend dependencies. With Node.js installed:

```sh
npm run build
npm test
```

Edit template.html for markup, styles.css for styling, and the JavaScript modules for behavior. build.mjs regenerates the self-contained index.html. Commit the rebuilt index.html when publishing changes. GitHub Pages serves main at the repository root; .nojekyll keeps this a static site.

## How it works

- **Music:** Google Lyria 3 through the instructor-provided ITP/IMA Replicate proxy, with explicit awkward lyrics and randomized musical direction.
- **Voice:** Luminia's public CPU RVC service, with r3gm's GPU demo as an alternate, using the MrSpringtroll/morty checkpoint and retrieval index.
- **Interaction:** An original spring-driven WebGL mesh distorts independently authored shaded vector artwork, with a static-image fallback.
- **Recovery:** The generated audio is kept for conversion-only retries and stored in IndexedDB when available.

These are shared demonstration services with queues, quotas, and outages. A dedicated backend is appropriate for sustained public traffic. The optional backend directory contains a Cloudflare Worker for music generation with your own Replicate account; it is not deployed or required by the default setup. Never put API keys in frontend code.

RVC processes the entire audio mix, so it can alter the backing track as well as the voice. Word inclusion, pronunciation, and performance vary. Lyric highlighting checks returned model text, not an independent audio transcript.

## References

- [Elastic Man](https://www.adultswim.com/etcetera/elastic-man), created by David Li, inspired the interaction direction. No source code or face textures were copied.
- [Lyria 3](https://replicate.com/google/lyria-3)
- [Primary RVC service](https://huggingface.co/spaces/Luminia/rvc-beatrice-voice-conversion)
- [Alternate RVC service](https://huggingface.co/spaces/r3gm/RVC_ZERO)
- [Morty voice model](https://huggingface.co/MrSpringtroll/morty)
- [Course proxy documentation](https://itp-ima-replicate-proxy.web.app/docs.md)

This project is not affiliated with Adult Swim or the creators of Rick and Morty.
