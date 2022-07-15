import type { LogContext } from '@balena/jellyfish-logger';
import type {
	Contract,
	ContractData,
	ContractDefinition,
	ContractSummary,
	JsonSchema,
	Kernel,
	TypeContract,
} from 'autumndb';
import type { Operation } from 'fast-json-patch';
import type { ActionContract } from './contracts/action';

export type { ActionContract };
export * from './contracts';

/**
 * The interface that all Jellyfish Error classes should
 * implement.
 */
export interface JellyfishError extends Error {
	/**
	 * True if the error could be expected in normal circumstances.
	 *
	 * i.e. if expected is true, this error isn't a result of a bug
	 * or an out-of-memory or segmentation-fault error etc.
	 */
	expected: boolean;
}

export interface JellyfishErrorConstructor {
	new (message?: string): JellyfishError;
	(message?: string): JellyfishError;
	readonly prototype: JellyfishError;
}

export declare var JellyfishError: JellyfishErrorConstructor;

export interface QuerySelect {
	[key: string]: any;
}

export interface StreamPayload {
	id: string;
	slug: string;
	type: string;
	cardType: string;
}

export interface Stream extends NodeJS.EventEmitter {
	query: <TContract extends Contract>(
		select: QuerySelect,
		schema: JsonSchema,
		options: any,
	) => Promise<TContract[]>;
	setSchema: (select: QuerySelect, schema: JsonSchema, options: any) => void;
	push: (payload: StreamPayload) => Promise<void>;
	tryEmitEvent: (payload: StreamPayload) => Promise<boolean>;
	close: () => void;
}

export interface Action {
	handler: <TData = ContractData>(
		session: string,
		context: WorkerContext,
		contract: Contract<ContractData>,
		request: ActionHandlerRequest,
	) => Promise<null | ContractSummary<TData> | Array<ContractSummary<TData>>>;
	pre?: (
		session: string,
		context: WorkerContext,
		request: ActionPreRequest,
	) => Promise<any> | any;
}

export interface ActionHandlerRequest {
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
}

export interface ActionPreRequest {
	action: string;
	card: string;
	type: string;
	logContext: LogContext;
	arguments: {
		[k: string]: any;
	};
}

export interface WorkerContext {
	sync: any;
	getEventSlug: (type: string) => string;
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
	cards: {
		[slug: string]: ContractDefinition<ContractData>;
	};
	executeAsyncTriggers: (
		currentContract: Contract<
			ContractData,
			{ [key: string]: Array<Contract<ContractData, any>> }
		> | null,
		insertedContract:
			| TypeContract
			| Contract<
					ContractData,
					{ [key: string]: Array<Contract<ContractData, any>> }
			  >,
		options: {
			actor: any;
			originator: any;
			attachEvents: any;
			timestamp: string | number | Date;
			reason: any;
			eventType: any;
			eventPayload: any;
		},
		currentTime: Date,
		session: string,
	) => Promise<void>;
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

export interface TransformerData {
	data: {
		requirements: {
			os?: string;
			architecture?: string;
			[k: string]: unknown;
		};
		inputFilter: {
			[k: string]: unknown;
		};
		workerFilter: {
			[k: string]: unknown;
		};
		[k: string]: unknown;
	};
	[k: string]: unknown;
}

export interface TransformerContractDefinition
	extends Omit<ContractDefinition, 'data'>,
		TransformerData {}

export interface TransformerContract
	extends Omit<Contract, 'data'>,
		TransformerData {}

export interface ChannelData {
	/**
	 * Contracts matching this filter will be handled by the channel
	 */
	filter: {
		[k: string]: unknown;
	};
	[k: string]: unknown;
}

export interface ChannelContractDefinition
	extends ContractDefinition<ChannelData> {}

export interface ChannelContract extends Contract<ChannelData> {}
