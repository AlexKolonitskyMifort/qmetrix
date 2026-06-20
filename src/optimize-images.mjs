#!/usr/bin/env node
/**
 * Image optimizer — resize + recompress committed assets with sharp (bundled with Next 16).
 *
 * Downscales anything larger than --max-px (never upscales, keeps aspect ratio) and
 * re-encodes at --quality. By default keeps each file's format and overwrites in place;
 * with --format it writes a converted copy alongside the original (update references,
 * then pass --replace to delete the source file).
 *
 * Usage:
 *   node dev/scripts/optimize-images.mjs [targets…] [options]
 *   npm run images:optimize -- public/images --format webp
 *
 * Targets: image files or directories, searched recursively (default: public/)
 * Options:
 *   --max-px <n>    longest side after resize (default 2560, no upscaling)
 *   --quality <n>   encoder quality 1–100 (default 80)
 *   --format <f>    keep | webp | avif | jpeg | png   (default keep)
 *   --replace       after a --format conversion, delete the original file
 *   --dry-run       encode and report savings, but write nothing
 *
 * SVG and GIF are skipped (vector / animation — not sharp's job).
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// libvips' file cache holds input handles open, which breaks in-place overwrites
// on Windows (EBUSY/EPERM on write). We read inputs into buffers ourselves, but
// disable the cache too so no handle ever lingers.
sharp.cache(false);

// Anchored on the consuming repo's cwd — every verb runs from the app root.
const ROOT = process.cwd();

const RASTER_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const SKIPPED_EXT = new Set(['.svg', '.gif']);
const FORMATS = new Set(['keep', 'webp', 'avif', 'jpeg', 'png']);

/* ── CLI parsing ── */
const argv = process.argv.slice(2);
const targets = [];
let maxPx = 2560;
let quality = 80;
let format = 'keep';
let replace = false;
let dryRun = false;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--max-px') {
    maxPx = Number(argv[++i]);
  } else if (a === '--quality') {
    quality = Number(argv[++i]);
  } else if (a === '--format') {
    format = String(argv[++i]).toLowerCase();
  } else if (a === '--replace') {
    replace = true;
  } else if (a === '--dry-run') {
    dryRun = true;
  } else if (a.startsWith('--')) {
    console.error(`Unknown option: ${a} (see header of dev/scripts/optimize-images.mjs)`);
    process.exit(2);
  } else {
    targets.push(a);
  }
}
if (!FORMATS.has(format) || !(maxPx > 0) || !(quality >= 1 && quality <= 100)) {
  console.error('Invalid options — format keep|webp|avif|jpeg|png, max-px > 0, quality 1–100.');
  process.exit(2);
}
if (targets.length === 0) {
  targets.push('public');
}

/* ── helpers ── */
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const fmtKB = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : bytes < 1024
      ? `${bytes} B`
      : `${Math.round(bytes / 1024)} KB`;

// Same-format recompression is lossy; don't rewrite a file for a marginal win.
const MIN_GAIN = 0.05;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      yield* walk(path.join(dir, entry.name));
    } else {
      yield path.join(dir, entry.name);
    }
  }
}

function collectFiles() {
  const files = [];
  for (const t of targets) {
    const abs = path.isAbsolute(t) ? t : path.join(ROOT, t);
    if (!existsSync(abs)) {
      console.error(`✗ Not found: ${t}`);
      process.exit(2);
    }
    if (statSync(abs).isDirectory()) {
      files.push(...walk(abs));
    } else {
      files.push(abs);
    }
  }
  return files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    if (SKIPPED_EXT.has(ext)) {
      console.log(`  ⊘ ${rel(f)} — ${ext.slice(1)} skipped (not handled by this tool)`);
      return false;
    }
    return RASTER_EXT.has(ext);
  });
}

// PNG quality requires palette quantization; only engage it below lossless quality.
function encode(pipeline, fmt) {
  if (fmt === 'jpeg') {
    return pipeline.jpeg({ quality, mozjpeg: true });
  }
  if (fmt === 'webp') {
    return pipeline.webp({ quality });
  }
  if (fmt === 'avif') {
    return pipeline.avif({ quality });
  }
  if (fmt === 'png') {
    return quality < 100
      ? pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality })
      : pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  }
  throw new Error(`No encoder for format "${fmt}"`);
}

const EXT_FOR = { jpeg: '.jpg', png: '.png', webp: '.webp', avif: '.avif' };

async function optimize(file) {
  const input = await readFile(file); // buffer in, so the source file holds no open handle
  const inBytes = input.length;
  const meta = await sharp(input).metadata();
  const srcFormat = meta.format === 'jpg' ? 'jpeg' : meta.format;
  const outFormat = format === 'keep' ? srcFormat : format;
  if (!EXT_FOR[outFormat]) {
    console.log(`  ⊘ ${rel(file)} — source format "${srcFormat}" not supported, skipped`);
    return null;
  }

  const converting = outFormat !== srcFormat;
  const willResize = Math.max(meta.width ?? 0, meta.height ?? 0) > maxPx;

  // A palette PNG has already been through quantization (likely a previous run of
  // this tool) — re-encoding would stack generation loss for pennies. Idempotency guard.
  if (!converting && !willResize && srcFormat === 'png' && meta.isPalette) {
    console.log(`  = ${rel(file)} — already quantized (${fmtKB(inBytes)})`);
    return { saved: 0 };
  }

  const pipeline = sharp(input)
    .rotate() // bake EXIF orientation in before any resize
    .resize({ width: maxPx, height: maxPx, fit: 'inside', withoutEnlargement: true });
  const buf = await encode(pipeline, outFormat).toBuffer();

  const outFile = converting
    ? path.join(path.dirname(file), path.basename(file, path.extname(file)) + EXT_FOR[outFormat])
    : file;

  // Same format and no resize needed: rewriting is a lossy generation — only
  // worth it when the size win is real, not a rounding error.
  if (!converting && !willResize && buf.length >= inBytes * (1 - MIN_GAIN)) {
    console.log(`  = ${rel(file)} — already optimal (${fmtKB(inBytes)})`);
    return { saved: 0 };
  }

  if (!dryRun) {
    await writeFile(outFile, buf);
    if (converting && replace) {
      await unlink(file);
    }
  }

  const pct = Math.round((1 - buf.length / inBytes) * 100);
  const dims = willResize ? ` ${meta.width}×${meta.height}→≤${maxPx}px` : '';
  const arrow = converting ? ` → ${rel(outFile)}` : '';
  console.log(
    `  ${dryRun ? '·' : '✓'} ${rel(file)}${arrow}${dims}  ${fmtKB(inBytes)} → ${fmtKB(buf.length)} (−${pct}%)${dryRun ? '  [dry-run]' : ''}`,
  );
  return { saved: inBytes - buf.length };
}

/* ── main ── */
const files = collectFiles();
console.log(
  `\n==  Image optimizer  ==  (${files.length} files · max ${maxPx}px · q${quality} · format=${format}${dryRun ? ' · DRY RUN' : ''})\n`,
);
if (files.length === 0) {
  console.log('Nothing to do.\n');
  process.exit(0);
}

let totalSaved = 0;
let failures = 0;
for (const file of files) {
  try {
    const r = await optimize(file);
    if (r) {
      totalSaved += Math.max(0, r.saved);
    }
  } catch (err) {
    failures++;
    console.log(`  ✗ ${rel(file)} — ${err.message}`);
  }
}

console.log(`\n${dryRun ? 'Would save' : 'Saved'} ${fmtKB(totalSaved)} total.`);
if (format !== 'keep') {
  console.log(
    replace
      ? 'Originals deleted (--replace) — update any code/markdown references to the new extension.'
      : 'Converted copies written alongside originals — update references, then re-run with --replace.',
  );
}
console.log('');
process.exit(failures ? 1 : 0);
