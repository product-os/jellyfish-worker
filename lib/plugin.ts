import { cardMixins } from '@balena/jellyfish-core';
import type {
	Contract,
	ContractData,
	ContractDefinition,
} from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import type { Action, Map } from './types';

export abstract class Plugin {
	public slug: string;
	public name: string;
	public version: string;
	public requires: PluginIdentity[];

	private actions: Map<ActionDefinition>;
	private contracts: ContractBuilder[];
	private integrationMap: Map<Integration>;

	protected constructor(options: PluginDefinition) {
		this.slug = options.slug;
		this.name = options.name;
		this.version = options.version;
		this.requires = options.requires || [];
		this.integrationMap = options.integrationMap || {};
		const actions = options.actions || [];
		this.contracts = _.concat(options.contracts || [], _.map(actions, 'card'));

		this.actions = {};
		for (const action of actions) {
			const slug = action.contract.slug;
			if (slug in this.actions) {
				throw new Error(`Duplicate action: ${slug}`);
			}

			this.actions[slug] = action;
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

	public getSyncIntegrations(): Map<Integration> {
		return this.integrationMap;
	}

	public getActions(): Map<ActionDefinition> {
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
	integrationMap?: Map<Integration>;
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

export interface Integration<T = ContractData> {
	slug: string;
	initialize: () => Promise<void>;
	destroy: () => Promise<void>;
	mirror: (
		card: Contract<T>,
		options: SyncFunctionOptions,
	) => Promise<Array<IntegrationResult<T>>>;
	translate: (
		event: IntegrationEvent,
		options?: SyncFunctionOptions,
	) => Promise<Array<IntegrationResult<T>>>;
}

// TODO: probably from sync
export interface IntegrationResult<T> {
	time: Date;
	actor: string;
	card: ContractDefinition<T>;
}
