// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import mermaid from 'astro-mermaid';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MERMAID_PRE = '<pre class="mermaid">';

export default defineConfig({
	integrations: [
		mermaid({
			autoTheme: true,
			enableLog: false,
			mermaidConfig: {
				fontFamily: '"Funnel Sans", system-ui, sans-serif',
				flowchart: { curve: 'basis', padding: 14 },
				sequence: { mirrorActors: false },
			},
		}),
		react(),
		{
			name: 'eg-ignore-diagrams-in-search',
			hooks: {
				'astro:build:done': async ({ dir }) => {
					const root = fileURLToPath(dir);
					const files = await readdir(root, { recursive: true });
					const pages = files.filter((file) => file.endsWith('.html'));
					await Promise.all(
						pages.map(async (file) => {
							const path = `${root}/${file}`;
							const html = await readFile(path, 'utf8');
							if (!html.includes(MERMAID_PRE)) return;
							await writeFile(path, html.replaceAll(MERMAID_PRE, '<pre class="mermaid" data-pagefind-ignore>'));
						}),
					);
				},
			},
		},
		starlight({
			title: 'EchoGuide',
			description:
				'Bilingual Amharic and English voice assistant that lets blind and low-vision users drive any Android app by speaking.',
			logo: { src: './src/assets/logo.svg' },
			customCss: ['./src/styles/theme.css', './src/styles/diagrams.css'],
			components: {
				Head: './src/components/Head.astro',
				Footer: './src/components/Footer.astro',
				ThemeSelect: './src/components/ThemeSelect.astro',
			},
			head: [
				{
					tag: 'link',
					attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
				},
				{
					tag: 'link',
					attrs: {
						rel: 'preconnect',
						href: 'https://fonts.gstatic.com',
						crossorigin: true,
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&family=Funnel+Sans:wght@300..800&display=swap',
					},
				},
			],
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/dawitlabs/EchoGuide',
				},
			],
			editLink: {
				baseUrl:
					'https://github.com/dawitlabs/EchoGuide/edit/main/apps/docs/',
			},
			lastUpdated: true,
			sidebar: [
				{
					label: 'Using EchoGuide',
					items: [
						{ label: 'Using EchoGuide', slug: 'guides/using-echoguide' },
						{ label: 'What you will hear', slug: 'guides/what-you-hear' },
						{ label: 'Privacy and data', slug: 'reference/privacy' },
						{ label: 'Voice on this site', slug: 'guides/docs-voice' },
					],
				},
				{
					label: 'Building on EchoGuide',
					items: [
						{ label: 'Developer quickstart', slug: 'guides/quickstart' },
						{ label: 'Voice commands', slug: 'guides/voice-commands' },
						{ label: 'API reference', slug: 'reference/api' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'Overview', slug: 'architecture/overview' },
						{ label: 'Mobile client', slug: 'architecture/mobile-client' },
						{ label: 'Command pipeline', slug: 'architecture/command-pipeline' },
						{ label: 'Latency, cost, capacity', slug: 'architecture/performance' },
						{ label: 'Backend', slug: 'architecture/backend' },
						{ label: 'Data', slug: 'architecture/data' },
						{ label: 'Security', slug: 'architecture/security' },
						{ label: 'Failure and degradation', slug: 'architecture/failure' },
						{ label: 'Observability', slug: 'architecture/observability' },
						{ label: 'Admin and docs clients', slug: 'architecture/other-clients' },
						{ label: 'Testing and layout', slug: 'architecture/testing' },
						{ label: 'Evolution', slug: 'architecture/evolution' },
						{ label: 'Decisions and risks', slug: 'architecture/decisions' },
					],
				},
			],
		}),
	],
});
