import type {
	Contract,
	LinkContract,
	SessionContract,
} from '@balena/jellyfish-types/build/core';
import { ExecuteContract } from '@balena/jellyfish-types/build/queue';
import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import permutations from 'just-permutations';
import _ from 'lodash';
import nock from 'nock';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { Worker } from '.';
import { ActionDefinition, PluginDefinition, PluginManager } from './plugin';
import type { ActionRequestContract } from './queue/types';
import { Action, Map } from './types';

/**
 * Context that can be used in tests against the worker.
 */
export interface TestContext extends autumndbTestUtils.TestContext {
	actor: string;
	dequeue: (times?: number) => Promise<ActionRequestContract | null>;
	worker: Worker;
	adminUserId: string;
	actionLibrary: Map<Action>;
	flush: (session: string) => Promise<void>;
	flushAll: (session: string) => Promise<void>;
	waitForMatch: <T extends Contract>(query: any, times?: number) => Promise<T>;
	processAction: (session: string, action: any) => Promise<any>;
	retry: (
		fn: any,
		checkResult: any,
		times?: number,
		delay?: number,
	) => Promise<any>;
	createEvent: (
		actor: string,
		session: string,
		target: Contract,
		body: string,
		type: string,
	) => Promise<any>;
	createLinkThroughWorker: (
		actor: string,
		session: string,
		fromContract: Contract,
		toContract: Contract,
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
export interface NewContextOptions extends autumndbTestUtils.NewContextOptions {
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
	const autumndbTestContext = await autumndbTestUtils.newContext(options);

	const consumedActionRequests: ActionRequestContract[] = [];
	const dequeue = async (
		times: number = 50,
	): Promise<ActionRequestContract | null> => {
		for (let i = 0; i < times; i++) {
			if (consumedActionRequests.length > 0) {
				return consumedActionRequests.shift()!;
			}

			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
		}

		return null;
	};

	const adminSessionContract =
		(await autumndbTestContext.kernel.getContractById(
			autumndbTestContext.logContext,
			autumndbTestContext.session,
			autumndbTestContext.session,
		)) as SessionContract;
	assert(adminSessionContract);

	// Initialize plugins.
	const pluginManager = new PluginManager(options.plugins || []);

	// Prepare and insert all contracts, including those from plugins.
	const actionLibrary = pluginManager.getActions();

	// Initialize worker instance.
	const worker = new Worker(
		autumndbTestContext.kernel,
		autumndbTestContext.session,
		autumndbTestContext.pool,
		options.plugins || [],
	);
	await worker.initialize(
		autumndbTestContext.logContext,
		async (payload: ActionRequestContract) => {
			consumedActionRequests.push(payload);
		},
	);

	const flush = async (session: string) => {
		const request = await dequeue();
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
		const results = await autumndbTestContext.kernel.query<T>(
			autumndbTestContext.logContext,
			autumndbTestContext.session,
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

	const processAction = async (
		session: string,
		action: ActionRequestContract,
	) => {
		const createRequest = await worker.insertCard(
			autumndbTestContext.logContext,
			worker.session,
			worker.typeContracts['action-request@1.0.0'],
			{
				actor: action.data.actor,
				timestamp: new Date().toISOString(),
			},
			action,
		);
		assert(createRequest);
		await flush(session);
		return worker.producer.waitResults(
			autumndbTestContext.logContext,
			createRequest as ActionRequestContract,
		);
	};

	const retry = async (fn: any, checkResult: any, times = 10, delay = 500) => {
		const result = await fn();
		if (!checkResult(result)) {
			if (times > 0) {
				await new Promise((resolve) => {
					setTimeout(resolve, delay);
				});
				return retry(fn, checkResult, times - 1);
			}
			throw new Error('Ran out of retry attempts');
		}
		return result;
	};

	const createEvent = async (
		actor: string,
		session: string,
		target: Contract,
		body: string,
		type: string,
	) => {
		const date = new Date();
		const req = await worker.insertCard(
			autumndbTestContext.logContext,
			autumndbTestContext.kernel.adminSession()!,
			worker.typeContracts['action-request@1.0.0'],
			{
				actor,
				timestamp: new Date().toISOString(),
				attachEvents: true,
			},
			{
				data: {
					actor,
					context: autumndbTestContext.logContext,
					action: 'action-create-event@1.0.0',
					card: target.id,
					type: target.type,
					epoch: date.valueOf(),
					timestamp: date.toISOString(),
					input: {
						id: target.id,
					},
					arguments: {
						type,
						payload: {
							message: body,
						},
					},
				},
			},
		);
		assert(req);

		await flushAll(session);
		const result: any = await worker.producer.waitResults(
			autumndbTestContext.logContext,
			req as ActionRequestContract,
		);
		expect(result.error).toBe(false);
		assert(result.data);
		await flushAll(session);
		const contract = (await autumndbTestContext.kernel.getContractById(
			autumndbTestContext.logContext,
			autumndbTestContext.session,
			result.data.id,
		)) as Contract;
		assert(contract);

		return contract;
	};

	const createLinkThroughWorker = async (
		actor: string,
		session: string,
		fromContract: Contract,
		toContract: Contract,
		verb: string,
		inverseVerb: string,
	) => {
		const inserted = await worker.insertCard(
			autumndbTestContext.logContext,
			session,
			worker.typeContracts['link@1.0.0'],
			{
				attachEvents: true,
				actor,
			},
			{
				slug: `link-${fromContract.id}-${verb.replace(/\s/g, '-')}-${
					toContract.id
				}-${autumndbTestUtils.generateRandomId()}`,
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
						id: fromContract.id,
						type: fromContract.type,
					},
					to: {
						id: toContract.id,
						type: toContract.type,
					},
				},
			},
		);
		assert(inserted);
		await flushAll(session);

		const link = await autumndbTestContext.kernel.getContractById<LinkContract>(
			autumndbTestContext.logContext,
			autumndbTestContext.session,
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
			autumndbTestContext.logContext,
			session,
			worker.typeContracts[type],
			{
				attachEvents: true,
				actor,
			},
			{
				name,
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: type.split('@')[0],
				}),
				version: '1.0.0',
				markers,
				data,
			},
		);
		assert(inserted);
		await flushAll(session);

		const contract = await autumndbTestContext.kernel.getContractById(
			autumndbTestContext.logContext,
			autumndbTestContext.session,
			inserted.id,
		);
		assert(contract);
		return contract;
	};

	return {
		actor: uuid(),
		dequeue,
		adminUserId: adminSessionContract.data.actor,
		actionLibrary,
		flush,
		waitForMatch,
		flushAll,
		processAction,
		retry,
		createEvent,
		createLinkThroughWorker,
		createContract,
		worker,
		...autumndbTestContext,
	};
};

/**
 * Deinitialize the worker.
 */
export const destroyContext = async (context: TestContext) => {
	await context.worker.consumer.cancel();
	context.worker.contractsStream.removeAllListeners();
	context.worker.contractsStream.close();
	await autumndbTestUtils.destroyContext(context);
};

interface Variation {
	name: string;
	combination: any[];
}

export const tailSort = [
	(contract: Contract) => {
		return contract.data.timestamp;
	},
	(contract: Contract) => {
		return contract.type;
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
		permutations(sequence)
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
 * @summary Tasks to be executed after all translate tests
 * @function
 */
export function translateAfterAll() {
	nock.enableNetConnect();
}

/**
 * Simulate a webhook against a nocked endpoint and check
 * translate results against expected values.
 *
 * @param context - test context
 * @param testCase - test case
 * @param options - test options
 */
export async function webhookScenario(
	context: TestContext,
	testCase: {
		steps: any[];
		prepareEvent: (event: any) => Promise<any>;
		offset: number;
		headIndex: number;
		original: any[];
		ignoreUpdateEvents: boolean;
		expected: any;
		name: string;
		variant: string;
	},
	options: {
		source: string;
		baseUrl: string | RegExp;
		uriPath: RegExp;
		basePath: string;
		isAuthorized: (request: any) => any;
		head?: {
			ignore: {
				[key: string]: string[];
			};
		};
	},
): Promise<void> {
	let webhookOffset = testCase.offset;

	nock(options.baseUrl)
		.persist()
		.get(options.uriPath)
		.query(true)
		.reply(function (uri: string, _request: any, callback: any) {
			if (!options.isAuthorized(this.req)) {
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
				path.join(options.basePath, testCase.name, 'stubs'),
				webhookOffset,
				jsonPath,
			);
			const code = content ? 200 : 404;
			return callback(null, [code, content]);
		});

	const contracts: any[] = [];
	for (const step of testCase.steps) {
		webhookOffset = Math.max(
			webhookOffset,
			_.findIndex(testCase.original, step) + 1,
		);

		const data = {
			source: options.source,
			headers: step.headers,
			payload: step.payload,
		};

		const event = await context.kernel.insertContract(
			context.logContext,
			context.session,
			{
				type: 'external-event@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'external-event',
				}),
				version: '1.0.0',
				data: await testCase.prepareEvent(data),
			},
		);

		const request = await context.worker.insertCard(
			context.logContext,
			context.session,
			context.worker.typeContracts['action-request@1.0.0'],
			{
				actor: context.adminUserId,
				timestamp: new Date().toISOString(),
			},
			{
				data: {
					context: context.logContext,
					action: 'action-integration-import-event@1.0.0',
					card: event.id,
					type: event.type,
					actor: context.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: event.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {},
				},
			},
		);

		await context.flush(context.session);
		const result = await context.worker.producer.waitResults(
			context.logContext,
			request as ActionRequestContract,
		);
		assert.ok(result.error === false);
		contracts.push(...(result.data as ExecuteContract[]));
	}

	if (!testCase.expected.head) {
		assert.equal(contracts.length, 0);
		return;
	}
	assert.ok(contracts.length > 0);

	const head = await context.kernel.getContractById(
		context.logContext,
		context.session,
		contracts[testCase.headIndex].id,
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
	if (options.head?.ignore[headType]) {
		expectedHead = _.merge(
			expectedHead,
			_.pick(head, options.head.ignore[headType]),
		);
	}
	assert.deepEqual(head, expectedHead);

	const tailFilter = (contract: any) => {
		const baseType = contract.type.split('@')[0];
		if (testCase.ignoreUpdateEvents && baseType === 'update') {
			return false;
		}

		if (baseType === 'message' || baseType === 'whisper') {
			if (
				!contract.active &&
				contract.data.payload.message.trim().length === 0
			) {
				return false;
			}
		}

		return true;
	};

	const actualTail = await Promise.all(
		_.sortBy(_.filter(timeline, tailFilter), tailSort).map(
			async (contract: any) => {
				Reflect.deleteProperty(contract, 'slug');
				Reflect.deleteProperty(contract, 'links');
				Reflect.deleteProperty(contract, 'markers');
				Reflect.deleteProperty(contract, 'created_at');
				Reflect.deleteProperty(contract, 'updated_at');
				Reflect.deleteProperty(contract, 'linked_at');
				Reflect.deleteProperty(contract.data, 'origin');
				Reflect.deleteProperty(contract.data, 'translateDate');
				Reflect.deleteProperty(contract.data, 'edited_at');

				// TODO: Remove once we fully support versioned
				// slug references in the sync module.
				if (!contract.type.includes('@')) {
					contract.type = `${contract.type}@1.0.0`;
				}

				const actorContract = await context.kernel.getContractById(
					context.logContext,
					context.session,
					contract.data.actor,
				);
				contract.data.actor = actorContract
					? {
							slug: actorContract.slug,
							active: actorContract.active,
					  }
					: contract.data.actor;

				if (contract.type.split('@')[0] === 'update') {
					contract.data.payload = contract.data.payload.filter(
						(operation: any) => {
							return ![
								'/data/origin',
								'/linked_at/has attached element',
							].includes(operation.path);
						},
					);

					if (contract.data.payload.length === 0) {
						return null;
					}
				} else if (contract.data.payload) {
					Reflect.deleteProperty(contract.data.payload, 'slug');
					Reflect.deleteProperty(contract.data.payload, 'links');
					Reflect.deleteProperty(contract.data.payload, 'markers');
					Reflect.deleteProperty(contract.data.payload, 'created_at');
					Reflect.deleteProperty(contract.data.payload, 'updated_at');
					Reflect.deleteProperty(contract.data.payload, 'linked_at');

					if (contract.data.payload.data) {
						Reflect.deleteProperty(contract.data.payload.data, 'origin');
						Reflect.deleteProperty(contract.data.payload.data, 'translateDate');
					}

					// TODO: Remove once we fully support versioned
					// slug references in the sync module.
					if (
						contract.data.payload.type &&
						!contract.data.payload.type.includes('@')
					) {
						contract.data.payload.type = `${contract.data.payload.type}@1.0.0`;
					}
				}

				return contract;
			},
		),
	);

	const expectedTail = _.map(
		_.sortBy(_.filter(testCase.expected.tail, tailFilter), tailSort),
		(contract: Contract, index) => {
			contract.id = _.get(actualTail, [index, 'id']);
			contract.name = _.get(actualTail, [index, 'name']);

			contract.data.target = head.id;

			// If we have to ignore the update events, then we can't also
			// trust the create event to be what it should have been at
			// the beginning, as services might not preserve that information.
			if (
				testCase.ignoreUpdateEvents &&
				contract.type.split('@')[0] === 'create'
			) {
				contract.data.payload = _.get(actualTail, [index, 'data', 'payload']);
				contract.data.timestamp = _.get(actualTail, [
					index,
					'data',
					'timestamp',
				]);
			}

			return contract;
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
