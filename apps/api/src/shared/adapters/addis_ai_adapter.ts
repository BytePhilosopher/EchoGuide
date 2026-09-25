interface ScreenContext {
  current_package: string;
  view_tree_summary: string;
}

export interface AddisSTTResponse {
  text: string;
  confidence: number;
}

export class AddisAIError extends Error {
  constructor(
    readonly stage: 'transcribe' | 'plan',
    readonly status: number,
  ) {
    super(`addis_ai_${stage}_failed`);
    this.name = 'AddisAIError';
  }
}

const BASE_URL = process.env.ADDIS_AI_BASE_URL ?? 'https://api.addisassistant.com';
const TRANSCRIBE_TIMEOUT_MS = 8_000;
const PLAN_TIMEOUT_MS = 6_000;
const SAMPLE_RATE = 16_000;

const PLAN_INSTRUCTION = [
  'You turn a spoken command into a plan of interface actions for an Android phone.',
  'Reply with JSON only. No prose, no code fence.',
  'Shape: {"package_name":string,"requires_user_confirmation":boolean,"steps":[{"action_type":"TAP"|"SCROLL"|"TEXT_INPUT"|"BACK"|"HOME","target_node_id":string|null,"payload":string|null,"is_destructive":boolean}]}',
  'Only use target_node_id values that appear in the screen listing.',
  'Set is_destructive true for anything that sends, pays, deletes or cannot be undone.',
  'If the command cannot be carried out on this screen, reply {"steps":[]}.',
].join('\n');

export class AddisAIAdapter {
  private readonly apiKey: string;

  constructor(apiKey: string = process.env.ADDIS_AI_API_KEY ?? '') {
    this.apiKey = apiKey;
  }

  async transcribeAudio(audioBuffer: Buffer, language: string): Promise<AddisSTTResponse> {
    const form = new FormData();
    form.append('audio', new Blob([toWav(audioBuffer)], { type: 'audio/wav' }), 'command.wav');
    form.append('request_data', JSON.stringify({ language_code: language.startsWith('en') ? 'en' : 'am' }));

    const response = await this.send('/api/v2/stt', { method: 'POST', body: form }, TRANSCRIBE_TIMEOUT_MS, 'transcribe');
    const payload = (await response.json()) as {
      data?: { transcription?: string };
      confidence?: number;
    };

    return {
      text: payload.data?.transcription ?? '',
      confidence: typeof payload.confidence === 'number' ? payload.confidence : 0,
    };
  }

  async planActionSequence(transcript: string, screenContext: ScreenContext): Promise<unknown> {
    const prompt = [
      `Foreground app: ${screenContext.current_package}`,
      'Screen:',
      screenContext.view_tree_summary,
      '',
      `Command: ${transcript}`,
    ].join('\n');

    const response = await this.send(
      '/api/v1/chat_generate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          system: PLAN_INSTRUCTION,
          generation_config: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      },
      PLAN_TIMEOUT_MS,
      'plan',
    );

    const payload = (await response.json()) as { response_text?: string };
    const parsed = parseJsonObject(payload.response_text ?? '');
    if (!parsed) return null;

    return {
      ...parsed,
      plan_id: crypto.randomUUID(),
      package_name: parsed.package_name ?? screenContext.current_package,
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((step: Record<string, unknown>) => ({ ...step, step_id: crypto.randomUUID() }))
        : [],
    };
  }

  private async send(
    path: string,
    init: RequestInit,
    timeoutMs: number,
    stage: 'transcribe' | 'plan',
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { ...(init.headers ?? {}), 'x-api-key': this.apiKey },
      });
      if (!response.ok) throw new AddisAIError(stage, response.status);
      return response;
    } catch (error) {
      if (error instanceof AddisAIError) throw error;
      throw new AddisAIError(stage, 0);
    } finally {
      clearTimeout(timer);
    }
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toWav(pcm: Buffer): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(44 + pcm.length));
  const view = new DataView(out.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);

  return out;
}
