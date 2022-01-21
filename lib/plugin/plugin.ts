import { cardMixins } from '@balena/jellyfish-core';
import type {
	Contract,
	ContractData,
	ContractDefinition,
} from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import type { IntegrationDefinition } from '../sync';
import type { Action, Map } from '../types';

export abstract class Plugin {
	public slug: string;
	public name: string;
	public version: string;
	public requires: PluginIdentity[];

	private actions: Map<Action>;
	private contracts: ContractBuilder[];
	private integrationMap: Map<IntegrationDefinition>;

	protected constructor(options: PluginDefinition) {
		if (!options.slug.match(/^plugin-[a-z0-9-]+$/)) {
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
		for (const contractBuilder of this.contracts) {
			let contractTemplate: ContractDefinition;
			if (typeof contractBuilder === 'function') {
				contractTemplate = contractBuilder();
			} else {
				contractTemplate = contractBuilder;
			}
			const contract = cardMixins.initialize(contractTemplate);

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
	contracts?: ContractBuilder[];
	integrationMap?: Map<IntegrationDefinition>;
	mixins?: Map<ContractBuilder>;
}

export interface PluginIdentity {
	slug: string;
	version: string;
}

export interface ActionDefinition<T = ContractData> extends Action {
	contract: ContractDefinition<T>;
}

export type ContractBuilder<T = ContractData> =
	| ContractDefinition<T>
	| (() => ContractDefinition<T>);
