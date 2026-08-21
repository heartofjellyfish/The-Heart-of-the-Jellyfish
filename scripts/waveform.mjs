/**
 * Precompute waveform peaks for every demo in public/audio.
 *
 * Decoding audio in the browser to draw a waveform means downloading and
 * decoding the whole file before the bar can render — for a 4 MB mp3 that is
 * absurd for a 2px-tall graphic. So the peaks are computed once, here, and
 * shipped as a small JSON the page fetches on first play.
 *
 * Run after adding or replacing a track:   npm run waveform
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const AUDIO_DIR = 'public/audio';
const OUT = 'public/waveforms.json';
/** Buckets per track. 400 is more than any bar is wide, so it downsamples cleanly. */
const BUCKETS = 400;

/** Decode to raw mono 8 kHz PCM on stdout — enough resolution for an envelope. */
function pcm(file) {
  return execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
    { maxBuffer: 1024 * 1024 * 512 },
  );
}

function peaks(buf) {
  const samples = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
  const per = Math.floor(samples.length / BUCKETS);
  const out = new Array(BUCKETS).fill(0);
  let max = 1;
  for (let b = 0; b < BUCKETS; b++) {
    let peak = 0;
    const start = b * per;
    const end = b === BUCKETS - 1 ? samples.length : start + per;
    for (let i = start; i < end; i++) {
      const v = Math.abs(samples[i]);
      if (v > peak) peak = v;
    }
    out[b] = peak;
    if (peak > max) max = peak;
  }
  // Normalise per track, then quantise to a byte. Per-track rather than across
  // the album: this is a seek affordance, not a mastering reference, and a quiet
  // song should still show a shape.
  return out.map((v) => Math.round((v / max) * 255));
}

const files = readdirSync(AUDIO_DIR).filter((f) => f.endsWith('.mp3')).sort();
const data = {};
for (const f of files) {
  const key = f.slice(0, 2); // "01".."10"
  process.stdout.write(`  ${f} … `);
  data[key] = peaks(pcm(join(AUDIO_DIR, f)));
  process.stdout.write('ok\n');
}
writeFileSync(OUT, JSON.stringify(data));
console.log(`\n${files.length} tracks -> ${OUT}`);
