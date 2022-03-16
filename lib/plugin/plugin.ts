import { cardMixins } from 'autumndb';
import type {
	ActionContract,
	Contract,
	ContractDefinition,
} from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import type { IntegrationDefinition } from '../sync';
import type { Action, Map } from '../types';

export class Plugin {
	public slug: string;
	public name: string;
	public version: string;
	public requires: PluginIdentity[];

	private actions: Map<Action>;
	private contracts: ContractDefinition[];
	private integrationMap: Map<IntegrationDefinition>;

	public constructor(options: PluginDefinition) {
		if (!options.slug.match(/^[a-z0-9-]+$/)) {
			throw new Error(`Invalid slug: ${options.slug}`);
		}

		this.slug = options.slug;
		this.name = options.name;
		this.version = options.version;
		this.requires = options.requires || [];
		this.integrationMap = options.integrationMap || {};
		const actions = options.actions || [];
		this.contracts = _.concat(
			options.contracts || [],
			_.map(actions, 'contract'),
		);

		this.actions = {};
		for (const action of actions) {
			const slug = action.contract.slug;
			if (slug in this.actions) {
				throw new Error(`Duplicate action: ${slug}`);
			}

			this.actions[slug] = _.omit(action, 'contract');
		}
	}

	public getCards(): Map<Contract> {
		const contractMap = {};
		for (const contractDefinition of this.contracts) {
			const contract = cardMixins.initialize(contractDefinition);

			const slug = contract.slug;
			if (slug in contractMap) {
				throw new Error(`Duplicate contract: ${slug}`);
			}

			contractMap[slug] = contract;
		}

		return contractMap;
	}

	public getSyncIntegrations(): Map<IntegrationDefinition> {
		return this.integrationMap;
	}

	public getActions(): Map<Action> {
		return this.actions;
	}
}

export interface PluginDefinition {
	slug: string;
	name: string;
	version: string;
	requires?: PluginIdentity[];
	actions?: ActionDefinition[];
	contracts?: ContractDefinition[];
	integrationMap?: Map<IntegrationDefinition>;
}

export interface PluginIdentity {
	slug: string;
	version: string;
}

export interface ActionDefinition extends Action {
	contract: ActionContractDefinition;
}

export type ActionContractDefinition = Pick<
	ActionContract,
	'slug' | 'version' | 'name' | 'type' | 'data'
>;
