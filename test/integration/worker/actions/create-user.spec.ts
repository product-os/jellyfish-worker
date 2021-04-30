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

describe('action-create-user', () => {
	it('should not store the password in the queue when using action-create-user', async () => {
		const { jellyfish, session, context, worker, queue, flush } = ctx;
		const userCard = await jellyfish.getCardBySlug(
			context,
			session,
			'user@latest',
		);
		const password = 'foobarbaz';

		assert(userCard !== null);

		const request = await worker.pre(session, {
			action: 'action-create-user@1.0.0',
			context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				email: 'johndoe@example.com',
				username: 'user-johndoe',
				password,
			},
		});

		const createUserRequest = await queue.producer.enqueue(
			worker.getId(),
			session,
			request,
		);
		expect((createUserRequest.data.arguments.password as any).string).not.toBe(
			password,
		);

		await flush(session);
		const result = await queue.producer.waitResults(context, createUserRequest);
		expect(result.error).toBe(false);
	});

	it('should use the PASSWORDLESS_USER_HASH when the supplied password is an empty string', async () => {
		const { jellyfish, context, session, worker, queue } = ctx;
		const userCard = await jellyfish.getCardBySlug(
			context,
			session,
			'user@latest',
		);

		assert(userCard !== null);

		const request = await worker.pre(session, {
			action: 'action-create-user@1.0.0',
			context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				email: 'johndoe@example.com',
				username: 'user-johndoe',
				password: '',
			},
		});
		const createUserRequest = await queue.producer.enqueue(
			worker.getId(),
			session,
			request,
		);
		expect(createUserRequest.data.arguments.password).toBe('PASSWORDLESS');
	});
});
