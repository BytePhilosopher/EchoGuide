import { useEffect, useMemo } from 'react';
import { VoxideClient, VoxideWidget } from '@voxide/react';
import {
	findRoute,
	readSection,
	searchDocs,
	showExample,
	type DocsRoute,
} from './capabilities';

type AssistantProps = { routes: DocsRoute[] };

async function goTo(path: string): Promise<void> {
	try {
		const { navigate } = await import('astro:transitions/client');
		navigate(path);
	} catch {
		window.location.assign(path);
	}
}

function createClient(publicKey: string, routes: DocsRoute[]): VoxideClient {
	const ai = new VoxideClient({
		publicKey,
		language: 'en-US',
		ui: {
			title: 'EchoGuide docs',
			subtitle: 'Ask, search, or navigate by voice',
			accentColor: '#ff583d',
			theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
			position: 'bottom-right',
			launcherMode: 'voice-bar',
			showBranding: false,
		},
	});

	ai.register({
		searchDocs: {
			description:
				'Search the full text of the EchoGuide documentation. Use this whenever the user asks where something is documented or asks a question the docs would answer.',
			params: {
				query: { type: 'string', required: true, description: 'The words to search for.' },
			},
			handler: ({ query }) => searchDocs(String(query)),
		},
		navigateTo: {
			description:
				'Open a documentation page by name, for example "quickstart", "security", "command pipeline", "API reference", or "privacy".',
			params: {
				section: {
					type: 'string',
					required: true,
					description: 'The page the user asked for, in their own words.',
				},
			},
			handler: async ({ section }) => {
				const route = findRoute(routes, String(section));
				if (!route) {
					return { status: 'not_found', available: routes.map((r) => r.title) };
				}
				await goTo(route.path);
				return { status: 'ok', title: route.title, path: route.path };
			},
		},
		readSection: {
			description:
				'Return the text of the section the reader is currently on, so it can be read aloud. Takes no arguments.',
			handler: () => readSection(),
		},
		showExample: {
			description:
				'Switch the visible code example to a given language, for example Kotlin or TypeScript.',
			params: {
				language: {
					type: 'string',
					required: true,
					description: 'The language the user asked to see.',
				},
			},
			handler: ({ language }) => showExample(String(language)),
		},
	});

	ai.bindState(() => ({
		path: window.location.pathname,
		title: document.title,
		headings: [...document.querySelectorAll('.sl-markdown-content h2')]
			.map((h) => h.textContent?.trim() ?? '')
			.filter(Boolean),
	}));

	return ai;
}

export default function Assistant({ routes }: AssistantProps) {
	const publicKey = import.meta.env.PUBLIC_VOXIDE_KEY;

	const routeKey = routes.map((route) => route.path).join('|');

	const client = useMemo(
		() => (publicKey ? createClient(publicKey, routes) : null),
		[publicKey, routeKey],
	);

	useEffect(() => {
		if (!client) return;
		return () => client.destroy();
	}, [client]);

	if (!client) return null;
	return <VoxideWidget client={client} />;
}
