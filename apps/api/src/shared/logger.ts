import { currentScope } from './context';

// Speech content: dropped, and a line carrying both speech and a user id is dropped entirely.
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
  'term',
  'terms',
  'vocabulary',
  'payload',
  'view_tree_summary',
]);

// Credentials and identifiers that must never reach a log line, whatever else it carries.
const SECRET_FRAGMENTS = ['token', 'secret', 'password', 'authorization', 'api_key', 'apikey', 'cookie', 'phone', 'credential'];

function normalize(key: string): string {
  return key.toLowerCase().replace(/-/g, '_');
}

function isBannedKey(key: string): boolean {
  const normalized = normalize(key);
  if (BANNED_KEYS.has(normalized)) return true;
  return normalized.includes('transcript') || normalized.includes('audio');
}

function isSecretKey(key: string): boolean {
  const normalized = normalize(key);
  return SECRET_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function isUserKey(key: string): boolean {
  const normalized = normalize(key);
  return normalized === 'user_id' || normalized === 'userid';
}

type Sink = (line: string) => void;
let sink: Sink = (line) => console.log(line);

/** Test hook: capture log lines instead of writing them. Returns the previous sink. */
export function setLogSink(next: Sink): Sink {
  const previous = sink;
  sink = next;
  return previous;
}

export function logStructured(event: string, fields: Record<string, unknown> = {}): void {
  let sawUser = false;
  let sawSpeech = false;
  const scope = currentScope();
  const payload: Record<string, unknown> = { event };
  if (scope) {
    payload.request_id = scope.requestId;
    payload.trace_id = scope.traceId;
  }

  for (const [key, value] of Object.entries(fields)) {
    if (isUserKey(key)) sawUser = true;
    if (isBannedKey(key)) {
      sawSpeech = true;
      continue;
    }
    if (isSecretKey(key)) continue;
    payload[key] = value;
  }

  if (sawUser && sawSpeech) return;
  sink(JSON.stringify(payload));
}

/**
 * Describes an error without its message. Driver messages can quote row values (a Postgres
 * unique violation prints the conflicting key), so only the class and a code are logged.
 */
export function describeError(error: unknown): { error_name: string; error_code?: string | number } {
  if (!(error instanceof Error)) return { error_name: typeof error };
  // drizzle wraps driver errors; the useful class and code are on the cause.
  const cause = (error as { cause?: unknown }).cause;
  const source = error.name === 'DrizzleQueryError' && cause instanceof Error ? cause : error;
  const code = (source as { code?: unknown }).code;
  const status = (source as { status?: unknown }).status;
  const result: { error_name: string; error_code?: string | number } = { error_name: source.name };
  if (typeof code === 'string' || typeof code === 'number') result.error_code = code;
  else if (typeof status === 'number') result.error_code = status;
  return result;
}
