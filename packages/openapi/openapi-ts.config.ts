import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
	input: './openapi.yaml',
	output: 'src/generated',
	plugins: [{ name: 'zod', compatibilityVersion: 3 }],
});
