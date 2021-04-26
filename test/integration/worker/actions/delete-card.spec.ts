/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { strict as assert } from 'assert';
import * as helpers from '../helpers';

let ctx: helpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await helpers.worker.before();
});

afterAll(() => {
	return helpers.worker.after(ctx);
});

describe('action-delete-card', () => {
	it('should delete a card', async () => {
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
					reason: null,
					properties: {
						slug: 'foo',
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

		const deleteRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-delete-card@1.0.0',
				context: ctx.context,
				card: (createResult.data as any).id,
				type: (createResult.data as any).type,
				arguments: {},
			},
		);

		await ctx.flush(ctx.session);
		const deleteResult = await ctx.queue.producer.waitResults(
			ctx.context,
			deleteRequest,
		);
		expect(deleteResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			(deleteResult.data as any).id,
		);
		assert(card !== null);
		expect(card).toEqual(
			ctx.kernel.defaults({
				created_at: card.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: (deleteResult.data as any).id,
				name: null,
				version: '1.0.0',
				slug: 'foo',
				type: 'card@1.0.0',
				active: false,
				links: card.links,
			}),
		);
	});
});
