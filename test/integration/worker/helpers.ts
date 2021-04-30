/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

// import { fromObject } from 'errio';
import { Worker } from '../../../lib/index';
import * as _ from 'lodash';
import * as errio from 'errio';
import CARDS from '../../../lib/cards';
import * as utils from '../utils';
import * as Bluebird from 'bluebird';
import { v4 as uuidv4 } from 'uuid';
import * as helpers from '../backend-helpers';
import {
	// 	SessionContract,
	UserContract,
} from '@balena/jellyfish-types/build/core';
import { core } from '@balena/jellyfish-types';
import {
	ActionPayload,
	QueueConsumer,
	QueueProducer,
} from '@balena/jellyfish-types/build/queue';
import * as queue from '@balena/jellyfish-queue';

const Consumer = queue.Consumer;
const Producer = queue.Producer;

export interface IntegrationCoreTestContext {
	session: string;
	actor: UserContract;
	queueActor: string;
	dequeue: (times?: number) => Promise<ActionPayload | null>;
	queue: {
		consumer: QueueConsumer;
		producer: QueueProducer;
	};
	jellyfish: core.JellyfishKernel;
	worker: InstanceType<typeof Worker>;
	flush: (session: string) => Promise<any>;
	processAction: (
		session: string,
		action: {
			action: string;
			context: any;
			card: string;
			type: string;
			arguments: any;
		},
	) => Promise<{ error: boolean; data: any }>;
}

export interface IntegrationTestContext
	extends helpers.BackendTestContext,
		IntegrationCoreTestContext {}

const before = async (context: any = {}, options: any = {}) => {
	await helpers.before(
		context,
		options && {
			suffix: options.suffix,
		},
	);

	context.allCards = utils.loadDefaultCards();
	context.actionLibrary = utils.loadActions();

	context.jellyfish = context.kernel;
	context.session = context.jellyfish.sessions.admin;

	const session = await context.jellyfish.getCardById(
		context.context,
		context.session,
		context.session,
	);
	context.actor = await context.jellyfish.getCardById(
		context.context,
		context.session,
		session.data.actor,
	);

	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards.message,
	);
	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards['role-user-community'],
	);
	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards['password-reset'],
	);
	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards['first-time-login'],
	);

	const actionCards = _.filter(context.allCards, (card) => {
		return card.slug.startsWith('action-');
	});

	_.forEach(actionCards, async (actionCard) => {
		await context.jellyfish.insertCard(
			context.context,
			context.session,
			actionCard,
		);
	});

	context.queue = {};
	context.queue.errors = queue.errors;

	context.queue.consumer = new Consumer(context.jellyfish, context.session);

	const consumedActionRequests: any[] = [];

	await context.queue.consumer.initializeWithEventHandler(
		context.context,
		(actionRequest: any) => {
			consumedActionRequests.push(actionRequest);
		},
	);

	context.queueActor = uuidv4();

	context.dequeue = async (times = 50) => {
		if (consumedActionRequests.length === 0) {
			if (times <= 0) {
				return null;
			}

			await Bluebird.delay(10);
			return context.dequeue(times - 1);
		}

		return consumedActionRequests.shift();
	};

	context.queue.producer = new Producer(context.jellyfish, context.session);

	await context.queue.producer.initialize(context.context);
	context.generateRandomSlug = utils.generateRandomSlug;
	context.generateRandomID = utils.generateRandomID;
};

const after = async (context: any) => {
	if (context.queue) {
		await context.queue.consumer.cancel();
	}

	if (context.jellyfish) {
		await helpers.after(context);
	}
};

export const jellyfish = {
	before: async (context: any = {}) => {
		await before(context);

		await context.jellyfish.insertCard(
			context.context,
			context.session,
			CARDS.update,
		);
		await context.jellyfish.insertCard(
			context.context,
			context.session,
			CARDS.create,
		);
		await context.jellyfish.insertCard(
			context.context,
			context.session,
			CARDS['triggered-action'],
		);

		return context;
	},

	after: (context: any) => {
		return after(context);
	},
};

export const worker = {
	before: async (context: any = {}, options: any = {}) => {
		await before(context, {
			suffix: options.suffix,
		});

		context.worker = new Worker(
			context.jellyfish,
			context.session,
			context.actionLibrary,
			context.queue.consumer,
			context.queue.producer,
		);
		await context.worker.initialize(context.context);

		context.flush = async (session: string) => {
			const request = await context.dequeue();

			if (!request) {
				throw new Error('No message dequeued');
			}

			const result = await context.worker.execute(session, request);

			if (result.error) {
				const Constructor =
					context.worker.errors[result.data.name] ||
					context.queue.errors[result.data.name] ||
					context.jellyfish.errors[result.data.name] ||
					Error;

				const error = new Constructor(result.data.message);
				error.stack = errio.fromObject(result.data).stack;
				throw error;
			}
		};

		context.processAction = async (session: string, action: any) => {
			const createRequest = await context.queue.producer.enqueue(
				context.worker.getId(),
				session,
				action,
			);
			await context.flush(session);
			return context.queue.producer.waitResults(context.context, createRequest);
		};

		return context;
	},
	after,
};
