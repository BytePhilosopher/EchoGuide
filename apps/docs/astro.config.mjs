// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	integrations: [
		starlight({
			title: 'EchoGuide',
			description:
				'Bilingual Amharic and English voice assistant that lets blind and low-vision users drive any Android app by speaking.',
			customCss: ['./src/styles/theme.css'],
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
					label: 'Start here',
					items: [
						{ label: 'Quickstart', slug: 'guides/quickstart' },
						{ label: 'Voice commands', slug: 'guides/voice-commands' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Architecture', slug: 'reference/architecture' },
						{ label: 'Privacy and data', slug: 'reference/privacy' },
					],
				},
			],
		}),
	],
});
