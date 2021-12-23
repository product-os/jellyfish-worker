import type { CoreKernel } from '@balena/jellyfish-core';
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
import type { Operation } from 'fast-json-patch';
import type { BaseTypedError } from './errors';

export interface WorkerContext {
	errors: BaseTypedError;
	defaults: CoreKernel['defaults'];
	sync: any;
	getEventSlug: (type: string) => Promise<string>;
	getCardById: (lsession: string, id: string) => Promise<Contract | null>;
	getCardBySlug: (lsession: string, slug: string) => Promise<Contract | null>;
	query: <T extends Contract = Contract>(
		lsession: string,
		schema: Parameters<CoreKernel['query']>[2],
		options?: Parameters<CoreKernel['query']>[3],
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

// TS-TODO: it's annoying that action-increment-tag returns an array of contract summaries
// whereas all the other actions return either null or a single contract summary. Might be
// better to standardize
export interface Action {
	handler: <TData = ContractData>(
		session: string,
		logContext: WorkerContext,
		// The full contract of the action target.
		// This is the same contract referenced by the request.card parameter.
		contract: Contract<ContractData>,
		request: {
			// The full contract of the action being executed.
			action: ActionContract;
			// The ID or Slug of the action target
			card: string;
			actor: string;
			logContext: LogContext;
			timestamp: any;
			epoch: any;
			arguments: { [k: string]: any };
			originator?: string;
		},
	) => Promise<null | ContractSummary<TData> | Array<ContractSummary<TData>>>;

	// Preprocess action arguments before sotring the action in the DB. e.g. Hashing a plaintext password
	// This function returns a (potentially) modified copy of the action arguments
	pre: (
		session: string,
		logContext: WorkerContext,
		request: {
			// The slug of the action being executed.
			action: string;
			// The ID or Slug of the action target
			card: string;
			type: string;
			logContext: LogContext;
			arguments: { [k: string]: any };
		},
	) => Promise<any> | any;
}

// tslint:disable: jsdoc-format
export interface EnqueueOptions {
	logContext: LogContext;
	/** slug or id of input contract **/
	card: string;
	/** type of input contract **/
	type?: string;
	/** slug of action contract to run **/
	action: string;
	/** id of actor that the action should be run on behalf of **/
	actor: string;
	/** arguments to be passed to the action **/
	arguments: {
		[k: string]: unknown;
	};
}
