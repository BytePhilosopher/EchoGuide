import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestScope = {
  requestId: string;
  // W3C trace id: the request id without dashes, so logs, traces and command_events share one key.
  traceId: string;
};

const storage = new AsyncLocalStorage<RequestScope>();

export function runWithScope<T>(scope: RequestScope, fn: () => T): T {
  return storage.run(scope, fn);
}

export function currentScope(): RequestScope | undefined {
  return storage.getStore();
}

export function traceIdFor(requestId: string): string {
  return requestId.replace(/-/g, '').toLowerCase();
}
