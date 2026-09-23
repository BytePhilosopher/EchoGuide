import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { toMarkdown } from '../lib/page-markdown';

const NON_DOC_PAGES = new Set(['index', '404']);

export const getStaticPaths: GetStaticPaths = async () => {
	const docs = await getCollection('docs', (entry) => !NON_DOC_PAGES.has(entry.id));
	return docs.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
};

export const GET: APIRoute<{ entry: CollectionEntry<'docs'> }> = ({ props }) =>
	new Response(toMarkdown(props.entry), {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
	});
