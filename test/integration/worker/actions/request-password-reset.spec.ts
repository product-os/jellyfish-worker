/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as nock from 'nock';
import * as helpers from '../helpers';
import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import { strict as assert } from 'assert';

let ctx: any;

const MAIL_OPTIONS = environment.mail.options;

const checkForKeyValue = (key, value, text) => {
	const pattern = new RegExp(`name="${key}"\\s*${value}`, 'm');
	const regex = text.search(pattern);
	return regex !== -1;
};

beforeAll(async () => {
	ctx = await helpers.worker.before();
	const { jellyfish, context, session } = ctx;

	ctx = {
		...ctx,
		userEmail: 'test@test.com',
		userPassword: 'foobarbaz',
		userCard: await jellyfish.getCardBySlug(context, session, 'user@latest'),
	};
});

beforeEach(async () => {
	const {
		worker,
		session,
		context,
		processAction,
		userCard,
		userEmail,
		userPassword,
	} = ctx;

	// Create user
	const username = ctx.generateRandomSlug();
	const createUserAction = await worker.pre(session, {
		action: 'action-create-user@1.0.0',
		context,
		card: userCard.id,
		type: userCard.type,
		arguments: {
			username: `user-${username}`,
			password: userPassword,
			email: userEmail,
		},
	});

	assert.ok(MAIL_OPTIONS);

	// Nock mail integration
	const nockRequest = (fn) => {
		nock(`${MAIL_OPTIONS.baseUrl}/${MAIL_OPTIONS.domain}`)
			.persist()
			.post('/messages')
			.basicAuth({
				user: 'api',
				pass: MAIL_OPTIONS.token,
			})
			.reply(200, (_uri, requestBody) => {
				if (fn) {
					fn(requestBody);
				}
			});
	};

	ctx = {
		...ctx,
		user: await processAction(session, createUserAction),
		username,
		nockRequest,
	};
});

afterEach(async () => {
	nock.cleanAll();
});

afterAll(async () => {
	await helpers.worker.after(ctx);
});

describe('action-request-password-reset', () => {
	it('should create a password reset card and user link when arguments match a valid user', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			username,
			nockRequest,
		} = ctx;

		nockRequest();

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username,
			},
		};

		const requestPasswordReset = await processAction(
			session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const [passwordReset] = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								const: user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(passwordReset !== undefined).toBe(true);
		expect(new Date(passwordReset.data.expiresAt) > new Date()).toBe(true);
		expect(passwordReset.links['is attached to'].id).toBe(user.id);
	});

	it('should send a password-reset email when the username in the argument matches a valid user', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			username,
			userEmail,
			nockRequest,
		} = ctx;

		let mailBody;
		const saveBody = (body) => {
			mailBody = body;
		};

		nockRequest(saveBody);

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username,
			},
		};

		const requestPasswordReset = await processAction(
			session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const [passwordReset] = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type', 'data'],
				additionalProperties: false,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
					data: {
						type: 'object',
						properties: {
							resetToken: {
								type: 'string',
							},
						},
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								const: user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		const resetPasswordUrl = `https://jel.ly.fish/password_reset/${passwordReset.data.resetToken}/${username}`;

		const expectedEmailBody = `<p>Hello,</p><p>We have received a password reset request for the Jellyfish account attached to this email.</p><p>Please use the link below to reset your password:</p><a href="${resetPasswordUrl}">${resetPasswordUrl}</a><p>Cheers</p><p>Jellyfish Team</p><a href="https://jel.ly.fish">https://jel.ly.fish</a>`;

		const fromIsInBody = checkForKeyValue(
			'from',
			'no-reply@mail.ly.fish',
			mailBody,
		);
		const toIsInBody = checkForKeyValue('to', userEmail, mailBody);
		const subjectIsInBody = checkForKeyValue(
			'subject',
			'Jellyfish Password Reset',
			mailBody,
		);
		const htmlIsInBody = checkForKeyValue('html', expectedEmailBody, mailBody);

		expect(toIsInBody).toBe(true);
		expect(fromIsInBody).toBe(true);
		expect(subjectIsInBody).toBe(true);
		expect(htmlIsInBody).toBe(true);
	});

	it('should fail silently if the username does not match a user', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			nockRequest,
		} = ctx;

		nockRequest();

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username: ctx.generateRandomSlug(),
			},
		};

		const requestPasswordReset = await processAction(
			session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const [passwordReset] = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type'],
				additionalProperties: false,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								const: user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(passwordReset === undefined).toBe(true);
	});

	it('should fail silently if the user is inactive', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			username,
			nockRequest,
		} = ctx;

		nockRequest();

		const requestDeleteCard = {
			action: 'action-delete-card@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		};

		const requestDelete = await processAction(session, requestDeleteCard);
		expect(requestDelete.error).toBe(false);

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username,
			},
		};

		const requestPasswordReset = await processAction(
			session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const [passwordReset] = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type'],
				additionalProperties: false,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								const: user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(passwordReset === undefined).toBe(true);
	});

	it('should fail silently if the user does not have a hash', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			username,
			nockRequest,
		} = ctx;

		nockRequest();

		const requestUpdateCard = {
			action: 'action-update-card@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				reason: 'Removing hash for test',
				patch: [
					{
						op: 'replace',
						path: '/data/hash',
						value: 'PASSWORDLESS',
					},
				],
			},
		};

		const requestUpdate = await processAction(session, requestUpdateCard);
		expect(requestUpdate.error).toBe(false);

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username,
			},
		};

		const requestPasswordReset = await processAction(
			session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const [passwordReset] = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type'],
				additionalProperties: false,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								const: user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(passwordReset === undefined).toBe(true);
	});

	it('should invalidate previous password reset requests', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			username,
			nockRequest,
		} = ctx;

		nockRequest();

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username,
			},
		};

		const firstPasswordResetRequest = await processAction(
			session,
			requestPasswordResetAction,
		);
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondPasswordResetRequest = await processAction(
			session,
			requestPasswordResetAction,
		);
		expect(secondPasswordResetRequest.error).toBe(false);

		const passwordResets = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								const: user.data.id,
							},
						},
					},
				},
			},
			{
				sortBy: 'created_at',
			},
		);

		expect(passwordResets.length).toBe(2);
		expect(passwordResets[0].active).toBe(false);
		expect(passwordResets[1].active).toBe(true);
	});

	it('should not invalidate previous password reset requests from other users', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			username,
			userCard,
			worker,
			nockRequest,
		} = ctx;

		nockRequest();

		const otherUsername = ctx.generateRandomSlug();

		const createUserAction = await worker.pre(session, {
			action: 'action-create-user@1.0.0',
			context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				email: 'other@user.com',
				username: `user-${otherUsername}`,
				password: 'apassword',
			},
		});

		const otherUser = await processAction(session, createUserAction);
		expect(otherUser.error).toBe(false);

		const otherUserRequest = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username: otherUsername,
			},
		};

		await processAction(session, otherUserRequest);

		const userRequest = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username,
			},
		};
		await processAction(session, userRequest);

		const passwordResets = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
					active: {
						type: 'boolean',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								enum: [user.data.id, otherUser.data.id],
							},
						},
					},
				},
			},
			{
				sortBy: 'created_at',
			},
		);

		expect(passwordResets.length).toBe(2);
		expect(passwordResets[0].active).toBe(true);
	});

	it('accounts with the same password have different request tokens', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			username,
			userPassword,
			userCard,
			worker,
			nockRequest,
		} = ctx;

		nockRequest();

		const newUsername = ctx.generateRandomSlug();

		const createUserAction = await worker.pre(session, {
			action: 'action-create-user@1.0.0',
			context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				email: 'madeup@gmail.com',
				username: `user-${newUsername}`,
				password: userPassword,
			},
		});

		const secondUser = await processAction(session, createUserAction);
		expect(secondUser.error).toBe(false);

		const firstRequest = {
			action: 'action-request-password-reset@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username,
			},
		};

		const firstPasswordResetRequest = await processAction(
			session,
			firstRequest,
		);
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondRequest = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username: newUsername,
			},
		};

		const secondPasswordResetRequest = await processAction(
			session,
			secondRequest,
		);
		expect(secondPasswordResetRequest.error).toBe(false);

		const passwordResets = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								enum: [user.data.id, secondUser.data.id],
							},
						},
					},
				},
			},
			{
				sortBy: 'created_at',
			},
		);
		expect(passwordResets.length).toBe(2);
		expect(
			passwordResets[0].data.resetToken === passwordResets[1].data.resetToken,
		).toBe(false);
	});

	it('should successfully send an email to a user with an array of emails', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			userCard,
			worker,
			nockRequest,
		} = ctx;

		let mailBody;
		const saveBody = (body) => {
			mailBody = body;
		};
		nockRequest(saveBody);

		const firstEmail = 'first@email.com';
		const secondEmail = 'second@email.com';
		const newUsername = ctx.generateRandomSlug();

		const createUserAction = await worker.pre(session, {
			action: 'action-create-user@1.0.0',
			context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				email: firstEmail,
				username: `user-${newUsername}`,
				password: 'foobarbaz',
			},
		});

		const newUser = await processAction(session, createUserAction);
		expect(newUser.error).toBe(false);

		const requestUpdateCard = {
			action: 'action-update-card@1.0.0',
			context,
			card: newUser.data.id,
			type: newUser.data.type,
			arguments: {
				reason: 'Making email an array for test',
				patch: [
					{
						op: 'replace',
						path: '/data/email',
						value: [firstEmail, secondEmail],
					},
				],
			},
		};

		const requestUpdate = await processAction(session, requestUpdateCard);
		expect(requestUpdate.error).toBe(false);

		const userWithEmailArray = await jellyfish.getCardById(
			context,
			session,
			newUser.data.id,
		);

		expect(userWithEmailArray.data.email).toEqual([firstEmail, secondEmail]);

		const passwordResetRequest = {
			action: 'action-request-password-reset@1.0.0',
			context,
			card: newUser.data.id,
			type: newUser.data.type,
			arguments: {
				username: newUsername,
			},
		};

		const passwordReset = await processAction(session, passwordResetRequest);
		expect(passwordReset.error).toBe(false);

		const toIsInBody = checkForKeyValue('to', firstEmail, mailBody);
		expect(toIsInBody).toBe(true);
	});
});
