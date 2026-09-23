import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const DIAGRAM_TAG = '<pre class="mermaid">';
const IGNORED_DIAGRAM_TAG = '<pre class="mermaid" data-pagefind-ignore>';

async function markDiagramsIgnored(file: string): Promise<void> {
	const html = await readFile(file, 'utf8');
	if (!html.includes(DIAGRAM_TAG)) return;
	await writeFile(file, html.replaceAll(DIAGRAM_TAG, IGNORED_DIAGRAM_TAG));
}

export default function ignoreDiagramsInSearch(): AstroIntegration {
	return {
		name: 'eg-ignore-diagrams-in-search',
		hooks: {
			'astro:build:done': async ({ dir }) => {
				const root = fileURLToPath(dir);
				const files = await readdir(root, { recursive: true });
				const pages = files.filter((file) => file.endsWith('.html'));
				await Promise.all(pages.map((page) => markDiagramsIgnored(join(root, page))));
			},
		},
	};
}
