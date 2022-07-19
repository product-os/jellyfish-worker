import type { IntegrationDefinition } from '../../../../lib/sync';
import type { Map } from '../../../../lib/types';
import { FoobarIntegration, foobarIntegrationDefinition } from './foobar';

export { FoobarIntegration };

export const integrationMap: Map<IntegrationDefinition> = {
	foobar: foobarIntegrationDefinition,
};
