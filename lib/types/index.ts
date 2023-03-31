import type { LogContext } from '@balena/jellyfish-logger';
import type {
	AutumnDBSession,
	Contract,
	ContractData,
	ContractDefinition,
	ContractSummary,
	Kernel,
	RelationshipContract,
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

export interface Action {
	handler: <TData = ContractData>(
		session: AutumnDBSession,
		context: WorkerContext,
		contract: Contract<ContractData>,
		request: ActionHandlerRequest,
	) => Promise<null | ContractSummary<TData> | Array<ContractSummary<TData>>>;
	pre?: (
		session: AutumnDBSession,
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
	getCardById: (
		lsession: AutumnDBSession,
		id: string,
	) => Promise<Contract | null>;
	getCardBySlug: (
		lsession: AutumnDBSession,
		slug: string,
	) => Promise<Contract | null>;
	query: <T extends Contract = Contract>(
		lsession: AutumnDBSession,
		schema: Parameters<Kernel['query']>[2],
		options?: Parameters<Kernel['query']>[3],
	) => Promise<T[]>;
	privilegedSession: AutumnDBSession;
	insertCard: (
		lsession: AutumnDBSession,
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
		lsession: AutumnDBSession,
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
		lsession: AutumnDBSession,
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
	relationships: RelationshipContract[];
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
