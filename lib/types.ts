import type { Kernel } from '@balena/jellyfish-core';
import type { LogContext } from '@balena/jellyfish-logger';
import type {
	ActionContract,
	ActionRequestContract,
	ProducerOptions,
} from '@balena/jellyfish-queue';
import type {
	Contract,
	ContractData,
	ContractDefinition,
	ContractSummary,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import type { Operation } from 'fast-json-patch';

export interface Action {
	handler: <TData = ContractData>(
		session: string,
		context: WorkerContext,
		contract: Contract<ContractData>,
		request: {
			action: ActionContract;
			card: string;
			actor: string;
			logContext: LogContext;
			timestamp: any;
			epoch: any;
			arguments: {
				[k: string]: any;
			};
			originator?: string;
		},
	) => Promise<null | ContractSummary<TData> | Array<ContractSummary<TData>>>;
	pre?: (
		session: string,
		context: WorkerContext,
		request: {
			action: string;
			card: string;
			type: string;
			logContext: LogContext;
			arguments: {
				[k: string]: any;
			};
		},
	) => Promise<any> | any;
}

export interface WorkerContext {
	sync: any;
	getEventSlug: (type: string) => Promise<string>;
	getCardById: (lsession: string, id: string) => Promise<Contract | null>;
	getCardBySlug: (lsession: string, slug: string) => Promise<Contract | null>;
	query: <T extends Contract = Contract>(
		lsession: string,
		schema: Parameters<Kernel['query']>[2],
		options?: Parameters<Kernel['query']>[3],
	) => Promise<T[]>;
	privilegedSession: string;
	insertCard: (
		lsession: string,
		typeCard: TypeContract,
		options: {
			timestamp?: string | number | Date;
			reason?: string;
			actor?: string;
			originator?: string;
			attachEvents?: boolean;
		},
		card: Partial<Contract>,
	) => Promise<Contract | null>;
	replaceCard: (
		lsession: string,
		typeCard: TypeContract,
		options: {
			timestamp?: string | number | Date;
			reason?: string;
			actor?: string;
			originator?: string;
			attachEvents?: boolean;
		},
		card: Partial<Contract>,
	) => Promise<Contract | null>;
	patchCard: (
		lsession: string,
		typeCard: TypeContract,
		options: {
			timestamp?: string | number | Date;
			reason?: string;
			actor?: string;
			originator?: string;
			attachEvents?: boolean;
		},
		card: Partial<Contract>,
		patch: Operation[],
	) => Promise<Contract | null>;
	enqueueAction: (
		session: string,
		actionRequest: ProducerOptions,
	) => Promise<ActionRequestContract>;
	cards: {
		[slug: string]: ContractDefinition<ContractData>;
	};
}

export interface EnqueueOptions {
	logContext?: LogContext;
	/** slug or id of input contract */
	card: string;
	/** type of input contract */
	type?: string;
	/** slug of action contract to run */
	action: string;
	/** id of actor that the action should be run on behalf of */
	actor: string;
	/** arguments to be passed to the action */
	arguments: {
		[k: string]: unknown;
	};
}

export interface Map<T> {
	[key: string]: T;
}

export type TriggeredActionData = TriggeredActionData1 & TriggeredActionData2;
export type TriggeredActionData2 = {
	[k: string]: unknown;
};

export interface TriggeredActionData1 {
	mode?: 'insert' | 'update';
	type?: string;
	action?: string;
	filter?: {
		[k: string]: unknown;
	};
	target?:
		| string
		| {
				[k: string]: unknown;
		  }
		| string[];
	interval?: string;
	/**
	 * Indicates whether the triggered action should be executed synchronously, asynchronously or enqueued
	 */
	schedule?: 'async' | 'sync' | 'enqueue';
	arguments?: {
		[k: string]: unknown;
	};
	startDate?: string;
	[k: string]: unknown;
}

export interface TriggeredActionContractDefinition
	extends ContractDefinition<TriggeredActionData> {}

export interface TriggeredActionContract
	extends Contract<TriggeredActionData> {}

export interface ScheduledActionData {
	options: ProducerOptions;
	schedule: {
		once?: {
			date: string;
		};
		recurring?: {
			start: string;
			end: string;
			interval: string;
		};
	};
	[k: string]: unknown;
}

export interface ScheduledActionContractDefinition
	extends ContractDefinition<ScheduledActionData> {}

export interface ScheduledActionContract
	extends Contract<ScheduledActionData> {}
