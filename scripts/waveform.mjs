/**
 * Precompute the waveform of each song — the WHOLE song, not the excerpt.
 *
 * The bar draws the full track dim and lights only the passage the medley
 * actually contains, so a listener can see that a 29-second excerpt is a piece
 * of a 2:16 song rather than the whole of a very short one. That only works if
 * the peaks describe the entire song, so this reads the full-length demos —
 * which live outside the repo, in `audio-originals/full-demos/`, precisely
 * because they must never ship.
 *
 * Decoding audio in the browser to draw this would mean downloading a 5 MB mp3
 * for a 26px graphic, and the browser does not have the full songs at all.
 *
 * Run after re-making the medley:   npm run waveform
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MEDLEY_CHAPTERS } from '../components/medley.ts';

/** Sibling of the site, never inside it. See the note above. */
const SRC = join(process.cwd(), '..', 'audio-originals', 'full-demos');
const OUT = 'public/waveforms.json';
/** Buckets per song. 400 is more than any bar is wide, so it downsamples cleanly. */
const BUCKETS = 400;

if (!existsSync(SRC)) {
  console.error(`\nCannot find the full-length demos at:\n  ${SRC}\n`);
  console.error('They are deliberately outside the repo. Without them this script');
  console.error('cannot draw whole songs, and the bar would misrepresent an excerpt');
  console.error('as a complete track. Restore the folder and run again.\n');
  process.exit(1);
}
const FILES = readdirSync(SRC).filter((f) => f.endsWith('.mp3'));

/** Decode a whole song to raw mono 8 kHz PCM — enough resolution for an envelope. */
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
  // Normalised per song, then quantised to a byte. Per song rather than across
  // the album: this is a seek affordance, not a mastering reference, and a
  // quiet song should still show a shape.
  return out.map((v) => Math.round((v / max) * 255));
}

const data = {};
for (const c of MEDLEY_CHAPTERS) {
  const f = FILES.find((x) => x.startsWith(c.num + '-'));
  if (!f) {
    console.error(`  ${c.num} — no source mp3, skipped`);
    continue;
  }
  process.stdout.write(`  ${c.num} ${c.title} … `);
  data[c.num] = peaks(pcm(join(SRC, f)));
  process.stdout.write(`ok (${c.full.toFixed(0)}s whole)\n`);
}
writeFileSync(OUT, JSON.stringify(data));
console.log(`\n${Object.keys(data).length} whole songs -> ${OUT}`);
