import type { Contract } from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import {
	ActionDefinition,
	Integration,
	Plugin,
	PluginDefinition,
} from '../lib';

const commonCard = {
	tags: [],
	markers: [],
	links: {},
	created_at: '2021-03-18T23:29:51.132Z',
	active: true,
	data: {},
	requires: [],
	capabilities: [],
};

export const card1: Contract = {
	...commonCard,
	id: '1',
	slug: 'card-1',
	type: 'card',
	version: '1.0.0',
};

export const card2: Contract = {
	...commonCard,
	id: '2',
	slug: 'card-2',
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

	async mirror(_contract: Contract, _options: any) {
		return Promise.resolve([]);
	}

	async translate(_event: IntegrationEvent) {
		return Promise.resolve([]);
	}
}

export const integration1 = new TestIntegration('integration-1');
export const integration2 = new TestIntegration('integration-2');

export class TestPlugin extends Plugin {
	public constructor(definition: Partial<PluginDefinition> = {}) {
		super(
			Object.assign(
				{
					slug: 'test-plugin',
					name: 'Test Plugin',
					version: '1.0.0',
				},
				definition,
			),
		);
	}
}

export const action1: ActionDefinition = {
	contract: {
		slug: 'action-1',
		type: 'action',
		data: {},
	},
	handler: async () => null,
};

export const action2: ActionDefinition = {
	contract: {
		slug: 'action-2',
		type: 'action',
		data: {},
	},
	pre: _.noop,
	handler: async () => _.pick(card1, 'id', 'slug', 'type', 'version'),
};
