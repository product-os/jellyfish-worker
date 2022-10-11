import { strict as assert } from 'assert';
import {
	errors as autumndbErrors,
	testUtils as autumndbTestUtils,
	UserContract,
} from 'autumndb';
import { v4 as uuidv4 } from 'uuid';
import {
	ActionRequestContract,
	errors,
	testUtils,
	WorkerContext,
} from '../../../lib';
import { actionCreateCard } from '../../../lib/actions/action-create-card';
import { makeRequest } from './helpers';

let ctx: testUtils.TestContext;
let actionContext: WorkerContext;
let guestUser: UserContract;

beforeAll(async () => {
	ctx = await testUtils.newContext();

	actionContext = ctx.worker.getActionContext(ctx.logContext);

	guestUser = await ctx.createUser(
		autumndbTestUtils.generateRandomSlug(),
		undefined,
		['user-guest'],
	);
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
		const otherUser = autumndbTestUtils.generateRandomId();
		assert(user.id !== otherUser);

		await expect(
			actionCreateCard.handler(
				{ actor: user },
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

		await expect(
			actionCreateCard.handler(
				{ actor: user },
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
				{ actor: guestUser },
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
				{ actor: guestUser },
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
				{ actor: user },
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
		).rejects.toThrow(autumndbErrors.JellyfishPermissionsError);
	});

	test('users should not be able to create action requests', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomId().split('-')[0],
		);

		await expect(
			actionCreateCard.handler(
				{ actor: user },
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

	test('should create specified links', async () => {
		// Create an org
		const org = await ctx.createOrg(autumndbTestUtils.generateRandomId());

		const pattern = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'pattern@1.0.0',
			'My pattern',
			{
				status: 'open',
			},
		);

		// Create a user with link to org
		const request = makeRequest(ctx, {
			properties: {
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'user@1.0.0',
				data: {
					roles: [],
				},
				links: {
					'is member of': [
						{
							id: org.id,
							slug: org.slug,
							type: 'org@1.0.0',
						},
					],
					owns: [
						{
							id: pattern.id,
							slug: pattern.slug,
							type: pattern.type,
						},
					],
				},
			},
		});

		const result: any = await actionCreateCard.handler(
			ctx.session,
			actionContext,
			ctx.worker.typeContracts['user@1.0.0'],
			request,
		);
		assert(result);

		await ctx.waitForMatch({
			type: 'object',
			properties: {
				id: {
					type: 'string',
					const: result.id,
				},
			},
			$$links: {
				'is member of': {
					type: 'object',
					properties: {
						id: {
							const: org.id,
						},
					},
				},
				owns: {
					type: 'object',
					properties: {
						id: {
							const: pattern.id,
						},
					},
				},
			},
		});
	});

	test('should throw on invalid link name', async () => {
		// Create an org
		const org = await ctx.createOrg(autumndbTestUtils.generateRandomId());

		// Create a user with link to org
		const request = makeRequest(ctx, {
			properties: {
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'user@1.0.0',
				data: {
					roles: [],
				},
				links: {
					foobar: [
						{
							id: org.id,
							slug: org.slug,
							type: org.type,
						},
					],
				},
			},
		});

		await expect(() => {
			return actionCreateCard.handler(
				ctx.session,
				actionContext,
				ctx.worker.typeContracts['user@1.0.0'],
				request,
			);
		}).rejects.toThrowError(errors.SyncNoElement);
	});

	test('should throw on non-existent target contract', async () => {
		// Create a user with link to non-existent org
		const request = makeRequest(ctx, {
			properties: {
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'user@1.0.0',
				data: {
					roles: [],
				},
				links: {
					'is member of': [
						{
							id: uuidv4(),
							slug: `org-${uuidv4()}`,
							type: 'org@1.0.0',
						},
					],
				},
			},
		});

		await expect(() => {
			return actionCreateCard.handler(
				ctx.session,
				actionContext,
				ctx.worker.typeContracts['user@1.0.0'],
				request,
			);
		}).rejects.toThrowError(errors.SyncNoElement);
	});

	test('should throw on invalid relationship', async () => {
		// Attempt to link one user to another with "is member of" link
		const otherUser = await ctx.createUser(
			autumndbTestUtils.generateRandomId().split('-')[0],
		);
		const request = makeRequest(ctx, {
			properties: {
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'user@1.0.0',
				data: {
					roles: [],
				},
				links: {
					'is member of': [
						{
							id: otherUser.id,
							slug: otherUser.slug,
							type: otherUser.type,
						},
					],
				},
			},
		});

		await expect(() => {
			return actionCreateCard.handler(
				ctx.session,
				actionContext,
				ctx.worker.typeContracts['user@1.0.0'],
				request,
			);
		}).rejects.toThrowError(errors.SyncNoElement);
	});

	test('operators should be able to create user contracts', async () => {
		const operator = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: ['user-community', 'user-operator'],
			},
		);

		const request = makeRequest(ctx, {
			properties: {
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'user@1.0.0',
				data: {
					roles: ['user-community'],
				},
			},
		});
		request.actor = operator.id;
		const result: any = await actionCreateCard.handler(
			{ actor: operator },
			actionContext,
			ctx.worker.typeContracts['user@1.0.0'],
			request,
		);
		assert(result);
		expect(result.slug).toEqual(request.arguments.properties.slug);
	});

	test('operators should not be able to create admin user contracts', async () => {
		const operator = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: ['user-community', 'user-operator'],
			},
		);

		const request = makeRequest(ctx, {
			properties: {
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'user@1.0.0',
				data: {
					roles: ['user-admin'],
				},
			},
		});
		request.actor = operator.id;
		await expect(() => {
			return actionCreateCard.handler(
				{ actor: operator },
				actionContext,
				ctx.worker.typeContracts['user@1.0.0'],
				request,
			);
		}).rejects.toThrow();
	});

	test('operators should not be able to create guest user contracts', async () => {
		const operator = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: ['user-community', 'user-operator'],
			},
		);

		const request = makeRequest(ctx, {
			properties: {
				slug: autumndbTestUtils.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'user@1.0.0',
				data: {
					roles: ['user-guest'],
				},
			},
		});
		request.actor = operator.id;
		await expect(() => {
			return actionCreateCard.handler(
				{ actor: operator },
				actionContext,
				ctx.worker.typeContracts['user@1.0.0'],
				request,
			);
		}).rejects.toThrow();
	});
});
