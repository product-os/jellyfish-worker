import type { PluginDefinition } from '../../../lib';
import { integrationMap } from './integrations';

/**
 * The Foobar Jellyfish plugin.
 */
export const foobarPlugin = (
	definition: Partial<PluginDefinition> = {},
): PluginDefinition => {
	return {
		slug: 'plugin-foobar',
		name: 'Foobar Plugin',
		version: '1.0.0',
		integrationMap,
		requires: [],
		...definition,
	};
};
