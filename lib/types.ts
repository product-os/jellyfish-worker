/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */
import { JSONSchema, core, worker, queue } from '@balena/jellyfish-types';
import { Operation } from 'fast-json-patch';

// TODO: just handle trigger contracts directly, as having 3 different structs for triggered-actions is super confusing
// These objects are initially generated in the action server bootstrap code here https://github.com/product-os/jellyfish/blob/de4b77283d78403c861b4d966027cb71e71a8bac/apps/action-server/lib/bootstrap.js#L47
// They also additional get parse by the `parseTrigger` function in index.ts
export interface WorkerTriggerObjectInput {
	id: string;
	slug: string;
	action: worker.TriggeredActionData2['action'];
	target: worker.TriggeredActionData2['target'];
	arguments: worker.TriggeredActionData2['arguments'];
	interval?: worker.TriggeredActionData2['interval'];
	filter: worker.TriggeredActionData2['filter'];
	mode: worker.TriggeredActionData2['mode'];
	schedule: worker.TriggeredActionData2['schedule'];
}

// This is how triggers are stored in the state of the worker instance
// TODO: Just work with trigger-action contracts directly
export interface ParsedWorkerTriggerObject {
	id: string;
	slug: string;
	action: worker.TriggeredActionData2['action'];
	target: worker.TriggeredActionData2['target'];
	arguments: worker.TriggeredActionData2['arguments'];
	schedule: worker.TriggeredActionData2['schedule'];
	startDate?: any;
	filter: worker.TriggeredActionData2['filter'];
	interval?: worker.TriggeredActionData2['interval'];
	mode: worker.TriggeredActionData2['mode'];
}

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
	api: string;
}

export interface QueueWaitResult {
	error: false | string;
	timestamp: string;
	data: {
		id: string;
		slug: string;
		type: string;
		version: string;
	};
}

export interface JellyfishKernel {
	cards: { [slug: string]: core.Contract };
	getCardById<TContract extends core.Contract = core.Contract>(
		context: LogContext,
		session: string,
		id: string,
	): Promise<TContract | null>;

	getCardBySlug<TContract = core.Contract>(
		context: LogContext,
		session: string,
		slug: string,
	): Promise<TContract | null>;

	patchCardBySlug<TContract extends core.Contract = core.Contract>(
		context: LogContext,
		session: string,
		slug: string,
		patch: Operation[],
	): Promise<TContract>;

	replaceCard(
		context: LogContext,
		session: string,
		contract: core.ContractDefinition,
	): Promise<core.Contract>;

	insertCard(
		context: LogContext,
		session: string,
		contract: core.ContractDefinition,
	): Promise<core.Contract>;

	defaults(
		partialContract: Partial<core.Contract> & Pick<core.Contract, 'type'>,
	): core.ContractDefinition;

	query<TContract extends core.Contract = core.Contract>(
		context: LogContext,
		session: string,
		schema: JSONSchema,
		options?: {
			limit?: number;
			sortBy?: string[] | string;
			sortDir?: 'asc' | 'desc';
		},
	): Promise<TContract[]>;
}
export interface ActionPayload {
	slug: string;
	data: {
		originator: string;
		timestamp: string;
		action: string;
		actor?: string;
	};
}
export interface PostResults {
	data: {
		originator?: string;
		[key: string]: any;
	};
	error: boolean;
}

export interface PostOptions {
	id: string;
	actor: string;
	action: string;
	timestamp: string;
	card: string;
	originator?: string;
}

export type OnMessageEventHandler = (payload: ActionPayload) => Promise<void>;

// TS-TODO: replace this with declaration in @balena/jellyfish-types
export interface QueueConsumer {
	initializeWithEventHandler: (
		context: LogContext,
		onMessageEventHandler: OnMessageEventHandler,
	) => Promise<void>;
	run: (
		context: LogContext,
		onMessageEventHandler: OnMessageEventHandler,
		retries?: number,
	) => Promise<boolean>;
	cancel: () => Promise<void>;
	postResults: (
		actor: string,
		context: LogContext,
		actionRequest: core.ActionRequestContract,
		results: PostResults,
	) => Promise<queue.ExecuteContract>;
}

export interface ProducerOptions {
	context: LogContext;
	action: string;
	card: string;
	type: string;
	arguments: core.ContractData;
	currentDate?: Date;
	originator?: string;
}

export interface ProducerResults {
	error: boolean;
	timestamp: string;
	data: queue.ExecuteContract['data']['payload']['data'];
}

export interface QueueProducer {
	initialize: (context: LogContext) => Promise<void>;
	storeRequest: (
		actor: string,
		session: string,
		options: ProducerOptions,
	) => Promise<core.ActionRequestContract>;
	enqueue: (
		actor: string,
		session: string,
		options: ProducerOptions,
	) => Promise<core.ActionRequestContract>;
	waitResults: (
		context: LogContext,
		actionRequest: core.ActionRequestContract,
	) => Promise<ProducerResults>;
	getLastExecutionEvent: (
		context: LogContext,
		originator: string,
	) => Promise<queue.ExecuteContract | null>;
}
