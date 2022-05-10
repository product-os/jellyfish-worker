import { strict as assert } from 'assert';
import {
	errors as autumndbErrors,
	testUtils as autumndbTestUtils,
} from 'autumndb';
import { ActionRequestContract, testUtils, WorkerContext } from '../../../lib';
import { actionCreateCard } from '../../../lib/actions/action-create-card';
import { makeRequest } from './helpers';

let ctx: testUtils.TestContext;
let actionContext: WorkerContext;
let guestUser: any;
let guestUserSession: any;

beforeAll(async () => {
	ctx = await testUtils.newContext();

	actionContext = ctx.worker.getActionContext(ctx.logContext);

	guestUser = await ctx.createUser(
		autumndbTestUtils.generateRandomSlug(),
		undefined,
		['user-guest'],
	);

	guestUserSession = await ctx.createSession(guestUser);
});

afterAll(async () => {
	await testUtils.destroyContext(ctx);
});

describe('action-create-card', () => {
	test('should use provided slug', async () => {
		const request = makeRequest(ctx, {
			properties: {
				slug: autumndbTestUtils.generateRandomSlug(),
				type: 'card@1.0.0',
			},
		});

		const result: any = await actionCreateCard.handler(
			ctx.session,
			actionContext,
			ctx.worker.typeContracts['card@1.0.0'],
			request,
		);
		assert(result);
		expect(result.slug).toEqual(request.arguments.properties.slug);
	});

	test('should throw when creating multiple contracts with same slug', async () => {
		// Create first contract
		const slug = autumndbTestUtils.generateRandomSlug();
		const result: any = await actionCreateCard.handler(
			ctx.session,
			actionContext,
			ctx.worker.typeContracts['card@1.0.0'],
			makeRequest(ctx, {
				properties: {
					slug,
					type: 'card@1.0.0',
				},
			}),
		);
		assert(result);
		expect(result.slug).toEqual(slug);

		await expect(() => {
			return actionCreateCard.handler(
				ctx.session,
				actionContext,
				ctx.worker.typeContracts['card@1.0.0'],
				makeRequest(ctx, {
					properties: {
						slug,
						type: 'card@1.0.0',
					},
				}),
			);
		}).rejects.toThrowError(autumndbErrors.JellyfishElementAlreadyExists);
	});

	test('should generate a slug when one is not provided', async () => {
		const request = makeRequest(ctx, {
			properties: {
				type: 'card@1.0.0',
			},
		});

		const result: any = await actionCreateCard.handler(
			ctx.session,
			actionContext,
			ctx.worker.typeContracts['card@1.0.0'],
			request,
		);
		assert(result);
		expect(result.slug).toMatch(/^card-/);
	});

	test('should fail to create an event with an action-create-card', async () => {
		const contractType = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		assert(contractType);

		const typeType = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'type@latest',
		);
		assert(typeType);

		const id = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeType.id,
					type: typeType.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeType.id,
					},
					timestamp: new Date().toISOString(),
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
			},
		);
		assert(id);
		await ctx.flushAll(ctx.session);

		const typeResult: any = await ctx.worker.producer.waitResults(
			ctx.logContext,
			id,
		);
		assert(typeResult);
		expect(typeResult.error).toBe(false);

		const threadId = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeResult.data.id,
					type: typeResult.data.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeResult.data.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: autumndbTestUtils.generateRandomSlug(),
							data: {
								mentions: [],
							},
						},
					},
				},
			},
		);
		assert(threadId);
		await ctx.flushAll(ctx.session);

		const threadResult = await ctx.worker.producer.waitResults(
			ctx.logContext,
			threadId,
		);
		expect(threadResult.error).toBe(false);

		await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					card: contractType.id,
					context: ctx.logContext,
					type: contractType.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: contractType.id,
					},
					timestamp: new Date().toISOString(),
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
				},
			},
		);

		await expect(ctx.flush(ctx.session)).rejects.toThrow(
			'You may not use contract actions to create an event',
		);
	});

	test('should create a new contract along with a reason', async () => {
		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		assert(typeContract);

		const createRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: 'My new contract',
						properties: {
							slug: autumndbTestUtils.generateRandomSlug(),
							version: '1.0.0',
						},
					},
				},
			},
		);
		assert(createRequest);
		await ctx.flushAll(ctx.session);

		const createResult = await ctx.worker.producer.waitResults(
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
		expect(timeline[0].name).toBe('My new contract');
	});

	test('should be able to insert a deeply nested contract', async () => {
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

		const typeContract = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		assert(typeContract);
		const slug = autumndbTestUtils.generateRandomSlug();

		const createRequest = await ctx.worker.insertCard<ActionRequestContract>(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['action-request@1.0.0'],
			{},
			{
				data: {
					action: 'action-create-card@1.0.0',
					context: ctx.logContext,
					card: typeContract.id,
					type: typeContract.type,
					actor: ctx.adminUserId,
					epoch: new Date().valueOf(),
					input: {
						id: typeContract.id,
					},
					timestamp: new Date().toISOString(),
					arguments: {
						reason: null,
						properties: {
							slug,
							version: '1.0.0',
							data,
						},
					},
				},
			},
		);
		assert(createRequest);
		await ctx.flushAll(ctx.session);

		const createResult = await ctx.worker.producer.waitResults(
			ctx.logContext,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const contract = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			(createResult.data as any).id,
		);
		assert(contract);
		expect(contract.slug).toBe(slug);
		expect(contract.version).toBe('1.0.0');
		expect(contract.data).toEqual(data);
	});

	test('a community user cannot create a session that points to another user', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomId().split('-')[0],
		);
		expect(user.data.roles).toEqual(['user-community']);
		const session = await ctx.createSession(user);

		const otherUser = autumndbTestUtils.generateRandomId();
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
					originator: autumndbTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: autumndbTestUtils.generateRandomSlug({
								prefix: 'session',
							}),
							data: {
								actor: otherUser,
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(autumndbErrors.JellyfishPermissionsError);
	});

	test('creating a role with a community user session should fail', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomId().split('-')[0],
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
					originator: autumndbTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: autumndbTestUtils.generateRandomSlug({
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
		).rejects.toThrow(autumndbErrors.JellyfishUnknownCardType);
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
					originator: autumndbTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: autumndbTestUtils.generateRandomSlug({
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
		).rejects.toThrow(autumndbErrors.JellyfishUnknownCardType);
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
					originator: autumndbTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: autumndbTestUtils.generateRandomSlug({
								prefix: 'user',
							}),
							data: {
								roles: [],
								hash: autumndbTestUtils.generateRandomId(),
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(autumndbErrors.JellyfishUnknownCardType);
	});

	test('users with no roles should not be able to create sessions for other users', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomId().split('-')[0],
		);
		const session = await ctx.createSession(user);
		const targetUser = await ctx.createUser(
			autumndbTestUtils.generateRandomId().split('-')[0],
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
					originator: autumndbTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: autumndbTestUtils.generateRandomSlug({
								prefix: 'session',
							}),
							data: {
								actor: targetUser.id,
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(autumndbErrors.JellyfishUnknownCardType);
	});

	test('users should not be able to create action requests', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomId().split('-')[0],
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
					originator: autumndbTestUtils.generateRandomId(),
					arguments: {
						reason: null,
						properties: {
							slug: autumndbTestUtils.generateRandomSlug({
								prefix: 'action-request',
							}),
							data: {
								epoch: 1559123116431,
								timestamp: '2019-05-29T09:45:16.431Z',
								context: {
									id: 'REQUEST-17.21.6-237c6999-64bb-4df0-ba7f-2f303003a609',
									api: 'SERVER-17.21.6-localhost-e0f6fe9b-60e3-4d41-b575-1e719febe55b',
								},
								actor: autumndbTestUtils.generateRandomId(),
								action: 'action-create-session@1.0.0',
								input: {
									id: autumndbTestUtils.generateRandomId(),
								},
								arguments: {
									password: autumndbTestUtils.generateRandomId(),
								},
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(autumndbErrors.JellyfishPermissionsError);
	});
});
