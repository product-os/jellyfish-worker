/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as nock from 'nock';
import * as helpers from '../helpers';
import { v4 as uuidv4 } from 'uuid';
import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import { TypeContract, UserContract } from '@balena/jellyfish-types/build/core';
import { strict as assert } from 'assert';

const MAIL_OPTIONS = environment.mail.options;

let ctx: helpers.IntegrationTestContext & {
	userEmail: string;
	userTypeContract: TypeContract;
	orgTypeContract: TypeContract;
	adminUser: UserContract;
	user: {
		data: {
			id: string;
			type: string;
		};
	};
	username: string;
	org: {
		data: {
			id: string;
			type: string;
		};
	};
	nockRequest: any;
	adminOrgLink: {
		data: {
			id: string;
			type: string;
		};
	};
};

const checkForKeyValue = (key, value, text) => {
	const pattern = new RegExp(`name="${key}"\\s*${value}`, 'm');
	const regex = text.search(pattern);
	return regex !== -1;
};

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

beforeAll(async () => {
	ctx = await helpers.worker.before();
	const { jellyfish, context, session } = ctx;
	const userTypeContract = await jellyfish.getCardBySlug<TypeContract>(
		context,
		session,
		'user@latest',
	);

	assert(userTypeContract !== null);

	const orgTypeContract = await jellyfish.getCardBySlug<TypeContract>(
		context,
		session,
		'org@latest',
	);

	assert(orgTypeContract !== null);

	const adminUser = await jellyfish.getCardBySlug<UserContract>(
		context,
		session,
		'user-admin@1.0.0',
	);
	assert(adminUser !== null);

	ctx = {
		...ctx,
		userEmail: 'test@test.com',
		userTypeContract,
		orgTypeContract,
		adminUser,
	};
});

beforeEach(async () => {
	const {
		worker,
		session,
		context,
		processAction,
		userTypeContract,
		orgTypeContract,
		adminUser,
		userEmail,
	} = ctx;

	const nockRequest = (fn) => {
		nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
			.persist()
			.post('/messages')
			.basicAuth({
				user: 'api',
				pass: MAIL_OPTIONS!.token,
			})
			.reply(200, (_uri, sendBody) => {
				if (fn) {
					fn(sendBody);
				}
			});
	};

	// Create user
	const username = ctx.generateRandomSlug();
	const createUserAction = await worker.pre(session, {
		action: 'action-create-user@1.0.0',
		context,
		card: userTypeContract.id,
		type: userTypeContract.type,
		arguments: {
			username: `user-${username}`,
			password: 'foobarbaz',
			email: userEmail,
		},
	});
	const user = await processAction(session, createUserAction);

	// Create org
	const org = await processAction(session, {
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

	// Link user to org
	const userOrgLinkAction = await createOrgLinkAction({
		toId: user.data.id,
		fromId: org.data.id,
		context,
	});
	await processAction(session, userOrgLinkAction);

	// Link admin user to org
	const adminOrgLinkAction = await createOrgLinkAction({
		toId: adminUser.id,
		fromId: org.data.id,
		context,
	});
	const adminOrgLink = await processAction(session, adminOrgLinkAction);

	ctx = {
		...ctx,
		user,
		username,
		org,
		nockRequest,
		adminOrgLink,
	};
});

afterEach(async () => {
	nock.cleanAll();
	await ctx.processAction(ctx.session, {
		action: 'action-delete-card@1.0.0',
		context: ctx.context,
		card: ctx.adminOrgLink.data.id,
		type: ctx.adminOrgLink.data.type,
		arguments: {},
	});
});

afterAll(async () => {
	await helpers.worker.after(ctx);
});

describe('action-send-first-time-login-link', () => {
	it('should create a first-time login card and user link for a user', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			nockRequest,
		} = ctx;

		nockRequest();

		const sendFirstTimeLogin = await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		expect(sendFirstTimeLogin.error).toBe(false);

		const [firstTimeLogin] = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type'],
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
			},
			{
				limit: 1,
			},
		);

		assert.ok(firstTimeLogin);
		assert.ok(firstTimeLogin.links);

		expect(new Date((firstTimeLogin.data as any).expiresAt) > new Date()).toBe(
			true,
		);
		expect(firstTimeLogin.links['is attached to'][0].id).toBe(user.data.id);
	});

	it('should send a first-time-login email to a user', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			userEmail,
			username,
			nockRequest,
		} = ctx;

		let mailBody;
		const saveBody = (body) => {
			mailBody = body;
		};

		nockRequest(saveBody);

		const sendFirstTimeLoginAction = {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		};

		const sendFirstTimeLogin = await processAction(
			session,
			sendFirstTimeLoginAction,
		);
		expect(sendFirstTimeLogin.error).toBe(false);

		const [firstTimeLogin] = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type', 'data'],
				additionalProperties: false,
				properties: {
					type: {
						type: 'string',
						const: 'first-time-login@1.0.0',
					},
					data: {
						type: 'object',
						properties: {
							firstTimeLoginToken: {
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

		const firstTimeLoginUrl = `https://jel.ly.fish/first_time_login/${firstTimeLogin.data.firstTimeLoginToken}/${username}`;

		const expectedEmailBody = `<p>Hello,</p><p>Here is a link to login to your new Jellyfish account ${username}.</p><p>Please use the link below to set your password and login:</p><a href="${firstTimeLoginUrl}">${firstTimeLoginUrl}</a><p>Cheers</p><p>Jellyfish Team</p><a href="https://jel.ly.fish">https://jel.ly.fish</a>`;

		const fromIsInBody = checkForKeyValue(
			'from',
			'no-reply@mail.ly.fish',
			mailBody,
		);
		const toIsInBody = checkForKeyValue('to', userEmail, mailBody);
		const subjectIsInBody = checkForKeyValue(
			'subject',
			'Jellyfish First Time Login',
			mailBody,
		);
		const htmlIsInBody = checkForKeyValue('html', expectedEmailBody, mailBody);

		expect(toIsInBody).toBe(true);
		expect(fromIsInBody).toBe(true);
		expect(subjectIsInBody).toBe(true);
		expect(htmlIsInBody).toBe(true);
	});

	it('should throw error if the user is inactive', async () => {
		const { context, processAction, user, session, nockRequest, worker } = ctx;

		nockRequest();

		const requestDelete = await processAction(session, {
			action: 'action-delete-card@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});
		expect(requestDelete.error).toBe(false);

		const sendFirstTimeLoginAction = {
			action: 'action-send-first-time-login-link@1.0.0',
			context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		};

		await expect(
			processAction(session, sendFirstTimeLoginAction),
		).rejects.toThrow(worker.errors.WorkerNoElement);
	});

	it('should invalidate previous first-time logins', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			nockRequest,
		} = ctx;

		nockRequest();

		const sendFirstTimeLoginAction = {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		};

		const firstPasswordResetRequest = await processAction(
			session,
			sendFirstTimeLoginAction,
		);
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondPasswordResetRequest = await processAction(
			session,
			sendFirstTimeLoginAction,
		);
		expect(secondPasswordResetRequest.error).toBe(false);

		const firstTimeLogins = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
				required: ['type'],
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
			},
			{
				sortBy: 'created_at',
			},
		);

		expect(firstTimeLogins.length).toBe(2);
		expect(firstTimeLogins[0].active).toBe(false);
		expect(firstTimeLogins[1].active).toBe(true);
	});

	it('should not invalidate previous first-time logins from other users', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			user,
			userTypeContract,
			org,
			worker,
			nockRequest,
		} = ctx;

		nockRequest();

		const otherUsername = 'janedoe';

		const createUserAction = await worker.pre(session, {
			action: 'action-create-user@1.0.0',
			context,
			card: userTypeContract.id,
			type: userTypeContract.type,
			arguments: {
				email: 'other@user.com',
				username: `user-${otherUsername}`,
				password: 'apassword',
			},
		});

		const otherUser = await processAction(session, createUserAction);
		expect(otherUser.error).toBe(false);

		const linkAction = await createOrgLinkAction({
			toId: otherUser.data.id,
			fromId: org.data.id,
			context,
		});

		await processAction(session, linkAction);

		await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: otherUser.data.id,
			type: otherUser.data.type,
			arguments: {},
		});

		await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const firstTimeLogins = await jellyfish.query(
			context,
			session,
			{
				type: 'object',
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

		expect(firstTimeLogins.length).toBe(2);
		expect(firstTimeLogins[0].active).toBe(true);
	});

	it('successfully sends an email to a user with an array of emails', async () => {
		const {
			jellyfish,
			session,
			context,
			processAction,
			userTypeContract,
			worker,
			org,
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
			card: userTypeContract.id,
			type: userTypeContract.type,
			arguments: {
				email: firstEmail,
				username: `user-${newUsername}`,
				password: 'foobarbaz',
			},
		});

		const newUser = await processAction(session, createUserAction);
		expect(newUser.error).toBe(false);

		const sendUpdateCard = {
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

		const sendUpdate = await processAction(session, sendUpdateCard);
		expect(sendUpdate.error).toBe(false);

		const userWithEmailArray = await jellyfish.getCardById(
			context,
			session,
			newUser.data.id,
		);

		assert(userWithEmailArray !== null);

		expect(userWithEmailArray.data.email).toEqual([firstEmail, secondEmail]);

		const linkAction = await createOrgLinkAction({
			toId: newUser.data.id,
			fromId: org.data.id,
			context,
		});

		await processAction(session, linkAction);

		const firstTimeLoginRequest = {
			action: 'action-send-first-time-login-link@1.0.0',
			context,
			card: newUser.data.id,
			type: newUser.data.type,
			arguments: {},
		};

		const firstTimeLogin = await processAction(session, firstTimeLoginRequest);
		expect(firstTimeLogin.error).toBe(false);

		const toIsInBody = checkForKeyValue('to', firstEmail, mailBody);
		expect(toIsInBody).toBe(true);
	});

	it('throws an error when the first-time-login user has no org', async () => {
		const {
			session,
			context,
			processAction,
			userTypeContract,
			worker,
			nockRequest,
		} = ctx;

		nockRequest();

		const userSlug = ctx.generateRandomSlug({
			prefix: 'user',
		});

		const createUserAction = await worker.pre(session, {
			action: 'action-create-user@1.0.0',
			context,
			card: userTypeContract.id,
			type: userTypeContract.type,
			arguments: {
				email: 'new@email.com',
				username: userSlug,
				password: 'foobarbaz',
			},
		});

		const newUser = await processAction(session, createUserAction);
		expect(newUser.error).toBe(false);

		await expect(
			processAction(session, {
				action: 'action-send-first-time-login-link@1.0.0',
				context,
				card: newUser.data.id,
				type: newUser.data.type,
				arguments: {},
			}),
		).rejects.toThrow(worker.errors.WorkerNoElement);
	});

	it('throws an error when the first-time-login requester has no org', async () => {
		const {
			session,
			context,
			processAction,
			adminOrgLink,
			user,
			worker,
			nockRequest,
		} = ctx;

		nockRequest();

		await processAction(session, {
			action: 'action-delete-card@1.0.0',
			context,
			card: adminOrgLink.data.id,
			type: adminOrgLink.data.type,
			arguments: {},
		});

		await expect(
			processAction(session, {
				action: 'action-send-first-time-login-link@1.0.0',
				context,
				card: user.data.id,
				type: user.data.type,
				arguments: {},
			}),
		).rejects.toThrow(worker.errors.WorkerNoElement);
	});

	it("throws an error when the first-time-login user does not belong to the requester's org", async () => {
		const {
			session,
			context,
			processAction,
			userTypeContract,
			orgTypeContract,
			worker,
			nockRequest,
		} = ctx;

		nockRequest();

		const userSlug = ctx.generateRandomSlug({
			prefix: 'user',
		});
		const userPassword = 'foobarbaz';

		const createUserAction = await worker.pre(session, {
			action: 'action-create-user@1.0.0',
			context,
			card: userTypeContract.id,
			type: userTypeContract.type,
			arguments: {
				email: 'new@email.com',
				username: userSlug,
				password: userPassword,
			},
		});

		const newUser = await processAction(session, createUserAction);
		expect(newUser.error).toBe(false);

		const newOrg = await processAction(session, {
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

		const linkAction = await createOrgLinkAction({
			toId: newUser.data.id,
			fromId: newOrg.data.id,
			context,
		});

		await processAction(session, linkAction);

		await expect(
			processAction(session, {
				action: 'action-send-first-time-login-link@1.0.0',
				context,
				card: newUser.data.id,
				type: newUser.data.type,
				arguments: {},
			}),
		).rejects.toThrow(worker.errors.WorkerAuthenticationError);
	});

	it('a community role is added to a supplied user with no role set', async () => {
		const {
			session,
			context,
			processAction,
			userTypeContract,
			org,
			jellyfish,
			worker,
			nockRequest,
		} = ctx;

		nockRequest();

		const createUserAction = await worker.pre(session, {
			action: 'action-create-card@1.0.0',
			context,
			card: userTypeContract.id,
			type: userTypeContract.type,
			arguments: {
				reason: 'for testing',
				properties: {
					slug: ctx.generateRandomSlug({
						prefix: 'user',
					}),
					data: {
						hash: 'fake-hash',
						email: 'fake@email.com',
						roles: [],
					},
				},
			},
		});

		const userWithoutRole = await processAction(session, createUserAction);
		expect(userWithoutRole.error).toBe(false);

		const linkAction = await createOrgLinkAction({
			toId: userWithoutRole.data.id,
			fromId: org.data.id,
			context,
		});

		await processAction(session, linkAction);

		await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context,
			card: userWithoutRole.data.id,
			type: userWithoutRole.data.type,
			arguments: {},
		});

		const updatedUser = await jellyfish.getCardById(
			context,
			session,
			userWithoutRole.data.id,
		);

		assert(updatedUser !== null);

		expect(updatedUser.data.roles).toEqual(['user-community']);
	});

	it('a community role is added to a supplied user when it is not present in the roles field', async () => {
		const {
			session,
			context,
			processAction,
			userTypeContract,
			org,
			jellyfish,
			worker,
			nockRequest,
		} = ctx;

		nockRequest();

		const createUserAction = await worker.pre(session, {
			action: 'action-create-card@1.0.0',
			context,
			card: userTypeContract.id,
			type: userTypeContract.type,
			arguments: {
				reason: 'for testing',
				properties: {
					slug: ctx.generateRandomSlug({
						prefix: 'user',
					}),
					data: {
						hash: 'fake-hash',
						email: 'fake@email.com',
						roles: ['user-external-support'],
					},
				},
			},
		});

		const userWithoutRole = await processAction(session, createUserAction);
		expect(userWithoutRole.error).toBe(false);

		const linkAction = await createOrgLinkAction({
			toId: userWithoutRole.data.id,
			fromId: org.data.id,
			context,
		});

		await processAction(session, linkAction);

		await processAction(session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context,
			card: userWithoutRole.data.id,
			type: userWithoutRole.data.type,
			arguments: {},
		});

		const updatedUser = await jellyfish.getCardById(
			context,
			session,
			userWithoutRole.data.id,
		);

		assert(updatedUser !== null);

		expect(updatedUser.data.roles).toEqual([
			'user-external-support',
			'user-community',
		]);
	});
});
