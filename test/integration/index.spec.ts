import { strict as assert } from 'assert';
import {
	Kernel,
	testUtils as autumndbTestUtils,
	TypeContract,
	UserContract,
} from 'autumndb';
import _ from 'lodash';
import { setTimeout as delay } from 'timers/promises';
import {
	ActionRequestContract,
	ActionRequestData,
	errors,
	PluginDefinition,
	ScheduledActionData,
	testUtils,
	TransformerContract,
	TriggeredActionContract,
	TriggeredActionData,
	Worker,
} from '../../lib';
import { getNextExecutionDate } from '../../lib/queue/producer';

let ctx: testUtils.TestContext;
const transformerSlugs = _.map(['foo', 'bar'], (name) => {
	return `transformer-${name}`;
});

beforeAll(async () => {
	const foobarPlugin = (): PluginDefinition => {
		return {
			slug: 'plugin-foobar',
			name: 'Foobar Plugin',
			version: '1.0.0',
			contracts: [
				{
					slug: transformerSlugs[0],
					type: 'transformer@1.0.0',
					active: true,
					data: {
						requirements: {},
						inputFilter: {},
						workerFilter: {},
						$transformer: {
							artifactReady: true,
						},
					},
				},
			],
		};
	};

	ctx = await testUtils.newContext({
		plugins: [foobarPlugin()],
	});
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

/**
 * @summary Build an action request to create a scheduled action contract
 * @function
 *
 * @param actor - actor id
 * @param schedule - schedule configuration
 * @param foo - data.foo for contract(s) created by scheduled action
 * @returns action request data
 */
function getScheduledActionRequest(
	actor: string,
	schedule: ScheduledActionData['schedule'],
	foo: string = autumndbTestUtils.generateRandomId(),
): ActionRequestData {
	return {
		actor,
		epoch: new Date().valueOf(),
		input: {
			id: ctx.worker.typeContracts['scheduled-action@1.0.0'].id,
		},
		timestamp: new Date().toISOString(),
		action: 'action-create-card@1.0.0',
		context: ctx.logContext,
		card: ctx.worker.typeContracts['scheduled-action@1.0.0'].id,
		type: ctx.worker.typeContracts['scheduled-action@1.0.0'].type,
		arguments: {
			reason: null,
			properties: {
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'scheduled-action',
				}),
				version: '1.0.0',
				data: {
					options: {
						context: ctx.logContext,
						action: 'action-create-card@1.0.0',
						card: ctx.worker.typeContracts['card@1.0.0'].id,
						type: 'type',
						arguments: {
							reason: null,
							properties: {
								data: {
									foo,
								},
							},
						},
					},
					schedule,
				},
			},
		},
	};
}

describe('.getId()', () => {
	test('should preserve the same id during its lifetime', async () => {
		const id1 = ctx.worker.getId();
		const id2 = ctx.worker.getId();
		const id3 = ctx.worker.getId();
		const id4 = ctx.worker.getId();
		const id5 = ctx.worker.getId();

		expect(id1).toBe(id2);
		expect(id2).toBe(id3);
		expect(id3).toBe(id4);
		expect(id4).toBe(id5);
	});

	test('different workers should get different ids', async () => {
		const worker1 = new Worker(ctx.kernel, ctx.session, ctx.pool, []);
		const worker2 = new Worker(ctx.kernel, ctx.session, ctx.pool, []);
		const worker3 = new Worker(ctx.kernel, ctx.session, ctx.pool, []);

		await worker1.initialize(ctx.logContext, async () => {
			return;
		});
		await worker2.initialize(ctx.logContext, async () => {
			return;
		});
		await worker3.initialize(ctx.logContext, async () => {
			return;
		});

		expect(worker1.getId()).not.toBe(worker2.getId());
		expect(worker1.getId()).not.toBe(worker3.getId());
		expect(worker2.getId()).not.toBe(worker3.getId());

		await Promise.all([worker1.stop(), worker2.stop(), worker3.stop()]);
	});
});

describe('Worker', () => {
	it('instance should update on new type contract', async () => {
		// Insert a new type contract
		const contract = await ctx.kernel.insertContract<TypeContract>(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomId(),
				type: 'type@1.0.0',
				markers: [],
				data: {
					schema: {
						type: 'object',
						required: ['name'],
						properties: {
							name: {
								type: 'string',
							},
						},
					},
				},
			},
		);
		assert(contract);

		// Wait for the polling mechanism to update the worker
		await delay(15 * 1000);
		await ctx.retry(
			() => {
				return ctx.worker.typeContracts[`${contract.slug}@${contract.version}`];
			},
			(typeContract: any) => {
				return typeContract !== undefined;
			},
		);
	});

	it('instance should update on new triggered-action contract', async () => {
		// Insert a new triggered action contract
		const contract = await ctx.kernel.insertContract<TriggeredActionContract>(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				type: 'triggered-action@1.0.0',
				markers: [],
				data: {
					filter: {
						type: 'object',
						required: ['type'],
						properties: {
							type: {
								type: 'string',
								const: 'foobar@1.0.0',
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: 'card@1.0.0',
					arguments: {
						reason: null,
						properties: {},
					},
				},
			},
		);
		assert(contract);

		// Wait for the polling mechanism to update the worker
		await delay(15 * 1000);
		await ctx.retry(
			() => {
				return _.find(ctx.worker.triggers, { id: contract.id });
			},
			(typeContract: any) => {
				return typeContract !== undefined;
			},
		);

		// Remove the test trigger
		ctx.worker.removeTrigger(ctx.logContext, contract.id);
	});

	it('instance should update on new transformer contract', async () => {
		// Insert a new transformer contract
		await ctx.kernel.insertContract<TransformerContract>(
			ctx.logContext,
			ctx.session,
			{
				slug: transformerSlugs[1],
				type: 'transformer@1.0.0',
				active: true,
				data: {
					requirements: {},
					inputFilter: {},
					workerFilter: {},
					$transformer: {
						artifactReady: true,
					},
				},
			},
		);

		// Wait for the polling mechanism to update the worker
		await delay(15 * 1000);
		const match = (transformer: TransformerContract) => {
			return _.includes(transformerSlugs, transformer.slug);
		};
		await ctx.retry(
			() => {
				return _.concat(
					_.filter(ctx.worker.transformers, match),
					_.filter(ctx.worker.latestTransformers, match),
				);
			},
			(matches: TransformerContract[]) => {
				return matches.length === 4;
			},
		);
	});

	it('instance should update on new formula generated triggered-action', async () => {
		// Insert a new type with a formula
		const contract = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['type@1.0.0'],
			{},
			{
				slug: autumndbTestUtils.generateRandomId(),
				type: 'type@1.0.0',
				markers: [],
				data: {
					schema: {
						type: 'object',
						properties: {
							latest: {
								type: 'object',
								$$formula: `
								PROPERTY(contract, [ "links", "has attached element", "length" ])
								? LAST(
										ORDER_BY(
											FILTER(
												contract.links["has attached element"],
												function (c) { return c && (c.type === "card@1.0.0"); }
											),
											"data.timestamp"
										)
									)
								: null
							`,
							},
						},
					},
				},
			},
		);
		assert(contract);

		// Wait for the polling mechanism to update the worker
		await delay(15 * 1000);
		await ctx.retry(
			() => {
				return _.find(ctx.worker.triggers, (item: TriggeredActionContract) => {
					return item.slug.startsWith(
						`triggered-action-formula-update-${contract.slug}`,
					);
				});
			},
			(typeContract: any) => {
				return typeContract !== undefined;
			},
		);

		// Remove the test trigger
		const trigger = _.find(
			ctx.worker.triggers,
			(item: TriggeredActionContract) => {
				return item.slug.startsWith(
					`triggered-action-formula-update-${contract.slug}`,
				);
			},
		);
		ctx.worker.removeTrigger(ctx.logContext, trigger!.id);
	});

	it('should throw when attempting to execute the same action-request twice', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);

		const slug = autumndbTestUtils.generateRandomSlug();
		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{
				actor: ctx.worker.getId(),
				timestamp: new Date().toISOString(),
			},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							version: '1.0.0',
							data: {
								foo: 'bar',
							},
						},
					},
				},
			},
		);

		const enqueuedRequest1 = await ctx.dequeue();
		assert(enqueuedRequest1);

		await ctx.worker.consumer.postResults(
			ctx.logContext,
			enqueuedRequest1 as any,
			{
				error: false,
				data: {
					id: autumndbTestUtils.generateRandomId(),
					type: 'card@1.0.0',
					slug,
				},
			},
		);

		await expect(
			ctx.worker.execute(ctx.session, enqueuedRequest1),
		).rejects.toThrowError();

		const enqueuedRequest2 = await ctx.dequeue();
		expect(enqueuedRequest2).toBeFalsy();
	});

	it('should evaluate a simple computed property on insertion', async () => {
		const typeContract = ctx.worker.typeContracts['type@1.0.0'];
		assert(typeContract);

		const slug = autumndbTestUtils.generateRandomSlug();
		const typeRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					timestamp: new Date().toISOString(),
					input: {
						id: typeContract.id,
					},
					arguments: {
						reason: null,
						properties: {
							slug,
							data: {
								schema: {
									type: 'object',
									properties: {
										type: {
											type: 'string',
											pattern: `^${slug}@`,
										},
										data: {
											type: 'object',
											properties: {
												foo: {
													type: 'string',
													$$formula: 'UPPER(input)',
												},
											},
											additionalProperties: true,
										},
									},
									additionalProperties: true,
									required: ['type', 'data'],
								},
							},
						},
					},
				},
			},
		);
		assert(typeRequest);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			typeRequest,
		);
		assert(typeResult);
		expect(typeResult.error).toBe(false);

		const insertRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeResult.data.id,
					type: typeResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {
								foo: 'hello',
							},
						},
					},
				},
			},
		);
		assert(insertRequest);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			insertResult.data.id,
		);
		assert(contract);
		expect(contract).toEqual({
			id: contract.id,
			slug: contract.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: contract.linked_at,
			updated_at: contract.updated_at,
			created_at: contract.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				foo: 'HELLO',
			},
		});
	});

	it('should evaluate a simple SUM property on a insertAction', async () => {
		const typeContract: any = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);
		assert(typeContract);

		const slug = autumndbTestUtils.generateRandomSlug();
		const typeRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							data: {
								schema: {
									type: 'object',
									properties: {
										type: {
											type: 'string',
											pattern: `^${slug}@`,
										},
										data: {
											type: 'object',
											properties: {
												apples: {
													type: 'number',
												},
												oranges: {
													type: 'number',
												},
												fruitSalad: {
													type: 'number',
													$$formula:
														'SUM([contract.data.apples, contract.data.oranges])',
												},
											},
											additionalProperties: true,
										},
									},
									additionalProperties: true,
									required: ['type', 'data'],
								},
							},
						},
					},
				},
			},
		);
		assert(typeRequest);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeResult.data.id,
					type: typeResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {
								apples: 10,
								oranges: 5,
							},
						},
					},
				},
			},
		);
		assert(insertRequest);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			insertResult.data.id,
		);
		assert(contract);

		expect(contract).toEqual({
			id: contract.id,
			slug: contract.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: contract.linked_at,
			updated_at: contract.updated_at,
			created_at: contract.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				apples: 10,
				fruitSalad: 15,
				oranges: 5,
			},
		});
	});

	it('should evaluate a simple computed property on a JSON Patch move', async () => {
		const typeContract = ctx.worker.typeContracts['type@1.0.0'];
		assert(typeContract);

		const slug = autumndbTestUtils.generateRandomSlug();
		const typeRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							data: {
								schema: {
									type: 'object',
									properties: {
										type: {
											type: 'string',
											pattern: `^${slug}@`,
										},
										data: {
											type: 'object',
											properties: {
												foo: {
													type: 'string',
													$$formula: 'UPPER(input)',
												},
											},
											additionalProperties: true,
										},
									},
									additionalProperties: true,
									required: ['type', 'data'],
								},
							},
						},
					},
				},
			},
		);
		assert(typeRequest);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeResult.data.id,
					type: typeResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {
								bar: 'hello',
								foo: 'test',
							},
						},
					},
				},
			},
		);
		assert(insertRequest);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-update-card@1.0.0',
					context: ctx.logContext,
					card: insertResult.data.id,
					type: insertResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: insertResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						patch: [
							{
								op: 'move',
								from: '/data/bar',
								path: '/data/foo',
							},
						],
					},
				},
			},
		);
		assert(updateRequest);
		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			updateResult.data.id,
		);
		assert(contract);

		expect(contract).toEqual({
			id: contract.id,
			slug: contract.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: contract.linked_at,
			updated_at: contract.updated_at,
			created_at: contract.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				// bar: 'hello', // removed by json patch move operation
				foo: 'HELLO',
			},
		});
	});

	it('should evaluate a simple computed property on a JSON Patch copy', async () => {
		const typeContract = ctx.worker.typeContracts['type@1.0.0'];
		assert(typeContract);

		const slug = autumndbTestUtils.generateRandomSlug();
		const typeRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							data: {
								schema: {
									type: 'object',
									properties: {
										type: {
											type: 'string',
											pattern: `^${slug}@`,
										},
										data: {
											type: 'object',
											properties: {
												foo: {
													type: 'string',
													$$formula: 'UPPER(input)',
												},
											},
											additionalProperties: true,
										},
									},
									additionalProperties: true,
									required: ['type', 'data'],
								},
							},
						},
					},
				},
			},
		);
		assert(typeRequest);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeResult.data.id,
					type: typeResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {
								bar: 'hello',
								foo: 'test',
							},
						},
					},
				},
			},
		);
		assert(insertRequest);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-update-card@1.0.0',
					context: ctx.logContext,
					card: insertResult.data.id,
					type: insertResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: insertResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						patch: [
							{
								op: 'copy',
								from: '/data/bar',
								path: '/data/foo',
							},
						],
					},
				},
			},
		);
		assert(updateRequest);
		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			updateResult.data.id,
		);
		assert(contract);

		expect(contract).toEqual({
			id: contract.id,
			slug: contract.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: contract.linked_at,
			updated_at: contract.updated_at,
			created_at: contract.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				foo: 'HELLO',
				bar: 'hello',
			},
		});
	});

	it('should evaluate a simple computed property on a JSON Patch replace', async () => {
		const typeContract = ctx.worker.typeContracts['type@1.0.0'];
		assert(typeContract);

		const slug = autumndbTestUtils.generateRandomSlug();
		const typeRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							data: {
								schema: {
									type: 'object',
									properties: {
										type: {
											type: 'string',
											pattern: `^${slug}@`,
										},
										data: {
											type: 'object',
											properties: {
												foo: {
													type: 'string',
													$$formula: 'UPPER(input)',
												},
											},
											additionalProperties: true,
										},
									},
									additionalProperties: true,
									required: ['type', 'data'],
								},
							},
						},
					},
				},
			},
		);
		assert(typeRequest);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeResult.data.id,
					type: typeResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {
								foo: 'hello',
							},
						},
					},
				},
			},
		);
		assert(insertRequest);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-update-card@1.0.0',
					context: ctx.logContext,
					card: insertResult.data.id,
					type: insertResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: insertResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						patch: [
							{
								op: 'replace',
								path: '/data/foo',
								value: 'bar',
							},
						],
					},
				},
			},
		);
		assert(updateRequest);
		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			updateResult.data.id,
		);
		assert(contract);

		expect(contract).toEqual({
			id: contract.id,
			slug: contract.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: contract.linked_at,
			updated_at: contract.updated_at,
			created_at: contract.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				foo: 'BAR',
			},
		});
	});

	it('should evaluate a simple computed property on a JSON Patch addition', async () => {
		const typeContract = ctx.worker.typeContracts['type@1.0.0'];
		assert(typeContract);

		const slug = autumndbTestUtils.generateRandomSlug();
		const typeRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							data: {
								schema: {
									type: 'object',
									properties: {
										type: {
											type: 'string',
											pattern: `^${slug}@`,
										},
										data: {
											type: 'object',
											properties: {
												foo: {
													type: 'string',
													$$formula: 'UPPER(input)',
												},
											},
											additionalProperties: true,
										},
									},
									additionalProperties: true,
									required: ['type', 'data'],
								},
							},
						},
					},
				},
			},
		);
		assert(typeRequest);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeResult.data.id,
					type: typeResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {},
						},
					},
				},
			},
		);
		assert(insertRequest);
		await ctx.flush(ctx.session);
		const insertResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			insertRequest,
		);
		expect(insertResult.error).toBe(false);

		const updateRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-update-card@1.0.0',
					context: ctx.logContext,
					card: insertResult.data.id,
					type: insertResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: insertResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						patch: [
							{
								op: 'add',
								path: '/data/foo',
								value: 'hello',
							},
						],
					},
				},
			},
		);
		assert(updateRequest);
		await ctx.flush(ctx.session);
		const updateResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			updateResult.data.id,
		);
		assert(contract);

		expect(contract).toEqual({
			id: contract.id,
			slug: contract.slug,
			capabilities: [],
			requires: [],
			markers: [],
			name: null,
			version: '1.0.0',
			linked_at: contract.linked_at,
			updated_at: contract.updated_at,
			created_at: contract.created_at,
			type: `${slug}@1.0.0`,
			active: true,
			loop: null,
			links: {},
			tags: [],
			data: {
				foo: 'HELLO',
			},
		});
	});

	it('should throw if the result of the formula is incompatible with the given type', async () => {
		const typeContract = ctx.worker.typeContracts['type@1.0.0'];
		assert(typeContract);

		const slug = autumndbTestUtils.generateRandomSlug();
		const typeRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							data: {
								schema: {
									type: 'object',
									properties: {
										type: {
											type: 'string',
											pattern: `^${slug}@`,
										},
										data: {
											type: 'object',
											properties: {
												foo: {
													type: 'number',
													$$formula: 'UPPER(input)',
												},
											},
											additionalProperties: true,
										},
									},
									additionalProperties: true,
									required: ['type', 'data'],
								},
							},
						},
					},
				},
			},
		);
		assert(typeRequest);
		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			typeRequest,
		);
		expect(typeResult.error).toBe(false);

		const insertRequest = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeResult.data.id,
					type: typeResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {
								foo: 'hello',
							},
						},
					},
				},
			},
		);
		assert(insertRequest);
		await expect(ctx.flush(ctx.session)).rejects.toThrowError();
	});

	it('should be able to login as a user with a password', async () => {
		const typeContract = ctx.worker.typeContracts['user@1.0.0'];
		assert(typeContract);

		const request1: any = await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			card: typeContract.id,
			logContext: ctx.logContext,
			type: typeContract.type,
			arguments: {
				email: 'johndoe@example.com',
				username: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		// TODO: Remove this after converting action request context to logContext
		request1.context = ctx.logContext;
		request1.epoch = new Date().valueOf();
		request1.timestamp = new Date().toISOString();
		request1.actor = ctx.adminUserId;
		request1.input = {
			id: typeContract.id,
		};

		const createUserRequest =
			await ctx.worker.insertCard<ActionRequestContract>(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{},
				{
					data: request1,
				},
			);
		assert(createUserRequest);
		await ctx.flushAll(ctx.session);

		const signupResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		const request2: any = await ctx.worker.pre(ctx.session, {
			action: 'action-create-session@1.0.0',
			card: signupResult.data.id,
			logContext: ctx.logContext,
			type: signupResult.data.type,
			arguments: {
				password: 'foobarbaz',
			},
		});

		// TODO: Remove this after converting action request context to logContext
		request2.context = ctx.logContext;
		request2.epoch = new Date().valueOf();
		request2.timestamp = new Date().toISOString();
		request2.actor = ctx.adminUserId;
		request2.input = {
			id: signupResult.data.id,
		};

		const loginRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: request2,
			},
		);
		assert(loginRequest);
		await ctx.flushAll(ctx.session);

		const loginResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			loginRequest,
		);
		expect(loginResult.error).toBe(false);

		const session = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			loginResult.data.id,
		);
		assert(session);

		session.data.token = {};
		expect(session).toEqual(
			Kernel.defaults({
				created_at: session.created_at,
				linked_at: session.linked_at,
				name: null,
				id: session.id,
				slug: session.slug,
				version: '1.0.0',
				type: 'session@1.0.0',
				links: session.links,
				data: {
					actor: signupResult.data.id,
					expiration: session.data.expiration,
					scope: {},
					token: {},
				},
			}),
		);

		const currentDate = new Date();
		expect(new Date(session.data.expiration as any) > currentDate).toBe(true);
	});

	it('should not be able to login as a password-less user', async () => {
		const user = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: [],
				},
			},
		);
		assert(user);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-session@1.0.0',
					context: ctx.logContext,
					card: user.id,
					type: user.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: user.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {},
				},
			},
		);
		await expect(ctx.flush(ctx.session)).rejects.toThrowError();
	});

	it('should not be able to login as a password-less user given a random password', async () => {
		const user = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: [],
				},
			},
		);
		assert(user);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-create-session@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					password: 'foobar',
				},
			}),
		).rejects.toThrow(errors.WorkerAuthenticationError);
	});

	it('should not be able to login as a password-less non-disallowed user', async () => {
		const user = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					disallowLogin: false,
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: [],
				},
			},
		);
		assert(user);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-session@1.0.0',
					context: ctx.logContext,
					card: user.id,
					type: user.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: user.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {},
				},
			},
		);
		await expect(ctx.flush(ctx.session)).rejects.toThrowError();
	});

	it('should not be able to login as a password-less disallowed user', async () => {
		const user = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					disallowLogin: true,
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: [],
				},
			},
		);
		assert(user);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-session@1.0.0',
					context: ctx.logContext,
					card: user.id,
					type: user.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: user.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {},
				},
			},
		);
		await expect(ctx.flush(ctx.session)).rejects.toThrowError();
	});

	it('should fail if signing up with the wrong password', async () => {
		const typeContract = ctx.worker.typeContracts['user@1.0.0'];
		assert(typeContract);

		const request1: any = await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			logContext: ctx.logContext,
			card: typeContract.id,
			type: typeContract.type,
			arguments: {
				email: 'johndoe@example.com',
				username: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'xxxxxxxxxxxx',
			},
		});

		// TODO: Remove this after converting action request context to logContext
		request1.context = ctx.logContext;

		const createUserRequest =
			await ctx.worker.insertCard<ActionRequestContract>(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{},
				{
					data: {
						...request1,
						epoch: new Date().valueOf(),
						timestamp: new Date().toISOString(),
						actor: ctx.adminUserId,
						input: {
							id: typeContract.id,
						},
					},
				},
			);
		assert(createUserRequest);

		await ctx.flush(ctx.session);
		const signupResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-create-session@1.0.0',
				logContext: ctx.logContext,
				card: signupResult.data.id,
				type: signupResult.data.type,
				arguments: {
					password: 'foobarbaz',
				},
			}),
		).rejects.toThrow(errors.WorkerAuthenticationError);
	});

	it('should post an error execute event if logging in as a disallowed user', async () => {
		const adminContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'user-admin@latest',
		);
		assert(adminContract);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-create-session@1.0.0',
				logContext: ctx.logContext,
				card: adminContract.id,
				type: adminContract.type,
				arguments: {
					password: 'foobarbaz',
				},
			}),
		).rejects.toThrow(errors.WorkerAuthenticationError);
	});

	it('a triggered action can update a dynamic list of contracts (ids as array of strings)', async () => {
		const contractIds: string[] = [];
		const slug = autumndbTestUtils.generateRandomSlug();
		await Promise.all(
			[1, 2, 3].map(async (idx) => {
				const contract = await ctx.kernel.insertContract(
					ctx.logContext,
					ctx.session,
					{
						slug: `${slug}${idx}`,
						type: 'card@1.0.0',
						version: '1.0.0',
						data: {
							id: `id${idx}`,
						},
					},
				);
				contractIds.push(contract.id);
			}),
		);

		ctx.worker.setTriggers(ctx.logContext, [
			Kernel.defaults<TriggeredActionData>({
				id: autumndbTestUtils.generateRandomId(),
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				type: 'triggered-action@1.0.0',
				data: {
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['cards'],
								properties: {
									cards: {
										type: 'array',
										items: {
											type: 'string',
										},
									},
								},
							},
						},
					},
					action: 'action-update-card@1.0.0',
					target: {
						$eval: 'source.data.cards',
					},
					arguments: {
						reason: null,
						patch: [
							{
								op: 'add',
								path: '/data/updated',
								value: true,
							},
						],
					},
				},
			}) as TriggeredActionContract,
		]);

		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);

		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {
								cards: contractIds,
							},
						},
					},
				},
			},
		);
		assert(request);
		await ctx.flushAll(ctx.session);

		const result = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(false);
		await ctx.flushAll(ctx.session);

		await Promise.all(
			[1, 2, 3].map(async (idx) => {
				const contract = await ctx.kernel.getContractBySlug(
					ctx.logContext,
					ctx.session,
					`${slug}${idx}@latest`,
				);
				assert(contract);
				expect(contract.data.updated).toBe(true);
			}),
		);
	});

	test('a triggered action can update a dynamic list of contracts (ids as array of objects with field id)', async () => {
		const contractsWithId: Array<{ [id: string]: string }> = [];
		const slug = autumndbTestUtils.generateRandomSlug();
		await Promise.all(
			[1, 2, 3].map(async (idx) => {
				const contract = await ctx.kernel.insertContract(
					ctx.logContext,
					ctx.session,
					{
						slug: `${slug}${idx}`,
						type: 'card@1.0.0',
						version: '1.0.0',
						data: {
							id: `id${idx}`,
						},
					},
				);
				contractsWithId.push({ id: contract.id });
			}),
		);

		ctx.worker.setTriggers(ctx.logContext, [
			Kernel.defaults<TriggeredActionData>({
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				type: 'triggered-action@1.0.0',
				data: {
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['cards'],
								properties: {
									cards: {
										type: 'array',
										items: {
											type: 'object',
											required: ['id'],
											properties: {
												id: {
													type: 'string',
												},
											},
										},
									},
								},
							},
						},
					},
					action: 'action-update-card@1.0.0',
					target: {
						$map: {
							$eval: 'source.data.cards[0:]',
						},
						'each(card)': {
							$eval: 'card.id',
						},
					},
					arguments: {
						reason: null,
						patch: [
							{
								op: 'add',
								path: '/data/updated',
								value: true,
							},
						],
					},
				},
			}) as TriggeredActionContract,
		]);

		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);

		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {
								cards: contractsWithId,
							},
						},
					},
				},
			},
		);
		assert(request);
		await ctx.flush(ctx.session);

		const result = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(false);
		await ctx.flushAll(ctx.session);

		await Promise.all(
			[1, 2, 3].map(async (idx) => {
				const contract = await ctx.kernel.getContractBySlug(
					ctx.logContext,
					ctx.session,
					`${slug}${idx}@latest`,
				);
				assert(contract !== null);
				expect(contract.data.updated).toBe(true);
			}),
		);
	});

	it('should fail when attempting to insert a triggered-action contract with duplicate targets', async () => {
		const trigger = {
			id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
			type: 'triggered-action@1.0.0',
			slug: 'triggered-action-12345',
			data: {
				filter: {
					type: 'object',
					required: ['data'],
					properties: {
						data: {
							type: 'object',
							required: ['command'],
							properties: {
								command: {
									type: 'string',
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-update-card@1.0.0',
				target: ['1', '1', '1'],
				arguments: {
					reason: null,
					patch: [
						{
							op: 'add',
							path: '/data/updated',
							value: true,
						},
					],
				},
			},
		};

		await expect(
			ctx.kernel.insertContract(ctx.logContext, ctx.session, trigger),
		).rejects.toThrowError();
	});

	test('trigger should update contract if triggered by a user not owning the contract', async () => {
		const contract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'card@1.0.0',
				version: '1.0.0',
				data: {
					id: 'id-admin',
				},
			},
		);

		ctx.worker.setTriggers(ctx.logContext, [
			Kernel.defaults<TriggeredActionData>({
				id: autumndbTestUtils.generateRandomId(),
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'triggered-action',
				}),
				type: 'triggered-action@1.0.0',
				data: {
					filter: {
						type: 'object',
						required: ['data'],
						properties: {
							data: {
								type: 'object',
								required: ['cards'],
								properties: {
									cards: {
										type: 'array',
										items: {
											type: 'object',
											required: ['id'],
											properties: {
												id: {
													type: 'string',
												},
											},
										},
									},
								},
							},
						},
					},
					action: 'action-update-card@1.0.0',
					target: {
						$map: {
							$eval: 'source.data.cards[0:]',
						},
						'each(card)': {
							$eval: 'card.id',
						},
					},
					arguments: {
						reason: null,
						patch: [
							{
								op: 'add',
								path: '/data/updated',
								value: true,
							},
						],
					},
				},
			}) as TriggeredActionContract,
		]);

		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);

		const userJohnDoe = await ctx.createUser(
			autumndbTestUtils.generateRandomId(),
			'PASSWORDLESS',
			['user-community'],
		);
		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: userJohnDoe.id,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {
								cards: [
									{
										id: contract.id,
									},
								],
							},
						},
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);

		const result = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			contract.id,
		);
		assert(result);
		expect(result).toBeTruthy();
		expect(result.data.updated).toBe(true);
	});
});

describe('.getTriggers()', () => {
	it('should return a list of triggers', async () => {
		const triggers = ctx.worker.getTriggers();
		expect(triggers[0].type.split('@')[0]).toEqual('triggered-action');
	});
});

describe('.replaceCard()', () => {
	test('should update type contract schema', async () => {
		const typeContract = ctx.worker.typeContracts['type@1.0.0'];
		assert(typeContract !== null);

		const slug = autumndbTestUtils.generateRandomSlug();
		const result1 = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					schema: {
						data: {
							foo: {
								title: 'Foobar',
								type: 'string',
							},
						},
					},
				},
			},
		);

		await ctx.worker.replaceCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					schema: {
						data: {
							foo: {
								title: 'Foobar2',
								type: 'string',
							},
						},
					},
				},
			},
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result1!.id,
		);

		assert(contract !== null);
		assert(result1! !== null);

		expect((contract.data.schema as any).data.foo.title).toEqual('Foobar2');
	});

	test('updating a contract must have the correct tail', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract !== null);

		const slug = autumndbTestUtils.generateRandomSlug();
		const result1 = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					foo: 1,
				},
			},
		);

		await ctx.worker.replaceCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			{
				slug,
				version: '1.0.0',
				data: {
					foo: 2,
				},
			},
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result1!.id,
		);

		assert(contract !== null);
		assert(result1! !== null);

		expect(contract).toEqual(
			Kernel.defaults({
				created_at: result1.created_at,
				updated_at: contract.updated_at,
				linked_at: contract.linked_at,
				id: result1!.id,
				name: null,
				slug,
				type: 'card@1.0.0',
				data: {
					foo: 2,
				},
			}),
		);

		const tail = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['type', 'data'],
			properties: {
				type: {
					type: 'string',
					enum: ['create@1.0.0', 'update@1.0.0'],
				},
				data: {
					type: 'object',
					required: ['target'],
					properties: {
						target: {
							type: 'string',
							const: result1!.id,
						},
					},
				},
			},
		});

		// "Replace" is an operation that will go away once the database
		// becomes fully immutable, so we don't attempt to calculate a
		// JSON Patch update for it, as we treat it as an exception
		expect(tail.length).toBe(1);
		expect(tail[0].type).toBe('create@1.0.0');
		expect(tail[0].data.payload).toEqual(
			_.pick(result1, ['data', 'slug', 'type', 'version']),
		);
	});

	test('should be able to disable event creation', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract !== null);

		const slug = autumndbTestUtils.generateRandomSlug();

		const result = await ctx.worker.replaceCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: false,
				actor: ctx.adminUserId,
			},
			{
				slug,
				version: '1.0.0',
			},
		);

		assert(result !== null);

		const tail = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['type', 'data'],
			properties: {
				type: {
					type: 'string',
					enum: ['create@1.0.0', 'update@1.0.0'],
				},
				data: {
					type: 'object',
					required: ['target'],
					properties: {
						target: {
							type: 'string',
							const: result.id,
						},
					},
				},
			},
		});

		expect(tail.length).toBe(0);
	});
});

describe('.insertCard()', () => {
	test('should insert a contract', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract !== null);

		const slug = autumndbTestUtils.generateRandomSlug();
		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: false,
				actor: ctx.adminUserId,
			},
			{
				slug,
				data: {
					foo: 1,
				},
			},
		);

		assert(result !== null);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result.id,
		);

		expect(contract).toEqual(
			Kernel.defaults({
				created_at: result!.created_at,
				id: result!.id,
				name: null,
				slug,
				type: 'card@1.0.0',
				data: {
					foo: 1,
				},
				linked_at: contract!.linked_at,
			}),
		);
	});

	test('should ignore an explicit type property', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);

		const slug = autumndbTestUtils.generateRandomSlug();
		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: false,
				actor: ctx.adminUserId,
			},
			{
				active: true,
				slug,
				type: `${slug}@1.0.0`,
				version: '1.0.0',
				links: {},
				tags: [],
				markers: [],
				requires: [],
				capabilities: [],
				data: {
					foo: 1,
				},
			},
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result!.id,
		);

		assert(contract !== null);

		expect(contract.type).toBe('card@1.0.0');
	});

	test('should default active to true', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: false,
				actor: ctx.adminUserId,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result!.id,
		);
		assert(contract !== null);
		expect(contract.active).toBe(true);
	});

	test('should be able to set active to false', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: false,
				actor: ctx.adminUserId,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
				active: false,
			},
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result!.id,
		);
		assert(contract !== null);
		expect(contract.active).toBe(false);
	});

	test('should provide sane defaults for links', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: false,
				actor: ctx.adminUserId,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result!.id,
		);
		assert(contract !== null);
		expect(contract.links).toEqual({});
	});

	test('should provide sane defaults for tags', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: false,
				actor: ctx.adminUserId,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result!.id,
		);
		assert(contract !== null);
		expect(contract.tags).toEqual([]);
	});

	test('should provide sane defaults for data', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: false,
				actor: ctx.adminUserId,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
			},
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result!.id,
		);
		assert(contract !== null);
		expect(contract.data).toEqual({});
	});

	test('should be able to set a slug', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);

		const slug = autumndbTestUtils.generateRandomSlug();
		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: false,
				actor: ctx.adminUserId,
			},
			{
				slug,
				version: '1.0.0',
			},
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result!.id,
		);
		assert(contract !== null);
		expect(contract.slug).toBe(slug);
	});

	test('should be able to set a name', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: false,
				actor: ctx.adminUserId,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
				name: 'Hello',
			},
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result!.id,
		);
		assert(contract !== null);
		expect(contract.name).toBe('Hello');
	});

	test('throw if contract already exists and override is false', async () => {
		const slug = autumndbTestUtils.generateRandomSlug();
		await ctx.kernel.insertContract(ctx.logContext, ctx.session, {
			slug,
			type: 'card@1.0.0',
			version: '1.0.0',
		});

		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		await expect(
			ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				typeContract,
				{
					attachEvents: false,
					actor: ctx.adminUserId,
				},
				{
					version: '1.0.0',
					slug,
					active: false,
				},
			),
		).rejects.toThrowError();
	});

	test('should add a create event if attachEvents is true', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		const result = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			{
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomSlug(),
			},
		);

		assert(result !== null);

		const tail = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['type', 'data'],
			properties: {
				type: {
					type: 'string',
					const: 'create@1.0.0',
				},
				data: {
					type: 'object',
					required: ['target'],
					properties: {
						target: {
							type: 'string',
							const: result.id,
						},
					},
				},
			},
		});

		expect(tail.length).toBe(1);
	});
});

describe('.patchCard()', () => {
	test('should ignore pointless updates', async () => {
		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		const result1 = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				version: '1.0.0',
				active: true,
			},
		);

		assert(result1 !== null);

		const result2 = await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				actor: ctx.adminUserId,
			},
			result1,
			[],
		);

		const result3 = await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				actor: ctx.adminUserId,
			},
			result1,
			[
				{
					op: 'replace',
					path: '/active',
					value: true,
				},
			],
		);

		expect(result1).toBeTruthy();
		expect(result2).toBeFalsy();
		expect(result3).toBeFalsy();

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result1.id,
		);
		assert(contract !== null);
		expect(contract.created_at).toBe(result1!.created_at);
	});

	test('should not upsert if no changes were made', async () => {
		const element = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				actor: ctx.adminUserId,
			},
			element,
			[],
		);
	});

	test('should set a contract to inactive', async () => {
		const previousContract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				actor: ctx.adminUserId,
			},
			previousContract,
			[
				{
					op: 'replace',
					path: '/active',
					value: false,
				},
			],
		);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			previousContract.id,
		);
		assert(contract !== null);
		expect(contract.active).toBe(false);
	});

	test('should add an update event if attachEvents is true', async () => {
		const element = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		const result = await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			typeContract,
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			element,
			[
				{
					op: 'replace',
					path: '/active',
					value: false,
				},
			],
		);

		const tail = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['type', 'data'],
			properties: {
				type: {
					type: 'string',
					const: 'update@1.0.0',
				},
				data: {
					type: 'object',
					required: ['target'],
					properties: {
						target: {
							type: 'string',
							const: result!.id,
						},
					},
				},
			},
		});

		expect(tail.length).toBe(1);
	});

	test('should remove previously inserted type triggered actions if deactivating a type', async () => {
		const slug = autumndbTestUtils.generateRandomSlug();
		const type = await ctx.kernel.insertContract(ctx.logContext, ctx.session, {
			type: 'type@1.0.0',
			version: '1.0.0',
			slug,
			data: {
				schema: {
					type: 'object',
				},
			},
		});

		const typeContract = ctx.worker.typeContracts['card@1.0.0'];
		assert(typeContract);
		await ctx.kernel.insertContract(ctx.logContext, ctx.session, {
			type: 'triggered-action@1.0.0',
			slug: autumndbTestUtils.generateRandomSlug({
				prefix: 'triggered-action',
			}),
			version: '1.0.0',
			data: {
				type: `${slug}@1.0.0`,
				filter: {
					type: 'object',
					required: ['data'],
					properties: {
						data: {
							type: 'object',
							required: ['command'],
							properties: {
								command: {
									type: 'string',
									const: 'foo-bar-baz',
								},
							},
						},
					},
				},
				action: 'action-create-card@1.0.0',
				target: typeContract.id,
				arguments: {
					properties: {
						slug: {
							$eval: 'source.data.slug',
						},
						data: {
							number: {
								$eval: 'source.data.number',
							},
						},
					},
				},
			},
		});

		const typeTypeContract = await ctx.kernel.getContractBySlug<TypeContract>(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);
		assert(typeTypeContract !== null);
		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			typeTypeContract,
			{
				actor: ctx.adminUserId,
			},
			type,
			[
				{
					op: 'replace',
					path: '/active',
					value: false,
				},
			],
		);

		const triggers = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['active', 'type'],
			properties: {
				active: {
					type: 'boolean',
					const: true,
				},
				type: {
					type: 'string',
					const: 'triggered-action@1.0.0',
				},
				data: {
					type: 'object',
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							const: `${slug}@1.0.0`,
						},
					},
				},
			},
		});

		expect(triggers).toEqual([]);
	});
});

describe('.getActionContext()', () => {
	it('should include a map of type contracts', async () => {
		const types = await ctx.kernel.query<TypeContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'object',
				properties: {
					type: {
						const: 'type@1.0.0',
					},
				},
			},
		);

		ctx.worker.setTypeContracts(ctx.logContext, types);

		const actionContext = ctx.worker.getActionContext(ctx.logContext);

		const hasAllTypes = _.every(types, (contract) => {
			return _.has(actionContext.cards, `${contract.slug}@${contract.version}`);
		});

		expect(hasAllTypes).toBeTruthy();
	});
});

describe('scheduled actions', () => {
	test('a one-time scheduled action with a past schedule should not enqueue a job', async () => {
		// Execute request to create new scheduled action
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: getScheduledActionRequest(ctx.adminUserId, {
					once: {
						date: new Date(new Date().setDate(new Date().getDate() - 1)),
					},
				}),
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		const result: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		assert(result && result.data && result.data.id);

		// Check that no job was enqueued
		const job = await ctx.pool.query({
			text: `SELECT run_at,payload from graphile_worker.jobs where key=$1;`,
			values: [result.data.id],
		});
		expect(job.rows).toEqual([]);
	});

	test('a one-time scheduled action with a future schedule should enqueue a job', async () => {
		// Execute request to create new scheduled action
		const schedule = {
			once: {
				date: new Date(new Date().setDate(new Date().getDate() + 1)),
			},
		};
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: getScheduledActionRequest(ctx.adminUserId, schedule),
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		const result: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		assert(result && result.data && result.data.id);

		// Check that the expected job was enqueued
		const job = await ctx.pool.query({
			text: `SELECT run_at,payload from graphile_worker.jobs where key=$1;`,
			values: [result.data.id],
		});
		expect(job.rows.length).toEqual(1);
		expect(job.rows[0]['run_at']).toEqual(getNextExecutionDate(schedule));
		expect(job.rows[0].payload.data.action).toEqual(request.data.action);
		expect(job.rows[0].payload.data.arguments).toEqual(
			(request.data.arguments as any).properties.data.options.arguments,
		);
		expect(job.rows[0].payload.data.schedule).toEqual(result.data.id);
	});

	test('a recurring scheduled action with past schedule should not enqueue a job', async () => {
		// Execute request to create new scheduled action
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: getScheduledActionRequest(ctx.adminUserId, {
					recurring: {
						start: new Date(new Date().setDate(new Date().getDate() - 10)),
						end: new Date(new Date().setDate(new Date().getDate() - 5)),
						interval: '* * * * *',
					},
				}),
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		const result: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		assert(result && result.data && result.data.id);

		// Check that no job was enqueued
		const job = await ctx.pool.query({
			text: `SELECT run_at,payload from graphile_worker.jobs where key=$1;`,
			values: [result.data.id],
		});
		expect(job.rows).toEqual([]);
	});

	test('a recurring scheduled action with future schedule should enqueue a job', async () => {
		// Execute request to create new scheduled action
		const schedule = {
			recurring: {
				start: new Date(new Date().setDate(new Date().getDate() - 1)),
				end: new Date(new Date().setDate(new Date().getDate() + 2)),
				interval: '* * * * *',
			},
		};
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: getScheduledActionRequest(ctx.adminUserId, schedule),
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		const result: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		assert(result && result.data && result.data.id);

		// Check that the expected job was enqueued
		const job = await ctx.pool.query({
			text: `SELECT run_at,payload from graphile_worker.jobs where key=$1;`,
			values: [result.data.id],
		});
		expect(job.rows.length).toEqual(1);
		expect(job.rows[0]['run_at']).toEqual(getNextExecutionDate(schedule));
		expect(job.rows[0].payload.data.action).toEqual(request.data.action);
		expect(job.rows[0].payload.data.arguments).toEqual(
			(request.data.arguments as any).properties.data.options.arguments,
		);
		expect(job.rows[0].payload.data.schedule).toEqual(result.data.id);
	});

	test('updating a scheduled action should update its task in the queue', async () => {
		// Execute request to create new scheduled action
		let schedule: ScheduledActionData['schedule'] = {
			once: {
				date: new Date(new Date().setDate(new Date().getDate() + 10)),
			},
		};
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: getScheduledActionRequest(ctx.adminUserId, schedule),
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		const result: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		assert(result && result.data && result.data.id);

		// Check that the expected job was enqueued
		let job = await ctx.pool.query({
			text: `SELECT run_at,payload from graphile_worker.jobs where key=$1;`,
			values: [result.data.id],
		});
		expect(job.rows.length).toEqual(1);
		expect(job.rows[0]['run_at']).toEqual(getNextExecutionDate(schedule));
		expect(job.rows[0].payload.data.action).toEqual(request.data.action);
		expect(job.rows[0].payload.data.arguments).toEqual(
			(request.data.arguments as any).properties.data.options.arguments,
		);
		expect(job.rows[0].payload.data.schedule).toEqual(result.data.id);

		// Execute a request to update the schedule
		schedule = {
			recurring: {
				start: new Date(new Date().setDate(new Date().getDate() - 1)),
				end: new Date(new Date().setDate(new Date().getDate() + 2)),
				interval: '* * * * *',
			},
		};
		const updateRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-update-card@1.0.0',
					context: ctx.logContext,
					card: result.data.id,
					type: ctx.worker.typeContracts['scheduled-action@1.0.0'].type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: result.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						patch: [
							{
								op: 'replace',
								path: '/data/schedule',
								value: schedule,
							},
						],
					},
				},
			},
		);
		assert(updateRequest);
		await ctx.flush(ctx.session);
		await ctx.worker.producer.waitResults(ctx.logContext, updateRequest);

		// Check that the expected job was updated
		job = await ctx.pool.query({
			text: `SELECT run_at,payload from graphile_worker.jobs where key=$1;`,
			values: [result.data.id],
		});
		expect(job.rows.length).toEqual(1);
		expect(job.rows[0]['run_at']).toEqual(getNextExecutionDate(schedule));
		expect(job.rows[0].payload.data.action).toEqual(request.data.action);
		expect(job.rows[0].payload.data.arguments).toEqual(
			(request.data.arguments as any).properties.data.options.arguments,
		);
		expect(job.rows[0].payload.data.schedule).toEqual(result.data.id);
	});

	test('deleting a scheduled action should remove its task from the queue', async () => {
		// Execute request to create new scheduled action
		let request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: getScheduledActionRequest(ctx.adminUserId, {
					once: {
						date: new Date(new Date().setDate(new Date().getDate() + 10)),
					},
				}),
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		const result: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			request,
		);
		assert(result && result.data && result.data.id);

		// Check that the expected job was enqueued
		let job = await ctx.pool.query({
			text: `SELECT run_at,payload from graphile_worker.jobs where key=$1;`,
			values: [result.data.id],
		});
		expect(job.rows.length).toEqual(1);

		// Execute a request to soft delete the scheduled action
		request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-update-card@1.0.0',
					context: ctx.logContext,
					card: result.data.id,
					type: ctx.worker.typeContracts['scheduled-action@1.0.0'].type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: result.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						patch: [
							{
								op: 'replace',
								path: '/active',
								value: false,
							},
						],
					},
				},
			},
		);
		assert(request);
		await ctx.flush(ctx.session);
		await ctx.worker.producer.waitResults(
			ctx.logContext,
			request as ActionRequestContract,
		);

		// Check that no job is enqueued for the deleted scheduled action
		job = await ctx.pool.query({
			text: `SELECT run_at,payload from graphile_worker.jobs where key=$1;`,
			values: [result.data.id],
		});
		expect(job.rows.length).toEqual(0);
	});

	test('should enqueue subsequent iterations for recurring scheduled actions', async () => {
		// Add a new scheduled action contract into the system
		const schedule = {
			recurring: {
				start: new Date(Date.now() - 1000),
				end: new Date(new Date().setHours(new Date().getHours() + 6)),
				interval: '*/30 * * * *',
			},
		};
		const foo = autumndbTestUtils.generateRandomId();
		const scheduledAction = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'scheduled-action@1.0.0',
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'scheduled-action',
				}),
				data: {
					options: {
						context: ctx.logContext,
						action: 'action-create-card@1.0.0',
						card: ctx.worker.typeContracts['card@1.0.0'].id,
						type: ctx.worker.typeContracts['card@1.0.0'].type,
						actor: ctx.adminUserId,
						epoch: new Date().valueOf(),
						input: {
							id: ctx.worker.typeContracts['card@1.0.0'].id,
						},
						timestamp: new Date().toISOString(),
						arguments: {
							reason: null,
							properties: {
								data: {
									foo,
								},
							},
						},
					},
					schedule: {
						recurring: {
							start: schedule.recurring.start.toISOString(),
							end: schedule.recurring.end.toISOString(),
							interval: schedule.recurring.interval,
						},
					},
				},
			},
		);

		// Execute a request tied to this recurring scheduled action
		const request = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: ctx.worker.typeContracts['card@1.0.0'].id,
					type: ctx.worker.typeContracts['card@1.0.0'].type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: ctx.worker.typeContracts['card@1.0.0'].id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							data: {
								foo,
							},
						},
					},
					schedule: scheduledAction.id,
				},
			},
		);
		assert(request);
		await ctx.flushAll(ctx.session);

		// Check that the expected contract was created
		await ctx.waitForMatch({
			type: 'object',
			required: ['data'],
			properties: {
				data: {
					type: 'object',
					required: ['foo'],
					properties: {
						foo: {
							type: 'string',
							const: foo,
						},
					},
				},
			},
		});

		// Wait a second
		await new Promise((resolve) => {
			setTimeout(resolve, 1000);
		});

		// Check that the next iteration was enqueued
		const job = await ctx.pool.query({
			text: `SELECT run_at,payload from graphile_worker.jobs where key=$1;`,
			values: [scheduledAction.id],
		});
		expect(job.rows.length).toEqual(1);
		expect(job.rows[0]['run_at']).toEqual(getNextExecutionDate(schedule));
		expect(job.rows[0].payload.data.action).toEqual(request.data.action);
		expect(job.rows[0].payload.data.arguments).toEqual(request.data.arguments);
		expect(job.rows[0].payload.data.schedule).toEqual(scheduledAction.id);
	});
});
