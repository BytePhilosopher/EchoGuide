const BANNED_KEYS = new Set([
  'transcript',
  'text',
  'stt_text',
  'utterance',
  'audio',
  'audio_base64',
  'audio_ref',
  'audio_url',
  'audio_path',
]);

function isBannedKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/-/g, '_');
  if (BANNED_KEYS.has(normalized)) return true;
  return normalized.includes('transcript') || normalized.includes('audio');
}

function isUserKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/-/g, '_');
  return normalized === 'user_id' || normalized === 'userid';
}

export function logStructured(event: string, fields: Record<string, unknown> = {}): void {
  let sawUser = false;
  let sawSpeech = false;
  const payload: Record<string, unknown> = { event };

  for (const [key, value] of Object.entries(fields)) {
    if (isUserKey(key)) sawUser = true;
    if (isBannedKey(key)) {
      sawSpeech = true;
      continue;
    }
    payload[key] = value;
  }

  if (sawUser && sawSpeech) return;
  console.log(JSON.stringify(payload));
}
