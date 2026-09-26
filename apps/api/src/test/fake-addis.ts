import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export type FakeReply = { status?: number; body?: unknown; rawBody?: string; delayMs?: number };
export type FakeHandler = (req: { path: string; headers: IncomingMessage['headers']; body: Buffer }) => FakeReply | Promise<FakeReply>;

/**
 * A real HTTP server standing in for Addis AI, so tests exercise the actual fetch, timeout,
 * breaker and parsing code. Each endpoint's reply is programmable per test.
 */
export class FakeAddis {
  private server: Server | null = null;
  url = '';
  stt: FakeHandler = () => ({ body: { data: { transcription: 'open chats' }, confidence: 0.95 } });
  plan: FakeHandler = () => ({ body: { response_text: JSON.stringify({ steps: [] }) } });
  calls: Array<{ path: string; headers: IncomingMessage['headers']; body: Buffer }> = [];

  async start(): Promise<void> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('fake addis failed to bind');
    this.url = `http://127.0.0.1:${address.port}`;
  }

  async stop(): Promise<void> {
    this.server?.closeAllConnections();
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  reset(): void {
    this.calls = [];
    this.stt = () => ({ body: { data: { transcription: 'open chats' }, confidence: 0.95 } });
    this.plan = () => ({ body: { response_text: JSON.stringify({ steps: [] }) } });
  }

  callsTo(path: string): number {
    return this.calls.filter((call) => call.path === path).length;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const call = { path: req.url ?? '', headers: req.headers, body: Buffer.concat(chunks) };
    this.calls.push(call);
    const handler = call.path.startsWith('/api/v2/stt') ? this.stt : call.path.startsWith('/api/v1/chat_generate') ? this.plan : null;
    if (!handler) {
      res.writeHead(404).end();
      return;
    }
    const reply = await handler(call);
    if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
    if (res.destroyed) return;
    res.writeHead(reply.status ?? 200, { 'content-type': 'application/json' });
    res.end(reply.rawBody ?? JSON.stringify(reply.body ?? {}));
  }
}
