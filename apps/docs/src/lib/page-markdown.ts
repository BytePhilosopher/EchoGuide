import type { CollectionEntry } from 'astro:content';

const MDX_IMPORT = /^import\s.+\sfrom\s.+;?\s*$/gm;

export function markdownPath(id: string): string {
	return `/${id}.md`;
}

export function toMarkdown(entry: CollectionEntry<'docs'>): string {
	const body = (entry.body ?? '').replace(MDX_IMPORT, '').trim();
	const summary = entry.data.description ? `> ${entry.data.description}\n\n` : '';
	return `# ${entry.data.title}\n\n${summary}${body}\n`;
}
