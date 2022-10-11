import { defaultEnvironment } from '@balena/jellyfish-environment';
import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import nock from 'nock';
import { testUtils } from '../../../lib';
import { actionCompleteFirstTimeLogin } from '../../../lib/actions/action-complete-first-time-login';
import type { WorkerContext } from '../../../lib/types';
import { makeHandlerRequest } from './helpers';

const MAIL_OPTIONS = defaultEnvironment.mail.options;
let balenaOrg: any;

const handler = actionCompleteFirstTimeLogin.handler;
let ctx: testUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
	actionContext = ctx.worker.getActionContext({
		id: `test-${autumndbTestUtils.generateRandomId()}`,
	});

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

beforeEach(() => {
	nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
		.persist()
		.post('/messages')
		.basicAuth({
			user: 'api',
			pass: MAIL_OPTIONS!.token,
		})
		.reply(200);
});

afterAll(async () => {
	return testUtils.destroyContext(ctx);
});

afterEach(async () => {
	nock.cleanAll();
});

describe('action-complete-first-time-login', () => {
	test("should update the user's password when the firstTimeLoginToken is valid", async () => {
		const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
		const session = { actor: user };
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-send-first-time-login-link@1.0.0',
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

		const match = await ctx.waitForMatch({
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
		});

		const newPassword = autumndbTestUtils.generateRandomId();
		const completeFirstTimeLoginAction = (await ctx.worker.pre(ctx.session, {
			action: 'action-complete-first-time-login@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {
				firstTimeLoginToken: match.data.firstTimeLoginToken,
				newPassword,
			},
		})) as any;

		// TODO: Remove temporary workaround for context/logContext mismatch
		completeFirstTimeLoginAction.context =
			completeFirstTimeLoginAction.logContext;
		completeFirstTimeLoginAction.epoch = new Date().valueOf();
		completeFirstTimeLoginAction.timestamp = new Date().toISOString();
		completeFirstTimeLoginAction.actor = user.id;
		completeFirstTimeLoginAction.input = {
			id: user.id,
		};
		Reflect.deleteProperty(completeFirstTimeLoginAction, 'logContext');

		await ctx.processAction(session, {
			type: 'action-request@1.0.0',
			data: completeFirstTimeLoginAction,
		});

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.hash).not.toEqual(PASSWORDLESS_USER_HASH);
	});

	test('should fail when the first-time login does not match a valid card', async () => {
		const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		const fakeToken = autumndbTestUtils.generateRandomId();
		await expect(
			ctx.processAction(ctx.session, {
				type: 'action-request@1.0.0',
				data: {
					action: 'action-complete-first-time-login@1.0.0',
					logContext: ctx.logContext,
					card: user.id,
					type: user.type,
					epoch: new Date().valueOf(),
					timestamp: new Date().toISOString(),
					actor: user.id,
					input: {
						id: user.id,
					},
					arguments: {
						firstTimeLoginToken: fakeToken,
						newPassword: autumndbTestUtils.generateRandomId(),
					},
				},
			}),
		).rejects.toThrowError();
	});

	test('should fail when the first-time login token has expired', async () => {
		const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-send-first-time-login-link@1.0.0',
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

		const match = await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
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

		const now = new Date();
		const hourInPast = now.setHours(now.getHours() - 1);
		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts[match.type],
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			match,
			[
				{
					op: 'replace',
					path: '/data/expiresAt',
					value: new Date(hourInPast).toISOString(),
				},
			],
		);
		await ctx.flushAll(ctx.session);

		await expect(
			ctx.processAction(ctx.session, {
				type: 'action-request@1.0.0',
				data: {
					action: 'action-complete-first-time-login@1.0.0',
					logContext: ctx.logContext,
					card: user.id,
					type: user.type,
					epoch: new Date().valueOf(),
					timestamp: new Date().toISOString(),
					actor: user.id,
					input: {
						id: user.id,
					},
					arguments: {
						firstTimeLoginToken: match.data.firstTimeLoginToken,
						newPassword: autumndbTestUtils.generateRandomId(),
					},
				},
			}),
		).rejects.toThrowError();
	});

	test('should fail when the first-time login is not active', async () => {
		const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-send-first-time-login-link@1.0.0',
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

		const match = await ctx.waitForMatch({
			type: 'object',
			$$links: {
				'is attached to': {
					type: 'object',
					required: ['id'],
					properties: {
						id: {
							type: 'string',
							const: user.id,
						},
					},
				},
			},
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
		});

		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-delete-card@1.0.0',
				context: ctx.logContext,
				card: match.id,
				type: match.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: user.id,
				input: {
					id: match.id,
				},
				arguments: {},
			},
		});

		await expect(
			ctx.processAction(ctx.session, {
				type: 'action-request@1.0.0',
				data: {
					action: 'action-complete-first-time-login@1.0.0',
					logContext: ctx.logContext,
					card: user.id,
					type: user.type,
					epoch: new Date().valueOf(),
					timestamp: new Date().toISOString(),
					actor: user.id,
					input: {
						id: user.id,
					},
					arguments: {
						firstTimeLoginToken: match.data.firstTimeLoginToken,
						newPassword: autumndbTestUtils.generateRandomId(),
					},
				},
			}),
		).rejects.toThrowError();
	});

	test('should fail if the user becomes inactive between requesting and completing the first-time login', async () => {
		const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
		const session = { actor: user };
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-send-first-time-login-link@1.0.0',
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

		await ctx.processAction(ctx.session, {
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

		const match = await ctx.waitForMatch({
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
		});

		const newPassword = autumndbTestUtils.generateRandomId();
		const completeFirstTimeLoginAction = (await ctx.worker.pre(ctx.session, {
			action: 'action-complete-first-time-login@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {
				firstTimeLoginToken: match.data.firstTimeLoginToken,
				newPassword,
			},
		})) as any;

		// TODO: Remove temporary workaround for context/logContext mismatch
		completeFirstTimeLoginAction.context =
			completeFirstTimeLoginAction.logContext;
		completeFirstTimeLoginAction.epoch = new Date().valueOf();
		completeFirstTimeLoginAction.timestamp = new Date().toISOString();
		completeFirstTimeLoginAction.actor = user.id;
		completeFirstTimeLoginAction.input = {
			id: user.id,
		};
		Reflect.deleteProperty(completeFirstTimeLoginAction, 'logContext');

		await expect(
			ctx.processAction(session, completeFirstTimeLoginAction),
		).rejects.toThrowError();
	});

	test('should invalidate the first-time-login card', async () => {
		const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-send-first-time-login-link@1.0.0',
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
					username: user.slug,
				},
			},
		});

		const firstTimeLogin = await ctx.waitForMatch({
			type: 'object',
			$$links: {
				'is attached to': {
					type: 'object',
					required: ['id'],
					properties: {
						id: {
							type: 'string',
							const: user.id,
						},
					},
				},
			},
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
			required: ['type'],
			additionalProperties: true,
		});

		// Execute action and check that the first time login contract was invalidated
		await handler(
			ctx.session,
			actionContext,
			user,
			makeHandlerRequest(ctx, actionCompleteFirstTimeLogin.contract, {
				firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
				newPassword: autumndbTestUtils.generateRandomId(),
			}),
		);

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			firstTimeLogin.id,
		);
		assert(updated);
		expect(updated.active).toBe(false);
	});

	test('should throw an error when the user already has a password set', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			autumndbTestUtils.generateRandomId(),
		);
		await ctx.createLinkThroughWorker(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-send-first-time-login-link@1.0.0',
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

		const match = await ctx.waitForMatch({
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
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

		await expect(
			ctx.processAction(ctx.session, {
				type: 'action-request@1.0.0',
				data: {
					action: 'action-complete-first-time-login@1.0.0',
					logContext: ctx.logContext,
					card: user.id,
					type: user.type,
					epoch: new Date().valueOf(),
					timestamp: new Date().toISOString(),
					actor: user.id,
					input: {
						id: user.id,
					},
					arguments: {
						firstTimeLoginToken: match.data.firstTimeLoginToken,
						newPassword: autumndbTestUtils.generateRandomId(),
					},
				},
			}),
		).rejects.toThrowError();
	});
});
