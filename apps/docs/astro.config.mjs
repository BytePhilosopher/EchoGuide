// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

export default defineConfig({
	integrations: [
		react(),
		starlight({
			title: 'EchoGuide',
			description:
				'Bilingual Amharic and English voice assistant that lets blind and low-vision users drive any Android app by speaking.',
			logo: { src: './src/assets/logo.svg' },
			customCss: ['./src/styles/theme.css'],
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
						{ label: 'Privacy and data', slug: 'reference/privacy' },
					],
				},
				{
					label: 'Building on EchoGuide',
					items: [
						{ label: 'Developer quickstart', slug: 'guides/quickstart' },
						{ label: 'Voice commands', slug: 'guides/voice-commands' },
						{ label: 'Architecture', slug: 'reference/architecture' },
					],
				},
			],
		}),
	],
});
