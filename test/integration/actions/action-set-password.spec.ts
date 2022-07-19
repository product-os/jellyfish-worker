import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import bcrypt from 'bcrypt';
import { testUtils } from '../../../lib';
import {
	BCRYPT_SALT_ROUNDS,
	PASSWORDLESS_USER_HASH,
} from '../../../lib/actions/constants';
import * as errors from '../../../lib/errors';
import type { ActionRequestContract } from '../../../lib/types';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(async () => {
	return testUtils.destroyContext(ctx);
});

describe('action-set-password', () => {
	test('pre should hide password', async () => {
		const password = autumndbTestUtils.generateRandomId();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			hash,
		);

		const newPassword = autumndbTestUtils.generateRandomId();
		const result = await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {
				currentPassword: password,
				newPassword,
			},
		});
		assert(result);
		expect(result.arguments.currentPassword).toEqual('CHECKED IN PRE HOOK');
		expect(result.arguments.newPassword).toBeTruthy();
		expect(result.arguments.newPassword).not.toBe(newPassword);
	});

	test('should change the password of a password-less user given no password', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			PASSWORDLESS_USER_HASH,
		);

		const actionRequest = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{
				attachEvents: false,
				timestamp: new Date().toISOString(),
			},
			{
				type: 'action-request@1.0.0',
				data: {
					action: 'action-set-password@1.0.0',
					context: ctx.logContext,
					card: user.id,
					type: user.type,
					actor: user.id,
					epoch: new Date().valueOf(),
					input: {
						id: user.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						currentPassword: null,
						newPassword: autumndbTestUtils.generateRandomId(),
					},
				},
			},
		);
		assert(actionRequest);
		await ctx.flush(ctx.session);
		const resetResult = await ctx.worker.producer.waitResults(
			ctx.logContext,
			actionRequest as ActionRequestContract,
		);
		expect(resetResult.error).toBe(false);

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.hash).toBeTruthy();
		expect(updated.data.hash).not.toEqual(PASSWORDLESS_USER_HASH);
	});

	test('should change a user password', async () => {
		const password = autumndbTestUtils.generateRandomId();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			hash,
		);

		const actionRequest = await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{
				attachEvents: false,
				timestamp: new Date().toISOString(),
			},
			{
				type: 'action-request@1.0.0',
				data: {
					action: 'action-set-password@1.0.0',
					context: ctx.logContext,
					card: user.id,
					type: user.type,
					actor: user.id,
					epoch: new Date().valueOf(),
					input: {
						id: user.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						currentPassword: password,
						newPassword: autumndbTestUtils.generateRandomId(),
					},
				},
			},
		);
		assert(actionRequest);
		await ctx.flushAll(ctx.session);

		const result = await ctx.worker.producer.waitResults(
			ctx.logContext,
			actionRequest as ActionRequestContract,
		);
		expect(result.error).toBe(false);

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.hash).toBeTruthy();
		expect(updated.data.hash).not.toEqual(hash);
	});

	test('should not change a user password given invalid current password', async () => {
		const password = autumndbTestUtils.generateRandomId();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			hash,
		);

		await expect(() => {
			return ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					currentPassword: 'xxxxxxxxxxxxxxxxxxxxxx',
					newPassword: autumndbTestUtils.generateRandomId(),
				},
			});
		}).rejects.toThrow(errors.WorkerAuthenticationError);
	});

	test('should not change a user password given a null current password', async () => {
		const password = autumndbTestUtils.generateRandomId();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			hash,
		);

		await expect(() => {
			return ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					currentPassword: null,
					newPassword: 'new-password',
				},
			});
		}).rejects.toThrow(errors.WorkerAuthenticationError);
	});

	test('should not change the password of a password-less user given a password', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			PASSWORDLESS_USER_HASH,
		);

		await expect(() => {
			return ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					currentPassword: 'xxxxxxxxxxxxxxxxxxxxxx',
					newPassword: 'new-password',
				},
			});
		}).rejects.toThrow(errors.WorkerAuthenticationError);
	});

	test('a community user should not be able to reset other users passwords', async () => {
		const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
		expect(user.data.roles).toEqual(['user-community']);
		const session = { actor: user };

		const password = autumndbTestUtils.generateRandomId().split('-')[0];
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const otherUser = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			hash,
		);
		expect(otherUser.data.hash).toEqual(hash);
		expect(otherUser.data.roles).toEqual(['user-community']);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{
				attachEvents: false,
				timestamp: new Date().toISOString(),
				actor: user.id,
			},
			{
				type: 'action-request@1.0.0',
				data: {
					action: 'action-set-password@1.0.0',
					context: ctx.logContext,
					card: otherUser.id,
					type: otherUser.type,
					actor: user.id,
					epoch: new Date().valueOf(),
					input: {
						id: otherUser.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						currentPassword: password,
						newPassword: 'foobarbaz',
					},
				},
			},
		);

		await expect(() => {
			return ctx.flush(session);
		}).rejects.toThrowError();
	});

	test('a community user should not be able to set a first time password for another user', async () => {
		const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
		expect(user.data.roles).toEqual(['user-community']);
		const session = { actor: user };

		const otherUser = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			PASSWORDLESS_USER_HASH,
		);
		expect(otherUser.data.hash).toEqual(PASSWORDLESS_USER_HASH);
		expect(otherUser.data.roles).toEqual(['user-community']);

		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{
				attachEvents: false,
				timestamp: new Date().toISOString(),
				actor: user.id,
			},
			{
				type: 'action-request@1.0.0',
				data: {
					action: 'action-set-password@1.0.0',
					context: ctx.logContext,
					card: otherUser.id,
					type: otherUser.type,
					actor: user.id,
					epoch: new Date().valueOf(),
					input: {
						id: otherUser.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						currentPassword: null,
						newPassword: 'foobarbaz',
					},
				},
			},
		);

		await expect(() => {
			return ctx.flush(session);
		}).rejects.toThrowError();
	});
});
