/**
 * Precompute waveform peaks for every chapter of the medley.
 *
 * Decoding audio in the browser to draw a waveform means downloading and
 * decoding the whole file before the bar can render — for an 8 MB mp3 that is
 * absurd for a 2px-tall graphic. So the peaks are computed once, here, and
 * shipped as a small JSON the page fetches on first play.
 *
 * Keyed by track number, because that is what the bar and the poem line ask
 * for. The site plays one continuous file now (see components/medley.ts), so a
 * "track" is a time window inside it rather than a file of its own — and each
 * window gets its own envelope, normalised to itself, exactly as before.
 *
 * Run after re-making the medley:   npm run waveform
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { MEDLEY_CHAPTERS } from '../components/medley.ts';

const AUDIO = 'public/audio/medley.mp3';
const OUT = 'public/waveforms.json';
/** Buckets per chapter. 400 is more than any bar is wide, so it downsamples cleanly. */
const BUCKETS = 400;

/** Decode one window to raw mono 8 kHz PCM — enough resolution for an envelope. */
function pcm(file, start, end) {
  return execFileSync(
    'ffmpeg',
    ['-v', 'error', '-ss', String(start), '-to', String(end), '-i', file,
     '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
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
  // Normalise per chapter, then quantise to a byte. Per chapter rather than
  // across the medley: this is a seek affordance, not a mastering reference,
  // and a quiet song should still show a shape.
  return out.map((v) => Math.round((v / max) * 255));
}

const data = {};
for (const c of MEDLEY_CHAPTERS) {
  process.stdout.write(`  ${c.num} ${c.title} … `);
  data[c.num] = peaks(pcm(AUDIO, c.start, c.end));
  process.stdout.write('ok\n');
}
writeFileSync(OUT, JSON.stringify(data));
console.log(`\n${MEDLEY_CHAPTERS.length} chapters -> ${OUT}`);
