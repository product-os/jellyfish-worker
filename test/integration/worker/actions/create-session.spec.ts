/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as Bluebird from 'bluebird';
import * as helpers from '../helpers';
import { strict as assert } from 'assert';

let ctx: helpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await helpers.worker.before();
});

afterAll(() => {
	return helpers.worker.after(ctx);
});

describe('action-create-session', () => {
	it('should not store the password in the queue', async () => {
		const userCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'user@latest',
		);

		assert(userCard !== null);

		const request1 = await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			context: ctx.context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				email: 'johndoe@example.com',
				username: 'user-johndoe',
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request1,
		);

		await ctx.flush(ctx.session);
		const result = await ctx.queue.producer.waitResults(
			ctx.context,
			createUserRequest,
		);
		expect(result.error).toBe(false);

		const plaintextPassword = 'foobarbaz';

		const request2 = await ctx.worker.pre(ctx.session, {
			action: 'action-create-session@1.0.0',
			context: ctx.context,
			card: (result.data as any).id,
			type: (result.data as any).type,
			arguments: {
				password: plaintextPassword,
			},
		});

		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, request2);

		await Bluebird.delay(2000);

		const request: any = await ctx.dequeue();
		expect(request).toBeTruthy();
		expect(request.data.arguments.password).not.toBe(plaintextPassword);
	});
});
