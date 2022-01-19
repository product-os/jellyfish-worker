import { strict as assert } from 'assert';
import { Kernel, testUtils as coreTestUtils } from '@balena/jellyfish-core';
import type { ActionRequestContract } from '@balena/jellyfish-types/build/core';
import type { TriggeredActionContract } from '@balena/jellyfish-types/build/worker';
import _ from 'lodash';
import { testUtils } from '../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('.execute()', () => {
	test('should execute an action', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug: coreTestUtils.generateRandomSlug({ prefix: 'execute-test' }),
						version: '1.0.0',
						data: {
							foo: 'bar',
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const result: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);
		const card = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			result.data.id,
		);
		assert(card !== null);
		expect(card.data.foo).toBe('bar');
	});

	test('should execute a triggered action given a matching mode', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeCard !== null);
		assert(actionCard !== null);

		const command = coreTestUtils.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.logContext,
			Kernel.defaults({
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
								required: ['command'],
								properties: {
									command: {
										type: 'string',
										const: command,
									},
								},
							},
						},
					},
					mode: 'insert',
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		);

		const slug = coreTestUtils.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				logContext: ctx.logContext,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data: {
							command,
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const result = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		const card = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@latest`,
		);

		expect(card).toBeTruthy();

		const resultCard = await ctx.waitForMatch({
			type: 'object',
			properties: {
				slug: {
					const: slug,
				},
				data: {
					type: 'object',
					properties: {
						command: {
							const: command,
						},
					},
				},
			},
		});

		assert(resultCard !== null);

		expect(resultCard.data.command).toBe(command);
	});

	test('should not execute a triggered action given a non matching mode', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeCard !== null);
		assert(actionCard !== null);

		const command = coreTestUtils.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.logContext,
			Kernel.defaults({
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
								required: ['command'],
								properties: {
									command: {
										type: 'string',
										const: command,
									},
								},
							},
						},
					},
					mode: 'update',
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		);

		const slug = coreTestUtils.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				logContext: ctx.logContext,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data: {
							command,
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const result = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);

		const card = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@latest`,
		);

		expect(card).toBeFalsy();

		const resultCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${slug}@latest`,
		);

		assert(resultCard !== null);

		expect(resultCard.data.command).toBe(command);
	});

	test('should execute a triggered action with a top level anyOf', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeCard !== null);
		assert(actionCard !== null);

		const command = coreTestUtils.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.logContext,
			Kernel.defaults({
				id: coreTestUtils.generateRandomId(),
				slug: `triggered-action-${coreTestUtils.generateRandomId()}`,
				type: 'triggered-action@1.0.0',
				data: {
					filter: {
						type: 'object',
						required: ['data'],
						anyOf: [
							{
								properties: {
									data: {
										type: 'object',
										required: ['command'],
										properties: {
											command: {
												type: 'string',
												const: command,
											},
										},
									},
								},
							},
							{
								properties: {
									data: {
										type: 'string',
									},
								},
							},
						],
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		);

		const slug = coreTestUtils.generateRandomSlug();

		await new Promise((resolve) => {
			setTimeout(resolve, 5000);
		});

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				logContext: ctx.logContext,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug,
						data: {
							command,
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);

		const result = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		const card = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@latest`,
		);
		expect(card).toBeTruthy();
	});

	test('should add a create event when creating a card', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeCard !== null);
		assert(actionCard !== null);

		const slug = coreTestUtils.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				logContext: ctx.logContext,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug,
						data: {
							foo: 'bar',
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const result: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);

		const timeline = await ctx.kernel.query(ctx.logContext, ctx.session, {
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
							const: result.data.id,
						},
					},
				},
			},
		});

		expect(timeline.length).toBe(1);
		expect(timeline[0].type).toBe('create@1.0.0');
	});

	test('should be able to AGGREGATE based on the card timeline', async () => {
		jest.setTimeout(10 * 1000);
		const typeType = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = coreTestUtils.generateRandomSlug({ prefix: 'test-type' });
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeType.id,
				type: typeType.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data: {
							schema: {
								type: 'object',
								properties: {
									type: {
										type: 'string',
										const: `${slug}@1.0.0`,
									},
									data: {
										type: 'object',
										properties: {
											mentions: {
												type: 'array',
												$$formula:
													'AGGREGATE($events, "data.payload.mentions")',
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
		);

		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(typeResult.error).toBe(false);

		const threadRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeResult.data.id,
				type: typeResult.data.type,
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug: coreTestUtils.generateRandomSlug(),
						data: {
							mentions: [],
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const threadResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			threadRequest,
		);
		expect(threadResult.error).toBe(false);

		const messageRequest1 = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				logContext: ctx.logContext,
				card: threadResult.data.id,
				type: threadResult.data.type,
				arguments: {
					type: 'card',
					payload: {
						mentions: ['johndoe'],
						message: 'Hello',
					},
				},
			},
		);

		const messageRequest2 = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				logContext: ctx.logContext,
				card: threadResult.data.id,
				type: threadResult.data.type,
				arguments: {
					type: 'card',
					payload: {
						mentions: ['janedoe', 'johnsmith'],
						message: 'Hello',
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		await ctx.flush(ctx.session);
		const messageResult1 = await ctx.queue.producer.waitResults(
			ctx.logContext,
			messageRequest1,
		);
		const messageResult2 = await ctx.queue.producer.waitResults(
			ctx.logContext,
			messageRequest2,
		);

		expect(messageResult1.error).toBe(false);
		expect(messageResult2.error).toBe(false);

		await ctx.flushAll(ctx.session);

		const thread = await ctx.waitForMatch({
			type: 'object',
			properties: {
				id: {
					const: threadResult.data.id,
				},
				data: {
					type: 'object',
					properties: {
						mentions: {
							type: 'array',
							minItems: 3,
						},
					},
					required: ['mentions'],
				},
			},
			required: ['id', 'data'],
		});

		assert(thread !== null);

		expect(_.sortBy(thread.data.mentions as string[])).toEqual(
			_.sortBy(['johndoe', 'janedoe', 'johnsmith']),
		);
	});

	test('AGGREGATE should create a property on the target if it does not exist', async () => {
		const typeType = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = coreTestUtils.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeType.id,
				type: typeType.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data: {
							schema: {
								type: 'object',
								properties: {
									type: {
										type: 'string',
										const: `${slug}@1.0.0`,
									},
									data: {
										type: 'object',
										properties: {
											mentions: {
												type: 'array',
												$$formula:
													'AGGREGATE($events, "data.payload.mentions")',
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
		);

		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(typeResult.error).toBe(false);

		const threadRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeResult.data.id,
				type: typeResult.data.type,
				arguments: {
					reason: null,
					properties: {
						slug: coreTestUtils.generateRandomSlug(),
						version: '1.0.0',
						data: {},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const threadResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			threadRequest,
		);
		expect(threadResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				logContext: ctx.logContext,
				card: threadResult.data.id,
				type: threadResult.data.type,
				arguments: {
					type: 'card',
					tags: [],
					payload: {
						mentions: ['johndoe'],
						message: 'Hello',
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const messageResult = await ctx.queue.producer.waitResults(
			ctx.logContext,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		await ctx.flushAll(ctx.session);

		await expect(
			ctx.waitForMatch({
				type: 'object',
				properties: {
					id: {
						const: threadResult.data.id,
					},
					data: {
						type: 'object',
						properties: {
							mentions: {
								type: 'array',
								contains: {
									const: 'johndoe',
								},
							},
						},
						required: ['mentions'],
					},
				},
				required: ['id', 'data'],
			}),
		).resolves.toBeTruthy();
	});

	test('AGGREGATE should work with $$ prefixed properties', async () => {
		const typeType = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = coreTestUtils.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeType.id,
				type: typeType.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data: {
							schema: {
								type: 'object',
								properties: {
									type: {
										type: 'string',
										const: `${slug}@1.0.0`,
									},
									data: {
										type: 'object',
										properties: {
											$$mentions: {
												type: 'array',
												$$formula:
													'AGGREGATE($events, "data.payload[\'$$mentions\']")',
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
		);

		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(typeResult.error).toBe(false);

		const threadRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeResult.data.id,
				type: 'type',
				arguments: {
					reason: null,
					properties: {
						slug: coreTestUtils.generateRandomSlug(),
						version: '1.0.0',
						data: {
							$$mentions: [],
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const threadResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			threadRequest,
		);

		expect(threadResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				card: threadResult.data.id,
				logContext: ctx.logContext,
				type: slug,
				arguments: {
					type: 'card',
					tags: [],
					payload: {
						$$mentions: ['johndoe'],
						message: 'Hello',
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const messageResult = await ctx.queue.producer.waitResults(
			ctx.logContext,
			messageRequest,
		);

		expect(messageResult.error).toBe(false);

		await ctx.flushAll(ctx.session);

		await expect(
			ctx.waitForMatch({
				type: 'object',
				properties: {
					id: {
						const: threadResult.data.id,
					},
					data: {
						type: 'object',
						properties: {
							$$mentions: {
								type: 'array',
								contains: {
									const: 'johndoe',
								},
							},
						},
						required: ['$$mentions'],
					},
				},
				required: ['id', 'data'],
			}),
		).resolves.toBeTruthy();
	});

	test('should create a message with tags', async () => {
		const typeType = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = coreTestUtils.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeType.id,
				type: typeType.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data: {
							schema: {
								type: 'object',
								properties: {
									type: {
										type: 'string',
										const: `${slug}@1.0.0`,
									},
								},
								additionalProperties: true,
								required: ['type'],
							},
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const typeResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(typeResult.error).toBe(false);

		const threadRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeResult.data.id,
				type: typeResult.data.type,
				arguments: {
					reason: null,
					properties: {
						slug: coreTestUtils.generateRandomSlug(),
						version: '1.0.0',
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const threadResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			threadRequest,
		);
		expect(threadResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				logContext: ctx.logContext,
				card: threadResult.data.id,
				type: threadResult.data.type,
				arguments: {
					type: 'card',
					tags: ['testtag'],
					payload: {
						$$mentions: ['johndoe'],
						message: 'Hello',
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const messageResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			messageRequest,
		);

		expect(messageResult.error).toBe(false);

		const element = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			messageResult.data.id,
		);

		assert(element !== null);

		expect(element.tags).toEqual(['testtag']);
	});

	test('should add an execution event to the action request', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);
		assert(typeCard !== null);
		assert(actionCard !== null);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				logContext: ctx.logContext,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug: coreTestUtils.generateRandomSlug(),
						version: '1.0.0',
						data: {
							foo: 'bar',
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const result = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(false);

		const timeline = await ctx.kernel.query(ctx.logContext, ctx.session, {
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
							const: request.id,
						},
					},
				},
			},
		});

		expect(timeline.length).toBe(1);
		expect(timeline[0].type).toBe('execute@1.0.0');
	});

	test('should execute a triggered action', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);
		assert(typeCard !== null);
		assert(actionCard !== null);

		const command = coreTestUtils.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.logContext,
			Kernel.defaults({
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
								required: ['command'],
								properties: {
									command: {
										type: 'string',
										const: command,
									},
								},
							},
						},
					},
					action: 'action-create-card@1.0.0',
					target: typeCard.id,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: command,
						},
					},
				},
			}) as TriggeredActionContract,
		);

		const slug = coreTestUtils.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				logContext: ctx.logContext,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data: {
							command,
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const result = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);

		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		const card = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${command}@latest`,
		);

		expect(card).toBeTruthy();

		await ctx.flushAll(ctx.session);

		const resultCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			`${slug}@latest`,
		);

		assert(resultCard !== null);

		expect(resultCard.data.command).toBe(command);
	});

	test('should create a card', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const slug = coreTestUtils.generateRandomSlug();
		const actionRequest = await ctx.kernel.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			{
				slug: `action-request-${coreTestUtils.generateRandomId()}`,
				type: 'action-request@1.0.0',
				data: {
					actor: ctx.adminUserId,
					context: ctx.logContext,
					action: 'action-create-card@1.0.0',
					epoch: 1530663772247,
					timestamp: '2018-07-04T00:22:52.247Z',
					input: {
						id: typeCard.id,
						type: typeCard.type,
					},
					arguments: {
						reason: null,
						properties: {
							slug,
							version: '1.0.0',
						},
					},
				},
			},
		);

		const result = await ctx.worker.execute(ctx.session, actionRequest);

		expect(result.data).toEqual({
			id: result.data.id,
			type: 'card@1.0.0',
			version: '1.0.0',
			slug,
		});
	});

	test('should throw if the input card does not exist', async () => {
		const actionRequest = await ctx.kernel.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			{
				slug: `action-request-${coreTestUtils.generateRandomId()}`,
				type: 'action-request@1.0.0',
				data: {
					actor: ctx.adminUserId,
					context: ctx.logContext,
					action: 'action-create-card@1.0.0',
					epoch: 1530663772247,
					timestamp: '2018-07-04T00:22:52.247Z',
					input: {
						// Make up a new UUID that doesn't correspond to any contract
						id: coreTestUtils.generateRandomId(),
						type: 'card@1.0.0',
					},
					arguments: {
						reason: null,
						properties: {
							slug: coreTestUtils.generateRandomSlug(),
							version: '1.0.0',
						},
					},
				},
			},
		);

		const result = await ctx.worker.execute(ctx.session, actionRequest);
		expect(result.error).toBe(true);
		expect(result.data.name).toBe('WorkerNoElement');
	});

	test('should throw if the actor does not exist', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const actionRequest = await ctx.kernel.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			{
				slug: `action-request-${coreTestUtils.generateRandomId()}`,
				type: 'action-request@1.0.0',
				data: {
					actor: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
					context: ctx.logContext,
					action: 'action-create-card@1.0.0',
					epoch: 1530663772247,
					timestamp: '2018-07-04T00:22:52.247Z',
					input: {
						id: typeCard.id,
						type: typeCard.type,
					},
					arguments: {
						reason: null,
						properties: {
							slug: coreTestUtils.generateRandomSlug(),
							version: '1.0.0',
						},
					},
				},
			},
		);

		const result = await ctx.worker.execute(ctx.session, actionRequest);
		expect(result.error).toBe(true);
		expect(result.data.name).toBe('WorkerNoElement');
	});

	test('should throw if input card does not match the action filter', async () => {
		const actionCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'action-create-card@latest',
		);

		assert(actionCard !== null);

		const actionRequest = await ctx.kernel.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			{
				slug: `action-request-${coreTestUtils.generateRandomId()}`,
				type: 'action-request@1.0.0',
				data: {
					actor: ctx.adminUserId,
					context: ctx.logContext,
					action: 'action-create-card@1.0.0',
					epoch: 1530663772247,
					timestamp: '2018-07-04T00:22:52.247Z',
					input: {
						id: actionCard.id,
						type: actionCard.type,
					},
					arguments: {
						reason: null,
						properties: {
							slug: coreTestUtils.generateRandomSlug(),
							version: '1.0.0',
						},
					},
				},
			},
		);

		// The input filter on action-create-card checks that the input contracts has
		// a type of "type". If it doesn't, the action request is rejected.
		const result = await ctx.worker.execute(ctx.session, actionRequest);
		expect(result.error).toBe(true);
		expect(result.data.name).toBe('WorkerSchemaMismatch');
	});

	test('should return an error if the arguments do not match the action', async () => {
		const typeCard = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const actionRequest = await ctx.kernel.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			{
				slug: `action-request-${coreTestUtils.generateRandomId()}`,
				type: 'action-request@1.0.0',
				data: {
					actor: ctx.adminUserId,
					context: ctx.logContext,
					action: 'action-create-card@1.0.0',
					epoch: 1530663772247,
					timestamp: '2018-07-04T00:22:52.247Z',
					input: {
						id: typeCard.id,
						type: typeCard.type,
					},
					arguments: {
						foo: 'bar',
						bar: 'baz',
					},
				},
			},
		);

		const result = await ctx.worker.execute(ctx.session, actionRequest);
		expect(result.error).toBe(true);
		expect(result.data.name).toBe('WorkerSchemaMismatch');
	});

	test('should return an error if the action has no corresponding implementation', async () => {
		const localCtx = await testUtils.newContext({
			// plugins: [DefaultPlugin, ActionLibrary, ProductOsPlugin],
		});

		const action = 'action-create-card@1.0.0';

		// Remove the library function from the worker instance
		Reflect.deleteProperty(localCtx.worker.library, action.split('@')[0]);

		const typeCard = await localCtx.kernel.getContractBySlug(
			localCtx.logContext,
			localCtx.session,
			'card@latest',
		);
		assert(typeCard !== null);

		const actionRequest =
			await localCtx.kernel.insertCard<ActionRequestContract>(
				localCtx.logContext,
				localCtx.session,
				{
					slug: `action-request-${coreTestUtils.generateRandomId()}`,
					type: 'action-request@1.0.0',
					data: {
						actor: localCtx.adminUserId,
						context: localCtx.logContext,
						action,
						epoch: 1530663772247,
						timestamp: '2018-07-04T00:22:52.247Z',
						input: {
							id: typeCard.id,
							type: typeCard.type,
						},
						arguments: {
							reason: null,
							properties: {
								slug: coreTestUtils.generateRandomSlug(),
								version: '1.0.0',
							},
						},
					},
				},
			);

		const result = await localCtx.worker.execute(
			localCtx.session,
			actionRequest,
		);
		expect(result.error).toBe(true);
		expect(result.data.name).toBe('WorkerInvalidAction');

		await testUtils.destroyContext(localCtx);
	});
});
