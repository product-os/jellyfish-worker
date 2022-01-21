import { strict as assert } from 'assert';
import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import { testUtils as queueTestUtils } from '@balena/jellyfish-queue';
import type {
	Contract,
	ContractDefinition,
	LinkContract,
	SessionContract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { ExecuteContract } from '@balena/jellyfish-types/build/queue';
import * as Combinatorics from 'js-combinatorics/commonjs/combinatorics';
import _ from 'lodash';
import nock from 'nock';
import path from 'path';
import { ActionDefinition, PluginDefinition, PluginManager } from './plugin';
import { Sync } from './sync';
import { Action, Map } from './types';
import { CARDS, Worker } from '.';

/**
 * Context that can be used in tests against the worker.
 */
export interface TestContext extends queueTestUtils.TestContext {
	worker: Worker;
	adminUserId: string;
	actionLibrary: Map<Action>;
	flush: (session: string) => Promise<void>;
	flushAll: (session: string) => Promise<void>;
	waitForMatch: <T extends Contract>(query: any, times?: number) => Promise<T>;
	processAction: (session: string, action: any) => Promise<any>;
	createEvent: (
		actor: string,
		session: string,
		target: Contract,
		body: string,
		type: string,
	) => Promise<any>;
	createLink: (
		actor: string,
		session: string,
		fromCard: Contract,
		toCard: Contract,
		verb: string,
		inverseVerb: string,
	) => Promise<LinkContract>;
	createContract: (
		actor: string,
		session: string,
		type: string,
		name: string | null,
		data: any,
		markers?: any,
	) => Promise<Contract>;
}

/**
 * Options accepted by `newContext`.
 */
export interface NewContextOptions extends coreTestUtils.NewContextOptions {
	/**
	 * Set of plugins needed to run tests.
	 */
	plugins?: PluginDefinition[];
	actions?: ActionDefinition[];
}

/**
 * Create a new `TestContext` with an initialized worker.
 */
export const newContext = async (
	options: NewContextOptions = {},
): Promise<TestContext> => {
	const queueTestContext = await queueTestUtils.newContext(options);

	const adminSessionContract = (await queueTestContext.kernel.getContractById(
		queueTestContext.logContext,
		queueTestContext.session,
		queueTestContext.session,
	)) as SessionContract;
	assert(adminSessionContract);

	// Initialize plugins.
	const pluginManager = new PluginManager(options.plugins || []);

	// Prepare and insert all contracts, including those from plugins.
	const contracts = pluginManager.getCards();
	const actionLibrary = pluginManager.getActions();
	const bootstrapContracts: ContractDefinition[] = [
		CARDS.create,
		CARDS.update,
		CARDS['triggered-action'],
	];

	// Make sure any loop contracts are initialized, as they can be a prerequisite
	Object.keys(contracts).forEach((slug: string) => {
		if (slug.startsWith('loop-') || slug.startsWith('action-')) {
			bootstrapContracts.push(contracts[slug]);
		}
	});

	// Add passed in actions
	if (options.actions) {
		for (const action of options.actions) {
			Object.assign(actionLibrary, {
				[action.contract.slug]: {
					handler: action.handler,
				},
			});
			await queueTestContext.kernel.insertContract(
				queueTestContext.logContext,
				queueTestContext.session,
				action.contract,
			);
		}
	}

	// Any remaining contracts from plugins can now be added to the sequence
	const remainder = _.filter(contracts, (contract: Contract) => {
		return !_.find(bootstrapContracts, { slug: contract.slug });
	});
	for (const contract of remainder) {
		bootstrapContracts.push(contract);
	}
	for (const contract of bootstrapContracts) {
		await queueTestContext.kernel.insertContract(
			queueTestContext.logContext,
			queueTestContext.session,
			contract,
		);
	}

	// Initialize sync.
	const sync = new Sync({
		integrations: pluginManager.getSyncIntegrations(),
	});

	// Initialize worker instance.
	const worker = new Worker(
		queueTestContext.kernel,
		queueTestContext.session,
		actionLibrary,
		queueTestContext.queue.consumer,
		queueTestContext.queue.producer,
	);
	await worker.initialize(queueTestContext.logContext, sync);

	const types = await queueTestContext.kernel.query<TypeContract>(
		queueTestContext.logContext,
		worker.session,
		{
			type: 'object',
			properties: {
				type: {
					const: 'type@1.0.0',
				},
			},
		},
	);
	worker.setTypeContracts(queueTestContext.logContext, types);

	// Update type cards through the worker for generated triggers, etc
	for (const contract of types) {
		await worker.replaceCard(
			queueTestContext.logContext,
			worker.session,
			worker.typeContracts['type@1.0.0'],
			{
				attachEvents: false,
			},
			contract,
		);
	}

	const triggers = await queueTestContext.kernel.query<TypeContract>(
		queueTestContext.logContext,
		worker.session,
		{
			type: 'object',
			properties: {
				type: {
					const: 'triggered-action@1.0.0',
				},
			},
		},
	);
	worker.setTriggers(queueTestContext.logContext, triggers);

	const flush = async (session: string) => {
		const request = await queueTestContext.dequeue();
		if (!request) {
			throw new Error('No message dequeued');
		}

		const result = await worker.execute(session, request);
		if (result.error) {
			throw new Error(result.data.message);
		}
	};

	const waitForMatch = async <T extends Contract>(
		waitQuery: any,
		times = 20,
	): Promise<T> => {
		if (times === 0) {
			throw new Error('The wait query did not resolve');
		}
		const results = await queueTestContext.kernel.query<T>(
			queueTestContext.logContext,
			queueTestContext.session,
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
		const createRequest = await queueTestContext.queue.producer.enqueue(
			worker.getId(),
			session,
			action,
		);
		await flush(session);
		return queueTestContext.queue.producer.waitResults(
			queueTestContext.logContext,
			createRequest,
		);
	};

	const createEvent = async (
		actor: string,
		session: string,
		target: Contract,
		body: string,
		type: string,
	) => {
		const req = await queueTestContext.queue.producer.enqueue(actor, session, {
			action: 'action-create-event@1.0.0',
			logContext: queueTestContext.logContext,
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
		const result: any = await queueTestContext.queue.producer.waitResults(
			queueTestContext.logContext,
			req,
		);
		expect(result.error).toBe(false);
		assert(result.data);
		await flushAll(session);
		const contract = (await queueTestContext.kernel.getContractById(
			queueTestContext.logContext,
			queueTestContext.session,
			result.data.id,
		)) as Contract;
		assert(contract);

		return contract;
	};

	const createLink = async (
		actor: string,
		session: string,
		fromCard: Contract,
		toCard: Contract,
		verb: string,
		inverseVerb: string,
	) => {
		const inserted = await worker.insertCard(
			queueTestContext.logContext,
			session,
			worker.typeContracts['link@1.0.0'],
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

		const link = await queueTestContext.kernel.getContractById<LinkContract>(
			queueTestContext.logContext,
			queueTestContext.session,
			inserted.id,
		);
		assert(link);
		return link;
	};

	const createContract = async (
		actor: string,
		session: string,
		type: string,
		name: string | null,
		data: any,
		markers = [],
	) => {
		const inserted = await worker.insertCard(
			queueTestContext.logContext,
			session,
			worker.typeContracts[type],
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

		const contract = await queueTestContext.kernel.getContractById(
			queueTestContext.logContext,
			queueTestContext.session,
			inserted.id,
		);
		assert(contract);
		return contract;
	};

	return {
		adminUserId: adminSessionContract.data.actor,
		actionLibrary,
		flush,
		waitForMatch,
		flushAll,
		processAction,
		createEvent,
		createLink,
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

// =============== TRANSLATE SCENARIO RUNNER

interface Variation {
	name: string;
	combination: any[];
}

class PermutationCombination {
	public seed: string[];

	constructor(seed: string[]) {
		this.seed = [...seed];
	}

	[Symbol.iterator]() {
		return (function* (it) {
			for (let index = 1, l = it.length; index <= l; index++) {
				yield* new Combinatorics.Permutation(it, index);
			}
		})(this.seed);
	}
}

export const tailSort = [
	(card: Contract) => {
		return card.data.timestamp;
	},
	(card: Contract) => {
		return card.type;
	},
];

/**
 * @summary Get the different variations for a given sequence
 * @function
 *
 * @param sequence
 * @param options
 * @returns
 */
export function getVariations(sequence: any, options: any): Variation[] {
	const invariant = _.last(sequence);
	return (
		Array.from(new PermutationCombination(sequence))
			.filter((combination) => {
				return _.includes(combination, invariant);
			})

			// Only consider the ones that preserve ordering for now
			.filter((combination) => {
				if (options.permutations) {
					return true;
				}

				return _.isEqual(
					combination,
					_.clone(combination).sort((left: any, right: any) => {
						return (
							_.findIndex(sequence, (element) => {
								return _.isEqual(element, left);
							}) -
							_.findIndex(sequence, (element) => {
								return _.isEqual(element, right);
							})
						);
					}),
				);
			})

			.map((combination) => {
				return {
					name: combination
						.map((element: any) => {
							return sequence.indexOf(element) + 1;
						})
						.join('-'),
					combination,
				};
			})
	);
}

/**
 * @summary Dynamically require stub path
 * @function
 *
 * @param basePath - require base path
 * @param offset - offset from base path
 * @param name - file name
 * @returns required file contents
 */
function requireStub(basePath: string, offset: any, name: string): any {
	if (offset === 0) {
		console.warn(
			'Stub not found (possibly to simulate a 404):',
			`\n\tName: ${name}`,
			`\n\tBase Path: ${basePath}`,
		);
		return null;
	}

	const stubPath = path.join(basePath, `${offset}`, `${name}.json`);
	try {
		return require(stubPath);
	} catch (error: any) {
		if (error.code === 'MODULE_NOT_FOUND') {
			return requireStub(basePath, offset - 1, name);
		}

		throw error;
	}
}

/**
 * @summary Save a clean copy of cards table to restore later
 * @function
 *
 * @param context - test context
 */
async function save(context: TestContext) {
	await context.pool.query('CREATE TABLE cards_copy AS TABLE cards');
	await context.pool.query('CREATE TABLE links2_copy AS TABLE links2');
}

/**
 * @summary Restore the cards table to a clean state
 * @function
 *
 * @param context - test context
 */
async function restore(context: TestContext) {
	await context.kernel.reset(context.logContext);
	await context.pool.query('INSERT INTO cards SELECT * FROM cards_copy');
	await context.pool.query('INSERT INTO links2 SELECT * FROM links2_copy');
}

/**
 * @summary Tasks to be executed before all translate tests
 * @function
 *
 * @param context - test context
 */
export async function translateBeforeAll(context: TestContext) {
	nock.disableNetConnect();
	nock.cleanAll();
	await save(context);
}

/**
 * @summary Tasks to be executed after each translate test
 * @function
 *
 * @param context - test context
 */
export async function translateAfterEach(context: TestContext) {
	nock.cleanAll();
	await restore(context);
}

/**
 * Simulate a webhook against a nocked endpoint and check
 * translate results against expected values.
 *
 * @param context - test context
 * @param testCase
 * @param integration
 * @param stub
 */
export async function webhookScenario(
	context: TestContext,
	testCase: any,
	integration: any,
	stub: any,
): Promise<void> {
	let webhookOffset = testCase.offset;

	nock(stub.baseUrl)
		.persist()
		.get(stub.uriPath)
		.query(true)
		.reply(function (uri: string, _request: any, callback: any) {
			if (!stub.isAuthorized(this.req)) {
				return callback(null, [401, this.req.headers]);
			}

			// Omit query parameters that start with "api" as
			// they contain secrets.
			const [baseUri, queryParams] = uri.split('?');
			const queryString = (queryParams || '')
				.split('&')
				.reduce((accumulator, part) => {
					const [key, value] = part.split('=');
					if (key.startsWith('api')) {
						return accumulator;
					}

					return [accumulator, key, value].join('-');
				}, '');

			const jsonPath = _.kebabCase(`${baseUri}-${queryString}`);
			const content = requireStub(
				path.join(stub.basePath, testCase.name, 'stubs'),
				webhookOffset,
				jsonPath,
			);
			const code = content ? 200 : 404;
			return callback(null, [code, content]);
		});

	const cards: any[] = [];
	for (const step of testCase.steps) {
		webhookOffset = Math.max(
			webhookOffset,
			_.findIndex(testCase.original, step) + 1,
		);

		const data = {
			source: integration.source,
			headers: step.headers,
			payload: step.payload,
		};

		const event = await context.kernel.insertContract(
			context.logContext,
			context.session,
			{
				type: 'external-event@1.0.0',
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'external-event',
				}),
				version: '1.0.0',
				data: await testCase.prepareEvent(data),
			},
		);

		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				logContext: context.logContext,
				action: 'action-integration-import-event@1.0.0',
				card: event.id,
				type: event.type,
				arguments: {},
			},
		);

		await context.flushAll(context.session);
		const result = await context.queue.producer.waitResults(
			context.logContext,
			request,
		);
		assert.ok(result.error === false);
		cards.push(...(result.data as ExecuteContract[]));
	}

	if (!testCase.expected.head) {
		assert.equal(cards.length, 0);
		return;
	}
	assert.ok(cards.length > 0);

	const head = await context.kernel.getContractById(
		context.logContext,
		context.session,
		cards[testCase.headIndex].id,
	);
	assert(head);

	// TODO: Remove once we fully support versioned
	// slug references in the sync module.
	if (!head.type.includes('@')) {
		head.type = `${head.type}@1.0.0`;
	}

	deleteExtraLinks(testCase.expected.head, head);
	Reflect.deleteProperty(head, 'markers');
	Reflect.deleteProperty(head.data, 'origin');
	Reflect.deleteProperty(head.data, 'translateDate');

	const timeline = await context.kernel.query(
		context.logContext,
		context.session,
		{
			type: 'object',
			additionalProperties: true,
			required: ['data'],
			properties: {
				data: {
					type: 'object',
					required: ['target'],
					additionalProperties: true,
					properties: {
						target: {
							type: 'string',
							const: head.id,
						},
					},
				},
			},
		},
		{
			sortBy: ['data', 'timestamp'],
		},
	);

	testCase.expected.head.slug = testCase.expected.head.slug || head.slug;

	let expectedHead = Object.assign(
		{},
		testCase.expected.head,
		_.pick(head, ['id', 'created_at', 'updated_at', 'linked_at']),
	);

	// Pick and merge any other fields explicitly marked to ignore
	// This should be used rarely, usually for unpredictable evaluated field values
	const headType = head.type.split('@')[0];
	if (integration.options?.head?.ignore[headType]) {
		expectedHead = _.merge(
			expectedHead,
			_.pick(head, integration.options.head.ignore[headType]),
		);
	}
	assert.deepEqual(head, expectedHead);

	const tailFilter = (card: any) => {
		const baseType = card.type.split('@')[0];
		if (testCase.ignoreUpdateEvents && baseType === 'update') {
			return false;
		}

		if (baseType === 'message' || baseType === 'whisper') {
			if (!card.active && card.data.payload.message.trim().length === 0) {
				return false;
			}
		}

		return true;
	};

	const actualTail = await Promise.all(
		_.sortBy(_.filter(timeline, tailFilter), tailSort).map(
			async (card: any) => {
				Reflect.deleteProperty(card, 'slug');
				Reflect.deleteProperty(card, 'links');
				Reflect.deleteProperty(card, 'markers');
				Reflect.deleteProperty(card, 'created_at');
				Reflect.deleteProperty(card, 'updated_at');
				Reflect.deleteProperty(card, 'linked_at');
				Reflect.deleteProperty(card.data, 'origin');
				Reflect.deleteProperty(card.data, 'translateDate');
				Reflect.deleteProperty(card.data, 'edited_at');

				// TODO: Remove once we fully support versioned
				// slug references in the sync module.
				if (!card.type.includes('@')) {
					card.type = `${card.type}@1.0.0`;
				}

				const actorCard = await context.kernel.getContractById(
					context.logContext,
					context.session,
					card.data.actor,
				);
				card.data.actor = actorCard
					? {
							slug: actorCard.slug,
							active: actorCard.active,
					  }
					: card.data.actor;

				if (card.type.split('@')[0] === 'update') {
					card.data.payload = card.data.payload.filter((operation: any) => {
						return ![
							'/data/origin',
							'/linked_at/has attached element',
						].includes(operation.path);
					});

					if (card.data.payload.length === 0) {
						return null;
					}
				} else if (card.data.payload) {
					Reflect.deleteProperty(card.data.payload, 'slug');
					Reflect.deleteProperty(card.data.payload, 'links');
					Reflect.deleteProperty(card.data.payload, 'markers');
					Reflect.deleteProperty(card.data.payload, 'created_at');
					Reflect.deleteProperty(card.data.payload, 'updated_at');
					Reflect.deleteProperty(card.data.payload, 'linked_at');

					if (card.data.payload.data) {
						Reflect.deleteProperty(card.data.payload.data, 'origin');
						Reflect.deleteProperty(card.data.payload.data, 'translateDate');
					}

					// TODO: Remove once we fully support versioned
					// slug references in the sync module.
					if (card.data.payload.type && !card.data.payload.type.includes('@')) {
						card.data.payload.type = `${card.data.payload.type}@1.0.0`;
					}
				}

				return card;
			},
		),
	);

	const expectedTail = _.map(
		_.sortBy(_.filter(testCase.expected.tail, tailFilter), tailSort),
		(card, index) => {
			card.id = _.get(actualTail, [index, 'id']);
			card.name = _.get(actualTail, [index, 'name']);

			card.data.target = head.id;

			// If we have to ignore the update events, then we can't also
			// trust the create event to be what it should have been at
			// the beginning, as services might not preserve that information.
			if (testCase.ignoreUpdateEvents && card.type.split('@')[0] === 'create') {
				card.data.payload = _.get(actualTail, [index, 'data', 'payload']);
				card.data.timestamp = _.get(actualTail, [index, 'data', 'timestamp']);
			}

			return card;
		},
	);

	assert.deepEqual(_.compact(actualTail), expectedTail);
}

/**
 * @summary Delete unnecessary links
 * @function
 *
 * @param expected
 * @param result
 */
function deleteExtraLinks(expected: any, result: any) {
	// If links is not present in expected we just remove the whole thing
	if (!expected.links) {
		Reflect.deleteProperty(result, 'links');
	}

	// Otherwise we recursively remove all relationships and links inside them
	// where the relationship does not match the relationship specified in expected
	const objDifference = getObjDifference(expected.links, result.links);

	_.each(objDifference, (rel) => {
		Reflect.deleteProperty(result.links, rel);
	});

	_.each(result.links, (links, relationship) => {
		_.each(links, (_link, index) => {
			const linkDiff = getObjDifference(
				expected.links[relationship][index],
				result.links[relationship][index],
			);
			_.each(linkDiff, (rel) => {
				Reflect.deleteProperty(result.links[relationship][index], rel);
			});
		});
	});
}

/**
 * @summary Get difference between two objects
 * @function
 *
 * @param expected - expected object
 * @param obtained - obtained object
 * @returns difference between the two provided objects
 */
function getObjDifference(expected: any, obtained: any): string[] {
	const expectedKeys = _.keys(expected);
	const obtainedKeys = _.keys(obtained);
	return _.difference(obtainedKeys, expectedKeys);
}
