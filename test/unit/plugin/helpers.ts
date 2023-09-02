import type { Contract } from 'autumndb';
import _ from 'lodash';
import type { ActionDefinition, PluginDefinition } from '../../../lib/plugin';
import type { Integration, IntegrationDefinition } from '../../../lib//sync';

const commonContract = {
	tags: [],
	markers: [],
	links: {},
	created_at: '2021-03-18T23:29:51.132Z',
	active: true,
	data: {},
	requires: [],
	capabilities: [],
	loop: null,
};

export const contract1: Contract = {
	...commonContract,
	id: '1',
	slug: 'contract-1',
	type: 'card',
	version: '1.0.0',
};

export const contract2: Contract = {
	...commonContract,
	id: '2',
	slug: 'contract-2',
	type: 'card',
	version: '1.0.0',
};

class TestIntegration implements Integration {
	slug: string;

	constructor(slug: string) {
		this.slug = slug;
	}

	async initialize() {
		return Promise.resolve();
	}

	async destroy() {
		return Promise.resolve();
	}

	async translate() {
		return Promise.resolve([]);
	}

	async mirror() {
		return Promise.resolve([]);
	}

	async getFile() {
		return Promise.resolve(Buffer.from([]));
	}
}

const integrationDefinitionFor = (slug: string): IntegrationDefinition => {
	return {
		slug,

		initialize: async () => new TestIntegration(slug),

		isEventValid: () => true,
	};
};
export const integration1 = integrationDefinitionFor('integration1');
export const integration2 = integrationDefinitionFor('integration2');

export const testPlugin = (definition: Partial<PluginDefinition> = {}) => {
	return {
		slug: 'plugin-test',
		name: 'Test Plugin',
		version: '1.0.0',
		...definition,
	};
};

export const action1: ActionDefinition = {
	contract: {
		slug: 'action-1',
		version: '1.0.0',
		type: 'action',
		data: { arguments: {} },
	},
	handler: async () => null,
};

export const action2: ActionDefinition = {
	contract: {
		slug: 'action-2',
		version: '1.0.0',
		type: 'action',
		data: { arguments: {} },
	},
	pre: _.noop,
	handler: async () => _.pick(contract1, 'id', 'slug', 'type', 'version'),
};
