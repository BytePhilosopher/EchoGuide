#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'apps/mobile/modules/voice-pipeline/android/src/main/assets/phrases.json');
const OUT_DIR = join(ROOT, 'apps/mobile/modules/voice-pipeline/android/src/main/assets/phrases/am-ET');

const ENDPOINT = 'https://api.addisassistant.com/api/v1/voice/generations';
const MAX_RETRIES = 5;
const BACKOFF_MS = 20_000;
const PACE_MS = 4_000;
const VOICE_ID = process.env.ADDIS_VOICE_ID ?? 'am-hamen';
const API_KEY = process.env.ADDIS_AI_API_KEY;

if (!API_KEY) {
  console.error('ADDIS_AI_API_KEY is not set.');
  console.error('Run:  ADDIS_AI_API_KEY=... node scripts/generate-amharic-phrases.mjs');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const exists = (path) => access(path).then(() => true, () => false);

async function post(key, text) {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      text,
      voice_id: VOICE_ID,
      language: 'am',
      output_format: 'mp3_44100',
      client_request_id: `echoguide-phrase-${key}`,
    }),
  });
}

async function generate(key, text) {
  let response = await post(key, text);

  for (let attempt = 0; response.status === 429 && attempt < MAX_RETRIES; attempt += 1) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : BACKOFF_MS * (attempt + 1);
    console.log(`${key}: rate limited, waiting ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
    response = await post(key, text);
  }

  if (!response.ok) {
    throw new Error(`${key}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  }

  const payload = await response.json();
  const audioUrl = payload.audio_url ?? payload.data?.audio_url;
  if (!audioUrl) throw new Error(`${key}: no audio_url in response`);

  const audio = await fetch(audioUrl);
  if (!audio.ok) throw new Error(`${key}: download failed ${audio.status}`);

  const target = join(OUT_DIR, `${key}.mp3`);
  await writeFile(target, Buffer.from(await audio.arrayBuffer()));
  return target;
}

const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));
await mkdir(OUT_DIR, { recursive: true });

let failed = 0;
for (const [key, entry] of Object.entries(catalog)) {
  const text = entry['am-ET'];
  if (!text) {
    console.error(`${key}: no am-ET text, skipped`);
    failed += 1;
    continue;
  }
  const target = join(OUT_DIR, `${key}.mp3`);
  if (await exists(target)) {
    console.log(`${key}  already present, skipped`);
    continue;
  }

  try {
    const path = await generate(key, text);
    console.log(`${key}  ${text}  ->  ${path.replace(ROOT + '/', '')}`);
    await sleep(PACE_MS);
  } catch (error) {
    console.error(String(error.message));
    failed += 1;
  }
}

console.log(`\n${Object.keys(catalog).length - failed}/${Object.keys(catalog).length} phrases written to`);
console.log(OUT_DIR.replace(ROOT + '/', ''));
if (failed > 0) process.exit(1);
