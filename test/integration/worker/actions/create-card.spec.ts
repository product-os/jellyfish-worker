/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as helpers from '../helpers';
import { strict as assert } from 'assert';

let ctx: helpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await helpers.worker.before();
});

afterAll(() => {
	return helpers.worker.after(ctx);
});

describe('action-create-card', () => {
	it('should fail to create an event with an action-create-card', async () => {
		const cardType = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		const typeType = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);

		assert(typeType !== null);
		assert(cardType !== null);

		const id = await ctx.queue.producer.enqueue(
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
						slug: 'test-thread',
						version: '1.0.0',
						data: {
							schema: {
								type: 'object',
								properties: {
									type: {
										type: 'string',
										const: 'test-thread@1.0.0',
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
		const typeResult = await ctx.queue.producer.waitResults(ctx.context, id);

		expect(typeResult.error).toBe(false);

		const threadId = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: (typeResult.data as any).id,
				type: (typeResult.data as any).type,
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
		const threadResult = await ctx.queue.producer.waitResults(
			ctx.context,
			threadId,
		);
		expect(threadResult.error).toBe(false);

		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, {
			action: 'action-create-card@1.0.0',
			card: cardType.id,
			context: ctx.context,
			type: cardType.type,
			arguments: {
				reason: null,
				properties: {
					version: '1.0.0',
					slug: 'bar',
					data: {
						timestamp: '2018-05-05T00:21:02.459Z',
						target: (threadResult.data as any).id,
						actor: ctx.actor.id,
						payload: {
							mentions: ['johndoe'],
						},
					},
				},
			},
		});

		await expect(ctx.flush(ctx.session)).rejects.toThrow(
			'You may not use card actions to create an event',
		);
	});

	it('should create a new card along with a reason', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: 'My new card',
					properties: {
						slug: ctx.generateRandomSlug(),
						version: '1.0.0',
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const createResult = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const timeline = await ctx.jellyfish.query(ctx.context, ctx.session, {
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
					additionalProperties: true,
					properties: {
						target: {
							type: 'string',
							const: (createResult.data as any).id,
						},
					},
				},
			},
		});

		expect(timeline.length).toBe(1);
		expect(timeline[0].name).toBe('My new card');
	});

	it('should be able to insert a deeply nested card', async () => {
		const data = {
			foo: {
				bar: {
					baz: {
						qux: {
							foo: {
								bar: {
									baz: {
										qux: {
											foo: {
												bar: {
													baz: {
														qux: {
															foo: {
																bar: {
																	baz: {
																		qux: {
																			test: 1,
																		},
																	},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		};

		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard !== null);
		const slug = ctx.generateRandomSlug();
		const createRequest = await ctx.queue.producer.enqueue(
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
						slug,
						version: '1.0.0',
						data,
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const createResult = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			(createResult.data as any).id,
		);

		assert(card !== null);

		expect(card.slug).toBe(slug);
		expect(card.version).toBe('1.0.0');
		expect(card.data).toEqual(data);
	});
});
