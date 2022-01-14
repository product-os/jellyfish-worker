import type { Kernel } from '@balena/jellyfish-core';
import type { LogContext } from '@balena/jellyfish-logger';
import type { ProducerOptions } from '@balena/jellyfish-queue';
import type {
	ActionContract,
	ActionRequestContract,
	Contract,
	ContractData,
	ContractDefinition,
	ContractSummary,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { Operation } from 'fast-json-patch';

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

interface ActionCore {
	handler: Action['handler'];
}

export interface ActionFile<TData = ContractData> extends ActionCore {
	pre?: Action['pre'];
	card: ContractDefinition<TData>;
}

export interface Actions extends Map<Action> {}

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
