/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as _ from 'lodash';
import * as helpers from './helpers';
import { v4 as uuidv4 } from 'uuid';
import { strict as assert } from 'assert';
import { TriggeredActionContract } from '@balena/jellyfish-types/build/worker';
import Bluebird from 'bluebird';

let ctx: helpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await helpers.before();
});

afterAll(() => {
	return helpers.after(ctx);
});

describe('.execute()', () => {
	test('should execute an action', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug: ctx.generateRandomSlug({ prefix: 'execute-test' }),
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
			ctx.context,
			request,
		);

		expect(result.error).toBe(false);
		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			result.data.id,
		);
		assert(card !== null);
		expect(card.data.foo).toBe('bar');
	});

	test('should execute a triggered action given a matching mode', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeCard !== null);
		assert(actionCard !== null);

		const command = ctx.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.context,
			ctx.jellyfish.defaults({
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

		const slug = ctx.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: ctx.context,
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
		const result = await ctx.queue.producer.waitResults(ctx.context, request);

		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		const card = await ctx.jellyfish.getCardBySlug(
			ctx.context,
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
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeCard !== null);
		assert(actionCard !== null);

		const command = ctx.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.context,
			ctx.jellyfish.defaults({
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

		const slug = ctx.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: ctx.context,
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
		const result = await ctx.queue.producer.waitResults(ctx.context, request);

		expect(result.error).toBe(false);

		const card = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command}@latest`,
		);

		expect(card).toBeFalsy();

		const resultCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${slug}@latest`,
		);

		assert(resultCard !== null);

		expect(resultCard.data.command).toBe(command);
	});

	test('should execute a triggered action with a top level anyOf', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeCard !== null);
		assert(actionCard !== null);

		const command = ctx.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.context,
			ctx.jellyfish.defaults({
				id: uuidv4(),
				slug: `triggered-action-${uuidv4()}`,
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

		const slug = ctx.generateRandomSlug();

		await Bluebird.delay(5000);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: ctx.context,
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

		const result = await ctx.queue.producer.waitResults(ctx.context, request);

		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		const card = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command}@latest`,
		);
		expect(card).toBeTruthy();
	});

	test('should add a create event when creating a card', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);

		assert(typeCard !== null);
		assert(actionCard !== null);

		const slug = ctx.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: ctx.context,
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
			ctx.context,
			request,
		);

		expect(result.error).toBe(false);

		const timeline = await ctx.jellyfish.query(ctx.context, ctx.session, {
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
		const typeType = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = ctx.generateRandomSlug({ prefix: 'test-type' });
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
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
			ctx.context,
			request,
		);

		expect(typeResult.error).toBe(false);

		const threadRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeResult.data.id,
				type: typeResult.data.type,
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug: ctx.generateRandomSlug(),
						data: {
							mentions: [],
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const threadResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			threadRequest,
		);
		expect(threadResult.error).toBe(false);

		const messageRequest1 = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
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

		const messageRequest2 = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
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

		await ctx.flush(ctx.session);
		await ctx.flush(ctx.session);
		const messageResult1 = await ctx.queue.producer.waitResults(
			ctx.context,
			messageRequest1,
		);
		const messageResult2 = await ctx.queue.producer.waitResults(
			ctx.context,
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
		const typeType = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = ctx.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
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
			ctx.context,
			request,
		);
		expect(typeResult.error).toBe(false);

		const threadRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeResult.data.id,
				type: typeResult.data.type,
				arguments: {
					reason: null,
					properties: {
						slug: ctx.generateRandomSlug(),
						version: '1.0.0',
						data: {},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const threadResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			threadRequest,
		);
		expect(threadResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
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

		await ctx.flush(ctx.session);
		const messageResult = await ctx.queue.producer.waitResults(
			ctx.context,
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
		const typeType = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = ctx.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
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
			ctx.context,
			request,
		);

		expect(typeResult.error).toBe(false);

		const threadRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeResult.data.id,
				type: 'type',
				arguments: {
					reason: null,
					properties: {
						slug: ctx.generateRandomSlug(),
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
			ctx.context,
			threadRequest,
		);

		expect(threadResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				card: threadResult.data.id,
				context: ctx.context,
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

		await ctx.flush(ctx.session);
		const messageResult = await ctx.queue.producer.waitResults(
			ctx.context,
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
		const typeType = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);

		const slug = ctx.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
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
			ctx.context,
			request,
		);
		expect(typeResult.error).toBe(false);

		const threadRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeResult.data.id,
				type: typeResult.data.type,
				arguments: {
					reason: null,
					properties: {
						slug: ctx.generateRandomSlug(),
						version: '1.0.0',
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const threadResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			threadRequest,
		);
		expect(threadResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
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

		await ctx.flush(ctx.session);
		const messageResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			messageRequest,
		);

		expect(messageResult.error).toBe(false);

		const element = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			messageResult.data.id,
		);

		assert(element !== null);

		expect(element.tags).toEqual(['testtag']);
	});

	test('should add an execution event to the action request', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
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
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug: ctx.generateRandomSlug(),
						version: '1.0.0',
						data: {
							foo: 'bar',
						},
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const result = await ctx.queue.producer.waitResults(ctx.context, request);
		expect(result.error).toBe(false);

		const timeline = await ctx.jellyfish.query(ctx.context, ctx.session, {
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
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);
		assert(typeCard !== null);
		assert(actionCard !== null);

		const command = ctx.generateRandomSlug();
		ctx.worker.upsertTrigger(
			ctx.context,
			ctx.jellyfish.defaults({
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

		const slug = ctx.generateRandomSlug();
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: `${actionCard.slug}@${actionCard.version}`,
				context: ctx.context,
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
		const result = await ctx.queue.producer.waitResults(ctx.context, request);

		expect(result.error).toBe(false);

		await ctx.flushAll(ctx.session);

		const card = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command}@latest`,
		);

		expect(card).toBeTruthy();

		await ctx.flushAll(ctx.session);

		const resultCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${slug}@latest`,
		);

		assert(resultCard !== null);

		expect(resultCard.data.command).toBe(command);
	});
});
