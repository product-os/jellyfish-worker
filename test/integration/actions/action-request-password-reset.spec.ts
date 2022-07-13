import { defaultEnvironment } from '@balena/jellyfish-environment';
import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import nock from 'nock';
import { testUtils } from '../../../lib';
import { PASSWORDLESS_USER_HASH } from '../../../lib/actions/constants';
import { includes } from './helpers';

const MAIL_OPTIONS = defaultEnvironment.mail.options;
let mailBody: string = '';
let balenaOrg: any;

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();

	// Get org and add test user as member
	balenaOrg = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(balenaOrg);
	await ctx.createLinkThroughWorker(
		ctx.adminUserId,
		ctx.session,
		(await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			ctx.adminUserId,
		))!,
		balenaOrg,
		'is member of',
		'has member',
	);
});

afterAll(async () => {
	return testUtils.destroyContext(ctx);
});

afterEach(() => {
	nock.cleanAll();
});

function nockRequest() {
	nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
		.persist()
		.post('/messages')
		.basicAuth({
			user: 'api',
			pass: MAIL_OPTIONS!.token,
		})
		.reply(200, (_uri: string, requestBody: string) => {
			mailBody = requestBody;
		});
}

describe('action-request-password-reset', () => {
	test('should create a password reset card and user link when arguments match a valid user', async () => {
		nockRequest();
		const username = autumndbTestUtils.generateRandomSlug();
		const user = await ctx.createUser(username);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		const requestPasswordReset = await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.logContext,
				card: user.id,
				type: user.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: user.id,
				input: {
					id: user.id,
				},
				arguments: {
					username,
				},
			},
		});
		expect(requestPasswordReset.error).toBe(false);

		await ctx.waitForMatch({
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
							const: user.id,
						},
					},
				},
			},
		});
	});

	test('should send a password-reset email when the username in the argument matches a valid user', async () => {
		mailBody = '';
		nockRequest();
		const username = autumndbTestUtils.generateRandomSlug();
		const user = await ctx.createUser(username);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);
		const email = (user.data as any).email[0];

		const requestPasswordReset = await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.logContext,
				card: user.id,
				type: user.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: user.id,
				input: {
					id: user.id,
				},
				arguments: {
					username,
				},
			},
		});
		expect(requestPasswordReset.error).toBe(false);

		const match = await ctx.waitForMatch({
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
							const: user.id,
						},
					},
				},
			},
		});

		const resetPasswordUrl = `https://jel.ly.fish/password_reset/${match.data.resetToken}/${username}`;
		const expectedEmailBody = `<p>Hello,</p><p>We have received a password reset request for the Jellyfish account attached to this email.</p><p>Please use the link below to reset your password:</p><a href="${resetPasswordUrl}">${resetPasswordUrl}</a><p>Cheers</p><p>Jellyfish Team</p><a href="https://jel.ly.fish">https://jel.ly.fish</a>`;

		expect(includes('to', email, mailBody)).toBe(true);
		expect(includes('from', 'no-reply@mail.ly.fish', mailBody)).toBe(true);
		expect(includes('subject', 'Jellyfish Password Reset', mailBody)).toBe(
			true,
		);
		expect(includes('html', expectedEmailBody, mailBody)).toBe(true);
	});

	test('should fail silently if the username does not match a user', async () => {
		nockRequest();
		const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		const requestPasswordReset = await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.logContext,
				card: user.id,
				type: user.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: user.id,
				input: {
					id: user.id,
				},
				arguments: {
					username: autumndbTestUtils.generateRandomSlug(),
				},
			},
		});
		expect(requestPasswordReset.error).toBe(false);

		await expect(
			ctx.waitForMatch(
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
									const: user.id,
								},
							},
						},
					},
				},
				3,
			),
		).rejects.toThrow(new Error('The wait query did not resolve'));
	});

	test('should fail silently if the user is inactive', async () => {
		nockRequest();
		const username = autumndbTestUtils.generateRandomSlug();
		const user = await ctx.createUser(username);
		const session = await ctx.createSession(user);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		const requestDelete = await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-delete-card@1.0.0',
				context: ctx.logContext,
				card: user.id,
				type: user.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: user.id,
				input: {
					id: user.id,
				},
				arguments: {},
			},
		});
		expect(requestDelete.error).toBe(false);

		await expect(
			ctx.processAction(session.id, {
				type: 'action-request@1.0.0',
				data: {
					action: 'action-request-password-reset@1.0.0',
					context: ctx.logContext,
					card: user.id,
					type: user.type,
					epoch: new Date().valueOf(),
					timestamp: new Date().toISOString(),
					actor: user.id,
					input: {
						id: user.id,
					},
					arguments: {
						username,
					},
				},
			}),
		).rejects.toThrowError();
	});

	test('should fail silently if the user does not have a hash', async () => {
		nockRequest();
		const username = autumndbTestUtils.generateRandomSlug();
		const user = await ctx.createUser(username, PASSWORDLESS_USER_HASH);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		const requestPasswordReset = await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.logContext,
				card: user.id,
				type: user.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: user.id,
				input: {
					id: user.id,
				},
				arguments: {
					username,
				},
			},
		});
		expect(requestPasswordReset.error).toBe(false);

		await expect(
			ctx.waitForMatch(
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
									const: user.id,
								},
							},
						},
					},
				},
				3,
			),
		).rejects.toThrow(new Error('The wait query did not resolve'));
	});

	test('should invalidate previous password reset requests', async () => {
		nockRequest();
		const username = autumndbTestUtils.generateRandomSlug();
		const user = await ctx.createUser(username);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		const requestPasswordResetAction = {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.logContext,
				card: user.id,
				type: user.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: user.id,
				input: {
					id: user.id,
				},
				arguments: {
					username,
				},
			},
		};

		const firstPasswordResetRequest = await ctx.processAction(
			ctx.session,
			requestPasswordResetAction,
		);
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondPasswordResetRequest = await ctx.processAction(
			ctx.session,
			requestPasswordResetAction,
		);
		expect(secondPasswordResetRequest.error).toBe(false);

		const passwordResets = await ctx.kernel.query(
			ctx.logContext,
			ctx.session,
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
								const: user.id,
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

	test('should not invalidate previous password reset requests from other users', async () => {
		nockRequest();
		const firstUsername = autumndbTestUtils.generateRandomSlug();
		const secondUsername = autumndbTestUtils.generateRandomSlug();
		const firstUser = await ctx.createUser(firstUsername);
		const secondUser = await ctx.createUser(secondUsername);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			firstUser,
			balenaOrg,
			'is member of',
			'has member',
		);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			secondUser,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.logContext,
				card: secondUser.id,
				type: secondUser.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: secondUser.id,
				input: {
					id: secondUser.id,
				},
				arguments: {
					username: secondUsername,
				},
			},
		});

		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.logContext,
				card: firstUser.id,
				type: firstUser.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: firstUser.id,
				input: {
					id: firstUser.id,
				},
				arguments: {
					username: firstUsername,
				},
			},
		});

		const passwordResets = await ctx.kernel.query(
			ctx.logContext,
			ctx.session,
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
								enum: [firstUser.id, secondUser.id],
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
		expect(passwordResets[1].active).toBe(true);
	});

	test('accounts with the same password have different request tokens', async () => {
		nockRequest();
		const password = autumndbTestUtils.generateRandomId().split('-')[0];
		const firstUsername = autumndbTestUtils.generateRandomId().split('-')[0];
		const secondUsername = autumndbTestUtils.generateRandomId().split('-')[0];

		const firstUserCreate = (await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			logContext: ctx.logContext,
			card: ctx.worker.typeContracts['user@1.0.0'].id,
			type: ctx.worker.typeContracts['user@1.0.0'].type,
			arguments: {
				email: `${firstUsername}@foo.bar`,
				username: `user-${firstUsername}`,
				password,
			},
		})) as any;

		// TODO: Remove temporary workaround for context/logContext mismatch
		firstUserCreate.context = firstUserCreate.logContext;
		firstUserCreate.epoch = new Date().valueOf();
		firstUserCreate.timestamp = new Date().toISOString();
		firstUserCreate.actor = ctx.worker.typeContracts['user@1.0.0'].id;
		firstUserCreate.input = {
			id: ctx.worker.typeContracts['user@1.0.0'].id,
		};
		Reflect.deleteProperty(firstUserCreate, 'logContext');

		const firstUser = await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: firstUserCreate,
		});
		expect(firstUser.error).toBe(false);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			firstUser.data,
			balenaOrg,
			'is member of',
			'has member',
		);

		// TODO: temporary workaround for context/logContext mismatch
		const secondUserCreate = (await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			logContext: ctx.logContext,
			card: ctx.worker.typeContracts['user@1.0.0'].id,
			type: ctx.worker.typeContracts['user@1.0.0'].type,
			arguments: {
				email: `${secondUsername}@foo.bar`,
				username: `user-${secondUsername}`,
				password,
			},
		})) as any;

		// TODO: Remove temporary workaround for context/logContext mismatch
		secondUserCreate.context = secondUserCreate.logContext;
		secondUserCreate.epoch = new Date().valueOf();
		secondUserCreate.timestamp = new Date().toISOString();
		secondUserCreate.actor = ctx.worker.typeContracts['user@1.0.0'].id;
		secondUserCreate.input = {
			id: ctx.worker.typeContracts['user@1.0.0'].id,
		};
		Reflect.deleteProperty(secondUserCreate, 'logContext');

		const secondUser = await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: secondUserCreate,
		});
		expect(secondUser.error).toBe(false);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			secondUser.data,
			balenaOrg,
			'is member of',
			'has member',
		);

		const firstPasswordResetRequest = await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.logContext,
				card: firstUser.data.id,
				type: firstUser.data.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: firstUser.data.id,
				input: {
					id: firstUser.data.id,
				},
				arguments: {
					username: firstUsername,
				},
			},
		});
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondPasswordResetRequest = await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.logContext,
				card: secondUser.data.id,
				type: secondUser.data.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: secondUser.data.id,
				input: {
					id: secondUser.data.id,
				},
				arguments: {
					username: secondUsername,
				},
			},
		});
		expect(secondPasswordResetRequest.error).toBe(false);

		const passwordResets = await ctx.kernel.query(
			ctx.logContext,
			ctx.session,
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
								enum: [firstUser.data.id, secondUser.data.id],
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

	test('should successfully send an email to a user with an array of emails', async () => {
		mailBody = '';
		nockRequest();
		const username = autumndbTestUtils.generateRandomSlug();
		const user = await ctx.createUser(username);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);
		const emails = [
			`${autumndbTestUtils.generateRandomSlug()}@example.com`,
			`${autumndbTestUtils.generateRandomSlug()}@example.com`,
		];

		// Update user emails
		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts[user.type],
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			user,
			[
				{
					op: 'replace',
					path: '/data/email',
					value: emails,
				},
			],
		);
		await ctx.flushAll(ctx.session);

		const passwordReset = await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.logContext,
				card: user.id,
				type: user.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: user.id,
				input: {
					id: user.id,
				},
				arguments: {
					username,
				},
			},
		});
		expect(passwordReset.error).toBe(false);
		expect(includes('to', emails[0], mailBody)).toBe(true);
	});

	test('should throw error when provided username is an email address', async () => {
		nockRequest();
		const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());

		await expect(
			ctx.processAction(ctx.session, {
				type: 'action-request@1.0.0',
				data: {
					action: 'action-request-password-reset@1.0.0',
					context: ctx.logContext,
					card: user.id,
					type: user.type,
					epoch: new Date().valueOf(),
					timestamp: new Date().toISOString(),
					actor: user.id,
					input: {
						id: user.id,
					},
					arguments: {
						username: 'foo@bar.com',
					},
				},
			}),
		).rejects.toThrowError();
	});
});
