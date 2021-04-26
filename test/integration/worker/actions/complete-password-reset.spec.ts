/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as nock from 'nock';
import * as crypto from 'crypto';
import * as helpers from '../helpers';
import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import { TypeContract, UserContract } from '@balena/jellyfish-types/build/core';
import { strict as assert } from 'assert';

const MAIL_OPTIONS = environment.mail.options;
const { resetPasswordSecretToken } = environment.actions;

let ctx: helpers.IntegrationTestContext & {
	user: UserContract;
	userEmail: string;
	userPassword: string;
	username: string;
	resetToken: string;
};

beforeAll(async () => {
	ctx = await helpers.worker.before();
});

beforeEach(async () => {
	const { worker, session, jellyfish, context, processAction } = ctx;

	const userTypeContract = await jellyfish.getCardBySlug<TypeContract>(
		context,
		session,
		'user@latest',
	);

	assert(userTypeContract !== null);

	const userEmail = 'test@test.com';
	const userPassword = 'original-password';
	const username = ctx.generateRandomSlug();

	const createUserAction = await worker.pre(session, {
		action: 'action-create-user@1.0.0',
		context,
		card: userTypeContract.id,
		type: userTypeContract.type,
		arguments: {
			email: userEmail,
			password: userPassword,
			username: `user-${username}`,
		},
	});

	const userInfo = await processAction(session, createUserAction);
	const user = await jellyfish.getCardById<UserContract>(
		context,
		session,
		userInfo.data.id,
	);

	assert(user !== null);

	const resetToken = crypto
		.createHmac('sha256', resetPasswordSecretToken)
		.update(user.data.hash)
		.digest('hex');

	nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
		.persist()
		.post('/messages')
		.basicAuth({
			user: 'api',
			pass: MAIL_OPTIONS!.token,
		})
		.reply(200);

	ctx = {
		...ctx,
		user,
		userEmail,
		userPassword,
		username,
		resetToken,
	};
});

afterAll(() => {
	return helpers.worker.after(ctx);
});

describe('action-complete-password-reset', () => {
	it('should replace the user password when the requestToken is valid', async () => {
		const {
			session,
			context,
			worker,
			processAction,
			user,
			username,
			resetToken,
			userPassword: originalPassword,
		} = ctx;

		const newPassword = 'new-password';

		const requestPasswordReset = {
			action: 'action-request-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				username,
			},
		};

		const passwordReset = await processAction(session, requestPasswordReset);
		expect(passwordReset.error).toBe(false);

		const completePasswordReset = await worker.pre(session, {
			action: 'action-complete-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				resetToken,
				newPassword,
			},
		});

		const completePasswordResetResult = await processAction(
			session,
			completePasswordReset,
		);
		expect(completePasswordResetResult.error).toBe(false);

		await expect(
			worker.pre(session, {
				action: 'action-create-session@1.0.0',
				card: user.id,
				type: user.type,
				context,
				arguments: {
					password: originalPassword,
				},
			}),
		).rejects.toThrow(worker.errors.WorkerAuthenticationError);

		const newPasswordLoginRequest = await ctx.worker.pre(ctx.session, {
			action: 'action-create-session@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				password: newPassword,
			},
		});

		const newPasswordLoginResult = await processAction(
			session,
			newPasswordLoginRequest,
		);

		expect(newPasswordLoginResult.error).toBe(false);
	});

	it('should fail when the reset token does not match a valid card', async () => {
		expect.assertions(2);
		const { session, context, worker, processAction, user } = ctx;

		const completePasswordReset = await worker.pre(session, {
			action: 'action-complete-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				resetToken: 'fake-reset-token',
				newPassword: 'new-password',
			},
		});

		try {
			await processAction(session, completePasswordReset);
		} catch (error) {
			expect(error.name).toBe('WorkerSchemaMismatch');
			expect(error.message).toBe(
				`Arguments do not match for action action-complete-password-reset: {
  "resetToken": "fake-reset-token",
  "newPassword": "${completePasswordReset.arguments.newPassword}"
}`,
			);
		}
	});

	it('should fail when the reset token has expired', async () => {
		const {
			jellyfish,
			session,
			context,
			worker,
			processAction,
			user,
			username,
			resetToken,
		} = ctx;

		const newPassword = 'new-password';

		const requestPasswordReset = {
			action: 'action-request-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				username,
			},
		};

		await processAction(session, requestPasswordReset);

		const [passwordReset] = await jellyfish.query(context, session, {
			type: 'object',
			required: ['id', 'type'],
			additionalProperties: true,
			properties: {
				id: {
					type: 'string',
				},
				type: {
					type: 'string',
					const: 'password-reset@1.0.0',
				},
				data: {
					type: 'object',
					additionalProperties: true,
					properties: {
						resetToken: {
							type: 'string',
							const: resetToken,
						},
					},
				},
			},
		});

		const now = new Date();
		const hourInPast = now.setHours(now.getHours() - 1);
		const newExpiry = new Date(hourInPast);

		const requestUpdateCard = {
			action: 'action-update-card@1.0.0',
			context,
			card: passwordReset.id,
			type: passwordReset.type,
			arguments: {
				reason: 'Expiring token for test',
				patch: [
					{
						op: 'replace',
						path: '/data/expiresAt',
						value: newExpiry.toISOString(),
					},
				],
			},
		};

		const updatedCard = await processAction(session, requestUpdateCard);
		expect(updatedCard.error).toBe(false);

		const completePasswordReset = await worker.pre(session, {
			action: 'action-complete-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				resetToken,
				newPassword,
			},
		});

		await expect(processAction(session, completePasswordReset)).rejects.toThrow(
			worker.errors.WorkerAuthenticationError,
		);
	});

	it('should fail when the reset token is not active', async () => {
		const {
			jellyfish,
			session,
			context,
			worker,
			processAction,
			user,
			username,
			resetToken,
		} = ctx;

		const newPassword = 'new-password';

		const requestPasswordReset = {
			action: 'action-request-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				username,
			},
		};

		await processAction(session, requestPasswordReset);

		const [passwordReset] = await jellyfish.query(context, session, {
			type: 'object',
			required: ['id', 'type'],
			additionalProperties: true,
			properties: {
				id: {
					type: 'string',
				},
				type: {
					type: 'string',
					const: 'password-reset@1.0.0',
				},
				data: {
					type: 'object',
					additionalProperties: true,
					properties: {
						resetToken: {
							type: 'string',
							const: resetToken,
						},
					},
				},
			},
		});

		const requestDeleteCard = {
			action: 'action-delete-card@1.0.0',
			context,
			card: passwordReset.id,
			type: passwordReset.type,
			arguments: {},
		};

		const requestDelete = await processAction(session, requestDeleteCard);
		expect(requestDelete.error).toBe(false);

		const completePasswordReset = await worker.pre(session, {
			action: 'action-complete-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				resetToken,
				newPassword,
			},
		});

		await expect(processAction(session, completePasswordReset)).rejects.toThrow(
			worker.errors.WorkerAuthenticationError,
		);
	});

	it('should fail if the user becomes inactive between requesting and completing the password reset', async () => {
		const {
			session,
			context,
			processAction,
			user,
			username,
			worker,
			resetToken,
		} = ctx;

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				username,
			},
		};

		const requestPasswordReset = await processAction(
			session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const requestDeleteCard = {
			action: 'action-delete-card@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {},
		};

		const requestDelete = await processAction(session, requestDeleteCard);
		expect(requestDelete.error).toBe(false);

		const completePasswordReset = await worker.pre(session, {
			action: 'action-complete-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				resetToken,
				newPassword: 'new-password',
			},
		});

		await expect(processAction(session, completePasswordReset)).rejects.toThrow(
			worker.errors.WorkerAuthenticationError,
		);
	});

	it('should remove the password reset card', async () => {
		const {
			session,
			context,
			processAction,
			user,
			username,
			worker,
			jellyfish,
			resetToken,
		} = ctx;

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				username,
			},
		};

		const requestPasswordReset = await processAction(
			session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const completePasswordReset = await worker.pre(session, {
			action: 'action-complete-password-reset@1.0.0',
			context,
			card: user.id,
			type: user.type,
			arguments: {
				resetToken,
				newPassword: 'new-password',
			},
		});

		await processAction(session, completePasswordReset);

		const [passwordReset] = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type', 'active', 'data'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
					active: {
						type: 'boolean',
					},
					data: {
						type: 'object',
						properties: {
							resetToken: {
								type: 'string',
								const: resetToken,
							},
						},
						required: ['resetToken'],
					},
				},
			},
			{
				limit: 1,
			},
		);

		// Sanity check to make sure the return element is the one we expect
		expect(passwordReset.data.resetToken).toBe(resetToken);
		expect(passwordReset.active).toBe(false);
	});
});
