import { ProducerOptions } from '@balena/jellyfish-queue';
import { core } from '@balena/jellyfish-types';
import { JellyfishErrorConstructor } from '@balena/jellyfish-types/build/error';
import { Action } from '@balena/jellyfish-types/build/worker';
import { Operation } from 'fast-json-patch';

// tslint:disable: jsdoc-format
export interface EnqueueOptions {
	context?: LogContext;
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

export interface LogContext {
	id: string;
	api?: string;
}

export interface ActionLibrary {
	[key: string]: Action;
}

export interface WorkerErrors {
	WorkerNoExecuteEvent: JellyfishErrorConstructor;
	WorkerNoElement: JellyfishErrorConstructor;
	WorkerInvalidVersion: JellyfishErrorConstructor;
	WorkerInvalidAction: JellyfishErrorConstructor;
	WorkerInvalidActionRequest: JellyfishErrorConstructor;
	WorkerInvalidTrigger: JellyfishErrorConstructor;
	WorkerInvalidTemplate: JellyfishErrorConstructor;
	WorkerInvalidDuration: JellyfishErrorConstructor;
	WorkerSchemaMismatch: JellyfishErrorConstructor;
	WorkerAuthenticationError: JellyfishErrorConstructor;
}

export interface WorkerContext {
	errors: WorkerErrors;
	defaults: core.JellyfishKernel['defaults'];
	sync: any;
	getEventSlug: (type: string) => Promise<string>;
	getCardById: (lsession: string, id: string) => Promise<core.Contract | null>;
	getCardBySlug: (
		lsession: string,
		slug: string,
	) => Promise<core.Contract | null>;
	query: <T extends core.Contract = core.Contract>(
		lsession: string,
		schema: Parameters<core.JellyfishKernel['query']>[2],
		options?: Parameters<core.JellyfishKernel['query']>[3],
	) => Promise<T[]>;
	privilegedSession: string;
	insertCard: (
		lsession: string,
		typeCard: core.TypeContract,
		options: {
			timestamp?: string | number | Date;
			reason?: string;
			actor?: string;
			originator?: string;
			attachEvents?: boolean;
		},
		card: Partial<core.Contract>,
	) => Promise<core.Contract | null>;
	replaceCard: (
		lsession: string,
		typeCard: core.TypeContract,
		options: {
			timestamp?: string | number | Date;
			reason?: string;
			actor?: string;
			originator?: string;
			attachEvents?: boolean;
		},
		card: Partial<core.Contract>,
	) => Promise<core.Contract | null>;
	patchCard: (
		lsession: string,
		typeCard: core.TypeContract,
		options: {
			timestamp?: string | number | Date;
			reason?: string;
			actor?: string;
			originator?: string;
			attachEvents?: boolean;
		},
		card: Partial<core.Contract>,
		patch: Operation[],
	) => Promise<core.Contract | null>;
	enqueueAction: (
		session: string,
		actionRequest: ProducerOptions,
	) => Promise<core.ActionRequestContract>;
	cards: {
		[slug: string]: core.ContractDefinition<core.ContractData>;
	};
}
