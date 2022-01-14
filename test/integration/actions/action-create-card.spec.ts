import { strict as assert } from 'assert';
import {
	errors as coreErrors,
	Kernel,
	testUtils as coreTestUtils,
} from '@balena/jellyfish-core';
import { testUtils, WorkerContext } from '../../../lib';
import { actionCreateCard } from '../../../lib/actions/action-create-card';
import { makeRequest } from './helpers';

let ctx: testUtils.TestContext;
let actionContext: WorkerContext;
let guestUser: any;
let guestUserSession: any;

beforeAll(async () => {
	ctx = await testUtils.newContext();

	actionContext = ctx.worker.getActionContext(ctx.logContext);

	guestUser = await ctx.kernel.getCardBySlug(
		ctx.logContext,
		ctx.session,
		'user-guest@1.0.0',
	);
	assert(guestUser);

	guestUserSession = await ctx.kernel.replaceCard(
		ctx.logContext,
		ctx.session,
		Kernel.defaults({
			slug: 'session-guest',
			version: '1.0.0',
			type: 'session@1.0.0',
			data: {
				actor: guestUser.id,
			},
		}),
	);
	assert(guestUserSession);
});

afterAll(async () => {
	await testUtils.destroyContext(ctx);
});

describe('action-create-card', () => {
	test('should use provided slug', async () => {
		const request = makeRequest(ctx, {
			properties: {
				id: coreTestUtils.generateRandomId(),
				name: coreTestUtils.generateRandomSlug(),
				slug: coreTestUtils.generateRandomSlug({
					prefix: 'message',
				}),
				type: 'message@1.0.0',
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				created_at: new Date().toISOString(),
				requires: [],
				capabilities: [],
				data: {
					actor: ctx.adminUserId,
					payload: {
						message: coreTestUtils.generateRandomSlug(),
					},
					timestamp: new Date().toISOString(),
				},
			},
		});

		const result: any = await actionCreateCard.handler(
			ctx.session,
			actionContext,
			ctx.worker.typeContracts['message@1.0.0'],
			request,
		);
		assert(result);
		expect(result.slug).toEqual(request.arguments.properties.slug);
	});

	test('should generate a slug when one is not provided', async () => {
		const request = makeRequest(ctx, {
			properties: {
				id: coreTestUtils.generateRandomId(),
				name: coreTestUtils.generateRandomSlug(),
				type: 'message@1.0.0',
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				created_at: new Date().toISOString(),
				requires: [],
				capabilities: [],
				data: {
					actor: ctx.adminUserId,
					payload: {
						message: coreTestUtils.generateRandomSlug(),
					},
					timestamp: new Date().toISOString(),
				},
			},
		});

		const result: any = await actionCreateCard.handler(
			ctx.session,
			actionContext,
			ctx.worker.typeContracts['message@1.0.0'],
			request,
		);
		assert(result);
		expect(result.slug).toMatch(/^message-/);
	});

	test('should fail to create an event with an action-create-card', async () => {
		const cardType = await ctx.kernel.getCardBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		assert(cardType);

		const typeType = await ctx.kernel.getCardBySlug(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);
		assert(typeType);

		const id = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeType.id,
				type: typeType.type,
				arguments: {
					reason: null,
					properties: {
						slug: 'test-thread',
						version: '1.0.0',
						data: {
							schema: {
								type: 'object',
								properties: {
									type: {
										type: 'string',
										const: 'test-thread@1.0.0',
									},
									data: {
										type: 'object',
										properties: {
											mentions: {
												type: 'array',
												$$formula:
													'AGGREGATE($events, "data.payload.mentions")',
											},
										},
										additionalProperties: true,
									},
								},
								additionalProperties: true,
								required: ['type', 'data'],
							},
						},
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const typeResult = await ctx.queue.producer.waitResults(ctx.logContext, id);
		expect(typeResult.error).toBe(false);

		const threadId = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: (typeResult.data as any).id,
				type: (typeResult.data as any).type,
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug: coreTestUtils.generateRandomSlug(),
						data: {
							mentions: [],
						},
					},
				},
			},
		);

		await ctx.flushAll(ctx.session);
		const threadResult = await ctx.queue.producer.waitResults(
			ctx.logContext,
			threadId,
		);
		expect(threadResult.error).toBe(false);

		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, {
			action: 'action-create-card@1.0.0',
			card: cardType.id,
			logContext: ctx.logContext,
			type: cardType.type,
			arguments: {
				reason: null,
				properties: {
					version: '1.0.0',
					slug: 'bar',
					data: {
						timestamp: '2018-05-05T00:21:02.459Z',
						target: (threadResult.data as any).id,
						actor: ctx.adminUserId,
						payload: {
							mentions: ['johndoe'],
						},
					},
				},
			},
		});

		await expect(ctx.flush(ctx.session)).rejects.toThrow(
			'You may not use card actions to create an event',
		);
	});

	test('should create a new card along with a reason', async () => {
		const typeCard = await ctx.kernel.getCardBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		assert(typeCard);
		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: 'My new card',
					properties: {
						slug: coreTestUtils.generateRandomSlug(),
						version: '1.0.0',
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const createResult = await ctx.queue.producer.waitResults(
			ctx.logContext,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const timeline = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['type', 'data'],
			properties: {
				type: {
					type: 'string',
					const: 'create@1.0.0',
				},
				data: {
					type: 'object',
					required: ['target'],
					additionalProperties: true,
					properties: {
						target: {
							type: 'string',
							const: (createResult.data as any).id,
						},
					},
				},
			},
		});

		expect(timeline.length).toBe(1);
		expect(timeline[0].name).toBe('My new card');
	});

	test('should be able to insert a deeply nested card', async () => {
		const data = {
			foo: {
				bar: {
					baz: {
						qux: {
							foo: {
								bar: {
									baz: {
										qux: {
											foo: {
												bar: {
													baz: {
														qux: {
															foo: {
																bar: {
																	baz: {
																		qux: {
																			test: 1,
																		},
																	},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		};

		const typeCard = await ctx.kernel.getCardBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		assert(typeCard);
		const slug = coreTestUtils.generateRandomSlug();
		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data,
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const createResult = await ctx.queue.producer.waitResults(
			ctx.logContext,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const card = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			(createResult.data as any).id,
		);
		assert(card);
		expect(card.slug).toBe(slug);
		expect(card.version).toBe('1.0.0');
		expect(card.data).toEqual(data);
	});

	test('a community user cannot create a session that points to another user', async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomId().split('-')[0],
		);
		expect(user.data.roles).toEqual(['user-community']);
		const session = await ctx.createSession(user);

		const otherUser = coreTestUtils.generateRandomId();
		assert(user.id !== otherUser);

		await expect(
			actionCreateCard.handler(
				session.id,
				actionContext,
				ctx.worker.typeContracts['session@1.0.0'],
				{
					context: ctx.logContext,
					timestamp: new Date().toISOString(),
					actor: user.id,
					originator: coreTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: coreTestUtils.generateRandomSlug({
								prefix: 'session',
							}),
							data: {
								actor: otherUser,
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(coreErrors.JellyfishPermissionsError);
	});

	test('creating a role with a community user session should fail', async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomId().split('-')[0],
		);
		expect(user.data.roles).toEqual(['user-community']);
		const session = await ctx.createSession(user);

		await expect(
			actionCreateCard.handler(
				session.id,
				actionContext,
				ctx.worker.typeContracts['role@1.0.0'],
				{
					context: ctx.logContext,
					timestamp: new Date().toISOString(),
					actor: user.id,
					originator: coreTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: coreTestUtils.generateRandomSlug({
								prefix: 'role',
							}),
							data: {
								read: {
									type: 'object',
									additionalProperties: true,
								},
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(coreErrors.JellyfishUnknownCardType);
	});

	test('creating a role with the guest user session should fail', async () => {
		await expect(
			actionCreateCard.handler(
				guestUserSession.id,
				actionContext,
				ctx.worker.typeContracts['role@1.0.0'],
				{
					context: ctx.logContext,
					timestamp: new Date().toISOString(),
					actor: guestUser.id,
					originator: coreTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: coreTestUtils.generateRandomSlug({
								prefix: 'role',
							}),
							data: {
								read: {
									type: 'object',
									additionalProperties: true,
								},
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(coreErrors.JellyfishUnknownCardType);
	});

	test('creating a user with the guest user session should fail', async () => {
		await expect(
			actionCreateCard.handler(
				guestUserSession.id,
				actionContext,
				ctx.worker.typeContracts['user@1.0.0'],
				{
					context: ctx.logContext,
					timestamp: new Date().toISOString(),
					actor: guestUser.id,
					originator: coreTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: coreTestUtils.generateRandomSlug({
								prefix: 'user',
							}),
							data: {
								roles: [],
								hash: coreTestUtils.generateRandomId(),
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(coreErrors.JellyfishPermissionsError);
	});

	test('users with no roles should not be able to create sessions for other users', async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomId().split('-')[0],
		);
		const session = await ctx.createSession(user);
		const targetUser = await ctx.createUser(
			coreTestUtils.generateRandomId().split('-')[0],
		);

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
					path: '/data/roles',
					value: [],
				},
			],
		);

		await expect(
			actionCreateCard.handler(
				session.id,
				actionContext,
				ctx.worker.typeContracts['session@1.0.0'],
				{
					context: ctx.logContext,
					timestamp: new Date().toISOString(),
					actor: user.id,
					originator: coreTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: coreTestUtils.generateRandomSlug({
								prefix: 'session',
							}),
							data: {
								actor: targetUser.id,
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(coreErrors.JellyfishUnknownCardType);
	});

	test('users should not be able to create action requests', async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomId().split('-')[0],
		);
		const session = await ctx.createSession(user);

		await expect(
			actionCreateCard.handler(
				session.id,
				actionContext,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					context: ctx.logContext,
					timestamp: new Date().toISOString(),
					actor: user.id,
					originator: coreTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: coreTestUtils.generateRandomSlug({
								prefix: 'action-request',
							}),
							data: {
								epoch: 1559123116431,
								timestamp: '2019-05-29T09:45:16.431Z',
								context: {
									id: 'REQUEST-17.21.6-237c6999-64bb-4df0-ba7f-2f303003a609',
									api: 'SERVER-17.21.6-localhost-e0f6fe9b-60e3-4d41-b575-1e719febe55b',
								},
								actor: coreTestUtils.generateRandomId(),
								action: 'action-create-session@1.0.0',
								input: {
									id: coreTestUtils.generateRandomId(),
								},
								arguments: {
									password: coreTestUtils.generateRandomId(),
								},
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(coreErrors.JellyfishPermissionsError);
	});
});
