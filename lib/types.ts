/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */
import { Kernel } from '@balena/jellyfish-core/build/kernel';
import { core, queue } from '@balena/jellyfish-types';
import {
	Contract,
	ContractData,
	ContractDefinition,
} from '@balena/jellyfish-types/build/core';
import { Operation } from 'fast-json-patch';
import * as errors from './errors';
import * as utils from './utils';

export interface WorkerContext {
	errors: typeof errors;
	defaults: Kernel['defaults'];
	sync: any;
	getEventSlug: typeof utils.getEventSlug;
	getCardById: (lsession: string, id: string) => Promise<Contract | null>;
	getCardBySlug: (lsession: string, slug: string) => Promise<Contract | null>;
	query: (
		lsession: string,
		schema: Parameters<Kernel['query']>[2],
		options: Parameters<Kernel['query']>[3],
	) => Promise<Contract[]>;
	privilegedSession: string;
	insertCard: (
		lsession: string,
		typeCard: core.TypeContract,
		options: {
			timestamp: any;
			reason: any;
			actor: any;
			originator?: any;
			attachEvents: any;
		},
		card: Partial<Contract>,
	) => Promise<Contract | null>;
	replaceCard: (
		lsession: string,
		typeCard: core.TypeContract,
		options: {
			timestamp: any;
			reason: any;
			actor: any;
			originator?: any;
			attachEvents: any;
		},
		card: Partial<Contract>,
	) => Promise<Contract | null>;
	patchCard: (
		lsession: string,
		typeCard: core.TypeContract,
		options: {
			timestamp: any;
			reason: any;
			actor: any;
			originator?: any;
			attachEvents: any;
		},
		card: Partial<Contract>,
		patch: Operation[],
	) => Promise<Contract | null>;
	cards: {
		[slug: string]: ContractDefinition<ContractData>;
	};
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
	api?: string;
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
