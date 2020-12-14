/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import * as helpers from './helpers';

let context: any;

beforeAll(async () => {
	context = await helpers.worker.before();

	context.waitForMatch = async (waitQuery: any, times = 20) => {
		if (times === 0) {
			throw new Error('The wait query did not resolve');
		}
		const results = await context.jellyfish.query(
			context.context,
			context.session,
			waitQuery,
		);
		if (results.length > 0) {
			return results[0];
		}
		await Bluebird.delay(500);
		return context.waitForMatch(waitQuery, times - 1);
	};
});

afterAll(() => {
	return helpers.worker.after(context);
});

describe('.execute()', () => {
	test('should execute an action', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug: context.generateRandomSlug(),
						version: '1.0.0',
						data: {
							foo: 'bar',
						},
					},
				},
			},
		);

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);

		expect(result.error).toBe(false);
		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result.data.id,
		);
		expect(card.data.foo).toBe('bar');
	});

	test('should execute a triggered action given a matching mode', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const command = context.generateRandomSlug();
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
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
		]);

		const slug = context.generateRandomSlug();
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: context.context,
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

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);

		expect(result.error).toBe(false);

		const card = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@latest`,
		);
		expect(card).toBeTruthy();

		const resultCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${slug}@latest`,
		);

		expect(resultCard.data.command).toBe(command);
	});

	test('should not execute a triggered action given a non matching mode', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const command = context.generateRandomSlug();
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
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
		]);

		const slug = context.generateRandomSlug();
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: context.context,
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

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);

		expect(result.error).toBe(false);

		const card = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@latest`,
		);

		expect(card).toBeFalsy();

		const resultCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${slug}@latest`,
		);

		expect(resultCard.data.command).toBe(command);
	});

	test('should not execute a triggered action with a future start date', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const command = context.generateRandomSlug();
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
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
				startDate: '2500-01-01T00:00:00.000Z',
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
		]);

		const slug = context.generateRandomSlug();
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: context.context,
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

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);

		expect(result.error).toBe(false);

		const card = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@latest`,
		);

		expect(card).toBeFalsy();
	});

	test('should execute a triggered action with a top level anyOf', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const command = context.generateRandomSlug();
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
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
		]);

		const slug = context.generateRandomSlug();
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: context.context,
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

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		const card = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@latest`,
		);
		expect(card).toBeTruthy();
	});

	test('should add a create event when creating a card', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const slug = context.generateRandomSlug();
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: context.context,
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

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		const timeline = await context.jellyfish.query(
			context.context,
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
								const: result.data.id,
							},
						},
					},
				},
			},
		);

		expect(timeline.length).toBe(1);
		expect(timeline[0].type).toBe('create@1.0.0');
	});

	test('should be able to AGGREGATE based on the card timeline', async () => {
		const typeType = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug({ prefix: 'test-type' });
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
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

		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(typeResult.error).toBe(false);

		const threadRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
				card: typeResult.data.id,
				type: typeResult.data.type,
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug: context.generateRandomSlug(),
						data: {
							mentions: [],
						},
					},
				},
			},
		);

		await context.flush(context.session);
		const threadResult = await context.queue.producer.waitResults(
			context.context,
			threadRequest,
		);
		expect(threadResult.error).toBe(false);

		const messageRequest1 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: threadResult.data.id,
				type: threadResult.data.type,
				arguments: {
					type: 'message',
					payload: {
						mentions: ['johndoe'],
						message: 'Hello',
					},
				},
			},
		);

		const messageRequest2 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: threadResult.data.id,
				type: threadResult.data.type,
				arguments: {
					type: 'message',
					payload: {
						mentions: ['janedoe', 'johnsmith'],
						message: 'Hello',
					},
				},
			},
		);

		await context.flush(context.session);
		await context.flush(context.session);
		const messageResult1 = await context.queue.producer.waitResults(
			context.context,
			messageRequest1,
		);
		const messageResult2 = await context.queue.producer.waitResults(
			context.context,
			messageRequest2,
		);

		expect(messageResult1.error).toBe(false);
		expect(messageResult2.error).toBe(false);

		// AGGREGATE is asynchronous, so we will need to wait for the actions to be processed
		const thread = await context.waitForMatch({
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

		expect(_.sortBy(thread.data.mentions)).toEqual(
			_.sortBy(['johndoe', 'janedoe', 'johnsmith']),
		);
	});

	test('AGGREGATE should create a property on the target if it does not exist', async () => {
		const typeType = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
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

		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(typeResult.error).toBe(false);

		const threadRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
				card: typeResult.data.id,
				type: typeResult.data.type,
				arguments: {
					reason: null,
					properties: {
						slug: context.generateRandomSlug(),
						version: '1.0.0',
						data: {},
					},
				},
			},
		);

		await context.flush(context.session);
		const threadResult = await context.queue.producer.waitResults(
			context.context,
			threadRequest,
		);
		expect(threadResult.error).toBe(false);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: threadResult.data.id,
				type: threadResult.data.type,
				arguments: {
					type: 'message',
					tags: [],
					payload: {
						mentions: ['johndoe'],
						message: 'Hello',
					},
				},
			},
		);

		await context.flush(context.session);
		const messageResult = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		await expect(
			context.waitForMatch({
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
		const typeType = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
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

		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			request,
		);

		expect(typeResult.error).toBe(false);

		const threadRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
				card: typeResult.data.id,
				type: 'type',
				arguments: {
					reason: null,
					properties: {
						slug: context.generateRandomSlug(),
						version: '1.0.0',
						data: {
							$$mentions: [],
						},
					},
				},
			},
		);

		await context.flush(context.session);
		const threadResult = await context.queue.producer.waitResults(
			context.context,
			threadRequest,
		);

		expect(threadResult.error).toBe(false);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				card: threadResult.data.id,
				context: context.context,
				type: slug,
				arguments: {
					type: 'message',
					tags: [],
					payload: {
						$$mentions: ['johndoe'],
						message: 'Hello',
					},
				},
			},
		);

		await context.flush(context.session);
		const messageResult = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);

		expect(messageResult.error).toBe(false);

		await expect(
			context.waitForMatch({
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
		const typeType = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		const slug = context.generateRandomSlug();
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
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

		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(typeResult.error).toBe(false);

		const threadRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
				card: typeResult.data.id,
				type: typeResult.data.type,
				arguments: {
					reason: null,
					properties: {
						slug: context.generateRandomSlug(),
						version: '1.0.0',
					},
				},
			},
		);

		await context.flush(context.session);
		const threadResult = await context.queue.producer.waitResults(
			context.context,
			threadRequest,
		);
		expect(threadResult.error).toBe(false);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: threadResult.data.id,
				type: threadResult.data.type,
				arguments: {
					type: 'message',
					tags: ['testtag'],
					payload: {
						$$mentions: ['johndoe'],
						message: 'Hello',
					},
				},
			},
		);

		await context.flush(context.session);
		const messageResult = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);

		expect(messageResult.error).toBe(false);

		const element = await context.jellyfish.getCardById(
			context.context,
			context.session,
			messageResult.data.id,
			{
				type: messageResult.data.type,
			},
		);

		expect(element.tags).toEqual(['testtag']);
	});

	test('should add an execution event to the action request', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: context.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug: context.generateRandomSlug(),
						version: '1.0.0',
						data: {
							foo: 'bar',
						},
					},
				},
			},
		);

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		const timeline = await context.jellyfish.query(
			context.context,
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
								const: request.id,
							},
						},
					},
				},
			},
		);

		expect(timeline.length).toBe(1);
		expect(timeline[0].type).toBe('execute@1.0.0');
	});

	test('should execute a triggered action', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const command = context.generateRandomSlug();
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
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
		]);

		const slug = context.generateRandomSlug();
		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: context.context,
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

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);

		expect(result.error).toBe(false);

		const card = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@latest`,
		);

		expect(card).toBeTruthy();

		const resultCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${slug}@latest`,
		);

		expect(resultCard.data.command).toBe(command);
	});
});
