// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import mermaid from 'astro-mermaid';
import ignoreDiagramsInSearch from './src/integrations/ignore-diagrams-in-search.ts';
import { SIDEBAR, SITE_DESCRIPTION, SITE_TITLE } from './src/site.ts';

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
		ignoreDiagramsInSearch(),
		starlight({
			title: SITE_TITLE,
			description: SITE_DESCRIPTION,
			logo: { src: './src/assets/logo.svg' },
			customCss: [
				'./src/styles/theme.css',
				'./src/styles/navigation.css',
				'./src/styles/search.css',
				'./src/styles/content.css',
				'./src/styles/cards.css',
				'./src/styles/diagrams.css',
			],
			components: {
				Head: './src/components/Head.astro',
				Footer: './src/components/Footer.astro',
				ThemeSelect: './src/components/ThemeSelect.astro',
				PageTitle: './src/components/PageTitle.astro',
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
			sidebar: SIDEBAR,
		}),
	],
});
