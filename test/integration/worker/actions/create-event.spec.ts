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

describe('action-create-event', () => {
	it('should create a link card', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const cardRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {},
				},
			},
		);

		await ctx.flush(ctx.session);
		const cardResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			cardRequest,
		);
		expect(cardResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
				card: cardResult.data.id,
				type: cardResult.data.type,
				arguments: {
					type: 'message',
					tags: [],
					payload: {
						message: 'johndoe',
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

		const [link] = await ctx.jellyfish.query(ctx.context, ctx.session, {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'link@1.0.0',
				},
				data: {
					type: 'object',
					properties: {
						from: {
							type: 'object',
							properties: {
								id: {
									type: 'string',
									const: messageResult.data.id,
								},
							},
							required: ['id'],
						},
					},
					required: ['from'],
				},
			},
			required: ['type', 'data'],
			additionalProperties: true,
		});

		expect(link).toEqual(
			ctx.jellyfish.defaults({
				created_at: link.created_at,
				id: link.id,
				slug: link.slug,
				name: 'is attached to',
				type: 'link@1.0.0',
				data: {
					inverseName: 'has attached element',
					from: {
						id: messageResult.data.id,
						type: 'message@1.0.0',
					},
					to: {
						id: cardResult.data.id,
						type: 'card@1.0.0',
					},
				},
			}),
		);
	});

	it('should be able to add an event name', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const cardRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {},
				},
			},
		);

		await ctx.flush(ctx.session);
		const cardResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			cardRequest,
		);
		expect(cardResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
				card: cardResult.data.id,
				type: cardResult.data.type,
				arguments: {
					type: 'message',
					name: 'Hello world',
					tags: [],
					payload: {
						message: 'johndoe',
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

		const event = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			messageResult.data.id,
		);

		assert(event !== null);

		expect(event.name).toBe('Hello world');
	});

	it("events should always inherit their parent's markers", async () => {
		const { context, jellyfish, session } = ctx;

		const marker = 'org-test';
		const typeCard = await jellyfish.getCardBySlug(
			context,
			session,
			'card@latest',
		);

		assert(typeCard !== null);

		const cardRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						markers: [marker],
					},
				},
			},
		);

		await ctx.flush(ctx.session);
		const cardResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			cardRequest,
		);
		expect(cardResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
				card: cardResult.data.id,
				type: cardResult.data.type,
				arguments: {
					type: 'message',
					tags: [],
					payload: {
						message: 'johndoe',
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

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			messageResult.data.id,
		);

		assert(card !== null);

		expect(card.markers).toEqual([marker]);
	});
});
