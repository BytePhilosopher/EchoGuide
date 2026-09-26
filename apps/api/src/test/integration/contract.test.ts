import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { createApp } from '../../app/app';
import { startHarness, type Harness } from '../harness';

type Operation = {
  security?: Array<Record<string, unknown>>;
  parameters?: Array<{ $ref?: string; name?: string }>;
  responses: Record<string, unknown>;
};
type Spec = {
  security: Array<Record<string, unknown>>;
  paths: Record<string, Record<string, Operation | unknown>>;
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const spec = parse(readFileSync(join(__dirname, '../../../../../packages/openapi/openapi.yaml'), 'utf8')) as Spec;

function specOperations(): Map<string, Operation> {
  const ops = new Map<string, Operation>();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      if (item[method]) ops.set(`${method.toUpperCase()} ${path}`, item[method] as Operation);
    }
  }
  return ops;
}

type Layer = { route?: { path: string; methods: Record<string, boolean> }; name?: string; handle?: { stack?: Layer[] } };

/** Every route the Express app actually serves, as `METHOD /openapi/{style}` keys. */
function appRoutes(stack: Layer[], found = new Set<string>()): Set<string> {
  for (const layer of stack) {
    if (layer.route) {
      const path = layer.route.path.replace(/:([A-Za-z]+)/g, '{$1}');
      for (const method of Object.keys(layer.route.methods)) {
        if (METHODS.includes(method)) found.add(`${method.toUpperCase()} ${path}`);
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      appRoutes(layer.handle.stack, found);
    }
  }
  return found;
}

describe('OpenAPI contract matches the implementation', () => {
  let h: Harness;
  let routes: Set<string>;
  before(async () => {
    h = await startHarness();
    const app = createApp(h.c) as unknown as { _router: { stack: Layer[] } };
    routes = appRoutes(app._router.stack);
  });
  after(async () => {
    await h.close();
  });

  test('every implemented route is documented', () => {
    const documented = new Set(specOperations().keys());
    const undocumented = [...routes].filter((route) => !documented.has(route));
    assert.deepEqual(undocumented, []);
  });

  test('every documented operation is implemented', () => {
    const missing = [...specOperations().keys()].filter((route) => !routes.has(route));
    assert.deepEqual(missing, []);
  });

  test('every authenticated operation documents 401, and user routes require the install id', () => {
    const problems: string[] = [];
    for (const [key, op] of specOperations()) {
      const security = op.security ?? spec.security;
      const isPublic = security.length === 0 || security.every((entry) => Object.keys(entry).length === 0);
      if (isPublic) continue;
      // Optional credentials (register-device): a bad one is treated like none, so there is no 401.
      const optionalAuth = security.some((entry) => Object.keys(entry).length === 0);
      if (!optionalAuth && !op.responses['401']) problems.push(`${key}: no 401`);
      const isAdmin = security.some((entry) => 'adminSession' in entry);
      if (isAdmin && !op.responses['403']) problems.push(`${key}: admin route without 403`);
      if (!isAdmin && !optionalAuth) {
        const hasInstallId = (op.parameters ?? []).some((p) => p.$ref === '#/components/parameters/InstallId');
        if (!hasInstallId) problems.push(`${key}: session route without X-Install-ID`);
        if (!op.responses['403']) problems.push(`${key}: session route without 403 (suspended account)`);
      }
    }
    assert.deepEqual(problems, []);
  });

  test('every non-probe operation documents 429, since every route is rate limited', () => {
    const missing = [...specOperations()]
      .filter(([key]) => !key.endsWith(' /health') && !key.endsWith(' /ready'))
      .filter(([, op]) => !op.responses['429'])
      .map(([key]) => key);
    assert.deepEqual(missing, []);
  });

  test('the command route documents every failure status it can return', () => {
    const op = specOperations().get('POST /v1/commands')!;
    for (const status of ['400', '401', '403', '409', '413', '422', '429', '500', '502', '503', '504']) {
      assert.ok(op.responses[status], `POST /v1/commands is missing ${status}`);
    }
  });
});
