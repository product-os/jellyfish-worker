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

describe('action-set-password', () => {
	it('should not store the passwords in the queue when using action-set-password', async () => {
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
				username: ctx.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request1,
		);

		await ctx.flush(ctx.session);
		const result: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createUserRequest,
		);
		expect(result.error).toBe(false);

		const plaintextPassword = 'foobarbaz';

		const request2 = await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			context: ctx.context,
			card: result.data.id,
			type: result.data.type,
			arguments: {
				currentPassword: plaintextPassword,
				newPassword: 'new-password',
			},
		});

		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, request2);

		const request: any = await ctx.dequeue();

		expect(request).toBeTruthy();
		expect(request.data.arguments.currentPassword).toBeTruthy();
		expect(request.data.arguments.newPassword).toBeTruthy();
		expect(request.data.arguments.currentPassword).not.toBe(plaintextPassword);
		expect(request.data.arguments.newPassword).not.toBe('new-password');
	});

	it('should change the password of a password-less user given no password', async () => {
		const userCard = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			slug: ctx.generateRandomSlug({
				prefix: 'user',
			}),
			type: 'user@1.0.0',
			data: {
				email: 'johndoe@example.com',
				hash: 'PASSWORDLESS',
				roles: ['user-community'],
			},
		});

		const resetRequestPre = await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			context: ctx.context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				currentPassword: null,
				newPassword: 'new-password',
			},
		});

		const resetRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			resetRequestPre,
		);
		await ctx.flush(ctx.session);
		const resetResult = await ctx.queue.producer.waitResults(
			ctx.context,
			resetRequest,
		);
		expect(resetResult.error).toBe(false);

		const loginRequestPre = await ctx.worker.pre(ctx.session, {
			action: 'action-create-session@1.0.0',
			card: userCard.id,
			context: ctx.context,
			type: userCard.type,
			arguments: {
				password: 'new-password',
			},
		});

		const loginRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			loginRequestPre,
		);
		await ctx.flush(ctx.session);
		const loginResult = await ctx.queue.producer.waitResults(
			ctx.context,
			loginRequest,
		);
		expect(loginResult.error).toBe(false);

		const user = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			userCard.id,
		);

		assert(user !== null);

		expect(user.data.hash).not.toBe('new-password');
	});

	it('should change a user password', async () => {
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
				username: ctx.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request1,
		);

		await ctx.flush(ctx.session);
		const signupResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		const plaintextPassword = 'foobarbaz';

		const request2 = await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			context: ctx.context,
			card: signupResult.data.id,
			type: signupResult.data.type,
			arguments: {
				currentPassword: plaintextPassword,
				newPassword: 'new-password',
			},
		});

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request2,
		);
		await ctx.flush(ctx.session);
		const result = await ctx.queue.producer.waitResults(ctx.context, request);
		expect(result.error).toBe(false);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-create-session@1.0.0',
				card: signupResult.data.id,
				context: ctx.context,
				type: signupResult.data.type,
				arguments: {
					password: plaintextPassword,
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);

		const request3 = await ctx.worker.pre(ctx.session, {
			action: 'action-create-session@1.0.0',
			card: signupResult.data.id,
			context: ctx.context,
			type: signupResult.data.type,
			arguments: {
				password: 'new-password',
			},
		});

		const loginRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request3,
		);
		await ctx.flush(ctx.session);
		const loginResult = await ctx.queue.producer.waitResults(
			ctx.context,
			loginRequest,
		);
		expect(loginResult.error).toBe(false);
	});

	it('should not change a user password given invalid current password', async () => {
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
				username: ctx.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request1,
		);

		await ctx.flush(ctx.session);
		const signupResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: signupResult.data.id,
				type: signupResult.data.type,
				arguments: {
					currentPassword: 'xxxxxxxxxxxxxxxxxxxxxx',
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	it('should not change a user password given a null current password', async () => {
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
				username: ctx.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request1,
		);

		await ctx.flush(ctx.session);
		const signupResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: signupResult.data.id,
				type: signupResult.data.type,
				arguments: {
					currentPassword: null,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	it('should change the hash when updating a user password', async () => {
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
		const signupResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		const userBefore = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			signupResult.data.id,
		);

		const plaintextPassword = 'foobarbaz';

		const request2 = await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			context: ctx.context,
			card: signupResult.data.id,
			type: signupResult.data.type,
			arguments: {
				currentPassword: plaintextPassword,
				newPassword: 'new-password',
			},
		});

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request2,
		);
		await ctx.flush(ctx.session);
		const result = await ctx.queue.producer.waitResults(ctx.context, request);
		expect(result.error).toBe(false);

		const userAfter = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			signupResult.data.id,
		);

		assert(userBefore !== null);
		assert(userAfter !== null);

		expect(userBefore.data.hash).toBeTruthy();
		expect(userAfter.data.hash).toBeTruthy();
		expect(userBefore.data.hash).not.toBe(userAfter.data.hash);
	});

	it('should not store the passwords when using action-set-password on a first time password', async () => {
		const userCard = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			slug: ctx.generateRandomSlug({
				prefix: 'user',
			}),
			type: 'user@1.0.0',
			data: {
				email: 'johndoe@example.com',
				hash: 'PASSWORDLESS',
				roles: ['user-community'],
			},
		});

		const resetRequest = await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			context: ctx.context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				currentPassword: null,
				newPassword: 'new-password',
			},
		});

		await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			resetRequest,
		);

		const request: any = await ctx.dequeue();

		expect(request).toBeTruthy();
		expect(request.data.arguments.currentPassword).toBeFalsy();
		expect(request.data.arguments.newPassword).toBeTruthy();
		expect(request.data.arguments.newPassword).not.toBe('new-password');
	});

	it('should not change the password of a password-less user given a password', async () => {
		const userCard = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
			slug: ctx.generateRandomSlug({
				prefix: 'user',
			}),
			type: 'user@1.0.0',
			data: {
				email: 'johndoe@example.com',
				hash: 'PASSWORDLESS',
				roles: ['user-community'],
			},
		});

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: userCard.id,
				type: userCard.type,
				arguments: {
					currentPassword: 'xxxxxxxxxxxxxxxxxxxxxx',
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});
});
