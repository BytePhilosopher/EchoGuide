export const SITE_TITLE = 'EchoGuide';

export const SITE_DESCRIPTION =
	'Bilingual Amharic and English voice assistant that lets blind and low-vision users drive any Android app by speaking.';

export const SIDEBAR = [
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
];
