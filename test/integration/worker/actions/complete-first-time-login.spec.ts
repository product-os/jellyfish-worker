/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as nock from 'nock';
import * as helpers from '../helpers';
import { v4 as uuidv4 } from 'uuid';
import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import { strict as assert } from 'assert';
import { TypeContract } from '@balena/jellyfish-types/build/core';

let ctx: helpers.IntegrationTestContext & {
	userTypeContract: TypeContract;
	org: {
		data: {
			id: string;
		};
	};
};

const MAIL_OPTIONS = environment.mail.options;

const createOrgLinkAction = async ({ fromId, toId, context }) => {
	return {
		action: 'action-create-card@1.0.0',
		context,
		card: 'link',
		type: 'type',
		arguments: {
			reason: 'for testing',
			properties: {
				slug: `link-${fromId}-has-member-${toId}-${uuidv4()}`,
				version: '1.0.0',
				name: 'has member',
				data: {
					inverseName: 'is member of',
					to: {
						id: toId,
						type: 'user@1.0.0',
					},
					from: {
						id: fromId,
						type: 'org@1.0.0',
					},
				},
			},
		},
	};
};

// Create new user and link to test org
const createUser = async (withPassword: boolean) => {
	let user;
	if (withPassword) {
		const createUserAction = await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			context: ctx.context,
			card: ctx.userTypeContract.id,
			type: ctx.userTypeContract.type,
			arguments: {
				email: 'test@test.com',
				password: 'a-very-dumb-password',
				username: ctx.generateRandomSlug({
					prefix: 'user',
				}),
			},
		});
		user = await ctx.processAction(ctx.session, createUserAction);
	} else {
		user = await ctx.processAction(ctx.session, {
			action: 'action-create-card@1.0.0',
			context: ctx.context,
			card: ctx.userTypeContract.id,
			type: ctx.userTypeContract.type,
			arguments: {
				reason: 'for testing',
				properties: {
					slug: ctx.generateRandomSlug({
						prefix: 'user',
					}),
					data: {
						email: 'test@test.com',
						hash: 'PASSWORDLESS',
						roles: ['user-community'],
					},
				},
			},
		});
	}

	// Link new user to test org
	const userOrgLinkAction = await createOrgLinkAction({
		toId: user.data.id,
		fromId: ctx.org.data.id,
		context: ctx.context,
	});
	await ctx.processAction(ctx.session, userOrgLinkAction);

	return user;
};

beforeAll(async () => {
	ctx = await helpers.worker.before();
	const { session, jellyfish, context, processAction } = ctx;

	nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
		.persist()
		.post('/messages')
		.basicAuth({
			user: 'api',
			pass: MAIL_OPTIONS!.token,
		})
		.reply(200);

	const orgTypeContract = await jellyfish.getCardBySlug(
		context,
		session,
		'org@latest',
	);
	assert(orgTypeContract !== null);

	const userTypeContract = await jellyfish.getCardBySlug<TypeContract>(
		context,
		session,
		'user@latest',
	);

	assert(userTypeContract !== null);
	ctx.userTypeContract = userTypeContract;
	ctx.org = await processAction(session, {
		action: 'action-create-card@1.0.0',
		context,
		card: orgTypeContract.id,
		type: orgTypeContract.type,
		arguments: {
			reason: 'for testing',
			properties: {
				name: 'foobar',
			},
		},
	});

	// Get admin user and link to org
	const adminUser = await jellyfish.getCardBySlug(
		context,
		session,
		'user-admin@1.0.0',
	);

	assert(adminUser !== null);

	const adminOrgLinkAction = await createOrgLinkAction({
		toId: adminUser.id,
		fromId: ctx.org.data.id,
		context,
	});
	await processAction(session, adminOrgLinkAction);
});

afterAll(() => {
	return helpers.worker.after(ctx);
});

describe('action-complete-first-time-login', () => {
	it("should update the user's password when the firstTimeLoginToken is valid", async () => {
		const { session, context, processAction, jellyfish, worker } = ctx;

		const user = await createUser(false);

		await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await jellyfish.query(context, session, {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
		});

		const newPassword = 'newPassword';

		const completeFirstTimeLoginAction = await worker.pre(session, {
			action: 'action-complete-first-time-login@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
				newPassword,
			},
		});

		await processAction(session, completeFirstTimeLoginAction);

		await expect(
			worker.pre(session, {
				action: 'action-create-session@1.0.0',
				card: user.data.id,
				type: user.data.type,
				context,
				arguments: {
					password: 'PASSWORDLESS',
				},
			}),
		).rejects.toThrow(worker.errors.WorkerAuthenticationError);

		const newPasswordLoginRequest = await ctx.worker.pre(ctx.session, {
			action: 'action-create-session@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
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

	it('should fail when the first-time login does not match a valid card', async () => {
		const { session, context, worker, processAction } = ctx;

		const user = await createUser(false);

		const fakeToken = uuidv4();

		await expect(
			processAction(session, {
				action: 'action-complete-first-time-login@1.0.0',
				context,
				card: user.data.id,
				type: user.data.type,
				arguments: {
					firstTimeLoginToken: fakeToken,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(worker.errors.WorkerAuthenticationError);
	});

	it('should fail when the first-time login token has expired', async () => {
		const { jellyfish, session, context, worker, processAction } = ctx;

		const user = await createUser(false);

		await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await jellyfish.query(context, session, {
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
							const: user.data.id,
						},
					},
				},
			},
		});

		const now = new Date();
		const hourInPast = now.setHours(now.getHours() - 1);
		const newExpiry = new Date(hourInPast);

		await processAction(session, {
			action: 'action-update-card@1.0.0',
			context,
			card: firstTimeLogin.id,
			type: firstTimeLogin.type,
			arguments: {
				reason: 'Expiring for test',
				patch: [
					{
						op: 'replace',
						path: '/data/expiresAt',
						value: newExpiry.toISOString(),
					},
				],
			},
		});

		await expect(
			processAction(session, {
				action: 'action-complete-first-time-login@1.0.0',
				context,
				card: user.data.id,
				type: user.data.type,
				arguments: {
					firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(worker.errors.WorkerAuthenticationError);
	});

	it('should fail when the first-time login is not active', async () => {
		const { jellyfish, session, context, worker, processAction } = ctx;
		const user = await createUser(false);

		await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await jellyfish.query(context, session, {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
		});

		await processAction(session, {
			action: 'action-delete-card@1.0.0',
			context,
			card: firstTimeLogin.id,
			type: firstTimeLogin.type,
			arguments: {},
		});

		await expect(
			processAction(session, {
				action: 'action-complete-first-time-login@1.0.0',
				context,
				card: user.data.id,
				type: user.data.type,
				arguments: {
					firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(worker.errors.WorkerAuthenticationError);
	});

	it('should fail if the user becomes inactive between requesting and completing the first-time login', async () => {
		const { session, context, processAction, worker, jellyfish } = ctx;
		const user = await createUser(false);

		await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username: user.data.slug,
			},
		});

		await processAction(session, {
			action: 'action-delete-card@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await jellyfish.query(context, session, {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
		});

		const completePasswordReset = await worker.pre(session, {
			action: 'action-complete-first-time-login@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
				newPassword: 'new-password',
			},
		});

		await expect(processAction(session, completePasswordReset)).rejects.toThrow(
			worker.errors.WorkerAuthenticationError,
		);
	});

	it('should invalidate the first-time-login card', async () => {
		const { session, context, processAction, worker, jellyfish } = ctx;
		const user = await createUser(false);

		await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await jellyfish.query(context, session, {
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
							const: user.data.id,
						},
					},
				},
			},
		});

		const completePasswordReset = await worker.pre(session, {
			action: 'action-complete-first-time-login@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
				newPassword: 'new-password',
			},
		});

		await processAction(session, completePasswordReset);

		const [updatedFirstTimeLogin] = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type', 'active'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'first-time-login@1.0.0',
					},
					active: {
						type: 'boolean',
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(updatedFirstTimeLogin.active).toBe(false);
	});

	it('should throw an error when the user already has a password set', async () => {
		const { session, context, processAction, worker, jellyfish } = ctx;
		const user = await createUser(true);

		await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await jellyfish.query(context, session, {
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
							const: user.data.id,
						},
					},
				},
			},
		});

		await expect(
			processAction(session, {
				action: 'action-complete-first-time-login@1.0.0',
				context,
				card: user.data.id,
				type: user.data.type,
				arguments: {
					firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(worker.errors.WorkerAuthenticationError);
	});
});
