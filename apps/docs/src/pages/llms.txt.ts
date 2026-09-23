import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { markdownPath } from '../lib/page-markdown';
import { SIDEBAR, SITE_DESCRIPTION, SITE_TITLE } from '../site';

export const GET: APIRoute = async () => {
	const docs = new Map((await getCollection('docs')).map((entry) => [entry.id, entry]));
	const sections = SIDEBAR.map((group) => {
		const links = group.items.flatMap((item) => {
			const entry = docs.get(item.slug);
			if (!entry) return [];
			const description = entry.data.description ? `: ${entry.data.description}` : '';
			return [`- [${entry.data.title}](${markdownPath(entry.id)})${description}`];
		});
		return `## ${group.label}\n\n${links.join('\n')}`;
	});
	const body = `# ${SITE_TITLE}\n\n> ${SITE_DESCRIPTION}\n\n${sections.join('\n\n')}\n`;
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
