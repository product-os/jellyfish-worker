import type { IntegrationDefinition, Map } from '../../../../lib';
import { FoobarIntegration, foobarIntegrationDefinition } from './foobar';

export { FoobarIntegration };

export const integrationMap: Map<IntegrationDefinition> = {
	foobar: foobarIntegrationDefinition,
};
