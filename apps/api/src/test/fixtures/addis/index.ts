import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function addisFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, `${name}.json`), 'utf8'));
}
