import { strict as assert } from 'assert';
import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import {
	ActionFile,
	Actions,
	CoreMixins,
	JellyfishPluginConstructor,
	PluginManager,
} from '@balena/jellyfish-plugin-base';
import type {
	Contract,
	LinkContract,
	SessionContract,
	UserContract,
} from '@balena/jellyfish-types/build/core';
import { testUtils as queueTestUtils } from '@balena/jellyfish-queue';
import _ from 'lodash';
import { CARDS as WorkerCards, Worker } from './index';

let ctx: TestContext;

/**
 * Context that can be used in tests against the worker.
 */
export interface TestContext extends queueTestUtils.TestContext {
	worker: Worker;
	adminUserId: string;
	actionLibrary: Actions;
	flush: (session: string) => Promise<null>;
	flushAll: (session: string) => Promise<void>;
	waitForMatch: <T extends Contract>(query: any, times?: number) => Promise<T>;
	processAction: (session: string, action: any) => Promise<any>;
	createEvent: (
		actor: string,
		session: string,
		target: Contract,
		body: string,
		type: 'message' | 'whisper',
	) => Promise<any>;
	createMessage: (
		actor: string,
		session: string,
		target: Contract,
		body: string,
	) => Promise<any>;
	createWhisper: (
		actor: string,
		session: string,
		target: Contract,
		body: string,
	) => Promise<any>;
	createUser: (
		username: string,
		hash?: string,
		roles?: string[],
	) => Promise<UserContract>;
	createSession: (user: UserContract) => Promise<SessionContract>;
	createLink: (
		actor: string,
		session: string,
		fromCard: Contract,
		toCard: Contract,
		verb: string,
		inverseVerb: string,
	) => Promise<LinkContract>;
	createSupportThread: (
		actor: string,
		session: string,
		name: string,
		data: any,
		markers?: string[],
	) => Promise<Contract>;
	createIssue: (
		actor: string,
		session: string,
		name: string,
		data: any,
		markers?: string[],
	) => Promise<Contract>;
	createContract: (
		actor: string,
		session: string,
		type: string,
		name: string,
		data: any,
		markers?: string[],
	) => Promise<Contract>;
}

/**
 * Options accepted by `newContext`.
 */
export interface NewContextOptions extends coreTestUtils.NewContextOptions {
	/**
	 * Set of plugins needed to run tests.
	 */
	plugins?: JellyfishPluginConstructor[];
	actions?: ActionFile[];
	mixins: CoreMixins;
}

/**
 * Create a new `TestContext` with an initialized worker.
 */
export const newContext = async (
	options: NewContextOptions,
): Promise<TestContext> => {
	const queueTestContext = await queueTestUtils.newContext(options);

	const adminSessionContract = (await queueTestContext.kernel.getCardById(
		queueTestContext.logContext,
		queueTestContext.session,
		queueTestContext.session,
	)) as SessionContract;
	assert(adminSessionContract);

	// Initialize plugins.
	const pluginManager = new PluginManager(ctx.logContext, {
		plugins: options.plugins || [],
	});

	// Prepare and insert all contracts, including those from plugins.
	const contracts = pluginManager.getCards(ctx.logContext, options.mixins);
	const actionLibrary = pluginManager.getActions(ctx.logContext);
	if (options.actions) {
		for (const action of options.actions) {
			Object.assign(actionLibrary, {
				[action.card.slug]: {
					handler: action.handler,
				},
			});
		}
	}
	const bootstrapContracts = [
		WorkerCards.create,
		WorkerCards.update,
		WorkerCards['triggered-action'],
		contracts['role-user-community'],
		contracts.message,
		// Make sure any loop contracts are initialized, as they can be a prerequisite
		..._.filter(contracts, (contract) => {
			return contract.slug.startsWith('loop-');
		}),
		..._.filter(contracts, (contract) => {
			return contract.slug.startsWith('action-');
		}),
	];

	// Any remaining contracts from plugins can now be added to the sequence
	const remainder = _.filter(contracts, (contract) => {
		return !_.find(bootstrapContracts, { slug: contract.slug });
	});
	for (const contract of remainder) {
		bootstrapContracts.push(contract);
	}
	for (const contract of bootstrapContracts) {
		await ctx.kernel.insertCard(ctx.logContext, ctx.session, contract);
	}

	// Initialize worker instance.
	const worker = new Worker(
		ctx.kernel,
		ctx.session,
		actionLibrary,
		ctx.queue.consumer,
		ctx.queue.producer,
	);
	await worker.initialize(ctx.logContext);

	const flush = async (session: string) => {
		const request = await queueTestContext.dequeue();
		if (!request) {
			throw new Error('No message dequeued');
		}

		const result = await worker.execute(session, request);
		throw new Error(result.data.message);
	};

	const waitForMatch = async <T extends Contract>(
		waitQuery: any,
		times = 20,
	): Promise<T> => {
		if (times === 0) {
			throw new Error('The wait query did not resolve');
		}
		const results = await ctx.kernel.query<T>(
			ctx.logContext,
			ctx.session,
			waitQuery,
		);
		if (results.length > 0) {
			return results[0];
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 500);
		});
		return waitForMatch<T>(waitQuery, times - 1);
	};

	const flushAll = async (session: string) => {
		try {
			while (true) {
				await flush(session);
			}
		} catch {
			// Once an error is thrown, there are no more requests to dequeue.
			return;
		}
	};

	const processAction = async (session: string, action: any) => {
		const createRequest = await ctx.queue.producer.enqueue(
			worker.getId(),
			session,
			action,
		);
		await flush(session);
		return ctx.queue.producer.waitResults(ctx.logContext, createRequest);
	};

	const createEvent = async (
		actor: string,
		session: string,
		target: Contract,
		body: string,
		type: 'message' | 'whisper',
	) => {
		const req = await ctx.queue.producer.enqueue(actor, session, {
			action: 'action-create-event@1.0.0',
			logContext: ctx.logContext,
			card: target.id,
			type: target.type,
			arguments: {
				type,
				payload: {
					message: body,
				},
			},
		});

		await flushAll(session);
		const result: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			req,
		);
		expect(result.error).toBe(false);
		assert(result.data);
		await flushAll(session);
		const contract = (await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			result.data.id,
		)) as Contract;
		assert(contract);

		return contract;
	};

	const createMessage = (
		actor: string,
		session: string,
		target: Contract,
		body: string,
	) => {
		return createEvent(actor, session, target, body, 'message');
	};

	const createWhisper = (
		actor: string,
		session: string,
		target: Contract,
		body: string,
	) => {
		return createEvent(actor, session, target, body, 'whisper');
	};

	const createUser = async (
		username: string,
		hash = 'foobar',
		roles = ['user-community'],
	) => {
		// Create the user, only if it doesn't exist yet
		const userContract =
			((await ctx.kernel.getCardBySlug(
				ctx.logContext,
				ctx.session,
				`user-${username}@latest`,
			)) as UserContract) ||
			(await ctx.kernel.insertCard<UserContract>(ctx.logContext, ctx.session, {
				type: 'user@1.0.0',
				slug: `user-${username}`,
				data: {
					email: `${username}@example.com`,
					hash,
					roles,
				},
			}));
		assert(userContract);

		return userContract;
	};

	const createLink = async (
		actor: string,
		session: string,
		fromCard: Contract,
		toCard: Contract,
		verb: string,
		inverseVerb: string,
	) => {
		const inserted = await ctx.worker.insertCard(
			ctx.logContext,
			session,
			ctx.worker.typeContracts['link@1.0.0'],
			{
				attachEvents: true,
				actor,
			},
			{
				slug: `link-${fromCard.id}-${verb.replace(/\s/g, '-')}-${
					toCard.id
				}-${coreTestUtils.generateRandomId()}`,
				tags: [],
				version: '1.0.0',
				links: {},
				requires: [],
				capabilities: [],
				active: true,
				name: verb,
				data: {
					inverseName: inverseVerb,
					from: {
						id: fromCard.id,
						type: fromCard.type,
					},
					to: {
						id: toCard.id,
						type: toCard.type,
					},
				},
			},
		);
		assert(inserted);
		await flushAll(session);

		const link = await ctx.kernel.getCardById<LinkContract>(
			ctx.logContext,
			ctx.session,
			inserted.id,
		);
		assert(link);
		return link;
	};

	const createSupportThread = async (
		actor: string,
		session: string,
		name: string,
		data: any,
		markers = [],
	) => {
		const contract = await createContract(
			actor,
			session,
			'support-thread@1.0.0',
			name,
			data,
			markers,
		);
		return contract;
	};

	const createIssue = async (
		actor: string,
		session: string,
		name: string,
		data: any,
		markers = [],
	) => {
		const contract = await createContract(
			actor,
			session,
			'issue@1.0.0',
			name,
			data,
			markers,
		);
		return contract;
	};

	const createContract = async (
		actor: string,
		session: string,
		type: string,
		name: string,
		data: any,
		markers = [],
	) => {
		const inserted = await ctx.worker.insertCard(
			ctx.logContext,
			session,
			ctx.worker.typeContracts[type],
			{
				attachEvents: true,
				actor,
			},
			{
				name,
				slug: coreTestUtils.generateRandomSlug({
					prefix: type.split('@')[0],
				}),
				version: '1.0.0',
				markers,
				data,
			},
		);
		assert(inserted);
		await flushAll(session);

		const contract = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			inserted.id,
		);
		assert(contract);
		return contract;
	};

	const createSession = async (user: UserContract) => {
		// Force login, even if we don't know the password
		const sessionContract = await ctx.kernel.insertCard<SessionContract>(
			ctx.logContext,
			ctx.session,
			{
				slug: `session-${
					user.slug
				}-integration-tests-${coreTestUtils.generateRandomId()}`,
				type: 'session@1.0.0',
				data: {
					actor: user.id,
				},
			},
		);
		assert(sessionContract);

		return sessionContract;
	};

	return {
		adminUserId: adminSessionContract.data.actor,
		actionLibrary,
		flush,
		waitForMatch,
		flushAll,
		processAction,
		createEvent,
		createMessage,
		createWhisper,
		createUser,
		createSession,
		createLink,
		createSupportThread,
		createIssue,
		createContract,
		worker,
		...queueTestContext,
	};
};

/**
 * Deinitialize the queue.
 */
export const destroyContext = async (context: TestContext) => {
	await queueTestUtils.destroyContext(context);
};
