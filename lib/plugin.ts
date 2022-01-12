import { getLogger, LogContext } from '@balena/jellyfish-logger';
import type {
	Contract,
	ContractData,
	ContractDefinition,
} from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import { mixins } from './mixins';
import type { Action, ActionMap } from './types';

const logger = getLogger(__filename);

export abstract class Plugin {
	public slug: string;
	public name: string;
	public version: string;
	public requires: PluginIdentity[];

	private actions: ActionDefinition[];
	private contracts: ContractBuilder[];
	private integrations: Integration[];
	private mixins: ContractBuilderMap;

	protected constructor(options: PluginDefinition) {
		this.slug = options.slug;
		this.name = options.name;
		this.version = options.version;
		this.requires = options.requires || [];
		this.actions = options.actions || [];
		this.contracts = options.cards || [];
		this.integrations = options.integrations || [];
		this.mixins = {
			...(options.mixins || {}),
			...mixins,
		};
	}

	// TODO: gonna inline this as it is not necessary to have this kind of
	// function
	private getSafeMap<T extends Sluggable>(
		logContext: LogContext,
		source: any[],
		sourceType: string,
		resolver: (item: any) => T = _.identity,
	): Map<T> {
		return _.reduce(
			source,
			(map: Map<T>, item: T) => {
				const resolvedItem = resolver(item);
				const slug =
					_.get(resolvedItem, 'slug') || _.get(resolvedItem, ['card', 'slug']);
				if (map[slug]) {
					const errorMessage = `Duplicate ${sourceType} with slug '${slug}' found`;
					logger.error(logContext, `${this.name}: ${errorMessage}`);
					throw new Error(errorMessage);
				}
				map[slug] = resolvedItem;
				return map;
			},
			{},
		);
	}

	public getCards(logContext: LogContext, mixins: CoreMixins) {
		const actionCards = _.map(this.actions, 'card');
		const allCards = _.concat(this.contracts, actionCards);
		const cardMixins = {
			...mixins,
			...this.mixins,
		};
		const cards = this.getSafeMap<ContractDefinition>(
			logContext,
			allCards,
			'cards',
			(cardFile: ContractBuilder) => {
				const card =
					typeof cardFile === 'function' ? cardFile(cardMixins) : cardFile;
				return mixins.initialize(card);
			},
		);
		return cards;
	}

	public getSyncIntegrations(logContext: LogContext) {
		return this.getSafeMap<Integration>(
			logContext,
			this.integrations,
			'integrations',
		);
	}

	public getActions(_logContext: LogContext) {
		return _.reduce(
			this.actions,
			(actions: ActionMap, action: ActionDefinition) => {
				const slug = action.card.slug;
				actions[slug] = {
					handler: action.handler,
					pre: action.pre || _.noop,
				};
				return actions;
			},
			{},
		);
	}
}

export interface PluginDefinition {
	slug: string;
	name: string;
	version: string;
	requires?: PluginIdentity[];
	actions?: ActionDefinition[];
	cards?: ContractBuilder[];
	integrations?: Integration[];
	mixins?: ContractBuilderMap;
}

export interface PluginIdentity {
	slug: string;
	version: string;
}

export interface ActionDefinition<T = ContractData> extends Action {
	card: ContractDefinition<T>;
}

export type ContractBuilder<T = ContractData> =
	| ContractDefinition<T>
	| ((mixins: CoreMixins) => ContractDefinition<T>);

export interface ContractBuilderMap {
	[key: string]: ContractBuilder;
}

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

export interface IntegrationResult<T> {
	time: Date;
	actor: string;
	card: ContractDefinition<T>;
}
