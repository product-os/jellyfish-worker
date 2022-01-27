import type { LogContext } from '@balena/jellyfish-logger';
import type { Contract } from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import type { Integration, IntegrationDefinition } from '../sync';
import type { Map } from '../types';
import { ActionDefinition, PluginDefinition } from '.';

const commonContractAttributes = {
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
	...commonContractAttributes,
	id: '1',
	slug: 'contract-1',
	type: 'card',
	version: '1.0.0',
};

export const contract2: Contract = {
	...commonContractAttributes,
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

	async translate(_contract: Contract, _options: { actor: string }) {
		return Promise.resolve([]);
	}

	async mirror(_contract: Contract, _options: { actor: string }) {
		return Promise.resolve([]);
	}

	async getFile(_file: string) {
		return Promise.resolve(Buffer.from([]));
	}
}

const integrationDefinitionFor = (slug: string): IntegrationDefinition => {
	return {
		initialize: async () => new TestIntegration(slug),

		isEventValid: (
			_logContext: LogContext,
			_token: any,
			_rawEvent: any,
			_headers: Map<string>,
		) => true,
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
